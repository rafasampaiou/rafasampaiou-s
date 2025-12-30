import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from './supabaseClient';
import { RequestItem, SectorConfig, UserRole, LoteConfig, User, MonthlyBudget, MonthlyLoteConfig, ManualRealStat, Shift, RequestType, OccupancyRecord, SystemConfig, SpecialRole } from './types';
import { MOCK_REQUESTS, INITIAL_SECTORS } from './constants';

interface AppContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, pass: string) => Promise<boolean>;
  logout: () => void;
  setUserRole: (role: UserRole) => void;

  // User Management
  availableUsers: User[];
  addUser: (name: string, email: string, role: UserRole) => void;
  editUser: (id: string, name: string, email: string, role: UserRole) => void;
  removeUser: (id: string) => void;
  switchUser: (id: string) => void;

  requests: RequestItem[];
  addRequest: (req: RequestItem) => void;
  addHistoricalRequests: (text: string) => void;
  updateRequestStatus: (id: string, status: 'Aprovado' | 'Rejeitado' | 'Pendente') => void;
  deleteRequest: (id: string) => void;

  // Sectors
  sectors: SectorConfig[];
  addSector: (name: string, type: 'Operacional' | 'Suporte') => void;
  removeSector: (id: string) => void;

  // Monthly Data
  getMonthlyBudget: (sectorId: string, monthKey: string) => MonthlyBudget;
  updateMonthlyBudget: (data: MonthlyBudget) => void;

  getMonthlyLote: (monthKey: string) => LoteConfig[];
  updateMonthlyLote: (monthKey: string, lotes: LoteConfig[]) => void;

  getManualRealStat: (sectorId: string, monthKey: string) => ManualRealStat | undefined;
  updateManualRealStat: (data: ManualRealStat) => void;

  // Occupancy
  occupancyData: Record<string, number>; // Date "YYYY-MM-DD" -> Count
  saveOccupancyBatch: (data: Record<string, number>) => void;

  // Configs
  systemConfig: SystemConfig;
  updateSystemConfig: (config: SystemConfig) => void;
  specialRoles: SpecialRole[];
  addSpecialRole: (name: string, rate: number) => void;
  removeSpecialRole: (id: string) => void;

  currentDate: Date;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // Mock Users Database with specific admins
  // Mock Users removed, will fetch from DB
  const [availableUsers, setAvailableUsers] = useState<User[]>([]);

  // Auth State
  const [user, setUser] = useState<User | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const [requests, setRequests] = useState<RequestItem[]>(MOCK_REQUESTS.map(r => ({
    ...r,
    totalValue: r.extrasQty * r.daysQty * 8 * (r.specialRate || 15.00)
  })));

  const [sectors, setSectors] = useState<SectorConfig[]>(INITIAL_SECTORS);
  const [currentDate] = useState(new Date());

  // Data Stores
  const [monthlyBudgets, setMonthlyBudgets] = useState<Record<string, MonthlyBudget>>({});
  const [monthlyLotes, setMonthlyLotes] = useState<Record<string, LoteConfig[]>>({});
  const [manualRealStats, setManualRealStats] = useState<Record<string, ManualRealStat>>({});
  const [occupancyData, setOccupancyData] = useState<Record<string, number>>({});

  // System Configs
  const [systemConfig, setSystemConfig] = useState<SystemConfig>({ standardHourRate: 15.00, taxRate: 0 });
  const [specialRoles, setSpecialRoles] = useState<SpecialRole[]>([
    { id: '1', name: 'Bilíngue', rate: 25.00 },
    { id: '2', name: 'Supervisor', rate: 22.00 }
  ]);

  useEffect(() => {
    // Check active session
    const checkSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          // Fetch profile
          const { data: profile } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', session.user.id)
            .single();

          if (profile) {
            const userData: User = {
              id: session.user.id,
              email: session.user.email!,
              name: profile.name || session.user.email!.split('@')[0],
              role: profile.role as UserRole
            };
            setUser(userData);
            setIsAuthenticated(true);
          }
        }
      } catch (error) {
        console.error('Error checking session:', error);
      } finally {
        setIsLoading(false);
      }
    };

    checkSession();
    fetchUsers();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .single();

        if (profile) {
          const userData: User = {
            id: session.user.id,
            email: session.user.email!,
            name: profile.name || session.user.email!.split('@')[0],
            role: profile.role as UserRole
          };
          setUser(userData);
          setIsAuthenticated(true);
        }
      } else {
        setUser(null);
        setIsAuthenticated(false);
      }
      setIsLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchUsers = async () => {
    const { data } = await supabase.from('profiles').select('*');
    if (data) {
      setAvailableUsers(data.map(p => ({
        id: p.id,
        name: p.name || p.email.split('@')[0],
        email: p.email,
        role: p.role as UserRole
      })));
    }
  };

  const login = async (email: string, pass: string): Promise<boolean> => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password: pass,
    });
    return !error;
  };

  const logout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setIsAuthenticated(false);
  };

  const setUserRole = (role: UserRole) => {
    if (user) {
      setUser({ ...user, role });
    }
  };

  // User Management
  const addUser = (name: string, email: string, role: UserRole) => {
    const newUser: User = {
      id: Math.random().toString(36).substr(2, 9),
      name,
      email,
      role
    };
    setAvailableUsers(prev => [...prev, newUser]);
  };

  const editUser = (id: string, name: string, email: string, role: UserRole) => {
    setAvailableUsers(prev => prev.map(u => u.id === id ? { ...u, name, email, role } : u));

    // If the edited user is the one currently "logged in", update the session state immediately
    if (user && user.id === id) {
      setUser(prev => prev ? { ...prev, name, email, role } : null);
    }
  };

  const removeUser = (id: string) => {
    // Prevent removing the current user
    if (user?.id === id) {
      alert("Você não pode remover seu próprio usuário.");
      return;
    }
    setAvailableUsers(prev => prev.filter(u => u.id !== id));
  };

  const switchUser = (id: string) => {
    const target = availableUsers.find(u => u.id === id);
    if (target) {
      setUser(target);
    }
  };

  const addRequest = (req: RequestItem) => {
    const rate = req.specialRate || systemConfig.standardHourRate;
    const baseTotal = req.extrasQty * req.daysQty * 8 * rate;
    setRequests(prev => [{ ...req, totalValue: baseTotal }, ...prev]);
  };

  // Helper to parse date dd/mm/yyyy to yyyy-mm-dd
  const parseDateStr = (dateStr: string) => {
    if (!dateStr) return '';
    const trimmed = dateStr.trim();
    if (trimmed.match(/^\d{4}-\d{2}-\d{2}$/)) return trimmed;

    const parts = trimmed.split('/');
    if (parts.length === 3) {
      const d = parts[0].padStart(2, '0');
      const m = parts[1].padStart(2, '0');
      const y = parts[2];
      if (y.length === 2) return `20${y}-${m}-${d}`;
      return `${y}-${m}-${d}`;
    }
    return '';
  }

  const addHistoricalRequests = (text: string) => {
    const lines = text.trim().split(/\r?\n/);
    const newRequests: RequestItem[] = [];
    let importCount = 0;

    lines.forEach((line, index) => {
      if (!line.trim()) return;
      const cols = line.split('\t');
      if (cols.length >= 8) {
        try {
          const dateEvent = parseDateStr(cols[2]?.trim());
          if (!dateEvent) return;

          const daysQty = parseInt(cols[3]?.trim()) || 1;
          const rawRate = cols[4]?.trim() || '0';
          const cleanRate = rawRate.replace(/[R$\s]/g, '').replace(',', '.');
          const specialRate = parseFloat(cleanRate) || undefined;
          const extrasQty = parseInt(cols[5]?.trim()) || 1;
          const rawOccupancy = cols[11]?.trim() || '0';
          const occupancyRate = parseFloat(rawOccupancy.replace('%', '').replace(',', '.')) || 0;
          const rateToUse = specialRate || 15.00;
          const totalValue = extrasQty * daysQty * 8 * rateToUse;

          newRequests.push({
            id: `hist_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
            sector: cols[0]?.trim(),
            reason: (cols[1]?.trim() || 'Ocupação') as any,
            type: daysQty > 1 ? RequestType.PACOTE : RequestType.DIARIA,
            dateEvent,
            daysQty,
            specialRate,
            extrasQty,
            functionRole: cols[6]?.trim() || 'Extra',
            shift: (cols[7]?.trim() || Shift.MANHA) as Shift,
            timeIn: cols[8]?.trim() || '08:00',
            timeOut: cols[9]?.trim() || '16:00',
            justification: cols[10]?.trim() || 'Importado do Histórico',
            occupancyRate,
            status: 'Aprovado',
            createdAt: new Date().toISOString(),
            totalValue,
            requestorEmail: 'importacao.historica@taua.com.br'
          });
          importCount++;
        } catch (e) {
          console.error(`Error parsing line ${index}`, e);
        }
      }
    });

    if (importCount > 0) {
      setRequests(prev => [...newRequests, ...prev]);
      alert(`${importCount} registros importados com sucesso!`);
    } else {
      alert("Nenhum registro válido encontrado.");
    }
  };

  const saveOccupancyBatch = (data: Record<string, number>) => {
    setOccupancyData(prev => ({ ...prev, ...data }));
  };

  const updateRequestStatus = (id: string, status: 'Aprovado' | 'Rejeitado' | 'Pendente') => {
    setRequests(prev => prev.map(req => req.id === id ? { ...req, status } : req));
  };

  const deleteRequest = (id: string) => {
    setRequests(prev => prev.filter(req => req.id !== id));
  };

  const addSector = (name: string, type: 'Operacional' | 'Suporte') => {
    const newSector: SectorConfig = {
      id: Math.random().toString(36).substr(2, 9),
      name,
      type
    };
    setSectors(prev => [...prev, newSector]);
  };

  const removeSector = (id: string) => {
    setSectors(prev => prev.filter(s => s.id !== id));
  };

  const getMonthlyBudget = (sectorId: string, monthKey: string): MonthlyBudget => {
    const key = `${sectorId}_${monthKey}`;
    return monthlyBudgets[key] || { sectorId, monthKey, budgetQty: 0, budgetValue: 0 };
  };

  const updateMonthlyBudget = (data: MonthlyBudget) => {
    const key = `${data.sectorId}_${data.monthKey}`;
    setMonthlyBudgets(prev => ({ ...prev, [key]: data }));
  };

  const getMonthlyLote = (monthKey: string): LoteConfig[] => {
    return monthlyLotes[monthKey] || [
      { id: 1, name: '1º Lote', startDay: 1, endDay: 10 },
      { id: 2, name: '2º Lote', startDay: 11, endDay: 20 },
      { id: 3, name: '3º Lote', startDay: 21, endDay: 31 },
    ];
  };

  const updateMonthlyLote = (monthKey: string, lotes: LoteConfig[]) => {
    setMonthlyLotes(prev => ({ ...prev, [monthKey]: lotes }));
  };

  const getManualRealStat = (sectorId: string, monthKey: string) => {
    const key = `${sectorId}_${monthKey}`;
    return manualRealStats[key];
  };

  const updateManualRealStat = (data: ManualRealStat) => {
    const key = `${data.sectorId}_${data.monthKey}`;
    setManualRealStats(prev => ({ ...prev, [key]: data }));
  };

  const updateSystemConfig = (config: SystemConfig) => {
    setSystemConfig(config);
  };

  const addSpecialRole = (name: string, rate: number) => {
    const newRole: SpecialRole = {
      id: Math.random().toString(36).substr(2, 9),
      name,
      rate
    };
    setSpecialRoles(prev => [...prev, newRole]);
  };

  const removeSpecialRole = (id: string) => {
    setSpecialRoles(prev => prev.filter(r => r.id !== id));
  };

  return (
    <AppContext.Provider value={{
      user, isAuthenticated, isLoading, login, logout, setUserRole,
      availableUsers, addUser, editUser, removeUser, switchUser,
      requests, addRequest, updateRequestStatus, deleteRequest, addHistoricalRequests,
      sectors, addSector, removeSector,
      getMonthlyBudget, updateMonthlyBudget,
      getMonthlyLote, updateMonthlyLote,
      getManualRealStat, updateManualRealStat,
      occupancyData, saveOccupancyBatch,
      systemConfig, updateSystemConfig,
      specialRoles, addSpecialRole, removeSpecialRole,
      currentDate
    }}>
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};