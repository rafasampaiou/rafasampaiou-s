import React, { useState, useMemo } from 'react';
import { useApp } from '../context';
import { UserRole } from '../types';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LabelList, Cell
} from 'recharts';
import { Check, X, AlertCircle, Calendar, Clock, Edit2, Save, Trash2 } from 'lucide-react';
import { RequestItem, Shift, RequestType } from '../types';

export const Dashboard: React.FC = () => {
  const { requests, sectors, user, updateRequestStatus, updateRequest, deleteRequest, systemConfig, getMonthlyLote, getMonthlyAppConfig, calculateRequestTotal } = useApp();

  // Filters State
  const [selectedSector, setSelectedSector] = useState(() => sessionStorage.getItem('dashboard_sector') || 'Todos');
  const [selectedYear, setSelectedYear] = useState(() => sessionStorage.getItem('dashboard_year') || String(new Date().getFullYear()));
  const [selectedMonth, setSelectedMonth] = useState(() => sessionStorage.getItem('dashboard_month') || String(new Date().getMonth() + 1).padStart(2, '0'));
  const [selectedLote, setSelectedLote] = useState(() => sessionStorage.getItem('dashboard_lote') || 'Todos');
  const [selectedStatus, setSelectedStatus] = useState(() => sessionStorage.getItem('dashboard_status') || 'Todos');

  // Edit State
  const [editingRequest, setEditingRequest] = useState<RequestItem | null>(null);

  const monthKey = `${selectedYear}-${selectedMonth}`;
  const availableLotes = getMonthlyLote(monthKey);

  // Persist filters
  const handleSectorChange = (val: string) => {
    setSelectedSector(val);
    sessionStorage.setItem('dashboard_sector', val);
  };
  const handleYearChange = (val: string) => {
    setSelectedYear(val);
    sessionStorage.setItem('dashboard_year', val);
  };
  const handleMonthChange = (val: string) => {
    setSelectedMonth(val);
    sessionStorage.setItem('dashboard_month', val);
  };
  const handleLoteChange = (val: string) => {
    setSelectedLote(val);
    sessionStorage.setItem('dashboard_lote', val);
  };
  const handleStatusChange = (val: string) => {
    setSelectedStatus(val);
    sessionStorage.setItem('dashboard_status', val);
  };

  // Filter logic for Charts and Summary Table
  const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' }>({ key: 'dateEvent', direction: 'asc' });

  // Filter logic
  const filteredRequests = requests.filter(r => {
    if (selectedSector !== 'Todos' && r.sector !== selectedSector) return false;
    if (selectedStatus !== 'Todos' && r.status !== selectedStatus) return false;
    if (!r.dateEvent.startsWith(monthKey)) return false;

    if (selectedLote !== 'Todos') {
      const lote = availableLotes.find(l => l.name === selectedLote);
      if (lote) {
        const day = parseInt(r.dateEvent.split('-')[2]);
        return day >= lote.startDay && day <= lote.endDay;
      }
    }
    return true;
  }).sort((a, b) => {
    const valueA = a[sortConfig.key as keyof RequestItem] || '';
    const valueB = b[sortConfig.key as keyof RequestItem] || '';

    if (valueA < valueB) return sortConfig.direction === 'asc' ? -1 : 1;
    if (valueA > valueB) return sortConfig.direction === 'asc' ? 1 : -1;
    return 0;
  });

  const approvedRequests = filteredRequests.filter(r => r.status === 'Aprovado');

  // Requests that need attention (Independent of filters)
  // Requests that need attention (Independent of filters)
  const pendingRequests = useMemo(() => {
    let list = requests.filter(r => r.status === 'Pendente');
    list.sort((a, b) => {
      const valueA = a[sortConfig.key as keyof RequestItem] || '';
      const valueB = b[sortConfig.key as keyof RequestItem] || '';

      if (valueA < valueB) return sortConfig.direction === 'asc' ? -1 : 1;
      if (valueA > valueB) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
    return list;
  }, [requests, sortConfig]);

  // --- KPI Calculations ---
  const totalDiarias = approvedRequests.reduce((acc, curr) => acc + (curr.daysQty * curr.extrasQty), 0);

  // Calculate dynamic total value based on current monthly settings
  const totalValue = approvedRequests.reduce((acc, curr) => acc + calculateRequestTotal(curr), 0);

  // KPI Calculation for tax needs to respect the specific month of each request
  const totalValueWithTax = approvedRequests.reduce((acc, curr) => {
    const reqMonth = curr.dateEvent.substring(0, 7);
    const config = getMonthlyAppConfig(reqMonth);
    return acc + calculateRequestTotal(curr) * (1 + (config.taxRate / 100));
  }, 0);

  // --- Data Processing (By Lote and Sector) ---
  // --- Data Processing (By Lote and Sector) ---
  const reportMonthContext = monthKey;
  const lotes = availableLotes;

  const daysInMonth = new Date(parseInt(selectedYear), parseInt(selectedMonth), 0).getDate();
  const daysInRange: string[] = Array.from({ length: daysInMonth }, (_, i) =>
    `${selectedYear}-${selectedMonth}-${String(i + 1).padStart(2, '0')}`
  );

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
        const reportMonth = dateStr.substring(0, 7);
        const config = getMonthlyAppConfig(reportMonth);
        const dailyCost = (req.totalValue || 0) / (req.daysQty || 1);
        const dailyCostWithTax = dailyCost * (1 + (config.taxRate / 100));
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

  // Qty by Lote: Group by name to handle any remaining duplicates in DB
  const qtyByLoteMap: Record<string, number> = {};
  loteBuckets.forEach(l => {
    qtyByLoteMap[l.name] = (qtyByLoteMap[l.name] || 0) + l.qty;
  });
  const qtyByLoteData = Object.entries(qtyByLoteMap)
    .filter(([_, value]) => value > 0)
    .map(([name, value]) => ({ name, value }));

  // Cost by Lote: Group by name
  const costByLoteMap: Record<string, number> = {};
  loteBuckets.forEach(l => {
    costByLoteMap[l.name] = (costByLoteMap[l.name] || 0) + Math.round(l.cost);
  });
  const costByLoteData = Object.entries(costByLoteMap)
    .filter(([_, value]) => value > 0)
    .map(([name, value]) => ({ name, value }));

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

  const formatDateTime = (isoStr: string) => {
    if (!isoStr) return '';
    try {
      const date = new Date(isoStr);
      const d = String(date.getDate()).padStart(2, '0');
      const m = String(date.getMonth() + 1).padStart(2, '0');
      const h = String(date.getHours()).padStart(2, '0');
      const min = String(date.getMinutes()).padStart(2, '0');
      return `${d}/${m} ${h}:${min}`;
    } catch { return ''; }
  };

  const EditRequestModal = ({ request, onClose }: { request: RequestItem, onClose: () => void }) => {
    const [editData, setEditData] = useState({ ...request });

    const handleSave = async () => {
      await updateRequest(request.id, editData);
      onClose();
    };

    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-lg overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
            <h3 className="text-lg font-bold text-[#155645]">Editar Solicitação</h3>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
          </div>
          <div className="p-6 grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Setor</label>
              <select
                value={editData.sector}
                onChange={(e) => setEditData({ ...editData, sector: e.target.value })}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#155645]"
              >
                {sectors.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Motivo</label>
              <select
                value={editData.reason}
                onChange={(e) => setEditData({ ...editData, reason: e.target.value as any })}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#155645]"
              >
                <option value="Ocupação">Ocupação</option>
                <option value="Quadro Ideal">Quadro Ideal</option>
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Tipo</label>
              <select
                value={editData.type}
                onChange={(e) => setEditData({ ...editData, type: e.target.value as any })}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#155645]"
              >
                <option value={RequestType.DIARIA}>Diária</option>
                <option value={RequestType.PACOTE}>Pacote</option>
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Entrada</label>
              <input
                type="time"
                value={editData.timeIn}
                onChange={(e) => setEditData({ ...editData, timeIn: e.target.value })}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#155645]"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Saída</label>
              <input
                type="time"
                value={editData.timeOut}
                onChange={(e) => setEditData({ ...editData, timeOut: e.target.value })}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#155645]"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Qtd Extras</label>
              <input
                type="number"
                value={editData.extrasQty}
                onChange={(e) => setEditData({ ...editData, extrasQty: parseInt(e.target.value) || 0 })}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#155645]"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Qtd Dias</label>
              <input
                type="number"
                value={editData.daysQty}
                onChange={(e) => setEditData({ ...editData, daysQty: parseInt(e.target.value) || 0 })}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#155645]"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Vl. Especial (R$)</label>
              <input
                type="number"
                step="0.01"
                value={editData.specialRate || ''}
                onChange={(e) => setEditData({ ...editData, specialRate: parseFloat(e.target.value) || 0 })}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#155645]"
                placeholder="Opcional"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Ocupação (%)</label>
              <input
                type="number"
                step="0.01"
                value={editData.occupancyRate || ''}
                onChange={(e) => setEditData({ ...editData, occupancyRate: parseFloat(e.target.value) || 0 })}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#155645]"
                placeholder="0.00"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Turno</label>
              <select
                value={editData.shift}
                onChange={(e) => setEditData({ ...editData, shift: e.target.value as Shift })}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#155645]"
              >
                {Object.values(Shift).map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Função</label>
              <input
                type="text"
                value={editData.functionRole}
                onChange={(e) => setEditData({ ...editData, functionRole: e.target.value })}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#155645]"
              />
            </div>
            <div className="col-span-2">
              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Data Início</label>
              <input
                type="date"
                value={editData.dateEvent}
                onChange={(e) => setEditData({ ...editData, dateEvent: e.target.value })}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#155645]"
              />
            </div>
            <div className="col-span-2">
              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Justificativa</label>
              <textarea
                value={editData.justification}
                onChange={(e) => setEditData({ ...editData, justification: e.target.value })}
                rows={2}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#155645]"
              />
            </div>
          </div>
          <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
            <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-200 rounded-lg transition-colors">Cancelar</button>
            <button onClick={handleSave} className="px-4 py-2 text-sm font-bold bg-[#155645] text-white rounded-lg hover:bg-[#104033] transition-colors flex items-center gap-2 shadow-sm">
              <Save size={16} /> Salvar Alterações
            </button>
          </div>
        </div>
      </div>
    );
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
              <LabelList
                dataKey="value"
                position="top"
                fill="#155645"
                fontSize={9}
                fontWeight="bold"
                offset={8}
                formatter={(val: any) => {
                  if (typeof val !== 'number') return val;
                  return prefix === 'R$ '
                    ? `R$ ${val.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
                    : val.toLocaleString('pt-BR');
                }}
              />
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
        <div className={`bg-white rounded-xl shadow-sm border-2 overflow-hidden no-print ${pendingRequests.length > 0 ? 'border-[#F8981C]' : 'border-[#155645]'
          }`}>
          <div className={`px-6 py-4 border-b flex justify-between items-center ${pendingRequests.length > 0 ? 'border-orange-100 bg-orange-50' : 'border-green-100 bg-green-50/50'
            }`}>
            <h3 className="text-lg font-bold text-[#155645] flex items-center gap-2">
              <AlertCircle size={20} className={pendingRequests.length > 0 ? 'text-[#F8981C]' : 'text-[#155645]'} />
              Gerenciamento de Solicitações
            </h3>
            <div className={`text-xs font-bold px-3 py-1 rounded-full ${pendingRequests.length > 0 ? 'bg-orange-200 text-orange-800' : 'bg-green-200 text-green-800'
              }`}>
              {pendingRequests.length === 0 ? 'Tudo em dia' : `${pendingRequests.length} para analisar`}
            </div>
          </div>
          <div className="overflow-x-auto max-h-[400px]">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#155645]/5 text-[#155645] uppercase sticky top-0 bg-white shadow-sm">
                <tr>
                  <th
                    className="p-3 cursor-pointer hover:bg-slate-100 transition-colors"
                    onClick={() => setSortConfig(prev => ({
                      key: 'dateEvent',
                      direction: prev.key === 'dateEvent' && prev.direction === 'asc' ? 'desc' : 'asc'
                    }))}
                  >
                    Início {sortConfig.key === 'dateEvent' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}
                  </th>
                  <th className="p-3">Fim</th>
                  <th className="p-3">Solicitado em</th>
                  <th className="p-3">Dias</th>
                  <th
                    className="p-3 cursor-pointer hover:bg-slate-100 transition-colors"
                    onClick={() => setSortConfig(prev => ({
                      key: 'sector',
                      direction: prev.key === 'sector' && prev.direction === 'asc' ? 'desc' : 'asc'
                    }))}
                  >
                    Setor {sortConfig.key === 'sector' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}
                  </th>
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
                    <td className="p-3 font-medium whitespace-nowrap">{formatDate(req.dateEvent)}</td>
                    <td className="p-3 text-slate-400 whitespace-nowrap">{formatDate(calculateEndDate(req.dateEvent, req.daysQty))}</td>
                    <td className="p-3 text-slate-400 whitespace-nowrap font-mono">{formatDateTime(req.createdAt || '')}</td>
                    <td className="p-3 font-bold">{req.daysQty}</td>
                    <td className="p-3 font-medium">{req.sector}</td>
                    <td className="p-3">{req.functionRole}</td>
                    <td className="p-3 text-center">{req.extrasQty}</td>
                    <td className="p-3 whitespace-nowrap">{req.timeIn} - {req.timeOut}</td>
                    <td className="p-3 truncate max-w-[120px]" title={req.requestorEmail}>{req.requestorEmail}</td>
                    <td className="p-3 truncate max-w-[180px]" title={req.justification}>{req.justification}</td>
                    <td className="p-3 text-right font-bold text-[#155645]">R$ {calculateRequestTotal(req).toLocaleString('pt-BR')}</td>
                    <td className="p-3">
                      <div className="flex items-center justify-center gap-1">
                        <button onClick={() => setEditingRequest(req)} className="p-1 bg-blue-100 text-blue-600 rounded hover:bg-blue-600 hover:text-white transition-all" title="Editar">
                          <Edit2 size={14} />
                        </button>
                        <button onClick={() => updateRequestStatus(req.id, 'Aprovado')} className="p-1 bg-green-100 text-green-600 rounded hover:bg-green-600 hover:text-white transition-all" title="Aprovar">
                          <Check size={14} />
                        </button>
                        <button onClick={() => updateRequestStatus(req.id, 'Rejeitado')} className="p-1 bg-red-100 text-red-600 rounded hover:bg-red-600 hover:text-white transition-all" title="Recusar">
                          <X size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {pendingRequests.length === 0 && (
                  <tr>
                    <td colSpan={12} className="p-8 text-center text-slate-400 italic">
                      Não há solicitações pendentes no momento.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {editingRequest && (
            <EditRequestModal
              request={editingRequest}
              onClose={() => setEditingRequest(null)}
            />
          )}
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

            {/* Year Filter */}
            <div className="flex flex-col">
              <label className="text-[10px] font-bold text-slate-400 uppercase mb-1">Ano</label>
              <select
                value={selectedYear}
                onChange={(e) => handleYearChange(e.target.value)}
                className="bg-slate-50 border border-slate-300 rounded-lg px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-[#155645] text-slate-700"
              >
                {[2024, 2025, 2026, 2027, 2028, 2029, 2030].map(y => <option key={y} value={String(y)}>{y}</option>)}
              </select>
            </div>

            {/* Month Filter */}
            <div className="flex flex-col">
              <label className="text-[10px] font-bold text-slate-400 uppercase mb-1">Mês</label>
              <select
                value={selectedMonth}
                onChange={(e) => handleMonthChange(e.target.value)}
                className="bg-slate-50 border border-slate-300 rounded-lg px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-[#155645] text-slate-700"
              >
                {['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'].map(m => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>

            {/* Lote Filter */}
            <div className="flex flex-col">
              <label className="text-[10px] font-bold text-slate-400 uppercase mb-1">Lote</label>
              <select
                value={selectedLote}
                onChange={(e) => handleLoteChange(e.target.value)}
                className="bg-slate-50 border border-slate-300 rounded-lg px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-[#155645] text-slate-700 w-32"
              >
                <option value="Todos">Todos os Lotes</option>
                {Array.from(new Set(availableLotes.map(l => l.name))).map(name => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* 3. KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border-l-4 border-[#155645]">
          <h3 className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-2">Quantidade de Diárias</h3>
          <p className="text-4xl font-extrabold text-[#155645]">{totalDiarias}</p>
          <span className="text-xs text-slate-400">Total Solicitado no período selecionado</span>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border-l-4 border-[#F8981C]">
          <h3 className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-2">Custo Estimado (c/ Impostos)</h3>
          <p className="text-4xl font-extrabold text-[#F8981C]">
            R$ {Math.round(totalValueWithTax).toLocaleString('pt-BR')}
          </p>
          <span className="text-xs text-slate-400">Total Financeiro no período selecionado</span>
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
        <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
          <div>
            <h3 className="text-lg font-bold text-[#155645]">Resumo das Solicitações Feitas</h3>
            <p className="text-xs text-slate-500 mt-1">Exibindo dados filtrados por Setor e Período</p>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-[10px] font-bold text-slate-400 uppercase">Status</label>
            <select
              value={selectedStatus}
              onChange={(e) => handleStatusChange(e.target.value)}
              className="bg-white border border-slate-300 rounded-lg px-3 py-1 text-xs outline-none focus:ring-2 focus:ring-[#155645] text-slate-700"
            >
              <option value="Todos">Todos</option>
              <option value="Aprovado">Aprovado</option>
              <option value="Rejeitado">Rejeitado</option>
              <option value="Pendente">Pendente</option>
            </select>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 uppercase font-bold border-b border-slate-100">
              <tr>
                <th
                  className="p-4 cursor-pointer hover:bg-slate-100 transition-colors"
                  onClick={() => setSortConfig(prev => ({
                    key: 'dateEvent',
                    direction: prev.key === 'dateEvent' && prev.direction === 'asc' ? 'desc' : 'asc'
                  }))}
                >
                  Início {sortConfig.key === 'dateEvent' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}
                </th>
                <th className="p-4">Fim</th>
                <th
                  className="p-4 cursor-pointer hover:bg-slate-100 transition-colors"
                  onClick={() => setSortConfig(prev => ({
                    key: 'sector',
                    direction: prev.key === 'sector' && prev.direction === 'asc' ? 'desc' : 'asc'
                  }))}
                >
                  Setor {sortConfig.key === 'sector' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}
                </th>
                <th className="p-4">Função</th>
                <th className="p-4 text-center">Extras</th>
                <th className="p-4 text-center">Dias</th>
                <th className="p-4">Entrada</th>
                <th className="p-4">Saída</th>
                <th className="p-4">Motivo</th>
                <th className="p-4 text-right">Valor Total</th>
                <th className="p-4 text-center">Status</th>
                {isAdminUnlocked && <th className="p-4 text-center">Ações</th>}
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
                  <td className="p-4">{req.timeIn}</td>
                  <td className="p-4">{req.timeOut}</td>
                  <td className="p-4">{req.reason}</td>
                  <td className="p-4 text-right font-bold text-[#155645]">R$ {calculateRequestTotal(req).toLocaleString('pt-BR')}</td>
                  <td className="p-4 text-center">
                    <span className={`px-2 py-1 rounded-full text-[10px] font-bold ${req.status === 'Aprovado' ? 'bg-green-100 text-green-700' :
                      req.status === 'Rejeitado' ? 'bg-red-100 text-red-700' :
                        'bg-yellow-100 text-yellow-700'
                      }`}>
                      {req.status}
                    </span>
                  </td>
                  {isAdminUnlocked && (
                    <td className="p-4 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button onClick={() => setEditingRequest(req)} className="p-1.5 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-600 hover:text-white transition-all shadow-sm" title="Editar">
                          <Edit2 size={14} />
                        </button>
                        <button onClick={() => { if (window.confirm('Excluir esta solicitação permanentemente?')) deleteRequest(req.id); }} className="p-1.5 bg-red-50 text-red-600 rounded-lg hover:bg-red-600 hover:text-white transition-all shadow-sm" title="Excluir">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  )}
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