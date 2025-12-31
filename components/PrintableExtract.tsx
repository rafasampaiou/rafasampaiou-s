import React, { useRef, useState } from 'react';
import { useApp } from '../context';
import { Printer, Filter, Calendar } from 'lucide-react';

export const PrintableExtract: React.FC = () => {
  const { requests, sectors, getMonthlyBudget, systemConfig, user } = useApp();
  const componentRef = useRef<HTMLDivElement>(null);
  const [selectedSector, setSelectedSector] = useState('Todos');

  // Default to current month start/end
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];

  const [startDate, setStartDate] = useState(startOfMonth);
  const [endDate, setEndDate] = useState(endOfMonth);

  // Column Widths State (px) - Fixed configuration
  const [colWidths] = useState({
    date: 70,
    days: 40,
    qty: 40,
    role: 120,
    shift: 60,
    timeIn: 45,
    timeOut: 45,
    hours: 45,
    rate: 95,
    total: 100,
    occupancy: 50
  });

  const handlePrint = () => {
    window.print();
  };

  // Helper to calculate duration between times
  const getDuration = (start: string, end: string) => {
    if (!start || !end) return '0:00';
    const [h1, m1] = start.split(':').map(Number);
    const [h2, m2] = end.split(':').map(Number);
    let diffMinutes = (h2 * 60 + m2) - (h1 * 60 + m1);
    if (diffMinutes < 0) diffMinutes += 24 * 60;
    const h = Math.floor(diffMinutes / 60);
    const m = diffMinutes % 60;
    return `${h}:${m.toString().padStart(2, '0')}`;
  };

  // Helper to format date string DD/MM/YYYY ignoring timezone
  const formatDate = (dateStr: string) => {
    if (!dateStr) return '';
    const [y, m, d] = dateStr.split('-');
    return `${d}/${m}/${y}`;
  };

  // Filter Requests
  const filteredRequests = requests.filter(req => {
    const matchesSector = selectedSector === 'Todos' || req.sector === selectedSector;
    const matchesDate = req.dateEvent >= startDate && req.dateEvent <= endDate;
    return matchesSector && matchesDate;
  });

  // Calculate Totals for Real
  const totalRealQty = filteredRequests.length > 0
    ? filteredRequests.reduce((acc, curr) => acc + curr.extrasQty, 0)
    : 0;

  const totalRealValue = filteredRequests.length > 0
    ? filteredRequests.reduce((acc, curr) => acc + (curr.totalValue || 0), 0)
    : 0;

  // Tax Calculation
  const taxAmount = totalRealValue * (systemConfig.taxRate / 100);
  const totalWithTax = totalRealValue + taxAmount;

  // Calculate Totals for Orçado (Budget)
  const reportMonthKey = startDate.slice(0, 7); // YYYY-MM

  let totalBudgetQty = 0;
  let totalBudgetValue = 0;

  if (selectedSector === 'Todos') {
    sectors.forEach(s => {
      const b = getMonthlyBudget(s.id, reportMonthKey);
      totalBudgetQty += b.budgetQty;
      totalBudgetValue += b.budgetValue;
    });
  } else {
    const s = sectors.find(sec => sec.name === selectedSector);
    if (s) {
      const b = getMonthlyBudget(s.id, reportMonthKey);
      totalBudgetQty += b.budgetQty;
      totalBudgetValue += b.budgetValue;
    }
  }

  // Helper to calculate End Date
  const calculateEndDate = (dateStr: string, days: number) => {
    if (!dateStr) return '';
    if (days <= 1) return dateStr;
    const [y, m, d] = dateStr.split('-').map(Number);
    // Create date at noon to avoid timezone shift
    const date = new Date(y, m - 1, d, 12, 0, 0);
    date.setDate(date.getDate() + (days - 1));
    const ey = date.getFullYear();
    const em = String(date.getMonth() + 1).padStart(2, '0');
    const ed = String(date.getDate()).padStart(2, '0');
    return `${ey}-${em}-${ed}`;
  };

  return (
    <div className="w-full">
      <div className="mb-4 flex flex-col md:flex-row justify-between items-center no-print bg-white p-4 rounded-lg shadow-sm border border-slate-200 gap-4">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <Filter size={18} className="text-[#155645]" />
            <select
              className="border border-slate-300 rounded px-3 py-1.5 text-sm focus:ring-2 focus:ring-[#155645] outline-none"
              value={selectedSector}
              onChange={(e) => setSelectedSector(e.target.value)}
            >
              <option value="Todos">Todos (Visualização Global)</option>
              {sectors.map(s => (
                <option key={s.id} value={s.name}>{s.name}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <Calendar size={18} className="text-[#155645]" />
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="border border-slate-300 rounded px-2 py-1.5 text-sm focus:ring-2 focus:ring-[#155645] outline-none"
            />
            <span className="text-slate-400">-</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="border border-slate-300 rounded px-2 py-1.5 text-sm focus:ring-2 focus:ring-[#155645] outline-none"
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => window.print()}
            className="flex items-center gap-2 bg-[#155645] text-white px-4 py-2 rounded hover:bg-[#104033] transition-colors text-sm shadow-sm"
          >
            <Printer size={18} />
            Imprimir
          </button>
        </div>
      </div>

      <div ref={componentRef} className="bg-white p-8 shadow-sm print:shadow-none print:p-0 print:w-full print:max-w-none w-full">
        <div className="text-center border-b-2 border-slate-800 pb-4 mb-6">
          <h1 className="text-2xl font-bold uppercase text-[#155645]">
            Extrato de Solicitação de Extras {selectedSector !== 'Todos' && `- ${selectedSector}`}
          </h1>
          <p className="text-sm text-slate-500">Departamento de Gestão de Pessoas e Operações {selectedSector !== 'Todos' && `| Setor: ${selectedSector}`}</p>
        </div>

        {/* Summary Cards (Real vs Orçado) */}
        <div className="grid grid-cols-2 gap-6 mb-8 border border-slate-200 rounded-lg p-4 bg-slate-50/50">
          <div className="text-center border-r border-slate-200">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Quadro Orçado (Mês Ref.)</h3>
            <div className="flex justify-center gap-4 text-sm">
              <div>
                <span className="block text-xl font-bold text-slate-700">{totalBudgetQty}</span>
                <span className="text-xs text-slate-400">Pessoas</span>
              </div>
              <div>
                <span className="block text-xl font-bold text-slate-700">R$ {totalBudgetValue.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</span>
                <span className="text-xs text-slate-400">Verba</span>
              </div>
            </div>
          </div>
          <div className="text-center">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Quadro Real (Período)</h3>
            <div className="flex justify-center gap-4 text-sm">
              <div>
                <span className="block text-xl font-bold text-[#155645]">{totalRealQty}</span>
                <span className="text-xs text-slate-400">Pessoas</span>
              </div>
              <div>
                <span className="block text-xl font-bold text-[#155645]">R$ {totalWithTax.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</span>
                <span className="text-xs text-slate-400">Gasto Total (c/ Impostos)</span>
              </div>
            </div>
          </div>
        </div>

        <div className="mb-4 text-xs flex justify-between">
          <div>
            <strong>Período:</strong> {new Date(startDate).toLocaleDateString('pt-BR')} até {new Date(endDate).toLocaleDateString('pt-BR')}
          </div>
          <div>
            <strong>Setor:</strong> {selectedSector === 'Todos' ? 'Todos' : selectedSector}
          </div>
        </div>

        <table className="w-full text-[10px] text-left border-collapse border border-slate-300 table-fixed">
          <thead>
            <tr className="bg-slate-100 font-bold text-center text-[#155645]">
              <th className="border border-slate-300 p-1" style={{ width: `65px` }}>ENTRADA</th>
              <th className="border border-slate-300 p-1" style={{ width: `65px` }}>SAÍDA</th>
              <th className="border border-slate-300 p-1" style={{ width: `${colWidths.days}px` }}>DIAS</th>
              <th className="border border-slate-300 p-1" style={{ width: `${colWidths.qty}px` }}>QTD.</th>
              <th className="border border-slate-300 p-1" style={{ width: `${colWidths.role}px` }}>FUNÇÃO</th>
              <th className="border border-slate-300 p-1">JUSTIFICATIVA</th>
              <th className="border border-slate-300 p-1" style={{ width: `${colWidths.shift}px` }}>TURNO</th>
              <th className="border border-slate-300 p-1" style={{ width: `${colWidths.timeIn}px` }}>ENT.</th>
              <th className="border border-slate-300 p-1" style={{ width: `${colWidths.timeOut}px` }}>SAÍDA</th>
              <th className="border border-slate-300 p-1" style={{ width: `${colWidths.hours}px` }}>HORAS</th>
              <th className="border border-slate-300 p-1" style={{ width: `${colWidths.rate}px` }}>VL. HORA</th>
              <th className="border border-slate-300 p-1" style={{ width: `${colWidths.total}px` }}>TOTAL</th>
              <th className="border border-slate-300 p-1" style={{ width: `${colWidths.occupancy}px` }}>% OCUP</th>
            </tr>
          </thead>
          <tbody>
            {filteredRequests.map((req) => (
              <tr key={req.id}>
                <td className="border border-slate-300 p-1 text-center">{formatDate(req.dateEvent)}</td>
                <td className="border border-slate-300 p-1 text-center">{formatDate(calculateEndDate(req.dateEvent, req.daysQty))}</td>
                <td className="border border-slate-300 p-1 text-center">{req.daysQty}</td>
                <td className="border border-slate-300 p-1 text-center">{req.extrasQty}</td>
                <td className="border border-slate-300 p-1 truncate">{req.functionRole}</td>
                <td className="border border-slate-300 p-1 truncate" title={req.justification}>{req.justification}</td>
                <td className="border border-slate-300 p-1 text-center">{req.shift}</td>
                <td className="border border-slate-300 p-1 text-center">{req.timeIn}</td>
                <td className="border border-slate-300 p-1 text-center">{req.timeOut}</td>
                <td className="border border-slate-300 p-1 text-center font-medium">{getDuration(req.timeIn, req.timeOut)}</td>
                <td className="border border-slate-300 p-1 text-right">R$ {(req.specialRate || 15.00).toFixed(2)}</td>
                <td className="border border-slate-300 p-1 text-right">R$ {(req.totalValue || 0).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</td>
                <td className="border border-slate-300 p-1 text-center">{req.occupancyRate.toFixed(0)}%</td>
              </tr>
            ))}
            {filteredRequests.length === 0 && (
              <tr>
                <td colSpan={12} className="border border-slate-300 p-8 text-center text-slate-500">
                  Nenhum registro encontrado para este filtro.
                </td>
              </tr>
            )}
          </tbody>
          <tfoot className="bg-slate-100 font-bold">
            <tr>
              <td colSpan={11} className="border border-slate-300 p-2 text-right">SUBTOTAL</td>
              <td colSpan={2} className="border border-slate-300 p-2 text-right">R$ {totalRealValue.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</td>
            </tr>
            <tr>
              <td colSpan={11} className="border border-slate-300 p-2 text-right">
                IMPOSTOS E ENCARGOS ({systemConfig.taxRate}%)
              </td>
              <td colSpan={2} className="border border-slate-300 p-2 text-right text-red-600">
                + R$ {taxAmount.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
              </td>
            </tr>
            <tr className="bg-slate-200 text-slate-900 border-t-2 border-slate-400">
              <td colSpan={11} className="border border-slate-300 p-2 text-right text-sm">TOTAL GERAL DO PERÍODO</td>
              <td colSpan={2} className="border border-slate-300 p-2 text-right text-sm">
                R$ {totalWithTax.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
              </td>
            </tr>
          </tfoot>
        </table>

        <div className="mt-8 pt-4 border-t border-slate-300">
          <p className="text-sm font-bold mb-8">O período contratado e o horário estipulado deverão ser seguidos e não poderão ocorrer dobras.</p>

          <div className="grid grid-cols-3 gap-8 mt-16 text-center text-xs">
            <div className="border-t border-slate-400 pt-2">
              Gerente do Setor
            </div>
            <div className="border-t border-slate-400 pt-2">
              Gerente TCF
            </div>
            <div className="border-t border-slate-400 pt-2">
              Gerência Geral
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};