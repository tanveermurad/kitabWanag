import 'dotenv/config';
import cors from 'cors';
import express from 'express';
import fs from 'fs';
import type { BookCondition, ListingType, RequestStatus } from '../src/types.ts';
import {
  addQuestionAnswer,
  createBook,
  createBookQuestion,
  createBookReview,
  createRequest,
  deleteBook,
  findNearbyBooks,
  findUserById,
  getBookById,
  getBookDiscussions,
  getRequestById,
  initDatabase,
  listBooks,
  listBooksByOwner,
  listIncomingRequests,
  listOutgoingRequests,
  updateBook,
  updateRequestStatus,
} from './db.ts';
import {
  type AuthenticatedRequest,
  authRateLimiter,
  errorHandler,
  HttpError,
  parseCoordinates,
  requireAuth,
  requireVerifiedAuth,
  sanitizeString,
} from './middleware.ts';
import { saveBookPhoto, UPLOAD_DIR, uploadImageMiddleware, validatePresetImageUrl } from './upload.ts';

const VALID_TYPES = new Set<ListingType>(['Exchange', 'Sell', 'Buy']);
const VALID_CONDITIONS = new Set<BookCondition>(['Like New', 'Good', 'Fair', 'Any']);
const VALID_STATUSES = new Set<RequestStatus>(['Pending', 'Accepted', 'Declined']);

function assertListingType(val: unknown): ListingType {
  if (typeof val !== 'string' || !VALID_TYPES.has(val as ListingType)) {
    throw new HttpError(400, 'Listing type must be Exchange, Sell, or Buy.');
  }
  return val as ListingType;
}

function assertCondition(val: unknown): BookCondition {
  if (typeof val !== 'string' || !VALID_CONDITIONS.has(val as BookCondition)) {
    throw new HttpError(400, 'Condition must be Like New, Good, Fair, or Any.');
  }
  return val as BookCondition;
}

function parsePrice(val: unknown, listingType: ListingType): number {
  if (listingType === 'Exchange') {
    return 0;
  }
  if (val === undefined || val === null || val === '') {
    if (listingType === 'Sell') {
      throw new HttpError(400, 'Please enter a price for a Sell listing.');
    }
    return 0;
  }
  const num = Number(val);
  if (!Number.isFinite(num) || num < 0 || num > 1000000) {
    throw new HttpError(400, 'Price must be a valid non-negative number.');
  }
  return Math.round(num);
}

async function resolveAuthenticatedActor(req: AuthenticatedRequest, fallbackCity = 'Quetta') {
  const authUser = req.user!;
  const stored = await findUserById(authUser.id);
  return {
    id: authUser.id,
    name: stored?.name || authUser.name || 'Reader',
    email: authUser.email,
    city: stored?.city || fallbackCity,
    emailVerified: authUser.emailVerified,
    createdAt: stored?.createdAt || new Date().toISOString(),
  };
}

export function createApiApp(): express.Express {
  const app = express();
  app.set('trust proxy', 1);

  const allowedOrigins = [
    process.env.FRONTEND_URL?.trim(),
    process.env.APP_URL?.trim(),
    'https://kitabwanag.vercel.app',
    'http://localhost:3000',
    'http://127.0.0.1:3000',
  ].filter((v): v is string => Boolean(v));

  app.use(
    cors({
      origin: (origin, cb) => {
        if (!origin) return cb(null, true);
        if (
          allowedOrigins.includes(origin) ||
          origin.endsWith('.run.app') ||
          origin.endsWith('.vercel.app')
        ) {
          return cb(null, true);
        }
        return cb(null, false);
      },
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
    }),
  );

  app.use(express.json({ limit: '1mb' }));

  try {
    if (!fs.existsSync(UPLOAD_DIR)) {
      fs.mkdirSync(UPLOAD_DIR, { recursive: true });
    }
    app.use('/uploads', express.static(UPLOAD_DIR));
  } catch {
    // Ignore static upload dir initialization errors on constrained runtimes
  }

  let dbMode: 'mongodb' | 'local' = 'local';

  // Ensure database is initialized once per process / serverless cold start
  app.use('/api', async (_req, _res, next) => {
    try {
      const result = await initDatabase();
      dbMode = result.mode;
      next();
    } catch (err) {
      next(err);
    }
  });

  // Health
  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, persistence: dbMode, authProvider: 'firebase' });
  });

  // Authenticated photo upload backed by Firebase ID token verification
  app.post(
    '/api/uploads',
    requireAuth,
    requireVerifiedAuth,
    uploadImageMiddleware.single('photo'),
    async (req, res, next) => {
      try {
        if (!req.file) {
          throw new HttpError(400, 'Please attach an image file to upload.');
        }
        const imageUrl = await saveBookPhoto(req.file);
        res.status(201).json({ imageUrl });
      } catch (err) {
        next(err);
      }
    },
  );

  // --- Firebase Auth Session Verification Route ---
  app.get('/api/auth/me', authRateLimiter, requireAuth, async (req: AuthenticatedRequest, res, next) => {
    try {
      const user = await resolveAuthenticatedActor(req);
      res.json({
        user,
        signInProvider: req.user?.signInProvider || null,
      });
    } catch (err) {
      next(err);
    }
  });

  // --- Book Routes ---
  app.get('/api/books', async (req, res, next) => {
    try {
      const type = typeof req.query.type === 'string' ? req.query.type : undefined;
      const q = typeof req.query.q === 'string' ? req.query.q : undefined;
      const city = typeof req.query.city === 'string' ? req.query.city : undefined;
      const category = typeof req.query.category === 'string' ? req.query.category : undefined;
      const language = typeof req.query.language === 'string' ? req.query.language : undefined;
      const books = await listBooks({ type, q, city, category, language });
      res.json({ books });
    } catch (err) {
      next(err);
    }
  });

  app.get('/api/books/nearby', async (req, res, next) => {
    try {
      const [lng, lat] = parseCoordinates(req.query.lng, req.query.lat);
      const rawDist = req.query.maxDistance ? Number(req.query.maxDistance) : 50;
      const maxDistanceKm = Number.isFinite(rawDist) && rawDist > 0 ? Math.min(rawDist, 2000) : 50;
      const type = typeof req.query.type === 'string' ? req.query.type : undefined;
      const books = await findNearbyBooks({ lng, lat, maxDistanceKm, type });
      res.json({ books, center: { lng, lat }, maxDistanceKm });
    } catch (err) {
      next(err);
    }
  });

  app.get('/api/books/mine', requireAuth, async (req: AuthenticatedRequest, res, next) => {
    try {
      const books = await listBooksByOwner(req.user!.id);
      res.json({ books });
    } catch (err) {
      next(err);
    }
  });

  app.get('/api/books/:id', async (req, res, next) => {
    try {
      const id = sanitizeString(req.params.id, 'Book ID', 64);
      const book = await getBookById(id);
      if (!book) {
        throw new HttpError(404, 'Book listing not found.');
      }
      res.json({ book });
    } catch (err) {
      next(err);
    }
  });

  app.post(
    '/api/books',
    requireAuth,
    requireVerifiedAuth,
    uploadImageMiddleware.single('photo'),
    async (req: AuthenticatedRequest, res, next) => {
      try {
        const title = sanitizeString(req.body?.title, 'Book title', 140);
        const author = sanitizeString(req.body?.author, 'Author', 100);
        const isbn = sanitizeString(req.body?.isbn || '', 'ISBN', 32, false);
        const category = sanitizeString(req.body?.category || 'Novels', 'Category', 60);
        const language = sanitizeString(req.body?.language || 'English', 'Language', 40);
        const listingType = assertListingType(req.body?.listingType);
        const condition = assertCondition(req.body?.condition || 'Good');
        const price = parsePrice(req.body?.price, listingType);
        const exchangeFor = sanitizeString(req.body?.exchangeFor || '', 'Exchange preference', 160, false);
        const description = sanitizeString(req.body?.description, 'Description', 1500);
        const city = sanitizeString(req.body?.city, 'City', 60);
        const neighborhood = sanitizeString(req.body?.neighborhood || '', 'Neighborhood', 80, false);
        const coordinates = parseCoordinates(req.body?.lng, req.body?.lat);

        let imageUrl: string;
        if (req.file) {
          imageUrl = await saveBookPhoto(req.file);
        } else {
          imageUrl = validatePresetImageUrl(req.body?.imageUrl);
        }

        const owner = await resolveAuthenticatedActor(req, city);

        const book = await createBook({
          title,
          author,
          isbn,
          category,
          language,
          listingType,
          condition,
          price,
          currency: 'PKR',
          exchangeFor,
          description,
          imageUrl,
          city,
          neighborhood,
          coordinates,
          ownerId: owner.id,
          ownerName: owner.name,
        });

        res.status(201).json({ book });
      } catch (err) {
        next(err);
      }
    },
  );

  app.put(
    '/api/books/:id',
    requireAuth,
    requireVerifiedAuth,
    uploadImageMiddleware.single('photo'),
    async (req: AuthenticatedRequest, res, next) => {
      try {
        const id = sanitizeString(req.params.id, 'Book ID', 64);
        const existing = await getBookById(id);
        if (!existing) {
          throw new HttpError(404, 'Book listing not found.');
        }
        if (existing.ownerId !== req.user!.id) {
          throw new HttpError(403, 'You can only edit your own book listings.');
        }

        const listingType = req.body?.listingType
          ? assertListingType(req.body.listingType)
          : existing.listingType;

        const updates: Parameters<typeof updateBook>[1] = {
          title: req.body?.title !== undefined ? sanitizeString(req.body.title, 'Book title', 140) : existing.title,
          author: req.body?.author !== undefined ? sanitizeString(req.body.author, 'Author', 100) : existing.author,
          isbn:
            req.body?.isbn !== undefined
              ? sanitizeString(req.body.isbn, 'ISBN', 32, false)
              : existing.isbn || '',
          category:
            req.body?.category !== undefined ? sanitizeString(req.body.category, 'Category', 60) : existing.category,
          language:
            req.body?.language !== undefined ? sanitizeString(req.body.language, 'Language', 40) : existing.language,
          listingType,
          condition: req.body?.condition ? assertCondition(req.body.condition) : existing.condition,
          price: req.body?.price !== undefined ? parsePrice(req.body.price, listingType) : existing.price,
          exchangeFor:
            req.body?.exchangeFor !== undefined
              ? sanitizeString(req.body.exchangeFor, 'Exchange preference', 160, false)
              : existing.exchangeFor,
          description:
            req.body?.description !== undefined
              ? sanitizeString(req.body.description, 'Description', 1500)
              : existing.description,
          city: req.body?.city !== undefined ? sanitizeString(req.body.city, 'City', 60) : existing.city,
          neighborhood:
            req.body?.neighborhood !== undefined
              ? sanitizeString(req.body.neighborhood, 'Neighborhood', 80, false)
              : existing.neighborhood,
        };

        if (req.body?.lng !== undefined && req.body?.lat !== undefined) {
          updates.coordinates = parseCoordinates(req.body.lng, req.body.lat);
        }
        if (req.file) {
          updates.imageUrl = await saveBookPhoto(req.file);
        } else if (req.body?.imageUrl) {
          updates.imageUrl = validatePresetImageUrl(req.body.imageUrl);
        }

        const book = await updateBook(id, updates);
        res.json({ book });
      } catch (err) {
        next(err);
      }
    },
  );

  app.delete(
    '/api/books/:id',
    requireAuth,
    requireVerifiedAuth,
    async (req: AuthenticatedRequest, res, next) => {
      try {
        const id = sanitizeString(req.params.id, 'Book ID', 64);
        const existing = await getBookById(id);
        if (!existing) {
          throw new HttpError(404, 'Book listing not found.');
        }
        if (existing.ownerId !== req.user!.id) {
          throw new HttpError(403, 'You can only delete your own book listings.');
        }
        await deleteBook(id);
        res.json({ deleted: true, id });
      } catch (err) {
        next(err);
      }
    },
  );

  // --- Exchange / Sell / Buy Request Routes ---
  app.post(
    '/api/requests',
    requireAuth,
    requireVerifiedAuth,
    async (req: AuthenticatedRequest, res, next) => {
      try {
        const bookId = sanitizeString(req.body?.bookId, 'Book ID', 64);
        const message = sanitizeString(req.body?.message, 'Message', 600);
        const contactNote = sanitizeString(req.body?.contactNote, 'Pickup / contact note', 180);
        const offerBookTitle = sanitizeString(req.body?.offerBookTitle || '', 'Book offered', 140, false);

        const book = await getBookById(bookId);
        if (!book) {
          throw new HttpError(404, 'Book listing not found.');
        }
        if (book.ownerId === req.user!.id) {
          throw new HttpError(400, 'You cannot send a request to your own listing.');
        }
        if (book.listingType === 'Exchange' && !offerBookTitle) {
          throw new HttpError(400, 'Please include the book title you are offering to swap.');
        }

        const requester = await resolveAuthenticatedActor(req);

        const created = await createRequest({
          bookId: book.id,
          bookTitle: book.title,
          bookType: book.listingType,
          bookImageUrl: book.imageUrl,
          ownerId: book.ownerId,
          ownerName: book.ownerName,
          requesterId: requester.id,
          requesterName: requester.name,
          requesterCity: requester.city,
          offerBookTitle,
          message,
          contactNote,
        });

        res.status(201).json({ request: created });
      } catch (err) {
        next(err);
      }
    },
  );

  app.get('/api/requests/incoming', requireAuth, async (req: AuthenticatedRequest, res, next) => {
    try {
      const requests = await listIncomingRequests(req.user!.id);
      res.json({ requests });
    } catch (err) {
      next(err);
    }
  });

  app.get('/api/requests/outgoing', requireAuth, async (req: AuthenticatedRequest, res, next) => {
    try {
      const requests = await listOutgoingRequests(req.user!.id);
      res.json({ requests });
    } catch (err) {
      next(err);
    }
  });

  app.patch(
    '/api/requests/:id',
    requireAuth,
    requireVerifiedAuth,
    async (req: AuthenticatedRequest, res, next) => {
      try {
        const id = sanitizeString(req.params.id, 'Request ID', 64);
        const statusRaw = req.body?.status;
        if (typeof statusRaw !== 'string' || !VALID_STATUSES.has(statusRaw as RequestStatus)) {
          throw new HttpError(400, 'Status must be Pending, Accepted, or Declined.');
        }
        const existing = await getRequestById(id);
        if (!existing) {
          throw new HttpError(404, 'Request not found.');
        }
        if (existing.ownerId !== req.user!.id) {
          throw new HttpError(403, 'Only the listing owner can update request status.');
        }
        const updated = await updateRequestStatus(id, statusRaw as RequestStatus);
        res.json({ request: updated });
      } catch (err) {
        next(err);
      }
    },
  );

  // --- Book Reviews & Reader Q&A Routes ---
  app.get('/api/books/:id/discussions', async (req, res, next) => {
    try {
      const id = sanitizeString(req.params.id, 'Book ID', 64);
      const book = await getBookById(id);
      if (!book) {
        throw new HttpError(404, 'Book listing not found.');
      }
      const discussions = await getBookDiscussions(id);
      res.json(discussions);
    } catch (err) {
      next(err);
    }
  });

  app.post(
    '/api/books/:id/reviews',
    requireAuth,
    requireVerifiedAuth,
    async (req: AuthenticatedRequest, res, next) => {
      try {
        const bookId = sanitizeString(req.params.id, 'Book ID', 64);
        const book = await getBookById(bookId);
        if (!book) {
          throw new HttpError(404, 'Book listing not found.');
        }

        const ratingNum = Number(req.body?.rating);
        if (!Number.isInteger(ratingNum) || ratingNum < 1 || ratingNum > 5) {
          throw new HttpError(400, 'Please select a star rating between 1 and 5.');
        }
        const comment = sanitizeString(req.body?.comment, 'Review comment', 1000);
        if (comment.length < 5) {
          throw new HttpError(400, 'Review comment must be at least 5 characters.');
        }
        const finishedReading = Boolean(req.body?.finishedReading);
        const rawCurrentPage = req.body?.currentPage;
        const rawTotalPages = req.body?.totalPages;
        const hasCurrentPage =
          rawCurrentPage !== undefined && rawCurrentPage !== null && String(rawCurrentPage).trim() !== '';
        const hasTotalPages =
          rawTotalPages !== undefined && rawTotalPages !== null && String(rawTotalPages).trim() !== '';

        const totalPages = hasTotalPages ? Math.round(Number(rawTotalPages)) : undefined;
        if (totalPages !== undefined && (!Number.isInteger(totalPages) || totalPages < 1 || totalPages > 20000)) {
          throw new HttpError(400, 'Total pages must be a whole number between 1 and 20,000.');
        }

        let currentPage: number | undefined;
        if (!finishedReading) {
          if (!hasCurrentPage) {
            throw new HttpError(400, 'Please enter your current page when currently reading.');
          }
          currentPage = Math.round(Number(rawCurrentPage));
          if (!Number.isInteger(currentPage) || currentPage < 1 || currentPage > 20000) {
            throw new HttpError(400, 'Current page must be a whole number between 1 and 20,000.');
          }
          if (totalPages !== undefined && currentPage > totalPages) {
            throw new HttpError(400, 'Current page cannot exceed total pages.');
          }
        }

        const author = await resolveAuthenticatedActor(req);

        const review = await createBookReview({
          bookId,
          authorId: author.id,
          authorName: author.name,
          authorCity: author.city,
          rating: ratingNum,
          comment,
          finishedReading,
          ...(currentPage !== undefined ? { currentPage } : {}),
          ...(totalPages !== undefined ? { totalPages } : {}),
        });

        res.status(201).json({ review });
      } catch (err) {
        next(err);
      }
    },
  );

  app.post(
    '/api/books/:id/questions',
    requireAuth,
    requireVerifiedAuth,
    async (req: AuthenticatedRequest, res, next) => {
      try {
        const bookId = sanitizeString(req.params.id, 'Book ID', 64);
        const book = await getBookById(bookId);
        if (!book) {
          throw new HttpError(404, 'Book listing not found.');
        }

        const question = sanitizeString(req.body?.question, 'Question', 600);
        if (question.length < 5) {
          throw new HttpError(400, 'Please write a question of at least 5 characters.');
        }

        const author = await resolveAuthenticatedActor(req);

        const created = await createBookQuestion({
          bookId,
          authorId: author.id,
          authorName: author.name,
          question,
        });

        res.status(201).json({ question: created });
      } catch (err) {
        next(err);
      }
    },
  );

  app.post(
    '/api/questions/:questionId/answers',
    requireAuth,
    requireVerifiedAuth,
    async (req: AuthenticatedRequest, res, next) => {
      try {
        const questionId = sanitizeString(req.params.questionId, 'Question ID', 64);
        const body = sanitizeString(req.body?.body, 'Answer', 800);
        if (body.length < 3) {
          throw new HttpError(400, 'Please write an answer of at least 3 characters.');
        }
        const hasReadBook = Boolean(req.body?.hasReadBook);

        const author = await resolveAuthenticatedActor(req);

        const updatedQuestion = await addQuestionAnswer(questionId, {
          authorId: author.id,
          authorName: author.name,
          hasReadBook,
          body,
        });

        if (!updatedQuestion) {
          throw new HttpError(404, 'Question not found.');
        }

        res.status(201).json({ question: updatedQuestion });
      } catch (err) {
        next(err);
      }
    },
  );

  // Unknown API routes return clean JSON 404
  app.use('/api', (_req, _res, next) => {
    next(new HttpError(404, 'API endpoint not found.'));
  });

  // Central API error handler
  app.use('/api', errorHandler);

  return app;
}
