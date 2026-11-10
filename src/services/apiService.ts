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
    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) return null;
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
    const res = await fetch(`${API_BASE}/sync/master`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return false;
    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) return false;
    const remoteData = await res.json();
    if (remoteData && Array.isArray(remoteData.employees)) {
      db.syncFromRemote(remoteData);
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

async function safeJsonRequest(url: string, options: RequestInit): Promise<{ success: boolean; error?: string; data?: any }> {
  try {
    const res = await fetch(url, options);
    const contentType = res.headers.get('content-type') || '';
    const data = contentType.includes('application/json') ? await res.json() : null;
    if (!res.ok) {
      return { success: false, error: data?.error || `Server error (${res.status})`, data };
    }
    return { success: true, data };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Unable to connect to database server' };
  }
}

// --- Auth & Profile ---
export async function apiGetUsers(): Promise<User[]> {
  try {
    const res = await fetch(`${API_BASE}/auth/users`);
    if (!res.ok) return [];
    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) return [];
    return await res.json();
  } catch {
    return [];
  }
}

export async function apiGetEmployees(): Promise<Employee[]> {
  try {
    const res = await fetch(`${API_BASE}/employees`);
    if (!res.ok) return [];
    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) return [];
    return await res.json();
  } catch {
    return [];
  }
}

export async function apiLogin(
  email: string,
  pass: string
): Promise<{ success: boolean; user?: User; token?: string; error?: string }> {
  try {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email.trim().toLowerCase(), password: pass.trim() }),
    });
    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      return { success: false, error: 'Server returned non-JSON response' };
    }
    const data = await res.json();
    if (!res.ok) {
      return { success: false, error: data.error || 'Invalid email or password' };
    }
    return { success: true, user: data.user, token: data.token };
  } catch (err: any) {
    return { success: false, error: err.message || 'Network error' };
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
export async function apiCreateEmployee(
  employee: any,
  pinCode?: string,
  password?: string,
  role?: string,
  salaryContract?: any
): Promise<{ success: boolean; error?: string; employee?: any; user?: any; salaryContract?: any }> {
  const res = await safeJsonRequest(`${API_BASE}/employees`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ employee, pinCode, password, role, salaryContract }),
  });
  return {
    success: res.success,
    error: res.error,
    employee: res.data?.employee,
    user: res.data?.user,
    salaryContract: res.data?.salaryContract,
  };
}

export async function apiUpdateEmployee(
  employeeId: string,
  updates: any
): Promise<{ success: boolean; error?: string; employee?: any; user?: any; salaryContract?: any }> {
  const res = await safeJsonRequest(`${API_BASE}/employees/${employeeId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  });
  return {
    success: res.success,
    error: res.error,
    employee: res.data?.employee,
    user: res.data?.user,
    salaryContract: res.data?.salaryContract,
  };
}

export async function apiUpdateSalaryContract(
  employeeId: string,
  contractUpdates: any
): Promise<{ success: boolean; error?: string; data?: any }> {
  return safeJsonRequest(`${API_BASE}/payroll/contracts/${employeeId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(contractUpdates),
  });
}

export async function apiDeleteEmployee(employeeId: string): Promise<{ success: boolean; error?: string }> {
  return safeJsonRequest(`${API_BASE}/employees/${employeeId}`, {
    method: 'DELETE',
  });
}

export async function apiUpdateEmployeePin(
  employeeId: string,
  pinCode: string,
  actorRole?: string
): Promise<boolean> {
  const res = await safeJsonRequest(`${API_BASE}/employees/${employeeId}/pin`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pinCode, actorRole }),
  });
  return res.success;
}

export async function apiUpdateEmployeePassword(employeeId: string, newPassword: string): Promise<boolean> {
  const res = await safeJsonRequest(`${API_BASE}/employees/${employeeId}/password`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ newPassword }),
  });
  return res.success;
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

// --- Shift Management ---
export async function apiGetShifts(): Promise<any[]> {
  try {
    const res = await fetch(`${API_BASE}/settings/shifts`);
    if (!res.ok) return [];
    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) return [];
    return await res.json();
  } catch {
    return [];
  }
}

export async function apiUpdateShift(shiftId: string, updates: any): Promise<any> {
  try {
    const res = await fetch(`${API_BASE}/settings/shifts/${shiftId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    if (!res.ok) return null;
    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) return null;
    return await res.json();
  } catch {
    return null;
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

export async function apiUpdatePayrollPeriod(periodId: string, updates: any): Promise<any> {
  try {
    const res = await fetch(`${API_BASE}/payroll/periods/${periodId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    return await res.json();
  } catch {
    return null;
  }
}

export async function apiDeletePayrollPeriod(periodId: string): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/payroll/periods/${periodId}`, {
      method: 'DELETE',
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function apiDeletePayrollRun(runId: string): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/payroll/runs/${runId}`, {
      method: 'DELETE',
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function apiResetPayslipPayment(payrollItemId: string): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/payroll/items/${payrollItemId}/payment`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        paymentStatus: 'unpaid',
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function apiResetAllPracticePayments(): Promise<any> {
  try {
    const res = await fetch(`${API_BASE}/payroll/reset-practice-payments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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
