import { AlertCircle, CheckCircle2 } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getErrorMessage } from '../lib/api';
import { CITY_PRESETS } from '../lib/cities';

export function SignupPage() {
  const { isAuthenticated, authReady, loginWithGoogle, signupWithEmail } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const returnTo = (location.state as { from?: string } | null)?.from || '/my-listings';

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [city, setCity] = useState('Quetta');
  const [submitting, setSubmitting] = useState(false);
  const [googleSubmitting, setGoogleSubmitting] = useState(false);
  const [verificationSent, setVerificationSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    document.title = 'Create Account — KitabWanag';
  }, []);

  if (authReady && isAuthenticated && !verificationSent) {
    return <Navigate to={returnTo} replace />;
  }

  const handleEmailSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim().length < 2) {
      setError('Please enter your full name.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const result = await signupWithEmail({ name, email, password, city });
      if (result.verificationEmailSent) {
        setVerificationSent(true);
      } else {
        navigate(returnTo, { replace: true });
      }
    } catch (err) {
      setError(getErrorMessage(err, 'Could not create your account. Please try again.'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogleSignUp = async () => {
    setGoogleSubmitting(true);
    setError(null);
    try {
      await loginWithGoogle(city);
      navigate(returnTo, { replace: true });
    } catch (err) {
      setError(getErrorMessage(err, 'Could not create your account with Google. Please try again.'));
    } finally {
      setGoogleSubmitting(false);
    }
  };

  const busy = submitting || googleSubmitting || !authReady;

  return (
    <div className="max-w-md mx-auto px-4 sm:px-6 py-14">
      <div className="bg-[#FFFFFF] border border-[#E5DFD3] rounded-2xl p-6 sm:p-8 space-y-6">
        {verificationSent ? (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-[#1B4D3E]">
              <CheckCircle2 className="w-5 h-5 shrink-0" aria-hidden="true" />
              <h1 className="font-display text-2xl font-bold text-[#1C1F1D]">
                Verify your email
              </h1>
            </div>
            <p className="text-sm text-[#5C615D] leading-relaxed">
              Your KitabWanag account has been created and a verification link was sent to{' '}
              <strong className="text-[#1C1F1D]">{email}</strong>. Open the link in your inbox so
              you can post books, send swap or buy requests, and write reviews.
            </p>
            <div className="flex flex-wrap gap-3 pt-2">
              <button
                type="button"
                onClick={() => navigate('/profile', { replace: true })}
                className="px-5 py-2.5 rounded-lg bg-[#1B4D3E] text-[#FAF7F2] text-sm font-semibold hover:bg-[#143A2F] cursor-pointer"
              >
                Go to Profile
              </button>
              <Link
                to="/browse"
                className="px-5 py-2.5 rounded-lg border border-[#E5DFD3] text-[#1C1F1D] text-sm font-semibold hover:bg-[#F3EFE6]"
              >
                Browse Books
              </Link>
            </div>
          </div>
        ) : (
          <>
            <div>
              <h1 className="font-display text-3xl font-bold text-[#1C1F1D]">
                Create your KitabWanag account
              </h1>
              <p className="text-sm text-[#5C615D] mt-1.5 leading-relaxed">
                Join with Google or email and password to list books, message nearby readers, and
                share reviews.
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
              onClick={() => void handleGoogleSignUp()}
              disabled={busy}
              className="w-full py-3 px-4 rounded-lg border border-[#1B4D3E] bg-[#FAF7F2] text-[#1C1F1D] text-sm font-semibold hover:bg-[#F3EFE6] disabled:opacity-60 transition-colors flex items-center justify-center gap-3 cursor-pointer"
            >
              <svg className="w-4 h-4 shrink-0 text-[#1B4D3E]" viewBox="0 0 24 24" aria-hidden="true">
                <path
                  fill="currentColor"
                  d="M21.35 11.1h-9.17v2.98h5.27c-.23 1.46-1.69 4.28-5.27 4.28a6.08 6.08 0 1 1 0-12.16c1.75 0 2.93.75 3.6 1.4l2.45-2.36A9.4 9.4 0 0 0 12.18 2.5a9.5 9.5 0 1 0 0 19c5.48 0 9.12-3.85 9.12-9.27 0-.62-.07-1.1-.15-1.13Z"
                />
              </svg>
              <span>{googleSubmitting ? 'Creating account...' : 'Sign up with Google'}</span>
            </button>

            <div className="relative flex items-center">
              <div className="flex-grow border-t border-[#E5DFD3]" />
              <span className="px-3 text-xs text-[#5C615D]">or register with email</span>
              <div className="flex-grow border-t border-[#E5DFD3]" />
            </div>

            <form onSubmit={handleEmailSignUp} className="space-y-4">
              <div>
                <label htmlFor="signupName" className="block text-sm font-medium text-[#1C1F1D] mb-1.5">
                  Full name
                </label>
                <input
                  id="signupName"
                  type="text"
                  required
                  autoComplete="name"
                  maxLength={80}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Ayesha Khan"
                  className="w-full h-11 px-3.5 rounded-lg bg-[#FAF7F2] border border-[#E5DFD3] text-sm text-[#1C1F1D] focus:outline-none focus:border-[#1B4D3E]"
                />
              </div>

              <div>
                <label htmlFor="signupEmail" className="block text-sm font-medium text-[#1C1F1D] mb-1.5">
                  Email address
                </label>
                <input
                  id="signupEmail"
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
                <label
                  htmlFor="signupPassword"
                  className="block text-sm font-medium text-[#1C1F1D] mb-1.5"
                >
                  Password
                </label>
                <input
                  id="signupPassword"
                  type="password"
                  required
                  minLength={6}
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 6 characters"
                  className="w-full h-11 px-3.5 rounded-lg bg-[#FAF7F2] border border-[#E5DFD3] text-sm text-[#1C1F1D] focus:outline-none focus:border-[#1B4D3E]"
                />
              </div>

              <div>
                <label htmlFor="signupCity" className="block text-sm font-medium text-[#1C1F1D] mb-1.5">
                  Your city
                </label>
                <select
                  id="signupCity"
                  value={city}
                  disabled={busy}
                  onChange={(e) => setCity(e.target.value)}
                  className="w-full h-11 px-3.5 rounded-lg bg-[#FAF7F2] border border-[#E5DFD3] text-sm text-[#1C1F1D] focus:outline-none focus:border-[#1B4D3E]"
                >
                  {CITY_PRESETS.map((preset) => (
                    <option key={preset.name} value={preset.name}>
                      {preset.name}
                    </option>
                  ))}
                </select>
              </div>

              <button
                type="submit"
                disabled={busy}
                className="w-full py-3 px-4 rounded-lg bg-[#1B4D3E] text-[#FAF7F2] text-sm font-semibold hover:bg-[#143A2F] disabled:opacity-60 transition-colors cursor-pointer"
              >
                {submitting ? 'Creating account...' : 'Create Account'}
              </button>
            </form>

            <div className="pt-4 border-t border-[#E5DFD3] text-xs text-[#5C615D]">
              <p className="leading-relaxed">
                Already have an account?{' '}
                <Link to="/login" state={location.state} className="font-semibold text-[#1B4D3E] hover:underline">
                  Sign in
                </Link>
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
