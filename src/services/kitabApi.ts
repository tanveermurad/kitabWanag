import type {
  BookListing,
  BookQuestion,
  BookRequest,
  BookReview,
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

export const authApi = {
  login(email: string, password: string) {
    return apiRequest<{ token: string; user: UserPublic }>('/api/auth/login', {
      method: 'POST',
      body: { email, password },
      fallbackMessage: 'Could not sign in.',
    });
  },

  signup(payload: { name: string; email: string; password: string; city: string }) {
    return apiRequest<{ token: string; user: UserPublic }>('/api/auth/signup', {
      method: 'POST',
      body: payload,
      fallbackMessage: 'Could not create account.',
    });
  },

  me() {
    return apiRequest<{ user: UserPublic }>('/api/auth/me', {
      auth: true,
      fallbackMessage: 'Could not load your profile.',
    });
  },
};

export const booksApi = {
  list(filters: BookListFilters = {}, signal?: AbortSignal) {
    const params = new URLSearchParams();
    if (filters.type && filters.type !== 'All') params.set('type', filters.type);
    if (filters.q?.trim()) params.set('q', filters.q.trim());
    if (filters.city) params.set('city', filters.city);
    if (filters.category && filters.category !== 'All') params.set('category', filters.category);
    if (filters.language && filters.language !== 'All') params.set('language', filters.language);

    const qs = params.toString();
    return apiRequest<{ books: BookListing[] }>(qs ? `/api/books?${qs}` : '/api/books', {
      signal,
      fallbackMessage: 'Could not load book listings.',
    });
  },

  nearby(paramsObj: NearbyBooksParams) {
    const params = new URLSearchParams({
      lng: String(paramsObj.lng),
      lat: String(paramsObj.lat),
      maxDistance: String(paramsObj.maxDistance),
    });
    if (paramsObj.type && paramsObj.type !== 'All') {
      params.set('type', paramsObj.type);
    }
    return apiRequest<{ books: BookListing[] }>(`/api/books/nearby?${params.toString()}`, {
      fallbackMessage: 'Could not load nearby books.',
    });
  },

  mine() {
    return apiRequest<{ books: BookListing[] }>('/api/books/mine', {
      auth: true,
      fallbackMessage: 'Could not load your listings.',
    });
  },

  getById(id: string) {
    return apiRequest<{ book: BookListing }>(`/api/books/${encodeURIComponent(id)}`, {
      fallbackMessage: 'Could not load book listing.',
    });
  },

  create(formData: FormData) {
    return apiRequest<{ book: BookListing }>('/api/books', {
      method: 'POST',
      auth: true,
      body: formData,
      fallbackMessage: 'Could not publish book listing.',
    });
  },

  update(id: string, formData: FormData) {
    return apiRequest<{ book: BookListing }>(`/api/books/${encodeURIComponent(id)}`, {
      method: 'PUT',
      auth: true,
      body: formData,
      fallbackMessage: 'Could not update book listing.',
    });
  },

  remove(id: string) {
    return apiRequest<{ deleted: boolean; id: string }>(`/api/books/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      auth: true,
      fallbackMessage: 'Could not delete book listing.',
    });
  },
};

export const requestsApi = {
  create(payload: {
    bookId: string;
    offerBookTitle: string;
    message: string;
    contactNote: string;
  }) {
    return apiRequest<{ request: BookRequest }>('/api/requests', {
      method: 'POST',
      auth: true,
      body: payload,
      fallbackMessage: 'Could not send request.',
    });
  },

  incoming() {
    return apiRequest<{ requests: BookRequest[] }>('/api/requests/incoming', {
      auth: true,
      fallbackMessage: 'Could not load incoming requests.',
    });
  },

  outgoing() {
    return apiRequest<{ requests: BookRequest[] }>('/api/requests/outgoing', {
      auth: true,
      fallbackMessage: 'Could not load sent requests.',
    });
  },

  updateStatus(requestId: string, status: RequestStatus) {
    return apiRequest<{ request: BookRequest }>(`/api/requests/${encodeURIComponent(requestId)}`, {
      method: 'PATCH',
      auth: true,
      body: { status },
      fallbackMessage: 'Could not update request status.',
    });
  },
};

export const discussionsApi = {
  getByBookId(bookId: string) {
    return apiRequest<BookDiscussionsResponse>(`/api/books/${encodeURIComponent(bookId)}/discussions`, {
      fallbackMessage: 'Could not load reviews and questions.',
    });
  },

  addReview(bookId: string, payload: { rating: number; comment: string; finishedReading: boolean }) {
    return apiRequest<{ review: BookReview }>(`/api/books/${encodeURIComponent(bookId)}/reviews`, {
      method: 'POST',
      auth: true,
      body: payload,
      fallbackMessage: 'Could not publish review.',
    });
  },

  addQuestion(bookId: string, question: string) {
    return apiRequest<{ question: BookQuestion }>(`/api/books/${encodeURIComponent(bookId)}/questions`, {
      method: 'POST',
      auth: true,
      body: { question },
      fallbackMessage: 'Could not post question.',
    });
  },

  addAnswer(questionId: string, payload: { body: string; hasReadBook: boolean }) {
    return apiRequest<{ question: BookQuestion }>(
      `/api/questions/${encodeURIComponent(questionId)}/answers`,
      {
        method: 'POST',
        auth: true,
        body: payload,
        fallbackMessage: 'Could not post answer.',
      },
    );
  },
};
