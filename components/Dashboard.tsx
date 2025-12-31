import React, { useState, useMemo } from 'react';
import { useApp } from '../context';
import { UserRole } from '../types';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LabelList, Cell
} from 'recharts';
import { Check, X, Trash2, AlertCircle, Calendar, Clock } from 'lucide-react';

export const Dashboard: React.FC = () => {
  const { requests, sectors, user, updateRequestStatus, deleteRequest, systemConfig, getMonthlyLote } = useApp();

  // Filters State
  const [startDate, setStartDate] = useState(() => {
    return sessionStorage.getItem('dashboard_startDate') || new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10);
  });
  const [endDate, setEndDate] = useState(() => {
    return sessionStorage.getItem('dashboard_endDate') || new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).toISOString().slice(0, 10);
  });
  const [selectedSector, setSelectedSector] = useState(() => {
    return sessionStorage.getItem('dashboard_sector') || 'Todos';
  });

  // Persist filters
  const handleStartDateChange = (val: string) => {
    setStartDate(val);
    sessionStorage.setItem('dashboard_startDate', val);
  };
  const handleEndDateChange = (val: string) => {
    setEndDate(val);
    sessionStorage.setItem('dashboard_endDate', val);
  };
  const handleSectorChange = (val: string) => {
    setSelectedSector(val);
    sessionStorage.setItem('dashboard_sector', val);
  };

  // Filter logic for Charts and Summary Table
  const filteredRequests = requests.filter(r => {
    const matchDate = r.dateEvent >= startDate && r.dateEvent <= endDate;
    const matchSector = selectedSector === 'Todos' || r.sector === selectedSector;
    return matchDate && matchSector;
  });

  const approvedRequests = filteredRequests.filter(r => r.status === 'Aprovado');

  // Requests that need attention (Independent of filters)
  const pendingRequests = requests.filter(r => r.status === 'Pendente');

  // --- KPI Calculations ---
  const totalDiarias = approvedRequests.reduce((acc, curr) => acc + (curr.daysQty * curr.extrasQty), 0);
  const totalValue = approvedRequests.reduce((acc, curr) => acc + (curr.totalValue || 0), 0);
  const totalValueWithTax = totalValue * (1 + (systemConfig.taxRate / 100));

  // --- Data Processing (By Lote and Sector) ---
  const reportMonthContext = startDate.slice(0, 7);
  const lotes = getMonthlyLote(reportMonthContext);

  const startObj = new Date(startDate + 'T12:00:00');
  const endObj = new Date(endDate + 'T12:00:00');
  const daysInRange: string[] = [];
  let curr = new Date(startObj);
  while (curr <= endObj) {
    daysInRange.push(curr.toISOString().slice(0, 10));
    curr.setDate(curr.getDate() + 1);
  }

  const loteBuckets = lotes.map(l => ({ ...l, qty: 0, cost: 0 }));
  const sectorBuckets = sectors.map(s => ({ ...s, qty: 0, cost: 0 }));

  daysInRange.forEach(dateStr => {
    const currentLoopDate = new Date(dateStr + 'T12:00:00');
    const dayOfMonth = currentLoopDate.getDate();

    approvedRequests.forEach(req => {
      const [rYear, rMonth, rDay] = req.dateEvent.split('-').map(Number);
      const reqStart = new Date(rYear, rMonth - 1, rDay, 12, 0, 0);
      const reqEnd = new Date(reqStart);
      reqEnd.setDate(reqStart.getDate() + (req.daysQty - 1));

      if (currentLoopDate >= reqStart && currentLoopDate <= reqEnd) {
        const dailyCost = (req.totalValue || 0) / (req.daysQty || 1);
        const dailyCostWithTax = dailyCost * (1 + (systemConfig.taxRate / 100));
        const dailyQty = req.extrasQty;

        if (dateStr.startsWith(reportMonthContext)) {
          const activeLote = loteBuckets.find(l => dayOfMonth >= l.startDay && dayOfMonth <= l.endDay);
          if (activeLote) {
            activeLote.qty += dailyQty;
            activeLote.cost += dailyCostWithTax;
          }
        }

        const activeSector = sectorBuckets.find(s => s.name === req.sector);
        if (activeSector) {
          activeSector.qty += dailyQty;
          activeSector.cost += dailyCostWithTax;
        }
      }
    });
  });

  const qtyByLoteData = loteBuckets.map(l => ({ name: l.name, value: l.qty }));
  const costByLoteData = loteBuckets.map(l => ({ name: l.name, value: Math.round(l.cost) }));
  const qtyBySectorData = sectorBuckets.filter(s => s.qty > 0).map(s => ({ name: s.name, value: s.qty })).sort((a, b) => b.value - a.value);
  const costBySectorData = sectorBuckets.filter(s => s.cost > 0).map(s => ({ name: s.name, value: Math.round(s.cost) })).sort((a, b) => b.value - a.value);

  const calculateEndDate = (dateStr: string, days: number) => {
    if (days <= 1) return dateStr;
    const [year, month, day] = dateStr.split('-').map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));
    date.setUTCDate(date.getUTCDate() + (days - 1));
    return date.toISOString().split('T')[0];
  };

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
            <XAxis dataKey="name" fontSize={9} tickLine={false} axisLine={false} interval={0} angle={-45} textAnchor="end" height={60} />
            <YAxis hide />
            <Tooltip cursor={{ fill: 'transparent' }} />
            <Bar dataKey="value" fill={color} radius={[4, 4, 0, 0]}>
              <LabelList dataKey="value" position="top" fill="#155645" fontSize={9} fontWeight="bold" offset={8} formatter={(val: number) => `${prefix}${val.toLocaleString('pt-BR')}`} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );

  const isAdminUnlocked = sessionStorage.getItem('admin_unlocked') === 'true';

  return (
    <div className="space-y-8">

      {/* 1. Admin Request Management - AT THE TOP */}
      {isAdminUnlocked && (
        <div className="bg-white rounded-xl shadow-sm border-2 border-[#F8981C] overflow-hidden no-print">
          <div className="px-6 py-4 border-b border-orange-100 bg-orange-50 flex justify-between items-center">
            <h3 className="text-lg font-bold text-[#155645] flex items-center gap-2">
              <AlertCircle size={20} className="text-[#F8981C]" />
              Gerenciamento de Solicitações (Admin - Todas as Pendências)
            </h3>
            <div className="bg-orange-200 text-orange-800 text-xs font-bold px-3 py-1 rounded-full">
              {pendingRequests.length} para analisar
            </div>
          </div>
          <div className="overflow-x-auto max-h-[400px]">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#155645]/5 text-[#155645] uppercase sticky top-0 bg-white shadow-sm">
                <tr>
                  <th className="p-3">Data</th>
                  <th className="p-3">Dias</th>
                  <th className="p-3">Setor</th>
                  <th className="p-3">Função</th>
                  <th className="p-3">Qtd</th>
                  <th className="p-3">Horário</th>
                  <th className="p-3">Solicitante</th>
                  <th className="p-3">Justificativa</th>
                  <th className="p-3 text-right">Valor</th>
                  <th className="p-3 text-center">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {pendingRequests.map((req) => (
                  <tr key={req.id} className="hover:bg-orange-50/30 transition-colors">
                    <td className="p-3 font-medium">{formatDate(req.dateEvent)}</td>
                    <td className="p-3 font-bold">{req.daysQty}</td>
                    <td className="p-3">{req.sector}</td>
                    <td className="p-3">{req.functionRole}</td>
                    <td className="p-3">{req.extrasQty}</td>
                    <td className="p-3 whitespace-nowrap">{req.timeIn} - {req.timeOut}</td>
                    <td className="p-3 truncate max-w-[120px]" title={req.requestorEmail}>{req.requestorEmail}</td>
                    <td className="p-3 truncate max-w-[200px]" title={req.justification}>{req.justification}</td>
                    <td className="p-3 text-right font-bold">R$ {(req.totalValue || 0).toLocaleString('pt-BR')}</td>
                    <td className="p-3">
                      <div className="flex items-center justify-center gap-1">
                        <button onClick={() => updateRequestStatus(req.id, 'Aprovado')} className="p-1 bg-green-100 text-green-600 rounded hover:bg-green-600 hover:text-white transition-all">
                          <Check size={14} />
                        </button>
                        <button onClick={() => updateRequestStatus(req.id, 'Rejeitado')} className="p-1 bg-red-100 text-red-600 rounded hover:bg-red-600 hover:text-white transition-all">
                          <X size={14} />
                        </button>
                        <button onClick={() => deleteRequest(req.id)} className="p-1 bg-slate-100 text-slate-500 rounded hover:bg-red-500 hover:text-white transition-all">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {pendingRequests.length === 0 && (
                  <tr>
                    <td colSpan={10} className="p-8 text-center text-slate-400 italic">
                      Não há solicitações pendentes no momento.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 2. Filters & Title */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 space-y-4 no-print">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <h3 className="text-[#155645] text-xl font-bold">Resumo Executivo</h3>

          <div className="flex flex-wrap items-center gap-4">
            {/* Sector Filter */}
            <div className="flex flex-col">
              <label className="text-[10px] font-bold text-slate-400 uppercase mb-1">Setor</label>
              <select
                value={selectedSector}
                onChange={(e) => handleSectorChange(e.target.value)}
                className="bg-slate-50 border border-slate-300 rounded-lg px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-[#155645] text-slate-700"
              >
                <option value="Todos">Todos os Setores</option>
                {sectors.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
              </select>
            </div>

            {/* Date Filters */}
            <div className="flex items-center gap-2">
              <div className="flex flex-col">
                <label className="text-[10px] font-bold text-slate-400 uppercase mb-1">Início</label>
                <div className="flex items-center gap-2 bg-slate-50 border border-slate-300 rounded-lg px-3 py-1.5 focus-within:ring-2 focus-within:ring-[#155645]">
                  <Calendar size={14} className="text-[#155645]" />
                  <input type="date" value={startDate} onChange={(e) => handleStartDateChange(e.target.value)} className="text-sm outline-none text-slate-700 bg-transparent w-28" />
                </div>
              </div>
              <span className="text-slate-300 mt-4">/</span>
              <div className="flex flex-col">
                <label className="text-[10px] font-bold text-slate-400 uppercase mb-1">Fim</label>
                <div className="flex items-center gap-2 bg-slate-50 border border-slate-300 rounded-lg px-3 py-1.5 focus-within:ring-2 focus-within:ring-[#155645]">
                  <Calendar size={14} className="text-[#155645]" />
                  <input type="date" value={endDate} onChange={(e) => handleEndDateChange(e.target.value)} className="text-sm outline-none text-slate-700 bg-transparent w-28" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 3. KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border-l-4 border-[#155645]">
          <h3 className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-2">Quantidade de Diárias</h3>
          <p className="text-4xl font-extrabold text-[#155645]">{totalDiarias}</p>
          <span className="text-xs text-slate-400">Total Solicitado no filtro selecionado</span>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border-l-4 border-[#F8981C]">
          <h3 className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-2">Custo Estimado (c/ Impostos)</h3>
          <p className="text-4xl font-extrabold text-[#F8981C]">
            R$ {Math.round(totalValueWithTax).toLocaleString('pt-BR')}
          </p>
          <span className="text-xs text-slate-400">Total Financeiro no filtro selecionado</span>
        </div>
      </div>

      {/* 4. Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-6">
          <ChartSection title="Diárias por Lote" data={qtyByLoteData} color="#155645" />
          <ChartSection title="Diárias por Setor" data={qtyBySectorData} color="#1E7A62" />
        </div>
        <div className="space-y-6">
          <ChartSection title="Custo por Lote (R$)" data={costByLoteData} color="#F8981C" prefix="R$ " />
          <ChartSection title="Custo por Setor (R$)" data={costBySectorData} color="#FBB355" prefix="R$ " />
        </div>
      </div>

      {/* 5. Bottom Detailed Summary Table (Reacts to filters) */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50">
          <h3 className="text-lg font-bold text-[#155645]">Resumo das Solicitações Feitas</h3>
          <p className="text-xs text-slate-500 mt-1">Exibindo dados filtrados por Setor e Período</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 uppercase font-bold border-b border-slate-100">
              <tr>
                <th className="p-4">Início</th>
                <th className="p-4">Fim</th>
                <th className="p-4">Setor</th>
                <th className="p-4">Função</th>
                <th className="p-4 text-center">Extras</th>
                <th className="p-4 text-center">Dias</th>
                <th className="p-4">Solicitante</th>
                <th className="p-4">Motivo</th>
                <th className="p-4 text-right">Valor Total</th>
                <th className="p-4 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredRequests.map((req) => (
                <tr key={req.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="p-4 font-medium whitespace-nowrap">{formatDate(req.dateEvent)}</td>
                  <td className="p-4 text-slate-400 whitespace-nowrap">
                    {formatDate(calculateEndDate(req.dateEvent, req.daysQty))}
                  </td>
                  <td className="p-4">{req.sector}</td>
                  <td className="p-4">{req.functionRole}</td>
                  <td className="p-4 text-center">{req.extrasQty}</td>
                  <td className="p-4 text-center">{req.daysQty}</td>
                  <td className="p-4 truncate max-w-[150px]" title={req.requestorEmail}>{req.requestorEmail}</td>
                  <td className="p-4">{req.reason}</td>
                  <td className="p-4 text-right font-bold text-[#155645]">R$ {(req.totalValue || 0).toLocaleString('pt-BR')}</td>
                  <td className="p-4 text-center">
                    <span className={`px-2 py-1 rounded-full text-[10px] font-bold ${req.status === 'Aprovado' ? 'bg-green-100 text-green-700' :
                      req.status === 'Rejeitado' ? 'bg-red-100 text-red-700' :
                        'bg-yellow-100 text-yellow-700'
                      }`}>
                      {req.status}
                    </span>
                  </td>
                </tr>
              ))}
              {filteredRequests.length === 0 && (
                <tr>
                  <td colSpan={10} className="p-12 text-center text-slate-400 italic">
                    Nenhuma solicitação encontrada para os filtros selecionados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};