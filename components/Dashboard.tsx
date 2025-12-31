import React, { useState, useMemo } from 'react';
import { useApp } from '../context';
import { UserRole } from '../types';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LabelList, Cell
} from 'recharts';
import { Check, X, Trash2, AlertCircle, Calendar, Clock } from 'lucide-react';

export const Dashboard: React.FC = () => {
  const { requests, sectors, user, updateRequestStatus, deleteRequest, systemConfig, getMonthlyLote } = useApp();
  // Date Filter State with persistence
  const [startDate, setStartDate] = useState(() => {
    return sessionStorage.getItem('dashboard_startDate') || new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10);
  });
  const [endDate, setEndDate] = useState(() => {
    return sessionStorage.getItem('dashboard_endDate') || new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).toISOString().slice(0, 10);
  });

  // Persist dates on change
  const handleStartDateChange = (val: string) => {
    setStartDate(val);
    sessionStorage.setItem('dashboard_startDate', val);
  };
  const handleEndDateChange = (val: string) => {
    setEndDate(val);
    sessionStorage.setItem('dashboard_endDate', val);
  };

  // Filter requests based on selected range
  const filteredRequests = requests.filter(r => r.dateEvent >= startDate && r.dateEvent <= endDate);
  const approvedRequests = filteredRequests.filter(r => r.status === 'Aprovado');

  // --- KPI Calculations ---

  // 1. Total Diárias (Man-Days)
  const totalDiarias = approvedRequests.reduce((acc, curr) => acc + (curr.daysQty * curr.extrasQty), 0);

  // 2. Financials
  const totalValue = approvedRequests.reduce((acc, curr) => acc + (curr.totalValue || 0), 0);
  const totalValueWithTax = totalValue * (1 + (systemConfig.taxRate / 100));

  // 3. Pending Count
  const pendingCount = filteredRequests.filter(r => r.status === 'Pendente').length;

  // --- Detailed Data Processing (By Lote and Sector) ---
  const reportMonthContext = startDate.slice(0, 7); // Use start date month for lote definitions
  const lotes = getMonthlyLote(reportMonthContext);

  const startObj = new Date(startDate + 'T12:00:00');
  const endObj = new Date(endDate + 'T12:00:00');
  const daysInRange: string[] = [];
  let curr = new Date(startObj);
  while (curr <= endObj) {
    daysInRange.push(curr.toISOString().slice(0, 10));
    curr.setDate(curr.getDate() + 1);
  }

  // Initialize buckets
  const loteBuckets = lotes.map(l => ({ ...l, qty: 0, cost: 0 }));
  const sectorBuckets = sectors.map(s => ({ ...s, qty: 0, cost: 0 }));

  // Iterate range to assign costs/qty
  daysInRange.forEach(dateStr => {
    const currentLoopDate = new Date(dateStr + 'T12:00:00');
    const dayOfMonth = currentLoopDate.getDate();

    approvedRequests.forEach(req => {
      // Check if request covers this day
      const [rYear, rMonth, rDay] = req.dateEvent.split('-').map(Number);
      const reqStart = new Date(rYear, rMonth - 1, rDay, 12, 0, 0);
      const reqEnd = new Date(reqStart);
      reqEnd.setDate(reqStart.getDate() + (req.daysQty - 1));

      if (currentLoopDate >= reqStart && currentLoopDate <= reqEnd) {
        const dailyCost = (req.totalValue || 0) / (req.daysQty || 1);
        const dailyCostWithTax = dailyCost * (1 + (systemConfig.taxRate / 100));
        const dailyQty = req.extrasQty;

        // Assign to Lote (only if it's the same month as context to be accurate, else skip lote attribution)
        if (dateStr.startsWith(reportMonthContext)) {
          const activeLote = loteBuckets.find(l => dayOfMonth >= l.startDay && dayOfMonth <= l.endDay);
          if (activeLote) {
            activeLote.qty += dailyQty;
            activeLote.cost += dailyCostWithTax;
          }
        }

        // Assign to Sector
        const activeSector = sectorBuckets.find(s => s.name === req.sector);
        if (activeSector) {
          activeSector.qty += dailyQty;
          activeSector.cost += dailyCostWithTax;
        }
      }
    });
  });

  // Format data for Recharts
  const qtyByLoteData = loteBuckets.map(l => ({ name: l.name, value: l.qty }));
  const costByLoteData = loteBuckets.map(l => ({ name: l.name, value: Math.round(l.cost) }));

  const qtyBySectorData = sectorBuckets
    .filter(s => s.qty > 0)
    .map(s => ({ name: s.name, value: s.qty }))
    .sort((a, b) => b.value - a.value);

  const costBySectorData = sectorBuckets
    .filter(s => s.cost > 0)
    .map(s => ({ name: s.name, value: Math.round(s.cost) }))
    .sort((a, b) => b.value - a.value);


  // Helper to calculate End Date for table
  const calculateEndDate = (dateStr: string, days: number) => {
    if (days <= 1) return dateStr;
    const [year, month, day] = dateStr.split('-').map(Number);
    // Create UTC date
    const date = new Date(Date.UTC(year, month - 1, day));
    // Add days (inclusive logic: start day counts as day 1, so add days-1)
    date.setUTCDate(date.getUTCDate() + (days - 1));
    return date.toISOString().split('T')[0];
  };

  // Helper to format date string DD/MM/YYYY ignoring timezone
  const formatDate = (dateStr: string) => {
    if (!dateStr) return '';
    const [y, m, d] = dateStr.split('-');
    return `${d}/${m}/${y}`;
  };

  const ChartSection = ({ title, data, color, prefix = '' }: { title: string, data: any[], color: string, prefix?: string }) => (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
      <h3 className="text-sm font-bold text-[#155645] mb-4 uppercase tracking-wider">{title}</h3>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 30, right: 10, left: 10, bottom: 20 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="name"
              fontSize={9}
              tickLine={false}
              axisLine={false}
              interval={0}
              angle={-45}
              textAnchor="end"
              height={60}
            />
            <YAxis hide />
            <Tooltip cursor={{ fill: 'transparent' }} />
            <Bar dataKey="value" fill={color} radius={[4, 4, 0, 0]}>
              <LabelList
                dataKey="value"
                position="top"
                fill="#155645"
                fontSize={9}
                fontWeight="bold"
                offset={8}
                formatter={(val: number) => `${prefix}${val.toLocaleString('pt-BR')}`}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );

  // Check if admin is unlocked via PIN in this session
  const isAdminUnlocked = sessionStorage.getItem('admin_unlocked') === 'true';

  return (
    <div className="space-y-6">
      {/* Date Filter */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-col md:flex-row items-center justify-between no-print gap-4">
        <h3 className="text-[#155645] font-bold">Resumo Executivo</h3>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-slate-50 border border-slate-300 rounded-lg px-3 py-1.5 focus-within:ring-2 focus-within:ring-[#155645] focus-within:border-[#155645]">
            <Calendar size={16} className="text-[#155645]" />
            <input
              type="date"
              value={startDate}
              onChange={(e) => handleStartDateChange(e.target.value)}
              className="text-sm outline-none text-slate-700 bg-transparent w-32"
            />
          </div>
          <span className="text-slate-400">até</span>
          <div className="flex items-center gap-2 bg-slate-50 border border-slate-300 rounded-lg px-3 py-1.5 focus-within:ring-2 focus-within:ring-[#155645] focus-within:border-[#155645]">
            <Calendar size={16} className="text-[#155645]" />
            <input
              type="date"
              value={endDate}
              onChange={(e) => handleEndDateChange(e.target.value)}
              className="text-sm outline-none text-slate-700 bg-transparent w-32"
            />
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* KPI: Quantidade */}
        <div className="bg-white p-6 rounded-xl shadow-sm border-l-4 border-[#155645] flex flex-col justify-between">
          <div>
            <h3 className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-2">Quantidade de Diárias</h3>
            <p className="text-4xl font-extrabold text-[#155645]">{totalDiarias}</p>
            <span className="text-xs text-slate-400">Total Solicitado (Dias × Pessoas)</span>
          </div>
        </div>

        {/* KPI: Custo */}
        <div className="bg-white p-6 rounded-xl shadow-sm border-l-4 border-[#F8981C] flex flex-col justify-between">
          <div>
            <h3 className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-2">Custo Estimado (c/ Impostos)</h3>
            <p className="text-4xl font-extrabold text-[#F8981C]">
              R$ {Math.round(totalValueWithTax).toLocaleString('pt-BR')}
            </p>
            <span className="text-xs text-slate-400">Valor Acumulado no Mês</span>
          </div>
        </div>
      </div>

      {/* Charts Grid: 2 Columns */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Left Column: Quantity Focus - Using Primary Green */}
        <div className="space-y-6">
          <ChartSection title="Diárias por Lote" data={qtyByLoteData} color="#155645" />
          <ChartSection title="Diárias por Setor" data={qtyBySectorData} color="#1E7A62" />
        </div>

        {/* Right Column: Cost Focus - Using Accent Orange */}
        <div className="space-y-6">
          <ChartSection title="Custo por Lote (R$)" data={costByLoteData} color="#F8981C" prefix="R$ " />
          <ChartSection title="Custo por Setor (R$)" data={costBySectorData} color="#FBB355" prefix="R$ " />
        </div>
      </div>

      {isAdminUnlocked && (
        <div className="space-y-4">

          {/* Pending Alert Banner */}
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-orange-100 p-2 rounded-full text-orange-600">
                <Clock size={20} />
              </div>
              <div>
                <h4 className="text-sm font-bold text-orange-900">Pendências de Aprovação</h4>
                <p className="text-xs text-orange-700">Existem {pendingCount} solicitações aguardando sua análise.</p>
              </div>
            </div>
            <div className="text-2xl font-bold text-orange-600 px-4">
              {pendingCount}
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
              <h3 className="text-lg font-bold text-[#155645] flex items-center gap-2">
                <AlertCircle size={20} className="text-[#F8981C]" />
                Gerenciamento de Solicitações (Admin - {formatDate(startDate)} até {formatDate(endDate)})
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#155645]/5 text-[#155645] uppercase">
                  <tr>
                    <th className="p-3">Data Início</th>
                    <th className="p-3">Data Fim</th>
                    <th className="p-3 text-center">Dias</th>
                    <th className="p-3">Horário</th>
                    <th className="p-3">Setor</th>
                    <th className="p-3">Função</th>
                    <th className="p-3 text-center">Qtd</th>
                    <th className="p-3">Solicitante</th>
                    <th className="p-3 w-48">Justificativa</th>
                    <th className="p-3 text-right">Valor Total</th>
                    <th className="p-3">Status</th>
                    <th className="p-3 text-center">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredRequests.map((req) => (
                    <tr key={req.id} className="hover:bg-slate-50 transition-colors">
                      <td className="p-3 font-medium whitespace-nowrap">{formatDate(req.dateEvent)}</td>
                      <td className="p-3 font-medium whitespace-nowrap text-slate-500">
                        {formatDate(calculateEndDate(req.dateEvent, req.daysQty))}
                      </td>
                      <td className="p-3 text-center font-bold bg-slate-50/50">{req.daysQty}</td>
                      <td className="p-3 whitespace-nowrap">{req.timeIn} - {req.timeOut}</td>
                      <td className="p-3">{req.sector}</td>
                      <td className="p-3">
                        {req.functionRole}
                        <span className="block text-[10px] text-slate-400">{req.type}</span>
                      </td>
                      <td className="p-3 text-center">{req.extrasQty}</td>
                      <td className="p-3 truncate max-w-[150px]" title={req.requestorEmail}>{req.requestorEmail}</td>
                      <td className="p-3 truncate max-w-[200px]" title={req.justification}>{req.justification}</td>
                      <td className="p-3 text-right whitespace-nowrap">
                        R$ {(req.totalValue || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="p-3">
                        <span className={`px-2 py-1 rounded-full text-[10px] font-semibold ${req.status === 'Aprovado' ? 'bg-green-100 text-green-700' :
                          req.status === 'Rejeitado' ? 'bg-red-100 text-red-700' :
                            'bg-yellow-100 text-yellow-700'
                          }`}>
                          {req.status}
                        </span>
                      </td>
                      <td className="p-3">
                        <div className="flex items-center justify-center gap-1">
                          {req.status === 'Pendente' && (
                            <>
                              <button
                                onClick={() => updateRequestStatus(req.id, 'Aprovado')}
                                title="Aprovar"
                                className="p-1 bg-green-100 text-green-600 rounded hover:bg-green-200"
                              >
                                <Check size={14} />
                              </button>
                              <button
                                onClick={() => updateRequestStatus(req.id, 'Rejeitado')}
                                title="Rejeitar"
                                className="p-1 bg-red-100 text-red-600 rounded hover:bg-red-200"
                              >
                                <X size={14} />
                              </button>
                            </>
                          )}
                          <button
                            onClick={() => deleteRequest(req.id)}
                            title="Excluir"
                            className="p-1 bg-slate-100 text-slate-500 rounded hover:bg-slate-200 hover:text-red-500"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filteredRequests.length === 0 && (
                    <tr>
                      <td colSpan={12} className="p-8 text-center text-slate-400">
                        Nenhuma solicitação encontrada para este mês.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};