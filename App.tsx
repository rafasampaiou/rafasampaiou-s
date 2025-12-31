import React, { useState, useEffect } from 'react';
import { AppProvider, useApp } from './context';
import { Sidebar } from './components/Sidebar';
import { RequestForm } from './components/RequestForm';
import { Dashboard } from './components/Dashboard';
import { AdminPanel } from './components/AdminPanel';
import { AdminGate } from './components/AdminGate';
import { IdealTable } from './components/IdealTable';
import { PrintableExtract } from './components/PrintableExtract';
import { Indicators } from './components/Indicators';
import { Login } from './components/Login';
import { UserRole } from './types';

const MainContent: React.FC = () => {
  const [currentView, setCurrentView] = useState('dashboard');
  const { user, isAuthenticated, isLoading } = useApp();

  // Route protection: If user is not ADMIN, force them away from admin view
  /*
  // Route protection removed - Admin is now PIN protected
  useEffect(() => {
    if (currentView === 'admin' && user?.role !== UserRole.ADMIN) {
      setCurrentView('dashboard');
    }
  }, [currentView, user]);
  */

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-100">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#155645]"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Login />;
  }

  const renderView = () => {
    switch (currentView) {
      case 'dashboard': return <Dashboard />;
      case 'indicators': return <Indicators />;
      case 'request': return <RequestForm />;
      case 'admin':
        return (
          <AdminGate>
            <AdminPanel />
          </AdminGate>
        );
      case 'ideal': return <IdealTable />;
      case 'extract': return <PrintableExtract />;
      default: return <Dashboard />;
    }
  };

  return (
    <div className="flex h-screen bg-slate-100 font-sans text-slate-900">
      <Sidebar currentView={currentView} setView={setCurrentView} />

      <main className="flex-1 overflow-auto">
        <header className="bg-white shadow-sm px-8 py-4 sticky top-0 z-10 no-print flex justify-between items-center">
          <div className="flex flex-col">
            <h2 className="text-xl font-bold text-slate-800 capitalize">
              {currentView === 'request' ? 'Nova Solicitação' :
                currentView === 'ideal' ? 'Quadro Ideal' :
                  currentView === 'extract' ? 'Impressão' :
                    currentView === 'admin' ? 'Administração' :
                      currentView === 'indicators' ? 'Indicadores' : 'Dashboard'}
            </h2>
            <span className="text-xs text-slate-400">Logado como: {user?.name}</span>
          </div>
          <div className="text-sm text-slate-500">
            {new Date().toLocaleDateString('pt-BR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </div>
        </header>

        <div className={`p-8 ${currentView === 'extract' ? 'print:p-0' : ''}`}>
          {renderView()}
        </div>
      </main>
    </div>
  );
};

const App: React.FC = () => {
  return (
    <AppProvider>
      <MainContent />
    </AppProvider>
  );
};

export default App;