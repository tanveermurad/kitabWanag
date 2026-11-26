import { AlertCircle } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getErrorMessage } from '../lib/api';

export function LoginPage() {
  const { isAuthenticated, authReady, loginWithGoogle, loginWithEmail } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const returnTo = (location.state as { from?: string } | null)?.from || '/my-listings';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [googleSubmitting, setGoogleSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    document.title = 'Sign In — KitabWanag';
  }, []);

  if (authReady && isAuthenticated) {
    return <Navigate to={returnTo} replace />;
  }

  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await loginWithEmail(email, password);
      navigate(returnTo, { replace: true });
    } catch (err) {
      setError(getErrorMessage(err, 'Could not sign in with that email and password.'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setGoogleSubmitting(true);
    setError(null);
    try {
      await loginWithGoogle();
      navigate(returnTo, { replace: true });
    } catch (err) {
      setError(getErrorMessage(err, 'Could not complete Google sign-in. Please try again.'));
    } finally {
      setGoogleSubmitting(false);
    }
  };

  const busy = submitting || googleSubmitting || !authReady;

  return (
    <div className="max-w-md mx-auto px-4 sm:px-6 py-14">
      <div className="bg-[#FFFFFF] border border-[#E5DFD3] rounded-2xl p-6 sm:p-8 space-y-6">
        <div>
          <h1 className="font-display text-3xl font-bold text-[#1C1F1D]">Sign in to KitabWanag</h1>
          <p className="text-sm text-[#5C615D] mt-1.5 leading-relaxed">
            Access your book shelf, swap or purchase requests, and reader reviews.
          </p>
        </div>

        {error && (
          <div className="flex items-start gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3.5 py-2.5">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
            <span>{error}</span>
          </div>
        )}

        <button
          type="button"
          onClick={() => void handleGoogleSignIn()}
          disabled={busy}
          className="w-full py-3 px-4 rounded-lg border border-[#1B4D3E] bg-[#FAF7F2] text-[#1C1F1D] text-sm font-semibold hover:bg-[#F3EFE6] disabled:opacity-60 transition-colors flex items-center justify-center gap-3 cursor-pointer"
        >
          <svg className="w-4 h-4 shrink-0 text-[#1B4D3E]" viewBox="0 0 24 24" aria-hidden="true">
            <path
              fill="currentColor"
              d="M21.35 11.1h-9.17v2.98h5.27c-.23 1.46-1.69 4.28-5.27 4.28a6.08 6.08 0 1 1 0-12.16c1.75 0 2.93.75 3.6 1.4l2.45-2.36A9.4 9.4 0 0 0 12.18 2.5a9.5 9.5 0 1 0 0 19c5.48 0 9.12-3.85 9.12-9.27 0-.62-.07-1.1-.15-1.13Z"
            />
          </svg>
          <span>{googleSubmitting ? 'Signing in...' : 'Continue with Google'}</span>
        </button>

        <div className="relative flex items-center">
          <div className="flex-grow border-t border-[#E5DFD3]" />
          <span className="px-3 text-xs text-[#5C615D]">or sign in with email</span>
          <div className="flex-grow border-t border-[#E5DFD3]" />
        </div>

        <form onSubmit={handleEmailSignIn} className="space-y-4">
          <div>
            <label htmlFor="loginEmail" className="block text-sm font-medium text-[#1C1F1D] mb-1.5">
              Email address
            </label>
            <input
              id="loginEmail"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="reader@example.com"
              className="w-full h-11 px-3.5 rounded-lg bg-[#FAF7F2] border border-[#E5DFD3] text-sm text-[#1C1F1D] focus:outline-none focus:border-[#1B4D3E]"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label htmlFor="loginPassword" className="block text-sm font-medium text-[#1C1F1D]">
                Password
              </label>
              <Link
                to="/forgot-password"
                className="text-xs font-medium text-[#1B4D3E] hover:underline"
              >
                Forgot password?
              </Link>
            </div>
            <input
              id="loginPassword"
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              className="w-full h-11 px-3.5 rounded-lg bg-[#FAF7F2] border border-[#E5DFD3] text-sm text-[#1C1F1D] focus:outline-none focus:border-[#1B4D3E]"
            />
          </div>

          <button
            type="submit"
            disabled={busy}
            className="w-full py-3 px-4 rounded-lg bg-[#1B4D3E] text-[#FAF7F2] text-sm font-semibold hover:bg-[#143A2F] disabled:opacity-60 transition-colors cursor-pointer"
          >
            {submitting ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <div className="pt-4 border-t border-[#E5DFD3] text-xs text-[#5C615D]">
          <p className="leading-relaxed">
            New to KitabWanag?{' '}
            <Link to="/signup" state={location.state} className="font-semibold text-[#1B4D3E] hover:underline">
              Create a reader account
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
