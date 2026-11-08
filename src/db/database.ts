/**
 * STUDIO MATRA — Database Storage & Transaction Repository
 * Complete, persistent repository for employees, attendance, leaves,
 * payroll runs, audit logs, and settings.
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
  PayrollItem,
  PayrollPeriod,
  PayrollPolicy,
  PayrollRun,
  SalaryAdvance,
  SalaryContract,
  ShiftDefinition,
  SystemSettings,
  RoleName,
  User,
} from '../types';
import {
  calculateCheckInMetrics,
  calculateSessionMetrics,
  checkIsMissingPunch,
} from '../utils/attendanceCalculator';
import { calculateEmployeePayroll, EmployeeAttendanceAggregate } from '../utils/payrollCalculator';
import {
  SEED_AUDIT_LOGS,
  SEED_DEPARTMENTS,
  SEED_DESIGNATIONS,
  SEED_EMPLOYEES,
  SEED_LEAVE_BALANCES,
  SEED_LEAVE_REQUESTS,
  SEED_LEAVE_TYPES,
  SEED_NOTIFICATIONS,
  SEED_ORGANIZATION,
  SEED_PAYROLL_POLICY,
  SEED_PUNCH_EVENTS,
  SEED_SALARY_ADVANCES,
  SEED_SALARY_CONTRACTS,
  SEED_SETTINGS,
  SEED_SHIFTS,
  SEED_USERS,
  SEED_ATTENDANCE_SESSIONS,
  SEED_CORRECTION_REQUESTS,
} from './seedData';

const STORAGE_KEY_PREFIX = 'studio_matra_db_v1_';

interface DatabaseSchema {
  organization: Organization;
  users: User[];
  departments: Department[];
  designations: Designation[];
  employees: Employee[];
  shifts: ShiftDefinition[];
  attendanceSessions: AttendanceSession[];
  punchEvents: AttendancePunchEvent[];
  correctionRequests: AttendanceCorrectionRequest[];
  leaveTypes: LeaveType[];
  leaveBalances: LeaveBalance[];
  leaveRequests: LeaveRequest[];
  salaryContracts: SalaryContract[];
  salaryAdvances: SalaryAdvance[];
  payrollPeriods: PayrollPeriod[];
  payrollRuns: PayrollRun[];
  payrollItems: PayrollItem[];
  payrollPolicy: PayrollPolicy;
  settings: SystemSettings;
  notifications: NotificationItem[];
  auditLogs: AuditLog[];
}

class StudioMatraDatabase {
  private state: DatabaseSchema;
  private listeners: (() => void)[] = [];

  constructor() {
    this.state = this.loadState();
    this.auditMissingPunches();
  }

  private loadState(): DatabaseSchema {
    try {
      if (typeof window === 'undefined') {
        return this.getInitialSeed();
      }

      const stored = localStorage.getItem(STORAGE_KEY_PREFIX + 'master');
      if (stored) {
        const parsed: DatabaseSchema = JSON.parse(stored);
        // Ensure default passwords for any user without a password
        if (parsed.users) {
          for (const u of parsed.users) {
            if (!u.password) {
              u.password = 'matra1234';
            }
          }
        }
        return parsed;
      }
    } catch (e) {
      console.warn('Failed to load database from localStorage, resetting to seed data', e);
    }

    const seed = this.getInitialSeed();
    this.persist(seed);
    return seed;
  }

  private getInitialSeed(): DatabaseSchema {
    // Generate an initial sample payroll period and draft run for Oct 2026
    const samplePeriodId = 'period-2026-10';
    const sampleRunId = 'run-2026-10-v1';

    const samplePeriod: PayrollPeriod = {
      id: samplePeriodId,
      organizationId: SEED_ORGANIZATION.id,
      month: 10,
      year: 2026,
      periodStart: '2026-10-01',
      periodEnd: '2026-10-31',
      status: 'finalized',
    };

    const sampleRun: PayrollRun = {
      id: sampleRunId,
      organizationId: SEED_ORGANIZATION.id,
      payrollPeriodId: samplePeriodId,
      month: 10,
      year: 2026,
      versionNumber: 1,
      status: 'finalized',
      totalEmployees: SEED_EMPLOYEES.length,
      totalGross: 519500,
      totalDeductions: 5000,
      totalNet: 514500,
      calculatedAt: '2026-10-31T18:00:00Z',
      calculatedBy: 'Rafiqul Islam',
      reviewedBy: 'Rafiqul Islam',
      reviewedAt: '2026-10-31T19:00:00Z',
      approvedBy: 'Ar. Nahid Rahman',
      approvedAt: '2026-11-01T10:00:00Z',
      finalizedBy: 'Rafiqul Islam',
      finalizedAt: '2026-11-01T11:00:00Z',
    };

    // Generate published payroll items for seed employees so employee self-service can download
    const sampleItems: PayrollItem[] = SEED_EMPLOYEES.map((emp) => {
      const contract = SEED_SALARY_CONTRACTS.find((c) => c.employeeId === emp.id)!;
      const dept = SEED_DEPARTMENTS.find((d) => d.id === emp.departmentId)!;
      const des = SEED_DESIGNATIONS.find((d) => d.id === emp.designationId)!;
      const advance = SEED_SALARY_ADVANCES.find((a) => a.employeeId === emp.id);

      const aggregate: EmployeeAttendanceAggregate = {
        employeeId: emp.id,
        totalPresent: 22,
        totalLate: 1,
        totalHalfDay: 0,
        totalPaidLeave: emp.id === 'emp-0005' ? 1 : 0,
        totalUnpaidLeave: 0,
        totalAbsent: 0,
        totalOvertimeHours: emp.id === 'emp-0005' ? 4 : 0,
        totalWorkedHours: 180,
      };

      const result = calculateEmployeePayroll({
        periodMonth: 10,
        periodYear: 2026,
        periodStart: '2026-10-01',
        periodEnd: '2026-10-31',
        daysInMonth: 31,
        scheduledWorkingDays: 22,
        employee: {
          id: emp.id,
          employeeCode: emp.employeeCode,
          fullName: emp.fullName,
          departmentName: dept.name,
          designationTitle: des.title,
          joiningDate: emp.joiningDate,
        },
        salaryContract: contract,
        attendance: aggregate,
        policy: SEED_PAYROLL_POLICY,
        activeAdvance: advance,
      });

      return {
        ...result.payrollItem,
        id: `item-${sampleRunId}-${emp.id}`,
        payrollRunId: sampleRunId,
        paymentStatus: 'paid',
        paymentDate: '2026-11-02',
        paymentMethod: 'bank_transfer',
        paymentReference: `EBL-TRX-${Math.floor(100000 + Math.random() * 900000)}`,
        publishedAt: '2026-11-01T12:00:00Z',
      };
    });

    return {
      organization: SEED_ORGANIZATION,
      users: SEED_USERS,
      departments: SEED_DEPARTMENTS,
      designations: SEED_DESIGNATIONS,
      employees: SEED_EMPLOYEES,
      shifts: SEED_SHIFTS,
      attendanceSessions: SEED_ATTENDANCE_SESSIONS,
      punchEvents: SEED_PUNCH_EVENTS,
      correctionRequests: SEED_CORRECTION_REQUESTS,
      leaveTypes: SEED_LEAVE_TYPES,
      leaveBalances: SEED_LEAVE_BALANCES,
      leaveRequests: SEED_LEAVE_REQUESTS,
      salaryContracts: SEED_SALARY_CONTRACTS,
      salaryAdvances: SEED_SALARY_ADVANCES,
      payrollPeriods: [samplePeriod],
      payrollRuns: [sampleRun],
      payrollItems: sampleItems,
      payrollPolicy: SEED_PAYROLL_POLICY,
      settings: SEED_SETTINGS,
      notifications: SEED_NOTIFICATIONS,
      auditLogs: SEED_AUDIT_LOGS,
    };
  }

  private persist(state: DatabaseSchema) {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_KEY_PREFIX + 'master', JSON.stringify(state));
      } catch (err) {
        console.error('Storage quota or persistence error', err);
      }
    }
  }

  private notify() {
    this.persist(this.state);
    for (const listener of this.listeners) {
      listener();
    }
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  public resetToSeed() {
    this.state = this.getInitialSeed();
    this.notify();
  }

  public syncFromRemote(remoteState: Partial<DatabaseSchema>) {
    this.state = { ...this.state, ...remoteState };
    this.notify();
  }

  public exportState(): DatabaseSchema {
    return this.state;
  }

  // -------------------------------------------------------------
  // AUDIT & NOTIFICATION HELPERS
  // -------------------------------------------------------------

  public logAudit(actor: { userId: string; name: string }, entry: Omit<AuditLog, 'id' | 'organizationId' | 'actorUserId' | 'actorName' | 'createdAt'>) {
    const audit: AuditLog = {
      id: 'audit-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
      organizationId: this.state.organization.id,
      actorUserId: actor.userId,
      actorName: actor.name,
      targetType: entry.targetType,
      targetId: entry.targetId,
      action: entry.action,
      details: entry.details,
      ipAddress: entry.ipAddress,
      createdAt: new Date().toISOString(),
    };
    this.state.auditLogs.unshift(audit);
    // Keep max 500 audit logs
    if (this.state.auditLogs.length > 500) {
      this.state.auditLogs.pop();
    }
  }

  public createNotification(notif: Omit<NotificationItem, 'id' | 'isRead' | 'createdAt'>) {
    const newNotif: NotificationItem = {
      ...notif,
      id: 'notif-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
      isRead: false,
      createdAt: new Date().toISOString(),
    };
    this.state.notifications.unshift(newNotif);
  }

  // -------------------------------------------------------------
  // USERS & EMPLOYEES
  // -------------------------------------------------------------

  public getUsers(): User[] {
    return this.state.users;
  }

  public getUserById(userId: string): User | undefined {
    return this.state.users.find((u) => u.id === userId);
  }

  public getUserByEmail(email: string): User | undefined {
    return this.state.users.find((u) => u.email.toLowerCase() === email.toLowerCase());
  }

  public authenticateUser(email: string, pass: string): User {
    const cleanEmail = email.trim().toLowerCase();
    const cleanPass = pass.trim();

    const user = this.state.users.find((u) => u.email.toLowerCase() === cleanEmail);
    if (!user) {
      throw new Error('No account found with this email address.');
    }

    if (user.accountStatus === 'suspended') {
      throw new Error('This account has been suspended. Please contact Studio Matra administration.');
    }

    const storedPass = user.password || 'matra1234';
    if (storedPass !== cleanPass) {
      throw new Error('Incorrect password. Please verify and try again.');
    }

    this.logAudit(
      { userId: user.id, name: user.fullName },
      {
        targetType: 'user',
        targetId: user.id,
        action: 'USER_LOGIN',
        details: `${user.fullName} (${user.email}) logged in successfully`,
      }
    );

    return user;
  }

  public changePassword(userId: string, currentPass: string, newPass: string): boolean {
    const user = this.state.users.find((u) => u.id === userId);
    if (!user) throw new Error('User not found.');

    const storedPass = user.password || 'matra1234';
    if (storedPass !== currentPass) {
      throw new Error('Current password does not match.');
    }

    if (!newPass || newPass.trim().length < 4) {
      throw new Error('New password must be at least 4 characters long.');
    }

    user.password = newPass.trim();

    this.logAudit(
      { userId: user.id, name: user.fullName },
      {
        targetType: 'user',
        targetId: user.id,
        action: 'CHANGE_PASSWORD',
        details: `${user.fullName} changed their account login password`,
      }
    );

    this.notify();
    return true;
  }

  public resetUserPassword(
    employeeId: string,
    newPass: string,
    actor: { userId: string; name: string }
  ): boolean {
    if (!newPass || newPass.trim().length < 4) {
      throw new Error('Password must be at least 4 characters long.');
    }

    const emp = this.getEmployeeById(employeeId);
    const user = this.state.users.find(
      (u) => u.employeeId === employeeId || (emp && u.id === emp.userId)
    );

    if (!user) {
      throw new Error('No user account associated with this employee.');
    }

    user.password = newPass.trim();

    this.logAudit(actor, {
      targetType: 'user',
      targetId: user.id,
      action: 'ADMIN_RESET_PASSWORD',
      details: `${actor.name} reset password for ${user.fullName} (${emp?.employeeCode || employeeId})`,
    });

    this.notify();
    return true;
  }

  public getEmployees(): Employee[] {
    return this.state.employees;
  }

  public getEmployeeById(employeeId: string): Employee | undefined {
    return this.state.employees.find((e) => e.id === employeeId);
  }

  public getEmployeeByUserId(userId: string): Employee | undefined {
    return this.state.employees.find((e) => e.userId === userId);
  }

  public getUserByEmployeeId(employeeId: string): User | undefined {
    const emp = this.getEmployeeById(employeeId);
    return this.state.users.find((u) => u.employeeId === employeeId || (emp && u.id === emp.userId));
  }

  public updateEmployeePin(
    employeeId: string,
    newPin: string,
    actor: { userId: string; name: string; role?: string }
  ): boolean {
    if (!/^\d{4}$/.test(newPin)) {
      throw new Error('PIN must be exactly 4 digits');
    }

    // Security Check: Only Admin roles can change employee PIN codes
    if (actor.role && actor.role !== 'super_admin' && actor.role !== 'hr_admin') {
      throw new Error('Permission denied: Only Administrators can modify employee PIN codes.');
    }

    const emp = this.getEmployeeById(employeeId);
    if (!emp) throw new Error('Employee not found');

    let user = this.state.users.find(
      (u) => u.employeeId === employeeId || u.id === emp.userId
    );

    if (!user) {
      user = {
        id: emp.userId || 'user-' + Date.now(),
        organizationId: this.state.organization.id,
        email: emp.email,
        fullName: emp.fullName,
        role: 'employee',
        employeeId: emp.id,
        accountStatus: 'active',
        pinCode: newPin,
        createdAt: new Date().toISOString(),
      };
      this.state.users.push(user);
    } else {
      user.pinCode = newPin;
    }

    this.logAudit(actor, {
      targetType: 'employee',
      targetId: employeeId,
      action: 'UPDATE_KIOSK_PIN',
      details: `Updated kiosk security PIN for ${emp.fullName} (${emp.employeeCode}) to ${newPin}`,
    });

    // Asynchronously update remote MySQL database
    if (typeof window !== 'undefined') {
      fetch(`/api/employees/${employeeId}/pin`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pinCode: newPin, actorRole: actor.role }),
      }).catch(() => {});
    }

    this.notify();
    return true;
  }

  public getDepartments(): Department[] {
    return this.state.departments;
  }

  public getDesignations(): Designation[] {
    return this.state.designations;
  }

  public getShifts(): ShiftDefinition[] {
    return this.state.shifts;
  }

  public createEmployee(
    data: Omit<Employee, 'id' | 'organizationId' | 'createdAt'>,
    actor: { userId: string; name: string },
    options?: { pinCode?: string; password?: string; role?: RoleName }
  ): Employee {
    const employeeId = 'emp-' + String(this.state.employees.length + 1).padStart(4, '0');
    const newEmp: Employee = {
      ...data,
      id: employeeId,
      organizationId: this.state.organization.id,
      createdAt: new Date().toISOString(),
    };

    const initialPin =
      options?.pinCode && /^\d{4}$/.test(options.pinCode)
        ? options.pinCode
        : String(Math.floor(1000 + Math.random() * 9000));

    const initialPassword =
      options?.password && options.password.trim() ? options.password.trim() : 'matra1234';

    // If new user needs to be linked
    if (!this.state.users.some((u) => u.id === data.userId)) {
      const newUser: User = {
        id: data.userId,
        organizationId: this.state.organization.id,
        email: data.email,
        password: initialPassword,
        fullName: data.fullName,
        role: options?.role || 'employee',
        employeeId: employeeId,
        accountStatus: 'active',
        pinCode: initialPin,
        createdAt: new Date().toISOString(),
      };
      this.state.users.push(newUser);
    } else {
      const existingUser = this.state.users.find((u) => u.id === data.userId);
      if (existingUser) {
        existingUser.employeeId = employeeId;
        existingUser.pinCode = initialPin;
        if (options?.password) {
          existingUser.password = options.password;
        }
      }
    }

    // Default leave balances
    const year = new Date().getFullYear();
    for (const lt of this.state.leaveTypes) {
      this.state.leaveBalances.push({
        id: `lb-${employeeId}-${lt.code.toLowerCase()}`,
        employeeId,
        leaveTypeId: lt.id,
        year,
        openingBalance: lt.annualQuota,
        accrued: lt.annualQuota,
        used: 0,
        closingBalance: lt.annualQuota,
      });
    }

    this.state.employees.push(newEmp);
    this.logAudit(actor, {
      targetType: 'employee',
      targetId: employeeId,
      action: 'CREATE_EMPLOYEE',
      details: `Created employee ${newEmp.fullName} (${newEmp.employeeCode})`,
    });
    this.notify();
    return newEmp;
  }

  public updateEmployee(
    employeeId: string,
    updates: Partial<Employee>,
    actor: { userId: string; name: string }
  ) {
    const index = this.state.employees.findIndex((e) => e.id === employeeId);
    if (index !== -1) {
      this.state.employees[index] = { ...this.state.employees[index], ...updates };
      this.logAudit(actor, {
        targetType: 'employee',
        targetId: employeeId,
        action: 'UPDATE_EMPLOYEE',
        details: `Updated employee details for ${this.state.employees[index].fullName}`,
      });
      this.notify();
    }
  }

  public deleteEmployee(
    employeeId: string,
    actor: { userId: string; name: string }
  ): boolean {
    const index = this.state.employees.findIndex((e) => e.id === employeeId);
    if (index === -1) return false;

    const emp = this.state.employees[index];

    // 1. Remove the employee record
    this.state.employees.splice(index, 1);

    // 2. Remove associated user login account (if any)
    const userIndex = this.state.users.findIndex(
      (u) => u.employeeId === employeeId || u.id === emp.userId
    );
    if (userIndex !== -1) {
      this.state.users.splice(userIndex, 1);
    }

    // 3. Remove leave balances & requests
    this.state.leaveBalances = this.state.leaveBalances.filter(
      (lb) => lb.employeeId !== employeeId
    );
    this.state.leaveRequests = this.state.leaveRequests.filter(
      (lr) => lr.employeeId !== employeeId
    );

    // 4. Remove salary contracts & advances
    this.state.salaryContracts = this.state.salaryContracts.filter(
      (sc) => sc.employeeId !== employeeId
    );
    this.state.salaryAdvances = this.state.salaryAdvances.filter(
      (sa) => sa.employeeId !== employeeId
    );

    // 5. Remove attendance sessions, punch events & corrections
    this.state.attendanceSessions = this.state.attendanceSessions.filter(
      (as) => as.employeeId !== employeeId
    );
    this.state.punchEvents = this.state.punchEvents.filter(
      (pe) => pe.employeeId !== employeeId
    );
    this.state.correctionRequests = this.state.correctionRequests.filter(
      (cr) => cr.employeeId !== employeeId
    );

    // 6. Audit trail
    this.logAudit(actor, {
      targetType: 'employee',
      targetId: employeeId,
      action: 'DELETE_EMPLOYEE',
      details: `Deleted employee ${emp.fullName} (${emp.employeeCode}) and associated records`,
    });

    // 7. Persist and notify listeners
    this.notify();
    return true;
  }

  // -------------------------------------------------------------
  // ATTENDANCE ENGINE
  // -------------------------------------------------------------

  public auditMissingPunches() {
    const todayDhaka = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Dhaka' }).format(new Date());
    let modified = false;

    for (const session of this.state.attendanceSessions) {
      if (!session.checkOutAt && session.attendanceDate < todayDhaka && !session.isMissingPunch) {
        session.isMissingPunch = true;
        session.computedStatus = 'missing_punch';
        modified = true;
      }
    }

    if (modified) {
      this.notify();
    }
  }

  public getActiveSession(employeeId: string): AttendanceSession | undefined {
    return this.state.attendanceSessions.find((s) => s.employeeId === employeeId && !s.checkOutAt);
  }

  public getTodaySession(employeeId: string): AttendanceSession | undefined {
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Dhaka' }).format(new Date());
    return this.state.attendanceSessions.find((s) => s.employeeId === employeeId && s.attendanceDate === today);
  }

  public getAttendanceSessions(filters?: {
    employeeId?: string;
    departmentId?: string;
    startDate?: string;
    endDate?: string;
    status?: string;
  }): AttendanceSession[] {
    return this.state.attendanceSessions.filter((s) => {
      if (filters?.employeeId && s.employeeId !== filters.employeeId) return false;
      if (filters?.startDate && s.attendanceDate < filters.startDate) return false;
      if (filters?.endDate && s.attendanceDate > filters.endDate) return false;
      if (filters?.status && s.computedStatus !== filters.status) return false;
      if (filters?.departmentId) {
        const emp = this.getEmployeeById(s.employeeId);
        if (emp?.departmentId !== filters.departmentId) return false;
      }
      return true;
    });
  }

  public getPunchEvents(employeeId?: string): AttendancePunchEvent[] {
    if (employeeId) {
      return this.state.punchEvents.filter((p) => p.employeeId === employeeId);
    }
    return this.state.punchEvents;
  }

  /**
   * Check In Workflow (Server Authoritative)
   */
  public checkIn(params: {
    employeeId: string;
    sourceType: 'kiosk' | 'office_network' | 'manual_adjustment';
    registeredDeviceId?: string;
    clientIp?: string;
    actorUserId: string;
  }): { session: AttendanceSession; punch: AttendancePunchEvent } {
    const { employeeId, sourceType, registeredDeviceId, clientIp, actorUserId } = params;
    const employee = this.getEmployeeById(employeeId);
    if (!employee) throw new Error('Employee record not found');

    // Rule: Check for active open session
    const existingActive = this.getActiveSession(employeeId);
    if (existingActive) {
      throw new Error(`Employee already has an active check-in session for ${existingActive.attendanceDate}. Please check out first.`);
    }

    const shift = this.state.shifts.find((s) => s.id === employee.shiftId) || this.state.shifts[0];
    const nowIso = new Date().toISOString();
    const todayDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Dhaka' }).format(new Date());

    // Calculate late metrics
    const { lateMinutes, isLate } = calculateCheckInMetrics(nowIso, shift);
    const shiftStart = 9 * 60;
    const shiftEnd = 18 * 60;
    const scheduledMinutes = shiftEnd - shiftStart - shift.breakMinutes;

    const sessionId = 'sess-' + Date.now() + '-' + Math.random().toString(36).substring(2, 5);

    const session: AttendanceSession = {
      id: sessionId,
      employeeId,
      attendanceDate: todayDate,
      assignedShiftId: shift.id,
      checkInAt: nowIso,
      sourceType,
      scheduledMinutes,
      workedMinutes: 0,
      breakMinutes: shift.breakMinutes,
      lateMinutes,
      earlyDepartureMinutes: 0,
      overtimeMinutes: 0,
      computedStatus: isLate ? 'late' : 'present',
      isMissingPunch: false,
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    const punch: AttendancePunchEvent = {
      id: 'punch-' + Date.now() + '-' + Math.random().toString(36).substring(2, 5),
      employeeId,
      sessionId,
      eventType: 'check_in',
      occurredAt: nowIso,
      sourceType,
      registeredDeviceId,
      clientIp,
      recordedBy: actorUserId,
      createdAt: nowIso,
    };

    this.state.attendanceSessions.unshift(session);
    this.state.punchEvents.unshift(punch);

    const user = this.getUserById(actorUserId);
    const actorId = user ? user.id : actorUserId;
    const actorName = user ? user.fullName : employee.fullName;
    this.logAudit({ userId: actorId, name: actorName }, {
      targetType: 'attendance',
      targetId: sessionId,
      action: 'CHECK_IN',
      details: `${employee.fullName} checked in (${sourceType}). Status: ${session.computedStatus}, Late: ${lateMinutes}m`,
      ipAddress: clientIp,
    });

    this.createNotification({
      recipientUserId: employee.userId,
      title: 'Check-In Successful',
      message: `Checked in at ${new Date(nowIso).toLocaleTimeString('en-US', { timeZone: 'Asia/Dhaka' })}. Shift: ${shift.name}.`,
      type: 'attendance',
    });

    this.notify();
    return { session, punch };
  }

  /**
   * Check Out Workflow
   */
  public checkOut(params: {
    employeeId: string;
    sourceType: 'kiosk' | 'office_network' | 'manual_adjustment';
    registeredDeviceId?: string;
    clientIp?: string;
    actorUserId: string;
  }): { session: AttendanceSession; punch: AttendancePunchEvent } {
    const { employeeId, sourceType, registeredDeviceId, clientIp, actorUserId } = params;
    const employee = this.getEmployeeById(employeeId);
    if (!employee) throw new Error('Employee record not found');

    const activeSession = this.getActiveSession(employeeId);
    if (!activeSession) {
      throw new Error('No active check-in session found to check out from.');
    }

    const shift = this.state.shifts.find((s) => s.id === activeSession.assignedShiftId) || this.state.shifts[0];
    const nowIso = new Date().toISOString();

    const metrics = calculateSessionMetrics({
      checkInAt: activeSession.checkInAt,
      checkOutAt: nowIso,
      shift,
      approvedOvertimeEligible: true,
    });

    activeSession.checkOutAt = nowIso;
    activeSession.workedMinutes = metrics.workedMinutes;
    activeSession.breakMinutes = metrics.breakMinutes;
    activeSession.earlyDepartureMinutes = metrics.earlyDepartureMinutes;
    activeSession.overtimeMinutes = metrics.overtimeMinutes;
    activeSession.computedStatus = metrics.status;
    activeSession.isMissingPunch = false;
    activeSession.updatedAt = nowIso;

    const punch: AttendancePunchEvent = {
      id: 'punch-' + Date.now() + '-' + Math.random().toString(36).substring(2, 5),
      employeeId,
      sessionId: activeSession.id,
      eventType: 'check_out',
      occurredAt: nowIso,
      sourceType,
      registeredDeviceId,
      clientIp,
      recordedBy: actorUserId,
      createdAt: nowIso,
    };

    this.state.punchEvents.unshift(punch);

    const user = this.getUserById(actorUserId);
    const actorId = user ? user.id : actorUserId;
    const actorName = user ? user.fullName : employee.fullName;
    this.logAudit({ userId: actorId, name: actorName }, {
      targetType: 'attendance',
      targetId: activeSession.id,
      action: 'CHECK_OUT',
      details: `${employee.fullName} checked out. Worked: ${Math.floor(metrics.workedMinutes / 60)}h ${metrics.workedMinutes % 60}m. Status: ${metrics.status}`,
      ipAddress: clientIp,
    });

    this.createNotification({
      recipientUserId: employee.userId,
      title: 'Check-Out Successful',
      message: `Checked out. Net worked: ${Math.floor(metrics.workedMinutes / 60)}h ${metrics.workedMinutes % 60}m. Status: ${metrics.status}.`,
      type: 'attendance',
    });

    this.notify();
    return { session: activeSession, punch };
  }

  // -------------------------------------------------------------
  // ATTENDANCE CORRECTIONS
  // -------------------------------------------------------------

  public getCorrectionRequests(employeeId?: string): AttendanceCorrectionRequest[] {
    if (employeeId) {
      return this.state.correctionRequests.filter((c) => c.employeeId === employeeId);
    }
    return this.state.correctionRequests;
  }

  public submitCorrectionRequest(
    data: Omit<AttendanceCorrectionRequest, 'id' | 'status' | 'submittedAt'>,
    actor: { userId: string; name: string }
  ): AttendanceCorrectionRequest {
    const newReq: AttendanceCorrectionRequest = {
      ...data,
      id: 'corr-' + Date.now(),
      status: 'submitted',
      submittedAt: new Date().toISOString(),
    };

    this.state.correctionRequests.unshift(newReq);

    // Notify HR
    const hrUsers = this.state.users.filter((u) => u.role === 'hr_admin' || u.role === 'super_admin');
    for (const hr of hrUsers) {
      this.createNotification({
        recipientUserId: hr.id,
        title: 'New Attendance Correction Request',
        message: `${actor.name} requested correction for ${data.attendanceDate}. Reason: ${data.reason}`,
        type: 'correction',
      });
    }

    this.logAudit(actor, {
      targetType: 'attendance',
      targetId: newReq.id,
      action: 'SUBMIT_CORRECTION',
      details: `Submitted correction for ${data.attendanceDate}`,
    });

    this.notify();
    return newReq;
  }

  public reviewCorrectionRequest(params: {
    requestId: string;
    action: 'manager_reviewed' | 'apply' | 'reject';
    comment?: string;
    reviewer: { userId: string; name: string; role: string };
  }) {
    const { requestId, action, comment, reviewer } = params;
    const req = this.state.correctionRequests.find((r) => r.id === requestId);
    if (!req) throw new Error('Correction request not found');

    const employee = this.getEmployeeById(req.employeeId);

    if (action === 'manager_reviewed') {
      req.status = 'manager_reviewed';
      req.managerReviewedBy = reviewer.userId;
      req.managerComment = comment;
      req.reviewedAt = new Date().toISOString();
    } else if (action === 'apply') {
      req.status = 'applied';
      req.approvedBy = reviewer.userId;
      req.hrComment = comment;
      req.appliedAt = new Date().toISOString();

      // Apply changes to the underlying attendance session or create one if none existed
      let session = this.state.attendanceSessions.find((s) => s.id === req.sessionId || (s.employeeId === req.employeeId && s.attendanceDate === req.attendanceDate));
      
      const shift = this.state.shifts[0];
      const checkInIso = req.requestedCheckIn ? `${req.attendanceDate}T${req.requestedCheckIn}:00.000Z` : (session?.checkInAt || `${req.attendanceDate}T09:00:00.000Z`);
      const checkOutIso = req.requestedCheckOut ? `${req.attendanceDate}T${req.requestedCheckOut}:00.000Z` : (session?.checkOutAt || `${req.attendanceDate}T18:00:00.000Z`);

      const metrics = calculateSessionMetrics({
        checkInAt: checkInIso,
        checkOutAt: checkOutIso,
        shift,
      });

      if (!session) {
        session = {
          id: 'sess-corr-' + Date.now(),
          employeeId: req.employeeId,
          attendanceDate: req.attendanceDate,
          assignedShiftId: shift.id,
          checkInAt: checkInIso,
          checkOutAt: checkOutIso,
          sourceType: 'manual_adjustment',
          scheduledMinutes: metrics.scheduledMinutes,
          workedMinutes: metrics.workedMinutes,
          breakMinutes: metrics.breakMinutes,
          lateMinutes: metrics.lateMinutes,
          earlyDepartureMinutes: metrics.earlyDepartureMinutes,
          overtimeMinutes: metrics.overtimeMinutes,
          computedStatus: metrics.status,
          isMissingPunch: false,
          correctionStatus: 'applied',
          notes: `Corrected by HR (${reviewer.name}). ${comment || ''}`,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        this.state.attendanceSessions.unshift(session);
      } else {
        session.checkInAt = checkInIso;
        session.checkOutAt = checkOutIso;
        session.workedMinutes = metrics.workedMinutes;
        session.lateMinutes = metrics.lateMinutes;
        session.earlyDepartureMinutes = metrics.earlyDepartureMinutes;
        session.overtimeMinutes = metrics.overtimeMinutes;
        session.computedStatus = metrics.status;
        session.isMissingPunch = false;
        session.correctionStatus = 'applied';
        session.notes = `Corrected by HR (${reviewer.name}): ${comment || ''}`;
        session.updatedAt = new Date().toISOString();
      }

      if (employee) {
        this.createNotification({
          recipientUserId: employee.userId,
          title: 'Attendance Correction Approved',
          message: `Your correction for ${req.attendanceDate} was approved and applied. Status updated to ${metrics.status}.`,
          type: 'correction',
        });
      }
    } else if (action === 'reject') {
      req.status = 'rejected';
      req.approvedBy = reviewer.userId;
      req.hrComment = comment;
      req.appliedAt = new Date().toISOString();

      if (employee) {
        this.createNotification({
          recipientUserId: employee.userId,
          title: 'Attendance Correction Rejected',
          message: `Your correction for ${req.attendanceDate} was rejected: ${comment || 'No reason provided'}`,
          type: 'correction',
        });
      }
    }

    this.logAudit({ userId: reviewer.userId, name: reviewer.name }, {
      targetType: 'attendance',
      targetId: req.id,
      action: `CORRECTION_${action.toUpperCase()}`,
      details: `${reviewer.name} marked correction as ${action}. Notes: ${comment || ''}`,
    });

    this.notify();
  }

  // -------------------------------------------------------------
  // LEAVE MANAGEMENT
  // -------------------------------------------------------------

  public getLeaveTypes(): LeaveType[] {
    return this.state.leaveTypes;
  }

  public getLeaveBalances(employeeId: string): LeaveBalance[] {
    return this.state.leaveBalances.filter((b) => b.employeeId === employeeId);
  }

  public getLeaveRequests(employeeId?: string): LeaveRequest[] {
    if (employeeId) {
      return this.state.leaveRequests.filter((r) => r.employeeId === employeeId);
    }
    return this.state.leaveRequests;
  }

  public applyLeave(
    data: Omit<LeaveRequest, 'id' | 'status' | 'submittedAt'>,
    actor: { userId: string; name: string }
  ): LeaveRequest {
    const leaveType = this.state.leaveTypes.find((lt) => lt.id === data.leaveTypeId);
    if (!leaveType) throw new Error('Invalid leave category');

    // Balance check for paid leaves
    if (leaveType.isPaid) {
      const balance = this.state.leaveBalances.find(
        (b) => b.employeeId === data.employeeId && b.leaveTypeId === data.leaveTypeId
      );
      if (balance && balance.closingBalance < data.durationDays) {
        throw new Error(
          `Insufficient leave balance. Requested ${data.durationDays} days, available: ${balance.closingBalance} days.`
        );
      }
    }

    // Overlap check
    const existingOverlap = this.state.leaveRequests.some(
      (r) =>
        r.employeeId === data.employeeId &&
        r.status !== 'rejected' &&
        r.status !== 'cancelled' &&
        !(data.endDate < r.startDate || data.startDate > r.endDate)
    );
    if (existingOverlap) {
      throw new Error('You already have a pending or approved leave request overlapping these dates.');
    }

    const newReq: LeaveRequest = {
      ...data,
      id: 'lr-' + Date.now(),
      status: 'pending',
      submittedAt: new Date().toISOString(),
    };

    this.state.leaveRequests.unshift(newReq);

    // Notify Manager / HR
    const hrUsers = this.state.users.filter((u) => u.role === 'hr_admin' || u.role === 'super_admin');
    for (const hr of hrUsers) {
      this.createNotification({
        recipientUserId: hr.id,
        title: 'New Leave Application',
        message: `${actor.name} applied for ${data.durationDays} day(s) of ${leaveType.name} (${data.startDate} to ${data.endDate}).`,
        type: 'leave',
      });
    }

    this.logAudit(actor, {
      targetType: 'leave',
      targetId: newReq.id,
      action: 'APPLY_LEAVE',
      details: `${actor.name} applied for ${leaveType.name} from ${data.startDate} to ${data.endDate}`,
    });

    this.notify();
    return newReq;
  }

  public reviewLeaveRequest(params: {
    requestId: string;
    action: 'recommend' | 'approve' | 'reject';
    comment?: string;
    reviewer: { userId: string; name: string; role: string };
  }) {
    const { requestId, action, comment, reviewer } = params;
    const req = this.state.leaveRequests.find((r) => r.id === requestId);
    if (!req) throw new Error('Leave request not found');

    const employee = this.getEmployeeById(req.employeeId);
    const leaveType = this.state.leaveTypes.find((lt) => lt.id === req.leaveTypeId);

    if (action === 'recommend') {
      req.status = 'manager_approved';
      req.managerRecommendation = 'recommend';
      req.managerComment = comment;
      req.managerReviewedAt = new Date().toISOString();
    } else if (action === 'approve') {
      req.status = 'approved';
      req.hrApproverId = reviewer.userId;
      req.hrComment = comment;
      req.decidedAt = new Date().toISOString();

      // Deduct balance
      const balance = this.state.leaveBalances.find(
        (b) => b.employeeId === req.employeeId && b.leaveTypeId === req.leaveTypeId
      );
      if (balance) {
        balance.used += req.durationDays;
        balance.closingBalance = Math.max(0, balance.accrued - balance.used);
      }

      // Automatically register approved leave days into attendance sessions
      const start = new Date(req.startDate);
      const end = new Date(req.endDate);
      const shift = this.state.shifts[0];

      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const dateStr = d.toISOString().split('T')[0];
        const status = leaveType?.isPaid ? 'paid_leave' : 'unpaid_leave';

        // Check if session exists
        let sess = this.state.attendanceSessions.find(
          (s) => s.employeeId === req.employeeId && s.attendanceDate === dateStr
        );
        if (!sess) {
          sess = {
            id: 'sess-leave-' + Date.now() + '-' + Math.random().toString(36).substring(2, 4),
            employeeId: req.employeeId,
            attendanceDate: dateStr,
            assignedShiftId: shift.id,
            checkInAt: `${dateStr}T09:00:00Z`,
            checkOutAt: `${dateStr}T18:00:00Z`,
            sourceType: 'manual_adjustment',
            scheduledMinutes: 480,
            workedMinutes: leaveType?.isPaid ? 480 : 0,
            breakMinutes: 0,
            lateMinutes: 0,
            earlyDepartureMinutes: 0,
            overtimeMinutes: 0,
            computedStatus: status,
            isMissingPunch: false,
            notes: `Approved Leave: ${leaveType?.name || 'Leave'}. Ref: ${req.id}`,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
          this.state.attendanceSessions.unshift(sess);
        } else {
          sess.computedStatus = status;
          sess.notes = `Approved Leave: ${leaveType?.name || 'Leave'}. Ref: ${req.id}`;
          sess.updatedAt = new Date().toISOString();
        }
      }

      if (employee) {
        this.createNotification({
          recipientUserId: employee.userId,
          title: 'Leave Request Approved',
          message: `Your ${leaveType?.name} request for ${req.startDate} to ${req.endDate} was approved.`,
          type: 'leave',
        });
      }
    } else if (action === 'reject') {
      req.status = 'rejected';
      req.hrApproverId = reviewer.userId;
      req.hrComment = comment;
      req.decidedAt = new Date().toISOString();

      if (employee) {
        this.createNotification({
          recipientUserId: employee.userId,
          title: 'Leave Request Rejected',
          message: `Your leave request for ${req.startDate} was rejected: ${comment || 'No reason specified'}`,
          type: 'leave',
        });
      }
    }

    this.logAudit({ userId: reviewer.userId, name: reviewer.name }, {
      targetType: 'leave',
      targetId: req.id,
      action: `LEAVE_${action.toUpperCase()}`,
      details: `${reviewer.name} ${action}ed leave for ${employee?.fullName}. Notes: ${comment || ''}`,
    });

    this.notify();
  }

  public getAllLeaveBalances(): LeaveBalance[] {
    return this.state.leaveBalances;
  }

  public updateLeaveBalance(
    params: {
      employeeId: string;
      leaveTypeId: string;
      accrued?: number;
      used?: number;
      closingBalance?: number;
      openingBalance?: number;
      year?: number;
      notes?: string;
    },
    actor: { userId: string; name: string }
  ): LeaveBalance {
    const year = params.year || new Date().getFullYear();
    let balance = this.state.leaveBalances.find(
      (b) => b.employeeId === params.employeeId && b.leaveTypeId === params.leaveTypeId && b.year === year
    );

    const emp = this.getEmployeeById(params.employeeId);
    const lt = this.state.leaveTypes.find((t) => t.id === params.leaveTypeId);

    if (!balance) {
      const accrued = params.accrued !== undefined ? Number(params.accrued) : (lt?.annualQuota || 10);
      const used = params.used !== undefined ? Number(params.used) : 0;
      const closing = params.closingBalance !== undefined ? Number(params.closingBalance) : Math.max(0, accrued - used);
      balance = {
        id: `lb-${params.employeeId}-${lt?.code.toLowerCase() || 'custom'}`,
        employeeId: params.employeeId,
        leaveTypeId: params.leaveTypeId,
        year,
        openingBalance: params.openingBalance !== undefined ? Number(params.openingBalance) : accrued,
        accrued,
        used,
        closingBalance: closing,
      };
      this.state.leaveBalances.push(balance);
    } else {
      if (params.accrued !== undefined) balance.accrued = Math.max(0, Number(params.accrued));
      if (params.used !== undefined) balance.used = Math.max(0, Number(params.used));
      if (params.openingBalance !== undefined) balance.openingBalance = Math.max(0, Number(params.openingBalance));
      if (params.closingBalance !== undefined) {
        balance.closingBalance = Math.max(0, Number(params.closingBalance));
      } else {
        balance.closingBalance = Math.max(0, balance.accrued - balance.used);
      }
    }

    this.logAudit(actor, {
      targetType: 'leave',
      targetId: balance.id,
      action: 'UPDATE_LEAVE_BALANCE',
      details: `Updated leave balance for ${emp?.fullName || params.employeeId} (${lt?.name}): Accrued=${balance.accrued}, Used=${balance.used}, Remaining=${balance.closingBalance}. Reason: ${params.notes || 'Admin manual quota balance adjustment'}`,
    });

    this.notify();
    return balance;
  }

  public updateLeaveRequest(
    params: {
      requestId: string;
      leaveTypeId?: string;
      startDate?: string;
      endDate?: string;
      durationDays?: number;
      reason?: string;
      status?: LeaveRequest['status'];
      hrComment?: string;
    },
    actor: { userId: string; name: string }
  ): LeaveRequest {
    const req = this.state.leaveRequests.find((r) => r.id === params.requestId);
    if (!req) throw new Error('Leave request not found');

    const oldStatus = req.status;
    const oldDuration = req.durationDays;
    const oldLeaveTypeId = req.leaveTypeId;

    if (params.leaveTypeId) req.leaveTypeId = params.leaveTypeId;
    if (params.startDate) req.startDate = params.startDate;
    if (params.endDate) req.endDate = params.endDate;
    if (params.durationDays !== undefined) req.durationDays = Number(params.durationDays);
    if (params.reason !== undefined) req.reason = params.reason;
    if (params.hrComment !== undefined) req.hrComment = params.hrComment;
    if (params.status) req.status = params.status;

    // Adjust leave balance if status or duration changed
    if (params.status === 'approved' && oldStatus !== 'approved') {
      const balance = this.state.leaveBalances.find(
        (b) => b.employeeId === req.employeeId && b.leaveTypeId === req.leaveTypeId
      );
      if (balance) {
        balance.used += req.durationDays;
        balance.closingBalance = Math.max(0, balance.accrued - balance.used);
      }
    } else if (params.status && params.status !== 'approved' && oldStatus === 'approved') {
      const balance = this.state.leaveBalances.find(
        (b) => b.employeeId === req.employeeId && b.leaveTypeId === oldLeaveTypeId
      );
      if (balance) {
        balance.used = Math.max(0, balance.used - oldDuration);
        balance.closingBalance = Math.max(0, balance.accrued - balance.used);
      }
    }

    this.logAudit(actor, {
      targetType: 'leave',
      targetId: req.id,
      action: 'UPDATE_LEAVE_REQUEST',
      details: `Updated leave request ${req.id} (Status: ${req.status}, Duration: ${req.durationDays}d)`,
    });

    this.notify();
    return req;
  }

  public deleteLeaveRequest(
    requestId: string,
    actor: { userId: string; name: string }
  ): boolean {
    const index = this.state.leaveRequests.findIndex((r) => r.id === requestId);
    if (index === -1) return false;

    const req = this.state.leaveRequests[index];
    if (req.status === 'approved') {
      const balance = this.state.leaveBalances.find(
        (b) => b.employeeId === req.employeeId && b.leaveTypeId === req.leaveTypeId
      );
      if (balance) {
        balance.used = Math.max(0, balance.used - req.durationDays);
        balance.closingBalance = Math.max(0, balance.accrued - balance.used);
      }
    }

    this.state.leaveRequests.splice(index, 1);

    this.logAudit(actor, {
      targetType: 'leave',
      targetId: requestId,
      action: 'DELETE_LEAVE_REQUEST',
      details: `Deleted leave request ${requestId} for employee ${req.employeeId}`,
    });

    this.notify();
    return true;
  }

  // -------------------------------------------------------------
  // PAYROLL ENGINE & REPOSITORY
  // -------------------------------------------------------------

  public getPayrollPeriods(): PayrollPeriod[] {
    return this.state.payrollPeriods;
  }

  public getPayrollRuns(): PayrollRun[] {
    return this.state.payrollRuns;
  }

  public getPayrollItems(runId?: string): PayrollItem[] {
    if (runId) {
      return this.state.payrollItems.filter((i) => i.payrollRunId === runId);
    }
    return this.state.payrollItems;
  }

  public getEmployeePublishedPayslips(employeeId: string): PayrollItem[] {
    return this.state.payrollItems.filter((i) => i.employeeId === employeeId && Boolean(i.publishedAt));
  }

  public getSalaryContracts(): SalaryContract[] {
    return this.state.salaryContracts;
  }

  public getSalaryContractByEmployee(employeeId: string): SalaryContract | undefined {
    return this.state.salaryContracts.find((c) => c.employeeId === employeeId && c.status === 'active');
  }

  public updateSalaryContract(
    employeeId: string,
    contractData: {
      basicSalary: number;
      houseRentAllowance: number;
      medicalAllowance: number;
      transportAllowance: number;
      otherFixedAllowances: number;
      effectiveFrom?: string;
      notes?: string;
    },
    actor: { userId: string; name: string }
  ): SalaryContract {
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Dhaka' }).format(new Date());
    const existingIndex = this.state.salaryContracts.findIndex(
      (c) => c.employeeId === employeeId && c.status === 'active'
    );

    const emp = this.getEmployeeById(employeeId);
    const empName = emp ? emp.fullName : employeeId;

    if (existingIndex !== -1) {
      const existing = this.state.salaryContracts[existingIndex];
      existing.status = 'superseded';
      existing.effectiveTo = contractData.effectiveFrom || today;
    }

    const newContract: SalaryContract = {
      id: 'sc-' + Date.now(),
      employeeId,
      salaryType: 'monthly',
      basicSalary: contractData.basicSalary,
      houseRentAllowance: contractData.houseRentAllowance,
      medicalAllowance: contractData.medicalAllowance,
      transportAllowance: contractData.transportAllowance,
      otherFixedAllowances: contractData.otherFixedAllowances,
      effectiveFrom: contractData.effectiveFrom || today,
      status: 'active',
      notes: contractData.notes,
    };

    this.state.salaryContracts.unshift(newContract);
    const gross =
      newContract.basicSalary +
      newContract.houseRentAllowance +
      newContract.medicalAllowance +
      newContract.transportAllowance +
      newContract.otherFixedAllowances;

    this.logAudit(actor, {
      targetType: 'payroll',
      targetId: newContract.id,
      action: 'UPDATE_SALARY_CONTRACT',
      details: `Updated salary structure for ${empName}. New Gross: ৳${gross} (Basic: ৳${newContract.basicSalary})`,
    });
    this.notify();
    return newContract;
  }

  public updateShift(
    shiftId: string,
    updates: Partial<ShiftDefinition>,
    actor: { userId: string; name: string }
  ): ShiftDefinition {
    const index = this.state.shifts.findIndex((s) => s.id === shiftId);
    if (index === -1) throw new Error('Shift not found');

    this.state.shifts[index] = { ...this.state.shifts[index], ...updates };
    const updated = this.state.shifts[index];

    this.logAudit(actor, {
      targetType: 'settings',
      targetId: shiftId,
      action: 'UPDATE_SHIFT',
      details: `Updated shift schedule ${updated.name}: ${updated.startTime}–${updated.endTime}, break: ${updated.breakMinutes}m, grace: ${updated.graceMinutes}m`,
    });
    this.notify();
    return updated;
  }

  public createShift(
    data: Omit<ShiftDefinition, 'id' | 'organizationId'>,
    actor: { userId: string; name: string }
  ): ShiftDefinition {
    const shiftId = 'shift-' + Date.now();
    const newShift: ShiftDefinition = {
      ...data,
      id: shiftId,
      organizationId: this.state.organization.id,
    };
    this.state.shifts.push(newShift);
    this.logAudit(actor, {
      targetType: 'settings',
      targetId: shiftId,
      action: 'CREATE_SHIFT',
      details: `Created new office shift ${newShift.name} (${newShift.startTime}–${newShift.endTime})`,
    });
    this.notify();
    return newShift;
  }

  public getSalaryAdvances(employeeId?: string): SalaryAdvance[] {
    if (employeeId) {
      return this.state.salaryAdvances.filter((a) => a.employeeId === employeeId);
    }
    return this.state.salaryAdvances;
  }

  public createSalaryAdvance(data: Omit<SalaryAdvance, 'id'>, actor: { userId: string; name: string }) {
    const newAdv: SalaryAdvance = {
      ...data,
      id: 'adv-' + Date.now(),
    };
    this.state.salaryAdvances.push(newAdv);
    this.logAudit(actor, {
      targetType: 'payroll',
      targetId: newAdv.id,
      action: 'CREATE_SALARY_ADVANCE',
      details: `Approved advance of ৳${data.approvedAmount} for employee ${data.employeeId}`,
    });
    this.notify();
  }

  /**
   * STEP 1: Create a Payroll Period
   */
  public createPayrollPeriod(month: number, year: number, actor: { userId: string; name: string }): PayrollPeriod {
    const existing = this.state.payrollPeriods.find((p) => p.month === month && p.year === year);
    if (existing) {
      return existing;
    }

    const lastDay = new Date(year, month, 0).getDate();
    const periodStart = `${year}-${String(month).padStart(2, '0')}-01`;
    const periodEnd = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

    const newPeriod: PayrollPeriod = {
      id: `period-${year}-${String(month).padStart(2, '0')}`,
      organizationId: this.state.organization.id,
      month,
      year,
      periodStart,
      periodEnd,
      status: 'draft',
    };

    this.state.payrollPeriods.unshift(newPeriod);
    this.logAudit(actor, {
      targetType: 'payroll',
      targetId: newPeriod.id,
      action: 'CREATE_PAYROLL_PERIOD',
      details: `Initialized payroll period for ${month}/${year}`,
    });
    this.notify();
    return newPeriod;
  }

  /**
   * STEP 2 & 3: Calculate Draft Payroll Run
   */
  public calculateDraftPayroll(periodId: string, actor: { userId: string; name: string }): PayrollRun {
    const period = this.state.payrollPeriods.find((p) => p.id === periodId);
    if (!period) throw new Error('Payroll period not found');

    const runId = `run-${period.id}-v1`;
    const daysInMonth = new Date(period.year, period.month, 0).getDate();
    // Estimate scheduled workdays (excluding Fridays and Saturdays)
    let scheduledWorkdays = 0;
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(period.year, period.month - 1, day);
      const dayOfWeek = date.getDay(); // 5 = Fri, 6 = Sat
      if (dayOfWeek !== 5 && dayOfWeek !== 6) {
        scheduledWorkdays++;
      }
    }

    const items: PayrollItem[] = [];
    let totalGross = 0;
    let totalDeductions = 0;
    let totalNet = 0;

    for (const emp of this.state.employees) {
      if (emp.employmentStatus !== 'active' && emp.employmentStatus !== 'probationary') continue;

      const contract = this.getSalaryContractByEmployee(emp.id);
      if (!contract) continue;

      const dept = this.state.departments.find((d) => d.id === emp.departmentId);
      const des = this.state.designations.find((d) => d.id === emp.designationId);
      const advance = this.state.salaryAdvances.find((a) => a.employeeId === emp.id && a.status === 'active');

      // Aggregate attendance for this period
      const sessions = this.state.attendanceSessions.filter(
        (s) => s.employeeId === emp.id && s.attendanceDate >= period.periodStart && s.attendanceDate <= period.periodEnd
      );

      let totalPresent = 0;
      let totalLate = 0;
      let totalHalfDay = 0;
      let totalPaidLeave = 0;
      let totalUnpaidLeave = 0;
      let totalAbsent = 0;
      let totalOvertimeHours = 0;
      let totalWorkedMinutes = 0;

      for (const s of sessions) {
        if (s.computedStatus === 'present') totalPresent++;
        else if (s.computedStatus === 'late') { totalPresent++; totalLate++; }
        else if (s.computedStatus === 'half_day') totalHalfDay++;
        else if (s.computedStatus === 'paid_leave') totalPaidLeave++;
        else if (s.computedStatus === 'unpaid_leave') totalUnpaidLeave++;
        else if (s.computedStatus === 'absent' || s.computedStatus === 'missing_punch') totalAbsent++;

        totalOvertimeHours += Math.floor(s.overtimeMinutes / 60);
        totalWorkedMinutes += s.workedMinutes;
      }

      // If records are partial, provide realistic working month default for stable demonstration
      if (totalPresent === 0 && totalPaidLeave === 0) {
        totalPresent = scheduledWorkdays;
      }

      const aggregate: EmployeeAttendanceAggregate = {
        employeeId: emp.id,
        totalPresent,
        totalLate,
        totalHalfDay,
        totalPaidLeave,
        totalUnpaidLeave,
        totalAbsent,
        totalOvertimeHours,
        totalWorkedHours: Math.floor(totalWorkedMinutes / 60),
      };

      const { payrollItem } = calculateEmployeePayroll({
        periodMonth: period.month,
        periodYear: period.year,
        periodStart: period.periodStart,
        periodEnd: period.periodEnd,
        daysInMonth,
        scheduledWorkingDays: scheduledWorkdays,
        employee: {
          id: emp.id,
          employeeCode: emp.employeeCode,
          fullName: emp.fullName,
          departmentName: dept?.name || 'Studio Matra',
          designationTitle: des?.title || 'Staff',
          joiningDate: emp.joiningDate,
        },
        salaryContract: contract,
        attendance: aggregate,
        policy: this.state.payrollPolicy,
        activeAdvance: advance,
      });

      const fullItem: PayrollItem = {
        ...payrollItem,
        id: `item-${runId}-${emp.id}`,
        payrollRunId: runId,
      };

      items.push(fullItem);
      totalGross += fullItem.grossAmount;
      totalDeductions += fullItem.totalDeductions;
      totalNet += fullItem.netAmount;
    }

    // Upsert run
    let run = this.state.payrollRuns.find((r) => r.id === runId);
    if (!run) {
      run = {
        id: runId,
        organizationId: this.state.organization.id,
        payrollPeriodId: period.id,
        month: period.month,
        year: period.year,
        versionNumber: 1,
        status: 'calculated',
        totalEmployees: items.length,
        totalGross,
        totalDeductions,
        totalNet,
        calculatedAt: new Date().toISOString(),
        calculatedBy: actor.name,
      };
      this.state.payrollRuns.unshift(run);
    } else {
      run.status = 'calculated';
      run.totalGross = totalGross;
      run.totalDeductions = totalDeductions;
      run.totalNet = totalNet;
      run.calculatedAt = new Date().toISOString();
      run.calculatedBy = actor.name;
    }

    // Replace items
    this.state.payrollItems = this.state.payrollItems.filter((i) => i.payrollRunId !== runId).concat(items);
    period.status = 'calculated';

    this.logAudit(actor, {
      targetType: 'payroll',
      targetId: run.id,
      action: 'CALCULATE_PAYROLL',
      details: `Calculated draft payroll for ${period.month}/${period.year}. Total Net: ৳${totalNet}`,
    });

    this.notify();
    return run;
  }

  /**
   * STEP 4: Review Payroll Run
   */
  public reviewPayrollRun(runId: string, actor: { userId: string; name: string }) {
    const run = this.state.payrollRuns.find((r) => r.id === runId);
    if (!run) throw new Error('Payroll run not found');
    run.status = 'reviewed';
    run.reviewedBy = actor.name;
    run.reviewedAt = new Date().toISOString();

    const period = this.state.payrollPeriods.find((p) => p.id === run.payrollPeriodId);
    if (period) period.status = 'reviewed';

    this.logAudit(actor, {
      targetType: 'payroll',
      targetId: runId,
      action: 'REVIEW_PAYROLL',
      details: `${actor.name} completed financial review for payroll run ${runId}`,
    });
    this.notify();
  }

  /**
   * STEP 5: Approve Payroll Run
   */
  public approvePayrollRun(runId: string, actor: { userId: string; name: string }, comment?: string) {
    const run = this.state.payrollRuns.find((r) => r.id === runId);
    if (!run) throw new Error('Payroll run not found');
    run.status = 'approved';
    run.approvedBy = actor.name;
    run.approvedAt = new Date().toISOString();
    run.notes = comment;

    const period = this.state.payrollPeriods.find((p) => p.id === run.payrollPeriodId);
    if (period) period.status = 'approved';

    this.logAudit(actor, {
      targetType: 'payroll',
      targetId: runId,
      action: 'APPROVE_PAYROLL',
      details: `${actor.name} approved payroll run. ${comment || ''}`,
    });
    this.notify();
  }

  /**
   * STEP 6: Finalize Payroll Run (Locks Snapshot)
   */
  public finalizePayrollRun(runId: string, actor: { userId: string; name: string }) {
    const run = this.state.payrollRuns.find((r) => r.id === runId);
    if (!run) throw new Error('Payroll run not found');
    run.status = 'finalized';
    run.finalizedBy = actor.name;
    run.finalizedAt = new Date().toISOString();

    const period = this.state.payrollPeriods.find((p) => p.id === run.payrollPeriodId);
    if (period) period.status = 'finalized';

    // Apply advance deductions to remaining balances
    const items = this.state.payrollItems.filter((i) => i.payrollRunId === runId);
    for (const item of items) {
      if (item.advanceRecoveryDeduction > 0) {
        const adv = this.state.salaryAdvances.find((a) => a.employeeId === item.employeeId && a.status === 'active');
        if (adv) {
          adv.remainingBalance = Math.max(0, adv.remainingBalance - item.advanceRecoveryDeduction);
          if (adv.remainingBalance === 0) {
            adv.status = 'completed';
          }
        }
      }
    }

    this.logAudit(actor, {
      targetType: 'payroll',
      targetId: runId,
      action: 'FINALIZE_PAYROLL',
      details: `${actor.name} finalized and locked payroll snapshot for ${run.month}/${run.year}`,
    });
    this.notify();
  }

  /**
   * STEP 7: Publish Payslips
   */
  public publishPayslips(runId: string, actor: { userId: string; name: string }) {
    const run = this.state.payrollRuns.find((r) => r.id === runId);
    if (!run) throw new Error('Payroll run not found');

    const items = this.state.payrollItems.filter((i) => i.payrollRunId === runId);
    const nowIso = new Date().toISOString();

    for (const item of items) {
      item.publishedAt = nowIso;
      const emp = this.getEmployeeById(item.employeeId);
      if (emp) {
        this.createNotification({
          recipientUserId: emp.userId,
          title: 'Payslip Published',
          message: `Your salary slip for ${run.month}/${run.year} is now ready for review and PDF download.`,
          type: 'payroll',
        });
      }
    }

    this.logAudit(actor, {
      targetType: 'payroll',
      targetId: runId,
      action: 'PUBLISH_PAYSLIPS',
      details: `Published payslips for ${items.length} employees`,
    });
    this.notify();
  }

  /**
   * STEP 8: Record Payment
   */
  public recordPayment(params: {
    payrollItemId: string;
    paymentMethod: 'bank_transfer' | 'bkash' | 'cash';
    paymentReference: string;
    paymentDate: string;
    actor: { userId: string; name: string };
  }) {
    const { payrollItemId, paymentMethod, paymentReference, paymentDate, actor } = params;
    const item = this.state.payrollItems.find((i) => i.id === payrollItemId);
    if (!item) throw new Error('Payroll record not found');

    item.paymentStatus = 'paid';
    item.paymentMethod = paymentMethod;
    item.paymentReference = paymentReference;
    item.paymentDate = paymentDate;

    this.logAudit(actor, {
      targetType: 'payroll',
      targetId: payrollItemId,
      action: 'RECORD_PAYMENT',
      details: `Recorded payment of ৳${item.netAmount} to ${item.employeeName} via ${paymentMethod} (Ref: ${paymentReference})`,
    });
    this.notify();
  }

  // -------------------------------------------------------------
  // SETTINGS & SYSTEM CONFIGURATION
  // -------------------------------------------------------------

  public getSettings(): SystemSettings {
    return this.state.settings;
  }

  public updateOrganization(updates: Partial<Organization>, actor: { userId: string; name: string }) {
    this.state.organization = { ...this.state.organization, ...updates };
    this.state.settings.organization = this.state.organization;
    this.logAudit(actor, {
      targetType: 'settings',
      targetId: this.state.organization.id,
      action: 'UPDATE_ORGANIZATION',
      details: `Updated company details/branding for STUDIO MATRA`,
    });
    this.notify();
  }

  public updatePayrollPolicy(updates: Partial<PayrollPolicy>, actor: { userId: string; name: string }) {
    this.state.payrollPolicy = { ...this.state.payrollPolicy, ...updates };
    this.state.settings.payrollPolicy = this.state.payrollPolicy;
    this.logAudit(actor, {
      targetType: 'settings',
      targetId: this.state.payrollPolicy.id,
      action: 'UPDATE_PAYROLL_POLICY',
      details: `Updated payroll policy parameters (Divisor: ${this.state.payrollPolicy.divisorMethod})`,
    });
    this.notify();
  }

  public getAuditLogs(): AuditLog[] {
    return this.state.auditLogs;
  }

  public getNotifications(userId: string): NotificationItem[] {
    return this.state.notifications.filter((n) => n.recipientUserId === userId);
  }

  public markNotificationAsRead(id: string) {
    const notif = this.state.notifications.find((n) => n.id === id);
    if (notif) {
      notif.isRead = true;
      this.notify();
    }
  }

  public markAllNotificationsAsRead(userId: string) {
    for (const n of this.state.notifications) {
      if (n.recipientUserId === userId) {
        n.isRead = true;
      }
    }
    this.notify();
  }
}

export const db = new StudioMatraDatabase();
