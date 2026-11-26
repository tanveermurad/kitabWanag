import { Check, Pencil, Plus, Trash2, X } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { booksApi, getErrorMessage, requestsApi, resolveBookImageUrl } from '../lib/api';
import type { BookListing, BookRequest, RequestStatus } from '../types';

export function MyListingsPage() {
  const { user, authReady, isAuthenticated } = useAuth();
  const [books, setBooks] = useState<BookListing[]>([]);
  const [incoming, setIncoming] = useState<BookRequest[]>([]);
  const [outgoing, setOutgoing] = useState<BookRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [booksData, inData, outData] = await Promise.all([
        booksApi.mine(),
        requestsApi.incoming(),
        requestsApi.outgoing(),
      ]);
      setBooks(Array.isArray(booksData.books) ? booksData.books : []);
      setIncoming(Array.isArray(inData.requests) ? inData.requests : []);
      setOutgoing(Array.isArray(outData.requests) ? outData.requests : []);
    } catch (err) {
      setError(getErrorMessage(err, 'Unable to load dashboard.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    document.title = 'My Listings — KitabWanag';
    if (!authReady || !isAuthenticated || !user?.id) {
      return;
    }

    setLoading(true);
    setError(null);
    let booksLoaded = false;
    let incomingLoaded = false;
    let outgoingLoaded = false;
    const markReady = () => {
      if (booksLoaded && incomingLoaded && outgoingLoaded) {
        setLoading(false);
      }
    };

    const unsubBooks = booksApi.subscribeMine(
      user.id,
      (nextBooks) => {
        setBooks(nextBooks);
        booksLoaded = true;
        markReady();
      },
      (err) => {
        setError(getErrorMessage(err, 'Unable to load your book listings.'));
        setLoading(false);
      },
    );

    const unsubIncoming = requestsApi.subscribeIncoming(
      user.id,
      (nextIncoming) => {
        setIncoming(nextIncoming);
        incomingLoaded = true;
        markReady();
      },
      (err) => {
        setError(getErrorMessage(err, 'Unable to load incoming requests.'));
        setLoading(false);
      },
    );

    const unsubOutgoing = requestsApi.subscribeOutgoing(
      user.id,
      (nextOutgoing) => {
        setOutgoing(nextOutgoing);
        outgoingLoaded = true;
        markReady();
      },
      (err) => {
        setError(getErrorMessage(err, 'Unable to load outgoing requests.'));
        setLoading(false);
      },
    );

    return () => {
      unsubBooks();
      unsubIncoming();
      unsubOutgoing();
    };
  }, [authReady, isAuthenticated, user?.id]);

  const handleDeleteBook = async (bookId: string) => {
    try {
      await booksApi.remove(bookId);
      setBooks((prev) => prev.filter((b) => b.id !== bookId));
      setIncoming((prev) => prev.filter((r) => r.bookId !== bookId));
      setConfirmDeleteId(null);
    } catch (err) {
      setError(getErrorMessage(err, 'Delete failed.'));
    }
  };

  const handleUpdateRequestStatus = async (requestId: string, status: RequestStatus) => {
    try {
      const data = await requestsApi.updateStatus(requestId, status);
      setIncoming((prev) => prev.map((r) => (r.id === requestId ? data.request : r)));
    } catch (err) {
      setError(getErrorMessage(err, 'Update failed.'));
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10 space-y-12">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-6 border-b border-[#E5DFD3]">
        <div>
          <h1 className="font-display text-3xl sm:text-4xl font-bold text-[#1C1F1D]">
            {user?.name}&rsquo;s shelf &amp; requests
          </h1>
          <p className="text-sm sm:text-base text-[#5C615D] mt-1.5">
            Manage your posted books and respond to incoming swap, purchase, or seller offers.
          </p>
        </div>
        <Link
          to="/post"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#1B4D3E] text-[#FAF7F2] text-sm font-semibold hover:bg-[#143A2F] transition-colors whitespace-nowrap shrink-0 self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          Post a Book
        </Link>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 flex flex-wrap items-center justify-between gap-3 text-sm text-red-700">
          <span>{error}</span>
          <button
            type="button"
            onClick={() => void loadDashboard()}
            className="px-3 py-1.5 rounded-md border border-red-300 bg-white text-xs font-semibold text-red-700 hover:bg-red-100 cursor-pointer"
          >
            Retry
          </button>
        </div>
      )}

      {/* Section 1: Incoming Requests */}
      <section className="space-y-4">
        <div className="flex items-baseline justify-between">
          <h2 className="font-display text-2xl font-bold text-[#1C1F1D]">
            Incoming requests
          </h2>
          <span className="text-sm text-[#5C615D] tabular-nums">
            {incoming.length} {incoming.length === 1 ? 'request' : 'requests'}
          </span>
        </div>

        {loading ? (
          <div className="h-28 rounded-xl bg-[#F3EFE6] animate-pulse" />
        ) : incoming.length === 0 ? (
          <div className="rounded-xl border border-[#E5DFD3] bg-[#FFFFFF] p-6 text-sm text-[#5C615D]">
            No incoming requests yet. When readers reach out about one of your listings, their
            message will appear here.
          </div>
        ) : (
          <div className="space-y-4">
            {incoming.map((reqItem) => (
              <div
                key={reqItem.id}
                className="rounded-xl border border-[#E5DFD3] bg-[#FFFFFF] p-5 flex flex-col md:flex-row md:items-center justify-between gap-4"
              >
                <div className="space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-[#5C615D]">
                    <span className="font-semibold text-[#1B4D3E]">{reqItem.bookType}</span>
                    <span aria-hidden="true">·</span>
                    <span>
                      From <strong className="text-[#1C1F1D]">{reqItem.requesterName}</strong> (
                      {reqItem.requesterCity})
                    </span>
                    <span aria-hidden="true">·</span>
                    <span
                      className={`font-semibold ${
                        reqItem.status === 'Accepted'
                          ? 'text-[#1B4D3E]'
                          : reqItem.status === 'Declined'
                            ? 'text-red-700'
                            : 'text-[#5C615D]'
                      }`}
                    >
                      Status: {reqItem.status}
                    </span>
                  </div>

                  <Link
                    to={`/books/${reqItem.bookId}`}
                    className="font-display text-lg font-semibold text-[#1C1F1D] hover:underline block"
                  >
                    {reqItem.bookTitle}
                  </Link>

                  {reqItem.offerBookTitle && (
                    <p className="text-sm text-[#1B4D3E] font-medium">
                      Offered to swap: {reqItem.offerBookTitle}
                    </p>
                  )}

                  <p className="text-sm text-[#1C1F1D]/90">{reqItem.message}</p>
                  <p className="text-xs text-[#5C615D]">Meetup / contact: {reqItem.contactNote}</p>
                </div>

                {reqItem.status === 'Pending' && (
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => void handleUpdateRequestStatus(reqItem.id, 'Accepted')}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#1B4D3E] text-[#FAF7F2] text-xs font-semibold hover:bg-[#143A2F] cursor-pointer"
                    >
                      <Check className="w-3.5 h-3.5" />
                      Accept
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleUpdateRequestStatus(reqItem.id, 'Declined')}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-[#E5DFD3] text-[#1C1F1D] text-xs font-semibold hover:bg-[#F3EFE6] cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                      Decline
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Section 2: Your Book Listings */}
      <section className="space-y-4">
        <div className="flex items-baseline justify-between">
          <h2 className="font-display text-2xl font-bold text-[#1C1F1D]">Your posted books</h2>
          <span className="text-sm text-[#5C615D] tabular-nums">
            {books.length} {books.length === 1 ? 'listing' : 'listings'}
          </span>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[1, 2].map((n) => (
              <div key={n} className="h-32 rounded-xl bg-[#F3EFE6] animate-pulse" />
            ))}
          </div>
        ) : books.length === 0 ? (
          <div className="rounded-xl border border-[#E5DFD3] bg-[#FFFFFF] p-8 text-center space-y-3">
            <p className="font-display text-xl font-semibold text-[#1C1F1D]">
              You haven&rsquo;t posted any books yet
            </p>
            <p className="text-sm text-[#5C615D]">
              List a book you want to exchange, sell, or find locally.
            </p>
            <Link
              to="/post"
              className="inline-flex px-5 py-2.5 rounded-lg bg-[#1B4D3E] text-[#FAF7F2] text-sm font-semibold"
            >
              Post Your First Book
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {books.map((book) => (
              <div
                key={book.id}
                className="rounded-xl border border-[#E5DFD3] bg-[#FFFFFF] p-4 flex gap-4 items-start"
              >
                <Link
                  to={`/books/${book.id}`}
                  className="w-20 aspect-[3/4] rounded-lg overflow-hidden bg-[#F3EFE6] shrink-0 border border-[#E5DFD3]"
                >
                  <img
                    src={resolveBookImageUrl(book.imageUrl)}
                    alt={book.title}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover"
                  />
                </Link>

                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center gap-2 text-xs text-[#5C615D]">
                    <span className="font-semibold text-[#1B4D3E]">{book.listingType}</span>
                    <span aria-hidden="true">·</span>
                    <span className="truncate">{book.city}</span>
                  </div>

                  <Link
                    to={`/books/${book.id}`}
                    className="font-display text-base font-semibold text-[#1C1F1D] hover:underline line-clamp-1 block"
                  >
                    {book.title}
                  </Link>
                  <p className="text-xs text-[#5C615D] truncate">{book.author}</p>

                  <div className="pt-3 flex flex-wrap items-center gap-2">
                    <Link
                      to={`/edit/${book.id}`}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-[#E5DFD3] text-xs font-medium text-[#1C1F1D] hover:bg-[#F3EFE6]"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                      Edit
                    </Link>

                    {confirmDeleteId === book.id ? (
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => void handleDeleteBook(book.id)}
                          className="px-3 py-1.5 rounded-md bg-red-700 text-white text-xs font-semibold cursor-pointer"
                        >
                          Confirm Delete
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(null)}
                          className="px-2.5 py-1.5 rounded-md border border-[#E5DFD3] text-xs text-[#5C615D] cursor-pointer"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteId(book.id)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-[#E5DFD3] text-xs font-medium text-red-700 hover:bg-red-50 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        Delete
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Section 3: Sent Requests */}
      {outgoing.length > 0 && (
        <section className="space-y-4 pt-4 border-t border-[#E5DFD3]">
          <h2 className="font-display text-2xl font-bold text-[#1C1F1D]">Requests you sent</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {outgoing.map((reqItem) => (
              <div
                key={reqItem.id}
                className="rounded-xl border border-[#E5DFD3] bg-[#FFFFFF] p-4 space-y-1.5"
              >
                <div className="flex items-center justify-between text-xs text-[#5C615D]">
                  <span>To {reqItem.ownerName}</span>
                  <span className="font-semibold text-[#1B4D3E]">Status: {reqItem.status}</span>
                </div>
                <Link
                  to={`/books/${reqItem.bookId}`}
                  className="font-display text-base font-semibold text-[#1C1F1D] hover:underline block"
                >
                  {reqItem.bookTitle}
                </Link>
                <p className="text-xs text-[#5C615D] line-clamp-2">{reqItem.message}</p>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
