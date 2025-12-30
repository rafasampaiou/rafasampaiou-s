import React, { useState } from 'react';
import { useApp } from '../context';
import { MASTER_PASSWORD } from '../constants';
import { UserRole } from '../types';
import { Lock } from 'lucide-react';

interface AdminLoginProps {
  onClose: () => void;
}

export const AdminLogin: React.FC<AdminLoginProps> = ({ onClose }) => {
  const { setUserRole } = useApp();
  const [password, setPassword] = useState('');
  const [error, setError] = useState(false);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === MASTER_PASSWORD) {
      setUserRole(UserRole.ADMIN);
      onClose();
    } else {
      setError(true);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-sm">
        <div className="flex flex-col items-center mb-4">
          <div className="bg-red-100 p-3 rounded-full text-red-600 mb-2">
            <Lock size={24} />
          </div>
          <h2 className="text-lg font-bold">Acesso Administrativo</h2>
          <p className="text-sm text-slate-500">Digite a senha para continuar.</p>
        </div>

        <form onSubmit={handleLogin}>
          <input
            type="password"
            autoFocus
            className={`w-full text-center text-2xl tracking-widest border rounded-lg p-3 mb-4 outline-none focus:ring-2 ${error ? 'border-red-500 ring-red-200' : 'border-slate-300 ring-blue-200'}`}
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              setError(false);
            }}
            placeholder="••••"
          />
          {error && <p className="text-red-500 text-xs text-center mb-4">Senha incorreta. Tente novamente.</p>}
          
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-slate-300 rounded-lg text-slate-600 hover:bg-slate-50 font-medium"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium"
            >
              Entrar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};