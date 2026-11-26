import { BookOpen, Calendar, Mail, MapPin, Plus } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { authApi, booksApi, getErrorMessage, resolveBookImageUrl } from '../lib/api';
import { CITY_PRESETS } from '../lib/cities';
import type { BookListing, UserPublic } from '../types';

function formatJoinDate(isoDate: string): string {
  const parsed = new Date(isoDate);
  if (Number.isNaN(parsed.getTime())) {
    return 'Recently joined';
  }
  return new Intl.DateTimeFormat('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(parsed);
}

export function ProfilePage() {
  const { user: sessionUser, authReady, isAuthenticated, updateCity } = useAuth();
  const [profile, setProfile] = useState<UserPublic | null>(sessionUser);
  const [books, setBooks] = useState<BookListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingCity, setSavingCity] = useState(false);
  const [citySaved, setCitySaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadProfile = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [meData, booksData] = await Promise.all([authApi.me(), booksApi.mine()]);
      setProfile(meData.user);
      setBooks(Array.isArray(booksData.books) ? booksData.books : []);
    } catch (err) {
      setError(getErrorMessage(err, 'Could not load your profile details.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    document.title = 'My Profile — KitabWanag';
    if (!authReady || !isAuthenticated || !sessionUser?.id) {
      return;
    }
    void loadProfile();

    const unsub = booksApi.subscribeMine(
      sessionUser.id,
      (nextBooks) => {
        setBooks(nextBooks);
      },
      (err) => {
        setError(getErrorMessage(err, 'Could not sync your book shelf.'));
      },
    );
    return () => unsub();
  }, [authReady, isAuthenticated, sessionUser?.id, loadProfile]);

  const handleCityChange = async (newCity: string) => {
    setSavingCity(true);
    setCitySaved(false);
    setError(null);
    try {
      await updateCity(newCity);
      setProfile((prev) => (prev ? { ...prev, city: newCity } : prev));
      setCitySaved(true);
    } catch (err) {
      setError(getErrorMessage(err, 'Could not update your city.'));
    } finally {
      setSavingCity(false);
    }
  };

  const counts = useMemo(() => {
    const exchange = books.filter((b) => b.listingType === 'Exchange').length;
    const sale = books.filter((b) => b.listingType === 'Sell').length;
    const wanted = books.filter((b) => b.listingType === 'Buy').length;
    return {
      exchange,
      sale,
      wanted,
      exchangeOrSale: exchange + sale,
    };
  }, [books]);

  const exchangeAndSaleBooks = useMemo(
    () => books.filter((b) => b.listingType === 'Exchange' || b.listingType === 'Sell'),
    [books],
  );

  const displayUser = profile ?? sessionUser;

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10 space-y-10">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-6 border-b border-[#E5DFD3]">
        <div>
          <p className="text-sm font-medium text-[#1B4D3E]">Reader profile</p>
          <h1 className="font-display text-3xl sm:text-4xl font-bold text-[#1C1F1D] mt-1">
            {displayUser?.name || 'Your Profile'}
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-3 self-start sm:self-auto">
          <Link
            to="/my-listings"
            className="px-4 py-2.5 rounded-lg border border-[#1B4D3E] text-[#1B4D3E] text-sm font-semibold hover:bg-[#F3EFE6] transition-colors whitespace-nowrap"
          >
            Manage Listings
          </Link>
          <Link
            to="/post"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#1B4D3E] text-[#FAF7F2] text-sm font-semibold hover:bg-[#143A2F] transition-colors whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            Post a Book
          </Link>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-5 py-4 flex flex-wrap items-center justify-between gap-3 text-sm text-red-700">
          <span>{error}</span>
          <button
            type="button"
            onClick={() => void loadProfile()}
            className="px-4 py-2 rounded-lg border border-red-300 bg-white text-xs font-semibold text-red-700 hover:bg-red-100 cursor-pointer"
          >
            Try Again
          </button>
        </div>
      )}

      {loading ? (
        <div className="space-y-6 animate-pulse">
          <div className="h-44 rounded-xl bg-[#F3EFE6]" />
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="h-28 rounded-xl bg-[#F3EFE6]" />
            <div className="h-28 rounded-xl bg-[#F3EFE6]" />
            <div className="h-28 rounded-xl bg-[#F3EFE6]" />
          </div>
        </div>
      ) : (
        <>
          {/* Member Details & Listing Stats */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
            <section
              aria-label="Account details"
              className="lg:col-span-5 rounded-xl border border-[#E5DFD3] bg-[#FFFFFF] p-6 space-y-4"
            >
              <h2 className="font-display text-xl font-semibold text-[#1C1F1D] pb-3 border-b border-[#E5DFD3]">
                Member details
              </h2>

              <dl className="space-y-3.5 text-sm">
                <div className="flex items-start gap-3">
                  <Mail className="w-4 h-4 text-[#1B4D3E] mt-0.5 shrink-0" aria-hidden="true" />
                  <div className="min-w-0">
                    <dt className="text-xs text-[#5C615D]">Email</dt>
                    <dd className="font-medium text-[#1C1F1D] truncate">
                      {displayUser?.email || '—'}
                    </dd>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <MapPin className="w-4 h-4 text-[#1B4D3E] mt-0.5 shrink-0" aria-hidden="true" />
                  <div className="flex-1 min-w-0 space-y-1">
                    <label htmlFor="profileCitySelect" className="block text-xs text-[#5C615D]">
                      City
                    </label>
                    <div className="flex items-center gap-2">
                      <select
                        id="profileCitySelect"
                        value={displayUser?.city || 'Quetta'}
                        disabled={savingCity}
                        onChange={(e) => void handleCityChange(e.target.value)}
                        className="h-9 px-2.5 rounded-lg bg-[#FAF7F2] border border-[#E5DFD3] text-sm font-medium text-[#1C1F1D] focus:outline-none focus:border-[#1B4D3E]"
                      >
                        {CITY_PRESETS.map((c) => (
                          <option key={c.name} value={c.name}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                      {citySaved && (
                        <span className="text-xs text-[#1B4D3E] font-medium">Saved</span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Calendar className="w-4 h-4 text-[#1B4D3E] mt-0.5 shrink-0" aria-hidden="true" />
                  <div>
                    <dt className="text-xs text-[#5C615D]">Member since</dt>
                    <dd className="font-medium text-[#1C1F1D]">
                      {displayUser?.createdAt ? formatJoinDate(displayUser.createdAt) : '—'}
                    </dd>
                  </div>
                </div>
              </dl>
            </section>

            <section
              aria-label="Book listing summary"
              className="lg:col-span-7 rounded-xl border border-[#E5DFD3] bg-[#FFFFFF] p-6 flex flex-col justify-between space-y-6"
            >
              <div className="pb-3 border-b border-[#E5DFD3] flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="font-display text-xl font-semibold text-[#1C1F1D]">
                  Books listed for exchange or sale
                </h2>
                <span className="text-xs text-[#5C615D] tabular-nums">
                  {books.length} total {books.length === 1 ? 'listing' : 'listings'}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="rounded-lg bg-[#FAF7F2] border border-[#E5DFD3] p-4 space-y-1">
                  <p className="text-xs text-[#5C615D]">Exchange or Sale</p>
                  <p className="font-display text-3xl font-bold text-[#1B4D3E] tabular-nums">
                    {counts.exchangeOrSale}
                  </p>
                  <p className="text-xs text-[#5C615D]">Active copies offered</p>
                </div>

                <div className="rounded-lg bg-[#FAF7F2] border border-[#E5DFD3] p-4 space-y-1">
                  <p className="text-xs text-[#5C615D]">For Exchange</p>
                  <p className="font-display text-3xl font-bold text-[#1C1F1D] tabular-nums">
                    {counts.exchange}
                  </p>
                  <p className="text-xs text-[#5C615D]">Open for swap</p>
                </div>

                <div className="rounded-lg bg-[#FAF7F2] border border-[#E5DFD3] p-4 space-y-1">
                  <p className="text-xs text-[#5C615D]">For Sale</p>
                  <p className="font-display text-3xl font-bold text-[#1C1F1D] tabular-nums">
                    {counts.sale}
                  </p>
                  <p className="text-xs text-[#5C615D]">Priced copies</p>
                </div>
              </div>

              {counts.wanted > 0 && (
                <p className="text-xs text-[#5C615D] tabular-nums">
                  You also have {counts.wanted} wanted {counts.wanted === 1 ? 'book' : 'books'}{' '}
                  posted under Buy requests.
                </p>
              )}
            </section>
          </div>

          {/* User's Exchange & Sale Books */}
          <section className="space-y-4">
            <div className="flex items-baseline justify-between">
              <h2 className="font-display text-2xl font-bold text-[#1C1F1D]">
                Your exchange &amp; sale shelf
              </h2>
              <Link
                to="/my-listings"
                className="text-sm font-semibold text-[#1B4D3E] hover:underline"
              >
                Edit or remove listings
              </Link>
            </div>

            {exchangeAndSaleBooks.length === 0 ? (
              <div className="rounded-xl border border-[#E5DFD3] bg-[#FFFFFF] p-8 text-center space-y-3">
                <BookOpen className="w-8 h-8 text-[#1B4D3E]/70 mx-auto" aria-hidden="true" />
                <p className="font-display text-xl font-semibold text-[#1C1F1D]">
                  No books listed for exchange or sale yet
                </p>
                <p className="text-sm text-[#5C615D] max-w-md mx-auto">
                  Share a book you have finished reading so neighbors in {displayUser?.city || 'your city'} can swap or buy it.
                </p>
                <Link
                  to="/post"
                  className="inline-flex mt-2 px-5 py-2.5 rounded-lg bg-[#1B4D3E] text-[#FAF7F2] text-sm font-semibold"
                >
                  Post a Book
                </Link>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {exchangeAndSaleBooks.map((book) => (
                  <Link
                    key={book.id}
                    to={`/books/${book.id}`}
                    className="rounded-xl border border-[#E5DFD3] bg-[#FFFFFF] p-4 flex gap-4 items-start hover:border-[#1B4D3E] transition-colors"
                  >
                    <div className="w-16 aspect-[3/4] rounded-lg overflow-hidden bg-[#F3EFE6] border border-[#E5DFD3] shrink-0">
                      {book.imageUrl ? (
                        <img
                          src={resolveBookImageUrl(book.imageUrl)}
                          alt={book.title}
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <BookOpen className="w-5 h-5 text-[#1B4D3E]" />
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex items-center gap-2 text-xs text-[#5C615D]">
                        <span className="font-semibold text-[#1B4D3E]">{book.listingType}</span>
                        <span aria-hidden="true">·</span>
                        <span>{book.language}</span>
                        <span aria-hidden="true">·</span>
                        <span>{book.city}</span>
                      </div>
                      <h3 className="font-display text-base font-semibold text-[#1C1F1D] line-clamp-1">
                        {book.title}
                      </h3>
                      <p className="text-xs text-[#5C615D] truncate">{book.author}</p>
                      <p className="text-xs font-semibold text-[#1C1F1D] pt-1 tabular-nums">
                        {book.listingType === 'Sell'
                          ? `${book.price.toLocaleString()} ${book.currency}`
                          : book.exchangeFor
                            ? `Swap for: ${book.exchangeFor}`
                            : 'Open to book swap'}
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
