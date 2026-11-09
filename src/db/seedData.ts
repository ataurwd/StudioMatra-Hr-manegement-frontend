/**
 * STUDIO MATRA — Database Seed Schema Template
 * Live runtime data is fetched dynamically from MySQL via the REST API (/api).
 * Static offline mock user and attendance arrays have been removed.
 */

import {
  AttendanceCorrectionRequest,
  AttendancePunchEvent,
  AttendanceSession,
  AuditLog,
  Department,
  Designation,
  Employee,
  LeaveBalance,
  LeaveRequest,
  LeaveType,
  NotificationItem,
  Organization,
  PayrollPeriod,
  PayrollPolicy,
  PayrollRun,
  SalaryAdvance,
  SalaryContract,
  ShiftDefinition,
  SystemSettings,
  User,
} from '../types';

export const SEED_ORGANIZATION: Organization = {
  id: 'org-studio-matra',
  name: 'STUDIO MATRA',
  subtitle: 'Interior Architecture & Design',
  country: 'Bangladesh',
  timezone: 'Asia/Dhaka',
  currency: 'BDT',
  currencySymbol: '৳',
  address: 'Level 4, House 28, Road 11, Block D, Banani, Dhaka 1213',
  phone: '01711174672',
  email: 'info@studiomatra.com.bd',
  logoUrl: '/logo.png',
  taxRegistrationNumber: 'BIN-192847302948',
  createdAt: '2024-01-01T00:00:00Z',
};

export const SEED_DEPARTMENTS: Department[] = [
  { id: 'dept-mgmt', name: 'Management', code: 'MGMT', status: 'active', managerId: 'emp-0001' },
  { id: 'dept-arch', name: 'Architecture & 3D Visualisation', code: 'ARCH', status: 'active', managerId: 'emp-0001' },
  { id: 'dept-interior', name: 'Interior Design', code: 'INTD', status: 'active', managerId: 'emp-0002' },
  { id: 'dept-pm', name: 'Project Coordination', code: 'PMGD', status: 'active', managerId: 'emp-0001' },
  { id: 'dept-admin', name: 'Administration & HR', code: 'ADMN', status: 'active', managerId: 'emp-0002' },
];

export const SEED_DESIGNATIONS: Designation[] = [
  { id: 'des-ceo', departmentId: 'dept-mgmt', title: 'CEO & Co-Founder', level: 1, status: 'active' },
  { id: 'des-md', departmentId: 'dept-mgmt', title: 'MD & Co-Founder', level: 1, status: 'active' },
  { id: 'des-prin-intern', departmentId: 'dept-arch', title: 'Principal Architect (Intern)', level: 3, status: 'active' },
  { id: 'des-int-intern', departmentId: 'dept-interior', title: 'Interior Designer (Intern)', level: 4, status: 'active' },
  { id: 'des-3d-intern', departmentId: 'dept-arch', title: '3D Visualiser (Intern)', level: 4, status: 'active' },
];

// All user accounts, employee profiles, and credentials are dynamically managed in MySQL via REST API
export const SEED_USERS: User[] = [];
export const SEED_EMPLOYEES: Employee[] = [];
export const SEED_SALARY_CONTRACTS: SalaryContract[] = [];

export const SEED_SHIFTS: ShiftDefinition[] = [
  {
    id: 'shift-standard',
    organizationId: 'org-studio-matra',
    name: 'Studio General Shift',
    startTime: '09:00',
    endTime: '18:00',
    timezone: 'Asia/Dhaka',
    breakMinutes: 60,
    graceMinutes: 10,
    weeklyWorkDays: [0, 1, 2, 3, 4, 6], // Sun, Mon, Tue, Wed, Thu, Sat (6 days, Friday off)
    status: 'active',
  },
];

export const SEED_LEAVE_TYPES: LeaveType[] = [
  {
    id: 'lt-casual',
    organizationId: 'org-studio-matra',
    name: 'Casual Leave',
    code: 'CL',
    annualQuota: 10,
    isPaid: true,
    requiresDocument: false,
    description: 'Casual leave for urgent personal matters',
  },
  {
    id: 'lt-sick',
    organizationId: 'org-studio-matra',
    name: 'Sick Leave',
    code: 'SL',
    annualQuota: 14,
    isPaid: true,
    requiresDocument: true,
    description: 'Medical and sickness leave with certificate if > 2 days',
  },
];

export const SEED_LEAVE_BALANCES: LeaveBalance[] = [];
export const SEED_LEAVE_REQUESTS: LeaveRequest[] = [];
export const SEED_SALARY_ADVANCES: SalaryAdvance[] = [];

export const SEED_PAYROLL_POLICY: PayrollPolicy = {
  id: 'pol-studio-standard',
  organizationId: 'org-studio-matra',
  version: 1,
  divisorMethod: 'fixed_30_days',
  overtimeMultiplier: 1.5,
  latePenaltyEnabled: true,
  latePenaltyThresholdDays: 3,
  unpaidLeaveDeductionFormula: 'per_day_gross',
  roundingRule: 'round_nearest',
  effectiveFrom: '2024-01-01',
};

// All attendance sessions and punch events are recorded live in MySQL via REST API
export const SEED_ATTENDANCE_SESSIONS: AttendanceSession[] = [];
export const SEED_PUNCH_EVENTS: AttendancePunchEvent[] = [];
export const SEED_CORRECTION_REQUESTS: AttendanceCorrectionRequest[] = [];

export const SEED_SETTINGS: SystemSettings = {
  organization: SEED_ORGANIZATION,
  trustedOfficeNetworks: [
    { id: 'net-1', name: 'Studio Matra Fiber Primary', cidr: '192.168.1.0/24', enabled: true },
  ],
  kioskDevices: [
    {
      id: 'kiosk-1',
      name: 'Studio Reception Terminal',
      deviceIdentifier: 'SM-KIOSK-BANANI-01',
      token: 'kiosk-token-sec-98124',
      lastSeen: '2026-11-04T05:00:00Z',
      enabled: true,
    },
  ],
  payrollPolicy: SEED_PAYROLL_POLICY,
};

export const SEED_AUDIT_LOGS: AuditLog[] = [];
export const SEED_NOTIFICATIONS: NotificationItem[] = [];
