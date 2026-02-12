import { Component, type ReactNode, type ErrorInfo } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("[Smart Blockbuster] Error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-sb-black flex items-center justify-center p-8">
          <div className="bg-sb-gray border border-sb-red rounded-lg p-8 max-w-lg w-full text-center">
            <div className="text-4xl mb-4">🎬</div>
            <h2 className="text-sb-red text-lg font-bold mb-2">
              СИСТЕМНАЯ ОШИБКА
            </h2>
            <p className="text-sb-slate text-sm mb-4">
              {this.state.error?.message || "Неизвестная ошибка"}
            </p>
            <button
              onClick={() => {
                this.setState({ hasError: false, error: null });
                window.location.reload();
              }}
              className="px-6 py-2 bg-sb-red text-white rounded hover:bg-red-700 transition-colors text-sm"
            >
              Перезагрузить систему
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
