import { ArrowRight, BookOpen, MessageSquare, RefreshCw } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { discussionsApi, getErrorMessage, requestsApi, resolveBookImageUrl } from '../lib/api';
import { CITY_PRESETS } from '../lib/cities';
import type { BookListing, BookQuestion, BookRequest, BookReview } from '../types';

type ActivityFilter = 'all' | 'city' | 'reviewed' | 'requests';

interface ActivityEntry {
  id: string;
  category: 'city' | 'reviewed' | 'request';
  kicker: string;
  title: string;
  detail: string;
  timestamp: string;
  to: string;
  imageUrl?: string;
}

function formatRelativeTime(isoDate: string): string {
  const ms = new Date(isoDate).getTime();
  if (Number.isNaN(ms)) return 'Recently';
  const diffSec = Math.max(0, Math.floor((Date.now() - ms) / 1000));
  if (diffSec < 60) return 'Just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 30) return `${diffDay}d ago`;
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(new Date(ms));
}

export function RecentActivityDashboard({
  books,
  loadingBooks,
  onRefreshBooks,
}: {
  books: BookListing[];
  loadingBooks: boolean;
  onRefreshBooks: () => Promise<void> | void;
}) {
  const { user, authReady, isAuthenticated } = useAuth();

  const [cityOverride, setCityOverride] = useState<string | null>(null);
  const selectedCity = cityOverride ?? user?.city ?? 'Quetta';

  const [activeFilter, setActiveFilter] = useState<ActivityFilter>('all');
  const [reviewsByBook, setReviewsByBook] = useState<Record<string, BookReview[]>>({});
  const [questionsByBook, setQuestionsByBook] = useState<Record<string, BookQuestion[]>>({});
  const [incomingRequests, setIncomingRequests] = useState<BookRequest[]>([]);
  const [outgoingRequests, setOutgoingRequests] = useState<BookRequest[]>([]);
  const [loadingActivity, setLoadingActivity] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const bookIdsKey = useMemo(
    () => books.slice(0, 12).map((b) => b.id).join(','),
    [books],
  );

  const loadActivity = useCallback(async () => {
    const ids = bookIdsKey ? bookIdsKey.split(',').filter(Boolean) : [];
    setLoadingActivity(true);
    setError(null);
    try {
      const [discussionSummary, inData, outData] = await Promise.all([
        ids.length > 0
          ? discussionsApi.listSummaryForBooks(ids)
          : Promise.resolve({ reviewsByBook: {}, questionsByBook: {} }),
        authReady && isAuthenticated && user?.id
          ? requestsApi.incoming()
          : Promise.resolve({ requests: [] }),
        authReady && isAuthenticated && user?.id
          ? requestsApi.outgoing()
          : Promise.resolve({ requests: [] }),
      ]);

      setReviewsByBook(discussionSummary.reviewsByBook);
      setQuestionsByBook(discussionSummary.questionsByBook);
      setIncomingRequests(inData.requests);
      setOutgoingRequests(outData.requests);
    } catch (err) {
      setError(getErrorMessage(err, 'Unable to load recent activity updates.'));
    } finally {
      setLoadingActivity(false);
    }
  }, [bookIdsKey, authReady, isAuthenticated, user?.id]);

  useEffect(() => {
    if (!authReady || loadingBooks) return;
    void loadActivity();
  }, [authReady, loadingBooks, loadActivity]);

  const handleRefreshAll = async () => {
    await Promise.all([Promise.resolve(onRefreshBooks()), loadActivity()]);
  };

  const {
    cityBooks,
    reviewedBookIds,
    reviewedUpdateCount,
    totalCommunityReviews,
    totalCommunityQuestions,
    allEntries,
  } = useMemo(() => {
    const normalizedCity = selectedCity.trim().toLowerCase();
    const cityMatches = books.filter((b) => b.city.trim().toLowerCase() === normalizedCity);

    const bookById = new Map<string, BookListing>();
    for (const b of books) {
      bookById.set(b.id, b);
    }

    const entries: ActivityEntry[] = [];

    for (const book of cityMatches) {
      const locationLabel = book.neighborhood ? `${book.neighborhood}, ${book.city}` : book.city;
      const offerSummary =
        book.listingType === 'Sell'
          ? `${book.price.toLocaleString()} ${book.currency}`
          : book.listingType === 'Exchange'
            ? book.exchangeFor
              ? `Swap for: ${book.exchangeFor}`
              : 'Open to book swap'
            : book.price > 0
              ? `Budget up to ${book.price.toLocaleString()} ${book.currency}`
              : 'Wanted by reader';

      entries.push({
        id: `city-${book.id}`,
        category: 'city',
        kicker: `New in ${book.city} · ${book.listingType} · ${book.language}`,
        title: `${book.title} by ${book.author}`,
        detail: `${offerSummary} · Posted by ${book.ownerName} in ${locationLabel}`,
        timestamp: book.createdAt,
        to: `/books/${book.id}`,
        imageUrl: book.imageUrl,
      });
    }

    const userReviewedIds = new Set<string>();
    let updatesOnReviewed = 0;
    let communityReviews = 0;
    let communityQuestions = 0;

    for (const book of books.slice(0, 12)) {
      const revs = reviewsByBook[book.id] || [];
      const qs = questionsByBook[book.id] || [];
      communityReviews += revs.length;
      communityQuestions += qs.length;

      if (user?.id) {
        const myReview = revs.find((r) => r.authorId === user.id);
        if (myReview) {
          userReviewedIds.add(book.id);

          if (
            book.updatedAt &&
            new Date(book.updatedAt).getTime() > new Date(myReview.createdAt).getTime()
          ) {
            updatesOnReviewed += 1;
            entries.push({
              id: `rev-book-update-${book.id}`,
              category: 'reviewed',
              kicker: `Reviewed book updated · ${book.listingType} · ${book.city}`,
              title: book.title,
              detail: `${book.ownerName} updated this listing (${book.condition}${
                book.listingType === 'Sell' ? ` · ${book.price.toLocaleString()} ${book.currency}` : ''
              })`,
              timestamp: book.updatedAt,
              to: `/books/${book.id}`,
              imageUrl: book.imageUrl,
            });
          }

          let bookHasExternalUpdate = false;
          for (const rev of revs) {
            if (rev.authorId !== user.id) {
              bookHasExternalUpdate = true;
              updatesOnReviewed += 1;
              const pageSuffix =
                !rev.finishedReading && rev.currentPage
                  ? ` · Reading p. ${rev.currentPage}${rev.totalPages ? `/${rev.totalPages}` : ''}`
                  : '';
              entries.push({
                id: `rev-peer-${rev.id}`,
                category: 'reviewed',
                kicker: `New review on a book you reviewed · ${rev.rating}/5 stars${pageSuffix}`,
                title: book.title,
                detail: `${rev.authorName}: "${rev.comment}"`,
                timestamp: rev.updatedAt || rev.createdAt,
                to: `/books/${book.id}`,
                imageUrl: book.imageUrl,
              });
            }
          }

          for (const q of qs) {
            if (q.authorId !== user.id) {
              bookHasExternalUpdate = true;
              updatesOnReviewed += 1;
              entries.push({
                id: `rev-question-${q.id}`,
                category: 'reviewed',
                kicker: 'New question on a book you reviewed',
                title: book.title,
                detail: `${q.authorName} asked: "${q.question}"`,
                timestamp: q.createdAt,
                to: `/books/${book.id}`,
                imageUrl: book.imageUrl,
              });
            }
          }

          if (!bookHasExternalUpdate) {
            const myPageSuffix =
              !myReview.finishedReading && myReview.currentPage
                ? ` · Page ${myReview.currentPage}${myReview.totalPages ? `/${myReview.totalPages}` : ''}`
                : '';
            entries.push({
              id: `rev-self-${myReview.id}`,
              category: 'reviewed',
              kicker: `${myReview.finishedReading ? 'Your review' : 'Currently reading'} · ${myReview.rating}/5 stars${myPageSuffix} · ${book.city}`,
              title: book.title,
              detail: `"${myReview.comment}"`,
              timestamp: myReview.updatedAt || myReview.createdAt,
              to: `/books/${book.id}`,
              imageUrl: book.imageUrl,
            });
          }
        }
      }
    }

    if (!user?.id || userReviewedIds.size === 0) {
      for (const book of books.slice(0, 12)) {
        const revs = reviewsByBook[book.id] || [];
        const qs = questionsByBook[book.id] || [];
        for (const rev of revs.slice(0, 2)) {
          const pageLabel =
            !rev.finishedReading && rev.currentPage
              ? `Currently reading (p. ${rev.currentPage}${rev.totalPages ? `/${rev.totalPages}` : ''})`
              : 'Reader review';
          entries.push({
            id: `comm-rev-${rev.id}`,
            category: 'reviewed',
            kicker: `${pageLabel} · ${rev.rating}/5 stars · ${book.city}`,
            title: book.title,
            detail: `${rev.authorName}: "${rev.comment}"`,
            timestamp: rev.updatedAt || rev.createdAt,
            to: `/books/${book.id}`,
            imageUrl: book.imageUrl,
          });
        }
        for (const q of qs.slice(0, 1)) {
          entries.push({
            id: `comm-q-${q.id}`,
            category: 'reviewed',
            kicker: `Reader question · ${book.city}`,
            title: book.title,
            detail: `${q.authorName} asked: "${q.question}"`,
            timestamp: q.createdAt,
            to: `/books/${book.id}`,
            imageUrl: book.imageUrl,
          });
        }
      }
    }

    if (user?.id) {
      for (const reqItem of incomingRequests) {
        const book = bookById.get(reqItem.bookId);
        entries.push({
          id: `req-in-${reqItem.id}`,
          category: 'request',
          kicker: `Incoming ${reqItem.bookType} request · ${reqItem.status}`,
          title: reqItem.bookTitle,
          detail: `From ${reqItem.requesterName} (${reqItem.requesterCity}): "${reqItem.message}"`,
          timestamp: reqItem.createdAt,
          to: '/my-listings',
          imageUrl: reqItem.bookImageUrl || book?.imageUrl,
        });
      }

      for (const reqItem of outgoingRequests) {
        const book = bookById.get(reqItem.bookId);
        entries.push({
          id: `req-out-${reqItem.id}`,
          category: 'request',
          kicker: `Your ${reqItem.bookType} request · ${reqItem.status}`,
          title: reqItem.bookTitle,
          detail: `Sent to ${reqItem.ownerName}: "${reqItem.message}"`,
          timestamp: reqItem.createdAt,
          to: '/my-listings',
          imageUrl: reqItem.bookImageUrl || book?.imageUrl,
        });
      }
    }

    entries.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    return {
      cityBooks: cityMatches,
      reviewedBookIds: userReviewedIds,
      reviewedUpdateCount: updatesOnReviewed,
      totalCommunityReviews: communityReviews,
      totalCommunityQuestions: communityQuestions,
      allEntries: entries,
    };
  }, [books, selectedCity, reviewsByBook, questionsByBook, incomingRequests, outgoingRequests, user?.id]);

  const filteredEntries = useMemo(() => {
    if (activeFilter === 'all') return allEntries.slice(0, 8);
    return allEntries.filter((item) => item.category === activeFilter).slice(0, 8);
  }, [allEntries, activeFilter]);

  const pendingRequestCount = useMemo(
    () =>
      incomingRequests.filter((r) => r.status === 'Pending').length +
      outgoingRequests.filter((r) => r.status === 'Pending').length,
    [incomingRequests, outgoingRequests],
  );

  const isLoading = loadingBooks || loadingActivity;

  const filterTabs: { id: ActivityFilter; label: string }[] = [
    { id: 'all', label: 'All activity' },
    { id: 'city', label: `In ${selectedCity}` },
    { id: 'reviewed', label: isAuthenticated ? 'Reviewed books' : 'Reader discussions' },
    ...(isAuthenticated ? [{ id: 'requests' as const, label: 'Requests' }] : []),
  ];

  return (
    <section
      aria-label="Recent activity dashboard"
      className="max-w-6xl mx-auto px-4 sm:px-6 py-12 border-t border-[#E5DFD3] space-y-6"
    >
      {/* Header & Controls */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div>
          <h2 className="font-display text-2xl sm:text-3xl font-bold text-[#1C1F1D]">
            Recent activity
          </h2>
          <p className="text-sm sm:text-base text-[#5C615D] mt-1">
            {isAuthenticated
              ? `New listings in ${selectedCity}, updates on books you have reviewed, and request activity.`
              : `Latest listings in ${selectedCity} and recent community book discussions.`}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <label htmlFor="activityCitySelect" className="text-xs font-medium text-[#5C615D]">
              City
            </label>
            <select
              id="activityCitySelect"
              value={selectedCity}
              onChange={(e) => setCityOverride(e.target.value)}
              className="h-9 px-3 rounded-lg bg-[#FFFFFF] border border-[#E5DFD3] text-sm font-medium text-[#1C1F1D] focus:outline-none focus:border-[#1B4D3E]"
            >
              {CITY_PRESETS.map((preset) => (
                <option key={preset.name} value={preset.name}>
                  {preset.name}
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            disabled={isLoading}
            onClick={() => void handleRefreshAll()}
            className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg border border-[#E5DFD3] bg-[#FFFFFF] text-xs font-semibold text-[#1C1F1D] hover:bg-[#F3EFE6] disabled:opacity-60 transition-colors cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} aria-hidden="true" />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Summary Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-xl border border-[#E5DFD3] bg-[#FFFFFF] p-4 space-y-1">
          <p className="text-xs text-[#5C615D]">Listings in {selectedCity}</p>
          <p className="font-display text-2xl sm:text-3xl font-bold text-[#1B4D3E] tabular-nums">
            {cityBooks.length}
          </p>
          <p className="text-xs text-[#5C615D]">Active copies nearby</p>
        </div>

        <div className="rounded-xl border border-[#E5DFD3] bg-[#FFFFFF] p-4 space-y-1">
          <p className="text-xs text-[#5C615D]">
            {isAuthenticated ? 'Books you reviewed' : 'Community reviews'}
          </p>
          <p className="font-display text-2xl sm:text-3xl font-bold text-[#1C1F1D] tabular-nums">
            {isAuthenticated ? reviewedBookIds.size : totalCommunityReviews}
          </p>
          <p className="text-xs text-[#5C615D]">
            {isAuthenticated ? 'Tracked for new activity' : 'Shared by readers'}
          </p>
        </div>

        <div className="rounded-xl border border-[#E5DFD3] bg-[#FFFFFF] p-4 space-y-1">
          <p className="text-xs text-[#5C615D]">
            {isAuthenticated ? 'Updates on reviewed' : 'Reader questions'}
          </p>
          <p className="font-display text-2xl sm:text-3xl font-bold text-[#1C1F1D] tabular-nums">
            {isAuthenticated ? reviewedUpdateCount : totalCommunityQuestions}
          </p>
          <p className="text-xs text-[#5C615D]">
            {isAuthenticated ? 'New reviews, Q&A & edits' : 'Open discussions'}
          </p>
        </div>

        <div className="rounded-xl border border-[#E5DFD3] bg-[#FFFFFF] p-4 space-y-1">
          <p className="text-xs text-[#5C615D]">
            {isAuthenticated ? 'Pending requests' : 'Community catalog'}
          </p>
          <p className="font-display text-2xl sm:text-3xl font-bold text-[#1C1F1D] tabular-nums">
            {isAuthenticated ? pendingRequestCount : books.length}
          </p>
          <p className="text-xs text-[#5C615D]">
            {isAuthenticated ? 'Incoming & sent offers' : 'Total active listings'}
          </p>
        </div>
      </div>

      {/* Filter Tabs */}
      <div
        className="inline-flex flex-wrap items-center gap-1 p-1 bg-[#F3EFE6] border border-[#E5DFD3] rounded-lg"
        role="tablist"
        aria-label="Filter recent activity"
      >
        {filterTabs.map((tab) => {
          const active = activeFilter === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setActiveFilter(tab.id)}
              className={`px-3.5 py-1.5 text-xs sm:text-sm font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                active
                  ? 'bg-[#1B4D3E] text-[#FAF7F2]'
                  : 'text-[#5C615D] hover:text-[#1C1F1D]'
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Activity Feed */}
      {error ? (
        <div className="rounded-xl border border-[#E5DFD3] bg-[#FFFFFF] p-6 flex flex-wrap items-center justify-between gap-4">
          <p className="text-sm text-red-700">{error}</p>
          <button
            type="button"
            onClick={() => void handleRefreshAll()}
            className="px-4 py-2 rounded-lg border border-[#1B4D3E] text-xs font-semibold text-[#1B4D3E] hover:bg-[#F3EFE6] cursor-pointer"
          >
            Try Again
          </button>
        </div>
      ) : isLoading ? (
        <div className="rounded-xl border border-[#E5DFD3] bg-[#FFFFFF] divide-y divide-[#E5DFD3] animate-pulse">
          {[1, 2, 3].map((row) => (
            <div key={row} className="p-4 flex items-center gap-4">
              <div className="w-11 h-14 rounded-lg bg-[#F3EFE6] shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="h-3 w-40 bg-[#F3EFE6] rounded" />
                <div className="h-4 w-2/3 bg-[#F3EFE6] rounded" />
                <div className="h-3 w-1/2 bg-[#F3EFE6] rounded" />
              </div>
            </div>
          ))}
        </div>
      ) : filteredEntries.length === 0 ? (
        <div className="rounded-xl border border-[#E5DFD3] bg-[#FFFFFF] p-8 text-center space-y-3">
          <p className="font-display text-lg font-semibold text-[#1C1F1D]">
            {activeFilter === 'city'
              ? `No recent listings in ${selectedCity} yet`
              : activeFilter === 'reviewed'
                ? 'No updates on reviewed books yet'
                : activeFilter === 'requests'
                  ? 'No swap or purchase requests yet'
                  : 'No recent activity yet'}
          </p>
          <p className="text-sm text-[#5C615D] max-w-md mx-auto">
            {activeFilter === 'reviewed' && isAuthenticated
              ? 'Leave a review on any book page to track new reader reviews, questions, and listing edits here.'
              : `Post a book in ${selectedCity} or browse nearby shelves to start exchanging with readers.`}
          </p>
          <div className="flex flex-wrap justify-center gap-3 pt-1">
            <Link
              to="/browse"
              className="px-4 py-2 rounded-lg border border-[#1B4D3E] text-[#1B4D3E] text-xs font-semibold hover:bg-[#F3EFE6]"
            >
              Browse Books
            </Link>
            <Link
              to="/post"
              className="px-4 py-2 rounded-lg bg-[#1B4D3E] text-[#FAF7F2] text-xs font-semibold hover:bg-[#143A2F]"
            >
              Post a Book
            </Link>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-[#E5DFD3] bg-[#FFFFFF] divide-y divide-[#E5DFD3]">
          {filteredEntries.map((item) => (
            <Link
              key={item.id}
              to={item.to}
              className="p-4 sm:px-5 flex items-center gap-4 hover:bg-[#FAF7F2] transition-colors group"
            >
              <div className="w-11 aspect-[3/4] rounded-lg overflow-hidden bg-[#F3EFE6] border border-[#E5DFD3] shrink-0 flex items-center justify-center">
                {item.imageUrl ? (
                  <img
                    src={resolveBookImageUrl(item.imageUrl)}
                    alt={item.title}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover"
                  />
                ) : item.category === 'reviewed' ? (
                  <MessageSquare className="w-4 h-4 text-[#1B4D3E]" aria-hidden="true" />
                ) : (
                  <BookOpen className="w-4 h-4 text-[#1B4D3E]" aria-hidden="true" />
                )}
              </div>

              <div className="min-w-0 flex-1 space-y-0.5">
                <div className="flex flex-wrap items-center gap-2 text-xs text-[#5C615D]">
                  <span className="font-semibold text-[#1B4D3E]">{item.kicker}</span>
                  <span aria-hidden="true">·</span>
                  <span className="tabular-nums">{formatRelativeTime(item.timestamp)}</span>
                </div>
                <p className="font-display text-base font-semibold text-[#1C1F1D] truncate">
                  {item.title}
                </p>
                <p className="text-xs sm:text-sm text-[#5C615D] line-clamp-1">{item.detail}</p>
              </div>

              <ArrowRight
                className="w-4 h-4 text-[#5C615D] group-hover:text-[#1B4D3E] shrink-0 transition-colors"
                aria-hidden="true"
              />
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
