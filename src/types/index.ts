/**
 * STUDIO MATRA — Office Attendance, HR & Payroll Management System
 * Core TypeScript Definitions & Database Models
 */

export type RoleName = 
  | 'super_admin'
  | 'hr_admin'
  | 'finance_manager'
  | 'department_manager'
  | 'employee';

export type PermissionKey =
  | 'employee.read_own'
  | 'employee.read_team'
  | 'employee.manage'
  | 'attendance.check_in_own'
  | 'attendance.check_out_own'
  | 'attendance.read_team'
  | 'attendance.correct'
  | 'attendance.manage'
  | 'leave.apply'
  | 'leave.approve'
  | 'leave.manage'
  | 'salary.read'
  | 'salary.manage'
  | 'payroll.calculate'
  | 'payroll.approve'
  | 'payroll.finalize'
  | 'payslip.publish'
  | 'reports.hr'
  | 'reports.payroll'
  | 'settings.manage';

export type AttendanceStatus =
  | 'present'
  | 'late'
  | 'absent'
  | 'half_day'
  | 'paid_leave'
  | 'unpaid_leave'
  | 'holiday'
  | 'weekly_off'
  | 'missing_punch'
  | 'pending_correction';

export type EmploymentStatus = 'active' | 'probationary' | 'resigned' | 'inactive' | 'archived';

export type EmploymentType = 'full_time' | 'contractual' | 'intern' | 'consultant' | 'adhoc';

export type LeaveStatus = 'pending' | 'manager_approved' | 'approved' | 'rejected' | 'cancelled';

export type CorrectionStatus = 'submitted' | 'manager_reviewed' | 'applied' | 'rejected';

export type PayrollRunStatus = 'draft' | 'calculated' | 'reviewed' | 'approved' | 'finalized' | 'paid';

export type DivisorMethod = 'calendar_days' | 'scheduled_workdays' | 'fixed_30_days';

export interface Organization {
  id: string;
  name: string;
  subtitle: string;
  country: string;
  timezone: string;
  currency: string;
  currencySymbol: string;
  address: string;
  phone: string;
  email: string;
  logoUrl: string | null;
  taxRegistrationNumber: string;
  createdAt: string;
}

export interface Department {
  id: string;
  name: string;
  code: string;
  description?: string;
  managerId?: string;
  status: 'active' | 'inactive';
}

export interface Designation {
  id: string;
  departmentId: string;
  title: string;
  level: number;
  status: 'active' | 'inactive';
}

export interface User {
  id: string;
  organizationId: string;
  email: string;
  password?: string; // User authentication password
  fullName: string;
  role: RoleName;
  employeeId?: string;
  accountStatus: 'active' | 'suspended';
  avatarUrl?: string;
  pinCode?: string; // 4-digit PIN for Kiosk quick punch
  createdAt: string;
}

export interface Employee {
  id: string;
  organizationId: string;
  userId: string;
  employeeCode: string; // e.g. SM-0001
  fullName: string;
  email: string;
  phone: string;
  departmentId: string;
  designationId: string;
  managerId?: string;
  joiningDate: string;
  terminationDate?: string;
  employmentStatus: EmploymentStatus;
  employmentType: EmploymentType;
  shiftId: string;
  emergencyContact: {
    name: string;
    relationship: string;
    phone: string;
  };
  paymentDetails: {
    bankName: string;
    accountName: string;
    accountNumber: string;
    branchName: string;
    routingNumber?: string;
    bkashNumber?: string;
  };
  avatarUrl?: string;
  adhocJobTitle?: string;
  customDesignation?: string;
  createdAt: string;
}

export interface ShiftDefinition {
  id: string;
  organizationId: string;
  name: string;
  startTime: string; // '09:00'
  endTime: string;   // '18:00'
  timezone: string;
  breakMinutes: number; // 60 min
  graceMinutes: number; // 10 min
  weeklyWorkDays: number[]; // [0, 1, 2, 3, 4] for Sun-Thu or Sat-Wed
  isOvernight?: boolean;
  status: 'active' | 'inactive';
}

export interface AttendancePunchEvent {
  id: string;
  employeeId: string;
  sessionId?: string;
  eventType: 'check_in' | 'check_out';
  occurredAt: string; // ISO string in UTC/Dhaka
  sourceType: 'kiosk' | 'office_network' | 'manual_adjustment';
  registeredDeviceId?: string;
  clientIp?: string;
  recordedBy: string; // userId or 'system'
  createdAt: string;
}

export interface AttendanceSession {
  id: string;
  employeeId: string;
  attendanceDate: string; // YYYY-MM-DD
  assignedShiftId: string;
  checkInAt: string;
  checkOutAt?: string;
  sourceType: 'kiosk' | 'office_network' | 'manual_adjustment';
  scheduledMinutes: number;
  workedMinutes: number;
  breakMinutes: number;
  lateMinutes: number;
  earlyDepartureMinutes: number;
  overtimeMinutes: number;
  computedStatus: AttendanceStatus;
  isMissingPunch: boolean;
  correctionStatus?: CorrectionStatus;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AttendanceCorrectionRequest {
  id: string;
  employeeId: string;
  sessionId?: string;
  attendanceDate: string;
  requestedCheckIn?: string;
  requestedCheckOut?: string;
  reason: string;
  attachmentName?: string;
  status: CorrectionStatus;
  submittedAt: string;
  managerReviewedBy?: string;
  managerComment?: string;
  reviewedAt?: string;
  approvedBy?: string;
  hrComment?: string;
  appliedAt?: string;
}

export interface LeaveType {
  id: string;
  organizationId: string;
  name: string;
  code: string;
  isPaid: boolean;
  annualQuota: number;
  description: string;
  requiresDocument: boolean;
}

export interface LeaveBalance {
  id: string;
  employeeId: string;
  leaveTypeId: string;
  year: number;
  openingBalance: number;
  accrued: number;
  used: number;
  closingBalance: number;
}

export interface LeaveRequest {
  id: string;
  employeeId: string;
  leaveTypeId: string;
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
  durationDays: number;
  isHalfDay: boolean;
  halfDaySession?: 'first_half' | 'second_half';
  reason: string;
  attachmentName?: string;
  status: LeaveStatus;
  submittedAt: string;
  managerId?: string;
  managerRecommendation?: 'recommend' | 'reject';
  managerComment?: string;
  managerReviewedAt?: string;
  hrApproverId?: string;
  hrComment?: string;
  decidedAt?: string;
}

export interface SalaryContract {
  id: string;
  employeeId: string;
  salaryType: 'monthly' | 'daily' | 'hourly';
  basicSalary: number; // in BDT
  houseRentAllowance: number;
  medicalAllowance: number;
  transportAllowance: number;
  otherFixedAllowances: number;
  effectiveFrom: string;
  effectiveTo?: string;
  status: 'active' | 'superseded';
  notes?: string;
}

export interface SalaryAdvance {
  id: string;
  employeeId: string;
  approvedAmount: number;
  disbursedAmount: number;
  remainingBalance: number;
  monthlyDeduction: number;
  approvalDate: string;
  disbursementDate: string;
  status: 'active' | 'completed' | 'cancelled';
  purpose: string;
}

export interface LoanRepaymentRecord {
  id: string;
  advanceId: string;
  payrollPeriodId: string;
  amount: number;
  recoveredAt: string;
}

export interface PayrollPolicy {
  id: string;
  organizationId: string;
  version: number;
  divisorMethod: DivisorMethod;
  overtimeMultiplier: number; // 1.5x or 2.0x of hourly basic
  latePenaltyEnabled: boolean;
  latePenaltyThresholdDays: number; // e.g. 3 late days = 1 day deduction
  unpaidLeaveDeductionFormula: 'per_day_gross' | 'per_day_basic';
  roundingRule: 'round_nearest' | 'round_up' | 'none';
  effectiveFrom: string;
}

export interface PayrollPeriod {
  id: string;
  organizationId: string;
  month: number; // 1-12
  year: number;
  periodStart: string; // YYYY-MM-DD
  periodEnd: string;   // YYYY-MM-DD
  status: PayrollRunStatus;
}

export interface PayrollLineItem {
  id: string;
  payrollItemId: string;
  category: 'earning' | 'deduction';
  type: string; // 'basic', 'house_rent', 'overtime', 'unpaid_leave', 'advance_recovery', etc.
  description: string;
  quantity?: number; // e.g. hours or days
  rate?: number;
  amount: number; // in BDT
  calculationBasis?: string;
}

export interface AttendanceDailySummary {
  id: string;
  employeeId: string;
  attendanceDate: string;
  scheduledMinutes: number;
  workedMinutes: number;
  lateMinutes: number;
  earlyDepartureMinutes: number;
  approvedOvertimeMinutes: number;
  computedStatus: AttendanceStatus;
}

export interface PayrollItem {
  id: string;
  payrollRunId: string;
  employeeId: string;
  employeeCode: string;
  employeeName: string;
  departmentName: string;
  designationTitle: string;
  daysInPeriod: number;
  workingDays: number;
  presentDays: number;
  paidLeaveDays: number;
  unpaidLeaveDays: number;
  absentDays: number;
  lateDays: number;
  overtimeHours: number;
  basicSalary: number;
  allowancesTotal: number;
  overtimePay: number;
  bonusAmount: number;
  grossAmount: number;
  unpaidDeduction: number;
  latePenaltyDeduction: number;
  advanceRecoveryDeduction: number;
  taxWithholding: number;
  otherDeductions: number;
  totalDeductions: number;
  netAmount: number;
  paymentStatus: 'unpaid' | 'paid';
  paymentDate?: string;
  paymentMethod?: 'bank_transfer' | 'bkash' | 'cash';
  paymentReference?: string;
  lineItems: PayrollLineItem[];
  publishedAt?: string;
}

export interface PayrollRun {
  id: string;
  organizationId: string;
  payrollPeriodId: string;
  month: number;
  year: number;
  versionNumber: number;
  status: PayrollRunStatus;
  totalEmployees: number;
  totalGross: number;
  totalDeductions: number;
  totalNet: number;
  calculatedAt: string;
  calculatedBy: string;
  reviewedBy?: string;
  reviewedAt?: string;
  approvedBy?: string;
  approvedAt?: string;
  finalizedBy?: string;
  finalizedAt?: string;
  notes?: string;
}

export interface NotificationItem {
  id: string;
  recipientUserId: string;
  title: string;
  message: string;
  type: 'attendance' | 'leave' | 'payroll' | 'correction' | 'system';
  isRead: boolean;
  actionUrl?: string;
  createdAt: string;
}

export interface AuditLog {
  id: string;
  organizationId: string;
  actorUserId: string;
  actorName: string;
  targetType: 'employee' | 'attendance' | 'leave' | 'payroll' | 'settings' | 'user';
  targetId: string;
  action: string;
  details: string;
  ipAddress?: string;
  createdAt: string;
}

export interface SystemSettings {
  organization: Organization;
  trustedOfficeNetworks: {
    id: string;
    name: string;
    cidr: string;
    enabled: boolean;
  }[];
  kioskDevices: {
    id: string;
    name: string;
    deviceIdentifier: string;
    token: string;
    lastSeen: string;
    enabled: boolean;
  }[];
  payrollPolicy: PayrollPolicy;
}
