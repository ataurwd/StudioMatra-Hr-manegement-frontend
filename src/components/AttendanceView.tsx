import React, { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  Calendar,
  CalendarCheck,
  CalendarDays,
  CheckCircle2,
  Clock,
  Filter,
  History,
  Lock,
  PlusCircle,
  Search,
  ShieldCheck,
  UserCheck,
  Wifi,
  X,
} from 'lucide-react';
import { db } from '../db/database';
import { AttendanceSession, Employee, RoleName, User } from '../types';
import { formatMinutes } from '../utils/attendanceCalculator';
import { canManageAttendance, hasPermission } from '../utils/permissions';
import { AttendanceCalendarView } from './AttendanceCalendarView';
import { AdminAttendanceEditModal } from './AdminAttendanceEditModal';

interface AttendanceViewProps {
  currentUser: User;
  isOfficeNetwork: boolean;
  setIsOfficeNetwork: (val: boolean) => void;
  onOpenKiosk: () => void;
}

export const AttendanceView: React.FC<AttendanceViewProps> = ({
  currentUser,
  isOfficeNetwork,
  setIsOfficeNetwork,
  onOpenKiosk,
}) => {
  const isEmployeeRole = currentUser.role === 'employee';
  const currentEmp = db.getEmployeeByUserId(currentUser.id);
  const canManage = canManageAttendance(currentUser.role);
  const isDeptManager = currentUser.role === 'department_manager';

  const [searchParams] = useSearchParams();
  const urlTab = searchParams.get('tab');
  const initialTab =
    urlTab && ['calendar', 'register', 'missing', 'network'].includes(urlTab)
      ? (urlTab as 'calendar' | 'register' | 'missing' | 'network')
      : isEmployeeRole
      ? 'calendar'
      : 'register';

  const [activeTab, setActiveTab] = useState<'calendar' | 'register' | 'missing' | 'network'>(initialTab);

  useEffect(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam && ['calendar', 'register', 'missing', 'network'].includes(tabParam)) {
      setActiveTab(tabParam as any);
    }
  }, [searchParams]);

  const [selectedDate, setSelectedDate] = useState<string>(
    new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Dhaka' }).format(new Date())
  );
  const [selectedDepartment, setSelectedDepartment] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [adminEditTarget, setAdminEditTarget] = useState<{
    date: string;
    employee: Employee;
    session?: AttendanceSession;
  } | null>(null);

  const employees = db.getEmployees();
  const departments = db.getDepartments();
  const allSessions = db.getAttendanceSessions();
  const missingPunches = allSessions.filter((s) => {
    if (isEmployeeRole && currentEmp) {
      return s.employeeId === currentEmp.id && s.isMissingPunch;
    }
    return s.isMissingPunch;
  });

  // Filter sessions
  const filteredSessions = allSessions.filter((s) => {
    if (isEmployeeRole && currentEmp && s.employeeId !== currentEmp.id) return false;
    if (selectedDate && s.attendanceDate !== selectedDate) return false;
    if (selectedStatus !== 'all' && s.computedStatus !== selectedStatus) return false;

    const emp = db.getEmployeeById(s.employeeId);
    if (!emp) return false;

    if (selectedDepartment !== 'all' && emp.departmentId !== selectedDepartment) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      if (!emp.fullName.toLowerCase().includes(q) && !emp.employeeCode.toLowerCase().includes(q)) {
        return false;
      }
    }
    return true;
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header Bar */}
      <div className="bg-white rounded-2xl p-6 border border-[#e8e4da] shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs uppercase font-bold tracking-wider text-[#8f6927] bg-[#f7efe0] border border-[#ebd8b7] px-2.5 py-0.5 rounded-full">
              Office Attendance Only
            </span>
            <span className="text-xs text-[#78827f]">• Privacy Protected (No GPS / Biometrics)</span>
          </div>
          <h1 className="text-2xl font-serif font-bold text-[#1c2120]">Studio Attendance Center</h1>
          <p className="text-xs text-[#6e7774] mt-0.5">
            Authoritative check-in/out records, missing punch audit, and studio attendance management
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {currentUser.role === 'super_admin' && (
            <Link
              to="/staff-attendance"
              className="px-3.5 py-2 rounded-xl bg-[#fcf8f0] hover:bg-[#f7efe0] text-[#8e6826] text-xs font-bold flex items-center gap-1.5 transition-colors border border-[#ebd8b7] shadow-2xs"
            >
              <CalendarCheck className="w-4 h-4 text-[#CAA05C]" />
              <span>Staff Monthly Console</span>
            </Link>
          )}
          <button
            onClick={onOpenKiosk}
            className="px-4 py-2 rounded-xl bg-[#1c2120] hover:bg-[#28322f] text-white text-xs font-semibold flex items-center gap-2 transition-colors cursor-pointer shadow-xs border border-[#353d3a]"
          >
            <Clock className="w-4 h-4 text-[#CAA05C]" />
            <span>Launch Kiosk Terminal</span>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-[#e5e1d8] text-xs font-semibold gap-1">
        {(currentEmp || canManage) && (
          <button
            onClick={() => setActiveTab('calendar')}
            className={`px-4 py-2.5 rounded-t-xl transition-colors cursor-pointer flex items-center gap-2 ${
              activeTab === 'calendar'
                ? 'bg-white text-[#CAA05C] border-t-2 border-t-[#CAA05C] border-x border-[#e8e4da] font-bold'
                : 'text-[#6e7874] hover:text-[#1c2120]'
            }`}
          >
            <CalendarDays className="w-4 h-4 text-[#CAA05C]" />
            <span>{canManage ? 'Monthly Attendance Calendar & Management' : 'My Attendance Calendar'}</span>
            {canManage && (
              <span className="px-1.5 py-0.2 rounded-full bg-[#CAA05C] text-[#171c1b] font-bold text-[10px]">
                Audit & Edit
              </span>
            )}
          </button>
        )}

        <button
          onClick={() => setActiveTab('register')}
          className={`px-4 py-2.5 rounded-t-xl transition-colors cursor-pointer flex items-center gap-2 ${
            activeTab === 'register'
              ? 'bg-white text-[#CAA05C] border-t-2 border-t-[#CAA05C] border-x border-[#e8e4da] font-bold'
              : 'text-[#6e7874] hover:text-[#1c2120]'
          }`}
        >
          <Calendar className="w-4 h-4" />
          <span>Daily Attendance Register</span>
        </button>

        <button
          onClick={() => setActiveTab('missing')}
          className={`px-4 py-2.5 rounded-t-xl transition-colors cursor-pointer flex items-center gap-2 ${
            activeTab === 'missing'
              ? 'bg-white text-[#CAA05C] border-t-2 border-t-[#CAA05C] border-x border-[#e8e4da] font-bold'
              : 'text-[#6e7874] hover:text-[#1c2120]'
          }`}
        >
          <AlertTriangle className="w-4 h-4 text-amber-700" />
          <span>Missing Punches</span>
          {missingPunches.length > 0 && (
            <span className="px-1.5 py-0.2 rounded-full bg-amber-100 text-amber-900 font-bold text-[10px]">
              {missingPunches.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('network')}
          className={`px-4 py-2.5 rounded-t-xl transition-colors cursor-pointer flex items-center gap-2 ${
            activeTab === 'network'
              ? 'bg-white text-[#CAA05C] border-t-2 border-t-[#CAA05C] border-x border-[#e8e4da] font-bold'
              : 'text-[#6e7874] hover:text-[#1c2120]'
          }`}
        >
          <Wifi className="w-4 h-4" />
          <span>Network Policy</span>
        </button>
      </div>

      {/* Tab 0: Monthly Attendance Calendar & Register */}
      {activeTab === 'calendar' && (currentEmp || canManage) && (
        <AttendanceCalendarView
          employeeId={currentEmp?.id}
          currentUser={currentUser}
          allowEmployeeSwitch={canManage}
        />
      )}

      {/* Tab 1: Daily Register */}
      {activeTab === 'register' && (
        <div className="space-y-4">
          {/* Filters Bar */}
          <div className="bg-white p-4 rounded-2xl border border-[#e8e4da] shadow-2xs flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex flex-wrap items-center gap-3">
              <div>
                <label className="block text-[10px] uppercase font-bold text-[#717b77] mb-1">
                  Attendance Date
                </label>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="px-3 py-1.5 rounded-lg border border-[#ded8cb] bg-[#faf9f5] font-mono text-xs focus:outline-none focus:border-[#1b4332]"
                />
              </div>

              {!isEmployeeRole && (
                <div>
                  <label className="block text-[10px] uppercase font-bold text-[#717b77] mb-1">
                    Department
                  </label>
                  <select
                    value={selectedDepartment}
                    onChange={(e) => setSelectedDepartment(e.target.value)}
                    className="px-3 py-1.5 rounded-lg border border-[#ded8cb] bg-[#faf9f5] text-xs focus:outline-none focus:border-[#1b4332]"
                  >
                    <option value="all">All Departments</option>
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-[10px] uppercase font-bold text-[#717b77] mb-1">Status</label>
                <select
                  value={selectedStatus}
                  onChange={(e) => setSelectedStatus(e.target.value)}
                  className="px-3 py-1.5 rounded-lg border border-[#ded8cb] bg-[#faf9f5] text-xs focus:outline-none focus:border-[#1b4332]"
                >
                  <option value="all">All Statuses</option>
                  <option value="present">Present</option>
                  <option value="late">Late Arrival</option>
                  <option value="half_day">Half Day</option>
                  <option value="paid_leave">Paid Leave</option>
                  <option value="missing_punch">Missing Punch</option>
                  <option value="absent">Absent</option>
                </select>
              </div>
            </div>

            {!isEmployeeRole && (
              <div className="w-full sm:w-64">
                <label className="block text-[10px] uppercase font-bold text-[#717b77] mb-1">
                  Search Employee
                </label>
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-[#8a9490]" />
                  <input
                    type="text"
                    placeholder="Search name or SM code..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-[#ded8cb] bg-[#faf9f5] text-xs focus:outline-none focus:border-[#1b4332]"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Table */}
          <div className="bg-white rounded-2xl border border-[#e8e4da] overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#f9f8f4] text-[#6d7572] uppercase font-bold text-[10px] border-b border-[#f0ece1]">
                  <tr>
                    <th className="py-3 px-4">Employee</th>
                    <th className="py-3 px-4">Department</th>
                    <th className="py-3 px-4">Check-In</th>
                    <th className="py-3 px-4">Check-Out</th>
                    <th className="py-3 px-4">Break Deducted</th>
                    <th className="py-3 px-4">Net Worked</th>
                    <th className="py-3 px-4">Late Minutes</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#f2eee6] text-[#2c3330]">
                  {filteredSessions.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-10 text-center text-[#8e9894]">
                        No attendance sessions matched this filter for {selectedDate}.
                      </td>
                    </tr>
                  ) : (
                    filteredSessions.map((s) => {
                      const emp = db.getEmployeeById(s.employeeId);
                      const dept = db.getDepartments().find((d) => d.id === emp?.departmentId);

                      return (
                        <tr key={s.id} className="hover:bg-[#faf9f5]">
                          <td className="py-3 px-4">
                            <div className="font-semibold text-[#1c2120]">{emp?.fullName}</div>
                            <div className="text-[10px] text-[#78827e] font-mono">{emp?.employeeCode}</div>
                          </td>
                          <td className="py-3 px-4 text-[#505a56]">{dept?.name}</td>
                          <td className="py-3 px-4 font-mono font-medium">
                            {new Date(s.checkInAt).toLocaleTimeString('en-US', { timeZone: 'Asia/Dhaka' })}
                          </td>
                          <td className="py-3 px-4 font-mono text-[#505a56]">
                            {s.checkOutAt
                              ? new Date(s.checkOutAt).toLocaleTimeString('en-US', { timeZone: 'Asia/Dhaka' })
                              : '—'}
                          </td>
                          <td className="py-3 px-4 text-[#757f7b]">{s.breakMinutes}m</td>
                          <td className="py-3 px-4 font-bold text-[#1b4332]">
                            {formatMinutes(s.workedMinutes)}
                          </td>
                          <td className="py-3 px-4 text-[#757f7b]">
                            {s.lateMinutes > 0 ? (
                              <span className="text-amber-800 font-bold">{s.lateMinutes}m Late</span>
                            ) : (
                              '0m'
                            )}
                          </td>
                          <td className="py-3 px-4">
                            <span
                              className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                                s.computedStatus === 'present'
                                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                                  : s.computedStatus === 'late'
                                  ? 'bg-amber-50 text-amber-800 border border-amber-200'
                                  : s.computedStatus === 'half_day'
                                  ? 'bg-blue-50 text-blue-800 border border-blue-200'
                                  : s.computedStatus === 'missing_punch'
                                  ? 'bg-red-50 text-red-800 border border-red-200'
                                  : 'bg-stone-100 text-stone-700'
                              }`}
                            >
                              {s.computedStatus.replace('_', ' ')}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right">
                            {canManage && (
                              <button
                                onClick={() => {
                                  if (emp) {
                                    setAdminEditTarget({
                                      date: s.attendanceDate,
                                      employee: emp,
                                      session: s,
                                    });
                                  }
                                }}
                                className="px-2.5 py-1 rounded bg-[#f4f1ea] hover:bg-[#eae6dc] text-[#1c2120] font-medium text-[11px] transition-colors cursor-pointer"
                              >
                                Edit Record
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Missing Punches */}
      {activeTab === 'missing' && (
        <div className="space-y-4">
          <div className="p-4 bg-amber-50 rounded-2xl border border-amber-200 text-amber-900 text-xs flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">Authoritative Missing Punch Policy:</p>
              <p className="mt-0.5 text-amber-800">
                When an employee forgets to check out, the system does not invent a departure time.
                Instead, it marks the record as Missing Punch and halts automatic overtime calculation.
                Employees or HR must submit a verifiable correction request with documented reason.
              </p>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-[#e8e4da] overflow-hidden shadow-xs">
            <div className="p-5 border-b border-[#f0ece1]">
              <h3 className="font-bold text-sm text-[#1c2120]">Unresolved Missing Checkout Sessions</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#f9f8f4] text-[#6d7572] uppercase font-bold text-[10px] border-b border-[#f0ece1]">
                  <tr>
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-4">Employee</th>
                    <th className="py-3 px-4">Check-In Time</th>
                    <th className="py-3 px-4">Check-Out Status</th>
                    <th className="py-3 px-4">Source Channel</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#f2eee6] text-[#2c3330]">
                  {missingPunches.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-[#7d8783]">
                        No open missing punches. All past sessions closed cleanly.
                      </td>
                    </tr>
                  ) : (
                    missingPunches.map((s) => {
                      const emp = db.getEmployeeById(s.employeeId);
                      return (
                        <tr key={s.id} className="hover:bg-[#faf9f5]">
                          <td className="py-3 px-4 font-mono font-bold text-[#1c2120]">
                            {s.attendanceDate}
                          </td>
                          <td className="py-3 px-4">
                            <span className="font-semibold text-[#1c2120]">{emp?.fullName}</span>
                            <span className="text-[10px] text-[#78827e] font-mono ml-2">
                              {emp?.employeeCode}
                            </span>
                          </td>
                          <td className="py-3 px-4 font-mono">
                            {new Date(s.checkInAt).toLocaleTimeString('en-US', { timeZone: 'Asia/Dhaka' })}
                          </td>
                          <td className="py-3 px-4">
                            <span className="px-2 py-0.5 rounded-full bg-red-100 text-red-800 font-bold text-[10px]">
                              Missing Check-Out
                            </span>
                          </td>
                          <td className="py-3 px-4 capitalize text-[#78827e]">{s.sourceType.replace('_', ' ')}</td>
                          <td className="py-3 px-4 text-right">
                            {canManage && emp ? (
                              <button
                                onClick={() => {
                                  setAdminEditTarget({
                                    date: s.attendanceDate,
                                    employee: emp,
                                    session: s,
                                  });
                                }}
                                className="px-3 py-1.5 rounded-lg bg-[#CAA05C] hover:bg-[#ba904c] text-[#171c1b] font-bold text-xs transition-colors cursor-pointer"
                              >
                                Audit & Resolve
                              </button>
                            ) : (
                              <span className="text-stone-400 text-xs">Awaiting Admin Audit</span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: Office Network Policy Simulator */}
      {activeTab === 'network' && (
        <div className="bg-white rounded-2xl p-6 border border-[#e8e4da] shadow-xs space-y-6">
          <div>
            <h3 className="font-bold text-base text-[#1c2120]">Office Network Verification Policy</h3>
            <p className="text-xs text-[#717b77] mt-1">
              Method 2 of Studio Matra Attendance Verification ensures employees can only punch in/out
              from authorized corporate routers or IP subnets.
            </p>
          </div>

          <div className="p-5 rounded-xl bg-[#faf9f5] border border-[#ece7dc] space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#ded8cb]">
              <div className="flex items-center gap-3">
                <Wifi className={`w-5 h-5 ${isOfficeNetwork ? 'text-[#1b4332]' : 'text-stone-400'}`} />
                <div>
                  <p className="font-bold text-sm text-[#1c2120]">Studio Fiber Primary (Banani Floor 4)</p>
                  <p className="text-xs text-[#717b77]">Subnet CIDR: 192.168.1.0/24</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span
                  className={`text-xs px-2.5 py-1 rounded-full font-bold ${
                    isOfficeNetwork
                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                      : 'bg-stone-200 text-stone-700'
                  }`}
                >
                  {isOfficeNetwork ? 'CONNECTED & AUTHORIZED' : 'EXTERNAL / DISCONNECTED'}
                </span>
                <button
                  onClick={() => setIsOfficeNetwork(!isOfficeNetwork)}
                  className="px-3 py-1.5 rounded-lg bg-[#1c2120] text-white text-xs font-semibold hover:bg-[#2c3532] cursor-pointer"
                >
                  Toggle Network Simulation
                </button>
              </div>
            </div>

            <p className="text-xs text-[#6e7774]">
              Note: When disconnected, employee self-service check-in will be rejected with an office policy
              warning, prompting the employee to connect to the studio router or check in via the reception
              kiosk terminal.
            </p>
          </div>
        </div>
      )}

      {/* Admin Attendance Audit & Override Modal */}
      {adminEditTarget && (
        <AdminAttendanceEditModal
          isOpen={!!adminEditTarget}
          onClose={() => setAdminEditTarget(null)}
          dateStr={adminEditTarget.date}
          employee={adminEditTarget.employee}
          existingSession={adminEditTarget.session}
          currentUser={currentUser}
          onSaved={() => {
            setAdminEditTarget(null);
          }}
        />
      )}
    </div>
  );
};
