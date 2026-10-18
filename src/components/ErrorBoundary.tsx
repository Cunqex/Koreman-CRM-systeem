import { Component, type ErrorInfo, type ReactNode } from 'react';
import i18next from 'i18next';

type State = { error: Error | null };

export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Onverwachte fout in de UI', error, info.componentStack);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div className="flex min-h-screen items-center justify-center bg-canvas px-4">
        <div className="w-full max-w-md rounded-xl border border-line bg-white p-6 text-center shadow-card">
          <p className="text-base font-semibold text-navy-900">
            {i18next.t('errors.genericTitle')}
          </p>
          <p className="mt-2 text-sm text-navy-500">
            {i18next.t('errors.genericBody')}
          </p>
          <pre className="mt-4 max-h-32 overflow-auto rounded-lg bg-navy-50 p-3 text-left text-xs text-navy-500">
            {error.message}
          </pre>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-4 rounded-lg bg-navy-950 px-4 py-2 text-sm font-medium text-white"
          >
            {i18next.t('errors.reload')}
          </button>
        </div>
      </div>
    );
  }
}
