import { AlertCircle, ArrowLeft, CheckCircle2 } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getErrorMessage } from '../lib/api';

export function ForgotPasswordPage() {
  const { sendPasswordReset } = useAuth();
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    document.title = 'Reset Password — KitabWanag';
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await sendPasswordReset(email);
      setSent(true);
    } catch (err) {
      setError(getErrorMessage(err, 'Could not send password reset email. Please try again.'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-md mx-auto px-4 sm:px-6 py-14">
      <div className="bg-[#FFFFFF] border border-[#E5DFD3] rounded-2xl p-6 sm:p-8 space-y-6">
        <div>
          <Link
            to="/login"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-[#5C615D] hover:text-[#1B4D3E] mb-4 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Back to sign in</span>
          </Link>
          <h1 className="font-display text-3xl font-bold text-[#1C1F1D]">Forgot password</h1>
          <p className="text-sm text-[#5C615D] mt-1.5 leading-relaxed">
            Enter your email address and Firebase Authentication will send you a password reset link.
          </p>
        </div>

        {sent ? (
          <div className="space-y-4">
            <div className="rounded-xl bg-[#FAF7F2] border border-[#E5DFD3] p-4 flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-[#1B4D3E] shrink-0 mt-0.5" aria-hidden="true" />
              <div className="space-y-1 text-sm text-[#5C615D]">
                <p className="font-semibold text-[#1C1F1D]">Reset email sent</p>
                <p className="leading-relaxed">
                  Check <strong className="text-[#1C1F1D]">{email}</strong> for a password reset
                  link, then return here to sign in with your new password.
                </p>
              </div>
            </div>
            <Link
              to="/login"
              className="block w-full text-center py-3 rounded-lg bg-[#1B4D3E] text-[#FAF7F2] text-sm font-semibold hover:bg-[#143A2F] transition-colors"
            >
              Return to Sign In
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="flex items-start gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3.5 py-2.5">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
                <span>{error}</span>
              </div>
            )}

            <div>
              <label htmlFor="resetEmail" className="block text-sm font-medium text-[#1C1F1D] mb-1.5">
                Email address
              </label>
              <input
                id="resetEmail"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="reader@example.com"
                className="w-full h-11 px-3.5 rounded-lg bg-[#FAF7F2] border border-[#E5DFD3] text-sm text-[#1C1F1D] focus:outline-none focus:border-[#1B4D3E]"
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3 px-4 rounded-lg bg-[#1B4D3E] text-[#FAF7F2] text-sm font-semibold hover:bg-[#143A2F] disabled:opacity-60 transition-colors cursor-pointer"
            >
              {submitting ? 'Sending reset link...' : 'Send Reset Link'}
            </button>
          </form>
        )}

        <div className="pt-4 border-t border-[#E5DFD3] text-xs text-[#5C615D]">
          <p className="leading-relaxed">
            Signed up with Google? Recover access through{' '}
            <a
              href="https://accounts.google.com/signin/recovery"
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-[#1B4D3E] hover:underline"
            >
              Google Account Recovery
            </a>
            .
          </p>
        </div>
      </div>
    </div>
  );
}
