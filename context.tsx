import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from './supabaseClient';
import { RequestItem, SectorConfig, UserRole, LoteConfig, User, MonthlyBudget, MonthlyLoteConfig, ManualRealStat, Shift, RequestType, OccupancyRecord, SystemConfig, SpecialRole } from './types';
import { MOCK_REQUESTS, INITIAL_SECTORS } from './constants';

interface AppContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;

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
  bulkUpdateMonthlyBudgets: (budgets: MonthlyBudget[]) => Promise<void>;
  bulkUpdateManualRealStats: (stats: ManualRealStat[]) => Promise<void>;

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
  // Auth State
  const [user, setUser] = useState<User | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Data Stores
  const [requests, setRequests] = useState<RequestItem[]>([]);
  const [sectors, setSectors] = useState<SectorConfig[]>([]);
  const [monthlyBudgets, setMonthlyBudgets] = useState<Record<string, MonthlyBudget>>({});
  const [monthlyLotes, setMonthlyLotes] = useState<Record<string, LoteConfig[]>>({});
  const [manualRealStats, setManualRealStats] = useState<Record<string, ManualRealStat>>({});
  const [occupancyData, setOccupancyData] = useState<Record<string, number>>({});

  // System Configs
  const [systemConfig, setSystemConfig] = useState<SystemConfig>({ standardHourRate: 15.00, taxRate: 0, isFormLocked: false });
  const [specialRoles, setSpecialRoles] = useState<SpecialRole[]>([]);

  const [currentDate] = useState(new Date());

  // --- Data Fetching ---
  const fetchAllData = async () => {
    setIsLoading(true);
    try {
      const { data: secs, error: secErr } = await supabase.from('sectors').select('*').order('name');

      // Seed initial sectors if none exist
      if ((!secs || secs.length === 0) && !secErr) {
        const initialSectors = INITIAL_SECTORS.map(({ name, type }) => ({ name, type }));
        await supabase.from('sectors').insert(initialSectors);
        fetchAllData(); // Recursive call to fetch again after seed
        return;
      }

      const [
        { data: reqs },
        { data: roles },
        { data: config },
        { data: budgets },
        { data: lotes },
        { data: stats },
        { data: occupancy }
      ] = await Promise.all([
        supabase.from('requests').select('*').order('created_at', { ascending: false }),
        supabase.from('special_roles').select('*').order('name'),
        supabase.from('system_config').select('*').single(),
        supabase.from('monthly_budgets').select('*'),
        supabase.from('monthly_lotes').select('*'),
        supabase.from('manual_real_stats').select('*'),
        supabase.from('occupancy_data').select('*')
      ]);

      if (reqs) {
        setRequests(reqs.map((r: any) => ({
          ...r,
          dateEvent: r.date_event,
          daysQty: r.days_qty,
          specialRate: r.special_rate,
          extrasQty: r.extras_qty,
          functionRole: r.function_role,
          createdAt: r.created_at,
          totalValue: r.total_value,
          requestorEmail: r.requestor_email
        })));
      }

      if (secs) setSectors(secs);

      if (roles) {
        setSpecialRoles(roles);
      } else {
        // Seed initial special roles if none
        const initialRoles = [
          { name: 'Bilíngue', rate: 25.00 },
          { name: 'Supervisor', rate: 22.00 }
        ];
        await supabase.from('special_roles').insert(initialRoles);
      }

      if (config) {
        setSystemConfig({
          standardHourRate: Number(config.standard_hour_rate),
          taxRate: Number(config.tax_rate),
          isFormLocked: config.is_form_locked
        });
      }

      if (budgets) {
        const budgetMap: Record<string, MonthlyBudget> = {};
        budgets.forEach((b: any) => {
          budgetMap[`${b.sector_id}_${b.month_key}`] = {
            sectorId: b.sector_id,
            monthKey: b.month_key,
            budgetQty: Number(b.budget_qty) || 0,
            budgetValue: Number(b.budget_value) || 0,
            hourRate: Number(b.hour_rate) || 0,
            workHoursPerDay: Number(b.work_hours_per_day) || 8,
            workingDaysPerMonth: Number(b.working_days_per_month) || 22,
            extraQtyPerDay: Number(b.extra_qty_per_day) || 0,
          };
        });
        setMonthlyBudgets(budgetMap);
      }

      if (lotes) {
        const loteMap: Record<string, LoteConfig[]> = {};
        lotes.forEach((l: any) => {
          if (!loteMap[l.month_key]) loteMap[l.month_key] = [];
          loteMap[l.month_key].push({
            id: l.id,
            name: l.name,
            startDay: l.start_day,
            endDay: l.end_day
          });
        });
        setMonthlyLotes(loteMap);
      }

      if (stats) {
        const statsMap: Record<string, ManualRealStat> = {};
        stats.forEach((s: any) => {
          statsMap[`${s.sector_id}_${s.month_key}`] = {
            sectorId: s.sector_id,
            monthKey: s.month_key,
            realQty: s.real_qty,
            realValue: s.real_value,
            afastadosQty: s.afastados_qty,
            apprenticesQty: s.apprentices_qty,
            wfoQty: s.wfo_qty,
            loteWfo: s.wfo_lotes_json ? JSON.parse(s.wfo_lotes_json) : undefined
          };
        });
        setManualRealStats(statsMap);
      }

      if (occupancy) {
        const occMap: Record<string, number> = {};
        occupancy.forEach((o: any) => {
          occMap[o.date_key] = Number(o.count);
        });
        setOccupancyData(occMap);
      }

    } catch (err) {
      console.error('Error fetching data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    // Initial session check
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        setUser({
          id: session.user.id,
          email: session.user.email!,
          name: session.user.email!.split('@')[0],
          role: UserRole.USER
        });
        setIsAuthenticated(true);
        fetchAllData();
      } else {
        setIsLoading(false);
      }
    };

    checkSession();

    // Auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session) {
        setUser({
          id: session.user.id,
          email: session.user.email!,
          name: session.user.email!.split('@')[0],
          role: UserRole.USER
        });
        setIsAuthenticated(true);
        if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION') fetchAllData();
      } else {
        setUser(null);
        setIsAuthenticated(false);
        setRequests([]);
      }
      setIsLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const login = async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    setIsLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (err: any) {
      return { success: false, error: 'Erro inesperado ao realizar login.' };
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setIsAuthenticated(false);
  };

  const addRequest = async (req: RequestItem) => {
    let baseTotal;
    if (req.specialRate) {
      baseTotal = req.extrasQty * req.daysQty * req.specialRate;
    } else {
      baseTotal = req.extrasQty * req.daysQty * 8 * systemConfig.standardHourRate;
    }

    const { data, error } = await supabase.from('requests').insert([{
      sector: req.sector,
      reason: req.reason,
      type: req.type,
      date_event: req.dateEvent,
      days_qty: req.daysQty,
      special_rate: req.specialRate,
      extras_qty: req.extrasQty,
      function_role: req.functionRole,
      shift: req.shift,
      time_in: req.timeIn,
      time_out: req.timeOut,
      justification: req.justification,
      occupancy_rate: req.occupancyRate,
      status: req.status,
      total_value: baseTotal,
      requestor_email: user?.email || req.requestorEmail
    }]).select();

    if (data && !error) {
      const newReq = {
        ...req,
        id: data[0].id,
        totalValue: baseTotal,
        createdAt: data[0].created_at
      };
      setRequests(prev => [newReq, ...prev]);
    }
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

  const addHistoricalRequests = async (text: string) => {
    const lines = text.trim().split(/\r?\n/);
    const newRequests: any[] = [];
    let importCount = 0;

    lines.forEach((line) => {
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

          let totalValue;
          if (specialRate) {
            totalValue = extrasQty * daysQty * specialRate;
          } else {
            totalValue = extrasQty * daysQty * 8 * 15.00;
          }

          newRequests.push({
            sector: cols[0]?.trim(),
            reason: (cols[1]?.trim() || 'Ocupação') as any,
            type: daysQty > 1 ? RequestType.PACOTE : RequestType.DIARIA,
            date_event: dateEvent,
            days_qty: daysQty,
            special_rate: specialRate,
            extras_qty: extrasQty,
            function_role: cols[6]?.trim() || 'Extra',
            shift: (cols[7]?.trim() || Shift.MANHA) as Shift,
            time_in: cols[8]?.trim() || '08:00',
            time_out: cols[9]?.trim() || '16:00',
            justification: cols[10]?.trim() || 'Importado do Histórico',
            occupancy_rate: occupancyRate,
            status: 'Aprovado',
            total_value: totalValue,
            requestor_email: 'importacao.historica@taua.com.br'
          });
          importCount++;
        } catch (e) {
          console.error(`Error parsing historical line`, e);
        }
      }
    });

    if (newRequests.length > 0) {
      const { error } = await supabase.from('requests').insert(newRequests);
      if (!error) {
        fetchAllData();
        alert(`${importCount} registros importados com sucesso para o banco de dados!`);
      } else {
        alert("Erro ao importar para o banco de dados.");
      }
    } else {
      alert("Nenhum registro válido encontrado.");
    }
  };

  const saveOccupancyBatch = async (data: Record<string, number>) => {
    const batch = Object.entries(data).map(([date_key, count]) => ({ date_key, count }));
    const { error } = await supabase.from('occupancy_data').upsert(batch);
    if (!error) setOccupancyData(prev => ({ ...prev, ...data }));
  };

  const updateRequestStatus = async (id: string, status: 'Aprovado' | 'Rejeitado' | 'Pendente') => {
    const { error } = await supabase.from('requests').update({ status }).eq('id', id);
    if (!error) setRequests(prev => prev.map(req => req.id === id ? { ...req, status } : req));
  };

  const deleteRequest = async (id: string) => {
    const { error } = await supabase.from('requests').delete().eq('id', id);
    if (!error) {
      setRequests(prev => prev.filter(req => req.id !== id));
    } else {
      console.error('Erro ao excluir:', error);
      alert('Falha ao excluir a solicitação: ' + error.message);
    }
  };

  const addSector = async (name: string, type: 'Operacional' | 'Suporte') => {
    const { data, error } = await supabase.from('sectors').insert([{ name, type }]).select();
    if (data && !error) setSectors(prev => [...prev, data[0]]);
  };

  const removeSector = async (id: string) => {
    const { error } = await supabase.from('sectors').delete().eq('id', id);
    if (!error) setSectors(prev => prev.filter(s => s.id !== id));
  };

  const getMonthlyBudget = (sectorId: string, monthKey: string): MonthlyBudget => {
    const key = `${sectorId}_${monthKey}`;
    return monthlyBudgets[key] || {
      sectorId,
      monthKey,
      budgetQty: 0,
      budgetValue: 0,
      hourRate: 0,
      workHoursPerDay: 8,
      workingDaysPerMonth: 22,
      extraQtyPerDay: 0
    };
  };

  const updateMonthlyBudget = async (data: MonthlyBudget) => {
    const { error } = await supabase.from('monthly_budgets').upsert({
      sector_id: data.sectorId,
      month_key: data.monthKey,
      budget_qty: data.budgetQty,
      budget_value: data.budgetValue,
      hour_rate: data.hourRate,
      work_hours_per_day: data.workHoursPerDay,
      working_days_per_month: data.workingDaysPerMonth,
      extra_qty_per_day: data.extraQtyPerDay
    }, { onConflict: 'sector_id, month_key' });
    if (!error) {
      const key = `${data.sectorId}_${data.monthKey}`;
      setMonthlyBudgets(prev => ({ ...prev, [key]: data }));
    } else {
      console.error('[updateMonthlyBudget] Error:', error);
      alert('Erro ao salvar orçamento: ' + error.message);
    }
  };

  const getMonthlyLote = (monthKey: string): LoteConfig[] => {
    return monthlyLotes[monthKey] || [
      { id: Date.now(), name: '1º Lote', startDay: 1, endDay: 10 },
      { id: Date.now() + 1, name: '2º Lote', startDay: 11, endDay: 20 },
      { id: Date.now() + 2, name: '3º Lote', startDay: 21, endDay: 31 },
    ];
  };

  const updateMonthlyLote = async (monthKey: string, lotes: LoteConfig[]) => {
    // Primeiro limpamos os lotes existentes para o mês para evitar duplicatas
    await supabase.from('monthly_lotes').delete().eq('month_key', monthKey);

    const { error } = await supabase.from('monthly_lotes').insert(
      lotes.map(l => ({ month_key: monthKey, name: l.name, start_day: l.startDay, end_day: l.endDay }))
    );
    if (!error) {
      setMonthlyLotes(prev => ({ ...prev, [monthKey]: lotes }));
    }
  };

  const getManualRealStat = (sectorId: string, monthKey: string) => {
    const key = `${sectorId}_${monthKey}`;
    return manualRealStats[key];
  };

  const updateManualRealStat = async (data: ManualRealStat) => {
    const key = `${data.sectorId}_${data.monthKey}`;
    // Optimistic update
    setManualRealStats(prev => ({ ...prev, [key]: data }));

    const { error } = await supabase.from('manual_real_stats').upsert({
      sector_id: data.sectorId,
      month_key: data.monthKey,
      real_qty: data.realQty,
      real_value: data.realValue
      // afastados_qty: data.afastadosQty,
      // apprentices_qty: data.apprenticesQty,
      // wfo_qty: data.wfoQty
      // wfo_lotes_json: data.loteWfo ? JSON.stringify(data.loteWfo) : null
    }, { onConflict: 'sector_id, month_key' });

    if (error) {
      console.error('[updateManualRealStats] Error:', error);
      alert('Erro ao salvar dados reais: ' + error.message);
    }
  };

  const bulkUpdateMonthlyBudgets = async (budgets: MonthlyBudget[]) => {
    console.log(`[bulkUpdateMonthlyBudgets] Attempting to upsert ${budgets.length} records...`);
    const { data, error } = await supabase.from('monthly_budgets').upsert(
      budgets.map(b => ({
        sector_id: b.sectorId,
        month_key: b.monthKey,
        budget_qty: b.budgetQty,
        budget_value: b.budgetValue,
        hour_rate: b.hourRate,
        work_hours_per_day: b.workHoursPerDay,
        working_days_per_month: b.workingDaysPerMonth,
        extra_qty_per_day: b.extraQtyPerDay
      })), { onConflict: 'sector_id, month_key' }
    ).select();

    if (!error) {
      console.log('[bulkUpdateMonthlyBudgets] Success!', data);
      setMonthlyBudgets(prev => {
        const newMap = { ...prev };
        budgets.forEach(b => {
          newMap[`${b.sectorId}_${b.monthKey}`] = b;
        });
        return newMap;
      });
    } else {
      console.error('[bulkUpdateMonthlyBudgets] Error:', error);
      alert(`Erro ao sincronizar orçamentos: ${error.message} (${error.code})`);
      throw error;
    }
  };

  const bulkUpdateManualRealStats = async (stats: ManualRealStat[]) => {
    console.log(`[bulkUpdateManualRealStats] Attempting to upsert ${stats.length} records...`);
    const { data, error } = await supabase.from('manual_real_stats').upsert(
      stats.map(s => ({
        sector_id: s.sectorId,
        month_key: s.monthKey,
        real_qty: s.realQty,
        real_value: s.realValue
        // afastados_qty: s.afastadosQty,
        // apprentices_qty: s.apprenticesQty,
        // wfo_qty: s.wfoQty
        // wfo_lotes_json: s.loteWfo ? JSON.stringify(s.loteWfo) : null
      })), { onConflict: 'sector_id, month_key' }
    ).select();

    if (!error) {
      console.log('[bulkUpdateManualRealStats] Success!', data);
      setManualRealStats(prev => {
        const newMap = { ...prev };
        stats.forEach(s => {
          newMap[`${s.sectorId}_${s.monthKey}`] = s;
        });
        return newMap;
      });
    } else {
      console.error('[bulkUpdateManualRealStats] Error:', error);
      alert(`Erro ao sincronizar stats REAIS: ${error.message} (${error.code})`);
      throw error;
    }
  };

  const updateSystemConfig = async (config: SystemConfig) => {
    const { error } = await supabase.from('system_config').update({
      standard_hour_rate: config.standardHourRate,
      tax_rate: config.taxRate,
      is_form_locked: config.isFormLocked
    }).eq('id', 1);
    if (!error) setSystemConfig(config);
  };

  const addSpecialRole = async (name: string, rate: number) => {
    const { data, error } = await supabase.from('special_roles').insert([{ name, rate }]).select();
    if (data && !error) setSpecialRoles(prev => [...prev, data[0]]);
  };

  const removeSpecialRole = async (id: string) => {
    const { error } = await supabase.from('special_roles').delete().eq('id', id);
    if (!error) setSpecialRoles(prev => prev.filter(r => r.id !== id));
  };


  return (
    <AppContext.Provider value={{
      user, isAuthenticated, isLoading, login, logout,
      requests, addRequest, updateRequestStatus, deleteRequest, addHistoricalRequests,
      sectors, addSector, removeSector,
      getMonthlyBudget, updateMonthlyBudget,
      getMonthlyLote, updateMonthlyLote,
      getManualRealStat, updateManualRealStat,
      bulkUpdateMonthlyBudgets, bulkUpdateManualRealStats,
      occupancyData, saveOccupancyBatch,
      systemConfig, updateSystemConfig,
      specialRoles, addSpecialRole, removeSpecialRole,
      currentDate,
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