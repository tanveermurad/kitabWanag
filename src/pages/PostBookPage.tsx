import { LocateFixed } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { BookPhotoDropzone } from '../components/BookPhotoDropzone';
import { LeafletMap } from '../components/LeafletMap';
import { useAuth } from '../context/AuthContext';
import { booksApi, getErrorMessage, resolveBookImageUrl } from '../lib/api';
import { BOOK_CATEGORIES, BOOK_LANGUAGES, CITY_PRESETS, findCityPreset } from '../lib/cities';
import type { BookCondition, ListingType } from '../types';

const PRESET_COVERS = [
  {
    label: 'Literary Fiction',
    url: '/src/assets/images/book_literary_classic_1795631935232.jpg',
  },
  {
    label: 'Engineering & Code',
    url: '/src/assets/images/book_software_craft_1795631934972.jpg',
  },
  {
    label: 'Science & Math',
    url: '/src/assets/images/book_science_textbook_1795631935957.jpg',
  },
  {
    label: 'History & Culture',
    url: '/src/assets/images/book_regional_history_1795631937282.jpg',
  },
];

export function PostBookPage() {
  const { id } = useParams<{ id: string }>();
  const isEditing = Boolean(id);
  const navigate = useNavigate();
  const { user } = useAuth();

  const initialCity = user?.city || 'Quetta';
  const initialCoords = findCityPreset(initialCity)?.coordinates ?? [66.9964, 30.1798];

  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [isbn, setIsbn] = useState('');
  const [category, setCategory] = useState<string>(BOOK_CATEGORIES[0]);
  const [language, setLanguage] = useState<string>('Balochi');
  const [listingType, setListingType] = useState<ListingType>('Exchange');
  const [condition, setCondition] = useState<BookCondition>('Like New');
  const [price, setPrice] = useState('');
  const [exchangeFor, setExchangeFor] = useState('');
  const [city, setCity] = useState(initialCity);
  const [neighborhood, setNeighborhood] = useState('');
  const [description, setDescription] = useState('');
  const [coordinates, setCoordinates] = useState<[number, number]>(initialCoords);
  const [presetImageUrl, setPresetImageUrl] = useState(PRESET_COVERS[0].url);
  const [customImageUrl, setCustomImageUrl] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>(PRESET_COVERS[0].url);
  const [previewFailed, setPreviewFailed] = useState(false);

  const [loadingInitial, setLoadingInitial] = useState(isEditing);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [geoStatus, setGeoStatus] = useState<string | null>(null);

  useEffect(() => {
    document.title = isEditing ? 'Edit Book Listing — KitabWanag' : 'Post a Book — KitabWanag';
  }, [isEditing]);

  useEffect(() => {
    if (!isEditing || !id) return;
    let cancelled = false;
    setLoadingInitial(true);
    booksApi
      .getById(id)
      .then(({ book }) => {
        if (cancelled) return;
        setTitle(book.title);
        setAuthor(book.author);
        setIsbn(book.isbn || '');
        setCategory(book.category);
        setLanguage(book.language || 'English');
        setListingType(book.listingType);
        setCondition(book.condition);
        setPrice(book.price > 0 ? String(book.price) : '');
        setExchangeFor(book.exchangeFor || '');
        setCity(book.city);
        setNeighborhood(book.neighborhood || '');
        setDescription(book.description);
        setCoordinates(book.location.coordinates);
        setPresetImageUrl(book.imageUrl);
        if (/^https:\/\//i.test(book.imageUrl)) {
          setCustomImageUrl(book.imageUrl);
        }
        setPreviewUrl(resolveBookImageUrl(book.imageUrl));
        setPreviewFailed(false);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(getErrorMessage(err, 'Unable to load listing.'));
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingInitial(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id, isEditing]);

  useEffect(() => {
    return () => {
      if (previewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  const handlePhotoSelect = (file: File | null) => {
    setError(null);
    setPhotoError(null);
    setPreviewFailed(false);
    if (!file) {
      setSelectedFile(null);
      setPreviewUrl(customImageUrl.trim() || presetImageUrl);
      return;
    }
    setSelectedFile(file);
    setCustomImageUrl('');
    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);
  };

  const handleCustomUrlChange = (value: string) => {
    setCustomImageUrl(value);
    setSelectedFile(null);
    setPreviewFailed(false);
    const trimmed = value.trim();
    if (trimmed) {
      setPreviewUrl(trimmed);
    } else {
      setPreviewUrl(presetImageUrl);
    }
  };

  const handleCityChange = (newCity: string) => {
    setCity(newCity);
    const preset = findCityPreset(newCity);
    if (preset) {
      setCoordinates(preset.coordinates);
    }
  };

  const handleUseMyLocation = () => {
    if (!navigator.geolocation) {
      setGeoStatus('Geolocation is not supported in this browser. Click on the map instead.');
      return;
    }
    setGeoStatus('Detecting coordinates...');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lng = Number(pos.coords.longitude.toFixed(6));
        const lat = Number(pos.coords.latitude.toFixed(6));
        setCoordinates([lng, lat]);
        setGeoStatus(`Pin updated to ${lat.toFixed(4)}, ${lng.toFixed(4)}.`);
      },
      () => {
        setGeoStatus('Location access denied. Click directly on the map to set a pickup pin.');
      },
      { enableHighAccuracy: false, timeout: 8000 },
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append('title', title);
      formData.append('author', author);
      if (isbn.trim()) formData.append('isbn', isbn.trim());
      formData.append('category', category);
      formData.append('language', language);
      formData.append('listingType', listingType);
      formData.append('condition', condition);
      if (price) formData.append('price', price);
      if (exchangeFor) formData.append('exchangeFor', exchangeFor);
      formData.append('city', city);
      formData.append('neighborhood', neighborhood);
      formData.append('description', description);
      formData.append('lng', String(coordinates[0]));
      formData.append('lat', String(coordinates[1]));
      if (selectedFile) {
        formData.append('photo', selectedFile);
      } else if (customImageUrl.trim()) {
        formData.append('imageUrl', customImageUrl.trim());
      } else {
        formData.append('imageUrl', presetImageUrl);
      }

      const data = isEditing && id ? await booksApi.update(id, formData) : await booksApi.create(formData);
      navigate(`/books/${data.book.id}`);
    } catch (err) {
      const msg = getErrorMessage(err, 'Unable to save book listing.');
      setError(msg);
      if (selectedFile && /photo|upload|supabase|cloudinary|storage|image/i.test(msg)) {
        setPhotoError(msg);
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (loadingInitial) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-12">
        <div className="h-96 rounded-xl bg-[#F3EFE6] animate-pulse" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10">
      <div className="pb-6 border-b border-[#E5DFD3] mb-8">
        <h1 className="font-display text-3xl sm:text-4xl font-bold text-[#1C1F1D]">
          {isEditing ? 'Edit book listing' : 'Post a book'}
        </h1>
        <p className="text-sm sm:text-base text-[#5C615D] mt-1.5">
          Share a book to exchange, list a second-hand copy for sale, or request a wanted title.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left: Photo & Preview */}
        <div className="lg:col-span-5 space-y-4">
          <BookPhotoDropzone
            previewUrl={previewUrl}
            previewFailed={previewFailed}
            onPreviewError={() => setPreviewFailed(true)}
            selectedFile={selectedFile}
            onFileSelect={handlePhotoSelect}
            error={photoError}
            onError={setPhotoError}
          />

          <div className="space-y-2">
            <p className="text-xs font-medium text-[#5C615D]">Or select an editorial cover:</p>
            <div className="grid grid-cols-2 gap-2">
              {PRESET_COVERS.map((preset) => (
                <button
                  key={preset.url}
                  type="button"
                  onClick={() => {
                    setSelectedFile(null);
                    setPhotoError(null);
                    setCustomImageUrl('');
                    setPresetImageUrl(preset.url);
                    setPreviewFailed(false);
                    setPreviewUrl(preset.url);
                  }}
                  className={`px-2.5 py-2 rounded-lg text-xs font-medium border text-left transition-colors cursor-pointer ${
                    !selectedFile && !customImageUrl.trim() && presetImageUrl === preset.url
                      ? 'border-[#1B4D3E] bg-[#1B4D3E] text-[#FAF7F2]'
                      : 'border-[#E5DFD3] bg-[#FFFFFF] text-[#1C1F1D] hover:bg-[#F3EFE6]'
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label htmlFor="customImageUrl" className="block text-xs font-medium text-[#5C615D] mb-1.5">
              Or paste a cover image URL (https://)
            </label>
            <input
              id="customImageUrl"
              type="url"
              value={customImageUrl}
              onChange={(e) => handleCustomUrlChange(e.target.value)}
              placeholder="https://..."
              className="w-full h-10 px-3 rounded-lg bg-[#FFFFFF] border border-[#E5DFD3] text-xs focus:outline-none focus:border-[#1B4D3E]"
            />
          </div>
        </div>

        {/* Right: Details & Map Pin */}
        <div className="lg:col-span-7 space-y-5 bg-[#FFFFFF] border border-[#E5DFD3] rounded-xl p-6">
          {/* Listing Type Segmented Selector */}
          <div>
            <span className="block text-sm font-medium text-[#1C1F1D] mb-2">Listing type</span>
            <div className="grid grid-cols-3 gap-2">
              {(['Exchange', 'Sell', 'Buy'] as ListingType[]).map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setListingType(type)}
                  className={`py-2.5 px-3 rounded-lg text-sm font-semibold border transition-colors cursor-pointer ${
                    listingType === type
                      ? 'bg-[#1B4D3E] border-[#1B4D3E] text-[#FAF7F2]'
                      : 'bg-[#FAF7F2] border-[#E5DFD3] text-[#1C1F1D] hover:bg-[#F3EFE6]'
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label htmlFor="bookTitle" className="block text-sm font-medium text-[#1C1F1D] mb-1.5">
              Book title
            </label>
            <input
              id="bookTitle"
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Designing Data-Intensive Applications"
              className="w-full h-11 px-3.5 rounded-lg bg-[#FAF7F2] border border-[#E5DFD3] text-sm focus:outline-none focus:border-[#1B4D3E]"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="bookAuthor" className="block text-sm font-medium text-[#1C1F1D] mb-1.5">
                Author
              </label>
              <input
                id="bookAuthor"
                type="text"
                required
                value={author}
                onChange={(e) => setAuthor(e.target.value)}
                placeholder="e.g. Syed Zahoor Shah Hashmi"
                className="w-full h-11 px-3.5 rounded-lg bg-[#FAF7F2] border border-[#E5DFD3] text-sm focus:outline-none focus:border-[#1B4D3E]"
              />
            </div>

            <div>
              <label htmlFor="bookIsbn" className="block text-sm font-medium text-[#1C1F1D] mb-1.5">
                ISBN (optional)
              </label>
              <input
                id="bookIsbn"
                type="text"
                value={isbn}
                onChange={(e) => setIsbn(e.target.value)}
                placeholder="e.g. 978-0134757599"
                className="w-full h-11 px-3.5 rounded-lg bg-[#FAF7F2] border border-[#E5DFD3] text-sm font-mono focus:outline-none focus:border-[#1B4D3E]"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="bookCategory" className="block text-sm font-medium text-[#1C1F1D] mb-1.5">
                Category
              </label>
              <select
                id="bookCategory"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full h-11 px-3.5 rounded-lg bg-[#FAF7F2] border border-[#E5DFD3] text-sm focus:outline-none focus:border-[#1B4D3E]"
              >
                {BOOK_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="bookLanguage" className="block text-sm font-medium text-[#1C1F1D] mb-1.5">
                Language
              </label>
              <select
                id="bookLanguage"
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className="w-full h-11 px-3.5 rounded-lg bg-[#FAF7F2] border border-[#E5DFD3] text-sm focus:outline-none focus:border-[#1B4D3E]"
              >
                {BOOK_LANGUAGES.map((lang) => (
                  <option key={lang} value={lang}>
                    {lang}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="bookCondition" className="block text-sm font-medium text-[#1C1F1D] mb-1.5">
                Condition
              </label>
              <select
                id="bookCondition"
                value={condition}
                onChange={(e) => setCondition(e.target.value as BookCondition)}
                className="w-full h-11 px-3.5 rounded-lg bg-[#FAF7F2] border border-[#E5DFD3] text-sm focus:outline-none focus:border-[#1B4D3E]"
              >
                <option value="Like New">Like New</option>
                <option value="Good">Good</option>
                <option value="Fair">Fair</option>
                <option value="Any">Any</option>
              </select>
            </div>

            {listingType === 'Exchange' ? (
              <div>
                <label htmlFor="exchangeFor" className="block text-sm font-medium text-[#1C1F1D] mb-1.5">
                  Looking to swap for
                </label>
                <input
                  id="exchangeFor"
                  type="text"
                  value={exchangeFor}
                  onChange={(e) => setExchangeFor(e.target.value)}
                  placeholder="e.g. Algorithms or literary novels"
                  className="w-full h-11 px-3.5 rounded-lg bg-[#FAF7F2] border border-[#E5DFD3] text-sm focus:outline-none focus:border-[#1B4D3E]"
                />
              </div>
            ) : (
              <div>
                <label htmlFor="bookPrice" className="block text-sm font-medium text-[#1C1F1D] mb-1.5">
                  {listingType === 'Sell' ? 'Price (PKR)' : 'Max budget (PKR, optional)'}
                </label>
                <input
                  id="bookPrice"
                  type="number"
                  min={0}
                  max={1000000}
                  required={listingType === 'Sell'}
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  placeholder="e.g. 1200"
                  className="w-full h-11 px-3.5 rounded-lg bg-[#FAF7F2] border border-[#E5DFD3] text-sm tabular-nums focus:outline-none focus:border-[#1B4D3E]"
                />
              </div>
            )}
          </div>

          <div>
            <label htmlFor="bookDescription" className="block text-sm font-medium text-[#1C1F1D] mb-1.5">
              Description
            </label>
            <textarea
              id="bookDescription"
              required
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Note edition, markings, binding state, or preferred meetup hours..."
              className="w-full p-3.5 rounded-lg bg-[#FAF7F2] border border-[#E5DFD3] text-sm focus:outline-none focus:border-[#1B4D3E]"
            />
          </div>

          {/* City, Neighborhood & Map Pin */}
          <div className="pt-2 border-t border-[#E5DFD3] space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="bookCity" className="block text-sm font-medium text-[#1C1F1D] mb-1.5">
                  City
                </label>
                <select
                  id="bookCity"
                  value={city}
                  onChange={(e) => handleCityChange(e.target.value)}
                  className="w-full h-11 px-3.5 rounded-lg bg-[#FAF7F2] border border-[#E5DFD3] text-sm focus:outline-none focus:border-[#1B4D3E]"
                >
                  {CITY_PRESETS.map((c) => (
                    <option key={c.name} value={c.name}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="neighborhood" className="block text-sm font-medium text-[#1C1F1D] mb-1.5">
                  Neighborhood / Campus (optional)
                </label>
                <input
                  id="neighborhood"
                  type="text"
                  value={neighborhood}
                  onChange={(e) => setNeighborhood(e.target.value)}
                  placeholder="e.g. Jinnah Town or Gulberg"
                  className="w-full h-11 px-3.5 rounded-lg bg-[#FAF7F2] border border-[#E5DFD3] text-sm focus:outline-none focus:border-[#1B4D3E]"
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs text-[#5C615D]">
                Click anywhere on the map to adjust pickup pin ({coordinates[1].toFixed(4)},{' '}
                {coordinates[0].toFixed(4)}).
              </p>
              <button
                type="button"
                onClick={handleUseMyLocation}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#1B4D3E] hover:underline cursor-pointer"
              >
                <LocateFixed className="w-3.5 h-3.5" />
                Use my location
              </button>
            </div>
            {geoStatus && <p className="text-xs text-[#5C615D]">{geoStatus}</p>}

            <LeafletMap
              books={[]}
              center={coordinates}
              zoom={12}
              heightClassName="h-56"
              interactivePicker
              pickedCoords={coordinates}
              onPickCoords={setCoordinates}
            />
          </div>

          {error && (
            <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3.5 py-2.5">
              {error}
            </p>
          )}

          <div className="pt-2 flex flex-wrap items-center gap-3">
            <button
              type="submit"
              disabled={submitting}
              className="px-6 py-3 rounded-lg bg-[#1B4D3E] text-[#FAF7F2] text-sm font-semibold hover:bg-[#143A2F] disabled:opacity-60 transition-colors cursor-pointer"
            >
              {submitting ? 'Saving...' : isEditing ? 'Save Changes' : 'Publish Listing'}
            </button>
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="px-5 py-3 rounded-lg border border-[#E5DFD3] text-sm font-medium text-[#1C1F1D] hover:bg-[#F3EFE6] cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
