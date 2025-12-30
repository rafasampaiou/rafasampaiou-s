
import { RequestItem, RequestType, Shift, MonthlyStats, SectorConfig } from './types';



export const INITIAL_SECTORS: SectorConfig[] = [
  { id: '1', name: 'Recepção', type: 'Operacional' },
  { id: '2', name: 'Governança', type: 'Operacional' },
  { id: '3', name: 'A&B', type: 'Operacional' },
  { id: '4', name: 'Manutenção', type: 'Suporte' },
  { id: '5', name: 'Segurança', type: 'Suporte' },
];

export const MOCK_REQUESTS: RequestItem[] = [
  {
    id: 'req_001',
    sector: 'A&B',
    reason: 'Ocupação',
    type: RequestType.DIARIA,
    dateEvent: '2023-10-15',
    daysQty: 1,
    extrasQty: 2,
    functionRole: 'Garçom',
    shift: Shift.NOITE,
    timeIn: '18:00',
    timeOut: '02:00',
    justification: 'Evento corporativo grande',
    occupancyRate: 85,
    status: 'Aprovado',
    createdAt: '2023-10-10',
    requestorEmail: 'rafael.souza@taua.com.br'
  },
  {
    id: 'req_002',
    sector: 'Governança',
    reason: 'Quadro Ideal',
    type: RequestType.DIARIA,
    dateEvent: '2023-10-16',
    daysQty: 1,
    extrasQty: 4,
    functionRole: 'Camareira',
    shift: Shift.MANHA,
    timeIn: '08:00',
    timeOut: '16:20',
    justification: 'Alta rotatividade, falta de staff fixo',
    occupancyRate: 92,
    status: 'Pendente',
    createdAt: '2023-10-12',
    requestorEmail: 'gestor.gov@taua.com.br'
  },
  {
    id: 'req_003',
    sector: 'Recepção',
    reason: 'Ocupação',
    type: RequestType.PACOTE,
    dateEvent: '2023-10-20',
    daysQty: 5,
    specialRate: 25.50,
    extrasQty: 1,
    functionRole: 'Recepcionista Bilíngue',
    shift: Shift.TARDE,
    timeIn: '14:00',
    timeOut: '22:20',
    justification: 'Semana de feriado internacional',
    occupancyRate: 95,
    status: 'Aprovado',
    createdAt: '2023-10-14',
    requestorEmail: 'vanessa.monteiro@taua.com.br'
  }
];

export const MOCK_IDEAL_STATS: MonthlyStats[] = [
  { sector: 'Recepção', budgetQty: 10, budgetValue: 25000, realQty: 10, realValue: 24500 },
  { sector: 'Governança', budgetQty: 25, budgetValue: 60000, realQty: 28, realValue: 68000 },
  { sector: 'A&B', budgetQty: 30, budgetValue: 75000, realQty: 29, realValue: 72000 },
  { sector: 'Manutenção', budgetQty: 8, budgetValue: 20000, realQty: 8, realValue: 20000 },
];
