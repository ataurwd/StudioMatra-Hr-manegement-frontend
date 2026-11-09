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
import { db } from '../db/database';
import { TEST_STATE } from './testFixtures';

// Initialize in-memory test fixtures for headless test runner
db.syncFromRemote(TEST_STATE);

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

test('Employee CANNOT see draft or unreleased payslips even if paid; payslip is strictly visible only after Admin publishes', () => {
  const actor = { userId: 'user-0001', name: 'IAr. Md. Ishtiaque Haque' };

  // Create a period and calculate payroll
  const period = db.createPayrollPeriod(3, 2026, actor);
  const run = db.calculateDraftPayroll(period.id, actor);
  assert.equal(run.status, 'calculated');

  // Ar. Iqbal Hossain is emp-0003
  const items = db.getPayrollItems(run.id);
  const iqbalItem = items.find((i: any) => i.employeeId === 'emp-0003');
  assert.ok(iqbalItem, 'Iqbal item must exist in draft calculation');
  assert.equal(iqbalItem.paymentStatus, 'unpaid');

  // Admin marks Iqbal as PAID internally
  db.recordPayment({
    payrollItemId: iqbalItem.id,
    paymentMethod: 'bank_transfer',
    paymentReference: 'EBL-TRX-123456',
    paymentDate: '2026-03-09',
    actor,
  });

  // Strict confidentiality check: Before Admin publishes, employee cannot see the payslip
  const unreleasedSlips = db.getEmployeePublishedPayslips('emp-0003');
  assert.equal(unreleasedSlips.length, 0, 'Unpublished payslips must NOT be visible to employee');

  // Admin reaches Step 7 and explicitly publishes payslips to staff
  db.publishPayslips(run.id, actor);

  // Now, employee can see the published payslip
  const publishedSlips = db.getEmployeePublishedPayslips('emp-0003');
  assert.ok(publishedSlips.length > 0, 'Published payslips must contain at least 1 item after release');

  const latestSlip = publishedSlips[0];
  assert.equal(latestSlip.id, iqbalItem.id);
  assert.equal(latestSlip.paymentStatus, 'paid');
  assert.equal(latestSlip.paymentReference, 'EBL-TRX-123456');
  assert.ok(latestSlip.publishedAt, 'publishedAt must be set after publish');
});

test('Admin can edit an existing payroll period (dates, month, year, status)', () => {
  const actor = { userId: 'user-0001', name: 'IAr. Md. Ishtiaque Haque' };
  const period = db.createPayrollPeriod(8, 2026, actor);
  assert.ok(period);
  assert.equal(period.month, 8);

  const updated = db.updatePayrollPeriod(
    period.id,
    {
      month: 9,
      periodStart: '2026-09-01',
      periodEnd: '2026-09-30',
      status: 'calculated',
    },
    actor
  );

  assert.equal(updated.month, 9);
  assert.equal(updated.periodStart, '2026-09-01');
  assert.equal(updated.status, 'calculated');
});

test('Admin can delete a payroll period along with its associated runs and items', () => {
  const actor = { userId: 'user-0001', name: 'IAr. Md. Ishtiaque Haque' };
  const period = db.createPayrollPeriod(12, 2026, actor);
  assert.ok(period);

  // Calculate run for this period
  const run = db.calculateDraftPayroll(period.id, actor);
  assert.ok(run);
  const itemsBefore = db.getPayrollItems(run.id);
  assert.ok(itemsBefore.length > 0);

  // Delete the period
  const deleted = db.deletePayrollPeriod(period.id, actor);
  assert.equal(deleted, true);

  // Verify period, run, and items are removed
  const periodsAfter = db.getPayrollPeriods();
  assert.equal(periodsAfter.some((p) => p.id === period.id), false);
  const runsAfter = db.getPayrollRuns();
  assert.equal(runsAfter.some((r) => r.payrollPeriodId === period.id), false);
  const itemsAfter = db.getPayrollItems(run.id);
  assert.equal(itemsAfter.length, 0);
});

test('Admin can reset a paid payslip back to UNPAID status and clear payment references', () => {
  const actor = { userId: 'user-0001', name: 'IAr. Md. Ishtiaque Haque' };
  const period = db.createPayrollPeriod(7, 2026, actor);
  const run = db.calculateDraftPayroll(period.id, actor);
  const items = db.getPayrollItems(run.id);
  const target = items[0];

  // Pay employee
  db.recordPayment({
    payrollItemId: target.id,
    paymentMethod: 'bank_transfer',
    paymentReference: 'TEST-REF-999',
    paymentDate: '2026-07-31',
    actor,
  });

  assert.equal(target.paymentStatus, 'paid');
  assert.equal(target.paymentReference, 'TEST-REF-999');

  // Reset payment
  const resetItem = db.resetPayslipPayment(target.id, actor);
  assert.equal(resetItem.paymentStatus, 'unpaid');
  assert.equal(resetItem.paymentReference, undefined);
  assert.equal(resetItem.paymentDate, undefined);
  assert.equal(resetItem.publishedAt, undefined);
});

test('Admin can reset all practice payments in bulk', () => {
  const actor = { userId: 'user-0001', name: 'IAr. Md. Ishtiaque Haque' };
  const period = db.createPayrollPeriod(6, 2026, actor);
  const run = db.calculateDraftPayroll(period.id, actor);
  const items = db.getPayrollItems(run.id);

  // Pay first 2 employees
  db.recordPayment({
    payrollItemId: items[0].id,
    paymentMethod: 'cash',
    paymentReference: 'CASH-001',
    paymentDate: '2026-06-30',
    actor,
  });
  db.recordPayment({
    payrollItemId: items[1].id,
    paymentMethod: 'bkash',
    paymentReference: 'BKASH-002',
    paymentDate: '2026-06-30',
    actor,
  });

  const count = db.resetAllPracticePayments(actor);
  assert.ok(count >= 2);
  assert.equal(items[0].paymentStatus, 'unpaid');
  assert.equal(items[1].paymentStatus, 'unpaid');
});

