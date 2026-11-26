import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getErrorMessage } from '../lib/api';
import { CITY_PRESETS } from '../lib/cities';

export function SignupPage() {
  const { signup } = useAuth();
  const navigate = useNavigate();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [city, setCity] = useState('Quetta');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    document.title = 'Create Account — KitabWanag';
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await signup(name, email, password, city);
      navigate('/my-listings', { replace: true });
    } catch (err) {
      setError(getErrorMessage(err, 'Could not create account.'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-md mx-auto px-4 sm:px-6 py-14">
      <div className="bg-[#FFFFFF] border border-[#E5DFD3] rounded-2xl p-6 sm:p-8 space-y-6">
        <div>
          <h1 className="font-display text-3xl font-bold text-[#1C1F1D]">Create account</h1>
          <p className="text-sm text-[#5C615D] mt-1.5">
            Join readers nearby to post books, arrange swaps, and request copies.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="signupName" className="block text-sm font-medium text-[#1C1F1D] mb-1.5">
              Full name
            </label>
            <input
              id="signupName"
              type="text"
              required
              autoComplete="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Sanaullah Kurd"
              className="w-full h-11 px-3.5 rounded-lg bg-[#FAF7F2] border border-[#E5DFD3] text-sm focus:outline-none focus:border-[#1B4D3E]"
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
              placeholder="you@example.com"
              className="w-full h-11 px-3.5 rounded-lg bg-[#FAF7F2] border border-[#E5DFD3] text-sm focus:outline-none focus:border-[#1B4D3E]"
            />
          </div>

          <div>
            <label htmlFor="signupCity" className="block text-sm font-medium text-[#1C1F1D] mb-1.5">
              Your city
            </label>
            <select
              id="signupCity"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              className="w-full h-11 px-3.5 rounded-lg bg-[#FAF7F2] border border-[#E5DFD3] text-sm focus:outline-none focus:border-[#1B4D3E]"
            >
              {CITY_PRESETS.map((c) => (
                <option key={c.name} value={c.name}>
                  {c.name}, {c.region}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="signupPassword"
              className="block text-sm font-medium text-[#1C1F1D] mb-1.5"
            >
              Password (minimum 6 characters)
            </label>
            <input
              id="signupPassword"
              type="password"
              required
              minLength={6}
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Choose a strong password"
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
            {submitting ? 'Creating account...' : 'Create Account'}
          </button>
        </form>

        <p className="text-sm text-[#5C615D] text-center pt-2 border-t border-[#E5DFD3]">
          Already have an account?{' '}
          <Link to="/login" className="font-semibold text-[#1B4D3E] hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
