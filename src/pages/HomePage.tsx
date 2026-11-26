import { ArrowRight, MapPin } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { BookCard } from '../components/BookCard';
import { booksApi, getErrorMessage } from '../lib/api';
import type { BookListing } from '../types';

export function HomePage() {
  const [books, setBooks] = useState<BookListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [heroImgFailed, setHeroImgFailed] = useState(false);

  const loadRecentBooks = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await booksApi.list();
      setBooks(Array.isArray(data.books) ? data.books.slice(0, 6) : []);
    } catch (err) {
      setError(getErrorMessage(err, 'Unable to load community listings.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    document.title = 'KitabWanag — Exchange, Sell & Buy Books Nearby';
    void loadRecentBooks();
  }, [loadRecentBooks]);

  return (
    <div>
      {/* Section 1: Storefront Hero */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 pt-10 pb-14 md:pt-16 md:pb-20">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-stretch">
          <div className="lg:col-span-6 flex flex-col justify-center space-y-6">
            <p className="text-sm font-medium text-[#1B4D3E]">
              Neighborhood book exchange, sales &amp; requests
            </p>
            <h1 className="font-display text-4xl sm:text-5xl font-bold tracking-tight text-[#1C1F1D] leading-[1.12] [text-wrap:balance]">
              Pass along the books you have finished, find the ones you need nearby.
            </h1>
            <p className="text-base sm:text-lg text-[#5C615D] leading-relaxed max-w-xl">
              KitabWanag connects students and readers across neighborhoods to swap textbooks,
              buy second-hand editions fairly, and locate copies on an open map.
            </p>
            <div className="flex flex-wrap items-center gap-4 pt-2">
              <Link
                to="/browse"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-[#1B4D3E] text-[#FAF7F2] text-sm font-semibold hover:bg-[#143A2F] transition-colors whitespace-nowrap shrink-0"
              >
                Browse Books
                <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                to="/post"
                className="inline-flex items-center justify-center px-6 py-3 rounded-lg border border-[#1B4D3E] text-[#1B4D3E] text-sm font-semibold hover:bg-[#F3EFE6] transition-colors whitespace-nowrap shrink-0"
              >
                Post a Book
              </Link>
              <Link
                to="/map"
                className="inline-flex items-center gap-1.5 px-2 py-2 text-sm font-medium text-[#5C615D] hover:text-[#1C1F1D] transition-colors whitespace-nowrap shrink-0"
              >
                <MapPin className="w-4 h-4 text-[#1B4D3E]" />
                Explore Map
              </Link>
            </div>
          </div>

          <div className="lg:col-span-6">
            <div className="h-full min-h-[280px] sm:min-h-[360px] rounded-2xl overflow-hidden border border-[#E5DFD3] bg-[#F3EFE6]">
              {!heroImgFailed ? (
                <img
                  src="/src/assets/images/hero_bookshop_table_1795631935125.jpg"
                  alt="Warm sunlit wooden reading table with curated books and tea"
                  referrerPolicy="no-referrer"
                  onError={() => setHeroImgFailed(true)}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center p-8 text-center bg-[#F3EFE6]">
                  <p className="font-display text-2xl text-[#1B4D3E]">
                    Shared shelves across your neighborhood
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Section 2: Featured Books Grid */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-12 border-t border-[#E5DFD3]">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
          <div>
            <h2 className="font-display text-2xl sm:text-3xl font-bold text-[#1C1F1D]">
              Recent community listings
            </h2>
            <p className="text-sm sm:text-base text-[#5C615D] mt-1">
              Books currently available to exchange, buy, or fulfill nearby.
            </p>
          </div>
          <Link
            to="/browse"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#1B4D3E] hover:text-[#143A2F] whitespace-nowrap shrink-0"
          >
            View all listings
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
            {[1, 2, 3].map((n) => (
              <div
                key={n}
                className="bg-[#FFFFFF] border border-[#E5DFD3] rounded-xl overflow-hidden animate-pulse"
              >
                <div className="aspect-[3/4] bg-[#F3EFE6]" />
                <div className="p-5 space-y-3">
                  <div className="h-3 w-24 bg-[#F3EFE6] rounded" />
                  <div className="h-5 w-4/5 bg-[#F3EFE6] rounded" />
                  <div className="h-4 w-1/2 bg-[#F3EFE6] rounded" />
                </div>
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="rounded-xl border border-[#E5DFD3] bg-[#FFFFFF] p-8 text-center">
            <p className="font-display text-xl font-semibold text-[#1C1F1D]">
              Could not load recent listings
            </p>
            <p className="text-sm text-[#5C615D] mt-2">{error}</p>
            <button
              type="button"
              onClick={() => void loadRecentBooks()}
              className="mt-5 px-5 py-2.5 rounded-lg bg-[#1B4D3E] text-[#FAF7F2] text-sm font-semibold cursor-pointer"
            >
              Try Again
            </button>
          </div>
        ) : books.length === 0 ? (
          <div className="rounded-xl border border-[#E5DFD3] bg-[#FFFFFF] p-10 text-center">
            <p className="font-display text-xl font-semibold text-[#1C1F1D]">
              No books listed yet
            </p>
            <p className="text-sm text-[#5C615D] mt-2">
              Be the first reader in your area to share a textbook or novel.
            </p>
            <Link
              to="/post"
              className="inline-flex mt-5 px-5 py-2.5 rounded-lg bg-[#1B4D3E] text-[#FAF7F2] text-sm font-semibold"
            >
              Post a Book
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
            {books.map((book) => (
              <BookCard key={book.id} book={book} />
            ))}
          </div>
        )}
      </section>

      {/* Section 3: How It Works */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-14 border-t border-[#E5DFD3]">
        <div className="max-w-2xl mb-10">
          <h2 className="font-display text-2xl sm:text-3xl font-bold text-[#1C1F1D]">
            Three ways readers connect on KitabWanag
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="pt-4 border-t border-[#E5DFD3] space-y-2">
            <h3 className="font-display text-xl font-semibold text-[#1C1F1D]">
              01. Exchange finished reads
            </h3>
            <p className="text-sm text-[#5C615D] leading-relaxed">
              List a book you have already read, suggest titles you would swap for, and review
              incoming swap offers from nearby readers.
            </p>
          </div>

          <div className="pt-4 border-t border-[#E5DFD3] space-y-2">
            <h3 className="font-display text-xl font-semibold text-[#1C1F1D]">
              02. Sell textbooks fairly
            </h3>
            <p className="text-sm text-[#5C615D] leading-relaxed">
              Pass along university coursebooks and reference volumes with clear condition notes
              and transparent local pricing.
            </p>
          </div>

          <div className="pt-4 border-t border-[#E5DFD3] space-y-2">
            <h3 className="font-display text-xl font-semibold text-[#1C1F1D]">
              03. Post wanted requests
            </h3>
            <p className="text-sm text-[#5C615D] leading-relaxed">
              Cannot find an edition? Post a Buy request pinned to your neighborhood so local
              owners can reach out directly.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
