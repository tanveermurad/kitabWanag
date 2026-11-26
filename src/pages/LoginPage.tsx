import React, { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getErrorMessage } from '../lib/api';

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const returnTo = (location.state as { from?: string } | null)?.from || '/my-listings';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    document.title = 'Sign In — KitabWanag';
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await login(email, password);
      navigate(returnTo, { replace: true });
    } catch (err) {
      setError(getErrorMessage(err, 'Invalid email or password.'));
    } finally {
      setSubmitting(false);
    }
  };

  const fillDemoReader = () => {
    setEmail('reader@kitabwanag.org');
    setPassword('KitabDemo2026!');
    setError(null);
  };

  return (
    <div className="max-w-md mx-auto px-4 sm:px-6 py-14">
      <div className="bg-[#FFFFFF] border border-[#E5DFD3] rounded-2xl p-6 sm:p-8 space-y-6">
        <div>
          <h1 className="font-display text-3xl font-bold text-[#1C1F1D]">Sign in</h1>
          <p className="text-sm text-[#5C615D] mt-1.5">
            Access your posted books, incoming swap requests, and saved neighborhood listings.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
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
              placeholder="reader@kitabwanag.org"
              className="w-full h-11 px-3.5 rounded-lg bg-[#FAF7F2] border border-[#E5DFD3] text-sm focus:outline-none focus:border-[#1B4D3E]"
            />
          </div>

          <div>
            <div className="flex items-center justify-between gap-2 mb-1.5">
              <label htmlFor="loginPassword" className="block text-sm font-medium text-[#1C1F1D]">
                Password
              </label>
              <Link
                to="/forgot-password"
                className="text-xs font-medium text-[#1B4D3E] hover:underline whitespace-nowrap shrink-0"
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
              className="w-full h-11 px-3.5 rounded-lg bg-[#FAF7F2] border border-[#E5DFD3] text-sm focus:outline-none focus:border-[#1B4D3E]"
            />
          </div>

          {error && (
            <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3.5 py-2.5">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3 rounded-lg bg-[#1B4D3E] text-[#FAF7F2] text-sm font-semibold hover:bg-[#143A2F] disabled:opacity-60 transition-colors cursor-pointer"
          >
            {submitting ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <div className="pt-4 border-t border-[#E5DFD3] space-y-3">
          <div className="rounded-lg bg-[#F3EFE6] p-3.5 text-xs text-[#5C615D] space-y-2">
            <p className="font-medium text-[#1C1F1D]">Want to try immediately?</p>
            <p>
              Demo reader: <span className="font-mono">reader@kitabwanag.org</span>
            </p>
            <button
              type="button"
              onClick={fillDemoReader}
              className="text-xs font-semibold text-[#1B4D3E] hover:underline cursor-pointer"
            >
              Fill demo reader credentials
            </button>
          </div>

          <p className="text-sm text-[#5C615D] text-center">
            New to KitabWanag?{' '}
            <Link to="/signup" className="font-semibold text-[#1B4D3E] hover:underline">
              Create an account
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
