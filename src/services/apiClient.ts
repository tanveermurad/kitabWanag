import { auth as firebaseAuth } from '../lib/firebase';

const API_BASE = (import.meta.env?.VITE_API_URL || '').replace(/\/+$/, '');
const DEFAULT_TIMEOUT_MS = 15000;

export type ApiErrorCode =
  | 'BAD_REQUEST'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'PAYLOAD_TOO_LARGE'
  | 'RATE_LIMITED'
  | 'SERVER_ERROR'
  | 'NETWORK_ERROR'
  | 'TIMEOUT'
  | 'INVALID_RESPONSE'
  | 'UNKNOWN_ERROR';

export class ApiError extends Error {
  readonly status: number;
  readonly code: ApiErrorCode;
  readonly endpoint: string;

  constructor(message: string, status: number, code: ApiErrorCode, endpoint: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.endpoint = endpoint;
  }

  get isNotFound(): boolean {
    return this.status === 404;
  }

  get isUnauthorized(): boolean {
    return this.status === 401;
  }

  get isServerError(): boolean {
    return this.status >= 500;
  }

  get isNetworkError(): boolean {
    return this.code === 'NETWORK_ERROR' || this.code === 'TIMEOUT';
  }
}

export function apiUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) {
    return path;
  }
  const normalized = path.startsWith('/') ? path : `/${path}`;
  return `${API_BASE}${normalized}`;
}

export function resolveBookImageUrl(url: string): string {
  if (!url) return '';
  if (url.startsWith('/uploads/')) {
    return apiUrl(url);
  }
  return url;
}

export function getErrorMessage(err: unknown, fallback = 'Something went wrong. Please try again.'): string {
  if (err instanceof ApiError) {
    return err.message;
  }

  const firebaseCode =
    err && typeof err === 'object' && 'code' in err && typeof (err as { code?: unknown }).code === 'string'
      ? (err as { code: string }).code
      : '';

  const authCode =
    firebaseCode.startsWith('auth/')
      ? firebaseCode
      : err instanceof Error && err.message.includes('auth/')
        ? err.message.match(/auth\/[a-z0-9-]+/i)?.[0] || ''
        : '';

  if (authCode) {
    switch (authCode) {
      case 'auth/email-already-in-use':
        return 'An account with this email already exists. Try signing in instead.';
      case 'auth/invalid-email':
        return 'Please enter a valid email address.';
      case 'auth/weak-password':
        return 'Password must be at least 6 characters long.';
      case 'auth/invalid-credential':
      case 'auth/wrong-password':
      case 'auth/user-not-found':
        return 'Invalid email or password.';
      case 'auth/missing-password':
        return 'Please enter your password.';
      case 'auth/expired-action-code':
      case 'auth/invalid-action-code':
        return 'This password reset link is invalid or has expired. Please request a new one.';
      case 'auth/requires-recent-login':
        return 'For your security, please sign in again before completing this action.';
      case 'auth/popup-closed-by-user':
      case 'auth/cancelled-popup-request':
        return 'Google sign-in was cancelled before completion. Please try again.';
      case 'auth/popup-blocked':
        return 'Your browser blocked the Google sign-in popup. Please allow popups for this site and try again.';
      case 'auth/unauthorized-domain': {
        const host = typeof window !== 'undefined' && window.location?.hostname ? window.location.hostname : 'this domain';
        return `The domain "${host}" is not authorized for Firebase sign-in yet. Add "${host}" under Firebase Console → Authentication → Settings → Authorized domains.`;
      }
      case 'auth/operation-not-allowed':
        return 'This sign-in method is not enabled in Firebase Authentication yet. Enable it in Firebase Console → Authentication → Sign-in method.';
      case 'auth/network-request-failed':
        return 'Network error while contacting Firebase Authentication. Check your connection and try again.';
      case 'auth/too-many-requests':
        return 'Too many attempts. Please wait a moment and try again.';
      case 'auth/user-disabled':
        return 'This account has been disabled in Firebase Authentication.';
      case 'auth/account-exists-with-different-credential':
        return 'An account already exists with this email using a different sign-in method.';
      default:
        break;
    }
  }

  if (err instanceof Error && err.message) {
    if (err.message.startsWith('{')) {
      try {
        const parsed = JSON.parse(err.message) as { error?: string; operationType?: string };
        if (parsed.error) {
          if (parsed.error.includes('Quota exceeded')) {
            return 'Daily database quota has been reached. Please try again tomorrow or upgrade your Firebase plan.';
          }
          if (parsed.error.includes('Missing or insufficient permissions')) {
            return 'You do not have permission for this action. Please sign in with a verified account.';
          }
          if (parsed.error.includes('client is offline')) {
            return 'Unable to reach Firebase Firestore right now. Check your internet connection and try again.';
          }
          return parsed.error;
        }
      } catch {
        // Fall through to raw message
      }
    }
    return err.message;
  }
  return fallback;
}

function mapStatusToCode(status: number): ApiErrorCode {
  if (status === 400) return 'BAD_REQUEST';
  if (status === 401) return 'UNAUTHORIZED';
  if (status === 403) return 'FORBIDDEN';
  if (status === 404) return 'NOT_FOUND';
  if (status === 409) return 'CONFLICT';
  if (status === 413) return 'PAYLOAD_TOO_LARGE';
  if (status === 429) return 'RATE_LIMITED';
  if (status >= 500) return 'SERVER_ERROR';
  return 'UNKNOWN_ERROR';
}

function defaultMessageForStatus(status: number, fallback: string, isHtmlOrNonJson: boolean): string {
  if (status === 401) {
    return 'Your session has expired or is invalid. Please sign in again.';
  }
  if (status === 403) {
    return 'You do not have permission to perform this action.';
  }
  if (status === 404) {
    return isHtmlOrNonJson
      ? `${fallback} The API endpoint was not found (404). Make sure the backend server is running and reachable.`
      : `${fallback} (Not found — 404)`;
  }
  if (status === 413) {
    return 'The uploaded file or request is too large.';
  }
  if (status === 429) {
    return 'Too many requests. Please wait a moment and try again.';
  }
  if (status >= 500) {
    return `The server encountered an unexpected issue (HTTP ${status}). Please try again shortly.`;
  }
  return `${fallback} (HTTP ${status})`;
}

export interface ApiRequestOptions extends Omit<RequestInit, 'body'> {
  body?: BodyInit | Record<string, unknown>;
  auth?: boolean;
  timeoutMs?: number;
  fallbackMessage?: string;
}

export async function apiRequest<T>(endpoint: string, options: ApiRequestOptions = {}): Promise<T> {
  const {
    auth = false,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    fallbackMessage = 'Request failed.',
    headers: rawHeaders,
    body: rawBody,
    signal: externalSignal,
    ...restInit
  } = options;

  const headers = new Headers(rawHeaders || {});
  let body: BodyInit | undefined;

  if (rawBody !== undefined) {
    if (
      typeof rawBody === 'string' ||
      rawBody instanceof FormData ||
      rawBody instanceof URLSearchParams ||
      rawBody instanceof Blob
    ) {
      body = rawBody;
    } else {
      if (!headers.has('Content-Type')) {
        headers.set('Content-Type', 'application/json');
      }
      body = JSON.stringify(rawBody);
    }
  }

  if (auth && firebaseAuth.currentUser && !headers.has('Authorization')) {
    const idToken = await firebaseAuth.currentUser.getIdToken();
    if (idToken) {
      headers.set('Authorization', `Bearer ${idToken}`);
    }
  }

  const method = (restInit.method || 'GET').toUpperCase();
  const maxAttempts = method === 'GET' ? 2 : 1;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort('timeout'), timeoutMs);

    const forwardAbort = () => controller.abort(externalSignal?.reason);
    if (externalSignal) {
      if (externalSignal.aborted) {
        controller.abort(externalSignal.reason);
      } else {
        externalSignal.addEventListener('abort', forwardAbort, { once: true });
      }
    }

    let res: Response;
    try {
      res = await fetch(apiUrl(endpoint), {
        ...restInit,
        headers,
        body,
        signal: controller.signal,
      });
    } catch (err) {
      if (externalSignal?.aborted) {
        throw err;
      }
      if (controller.signal.aborted && controller.signal.reason === 'timeout') {
        throw new ApiError(
          'The request timed out. Please check your connection and try again.',
          0,
          'TIMEOUT',
          endpoint,
        );
      }
      if (attempt < maxAttempts) {
        await new Promise((r) => window.setTimeout(r, 500));
        continue;
      }
      throw new ApiError(
        'Network error. Please check your internet connection and try again.',
        0,
        'NETWORK_ERROR',
        endpoint,
      );
    } finally {
      window.clearTimeout(timeoutId);
      if (externalSignal) {
        externalSignal.removeEventListener('abort', forwardAbort);
      }
    }

    if (res.status >= 502 && res.status <= 504 && attempt < maxAttempts) {
      await new Promise((r) => window.setTimeout(r, 500));
      continue;
    }

    if (res.status === 204) {
      return undefined as T;
    }

    const contentType = (res.headers.get('content-type') || '').toLowerCase();
    const isJson = contentType.includes('application/json');

    if (!isJson) {
      if (!res.ok) {
        throw new ApiError(
          defaultMessageForStatus(res.status, fallbackMessage, true),
          res.status,
          mapStatusToCode(res.status),
          endpoint,
        );
      }
      throw new ApiError(
        `${fallbackMessage} The backend API was not reached (received an HTML page instead of JSON).`,
        res.status || 502,
        'INVALID_RESPONSE',
        endpoint,
      );
    }

    let payload: unknown;
    try {
      payload = await res.json();
    } catch {
      throw new ApiError(
        `${fallbackMessage} Could not read the server response.`,
        res.status || 502,
        'INVALID_RESPONSE',
        endpoint,
      );
    }

    if (!res.ok) {
      const serverError =
        payload && typeof payload === 'object' && 'error' in payload && typeof (payload as { error?: unknown }).error === 'string'
          ? (payload as { error: string }).error
          : null;

      throw new ApiError(
        serverError || defaultMessageForStatus(res.status, fallbackMessage, false),
        res.status,
        mapStatusToCode(res.status),
        endpoint,
      );
    }

    return payload as T;
  }

  throw new ApiError(fallbackMessage, 0, 'UNKNOWN_ERROR', endpoint);
}
