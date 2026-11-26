import { BookOpen } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { resolveBookImageUrl } from '../lib/api';
import type { BookListing } from '../types';

export function BookCard({ book }: { book: BookListing }) {
  const [imgFailed, setImgFailed] = useState(false);

  const actionLine =
    book.listingType === 'Sell'
      ? `${book.price.toLocaleString()} ${book.currency}`
      : book.listingType === 'Exchange'
        ? 'Open to swap'
        : book.price > 0
          ? `Budget ${book.price.toLocaleString()} ${book.currency}`
          : 'Wanted copy';

  return (
    <Link
      to={`/books/${book.id}`}
      className="group block bg-[#FFFFFF] border border-[#E5DFD3] rounded-xl overflow-hidden transition-all duration-150 hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1B4D3E]"
    >
      <div className="aspect-[3/4] w-full bg-[#F3EFE6] overflow-hidden relative">
        {!imgFailed && book.imageUrl ? (
          <img
            src={resolveBookImageUrl(book.imageUrl)}
            alt={`${book.title} by ${book.author}`}
            referrerPolicy="no-referrer"
            onError={() => setImgFailed(true)}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center bg-gradient-to-br from-[#F3EFE6] to-[#E8E1D3]">
            <BookOpen className="w-10 h-10 text-[#1B4D3E]/70 mb-3" />
            <p className="font-display text-base font-semibold text-[#1C1F1D] line-clamp-3">
              {book.title}
            </p>
          </div>
        )}
      </div>

      <div className="p-4 sm:p-5 space-y-2">
        {/* Clean unboxed metadata per zero-pill discipline */}
        <div className="flex items-center gap-2 text-xs text-[#5C615D] truncate">
          <span className="font-semibold text-[#1B4D3E]">{book.listingType}</span>
          <span aria-hidden="true">·</span>
          <span className="shrink-0">{book.language}</span>
          <span aria-hidden="true">·</span>
          <span className="truncate">{book.city}</span>
          {book.distanceKm !== undefined && (
            <>
              <span aria-hidden="true">·</span>
              <span className="tabular-nums shrink-0">{book.distanceKm} km</span>
            </>
          )}
        </div>

        <h3 className="font-display text-lg font-semibold text-[#1C1F1D] leading-snug line-clamp-2 min-h-[3.1rem]">
          {book.title}
        </h3>

        <p className="text-sm text-[#5C615D] truncate">{book.author}</p>

        <div className="pt-2 border-t border-[#E5DFD3]/70 flex items-center justify-between gap-2 text-sm">
          <span className="font-medium text-[#1C1F1D] tabular-nums">{actionLine}</span>
          <span className="text-xs text-[#5C615D]">{book.condition}</span>
        </div>
      </div>
    </Link>
  );
}
