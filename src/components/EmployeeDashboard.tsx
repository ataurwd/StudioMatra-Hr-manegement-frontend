import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  ArrowUpRight,
  Calendar,
  CheckCircle2,
  Clock,
  CreditCard,
  Download,
  Eye,
  FileText,
  LogIn,
  LogOut,
  PlusCircle,
  ShieldAlert,
  Sparkles,
  Timer,
  UserCheck,
  X,
} from 'lucide-react';
import { db } from '../db/database';
import { generatePayslipPDF } from '../services/pdfGenerator';
import { AttendanceSession, Employee, LeaveBalance, PayrollItem, User } from '../types';
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
  const [previewItem, setPreviewItem] = useState<PayrollItem | null>(null);
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
  const publishedPayslips = db.getEmployeePublishedPayslips(employee.id);
  const latestPayslip = publishedPayslips[0];

  const getPeriodLabel = (item?: PayrollItem) => {
    if (!item) return '';
    const run = db.getPayrollRuns().find((r) => r.id === item.payrollRunId);
    const period = run ? db.getPayrollPeriods().find((p) => p.id === run.payrollPeriodId) : null;
    const month = period?.month ?? run?.month;
    const year = period?.year ?? run?.year;
    if (month && year) {
      const monthNames = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December',
      ];
      return `${monthNames[month - 1] || month} ${year}`;
    }
    return item.payrollRunId;
  };

  // Monthly stats
  const monthlySessions = db.getAttendanceSessions({ employeeId: employee.id });
  let presentCount = 0;
  let lateCount = 0;
  let absentCount = 0;
  let leaveCount = 0;
  let totalMinutesWorked = 0;

  for (const s of monthlySessions) {
    if (s.computedStatus === 'present') presentCount++;
    else if (s.computedStatus === 'late') { presentCount++; lateCount++; }
    else if (s.computedStatus === 'half_day') presentCount += 0.5;
    else if (s.computedStatus === 'paid_leave' || s.computedStatus === 'unpaid_leave') leaveCount++;
    else if (s.computedStatus === 'absent' || s.computedStatus === 'missing_punch') absentCount++;

    totalMinutesWorked += s.workedMinutes;
  }

  const handleCheckIn = () => {
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
      setActionSuccess(
        `Checked in successfully at ${new Date(session.checkInAt).toLocaleTimeString('en-US', { timeZone: 'Asia/Dhaka' })}. Status: ${session.computedStatus.toUpperCase()}.`
      );
      refreshSessions();
    } catch (err: any) {
      setActionError(err.message || 'Check-in failed');
    }
  };

  const handleCheckOut = () => {
    setActionError('');
    setActionSuccess('');

    try {
      const { session } = db.checkOut({
        employeeId: employee.id,
        sourceType: 'office_network',
        clientIp: '192.168.1.105',
        actorUserId: currentUser.id,
      });
      setActionSuccess(
        `Checked out successfully! Total worked: ${formatMinutes(session.workedMinutes)} (${session.breakMinutes}m lunch break deducted). Status: ${session.computedStatus.toUpperCase()}.`
      );
      refreshSessions();
    } catch (err: any) {
      setActionError(err.message || 'Check-out failed');
    }
  };

  const handleDownloadLatestPayslip = () => {
    if (!latestPayslip) return;
    const org = db.getSettings().organization;
    const doc = generatePayslipPDF(latestPayslip, org);
    doc.save(`Studio_Matra_Payslip_${employee.employeeCode}_${latestPayslip.payrollRunId}.pdf`);
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
          {latestPayslip && (
            <button
              onClick={handleDownloadLatestPayslip}
              className="px-3.5 py-2 rounded-xl bg-[#CAA05C] hover:bg-[#ba904c] text-[#171c1b] text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
            >
              <Download className="w-4 h-4" />
              <span>Download Payslip</span>
            </button>
          )}
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
                09:00 – 18:00
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

            <button
              onClick={() => goTo('attendance')}
              className="w-full sm:w-auto py-3.5 px-5 rounded-xl bg-[#f4f1ea] hover:bg-[#eae6dc] text-[#3b4340] font-semibold text-xs transition-colors cursor-pointer"
            >
              Request Correction
            </button>
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
        onRequestCorrection={() => goTo('attendance')}
      />

      {/* Leave Balances & Additional Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Annual Leave Balances Card */}
        <div className="lg:col-span-2 bg-white rounded-2xl p-6 border border-[#e8e4da] shadow-xs">
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

          <div className="mt-5 grid grid-cols-1 sm:grid-cols-3 gap-4">
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

        {/* Recent Payslip Quick Access Card */}
        <div className="bg-white rounded-2xl p-6 border border-[#e8e4da] shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-[#f0ece1]">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-[#faf7f0] border border-[#ebd8b7] flex items-center justify-center text-[#CAA05C]">
                  <CreditCard className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-[#1c2120]">Compensation & Payslip</h3>
                  <p className="text-[10px] text-[#717b77]">Monthly earnings & salary disbursement</p>
                </div>
              </div>
              <span className="text-[11px] font-bold text-[#CAA05C] bg-[#fdfbf7] px-2 py-0.5 rounded border border-[#ebd8b7]">
                BDT (৳)
              </span>
            </div>

            {latestPayslip ? (
              <div className="mt-4 p-4 rounded-xl bg-[#faf9f5] border border-[#ece7dc] space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#717b77] block">
                      Disbursement Period
                    </span>
                    <p className="font-bold text-base text-[#1c2120] mt-0.5">
                      {getPeriodLabel(latestPayslip)}
                    </p>
                  </div>
                  <span
                    className={`px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider border ${
                      latestPayslip.paymentStatus === 'paid'
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                        : 'bg-amber-50 text-amber-800 border-amber-200'
                    }`}
                  >
                    {latestPayslip.paymentStatus === 'paid' ? '✓ Paid' : 'Pending'}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-[#ece7dc] text-[11px]">
                  <div>
                    <span className="text-[#717b77] block">Gross Pay:</span>
                    <span className="font-mono font-medium text-[#1c2120]">{formatBDT(latestPayslip.grossAmount)}</span>
                  </div>
                  <div>
                    <span className="text-[#717b77] block">Deductions:</span>
                    <span className="font-mono text-amber-800">{formatBDT(latestPayslip.totalDeductions)}</span>
                  </div>
                </div>

                <div className="pt-2 border-t border-[#ece7dc] flex items-baseline justify-between">
                  <span className="text-xs font-semibold text-[#717b77]">Net Disbursed:</span>
                  <span className="font-mono font-bold text-[#1b4332] text-lg">
                    {formatBDT(latestPayslip.netAmount)}
                  </span>
                </div>

                {latestPayslip.paymentStatus === 'paid' && latestPayslip.paymentDate && (
                  <div className="text-[10px] text-[#52b788] font-medium pt-1 border-t border-[#ece7dc] flex items-center justify-between">
                    <span>Paid on {latestPayslip.paymentDate}</span>
                    <span className="text-[10px] text-[#717b77] font-mono capitalize">
                      via {latestPayslip.paymentMethod?.replace('_', ' ') || 'Bank'}
                    </span>
                  </div>
                )}
              </div>
            ) : (
              <div className="mt-4 p-5 rounded-xl bg-[#faf9f5] border border-[#ece7dc] text-xs text-[#717b77] text-center">
                <CreditCard className="w-8 h-8 text-[#ded8cb] mx-auto mb-2" />
                <p className="font-semibold text-[#1c2120]">No published payslips yet</p>
                <p className="text-[11px] text-[#8e9894] mt-0.5">
                  When payroll is calculated or marked paid by HR, your payslip will appear here.
                </p>
              </div>
            )}
          </div>

          <div className="mt-4 pt-3 border-t border-[#f0ece1] flex items-center gap-2">
            {latestPayslip && (
              <>
                <button
                  onClick={() => setPreviewItem(latestPayslip)}
                  className="py-2 px-3 rounded-xl bg-[#f4f1ea] hover:bg-[#eae6dc] text-[#1c2120] font-semibold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>View Details</span>
                </button>
                <button
                  onClick={handleDownloadLatestPayslip}
                  className="flex-1 py-2 px-3 rounded-xl bg-[#CAA05C] hover:bg-[#ba904c] text-[#171c1b] font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-xs"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>PDF Payslip</span>
                </button>
              </>
            )}
            <button
              onClick={() => goTo('payroll')}
              className="py-2 px-3 rounded-xl bg-[#f4f1ea] hover:bg-[#eae6dc] text-[#1c2120] font-semibold text-xs cursor-pointer"
            >
              All Slips →
            </button>
          </div>
        </div>
      </div>

      {/* Payslip Details Modal */}
      {previewItem && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 border border-[#ded8cb] shadow-2xl animate-in zoom-in-95 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-[#f0ece1]">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-[#faf7f0] border border-[#ebd8b7] flex items-center justify-center text-[#CAA05C]">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-[#1c2120]">Salary Payslip Statement</h3>
                  <p className="text-xs text-[#717b77]">
                    Period: {getPeriodLabel(previewItem)} • Confidential
                  </p>
                </div>
              </div>
              <button
                onClick={() => setPreviewItem(null)}
                className="text-stone-400 hover:text-stone-700 cursor-pointer p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="my-5 p-5 bg-[#faf9f5] rounded-xl border border-[#ece7dc] space-y-4 text-xs">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pb-3 border-b border-[#ece7dc]">
                <div>
                  <p className="text-[10px] text-[#717b77] uppercase font-bold">Employee</p>
                  <p className="font-bold text-[#1c2120] text-sm mt-0.5">{previewItem.employeeName}</p>
                  <p className="text-[11px] font-mono text-[#8f6927] font-bold">{previewItem.employeeCode}</p>
                </div>
                <div>
                  <p className="text-[10px] text-[#717b77] uppercase font-bold">Designation</p>
                  <p className="font-semibold text-[#1c2120] mt-0.5">{previewItem.designationTitle}</p>
                  <p className="text-[11px] text-[#717b77]">{previewItem.departmentName}</p>
                </div>
                <div>
                  <p className="text-[10px] text-[#717b77] uppercase font-bold">Attendance</p>
                  <p className="font-semibold text-[#1c2120] mt-0.5">
                    {previewItem.presentDays} Present / {previewItem.workingDays} Days
                  </p>
                  <p className="text-[11px] text-[#717b77]">{previewItem.lateDays} Late Days</p>
                </div>
                <div>
                  <p className="text-[10px] text-[#717b77] uppercase font-bold">Payment Status</p>
                  <span
                    className={`inline-block mt-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                      previewItem.paymentStatus === 'paid'
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                        : 'bg-amber-50 text-amber-800 border-amber-200'
                    }`}
                  >
                    {previewItem.paymentStatus === 'paid' ? '✓ PAID' : 'PENDING'}
                  </span>
                  {previewItem.paymentDate && (
                    <p className="text-[10px] text-[#717b77] mt-0.5 font-mono">{previewItem.paymentDate}</p>
                  )}
                </div>
              </div>

              {/* Financial Breakdown */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Earnings */}
                <div className="p-3.5 rounded-xl bg-white border border-[#ece7dc] space-y-2">
                  <p className="font-bold text-xs text-[#1b4332] pb-1 border-b border-[#f0ece1]">
                    Earnings & Allowances
                  </p>
                  <div className="flex justify-between">
                    <span className="text-[#646e6a]">Basic Salary</span>
                    <span className="font-mono font-medium">{formatBDT(previewItem.basicSalary)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#646e6a]">Allowances Total</span>
                    <span className="font-mono font-medium">{formatBDT(previewItem.allowancesTotal)}</span>
                  </div>
                  {previewItem.overtimePay > 0 && (
                    <div className="flex justify-between text-[#1b4332]">
                      <span>Overtime Pay ({previewItem.overtimeHours} hrs)</span>
                      <span className="font-mono font-bold">{formatBDT(previewItem.overtimePay)}</span>
                    </div>
                  )}
                  {previewItem.bonusAmount > 0 && (
                    <div className="flex justify-between text-[#1b4332]">
                      <span>Bonus / Incentives</span>
                      <span className="font-mono font-bold">{formatBDT(previewItem.bonusAmount)}</span>
                    </div>
                  )}
                  <div className="pt-2 border-t border-[#f0ece1] flex justify-between font-bold text-[#1c2120]">
                    <span>Gross Earnings</span>
                    <span className="font-mono">{formatBDT(previewItem.grossAmount)}</span>
                  </div>
                </div>

                {/* Deductions */}
                <div className="p-3.5 rounded-xl bg-white border border-[#ece7dc] space-y-2">
                  <p className="font-bold text-xs text-amber-900 pb-1 border-b border-[#f0ece1]">
                    Deductions & Recoveries
                  </p>
                  <div className="flex justify-between">
                    <span className="text-[#646e6a]">Unpaid Absence / Leave</span>
                    <span className="font-mono text-amber-800">{formatBDT(previewItem.unpaidDeduction)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#646e6a]">Late Arrival Penalties</span>
                    <span className="font-mono text-amber-800">{formatBDT(previewItem.latePenaltyDeduction)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#646e6a]">Salary Advance Recovery</span>
                    <span className="font-mono text-amber-800">{formatBDT(previewItem.advanceRecoveryDeduction)}</span>
                  </div>
                  <div className="pt-2 border-t border-[#f0ece1] flex justify-between font-bold text-amber-900">
                    <span>Total Deductions</span>
                    <span className="font-mono">{formatBDT(previewItem.totalDeductions)}</span>
                  </div>
                </div>
              </div>

              {/* Net Salary Highlight */}
              <div className="p-4 rounded-xl bg-[#171c1b] border-2 border-[#CAA05C] text-white flex items-center justify-between shadow-sm">
                <div>
                  <p className="text-[11px] text-[#CAA05C] uppercase font-bold tracking-wider">
                    Net Salary Disbursed (BDT)
                  </p>
                  <p className="text-2xl font-bold font-mono mt-0.5">{formatBDT(previewItem.netAmount)}</p>
                  {previewItem.paymentReference && (
                    <p className="text-[10px] text-stone-300 mt-0.5 font-mono">
                      Ref: {previewItem.paymentReference} ({previewItem.paymentMethod?.replace('_', ' ') || 'Bank'})
                    </p>
                  )}
                </div>
                <button
                  onClick={() => {
                    const org = db.getSettings().organization;
                    const doc = generatePayslipPDF(previewItem, org);
                    doc.save(`Studio_Matra_Payslip_${employee.employeeCode}_${previewItem.payrollRunId}.pdf`);
                  }}
                  className="px-4 py-2 rounded-xl bg-[#CAA05C] hover:bg-[#ba904c] text-[#171c1b] font-bold text-xs flex items-center gap-2 cursor-pointer transition-colors shadow-xs"
                >
                  <Download className="w-4 h-4" />
                  <span>Download Official PDF</span>
                </button>
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t border-[#f0ece1]">
              <button
                onClick={() => setPreviewItem(null)}
                className="px-4 py-2 rounded-xl bg-[#f4f1ea] hover:bg-[#eae6dc] text-xs font-semibold text-[#1c2120] cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
