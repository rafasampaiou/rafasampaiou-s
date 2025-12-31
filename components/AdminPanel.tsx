import React, { useState, useEffect } from 'react';
import { useApp } from '../context';
import { Settings, Edit3, Database, Download, Plus, Trash2, Save, Sliders, Briefcase, Building2, Lock, Unlock } from 'lucide-react';

export const AdminPanel: React.FC = () => {
  const {
    sectors, addSector, removeSector,
    getMonthlyBudget, updateMonthlyBudget,
    getMonthlyLote, updateMonthlyLote,
    saveOccupancyBatch, occupancyData, requests,
    systemConfig, updateSystemConfig,
    specialRoles, addSpecialRole, removeSpecialRole,
    bulkDeleteRequests,
  } = useApp();

  // Admin Gate handles the PIN check, so we don't need to check user role here.
  // The fact that this component is rendered means the user passed the AdminGate.

  const [activeTab, setActiveTab] = useState('sectors');
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM

  // Occupancy State
  const [occupancyYear, setOccupancyYear] = useState(new Date().getFullYear());
  const [gridData, setGridData] = useState<Record<string, string>>({});

  // New Inputs State
  const [newRoleName, setNewRoleName] = useState('');
  const [newRoleRate, setNewRoleRate] = useState('');
  const [newSectorName, setNewSectorName] = useState('');
  const [newSectorType, setNewSectorType] = useState<'Operacional' | 'Suporte'>('Operacional');
  const [deletePeriod, setDeletePeriod] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM

  // Sync global occupancy data to local grid state when year changes
  useEffect(() => {
    const newGridData: Record<string, string> = {};
    Object.entries(occupancyData).forEach(([dateStr, val]) => {
      if (dateStr.startsWith(String(occupancyYear))) {
        newGridData[dateStr] = val.toString();
      }
    });
    setGridData(newGridData);
  }, [occupancyYear, occupancyData]);

  // Helper for Occupancy Grid
  const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  const days = Array.from({ length: 31 }, (_, i) => i + 1);
  const years = Array.from({ length: 11 }, (_, i) => 2025 + i);

  const isValidDate = (y: number, m: number, d: number) => {
    const date = new Date(y, m, d);
    return date.getMonth() === m && date.getDate() === d;
  };

  const handleBudgetChange = (sectorId: string, field: 'budgetQty' | 'budgetValue', value: string) => {
    const current = getMonthlyBudget(sectorId, selectedMonth);
    updateMonthlyBudget({
      ...current,
      [field]: parseFloat(value) || 0
    });
  };

  const handleLoteChange = (index: number, field: 'name' | 'startDay' | 'endDay', value: string) => {
    const currentLotes = getMonthlyLote(selectedMonth);
    const newLotes = [...currentLotes];
    // @ts-ignore
    newLotes[index] = { ...newLotes[index], [field]: field === 'name' ? value : (parseInt(value) || 0) };
    updateMonthlyLote(selectedMonth, newLotes);
  };

  const addLote = () => {
    const currentLotes = getMonthlyLote(selectedMonth);
    const newId = currentLotes.length > 0 ? Math.max(...currentLotes.map(l => l.id)) + 1 : 1;
    updateMonthlyLote(selectedMonth, [...currentLotes, {
      id: newId,
      name: `${currentLotes.length + 1}º Lote`,
      startDay: 0,
      endDay: 0
    }]);
  };

  const removeLote = (index: number) => {
    const currentLotes = getMonthlyLote(selectedMonth);
    const newLotes = currentLotes.filter((_, i) => i !== index);
    updateMonthlyLote(selectedMonth, newLotes);
  };

  // Occupancy Grid Handlers
  const handleGridChange = (monthIndex: number, day: number, value: string) => {
    const dateKey = `${occupancyYear}-${String(monthIndex + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    setGridData(prev => ({
      ...prev,
      [dateKey]: value
    }));
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>, startMIdx: number, startDay: number) => {
    e.preventDefault();
    const clipboardData = e.clipboardData.getData('text');
    if (!clipboardData) return;

    const rows = clipboardData.split(/\r?\n/);
    const newGridData = { ...gridData };
    let hasChanges = false;

    rows.forEach((rowStr, rowIndex) => {
      if (!rowStr.trim()) return;

      // Handle tabs (columns) if user copied a table
      const cols = rowStr.split('\t');

      cols.forEach((val, colIndex) => {
        const targetMIdx = startMIdx + colIndex;
        const targetDay = startDay + rowIndex;

        // Ensure we are within bounds
        if (targetMIdx > 11 || targetDay > 31) return;

        // Check if date is valid (e.g. avoid Feb 30)
        if (!isValidDate(occupancyYear, targetMIdx, targetDay)) return;

        const dateKey = `${occupancyYear}-${String(targetMIdx + 1).padStart(2, '0')}-${String(targetDay).padStart(2, '0')}`;

        // Basic cleanup of value
        const stringVal = String(val);
        const cleanVal = stringVal.trim().replace(/[^\d.,]/g, ''); // Allow numbers, dots, commas

        if (cleanVal) {
          newGridData[dateKey] = cleanVal;
          hasChanges = true;
        }
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
    const batchToSave: Record<string, number> = {};
    Object.entries(gridData).forEach(([key, val]) => {
      const strVal = String(val);
      if (strVal !== '') {
        batchToSave[key] = parseFloat(strVal.replace(',', '.')) || 0;
      }
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
          onClick={() => setActiveTab('export')}
          className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'export' ? 'border-[#F8981C] text-[#155645]' : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
        >
          <Database size={16} />
          Gestão da Base
        </button>
      </div>

      <div className="p-6 flex-1 flex flex-col">

        {(activeTab === 'sectors' || activeTab === 'config') && (
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
            <h3 className="text-lg font-bold text-[#155645] mb-4">Orçamento por Setor ({selectedMonth})</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-[#155645]/5 text-[#155645] uppercase">
                  <tr>
                    <th className="p-3">Setor</th>
                    <th className="p-3">Qtd Orçada</th>
                    <th className="p-3">Valor Orçado (R$)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {sectors.map(sector => {
                    const budget = getMonthlyBudget(sector.id, selectedMonth);
                    return (
                      <tr key={sector.id} className="hover:bg-slate-50">
                        <td className="p-3 font-medium text-slate-800">{sector.name}</td>
                        <td className="p-3">
                          <input
                            type="number"
                            className="border border-slate-300 rounded px-2 py-1 w-24 focus:ring-1 focus:ring-[#155645] outline-none"
                            value={budget.budgetQty || 0}
                            onChange={(e) => handleBudgetChange(sector.id, 'budgetQty', e.target.value)}
                          />
                        </td>
                        <td className="p-3">
                          <input
                            type="number"
                            step="0.01"
                            className="border border-slate-300 rounded px-2 py-1 w-32 focus:ring-1 focus:ring-[#155645] outline-none"
                            value={budget.budgetValue || 0}
                            onChange={(e) => handleBudgetChange(sector.id, 'budgetValue', e.target.value)}
                          />
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
              <button onClick={addLote} className="flex items-center gap-1 bg-[#155645] text-white px-3 py-1.5 rounded text-sm hover:bg-[#104033]">
                <Plus size={14} /> Adicionar Lote
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm border-collapse">
                <thead className="bg-[#155645]/5 text-[#155645] uppercase">
                  <tr>
                    <th className="p-3 border border-slate-200">Ano / Mês</th>
                    <th className="p-3 border border-slate-200">Nome do Lote</th>
                    <th className="p-3 border border-slate-200">Dia Início</th>
                    <th className="p-3 border border-slate-200">Dia Final</th>
                    <th className="p-3 border border-slate-200 text-center">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {getMonthlyLote(selectedMonth).map((lote, idx) => (
                    <tr key={lote.id}>
                      <td className="p-3 border border-slate-200 bg-slate-50 font-mono text-xs">{selectedMonth}</td>
                      <td className="p-3 border border-slate-200">
                        <input
                          type="text"
                          className="border border-slate-300 rounded px-2 py-1 w-full"
                          value={lote.name}
                          onChange={(e) => handleLoteChange(idx, 'name', e.target.value)}
                        />
                      </td>
                      <td className="p-3 border border-slate-200">
                        <input
                          type="number"
                          className="border border-slate-300 rounded px-2 py-1 w-20"
                          value={lote.startDay}
                          onChange={(e) => handleLoteChange(idx, 'startDay', e.target.value)}
                        />
                      </td>
                      <td className="p-3 border border-slate-200">
                        <input
                          type="number"
                          className="border border-slate-300 rounded px-2 py-1 w-20"
                          value={lote.endDay}
                          onChange={(e) => handleLoteChange(idx, 'endDay', e.target.value)}
                        />
                      </td>
                      <td className="p-3 border border-slate-200 text-center">
                        <button onClick={() => removeLote(idx)} className="text-red-500 hover:text-red-700 p-1"><Trash2 size={16} /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'occupancy' && (
          <div className="flex flex-col h-full overflow-hidden">
            <div className="flex justify-between items-center mb-4 bg-blue-50 p-4 rounded-lg border border-blue-100">
              <div className="flex items-center gap-4">
                <h3 className="text-lg font-bold text-slate-800">Tabela de Ocupação</h3>
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
                <div className="text-xs text-blue-600 bg-blue-100 px-3 py-1 rounded-full">
                  Dica: Copie do Excel e cole na 1ª célula para preencher
                </div>
                <button onClick={handleSaveOccupancy} className="bg-[#155645] text-white px-4 py-2 rounded-lg font-medium hover:bg-[#104033] transition-colors flex items-center gap-2 shadow-sm">
                  <Save size={16} /> Salvar Ocupação
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-auto border border-slate-200 rounded-lg">
              <table className="w-full text-center border-collapse">
                <thead className="bg-slate-100 text-slate-600 sticky top-0 z-10 shadow-sm">
                  <tr>
                    <th className="p-2 text-xs uppercase bg-slate-200 border border-slate-300 w-12 sticky left-0 z-20">Dia</th>
                    {months.map(m => (
                      <th key={m} className="p-2 text-xs uppercase border border-slate-300 min-w-[60px]">{m}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {days.map(day => (
                    <tr key={day}>
                      <td className="p-2 text-xs font-bold bg-slate-50 border border-slate-300 sticky left-0 z-10">{day}</td>
                      {months.map((_, mIdx) => {
                        const valid = isValidDate(occupancyYear, mIdx, day);
                        const dateKey = `${occupancyYear}-${String(mIdx + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                        const val = gridData[dateKey] || '';
                        return valid ? (
                          <td key={mIdx} className="border border-slate-300 p-0">
                            <input
                              id={`occ-input-${mIdx}-${day}`}
                              type="text"
                              className="w-full h-full p-2 text-center text-sm outline-none focus:bg-blue-50 transition-colors"
                              value={val}
                              placeholder="-"
                              onChange={(e) => handleGridChange(mIdx, day, e.target.value)}
                              onKeyDown={(e) => handleKeyDown(e, mIdx, day)}
                              onPaste={(e) => handlePaste(e, mIdx, day)}
                            />
                          </td>
                        ) : <td key={mIdx} className="bg-slate-100 border border-slate-300"></td>;
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
            {/* 1. Taxas Gerais */}
            <div className="bg-slate-50 p-6 rounded-lg border border-slate-200">
              <h3 className="text-lg font-bold text-[#155645] mb-4 flex items-center gap-2">
                <Settings size={20} className="text-[#F8981C]" /> Taxas Gerais e Impostos
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Valor da Hora Comum (R$)</label>
                  <input
                    type="number"
                    step="0.01"
                    className="border border-slate-300 rounded px-3 py-2 w-full focus:ring-1 focus:ring-[#155645] outline-none"
                    value={systemConfig.standardHourRate}
                    onChange={(e) => updateSystemConfig({ ...systemConfig, standardHourRate: parseFloat(e.target.value) || 0 })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Imposto sobre Total (%)</label>
                  <input
                    type="number"
                    step="0.01"
                    className="border border-slate-300 rounded px-3 py-2 w-full focus:ring-1 focus:ring-[#155645] outline-none"
                    value={systemConfig.taxRate}
                    onChange={(e) => updateSystemConfig({ ...systemConfig, taxRate: parseFloat(e.target.value) || 0 })}
                  />
                  <p className="text-xs text-slate-500 mt-1">Este percentual incide sobre o valor total final das solicitações.</p>
                </div>

                <div className="col-span-1 md:col-span-2 border-t border-slate-200 pt-6 mt-2">
                  <label className="block text-sm font-medium text-slate-700 mb-2">Status do Formulário de Solicitação</label>
                  <button
                    onClick={() => updateSystemConfig({ ...systemConfig, isFormLocked: !systemConfig.isFormLocked })}
                    className={`flex items-center gap-2 px-6 py-3 rounded-lg font-bold transition-all ${systemConfig.isFormLocked
                      ? 'bg-red-100 text-red-700 border border-red-200 hover:bg-red-200'
                      : 'bg-green-100 text-green-700 border border-green-200 hover:bg-green-200'
                      }`}
                  >
                    {systemConfig.isFormLocked ? <Lock size={20} /> : <Unlock size={20} />}
                    {systemConfig.isFormLocked ? 'FORMULÁRIO BLOQUEADO (Clique para Liberar)' : 'FORMULÁRIO LIBERADO (Clique para Bloquear)'}
                  </button>
                  <p className="text-xs text-slate-500 mt-2">
                    {systemConfig.isFormLocked
                      ? 'Nenhum usuário pode enviar solicitações no momento.'
                      : 'O formulário está aberto para novos pedidos.'}
                  </p>
                </div>
              </div>
            </div>

            {/* 2. Cargos Especiais */}
            <div className="bg-white p-6 rounded-lg border border-slate-200">
              <h3 className="text-lg font-bold text-[#155645] mb-4 flex items-center gap-2">
                <Briefcase size={20} className="text-[#F8981C]" /> Cargos e Diárias Especiais
              </h3>
              <div className="flex gap-2 mb-4">
                <input
                  type="text"
                  placeholder="Nome do Cargo (ex: Bilíngue)"
                  className="border border-slate-300 rounded px-3 py-2 flex-1 focus:ring-1 focus:ring-[#155645] outline-none"
                  value={newRoleName}
                  onChange={(e) => setNewRoleName(e.target.value)}
                />
                <input
                  type="number"
                  step="0.01"
                  placeholder="Valor Diária (R$)"
                  className="border border-slate-300 rounded px-3 py-2 w-32 focus:ring-1 focus:ring-[#155645] outline-none"
                  value={newRoleRate}
                  onChange={(e) => setNewRoleRate(e.target.value)}
                />
                <button onClick={handleAddRole} className="bg-[#155645] text-white px-4 py-2 rounded hover:bg-[#104033]">
                  <Plus size={18} />
                </button>
              </div>

              <ul className="divide-y divide-slate-100 border border-slate-100 rounded-lg">
                {specialRoles.map(role => (
                  <li key={role.id} className="flex justify-between items-center p-3 hover:bg-slate-50">
                    <div>
                      <span className="font-medium text-slate-700">{role.name}</span>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-sm font-bold text-[#155645]">R$ {role.rate.toFixed(2)} /dia</span>
                      <button onClick={() => removeSpecialRole(role.id)} className="text-red-400 hover:text-red-600">

                        <Trash2 size={16} />
                      </button>
                    </div>
                  </li>
                ))}
                {specialRoles.length === 0 && <li className="p-4 text-center text-slate-400 text-sm">Nenhum cargo especial cadastrado.</li>}
              </ul>
            </div>

            {/* 3. Setores */}
            <div className="bg-white p-6 rounded-lg border border-slate-200">
              <h3 className="text-lg font-bold text-[#155645] mb-4 flex items-center gap-2">
                <Building2 size={20} className="text-[#F8981C]" /> Gerenciar Setores
              </h3>
              <div className="flex gap-2 mb-4">
                <input
                  type="text"
                  placeholder="Nome do Setor"
                  className="border border-slate-300 rounded px-3 py-2 flex-1 focus:ring-1 focus:ring-[#155645] outline-none"
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

              <ul className="divide-y divide-slate-100 border border-slate-100 rounded-lg max-h-60 overflow-auto">
                {sectors.map(sector => (
                  <li key={sector.id} className="flex justify-between items-center p-3 hover:bg-slate-50">
                    <div className="flex items-center gap-3">
                      <span className="font-medium text-slate-700">{sector.name}</span>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full ${sector.type === 'Operacional' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700'}`}>
                        {sector.type}
                      </span>
                    </div>
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
          <div className="max-w-4xl space-y-12">
            {/* Export Section */}
            <div>
              <h3 className="text-lg font-bold text-slate-800 mb-2">Exportar Dados</h3>
              <div className="bg-green-50 p-4 rounded-lg border border-green-200 mb-4 text-sm text-green-800">
                Faça o download de todas as solicitações registradas no sistema em formato CSV (compatível com Excel).
              </div>
              <button onClick={handleExport} className="bg-[#155645] hover:bg-[#104033] text-white px-6 py-3 rounded-lg font-medium transition-colors flex items-center gap-2 shadow-sm">
                <Download size={18} /> Baixar CSV da Base Completa
              </button>
            </div>

            {/* Bulk Delete Section */}
            <div className="pt-8 border-t border-slate-200">
              <h3 className="text-lg font-bold text-red-600 mb-2">Limpeza de Base de Dados</h3>
              <div className="bg-red-50 p-4 rounded-lg border border-red-100 mb-6 text-sm text-red-800">
                <strong>ATENÇÃO:</strong> Esta ferramenta remove registros permanentemente do banco de dados.
                Selecione o período abaixo para realizar a limpeza.
              </div>

              <div className="flex flex-wrap items-end gap-6">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Selecione o Período</label>
                  <input
                    type="month"
                    value={deletePeriod}
                    onChange={(e) => setDeletePeriod(e.target.value)}
                    className="border border-slate-300 rounded-lg px-3 py-2 bg-slate-50 outline-none focus:ring-2 focus:ring-red-500 focus:bg-white transition-all"
                  />
                </div>

                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={async () => {
                      console.log('Botão Limpar Mês clicado, período:', deletePeriod);
                      if (window.confirm(`Essa opção irá excluir todas as solicitações feitas no período ${deletePeriod}, tem certeza disso?`)) {
                        await bulkDeleteRequests(deletePeriod, 'month');
                      }
                    }}
                    className="bg-red-600 hover:bg-red-700 text-white px-6 py-2.5 rounded-lg font-bold transition-colors flex items-center gap-2 shadow-sm"
                  >
                    <Trash2 size={18} /> Limpar Mês
                  </button>

                  <button
                    type="button"
                    onClick={async () => {
                      const year = deletePeriod.split('-')[0];
                      console.log('Botão Limpar Ano clicado, ano:', year);
                      if (window.confirm(`Essa opção irá excluir todas as solicitações feitas no ANO de ${year}, tem certeza disso?`)) {
                        await bulkDeleteRequests(year, 'year');
                      }
                    }}
                    className="bg-red-800 hover:bg-red-900 text-white px-6 py-2.5 rounded-lg font-bold transition-colors flex items-center gap-2 shadow-sm"
                  >
                    <Trash2 size={18} /> Limpar Ano
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};