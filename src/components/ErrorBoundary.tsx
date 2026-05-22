import  { Component, ErrorInfo, ReactNode } from 'react';
import { AlertCircle } from 'lucide-react';

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  errorMsg: string;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    errorMsg: ''
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, errorMsg: error.message };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex flex-col items-center justify-center p-6 text-slate-800 dark:text-slate-200">
          <div className="bg-white dark:bg-slate-800 p-8 rounded-3xl shadow-xl max-w-md w-full text-center">
             <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-6" />
             <h1 className="text-2xl font-bold mb-4">Oops, something went wrong</h1>
             <p className="text-slate-500 dark:text-slate-400 mb-6">
                An unexpected error occurred in the application. Please refresh the page and try again.
             </p>
             <div className="bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-300 p-4 rounded-xl text-left font-mono text-sm overflow-auto mb-6">
               {this.state.errorMsg}
             </div>
             <button 
                onClick={() => window.location.reload()}
                className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold transition-colors"
             >
               Return to Start
             </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
