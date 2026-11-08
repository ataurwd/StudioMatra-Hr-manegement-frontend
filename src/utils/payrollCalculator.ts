/**
 * STUDIO MATRA — Automated BDT Payroll Calculation Engine
 * Implements precise, traceable, and audited payroll calculations.
 * Supports configurable divisor methods, pro-rating, overtime multipliers,
 * late penalties, salary advances, and tax deductions.
 */

import { DivisorMethod, PayrollItem, PayrollLineItem, PayrollPolicy, SalaryAdvance, SalaryContract } from '../types';
import { addMoney, divideMoney, multiplyMoney, round2, subtractMoney } from './money';

export interface EmployeeAttendanceAggregate {
  employeeId: string;
  totalPresent: number;
  totalLate: number;
  totalHalfDay: number;
  totalPaidLeave: number;
  totalUnpaidLeave: number;
  totalAbsent: number;
  totalOvertimeHours: number;
  totalWorkedHours: number;
}

export interface PayrollCalculationInput {
  periodMonth: number;
  periodYear: number;
  periodStart: string; // YYYY-MM-DD
  periodEnd: string;   // YYYY-MM-DD
  daysInMonth: number;
  scheduledWorkingDays: number;
  employee: {
    id: string;
    employeeCode: string;
    fullName: string;
    departmentName: string;
    designationTitle: string;
    joiningDate: string;
    terminationDate?: string;
  };
  salaryContract: SalaryContract;
  attendance: EmployeeAttendanceAggregate;
  policy: PayrollPolicy;
  activeAdvance?: SalaryAdvance;
  bonusAmount?: number;
  taxWithholding?: number;
  otherDeductions?: number;
  customAdjustmentNotes?: string;
}

/**
 * Resolves the configured paid-day divisor count based on policy.
 */
export function getDivisorCount(
  method: DivisorMethod,
  daysInMonth: number,
  scheduledWorkingDays: number
): number {
  switch (method) {
    case 'calendar_days':
      return daysInMonth;
    case 'scheduled_workdays':
      return Math.max(1, scheduledWorkingDays);
    case 'fixed_30_days':
    default:
      return 30;
  }
}

/**
 * Checks if employee joined or left during the payroll period, returning eligible day fraction.
 */
export function calculateEligibleDayFraction(params: {
  periodStart: string;
  periodEnd: string;
  joiningDate: string;
  terminationDate?: string;
  daysInMonth: number;
}): { isPartialMonth: boolean; eligibleDays: number; totalDays: number } {
  const { periodStart, periodEnd, joiningDate, terminationDate, daysInMonth } = params;

  const pStart = new Date(periodStart);
  const pEnd = new Date(periodEnd);
  const join = new Date(joiningDate);
  const term = terminationDate ? new Date(terminationDate) : null;

  // Effective period bounds
  const effectiveStart = join > pStart ? join : pStart;
  const effectiveEnd = term && term < pEnd ? term : pEnd;

  if (effectiveStart > pEnd || effectiveEnd < pStart) {
    return { isPartialMonth: true, eligibleDays: 0, totalDays: daysInMonth };
  }

  const isPartial = join > pStart || (term !== null && term < pEnd);
  
  if (!isPartial) {
    return { isPartialMonth: false, eligibleDays: daysInMonth, totalDays: daysInMonth };
  }

  // Calculate inclusive active days
  const diffTime = effectiveEnd.getTime() - effectiveStart.getTime();
  const eligibleDays = Math.max(0, Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1);

  return { isPartialMonth: true, eligibleDays, totalDays: daysInMonth };
}

/**
 * Calculates a complete, audited payroll line-item breakdown for an employee.
 */
export function calculateEmployeePayroll(input: PayrollCalculationInput): {
  payrollItem: Omit<PayrollItem, 'id' | 'payrollRunId'>;
  advanceRecoveryAmount: number;
  exceptions: string[];
} {
  const {
    periodStart,
    periodEnd,
    daysInMonth,
    scheduledWorkingDays,
    employee,
    salaryContract,
    attendance,
    policy,
    activeAdvance,
    bonusAmount = 0,
    taxWithholding = 0,
    otherDeductions = 0,
  } = input;

  const exceptions: string[] = [];
  const lineItems: PayrollLineItem[] = [];

  // 1. Determine Divisor
  const divisor = getDivisorCount(policy.divisorMethod, daysInMonth, scheduledWorkingDays);

  // 2. Base Earnings
  const fullBasic = round2(salaryContract.basicSalary);
  const houseRent = round2(salaryContract.houseRentAllowance);
  const medical = round2(salaryContract.medicalAllowance);
  const transport = round2(salaryContract.transportAllowance);
  const otherAllowances = round2(salaryContract.otherFixedAllowances);

  const fullMonthlyGross = addMoney(fullBasic, houseRent, medical, transport, otherAllowances);
  const totalAllowances = addMoney(houseRent, medical, transport, otherAllowances);

  // Check for Mid-Month Joining or Separation
  const { isPartialMonth, eligibleDays } = calculateEligibleDayFraction({
    periodStart,
    periodEnd,
    joiningDate: employee.joiningDate,
    terminationDate: employee.terminationDate,
    daysInMonth,
  });

  let eligibleBasic = fullBasic;
  let eligibleAllowances = totalAllowances;

  if (isPartialMonth) {
    const fraction = eligibleDays / daysInMonth;
    eligibleBasic = round2(fullBasic * fraction);
    eligibleAllowances = round2(totalAllowances * fraction);
    exceptions.push(
      `Partial month applied: Joined ${employee.joiningDate}. Eligible ${eligibleDays}/${daysInMonth} days.`
    );
  }

  lineItems.push({
    id: 'li-basic',
    payrollItemId: '',
    category: 'earning',
    type: 'basic',
    description: isPartialMonth ? `Basic Salary (Prorated ${eligibleDays}/${daysInMonth} days)` : 'Basic Salary',
    amount: eligibleBasic,
    calculationBasis: `Monthly basic: ${fullBasic}`,
  });

  if (houseRent > 0) {
    const hr = isPartialMonth ? round2(houseRent * (eligibleDays / daysInMonth)) : houseRent;
    lineItems.push({
      id: 'li-house-rent',
      payrollItemId: '',
      category: 'earning',
      type: 'house_rent',
      description: 'House Rent Allowance',
      amount: hr,
    });
  }

  if (medical > 0) {
    const med = isPartialMonth ? round2(medical * (eligibleDays / daysInMonth)) : medical;
    lineItems.push({
      id: 'li-medical',
      payrollItemId: '',
      category: 'earning',
      type: 'medical',
      description: 'Medical Allowance',
      amount: med,
    });
  }

  if (transport > 0) {
    const tr = isPartialMonth ? round2(transport * (eligibleDays / daysInMonth)) : transport;
    lineItems.push({
      id: 'li-transport',
      payrollItemId: '',
      category: 'earning',
      type: 'transport',
      description: 'Transport Allowance',
      amount: tr,
    });
  }

  if (otherAllowances > 0) {
    const oth = isPartialMonth ? round2(otherAllowances * (eligibleDays / daysInMonth)) : otherAllowances;
    lineItems.push({
      id: 'li-other-allowance',
      payrollItemId: '',
      category: 'earning',
      type: 'other_allowance',
      description: 'Special Architecture Project Allowance',
      amount: oth,
    });
  }

  // 3. Overtime Pay Calculation
  // Standard formula: Hourly rate = (Basic Salary / Divisor) / 8 standard work hours
  // Overtime rate = Hourly rate * overtimeMultiplier
  let overtimePay = 0;
  if (attendance.totalOvertimeHours > 0) {
    const dailyBasicRate = divideMoney(fullBasic, divisor);
    const hourlyRate = divideMoney(dailyBasicRate, 8);
    const otRate = round2(hourlyRate * policy.overtimeMultiplier);
    overtimePay = round2(otRate * attendance.totalOvertimeHours);

    lineItems.push({
      id: 'li-overtime',
      payrollItemId: '',
      category: 'earning',
      type: 'overtime',
      description: `Approved Overtime (${attendance.totalOvertimeHours} hrs @ ${otRate}/hr)`,
      quantity: attendance.totalOvertimeHours,
      rate: otRate,
      amount: overtimePay,
      calculationBasis: `Hourly basic: ${hourlyRate} * ${policy.overtimeMultiplier}x`,
    });
  }

  // 4. Bonuses & Incentives
  if (bonusAmount > 0) {
    lineItems.push({
      id: 'li-bonus',
      payrollItemId: '',
      category: 'earning',
      type: 'performance_bonus',
      description: 'Performance & Design Completion Bonus',
      amount: round2(bonusAmount),
    });
  }

  const grossAmount = addMoney(
    eligibleBasic,
    eligibleAllowances,
    overtimePay,
    bonusAmount
  );

  // 5. Deductions
  // 5a. Unpaid Leave & Absence Deductions
  // Daily rate for deductions based on policy
  const dailyDeductionBase = policy.unpaidLeaveDeductionFormula === 'per_day_basic'
    ? fullBasic
    : fullMonthlyGross;
  const perDayRate = divideMoney(dailyDeductionBase, divisor);

  // Unpaid days = unpaid leaves + unapproved absences + (half days * 0.5)
  const totalUnpaidDays = attendance.totalUnpaidLeave + attendance.totalAbsent + (attendance.totalHalfDay * 0.5);
  let unpaidDeduction = 0;

  if (totalUnpaidDays > 0) {
    unpaidDeduction = round2(perDayRate * totalUnpaidDays);
    lineItems.push({
      id: 'li-unpaid-deduction',
      payrollItemId: '',
      category: 'deduction',
      type: 'unpaid_leave',
      description: `Absence & Unpaid Leave (${totalUnpaidDays} days @ ${perDayRate}/day)`,
      quantity: totalUnpaidDays,
      rate: perDayRate,
      amount: unpaidDeduction,
      calculationBasis: `Divisor: ${divisor} days`,
    });
  }

  // 5b. Late Arrival Penalty
  // e.g. 3 late days = 1 day basic salary penalty
  let latePenaltyDeduction = 0;
  if (policy.latePenaltyEnabled && attendance.totalLate >= policy.latePenaltyThresholdDays) {
    const penaltyUnits = Math.floor(attendance.totalLate / policy.latePenaltyThresholdDays);
    const penaltyRate = divideMoney(fullBasic, divisor);
    latePenaltyDeduction = round2(penaltyUnits * penaltyRate);

    lineItems.push({
      id: 'li-late-penalty',
      payrollItemId: '',
      category: 'deduction',
      type: 'late_penalty',
      description: `Late Arrival Penalty (${attendance.totalLate} late days, ${penaltyUnits} penalty day(s))`,
      quantity: penaltyUnits,
      rate: penaltyRate,
      amount: latePenaltyDeduction,
    });
  }

  // 5c. Advance Recovery / Loan Installment
  let advanceRecoveryDeduction = 0;
  if (activeAdvance && activeAdvance.remainingBalance > 0) {
    advanceRecoveryDeduction = Math.min(activeAdvance.monthlyDeduction, activeAdvance.remainingBalance);
    advanceRecoveryDeduction = round2(advanceRecoveryDeduction);

    lineItems.push({
      id: 'li-advance-recovery',
      payrollItemId: '',
      category: 'deduction',
      type: 'advance_recovery',
      description: `Salary Advance Recovery (Balance remaining: ${subtractMoney(activeAdvance.remainingBalance, advanceRecoveryDeduction)})`,
      amount: advanceRecoveryDeduction,
    });
  }

  // 5d. Tax Withholding (TDS)
  if (taxWithholding > 0) {
    lineItems.push({
      id: 'li-tax',
      payrollItemId: '',
      category: 'deduction',
      type: 'tax_withholding',
      description: 'Tax Withholding (TDS)',
      amount: round2(taxWithholding),
    });
  }

  // 5e. Other Deductions
  if (otherDeductions > 0) {
    lineItems.push({
      id: 'li-other-deduction',
      payrollItemId: '',
      category: 'deduction',
      type: 'other_deductions',
      description: 'Authorized Miscellaneous Deduction',
      amount: round2(otherDeductions),
    });
  }

  const totalDeductions = addMoney(
    unpaidDeduction,
    latePenaltyDeduction,
    advanceRecoveryDeduction,
    taxWithholding,
    otherDeductions
  );

  let netAmount = subtractMoney(grossAmount, totalDeductions);

  // Negative Net Salary Exception Guard
  if (netAmount < 0) {
    exceptions.push(
      `Negative Net Pay Exception: Gross (${grossAmount}) is lower than Total Deductions (${totalDeductions}). Net adjusted to ৳0.00.`
    );
    netAmount = 0;
  }

  return {
    payrollItem: {
      employeeId: employee.id,
      employeeCode: employee.employeeCode,
      employeeName: employee.fullName,
      departmentName: employee.departmentName,
      designationTitle: employee.designationTitle,
      daysInPeriod: daysInMonth,
      workingDays: scheduledWorkingDays,
      presentDays: attendance.totalPresent,
      paidLeaveDays: attendance.totalPaidLeave,
      unpaidLeaveDays: attendance.totalUnpaidLeave,
      absentDays: attendance.totalAbsent,
      lateDays: attendance.totalLate,
      overtimeHours: attendance.totalOvertimeHours,
      basicSalary: eligibleBasic,
      allowancesTotal: eligibleAllowances,
      overtimePay,
      bonusAmount: round2(bonusAmount),
      grossAmount,
      unpaidDeduction,
      latePenaltyDeduction,
      advanceRecoveryDeduction,
      taxWithholding: round2(taxWithholding),
      otherDeductions: round2(otherDeductions),
      totalDeductions,
      netAmount,
      paymentStatus: 'unpaid',
      lineItems,
    },
    advanceRecoveryAmount: advanceRecoveryDeduction,
    exceptions,
  };
}
