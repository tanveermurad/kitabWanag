import { AlertCircle } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getErrorMessage } from '../lib/api';

export function LoginPage() {
  const { isAuthenticated, authReady, loginWithGoogle } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const returnTo = (location.state as { from?: string } | null)?.from || '/my-listings';

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    document.title = 'Sign In — KitabWanag';
  }, []);

  if (authReady && isAuthenticated) {
    return <Navigate to={returnTo} replace />;
  }

  const handleGoogleSignIn = async () => {
    setSubmitting(true);
    setError(null);
    try {
      await loginWithGoogle();
      navigate(returnTo, { replace: true });
    } catch (err) {
      setError(getErrorMessage(err, 'Could not complete Google sign-in. Please try again.'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-md mx-auto px-4 sm:px-6 py-14">
      <div className="bg-[#FFFFFF] border border-[#E5DFD3] rounded-2xl p-6 sm:p-8 space-y-6">
        <div>
          <h1 className="font-display text-3xl font-bold text-[#1C1F1D]">Sign in to KitabWanag</h1>
          <p className="text-sm text-[#5C615D] mt-1.5 leading-relaxed">
            Use your Google account to post books, manage swap and purchase requests, write reader
            reviews, and keep your shelf synced across devices.
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
          disabled={submitting || !authReady}
          className="w-full py-3 px-4 rounded-lg bg-[#1B4D3E] text-[#FAF7F2] text-sm font-semibold hover:bg-[#143A2F] disabled:opacity-60 transition-colors flex items-center justify-center gap-3 cursor-pointer"
        >
          <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
            <path
              fill="currentColor"
              d="M21.35 11.1h-9.17v2.98h5.27c-.23 1.46-1.69 4.28-5.27 4.28a6.08 6.08 0 1 1 0-12.16c1.75 0 2.93.75 3.6 1.4l2.45-2.36A9.4 9.4 0 0 0 12.18 2.5a9.5 9.5 0 1 0 0 19c5.48 0 9.12-3.85 9.12-9.27 0-.62-.07-1.1-.15-1.13Z"
            />
          </svg>
          <span>{submitting ? 'Signing in...' : 'Continue with Google'}</span>
        </button>

        <div className="pt-4 border-t border-[#E5DFD3] space-y-2 text-xs text-[#5C615D]">
          <p className="leading-relaxed">
            New to KitabWanag?{' '}
            <Link to="/signup" state={location.state} className="font-semibold text-[#1B4D3E] hover:underline">
              Create a reader account
            </Link>
          </p>
          <p className="leading-relaxed">
            Need help accessing your Google account?{' '}
            <Link to="/forgot-password" className="font-semibold text-[#1B4D3E] hover:underline">
              Account recovery options
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
