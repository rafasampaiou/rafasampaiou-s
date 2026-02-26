import React, { useRef, useState } from 'react';
import { useApp } from '../context';
import { Printer, Filter, Calendar } from 'lucide-react';

export const PrintableExtract: React.FC = () => {
  const { requests, sectors, getMonthlyBudget, occupancyData, getMonthlyLote, getManualRealStat, updateManualRealStat, systemConfig, user, getMonthlyAppConfig, calculateRequestTotal } = useApp();
  const componentRef = useRef<HTMLDivElement>(null);
  const [selectedSector, setSelectedSector] = useState('Todos');

  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [calendarViewDate, setCalendarViewDate] = useState(new Date());
  const [showCalendar, setShowCalendar] = useState(false);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  // Column Widths State (px) - Fixed configuration
  const [colWidths] = useState({
    date: 65,
    days: 35,
    qty: 35,
    role: 100,
    shift: 50,
    timeIn: 45,
    timeOut: 45,
    hours: 40,
    rate: 85,
    total: 90,
    occupancy: 45,
    justification: 160
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
    const matchesDate = req.dateEvent === selectedDate;
    // status check: ignore variants of 'Rejeitado'
    const statusLower = (req.status || '').toLowerCase();
    const isActive = statusLower === 'aprovado';

    return matchesSector && matchesDate && isActive;
  }).sort((a, b) => {
    // Sort by Date Event (Entrada)
    if (a.dateEvent < b.dateEvent) return sortDirection === 'asc' ? -1 : 1;
    if (a.dateEvent > b.dateEvent) return sortDirection === 'asc' ? 1 : -1;
    return 0;
  });

  // Calculate Totals for Real
  const totalRealQty = filteredRequests.length > 0
    ? filteredRequests.reduce((acc, curr) => acc + curr.extrasQty, 0)
    : 0;

  // Calculate Totals for Real - Dynamic Calculation to ensure consistency with current settings
  const totalRealValue = filteredRequests.reduce((acc, curr) => acc + calculateRequestTotal(curr), 0);

  // Tax Calculation
  const reportMonthKey = selectedDate.slice(0, 7); // YYYY-MM
  const currentConfig = getMonthlyAppConfig(reportMonthKey);
  const taxAmount = totalRealValue * (currentConfig.taxRate / 100);
  const totalWithTax = totalRealValue + taxAmount;

  // Calculate Totals for Orçado (Budget)
  // reportMonthKey is already defined above

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
          <div className="flex flex-col gap-1">
            <span className="text-xs font-bold text-slate-500 uppercase ml-1">Filtro de Setor</span>
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
          </div>

          <div className="flex flex-col gap-1">
            <span className="text-xs font-bold text-slate-500 uppercase ml-1">Data da Solicitação</span>
            <div className="relative">
              <div
                className="flex items-center gap-2 border border-slate-300 rounded px-3 py-1.5 text-sm bg-white cursor-pointer hover:border-[#155645] transition-colors w-40"
                onClick={() => setShowCalendar(!showCalendar)}
              >
                <Calendar size={16} className="text-[#155645]" />
                <span>{new Date(selectedDate + 'T12:00:00').toLocaleDateString('pt-BR')}</span>
              </div>

              {showCalendar && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowCalendar(false)}></div>
                  <div className="absolute left-0 top-full mt-2 bg-white border border-slate-200 rounded-xl shadow-2xl p-4 z-50 w-72 animate-in fade-in zoom-in duration-200 origin-top-left">
                    <div className="flex justify-between items-center mb-4">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setCalendarViewDate(new Date(calendarViewDate.getFullYear(), calendarViewDate.getMonth() - 1, 1));
                        }}
                        className="p-1.5 hover:bg-slate-100 rounded-full text-slate-600 transition-colors"
                      >
                        &lt;
                      </button>
                      <span className="text-sm font-bold text-[#155645] capitalize">
                        {calendarViewDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setCalendarViewDate(new Date(calendarViewDate.getFullYear(), calendarViewDate.getMonth() + 1, 1));
                        }}
                        className="p-1.5 hover:bg-slate-100 rounded-full text-slate-600 transition-colors"
                      >
                        &gt;
                      </button>
                    </div>

                    <div className="grid grid-cols-7 gap-1 text-center text-[10px] items-center mb-2">
                      {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(d => (
                        <div key={d} className="font-bold text-slate-400 p-1">{d}</div>
                      ))}
                      {Array.from({ length: new Date(calendarViewDate.getFullYear(), calendarViewDate.getMonth(), 1).getDay() }).map((_, i) => (
                        <div key={`empty-${i}`} className="p-1"></div>
                      ))}
                      {Array.from({ length: new Date(calendarViewDate.getFullYear(), calendarViewDate.getMonth() + 1, 0).getDate() }).map((_, i) => {
                        const day = i + 1;
                        const dateKey = `${calendarViewDate.getFullYear()}-${String(calendarViewDate.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                        const hasPending = requests.some(r => r.dateEvent === dateKey && r.status === 'Pendente');
                        const isSelected = selectedDate === dateKey;
                        const isToday = new Date().toISOString().split('T')[0] === dateKey;

                        return (
                          <button
                            key={day}
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedDate(dateKey);
                              setShowCalendar(false);
                            }}
                            className={`
                              h-8 w-8 rounded-lg text-[11px] transition-all flex items-center justify-center relative
                              ${isSelected ? 'bg-[#155645] text-white font-bold shadow-md scale-110' : 'hover:bg-slate-100 text-slate-700'}
                              ${hasPending && !isSelected ? 'bg-yellow-100 text-yellow-900 border border-yellow-200' : ''}
                              ${isToday && !isSelected ? 'ring-1 ring-[#155645] ring-inset' : ''}
                            `}
                          >
                            {day}
                            {hasPending && (
                              <span className={`absolute bottom-1 w-1 h-1 rounded-full ${isSelected ? 'bg-white' : 'bg-yellow-500'}`}></span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                    <div className="mt-4 pt-3 border-t border-slate-100">
                      <div className="flex items-center gap-2 mb-1">
                        <div className="w-3 h-3 bg-yellow-100 border border-yellow-200 rounded"></div>
                        <span className="text-[10px] text-slate-500 font-medium">(dia com solicitações pendentes)</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 bg-white border border-slate-200 rounded"></div>
                        <span className="text-[10px] text-slate-400">Clique para selecionar uma data específica</span>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="bg-orange-50 border border-orange-100 rounded-lg p-3 flex items-center gap-3 shadow-sm">
            <div className="bg-orange-200/50 p-2 rounded-full">
              <Printer size={20} className="text-orange-700" />
            </div>
            <div>
              <p className="text-sm font-bold text-orange-800 leading-tight">Dica de Impressão</p>
              <p className="text-xs text-orange-700 mt-0.5">Para imprimir, aperte <strong>Control + P</strong> e ajuste o % de zoom conforme necessário.</p>
            </div>
          </div>
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
            <strong>Data:</strong> {new Date(selectedDate + 'T12:00:00').toLocaleDateString('pt-BR')}
          </div>
          <div>
            <strong>Setor:</strong> {selectedSector === 'Todos' ? 'Todos' : selectedSector}
          </div>
        </div>

        <table className="mx-auto text-[10px] text-left border-collapse border border-slate-300 table-fixed" style={{ width: '100%', maxWidth: '900px' }}>
          <thead>
            <tr className="bg-slate-100 font-bold text-center text-[#155645]">
              <th
                className="border border-slate-300 p-1 cursor-pointer hover:bg-slate-200"
                style={{ width: `${colWidths.date}px` }}
                onClick={() => setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc')}
              >
                ENTRADA <span className="no-print">{sortDirection === 'asc' ? '↑' : '↓'}</span>
              </th>
              {/* Column Removed: Data de Saída */}
              <th className="border border-slate-300 p-1" style={{ width: `${colWidths.days}px` }}>DIAS</th>
              <th className="border border-slate-300 p-1" style={{ width: `${colWidths.qty}px` }}>QTD.</th>
              <th className="border border-slate-300 p-1" style={{ width: `${colWidths.role}px` }}>FUNÇÃO</th>
              <th className="border border-slate-300 p-1" style={{ width: `${colWidths.justification}px` }}>JUSTIFICATIVA</th>
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
                {/* Column Removed: Data de Saída */}
                <td className="border border-slate-300 p-1 text-center">{req.daysQty}</td>
                <td className="border border-slate-300 p-1 text-center">{req.extrasQty}</td>
                <td className="border border-slate-300 p-1 truncate">{req.functionRole}</td>
                <td className="border border-slate-300 p-1 truncate" title={req.justification}>{req.justification}</td>
                <td className="border border-slate-300 p-1 text-center">{req.shift}</td>
                <td className="border border-slate-300 p-1 text-center">{req.timeIn}</td>
                <td className="border border-slate-300 p-1 text-center">{req.timeOut}</td>
                <td className="border border-slate-300 p-1 text-center font-medium">{getDuration(req.timeIn, req.timeOut)}</td>
                {(() => {
                  const reqMonth = req.dateEvent.substring(0, 7);
                  const config = getMonthlyAppConfig(reqMonth);
                  let displayRate = req.specialRate ?? config.standardHourRate;
                  // Calculate daily cost base
                  const dailyCost = calculateRequestTotal({ ...req, daysQty: 1, extrasQty: 1 });
                  const dailyQty = req.extrasQty;
                  return (
                    <>
                      <td className="border border-slate-300 p-1 text-right">R$ {displayRate.toFixed(2)}</td>
                      <td className="border border-slate-300 p-1 text-right">R$ {calculateRequestTotal(req).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</td>
                    </>
                  );
                })()}
                <td className="border border-slate-300 p-1 text-center">{(req.occupancyRate ?? 0).toFixed(0)}%</td>
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
              <td colSpan={10} className="border border-slate-300 p-2 text-right">SUBTOTAL</td>
              <td colSpan={2} className="border border-slate-300 p-2 text-right">R$ {totalRealValue.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</td>
            </tr>
            <tr>
              <td colSpan={10} className="border border-slate-300 p-2 text-right">
                IMPOSTOS E ENCARGOS ({currentConfig.taxRate}%)
              </td>
              <td colSpan={2} className="border border-slate-300 p-2 text-right text-red-600">
                + R$ {taxAmount.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
              </td>
            </tr>
            <tr className="bg-slate-200 text-slate-900 border-t-2 border-slate-400">
              <td colSpan={10} className="border border-slate-300 p-2 text-right text-sm">TOTAL GERAL DO PERÍODO</td>
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
              Gerente Geral ou Gerente de Operações
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};