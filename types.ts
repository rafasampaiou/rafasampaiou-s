export enum UserRole {
  USER = 'USER',
  ADMIN = 'ADMIN'
}

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
}

export enum RequestType {
  DIARIA = 'Diária',
  PACOTE = 'Pacote'
}

export enum Shift {
  MANHA = 'Manhã',
  TARDE = 'Tarde',
  NOITE = 'Noite',
  MADRUGADA = 'Madrugada'
}

export interface RequestItem {
  id: string;
  sector: string;
  reason: 'Quadro Ideal' | 'Ocupação';
  type: RequestType;
  dateEvent: string;
  daysQty: number;
  specialRate?: number; // Valor hora especial (opcional)
  extrasQty: number;
  functionRole: string;
  shift: Shift;
  timeIn: string;
  timeOut: string;
  justification: string;
  occupancyRate: number;
  status: 'Pendente' | 'Aprovado' | 'Rejeitado';
  createdAt: string;
  totalValue?: number; // Calculated value
  requestorEmail: string; // Email of the person who requested
}

export interface SectorConfig {
  id: string;
  name: string;
  type: 'Operacional' | 'Suporte';
  // Budget is now handled in MonthlyBudget
}

export interface MonthlyBudget {
  sectorId: string;
  monthKey: string; // YYYY-MM
  budgetQty: number; // Qtd Extras por mês (Calculado)
  budgetValue: number; // Valor Total Orçado
  hourRate: number; // Valor pago por hora
  workHoursPerDay: number; // Horas de trabalho (default 8)
  workingDaysPerMonth: number; // Dias trabalhados (default 22)
  extraQtyPerDay: number; // Qtd Extras por dia (Calculado)
}

// Stores manual overrides for "Real" values in Ideal Table if user edits them
export interface ManualRealStat {
  sectorId: string;
  monthKey: string;
  realQty: number;
  realValue: number;
  afastadosQty?: number; // New: Absent/Leave
  apprenticesQty?: number; // New: Young Apprentices
  wfoQty?: number; // New: WFO Target (Monthly)
  loteWfo?: Record<number, number>; // New: WFO Target (per Lote ID)
}

export interface LoteConfig {
  id: number;
  name: string;
  startDay: number;
  endDay: number;
  wfo?: number;
}

export interface MonthlyLoteConfig {
  monthKey: string; // YYYY-MM
  lotes: LoteConfig[];
}

export interface MonthlyStats {
  sector: string;
  budgetQty: number;
  budgetValue: number;
  realQty: number;
  realValue: number;
}

export interface OccupancyRecord {
  date: string; // YYYY-MM-DD
  occupiedRooms: number;
}

export interface SpecialRole {
  id: string;
  name: string;
  rate: number;
}

export interface SystemConfig {
  standardHourRate: number;
  taxRate: number; // Percentage
  isFormLocked?: boolean;
}