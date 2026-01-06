import React, { useState, useMemo } from 'react';
import { useApp } from '../context';
import { Calendar, Filter, BarChart3, DollarSign, Users, Activity } from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  LabelList
} from 'recharts';

export const Indicators: React.FC = () => {
  const { requests, sectors, occupancyData, getMonthlyLote, getManualRealStat, updateManualRealStat, systemConfig } = useApp();
  const [selectedYear, setSelectedYear] = useState(() => String(new Date().getFullYear()));
  const [selectedMonth, setSelectedMonth] = useState(() => String(new Date().getMonth() + 1).padStart(2, '0'));
  const [selectedSector, setSelectedSector] = useState('Todos');
  const [selectedType, setSelectedType] = useState('Todos');
  const [chartMetric, setChartMetric] = useState<'extras' | 'clt' | 'total'>('extras');
  const [matrixView, setMatrixView] = useState<'value' | 'qty' | 'index'>('value');

  const monthKey = `${selectedYear}-${selectedMonth}`;

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
  }, [filteredSectors, monthKey, getManualRealStat]);

  // Generate days for the selected month
  const [year, month] = monthKey.split('-').map(Number);
  const daysInMonth = new Date(year, month, 0).getDate();

  const dailyData = Array.from({ length: daysInMonth }, (_, i) => {
    const day = i + 1;
    // Format: YYYY-MM-DD
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const currentLoopDate = new Date(year, month - 1, day, 12, 0, 0); // Noon to avoid timezone edge cases

    // Get Occupancy (Ensure number)
    const occupiedUH = Number(occupancyData[dateStr] || 0);

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
        const dailyCost = (r.totalValue || 0) / (r.daysQty || 1);
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

      // Apply Tax Rate to the accumulated base value for this lote
      const valueWithTax = loteTotalBaseValue * (1 + (systemConfig.taxRate / 100));

      // Calculate Index: Total Extras Days / Total Occupied Room Nights in Lote
      const sectorIndex = loteOccupancy > 0 ? (loteTotalQty / loteOccupancy) : 0;

      return {
        loteId: lote.id,
        value: valueWithTax,
        qty: loteTotalQty,
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
    if (type === 'value') return `R$ ${val.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
    if (type === 'qty') return Math.round(val); // Force Integer
    if (type === 'index') return (val || 0).toFixed(3);
    return val;
  };

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
            </LineChart>
          </ResponsiveContainer>
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
            <span className="text-xs text-slate-500">Taxa Configurada: {systemConfig.taxRate}%</span>
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
                <th rowSpan={2} className="p-3 border-r border-slate-200 text-left align-middle uppercase w-48 min-w-[180px]">Setor</th>
                {lotes.map(lote => (
                  <th key={lote.id} colSpan={3} className="p-2 border-r border-b border-slate-200 text-center uppercase">
                    {lote.name}
                    <div className="text-[9px] text-slate-400 font-normal normal-case">Dia {lote.startDay}-{lote.endDay}</div>
                  </th>
                ))}
                <th colSpan={3} className="p-2 border-b border-slate-200 text-center bg-slate-100 uppercase">Total Mensal</th>
              </tr>
              <tr className="border-b border-slate-200">
                {lotes.map(lote => (
                  <React.Fragment key={lote.id}>
                    <th className="p-1.5 border-r border-slate-200 font-bold text-center text-[10px] uppercase w-20 min-w-[80px]">Workforce</th>
                    <th className="p-1.5 border-r border-slate-200 font-bold text-center text-[10px] uppercase w-20 min-w-[80px]">Wfo</th>
                    <th className="p-1.5 border-r border-slate-200 font-bold text-center text-[10px] uppercase w-16">Diff</th>
                  </React.Fragment>
                ))}
                <th className="p-1.5 border-r border-slate-200 font-bold text-center text-[10px] uppercase bg-slate-100 w-20 min-w-[80px]">Workforce</th>
                <th className="p-1.5 border-r border-slate-200 font-bold text-center text-[10px] uppercase bg-slate-100 w-20 min-w-[80px]">Wfo</th>
                <th className="p-1.5 font-bold text-center text-[10px] uppercase bg-slate-100 w-16">Diff</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {financialMatrix.map((row, idx) => {
                const sectorObj = sectors.find(s => s.name === row.sectorName);
                const stats = sectorObj ? getManualRealStat(sectorObj.id, monthKey) : undefined;
                const workforce = stats ? Math.max(0, stats.realQty - (stats.afastadosQty || 0) - (stats.apprenticesQty || 0)) : 0;

                return (
                  <tr key={idx} className="hover:bg-slate-50">
                    <td className="p-3 border-r border-slate-200 text-left font-medium text-slate-800">{row.sectorName}</td>

                    {row.loteValues.map((cell, cIdx) => {
                      const lote = lotes[cIdx];
                      const wfo = stats?.loteWfo?.[lote.id] || 0;
                      const diff = workforce - wfo;
                      const isDifferent = workforce !== wfo;

                      return (
                        <React.Fragment key={cIdx}>
                          <td className="p-3 border-r border-slate-100 bg-slate-50/30 text-center w-20 min-w-[80px]">
                            {renderMatrixCell(
                              matrixView === 'value' ? cell.value :
                                matrixView === 'qty' ? cell.qty : cell.index,
                              matrixView
                            )}
                          </td>
                          <td className="p-2 border-r border-slate-100 text-center w-20 min-w-[80px]">
                            <input
                              type="number"
                              className="w-14 border border-slate-200 rounded px-1 py-0.5 text-center text-[10px] focus:ring-1 focus:ring-[#155645] outline-none"
                              value={wfo === 0 ? '' : wfo}
                              placeholder="0"
                              onChange={(e) => {
                                if (!sectorObj) return;
                                const newVal = parseInt(e.target.value) || 0;
                                const currentStats = getManualRealStat(sectorObj.id, monthKey) || {
                                  sectorId: sectorObj.id,
                                  monthKey: monthKey,
                                  realQty: 0,
                                  realValue: 0,
                                  afastadosQty: 0,
                                  apprenticesQty: 0
                                };
                                const updatedLoteWfo = { ...(currentStats.loteWfo || {}), [lote.id]: newVal };
                                updateManualRealStat({ ...currentStats, loteWfo: updatedLoteWfo });
                              }}
                            />
                          </td>
                          <td className={`p-2 border-r border-slate-200 text-center font-bold text-[11px] w-16 ${isDifferent ? 'text-red-500 bg-red-50' : 'text-green-600 bg-green-50'}`}>
                            {diff > 0 ? `+${diff}` : diff}
                          </td>
                        </React.Fragment>
                      );
                    })}

                    {/* Total Mensal Cols */}
                    {(() => {
                      const monthlyWfo = (Object.values(stats?.loteWfo || {}) as number[]).reduce((a, b) => a + (Number(b) || 0), 0);
                      const monthlyDiff = workforce - monthlyWfo;
                      return (
                        <>
                          <td className="p-3 font-bold bg-slate-100 border-r border-slate-200 text-center w-20 min-w-[80px]">
                            {renderMatrixCell(
                              matrixView === 'value' ? row.totalSectorValue :
                                matrixView === 'qty' ? row.totalSectorQty : row.totalSectorIndex,
                              matrixView
                            )}
                          </td>
                          <td className="p-3 bg-slate-100 border-r border-slate-200 text-center font-bold text-[#155645] w-20 min-w-[80px]">
                            {monthlyWfo || 0}
                          </td>
                          <td className={`p-2 bg-slate-100 text-center font-bold text-[11px] w-16 ${workforce !== monthlyWfo ? 'text-red-500' : 'text-green-600'}`}>
                            {monthlyDiff > 0 ? `+${monthlyDiff}` : monthlyDiff}
                          </td>
                        </>
                      );
                    })()}
                  </tr>
                );
              })}
              {financialMatrix.length === 0 && (
                <tr>
                  <td colSpan={(lotes.length * 3) + 4} className="p-4 text-center text-slate-400">Nenhum dado disponível.</td>
                </tr>
              )}
            </tbody>
            <tfoot className="bg-slate-100 font-bold border-t border-slate-300">
              <tr>
                <td className="p-3 text-left uppercase">Total Geral</td>
                {loteTotalsWithIndex.map((total, idx) => (
                  <React.Fragment key={idx}>
                    <td className="p-3 border-r border-slate-300 text-center w-20 min-w-[80px]">
                      {renderMatrixCell(
                        matrixView === 'value' ? total.value :
                          matrixView === 'qty' ? total.qty : total.index,
                        matrixView
                      )}
                    </td>
                    <td colSpan={2} className="border-r border-slate-300"></td>
                  </React.Fragment>
                ))}
                <td className="p-3 bg-slate-200 border-r border-slate-300 text-center w-20 min-w-[80px]">
                  {renderMatrixCell(
                    matrixView === 'value' ? grandTotalValue :
                      matrixView === 'qty' ? grandTotalQty : grandTotalIndex,
                    matrixView
                  )}
                </td>
                <td colSpan={2} className="bg-slate-200"></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
};