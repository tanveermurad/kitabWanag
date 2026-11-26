import { ArrowLeft, ShieldCheck } from 'lucide-react';
import { useEffect } from 'react';
import { Link } from 'react-router-dom';

export function ForgotPasswordPage() {
  useEffect(() => {
    document.title = 'Account Recovery — KitabWanag';
  }, []);

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
          <h1 className="font-display text-3xl font-bold text-[#1C1F1D]">Account recovery</h1>
          <p className="text-sm text-[#5C615D] mt-1.5 leading-relaxed">
            KitabWanag signs readers in through Google Authentication so you do not need to manage
            a separate password here.
          </p>
        </div>

        <div className="rounded-xl bg-[#FAF7F2] border border-[#E5DFD3] p-4 flex items-start gap-3">
          <ShieldCheck className="w-5 h-5 text-[#1B4D3E] shrink-0 mt-0.5" aria-hidden="true" />
          <div className="space-y-1.5 text-sm text-[#5C615D]">
            <p className="font-semibold text-[#1C1F1D]">Recover your Google password</p>
            <p className="leading-relaxed">
              If you forgot the password to your Google account, reset it directly through{' '}
              <a
                href="https://accounts.google.com/signin/recovery"
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-[#1B4D3E] hover:underline"
              >
                Google Account Recovery
              </a>
              , then return here to sign in.
            </p>
          </div>
        </div>

        <Link
          to="/login"
          className="block w-full text-center py-3 rounded-lg bg-[#1B4D3E] text-[#FAF7F2] text-sm font-semibold hover:bg-[#143A2F] transition-colors"
        >
          Go to Sign In
        </Link>
      </div>
    </div>
  );
}
