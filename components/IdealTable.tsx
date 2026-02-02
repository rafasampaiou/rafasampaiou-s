import React, { useState, useEffect } from 'react';
import { useApp } from '../context';
import { Calendar, Copy, ClipboardPaste, Check, AlertTriangle } from 'lucide-react';

interface CurrencyInputProps {
  value: number;
  onChange: (value: string) => void;
  onPaste?: (e: React.ClipboardEvent) => void;
}

const CurrencyInput: React.FC<CurrencyInputProps> = ({ value, onChange, onPaste }) => {
  const [isEditing, setIsEditing] = useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isEditing]);

  if (isEditing) {
    return (
      <input
        ref={inputRef}
        type="number"
        step="0.01"
        className="w-full h-full p-2 text-right outline-none bg-blue-50 font-medium"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={() => setIsEditing(false)}
        onPaste={onPaste}
      />
    );
  }

  return (
    <div
      className="w-full h-full p-2 text-right cursor-text hover:bg-slate-100 transition-colors font-medium flex items-center justify-end text-slate-700"
      onClick={() => setIsEditing(true)}
    >
      {value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
    </div>
  );
};

interface MatrixCellProps {
  value: number;
  onChange: (val: number) => void;
  onPaste: (e: React.ClipboardEvent) => void;
  disabled?: boolean;
  type: 'qty' | 'value';
}

const MatrixCell: React.FC<MatrixCellProps> = ({ value, onChange, onPaste, disabled, type }) => {
  const [localValue, setLocalValue] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  // Ref to track if we should skip the next blur save (e.g. because we just pasted and blurred intentionally)
  const skipBlurRef = React.useRef(false);

  // Sync local state with prop value when NOT focused
  useEffect(() => {
    if (!isFocused) {
      // Format for display
      if (type === 'value') {
        setLocalValue(value ? value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '');
      } else {
        setLocalValue(value ? String(value) : '');
      }
    }
  }, [value, isFocused, type]);

  const handleBlur = () => {
    setIsFocused(false);

    if (skipBlurRef.current) {
      skipBlurRef.current = false;
      return;
    }

    let cleanVal = localValue.trim();
    if (cleanVal === '') {
      // Only trigger change if value is actually different from 0 which is default
      if (value !== 0) onChange(0);
      return;
    }

    cleanVal = cleanVal.replace('R$', '').trim();
    if (cleanVal.includes('.') && cleanVal.includes(',')) {
      cleanVal = cleanVal.replace(/\./g, '').replace(',', '.');
    } else if (cleanVal.includes(',')) {
      cleanVal = cleanVal.replace(',', '.');
    } else if (cleanVal.includes('.')) {
      cleanVal = cleanVal.replace(/\./g, '');
    }

    const num = parseFloat(cleanVal) || 0;
    if (num !== value) {
      onChange(num);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Basic filtering to prevent invalid chars but allow typing flow
    const valid = e.target.value;
    setLocalValue(valid);
  };

  const handlePasteInternal = (e: React.ClipboardEvent) => {
    // When pasting, we assume the parent 'onPaste' handles the data update (bulk).
    // The input's current localValue is 'stale' or incomplete.
    // We want to blur this input so it stops holding focus, and we want to prevent
    // handleBlur from saving the stale localValue over the new pasted data.

    skipBlurRef.current = true;
    onPaste(e);
    e.currentTarget.blur();
  };

  return (
    <input
      type="text"
      className="w-full h-full p-2 text-center outline-none focus:bg-blue-50 transition-colors"
      value={localValue}
      onChange={handleChange}
      onFocus={() => setIsFocused(true)}
      onBlur={handleBlur}
      onPaste={handlePasteInternal}
      disabled={disabled}
      placeholder={type === 'value' ? "0,00" : "0"}
    />
  );
};

export const IdealTable: React.FC = () => {
  const {
    sectors,
    requests,
    getMonthlyBudget,
    updateMonthlyBudget,
    getManualRealStat,
    updateManualRealStat,
    bulkUpdateMonthlyBudgets,
    bulkUpdateManualRealStats
  } = useApp();
  const [selectedYear, setSelectedYear] = useState(() => String(new Date().getFullYear()));
  const [selectedMonth, setSelectedMonth] = useState(() => String(new Date().getMonth() + 1).padStart(2, '0'));
  const [isProcessing, setIsProcessing] = useState(false);
  const [hasClipboard, setHasClipboard] = useState(false);
  const selectedMonthKey = `${selectedYear}-${selectedMonth}`;

  // Confirmation Modal State (to replace native confirm)
  const [showConfirmPaste, setShowConfirmPaste] = useState(false);
  const [pasteSourceMonth, setPasteSourceMonth] = useState('');
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error' | 'info', text: string } | null>(null);

  useEffect(() => {
    const checkClipboard = () => {
      try {
        const clipboardData = localStorage.getItem('ideal_clipboard');
        // Basic validation that it's a JSON string
        if (clipboardData && clipboardData.startsWith('{')) {
          setHasClipboard(true);
        } else {
          setHasClipboard(false);
        }
      } catch (e) {
        console.error('Error checking clipboard:', e);
        setHasClipboard(false);
      }
    };

    checkClipboard();
    // Also check when window gains focus (in case user copied in another tab)
    window.addEventListener('focus', checkClipboard);
    return () => window.removeEventListener('focus', checkClipboard);
  }, [selectedMonthKey]);

  // Field mapping for paste functionality order
  const fieldOrder = [
    'budgetQty',
    'budgetValue',
    'realQty',
    'afastadosQty',
    'apprenticesQty',
    'realValue'
  ];

  const handleBudgetChange = (sectorId: string, field: 'cltBudgetQty' | 'cltBudgetValue', value: string) => {
    const current = getMonthlyBudget(sectorId, selectedMonthKey);
    updateMonthlyBudget({
      ...current,
      [field]: parseFloat(value) || 0
    });
  };

  const handleRealChange = (sectorId: string, field: 'realQty' | 'realValue' | 'afastadosQty' | 'apprenticesQty', value: string) => {
    const current = getManualRealStat(sectorId, selectedMonthKey) || { sectorId, monthKey: selectedMonthKey, realQty: 0, realValue: 0 };
    updateManualRealStat({
      ...current,
      [field]: parseFloat(value) || 0
    });
  };

  // Copy Data to Local Clipboard (RESTRICTED TO REAL DATA)
  const handleCopyData = () => {
    setStatusMessage(null);
    try {
      // const budgetsToCopy: any[] = [];
      const statsToCopy: any[] = [];

      sectors.forEach(s => {
        // Budget Copy Disabled as per new requirement
        // const b = getMonthlyBudget(s.id, selectedMonthKey);
        // if (b.budgetQty > 0 || b.budgetValue > 0) {
        //   budgetsToCopy.push(b);
        // }

        const r = getManualRealStat(s.id, selectedMonthKey);
        if (r) {
          statsToCopy.push(r);
        }
      });

      if (statsToCopy.length === 0) {
        setStatusMessage({ type: 'info', text: 'Não há dados realizados neste mês para copiar.' });
        return;
      }

      const clipboardPayload = {
        sourceMonth: selectedMonthKey,
        budgets: [], // Empty for now
        stats: statsToCopy,
        timestamp: new Date().toISOString()
      };

      const jsonStr = JSON.stringify(clipboardPayload);
      localStorage.setItem('ideal_clipboard', jsonStr);
      console.log('Dados copiados para localStorage:', jsonStr.length, 'bytes');

      setHasClipboard(true);
      setStatusMessage({ type: 'success', text: `Realizado de ${selectedMonthKey} copiado!` });
    } catch (error) {
      console.error('Error copying data:', error);
      setStatusMessage({ type: 'error', text: 'Erro ao copiar dados: ' + (error as any).message });
    }
  };

  // Paste Data - Step 1: Check and Confirm
  const handlePasteDataClick = () => {
    setStatusMessage(null);
    try {
      const rawData = localStorage.getItem('ideal_clipboard');
      if (!rawData) {
        setStatusMessage({ type: 'error', text: 'Área de transferência vazia.' });
        return;
      }
      const clipboardData = JSON.parse(rawData);
      setPasteSourceMonth(clipboardData.sourceMonth);
      setShowConfirmPaste(true);
    } catch (e) {
      console.error('Error parsing clipboard:', e);
      setStatusMessage({ type: 'error', text: 'Dados da área de transferência inválidos.' });
    }
  };

  // Paste Data - Step 2: Execute
  const executePasteData = async () => {
    if (isProcessing) return;
    setIsProcessing(true);
    setShowConfirmPaste(false);
    setStatusMessage({ type: 'info', text: 'Colando dados Realizados, aguarde...' });

    try {
      const rawData = localStorage.getItem('ideal_clipboard');
      if (!rawData) throw new Error('Clipboard empty during execution');

      const clipboardData = JSON.parse(rawData);
      const { stats } = clipboardData; // Only extract stats (Real)

      // Prepare data for the current month
      const newStats = stats.map((s: any) => ({ ...s, monthKey: selectedMonthKey }));

      await Promise.all([
        // newBudgets.length > 0 ? bulkUpdateMonthlyBudgets(newBudgets) : Promise.resolve(),
        newStats.length > 0 ? bulkUpdateManualRealStats(newStats) : Promise.resolve()
      ]);

      setStatusMessage({ type: 'success', text: `Realizado de ${clipboardData.sourceMonth} colado em ${selectedMonthKey}!` });
    } catch (error) {
      console.error('Error pasting data:', error);
      setStatusMessage({ type: 'error', text: 'Erro ao colar dados: ' + (error as any).message });
    } finally {
      setIsProcessing(false);
    }
  };


  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>, startSectorIndex: number, startField: string) => {
    e.preventDefault();
    const clipboardData = e.clipboardData.getData('text');
    if (!clipboardData) return;

    const rows = clipboardData.split(/\r?\n/).filter(r => r.trim() !== '');
    const startFieldIndex = fieldOrder.indexOf(startField);
    if (startFieldIndex === -1) return;

    const updatesBySector: Record<string, any> = {};

    rows.forEach((rowStr, rowIndex) => {
      const targetSectorIndex = startSectorIndex + rowIndex;
      if (targetSectorIndex >= sectors.length) return;
      const sector = sectors[targetSectorIndex];

      if (!updatesBySector[sector.id]) {
        updatesBySector[sector.id] = {
          budget: { ...getMonthlyBudget(sector.id, selectedMonthKey) },
          real: { ...getManualRealStat(sector.id, selectedMonthKey) || { sectorId: sector.id, monthKey: selectedMonthKey, realQty: 0, realValue: 0 } }
        };
      }

      const cols = rowStr.split('\t');
      cols.forEach((val, colIndex) => {
        const targetFieldIndex = startFieldIndex + colIndex;
        if (targetFieldIndex >= fieldOrder.length) return;

        const targetField = fieldOrder[targetFieldIndex];
        let cleanVal = val.trim().replace('R$', '').trim();
        if (cleanVal.includes('.') && cleanVal.includes(',')) {
          cleanVal = cleanVal.replace(/\./g, '').replace(',', '.');
        } else if (cleanVal.includes(',')) {
          cleanVal = cleanVal.replace(',', '.');
        }
        const numVal = parseFloat(cleanVal) || 0;

        if (targetField === 'budgetQty') {
          updatesBySector[sector.id].budget.cltBudgetQty = numVal;
        } else if (targetField === 'budgetValue') {
          updatesBySector[sector.id].budget.cltBudgetValue = numVal;
        } else {
          updatesBySector[sector.id].real[targetField] = numVal;
        }
      });
    });

    Object.keys(updatesBySector).forEach(sectorId => {
      const updateData = updatesBySector[sectorId];
      updateMonthlyBudget(updateData.budget);
      updateManualRealStat(updateData.real);
    });

    setStatusMessage({ type: 'success', text: 'Dados colados via Excel.' });
  };

  // Matrix Logic for Annual Budget
  const months = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'];

  const handleMatrixPaste = (e: React.ClipboardEvent, startSectorIndex: number, startMonthIndex: number, type: 'qty' | 'value') => {
    e.preventDefault();

    if (!isAdminUnlocked) {
      alert('Modo Admin bloqueado. Clique no cadeado para desbloquear.');
      return;
    }

    // Try to get data
    const clipboardData = e.clipboardData.getData('text');
    if (!clipboardData) {
      console.warn('Clipboard text is empty');
      alert('Não foi possível ler dados da área de transferência.');
      return;
    }

    // Clean data
    const rows = clipboardData.replace(/"/g, '').split(/\r?\n/).filter(line => line.trim() !== '');
    if (rows.length === 0) {
      alert('Nenhum dado encontrado para colar.');
      return;
    }

    setStatusMessage({ type: 'info', text: 'Processando colagem...' });
    const updates: any[] = [];
    let cellCount = 0;

    rows.forEach((rowStr, rowIndex) => {
      const currentSectorIndex = startSectorIndex + rowIndex;
      if (currentSectorIndex >= sectors.length) return;
      const sector = sectors[currentSectorIndex];

      const cols = rowStr.split('\t');
      cols.forEach((val, colIndex) => {
        const currentMonthIndex = startMonthIndex + colIndex;
        if (currentMonthIndex >= 12) return;

        const month = months[currentMonthIndex];
        const monthKey = `${selectedYear}-${month}`;

        let cleanVal = val.trim().replace('R$', '').trim();

        // Robust Brazilian Currency Parsing
        if (cleanVal.includes('.') && cleanVal.includes(',')) {
          // Format: 1.234,56 -> Remove dots, replace comma with dot
          cleanVal = cleanVal.replace(/\./g, '').replace(',', '.');
        } else if (cleanVal.includes(',')) {
          // Format: 1234,56 -> Replace comma with dot
          cleanVal = cleanVal.replace(',', '.');
        } else if (cleanVal.includes('.')) {
          // Safest bet for pt-BR user: Remove dots (thousands).
          cleanVal = cleanVal.replace(/\./g, '');
        }

        const numVal = parseFloat(cleanVal) || 0;
        const currentBudget = getMonthlyBudget(sector.id, monthKey);

        updates.push({
          ...currentBudget,
          [type === 'qty' ? 'cltBudgetQty' : 'cltBudgetValue']: numVal,
          monthKey
        });
        cellCount++;
      });
    });

    if (updates.length > 0) {
      // De-duplicate updates (last one wins)
      const uniqueUpdates: Record<string, any> = {};
      updates.forEach(u => {
        uniqueUpdates[`${u.sectorId}_${u.monthKey}`] = u;
      });

      bulkUpdateMonthlyBudgets(Object.values(uniqueUpdates))
        .then(() => {
          setStatusMessage({ type: 'success', text: `${cellCount} valores colados com sucesso!` });
        })
        .catch(err => {
          console.error(err);
          setStatusMessage({ type: 'error', text: 'Erro ao salvar colagem.' });
        });
    }
  };

  const stats = sectors.map(s => {
    const budget = getMonthlyBudget(s.id, selectedMonthKey);
    const manualReal = getManualRealStat(s.id, selectedMonthKey);

    // Calculate actual real from requests if no manual override exists
    const calculatedRealQty = requests
      .filter(r => r.sector === s.name && r.dateEvent.startsWith(selectedMonthKey) && r.status === 'Aprovado')
      .reduce((sum, r) => sum + r.extrasQty, 0);

    const calculatedRealValue = requests
      .filter(r => r.sector === s.name && r.dateEvent.startsWith(selectedMonthKey) && r.status === 'Aprovado')
      .reduce((sum, r) => sum + (r.totalValue || 0), 0);

    // Use manual override if available, otherwise calculated
    const realQty = manualReal ? manualReal.realQty : calculatedRealQty;
    const realValue = manualReal ? manualReal.realValue : calculatedRealValue;
    const afastadosQty = manualReal?.afastadosQty || 0;
    const apprenticesQty = manualReal?.apprenticesQty || 0;

    const activeRealQty = realQty - afastadosQty - apprenticesQty;
    const diffQty = activeRealQty - (budget.cltBudgetQty || 0);
    const diffValue = realValue - (budget.cltBudgetValue || 0);
    const diffPercent = (budget.cltBudgetValue || 0) > 0 ? (diffValue / (budget.cltBudgetValue || 0)) * 100 : 0;

    return {
      sectorId: s.id,
      sectorName: s.name,
      budgetQty: budget.cltBudgetQty || 0,
      budgetValue: budget.cltBudgetValue || 0,
      realQty,
      realValue,
      afastadosQty,
      apprenticesQty,
      diffQty,
      diffValue,
      diffPercent,
      isManual: !!manualReal
    };
  });

  const totals = stats.reduce((acc, curr) => ({
    budgetQty: acc.budgetQty + curr.budgetQty,
    budgetValue: acc.budgetValue + curr.budgetValue,
    realQty: acc.realQty + curr.realQty,
    realValue: acc.realValue + curr.realValue,
    afastadosQty: acc.afastadosQty + curr.afastadosQty,
    apprenticesQty: acc.apprenticesQty + curr.apprenticesQty,
    diffQty: acc.diffQty + curr.diffQty,
    diffValue: acc.diffValue + curr.diffValue,
  }), { budgetQty: 0, budgetValue: 0, realQty: 0, realValue: 0, afastadosQty: 0, apprenticesQty: 0, diffQty: 0, diffValue: 0 });

  const totalDiffPercent = totals.budgetValue > 0 ? (totals.diffValue / totals.budgetValue) * 100 : 0;

  // Check if admin is unlocked via PIN in this session
  const isAdminUnlocked = sessionStorage.getItem('admin_unlocked') === 'true';

  return (
    <div className="flex flex-col gap-8">
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden relative">
        {/* Custom Confirmation Modal */}
        {showConfirmPaste && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm p-4">
            <div className="bg-white rounded-lg shadow-xl p-6 max-w-sm w-full border-t-4 border-[#155645] animate-in fade-in zoom-in duration-200">
              <h3 className="text-lg font-bold text-slate-800 mb-2 flex items-center gap-2">
                <AlertTriangle className="text-orange-500" size={24} />
                Confirmar Colagem (REALIZADO)
              </h3>
              <p className="text-slate-600 mb-6 text-sm">
                Você está prestes a colar dados <strong>REALIZADOS</strong> de <strong>{pasteSourceMonth}</strong> em <strong>{selectedMonthKey}</strong>.
                <br /><br />
                Isso substituirá apenas os dados manuais de Real (Qtd e Valor). O Orçado não será afetado. Deseja continuar?
              </p>
              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => setShowConfirmPaste(false)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg text-sm font-medium transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={executePasteData}
                  className="px-4 py-2 bg-[#155645] hover:bg-[#104033] text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
                >
                  Sim, Colar Realizado
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-4">
              <h2 className="text-lg font-bold text-slate-800">Quadro Orçado x Realizado</h2>
              <div className="flex items-center gap-2 bg-white border border-slate-300 rounded-lg px-3 py-1.5 focus-within:ring-2 focus-within:ring-[#155645]">
                <Calendar size={16} className="text-[#155645]" />
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(e.target.value)}
                  className="text-sm outline-none text-slate-700 bg-transparent"
                >
                  {[2024, 2025, 2026, 2027, 2028, 2029, 2030].map(y => <option key={y} value={String(y)}>{y}</option>)}
                </select>
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="text-sm outline-none text-slate-700 bg-transparent"
                >
                  {['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'].map(m => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>
            </div>
            {statusMessage && (
              <div className={`text-xs ml-1 flex items-center gap-1.5 ${statusMessage.type === 'success' ? 'text-green-600' :
                statusMessage.type === 'error' ? 'text-red-500' : 'text-blue-500'
                }`}>
                {statusMessage.type === 'success' && <Check size={12} />}
                {statusMessage.text}
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            {isAdminUnlocked && (
              <>
                <button
                  onClick={handleCopyData}
                  className="flex items-center gap-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 px-4 py-2 rounded-lg text-sm transition-colors"
                  title="Copiar dados REALIZADOS deste mês"
                >
                  <Copy size={16} />
                  Copiar Realizado
                </button>

                {hasClipboard && (
                  <button
                    onClick={handlePasteDataClick}
                    disabled={isProcessing}
                    className={`flex items-center gap-2 bg-[#155645] hover:bg-[#104033] text-white px-4 py-2 rounded-lg text-sm transition-colors ${isProcessing ? 'opacity-50 cursor-not-allowed' : ''
                      }`}
                    title="Colar dados REALIZADOS"
                  >
                    <ClipboardPaste size={16} className={isProcessing ? 'animate-spin' : ''} />
                    {isProcessing ? 'Colando...' : 'Colar Realizado'}
                  </button>
                )}
              </>
            )}
          </div>
        </div>

        <div className="overflow-x-auto border border-slate-300 rounded-lg">
          <table className="w-full text-sm text-right border-collapse">
            <thead className="bg-slate-100 text-slate-600 uppercase text-xs sticky top-0 z-10 shadow-sm font-bold">
              <tr>
                <th className="p-2 border border-slate-300 text-left sticky left-0 z-20 bg-slate-100">Setor</th>
                <th className="p-2 border border-slate-300 bg-slate-200/50">Qtd Orçada</th>
                <th className="p-2 border border-slate-300 bg-slate-200/50">Salário Orçado</th>
                <th className="p-2 border border-slate-300">Qtd Real (CLT)</th>
                <th className="p-2 border border-slate-300 text-orange-700">Afastados</th>
                <th className="p-2 border border-slate-300 text-blue-700">Jovem Ap.</th>
                <th className="p-2 border border-slate-300">Salário Real</th>
                <th className="p-2 border border-slate-300 text-center">Dif. Qtd</th>
                <th className="p-2 border border-slate-300 text-center">Dif. Valor</th>
                <th className="p-2 border border-slate-300 text-center">Dif. % Valor</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {stats.map((row, index) => (
                <tr key={row.sectorId} className="hover:bg-blue-50/30 transition-colors">
                  <td className="p-2 text-left font-bold text-slate-700 border border-slate-300 bg-slate-50/50 sticky left-0 z-10">{row.sectorName}</td>

                  {/* Orçado */}
                  <td className="p-0 border border-slate-300 bg-slate-50/50">
                    <input
                      type="number"
                      className="w-full h-full p-2 text-right outline-none focus:bg-blue-50 transition-colors"
                      value={row.budgetQty}
                      onChange={(e) => handleBudgetChange(row.sectorId, 'cltBudgetQty', e.target.value)}
                      onPaste={(e) => handlePaste(e, index, 'budgetQty')}
                    // disabled={!isAdminUnlocked} // Allowing edit in top table too, why not
                    />
                  </td>
                  <td className="p-0 border border-slate-300 bg-slate-50/50 relative group">
                    <CurrencyInput
                      value={row.budgetValue}
                      onChange={(val) => handleBudgetChange(row.sectorId, 'cltBudgetValue', val)}
                      onPaste={(e) => handlePaste(e, index, 'budgetValue')}
                    />
                  </td>

                  {/* Real & Adjustments */}
                  <td className="p-0 border border-slate-300">
                    <input
                      type="number"
                      className={`w-full h-full p-2 text-right outline-none focus:bg-blue-50 transition-colors ${row.isManual ? 'bg-orange-50/50' : ''}`}
                      value={row.realQty}
                      onChange={(e) => handleRealChange(row.sectorId, 'realQty', e.target.value)}
                      onPaste={(e) => handlePaste(e, index, 'realQty')}
                      disabled={!isAdminUnlocked}
                    />
                  </td>
                  <td className="p-0 border border-slate-300 bg-orange-50/20">
                    <input
                      type="number"
                      className="w-full h-full p-2 text-right outline-none focus:bg-orange-100/50 transition-colors text-orange-800"
                      value={row.afastadosQty}
                      onChange={(e) => handleRealChange(row.sectorId, 'afastadosQty', e.target.value)}
                      onPaste={(e) => handlePaste(e, index, 'afastadosQty')}
                      disabled={!isAdminUnlocked}
                    />
                  </td>
                  <td className="p-0 border border-slate-300 bg-blue-50/20">
                    <input
                      type="number"
                      className="w-full h-full p-2 text-right outline-none focus:bg-blue-100/50 transition-colors text-blue-800"
                      value={row.apprenticesQty}
                      onChange={(e) => handleRealChange(row.sectorId, 'apprenticesQty', e.target.value)}
                      onPaste={(e) => handlePaste(e, index, 'apprenticesQty')}
                      disabled={!isAdminUnlocked}
                    />
                  </td>
                  <td className="p-0 border border-slate-300">
                    <input
                      type="number"
                      step="0.01"
                      className={`w-full h-full p-2 text-right outline-none focus:bg-blue-50 transition-colors font-medium ${row.isManual ? 'bg-orange-50/50' : ''}`}
                      value={row.realValue}
                      onChange={(e) => handleRealChange(row.sectorId, 'realValue', e.target.value)}
                      onPaste={(e) => handlePaste(e, index, 'realValue')}
                      disabled={!isAdminUnlocked}
                    />
                  </td>

                  {/* Differences */}
                  <td className="p-2 text-center border border-slate-300 bg-slate-50/30">
                    <span className={`font-bold ${row.diffQty <= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {row.diffQty > 0 ? '+' : ''}{row.diffQty}
                    </span>
                  </td>
                  <td className="p-2 text-center border border-slate-300 bg-slate-50/30">
                    <span className={`px-2 py-0.5 rounded text-xs font-bold ${row.diffValue <= 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                      }`}>
                      R$ {row.diffValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </span>
                  </td>
                  <td className="p-2 text-center border border-slate-300 bg-slate-50/30">
                    <span className={`font-bold text-xs ${row.diffPercent <= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {row.diffPercent > 0 ? '+' : ''}{row.diffPercent.toFixed(1)}%
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-slate-100 font-bold border-t-2 border-slate-400">
              <tr>
                <td className="p-2 text-left border border-slate-300">TOTAL</td>
                <td className="p-2 border border-slate-300">{totals.budgetQty}</td>
                <td className="p-2 border border-slate-300">R$ {totals.budgetValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                <td className="p-2 border border-slate-300">{totals.realQty}</td>
                <td className="p-2 border border-slate-300 text-orange-700">{totals.afastadosQty}</td>
                <td className="p-2 border border-slate-300 text-blue-700">{totals.apprenticesQty}</td>
                <td className="p-2 border border-slate-300">R$ {totals.realValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                <td className="p-2 text-center border border-slate-300">
                  <span className={totals.diffQty <= 0 ? 'text-green-600' : 'text-red-600'}>
                    {totals.diffQty}
                  </span>
                </td>
                <td className="p-2 text-center border border-slate-300">
                  <span className={totals.diffValue <= 0 ? 'text-green-600' : 'text-red-600'}>
                    R$ {totals.diffValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </span>
                </td>
                <td className="p-2 text-center border border-slate-300">
                  <span className={totalDiffPercent <= 0 ? 'text-green-600' : 'text-red-600'}>
                    {totalDiffPercent > 0 ? '+' : ''}{totalDiffPercent.toFixed(1)}%
                  </span>
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
        <div className="p-2 text-xs text-slate-400 text-center bg-slate-50 border-t border-slate-200">
          * Cálculo: (Real - Afastados - Jovens) - Orçado. Negativo (Verde) = Vagas/Economia. Positivo (Vermelho) = Excedente.
          <br />
          ** Dica: Para colar do Excel (Realizado), use os botões acima. Para Orçado (Anual), use as tabelas abaixo.
        </div>
      </div>

      {/* NEW BUDGET MATRIX TABLES */}
      <div className="grid grid-cols-1 gap-6">
        {/* Quantity Table */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 bg-slate-50">
            <h2 className="text-lg font-bold text-slate-800">Matriz de Quantidade Orçada (Anual) - {selectedYear}</h2>
            <p className="text-xs text-slate-500 mt-1">Cole aqui os dados do Excel (Setores na vertical, Meses na horizontal)</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-right border-collapse">
              <thead className="bg-slate-100 text-slate-600 uppercase text-xs">
                <tr>
                  <th className="p-2 border border-slate-300 text-left sticky left-0 z-10 bg-slate-100 w-48">Setor</th>
                  {months.map(m => (
                    <th key={m} className="p-2 border border-slate-300 min-w-[60px] text-center">{m}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sectors.map((s, sectIdx) => (
                  <tr key={s.id} className="hover:bg-slate-50">
                    <td className="p-2 text-left font-bold text-slate-700 border border-slate-300 sticky left-0 z-10 bg-white">{s.name}</td>
                    {months.map((m, monthIdx) => {
                      const budget = getMonthlyBudget(s.id, `${selectedYear}-${m}`);
                      return (
                        <td key={m} className="p-0 border border-slate-300">
                          <MatrixCell
                            value={budget.cltBudgetQty || 0}
                            onChange={(val) => updateMonthlyBudget({ ...budget, cltBudgetQty: val })}
                            onPaste={(e) => handleMatrixPaste(e, sectIdx, monthIdx, 'qty')}
                            disabled={!isAdminUnlocked}
                            type="qty"
                          />
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Value Table */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 bg-slate-50">
            <h2 className="text-lg font-bold text-slate-800">Matriz de Salário Orçado (Anual) - {selectedYear}</h2>
            <p className="text-xs text-slate-500 mt-1">Cole aqui os valores do Excel (Setores na vertical, Meses na horizontal)</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-right border-collapse">
              <thead className="bg-slate-100 text-slate-600 uppercase text-xs">
                <tr>
                  <th className="p-2 border border-slate-300 text-left sticky left-0 z-10 bg-slate-100 w-48">Setor</th>
                  {months.map(m => (
                    <th key={m} className="p-2 border border-slate-300 min-w-[80px] text-center">{m}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sectors.map((s, sectIdx) => (
                  <tr key={s.id} className="hover:bg-slate-50">
                    <td className="p-2 text-left font-bold text-slate-700 border border-slate-300 sticky left-0 z-10 bg-white">{s.name}</td>
                    {months.map((m, monthIdx) => {
                      const budget = getMonthlyBudget(s.id, `${selectedYear}-${m}`);
                      return (
                        <td key={m} className="p-0 border border-slate-300">
                          <MatrixCell
                            value={budget.cltBudgetValue || 0}
                            onChange={(val) => updateMonthlyBudget({ ...budget, cltBudgetValue: val })}
                            onPaste={(e) => handleMatrixPaste(e, sectIdx, monthIdx, 'value')}
                            disabled={!isAdminUnlocked}
                            type="value"
                          />
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};