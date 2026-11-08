import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowRight,
  Briefcase,
  Calendar,
  CalendarDays,
  CheckCircle2,
  Clock,
  Compass,
  DollarSign,
  LayoutDashboard,
  TrendingUp,
  UserCheck,
  Users,
  Wallet,
} from 'lucide-react';
import { db } from '../db/database';
import { RoleName, User } from '../types';
import { canViewSalary } from '../utils/permissions';
import { formatBDT } from '../utils/money';
import { KioskPinCard } from './common/KioskPinCard';
import { AttendanceCalendarView } from './AttendanceCalendarView';

interface AdminDashboardProps {
  currentUser: User;
  onNavigate?: (tab: string) => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ currentUser, onNavigate }) => {
  const navigate = useNavigate();
  const goTo = (tab: string) => {
    if (onNavigate) {
      onNavigate(tab);
    } else {
      navigate(tab.startsWith('/') ? tab : `/${tab}`);
    }
  };
  const employees = db.getEmployees().filter((e) => e.employmentStatus === 'active' || e.employmentStatus === 'probationary');
  const departments = db.getDepartments();
  const shifts = db.getShifts();

  const todayDhaka = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Dhaka' }).format(new Date());
  const todaySessions = db.getAttendanceSessions({ startDate: todayDhaka, endDate: todayDhaka });

  // Real KPI metrics from database
  let presentToday = 0;
  let lateToday = 0;
  let absentToday = 0;
  let leaveToday = 0;

  for (const s of todaySessions) {
    if (s.computedStatus === 'present') presentToday++;
    else if (s.computedStatus === 'late') { presentToday++; lateToday++; }
    else if (s.computedStatus === 'half_day') presentToday += 0.5;
    else if (s.computedStatus === 'paid_leave' || s.computedStatus === 'unpaid_leave') leaveToday++;
    else if (s.computedStatus === 'absent' || s.computedStatus === 'missing_punch') absentToday++;
  }

  // Those who haven't checked in yet today and are not on leave
  const activeUnchecked = Math.max(0, employees.length - presentToday - leaveToday - absentToday);

  // Missing Punches across all time
  const missingPunches = db.getAttendanceSessions().filter((s) => s.isMissingPunch);

  // Pending Requests
  const pendingLeaves = db.getLeaveRequests().filter((r) => r.status === 'pending' || r.status === 'manager_approved');
  const pendingCorrections = db.getCorrectionRequests().filter((c) => c.status === 'submitted' || c.status === 'manager_reviewed');

  // Payroll Metrics (Strictly for Super Admin and Finance Manager)
  const isAuthorizedFinance = canViewSalary(currentUser.role);
  const latestPayrollRun = db.getPayrollRuns()[0];
  const payrollItems = latestPayrollRun ? db.getPayrollItems(latestPayrollRun.id) : [];

  const totalGrossPayroll = latestPayrollRun?.totalGross || 0;
  const totalDeductionsPayroll = latestPayrollRun?.totalDeductions || 0;
  const totalNetPayroll = latestPayrollRun?.totalNet || 0;

  const paidCount = payrollItems.filter((i) => i.paymentStatus === 'paid').length;
  const totalItemsCount = payrollItems.length;

  const [dashboardView, setDashboardView] = useState<'overview' | 'my_attendance'>('overview');
  const currentEmp = currentUser.employeeId
    ? db.getEmployeeById(currentUser.employeeId)
    : db.getEmployeeByUserId(currentUser.id);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Top Banner */}
      <div className="bg-white rounded-2xl p-6 border border-[#e8e4da] shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <span className="text-xs uppercase font-bold tracking-wider text-[#8f6927] bg-[#f7efe0] border border-[#ebd8b7] px-2.5 py-0.5 rounded-full">
            Executive Operations Center
          </span>
          <h1 className="text-2xl font-serif font-bold text-[#1c2120] mt-1.5">
            Studio Matra Operations & Human Resources
          </h1>
          <p className="text-xs text-[#6e7774]">
            Authoritative office attendance, leave approvals, and payroll administration
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => goTo('attendance')}
            className="px-4 py-2 rounded-xl bg-[#CAA05C] hover:bg-[#ba904c] text-[#171c1b] text-xs font-bold flex items-center gap-2 transition-colors cursor-pointer shadow-xs"
          >
            <Clock className="w-4 h-4 text-[#171c1b]" />
            <span>Attendance Register</span>
          </button>
          <button
            onClick={() => goTo('employees')}
            className="px-4 py-2 rounded-xl bg-[#f4f1ea] hover:bg-[#eae6dc] text-[#1c2120] text-xs font-semibold flex items-center gap-2 transition-colors cursor-pointer"
          >
            <Users className="w-4 h-4" />
            <span>Directory</span>
          </button>
        </div>
      </div>

      {/* View Switcher Tabs (Studio Overview vs Personal Attendance) */}
      <div className="flex items-center gap-2 border-b border-[#e8e4da] pb-3">
        <button
          onClick={() => setDashboardView('overview')}
          className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
            dashboardView === 'overview'
              ? 'bg-[#171c1b] text-white shadow-xs'
              : 'bg-white text-[#65716c] hover:bg-[#f4f1ea]'
          }`}
        >
          <LayoutDashboard className="w-4 h-4 text-[#CAA05C]" />
          <span>Studio Executive Overview</span>
        </button>

        <button
          onClick={() => setDashboardView('my_attendance')}
          className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
            dashboardView === 'my_attendance'
              ? 'bg-[#171c1b] text-white shadow-xs'
              : 'bg-white text-[#65716c] hover:bg-[#f4f1ea]'
          }`}
        >
          <CalendarDays className="w-4 h-4 text-[#CAA05C]" />
          <span>My Personal Attendance & Kiosk PIN</span>
          <span className="w-2 h-2 rounded-full bg-[#CAA05C]" />
        </button>
      </div>

      {dashboardView === 'my_attendance' ? (
        /* My Personal Attendance & Kiosk PIN Tab */
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <KioskPinCard currentUser={currentUser} onNavigate={goTo} className="lg:col-span-1" />

            <div className="lg:col-span-2 bg-white rounded-2xl p-6 border border-[#e8e4da] shadow-xs flex flex-col justify-between">
              <div>
                <span className="text-[11px] uppercase font-bold text-[#8f6927] bg-[#f7efe0] border border-[#ebd8b7] px-2.5 py-0.5 rounded-full">
                  Executive Staff Profile
                </span>
                <h3 className="text-xl font-serif font-bold text-[#1c2120] mt-2">
                  {currentEmp?.fullName || currentUser.fullName}
                </h3>
                <p className="text-xs text-[#717b77] mt-0.5">
                  Code: <strong className="text-[#1c2120]">{currentEmp?.employeeCode || 'ADMIN'}</strong> • Email: {currentUser.email} • Role: {currentUser.role.replace('_', ' ').toUpperCase()}
                </p>

                <div className="mt-4 p-4 bg-[#faf9f5] rounded-xl border border-[#ece7dc] space-y-1.5 text-xs text-[#525d59]">
                  <p className="font-bold text-[#1c2120]">Kiosk PIN Management Policy:</p>
                  <p>
                    As a Studio Administrator, you have full authority to update staff PIN codes in the <strong>Studio Directory</strong>. Your own personal PIN is displayed on the left and can be used on the Banani reception terminal.
                  </p>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-[#f0ece1] flex items-center gap-2">
                <button
                  onClick={() => goTo('employees')}
                  className="px-4 py-2 bg-[#CAA05C] hover:bg-[#ba904c] rounded-xl text-xs font-bold text-[#171c1b] cursor-pointer"
                >
                  Manage All Staff PINs in Directory →
                </button>
              </div>
            </div>
          </div>

          {currentEmp && (
            <AttendanceCalendarView
              employeeId={currentEmp.id}
              currentUser={currentUser}
              onRequestCorrection={() => goTo('attendance')}
            />
          )}
        </div>
      ) : (
        /* Executive Overview Tab */
        <div className="space-y-6">

      {/* Summary KPI Cards Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-[#e8e4da] shadow-xs">
          <div className="flex items-center justify-between text-[#7d8783]">
            <span className="text-xs font-semibold">Active Staff</span>
            <Users className="w-4 h-4 text-[#CAA05C]" />
          </div>
          <p className="text-3xl font-bold text-[#1c2120] mt-2">{employees.length}</p>
          <p className="text-[11px] text-[#717b77] mt-1">Across 6 departments</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-[#e8e4da] shadow-xs">
          <div className="flex items-center justify-between text-[#7d8783]">
            <span className="text-xs font-semibold">Present Today</span>
            <UserCheck className="w-4 h-4 text-emerald-700" />
          </div>
          <p className="text-3xl font-bold text-emerald-800 mt-2">{presentToday}</p>
          <p className="text-[11px] text-emerald-700 mt-1">
            {lateToday > 0 ? `${lateToday} arrived late` : 'All on schedule'}
          </p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-[#e8e4da] shadow-xs">
          <div className="flex items-center justify-between text-[#7d8783]">
            <span className="text-xs font-semibold">On Leave Today</span>
            <Calendar className="w-4 h-4 text-teal-700" />
          </div>
          <p className="text-3xl font-bold text-teal-800 mt-2">{leaveToday}</p>
          <p className="text-[11px] text-[#717b77] mt-1">Approved absence</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-[#e8e4da] shadow-xs">
          <div className="flex items-center justify-between text-[#7d8783]">
            <span className="text-xs font-semibold">Missing Punches</span>
            <AlertTriangle className="w-4 h-4 text-amber-700" />
          </div>
          <p className="text-3xl font-bold text-amber-800 mt-2">{missingPunches.length}</p>
          <p className="text-[11px] text-amber-700 mt-1">Requires HR resolution</p>
        </div>
      </div>

      {/* Approvals, Financials & Kiosk PIN Card Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Action Items / Approvals Alert Box */}
          {(pendingLeaves.length > 0 || pendingCorrections.length > 0) && (
            <div className="bg-[#fffbf0] border border-[#f5e3b5] rounded-2xl p-5 shadow-xs">
              <div className="flex items-center gap-2 mb-3">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-600 animate-pulse" />
                <h3 className="font-bold text-sm text-amber-950">Pending Manager & HR Approvals</h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                {pendingLeaves.length > 0 && (
                  <div
                    onClick={() => goTo('leave')}
                    className="p-3.5 bg-white rounded-xl border border-[#f0deae] hover:border-amber-400 transition-colors cursor-pointer flex items-center justify-between"
                  >
                    <div>
                      <p className="font-bold text-amber-900">{pendingLeaves.length} Leave Application(s) Pending</p>
                      <p className="text-[#717a76] text-[11px]">Requires manager recommendation & HR approval</p>
                    </div>
                    <ArrowRight className="w-4 h-4 text-amber-700" />
                  </div>
                )}

                {pendingCorrections.length > 0 && (
                  <div
                    onClick={() => goTo('attendance')}
                    className="p-3.5 bg-white rounded-xl border border-[#f0deae] hover:border-amber-400 transition-colors cursor-pointer flex items-center justify-between"
                  >
                    <div>
                      <p className="font-bold text-amber-900">
                        {pendingCorrections.length} Attendance Correction(s) Pending
                      </p>
                      <p className="text-[#717a76] text-[11px]">Audit and apply missing checkout corrections</p>
                    </div>
                    <ArrowRight className="w-4 h-4 text-amber-700" />
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Financial Overview (Strictly Role Gated) */}
          {isAuthorizedFinance && (
            <div className="bg-white rounded-2xl p-6 border border-[#e8e4da] shadow-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-[#f0ece1] gap-2">
                <div>
                  <span className="text-[11px] uppercase font-bold tracking-wider text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                    Confidential Finance Metrics
                  </span>
                  <h2 className="text-lg font-bold text-[#1c2120] mt-1">
                    Studio Matra Payroll Summary ({latestPayrollRun?.month}/{latestPayrollRun?.year})
                  </h2>
                </div>
                <button
                  onClick={() => goTo('payroll')}
                  className="text-xs font-semibold text-[#CAA05C] hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <span>Manage Payroll Runs</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mt-5">
                <div className="p-4 rounded-xl bg-[#faf9f5] border border-[#ece7dc]">
                  <span className="text-[11px] text-[#717b77] block">Gross Monthly Payroll</span>
                  <span className="text-xl font-bold text-[#1c2120] font-mono mt-1 block">
                    {formatBDT(totalGrossPayroll)}
                  </span>
                  <span className="text-[10px] text-[#7d8783]">Before deductions</span>
                </div>

                <div className="p-4 rounded-xl bg-[#faf9f5] border border-[#ece7dc]">
                  <span className="text-[11px] text-[#717b77] block">Total Deductions</span>
                  <span className="text-xl font-bold text-amber-800 font-mono mt-1 block">
                    {formatBDT(totalDeductionsPayroll)}
                  </span>
                  <span className="text-[10px] text-[#7d8783]">Advances & Unpaid Leaves</span>
                </div>

                <div className="p-4 rounded-xl bg-[#fcf8f0] border border-[#ebd8b7]">
                  <span className="text-[11px] text-[#8f6927] font-semibold block">Net Payable Payroll</span>
                  <span className="text-xl font-bold text-[#CAA05C] font-mono mt-1 block">
                    {formatBDT(totalNetPayroll)}
                  </span>
                  <span className="text-[10px] text-[#8f6927]">Authoritative BDT</span>
                </div>

                <div className="p-4 rounded-xl bg-[#faf9f5] border border-[#ece7dc]">
                  <span className="text-[11px] text-[#717b77] block">Disbursement Status</span>
                  <span className="text-xl font-bold text-[#1c2120] font-mono mt-1 block">
                    {paidCount} / {totalItemsCount} Paid
                  </span>
                  <span className="text-[10px] text-emerald-700 font-medium capitalize">
                    Run Status: {latestPayrollRun?.status || 'Draft'}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Kiosk PIN Card on Dashboard */}
        <div className="lg:col-span-1">
          <KioskPinCard currentUser={currentUser} onNavigate={goTo} />
        </div>
      </div>

      {/* Department Attendance Distribution Table */}
      <div className="bg-white rounded-2xl border border-[#e8e4da] overflow-hidden shadow-xs">
        <div className="p-5 border-b border-[#f0ece1] flex items-center justify-between">
          <div>
            <h3 className="font-bold text-sm text-[#1c2120]">Departmental Presence Overview</h3>
            <p className="text-xs text-[#717b77]">Live studio presence across architecture & interior design teams</p>
          </div>
          <span className="text-xs font-mono font-medium text-[#7d8783]">Dhaka Date: {todayDhaka}</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#f9f8f4] text-[#6d7572] uppercase font-bold text-[10px] border-b border-[#f0ece1]">
              <tr>
                <th className="py-3 px-4">Department</th>
                <th className="py-3 px-4">Total Members</th>
                <th className="py-3 px-4">Present Today</th>
                <th className="py-3 px-4">Late Arrivals</th>
                <th className="py-3 px-4">On Leave</th>
                <th className="py-3 px-4">Presence Rate</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f2eee6] text-[#2c3330]">
              {departments.map((dept) => {
                const deptEmps = employees.filter((e) => e.departmentId === dept.id);
                const deptSessions = todaySessions.filter((s) => {
                  const emp = employees.find((e) => e.id === s.employeeId);
                  return emp?.departmentId === dept.id;
                });

                const presentInDept = deptSessions.filter((s) => s.computedStatus === 'present' || s.computedStatus === 'late').length;
                const lateInDept = deptSessions.filter((s) => s.computedStatus === 'late').length;
                const leaveInDept = deptSessions.filter((s) => s.computedStatus === 'paid_leave' || s.computedStatus === 'unpaid_leave').length;
                const rate = deptEmps.length > 0 ? Math.round((presentInDept / deptEmps.length) * 100) : 0;

                return (
                  <tr key={dept.id} className="hover:bg-[#faf9f5]">
                    <td className="py-3 px-4 font-semibold text-[#1c2120]">
                      {dept.name} <span className="text-[10px] text-[#7d8783]">({dept.code})</span>
                    </td>
                    <td className="py-3 px-4 font-medium">{deptEmps.length}</td>
                    <td className="py-3 px-4 font-bold text-emerald-800">{presentInDept}</td>
                    <td className="py-3 px-4 text-amber-800">{lateInDept > 0 ? lateInDept : '—'}</td>
                    <td className="py-3 px-4 text-teal-800">{leaveInDept > 0 ? leaveInDept : '—'}</td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <div className="w-20 h-2 bg-[#f0ece1] rounded-full overflow-hidden">
                          <div
                            className="h-full bg-[#CAA05C] rounded-full"
                            style={{ width: `${rate}%` }}
                          />
                        </div>
                        <span className="font-mono text-xs font-bold text-[#1c2120]">{rate}%</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )}
</div>
  );
};
