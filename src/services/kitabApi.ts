import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
  type Unsubscribe,
} from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType } from '../lib/firebase';
import { findCityPreset } from '../lib/cities';
import type {
  BookAnswer,
  BookCondition,
  BookListing,
  BookQuestion,
  BookRequest,
  BookReview,
  ListingType,
  RequestStatus,
  UserPublic,
} from '../types';
import { apiRequest } from './apiClient';

export interface BookListFilters {
  type?: string;
  q?: string;
  city?: string;
  category?: string;
  language?: string;
}

export interface NearbyBooksParams {
  lng: number;
  lat: number;
  maxDistance: number;
  type?: string;
}

export interface BookDiscussionsResponse {
  reviews: BookReview[];
  questions: BookQuestion[];
  averageRating: number;
  reviewCount: number;
}

const VALID_ID_RX = /^[a-zA-Z0-9_-]{1,128}$/;
const VALID_LISTING_TYPES = new Set<ListingType>(['Exchange', 'Sell', 'Buy']);
const VALID_CONDITIONS = new Set<BookCondition>(['Like New', 'Good', 'Fair', 'Any']);
const VALID_STATUSES = new Set<RequestStatus>(['Pending', 'Accepted', 'Declined']);

function makeId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`;
}

function assertValidId(id: string, label = 'ID'): string {
  const trimmed = id.trim();
  if (!VALID_ID_RX.test(trimmed)) {
    throw new Error(`Invalid ${label} format.`);
  }
  return trimmed;
}

function clampText(value: unknown, maxLen: number, fallback = ''): string {
  if (typeof value !== 'string') return fallback;
  const trimmed = value.trim();
  if (!trimmed) return fallback;
  return trimmed.slice(0, maxLen);
}

function tsToIso(value: unknown): string {
  if (value instanceof Timestamp) {
    return value.toDate().toISOString();
  }
  if (value && typeof value === 'object' && 'toDate' in value && typeof (value as { toDate: unknown }).toDate === 'function') {
    return (value as { toDate: () => Date }).toDate().toISOString();
  }
  if (typeof value === 'string' && value) {
    return value;
  }
  return new Date().toISOString();
}

function haversineKm(a: [number, number], b: [number, number]): number {
  const [lng1, lat1] = a;
  const [lng2, lat2] = b;
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const h =
    sinLat * sinLat +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * sinLng * sinLng;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

function docToBook(id: string, data: Record<string, unknown>, distanceKm?: number): BookListing {
  const lng = Number(data.lng ?? 66.9964);
  const lat = Number(data.lat ?? 30.1798);
  return {
    id,
    title: String(data.title || ''),
    author: String(data.author || ''),
    isbn: String(data.isbn || ''),
    category: String(data.category || 'Novels'),
    language: String(data.language || 'English'),
    listingType: (data.listingType as ListingType) || 'Exchange',
    condition: (data.condition as BookCondition) || 'Good',
    price: Number(data.price ?? 0),
    currency: String(data.currency || 'PKR'),
    exchangeFor: String(data.exchangeFor || ''),
    description: String(data.description || ''),
    imageUrl: String(data.imageUrl || ''),
    city: String(data.city || 'Quetta'),
    neighborhood: String(data.neighborhood || ''),
    location: {
      type: 'Point',
      coordinates: [lng, lat],
    },
    ownerId: String(data.ownerId || ''),
    ownerName: String(data.ownerName || ''),
    createdAt: tsToIso(data.createdAt),
    ...(data.updatedAt ? { updatedAt: tsToIso(data.updatedAt) } : {}),
    ...(distanceKm !== undefined ? { distanceKm: Number(distanceKm.toFixed(1)) } : {}),
  };
}

function docToRequest(id: string, data: Record<string, unknown>): BookRequest {
  return {
    id,
    bookId: String(data.bookId || ''),
    bookTitle: String(data.bookTitle || ''),
    bookType: (data.bookType as ListingType) || 'Exchange',
    bookImageUrl: String(data.bookImageUrl || ''),
    ownerId: String(data.ownerId || ''),
    ownerName: String(data.ownerName || ''),
    requesterId: String(data.requesterId || ''),
    requesterName: String(data.requesterName || ''),
    requesterCity: String(data.requesterCity || ''),
    offerBookTitle: String(data.offerBookTitle || ''),
    message: String(data.message || ''),
    contactNote: String(data.contactNote || ''),
    status: (data.status as RequestStatus) || 'Pending',
    createdAt: tsToIso(data.createdAt),
  };
}

function requireVerifiedAuth() {
  const current = auth.currentUser;
  if (!current) {
    throw new Error('Please sign in to continue.');
  }
  if (!current.emailVerified) {
    throw new Error('Please verify your email address before posting books, sending requests, or leaving reviews.');
  }
  return current;
}

async function resolveCoverImageUrl(formData: FormData): Promise<string> {
  const file = formData.get('photo');
  if (file instanceof File && file.size > 0) {
    const uploadFd = new FormData();
    uploadFd.append('photo', file);
    try {
      const uploaded = await apiRequest<{ imageUrl: string }>('/api/uploads', {
        method: 'POST',
        body: uploadFd,
        auth: true,
        fallbackMessage: 'Could not upload cover photo.',
      });
      if (uploaded.imageUrl) {
        return clampText(uploaded.imageUrl, 500, '/src/assets/images/book_literary_classic_1795631935232.jpg');
      }
    } catch {
      throw new Error(
        'Photo upload server is unavailable here. Please select one of the editorial book covers or paste a cover image URL.',
      );
    }
  }
  const rawUrl = clampText(formData.get('imageUrl'), 500);
  if (!rawUrl) {
    return '/src/assets/images/book_literary_classic_1795631935232.jpg';
  }
  if (rawUrl.startsWith('/src/assets/') || rawUrl.startsWith('/uploads/') || /^https:\/\//i.test(rawUrl)) {
    return rawUrl;
  }
  throw new Error('Cover image URL must start with https:// or use an editorial cover.');
}

function parseBookFormData(formData: FormData) {
  const title = clampText(formData.get('title'), 140);
  const author = clampText(formData.get('author'), 100);
  if (!title || !author) {
    throw new Error('Book title and author are required.');
  }
  const isbn = clampText(formData.get('isbn'), 32, '');
  const category = clampText(formData.get('category'), 60, 'Novels');
  const language = clampText(formData.get('language'), 40, 'English');

  const listingTypeRaw = String(formData.get('listingType') || 'Exchange') as ListingType;
  const listingType: ListingType = VALID_LISTING_TYPES.has(listingTypeRaw) ? listingTypeRaw : 'Exchange';

  const conditionRaw = String(formData.get('condition') || 'Good') as BookCondition;
  const condition: BookCondition = VALID_CONDITIONS.has(conditionRaw) ? conditionRaw : 'Good';

  const rawPrice = Number(formData.get('price') || 0);
  const price =
    listingType === 'Exchange'
      ? 0
      : Number.isFinite(rawPrice) && rawPrice >= 0
        ? Math.min(1000000, Math.round(rawPrice))
        : 0;
  if (listingType === 'Sell' && price <= 0) {
    throw new Error('Please enter a valid price for a Sell listing.');
  }

  const exchangeFor = clampText(formData.get('exchangeFor'), 160, '');
  const description = clampText(formData.get('description'), 1500);
  if (!description) {
    throw new Error('Please add a short description for your book listing.');
  }
  const city = clampText(formData.get('city'), 60, 'Quetta');
  const neighborhood = clampText(formData.get('neighborhood'), 80, '');

  const presetCoords = findCityPreset(city)?.coordinates ?? [66.9964, 30.1798];
  const lngRaw = Number(formData.get('lng'));
  const latRaw = Number(formData.get('lat'));
  const lng = Number.isFinite(lngRaw) && lngRaw >= -180 && lngRaw <= 180 ? Number(lngRaw.toFixed(6)) : presetCoords[0];
  const lat = Number.isFinite(latRaw) && latRaw >= -90 && latRaw <= 90 ? Number(latRaw.toFixed(6)) : presetCoords[1];

  return {
    title,
    author,
    isbn,
    category,
    language,
    listingType,
    condition,
    price,
    currency: 'PKR' as const,
    exchangeFor,
    description,
    city,
    neighborhood,
    lng,
    lat,
  };
}

const inFlightUserSync = new Map<string, Promise<UserPublic>>();

async function performSyncSignedInUser(
  fbUser: {
    uid: string;
    displayName: string | null;
    email: string | null;
    emailVerified?: boolean;
  },
  preferredCity?: string,
): Promise<UserPublic> {
  const uid = assertValidId(fbUser.uid, 'user ID');
  const publicPath = `users/${uid}`;
  const privatePath = `users/${uid}/private/info`;
  const publicRef = doc(db, 'users', uid);
  const privateRef = doc(db, 'users', uid, 'private', 'info');

  let publicSnap;
  try {
    publicSnap = await getDoc(publicRef);
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, publicPath);
  }

  const safeName = clampText(fbUser.displayName, 80, fbUser.email?.split('@')[0] || 'Reader');
  const safeEmail = clampText(fbUser.email, 120);
  const safePreferredCity = preferredCity ? clampText(preferredCity, 60, 'Quetta') : undefined;
  const isVerified = Boolean(fbUser.emailVerified);

  if (!isVerified) {
    const existingData = publicSnap.exists() ? publicSnap.data() || {} : {};
    return {
      id: uid,
      name: String(existingData.name || safeName),
      email: safeEmail,
      city: String(existingData.city || safePreferredCity || 'Quetta'),
      createdAt: existingData.createdAt ? tsToIso(existingData.createdAt) : new Date().toISOString(),
      emailVerified: false,
    };
  }

  if (!publicSnap.exists()) {
    try {
      await setDoc(publicRef, {
        id: uid,
        name: safeName,
        city: safePreferredCity || 'Quetta',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, publicPath);
    }
  } else if (safePreferredCity && publicSnap.data()?.city !== safePreferredCity) {
    try {
      await updateDoc(publicRef, {
        name: safeName,
        city: safePreferredCity,
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, publicPath);
    }
  }

  if (safeEmail) {
    let privateSnap;
    try {
      privateSnap = await getDoc(privateRef);
    } catch (err) {
      handleFirestoreError(err, OperationType.GET, privatePath);
    }
    try {
      if (!privateSnap.exists()) {
        await setDoc(privateRef, {
          email: safeEmail,
          updatedAt: serverTimestamp(),
        });
      } else if (privateSnap.data()?.email !== safeEmail) {
        await updateDoc(privateRef, {
          email: safeEmail,
          updatedAt: serverTimestamp(),
        });
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, privatePath);
    }
  }

  let finalSnap;
  try {
    finalSnap = await getDoc(publicRef);
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, publicPath);
  }
  const data = finalSnap.data() || {};
  return {
    id: uid,
    name: String(data.name || safeName),
    email: safeEmail,
    city: String(data.city || safePreferredCity || 'Quetta'),
    createdAt: tsToIso(data.createdAt),
    emailVerified: true,
  };
}

export const authApi = {
  async syncSignedInUser(
    fbUser: {
      uid: string;
      displayName: string | null;
      email: string | null;
      emailVerified?: boolean;
    },
    preferredCity?: string,
  ): Promise<UserPublic> {
    const uid = assertValidId(fbUser.uid, 'user ID');
    const existingPromise = inFlightUserSync.get(uid);
    if (existingPromise) {
      const result = await existingPromise;
      if (fbUser.emailVerified && preferredCity && result.city !== preferredCity.trim()) {
        return authApi.updateCity(preferredCity);
      }
      return result;
    }

    const syncPromise = performSyncSignedInUser(fbUser, preferredCity).finally(() => {
      inFlightUserSync.delete(uid);
    });
    inFlightUserSync.set(uid, syncPromise);
    return syncPromise;
  },

  async me(): Promise<{ user: UserPublic }> {
    const current = auth.currentUser;
    if (!current) {
      throw new Error('Please sign in to view your profile.');
    }
    const user = await authApi.syncSignedInUser(current);
    return { user };
  },

  async updateCity(city: string): Promise<UserPublic> {
    const current = requireVerifiedAuth();
    const uid = assertValidId(current.uid, 'user ID');
    const safeCity = clampText(city, 60, 'Quetta');
    const publicPath = `users/${uid}`;
    const publicRef = doc(db, 'users', uid);

    let snap;
    try {
      snap = await getDoc(publicRef);
    } catch (err) {
      handleFirestoreError(err, OperationType.GET, publicPath);
    }
    const existingData = snap.data() || {};
    const safeName = clampText(existingData.name || current.displayName, 80, 'Reader');

    try {
      await updateDoc(publicRef, {
        name: safeName,
        city: safeCity,
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, publicPath);
    }

    return {
      id: uid,
      name: safeName,
      email: current.email || '',
      city: safeCity,
      createdAt: tsToIso(existingData.createdAt),
    };
  },
};

export const booksApi = {
  async list(filters: BookListFilters = {}, _signal?: AbortSignal): Promise<{ books: BookListing[] }> {
    const typeFilter = filters.type && filters.type !== 'All' ? filters.type : undefined;
    const booksCol = collection(db, 'books');
    const qRef = typeFilter
      ? query(booksCol, where('listingType', '==', typeFilter))
      : query(booksCol, where('listingType', 'in', ['Exchange', 'Sell', 'Buy']));

    let snap;
    try {
      snap = await getDocs(qRef);
    } catch (err) {
      handleFirestoreError(err, OperationType.LIST, 'books');
    }

    const q = filters.q?.trim().toLowerCase() || '';
    const qCompact = q.replace(/[-\s]/g, '');
    const city = filters.city?.trim().toLowerCase() || '';
    const category = filters.category && filters.category !== 'All' ? filters.category.trim().toLowerCase() : '';
    const language = filters.language && filters.language !== 'All' ? filters.language.trim().toLowerCase() : '';

    const books = snap.docs
      .map((d) => docToBook(d.id, d.data() as Record<string, unknown>))
      .filter((b) => {
        if (city && b.city.toLowerCase() !== city) return false;
        if (category && b.category.toLowerCase() !== category) return false;
        if (language && b.language.toLowerCase() !== language) return false;
        if (q) {
          const bookIsbn = (b.isbn || '').toLowerCase();
          const compactBookIsbn = bookIsbn.replace(/[-\s]/g, '');
          const hay = `${b.title} ${b.author} ${bookIsbn} ${b.city} ${b.category} ${b.language} ${b.description}`.toLowerCase();
          const matchesIsbn = qCompact.length > 0 && compactBookIsbn.includes(qCompact);
          if (!hay.includes(q) && !matchesIsbn) return false;
        }
        return true;
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return { books };
  },

  async nearby(paramsObj: NearbyBooksParams): Promise<{ books: BookListing[] }> {
    const { books } = await booksApi.list({ type: paramsObj.type });
    const nearbyBooks = books
      .map((b) => ({
        ...b,
        distanceKm: Number(haversineKm([paramsObj.lng, paramsObj.lat], b.location.coordinates).toFixed(1)),
      }))
      .filter((b) => b.distanceKm <= paramsObj.maxDistance)
      .sort((a, b) => a.distanceKm - b.distanceKm);

    return { books: nearbyBooks };
  },

  async mine(): Promise<{ books: BookListing[] }> {
    const current = auth.currentUser;
    if (!current) {
      throw new Error('Please sign in to view your listings.');
    }
    const qRef = query(collection(db, 'books'), where('ownerId', '==', current.uid));
    let snap;
    try {
      snap = await getDocs(qRef);
    } catch (err) {
      handleFirestoreError(err, OperationType.LIST, 'books');
    }
    const books = snap.docs
      .map((d) => docToBook(d.id, d.data() as Record<string, unknown>))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return { books };
  },

  subscribeMine(
    uid: string,
    onData: (books: BookListing[]) => void,
    onError: (err: Error) => void,
  ): Unsubscribe {
    const qRef = query(collection(db, 'books'), where('ownerId', '==', uid));
    return onSnapshot(
      qRef,
      (snap) => {
        const list = snap.docs
          .map((d) => docToBook(d.id, d.data() as Record<string, unknown>))
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        onData(list);
      },
      (error) => {
        try {
          handleFirestoreError(error, OperationType.LIST, 'books');
        } catch (wrapped) {
          onError(wrapped as Error);
        }
      },
    );
  },

  async getById(id: string): Promise<{ book: BookListing }> {
    const safeId = assertValidId(id, 'book ID');
    const path = `books/${safeId}`;
    let snap;
    try {
      snap = await getDoc(doc(db, 'books', safeId));
    } catch (err) {
      handleFirestoreError(err, OperationType.GET, path);
    }
    if (!snap.exists()) {
      throw new Error('Book listing not found.');
    }
    return { book: docToBook(snap.id, snap.data() as Record<string, unknown>) };
  },

  async create(formData: FormData): Promise<{ book: BookListing }> {
    const current = requireVerifiedAuth();
    const uid = assertValidId(current.uid, 'user ID');
    const fields = parseBookFormData(formData);
    const imageUrl = await resolveCoverImageUrl(formData);
    const userProfile = await authApi.syncSignedInUser(current);
    const ownerName = clampText(userProfile.name, 80, 'Reader');

    const bookId = makeId('bk');
    const path = `books/${bookId}`;

    try {
      await setDoc(doc(db, 'books', bookId), {
        ...fields,
        imageUrl,
        ownerId: uid,
        ownerName,
        createdAt: serverTimestamp(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, path);
    }

    return booksApi.getById(bookId);
  },

  async update(id: string, formData: FormData): Promise<{ book: BookListing }> {
    requireVerifiedAuth();
    const safeId = assertValidId(id, 'book ID');
    const fields = parseBookFormData(formData);
    const imageUrl = await resolveCoverImageUrl(formData);
    const path = `books/${safeId}`;

    try {
      await updateDoc(doc(db, 'books', safeId), {
        title: fields.title,
        author: fields.author,
        isbn: fields.isbn,
        category: fields.category,
        language: fields.language,
        listingType: fields.listingType,
        condition: fields.condition,
        price: fields.price,
        exchangeFor: fields.exchangeFor,
        description: fields.description,
        imageUrl,
        city: fields.city,
        neighborhood: fields.neighborhood,
        lng: fields.lng,
        lat: fields.lat,
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, path);
    }

    return booksApi.getById(safeId);
  },

  async remove(id: string): Promise<{ deleted: boolean; id: string }> {
    requireVerifiedAuth();
    const safeId = assertValidId(id, 'book ID');
    const path = `books/${safeId}`;
    try {
      await deleteDoc(doc(db, 'books', safeId));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, path);
    }
    return { deleted: true, id: safeId };
  },

  async seedStarterLibrary(): Promise<BookListing[]> {
    const current = requireVerifiedAuth();
    const uid = assertValidId(current.uid, 'user ID');
    const profile = await authApi.syncSignedInUser(current);
    const ownerName = clampText(profile.name, 80, 'Reader');

    const starterItems = [
      {
        title: 'Nazuk: Modern Balochi Short Novel',
        author: 'Syed Zahoor Shah Hashmi',
        isbn: '978-9698501075',
        category: 'Novels',
        language: 'Balochi',
        listingType: 'Exchange' as ListingType,
        condition: 'Good' as BookCondition,
        price: 0,
        exchangeFor: 'Balochi or Brahui novels, or Balochistan history volumes',
        description:
          'Well-kept edition of Nazuk in Balochi. Looking to swap with another regional novel or historical work.',
        imageUrl: '/src/assets/images/book_literary_classic_1795631935232.jpg',
        city: 'Turbat',
        neighborhood: 'Main Bazaar',
        lng: 63.0439,
        lat: 26.0028,
      },
      {
        title: 'Code Craft: Principles & Patterns in Software Engineering',
        author: 'James Lyons',
        isbn: '978-0134757599',
        category: 'Computer Science',
        language: 'English',
        listingType: 'Exchange' as ListingType,
        condition: 'Like New' as BookCondition,
        price: 0,
        exchangeFor: 'Designing Data-Intensive Applications or Clean Architecture',
        description:
          'Clean hardcover edition used during my final-year systems course. No highlights or margin notes.',
        imageUrl: '/src/assets/images/book_software_craft_1795631934972.jpg',
        city: 'Quetta',
        neighborhood: 'Jinnah Town',
        lng: 66.9895,
        lat: 30.1912,
      },
      {
        title: 'History & Grammar of the Brahui Language',
        author: 'Denys de S. Bray',
        isbn: '978-9698501082',
        category: 'History & Heritage',
        language: 'Brahui',
        listingType: 'Sell' as ListingType,
        condition: 'Like New' as BookCondition,
        price: 1400,
        exchangeFor: '',
        description:
          'Clean reference volume covering Brahui linguistics, oral heritage, and regional history around Kalat and Quetta.',
        imageUrl: '/src/assets/images/book_regional_history_1795631937282.jpg',
        city: 'Quetta',
        neighborhood: 'Sariab Road',
        lng: 66.9922,
        lat: 30.1615,
      },
      {
        title: 'University Principles of Mathematics & Physics',
        author: 'Dr. S. H. Rizvi',
        isbn: '978-9694201023',
        category: 'Mathematics & Physics',
        language: 'English',
        listingType: 'Sell' as ListingType,
        condition: 'Good' as BookCondition,
        price: 1250,
        exchangeFor: '',
        description:
          'Complete foundational textbook covering multivariable calculus, linear algebra, and classical mechanics.',
        imageUrl: '/src/assets/images/book_science_textbook_1795631935957.jpg',
        city: 'Lahore',
        neighborhood: 'Gulberg III',
        lng: 74.3461,
        lat: 31.5102,
      },
      {
        title: 'World Architecture: An Illustrated Cultural History',
        author: 'Eliza Harper & Liam Reed',
        isbn: '978-0500342930',
        category: 'History & Heritage',
        language: 'English',
        listingType: 'Sell' as ListingType,
        condition: 'Like New' as BookCondition,
        price: 2400,
        exchangeFor: '',
        description:
          'Large-format illustrated volume featuring heritage masonry, timber mosques, and civic architecture.',
        imageUrl: '/src/assets/images/book_regional_history_1795631937282.jpg',
        city: 'Islamabad',
        neighborhood: 'Sector F-7/2',
        lng: 73.0551,
        lat: 33.7215,
      },
      {
        title: 'Wanted: Operating System Concepts (10th Edition)',
        author: 'Silberschatz, Galvin & Gagne',
        isbn: '978-1119800361',
        category: 'Computer Science',
        language: 'English',
        listingType: 'Buy' as ListingType,
        condition: 'Any' as BookCondition,
        price: 1800,
        exchangeFor: '',
        description:
          'Looking to buy a clean second-hand copy before semester midterms near Clifton or University Road.',
        imageUrl: '/src/assets/images/book_software_craft_1795631934972.jpg',
        city: 'Karachi',
        neighborhood: 'Clifton Block 5',
        lng: 67.0285,
        lat: 24.8138,
      },
    ];

    const batch = writeBatch(db);
    for (const item of starterItems) {
      const bookId = makeId('bk');
      batch.set(doc(db, 'books', bookId), {
        ...item,
        currency: 'PKR',
        ownerId: uid,
        ownerName,
        createdAt: serverTimestamp(),
      });
    }

    try {
      await batch.commit();
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'books');
    }

    const { books } = await booksApi.list();
    return books;
  },
};

export const requestsApi = {
  async create(payload: {
    bookId: string;
    offerBookTitle: string;
    message: string;
    contactNote: string;
  }): Promise<{ request: BookRequest }> {
    const current = requireVerifiedAuth();
    const uid = assertValidId(current.uid, 'user ID');
    const safeBookId = assertValidId(payload.bookId, 'book ID');

    const { book } = await booksApi.getById(safeBookId);
    if (book.ownerId === uid) {
      throw new Error('You cannot send a request to your own listing.');
    }

    const offerBookTitle = clampText(payload.offerBookTitle, 140, '');
    if (book.listingType === 'Exchange' && !offerBookTitle) {
      throw new Error('Please include the book title you are offering to swap.');
    }

    const message = clampText(payload.message, 600);
    const contactNote = clampText(payload.contactNote, 180);
    if (!message || !contactNote) {
      throw new Error('Please include a message and pickup or contact preference.');
    }

    const requesterProfile = await authApi.syncSignedInUser(current);
    const requestId = makeId('req');
    const path = `requests/${requestId}`;

    try {
      await setDoc(doc(db, 'requests', requestId), {
        bookId: safeBookId,
        bookTitle: clampText(book.title, 140, 'Book'),
        bookType: book.listingType,
        bookImageUrl: clampText(book.imageUrl, 500, '/src/assets/images/book_literary_classic_1795631935232.jpg'),
        ownerId: assertValidId(book.ownerId, 'owner ID'),
        ownerName: clampText(book.ownerName, 80, 'Owner'),
        requesterId: uid,
        requesterName: clampText(requesterProfile.name, 80, 'Reader'),
        requesterCity: clampText(requesterProfile.city, 60, 'Quetta'),
        offerBookTitle,
        message,
        contactNote,
        status: 'Pending',
        createdAt: serverTimestamp(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, path);
    }

    let createdSnap;
    try {
      createdSnap = await getDoc(doc(db, 'requests', requestId));
    } catch (err) {
      handleFirestoreError(err, OperationType.GET, path);
    }

    return {
      request: docToRequest(createdSnap.id, (createdSnap.data() || {}) as Record<string, unknown>),
    };
  },

  async incoming(): Promise<{ requests: BookRequest[] }> {
    const current = auth.currentUser;
    if (!current) {
      throw new Error('Please sign in to view incoming requests.');
    }
    const qRef = query(collection(db, 'requests'), where('ownerId', '==', current.uid));
    let snap;
    try {
      snap = await getDocs(qRef);
    } catch (err) {
      handleFirestoreError(err, OperationType.LIST, 'requests');
    }
    const requests = snap.docs
      .map((d) => docToRequest(d.id, d.data() as Record<string, unknown>))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return { requests };
  },

  async outgoing(): Promise<{ requests: BookRequest[] }> {
    const current = auth.currentUser;
    if (!current) {
      throw new Error('Please sign in to view sent requests.');
    }
    const qRef = query(collection(db, 'requests'), where('requesterId', '==', current.uid));
    let snap;
    try {
      snap = await getDocs(qRef);
    } catch (err) {
      handleFirestoreError(err, OperationType.LIST, 'requests');
    }
    const requests = snap.docs
      .map((d) => docToRequest(d.id, d.data() as Record<string, unknown>))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return { requests };
  },

  subscribeIncoming(
    uid: string,
    onData: (requests: BookRequest[]) => void,
    onError: (err: Error) => void,
  ): Unsubscribe {
    const qRef = query(collection(db, 'requests'), where('ownerId', '==', uid));
    return onSnapshot(
      qRef,
      (snap) => {
        const list = snap.docs
          .map((d) => docToRequest(d.id, d.data() as Record<string, unknown>))
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        onData(list);
      },
      (error) => {
        try {
          handleFirestoreError(error, OperationType.LIST, 'requests');
        } catch (wrapped) {
          onError(wrapped as Error);
        }
      },
    );
  },

  subscribeOutgoing(
    uid: string,
    onData: (requests: BookRequest[]) => void,
    onError: (err: Error) => void,
  ): Unsubscribe {
    const qRef = query(collection(db, 'requests'), where('requesterId', '==', uid));
    return onSnapshot(
      qRef,
      (snap) => {
        const list = snap.docs
          .map((d) => docToRequest(d.id, d.data() as Record<string, unknown>))
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        onData(list);
      },
      (error) => {
        try {
          handleFirestoreError(error, OperationType.LIST, 'requests');
        } catch (wrapped) {
          onError(wrapped as Error);
        }
      },
    );
  },

  async updateStatus(requestId: string, status: RequestStatus): Promise<{ request: BookRequest }> {
    requireVerifiedAuth();
    const safeId = assertValidId(requestId, 'request ID');
    if (!VALID_STATUSES.has(status) || status === 'Pending') {
      throw new Error('Status must be Accepted or Declined.');
    }
    const path = `requests/${safeId}`;
    const ref = doc(db, 'requests', safeId);

    try {
      await updateDoc(ref, {
        status,
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, path);
    }

    let snap;
    try {
      snap = await getDoc(ref);
    } catch (err) {
      handleFirestoreError(err, OperationType.GET, path);
    }

    return {
      request: docToRequest(snap.id, (snap.data() || {}) as Record<string, unknown>),
    };
  },
};

export const discussionsApi = {
  async getByBookId(bookId: string): Promise<BookDiscussionsResponse> {
    const safeBookId = assertValidId(bookId, 'book ID');
    const reviewsPath = `books/${safeBookId}/reviews`;
    const questionsPath = `books/${safeBookId}/questions`;

    let revSnap;
    let qSnap;
    try {
      [revSnap, qSnap] = await Promise.all([
        getDocs(query(collection(db, 'books', safeBookId, 'reviews'), where('bookId', '==', safeBookId))),
        getDocs(query(collection(db, 'books', safeBookId, 'questions'), where('bookId', '==', safeBookId))),
      ]);
    } catch (err) {
      handleFirestoreError(err, OperationType.LIST, `${reviewsPath} | ${questionsPath}`);
    }

    const reviews: BookReview[] = revSnap.docs
      .map((d) => {
        const data = d.data() as Record<string, unknown>;
        return {
          id: d.id,
          bookId: String(data.bookId || safeBookId),
          authorId: String(data.authorId || ''),
          authorName: String(data.authorName || ''),
          authorCity: String(data.authorCity || ''),
          rating: Number(data.rating ?? 5),
          comment: String(data.comment || ''),
          finishedReading: Boolean(data.finishedReading),
          createdAt: tsToIso(data.createdAt),
        };
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    const questions: BookQuestion[] = await Promise.all(
      qSnap.docs.map(async (qDoc) => {
        const qData = qDoc.data() as Record<string, unknown>;
        const answersPath = `books/${safeBookId}/questions/${qDoc.id}/answers`;
        let ansSnap;
        try {
          ansSnap = await getDocs(
            query(
              collection(db, 'books', safeBookId, 'questions', qDoc.id, 'answers'),
              where('questionId', '==', qDoc.id),
            ),
          );
        } catch (err) {
          handleFirestoreError(err, OperationType.LIST, answersPath);
        }

        const answers: BookAnswer[] = ansSnap.docs
          .map((aDoc) => {
            const aData = aDoc.data() as Record<string, unknown>;
            return {
              id: aDoc.id,
              authorId: String(aData.authorId || ''),
              authorName: String(aData.authorName || ''),
              hasReadBook: Boolean(aData.hasReadBook),
              body: String(aData.body || ''),
              createdAt: tsToIso(aData.createdAt),
            };
          })
          .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

        return {
          id: qDoc.id,
          bookId: String(qData.bookId || safeBookId),
          authorId: String(qData.authorId || ''),
          authorName: String(qData.authorName || ''),
          question: String(qData.question || ''),
          answers,
          createdAt: tsToIso(qData.createdAt),
        };
      }),
    );

    questions.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    const reviewCount = reviews.length;
    const averageRating =
      reviewCount > 0
        ? Number((reviews.reduce((sum, r) => sum + r.rating, 0) / reviewCount).toFixed(1))
        : 0;

    return { reviews, questions, averageRating, reviewCount };
  },

  async addReview(
    bookId: string,
    payload: { rating: number; comment: string; finishedReading: boolean },
  ): Promise<{ review: BookReview }> {
    const current = requireVerifiedAuth();
    const uid = assertValidId(current.uid, 'user ID');
    const safeBookId = assertValidId(bookId, 'book ID');
    const rating = Math.round(Number(payload.rating));
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      throw new Error('Please choose a rating between 1 and 5 stars.');
    }
    const comment = clampText(payload.comment, 1000);
    if (comment.length < 5) {
      throw new Error('Review comment must be at least 5 characters.');
    }

    const author = await authApi.syncSignedInUser(current);
    const reviewId = makeId('rev');
    const path = `books/${safeBookId}/reviews/${reviewId}`;

    try {
      await setDoc(doc(db, 'books', safeBookId, 'reviews', reviewId), {
        bookId: safeBookId,
        authorId: uid,
        authorName: clampText(author.name, 80, 'Reader'),
        authorCity: clampText(author.city, 60, ''),
        rating,
        comment,
        finishedReading: Boolean(payload.finishedReading),
        createdAt: serverTimestamp(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, path);
    }

    return {
      review: {
        id: reviewId,
        bookId: safeBookId,
        authorId: uid,
        authorName: clampText(author.name, 80, 'Reader'),
        authorCity: clampText(author.city, 60, ''),
        rating,
        comment,
        finishedReading: Boolean(payload.finishedReading),
        createdAt: new Date().toISOString(),
      },
    };
  },

  async addQuestion(bookId: string, questionText: string): Promise<{ question: BookQuestion }> {
    const current = requireVerifiedAuth();
    const uid = assertValidId(current.uid, 'user ID');
    const safeBookId = assertValidId(bookId, 'book ID');
    const question = clampText(questionText, 600);
    if (question.length < 5) {
      throw new Error('Please write a question of at least 5 characters.');
    }

    const author = await authApi.syncSignedInUser(current);
    const questionId = makeId('qst');
    const path = `books/${safeBookId}/questions/${questionId}`;

    try {
      await setDoc(doc(db, 'books', safeBookId, 'questions', questionId), {
        bookId: safeBookId,
        authorId: uid,
        authorName: clampText(author.name, 80, 'Reader'),
        question,
        createdAt: serverTimestamp(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, path);
    }

    return {
      question: {
        id: questionId,
        bookId: safeBookId,
        authorId: uid,
        authorName: clampText(author.name, 80, 'Reader'),
        question,
        answers: [],
        createdAt: new Date().toISOString(),
      },
    };
  },

  async addAnswer(
    bookId: string,
    questionId: string,
    payload: { body: string; hasReadBook: boolean },
  ): Promise<{ answer: BookAnswer }> {
    const current = requireVerifiedAuth();
    const uid = assertValidId(current.uid, 'user ID');
    const safeBookId = assertValidId(bookId, 'book ID');
    const safeQuestionId = assertValidId(questionId, 'question ID');
    const body = clampText(payload.body, 800);
    if (body.length < 3) {
      throw new Error('Please write an answer of at least 3 characters.');
    }

    const author = await authApi.syncSignedInUser(current);
    const answerId = makeId('ans');
    const path = `books/${safeBookId}/questions/${safeQuestionId}/answers/${answerId}`;

    try {
      await setDoc(doc(db, 'books', safeBookId, 'questions', safeQuestionId, 'answers', answerId), {
        bookId: safeBookId,
        questionId: safeQuestionId,
        authorId: uid,
        authorName: clampText(author.name, 80, 'Reader'),
        hasReadBook: Boolean(payload.hasReadBook),
        body,
        createdAt: serverTimestamp(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, path);
    }

    return {
      answer: {
        id: answerId,
        authorId: uid,
        authorName: clampText(author.name, 80, 'Reader'),
        hasReadBook: Boolean(payload.hasReadBook),
        body,
        createdAt: new Date().toISOString(),
      },
    };
  },

  async listSummaryForBooks(bookIds: string[]): Promise<{
    reviewsByBook: Record<string, BookReview[]>;
    questionsByBook: Record<string, BookQuestion[]>;
  }> {
    const safeIds = bookIds
      .map((id) => id.trim())
      .filter((id) => VALID_ID_RX.test(id))
      .slice(0, 12);

    const reviewsByBook: Record<string, BookReview[]> = {};
    const questionsByBook: Record<string, BookQuestion[]> = {};

    await Promise.all(
      safeIds.map(async (safeBookId) => {
        const reviewsPath = `books/${safeBookId}/reviews`;
        const questionsPath = `books/${safeBookId}/questions`;
        let revSnap;
        let qSnap;
        try {
          [revSnap, qSnap] = await Promise.all([
            getDocs(query(collection(db, 'books', safeBookId, 'reviews'), where('bookId', '==', safeBookId))),
            getDocs(query(collection(db, 'books', safeBookId, 'questions'), where('bookId', '==', safeBookId))),
          ]);
        } catch (err) {
          handleFirestoreError(err, OperationType.LIST, `${reviewsPath} | ${questionsPath}`);
        }

        reviewsByBook[safeBookId] = revSnap.docs
          .map((d) => {
            const data = d.data() as Record<string, unknown>;
            return {
              id: d.id,
              bookId: String(data.bookId || safeBookId),
              authorId: String(data.authorId || ''),
              authorName: String(data.authorName || ''),
              authorCity: String(data.authorCity || ''),
              rating: Number(data.rating ?? 5),
              comment: String(data.comment || ''),
              finishedReading: Boolean(data.finishedReading),
              createdAt: tsToIso(data.createdAt),
            };
          })
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

        questionsByBook[safeBookId] = qSnap.docs
          .map((d) => {
            const data = d.data() as Record<string, unknown>;
            return {
              id: d.id,
              bookId: String(data.bookId || safeBookId),
              authorId: String(data.authorId || ''),
              authorName: String(data.authorName || ''),
              question: String(data.question || ''),
              answers: [],
              createdAt: tsToIso(data.createdAt),
            };
          })
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      }),
    );

    return { reviewsByBook, questionsByBook };
  },
};
