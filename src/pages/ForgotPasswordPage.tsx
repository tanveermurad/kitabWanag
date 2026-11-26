import React, { useEffect, useState } from 'react';
import { AlertCircle, ArrowLeft, CheckCircle2, Mail } from 'lucide-react';
import { Link } from 'react-router-dom';
import { authApi, getErrorMessage } from '../lib/api';

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submittedMessage, setSubmittedMessage] = useState<string | null>(null);
  const [emailConfigured, setEmailConfigured] = useState(true);

  useEffect(() => {
    document.title = 'Forgot Password — KitabWanag';
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await authApi.forgotPassword(email.trim());
      setSubmittedMessage(res.message);
      setEmailConfigured(res.emailConfigured !== false);
    } catch (err) {
      setError(getErrorMessage(err, 'Could not process your password reset request.'));
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
          <p className="text-sm text-[#5C615D] mt-1.5">
            Enter the email address for your KitabWanag account and we will send a single-use link to
            set a new password.
          </p>
        </div>

        {submittedMessage ? (
          <div className="space-y-4">
            <div className="rounded-xl bg-[#FAF7F2] border border-[#E5DFD3] p-4 space-y-2.5">
              <div className="flex items-start gap-2.5 text-[#1B4D3E]">
                <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" aria-hidden="true" />
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-[#1C1F1D]">Request received</p>
                  <p className="text-sm text-[#5C615D] leading-relaxed">{submittedMessage}</p>
                </div>
              </div>
              <p className="text-xs text-[#5C615D] pl-7">
                Reset links remain valid for 15 minutes and can only be used once.
              </p>
            </div>

            {!emailConfigured && (
              <div className="rounded-xl bg-[#F3EFE6] border border-[#E5DFD3] p-4 text-xs text-[#5C615D] space-y-1.5">
                <p className="font-semibold text-[#1C1F1D] flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-[#1B4D3E]" aria-hidden="true" />
                  <span>Outgoing email not yet configured</span>
                </p>
                <p className="leading-relaxed">
                  Add <span className="font-mono text-[#1C1F1D]">RESEND_API_KEY</span> in your server
                  environment variables to send reset emails automatically.
                </p>
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-2.5 pt-1">
              <Link
                to="/reset-password"
                className="flex-1 text-center py-2.5 px-4 rounded-lg bg-[#1B4D3E] text-[#FAF7F2] text-sm font-semibold hover:bg-[#143A2F] transition-colors whitespace-nowrap"
              >
                Enter Reset Token
              </Link>
              <button
                type="button"
                onClick={() => {
                  setSubmittedMessage(null);
                  setError(null);
                }}
                className="flex-1 py-2.5 px-4 rounded-lg border border-[#E5DFD3] text-sm font-medium text-[#1C1F1D] hover:bg-[#FAF7F2] transition-colors cursor-pointer whitespace-nowrap"
              >
                Try another email
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="forgotEmail" className="block text-sm font-medium text-[#1C1F1D] mb-1.5">
                Email address
              </label>
              <input
                id="forgotEmail"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="reader@kitabwanag.org"
                className="w-full h-11 px-3.5 rounded-lg bg-[#FAF7F2] border border-[#E5DFD3] text-sm focus:outline-none focus:border-[#1B4D3E]"
              />
            </div>

            {error && (
              <div className="flex items-start gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3.5 py-2.5">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3 rounded-lg bg-[#1B4D3E] text-[#FAF7F2] text-sm font-semibold hover:bg-[#143A2F] disabled:opacity-60 transition-colors cursor-pointer"
            >
              {submitting ? 'Sending instructions...' : 'Send Reset Link'}
            </button>
          </form>
        )}

        <div className="pt-4 border-t border-[#E5DFD3] flex flex-wrap items-center justify-between gap-2 text-xs text-[#5C615D]">
          <span>Remembered your password?</span>
          <Link to="/login" className="font-semibold text-[#1B4D3E] hover:underline whitespace-nowrap">
            Return to Sign In
          </Link>
        </div>
      </div>
    </div>
  );
}
