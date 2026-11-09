import React, { useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  Calendar,
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
import { AttendanceCorrectionRequest, AttendanceSession, Employee, RoleName, User } from '../types';
import { formatMinutes } from '../utils/attendanceCalculator';
import { canManageAttendance, hasPermission } from '../utils/permissions';
import { AttendanceCalendarView } from './AttendanceCalendarView';

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

  const [activeTab, setActiveTab] = useState<'calendar' | 'register' | 'missing' | 'corrections' | 'network'>(
    isEmployeeRole ? 'calendar' : 'register'
  );
  const [selectedDate, setSelectedDate] = useState<string>(
    new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Dhaka' }).format(new Date())
  );
  const [selectedDepartment, setSelectedDepartment] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Correction Request Modals
  const [isSubmitModalOpen, setIsSubmitModalOpen] = useState(false);
  const [selectedSessionForCorrection, setSelectedSessionForCorrection] = useState<AttendanceSession | null>(null);
  const [correctionCheckIn, setCorrectionCheckIn] = useState('09:00');
  const [correctionCheckOut, setCorrectionCheckOut] = useState('18:00');
  const [correctionReason, setCorrectionReason] = useState('');
  const [modalError, setModalError] = useState('');
  const [modalSuccess, setModalSuccess] = useState('');

  // Review Modal
  const [reviewRequest, setReviewRequest] = useState<AttendanceCorrectionRequest | null>(null);
  const [reviewComment, setReviewComment] = useState('');

  const employees = db.getEmployees();
  const departments = db.getDepartments();
  const allSessions = db.getAttendanceSessions();
  const missingPunches = allSessions.filter((s) => {
    if (isEmployeeRole && currentEmp) {
      return s.employeeId === currentEmp.id && s.isMissingPunch;
    }
    return s.isMissingPunch;
  });

  const allCorrectionRequests = db.getCorrectionRequests(
    isEmployeeRole && currentEmp ? currentEmp.id : undefined
  );

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

  const handleOpenCorrection = (session: AttendanceSession) => {
    setSelectedSessionForCorrection(session);
    setCorrectionCheckIn(
      new Date(session.checkInAt).toLocaleTimeString('en-GB', {
        timeZone: 'Asia/Dhaka',
        hour: '2-digit',
        minute: '2-digit',
      })
    );
    setCorrectionCheckOut(
      session.checkOutAt
        ? new Date(session.checkOutAt).toLocaleTimeString('en-GB', {
            timeZone: 'Asia/Dhaka',
            hour: '2-digit',
            minute: '2-digit',
          })
        : '18:00'
    );
    setCorrectionReason('');
    setModalError('');
    setModalSuccess('');
    setIsSubmitModalOpen(true);
  };

  const handleSubmitCorrection = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSessionForCorrection) return;
    if (!correctionReason.trim()) {
      setModalError('Please specify the detailed operational reason for this correction.');
      return;
    }

    try {
      db.submitCorrectionRequest(
        {
          employeeId: selectedSessionForCorrection.employeeId,
          sessionId: selectedSessionForCorrection.id,
          attendanceDate: selectedSessionForCorrection.attendanceDate,
          requestedCheckIn: correctionCheckIn,
          requestedCheckOut: correctionCheckOut,
          reason: correctionReason,
        },
        { userId: currentUser.id, name: currentUser.fullName }
      );

      setModalSuccess('Attendance correction request submitted to HR for audit and approval.');
      setTimeout(() => {
        setIsSubmitModalOpen(false);
      }, 1500);
    } catch (err: any) {
      setModalError(err.message || 'Submission failed');
    }
  };

  const handleExecuteReview = (action: 'manager_reviewed' | 'apply' | 'reject') => {
    if (!reviewRequest) return;
    try {
      db.reviewCorrectionRequest({
        requestId: reviewRequest.id,
        action,
        comment: reviewComment,
        reviewer: { userId: currentUser.id, name: currentUser.fullName, role: currentUser.role },
      });
      setReviewRequest(null);
      setReviewComment('');
    } catch (err: any) {
      alert(err.message || 'Review failed');
    }
  };

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
            Authoritative check-in/out records, missing punch audit, and HR correction workflow
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
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
          onClick={() => setActiveTab('corrections')}
          className={`px-4 py-2.5 rounded-t-xl transition-colors cursor-pointer flex items-center gap-2 ${
            activeTab === 'corrections'
              ? 'bg-white text-[#CAA05C] border-t-2 border-t-[#CAA05C] border-x border-[#e8e4da] font-bold'
              : 'text-[#6e7874] hover:text-[#1c2120]'
          }`}
        >
          <History className="w-4 h-4" />
          <span>Correction Requests</span>
          {allCorrectionRequests.filter((c) => c.status === 'submitted').length > 0 && (
            <span className="px-1.5 py-0.2 rounded-full bg-[#CAA05C] text-[#171c1b] font-bold text-[10px]">
              {allCorrectionRequests.filter((c) => c.status === 'submitted').length}
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
          onRequestCorrection={(date, session) => {
            if (session) {
              handleOpenCorrection(session);
            } else {
              setSelectedDate(date);
              setActiveTab('register');
            }
          }}
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
                            <button
                              onClick={() => handleOpenCorrection(s)}
                              className="px-2.5 py-1 rounded bg-[#f4f1ea] hover:bg-[#eae6dc] text-[#1c2120] font-medium text-[11px] transition-colors cursor-pointer"
                            >
                              Adjust / Correct
                            </button>
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
                            <button
                              onClick={() => handleOpenCorrection(s)}
                              className="px-3 py-1.5 rounded-lg bg-[#CAA05C] hover:bg-[#ba904c] text-[#171c1b] font-bold text-xs transition-colors cursor-pointer"
                            >
                              Request Correction
                            </button>
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

      {/* Tab 3: Correction Requests Workflow */}
      {activeTab === 'corrections' && (
        <div className="bg-white rounded-2xl border border-[#e8e4da] overflow-hidden shadow-xs">
          <div className="p-5 border-b border-[#f0ece1] flex items-center justify-between">
            <div>
              <h3 className="font-bold text-sm text-[#1c2120]">Attendance Correction Register</h3>
              <p className="text-xs text-[#717b77]">Submitted employee corrections awaiting review or application</p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#f9f8f4] text-[#6d7572] uppercase font-bold text-[10px] border-b border-[#f0ece1]">
                <tr>
                  <th className="py-3 px-4">Employee</th>
                  <th className="py-3 px-4">Target Date</th>
                  <th className="py-3 px-4">Requested Punch Times</th>
                  <th className="py-3 px-4">Reason Given</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Review Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f2eee6] text-[#2c3330]">
                {allCorrectionRequests.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-[#7d8783]">
                      No correction requests submitted.
                    </td>
                  </tr>
                ) : (
                  allCorrectionRequests.map((req) => {
                    const emp = db.getEmployeeById(req.employeeId);
                    return (
                      <tr key={req.id} className="hover:bg-[#faf9f5]">
                        <td className="py-3 px-4 font-semibold text-[#1c2120]">
                          {emp?.fullName}{' '}
                          <span className="text-[10px] font-mono text-[#78827e]">({emp?.employeeCode})</span>
                        </td>
                        <td className="py-3 px-4 font-mono font-medium">{req.attendanceDate}</td>
                        <td className="py-3 px-4 font-mono text-xs">
                          {req.requestedCheckIn || '—'} → {req.requestedCheckOut || '—'}
                        </td>
                        <td className="py-3 px-4 max-w-xs truncate text-[#505a56]" title={req.reason}>
                          {req.reason}
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                              req.status === 'applied'
                                ? 'bg-emerald-100 text-emerald-800'
                                : req.status === 'rejected'
                                ? 'bg-red-100 text-red-800'
                                : req.status === 'manager_reviewed'
                                ? 'bg-teal-100 text-teal-800'
                                : 'bg-amber-100 text-amber-800'
                            }`}
                          >
                            {req.status.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          {(canManage || isDeptManager) && req.status !== 'applied' && req.status !== 'rejected' ? (
                            <button
                              onClick={() => {
                                setReviewRequest(req);
                                setReviewComment('');
                              }}
                              className="px-3 py-1 rounded-lg bg-[#CAA05C] hover:bg-[#ba904c] text-[#171c1b] font-bold text-xs transition-colors cursor-pointer"
                            >
                              Review & Decide
                            </button>
                          ) : (
                            <span className="text-stone-400 text-xs">Completed</span>
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
      )}

      {/* Tab 4: Office Network Policy Simulator */}
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

      {/* Submit Correction Modal */}
      {isSubmitModalOpen && selectedSessionForCorrection && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 border border-[#ded8cb] shadow-2xl animate-in zoom-in-95">
            <div className="flex items-center justify-between pb-4 border-b border-[#f0ece1]">
              <h3 className="font-bold text-base text-[#1c2120]">Submit Attendance Correction</h3>
              <button
                onClick={() => setIsSubmitModalOpen(false)}
                className="text-stone-400 hover:text-stone-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitCorrection} className="space-y-4 mt-4 text-xs">
              <div className="p-3 rounded-lg bg-[#faf9f5] border border-[#ece7dc] space-y-1">
                <p className="font-semibold text-[#1c2120]">Session Details:</p>
                <p className="text-[#717b77]">
                  Date: <span className="font-mono font-bold text-[#1c2120]">{selectedSessionForCorrection.attendanceDate}</span> | Original Status: <span className="uppercase font-bold text-[#1b4332]">{selectedSessionForCorrection.computedStatus}</span>
                </p>
              </div>

              {modalError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-800 text-xs">
                  {modalError}
                </div>
              )}

              {modalSuccess && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-800 text-xs">
                  {modalSuccess}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-[#1c2120] mb-1">Requested Check-In (HH:mm)</label>
                  <input
                    type="time"
                    value={correctionCheckIn}
                    onChange={(e) => setCorrectionCheckIn(e.target.value)}
                    className="w-full p-2 border border-[#ded8cb] rounded-lg font-mono text-xs bg-[#faf9f5]"
                    required
                  />
                </div>
                <div>
                  <label className="block font-bold text-[#1c2120] mb-1">Requested Check-Out (HH:mm)</label>
                  <input
                    type="time"
                    value={correctionCheckOut}
                    onChange={(e) => setCorrectionCheckOut(e.target.value)}
                    className="w-full p-2 border border-[#ded8cb] rounded-lg font-mono text-xs bg-[#faf9f5]"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-[#1c2120] mb-1">Operational Reason / Documentation</label>
                <textarea
                  rows={3}
                  value={correctionReason}
                  onChange={(e) => setCorrectionReason(e.target.value)}
                  placeholder="e.g. On-site architectural inspection in Gulshan; forgot to checkout upon return..."
                  className="w-full p-2.5 border border-[#ded8cb] rounded-lg text-xs bg-[#faf9f5] focus:outline-none focus:border-[#1b4332]"
                  required
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-[#f0ece1]">
                <button
                  type="button"
                  onClick={() => setIsSubmitModalOpen(false)}
                  className="px-4 py-2 rounded-lg bg-[#f4f1ea] hover:bg-[#eae6dc] font-semibold text-stone-700 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-[#CAA05C] hover:bg-[#ba904c] text-[#171c1b] font-bold cursor-pointer shadow-xs"
                >
                  Submit for HR Audit
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Review Modal for HR / Manager */}
      {reviewRequest && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 border border-[#ded8cb] shadow-2xl animate-in zoom-in-95">
            <div className="flex items-center justify-between pb-4 border-b border-[#f0ece1]">
              <h3 className="font-bold text-base text-[#1c2120]">Audit & Review Correction</h3>
              <button
                onClick={() => setReviewRequest(null)}
                className="text-stone-400 hover:text-stone-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 mt-4 text-xs">
              <div className="p-3 bg-[#faf9f5] rounded-xl border border-[#ece7dc] space-y-1">
                <p>
                  <strong className="text-[#1c2120]">Target Date:</strong> {reviewRequest.attendanceDate}
                </p>
                <p>
                  <strong className="text-[#1c2120]">Requested Time:</strong> {reviewRequest.requestedCheckIn} – {reviewRequest.requestedCheckOut}
                </p>
                <p>
                  <strong className="text-[#1c2120]">Employee Reason:</strong> {reviewRequest.reason}
                </p>
              </div>

              <div>
                <label className="block font-bold text-[#1c2120] mb-1">Reviewer Note / Decision Comment</label>
                <textarea
                  rows={2}
                  value={reviewComment}
                  onChange={(e) => setReviewComment(e.target.value)}
                  placeholder="e.g. Verified with project supervisor logs..."
                  className="w-full p-2.5 border border-[#ded8cb] rounded-lg text-xs bg-[#faf9f5]"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-[#f0ece1]">
                <button
                  type="button"
                  onClick={() => setReviewRequest(null)}
                  className="px-3.5 py-2 rounded-lg bg-[#f4f1ea] hover:bg-[#eae6dc] font-semibold text-stone-700 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => handleExecuteReview('reject')}
                  className="px-3.5 py-2 rounded-lg bg-red-800 hover:bg-red-900 text-white font-bold cursor-pointer"
                >
                  Reject
                </button>
                {canManage ? (
                  <button
                    type="button"
                    onClick={() => handleExecuteReview('apply')}
                    className="px-4 py-2 rounded-lg bg-[#CAA05C] hover:bg-[#ba904c] text-[#171c1b] font-bold cursor-pointer shadow-xs"
                  >
                    Apply Correction to Attendance
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleExecuteReview('manager_reviewed')}
                    className="px-4 py-2 rounded-lg bg-teal-800 hover:bg-teal-900 text-white font-bold cursor-pointer"
                  >
                    Recommend for HR Approval
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
