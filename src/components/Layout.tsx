import { BookOpen, Menu, Search, X } from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { booksApi, resolveBookImageUrl } from '../lib/api';
import type { BookListing } from '../types';

export function Layout({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);

  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<BookListing[]>([]);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const searchBoxRef = useRef<HTMLDivElement | null>(null);

  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    `whitespace-nowrap shrink-0 text-sm font-medium transition-colors pb-0.5 ${
      isActive
        ? 'text-[#1B4D3E] border-b border-[#1B4D3E]'
        : 'text-[#5C615D] hover:text-[#1C1F1D]'
    }`;

  // Sync header search input when browsing with ?q=
  useEffect(() => {
    if (location.pathname === '/browse') {
      const qParam = new URLSearchParams(location.search).get('q') || '';
      setQuery(qParam);
    }
  }, [location.pathname, location.search]);

  // Close suggestions dropdown on outside click or route change
  useEffect(() => {
    setDropdownOpen(false);
    setMobileSearchOpen(false);
  }, [location.pathname, location.search]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchBoxRef.current && !searchBoxRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Debounced live search suggestions
  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setSuggestions([]);
      setSearching(false);
      return;
    }

    const controller = new AbortController();
    setSearching(true);
    const timer = setTimeout(async () => {
      try {
        const data = await booksApi.list({ q: trimmed }, controller.signal);
        if (!controller.signal.aborted && Array.isArray(data.books)) {
          setSuggestions(data.books.slice(0, 5));
        }
      } catch {
        if (!controller.signal.aborted) setSuggestions([]);
      } finally {
        if (!controller.signal.aborted) setSearching(false);
      }
    }, 180);

    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [query]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = query.trim();
    setDropdownOpen(false);
    setMobileSearchOpen(false);
    setMobileMenuOpen(false);
    if (trimmed) {
      navigate(`/browse?q=${encodeURIComponent(trimmed)}`);
    } else {
      navigate('/browse');
    }
  };

  const handleSignOut = () => {
    logout();
    setMobileMenuOpen(false);
    navigate('/');
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#FAF7F2] text-[#1C1F1D]">
      <header className="sticky top-0 z-40 bg-[#FAF7F2]/95 backdrop-blur-sm border-b border-[#E5DFD3]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4 lg:gap-8">
          {/* Zone 1: Single-line Brand Wordmark */}
          <Link
            to="/"
            className="flex items-center gap-2.5 whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#1B4D3E] rounded"
          >
            <svg
              aria-hidden="true"
              className="w-6 h-6 text-[#1B4D3E] shrink-0"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M2 5.5A2.5 2.5 0 0 1 4.5 3H11v16l-1.6-.8a4 4 0 0 0-3.6 0L2 20V5.5Z" />
              <path d="M22 5.5A2.5 2.5 0 0 0 19.5 3H13v16l1.6-.8a4 4 0 0 1 3.6 0L22 20V5.5Z" />
            </svg>
            <span className="font-display text-xl font-bold tracking-tight text-[#1C1F1D]">
              KitabWanag
            </span>
          </Link>

          {/* Zone 2: Clean single-line text navigation links + global search bar */}
          <div className="hidden md:flex items-center gap-5 lg:gap-7 flex-1 justify-center min-w-0">
            <nav className="flex items-center gap-5 lg:gap-6 shrink-0" aria-label="Primary navigation">
              <NavLink to="/browse" className={navLinkClass}>
                Browse
              </NavLink>
              <NavLink to="/map" className={navLinkClass}>
                Map
              </NavLink>
              <NavLink to="/post" className={navLinkClass}>
                Post a Book
              </NavLink>
              <NavLink to="/my-listings" className={navLinkClass}>
                My Listings
              </NavLink>
            </nav>

            {/* Global Header Search Bar */}
            <div ref={searchBoxRef} className="relative flex-1 max-w-xs">
              <form onSubmit={handleSearchSubmit} role="search" aria-label="Global book search">
                <Search
                  className="w-4 h-4 text-[#5C615D] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                  aria-hidden="true"
                />
                <input
                  type="search"
                  value={query}
                  onFocus={() => setDropdownOpen(true)}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setDropdownOpen(true);
                  }}
                  placeholder="Title, author, or ISBN..."
                  aria-label="Search books by title, author, or ISBN"
                  className="w-full h-9 pl-9 pr-3 rounded-lg bg-[#FFFFFF] border border-[#E5DFD3] text-sm text-[#1C1F1D] placeholder:text-[#5C615D]/75 focus:outline-none focus:border-[#1B4D3E]"
                />
              </form>

              {dropdownOpen && query.trim().length >= 2 && (
                <div className="absolute left-0 right-0 mt-1.5 bg-[#FFFFFF] border border-[#E5DFD3] rounded-xl shadow-lg overflow-hidden z-50">
                  {searching ? (
                    <p className="px-4 py-3 text-xs text-[#5C615D]">Searching books...</p>
                  ) : suggestions.length === 0 ? (
                    <div className="px-4 py-3 text-xs text-[#5C615D]">
                      No matches for &ldquo;{query.trim()}&rdquo;. Press Enter to browse all.
                    </div>
                  ) : (
                    <>
                      <div className="divide-y divide-[#E5DFD3]/60">
                        {suggestions.map((book) => (
                          <Link
                            key={book.id}
                            to={`/books/${book.id}`}
                            onClick={() => setDropdownOpen(false)}
                            className="flex items-center gap-3 px-3.5 py-2.5 hover:bg-[#FAF7F2] transition-colors"
                          >
                            <div className="w-9 h-12 rounded bg-[#F3EFE6] overflow-hidden shrink-0 border border-[#E5DFD3]">
                              {book.imageUrl ? (
                                <img
                                  src={resolveBookImageUrl(book.imageUrl)}
                                  alt={book.title}
                                  referrerPolicy="no-referrer"
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center">
                                  <BookOpen className="w-4 h-4 text-[#1B4D3E]" />
                                </div>
                              )}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-semibold text-[#1C1F1D] truncate">
                                {book.title}
                              </p>
                              <p className="text-xs text-[#5C615D] truncate">
                                {book.author}
                                {book.isbn ? ` · ISBN ${book.isbn}` : ''}
                              </p>
                            </div>
                          </Link>
                        ))}
                      </div>
                      <button
                        type="button"
                        onClick={handleSearchSubmit}
                        className="w-full px-4 py-2.5 text-xs font-semibold text-[#1B4D3E] bg-[#F3EFE6]/70 hover:bg-[#F3EFE6] text-left border-t border-[#E5DFD3] cursor-pointer"
                      >
                        See all results for &ldquo;{query.trim()}&rdquo;
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Zone 3: Single Primary Action + Mobile Controls */}
          <div className="flex items-center gap-2 shrink-0">
            {isAuthenticated && user ? (
              <button
                type="button"
                onClick={handleSignOut}
                className="hidden md:inline-flex items-center justify-center px-4 py-2 text-sm font-medium rounded-lg border border-[#1B4D3E] text-[#1B4D3E] hover:bg-[#1B4D3E] hover:text-[#FAF7F2] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                Sign Out ({user.name.split(' ')[0]})
              </button>
            ) : (
              <Link
                to="/login"
                className="hidden md:inline-flex items-center justify-center px-5 py-2 text-sm font-medium rounded-lg bg-[#1B4D3E] text-[#FAF7F2] hover:bg-[#143A2F] transition-colors whitespace-nowrap shrink-0"
              >
                Sign In
              </Link>
            )}

            <button
              type="button"
              onClick={() => {
                setMobileSearchOpen((prev) => !prev);
                setMobileMenuOpen(false);
              }}
              aria-label="Toggle book search"
              aria-expanded={mobileSearchOpen}
              className="md:hidden inline-flex items-center justify-center w-11 h-11 rounded-lg border border-[#E5DFD3] text-[#1C1F1D] hover:bg-[#F3EFE6] transition-colors cursor-pointer"
            >
              <Search className="w-5 h-5" />
            </button>

            <button
              type="button"
              onClick={() => {
                setMobileMenuOpen((prev) => !prev);
                setMobileSearchOpen(false);
              }}
              aria-label={mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
              aria-expanded={mobileMenuOpen}
              className="md:hidden inline-flex items-center justify-center w-11 h-11 rounded-lg border border-[#E5DFD3] text-[#1C1F1D] hover:bg-[#F3EFE6] transition-colors cursor-pointer"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Search Bar */}
        {mobileSearchOpen && (
          <div className="md:hidden border-t border-[#E5DFD3] bg-[#FAF7F2] px-4 py-3">
            <form onSubmit={handleSearchSubmit} className="flex gap-2" role="search">
              <div className="relative flex-1">
                <Search
                  className="w-4 h-4 text-[#5C615D] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                  aria-hidden="true"
                />
                <input
                  type="search"
                  autoFocus
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Title, author, or ISBN..."
                  aria-label="Search books by title, author, or ISBN"
                  className="w-full h-11 pl-9 pr-3 rounded-lg bg-[#FFFFFF] border border-[#E5DFD3] text-sm text-[#1C1F1D] focus:outline-none focus:border-[#1B4D3E]"
                />
              </div>
              <button
                type="submit"
                className="px-4 h-11 rounded-lg bg-[#1B4D3E] text-[#FAF7F2] text-sm font-semibold shrink-0 cursor-pointer"
              >
                Search
              </button>
            </form>
          </div>
        )}

        {/* Mobile Drawer */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-[#E5DFD3] bg-[#FAF7F2] px-4 py-4 space-y-2">
            <NavLink
              to="/browse"
              onClick={() => setMobileMenuOpen(false)}
              className="block py-2.5 px-3 rounded-lg text-base font-medium text-[#1C1F1D] hover:bg-[#F3EFE6]"
            >
              Browse Books
            </NavLink>
            <NavLink
              to="/map"
              onClick={() => setMobileMenuOpen(false)}
              className="block py-2.5 px-3 rounded-lg text-base font-medium text-[#1C1F1D] hover:bg-[#F3EFE6]"
            >
              Nearby Map
            </NavLink>
            <NavLink
              to="/post"
              onClick={() => setMobileMenuOpen(false)}
              className="block py-2.5 px-3 rounded-lg text-base font-medium text-[#1C1F1D] hover:bg-[#F3EFE6]"
            >
              Post a Book
            </NavLink>
            <NavLink
              to="/my-listings"
              onClick={() => setMobileMenuOpen(false)}
              className="block py-2.5 px-3 rounded-lg text-base font-medium text-[#1C1F1D] hover:bg-[#F3EFE6]"
            >
              My Listings
            </NavLink>
            <div className="pt-2 border-t border-[#E5DFD3]">
              {isAuthenticated && user ? (
                <button
                  type="button"
                  onClick={handleSignOut}
                  className="w-full py-2.5 px-4 rounded-lg border border-[#1B4D3E] text-[#1B4D3E] text-sm font-medium text-center cursor-pointer"
                >
                  Sign Out ({user.name})
                </button>
              ) : (
                <Link
                  to="/login"
                  onClick={() => setMobileMenuOpen(false)}
                  className="block w-full py-2.5 px-4 rounded-lg bg-[#1B4D3E] text-[#FAF7F2] text-sm font-medium text-center"
                >
                  Sign In
                </Link>
              )}
            </div>
          </div>
        )}
      </header>

      <main className="flex-1">{children}</main>

      <footer className="border-t border-[#E5DFD3] bg-[#F3EFE6]/60 mt-16">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          <div>
            <p className="font-display text-lg font-semibold text-[#1C1F1D]">KitabWanag</p>
            <p className="text-sm text-[#5C615D] mt-1">
              Community book exchange, sales, and wanted requests for readers nearby.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-6 text-sm text-[#5C615D]">
            <Link to="/browse" className="hover:text-[#1C1F1D] transition-colors">
              Browse
            </Link>
            <Link to="/map" className="hover:text-[#1C1F1D] transition-colors">
              Map
            </Link>
            <Link to="/post" className="hover:text-[#1C1F1D] transition-colors">
              Post a Book
            </Link>
            <Link to="/my-listings" className="hover:text-[#1C1F1D] transition-colors">
              My Listings
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
