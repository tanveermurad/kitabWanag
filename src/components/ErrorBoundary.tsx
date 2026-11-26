import React from 'react';

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      message: error?.message || 'Something unexpected happened while rendering this page.',
    };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    console.error('UI ErrorBoundary caught:', error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#FAF7F2] text-[#1C1F1D] flex items-center justify-center px-4">
          <div className="max-w-md w-full bg-[#FFFFFF] border border-[#E5DFD3] rounded-2xl p-8 text-center space-y-4">
            <h1 className="font-display text-2xl font-bold text-[#1C1F1D]">
              Something went wrong
            </h1>
            <p className="text-sm text-[#5C615D]">{this.state.message}</p>
            <div className="pt-2 flex justify-center gap-3">
              <button
                type="button"
                onClick={() => window.location.assign('/')}
                className="px-5 py-2.5 rounded-lg bg-[#1B4D3E] text-[#FAF7F2] text-sm font-semibold cursor-pointer"
              >
                Return Home
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
