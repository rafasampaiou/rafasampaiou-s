import React, { useState } from 'react';
import { useApp } from '../context';
import { User, Lock } from 'lucide-react';

export const Login: React.FC = () => {
  const { login, isLoading } = useApp();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading) return;

    if (!email.toLowerCase().endsWith('@taua.com.br')) {
      setError('Apenas e-mails @taua.com.br são permitidos.');
      return;
    }

    setError('');

    try {
      const result = await login(email, password);

      if (!result.success) {
        setError(result.error || 'E-mail ou senha incorretos.');
      }
    } catch (err: any) {
      setError('Erro ao realizar login.');
    }
  };

  return (
    <div className="min-h-screen bg-[#155645] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="bg-[#155645] p-8 text-center border-b-4 border-[#F8981C]">
          <div className="w-16 h-16 bg-[#F8981C] rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
            <svg viewBox="0 0 24 24" className="w-10 h-10 text-white" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="5" r="3" />
              <path d="M4 9L8.5 20L12 14L15.5 20L20 9" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-white">Workforce</h1>
          <p className="text-slate-200 text-sm mt-2">Sistema de Controle de Mão de Obra</p>
        </div>

        <div className="p-8">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">E-mail Corporativo</label>
              <div className="relative">
                <User className="absolute left-3 top-3 text-slate-400" size={20} />
                <input
                  type="email"
                  required
                  placeholder="usuario@taua.com.br"
                  className="w-full pl-10 pr-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#155645] focus:border-[#155645] outline-none transition-all"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Senha</label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 text-slate-400" size={20} />
                <input
                  type="password"
                  required
                  placeholder="Sua senha"
                  className="w-full pl-10 pr-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#155645] focus:border-[#155645] outline-none transition-all"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            </div>

            {error && (
              <div className="p-3 bg-red-50 text-red-600 text-sm rounded-lg border border-red-100 flex items-center justify-center text-center">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className={`w-full bg-[#155645] text-white font-semibold py-3 px-4 rounded-lg hover:bg-[#104033] transition-colors shadow-lg border-b-4 border-[#0e3a2f] active:border-b-0 active:translate-y-1 ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              {isLoading ? 'Entrando...' : 'Entrar no Sistema'}
            </button>
          </form>

          <div className="mt-6 text-center text-xs text-slate-400">
            &copy; {new Date().getFullYear()} Grupo Tauá. Todos os direitos reservados.
          </div>
        </div>
      </div>
    </div>
  );
};