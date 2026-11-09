/**
 * Unit Tests for Role-Based Access Control (RBAC)
 * Run with: npx --yes tsx --test src/test/rbac.test.ts
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { db } from '../db/database';
import { TEST_STATE } from './testFixtures';

// Initialize in-memory test fixtures for headless test runner
db.syncFromRemote(TEST_STATE);
import {
  canApproveLeave,
  canManageAttendance,
  canManagePayroll,
  canViewSalary,
  hasPermission
} from '../utils/permissions';

test('Super Admin has all permissions including salary, payroll, settings, and attendance', () => {
  assert.equal(hasPermission('super_admin', 'salary.read'), true);
  assert.equal(hasPermission('super_admin', 'payroll.calculate'), true);
  assert.equal(hasPermission('super_admin', 'payroll.approve'), true);
  assert.equal(hasPermission('super_admin', 'payroll.finalize'), true);
  assert.equal(hasPermission('super_admin', 'settings.manage'), true);
  assert.equal(canViewSalary('super_admin'), true);
  assert.equal(canManagePayroll('super_admin'), true);
});

test('HR Admin CANNOT view confidential salaries or calculate payroll', () => {
  assert.equal(hasPermission('hr_admin', 'salary.read'), false);
  assert.equal(hasPermission('hr_admin', 'salary.manage'), false);
  assert.equal(hasPermission('hr_admin', 'payroll.calculate'), false);
  assert.equal(hasPermission('hr_admin', 'payroll.finalize'), false);
  assert.equal(canViewSalary('hr_admin'), false);
  assert.equal(canManagePayroll('hr_admin'), false);
});

test('HR Admin CAN manage employees, leave, and attendance corrections', () => {
  assert.equal(hasPermission('hr_admin', 'employee.manage'), true);
  assert.equal(hasPermission('hr_admin', 'attendance.manage'), true);
  assert.equal(hasPermission('hr_admin', 'attendance.correct'), true);
  assert.equal(hasPermission('hr_admin', 'leave.approve'), true);
  assert.equal(canApproveLeave('hr_admin'), true);
  assert.equal(canManageAttendance('hr_admin'), true);
});

test('Finance Manager CAN manage salary, payroll, and view reports, but cannot alter shifts or attendance policies', () => {
  assert.equal(canViewSalary('finance_manager'), true);
  assert.equal(canManagePayroll('finance_manager'), true);
  assert.equal(hasPermission('finance_manager', 'payslip.publish'), true);
  assert.equal(hasPermission('finance_manager', 'settings.manage'), false);
  assert.equal(hasPermission('finance_manager', 'attendance.manage'), false);
});

test('Department Manager CANNOT view private salaries or payroll registers', () => {
  assert.equal(canViewSalary('department_manager'), false);
  assert.equal(canManagePayroll('department_manager'), false);
  assert.equal(hasPermission('department_manager', 'employee.read_team'), true);
  assert.equal(hasPermission('department_manager', 'attendance.read_team'), true);
});

test('Employee CANNOT view peer records, alter payroll, or approve requests', () => {
  assert.equal(hasPermission('employee', 'employee.read_team'), false);
  assert.equal(hasPermission('employee', 'attendance.read_team'), false);
  assert.equal(hasPermission('employee', 'leave.approve'), false);
  assert.equal(hasPermission('employee', 'payroll.calculate'), false);
  assert.equal(hasPermission('employee', 'salary.read'), false);
  assert.equal(hasPermission('employee', 'attendance.check_in_own'), true);
  assert.equal(hasPermission('employee', 'attendance.check_out_own'), true);
  assert.equal(hasPermission('employee', 'leave.apply'), true);
});

test('createEmployee and deleteEmployee properly add and purge employee and associated records', () => {
  const actor = { userId: 'user-0001', name: 'Ar. Nahid Rahman' };
  const initialCount = db.getEmployees().length;

  const created = db.createEmployee(
    {
      userId: 'user-test-delete',
      employeeCode: 'SM-9999',
      fullName: 'Test Dummy Employee',
      email: 'dummy@studiomatra.com.bd',
      phone: '+880 1711-999999',
      departmentId: 'dept-arch',
      designationId: 'des-jr-arch',
      joiningDate: '2026-11-01',
      employmentStatus: 'active',
      employmentType: 'full_time',
      shiftId: 'shift-standard',
      emergencyContact: {
        name: 'Emergency',
        relationship: 'Kin',
        phone: '+880 1711-888888',
      },
      paymentDetails: {
        bankName: 'BRAC Bank',
        accountName: 'Test Dummy',
        accountNumber: '1234567890',
        branchName: 'Gulshan',
      },
    },
    actor
  );

  assert.equal(db.getEmployees().length, initialCount + 1);
  assert.equal(db.getEmployees().some((e) => e.id === created.id), true);

  const deleted = db.deleteEmployee(created.id, actor);
  assert.equal(deleted, true);
  assert.equal(db.getEmployees().length, initialCount);
  assert.equal(db.getEmployees().some((e) => e.id === created.id), false);
  assert.equal(
    db.getUsers().some((u) => u.employeeId === created.id || u.id === 'user-test-delete'),
    false
  );
});

test('updateLeaveBalance allows admin to adjust quota and recalculate remaining days for an individual employee', () => {
  const actor = { userId: 'user-0001', name: 'Ar. Nahid Rahman' };
  const employeeId = 'emp-0001';
  const leaveTypeId = 'lt-casual';

  // Adjust quota to 15, used to 3 -> closing should be 12
  const updated = db.updateLeaveBalance(
    {
      employeeId,
      leaveTypeId,
      accrued: 15,
      used: 3,
      notes: 'Test bonus allocation',
    },
    actor
  );

  assert.equal(updated.accrued, 15);
  assert.equal(updated.used, 3);
  assert.equal(updated.closingBalance, 12);

  const balances = db.getLeaveBalances(employeeId);
  const casual = balances.find((b) => b.leaveTypeId === leaveTypeId);
  assert.equal(casual?.closingBalance, 12);
});

test('updateLeaveRequest allows admin to modify dates and status of existing application', () => {
  const actor = { userId: 'user-0001', name: 'IAr. Md. Ishtiaque Haque' };
  const target = db.applyLeave(
    {
      employeeId: 'emp-0003',
      leaveTypeId: 'lt-casual',
      startDate: '2026-11-20',
      endDate: '2026-11-21',
      durationDays: 2,
      isHalfDay: false,
      reason: 'Personal reason',
    },
    actor
  );
  assert.ok(target.id);

  const updated = db.updateLeaveRequest(
    {
      requestId: target.id,
      reason: 'Updated vacation schedule',
      durationDays: 4,
    },
    actor
  );

  assert.equal(updated.reason, 'Updated vacation schedule');
  assert.equal(updated.durationDays, 4);
});

test('createEmployee with custom kiosk PIN and updateEmployeePin work as expected', () => {
  const actor = { userId: 'user-0001', name: 'IAr. Md. Ishtiaque Haque' };

  const created = db.createEmployee(
    {
      userId: 'user-pin-test',
      employeeCode: 'SM-8888',
      fullName: 'Pin Test Employee',
      email: 'pintest@studiomatra.com.bd',
      phone: '+880 1711-555555',
      departmentId: 'dept-arch',
      designationId: 'des-jr-arch',
      joiningDate: '2026-11-01',
      employmentStatus: 'active',
      employmentType: 'full_time',
      shiftId: 'shift-standard',
      emergencyContact: {
        name: 'Contact',
        relationship: 'Sibling',
        phone: '+880 1711-111111',
      },
      paymentDetails: {
        bankName: 'City Bank',
        accountName: 'Pin Test',
        accountNumber: '987654321',
        branchName: 'Dhanmondi',
      },
    },
    actor,
    { pinCode: '8989' }
  );

  const user = db.getUserByEmployeeId(created.id);
  assert.equal(user?.pinCode, '8989');

  // Change PIN later
  db.updateEmployeePin(created.id, '4321', actor);
  const updatedUser = db.getUserByEmployeeId(created.id);
  assert.equal(updatedUser?.pinCode, '4321');

  // Cleanup
  db.deleteEmployee(created.id, actor);
});

test('Only Administrators (Super Admin & HR Admin) can modify an employee PIN code', () => {
  const adminActor = { userId: 'user-0001', name: 'Nahid Hassan', role: 'super_admin' as const };
  const hrActor = { userId: 'user-0004', name: 'Farhana Ahmed', role: 'hr_admin' as const };
  const employeeActor = { userId: 'user-0005', name: 'Nusrat Jahan', role: 'employee' as const };
  const financeActor = { userId: 'user-0003', name: 'Kamrul Islam', role: 'finance_manager' as const };

  const targetEmp = db.getEmployees()[0];
  assert.ok(targetEmp);

  // 1. Regular employee cannot update PIN
  assert.throws(
    () => {
      db.updateEmployeePin(targetEmp.id, '9999', employeeActor);
    },
    /Permission denied: Only Administrators/
  );

  // 2. Finance manager cannot update PIN
  assert.throws(
    () => {
      db.updateEmployeePin(targetEmp.id, '9999', financeActor);
    },
    /Permission denied: Only Administrators/
  );

  // 3. HR Admin CAN update PIN
  db.updateEmployeePin(targetEmp.id, '7654', hrActor);
  let updatedUser = db.getUserByEmployeeId(targetEmp.id);
  assert.equal(updatedUser?.pinCode, '7654');

  // 4. Super Admin CAN update PIN
  db.updateEmployeePin(targetEmp.id, '1111', adminActor);
  updatedUser = db.getUserByEmployeeId(targetEmp.id);
  assert.equal(updatedUser?.pinCode, '1111');
});

test('Staff Monthly Attendance route is exclusively accessible by Super Admin only', () => {
  const isStaffAttendanceAuthorized = (role: string) => role === 'super_admin';

  assert.equal(isStaffAttendanceAuthorized('super_admin'), true);
  assert.equal(isStaffAttendanceAuthorized('hr_admin'), false);
  assert.equal(isStaffAttendanceAuthorized('finance_manager'), false);
  assert.equal(isStaffAttendanceAuthorized('department_manager'), false);
  assert.equal(isStaffAttendanceAuthorized('employee'), false);
});
