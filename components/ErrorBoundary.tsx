import { Component, ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-tv-black flex items-center justify-center p-8">
          <div className="max-w-lg w-full bg-tv-gray/30 border border-tv-amber rounded-lg p-8 text-center">
            <div className="text-4xl mb-4">&#x26A0;</div>
            <h1 className="text-xl font-bold text-tv-amber uppercase tracking-widest mb-4">
              System Failure
            </h1>
            <p className="text-gray-400 font-mono text-sm mb-6">
              {this.state.error?.message || 'An unexpected error occurred.'}
            </p>
            <button
              onClick={() => this.setState({ hasError: false, error: null })}
              className="bg-tv-amber hover:bg-amber-600 text-black px-6 py-3 rounded font-bold uppercase tracking-wider text-sm transition-colors"
            >
              Reboot System
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
