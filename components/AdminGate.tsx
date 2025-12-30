import React, { useState, useEffect } from 'react';

const ADMIN_PIN = '5868';

interface AdminGateProps {
    children: React.ReactNode;
}

export const AdminGate: React.FC<AdminGateProps> = ({ children }) => {
    const [isUnlocked, setIsUnlocked] = useState(false);
    const [pin, setPin] = useState('');
    const [error, setError] = useState('');

    useEffect(() => {
        // Check session storage to keep unlocked during session refresh
        const stored = sessionStorage.getItem('admin_unlocked');
        if (stored === 'true') {
            setIsUnlocked(true);
        }
    }, []);

    const handleUnlock = (e: React.FormEvent) => {
        e.preventDefault();
        if (pin === ADMIN_PIN) {
            setIsUnlocked(true);
            sessionStorage.setItem('admin_unlocked', 'true');
            setError('');
        } else {
            setError('Senha incorreta. Acesso restrito.');
            setPin('');
        }
    };

    if (isUnlocked) {
        return <>{children}</>;
    }

    return (
        <div className="flex flex-col items-center justify-center min-h-[50vh] p-4">
            <div className="w-full max-w-md bg-white rounded-lg shadow-xl p-8 text-center border-t-4 border-[#155645]">
                <div className="mb-6">
                    <div className="bg-orange-100 p-4 rounded-full w-20 h-20 flex items-center justify-center mx-auto mb-4">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-orange-600" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                    </div>
                    <h2 className="text-2xl font-bold text-gray-800">Área Administrativa</h2>
                    <p className="text-gray-500 mt-2">Digite a senha de acesso para continuar.</p>
                </div>

                <form onSubmit={handleUnlock} className="space-y-4">
                    <input
                        type="password"
                        value={pin}
                        onChange={(e) => setPin(e.target.value)}
                        className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#155645] text-center text-xl tracking-widest"
                        placeholder="Senha (PIN)"
                        autoFocus
                    />

                    {error && <p className="text-red-500 text-sm font-medium">{error}</p>}

                    <button
                        type="submit"
                        className="w-full bg-[#155645] hover:bg-[#104033] text-white font-bold py-3 px-4 rounded-lg transition-colors"
                    >
                        Acessar Painel
                    </button>
                </form>
            </div>
        </div>
    );
};
