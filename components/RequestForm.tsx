import React, { useState } from 'react';
import { useApp } from '../context';
import { RequestType, Shift } from '../types';
import { Save, AlertCircle } from 'lucide-react';

export const RequestForm: React.FC = () => {
  const { sectors, addRequest, user } = useApp();
  const [submitted, setSubmitted] = useState(false);
  
  const [formData, setFormData] = useState({
    sector: '',
    reason: 'Ocupação',
    type: RequestType.DIARIA,
    dateEvent: '',
    daysQty: 1,
    specialRate: '',
    extrasQty: 1,
    functionRole: '',
    shift: Shift.MANHA,
    timeIn: '',
    timeOut: '',
    justification: '',
    occupancyRate: ''
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.email) return;

    addRequest({
      id: Math.random().toString(36).substr(2, 9),
      ...formData,
      reason: formData.reason as 'Quadro Ideal' | 'Ocupação',
      type: formData.type as RequestType,
      shift: formData.shift as Shift,
      specialRate: formData.specialRate ? parseFloat(formData.specialRate) : undefined,
      occupancyRate: formData.occupancyRate ? parseFloat(formData.occupancyRate) : 0,
      status: 'Pendente',
      createdAt: new Date().toISOString(),
      requestorEmail: user.email // Automatic email capture
    });
    setSubmitted(true);
    setTimeout(() => setSubmitted(false), 3000);
    // Reset basic fields
    setFormData(prev => ({...prev, justification: '', extrasQty: 1, occupancyRate: ''}));
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex justify-between items-center">
          <div>
            <h2 className="text-lg font-semibold text-[#155645]">Solicitação de Mão de Obra Extra</h2>
            <p className="text-sm text-slate-500">Preencha todos os dados obrigatórios para aprovação.</p>
          </div>
          <div className="text-right text-xs text-slate-400">
            <span className="block font-medium text-slate-600">Solicitante:</span>
            {user?.email}
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
          
          {/* Setor */}
          <div className="col-span-1">
            <label className="block text-sm font-medium text-slate-700 mb-1">Setor</label>
            <select 
              name="sector" 
              required
              className="w-full rounded-lg border-slate-300 border p-2.5 focus:ring-2 focus:ring-[#155645] focus:border-[#155645] outline-none"
              value={formData.sector}
              onChange={handleChange}
            >
              <option value="">Selecione...</option>
              {sectors.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
            </select>
          </div>

          {/* Motivo */}
          <div className="col-span-1">
            <label className="block text-sm font-medium text-slate-700 mb-1">Motivo</label>
            <select 
              name="reason" 
              className="w-full rounded-lg border-slate-300 border p-2.5 outline-none focus:ring-2 focus:ring-[#155645] focus:border-[#155645]"
              value={formData.reason}
              onChange={handleChange}
            >
              <option value="Ocupação">Ocupação</option>
              <option value="Quadro Ideal">Quadro Ideal</option>
            </select>
          </div>

          <div className="col-span-2 border-t border-slate-100 my-2"></div>

          {/* Tipo e Data */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Tipo de Extra</label>
            <select 
              name="type" 
              className="w-full rounded-lg border-slate-300 border p-2.5 outline-none focus:ring-2 focus:ring-[#155645] focus:border-[#155645]"
              value={formData.type}
              onChange={handleChange}
            >
              <option value={RequestType.DIARIA}>Diária</option>
              <option value={RequestType.PACOTE}>Pacote</option>
            </select>
            {formData.type === RequestType.PACOTE && (
              <p className="text-xs text-[#F8981C] mt-1">Pacotes incluem múltiplos dias negociados.</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Data do Evento (Início)</label>
            <input 
              type="date" 
              name="dateEvent" 
              required
              className="w-full rounded-lg border-slate-300 border p-2.5 outline-none focus:ring-2 focus:ring-[#155645] focus:border-[#155645]"
              value={formData.dateEvent}
              onChange={handleChange}
            />
          </div>

          {/* Qtd Dias e Valor Especial */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Quantidade de Dias</label>
            <input 
              type="number" 
              min="1"
              name="daysQty" 
              className="w-full rounded-lg border-slate-300 border p-2.5 outline-none focus:ring-2 focus:ring-[#155645] focus:border-[#155645]"
              value={formData.daysQty}
              onChange={handleChange}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1 flex justify-between">
              <span>Valor Hora Especial (R$)</span>
              <span className="text-xs text-slate-400 font-normal">Opcional</span>
            </label>
            <input 
              type="number" 
              step="0.01"
              name="specialRate" 
              placeholder="Ex: 25.00"
              className="w-full rounded-lg border-slate-300 border p-2.5 outline-none focus:ring-2 focus:ring-[#155645] focus:border-[#155645]"
              value={formData.specialRate}
              onChange={handleChange}
            />
            <p className="text-xs text-slate-500 mt-1">Só preencher se houver negociação específica.</p>
          </div>

          {/* Detalhes da Função */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Quantidade de Extras</label>
            <input 
              type="number" 
              min="1"
              name="extrasQty" 
              required
              className="w-full rounded-lg border-slate-300 border p-2.5 outline-none focus:ring-2 focus:ring-[#155645] focus:border-[#155645]"
              value={formData.extrasQty}
              onChange={handleChange}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Função</label>
            <input 
              type="text" 
              name="functionRole" 
              required
              placeholder="Ex: Garçom, Camareira"
              className="w-full rounded-lg border-slate-300 border p-2.5 outline-none focus:ring-2 focus:ring-[#155645] focus:border-[#155645]"
              value={formData.functionRole}
              onChange={handleChange}
            />
          </div>

          {/* Turno e Horários */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Turno</label>
            <select 
              name="shift" 
              className="w-full rounded-lg border-slate-300 border p-2.5 outline-none focus:ring-2 focus:ring-[#155645] focus:border-[#155645]"
              value={formData.shift}
              onChange={handleChange}
            >
              {Object.values(Shift).map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Entrada</label>
              <input 
                type="time" 
                name="timeIn" 
                required
                className="w-full rounded-lg border-slate-300 border p-2.5 outline-none focus:ring-2 focus:ring-[#155645] focus:border-[#155645]"
                value={formData.timeIn}
                onChange={handleChange}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Saída</label>
              <input 
                type="time" 
                name="timeOut" 
                required
                className="w-full rounded-lg border-slate-300 border p-2.5 outline-none focus:ring-2 focus:ring-[#155645] focus:border-[#155645]"
                value={formData.timeOut}
                onChange={handleChange}
              />
            </div>
          </div>

          {/* Ocupação */}
          <div className="col-span-1">
             <label className="block text-sm font-medium text-slate-700 mb-1">Ocupação (%)</label>
             <div className="flex items-center gap-2">
                <input 
                  type="number" 
                  step="0.01"
                  min="0" 
                  max="100" 
                  name="occupancyRate"
                  placeholder="0.00"
                  className="w-full rounded-lg border-slate-300 border p-2.5 outline-none focus:ring-2 focus:ring-[#155645] focus:border-[#155645]"
                  value={formData.occupancyRate}
                  onChange={handleChange}
                />
             </div>
          </div>

          {/* Justificativa */}
          <div className="col-span-1 md:col-span-2">
            <label className="block text-sm font-medium text-slate-700 mb-1">Justificativa</label>
            <textarea 
              name="justification"
              required
              rows={3}
              className="w-full rounded-lg border-slate-300 border p-2.5 outline-none focus:ring-2 focus:ring-[#155645] focus:border-[#155645]"
              placeholder="Descreva o motivo da solicitação..."
              value={formData.justification}
              onChange={handleChange}
            ></textarea>
          </div>

          <div className="col-span-1 md:col-span-2 mt-4">
            <button 
              type="submit" 
              className="w-full bg-[#155645] hover:bg-[#104033] text-white font-semibold py-3 px-4 rounded-lg transition-all flex items-center justify-center gap-2 shadow-sm"
            >
              <Save size={20} />
              Enviar Solicitação
            </button>
          </div>
        </form>

        {submitted && (
          <div className="mx-6 mb-6 p-4 bg-green-50 text-green-700 rounded-lg flex items-center gap-2 border border-green-200">
            <AlertCircle size={20} />
            <span>Solicitação enviada com sucesso!</span>
          </div>
        )}
      </div>
    </div>
  );
};