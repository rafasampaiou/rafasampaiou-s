import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertOctagon, RefreshCw } from 'lucide-react';

interface Props {
    children: ReactNode;
}

interface State {
    hasError: boolean;
    error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = { hasError: false };
    }

    static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error("Uncaught error:", error, errorInfo);

        // Clear potentially corrupted storage
        localStorage.clear();
        console.warn("Storage cleared due to fatal error. Reloading in 2s...");

        // Auto-reload disabled for debugging "Not Loading" issue
        // setTimeout(() => {
        //     window.location.reload();
        // }, 100);
    }

    render() {
        if (this.state.hasError) {
            return (
                <div className="flex h-screen w-screen items-center justify-center bg-slate-50 p-4">
                    <div className="text-center max-w-md bg-white p-8 rounded-xl shadow-xl border border-red-100">
                        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-100 mb-6">
                            <AlertOctagon className="h-8 w-8 text-red-600" />
                        </div>

                        <h2 className="text-2xl font-bold text-slate-900 mb-2">Ops! Algo deu errado.</h2>
                        <p className="text-slate-500 mb-6">
                            Ocorreu um erro inesperado ao carregar a aplicação.
                        </p>

                        {/* Show error for debugging */}
                        <div className="bg-red-50 p-3 rounded text-left text-xs font-mono text-red-700 mb-6 overflow-auto max-h-32 w-full">
                            {this.state.error?.toString() || 'Erro desconhecido'}
                        </div>

                        <button
                            onClick={() => window.location.reload()}
                            className="flex items-center justify-center gap-2 text-white font-medium bg-[#155645] hover:bg-[#104033] py-3 px-6 rounded-lg transition-colors w-full"
                        >
                            <RefreshCw className="h-5 w-5" />
                            <span>Tentar Novamente</span>
                        </button>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}
