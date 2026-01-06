import React from 'react';
import {
  LayoutDashboard,
  FilePlus2,
  Table2,
  Settings,
  Printer,
  LogOut,
  UserCircle,
  LineChart
} from 'lucide-react';
import { useApp } from '../context';
import { UserRole } from '../types';

interface SidebarProps {
  currentView: string;
  setView: (view: string) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentView, setView }) => {
  const { user, logout } = useApp();

  const menuItems = [
    { id: 'dashboard', label: 'Painéis e Resumos', icon: LayoutDashboard },
    { id: 'indicators', label: 'Indicadores', icon: LineChart },
    { id: 'request', label: 'Solicitar Extra', icon: FilePlus2 },
    { id: 'extract', label: 'Impressão', icon: Printer },
    { id: 'ideal', label: 'Quadro Orçado (CLT)', icon: Table2 },
    { id: 'admin', label: 'Administração', icon: Settings }
  ];

  /* 
  // Old Admin Check Removed - accessible by everyone, protected by PIN
  if (user?.role === UserRole.ADMIN) {
    menuItems.push({ id: 'admin', label: 'Administração', icon: Settings });
  }
  */

  return (
    <div className="w-64 bg-[#155645] text-white h-screen flex flex-col no-print">
      <div className="p-6 border-b border-[#F8981C]/20">
        <h1 className="text-xl font-bold flex items-center gap-2">
          <div className="w-8 h-8 bg-[#F8981C] rounded-lg flex items-center justify-center shrink-0 shadow-md">
            <svg viewBox="0 0 24 24" className="w-5 h-5 text-white" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="5" r="3" />
              <path d="M4 9L8.5 20L12 14L15.5 20L20 9" />
            </svg>
          </div>
          Workforce
        </h1>
        <p className="text-xs text-slate-300 mt-1 pl-10">Gestão de Mão de Obra</p>
      </div>

      <div className="p-4 border-b border-[#F8981C]/20 bg-black/10">
        <div className="flex items-center gap-3">
          <UserCircle className="text-[#F8981C]" size={32} />
          <div className="overflow-hidden">
            <p className="text-sm font-medium truncate">{user?.name}</p>
            <p className="text-xs text-slate-300 truncate">{user?.email}</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 p-4 space-y-2">
        {menuItems.map((item) => (
          <button
            key={item.id}
            onClick={() => setView(item.id)}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${currentView === item.id
              ? 'bg-[#F8981C] text-white shadow-lg'
              : 'text-slate-300 hover:bg-white/10 hover:text-white'
              }`}
          >
            <item.icon size={20} />
            <span className="text-sm font-medium">{item.label}</span>
          </button>
        ))}
      </nav>

      <div className="p-4 border-t border-[#F8981C]/20">
        <button
          onClick={logout}
          className="w-full flex items-center gap-2 px-4 py-2 text-slate-300 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
        >
          <LogOut size={18} />
          <span className="text-sm">Sair do Sistema</span>
        </button>
      </div>
    </div >
  );
};