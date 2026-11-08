/**
 * Unit Tests for Payroll Calculations
 * Run with: npx --yes tsx --test src/test/payroll.test.ts
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateEligibleDayFraction,
  calculateEmployeePayroll,
  getDivisorCount,
  PayrollCalculationInput
} from '../utils/payrollCalculator';
import { PayrollPolicy, SalaryContract } from '../types';

const defaultPolicy: PayrollPolicy = {
  id: 'policy-1',
  organizationId: 'org-1',
  version: 1,
  divisorMethod: 'fixed_30_days',
  overtimeMultiplier: 1.5,
  latePenaltyEnabled: true,
  latePenaltyThresholdDays: 3,
  unpaidLeaveDeductionFormula: 'per_day_gross',
  roundingRule: 'round_nearest',
  effectiveFrom: '2026-01-01',
};

const standardContract: SalaryContract = {
  id: 'contract-1',
  employeeId: 'emp-1',
  salaryType: 'monthly',
  basicSalary: 50000,
  houseRentAllowance: 25000,
  medicalAllowance: 5000,
  transportAllowance: 5000,
  otherFixedAllowances: 0,
  effectiveFrom: '2026-01-01',
  status: 'active',
};

test('Divisor method returns correct days', () => {
  assert.equal(getDivisorCount('calendar_days', 31, 22), 31);
  assert.equal(getDivisorCount('scheduled_workdays', 30, 22), 22);
  assert.equal(getDivisorCount('fixed_30_days', 31, 22), 30);
});

test('Full month salary with zero deductions calculates exact gross and net pay', () => {
  const input: PayrollCalculationInput = {
    periodMonth: 11,
    periodYear: 2026,
    periodStart: '2026-11-01',
    periodEnd: '2026-11-30',
    daysInMonth: 30,
    scheduledWorkingDays: 22,
    employee: {
      id: 'emp-1',
      employeeCode: 'SM-0001',
      fullName: 'Tanvir Hasan',
      departmentName: 'Architecture',
      designationTitle: 'Senior Architect',
      joiningDate: '2025-01-01',
    },
    salaryContract: standardContract, // 50k basic + 25k HR + 5k Med + 5k Trans = 85k gross
    attendance: {
      employeeId: 'emp-1',
      totalPresent: 22,
      totalLate: 0,
      totalHalfDay: 0,
      totalPaidLeave: 0,
      totalUnpaidLeave: 0,
      totalAbsent: 0,
      totalOvertimeHours: 0,
      totalWorkedHours: 176,
    },
    policy: defaultPolicy,
  };

  const { payrollItem, exceptions } = calculateEmployeePayroll(input);

  assert.equal(payrollItem.grossAmount, 85000);
  assert.equal(payrollItem.totalDeductions, 0);
  assert.equal(payrollItem.netAmount, 85000);
  assert.equal(exceptions.length, 0);
});

test('Unpaid leave deducts accurately based on gross/divisor without double subtraction', () => {
  const input: PayrollCalculationInput = {
    periodMonth: 11,
    periodYear: 2026,
    periodStart: '2026-11-01',
    periodEnd: '2026-11-30',
    daysInMonth: 30,
    scheduledWorkingDays: 22,
    employee: {
      id: 'emp-1',
      employeeCode: 'SM-0001',
      fullName: 'Tanvir Hasan',
      departmentName: 'Architecture',
      designationTitle: 'Senior Architect',
      joiningDate: '2025-01-01',
    },
    salaryContract: standardContract, // 85k gross. Divisor 30 => 2833.33/day
    attendance: {
      employeeId: 'emp-1',
      totalPresent: 20,
      totalLate: 0,
      totalHalfDay: 0,
      totalPaidLeave: 0,
      totalUnpaidLeave: 2, // 2 days unpaid
      totalAbsent: 0,
      totalOvertimeHours: 0,
      totalWorkedHours: 160,
    },
    policy: defaultPolicy, // fixed_30_days, per_day_gross
  };

  const { payrollItem } = calculateEmployeePayroll(input);

  // Daily rate = 85000 / 30 = 2833.33. 2 days = 5666.66
  assert.equal(payrollItem.grossAmount, 85000);
  assert.equal(payrollItem.unpaidDeduction, 5666.66);
  assert.equal(payrollItem.totalDeductions, 5666.66);
  assert.equal(payrollItem.netAmount, 79333.34);
});

test('Late penalty applies 1 day basic salary penalty when late days >= threshold (3 days)', () => {
  const input: PayrollCalculationInput = {
    periodMonth: 11,
    periodYear: 2026,
    periodStart: '2026-11-01',
    periodEnd: '2026-11-30',
    daysInMonth: 30,
    scheduledWorkingDays: 22,
    employee: {
      id: 'emp-1',
      employeeCode: 'SM-0001',
      fullName: 'Tanvir Hasan',
      departmentName: 'Architecture',
      designationTitle: 'Senior Architect',
      joiningDate: '2025-01-01',
    },
    salaryContract: standardContract, // 50k basic / 30 = 1666.67
    attendance: {
      employeeId: 'emp-1',
      totalPresent: 22,
      totalLate: 4, // 4 late days >= 3 threshold => 1 penalty unit
      totalHalfDay: 0,
      totalPaidLeave: 0,
      totalUnpaidLeave: 0,
      totalAbsent: 0,
      totalOvertimeHours: 0,
      totalWorkedHours: 176,
    },
    policy: defaultPolicy,
  };

  const { payrollItem } = calculateEmployeePayroll(input);
  assert.equal(payrollItem.latePenaltyDeduction, 1666.67);
  assert.equal(payrollItem.netAmount, 85000 - 1666.67);
});

test('Overtime pay calculates hourly rate * multiplier correctly', () => {
  const input: PayrollCalculationInput = {
    periodMonth: 11,
    periodYear: 2026,
    periodStart: '2026-11-01',
    periodEnd: '2026-11-30',
    daysInMonth: 30,
    scheduledWorkingDays: 22,
    employee: {
      id: 'emp-1',
      employeeCode: 'SM-0001',
      fullName: 'Tanvir Hasan',
      departmentName: 'Architecture',
      designationTitle: 'Senior Architect',
      joiningDate: '2025-01-01',
    },
    salaryContract: standardContract, // 50k basic. Divisor 30 => daily 1666.67 => hourly 208.33. Multiplier 1.5 => 312.50/hr
    attendance: {
      employeeId: 'emp-1',
      totalPresent: 22,
      totalLate: 0,
      totalHalfDay: 0,
      totalPaidLeave: 0,
      totalUnpaidLeave: 0,
      totalAbsent: 0,
      totalOvertimeHours: 10, // 10 OT hours
      totalWorkedHours: 186,
    },
    policy: defaultPolicy,
  };

  const { payrollItem } = calculateEmployeePayroll(input);

  // 10 hours * 312.50 = 3125.00
  assert.equal(payrollItem.overtimePay, 3125);
  assert.equal(payrollItem.grossAmount, 85000 + 3125);
  assert.equal(payrollItem.netAmount, 88125);
});

test('Mid-month joiner on Nov 16 (15 days out of 30) gets 50% prorated base salary', () => {
  const fraction = calculateEligibleDayFraction({
    periodStart: '2026-11-01',
    periodEnd: '2026-11-30',
    joiningDate: '2026-11-16',
    daysInMonth: 30,
  });

  assert.equal(fraction.isPartialMonth, true);
  assert.equal(fraction.eligibleDays, 15);

  const input: PayrollCalculationInput = {
    periodMonth: 11,
    periodYear: 2026,
    periodStart: '2026-11-01',
    periodEnd: '2026-11-30',
    daysInMonth: 30,
    scheduledWorkingDays: 22,
    employee: {
      id: 'emp-2',
      employeeCode: 'SM-0002',
      fullName: 'Sadia Kabir',
      departmentName: 'Interior Design',
      designationTitle: 'Junior Interior Designer',
      joiningDate: '2026-11-16',
    },
    salaryContract: standardContract,
    attendance: {
      employeeId: 'emp-2',
      totalPresent: 11,
      totalLate: 0,
      totalHalfDay: 0,
      totalPaidLeave: 0,
      totalUnpaidLeave: 0,
      totalAbsent: 0,
      totalOvertimeHours: 0,
      totalWorkedHours: 88,
    },
    policy: defaultPolicy,
  };

  const { payrollItem, exceptions } = calculateEmployeePayroll(input);
  assert.equal(payrollItem.basicSalary, 25000); // 50k * (15/30) = 25k
  assert.equal(payrollItem.grossAmount, 42500); // 85k * 0.5 = 42500
  assert.equal(exceptions.some(e => e.includes('Partial month')), true);
});

test('Salary advance deduction does not exceed remaining balance', () => {
  const input: PayrollCalculationInput = {
    periodMonth: 11,
    periodYear: 2026,
    periodStart: '2026-11-01',
    periodEnd: '2026-11-30',
    daysInMonth: 30,
    scheduledWorkingDays: 22,
    employee: {
      id: 'emp-1',
      employeeCode: 'SM-0001',
      fullName: 'Tanvir Hasan',
      departmentName: 'Architecture',
      designationTitle: 'Senior Architect',
      joiningDate: '2025-01-01',
    },
    salaryContract: standardContract,
    attendance: {
      employeeId: 'emp-1',
      totalPresent: 22,
      totalLate: 0,
      totalHalfDay: 0,
      totalPaidLeave: 0,
      totalUnpaidLeave: 0,
      totalAbsent: 0,
      totalOvertimeHours: 0,
      totalWorkedHours: 176,
    },
    policy: defaultPolicy,
    activeAdvance: {
      id: 'adv-1',
      employeeId: 'emp-1',
      approvedAmount: 20000,
      disbursedAmount: 20000,
      remainingBalance: 3000, // only 3000 left
      monthlyDeduction: 5000, // installment is 5000
      approvalDate: '2026-08-01',
      disbursementDate: '2026-08-02',
      status: 'active',
      purpose: 'Design Equipment Advance',
    },
  };

  const { payrollItem } = calculateEmployeePayroll(input);
  // Cap deduction at remaining balance: 3000 instead of 5000
  assert.equal(payrollItem.advanceRecoveryDeduction, 3000);
  assert.equal(payrollItem.netAmount, 85000 - 3000);
});

test('Negative net pay protection clamps to 0 and logs exception', () => {
  const input: PayrollCalculationInput = {
    periodMonth: 11,
    periodYear: 2026,
    periodStart: '2026-11-01',
    periodEnd: '2026-11-30',
    daysInMonth: 30,
    scheduledWorkingDays: 22,
    employee: {
      id: 'emp-1',
      employeeCode: 'SM-0001',
      fullName: 'Tanvir Hasan',
      departmentName: 'Architecture',
      designationTitle: 'Senior Architect',
      joiningDate: '2025-01-01',
    },
    salaryContract: standardContract,
    attendance: {
      employeeId: 'emp-1',
      totalPresent: 0,
      totalLate: 0,
      totalHalfDay: 0,
      totalPaidLeave: 0,
      totalUnpaidLeave: 0,
      totalAbsent: 0,
      totalOvertimeHours: 0,
      totalWorkedHours: 0,
    },
    policy: defaultPolicy,
    otherDeductions: 100000, // Exceeds 85k gross
  };

  const { payrollItem, exceptions } = calculateEmployeePayroll(input);
  assert.equal(payrollItem.netAmount, 0);
  assert.equal(exceptions.some(e => e.includes('Negative Net Pay Exception')), true);
});
