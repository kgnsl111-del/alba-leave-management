import { Timestamp } from 'firebase/firestore';

// ─── User ───
export interface User {
  uid: string;
  name: string;
  role: 'admin' | 'worker';
  storeId: string;
  email: string;
  phone?: string;
  hourlyWage: number;
  hireDate: Timestamp;
  isActive: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// ─── Store ───
export interface Store {
  storeId: string;
  name: string;
  payCycle: 'monthly' | 'biweekly';
  payDay: number;
  timezone: string;
  createdAt: Timestamp;
}

// ─── Shift ───
export interface Shift {
  shiftId: string;
  storeId: string;
  uid: string;
  date: string;          // YYYY-MM-DD
  startTime: string;     // HH:mm
  endTime: string;       // HH:mm
  breakMinutes: number;
  netMinutes: number;
  weekKey: string;       // YYYY-WW
  confirmed: boolean;
  source: 'manual' | 'import';
  createdBy: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// ─── Shift Audit Log ───
export interface ShiftAuditLog {
  logId: string;
  shiftId: string;
  storeId: string;
  changes: Array<{
    field: string;
    oldValue: string;
    newValue: string;
  }>;
  changedBy: string;
  changedAt: Timestamp;
}

// ─── Leave Policy ───
export interface LeavePolicy {
  policyId: string;
  storeId: string;
  minWeeklyHours: number;
  accrualMode: 'fixed' | 'proportional';
  accrualFixedHours?: number;
  accrualRatio?: number;
  maxAccumulatedHours: number;
  displayDayHours: number;
  enabled: boolean;
  updatedBy: string;
  updatedAt: Timestamp;
}

// ─── Leave Ledger ───
export interface LeaveLedgerEntry {
  ledgerId: string;
  storeId: string;
  uid: string;
  type: 'accrual' | 'use' | 'adjust';
  amountHours: number;
  balance: number;
  relatedRequestId?: string;
  relatedWeekKey?: string;
  weeklyHoursWorked?: number;
  note: string;
  createdBy: string;
  createdAt: Timestamp;
}

// ─── Leave Request ───
export type LeaveRequestStatus = 'requested' | 'approved' | 'rejected' | 'canceled';

export interface LeaveRequest {
  requestId: string;
  storeId: string;
  uid: string;
  date: string;           // YYYY-MM-DD
  amountHours: number;
  reason: string;
  status: LeaveRequestStatus;
  decidedBy?: string;
  decidedAt?: Timestamp;
  decisionNote?: string;
  createdAt: Timestamp;
}

// ─── Payroll Export ───
export interface PayrollRow {
  uid: string;
  name: string;
  totalWorkHours: number;
  leaveHoursUsed: number;
  leaveDates: string[];
  paidLeaveAmount: number;
}

export interface PayrollExport {
  exportId: string;
  storeId: string;
  periodStart: string;
  periodEnd: string;
  rows: PayrollRow[];
  createdBy: string;
  createdAt: Timestamp;
}
