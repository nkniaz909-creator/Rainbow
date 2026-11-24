import React from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';
import { RAINBOW_LOGO_PATH } from '../types';

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
    return { hasError: true, message: error?.message || 'Unexpected error' };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    console.error('Rainbow ErrorBoundary caught:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-white dark:bg-neutral-950 text-neutral-950 dark:text-neutral-50 p-6">
          <div className="max-w-md w-full border border-neutral-200 dark:border-neutral-800 rounded-2xl p-8 text-center">
            <img
              src={RAINBOW_LOGO_PATH}
              alt="Rainbow"
              className="w-14 h-14 rounded-full mx-auto mb-4 object-cover"
            />
            <div className="w-10 h-10 rounded-full bg-red-500/10 text-red-600 dark:text-red-400 flex items-center justify-center mx-auto mb-3">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <h1 className="text-lg font-bold mb-2">Something went wrong</h1>
            <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-6 break-words">
              {this.state.message}
            </p>
            <button
              onClick={() => window.location.reload()}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-neutral-950 dark:bg-white text-white dark:text-neutral-950 text-sm font-medium hover:opacity-90 transition-opacity"
            >
              <RotateCcw className="w-4 h-4" />
              Reload Rainbow
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
