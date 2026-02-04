import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from './supabaseClient';
import { createClient } from '@supabase/supabase-js';
import { RequestItem, SectorConfig, UserRole, LoteConfig, User, UserProfile, MonthlyBudget, MonthlyLoteConfig, ManualRealStat, Shift, RequestType, OccupancyRecord, SystemConfig, SpecialRole, MonthlyAppConfig } from './types';
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
  updateRequest: (id: string, updates: Partial<RequestItem>) => Promise<void>;
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
  occupancyData: Record<string, { total: number, lazer: number, eventos: number }>; // Date "YYYY-MM-DD" -> Values
  saveOccupancyBatch: (data: Record<string, { total: number, lazer: number, eventos: number }>) => void;

  // Configs
  systemConfig: SystemConfig;
  updateSystemConfig: (config: SystemConfig) => void;
  // Monthly Configs
  getMonthlyAppConfig: (monthKey: string) => MonthlyAppConfig;
  updateMonthlyAppConfig: (config: MonthlyAppConfig) => void;
  calculateRequestTotal: (req: Partial<RequestItem>) => number;
  specialRoles: SpecialRole[];
  addSpecialRole: (name: string, rate: number) => void;
  removeSpecialRole: (id: string) => void;

  // User Management
  profiles: UserProfile[];
  fetchProfiles: () => Promise<void>;
  createSystemUser: (data: { email: string, password: string, name: string, role: string }) => Promise<{ success: boolean; error?: string }>;
  updateSystemUser: (id: string, data: Partial<UserProfile>) => Promise<{ success: boolean; error?: string }>;
  deleteSystemUser: (id: string) => Promise<{ success: boolean; error?: string }>;

  manualRealStats: Record<string, ManualRealStat>;
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
  const [occupancyData, setOccupancyData] = useState<Record<string, { total: number, lazer: number, eventos: number }>>({});

  // System Configs
  const [systemConfig, setSystemConfig] = useState<SystemConfig>({ standardHourRate: 15.00, taxRate: 0, isFormLocked: false });
  const [monthlyAppConfigs, setMonthlyAppConfigs] = useState<Record<string, MonthlyAppConfig>>({});
  const [specialRoles, setSpecialRoles] = useState<SpecialRole[]>([]);
  const [profiles, setProfiles] = useState<UserProfile[]>([]);

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

      const fetchResults = await Promise.all([
        supabase.from('requests').select('*').order('created_at', { ascending: false }),
        supabase.from('special_roles').select('*').order('name'),
        supabase.from('system_config').select('*').single(),
        supabase.from('monthly_budgets').select('*'),
        supabase.from('monthly_lotes').select('*'),
        supabase.from('manual_real_stats').select('*'),
        supabase.from('occupancy_data').select('*'),
        supabase.from('monthly_app_configs').select('*')
      ]);

      const [
        { data: reqs, error: reqErr },
        { data: roles, error: roleErr },
        { data: config, error: configErr },
        { data: budgets, error: budgetErr },
        { data: lotes, error: loteErr },
        { data: stats, error: statErr },
        { data: occupancy, error: occErr },
        { data: mAppConfigs, error: mAppErr }
      ] = fetchResults;

      if (statErr) console.error('[fetchAllData] Error fetching manual_real_stats:', statErr);

      if (reqs) {
        setRequests(reqs.map((r: any) => ({
          ...r,
          dateEvent: r.date_event,
          daysQty: r.days_qty,
          specialRate: r.special_rate,
          extrasQty: r.extras_qty,
          functionRole: r.function_role,
          timeIn: r.time_in,
          timeOut: r.time_out,
          justification: r.justification,
          status: r.status,
          occupancyRate: r.occupancy_rate,
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
            cltBudgetQty: Number(b.clt_budget_qty) || 0,
            cltBudgetValue: Number(b.clt_budget_value) || 0,
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
          const key = `${s.sector_id}_${s.month_key}`;
          statsMap[key] = {
            sectorId: s.sector_id,
            monthKey: s.month_key,
            realQty: s.real_qty,
            realValue: s.real_value,
            afastadosQty: s.afastados_qty,
            apprenticesQty: s.apprentices_qty,
            wfoQty: s.wfo_qty,
            loteWfo: s.wfo_lotes_json
              ? (typeof s.wfo_lotes_json === 'string' ? JSON.parse(s.wfo_lotes_json) : s.wfo_lotes_json)
              : undefined,
            loteWfoQty: s.wfo_qty_lotes_json
              ? (typeof s.wfo_qty_lotes_json === 'string' ? JSON.parse(s.wfo_qty_lotes_json) : s.wfo_qty_lotes_json)
              : undefined,
            loteWfoValue: s.wfo_value_lotes_json
              ? (typeof s.wfo_value_lotes_json === 'string' ? JSON.parse(s.wfo_value_lotes_json) : s.wfo_value_lotes_json)
              : undefined
          };
        });
        setManualRealStats(statsMap);
      }

      if (occupancy) {
        const occMap: Record<string, { total: number, lazer: number, eventos: number }> = {};
        occupancy.forEach((o: any) => {
          occMap[o.date_key] = {
            total: Number(o.count || 0),
            lazer: Number(o.lazer || 0),
            eventos: Number(o.eventos || 0)
          };
        });
        setOccupancyData(occMap as any);
      }

      if (mAppConfigs) {
        const configMap: Record<string, MonthlyAppConfig> = {};
        mAppConfigs.forEach((c: any) => {
          configMap[c.month_key] = {
            monthKey: c.month_key,
            standardHourRate: Number(c.standard_hour_rate),
            taxRate: Number(c.tax_rate),
            moTarget: Number(c.mo_target || 0),
            moTargetExtra: Number(c.mo_target_extra || 0),
            moTargetClt: Number(c.mo_target_clt || 0),
            moTargetTotal: Number(c.mo_target_total || 0)
          };
        });
        setMonthlyAppConfigs(configMap);
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
    const baseTotal = calculateRequestTotal(req);

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
          const config = getMonthlyAppConfig(dateEvent.substring(0, 7));
          if (specialRate) {
            totalValue = extrasQty * daysQty * specialRate;
          } else {
            totalValue = extrasQty * daysQty * 8 * config.standardHourRate;
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

  const saveOccupancyBatch = async (data: Record<string, { total: number, lazer: number, eventos: number }>) => {
    const batch = Object.entries(data).map(([date_key, vals]) => ({
      date_key,
      count: vals.total,
      lazer: vals.lazer,
      eventos: vals.eventos
    }));
    const { error } = await supabase.from('occupancy_data').upsert(batch);
    if (!error) setOccupancyData(prev => ({ ...prev, ...data }));
  };

  const updateRequestStatus = async (id: string, status: 'Aprovado' | 'Rejeitado' | 'Pendente') => {
    try {
      const { error } = await supabase.from('requests').update({ status }).eq('id', id);
      if (!error) {
        setRequests(prev => prev.map(req => req.id === id ? { ...req, status } : req));
        alert(`Solicitação ${status === 'Aprovado' ? 'aprovada' : status === 'Rejeitado' ? 'rejeitada' : 'movida para pendente'} com sucesso!`);
      } else {
        console.error('[updateRequestStatus] Error:', error);
        alert('Erro ao atualizar status: ' + error.message);
      }
    } catch (err: any) {
      console.error('[updateRequestStatus] Exception:', err);
      alert('Erro inesperado ao atualizar status: ' + err.message);
    }
  };

  const updateRequest = async (id: string, updates: Partial<RequestItem>) => {
    // Map camelCase to snake_case for Supabase
    const payload: any = {};
    if (updates.sector !== undefined) payload.sector = updates.sector;
    if (updates.reason !== undefined) payload.reason = updates.reason;
    if (updates.type !== undefined) payload.type = updates.type;
    if (updates.dateEvent !== undefined) payload.date_event = updates.dateEvent;
    if (updates.daysQty !== undefined) payload.days_qty = updates.daysQty;
    if (updates.specialRate !== undefined) payload.special_rate = updates.specialRate;
    if (updates.extrasQty !== undefined) payload.extras_qty = updates.extrasQty;
    if (updates.functionRole !== undefined) payload.function_role = updates.functionRole;
    if (updates.shift !== undefined) payload.shift = updates.shift;
    if (updates.timeIn !== undefined) payload.time_in = updates.timeIn;
    if (updates.timeOut !== undefined) payload.time_out = updates.timeOut;
    if (updates.justification !== undefined) payload.justification = updates.justification;
    if (updates.occupancyRate !== undefined) payload.occupancy_rate = updates.occupancyRate;
    if (updates.status !== undefined) payload.status = updates.status;

    // Recalculate total value if relevant fields changed
    if (updates.dateEvent || updates.extrasQty || updates.daysQty || updates.specialRate !== undefined) {
      const fullReq = requests.find(r => r.id === id);
      if (fullReq) {
        payload.total_value = calculateRequestTotal({ ...fullReq, ...updates });
      }
    }

    const { error } = await supabase.from('requests').update(payload).eq('id', id);
    if (!error) {
      setRequests(prev => prev.map(req => req.id === id ? { ...req, ...updates, totalValue: payload.total_value ?? req.totalValue } : req));
      alert('Solicitação atualizada com sucesso!');
    } else {
      console.error('[updateRequest] Error:', error);
      alert('Erro ao atualizar solicitação: ' + error.message);
    }
  };

  const deleteRequest = async (id: string) => {
    console.log('[deleteRequest] Attempting to delete request ID:', id, 'Type:', typeof id);
    try {
      const { data, error, status } = await supabase
        .from('requests')
        .delete()
        .eq('id', id)
        .select();

      if (error) {
        console.error('[deleteRequest] Supabase error:', error);
        alert('Falha ao excluir a solicitação: ' + error.message);
        return;
      }

      console.log('[deleteRequest] Response Status:', status, 'Deleted Data:', data);

      if (data && data.length > 0) {
        setRequests(prev => prev.filter(req => req.id !== id));
        alert('Solicitação excluída com sucesso!');
      } else {
        console.warn('[deleteRequest] No rows were deleted. Checking if ID exists...');
        // Fallback: check if we have it in state, if so, maybe it's already gone or RLS issue
        const existsLocally = requests.some(r => r.id === id);
        if (existsLocally) {
          alert('Aviso: O registro não pôde ser excluído do banco de dados (verifique permissões), mas será removido da sua tela temporariamente.');
          setRequests(prev => prev.filter(req => req.id !== id));
        } else {
          alert('Solicitação não encontrada no banco de dados.');
        }
      }

    } catch (err: any) {
      console.error('[deleteRequest] Exception:', err);
      alert('Erro inesperado ao excluir: ' + err.message);
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
      extraQtyPerDay: 0,
      cltBudgetQty: 0,
      cltBudgetValue: 0
    };
  };

  const updateMonthlyBudget = async (data: MonthlyBudget) => {
    // Optimistic Update: Update local state immediately
    const key = `${data.sectorId}_${data.monthKey}`;
    setMonthlyBudgets(prev => ({ ...prev, [key]: data }));

    const { error } = await supabase.from('monthly_budgets').upsert({
      sector_id: data.sectorId,
      month_key: data.monthKey,
      budget_qty: data.budgetQty || 0,
      budget_value: data.budgetValue || 0,
      hour_rate: data.hourRate || 0,
      work_hours_per_day: data.workHoursPerDay || 8,
      working_days_per_month: data.workingDaysPerMonth || 22,
      extra_qty_per_day: data.extraQtyPerDay || 0,
      clt_budget_qty: data.cltBudgetQty || 0,
      clt_budget_value: data.cltBudgetValue || 0
    }, { onConflict: 'sector_id, month_key' });

    if (error) {
      console.error('[updateMonthlyBudget] Error:', error);
      // Revert if needed, or just alert. Since it's an admin tool, alert is acceptable.
      alert('Erro ao salvar orçamento no banco de dados: ' + error.message);
    }
  };

  const getMonthlyLote = (monthKey: string): LoteConfig[] => {
    return monthlyLotes[monthKey] || [
      { id: 1, name: '1º Lote', startDay: 1, endDay: 10 },
      { id: 2, name: '2º Lote', startDay: 11, endDay: 20 },
      { id: 3, name: '3º Lote', startDay: 21, endDay: 31 },
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

    console.log('[updateManualRealStat] Saving:', data);

    const payload: any = {
      sector_id: data.sectorId,
      month_key: data.monthKey,
      real_qty: data.realQty ?? 0,
      real_value: data.realValue ?? 0,
      afastados_qty: data.afastadosQty ?? 0,
      apprentices_qty: data.apprenticesQty ?? 0,
      wfo_qty: data.wfoQty ?? 0,
    };

    if (data.loteWfo !== undefined) payload.wfo_lotes_json = data.loteWfo;
    if (data.loteWfoQty !== undefined) payload.wfo_qty_lotes_json = data.loteWfoQty;
    if (data.loteWfoValue !== undefined) payload.wfo_value_lotes_json = data.loteWfoValue;

    const { error } = await supabase.from('manual_real_stats').upsert(payload, { onConflict: 'sector_id, month_key' }).select();

    if (error) {
      console.error('[updateManualRealStat] Supabase Error:', error);
      alert('Erro ao salvar no banco: ' + error.message + ' (' + error.code + ')');
    } else {
      console.log('[updateManualRealStat] Save successful!');
    }
  };

  const bulkUpdateMonthlyBudgets = async (budgets: MonthlyBudget[]) => {
    console.log(`[bulkUpdateMonthlyBudgets] Attempting to upsert ${budgets.length} records...`);
    const { data, error } = await supabase.from('monthly_budgets').upsert(
      budgets.map(b => ({
        sector_id: b.sectorId,
        month_key: b.monthKey,
        budget_qty: b.budgetQty || 0,
        budget_value: b.budgetValue || 0,
        hour_rate: b.hourRate || 0,
        work_hours_per_day: b.workHoursPerDay || 8,
        working_days_per_month: b.workingDaysPerMonth || 22,
        extra_qty_per_day: b.extraQtyPerDay || 0,
        clt_budget_qty: b.cltBudgetQty || 0,
        clt_budget_value: b.cltBudgetValue || 0
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
        real_value: s.realValue,
        afastados_qty: s.afastadosQty,
        apprentices_qty: s.apprenticesQty,
        wfo_qty: s.wfoQty,
        wfo_lotes_json: s.loteWfo || null
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

  const getMonthlyAppConfig = (monthKey: string): MonthlyAppConfig => {
    return monthlyAppConfigs[monthKey] || {
      monthKey,
      standardHourRate: systemConfig.standardHourRate, // Fallback to global
      taxRate: systemConfig.taxRate, // Fallback to global
      moTarget: 0,
      moTargetExtra: 0,
      moTargetClt: 0,
      moTargetTotal: 0
    };
  };

  const calculateRequestTotal = (req: Partial<RequestItem>) => {
    if (!req.dateEvent) return 0;
    const reqMonth = req.dateEvent.substring(0, 7);
    const config = getMonthlyAppConfig(reqMonth);
    const extrasQty = req.extrasQty || 0;
    const daysQty = req.daysQty || 0;

    if (req.specialRate) {
      return extrasQty * daysQty * req.specialRate;
    } else {
      return extrasQty * daysQty * 8 * config.standardHourRate;
    }
  };



  const updateMonthlyAppConfig = async (config: MonthlyAppConfig) => {
    const { error } = await supabase.from('monthly_app_configs').upsert({
      month_key: config.monthKey,
      standard_hour_rate: config.standardHourRate,
      tax_rate: config.taxRate,
      mo_target: config.moTarget,
      mo_target_extra: config.moTargetExtra || 0,
      mo_target_clt: config.moTargetClt || 0,
      mo_target_total: config.moTargetTotal || 0
    });

    if (!error) {
      setMonthlyAppConfigs(prev => ({ ...prev, [config.monthKey]: config }));
    } else {
      console.error('Error updating monthly config:', error);
      alert('Erro ao salvar configuração mensal: ' + error.message);
    }
  };

  const addSpecialRole = async (name: string, rate: number) => {
    const { data, error } = await supabase.from('special_roles').insert([{ name, rate }]).select();
    if (data && !error) setSpecialRoles(prev => [...prev, data[0]]);
  };

  const removeSpecialRole = async (id: string) => {
    const { error } = await supabase.from('special_roles').delete().eq('id', id);
    if (!error) setSpecialRoles(prev => prev.filter(r => r.id !== id));
  };

  // --- User Management Logic ---
  const fetchProfiles = async () => {
    const { data, error } = await supabase.from('profiles').select('*').order('name');
    if (data && !error) {
      // @ts-ignore
      setProfiles(data);
    } else {
      console.error('Error fetching profiles:', error);
    }
  };

  const createSystemUser = async (data: { email: string, password: string, name: string, role: string }) => {
    try {
      // 1. Create Ghost Client (In-Memory)
      // @ts-ignore
      const tempSupabase = createClient(
        import.meta.env.VITE_SUPABASE_URL,
        import.meta.env.VITE_SUPABASE_ANON_KEY,
        { auth: { persistSession: false } }
      );

      // 2. Sign Up User
      const { data: authData, error: authError } = await tempSupabase.auth.signUp({
        email: data.email,
        password: data.password,
        options: {
          data: {
            name: data.name,
            role: data.role
          }
        }
      });

      if (authError) return { success: false, error: authError.message };
      if (!authData.user) return { success: false, error: 'User creation failed (no user returned)' };

      // 3. Create or Update Profile (using Admin client)
      // Even if trigger exists, upsert ensures we set the right values
      const { error: profileError } = await supabase.from('profiles').upsert({
        id: authData.user.id,
        email: data.email,
        name: data.name,
        role: data.role
      });

      if (profileError) {
        console.error('Profile creation error:', profileError);
      }

      await fetchProfiles();
      return { success: true };

    } catch (e: any) {
      console.error('Create user exception:', e);
      return { success: false, error: e.message };
    }
  };

  const updateSystemUser = async (id: string, updates: Partial<UserProfile>) => {
    const { error } = await supabase.from('profiles').update(updates).eq('id', id);
    if (error) return { success: false, error: error.message };
    await fetchProfiles();
    return { success: true };
  };

  const deleteSystemUser = async (id: string) => {
    const { error } = await supabase.from('profiles').delete().eq('id', id);
    if (error) return { success: false, error: error.message };
    setProfiles(prev => prev.filter(p => p.id !== id));
    return { success: true };
  };

  // Initial Fetch of Profiles when admin logs in (or simplistic effect)
  useEffect(() => {
    if (isAuthenticated && user?.role === UserRole.ADMIN) {
      fetchProfiles();
    }
  }, [isAuthenticated, user]);


  return (
    <AppContext.Provider value={{
      user, isAuthenticated, isLoading, login, logout,
      requests, addRequest, updateRequestStatus, updateRequest, deleteRequest, addHistoricalRequests,
      sectors, addSector, removeSector,
      getMonthlyBudget, updateMonthlyBudget,
      getMonthlyLote, updateMonthlyLote,
      getManualRealStat, updateManualRealStat,
      manualRealStats,
      bulkUpdateMonthlyBudgets, bulkUpdateManualRealStats,
      occupancyData, saveOccupancyBatch,
      systemConfig, updateSystemConfig, getMonthlyAppConfig, updateMonthlyAppConfig,
      calculateRequestTotal,
      specialRoles, addSpecialRole, removeSpecialRole,

      // User Management
      profiles, fetchProfiles, createSystemUser, updateSystemUser, deleteSystemUser,

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