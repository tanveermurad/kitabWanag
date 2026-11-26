import { LocateFixed, MapPin } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { LeafletMap } from '../components/LeafletMap';
import { booksApi, getErrorMessage } from '../lib/api';
import { CITY_PRESETS, findCityPreset } from '../lib/cities';
import type { BookListing } from '../types';

const TYPE_OPTIONS = ['All', 'Exchange', 'Sell', 'Buy'] as const;

export function MapPage() {
  const [books, setBooks] = useState<BookListing[]>([]);
  const [center, setCenter] = useState<[number, number]>([66.9964, 30.1798]); // Quetta [lng, lat]
  const [zoom, setZoom] = useState<number>(6);
  const [radiusKm, setRadiusKm] = useState<number>(0); // 0 = show all listings nationwide
  const [activeType, setActiveType] = useState<(typeof TYPE_OPTIONS)[number]>('All');
  const [selectedCity, setSelectedCity] = useState<string>('');
  const [locationNote, setLocationNote] = useState<string>(
    'Showing all community listings across the map. Click "Books near me" or pick a city to filter nearby.',
  );
  const [locating, setLocating] = useState(false);
  const [locationDenied, setLocationDenied] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadAllBooks = useCallback(async (typeFilter: string) => {
    setLoading(true);
    setError(null);
    try {
      const data = await booksApi.list({ type: typeFilter });
      setBooks(Array.isArray(data.books) ? data.books : []);
    } catch (err) {
      setError(getErrorMessage(err, 'Unable to load map listings.'));
    } finally {
      setLoading(false);
    }
  }, []);

  const loadNearbyBooks = useCallback(
    async (lng: number, lat: number, distKm: number, typeFilter: string) => {
      setLoading(true);
      setError(null);
      try {
        const data = await booksApi.nearby({
          lng,
          lat,
          maxDistance: distKm,
          type: typeFilter,
        });
        setBooks(Array.isArray(data.books) ? data.books : []);
      } catch (err) {
        setError(getErrorMessage(err, 'Unable to load nearby listings.'));
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    document.title = 'Nearby Book Map — KitabWanag';
  }, []);

  useEffect(() => {
    if (radiusKm > 0) {
      void loadNearbyBooks(center[0], center[1], radiusKm, activeType);
    } else {
      void loadAllBooks(activeType);
    }
  }, [activeType, center, radiusKm, loadAllBooks, loadNearbyBooks]);

  const handleNearMe = () => {
    if (!navigator.geolocation) {
      setLocationDenied(true);
      setLocationNote('Browser location is unavailable here. Pick a city below instead.');
      return;
    }

    setLocating(true);
    setLocationDenied(false);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lng = Number(pos.coords.longitude.toFixed(6));
        const lat = Number(pos.coords.latitude.toFixed(6));
        setSelectedCity('');
        setCenter([lng, lat]);
        setZoom(12);
        const nextRadius = radiusKm > 0 ? radiusKm : 50;
        setRadiusKm(nextRadius);
        setLocationNote(`Centered on your current location (within ${nextRadius} km).`);
        setLocating(false);
      },
      () => {
        setLocating(false);
        setLocationDenied(true);
        setLocationNote('Location access was denied. Pick a city below to explore nearby books.');
      },
      { enableHighAccuracy: false, timeout: 8000 },
    );
  };

  const handleCitySelect = (cityName: string) => {
    setSelectedCity(cityName);
    if (!cityName) {
      setRadiusKm(0);
      setZoom(6);
      setCenter([66.9964, 30.1798]);
      setLocationNote('Showing all community listings across the map.');
      return;
    }
    const preset = findCityPreset(cityName);
    if (preset) {
      setCenter(preset.coordinates);
      setZoom(12);
      const nextRadius = radiusKm > 0 ? radiusKm : 50;
      setRadiusKm(nextRadius);
      setLocationNote(`Showing books within ${nextRadius} km of ${preset.name}.`);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10 space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 pb-6 border-b border-[#E5DFD3]">
        <div>
          <h1 className="font-display text-3xl sm:text-4xl font-bold text-[#1C1F1D]">
            Nearby book map
          </h1>
          <p className="text-sm sm:text-base text-[#5C615D] mt-1.5">{locationNote}</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={handleNearMe}
            disabled={locating}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#1B4D3E] text-[#FAF7F2] text-sm font-semibold hover:bg-[#143A2F] disabled:opacity-60 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <LocateFixed className="w-4 h-4" />
            {locating ? 'Locating...' : 'Books near me'}
          </button>

          <select
            value={selectedCity}
            onChange={(e) => handleCitySelect(e.target.value)}
            aria-label="Pick a city"
            className="h-10 px-3.5 rounded-lg bg-[#FFFFFF] border border-[#E5DFD3] text-sm text-[#1C1F1D] focus:outline-none focus:border-[#1B4D3E]"
          >
            <option value="">All cities (national view)</option>
            {CITY_PRESETS.map((city) => (
              <option key={city.name} value={city.name}>
                {city.name}, {city.region}
              </option>
            ))}
          </select>

          {radiusKm > 0 && (
            <select
              value={radiusKm}
              onChange={(e) => setRadiusKm(Number(e.target.value))}
              aria-label="Search radius"
              className="h-10 px-3 rounded-lg bg-[#FFFFFF] border border-[#E5DFD3] text-sm text-[#1C1F1D] focus:outline-none focus:border-[#1B4D3E]"
            >
              <option value={15}>15 km</option>
              <option value={50}>50 km</option>
              <option value={150}>150 km</option>
              <option value={500}>500 km</option>
            </select>
          )}
        </div>
      </div>

      {locationDenied && (
        <div className="rounded-lg border border-[#E5DFD3] bg-[#F3EFE6] px-4 py-3 flex flex-wrap items-center justify-between gap-3 text-sm">
          <span className="text-[#1C1F1D]">
            Location permission is off. Choose a city quickly:
          </span>
          <div className="flex flex-wrap gap-2">
            {CITY_PRESETS.slice(0, 5).map((c) => (
              <button
                key={c.name}
                type="button"
                onClick={() => handleCitySelect(c.name)}
                className="px-3 py-1.5 rounded-md bg-[#FFFFFF] border border-[#E5DFD3] text-xs font-semibold text-[#1B4D3E] hover:bg-[#1B4D3E] hover:text-[#FAF7F2] transition-colors cursor-pointer"
              >
                {c.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Filter Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="inline-flex items-center gap-1 p-1 bg-[#F3EFE6] border border-[#E5DFD3] rounded-lg">
          {TYPE_OPTIONS.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setActiveType(t)}
              className={`px-3.5 py-1.5 text-sm font-medium rounded-md transition-colors cursor-pointer ${
                activeType === t ? 'bg-[#1B4D3E] text-[#FAF7F2]' : 'text-[#5C615D] hover:text-[#1C1F1D]'
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        <p className="text-sm text-[#5C615D] tabular-nums">
          {loading ? 'Updating map...' : `${books.length} ${books.length === 1 ? 'pin' : 'pins'} shown`}
        </p>
      </div>

      {/* Map + Nearby List Split */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-8">
          <LeafletMap
            books={books}
            center={center}
            zoom={zoom}
            userCircleKm={radiusKm > 0 ? radiusKm : undefined}
            heightClassName="h-[420px] sm:h-[540px]"
          />
        </div>

        <div className="lg:col-span-4 space-y-3 max-h-[540px] overflow-y-auto pr-1">
          <h2 className="font-display text-xl font-semibold text-[#1C1F1D]">
            {radiusKm > 0 ? 'Books in range' : 'Pinned listings'}
          </h2>
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((n) => (
                <div key={n} className="h-24 rounded-xl bg-[#F3EFE6] animate-pulse" />
              ))}
            </div>
          ) : error ? (
            <div className="rounded-xl border border-[#E5DFD3] bg-[#FFFFFF] p-6 space-y-3">
              <p className="text-sm text-red-700">{error}</p>
              <button
                type="button"
                onClick={() => {
                  if (radiusKm > 0) {
                    void loadNearbyBooks(center[0], center[1], radiusKm, activeType);
                  } else {
                    void loadAllBooks(activeType);
                  }
                }}
                className="px-4 py-2 rounded-lg bg-[#1B4D3E] text-[#FAF7F2] text-xs font-semibold cursor-pointer"
              >
                Try Again
              </button>
            </div>
          ) : books.length === 0 ? (
            <div className="rounded-xl border border-[#E5DFD3] bg-[#FFFFFF] p-6 text-sm text-[#5C615D] space-y-3">
              <p>No listings found inside this radius.</p>
              {radiusKm > 0 && (
                <button
                  type="button"
                  onClick={() => handleCitySelect('')}
                  className="text-sm font-semibold text-[#1B4D3E] hover:underline cursor-pointer"
                >
                  Show all cities instead
                </button>
              )}
            </div>
          ) : (
            books.map((book) => (
              <Link
                key={book.id}
                to={`/books/${book.id}`}
                className="block rounded-xl border border-[#E5DFD3] bg-[#FFFFFF] p-4 hover:border-[#1B4D3E] transition-colors"
              >
                <div className="flex items-center justify-between gap-2 text-xs text-[#5C615D]">
                  <span className="font-semibold text-[#1B4D3E]">{book.listingType}</span>
                  {book.distanceKm !== undefined ? (
                    <span className="tabular-nums">{book.distanceKm} km away</span>
                  ) : (
                    <span>{book.city}</span>
                  )}
                </div>
                <h3 className="font-display text-base font-semibold text-[#1C1F1D] mt-1 line-clamp-1">
                  {book.title}
                </h3>
                <p className="text-xs text-[#5C615D] mt-0.5 truncate">{book.author}</p>
                <div className="mt-2 pt-2 border-t border-[#E5DFD3]/60 flex items-center justify-between text-xs">
                  <span className="inline-flex items-center gap-1 text-[#5C615D]">
                    <MapPin className="w-3 h-3 text-[#1B4D3E]" />
                    {book.neighborhood ? `${book.neighborhood}, ${book.city}` : book.city}
                  </span>
                  <span className="font-semibold text-[#1C1F1D] tabular-nums">
                    {book.listingType === 'Sell'
                      ? `${book.price.toLocaleString()} ${book.currency}`
                      : book.listingType}
                  </span>
                </div>
              </Link>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
