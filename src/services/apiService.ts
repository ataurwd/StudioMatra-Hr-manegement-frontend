import { db } from '../db/database';
import { Employee, LeaveBalance, User } from '../types';

const API_BASE = (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_API_URL)
  ? ((import.meta as any).env.VITE_API_URL as string).replace(/\/$/, '')
  : '/api';

export interface HealthResponse {
  status: string;
  service: string;
  database: {
    engine: string;
    status: string;
    targetDatabase: string;
    totalEmployees: number;
    totalUsers: number;
    totalAttendanceSessions: number;
  };
  timestamp: string;
}

export async function checkBackendHealth(): Promise<HealthResponse | null> {
  try {
    const res = await fetch(`${API_BASE}/health`, { signal: AbortSignal.timeout(3000) });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

/**
 * Dynamically synchronizes client data directly from MySQL database through backend REST API.
 */
export async function syncWithBackend(): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/sync/master`, { signal: AbortSignal.timeout(4000) });
    if (!res.ok) return false;
    const remoteData = await res.json();
    if (remoteData && (remoteData.users?.length > 0 || remoteData.employees?.length > 0)) {
      db.syncFromRemote(remoteData);
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

// --- Auth & Profile ---
export async function apiLogin(email: string, pass: string): Promise<{ user: User; token: string } | null> {
  try {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: pass }),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function apiChangePassword(userId: string, currentPassword: string, newPassword: string): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/auth/change-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, currentPassword, newPassword }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

// --- Attendance & Kiosk ---
export async function apiCheckIn(employeeId: string, sourceType?: string): Promise<any> {
  try {
    const res = await fetch(`${API_BASE}/attendance/check-in`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ employeeId, sourceType: sourceType || 'office_network' }),
    });
    return await res.json();
  } catch {
    return null;
  }
}

export async function apiCheckOut(employeeId: string, sourceType?: string): Promise<any> {
  try {
    const res = await fetch(`${API_BASE}/attendance/check-out`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ employeeId, sourceType: sourceType || 'office_network' }),
    });
    return await res.json();
  } catch {
    return null;
  }
}

export async function apiKioskPunch(pin: string, mode?: 'check_in' | 'check_out', deviceId?: string, loggedInUserId?: string): Promise<any> {
  try {
    const res = await fetch(`${API_BASE}/attendance/kiosk-punch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin, mode, deviceId, loggedInUserId }),
    });
    return await res.json();
  } catch {
    return null;
  }
}

export async function apiAdminOverrideAttendance(data: any): Promise<any> {
  try {
    const res = await fetch(`${API_BASE}/attendance/admin-override`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return await res.json();
  } catch {
    return null;
  }
}

export async function apiAdminDeleteAttendance(sessionId: string): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/attendance/sessions/${sessionId}`, {
      method: 'DELETE',
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function apiSubmitCorrection(correction: any, actor?: any): Promise<any> {
  try {
    const res = await fetch(`${API_BASE}/attendance/corrections`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ correction, actor }),
    });
    return await res.json();
  } catch {
    return null;
  }
}

export async function apiReviewCorrection(requestId: string, action: string, comment?: string, reviewer?: any): Promise<any> {
  try {
    const res = await fetch(`${API_BASE}/attendance/corrections/${requestId}/review`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, comment, reviewer }),
    });
    return await res.json();
  } catch {
    return null;
  }
}

// --- Employees Management ---
export async function apiCreateEmployee(employee: any, pinCode?: string, password?: string): Promise<any> {
  try {
    const res = await fetch(`${API_BASE}/employees`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ employee, pinCode, password }),
    });
    return await res.json();
  } catch {
    return null;
  }
}

export async function apiUpdateEmployee(employeeId: string, updates: any): Promise<any> {
  try {
    const res = await fetch(`${API_BASE}/employees/${employeeId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    return await res.json();
  } catch {
    return null;
  }
}

export async function apiDeleteEmployee(employeeId: string): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/employees/${employeeId}`, {
      method: 'DELETE',
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function apiUpdateEmployeePin(
  employeeId: string,
  pinCode: string,
  actorRole?: string
): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/employees/${employeeId}/pin`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pinCode, actorRole }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function apiUpdateEmployeePassword(employeeId: string, newPassword: string): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/employees/${employeeId}/password`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ newPassword }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

// --- Leave Management ---
export async function apiApplyLeave(request: any): Promise<any> {
  try {
    const res = await fetch(`${API_BASE}/leave/requests`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ request }),
    });
    return await res.json();
  } catch {
    return null;
  }
}

export async function apiReviewLeave(requestId: string, status: string, comment?: string, reviewerId?: string): Promise<any> {
  try {
    const res = await fetch(`${API_BASE}/leave/requests/${requestId}/review`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, comment, reviewerId }),
    });
    return await res.json();
  } catch {
    return null;
  }
}

export async function apiUpdateLeaveBalances(balances: LeaveBalance[]): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/leave/balances`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ balances }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

// --- Payroll Management ---
export async function apiCreatePayrollPeriod(month: number, year: number, name?: string): Promise<any> {
  try {
    const res = await fetch(`${API_BASE}/payroll/periods`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ month, year, name }),
    });
    return await res.json();
  } catch {
    return null;
  }
}

export async function apiPublishPayslips(runId: string): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/payroll/runs/${runId}/publish`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function apiCalculatePayroll(periodId: string, calculatedBy?: string, notes?: string): Promise<any> {
  try {
    const res = await fetch(`${API_BASE}/payroll/calculate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ periodId, calculatedBy, notes }),
    });
    return await res.json();
  } catch {
    return null;
  }
}

export async function apiUpdatePayrollRunStatus(runId: string, status: string, actorId?: string): Promise<any> {
  try {
    const res = await fetch(`${API_BASE}/payroll/runs/${runId}/status`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, actorId }),
    });
    return await res.json();
  } catch {
    return null;
  }
}

export async function apiRecordPayment(params: {
  payrollItemId: string;
  paymentMethod: 'bank_transfer' | 'bkash' | 'cash';
  paymentReference: string;
  paymentDate: string;
}): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/payroll/items/${params.payrollItemId}/payment`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        paymentStatus: 'paid',
        paymentDate: params.paymentDate,
        paymentReference: params.paymentReference,
        paymentMethod: params.paymentMethod,
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

// --- Settings & Organization ---
export async function apiUpdateOrganization(updates: any): Promise<any> {
  try {
    const res = await fetch(`${API_BASE}/settings/organization`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    return await res.json();
  } catch {
    return null;
  }
}

export async function apiUpdatePayrollPolicy(updates: any): Promise<any> {
  try {
    const res = await fetch(`${API_BASE}/settings/payroll-policy`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    return await res.json();
  } catch {
    return null;
  }
}
