import React, { useState, useEffect } from 'react';
import { useApp } from '../context';
import { Save, Calendar, Copy, ArrowDownToLine } from 'lucide-react';

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
  const isAdminUnlockedOnce = sessionStorage.getItem('admin_unlocked') === 'true';
  const selectedMonthKey = `${selectedYear}-${selectedMonth}`;

  useEffect(() => {
    console.log('[IdealTable] mounted with selectedMonthKey:', selectedMonthKey);
    console.log('[IdealTable] isAdminUnlockedOnce:', isAdminUnlockedOnce);
    window.alert(`IdealTable montado. Admin unlocked: ${isAdminUnlockedOnce}`);
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

  const handleBudgetChange = (sectorId: string, field: 'budgetQty' | 'budgetValue', value: string) => {
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

  // Replicate data from Previous Month
  const handleReplicatePrevious = async () => {
    try {
      if (!window.confirm('Isso irá sobrescrever os dados atuais com os orçados e reais do mês anterior. Deseja continuar?')) return;

      const [y, m] = selectedMonthKey.split('-').map(Number);
      const prevDate = new Date(y, m - 2, 1);
      const prevMonth = String(prevDate.getMonth() + 1).padStart(2, '0');
      const prevYear = prevDate.getFullYear();
      const prevMonthKey = `${prevYear}-${prevMonth}`;

      const newBudgets: any[] = [];
      const newRealStats: any[] = [];

      sectors.forEach(s => {
        // 1. Replicate Budget
        const prevBudget = getMonthlyBudget(s.id, prevMonthKey);
        if (prevBudget.budgetQty > 0 || prevBudget.budgetValue > 0) {
          newBudgets.push({
            ...prevBudget,
            monthKey: selectedMonthKey
          });
        }

        // 2. Replicate Real Stats (Manual overrides / CLT data)
        const prevReal = getManualRealStat(s.id, prevMonthKey);
        if (prevReal) {
          newRealStats.push({
            ...prevReal,
            monthKey: selectedMonthKey
          });
        }
      });

      if (newBudgets.length === 0 && newRealStats.length === 0) {
        alert('Nenhum dado encontrado no mês anterior para replicar.');
        return;
      }

      // Replicate data from Previous Month
      const handleReplicatePrevious = async () => {
        try {
          if (!window.confirm('Isso irá copiar os dados do mês anterior para o mês atual. Deseja continuar?')) return;

          const [y, m] = selectedMonthKey.split('-').map(Number);
          const prevDate = new Date(y, m - 2, 1);
          const prevMonthKey = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`;

          const newBudgets: any[] = [];
          const newRealStats: any[] = [];

          sectors.forEach(s => {
            // Replicate Budget (only if not default/empty)
            const prevBudget = getMonthlyBudget(s.id, prevMonthKey);
            if (prevBudget.budgetQty > 0 || prevBudget.budgetValue > 0) {
              newBudgets.push({ ...prevBudget, monthKey: selectedMonthKey });
            }

            // Replicate Real Stats
            const prevReal = getManualRealStat(s.id, prevMonthKey);
            if (prevReal) {
              newRealStats.push({ ...prevReal, monthKey: selectedMonthKey });
            }
          });

          if (newBudgets.length === 0 && newRealStats.length === 0) {
            alert('Nenhum dado encontrado no mês anterior para replicar.');
            return;
          }

          await Promise.all([
            newBudgets.length > 0 ? bulkUpdateMonthlyBudgets(newBudgets) : Promise.resolve(),
            newRealStats.length > 0 ? bulkUpdateManualRealStats(newRealStats) : Promise.resolve()
          ]);

          alert(`Dados de ${prevMonthKey} replicados com sucesso! A página será atualizada.`);
          window.location.reload();
        } catch (error) {
          console.error('[Replicate] Erro:', error);
          alert('Erro ao replicar dados.');
        }
      };

      const handleSave = () => {
        // As inputs use updateMonthlyBudget/updateManualRealStat in real-time,
        // this button serves as a final confirmation/validation for the user.
        alert('As alterações foram persistidas com sucesso no banco de dados.');
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

        // IMPROVED LOGIC: Process per Sector to avoid state overwrite race conditions
        // We group values by sector first.
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

            if (targetField === 'budgetQty' || targetField === 'budgetValue') {
              updatesBySector[sector.id].budget[targetField] = numVal;
            } else {
              updatesBySector[sector.id].real[targetField] = numVal;
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
          console.log('Paste processed');
          alert('Dados colados com sucesso.');
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
            <div className="flex items-center gap-2">
              {true && (
                <>
                  <button
                    onClick={handleReplicatePrevious}
                    className="flex items-center gap-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 px-4 py-2 rounded-lg text-sm transition-colors"
                    title="Copiar dados do mês anterior"
                  >
                    <Copy size={16} />
                    Replicar Mês Ant.
                  </button>
                  <button
                    onClick={handleSave}
                    className="flex items-center gap-2 bg-[#155645] hover:bg-[#104033] text-white px-4 py-2 rounded-lg text-sm transition-colors"
                  >
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