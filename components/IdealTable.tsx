import React, { useState } from 'react';
import { useApp } from '../context';
import { Save, Calendar, Copy, ArrowDownToLine } from 'lucide-react';

export const IdealTable: React.FC = () => {
  const { sectors, requests, getMonthlyBudget, updateMonthlyBudget, getManualRealStat, updateManualRealStat } = useApp();
  const [selectedYear, setSelectedYear] = useState(() => String(new Date().getFullYear()));
  const [selectedMonth, setSelectedMonth] = useState(() => String(new Date().getMonth() + 1).padStart(2, '0'));
  const selectedMonthKey = `${selectedYear}-${selectedMonth}`;

  // Field mapping for paste functionality order
  const fieldOrder = [
    'budgetQty',
    'budgetValue',
    'realQty',
    'afastadosQty',
    'apprenticesQty',
    'realValue'
  ];

  const handleBudgetChange = (sectorId: string, field: 'budgetQty' | 'budgetValue', value: string) => {
    const current = getMonthlyBudget(sectorId, selectedMonth);
    updateMonthlyBudget({
      ...current,
      [field]: parseFloat(value) || 0
    });
  };

  const handleRealChange = (sectorId: string, field: 'realQty' | 'realValue' | 'afastadosQty' | 'apprenticesQty', value: string) => {
    const current = getManualRealStat(sectorId, selectedMonth) || { sectorId, monthKey: selectedMonth, realQty: 0, realValue: 0 };
    updateManualRealStat({
      ...current,
      [field]: parseFloat(value) || 0
    });
  };

  // Replicate data from Previous Month
  const handleReplicatePrevious = () => {
    if (!confirm('Isso irá sobrescrever os dados atuais com os do mês anterior. Deseja continuar?')) return;

    const [y, m] = selectedMonth.split('-').map(Number);
    // Calculate previous month date
    const prevDate = new Date(y, m - 2, 1); // Month is 0-indexed in Date constructor (m-1 is current, m-2 is prev)
    const prevMonthKey = prevDate.toISOString().slice(0, 7);

    let updatedCount = 0;

    sectors.forEach(s => {
      // 1. Replicate Budget
      const prevBudget = getMonthlyBudget(s.id, prevMonthKey);
      if (prevBudget.budgetQty > 0 || prevBudget.budgetValue > 0) {
        updateMonthlyBudget({
          sectorId: s.id,
          monthKey: selectedMonth,
          budgetQty: prevBudget.budgetQty,
          budgetValue: prevBudget.budgetValue
        });
        updatedCount++;
      }

      // 2. Replicate Real Stats (Manual Overrides)
      const prevReal = getManualRealStat(s.id, prevMonthKey);
      if (prevReal) {
        updateManualRealStat({
          sectorId: s.id,
          monthKey: selectedMonth,
          realQty: prevReal.realQty,
          realValue: prevReal.realValue,
          afastadosQty: prevReal.afastadosQty,
          apprenticesQty: prevReal.apprenticesQty
        });
        updatedCount++;
      }
    });

    alert(`Dados replicados de ${prevMonthKey} com sucesso!`);
  };

  // Handle Paste from Excel
  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>, startSectorIndex: number, startField: string) => {
    e.preventDefault();
    const clipboardData = e.clipboardData.getData('text');
    if (!clipboardData) return;

    const rows = clipboardData.split(/\r?\n/).filter(r => r.trim() !== '');
    const startFieldIndex = fieldOrder.indexOf(startField);

    if (startFieldIndex === -1) return;

    let changesMade = 0;

    rows.forEach((rowStr, rowIndex) => {
      const targetSectorIndex = startSectorIndex + rowIndex;
      if (targetSectorIndex >= sectors.length) return; // Out of bounds

      const sector = sectors[targetSectorIndex];
      const cols = rowStr.split('\t');

      cols.forEach((val, colIndex) => {
        const targetFieldIndex = startFieldIndex + colIndex;
        if (targetFieldIndex >= fieldOrder.length) return; // Out of bounds columns

        const targetField = fieldOrder[targetFieldIndex];

        // Clean value (handle currency format R$ 1.000,00 -> 1000.00)
        let cleanVal = val.trim().replace('R$', '').trim();
        // If it has comma and dot, assume dot is thousands separator if it comes before comma
        if (cleanVal.includes('.') && cleanVal.includes(',')) {
          cleanVal = cleanVal.replace(/\./g, '').replace(',', '.');
        } else if (cleanVal.includes(',')) {
          cleanVal = cleanVal.replace(',', '.');
        }

        const numVal = parseFloat(cleanVal) || 0;

        // Determine if it's Budget or Real update
        if (targetField === 'budgetQty' || targetField === 'budgetValue') {
          // It's a budget update, need to fetch current state first or just update partial?
          // We can't easily fetch current state inside loop without race conditions if we rely on state hooks directly in loop.
          // However, context updates are usually state setters.
          // A safer way is to fetch the object, modify it.
          const currentBudget = getMonthlyBudget(sector.id, selectedMonth);
          // Since getMonthlyBudget returns a value from state at render time, 
          // multiple updates in a loop might overwrite each other if we use the same 'currentBudget' object reference 
          // without merging. But here we are updating different fields or different sectors.
          // To be safe, we just fire the update. The context implementation should handle object merging or replacement.
          // Based on context.tsx: setMonthlyBudgets(prev => ({ ...prev, [key]: data }));
          // So we need to provide the FULL object.

          // Hack: Since we can't see "pending" updates in this loop, we might have issues if pasting 
          // BudgetQty AND BudgetValue in the same row simultaneously.
          // We will update individually. Ideally the context setter should use functional update merging.
          // For now, let's assume the user pastes columns.

          // Re-fetching inside the loop isn't possible, so we use a strategy:
          // We will fire the update. If React batches, we might lose one field if we don't merge locally.
          // Let's rely on the fact that usually we paste a block.

          // NOTE: To fix the potential overwrite of `budgetQty` when updating `budgetValue` in the same batch,
          // we really should use a more robust store. But for this specific app structure:
          // The context `updateMonthlyBudget` replaces the whole object for that key.
          // We need to merge with what we *think* is the latest. 
          // Since we can't, we will do a trick: We trigger the update.

          // For this specific UI, let's assume standard behavior.
          // If we want to support multi-column paste robustly, we'd need a bulk update method in context.
          // We'll proceed with individual updates hoping React 18 auto-batching helps, 
          // OR we accept that updating cols 1 and 2 might race.
          // *Correction*: In the Context, `setMonthlyBudgets` uses `...prev`. 
          // BUT it replaces the value for `key`. `[key]: data`.
          // If I call update twice for same key, the second one overwrites the first one if it doesn't contain the first's changes.
          // Since `currentBudget` is const from render start, it is stale for the second call.

          // Workaround: We can't solve the state race condition easily without refactoring Context to support patch/merge.
          // However, for pasting, usually users paste one column or block.
          // If pasting a block, we can construct the final object for the sector.

          // Let's implement a local merge for the row.

          // Note: This logic assumes we process row by row.
        }
      });
    });

    // IMPROVED LOGIC: Process per Sector to avoid state overwrite race conditions
    // We group values by sector first.
    const updatesBySector: Record<string, any> = {};

    rows.forEach((rowStr, rowIndex) => {
      const targetSectorIndex = startSectorIndex + rowIndex;
      if (targetSectorIndex >= sectors.length) return;
      const sector = sectors[targetSectorIndex];

      if (!updatesBySector[sector.id]) {
        updatesBySector[sector.id] = {
          budget: { ...getMonthlyBudget(sector.id, selectedMonth) },
          real: { ...getManualRealStat(sector.id, selectedMonth) || { sectorId: sector.id, monthKey: selectedMonth, realQty: 0, realValue: 0 } }
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

        if (targetField === 'budgetQty' || targetField === 'budgetValue') {
          updatesBySector[sector.id].budget[targetField] = numVal;
        } else {
          updatesBySector[sector.id].real[targetField] = numVal;
          // Also ensure defaults exist for real
          if (targetField === 'realQty' || targetField === 'realValue') {
            // handled
          }
        }
      });
    });

    // Apply updates
    Object.keys(updatesBySector).forEach(sectorId => {
      const updateData = updatesBySector[sectorId];
      updateMonthlyBudget(updateData.budget);
      updateManualRealStat(updateData.real);
      changesMade++;
    });

    if (changesMade > 0) {
      // Optional: Toast or simple console log
      console.log('Paste processed');
    }
  };

  const stats = sectors.map(s => {
    const budget = getMonthlyBudget(s.id, selectedMonth);
    const manualReal = getManualRealStat(s.id, selectedMonth);

    // Calculate actual real from requests if no manual override exists
    const calculatedRealQty = requests
      .filter(r => r.sector === s.name && r.dateEvent.startsWith(selectedMonth) && r.status === 'Aprovado')
      .reduce((sum, r) => sum + r.extrasQty, 0);

    const calculatedRealValue = requests
      .filter(r => r.sector === s.name && r.dateEvent.startsWith(selectedMonth) && r.status === 'Aprovado')
      .reduce((sum, r) => sum + (r.totalValue || 0), 0);

    // Use manual override if available, otherwise calculated
    const realQty = manualReal ? manualReal.realQty : calculatedRealQty;
    const realValue = manualReal ? manualReal.realValue : calculatedRealValue;
    const afastadosQty = manualReal?.afastadosQty || 0;
    const apprenticesQty = manualReal?.apprenticesQty || 0;

    const activeRealQty = realQty - afastadosQty - apprenticesQty;
    const diffQty = activeRealQty - budget.budgetQty;
    const diffValue = realValue - budget.budgetValue;
    const diffPercent = budget.budgetValue > 0 ? (diffValue / budget.budgetValue) * 100 : 0;

    return {
      sectorId: s.id,
      sectorName: s.name,
      budgetQty: budget.budgetQty,
      budgetValue: budget.budgetValue,
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
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
        <div className="flex items-center gap-4">
          <h2 className="text-lg font-bold text-slate-800">Quadro Ideal x Realizado</h2>
          <div className="flex items-center gap-2 bg-white border border-slate-300 rounded-lg px-3 py-1.5 focus-within:ring-2 focus-within:ring-[#155645]">
            <Calendar size={16} className="text-[#155645]" />
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              className="text-sm outline-none text-slate-700 bg-transparent"
            >
              {[2024, 2025, 2026, 2027].map(y => <option key={y} value={String(y)}>{y}</option>)}
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
        <div className="flex items-center gap-2">
          {isAdminUnlocked && (
            <>
              <button
                onClick={handleReplicatePrevious}
                className="flex items-center gap-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 px-4 py-2 rounded-lg text-sm transition-colors"
                title="Copiar dados do mês anterior"
              >
                <Copy size={16} />
                Replicar Mês Ant.
              </button>
              <button className="flex items-center gap-2 bg-[#155645] hover:bg-[#104033] text-white px-4 py-2 rounded-lg text-sm transition-colors">
                <Save size={16} />
                Salvar Alterações
              </button>
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
                    onChange={(e) => handleBudgetChange(row.sectorId, 'budgetQty', e.target.value)}
                    onPaste={(e) => handlePaste(e, index, 'budgetQty')}
                    disabled={!isAdminUnlocked}
                  />
                </td>
                <td className="p-0 border border-slate-300 bg-slate-50/50">
                  <input
                    type="number"
                    step="0.01"
                    className="w-full h-full p-2 text-right outline-none focus:bg-blue-50 transition-colors font-medium"
                    value={row.budgetValue}
                    onChange={(e) => handleBudgetChange(row.sectorId, 'budgetValue', e.target.value)}
                    onPaste={(e) => handlePaste(e, index, 'budgetValue')}
                    disabled={!isAdminUnlocked}
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
        ** Dica: Você pode copiar dados do Excel e colar diretamente nos campos numéricos para preenchimento em massa.
      </div>
    </div>
  );
};