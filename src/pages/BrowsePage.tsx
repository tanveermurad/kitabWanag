import { Search, SlidersHorizontal } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { BookCard } from '../components/BookCard';
import { booksApi, getErrorMessage } from '../lib/api';
import { BOOK_CATEGORIES, BOOK_LANGUAGES, CITY_PRESETS } from '../lib/cities';
import type { BookListing } from '../types';

const FILTER_TABS = ['All', 'Exchange', 'Sell', 'Buy'] as const;

export function BrowsePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const urlQuery = searchParams.get('q') || '';

  const [activeType, setActiveType] = useState<(typeof FILTER_TABS)[number]>('All');
  const [searchQuery, setSearchQuery] = useState(urlQuery);
  const [selectedCity, setSelectedCity] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedLanguage, setSelectedLanguage] = useState('All');
  const [books, setBooks] = useState<BookListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchBooks = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await booksApi.list({
        type: activeType,
        q: searchQuery,
        city: selectedCity,
        category: selectedCategory,
        language: selectedLanguage,
      });
      setBooks(Array.isArray(data.books) ? data.books : []);
    } catch (err) {
      setError(getErrorMessage(err, 'Unable to load listings.'));
    } finally {
      setLoading(false);
    }
  }, [activeType, searchQuery, selectedCity, selectedCategory, selectedLanguage]);

  useEffect(() => {
    document.title = 'Browse Books — KitabWanag';
  }, []);

  useEffect(() => {
    setSearchQuery(urlQuery);
  }, [urlQuery]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void fetchBooks();
    }, 180);
    return () => clearTimeout(timer);
  }, [fetchBooks]);

  const resetFilters = () => {
    setActiveType('All');
    setSearchQuery('');
    setSelectedCity('');
    setSelectedCategory('All');
    setSelectedLanguage('All');
    setSearchParams({}, { replace: true });
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-8 border-b border-[#E5DFD3]">
        <div>
          <h1 className="font-display text-3xl sm:text-4xl font-bold text-[#1C1F1D]">
            Browse community books
          </h1>
          <p className="text-sm sm:text-base text-[#5C615D] mt-2">
            Filter by exchange, sale, or wanted requests across readers near you.
          </p>
        </div>

        {/* Segmented Filter Tabs */}
        <div
          className="inline-flex items-center gap-1 p-1 bg-[#F3EFE6] border border-[#E5DFD3] rounded-lg self-start md:self-auto"
          role="tablist"
          aria-label="Filter listings by type"
        >
          {FILTER_TABS.map((tab) => {
            const active = activeType === tab;
            return (
              <button
                key={tab}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setActiveType(tab)}
                className={`px-3.5 py-2 text-sm font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  active
                    ? 'bg-[#1B4D3E] text-[#FAF7F2]'
                    : 'text-[#5C615D] hover:text-[#1C1F1D]'
                }`}
              >
                {tab}
              </button>
            );
          })}
        </div>
      </div>

      {/* Search & Dropdown Filters */}
      <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 py-6">
        <div className="sm:col-span-5 relative">
          <Search
            className="w-4 h-4 text-[#5C615D] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
            aria-hidden="true"
          />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => {
              const val = e.target.value;
              setSearchQuery(val);
              if (val.trim()) {
                setSearchParams({ q: val }, { replace: true });
              } else {
                setSearchParams({}, { replace: true });
              }
            }}
            placeholder="Search title, author, ISBN, language, or city..."
            aria-label="Search books by title, author, ISBN, language, or city"
            className="w-full h-11 pl-10 pr-4 rounded-lg bg-[#FFFFFF] border border-[#E5DFD3] text-sm text-[#1C1F1D] placeholder:text-[#5C615D]/70 focus:outline-none focus:border-[#1B4D3E]"
          />
        </div>

        <div className="sm:col-span-3">
          <div className="relative">
            <SlidersHorizontal
              className="w-4 h-4 text-[#5C615D] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
              aria-hidden="true"
            />
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              aria-label="Filter by category"
              className="w-full h-11 pl-10 pr-3.5 rounded-lg bg-[#FFFFFF] border border-[#E5DFD3] text-sm text-[#1C1F1D] focus:outline-none focus:border-[#1B4D3E]"
            >
              <option value="All">All categories</option>
              {BOOK_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="sm:col-span-2">
          <select
            value={selectedLanguage}
            onChange={(e) => setSelectedLanguage(e.target.value)}
            aria-label="Filter by language"
            className="w-full h-11 px-3.5 rounded-lg bg-[#FFFFFF] border border-[#E5DFD3] text-sm text-[#1C1F1D] focus:outline-none focus:border-[#1B4D3E]"
          >
            <option value="All">All languages</option>
            {BOOK_LANGUAGES.map((lang) => (
              <option key={lang} value={lang}>
                {lang}
              </option>
            ))}
          </select>
        </div>

        <div className="sm:col-span-2">
          <select
            value={selectedCity}
            onChange={(e) => setSelectedCity(e.target.value)}
            aria-label="Filter by city"
            className="w-full h-11 px-3.5 rounded-lg bg-[#FFFFFF] border border-[#E5DFD3] text-sm text-[#1C1F1D] focus:outline-none focus:border-[#1B4D3E]"
          >
            <option value="">All cities</option>
            {CITY_PRESETS.map((city) => (
              <option key={city.name} value={city.name}>
                {city.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Results Grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
          {[1, 2, 3, 4, 5, 6].map((n) => (
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
            Could not load book listings
          </p>
          <p className="text-sm text-[#5C615D] mt-2">{error}</p>
          <button
            type="button"
            onClick={() => void fetchBooks()}
            className="mt-5 px-5 py-2.5 rounded-lg bg-[#1B4D3E] text-[#FAF7F2] text-sm font-semibold cursor-pointer"
          >
            Try Again
          </button>
        </div>
      ) : books.length === 0 ? (
        <div className="rounded-xl border border-[#E5DFD3] bg-[#FFFFFF] p-12 text-center space-y-3">
          <h2 className="font-display text-2xl font-semibold text-[#1C1F1D]">
            No matching books found
          </h2>
          <p className="text-sm text-[#5C615D] max-w-md mx-auto">
            Try clearing your search or filters, or post a Buy request so nearby readers know what
            book you are looking for.
          </p>
          <div className="pt-3 flex flex-wrap justify-center gap-3">
            <button
              type="button"
              onClick={resetFilters}
              className="px-5 py-2.5 rounded-lg border border-[#1B4D3E] text-[#1B4D3E] text-sm font-semibold cursor-pointer"
            >
              Reset Filters
            </button>
            <Link
              to="/post"
              className="px-5 py-2.5 rounded-lg bg-[#1B4D3E] text-[#FAF7F2] text-sm font-semibold"
            >
              Post a Request
            </Link>
          </div>
        </div>
      ) : (
        <>
          <p className="text-xs text-[#5C615D] mb-4 tabular-nums">
            Showing {books.length} {books.length === 1 ? 'listing' : 'listings'}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
            {books.map((book) => (
              <BookCard key={book.id} book={book} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
