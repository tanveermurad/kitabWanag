import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import fs from 'fs';
import mongoose, { Schema, type Model } from 'mongoose';
import path from 'path';
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
} from '../src/types.ts';

interface StoredUser extends UserPublic {
  passwordHash: string;
  resetTokenHash?: string | null;
  resetTokenExpiresAt?: string | null;
}

interface LocalDatabase {
  users: StoredUser[];
  books: BookListing[];
  requests: BookRequest[];
  reviews: BookReview[];
  questions: BookQuestion[];
}

const IS_SERVERLESS = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
const DATA_DIR = IS_SERVERLESS
  ? path.resolve('/tmp', 'kitabwanag-data')
  : path.resolve(process.cwd(), 'data');
const DATA_FILE = path.resolve(DATA_DIR, 'kitabwanag.json');

let usingMongo = false;
let memoryFallbackDb: LocalDatabase | null = null;
let initPromise: Promise<{ mode: 'mongodb' | 'local' }> | null = null;

// --- Mongoose Models (active when MONGO_URI is set) ---
const UserSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    city: { type: String, required: true, trim: true },
    resetTokenHash: { type: String, default: null },
    resetTokenExpiresAt: { type: Date, default: null },
  },
  { timestamps: true },
);

const BookSchema = new Schema(
  {
    title: { type: String, required: true, trim: true },
    author: { type: String, required: true, trim: true },
    isbn: { type: String, default: '', trim: true },
    category: { type: String, required: true, trim: true },
    language: { type: String, default: 'English', trim: true },
    listingType: { type: String, enum: ['Exchange', 'Sell', 'Buy'], required: true },
    condition: { type: String, enum: ['Like New', 'Good', 'Fair', 'Any'], required: true },
    price: { type: Number, default: 0 },
    currency: { type: String, default: 'PKR' },
    exchangeFor: { type: String, default: '' },
    description: { type: String, required: true },
    imageUrl: { type: String, required: true },
    city: { type: String, required: true, trim: true },
    neighborhood: { type: String, default: '' },
    location: {
      type: { type: String, enum: ['Point'], required: true, default: 'Point' },
      coordinates: { type: [Number], required: true }, // [longitude, latitude]
    },
    ownerId: { type: String, required: true, index: true },
    ownerName: { type: String, required: true },
  },
  { timestamps: true },
);
BookSchema.index({ location: '2dsphere' });

const RequestSchema = new Schema(
  {
    bookId: { type: String, required: true, index: true },
    bookTitle: { type: String, required: true },
    bookType: { type: String, enum: ['Exchange', 'Sell', 'Buy'], required: true },
    bookImageUrl: { type: String, required: true },
    ownerId: { type: String, required: true, index: true },
    ownerName: { type: String, required: true },
    requesterId: { type: String, required: true, index: true },
    requesterName: { type: String, required: true },
    requesterCity: { type: String, required: true },
    offerBookTitle: { type: String, default: '' },
    message: { type: String, required: true },
    contactNote: { type: String, required: true },
    status: { type: String, enum: ['Pending', 'Accepted', 'Declined'], default: 'Pending' },
  },
  { timestamps: true },
);

const ReviewSchema = new Schema(
  {
    bookId: { type: String, required: true, index: true },
    authorId: { type: String, required: true },
    authorName: { type: String, required: true },
    authorCity: { type: String, default: '' },
    rating: { type: Number, required: true, min: 1, max: 5 },
    comment: { type: String, required: true },
    finishedReading: { type: Boolean, default: true },
    currentPage: { type: Number, default: undefined },
    totalPages: { type: Number, default: undefined },
  },
  { timestamps: true },
);

const AnswerSubSchema = new Schema(
  {
    id: { type: String, required: true },
    authorId: { type: String, required: true },
    authorName: { type: String, required: true },
    hasReadBook: { type: Boolean, default: false },
    body: { type: String, required: true },
    createdAt: { type: String, required: true },
  },
  { _id: false },
);

const QuestionSchema = new Schema(
  {
    bookId: { type: String, required: true, index: true },
    authorId: { type: String, required: true },
    authorName: { type: String, required: true },
    question: { type: String, required: true },
    answers: { type: [AnswerSubSchema], default: [] },
  },
  { timestamps: true },
);

const UserModel: Model<any> = mongoose.models.User || mongoose.model('User', UserSchema);
const BookModel: Model<any> = mongoose.models.Book || mongoose.model('Book', BookSchema);
const RequestModel: Model<any> = mongoose.models.Request || mongoose.model('Request', RequestSchema);
const ReviewModel: Model<any> = mongoose.models.Review || mongoose.model('Review', ReviewSchema);
const QuestionModel: Model<any> = mongoose.models.Question || mongoose.model('Question', QuestionSchema);

// --- Local JSON Persistence (used seamlessly when MONGO_URI is unset) ---
function createSeedData(): LocalDatabase {
  const demoPasswordHash = bcrypt.hashSync('KitabDemo2026!', 10);
  const now = Date.now();

  const users: StoredUser[] = [
    {
      id: 'usr_zainab',
      name: 'Zainab Baloch',
      email: 'reader@kitabwanag.org',
      passwordHash: demoPasswordHash,
      city: 'Quetta',
      createdAt: new Date(now - 86400000 * 10).toISOString(),
    },
    {
      id: 'usr_hamza',
      name: 'Hamza Tariq',
      email: 'hamza@example.org',
      passwordHash: demoPasswordHash,
      city: 'Lahore',
      createdAt: new Date(now - 86400000 * 8).toISOString(),
    },
    {
      id: 'usr_mahgul',
      name: 'Mahgul Bugti',
      email: 'mahgul@example.org',
      passwordHash: demoPasswordHash,
      city: 'Quetta',
      createdAt: new Date(now - 86400000 * 6).toISOString(),
    },
    {
      id: 'usr_bilal',
      name: 'Bilal Siddiqui',
      email: 'bilal@example.org',
      passwordHash: demoPasswordHash,
      city: 'Karachi',
      createdAt: new Date(now - 86400000 * 5).toISOString(),
    },
    {
      id: 'usr_ayesha',
      name: 'Ayesha Khan',
      email: 'ayesha@example.org',
      passwordHash: demoPasswordHash,
      city: 'Islamabad',
      createdAt: new Date(now - 86400000 * 3).toISOString(),
    },
  ];

  const books: BookListing[] = [
    {
      id: 'bk_101',
      title: 'Code Craft: Principles & Patterns in Software Engineering',
      author: 'James Lyons',
      isbn: '978-0134757599',
      category: 'Computer Science',
      language: 'English',
      listingType: 'Exchange',
      condition: 'Like New',
      price: 0,
      currency: 'PKR',
      exchangeFor: 'Designing Data-Intensive Applications or Clean Architecture',
      description:
        'Clean hardcover edition used during my final-year systems course. No highlights or margin notes. Looking to swap for distributed systems or algorithms books near Sariab Road or Jinnah Road.',
      imageUrl: '/src/assets/images/book_software_craft_1795631934972.jpg',
      city: 'Quetta',
      neighborhood: 'Jinnah Town',
      location: { type: 'Point', coordinates: [66.9895, 30.1912] },
      ownerId: 'usr_zainab',
      ownerName: 'Zainab Baloch',
      createdAt: new Date(now - 86400000 * 4).toISOString(),
    },
    {
      id: 'bk_102',
      title: 'University Principles of Mathematics & Physics',
      author: 'Dr. S. H. Rizvi',
      isbn: '978-9694201023',
      category: 'Mathematics & Physics',
      language: 'English',
      listingType: 'Sell',
      condition: 'Good',
      price: 1250,
      currency: 'PKR',
      description:
        'Complete foundational textbook covering multivariable calculus, linear algebra, and classical mechanics with solved chapter exercises. Tight binding and clean pages.',
      imageUrl: '/src/assets/images/book_science_textbook_1795631935957.jpg',
      city: 'Quetta',
      neighborhood: 'Brewery Road',
      location: { type: 'Point', coordinates: [66.9682, 30.1755] },
      ownerId: 'usr_mahgul',
      ownerName: 'Mahgul Bugti',
      createdAt: new Date(now - 86400000 * 3).toISOString(),
    },
    {
      id: 'bk_103',
      title: 'The Garden of Secrets',
      author: 'Evelyn St. Clair',
      isbn: '978-0141187761',
      category: 'Novels',
      language: 'English',
      listingType: 'Exchange',
      condition: 'Good',
      price: 0,
      currency: 'PKR',
      exchangeFor: 'Any literary novel, Balochi fiction, or South Asian poetry',
      description:
        'Clothbound edition kept on a shaded bookshelf. Finished reading last month and happy to swap with fellow fiction readers in Gulberg or Model Town.',
      imageUrl: '/src/assets/images/book_literary_classic_1795631935232.jpg',
      city: 'Lahore',
      neighborhood: 'Gulberg III',
      location: { type: 'Point', coordinates: [74.3461, 31.5102] },
      ownerId: 'usr_hamza',
      ownerName: 'Hamza Tariq',
      createdAt: new Date(now - 86400000 * 2.5).toISOString(),
    },
    {
      id: 'bk_104',
      title: 'World Architecture: An Illustrated Cultural History',
      author: 'Eliza Harper & Liam Reed',
      isbn: '978-0500342930',
      category: 'History & Heritage',
      language: 'English',
      listingType: 'Sell',
      condition: 'Like New',
      price: 2400,
      currency: 'PKR',
      description:
        'Large-format illustrated volume featuring heritage masonry, timber mosques, and civic architecture across Eurasia. Ideal for architecture and history students.',
      imageUrl: '/src/assets/images/book_regional_history_1795631937282.jpg',
      city: 'Islamabad',
      neighborhood: 'Sector F-7/2',
      location: { type: 'Point', coordinates: [73.0551, 33.7215] },
      ownerId: 'usr_ayesha',
      ownerName: 'Ayesha Khan',
      createdAt: new Date(now - 86400000 * 2).toISOString(),
    },
    {
      id: 'bk_105',
      title: 'Wanted: Operating System Concepts (10th Edition)',
      author: 'Silberschatz, Galvin & Gagne',
      isbn: '978-1119800361',
      category: 'Computer Science',
      language: 'English',
      listingType: 'Buy',
      condition: 'Any',
      price: 1800,
      currency: 'PKR',
      description:
        'Looking to buy a clean second-hand copy before semester midterms. Can pick up near Clifton, Saddar, or University Road.',
      imageUrl: '/src/assets/images/book_software_craft_1795631934972.jpg',
      city: 'Karachi',
      neighborhood: 'Clifton Block 5',
      location: { type: 'Point', coordinates: [67.0285, 24.8138] },
      ownerId: 'usr_bilal',
      ownerName: 'Bilal Siddiqui',
      createdAt: new Date(now - 86400000 * 1.5).toISOString(),
    },
    {
      id: 'bk_106',
      title: 'Wanted: Classical Balochi & Persian Literary Anthologies',
      author: 'Balochi Academy Editors',
      isbn: '978-9698501068',
      category: 'Poetry & Folklore',
      language: 'Balochi',
      listingType: 'Buy',
      condition: 'Fair',
      price: 1000,
      currency: 'PKR',
      description:
        'Seeking out-of-print or used Balochi poetry collections and literary histories of Balochistan. Happy to buy or trade modern novels in return.',
      imageUrl: '/src/assets/images/book_regional_history_1795631937282.jpg',
      city: 'Quetta',
      neighborhood: 'Model Town',
      location: { type: 'Point', coordinates: [67.0155, 30.1846] },
      ownerId: 'usr_mahgul',
      ownerName: 'Mahgul Bugti',
      createdAt: new Date(now - 86400000 * 1).toISOString(),
    },
    {
      id: 'bk_107',
      title: 'Nazuk: Modern Balochi Short Novel',
      author: 'Syed Zahoor Shah Hashmi',
      isbn: '978-9698501075',
      category: 'Novels',
      language: 'Balochi',
      listingType: 'Exchange',
      condition: 'Good',
      price: 0,
      currency: 'PKR',
      exchangeFor: 'Balochi or Brahui novels, or Balochistan history volumes',
      description:
        'Well-kept edition of Nazuk in Balochi. Looking to swap with another regional novel or historical work in Quetta or Turbat.',
      imageUrl: '/src/assets/images/book_literary_classic_1795631935232.jpg',
      city: 'Turbat',
      neighborhood: 'Main Bazaar',
      location: { type: 'Point', coordinates: [63.0439, 26.0028] },
      ownerId: 'usr_zainab',
      ownerName: 'Zainab Baloch',
      createdAt: new Date(now - 86400000 * 0.8).toISOString(),
    },
    {
      id: 'bk_108',
      title: 'History & Grammar of the Brahui Language',
      author: 'Denys de S. Bray / Brahui Academy',
      isbn: '978-9698501082',
      category: 'History & Heritage',
      language: 'Brahui',
      listingType: 'Sell',
      condition: 'Like New',
      price: 1400,
      currency: 'PKR',
      description:
        'Clean reference volume covering Brahui linguistics, oral heritage, and regional history around Kalat and Quetta.',
      imageUrl: '/src/assets/images/book_regional_history_1795631937282.jpg',
      city: 'Quetta',
      neighborhood: 'Sariab Road',
      location: { type: 'Point', coordinates: [66.9922, 30.1615] },
      ownerId: 'usr_mahgul',
      ownerName: 'Mahgul Bugti',
      createdAt: new Date(now - 86400000 * 0.4).toISOString(),
    },
  ];

  const requests: BookRequest[] = [
    {
      id: 'req_201',
      bookId: 'bk_101',
      bookTitle: 'Code Craft: Principles & Patterns in Software Engineering',
      bookType: 'Exchange',
      bookImageUrl: '/src/assets/images/book_software_craft_1795631934972.jpg',
      ownerId: 'usr_zainab',
      ownerName: 'Zainab Baloch',
      requesterId: 'usr_mahgul',
      requesterName: 'Mahgul Bugti',
      requesterCity: 'Quetta',
      offerBookTitle: 'Clean Architecture by Robert C. Martin',
      message: 'Hi Zainab, I have a crisp copy of Clean Architecture if you would like to swap this weekend near University Chowk.',
      contactNote: 'Available after 4 PM near Jinnah Road',
      status: 'Pending',
      createdAt: new Date(now - 3600000 * 18).toISOString(),
    },
  ];

  const reviews: BookReview[] = [
    {
      id: 'rev_301',
      bookId: 'bk_101',
      authorId: 'usr_hamza',
      authorName: 'Hamza Tariq',
      authorCity: 'Lahore',
      rating: 5,
      comment:
        'Very practical chapters on clean interfaces and modular architecture. Helped me refactor my entire semester capstone project.',
      finishedReading: true,
      createdAt: new Date(now - 86400000 * 2).toISOString(),
    },
    {
      id: 'rev_302',
      bookId: 'bk_107',
      authorId: 'usr_mahgul',
      authorName: 'Mahgul Bugti',
      authorCity: 'Quetta',
      rating: 5,
      comment:
        'A landmark short novel in modern Balochi prose. Clear storytelling and vivid coastal atmosphere.',
      finishedReading: true,
      createdAt: new Date(now - 86400000 * 1).toISOString(),
    },
  ];

  const questions: BookQuestion[] = [
    {
      id: 'qst_401',
      bookId: 'bk_101',
      authorId: 'usr_bilal',
      authorName: 'Bilal Siddiqui',
      question: 'Is this book approachable for second-year computer science students, or is it better after an internship?',
      answers: [
        {
          id: 'ans_501',
          authorId: 'usr_zainab',
          authorName: 'Zainab Baloch',
          hasReadBook: true,
          body: 'I read it right after data structures and found the first six chapters very approachable. The refactoring examples make sense as soon as you have written one multi-file project.',
          createdAt: new Date(now - 3600000 * 10).toISOString(),
        },
      ],
      createdAt: new Date(now - 3600000 * 14).toISOString(),
    },
    {
      id: 'qst_402',
      bookId: 'bk_107',
      authorId: 'usr_ayesha',
      authorName: 'Ayesha Khan',
      question: 'Is the Balochi vocabulary accessible for intermediate readers learning literary Balochi?',
      answers: [
        {
          id: 'ans_502',
          authorId: 'usr_zainab',
          authorName: 'Zainab Baloch',
          hasReadBook: true,
          body: 'Yes! Compared to classical poetry, Hashmi writes in direct everyday sentences, so it is one of the best starting novels for intermediate readers.',
          createdAt: new Date(now - 3600000 * 6).toISOString(),
        },
      ],
      createdAt: new Date(now - 3600000 * 9).toISOString(),
    },
  ];

  return { users, books, requests, reviews, questions };
}

function loadLocalDb(): LocalDatabase {
  if (memoryFallbackDb) {
    return memoryFallbackDb;
  }
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (!fs.existsSync(DATA_FILE)) {
      const seed = createSeedData();
      fs.writeFileSync(DATA_FILE, JSON.stringify(seed, null, 2), 'utf8');
      return seed;
    }
    const raw = fs.readFileSync(DATA_FILE, 'utf8');
    const parsed = JSON.parse(raw) as LocalDatabase;
    const seedIsbns: Record<string, string> = {
      bk_101: '978-0134757599',
      bk_102: '978-9694201023',
      bk_103: '978-0141187761',
      bk_104: '978-0500342930',
      bk_105: '978-1119800361',
      bk_106: '978-9698501068',
      bk_107: '978-9698501075',
      bk_108: '978-9698501082',
    };
    const books = Array.isArray(parsed.books)
      ? parsed.books.map((b) => ({
          ...b,
          isbn: b.isbn ?? seedIsbns[b.id] ?? '',
          language: b.language || (b.id === 'bk_106' ? 'Balochi' : 'English'),
        }))
      : [];
    const fallbackSeed =
      !Array.isArray(parsed.reviews) || !Array.isArray(parsed.questions) ? createSeedData() : null;
    return {
      users: Array.isArray(parsed.users) ? parsed.users : [],
      books,
      requests: Array.isArray(parsed.requests) ? parsed.requests : [],
      reviews: Array.isArray(parsed.reviews) ? parsed.reviews : fallbackSeed!.reviews,
      questions: Array.isArray(parsed.questions) ? parsed.questions : fallbackSeed!.questions,
    };
  } catch {
    const seed = createSeedData();
    memoryFallbackDb = seed;
    try {
      fs.writeFileSync(DATA_FILE, JSON.stringify(seed, null, 2), 'utf8');
    } catch {
      // Keep in-memory fallback if filesystem is read-only
    }
    return seed;
  }
}

function saveLocalDb(db: LocalDatabase): void {
  memoryFallbackDb = db;
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    const tmpFile = `${DATA_FILE}.tmp`;
    fs.writeFileSync(tmpFile, JSON.stringify(db, null, 2), 'utf8');
    fs.renameSync(tmpFile, DATA_FILE);
  } catch {
    // Preserve in-memory state if filesystem write fails
  }
}

/** Haversine distance in kilometers between two [lng, lat] points */
export function haversineKm(a: [number, number], b: [number, number]): number {
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

function toPublicUser(u: any): UserPublic {
  return {
    id: String(u._id ?? u.id),
    name: u.name,
    email: u.email,
    city: u.city,
    createdAt: u.createdAt instanceof Date ? u.createdAt.toISOString() : String(u.createdAt),
  };
}

function toBookListing(b: any, distanceKm?: number): BookListing {
  const coords = b.location?.coordinates ?? [66.9964, 30.1798];
  return {
    id: String(b._id ?? b.id),
    title: b.title,
    author: b.author,
    isbn: b.isbn || '',
    category: b.category,
    language: b.language || 'English',
    listingType: b.listingType,
    condition: b.condition,
    price: Number(b.price ?? 0),
    currency: b.currency || 'PKR',
    exchangeFor: b.exchangeFor || '',
    description: b.description,
    imageUrl: b.imageUrl,
    city: b.city,
    neighborhood: b.neighborhood || '',
    location: {
      type: 'Point',
      coordinates: [Number(coords[0]), Number(coords[1])],
    },
    ownerId: String(b.ownerId),
    ownerName: b.ownerName,
    createdAt: b.createdAt instanceof Date ? b.createdAt.toISOString() : String(b.createdAt),
    ...(distanceKm !== undefined ? { distanceKm: Number(distanceKm.toFixed(1)) } : {}),
  };
}

function toBookRequest(r: any): BookRequest {
  return {
    id: String(r._id ?? r.id),
    bookId: String(r.bookId),
    bookTitle: r.bookTitle,
    bookType: r.bookType,
    bookImageUrl: r.bookImageUrl,
    ownerId: String(r.ownerId),
    ownerName: r.ownerName,
    requesterId: String(r.requesterId),
    requesterName: r.requesterName,
    requesterCity: r.requesterCity,
    offerBookTitle: r.offerBookTitle || '',
    message: r.message,
    contactNote: r.contactNote,
    status: r.status,
    createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : String(r.createdAt),
  };
}

function toBookReview(r: any): BookReview {
  const currentPage = Number.isInteger(Number(r.currentPage)) && Number(r.currentPage) >= 1
    ? Number(r.currentPage)
    : undefined;
  const totalPages = Number.isInteger(Number(r.totalPages)) && Number(r.totalPages) >= 1
    ? Number(r.totalPages)
    : undefined;
  return {
    id: String(r._id ?? r.id),
    bookId: String(r.bookId),
    authorId: String(r.authorId),
    authorName: r.authorName,
    authorCity: r.authorCity || '',
    rating: Number(r.rating),
    comment: r.comment,
    finishedReading: Boolean(r.finishedReading),
    ...(currentPage !== undefined ? { currentPage } : {}),
    ...(totalPages !== undefined ? { totalPages } : {}),
    createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : String(r.createdAt),
    ...(r.updatedAt ? { updatedAt: r.updatedAt instanceof Date ? r.updatedAt.toISOString() : String(r.updatedAt) } : {}),
  };
}

function toBookQuestion(q: any): BookQuestion {
  return {
    id: String(q._id ?? q.id),
    bookId: String(q.bookId),
    authorId: String(q.authorId),
    authorName: q.authorName,
    question: q.question,
    answers: Array.isArray(q.answers)
      ? q.answers.map((a: any) => ({
          id: String(a.id),
          authorId: String(a.authorId),
          authorName: a.authorName,
          hasReadBook: Boolean(a.hasReadBook),
          body: a.body,
          createdAt: String(a.createdAt),
        }))
      : [],
    createdAt: q.createdAt instanceof Date ? q.createdAt.toISOString() : String(q.createdAt),
  };
}

export async function initDatabase(): Promise<{ mode: 'mongodb' | 'local' }> {
  if (initPromise) {
    return initPromise;
  }

  initPromise = (async () => {
    const mongoUri = (process.env.MONGODB_URI || process.env.MONGO_URI)?.trim();
    const dbName = process.env.MONGODB_DB?.trim() || 'kitabwanag';
    if (mongoUri) {
      try {
        await mongoose.connect(mongoUri, {
          dbName,
          serverSelectionTimeoutMS: 5000,
          connectTimeoutMS: 5000,
        });
        await BookModel.syncIndexes();

        const [userCount, bookCount] = await Promise.all([
          UserModel.countDocuments(),
          BookModel.countDocuments(),
        ]);
        if (userCount === 0 && bookCount === 0) {
          const seed = createSeedData();
          const userIdMap = new Map<string, string>();
          const bookIdMap = new Map<string, string>();

          for (const u of seed.users) {
            const created = await UserModel.create({
              name: u.name,
              email: u.email,
              passwordHash: u.passwordHash,
              city: u.city,
            });
            userIdMap.set(u.id, String(created._id));
          }
          for (const b of seed.books) {
            const created = await BookModel.create({
              title: b.title,
              author: b.author,
              isbn: b.isbn || '',
              category: b.category,
              language: b.language,
              listingType: b.listingType,
              condition: b.condition,
              price: b.price,
              currency: b.currency,
              exchangeFor: b.exchangeFor,
              description: b.description,
              imageUrl: b.imageUrl,
              city: b.city,
              neighborhood: b.neighborhood,
              location: b.location,
              ownerId: userIdMap.get(b.ownerId) || b.ownerId,
              ownerName: b.ownerName,
            });
            bookIdMap.set(b.id, String(created._id));
          }
          for (const r of seed.reviews) {
            await ReviewModel.create({
              bookId: bookIdMap.get(r.bookId) || r.bookId,
              authorId: userIdMap.get(r.authorId) || r.authorId,
              authorName: r.authorName,
              authorCity: r.authorCity,
              rating: r.rating,
              comment: r.comment,
              finishedReading: r.finishedReading,
            });
          }
          for (const q of seed.questions) {
            await QuestionModel.create({
              bookId: bookIdMap.get(q.bookId) || q.bookId,
              authorId: userIdMap.get(q.authorId) || q.authorId,
              authorName: q.authorName,
              question: q.question,
              answers: q.answers.map((a) => ({
                ...a,
                authorId: userIdMap.get(a.authorId) || a.authorId,
              })),
            });
          }
        }

        usingMongo = true;
        console.log(`Connected to MongoDB Atlas database "${dbName}" (2dsphere index active).`);
        return { mode: 'mongodb' as const };
      } catch {
        await mongoose.disconnect().catch(() => {});
        console.log('MongoDB Atlas unreachable (check Atlas Network Access IP whitelist). Using local GeoJSON persistence.');
      }
    }
    loadLocalDb();
    usingMongo = false;
    console.log('KitabWanag local GeoJSON persistence ready.');
    return { mode: 'local' as const };
  })();

  return initPromise;
}

// --- Repository API ---
export async function findUserByEmail(email: string): Promise<(UserPublic & { passwordHash: string }) | null> {
  const normalized = email.trim().toLowerCase();
  if (usingMongo) {
    const doc = await UserModel.findOne({ email: normalized }).lean();
    if (!doc) return null;
    return { ...toPublicUser(doc), passwordHash: doc.passwordHash };
  }
  const db = loadLocalDb();
  const user = db.users.find((u) => u.email.toLowerCase() === normalized);
  return user ? { ...user } : null;
}

export async function findUserById(id: string): Promise<UserPublic | null> {
  if (usingMongo) {
    if (!mongoose.Types.ObjectId.isValid(id)) return null;
    const doc = await UserModel.findById(id).lean();
    return doc ? toPublicUser(doc) : null;
  }
  const db = loadLocalDb();
  const user = db.users.find((u) => u.id === id);
  return user ? toPublicUser(user) : null;
}

export async function createUser(input: {
  name: string;
  email: string;
  passwordHash: string;
  city: string;
}): Promise<UserPublic> {
  const normalized = input.email.trim().toLowerCase();
  if (usingMongo) {
    const doc = await UserModel.create({
      name: input.name,
      email: normalized,
      passwordHash: input.passwordHash,
      city: input.city,
    });
    return toPublicUser(doc);
  }
  const db = loadLocalDb();
  const newUser: StoredUser = {
    id: `usr_${crypto.randomUUID().slice(0, 8)}`,
    name: input.name,
    email: normalized,
    passwordHash: input.passwordHash,
    city: input.city,
    createdAt: new Date().toISOString(),
  };
  db.users.push(newUser);
  saveLocalDb(db);
  return toPublicUser(newUser);
}

export async function setPasswordResetToken(
  email: string,
  tokenHash: string,
  expiresAt: Date,
): Promise<boolean> {
  const normalized = email.trim().toLowerCase();
  if (usingMongo) {
    const res = await UserModel.updateOne(
      { email: normalized },
      {
        $set: {
          resetTokenHash: tokenHash,
          resetTokenExpiresAt: expiresAt,
        },
      },
    );
    return res.matchedCount > 0;
  }

  const db = loadLocalDb();
  const idx = db.users.findIndex((u) => u.email.toLowerCase() === normalized);
  if (idx === -1) return false;
  db.users[idx] = {
    ...db.users[idx],
    resetTokenHash: tokenHash,
    resetTokenExpiresAt: expiresAt.toISOString(),
  };
  saveLocalDb(db);
  return true;
}

export async function resetPasswordWithToken(
  tokenHash: string,
  newPasswordHash: string,
): Promise<boolean> {
  const now = new Date();
  if (usingMongo) {
    const updated = await UserModel.findOneAndUpdate(
      {
        resetTokenHash: tokenHash,
        resetTokenExpiresAt: { $gt: now },
      },
      {
        $set: {
          passwordHash: newPasswordHash,
          resetTokenHash: null,
          resetTokenExpiresAt: null,
        },
      },
      { new: true },
    ).lean();
    return Boolean(updated);
  }

  const db = loadLocalDb();
  const idx = db.users.findIndex((u) => {
    if (!u.resetTokenHash || !u.resetTokenExpiresAt) return false;
    const expiresMs = new Date(u.resetTokenExpiresAt).getTime();
    return u.resetTokenHash === tokenHash && Number.isFinite(expiresMs) && expiresMs > now.getTime();
  });
  if (idx === -1) return false;

  db.users[idx] = {
    ...db.users[idx],
    passwordHash: newPasswordHash,
    resetTokenHash: null,
    resetTokenExpiresAt: null,
  };
  saveLocalDb(db);
  return true;
}

export async function listBooks(filters: {
  type?: string;
  q?: string;
  city?: string;
  category?: string;
  language?: string;
}): Promise<BookListing[]> {
  const typeFilter = filters.type && filters.type !== 'All' ? filters.type : undefined;
  const q = filters.q?.trim().toLowerCase() || '';
  const city = filters.city?.trim().toLowerCase() || '';
  const category = filters.category && filters.category !== 'All' ? filters.category.trim().toLowerCase() : '';
  const language = filters.language && filters.language !== 'All' ? filters.language.trim().toLowerCase() : '';

  if (usingMongo) {
    const query: Record<string, any> = {};
    if (typeFilter) query.listingType = typeFilter;
    if (city) query.city = new RegExp(`^${escapeRegex(city)}$`, 'i');
    if (category) query.category = new RegExp(`^${escapeRegex(category)}$`, 'i');
    if (language) query.language = new RegExp(`^${escapeRegex(language)}$`, 'i');
    if (q) {
      const rx = new RegExp(escapeRegex(q), 'i');
      const compactIsbn = q.replace(/[-\s]/g, '');
      const isbnRx = compactIsbn ? new RegExp(escapeRegex(compactIsbn), 'i') : rx;
      query.$or = [
        { title: rx },
        { author: rx },
        { isbn: rx },
        { isbn: isbnRx },
        { city: rx },
        { category: rx },
        { language: rx },
        { description: rx },
      ];
    }
    const docs = await BookModel.find(query).sort({ createdAt: -1 }).lean();
    return docs.map((d) => toBookListing(d));
  }

  const db = loadLocalDb();
  const qCompact = q.replace(/[-\s]/g, '');
  return db.books
    .filter((b) => {
      const bookLang = (b.language || 'English').toLowerCase();
      if (typeFilter && b.listingType !== typeFilter) return false;
      if (city && b.city.toLowerCase() !== city) return false;
      if (category && b.category.toLowerCase() !== category) return false;
      if (language && bookLang !== language) return false;
      if (q) {
        const bookIsbn = (b.isbn || '').toLowerCase();
        const compactBookIsbn = bookIsbn.replace(/[-\s]/g, '');
        const hay = `${b.title} ${b.author} ${bookIsbn} ${b.city} ${b.category} ${bookLang} ${b.description}`.toLowerCase();
        const matchesIsbn = qCompact.length > 0 && compactBookIsbn.includes(qCompact);
        if (!hay.includes(q) && !matchesIsbn) return false;
      }
      return true;
    })
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export async function findNearbyBooks(params: {
  lng: number;
  lat: number;
  maxDistanceKm: number;
  type?: string;
}): Promise<BookListing[]> {
  const typeFilter = params.type && params.type !== 'All' ? params.type : undefined;

  if (usingMongo) {
    const query: Record<string, any> = {
      location: {
        $near: {
          $geometry: { type: 'Point', coordinates: [params.lng, params.lat] },
          $maxDistance: params.maxDistanceKm * 1000,
        },
      },
    };
    if (typeFilter) query.listingType = typeFilter;
    const docs = await BookModel.find(query).lean();
    return docs.map((d) => {
      const dist = haversineKm([params.lng, params.lat], d.location.coordinates);
      return toBookListing(d, dist);
    });
  }

  const db = loadLocalDb();
  return db.books
    .filter((b) => !typeFilter || b.listingType === typeFilter)
    .map((b) => ({
      book: b,
      dist: haversineKm([params.lng, params.lat], b.location.coordinates),
    }))
    .filter((entry) => entry.dist <= params.maxDistanceKm)
    .sort((a, b) => a.dist - b.dist)
    .map((entry) => toBookListing(entry.book, entry.dist));
}

export async function listBooksByOwner(ownerId: string): Promise<BookListing[]> {
  if (usingMongo) {
    const docs = await BookModel.find({ ownerId }).sort({ createdAt: -1 }).lean();
    return docs.map((d) => toBookListing(d));
  }
  const db = loadLocalDb();
  return db.books
    .filter((b) => b.ownerId === ownerId)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export async function getBookById(id: string): Promise<BookListing | null> {
  if (usingMongo) {
    if (!mongoose.Types.ObjectId.isValid(id)) return null;
    const doc = await BookModel.findById(id).lean();
    return doc ? toBookListing(doc) : null;
  }
  const db = loadLocalDb();
  const book = db.books.find((b) => b.id === id);
  return book ? { ...book } : null;
}

export async function createBook(input: {
  title: string;
  author: string;
  isbn: string;
  category: string;
  language: string;
  listingType: ListingType;
  condition: BookCondition;
  price: number;
  currency: string;
  exchangeFor: string;
  description: string;
  imageUrl: string;
  city: string;
  neighborhood: string;
  coordinates: [number, number];
  ownerId: string;
  ownerName: string;
}): Promise<BookListing> {
  if (usingMongo) {
    const doc = await BookModel.create({
      ...input,
      location: { type: 'Point', coordinates: input.coordinates },
    });
    return toBookListing(doc);
  }
  const db = loadLocalDb();
  const book: BookListing = {
    id: `bk_${crypto.randomUUID().slice(0, 8)}`,
    title: input.title,
    author: input.author,
    isbn: input.isbn,
    category: input.category,
    language: input.language,
    listingType: input.listingType,
    condition: input.condition,
    price: input.price,
    currency: input.currency,
    exchangeFor: input.exchangeFor,
    description: input.description,
    imageUrl: input.imageUrl,
    city: input.city,
    neighborhood: input.neighborhood,
    location: { type: 'Point', coordinates: input.coordinates },
    ownerId: input.ownerId,
    ownerName: input.ownerName,
    createdAt: new Date().toISOString(),
  };
  db.books.unshift(book);
  saveLocalDb(db);
  return book;
}

export async function updateBook(
  id: string,
  updates: Partial<{
    title: string;
    author: string;
    isbn: string;
    category: string;
    language: string;
    listingType: ListingType;
    condition: BookCondition;
    price: number;
    exchangeFor: string;
    description: string;
    imageUrl: string;
    city: string;
    neighborhood: string;
    coordinates: [number, number];
  }>,
): Promise<BookListing | null> {
  if (usingMongo) {
    if (!mongoose.Types.ObjectId.isValid(id)) return null;
    const mongoUpdates: Record<string, any> = { ...updates };
    if (updates.coordinates) {
      mongoUpdates.location = { type: 'Point', coordinates: updates.coordinates };
      delete mongoUpdates.coordinates;
    }
    const doc = await BookModel.findByIdAndUpdate(id, mongoUpdates, { new: true }).lean();
    return doc ? toBookListing(doc) : null;
  }

  const db = loadLocalDb();
  const idx = db.books.findIndex((b) => b.id === id);
  if (idx === -1) return null;
  const current = db.books[idx];
  const updated: BookListing = {
    ...current,
    ...(updates.title !== undefined ? { title: updates.title } : {}),
    ...(updates.author !== undefined ? { author: updates.author } : {}),
    ...(updates.isbn !== undefined ? { isbn: updates.isbn } : {}),
    ...(updates.category !== undefined ? { category: updates.category } : {}),
    ...(updates.language !== undefined ? { language: updates.language } : {}),
    ...(updates.listingType !== undefined ? { listingType: updates.listingType } : {}),
    ...(updates.condition !== undefined ? { condition: updates.condition } : {}),
    ...(updates.price !== undefined ? { price: updates.price } : {}),
    ...(updates.exchangeFor !== undefined ? { exchangeFor: updates.exchangeFor } : {}),
    ...(updates.description !== undefined ? { description: updates.description } : {}),
    ...(updates.imageUrl !== undefined ? { imageUrl: updates.imageUrl } : {}),
    ...(updates.city !== undefined ? { city: updates.city } : {}),
    ...(updates.neighborhood !== undefined ? { neighborhood: updates.neighborhood } : {}),
    ...(updates.coordinates !== undefined
      ? { location: { type: 'Point', coordinates: updates.coordinates } }
      : {}),
  };
  db.books[idx] = updated;
  saveLocalDb(db);
  return updated;
}

export async function deleteBook(id: string): Promise<boolean> {
  if (usingMongo) {
    if (!mongoose.Types.ObjectId.isValid(id)) return false;
    const res = await BookModel.findByIdAndDelete(id);
    if (!res) return false;
    await Promise.all([
      RequestModel.deleteMany({ bookId: id }),
      ReviewModel.deleteMany({ bookId: id }),
      QuestionModel.deleteMany({ bookId: id }),
    ]);
    return true;
  }
  const db = loadLocalDb();
  const initialLen = db.books.length;
  db.books = db.books.filter((b) => b.id !== id);
  if (db.books.length === initialLen) return false;
  db.requests = db.requests.filter((r) => r.bookId !== id);
  db.reviews = db.reviews.filter((r) => r.bookId !== id);
  db.questions = db.questions.filter((q) => q.bookId !== id);
  saveLocalDb(db);
  return true;
}

export async function createRequest(input: {
  bookId: string;
  bookTitle: string;
  bookType: ListingType;
  bookImageUrl: string;
  ownerId: string;
  ownerName: string;
  requesterId: string;
  requesterName: string;
  requesterCity: string;
  offerBookTitle: string;
  message: string;
  contactNote: string;
}): Promise<BookRequest> {
  if (usingMongo) {
    const doc = await RequestModel.create({ ...input, status: 'Pending' });
    return toBookRequest(doc);
  }
  const db = loadLocalDb();
  const created: BookRequest = {
    id: `req_${crypto.randomUUID().slice(0, 8)}`,
    ...input,
    status: 'Pending',
    createdAt: new Date().toISOString(),
  };
  db.requests.unshift(created);
  saveLocalDb(db);
  return created;
}

export async function listIncomingRequests(ownerId: string): Promise<BookRequest[]> {
  if (usingMongo) {
    const docs = await RequestModel.find({ ownerId }).sort({ createdAt: -1 }).lean();
    return docs.map((d) => toBookRequest(d));
  }
  const db = loadLocalDb();
  return db.requests
    .filter((r) => r.ownerId === ownerId)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export async function listOutgoingRequests(requesterId: string): Promise<BookRequest[]> {
  if (usingMongo) {
    const docs = await RequestModel.find({ requesterId }).sort({ createdAt: -1 }).lean();
    return docs.map((d) => toBookRequest(d));
  }
  const db = loadLocalDb();
  return db.requests
    .filter((r) => r.requesterId === requesterId)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export async function getRequestById(id: string): Promise<BookRequest | null> {
  if (usingMongo) {
    if (!mongoose.Types.ObjectId.isValid(id)) return null;
    const doc = await RequestModel.findById(id).lean();
    return doc ? toBookRequest(doc) : null;
  }
  const db = loadLocalDb();
  const reqItem = db.requests.find((r) => r.id === id);
  return reqItem ? { ...reqItem } : null;
}

export async function updateRequestStatus(id: string, status: RequestStatus): Promise<BookRequest | null> {
  if (usingMongo) {
    if (!mongoose.Types.ObjectId.isValid(id)) return null;
    const doc = await RequestModel.findByIdAndUpdate(id, { status }, { new: true }).lean();
    return doc ? toBookRequest(doc) : null;
  }
  const db = loadLocalDb();
  const idx = db.requests.findIndex((r) => r.id === id);
  if (idx === -1) return null;
  db.requests[idx] = { ...db.requests[idx], status };
  saveLocalDb(db);
  return db.requests[idx];
}

// --- Book Reviews & Reader Q&A ---
export async function getBookDiscussions(bookId: string): Promise<{
  reviews: BookReview[];
  questions: BookQuestion[];
  averageRating: number;
  reviewCount: number;
}> {
  let reviews: BookReview[];
  let questions: BookQuestion[];

  if (usingMongo) {
    const [revDocs, qDocs] = await Promise.all([
      ReviewModel.find({ bookId }).sort({ createdAt: -1 }).lean(),
      QuestionModel.find({ bookId }).sort({ createdAt: -1 }).lean(),
    ]);
    reviews = revDocs.map(toBookReview);
    questions = qDocs.map(toBookQuestion);
  } else {
    const db = loadLocalDb();
    reviews = db.reviews
      .filter((r) => r.bookId === bookId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    questions = db.questions
      .filter((q) => q.bookId === bookId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  const reviewCount = reviews.length;
  const averageRating =
    reviewCount > 0
      ? Number((reviews.reduce((sum, r) => sum + r.rating, 0) / reviewCount).toFixed(1))
      : 0;

  return { reviews, questions, averageRating, reviewCount };
}

export async function createBookReview(input: {
  bookId: string;
  authorId: string;
  authorName: string;
  authorCity: string;
  rating: number;
  comment: string;
  finishedReading: boolean;
  currentPage?: number;
  totalPages?: number;
}): Promise<BookReview> {
  if (usingMongo) {
    const doc = await ReviewModel.create(input);
    return toBookReview(doc);
  }
  const db = loadLocalDb();
  const created: BookReview = {
    id: `rev_${crypto.randomUUID().slice(0, 8)}`,
    ...input,
    createdAt: new Date().toISOString(),
  };
  db.reviews.unshift(created);
  saveLocalDb(db);
  return created;
}

export async function createBookQuestion(input: {
  bookId: string;
  authorId: string;
  authorName: string;
  question: string;
}): Promise<BookQuestion> {
  if (usingMongo) {
    const doc = await QuestionModel.create({ ...input, answers: [] });
    return toBookQuestion(doc);
  }
  const db = loadLocalDb();
  const created: BookQuestion = {
    id: `qst_${crypto.randomUUID().slice(0, 8)}`,
    ...input,
    answers: [],
    createdAt: new Date().toISOString(),
  };
  db.questions.unshift(created);
  saveLocalDb(db);
  return created;
}

export async function addQuestionAnswer(
  questionId: string,
  input: {
    authorId: string;
    authorName: string;
    hasReadBook: boolean;
    body: string;
  },
): Promise<BookQuestion | null> {
  const answer: BookAnswer = {
    id: `ans_${crypto.randomUUID().slice(0, 8)}`,
    authorId: input.authorId,
    authorName: input.authorName,
    hasReadBook: input.hasReadBook,
    body: input.body,
    createdAt: new Date().toISOString(),
  };

  if (usingMongo) {
    if (!mongoose.Types.ObjectId.isValid(questionId)) return null;
    const doc = await QuestionModel.findByIdAndUpdate(
      questionId,
      { $push: { answers: answer } },
      { new: true },
    ).lean();
    return doc ? toBookQuestion(doc) : null;
  }

  const db = loadLocalDb();
  const idx = db.questions.findIndex((q) => q.id === questionId);
  if (idx === -1) return null;
  db.questions[idx] = {
    ...db.questions[idx],
    answers: [...db.questions[idx].answers, answer],
  };
  saveLocalDb(db);
  return db.questions[idx];
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
