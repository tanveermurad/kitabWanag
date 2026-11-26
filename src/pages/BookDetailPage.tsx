import { ArrowLeft, BookOpen, CheckCircle2, MapPin, User } from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { BookDiscussions } from '../components/BookDiscussions';
import { LeafletMap } from '../components/LeafletMap';
import { useAuth } from '../context/AuthContext';
import { booksApi, getErrorMessage, requestsApi, resolveBookImageUrl } from '../lib/api';
import type { BookListing } from '../types';

export function BookDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user, isAuthenticated } = useAuth();

  const [book, setBook] = useState<BookListing | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [imgFailed, setImgFailed] = useState(false);

  // Request form state
  const [offerBookTitle, setOfferBookTitle] = useState('');
  const [message, setMessage] = useState('');
  const [contactNote, setContactNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [requestSent, setRequestSent] = useState(false);

  const loadBook = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const data = await booksApi.getById(id);
      setBook(data.book);
      document.title = `${data.book.title} — KitabWanag`;
    } catch (err) {
      setError(getErrorMessage(err, 'Unable to load listing.'));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void loadBook();
  }, [loadBook]);

  const handleRequestSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!book) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      await requestsApi.create({
        bookId: book.id,
        offerBookTitle,
        message,
        contactNote,
      });
      setRequestSent(true);
      setOfferBookTitle('');
      setMessage('');
      setContactNote('');
    } catch (err) {
      setSubmitError(getErrorMessage(err, 'Could not send request.'));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-12 animate-pulse">
        <div className="h-5 w-32 bg-[#F3EFE6] rounded mb-8" />
        <div className="grid grid-cols-1 md:grid-cols-12 gap-10">
          <div className="md:col-span-5 aspect-[3/4] bg-[#F3EFE6] rounded-xl" />
          <div className="md:col-span-7 space-y-4">
            <div className="h-8 w-3/4 bg-[#F3EFE6] rounded" />
            <div className="h-5 w-1/3 bg-[#F3EFE6] rounded" />
            <div className="h-32 w-full bg-[#F3EFE6] rounded" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !book) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-16 text-center space-y-4">
        <h1 className="font-display text-3xl font-bold text-[#1C1F1D]">Listing unavailable</h1>
        <p className="text-sm text-[#5C615D]">{error || 'This book could not be found.'}</p>
        <div className="flex flex-wrap justify-center gap-3 pt-2">
          <button
            type="button"
            onClick={() => void loadBook()}
            className="px-5 py-2.5 rounded-lg border border-[#1B4D3E] text-[#1B4D3E] text-sm font-semibold hover:bg-[#F3EFE6] cursor-pointer"
          >
            Try Again
          </button>
          <Link
            to="/browse"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#1B4D3E] text-[#FAF7F2] text-sm font-semibold"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Browse
          </Link>
        </div>
      </div>
    );
  }

  const isOwner = Boolean(user && user.id === book.ownerId);

  const actionHeadline =
    book.listingType === 'Exchange'
      ? 'Propose a book exchange'
      : book.listingType === 'Sell'
        ? 'Request to buy this book'
        : 'Offer a copy to this reader';

  const submitLabel =
    book.listingType === 'Exchange'
      ? 'Send Swap Request'
      : book.listingType === 'Sell'
        ? 'Send Buy Request'
        : 'Offer Your Copy';

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10">
      <Link
        to="/browse"
        className="inline-flex items-center gap-2 text-sm font-medium text-[#5C615D] hover:text-[#1C1F1D] mb-8"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Browse
      </Link>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-8 lg:gap-12 items-start">
        {/* Left Sticky Cover + Location Preview */}
        <div className="md:col-span-5 md:sticky md:top-24 space-y-6">
          <div className="aspect-[3/4] rounded-xl overflow-hidden border border-[#E5DFD3] bg-[#F3EFE6]">
            {!imgFailed && book.imageUrl ? (
              <img
                src={resolveBookImageUrl(book.imageUrl)}
                alt={`${book.title} by ${book.author}`}
                referrerPolicy="no-referrer"
                onError={() => setImgFailed(true)}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center p-8 text-center">
                <BookOpen className="w-12 h-12 text-[#1B4D3E]/70 mb-3" />
                <p className="font-display text-lg font-semibold text-[#1C1F1D]">{book.title}</p>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <p className="text-xs font-medium text-[#5C615D] flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-[#1B4D3E]" />
              {book.neighborhood ? `${book.neighborhood}, ${book.city}` : book.city}
            </p>
            <LeafletMap
              books={[book]}
              center={book.location.coordinates}
              zoom={13}
              heightClassName="h-52"
            />
          </div>
        </div>

        {/* Right Contiguous Listing Details & Request Module */}
        <div className="md:col-span-7 space-y-6">
          <div className="space-y-3 pb-6 border-b border-[#E5DFD3]">
            <div className="flex flex-wrap items-center gap-2 text-xs text-[#5C615D]">
              <span className="font-semibold text-[#1B4D3E]">{book.listingType}</span>
              <span aria-hidden="true">·</span>
              <span>{book.category}</span>
              <span aria-hidden="true">·</span>
              <span>{book.language}</span>
              <span aria-hidden="true">·</span>
              <span>Condition: {book.condition}</span>
            </div>

            <h1 className="font-display text-3xl sm:text-4xl font-bold text-[#1C1F1D] leading-tight [text-wrap:balance]">
              {book.title}
            </h1>

            <p className="text-base text-[#5C615D]">
              By {book.author}
              {book.isbn ? (
                <span className="ml-2 text-xs font-mono tabular-nums text-[#5C615D]">
                  · ISBN {book.isbn}
                </span>
              ) : null}
            </p>

            <div className="pt-2 flex flex-wrap items-baseline gap-6">
              {book.listingType === 'Sell' && (
                <p className="text-2xl font-semibold text-[#1C1F1D] tabular-nums">
                  {book.price.toLocaleString()} {book.currency}
                </p>
              )}
              {book.listingType === 'Buy' && (
                <p className="text-lg font-semibold text-[#1C1F1D] tabular-nums">
                  {book.price > 0
                    ? `Target budget: ${book.price.toLocaleString()} ${book.currency}`
                    : 'Open to offers from local sellers'}
                </p>
              )}
              {book.listingType === 'Exchange' && (
                <p className="text-base font-medium text-[#1B4D3E]">
                  {book.exchangeFor
                    ? `Looking to swap for: ${book.exchangeFor}`
                    : 'Open to book swap suggestions'}
                </p>
              )}
            </div>

            <div className="pt-2 flex items-center gap-2 text-sm text-[#5C615D]">
              <User className="w-4 h-4 text-[#1B4D3E]" />
              <span>
                Posted by <strong className="font-semibold text-[#1C1F1D]">{book.ownerName}</strong>
              </span>
            </div>
          </div>

          <div className="space-y-2">
            <h2 className="font-display text-xl font-semibold text-[#1C1F1D]">About this listing</h2>
            <p className="text-base text-[#1C1F1D]/90 leading-relaxed whitespace-pre-line">
              {book.description}
            </p>
          </div>

          {/* Action / Request Panel */}
          <div className="bg-[#FFFFFF] border border-[#E5DFD3] rounded-xl p-6 space-y-4">
            {isOwner ? (
              <div className="space-y-3">
                <h2 className="font-display text-xl font-semibold text-[#1C1F1D]">
                  This is your listing
                </h2>
                <p className="text-sm text-[#5C615D]">
                  You can update details or review incoming requests from interested readers.
                </p>
                <div className="flex flex-wrap gap-3 pt-1">
                  <Link
                    to={`/edit/${book.id}`}
                    className="px-5 py-2.5 rounded-lg bg-[#1B4D3E] text-[#FAF7F2] text-sm font-semibold"
                  >
                    Edit Listing
                  </Link>
                  <Link
                    to="/my-listings"
                    className="px-5 py-2.5 rounded-lg border border-[#1B4D3E] text-[#1B4D3E] text-sm font-semibold"
                  >
                    View Incoming Requests
                  </Link>
                </div>
              </div>
            ) : !isAuthenticated ? (
              <div className="space-y-3">
                <h2 className="font-display text-xl font-semibold text-[#1C1F1D]">
                  {actionHeadline}
                </h2>
                <p className="text-sm text-[#5C615D]">
                  Sign in or create a free reader account to contact {book.ownerName} and arrange a
                  meetup.
                </p>
                <div className="flex flex-wrap gap-3 pt-1">
                  <Link
                    to="/login"
                    state={{ from: `/books/${book.id}` }}
                    className="px-5 py-2.5 rounded-lg bg-[#1B4D3E] text-[#FAF7F2] text-sm font-semibold"
                  >
                    Sign In to Contact Owner
                  </Link>
                  <Link
                    to="/signup"
                    className="px-5 py-2.5 rounded-lg border border-[#E5DFD3] text-[#1C1F1D] text-sm font-semibold hover:bg-[#F3EFE6]"
                  >
                    Create Account
                  </Link>
                </div>
              </div>
            ) : requestSent ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-[#1B4D3E]">
                  <CheckCircle2 className="w-5 h-5" />
                  <h2 className="font-display text-xl font-semibold">Request sent</h2>
                </div>
                <p className="text-sm text-[#5C615D]">
                  Your request has been delivered to {book.ownerName}. You can track its status in
                  My Listings.
                </p>
                <div className="flex flex-wrap gap-3 pt-1">
                  <Link
                    to="/my-listings"
                    className="px-5 py-2.5 rounded-lg bg-[#1B4D3E] text-[#FAF7F2] text-sm font-semibold"
                  >
                    Go to My Listings
                  </Link>
                  <button
                    type="button"
                    onClick={() => setRequestSent(false)}
                    className="px-4 py-2.5 rounded-lg border border-[#E5DFD3] text-sm font-medium text-[#1C1F1D] cursor-pointer"
                  >
                    Send Another Note
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleRequestSubmit} className="space-y-4">
                <div>
                  <h2 className="font-display text-xl font-semibold text-[#1C1F1D]">
                    {actionHeadline}
                  </h2>
                  <p className="text-xs text-[#5C615D] mt-1">
                    Sent directly to {book.ownerName} in {book.city}.
                  </p>
                </div>

                {book.listingType === 'Exchange' && (
                  <div>
                    <label
                      htmlFor="offerBookTitle"
                      className="block text-sm font-medium text-[#1C1F1D] mb-1.5"
                    >
                      Book you are offering to swap
                    </label>
                    <input
                      id="offerBookTitle"
                      type="text"
                      required
                      value={offerBookTitle}
                      onChange={(e) => setOfferBookTitle(e.target.value)}
                      placeholder="e.g. Clean Architecture by Robert C. Martin"
                      className="w-full h-11 px-3.5 rounded-lg bg-[#FAF7F2] border border-[#E5DFD3] text-sm focus:outline-none focus:border-[#1B4D3E]"
                    />
                  </div>
                )}

                <div>
                  <label
                    htmlFor="requestMessage"
                    className="block text-sm font-medium text-[#1C1F1D] mb-1.5"
                  >
                    Message
                  </label>
                  <textarea
                    id="requestMessage"
                    required
                    rows={3}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder={
                      book.listingType === 'Buy'
                        ? 'Describe the edition, condition, and asking price of your copy...'
                        : 'Introduce yourself and ask about availability or book condition...'
                    }
                    className="w-full p-3.5 rounded-lg bg-[#FAF7F2] border border-[#E5DFD3] text-sm focus:outline-none focus:border-[#1B4D3E]"
                  />
                </div>

                <div>
                  <label
                    htmlFor="contactNote"
                    className="block text-sm font-medium text-[#1C1F1D] mb-1.5"
                  >
                    Meetup area or contact preference
                  </label>
                  <input
                    id="contactNote"
                    type="text"
                    required
                    value={contactNote}
                    onChange={(e) => setContactNote(e.target.value)}
                    placeholder="e.g. Weekdays after 4 PM near University Chowk"
                    className="w-full h-11 px-3.5 rounded-lg bg-[#FAF7F2] border border-[#E5DFD3] text-sm focus:outline-none focus:border-[#1B4D3E]"
                  />
                </div>

                {submitError && (
                  <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3.5 py-2.5">
                    {submitError}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full sm:w-auto px-6 py-3 rounded-lg bg-[#1B4D3E] text-[#FAF7F2] text-sm font-semibold hover:bg-[#143A2F] disabled:opacity-60 transition-colors cursor-pointer"
                >
                  {submitting ? 'Sending...' : submitLabel}
                </button>
              </form>
            )}
          </div>
        </div>
      </div>

      <BookDiscussions bookId={book.id} bookTitle={book.title} />
    </div>
  );
}
