import React, { useState, useMemo, useEffect } from 'react';
import { useApp } from '../context';
import { Calendar, Filter, BarChart3, DollarSign, Users, Activity } from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  LabelList,
  ReferenceLine,
  Label
} from 'recharts';

interface BudgetCellProps {
  value: number;
  onChange: (val: string) => void;
  onPaste?: (e: React.ClipboardEvent) => void;
  step?: string;
  placeholder?: string;
  className?: string;
}

const BudgetCell: React.FC<BudgetCellProps> = ({ value, onChange, onPaste, step, placeholder, className }) => {
  const [localValue, setLocalValue] = useState(value?.toString() || '');
  const [isFocused, setIsFocused] = useState(false);

  useEffect(() => {
    if (!isFocused) {
      setLocalValue(value?.toString() || '');
    }
  }, [value, isFocused]);

  const handleBlur = () => {
    setIsFocused(false);
    if (localValue !== value?.toString()) {
      onChange(localValue);
    }
  };

  return (
    <input
      type="number"
      step={step}
      placeholder={placeholder}
      className={className}
      value={localValue}
      onChange={(e) => setLocalValue(e.target.value)}
      onBlur={handleBlur}
      onFocus={() => setIsFocused(true)}
      onPaste={onPaste}
    />
  );
};

interface WfoCellProps {
  value: number;
  onSave: (val: number) => void;
  isIndex?: boolean;
}

const WfoCell: React.FC<WfoCellProps> = ({ value, onSave, isIndex }) => {
  const [localValue, setLocalValue] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const prevValueProp = React.useRef(value);

  // Synchronize localValue with value prop only when value prop actually changes
  // or when we finished editing/lost focus.
  useEffect(() => {
    if (!isFocused) {
      const formatted = value === 0 ? '' : (isIndex ? value.toFixed(3) : value.toString());
      setLocalValue(formatted.replace('.', ','));
      prevValueProp.current = value;
    }
  }, [value, isFocused, isIndex]);

  // AUTO-SAVE: Debounced effect to save while typing
  useEffect(() => {
    if (!isFocused) return;

    const timer = setTimeout(() => {
      const num = parseFloat(localValue.replace(',', '.')) || 0;
      // Precision check to avoid unnecessary saves
      if (Math.abs(num - value) > 0.0001) {
        onSave(num);
      }
    }, 1000); // 1s debounce

    return () => clearTimeout(timer);
  }, [localValue, isFocused, onSave, value]);

  const handleBlur = () => {
    setIsFocused(false);
    const num = parseFloat(localValue.replace(',', '.')) || 0;
    if (Math.abs(num - value) > 0.0001) {
      onSave(num);
    }
  };

  return (
    <input
      type="text"
      className="w-14 border border-slate-200 rounded px-1 py-0.5 text-center text-[10px] focus:ring-1 focus:ring-[#155645] outline-none bg-white"
      value={localValue}
      onChange={(e) => setLocalValue(e.target.value)}
      onBlur={handleBlur}
      onFocus={() => setIsFocused(true)}
      onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
      placeholder="0"
    />
  );
};

export const Indicators: React.FC = () => {
  const { requests, sectors, occupancyData, manualRealStats, getMonthlyLote, getManualRealStat, updateManualRealStat, systemConfig, getMonthlyAppConfig, calculateRequestTotal } = useApp();
  const [selectedYear, setSelectedYear] = useState(() => String(new Date().getFullYear()));
  const [selectedMonth, setSelectedMonth] = useState(() => String(new Date().getMonth() + 1).padStart(2, '0'));
  const [selectedSector, setSelectedSector] = useState('Todos');
  const [selectedType, setSelectedType] = useState('Todos');
  const [chartMetric, setChartMetric] = useState<'extras' | 'clt' | 'total'>('extras');
  const [matrixView, setMatrixView] = useState<'value' | 'qty' | 'index'>('value');
  const [isSaving, setIsSaving] = useState(false);

  const monthKey = `${selectedYear}-${selectedMonth}`;
  const config = getMonthlyAppConfig(monthKey);
  const activeMoTarget = useMemo(() => {
    if (chartMetric === 'extras') return config.moTargetExtra || config.moTarget || 0;
    if (chartMetric === 'clt') return config.moTargetClt || 0;
    if (chartMetric === 'total') return config.moTargetTotal || 0;
    return 0;
  }, [chartMetric, config]);

  // Debounced WFO saving is now replaced by WfoCell (onBlur saving)


  // Generate days for the selected month
  const [year, month] = monthKey.split('-').map(Number);
  const daysInMonth = new Date(year, month, 0).getDate();

  // Filter sectors based on selected sector and type
  const filteredSectors = useMemo(() => {
    return sectors.filter(s => {
      const matchesSector = selectedSector === 'Todos' || s.name === selectedSector;
      const matchesType = selectedType === 'Todos' || s.type === selectedType;
      return matchesSector && matchesType;
    });
  }, [sectors, selectedSector, selectedType]);

  // Calculate Net CLT (Fixed Staff) for the selected month and sector
  // Logic: Real Qty (from Ideal Table) - Afastados - Apprentices
  const netCltCount = useMemo(() => {
    let total = 0;
    filteredSectors.forEach(s => {
      const stats = getManualRealStat(s.id, monthKey);
      if (stats) {
        const net = stats.realQty - (stats.afastadosQty || 0) - (stats.apprenticesQty || 0);
        total += Math.max(0, net); // Ensure no negative numbers
      }
    });
    return total;
  }, [filteredSectors, monthKey, getManualRealStat, manualRealStats]);

  const dailyData = Array.from({ length: daysInMonth }, (_, i) => {
    const day = i + 1;
    // Format: YYYY-MM-DD
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const currentLoopDate = new Date(year, month - 1, day, 12, 0, 0); // Noon to avoid timezone edge cases

    // Get Occupancy (Ensure number)
    const occRecord = occupancyData[dateStr] as any;
    const occupiedUH = Number(occRecord?.total || 0);

    // Get Extras Count (Approved only, considering date ranges)
    const activeRequests = requests.filter(r => {
      // 1. Check Status
      if (r.status !== 'Aprovado') return false;

      // 2. Check Sector
      if (!filteredSectors.some(s => s.name === r.sector)) return false;

      // 3. Check Date Range
      const [rYear, rMonth, rDay] = r.dateEvent.split('-').map(Number);
      const startDate = new Date(rYear, rMonth - 1, rDay, 12, 0, 0);

      const endDate = new Date(startDate);
      endDate.setDate(startDate.getDate() + (r.daysQty - 1));

      return currentLoopDate >= startDate && currentLoopDate <= endDate;
    });

    const extrasCount = activeRequests.reduce((sum, r) => sum + Number(r.extrasQty), 0);
    const totalHeadcount = extrasCount + netCltCount;

    // Calculate Indices
    const indexExtras = occupiedUH > 0 ? (extrasCount / occupiedUH) : 0;
    const indexClt = occupiedUH > 0 ? (netCltCount / occupiedUH) : 0;
    const indexTotal = occupiedUH > 0 ? (totalHeadcount / occupiedUH) : 0;

    // Determine value based on selected metric
    let displayValue = 0;
    if (chartMetric === 'extras') displayValue = indexExtras;
    if (chartMetric === 'clt') displayValue = indexClt;
    if (chartMetric === 'total') displayValue = indexTotal;

    return {
      day: day,
      date: dateStr,
      occupiedUH,
      extrasCount,
      netCltCount,
      totalHeadcount,
      displayValue: Number((displayValue || 0).toFixed(3))
    };
  });

  // Batch (Lotes) Calculation
  const lotes = getMonthlyLote(monthKey);
  const loteStats = lotes.map(lote => {
    // Filter days that fall within the lote range
    const daysInLote = dailyData.filter(d => d.day >= lote.startDay && d.day <= lote.endDay);

    const totalOccupancy = daysInLote.reduce((acc, curr) => acc + curr.occupiedUH, 0);

    // Summing headcount for averages
    const totalExtras = daysInLote.reduce((acc, curr) => acc + curr.extrasCount, 0);
    const totalCltSum = daysInLote.reduce((acc, curr) => acc + curr.netCltCount, 0);
    const grandTotalHeadcount = totalExtras + totalCltSum;

    let relevantTotalCount = 0;
    if (chartMetric === 'extras') relevantTotalCount = totalExtras;
    if (chartMetric === 'clt') relevantTotalCount = totalCltSum;
    if (chartMetric === 'total') relevantTotalCount = grandTotalHeadcount;

    const avgIndex = totalOccupancy > 0 ? relevantTotalCount / totalOccupancy : 0;

    return {
      id: lote.id,
      name: lote.name,
      range: `Dia ${lote.startDay} a ${lote.endDay}`,
      totalOccupancy,
      relevantTotalCount,
      avgIndex
    };
  });

  // Financial Matrix Calculation (Sector x Lote)
  // UPDATED: Now calculates Value, Qty and Index for the Matrix
  const financialMatrix = filteredSectors.map(sector => {
    const loteValues = lotes.map(lote => {
      let loteTotalBaseValue = 0;
      let loteTotalQty = 0;

      // We need total occupancy for this specific lote to calculate sector index
      const stats = loteStats.find(ls => ls.id === lote.id);
      const loteOccupancy = stats ? stats.totalOccupancy : 0;

      requests.forEach(r => {
        // Filter by Sector and Status
        if (r.sector !== sector.name || r.status !== 'Aprovado') return;

        const [rYear, rMonth, rDay] = r.dateEvent.split('-').map(Number);
        const startDate = new Date(rYear, rMonth - 1, rDay);

        // Calculate daily cost base
        const reportMonth = r.dateEvent.substring(0, 7);
        const dailyCost = calculateRequestTotal({ ...r, daysQty: 1 });
        const dailyQty = r.extrasQty;

        // Iterate through each day of the request
        for (let i = 0; i < r.daysQty; i++) {
          const currentLoopDate = new Date(startDate);
          currentLoopDate.setDate(startDate.getDate() + i);

          // Check if this specific day falls within the selected VIEW month
          if (currentLoopDate.getMonth() + 1 === month && currentLoopDate.getFullYear() === year) {
            const currentDay = currentLoopDate.getDate();

            // Check if this day falls within the current Lote
            if (currentDay >= lote.startDay && currentDay <= lote.endDay) {
              loteTotalBaseValue += dailyCost;
              loteTotalQty += dailyQty;
            }
          }
        }
      });

      // CLT Contribution
      const sectorObj = sectors.find(s => s.name === sector.name);
      const sectorStats = sectorObj ? getManualRealStat(sectorObj.id, monthKey) : null;
      const cltHeadcount = sectorStats ? Math.max(0, sectorStats.realQty - (sectorStats.afastadosQty || 0) - (sectorStats.apprenticesQty || 0)) : 0;
      const cltValue = sectorStats ? sectorStats.realValue : 0;

      const daysInLoteMatch = lote.endDay - lote.startDay + 1;
      const cltLoteQty = cltHeadcount * daysInLoteMatch;
      const cltLoteValue = (cltValue / daysInMonth) * daysInLoteMatch;

      // Determine metrics based on chartMetric
      let finalValue = 0;
      let finalQty = 0;

      if (chartMetric === 'extras') {
        finalValue = loteTotalBaseValue;
        finalQty = loteTotalQty;
      } else if (chartMetric === 'clt') {
        finalValue = cltLoteValue;
        finalQty = cltLoteQty;
      } else {
        finalValue = loteTotalBaseValue + cltLoteValue;
        finalQty = loteTotalQty + cltLoteQty;
      }

      // Apply Tax Rate to the accumulated base value for this lote
      const taxRate = getMonthlyAppConfig(monthKey).taxRate;
      const valueWithTax = finalValue * (1 + (taxRate / 100));

      // Calculate Index: Total Days / Total Occupied Room Nights in Lote
      const sectorIndex = loteOccupancy > 0 ? (finalQty / loteOccupancy) : 0;

      return {
        loteId: lote.id,
        value: valueWithTax,
        qty: finalQty,
        index: sectorIndex
      };
    });

    const totalSectorValue = loteValues.reduce((acc, curr) => acc + curr.value, 0);
    const totalSectorQty = loteValues.reduce((acc, curr) => acc + curr.qty, 0);
    // For total index, we need total occupancy of the month (sum of all lotes occupancy)
    const monthTotalOccupancy = loteStats.reduce((acc, curr) => acc + curr.totalOccupancy, 0);
    const totalSectorIndex = monthTotalOccupancy > 0 ? (totalSectorQty / monthTotalOccupancy) : 0;

    return {
      sectorName: sector.name,
      loteValues,
      totalSectorValue,
      totalSectorQty,
      totalSectorIndex
    };
  });

  const loteTotals = lotes.map(lote => {
    return financialMatrix.reduce((acc, row) => {
      const cell = row.loteValues.find(v => v.loteId === lote.id);
      return {
        value: acc.value + (cell?.value || 0),
        qty: acc.qty + (cell?.qty || 0),
        // Index needs re-calc: Sum of all sector Qtys / Lote Occupancy
        // We can't just sum indices.
      };
    }, { value: 0, qty: 0 });
  });

  // Re-calculate Totals Indices correctly
  const loteTotalsWithIndex = loteTotals.map((t, idx) => {
    const lote = lotes[idx];
    const stats = loteStats.find(ls => ls.id === lote.id);
    const occ = stats ? stats.totalOccupancy : 0;
    return {
      ...t,
      index: occ > 0 ? t.qty / occ : 0
    };
  });

  const grandTotalValue = loteTotals.reduce((a, b) => a + b.value, 0);
  const grandTotalQty = loteTotals.reduce((a, b) => a + b.qty, 0);
  const grandTotalOccupancy = loteStats.reduce((acc, curr) => acc + curr.totalOccupancy, 0);
  const grandTotalIndex = grandTotalOccupancy > 0 ? grandTotalQty / grandTotalOccupancy : 0;

  const getMetricLabel = () => {
    if (chartMetric === 'extras') return 'Extras';
    if (chartMetric === 'clt') return 'Quadro CLT (Ativo)';
    return 'Total (Extras + CLT)';
  };

  const renderMatrixCell = (val: number, type: 'value' | 'qty' | 'index') => {
    if (type === 'value') return val.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
    if (type === 'qty') return Math.round(val); // Force Integer
    if (type === 'index') return (val || 0).toFixed(3);
    return val;
  };

  // Calculate Totals for WFO and Diff in the matrix
  const loteWfoTotals = lotes.map(lote => {
    return sectors.reduce((acc, s) => {
      const stats = getManualRealStat(s.id, monthKey);
      const loteIdStr = String(lote.id);
      const val = (stats?.loteWfoValue as any)?.[loteIdStr]?.value || 0;
      const qty = (stats?.loteWfoQty as any)?.[loteIdStr]?.qty || 0;
      return {
        value: acc.value + val,
        qty: acc.qty + qty
      };
    }, { value: 0, qty: 0 });
  });

  const loteIntermitentesTotals = lotes.map(lote => {
    return sectors.reduce((acc, s) => {
      const stats = getManualRealStat(s.id, monthKey);
      const loteIdStr = String(lote.id);
      const val = (stats?.loteIntermitentesValue as any)?.[loteIdStr]?.value || 0;
      const qty = (stats?.loteIntermitentesQty as any)?.[loteIdStr]?.qty || 0;
      return {
        value: acc.value + val,
        qty: acc.qty + qty
      };
    }, { value: 0, qty: 0 });
  });

  const monthlyWfoTotals = sectors.reduce((acc, s) => {
    const stats = getManualRealStat(s.id, monthKey);
    const valTotal = (Object.values(stats?.loteWfoValue || {}) as any).reduce((sum: number, item: any) => sum + (item.value || 0), 0);
    const qtyTotal = (Object.values(stats?.loteWfoQty || {}) as any).reduce((sum: number, item: any) => sum + (item.qty || 0), 0);
    return {
      value: acc.value + valTotal,
      qty: acc.qty + qtyTotal
    };
  }, { value: 0, qty: 0 });

  const monthlyIntermitentesTotals = sectors.reduce((acc, s) => {
    const stats = getManualRealStat(s.id, monthKey);
    const valTotal = (Object.values(stats?.loteIntermitentesValue || {}) as any).reduce((sum: number, item: any) => sum + (item.value || 0), 0);
    const qtyTotal = (Object.values(stats?.loteIntermitentesQty || {}) as any).reduce((sum: number, item: any) => sum + (item.qty || 0), 0);
    return {
      value: acc.value + valTotal,
      qty: acc.qty + qtyTotal
    };
  }, { value: 0, qty: 0 });

  return (
    <div className="space-y-6">
      <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-col md:flex-row items-center justify-between gap-4">
        <h2 className="text-lg font-bold text-[#155645]">Indicador: Mão de Obra por UH Ocupada</h2>

        <div className="flex flex-wrap gap-4 items-center">
          <div className="flex items-center gap-2">
            <Calendar size={18} className="text-[#155645]" />
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              className="border border-slate-300 rounded px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-[#155645]"
            >
              {[2024, 2025, 2026, 2027, 2028, 2029, 2030].map(y => <option key={y} value={String(y)}>{y}</option>)}
            </select>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="border border-slate-300 rounded px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-[#155645]"
            >
              {['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'].map(m => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <Filter size={18} className="text-[#155645]" />
            <select
              className="border border-slate-300 rounded px-3 py-1.5 text-sm focus:ring-2 focus:ring-[#155645] outline-none"
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
            >
              <option value="Todos">Todos os Tipos</option>
              <option value="Operacional">Operacional</option>
              <option value="Suporte">Suporte</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <Filter size={18} className="text-[#155645]" />
            <select
              className="border border-slate-300 rounded px-3 py-1.5 text-sm focus:ring-2 focus:ring-[#155645] outline-none"
              value={selectedSector}
              onChange={(e) => setSelectedSector(e.target.value)}
            >
              <option value="Todos">Todos os Setores</option>
              {sectors.map(s => (
                <option key={s.id} value={s.name}>{s.name}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-lg border border-slate-200">
            <BarChart3 size={18} className="text-[#155645] ml-2" />
            <div className="flex">
              <button
                onClick={() => setChartMetric('extras')}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${chartMetric === 'extras' ? 'bg-white text-[#155645] shadow-sm' : 'text-slate-500 hover:text-slate-700'
                  }`}
              >
                Extras
              </button>
              <button
                onClick={() => setChartMetric('clt')}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${chartMetric === 'clt' ? 'bg-white text-[#155645] shadow-sm' : 'text-slate-500 hover:text-slate-700'
                  }`}
              >
                Quadro CLT
              </button>
              <button
                onClick={() => setChartMetric('total')}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${chartMetric === 'total' ? 'bg-white text-[#155645] shadow-sm' : 'text-slate-500 hover:text-slate-700'
                  }`}
              >
                Total
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Chart */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
        <h3 className="text-sm font-bold text-slate-500 uppercase mb-4 flex justify-between">
          <span>Evolução Diária do Índice ({getMetricLabel()} / UH)</span>
          <span className="text-xs normal-case text-slate-400">
            {chartMetric === 'clt' && 'Nota: CLT Ativo = Real - Afastados - Aprendizes'}
          </span>
        </h3>
        <div className="h-80">
          {dailyData && dailyData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={dailyData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="day" label={{ value: 'Dia', position: 'insideBottom', offset: -5 }} />
                <Tooltip
                  labelFormatter={(day) => `${day}/${month}/${year}`}
                  formatter={(value: number, name: string) => [
                    name === 'displayValue' ? (value || 0).toFixed(3) : value,
                    name === 'displayValue' ? 'Índice' :
                      name === 'occupiedUH' ? 'UH Ocupada' :
                        name === 'extrasCount' ? 'Extras' :
                          name === 'netCltCount' ? 'CLT Ativo' :
                            name === 'totalHeadcount' ? 'Total Pessoas' : name
                  ]}
                />
                <Legend />
                <Line type="monotone" dataKey="displayValue" stroke="#155645" strokeWidth={2} name={`Índice (${getMetricLabel()})`} dot={{ r: 4 }}>
                  <LabelList dataKey="displayValue" position="top" style={{ fontSize: '10px', fill: '#666' }} />
                </Line>
                {activeMoTarget > 0 && (
                  <ReferenceLine
                    y={activeMoTarget}
                    stroke="#F8981C"
                    strokeWidth={2}
                    strokeDasharray="5 5"
                    label={{
                      value: `Meta: ${activeMoTarget.toFixed(2).replace('.', ',')}`,
                      position: 'insideLeft',
                      fill: '#F8981C',
                      fontSize: 10,
                      fontWeight: 'bold',
                      dy: -10
                    }}
                  />
                )}
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-full text-slate-400">
              Nenhum dado disponível para exibir
            </div>
          )}
        </div>
      </div>

      {/* Batch Summary (Extraordinários por Lotes) */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50">
          <h3 className="text-sm font-bold text-slate-800">Extraordinários por Lotes ({getMetricLabel()})</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-center">
            <thead className="bg-[#155645]/5 text-[#155645] uppercase text-xs">
              <tr>
                <th className="p-3 border-r border-slate-200">Lote</th>
                <th className="p-3 border-r border-slate-200">Período</th>
                <th className="p-3 border-r border-slate-200">UH Total (Acum.)</th>
                <th className="p-3 border-r border-slate-200">{getMetricLabel()} (Acum.)</th>
                <th className="p-3 border-r border-slate-200 text-[#155645]">MO / UH Ocupada</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loteStats.map((stat, idx) => (
                <tr key={idx} className="hover:bg-slate-50">
                  <td className="p-3 border-r border-slate-200 font-bold">{stat.name}</td>
                  <td className="p-3 border-r border-slate-200 text-slate-500 text-xs">{stat.range}</td>
                  <td className="p-3 border-r border-slate-200">{stat.totalOccupancy}</td>
                  <td className="p-3 border-r border-slate-200">{stat.relevantTotalCount}</td>
                  <td className="p-3 border-r border-slate-200 font-bold text-[#155645]">{(stat.avgIndex || 0).toFixed(3)}</td>
                </tr>
              ))}
              {loteStats.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-4 text-slate-400">Nenhum lote configurado para este mês.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Financial Matrix (Extraordinários por setor) */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex flex-col">
            <h3 className="text-sm font-bold text-slate-800">Extraordinários por Setor</h3>
            <div className="flex items-center gap-4">
              <span className="text-xs text-slate-500">Taxa Configurada: {getMonthlyAppConfig(monthKey).taxRate}%</span>
              {isSaving && (
                <span className="text-[10px] bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full animate-pulse font-bold flex items-center gap-1">
                  <Activity size={10} className="animate-spin" /> SALVANDO...
                </span>
              )}
            </div>
          </div>

          {/* Matrix View Filter */}
          <div className="flex bg-white border border-slate-300 rounded-lg p-1">
            <button
              onClick={() => setMatrixView('value')}
              className={`flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded transition-colors ${matrixView === 'value' ? 'bg-[#155645]/10 text-[#155645]' : 'text-slate-500 hover:bg-slate-50'
                }`}
            >
              <DollarSign size={14} /> Valor Pago
            </button>
            <button
              onClick={() => setMatrixView('qty')}
              className={`flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded transition-colors ${matrixView === 'qty' ? 'bg-[#155645]/10 text-[#155645]' : 'text-slate-500 hover:bg-slate-50'
                }`}
            >
              <Users size={14} /> Quantidade
            </button>
            <button
              onClick={() => setMatrixView('index')}
              className={`flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded transition-colors ${matrixView === 'index' ? 'bg-[#155645]/10 text-[#155645]' : 'text-slate-500 hover:bg-slate-50'
                }`}
            >
              <Activity size={14} /> MO / UH Ocupada
            </button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-right">
            <thead className="bg-[#155645]/5 text-[#155645] text-xs">
              <tr>
                <th rowSpan={2} className="p-3 border-r border-slate-200 text-left align-middle uppercase w-32 min-w-[140px]">Setor</th>
                {lotes.map(lote => (
                  <th key={lote.id} colSpan={4} className="p-2 border-r border-b border-slate-200 text-center uppercase">
                    {lote.name}
                    <div className="text-[9px] text-slate-400 font-normal normal-case">Dia {lote.startDay}-{lote.endDay}</div>
                  </th>
                ))}
                <th colSpan={4} className="p-2 border-b border-slate-200 text-center bg-slate-100 uppercase">Total Mensal</th>
              </tr>
              <tr className="border-b border-slate-200">
                {lotes.map(lote => (
                  <React.Fragment key={lote.id}>
                    <th className="p-1.5 border-r border-slate-200 font-bold text-center text-[10px] uppercase w-20 min-w-[80px]">Work<br />force</th>
                    <th className="p-1.5 border-r border-slate-200 font-bold text-center text-[10px] uppercase w-20 min-w-[80px]">Wfo</th>
                    <th className="p-1.5 border-r border-slate-200 font-bold text-center text-[10px] uppercase w-20 min-w-[80px]">Inter<br />mitente</th>
                    <th className="p-1.5 border-r border-slate-200 font-bold text-center text-[10px] uppercase w-16">Diff</th>
                  </React.Fragment>
                ))}
                <th className="p-1.5 border-r border-slate-200 font-bold text-center text-[10px] uppercase bg-slate-100 w-20 min-w-[80px]">Work<br />force</th>
                <th className="p-1.5 border-r border-slate-200 font-bold text-center text-[10px] uppercase bg-slate-100 w-20 min-w-[80px]">Wfo</th>
                <th className="p-1.5 border-r border-slate-200 font-bold text-center text-[10px] uppercase bg-slate-100 w-20 min-w-[80px]">Inter<br />mitente</th>
                <th className="p-1.5 font-bold text-center text-[10px] uppercase bg-slate-100 w-16">Diff</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {financialMatrix.map((row, idx) => {
                const sectorObj = sectors.find(s => s.name === row.sectorName);
                const stats = sectorObj ? getManualRealStat(sectorObj.id, monthKey) : undefined;
                return (
                  <tr key={idx} className="hover:bg-slate-50">
                    <td className="p-3 border-r border-slate-200 text-left font-medium text-slate-800">{row.sectorName}</td>

                    {row.loteValues.map((cell, cIdx) => {
                      const lote = lotes[cIdx];
                      const loteIdStr = String(lote.id);

                      let workforceMetric = 0;
                      let currentWfoMetric = 0;
                      let currentIntermitentesMetric = 0;

                      if (matrixView === 'value') {
                        workforceMetric = cell.value;
                        const wfoData = (stats?.loteWfoValue as any)?.[loteIdStr];
                        currentWfoMetric = wfoData?.value || 0;
                        const intermitentesData = (stats?.loteIntermitentesValue as any)?.[loteIdStr];
                        currentIntermitentesMetric = intermitentesData?.value || 0;
                      } else if (matrixView === 'qty') {
                        workforceMetric = cell.qty;
                        const wfoData = (stats?.loteWfoQty as any)?.[loteIdStr];
                        currentWfoMetric = wfoData?.qty || 0;
                        const intermitentesData = (stats?.loteIntermitentesQty as any)?.[loteIdStr];
                        currentIntermitentesMetric = intermitentesData?.qty || 0;
                      } else {
                        workforceMetric = cell.index;
                        const wfoData = (stats?.loteWfoQty as any)?.[loteIdStr];
                        const intermitentesData = (stats?.loteIntermitentesQty as any)?.[loteIdStr];
                        const statsLote = loteStats.find(ls => ls.id === lote.id);
                        const occ = statsLote ? statsLote.totalOccupancy : 0;
                        currentWfoMetric = occ > 0 ? (wfoData?.qty || 0) / occ : 0;
                        currentIntermitentesMetric = occ > 0 ? (intermitentesData?.qty || 0) / occ : 0;
                      }

                      const diff = workforceMetric - (currentWfoMetric + currentIntermitentesMetric);
                      const isDifferent = Math.abs(diff) > 0.0001;

                      return (
                        <React.Fragment key={cIdx}>
                          <td className="p-3 border-r border-slate-100 bg-slate-50/30 text-center w-20 min-w-[80px]">
                            {renderMatrixCell(workforceMetric, matrixView)}
                          </td>
                          <td className="p-2 border-r border-slate-100 text-center w-20 min-w-[80px]">
                            <WfoCell
                              value={currentWfoMetric}
                              isIndex={matrixView === 'index'}
                              onSave={async (num) => {
                                if (!sectorObj) return;
                                setIsSaving(true);

                                try {
                                  const key = `${sectorObj.id}_${monthKey}`;
                                  const existing = manualRealStats[key];

                                  const currentStats = existing || {
                                    sectorId: sectorObj.id,
                                    monthKey: monthKey,
                                    realQty: 0,
                                    realValue: 0,
                                    afastadosQty: 0,
                                    apprenticesQty: 0,
                                    wfoQty: 0,
                                    loteWfo: {}
                                  };

                                  const loteIdStr = String(lote.id);

                                  if (matrixView === 'value') {
                                    const nextLoteWfoValue = { ...(currentStats.loteWfoValue || {}) } as any;
                                    const currentLoteData = nextLoteWfoValue[loteIdStr] || {};
                                    nextLoteWfoValue[loteIdStr] = { ...currentLoteData, value: num };

                                    await updateManualRealStat({
                                      sectorId: sectorObj.id,
                                      monthKey: monthKey,
                                      loteWfoValue: nextLoteWfoValue
                                    } as any);
                                  } else {
                                    const nextLoteWfoQty = { ...(currentStats.loteWfoQty || {}) } as any;
                                    const currentLoteData = nextLoteWfoQty[loteIdStr] || {};

                                    if (matrixView === 'qty') {
                                      nextLoteWfoQty[loteIdStr] = { ...currentLoteData, qty: num };
                                    } else if (matrixView === 'index') {
                                      const statsLote = loteStats.find(ls => ls.id === lote.id);
                                      const occ = statsLote ? statsLote.totalOccupancy : 0;
                                      const calculatedQty = occ > 0 ? num * occ : 0;
                                      nextLoteWfoQty[loteIdStr] = { ...currentLoteData, qty: calculatedQty };
                                    }

                                    await updateManualRealStat({
                                      sectorId: sectorObj.id,
                                      monthKey: monthKey,
                                      loteWfoQty: nextLoteWfoQty
                                    } as any);
                                  }
                                } catch (err) {
                                  console.error('Error in WfoCell onSave:', err);
                                } finally {
                                  setTimeout(() => setIsSaving(false), 500);
                                }
                              }}
                            />
                          </td>
                          <td className="p-2 border-r border-slate-100 text-center w-20 min-w-[80px]">
                            <WfoCell
                              value={currentIntermitentesMetric}
                              isIndex={matrixView === 'index'}
                              onSave={async (num) => {
                                if (!sectorObj) return;
                                setIsSaving(true);

                                try {
                                  const key = `${sectorObj.id}_${monthKey}`;
                                  const existing = manualRealStats[key];

                                  const currentStats = existing || {
                                    sectorId: sectorObj.id,
                                    monthKey: monthKey,
                                    realQty: 0,
                                    realValue: 0,
                                    afastadosQty: 0,
                                    apprenticesQty: 0,
                                    wfoQty: 0,
                                    loteWfo: {}
                                  };

                                  const loteIdStr = String(lote.id);

                                  if (matrixView === 'value') {
                                    const nextLoteIntermitentesValue = { ...(currentStats.loteIntermitentesValue || {}) } as any;
                                    const currentLoteData = nextLoteIntermitentesValue[loteIdStr] || {};
                                    nextLoteIntermitentesValue[loteIdStr] = { ...currentLoteData, value: num };

                                    await updateManualRealStat({
                                      sectorId: sectorObj.id,
                                      monthKey: monthKey,
                                      loteIntermitentesValue: nextLoteIntermitentesValue
                                    } as any);
                                  } else {
                                    const nextLoteIntermitentesQty = { ...(currentStats.loteIntermitentesQty || {}) } as any;
                                    const currentLoteData = nextLoteIntermitentesQty[loteIdStr] || {};

                                    if (matrixView === 'qty') {
                                      nextLoteIntermitentesQty[loteIdStr] = { ...currentLoteData, qty: num };
                                    } else if (matrixView === 'index') {
                                      const statsLote = loteStats.find(ls => ls.id === lote.id);
                                      const occ = statsLote ? statsLote.totalOccupancy : 0;
                                      const calculatedQty = occ > 0 ? num * occ : 0;
                                      nextLoteIntermitentesQty[loteIdStr] = { ...currentLoteData, qty: calculatedQty };
                                    }

                                    await updateManualRealStat({
                                      sectorId: sectorObj.id,
                                      monthKey: monthKey,
                                      loteIntermitentesQty: nextLoteIntermitentesQty
                                    } as any);
                                  }
                                } catch (err) {
                                  console.error('Error in IntermitentesCell onSave:', err);
                                } finally {
                                  setTimeout(() => setIsSaving(false), 500);
                                }
                              }}
                            />
                          </td>
                          <td className={`p-2 border-r border-slate-200 text-center font-bold text-[11px] w-16 ${isDifferent ? 'text-red-500 bg-red-50' : 'text-green-600 bg-green-50'}`}>
                            {diff > 0 ? `+${renderMatrixCell(diff, matrixView)}` : renderMatrixCell(diff, matrixView)}
                          </td>
                        </React.Fragment>
                      );
                    })}

                    {/* Total Mensal Cols */}
                    {(() => {
                      let workforceTotal = 0;
                      let wfoTotal = 0;
                      let intermitentesTotal = 0;

                      const sectorObj = sectors.find(s => s.name === row.sectorName);
                      const sectorStats = sectorObj ? getManualRealStat(sectorObj.id, monthKey) : undefined;

                      if (matrixView === 'value') {
                        workforceTotal = row.totalSectorValue;
                        wfoTotal = (Object.values(sectorStats?.loteWfoValue || {}) as { value?: number }[]).reduce((acc, curr) => acc + (curr.value || 0), 0);
                        intermitentesTotal = (Object.values(sectorStats?.loteIntermitentesValue || {}) as { value?: number }[]).reduce((acc, curr) => acc + (curr.value || 0), 0);
                      } else if (matrixView === 'qty') {
                        workforceTotal = row.totalSectorQty;
                        wfoTotal = (Object.values(sectorStats?.loteWfoQty || {}) as { qty?: number }[]).reduce((acc, curr) => acc + (curr.qty || 0), 0);
                        intermitentesTotal = (Object.values(sectorStats?.loteIntermitentesQty || {}) as { qty?: number }[]).reduce((acc, curr) => acc + (curr.qty || 0), 0);
                      } else {
                        workforceTotal = row.totalSectorIndex;
                        // Calculate total index for WFO: Total WFO Qty / Total Month Occupancy
                        const totalWfoQty = (Object.values(sectorStats?.loteWfoQty || {}) as { qty?: number }[]).reduce((acc, curr) => acc + (curr.qty || 0), 0);
                        const totalIntermitentesQty = (Object.values(sectorStats?.loteIntermitentesQty || {}) as { qty?: number }[]).reduce((acc, curr) => acc + (curr.qty || 0), 0);
                        const totalOccupancy = loteStats.reduce((acc, curr) => acc + curr.totalOccupancy, 0);
                        wfoTotal = totalOccupancy > 0 ? totalWfoQty / totalOccupancy : 0;
                        intermitentesTotal = totalOccupancy > 0 ? totalIntermitentesQty / totalOccupancy : 0;
                      }

                      const monthlyDiff = workforceTotal - (wfoTotal + intermitentesTotal);
                      const isMonthlyDiff = Math.abs(monthlyDiff) > 0.0001;

                      return (
                        <>
                          <td className="p-3 font-bold bg-slate-100 border-r border-slate-200 text-center w-20 min-w-[80px]">
                            {renderMatrixCell(workforceTotal, matrixView)}
                          </td>
                          <td className="p-3 bg-slate-100 border-r border-slate-200 text-center font-bold text-[#155645] w-20 min-w-[80px]">
                            {renderMatrixCell(wfoTotal, matrixView)}
                          </td>
                          <td className="p-3 bg-slate-100 border-r border-slate-200 text-center font-bold text-purple-600 w-20 min-w-[80px]">
                            {renderMatrixCell(intermitentesTotal, matrixView)}
                          </td>
                          <td className={`p-2 bg-slate-100 text-center font-bold text-[11px] w-16 ${isMonthlyDiff ? 'text-red-500' : 'text-green-600'}`}>
                            {monthlyDiff > 0 ? `+${renderMatrixCell(monthlyDiff, matrixView)}` : renderMatrixCell(monthlyDiff, matrixView)}
                          </td>
                        </>
                      );
                    })()}
                  </tr>
                );
              })}
              {financialMatrix.length === 0 && (
                <tr>
                  <td colSpan={(lotes.length * 4) + 5} className="p-4 text-center text-slate-400">Nenhum dado disponível.</td>
                </tr>
              )}
            </tbody>
            <tfoot className="bg-slate-100 font-bold border-t border-slate-300">
              <tr>
                <td className="p-3 text-left border-r border-slate-200 uppercase">Total Geral</td>
                {loteTotalsWithIndex.map((total, idx) => {
                  const wfoMetric = matrixView === 'value' ? loteWfoTotals[idx].value :
                    matrixView === 'qty' ? loteWfoTotals[idx].qty :
                      (loteStats[idx].totalOccupancy > 0 ? loteWfoTotals[idx].qty / loteStats[idx].totalOccupancy : 0);
                  const intermitentesMetric = matrixView === 'value' ? loteIntermitentesTotals[idx].value :
                    matrixView === 'qty' ? loteIntermitentesTotals[idx].qty :
                      (loteStats[idx].totalOccupancy > 0 ? loteIntermitentesTotals[idx].qty / loteStats[idx].totalOccupancy : 0);
                  const workforceMetric = matrixView === 'value' ? total.value :
                    matrixView === 'qty' ? total.qty : total.index;
                  const diff = workforceMetric - (wfoMetric + intermitentesMetric);
                  const isDifferent = Math.abs(diff) > 0.0001;

                  return (
                    <React.Fragment key={idx}>
                      <td className="p-3 border-r border-slate-300 text-center w-20 min-w-[80px]">
                        {renderMatrixCell(workforceMetric, matrixView)}
                      </td>
                      <td className="p-3 border-r border-slate-300 text-center text-[#155645] w-20 min-w-[80px]">
                        {renderMatrixCell(wfoMetric, matrixView)}
                      </td>
                      <td className="p-3 border-r border-slate-300 text-center text-purple-600 w-20 min-w-[80px]">
                        {renderMatrixCell(intermitentesMetric, matrixView)}
                      </td>
                      <td className={`p-2 border-r border-slate-300 text-center text-[11px] w-16 ${isDifferent ? 'text-red-500 bg-red-50' : 'text-green-600 bg-green-50'}`}>
                        {diff > 0 ? `+${renderMatrixCell(diff, matrixView)}` : renderMatrixCell(diff, matrixView)}
                      </td>
                    </React.Fragment>
                  );
                })}

                {/* Monthly Grand Totals */}
                {(() => {
                  const wfMonthly = matrixView === 'value' ? grandTotalValue :
                    matrixView === 'qty' ? grandTotalQty : grandTotalIndex;

                  const wfoMonthly = matrixView === 'value' ? monthlyWfoTotals.value :
                    matrixView === 'qty' ? monthlyWfoTotals.qty :
                      (grandTotalOccupancy > 0 ? monthlyWfoTotals.qty / grandTotalOccupancy : 0);

                  const intermitentesMonthly = matrixView === 'value' ? monthlyIntermitentesTotals.value :
                    matrixView === 'qty' ? monthlyIntermitentesTotals.qty :
                      (grandTotalOccupancy > 0 ? monthlyIntermitentesTotals.qty / grandTotalOccupancy : 0);

                  const mDiff = wfMonthly - (wfoMonthly + intermitentesMonthly);
                  const isMDiff = Math.abs(mDiff) > 0.0001;

                  return (
                    <>
                      <td className="p-3 bg-slate-200 border-r border-slate-300 text-center w-20 min-w-[80px]">
                        {renderMatrixCell(wfMonthly, matrixView)}
                      </td>
                      <td className="p-3 bg-slate-200 border-r border-slate-300 text-center text-[#155645] w-20 min-w-[80px]">
                        {renderMatrixCell(wfoMonthly, matrixView)}
                      </td>
                      <td className="p-3 bg-slate-200 border-r border-slate-300 text-center text-purple-600 w-20 min-w-[80px]">
                        {renderMatrixCell(intermitentesMonthly, matrixView)}
                      </td>
                      <td className={`p-2 bg-slate-200 text-center text-[11px] w-16 ${isMDiff ? 'text-red-500' : 'text-green-600'}`}>
                        {mDiff > 0 ? `+${renderMatrixCell(mDiff, matrixView)}` : renderMatrixCell(mDiff, matrixView)}
                      </td>
                    </>
                  );
                })()}
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
};