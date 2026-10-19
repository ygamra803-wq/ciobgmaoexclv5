// ✅ ملف: src/presentation/components/ErrorBoundary.tsx

import React from 'react';

interface Props {
  children: React.ReactNode;
  sectionName?: string;
}

interface State {
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
  errorCount: number;
}

/**
 * Error Boundary Component
 * ✅ التقاط الأخطاء في React ومنع انهيار التطبيق بالكامل
 */
export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      error: null,
      errorInfo: null,
      errorCount: 0,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary caught:', error, errorInfo);
    this.setState((prevState) => ({
      errorInfo,
      errorCount: prevState.errorCount + 1,
    }));
  }

  handleReset = () => {
    this.setState({ error: null, errorInfo: null });
  };

  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen bg-red-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full">
            <h1 className="text-2xl font-bold text-center text-gray-900 mb-4">
              حدث خطأ
            </h1>
            {this.props.sectionName && (
              <p className="text-xs font-semibold text-center text-red-600 mb-2">
                {this.props.sectionName}
              </p>
            )}
            <p className="text-gray-600 text-center mb-4">
              {this.state.error.message}
            </p>
            <div className="flex gap-3">
              <button
                onClick={this.handleReset}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                إعادة محاولة
              </button>
              <button
                onClick={() => (window.location.href = '/')}
                className="flex-1 px-4 py-2 bg-gray-200 text-gray-900 rounded-lg hover:bg-gray-300"
              >
                الرئيسية
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
