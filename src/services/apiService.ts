import { db } from '../db/database';
import { Employee, LeaveBalance, User } from '../types';

const API_BASE = '/api';

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

let syncTimeout: any = null;

export function schedulePushToBackend(): void {
  if (syncTimeout) clearTimeout(syncTimeout);
  syncTimeout = setTimeout(() => {
    pushToBackend().catch(() => {});
  }, 1000);
}

export async function pushToBackend(): Promise<boolean> {
  try {
    const state = db.exportState();
    const res = await fetch(`${API_BASE}/sync/master`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(state),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function syncWithBackend(): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/sync/master`, { signal: AbortSignal.timeout(3000) });
    if (!res.ok) return false;
    const remoteData = await res.json();
    if (remoteData && remoteData.users && remoteData.employees) {
      db.syncFromRemote(remoteData);
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

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

export async function apiKioskPunch(pin: string, mode?: 'check_in' | 'check_out', deviceId?: string): Promise<any> {
  try {
    const res = await fetch(`${API_BASE}/attendance/kiosk-punch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin, mode, deviceId }),
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

