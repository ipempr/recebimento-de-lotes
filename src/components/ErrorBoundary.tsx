import React, { ErrorInfo, ReactNode } from 'react';
import { AlertCircle, RefreshCw, Sparkles } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  override state: State = {
    hasError: false,
    error: null,
  };

  constructor(props: Props) {
    super(props);
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error in application:', error, errorInfo);
  }

  private handleResetLocal = () => {
    try {
      localStorage.setItem('lotes_isLocalMode', 'true');
    } catch (e) {
      // ignore
    }
    window.location.reload();
  };

  private handleReload = () => {
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#f5f5f0] flex items-center justify-center p-6 text-[#1a1a1a] font-sans">
          <div className="max-w-lg w-full bg-white rounded-[32px] p-8 border border-red-200 shadow-2xl text-center space-y-4">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center text-red-600 mx-auto shadow-inner">
              <AlertCircle size={32} />
            </div>

            <h2 className="text-2xl font-bold tracking-tight text-gray-900">
              Ocorreu um erro no aplicativo
            </h2>

            <p className="text-xs text-[#5A5A40] leading-relaxed">
              Foi detectada uma falha durante o processamento da interface. Você pode tentar recarregar a página ou iniciar no modo local seguro para restaurar a visualização.
            </p>

            {this.state.error && (
              <div className="p-3 bg-red-50 rounded-xl border border-red-100 text-[11px] font-mono text-red-800 text-left overflow-auto max-h-32">
                {this.state.error.message || String(this.state.error)}
              </div>
            )}

            <div className="pt-2 flex flex-col sm:flex-row gap-3">
              <button
                onClick={this.handleReload}
                className="flex-1 py-3 px-4 bg-[#5A5A40] text-white font-semibold text-xs rounded-2xl hover:bg-[#4a4a30] transition flex items-center justify-center gap-2 cursor-pointer shadow-md"
              >
                <RefreshCw size={14} /> Recarregar Página
              </button>
              <button
                onClick={this.handleResetLocal}
                className="flex-1 py-3 px-4 bg-amber-600 text-white font-semibold text-xs rounded-2xl hover:bg-amber-700 transition flex items-center justify-center gap-2 cursor-pointer shadow-md"
              >
                <Sparkles size={14} /> Iniciar no Modo Local
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
