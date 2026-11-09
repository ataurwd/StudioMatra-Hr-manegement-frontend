import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  ArrowUpRight,
  Calendar,
  CheckCircle2,
  Clock,
  LogIn,
  LogOut,
  PlusCircle,
  ShieldAlert,
  Sparkles,
  Timer,
  UserCheck,
} from 'lucide-react';
import { db } from '../db/database';
import { syncWithBackend, apiCheckIn, apiCheckOut } from '../services/apiService';
import { AttendanceSession, Employee, LeaveBalance, User } from '../types';
import { formatMinutes } from '../utils/attendanceCalculator';
import { formatBDT } from '../utils/money';
import { KioskPinCard } from './common/KioskPinCard';
import { AttendanceCalendarView } from './AttendanceCalendarView';

interface EmployeeDashboardProps {
  currentUser: User;
  onNavigate?: (tab: string) => void;
  isOfficeNetwork: boolean;
}

export const EmployeeDashboard: React.FC<EmployeeDashboardProps> = ({
  currentUser,
  onNavigate,
  isOfficeNetwork,
}) => {
  const navigate = useNavigate();
  const goTo = (tab: string) => {
    if (onNavigate) {
      onNavigate(tab);
    } else {
      navigate(tab.startsWith('/') ? tab : `/${tab}`);
    }
  };
  const employee = currentUser.employeeId
    ? db.getEmployeeById(currentUser.employeeId)
    : db.getEmployeeByUserId(currentUser.id);
  const [, setDbTick] = useState(0);
  const [activeSession, setActiveSession] = useState<AttendanceSession | null>(null);
  const [todaySession, setTodaySession] = useState<AttendanceSession | null>(null);
  const [elapsedString, setElapsedString] = useState('0h 0m');
  const [actionError, setActionError] = useState('');
  const [actionSuccess, setActionSuccess] = useState('');

  const refreshSessions = () => {
    if (employee) {
      setActiveSession(db.getActiveSession(employee.id) || null);
      setTodaySession(db.getTodaySession(employee.id) || null);
    }
    setDbTick((t) => t + 1);
  };

  useEffect(() => {
    syncWithBackend().catch(() => {});
    refreshSessions();
    const unsub = db.subscribe(refreshSessions);
    return unsub;
  }, [employee]);

  // Live timer for active session
  useEffect(() => {
    if (!activeSession) {
      setElapsedString('0h 0m');
      return;
    }

    const calcElapsed = () => {
      const start = new Date(activeSession.checkInAt).getTime();
      const now = Date.now();
      const diffMin = Math.max(0, Math.floor((now - start) / (1000 * 60)));
      setElapsedString(formatMinutes(diffMin));
    };

    calcElapsed();
    const interval = setInterval(calcElapsed, 10000);
    return () => clearInterval(interval);
  }, [activeSession]);

  if (!employee) {
    return (
      <div className="p-8 text-center text-[#646e6a]">
        Employee record not linked to current user account.
      </div>
    );
  }

  const dept = db.getDepartments().find((d) => d.id === employee.departmentId);
  const des = db.getDesignations().find((d) => d.id === employee.designationId);
  const desTitle = employee.customDesignation || des?.title || 'Studio Personnel';
  const shift = db.getShifts().find((s) => s.id === employee.shiftId) || db.getShifts()[0];
  const rawBalances = db.getLeaveBalances(employee.id);
  const leaveBalances = rawBalances.length > 0
    ? rawBalances
    : db.getLeaveTypes().map((lt) => ({
        id: `lb-${employee.id}-${lt.code.toLowerCase()}`,
        employeeId: employee.id,
        leaveTypeId: lt.id,
        year: 2026,
        openingBalance: lt.annualQuota,
        accrued: lt.annualQuota,
        used: 0,
        closingBalance: lt.annualQuota,
      }));
  const recentSessions = db.getAttendanceSessions({ employeeId: employee.id }).slice(0, 5);

  // Monthly stats
  const monthlySessions = db.getAttendanceSessions({ employeeId: employee.id });
  let presentCount = 0;
  let lateCount = 0;
  let absentCount = 0;
  let leaveCount = 0;
  let totalMinutesWorked = 0;

  for (const s of monthlySessions) {
    if (s.computedStatus === 'present' || s.computedStatus === 'missing_punch' || s.isMissingPunch) {
      presentCount++;
      if (s.lateMinutes > 0) lateCount++;
    }
    else if (s.computedStatus === 'late') { presentCount++; lateCount++; }
    else if (s.computedStatus === 'half_day') presentCount += 0.5;
    else if (s.computedStatus === 'paid_leave' || s.computedStatus === 'unpaid_leave') leaveCount++;
    else if (s.computedStatus === 'absent') absentCount++;

    totalMinutesWorked += s.workedMinutes > 0 ? s.workedMinutes : (s.isMissingPunch || s.computedStatus === 'missing_punch' ? 480 : 0);
  }

  const handleCheckIn = async () => {
    setActionError('');
    setActionSuccess('');

    // Office network verification check (Method 2)
    if (!isOfficeNetwork) {
      setActionError(
        'Office Attendance Verification Failed: You are not connected to the authorized Studio Matra office Wi-Fi / IP subnet (192.168.1.0/24). Please connect or use the Reception Kiosk.'
      );
      return;
    }

    try {
      const { session } = db.checkIn({
        employeeId: employee.id,
        sourceType: 'office_network',
        clientIp: '192.168.1.105',
        actorUserId: currentUser.id,
      });
      // Synchronize directly with MySQL backend
      apiCheckIn(employee.id, 'office_network').then(() => syncWithBackend()).catch(() => {});
      setActionSuccess(
        `Checked in successfully at ${new Date(session.checkInAt).toLocaleTimeString('en-US', { timeZone: 'Asia/Dhaka' })}. Status: ${session.computedStatus.toUpperCase()}.`
      );
      refreshSessions();
    } catch (err: any) {
      setActionError(err.message || 'Check-in failed');
    }
  };

  const handleCheckOut = async () => {
    setActionError('');
    setActionSuccess('');

    try {
      const { session } = db.checkOut({
        employeeId: employee.id,
        sourceType: 'office_network',
        clientIp: '192.168.1.105',
        actorUserId: currentUser.id,
      });
      // Synchronize directly with MySQL backend
      apiCheckOut(employee.id, 'office_network').then(() => syncWithBackend()).catch(() => {});
      setActionSuccess(
        `Checked out successfully! Total worked: ${formatMinutes(session.workedMinutes)} (${session.breakMinutes}m lunch break deducted). Status: ${session.computedStatus.toUpperCase()}.`
      );
      refreshSessions();
    } catch (err: any) {
      setActionError(err.message || 'Check-out failed');
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Welcome Banner */}
      <div className="bg-white rounded-2xl p-6 border border-[#e8e4da] shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            <span className="text-xs uppercase tracking-wider font-bold text-[#8f6927] bg-[#f7efe0] border border-[#ebd8b7] px-2.5 py-0.5 rounded-full">
              {employee.employeeCode}
            </span>
            <span className="text-xs font-bold text-[#1c2120] bg-[#faf3e7] border border-[#ebd8b7] px-2.5 py-0.5 rounded-full">
              {desTitle}
            </span>
            {employee.employmentType === 'adhoc' && (
              <span className="text-xs font-bold text-purple-700 bg-purple-50 border border-purple-200 px-2.5 py-0.5 rounded-full">
                Ad-hoc Job {employee.adhocJobTitle ? `• ${employee.adhocJobTitle}` : ''}
              </span>
            )}
            <span className="text-xs text-[#7d8783]">• {dept?.name}</span>
          </div>
          <h1 className="text-2xl font-serif font-bold text-[#1a201e]">Welcome, {employee.fullName}</h1>
          <p className="text-xs text-[#66706c] mt-0.5">
            <strong className="text-[#CAA05C] font-semibold">{desTitle}</strong> • Shift: {shift.name} ({shift.startTime} – {shift.endTime})
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => goTo('leave')}
            className="px-3.5 py-2 rounded-xl bg-[#f4f1ea] hover:bg-[#eae6dc] text-[#1c2120] text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <PlusCircle className="w-4 h-4 text-[#CAA05C]" />
            <span>Apply Leave</span>
          </button>
          <button
            onClick={() => goTo('attendance')}
            className="px-3.5 py-2 rounded-xl bg-[#f4f1ea] hover:bg-[#eae6dc] text-[#1c2120] text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Calendar className="w-4 h-4 text-[#CAA05C]" />
            <span>Attendance Log</span>
          </button>
        </div>
      </div>

      {/* Ad-hoc Job Assignment Notice */}
      {employee.employmentType === 'adhoc' && (
        <div className="bg-gradient-to-r from-purple-50 via-white to-[#faf7f0] border border-purple-200 rounded-2xl p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-purple-100 border border-purple-200 flex items-center justify-center text-purple-700 font-bold text-sm shrink-0">
              AD
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold text-purple-900 bg-purple-100/80 px-2 py-0.5 rounded uppercase tracking-wider">
                  Ad-hoc Project Assignment / এডহক কাজ
                </span>
              </div>
              <p className="text-base font-bold text-[#1c2120] mt-0.5">
                {employee.adhocJobTitle || 'Special Architectural & Design Project'}
              </p>
              <p className="text-xs text-[#6e7774]">
                Assigned under Studio Matra project contract guidelines.
              </p>
            </div>
          </div>
          <span className="px-3.5 py-1.5 rounded-full text-xs font-bold bg-purple-600 text-white shadow-xs self-start sm:self-auto">
            Active Ad-hoc
          </span>
        </div>
      )}

      {/* Main Attendance Card */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-2xl p-6 sm:p-8 border border-[#e8e4da] shadow-xs">
          <div className="flex items-center justify-between pb-6 border-b border-[#f0ece1]">
            <div>
              <span className="text-[11px] uppercase font-bold tracking-wider text-[#7d8884]">
                Today's Office Attendance
              </span>
              <h2 className="text-xl font-bold text-[#1c2120] mt-0.5">Attendance Action Center</h2>
            </div>
            {activeSession ? (
              <span className="px-3 py-1.5 rounded-full bg-[#e8f6ed] text-[#1b4332] text-xs font-bold border border-[#bfe7cf] flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-[#2d6a4f] animate-pulse" />
                Active Session
              </span>
            ) : todaySession?.checkOutAt ? (
              <span className="px-3 py-1.5 rounded-full bg-[#f4f1ea] text-[#4d5653] text-xs font-semibold border border-[#ded8cb] flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-[#2d6a4f]" />
                Completed for Today
              </span>
            ) : (
              <span className="px-3 py-1.5 rounded-full bg-[#fdf2f2] text-[#991b1b] text-xs font-semibold border border-[#fed7d7]">
                Not Checked In
              </span>
            )}
          </div>

          {/* Feedback alerts */}
          {actionError && (
            <div className="mt-4 p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-600 mt-0.5" />
              <span>{actionError}</span>
            </div>
          )}

          {actionSuccess && (
            <div className="mt-4 p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 mt-0.5" />
              <span>{actionSuccess}</span>
            </div>
          )}

          {/* Session Timer & Status */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 my-6 p-4 rounded-xl bg-[#faf9f5] border border-[#ece7dc]">
            <div>
              <p className="text-[11px] text-[#76807c]">Check-In Time</p>
              <p className="text-sm font-semibold text-[#1c2120] font-mono mt-0.5">
                {activeSession
                  ? new Date(activeSession.checkInAt).toLocaleTimeString('en-US', { timeZone: 'Asia/Dhaka' })
                  : todaySession
                  ? new Date(todaySession.checkInAt).toLocaleTimeString('en-US', { timeZone: 'Asia/Dhaka' })
                  : '—'}
              </p>
            </div>
            <div>
              <p className="text-[11px] text-[#76807c]">Check-Out Time</p>
              <p className="text-sm font-semibold text-[#1c2120] font-mono mt-0.5">
                {todaySession?.checkOutAt
                  ? new Date(todaySession.checkOutAt).toLocaleTimeString('en-US', { timeZone: 'Asia/Dhaka' })
                  : 'In Progress'}
              </p>
            </div>
            <div>
              <p className="text-[11px] text-[#76807c]">Active Duration</p>
              <p className="text-sm font-semibold text-[#CAA05C] font-mono mt-0.5">
                {activeSession ? elapsedString : todaySession ? formatMinutes(todaySession.workedMinutes) : '0h 0m'}
              </p>
            </div>
            <div>
              <p className="text-[11px] text-[#76807c]">Scheduled Shift</p>
              <p className="text-sm font-semibold text-[#1c2120] font-mono mt-0.5">
                {shift?.startTime || '10:15'} – {shift?.endTime || '19:30'}
              </p>
            </div>
          </div>

          {/* Check In / Out Main CTA */}
          <div className="flex flex-col sm:flex-row items-center gap-3">
            {!activeSession ? (
              <button
                onClick={handleCheckIn}
                className="w-full sm:w-auto flex-1 py-3.5 px-6 rounded-xl bg-[#CAA05C] hover:bg-[#ba904c] active:bg-[#a67e3a] text-[#171c1b] font-bold text-sm flex items-center justify-center gap-2.5 transition-all cursor-pointer shadow-sm active:scale-98"
              >
                <LogIn className="w-5 h-5 text-[#171c1b]" />
                <span>OFFICE CHECK IN</span>
              </button>
            ) : (
              <button
                onClick={handleCheckOut}
                className="w-full sm:w-auto flex-1 py-3.5 px-6 rounded-xl bg-[#92400e] hover:bg-[#b45309] active:bg-[#d97706] text-white font-bold text-sm flex items-center justify-center gap-2.5 transition-all cursor-pointer shadow-sm active:scale-98"
              >
                <LogOut className="w-5 h-5 text-amber-200" />
                <span>OFFICE CHECK OUT</span>
              </button>
            )}
          </div>

          <div className="mt-4 flex items-center gap-2 text-[11px] text-[#76807c]">
            <ShieldAlert className="w-3.5 h-3.5 text-[#CAA05C]" />
            <span>
              Office attendance policy active: Verifies office IP range (192.168.1.0/24). Grace period: 10 mins.
            </span>
          </div>
        </div>

        {/* Kiosk Attendance PIN Card */}
        <KioskPinCard currentUser={currentUser} onNavigate={goTo} />
      </div>

      {/* Main Interactive Attendance Calendar & Timeline Register */}
      <AttendanceCalendarView
        employeeId={employee.id}
        currentUser={currentUser}
      />

      {/* Annual Leave Balances & Quota Card */}
      <div className="bg-white rounded-2xl p-6 border border-[#e8e4da] shadow-xs">
        <div className="flex items-center justify-between pb-4 border-b border-[#f0ece1]">
          <div>
            <h3 className="font-bold text-sm text-[#1c2120]">Annual Leave Balances & Quota</h3>
            <p className="text-xs text-[#717b77]">Authoritative company leave entitlement for 2026</p>
          </div>
          <button
            onClick={() => goTo('leave')}
            className="text-xs font-semibold text-[#8f6927] hover:underline cursor-pointer"
          >
            Apply Leave Request →
          </button>
        </div>

        <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {leaveBalances.map((bal) => {
            const lt = db.getLeaveTypes().find((t) => t.id === bal.leaveTypeId);
            const percent = bal.accrued > 0 ? Math.round((bal.closingBalance / bal.accrued) * 100) : 0;
            return (
              <div key={bal.id} className="p-4 rounded-xl bg-[#faf9f5] border border-[#ece7dc] space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-bold text-[#1c2120]">{lt?.name}</span>
                  <span className="font-mono font-bold text-[#CAA05C]">
                    {bal.closingBalance} / {bal.accrued}
                  </span>
                </div>
                <div className="w-full h-2 bg-[#f0ece1] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[#CAA05C] rounded-full"
                    style={{ width: `${Math.min(100, percent)}%` }}
                  />
                </div>
                <span className="text-[10px] text-[#76807c] block">
                  {bal.used} used • {bal.closingBalance} days remaining
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
