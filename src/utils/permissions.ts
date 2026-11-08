/**
 * STUDIO MATRA — Role-Based Access Control (RBAC) System
 * Enforces server-grade permission authorization across all roles.
 */

import { PermissionKey, RoleName } from '../types';

export const ROLE_PERMISSIONS: Record<RoleName, PermissionKey[]> = {
  super_admin: [
    'employee.read_own',
    'employee.read_team',
    'employee.manage',
    'attendance.check_in_own',
    'attendance.check_out_own',
    'attendance.read_team',
    'attendance.correct',
    'attendance.manage',
    'leave.apply',
    'leave.approve',
    'leave.manage',
    'salary.read',
    'salary.manage',
    'payroll.calculate',
    'payroll.approve',
    'payroll.finalize',
    'payslip.publish',
    'reports.hr',
    'reports.payroll',
    'settings.manage',
  ],

  hr_admin: [
    'employee.read_own',
    'employee.read_team',
    'employee.manage',
    'attendance.check_in_own',
    'attendance.check_out_own',
    'attendance.read_team',
    'attendance.correct',
    'attendance.manage',
    'leave.apply',
    'leave.approve',
    'leave.manage',
    'reports.hr',
  ],

  finance_manager: [
    'employee.read_own',
    'employee.read_team',
    'attendance.check_in_own',
    'attendance.check_out_own',
    'leave.apply',
    'salary.read',
    'salary.manage',
    'payroll.calculate',
    'payroll.approve',
    'payroll.finalize',
    'payslip.publish',
    'reports.payroll',
    'reports.hr',
  ],

  department_manager: [
    'employee.read_own',
    'employee.read_team',
    'attendance.check_in_own',
    'attendance.check_out_own',
    'attendance.read_team',
    'attendance.correct', // Can review/recommend corrections for team
    'leave.apply',
    'leave.approve', // Can recommend/review leave for direct reports
    'reports.hr',    // Limited team reports
  ],

  employee: [
    'employee.read_own',
    'attendance.check_in_own',
    'attendance.check_out_own',
    'attendance.correct', // Can submit own correction request
    'leave.apply',        // Can submit own leave request
  ],
};

/**
 * Checks whether a given role has a specific permission.
 */
export function hasPermission(role: RoleName, permission: PermissionKey): boolean {
  const permissions = ROLE_PERMISSIONS[role] || [];
  return permissions.includes(permission);
}

/**
 * Checks if the user role is authorized to view confidential salary information.
 */
export function canViewSalary(role: RoleName): boolean {
  return hasPermission(role, 'salary.read');
}

/**
 * Checks if the user role is authorized to calculate and approve payroll.
 */
export function canManagePayroll(role: RoleName): boolean {
  return hasPermission(role, 'payroll.calculate');
}

/**
 * Checks if the user role can approve leave requests.
 */
export function canApproveLeave(role: RoleName): boolean {
  return hasPermission(role, 'leave.approve');
}

/**
 * Checks if the user role can adjust/approve attendance corrections.
 */
export function canManageAttendance(role: RoleName): boolean {
  return hasPermission(role, 'attendance.manage');
}

/**
 * Human-readable role labels
 */
export function getRoleBadge(role: RoleName): { label: string; colorClass: string } {
  switch (role) {
    case 'super_admin':
      return { label: 'Super Admin', colorClass: 'bg-[#f7efe0] text-[#8f6927] border-[#ebd8b7] font-semibold' };
    case 'hr_admin':
      return { label: 'HR Admin', colorClass: 'bg-stone-800 text-stone-200 border-stone-700' };
    case 'finance_manager':
      return { label: 'Finance Manager', colorClass: 'bg-amber-950 text-amber-300 border-amber-800' };
    case 'department_manager':
      return { label: 'Dept Manager', colorClass: 'bg-teal-950 text-teal-300 border-teal-800' };
    case 'employee':
    default:
      return { label: 'Employee', colorClass: 'bg-stone-200 text-stone-800 border-stone-300' };
  }
}
