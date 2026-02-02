import React, { useState, useEffect } from 'react';
import { useApp } from '../context';
import { Settings, Edit3, Database, Download, Plus, Trash2, Save, Sliders, Briefcase, Building2, Lock, Unlock, Users, Key } from 'lucide-react';
import { MonthlyBudget, LoteConfig, UserRole } from '../types';

export const AdminPanel: React.FC = () => {
  const {
    sectors, addSector, removeSector,
    getMonthlyBudget, updateMonthlyBudget,
    getMonthlyLote, updateMonthlyLote,
    saveOccupancyBatch, occupancyData, requests,
    systemConfig, updateSystemConfig, getMonthlyAppConfig, updateMonthlyAppConfig,
    specialRoles, addSpecialRole, removeSpecialRole,
    profiles, fetchProfiles, createSystemUser, updateSystemUser, deleteSystemUser
  } = useApp();

  const [activeTab, setActiveTab] = useState('sectors');
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM

  // Occupancy State
  const [occupancyYear, setOccupancyYear] = useState(new Date().getFullYear());
  const [gridData, setGridData] = useState<Record<string, { lazer: string, eventos: string, total: string }>>({});

  // New Inputs State
  const [newRoleName, setNewRoleName] = useState('');
  const [newRoleRate, setNewRoleRate] = useState('');
  const [newSectorName, setNewSectorName] = useState('');
  const [newSectorType, setNewSectorType] = useState<'Operacional' | 'Suporte'>('Operacional');

  // User Management State
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [newUserName, setNewUserName] = useState('');
  const [newUserRole, setNewUserRole] = useState<UserRole>(UserRole.USER);
  const [isCreatingUser, setIsCreatingUser] = useState(false);
  const [userMsg, setUserMsg] = useState('');

  // Fetch profiles when tab is active
  useEffect(() => {
    if (activeTab === 'users' && fetchProfiles) {
      fetchProfiles();
    }
  }, [activeTab]);

  useEffect(() => {
    const newGridData: Record<string, { lazer: string, eventos: string, total: string }> = {};
    Object.entries(occupancyData).forEach(([dateStr, val]) => {
      // @ts-ignore
      newGridData[dateStr] = {
        lazer: (val as any).lazer?.toString() || '',
        eventos: (val as any).eventos?.toString() || '',
        total: (val as any).total?.toString() || ''
      };
    });
    setGridData(newGridData);
  }, [occupancyData]);

  const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  const days = Array.from({ length: 31 }, (_, i) => i + 1);
  const years = Array.from({ length: 11 }, (_, i) => 2025 + i);

  const isValidDate = (y: number, m: number, d: number) => {
    const date = new Date(y, m, d);
    return date.getMonth() === m && date.getDate() === d;
  };

  const handleBudgetChange = (sectorId: string, field: keyof MonthlyBudget, value: string) => {
    const current = getMonthlyBudget(sectorId, selectedMonth);
    const numVal = parseFloat(value) || 0;
    const updated = { ...current, [field]: numVal };

    // Auto-calculate extras
    if (field === 'budgetValue' || field === 'hourRate' || field === 'workHoursPerDay' || field === 'workingDaysPerMonth') {
      const v = updated.budgetValue;
      const r = updated.hourRate;
      const h = updated.workHoursPerDay || 8;
      const d = updated.workingDaysPerMonth || 22;

      if (r > 0 && h > 0) {
        updated.budgetQty = Math.round(v / r / h);
        if (d > 0) {
          updated.extraQtyPerDay = Number((v / r / h / d).toFixed(2));
        }
      }
    }

    updateMonthlyBudget(updated);
  };

  const handleBudgetPaste = (e: React.ClipboardEvent<HTMLInputElement>, startSectorIdx: number) => {
    e.preventDefault();
    const clipboardData = e.clipboardData.getData('text');
    if (!clipboardData) return;

    const rows = clipboardData.split(/\r?\n/).filter(r => r.trim());
    rows.forEach((rowStr, rowIndex) => {
      const targetSectorIdx = startSectorIdx + rowIndex;
      if (targetSectorIdx >= sectors.length) return;

      const sector = sectors[targetSectorIdx];
      const cols = rowStr.split('\t');
      const current = getMonthlyBudget(sector.id, selectedMonth);
      const updated = { ...current };

      // Map columns: Valor Orçado | Valor Hora | Horas Trabalho | Dias Trabalhados
      if (cols[0]) updated.budgetValue = parseFloat(cols[0].replace(/[^\d.,]/g, '').replace(',', '.')) || 0;
      if (cols[1]) updated.hourRate = parseFloat(cols[1].replace(/[^\d.,]/g, '').replace(',', '.')) || 0;
      if (cols[2]) updated.workHoursPerDay = parseFloat(cols[2].replace(/[^\d.,]/g, '').replace(',', '.')) || 8;
      if (cols[3]) updated.workingDaysPerMonth = parseFloat(cols[3].replace(/[^\d.,]/g, '').replace(',', '.')) || 22;

      // Recalculate
      const v = updated.budgetValue;
      const r = updated.hourRate;
      const h = updated.workHoursPerDay;
      const d = updated.workingDaysPerMonth;

      if (r > 0 && h > 0) {
        updated.budgetQty = Math.round(v / r / h);
        if (d > 0) {
          updated.extraQtyPerDay = Number((v / r / h / d).toFixed(2));
        }
      }

      updateMonthlyBudget(updated);
    });
  };

  const [localLotes, setLocalLotes] = useState<LoteConfig[]>([]);

  useEffect(() => {
    setLocalLotes(getMonthlyLote(selectedMonth));
  }, [selectedMonth, requests]); // Refresh when month or requests change

  const handleLoteChange = (index: number, field: 'name' | 'startDay' | 'endDay', value: string) => {
    const newLotes = [...localLotes];
    // @ts-ignore
    newLotes[index] = { ...newLotes[index], [field]: field === 'name' ? value : (parseInt(value) || 0) };
    setLocalLotes(newLotes);
  };

  const addLote = () => {
    const newId = localLotes.length > 0 ? Math.max(...localLotes.map(l => l.id)) + 1 : Date.now();
    setLocalLotes([...localLotes, {
      id: newId,
      name: `${localLotes.length + 1}º Lote`,
      startDay: 1,
      endDay: 10
    }]);
  };

  const removeLote = (index: number) => {
    setLocalLotes(localLotes.filter((_, i) => i !== index));
  };

  const handleSaveLotes = () => {
    updateMonthlyLote(selectedMonth, localLotes);
    alert('Lotes salvos com sucesso!');
  };

  const handleGridChange = (day: number, monthIdx: number, field: 'lazer' | 'eventos' | 'total', value: string) => {
    const dateKey = `${occupancyYear}-${String(monthIdx + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    setGridData(prev => {
      const current = prev[dateKey] || { lazer: '', eventos: '', total: '' };
      const updated = { ...current, [field]: value };

      if (field === 'lazer' || field === 'eventos') {
        const l = parseFloat(updated.lazer.replace(',', '.')) || 0;
        const e = parseFloat(updated.eventos.replace(',', '.')) || 0;
        updated.total = (l + e).toString();
      }

      return { ...prev, [dateKey]: updated };
    });
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>, startColIdx: number, startDay: number) => {
    e.preventDefault();
    const clipboardData = e.clipboardData.getData('text');
    if (!clipboardData) return;

    const rows = clipboardData.split(/\r?\n/).filter(r => r.trim());
    const newGridData = { ...gridData };
    let hasChanges = false;

    rows.forEach((rowStr, rowIndex) => {
      const cols = rowStr.split('\t');
      cols.forEach((val, colOffset) => {
        const totalColIdx = startColIdx + colOffset;
        const day = startDay + rowIndex;
        if (day > 31) return;

        const monthIdx = Math.floor(totalColIdx / 3);
        const subColIdx = totalColIdx % 3; // 0=lazer, 1=eventos, 2=total
        if (monthIdx > 11) return;
        if (!isValidDate(occupancyYear, monthIdx, day)) return;

        const dateKey = `${occupancyYear}-${String(monthIdx + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const current = newGridData[dateKey] || { lazer: '', eventos: '', total: '' };
        const cleanVal = val.trim().replace(/[^\d.,]/g, '');

        if (subColIdx === 0) current.lazer = cleanVal;
        else if (subColIdx === 1) current.eventos = cleanVal;
        // subColIdx 2 (Total) is auto-calc

        // Recalc Total
        const l = parseFloat(current.lazer.replace(',', '.')) || 0;
        const e = parseFloat(current.eventos.replace(',', '.')) || 0;
        current.total = (l + e).toString();

        newGridData[dateKey] = { ...current };
        hasChanges = true;
      });
    });

    if (hasChanges) {
      setGridData(newGridData);
    }
  };
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, mIdx: number, day: number) => {
    if (e.key === 'Tab' && !e.shiftKey) {
      e.preventDefault();
      const nextDay = day + 1;
      const nextId = `occ-input-${mIdx}-${nextDay}`;
      const nextElement = document.getElementById(nextId);
      if (nextElement) {
        nextElement.focus();
      }
    }
  };

  const handleSaveOccupancy = () => {
    const batchToSave: Record<string, { total: number, lazer: number, eventos: number }> = {};
    (Object.entries(gridData) as [string, { lazer: string, eventos: string, total: string }][]).forEach(([key, vals]) => {
      batchToSave[key] = {
        lazer: parseFloat(vals.lazer.replace(',', '.')) || 0,
        eventos: parseFloat(vals.eventos.replace(',', '.')) || 0,
        total: parseFloat(vals.total.replace(',', '.')) || 0
      };
    });
    saveOccupancyBatch(batchToSave);
    alert('Dados de ocupação salvos com sucesso!');
  };

  const handleAddRole = () => {
    if (newRoleName && newRoleRate) {
      addSpecialRole(newRoleName, parseFloat(newRoleRate));
      setNewRoleName('');
      setNewRoleRate('');
    }
  };

  const handleAddSector = () => {
    if (newSectorName) {
      addSector(newSectorName, newSectorType);
      setNewSectorName('');
    }
  };

  const handleExport = () => {
    const headers = [
      'ID', 'Data Criação', 'Solicitante', 'Setor', 'Motivo', 'Tipo', 'Data Evento',
      'Dias', 'Qtd Extras', 'Função', 'Turno', 'Entrada', 'Saída', 'Justificativa',
      'Ocupação (%)', 'Valor Unit. (R$)', 'Valor Total (R$)', 'Status'
    ];
    const rows = requests.map(r => [
      r.id,
      r.createdAt,
      r.requestorEmail,
      r.sector,
      r.reason,
      r.type,
      r.dateEvent,
      r.daysQty,
      r.extrasQty,
      r.functionRole,
      r.shift,
      r.timeIn,
      r.timeOut,
      `"${r.justification.replace(/"/g, '""')}"`,
      r.occupancyRate,
      (r.specialRate || 15).toFixed(2),
      (r.totalValue || 0).toFixed(2),
      r.status
    ]);
    const csvContent = [headers.join(';'), ...rows.map(row => row.join(';'))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `extragestor_base_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleCreateUser = async () => {
    if (!newUserEmail || !newUserPassword || !newUserName) return;
    setIsCreatingUser(true);
    setUserMsg('');
    const res = await createSystemUser({
      email: newUserEmail,
      password: newUserPassword,
      name: newUserName,
      role: newUserRole
    });
    setIsCreatingUser(false);
    if (res.success) {
      setNewUserEmail('');
      setNewUserPassword('');
      setNewUserName('');
      setUserMsg('Usuário criado com sucesso! Envie as credenciais para ele.');
    } else {
      setUserMsg('Erro ao criar: ' + res.error);
    }
  };

  const handleDeleteUser = async (id: string) => {
    if (window.confirm('Tem certeza? O usuário não conseguirá mais logar.')) {
      const res = await deleteSystemUser(id);
      if (!res.success) alert('Erro ao deletar: ' + res.error);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 min-h-[600px] flex flex-col">
      <div className="flex border-b border-slate-200 flex-wrap shrink-0">
        <button
          onClick={() => setActiveTab('sectors')}
          className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'sectors' ? 'border-[#F8981C] text-[#155645]' : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
        >
          <Database size={16} />
          Orçamentos Mensais
        </button>
        <button
          onClick={() => setActiveTab('config')}
          className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'config' ? 'border-[#F8981C] text-[#155645]' : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
        >
          <Settings size={16} />
          Config. Lotes
        </button>
        <button
          onClick={() => setActiveTab('occupancy')}
          className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'occupancy' ? 'border-[#F8981C] text-[#155645]' : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
        >
          <Edit3 size={16} />
          Ocupação
        </button>
        <button
          onClick={() => setActiveTab('general')}
          className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'general' ? 'border-[#F8981C] text-[#155645]' : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
        >
          <Sliders size={16} />
          Config. Geral
        </button>
        <button
          onClick={() => setActiveTab('users')}
          className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'users' ? 'border-[#F8981C] text-[#155645]' : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
        >
          <Users size={16} />
          Usuários
        </button>
        <button
          onClick={() => setActiveTab('export')}
          className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'export' ? 'border-[#F8981C] text-[#155645]' : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
        >
          <Download size={16} />
          Exportar Base
        </button>
      </div>

      <div className="p-6 flex-1 flex flex-col">
        {(activeTab === 'sectors' || activeTab === 'config' || activeTab === 'general') && (
          <div className="mb-6 flex items-center gap-3 bg-slate-50 p-3 rounded-lg border border-slate-200 w-fit">
            <span className="text-sm font-bold text-slate-700">Mês de Referência:</span>
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="border border-slate-300 rounded px-2 py-1 text-sm outline-none focus:border-[#155645]"
            />
          </div>
        )}

        {activeTab === 'sectors' && (
          <div>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-[#155645]">Orçamento de Extraordinários ({selectedMonth})</h3>
              <div className="text-xs text-blue-600 bg-blue-50 px-3 py-1 rounded-full border border-blue-100 font-medium">
                Dica: Valor Orçado | Valor Hora | Horas Trab. | Dias Trab.
              </div>
            </div>
            <div className="overflow-x-auto border border-slate-300 rounded-lg">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-100 text-slate-600 uppercase sticky top-0 z-10 shadow-sm font-bold text-center">
                  <tr>
                    <th className="p-2 border border-slate-300 text-left">Setor</th>
                    <th className="p-2 border border-slate-300 bg-slate-50">Valor Orçado (R$)</th>
                    <th className="p-2 border border-slate-300 bg-slate-50">VL. Hora (R$)</th>
                    <th className="p-2 border border-slate-300 bg-slate-50">Hrs/Dia</th>
                    <th className="p-2 border border-slate-300 text-orange-700">Extras Mês (Calc)</th>
                    <th className="p-2 border border-slate-300 bg-slate-50">Dias/Mês</th>
                    <th className="p-2 border border-slate-300 text-orange-700">MO / UH ocupada</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {sectors.map((sector, idx) => {
                    const budget = getMonthlyBudget(sector.id, selectedMonth);
                    return (
                      <tr key={sector.id} className="hover:bg-blue-50/30 transition-colors">
                        <td className="p-2 font-bold text-slate-700 border border-slate-300 bg-slate-50/50">{sector.name}</td>
                        <td className="p-0 border border-slate-300">
                          <input
                            type="number"
                            step="0.01"
                            placeholder="0,00"
                            className="w-full h-full p-2 outline-none focus:bg-blue-50 text-right transition-colors"
                            value={budget.budgetValue || ''}
                            onChange={(e) => handleBudgetChange(sector.id, 'budgetValue', e.target.value)}
                            onPaste={(e) => handleBudgetPaste(e, idx)}
                          />
                        </td>
                        <td className="p-0 border border-slate-300">
                          <input
                            type="number"
                            step="0.01"
                            placeholder="0,00"
                            className="w-full h-full p-2 outline-none focus:bg-blue-50 text-right transition-colors"
                            value={budget.hourRate || ''}
                            onChange={(e) => handleBudgetChange(sector.id, 'hourRate', e.target.value)}
                            onPaste={(e) => handleBudgetPaste(e, idx)}
                          />
                        </td>
                        <td className="p-0 border border-slate-300">
                          <input
                            type="number"
                            placeholder="8"
                            className="w-full h-full p-2 outline-none focus:bg-blue-50 text-center transition-colors"
                            value={budget.workHoursPerDay || ''}
                            onChange={(e) => handleBudgetChange(sector.id, 'workHoursPerDay', e.target.value)}
                            onPaste={(e) => handleBudgetPaste(e, idx)}
                          />
                        </td>
                        <td className="p-2 font-bold text-[#155645] text-center border border-slate-300 bg-orange-50/30">
                          {budget.budgetQty}
                        </td>
                        <td className="p-0 border border-slate-300">
                          <input
                            type="number"
                            placeholder="22"
                            className="w-full h-full p-2 outline-none focus:bg-blue-50 text-center transition-colors"
                            value={budget.workingDaysPerMonth || ''}
                            onChange={(e) => handleBudgetChange(sector.id, 'workingDaysPerMonth', e.target.value)}
                            onPaste={(e) => handleBudgetPaste(e, idx)}
                          />
                        </td>
                        <td className="p-2 font-bold text-[#F8981C] text-center border border-slate-300 bg-orange-50/30">
                          {budget.extraQtyPerDay}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'config' && (
          <div>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-[#155645]">Configuração de Lotes ({selectedMonth})</h3>
              <div className="flex gap-2">
                <button onClick={addLote} className="flex items-center gap-1 bg-white border border-slate-300 text-slate-700 px-3 py-1.5 rounded text-sm hover:bg-slate-50">
                  <Plus size={14} /> Adicionar Lote
                </button>
                <button onClick={handleSaveLotes} className="flex items-center gap-1 bg-[#155645] text-white px-4 py-1.5 rounded text-sm hover:bg-[#104033] shadow-sm">
                  <Save size={14} /> Salvar Lotes
                </button>
              </div>
            </div>
            <div className="overflow-x-auto border border-slate-300 rounded-lg">
              <table className="w-full text-left text-sm border-collapse">
                <thead className="bg-slate-100 text-slate-600 uppercase font-bold sticky top-0 z-10 shadow-sm">
                  <tr>
                    <th className="p-2 border border-slate-300">Nome do Lote</th>
                    <th className="p-2 border border-slate-300 w-32">Dia Início</th>
                    <th className="p-2 border border-slate-300 w-32">Dia Final</th>
                    <th className="p-2 border border-slate-300 text-center w-20">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {localLotes.map((lote, idx) => (
                    <tr key={lote.id} className="hover:bg-blue-50/20 transition-colors">
                      <td className="p-0 border border-slate-300">
                        <input
                          type="text"
                          className="w-full h-full p-2 outline-none focus:bg-blue-50"
                          value={lote.name}
                          onChange={(e) => handleLoteChange(idx, 'name', e.target.value)}
                        />
                      </td>
                      <td className="p-0 border border-slate-300">
                        <input
                          type="number"
                          className="w-full h-full p-2 outline-none focus:bg-blue-50 text-center"
                          value={lote.startDay}
                          onChange={(e) => handleLoteChange(idx, 'startDay', e.target.value)}
                        />
                      </td>
                      <td className="p-0 border border-slate-300">
                        <input
                          type="number"
                          className="w-full h-full p-2 outline-none focus:bg-blue-50 text-center"
                          value={lote.endDay}
                          onChange={(e) => handleLoteChange(idx, 'endDay', e.target.value)}
                        />
                      </td>
                      <td className="p-2 text-center border border-slate-300">
                        <button onClick={() => removeLote(idx)} className="text-red-400 hover:text-red-600 p-1"><Trash2 size={16} /></button>
                      </td>
                    </tr>
                  ))}
                  {localLotes.length === 0 && (
                    <tr>
                      <td colSpan={4} className="p-8 text-center text-slate-400 italic">Nenhum lote configurado. Clique em adicionar.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'occupancy' && (
          <div className="flex flex-col h-full overflow-hidden">
            <div className="flex justify-between items-center mb-4 bg-blue-50 p-4 rounded-lg border border-blue-100">
              <div className="flex items-center gap-6">
                <h3 className="text-lg font-bold text-slate-800">Tabela de Ocupação ({occupancyYear})</h3>
                <div className="flex items-center gap-2">
                  <label className="text-sm font-medium text-slate-600">Ano:</label>
                  <select
                    value={occupancyYear}
                    onChange={(e) => setOccupancyYear(Number(e.target.value))}
                    className="border border-slate-300 rounded px-2 py-1 text-sm bg-white"
                  >
                    {years.map(y => <option key={y} value={y}>{y}</option>)}
                  </select>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button onClick={handleSaveOccupancy} className="bg-[#155645] text-white px-4 py-2 rounded-lg font-medium hover:bg-[#104033] transition-colors flex items-center gap-2 shadow-sm">
                  <Save size={16} /> Salvar Ocupação
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-auto border border-slate-200 rounded-lg">
              <table className="w-full text-center border-collapse min-w-[2000px]">
                <thead className="bg-[#155645] text-white sticky top-0 z-10 shadow-sm">
                  <tr>
                    <th rowSpan={2} className="p-3 text-xs uppercase border border-white/20 w-16 sticky left-0 bg-[#155645] z-20">Dia</th>
                    {months.map(m => (
                      <th key={m} colSpan={3} className="p-2 text-xs uppercase border border-white/20">{m}</th>
                    ))}
                  </tr>
                  <tr className="bg-[#104033] sticky top-[41px] z-10 shadow-sm">
                    {months.map((m, i) => (
                      <React.Fragment key={`${m}-sub`}>
                        <th className="p-1 text-[9px] uppercase border border-white/10 w-20">Lazer</th>
                        <th className="p-1 text-[9px] uppercase border border-white/10 w-20">Eventos</th>
                        <th className="p-1 text-[9px] uppercase border border-white/10 w-20 bg-[#F8981C]/80">Total</th>
                      </React.Fragment>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {days.map(day => (
                    <tr key={day} className="hover:bg-slate-50 border-b border-slate-200">
                      <td className="p-2 text-sm font-bold bg-slate-50 border-r border-slate-200 sticky left-0 z-10">{day}</td>
                      {months.map((_, mIdx) => {
                        const valid = isValidDate(occupancyYear, mIdx, day);
                        const dateKey = `${occupancyYear}-${String(mIdx + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                        const vals = gridData[dateKey] || { lazer: '', eventos: '', total: '0' };

                        if (!valid) return (
                          <React.Fragment key={`${mIdx}-${day}`}>
                            <td className="bg-slate-100 border-r border-slate-200"></td>
                            <td className="bg-slate-100 border-r border-slate-200"></td>
                            <td className="bg-slate-100 border-r border-slate-200"></td>
                          </React.Fragment>
                        );

                        return (
                          <React.Fragment key={`${mIdx}-${day}`}>
                            <td className="p-0 border-r border-slate-200">
                              <input
                                type="text"
                                className="w-full p-1 text-center text-xs outline-none bg-transparent focus:bg-blue-50"
                                value={vals.lazer}
                                onChange={(e) => handleGridChange(day, mIdx, 'lazer', e.target.value)}
                                onPaste={(e) => handlePaste(e, mIdx * 3 + 0, day)}
                              />
                            </td>
                            <td className="p-0 border-r border-slate-200">
                              <input
                                type="text"
                                className="w-full p-1 text-center text-xs outline-none bg-transparent focus:bg-blue-50"
                                value={vals.eventos}
                                onChange={(e) => handleGridChange(day, mIdx, 'eventos', e.target.value)}
                                onPaste={(e) => handlePaste(e, mIdx * 3 + 1, day)}
                              />
                            </td>
                            <td className="p-0 border-r border-slate-200 bg-slate-50/50">
                              <input
                                type="text"
                                className="w-full p-1 text-center text-xs font-bold text-[#155645] outline-none bg-transparent"
                                value={vals.total}
                                readOnly
                              />
                            </td>
                          </React.Fragment>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'general' && (
          <div className="max-w-4xl space-y-8">
            <div className="bg-slate-50 p-6 rounded-lg border border-slate-200">
              <h3 className="text-lg font-bold text-[#155645] mb-4 flex items-center gap-2">
                <Settings size={20} className="text-[#F8981C]" /> Taxas Gerais e Impostos ({selectedMonth})
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Valor da Hora Comum (R$)</label>
                  <input
                    type="number"
                    step="0.01"
                    className="border border-slate-300 rounded px-3 py-2 w-full focus:ring-1 focus:ring-[#155645] outline-none"
                    value={getMonthlyAppConfig(selectedMonth).standardHourRate}
                    onChange={(e) => updateMonthlyAppConfig({ ...getMonthlyAppConfig(selectedMonth), standardHourRate: parseFloat(e.target.value) || 0 })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Imposto sobre Total (%)</label>
                  <input
                    type="number"
                    step="0.01"
                    className="border border-slate-300 rounded px-3 py-2 w-full focus:ring-1 focus:ring-[#155645] outline-none"
                    value={getMonthlyAppConfig(selectedMonth).taxRate}
                    onChange={(e) => updateMonthlyAppConfig({ ...getMonthlyAppConfig(selectedMonth), taxRate: parseFloat(e.target.value) || 0 })}
                  />
                </div>
                <div className="col-span-1 md:col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-1">Meta de MO por UH Ocupada (Índice)</label>
                  <div className="flex items-center gap-3">
                    <input
                      type="number"
                      step="0.001"
                      className="border border-slate-300 rounded px-3 py-2 w-full md:w-1/2 focus:ring-1 focus:ring-[#155645] outline-none font-bold text-[#F8981C]"
                      value={getMonthlyAppConfig(selectedMonth).moTarget || 0}
                      onChange={(e) => updateMonthlyAppConfig({ ...getMonthlyAppConfig(selectedMonth), moTarget: parseFloat(e.target.value) || 0 })}
                    />
                    <div className="text-xs text-slate-500 italic">
                      Esta meta será exibida como uma linha laranja no gráfico de indicadores.
                    </div>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Meta MO por UH Ocupada (Alvo)</label>
                  <input
                    type="number"
                    step="0.001"
                    className="border border-slate-300 rounded px-3 py-2 w-full focus:ring-1 focus:ring-[#155645] outline-none"
                    value={getMonthlyAppConfig(selectedMonth).moTarget || ''}
                    placeholder="Ex: 0.150"
                    onChange={(e) => updateMonthlyAppConfig({ ...getMonthlyAppConfig(selectedMonth), moTarget: parseFloat(e.target.value) || 0 })}
                  />
                </div>
                <div className="col-span-1 md:col-span-2 border-t border-slate-200 pt-6 mt-2">
                  <label className="block text-sm font-medium text-slate-700 mb-2">Status do Formulário de Solicitação (Global)</label>
                  <button
                    onClick={() => updateSystemConfig({ ...systemConfig, isFormLocked: !systemConfig.isFormLocked })}
                    className={`flex items-center gap-2 px-6 py-3 rounded-lg font-bold transition-all ${systemConfig.isFormLocked
                      ? 'bg-red-100 text-red-700 border border-red-200 hover:bg-red-200'
                      : 'bg-green-100 text-green-700 border border-green-200 hover:bg-green-200'
                      }`}
                  >
                    {systemConfig.isFormLocked ? <Lock size={20} /> : <Unlock size={20} />}
                    {systemConfig.isFormLocked ? 'FORMULÁRIO BLOQUEADO' : 'FORMULÁRIO LIBERADO'}
                  </button>
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-lg border border-slate-200">
              <h3 className="text-lg font-bold text-[#155645] mb-4 flex items-center gap-2">
                <Briefcase size={20} className="text-[#F8981C]" /> Cargos e Diárias Especiais
              </h3>
              <div className="flex gap-2 mb-4">
                <input
                  type="text"
                  placeholder="Nome do Cargo"
                  className="border border-slate-300 rounded px-3 py-2 flex-1 outline-none"
                  value={newRoleName}
                  onChange={(e) => setNewRoleName(e.target.value)}
                />
                <input
                  type="number"
                  placeholder="Valor"
                  className="border border-slate-300 rounded px-3 py-2 w-32 outline-none"
                  value={newRoleRate}
                  onChange={(e) => setNewRoleRate(e.target.value)}
                />
                <button onClick={handleAddRole} className="bg-[#155645] text-white px-4 py-2 rounded hover:bg-[#104033]">
                  <Plus size={18} />
                </button>
              </div>
              <ul className="divide-y divide-slate-100">
                {specialRoles.map(role => (
                  <li key={role.id} className="flex justify-between items-center p-3">
                    <span className="text-slate-700 font-medium">{role.name}</span>
                    <div className="flex items-center gap-4">
                      <span className="font-bold text-[#155645]">R$ {role.rate.toFixed(2)}</span>
                      <button onClick={() => removeSpecialRole(role.id)} className="text-red-400 hover:text-red-600">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            <div className="bg-white p-6 rounded-lg border border-slate-200">
              <h3 className="text-lg font-bold text-[#155645] mb-4 flex items-center gap-2">
                <Building2 size={20} className="text-[#F8981C]" /> Gerenciar Setores
              </h3>
              <div className="flex gap-2 mb-4">
                <input
                  type="text"
                  placeholder="Nome do Setor"
                  className="border border-slate-300 rounded px-3 py-2 flex-1 outline-none"
                  value={newSectorName}
                  onChange={(e) => setNewSectorName(e.target.value)}
                />
                <select
                  className="border border-slate-300 rounded px-3 py-2 outline-none"
                  value={newSectorType}
                  onChange={(e) => setNewSectorType(e.target.value as any)}
                >
                  <option value="Operacional">Operacional</option>
                  <option value="Suporte">Suporte</option>
                </select>
                <button onClick={handleAddSector} className="bg-[#155645] text-white px-4 py-2 rounded hover:bg-[#104033]">
                  <Plus size={18} />
                </button>
              </div>
              <ul className="divide-y divide-slate-100 max-h-60 overflow-auto">
                {sectors.map(sector => (
                  <li key={sector.id} className="flex justify-between items-center p-3">
                    <span className="text-slate-700 font-medium">{sector.name}</span>
                    <button onClick={() => removeSector(sector.id)} className="text-red-400 hover:text-red-600">
                      <Trash2 size={16} />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {activeTab === 'export' && (
          <div className="max-w-4xl">
            <h3 className="text-lg font-bold text-slate-800 mb-2">Exportar Base do Sistema</h3>
            <div className="bg-green-50 p-4 rounded-lg border border-green-200 mb-4 text-sm text-green-800">
              Faça o download de todas as solicitações registradas no sistema em formato CSV (compatível com Excel).
            </div>
            <button onClick={handleExport} className="bg-[#155645] hover:bg-[#104033] text-white px-6 py-3 rounded-lg font-medium transition-colors flex items-center gap-2">
              <Download size={20} /> Baixar CSV Completo
            </button>
          </div>
        )}
        {activeTab === 'users' && (
          <div className="max-w-4xl space-y-6">
            {/* Create User Form */}
            <div className="bg-slate-50 p-6 rounded-lg border border-slate-200">
              <h3 className="text-lg font-bold text-[#155645] mb-4 flex items-center gap-2">
                <Plus size={20} className="text-[#F8981C]" /> Cadastrar Novo Usuário
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <input
                  type="text" placeholder="Nome Completo"
                  className="border border-slate-300 rounded px-3 py-2 outline-none focus:ring-1 focus:ring-[#155645]"
                  value={newUserName} onChange={e => setNewUserName(e.target.value)}
                />
                <input
                  type="email" placeholder="Email de Login"
                  className="border border-slate-300 rounded px-3 py-2 outline-none focus:ring-1 focus:ring-[#155645]"
                  value={newUserEmail} onChange={e => setNewUserEmail(e.target.value)}
                />
                <div className="relative">
                  <Key size={16} className="absolute left-3 top-3 text-slate-400" />
                  <input
                    type="text" placeholder="Senha Inicial"
                    className="border border-slate-300 rounded px-3 py-2 pl-9 w-full outline-none focus:ring-1 focus:ring-[#155645]"
                    value={newUserPassword} onChange={e => setNewUserPassword(e.target.value)}
                  />
                </div>
                <select
                  className="border border-slate-300 rounded px-3 py-2 outline-none"
                  value={newUserRole} onChange={e => setNewUserRole(e.target.value as UserRole)}
                >
                  <option value="USER">Usuário Comum</option>
                  <option value="ADMIN">Administrador</option>
                </select>
              </div>
              <div className="mt-4 flex items-center justify-between">
                <p className={`text-sm font-medium ${userMsg.includes('Erro') ? 'text-red-500' : 'text-green-600'}`}>{userMsg}</p>
                <button
                  onClick={handleCreateUser}
                  disabled={isCreatingUser || !newUserEmail || !newUserPassword}
                  className={`px-6 py-2 bg-[#155645] text-white rounded-lg font-bold hover:bg-[#104033] transition-colors ${isCreatingUser ? 'opacity-50' : ''}`}
                >
                  {isCreatingUser ? 'Criando...' : 'Criar Usuário'}
                </button>
              </div>
            </div>

            {/* User List */}
            <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-100 text-slate-600 uppercase font-bold">
                  <tr>
                    <th className="p-3 border-b">Nome</th>
                    <th className="p-3 border-b">Email</th>
                    <th className="p-3 border-b">Função</th>
                    <th className="p-3 border-b text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {profiles.map(p => (
                    <tr key={p.id} className="hover:bg-slate-50">
                      <td className="p-3 font-medium text-slate-700">{p.name}</td>
                      <td className="p-3 text-slate-500">{p.email}</td>
                      <td className="p-3">
                        <span className={`px-2 py-1 rounded-full text-xs font-bold ${p.role === 'ADMIN' ? 'bg-[#155645]/10 text-[#155645]' : 'bg-blue-50 text-blue-600'}`}>
                          {p.role}
                        </span>
                      </td>
                      <td className="p-3 text-right">
                        <button onClick={() => handleDeleteUser(p.id)} className="text-red-400 hover:text-red-600 p-1" title="Excluir Usuário">
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {profiles.length === 0 && (
                    <tr><td colSpan={4} className="p-6 text-center text-slate-400">Nenhum usuário encontrado.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};