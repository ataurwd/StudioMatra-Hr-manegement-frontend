import React, { useState, useMemo, useEffect } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  Calendar,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Coffee,
  Edit3,
  HelpCircle,
  Info,
  List,
  MonitorSmartphone,
  ShieldAlert,
  ShieldCheck,
  Timer,
  UserCheck,
  Users,
  X,
} from 'lucide-react';
import { db } from '../db/database';
import { AttendanceSession, Employee, User } from '../types';
import { formatMinutes } from '../utils/attendanceCalculator';
import { canManageAttendance } from '../utils/permissions';
import { AdminAttendanceEditModal } from './AdminAttendanceEditModal';

interface AttendanceCalendarViewProps {
  employeeId?: string;
  currentUser: User;
  onRequestCorrection?: (date: string, session?: AttendanceSession) => void;
  className?: string;
  allowEmployeeSwitch?: boolean;
}

interface DayAttendanceRecord {
  dateStr: string; // 'YYYY-MM-DD'
  dayNumber: number;
  dayName: string; // 'Sun', 'Mon', etc.
  fullDateLabel: string;
  isToday: boolean;
  isWeekend: boolean;
  isFuture: boolean;
  session?: AttendanceSession;
  leaveName?: string;
  computedCategory: 'present' | 'late' | 'half_day' | 'leave' | 'absent' | 'weekend' | 'missing' | 'scheduled';
  checkInTimeFormatted?: string;
  checkOutTimeFormatted?: string;
  workedMinutesFormatted?: string;
}

export const AttendanceCalendarView: React.FC<AttendanceCalendarViewProps> = ({
  employeeId,
  currentUser,
  onRequestCorrection,
  className = '',
  allowEmployeeSwitch,
}) => {
  const canManage = canManageAttendance(currentUser.role);
  const allowSwitch = allowEmployeeSwitch ?? canManage;

  const employees = db.getEmployees();
  const defaultEmpId =
    employeeId ||
    db.getEmployeeByUserId(currentUser.id)?.id ||
    employees[0]?.id ||
    '';

  const [activeEmployeeId, setActiveEmployeeId] = useState<string>(defaultEmpId);
  const [refreshKey, setRefreshKey] = useState<number>(0);

  // Sync activeEmployeeId if prop changes
  useEffect(() => {
    if (employeeId && employeeId !== activeEmployeeId) {
      setActiveEmployeeId(employeeId);
    }
  }, [employeeId]);

  // Current Dhaka time baseline
  const todayDhaka = useMemo(() => {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Dhaka' }).format(new Date());
  }, []);

  const [todayYear, todayMonth] = useMemo(() => {
    const parts = todayDhaka.split('-');
    return [parseInt(parts[0], 10), parseInt(parts[1], 10) - 1]; // 0-indexed month
  }, [todayDhaka]);

  const [viewYear, setViewYear] = useState<number>(todayYear);
  const [viewMonth, setViewMonth] = useState<number>(todayMonth);
  const [viewMode, setViewMode] = useState<'calendar' | 'list'>('calendar');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedDayRecord, setSelectedDayRecord] = useState<DayAttendanceRecord | null>(null);

  // Admin Direct Edit Modal State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<DayAttendanceRecord | null>(null);

  const employee = db.getEmployeeById(activeEmployeeId);
  const department = employee ? db.getDepartments().find((d) => d.id === employee.departmentId) : null;
  const shift = employee ? db.getShifts().find((s) => s.id === employee.shiftId) || db.getShifts()[0] : null;

  // Month navigation handlers
  const handlePrevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((y) => y - 1);
    } else {
      setViewMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((y) => y + 1);
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  const handleJumpToCurrent = () => {
    setViewYear(todayYear);
    setViewMonth(todayMonth);
  };

  const monthLabel = useMemo(() => {
    const date = new Date(viewYear, viewMonth, 1);
    return date.toLocaleString('en-US', { month: 'long', year: 'numeric' });
  }, [viewYear, viewMonth]);

  // Employee cycling
  const currentEmpIndex = employees.findIndex((e) => e.id === activeEmployeeId);
  const handlePrevEmployee = () => {
    if (employees.length === 0) return;
    const newIdx = currentEmpIndex <= 0 ? employees.length - 1 : currentEmpIndex - 1;
    setActiveEmployeeId(employees[newIdx].id);
  };

  const handleNextEmployee = () => {
    if (employees.length === 0) return;
    const newIdx = currentEmpIndex >= employees.length - 1 ? 0 : currentEmpIndex + 1;
    setActiveEmployeeId(employees[newIdx].id);
  };

  // Compute all days in the selected month with attendance records
  const monthDays = useMemo(() => {
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const records: DayAttendanceRecord[] = [];

    // Fetch all sessions and leaves for this employee
    const allSessions = db.getAttendanceSessions({ employeeId: activeEmployeeId });
    const allLeaves = db.getLeaveRequests().filter(
      (l) => l.employeeId === activeEmployeeId && (l.status === 'approved' || l.status === 'manager_approved')
    );

    const dayFormatter = new Intl.DateTimeFormat('en-US', { weekday: 'short' });

    for (let day = 1; day <= daysInMonth; day++) {
      const dayDate = new Date(viewYear, viewMonth, day);
      const yyyy = viewYear;
      const mm = String(viewMonth + 1).padStart(2, '0');
      const dd = String(day).padStart(2, '0');
      const dateStr = `${yyyy}-${mm}-${dd}`;

      const dayOfWeekIndex = dayDate.getDay(); // 0 = Sun, 1 = Mon, ..., 5 = Fri, 6 = Sat
      const dayName = dayFormatter.format(dayDate); // 'Sun', 'Mon', etc.

      // Studio Matra Schedule: 6 Working Days (Sat–Thu), ONLY Friday is the weekly day off
      const isWeekend = dayOfWeekIndex === 5;
      const isToday = dateStr === todayDhaka;
      const isFuture = dateStr > todayDhaka;

      // Find session for this date
      const session = allSessions.find((s) => s.attendanceDate === dateStr);

      // Find leave for this date
      const leave = allLeaves.find((l) => dateStr >= l.startDate && dateStr <= l.endDate);
      const leaveType = leave ? db.getLeaveTypes().find((t) => t.id === leave.leaveTypeId) : null;

      let computedCategory: DayAttendanceRecord['computedCategory'] = 'scheduled';
      let checkInTimeFormatted: string | undefined;
      let checkOutTimeFormatted: string | undefined;
      let workedMinutesFormatted: string | undefined;

      if (session) {
        if (session.checkInAt) {
          checkInTimeFormatted = new Date(session.checkInAt).toLocaleTimeString('en-US', {
            timeZone: 'Asia/Dhaka',
            hour: '2-digit',
            minute: '2-digit',
            hour12: true,
          });
        }
        if (session.checkOutAt) {
          checkOutTimeFormatted = new Date(session.checkOutAt).toLocaleTimeString('en-US', {
            timeZone: 'Asia/Dhaka',
            hour: '2-digit',
            minute: '2-digit',
            hour12: true,
          });
        } else if (isToday) {
          checkOutTimeFormatted = 'In Progress';
        } else {
          checkOutTimeFormatted = 'Missing Punch';
        }

        if (session.workedMinutes > 0) {
          workedMinutesFormatted = formatMinutes(session.workedMinutes);
        } else if (session.isMissingPunch) {
          workedMinutesFormatted = formatMinutes(session.scheduledMinutes || 480);
        } else if (isToday && session.checkInAt && !session.checkOutAt) {
          const start = new Date(session.checkInAt).getTime();
          const diffMin = Math.max(0, Math.floor((Date.now() - start) / (1000 * 60)));
          workedMinutesFormatted = formatMinutes(diffMin);
        }

        if (session.isMissingPunch) {
          computedCategory = 'missing';
        } else if (session.computedStatus === 'late') {
          computedCategory = 'late';
        } else if (session.computedStatus === 'half_day') {
          computedCategory = 'half_day';
        } else if (session.computedStatus === 'present') {
          computedCategory = 'present';
        } else if (session.computedStatus === 'paid_leave') {
          computedCategory = 'leave';
        } else if (session.computedStatus === 'absent') {
          computedCategory = 'absent';
        } else {
          computedCategory = 'present';
        }
      } else if (leave) {
        computedCategory = 'leave';
      } else if (isWeekend) {
        computedCategory = 'weekend';
      } else if (isFuture) {
        computedCategory = 'scheduled';
      } else if (isToday) {
        computedCategory = 'scheduled'; // Not punched yet today
      } else {
        computedCategory = 'absent'; // Past workday without attendance
      }

      records.push({
        dateStr,
        dayNumber: day,
        dayName,
        fullDateLabel: dayDate.toLocaleDateString('en-US', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        }),
        isToday,
        isWeekend,
        isFuture,
        session,
        leaveName: leaveType?.name || (leave ? 'Approved Leave' : undefined),
        computedCategory,
        checkInTimeFormatted,
        checkOutTimeFormatted,
        workedMinutesFormatted,
      });
    }

    return records;
  }, [viewYear, viewMonth, activeEmployeeId, todayDhaka, refreshKey]);

  // Calendar grid padding (day of week of the 1st of the month)
  const startDayOfWeek = useMemo(() => {
    return new Date(viewYear, viewMonth, 1).getDay();
  }, [viewYear, viewMonth]);

  // Aggregate stats for the selected month
  const stats = useMemo(() => {
    let presentDays = 0;
    let lateDays = 0;
    let leaveDays = 0;
    let absentDays = 0;
    let weekendDays = 0;
    let totalMinutesWorked = 0;

    monthDays.forEach((r) => {
      if (r.computedCategory === 'present') {
        presentDays++;
      } else if (r.computedCategory === 'late') {
        presentDays++;
        lateDays++;
      } else if (r.computedCategory === 'missing') {
        // Missing punch out is counted as Present!
        presentDays++;
        if (r.session?.lateMinutes && r.session.lateMinutes > 0) {
          lateDays++;
        }
      } else if (r.computedCategory === 'half_day') {
        presentDays += 0.5;
      } else if (r.computedCategory === 'leave') {
        leaveDays++;
      } else if (r.computedCategory === 'absent') {
        absentDays++;
      } else if (r.computedCategory === 'weekend') {
        weekendDays++;
      }

      if (r.session) {
        if (r.session.workedMinutes > 0) {
          totalMinutesWorked += r.session.workedMinutes;
        } else if (r.computedCategory === 'missing') {
          totalMinutesWorked += (r.session.scheduledMinutes || 480);
        }
      }
    });

    return {
      presentDays,
      lateDays,
      leaveDays,
      absentDays,
      weekendDays,
      totalMinutesWorked,
    };
  }, [monthDays]);

  // Filtered records for list view
  const filteredListDays = useMemo(() => {
    if (statusFilter === 'all') return monthDays;
    if (statusFilter === 'present') return monthDays.filter((d) => d.computedCategory === 'present' || d.computedCategory === 'late' || d.computedCategory === 'missing');
    if (statusFilter === 'late') return monthDays.filter((d) => d.computedCategory === 'late' || (d.computedCategory === 'missing' && (d.session?.lateMinutes || 0) > 0));
    if (statusFilter === 'leave') return monthDays.filter((d) => d.computedCategory === 'leave');
    if (statusFilter === 'absent') return monthDays.filter((d) => d.computedCategory === 'absent');
    if (statusFilter === 'workdays') return monthDays.filter((d) => !d.isWeekend);
    return monthDays;
  }, [monthDays, statusFilter]);

  return (
    <div className={`bg-white rounded-2xl border border-[#e8e4da] p-6 shadow-xs ${className}`}>
      {/* SUPER ADMIN EMPLOYEE SELECTOR BAR */}
      {allowSwitch && (
        <div className="mb-6 p-4.5 bg-[#faf9f5] border border-[#e8e4da] rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-full bg-[#1c2120] text-white flex items-center justify-center font-bold text-base border border-[#3b4441] shadow-2xs">
              {employee?.fullName
                .split(' ')
                .map((n) => n[0])
                .slice(0, 2)
                .join('')}
            </div>
            <div>
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-[10px] uppercase font-bold tracking-wider text-[#8f6927] bg-[#f7efe0] border border-[#ebd8b7] px-2.5 py-0.5 rounded-full flex items-center gap-1">
                  <Users className="w-3 h-3 text-[#CAA05C]" />
                  Individual Staff Attendance Audit
                </span>
                <span className="text-xs text-[#717b77]">• Super Admin Mode</span>
              </div>
              <h3 className="text-lg font-bold text-[#1c2120] flex items-center gap-2">
                <span>{employee?.fullName}</span>
                <span className="font-mono text-xs font-bold text-[#CAA05C] bg-[#1c2120] px-2 py-0.5 rounded-md">
                  {employee?.employeeCode}
                </span>
              </h3>
              <p className="text-xs text-[#6e7774] mt-0.5">
                Department: <strong className="text-[#1c2120]">{department?.name || 'Architecture'}</strong> • Shift: {shift?.startTime} – {shift?.endTime} (8 hrs/day)
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <div>
              <label className="block text-[10px] uppercase font-bold text-[#6a7571] mb-1">
                Select Employee:
              </label>
              <select
                value={activeEmployeeId}
                onChange={(e) => setActiveEmployeeId(e.target.value)}
                className="px-3.5 py-2 rounded-xl border border-[#ded8cb] bg-white text-xs font-bold text-[#1c2120] focus:outline-none focus:border-[#CAA05C] shadow-2xs min-w-64 cursor-pointer"
              >
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.fullName} ({emp.employeeCode})
                  </option>
                ))}
              </select>
            </div>

            {/* Quick Prev / Next Employee buttons */}
            <div className="flex items-center gap-1 pt-4">
              <button
                type="button"
                onClick={handlePrevEmployee}
                title="Previous Employee"
                className="p-2 rounded-xl bg-white border border-[#ded8cb] hover:bg-[#ede8dc] text-[#333d39] transition-colors cursor-pointer shadow-2xs"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={handleNextEmployee}
                title="Next Employee"
                className="p-2 rounded-xl bg-white border border-[#ded8cb] hover:bg-[#ede8dc] text-[#333d39] transition-colors cursor-pointer shadow-2xs"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header with Month Navigation & View Mode Switcher */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-[#f0ece1]">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs uppercase font-bold tracking-wider text-[#8f6927] bg-[#f7efe0] border border-[#ebd8b7] px-2.5 py-0.5 rounded-full flex items-center gap-1.5">
              <Calendar className="w-3 h-3 text-[#CAA05C]" />
              Full Month Attendance & Time Register
            </span>
            <span className="text-xs text-[#717b77]">• Asia/Dhaka Time</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-serif font-bold text-[#1c2120]">
            Monthly Attendance Calendar: {employee?.fullName}
          </h2>
          <p className="text-xs text-[#6e7774] mt-0.5">
            Individual full-month attendance view with direct administrative override & time adjustments
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Month Selector Controls */}
          <div className="flex items-center bg-[#faf9f5] border border-[#ded8cb] rounded-xl p-1 shadow-2xs">
            <button
              onClick={handlePrevMonth}
              className="p-1.5 rounded-lg text-[#3b4340] hover:bg-[#ede8dc] transition-colors cursor-pointer"
              aria-label="Previous Month"
              title="Previous Month"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-3 text-xs font-bold text-[#1c2120] font-mono min-w-36 text-center">
              {monthLabel}
            </span>
            <button
              onClick={handleNextMonth}
              className="p-1.5 rounded-lg text-[#3b4340] hover:bg-[#ede8dc] transition-colors cursor-pointer"
              aria-label="Next Month"
              title="Next Month"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <button
            onClick={handleJumpToCurrent}
            className="px-3 py-2 rounded-xl bg-[#f4f1ea] hover:bg-[#eae6dc] text-[#1c2120] text-xs font-semibold transition-colors cursor-pointer"
          >
            Today
          </button>

          {/* View Mode Toggle */}
          <div className="flex items-center bg-[#f4f1ea] p-1 rounded-xl border border-[#ded8cb]">
            <button
              onClick={() => setViewMode('calendar')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                viewMode === 'calendar'
                  ? 'bg-white text-[#1c2120] shadow-xs'
                  : 'text-[#6e7774] hover:text-[#1c2120]'
              }`}
            >
              <CalendarDays className="w-3.5 h-3.5 text-[#CAA05C]" />
              <span>Calendar</span>
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                viewMode === 'list'
                  ? 'bg-white text-[#1c2120] shadow-xs'
                  : 'text-[#6e7774] hover:text-[#1c2120]'
              }`}
            >
              <List className="w-3.5 h-3.5 text-[#CAA05C]" />
              <span>Timeline List</span>
            </button>
          </div>
        </div>
      </div>

      {/* Monthly Statistics Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 py-5 border-b border-[#f0ece1]">
        <div className="p-3 bg-[#faf9f5] rounded-xl border border-[#ece7dc]">
          <span className="text-[10px] font-bold uppercase tracking-wider text-[#717b77] block">
            Present Days
          </span>
          <span className="text-xl font-bold font-mono text-emerald-700 block mt-0.5">
            {stats.presentDays}
          </span>
          <span className="text-[10px] text-[#86928e]">Workdays attended</span>
        </div>

        <div className="p-3 bg-[#faf9f5] rounded-xl border border-[#ece7dc]">
          <span className="text-[10px] font-bold uppercase tracking-wider text-[#717b77] block">
            Late Days
          </span>
          <span className="text-xl font-bold font-mono text-amber-700 block mt-0.5">
            {stats.lateDays}
          </span>
          <span className="text-[10px] text-[#86928e]">Grace threshold exceeded</span>
        </div>

        <div className="p-3 bg-[#faf9f5] rounded-xl border border-[#ece7dc]">
          <span className="text-[10px] font-bold uppercase tracking-wider text-[#717b77] block">
            Leave Taken
          </span>
          <span className="text-xl font-bold font-mono text-purple-700 block mt-0.5">
            {stats.leaveDays}
          </span>
          <span className="text-[10px] text-[#86928e]">Approved leaves</span>
        </div>

        <div className="p-3 bg-[#faf9f5] rounded-xl border border-[#ece7dc]">
          <span className="text-[10px] font-bold uppercase tracking-wider text-[#717b77] block">
            Absent Days
          </span>
          <span className="text-xl font-bold font-mono text-red-700 block mt-0.5">
            {stats.absentDays}
          </span>
          <span className="text-[10px] text-[#86928e]">Unattended / unexcused</span>
        </div>

        <div className="p-3 bg-[#faf9f5] rounded-xl border border-[#ece7dc]">
          <span className="text-[10px] font-bold uppercase tracking-wider text-[#717b77] block">
            Weekend Off
          </span>
          <span className="text-xl font-bold font-mono text-[#5b6461] block mt-0.5">
            {stats.weekendDays}
          </span>
          <span className="text-[10px] text-[#86928e]">Fri & Sat closed</span>
        </div>

        <div className="p-3 bg-[#faf9f5] rounded-xl border border-[#ece7dc]">
          <span className="text-[10px] font-bold uppercase tracking-wider text-[#717b77] block">
            Net Worked Hours
          </span>
          <span className="text-xl font-bold font-mono text-[#1b4332] block mt-0.5">
            {formatMinutes(stats.totalMinutesWorked)}
          </span>
          <span className="text-[10px] text-[#86928e]">Less 1 hr lunch break</span>
        </div>
      </div>

      {/* Status Filter Tabs (for List View) */}
      {viewMode === 'list' && (
        <div className="flex flex-wrap items-center gap-1.5 pt-4 text-xs">
          <span className="text-[11px] font-bold text-[#717b77] mr-1">Filter Records:</span>
          {[
            { id: 'all', label: 'All Days' },
            { id: 'workdays', label: 'Workdays Only' },
            { id: 'present', label: 'Present' },
            { id: 'late', label: 'Late Arrival' },
            { id: 'leave', label: 'On Leave' },
            { id: 'absent', label: 'Absent' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setStatusFilter(tab.id)}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer ${
                statusFilter === tab.id
                  ? 'bg-[#1c2120] text-white shadow-2xs'
                  : 'bg-[#faf9f5] text-[#6d7572] hover:bg-[#ede8dc]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      )}

      {/* MODE 1: VISUAL CALENDAR GRID */}
      {viewMode === 'calendar' && (
        <div className="mt-4">
          {/* Day of Week Headers */}
          <div className="grid grid-cols-7 gap-2 mb-2 text-center text-xs font-bold text-[#6e7774]">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri (Off)', 'Sat (Off)'].map((name, i) => (
              <div
                key={name}
                className={`py-2 rounded-lg ${
                  i === 5 || i === 6 ? 'bg-[#f4f1ea] text-[#8d9692]' : 'bg-[#faf9f5] text-[#1c2120]'
                }`}
              >
                {name}
              </div>
            ))}
          </div>

          {/* Calendar Grid Cells */}
          <div className="grid grid-cols-7 gap-2">
            {/* Empty Offset Days from Previous Month */}
            {Array.from({ length: startDayOfWeek }).map((_, i) => (
              <div
                key={`empty-${i}`}
                className="h-28 sm:h-32 rounded-xl bg-[#faf9f5]/30 border border-dashed border-[#ece7dc] opacity-40"
              />
            ))}

            {/* Days in Month */}
            {monthDays.map((record) => {
              const {
                dateStr,
                dayNumber,
                isToday,
                isWeekend,
                isFuture,
                computedCategory,
                checkInTimeFormatted,
                checkOutTimeFormatted,
                workedMinutesFormatted,
                leaveName,
              } = record;

              // Style states
              let cellBg = 'bg-[#faf9f5] border-[#ece7dc] hover:border-[#CAA05C]/70';
              let badgeBg = 'bg-stone-100 text-stone-700';
              let statusText = '';

              if (computedCategory === 'present') {
                cellBg = 'bg-emerald-50/50 border-emerald-200 hover:border-emerald-400';
                badgeBg = 'bg-emerald-100 text-emerald-900 border-emerald-300';
                statusText = 'Present';
              } else if (computedCategory === 'late') {
                cellBg = 'bg-amber-50/60 border-amber-200 hover:border-amber-400';
                badgeBg = 'bg-amber-100 text-amber-900 border-amber-300';
                statusText = `Late (${record.session?.lateMinutes || 0}m)`;
              } else if (computedCategory === 'half_day') {
                cellBg = 'bg-blue-50/50 border-blue-200 hover:border-blue-400';
                badgeBg = 'bg-blue-100 text-blue-900 border-blue-300';
                statusText = 'Half Day';
              } else if (computedCategory === 'leave') {
                cellBg = 'bg-purple-50/50 border-purple-200 hover:border-purple-400';
                badgeBg = 'bg-purple-100 text-purple-900 border-purple-300';
                statusText = leaveName || 'Leave';
              } else if (computedCategory === 'missing') {
                cellBg = 'bg-emerald-50/50 border-emerald-300 hover:border-emerald-500';
                badgeBg = 'bg-amber-100 text-amber-900 border-amber-300';
                statusText = record.session?.lateMinutes && record.session.lateMinutes > 0 ? `Present (Late ${record.session.lateMinutes}m)` : 'Present (Missing Out)';
              } else if (computedCategory === 'absent') {
                cellBg = 'bg-red-50/30 border-red-200/80 hover:border-red-300';
                badgeBg = 'bg-red-100 text-red-800 border-red-200';
                statusText = 'Absent';
              } else if (isWeekend) {
                cellBg = 'bg-[#f4f1ea]/60 border-[#e5dfd2] text-[#87918d]';
                badgeBg = 'bg-[#eae4d5] text-[#6b7571]';
                statusText = 'Weekend';
              } else if (isFuture) {
                cellBg = 'bg-[#faf9f5]/50 border-[#ece7dc] opacity-70';
                badgeBg = 'bg-stone-100 text-stone-500';
                statusText = 'Scheduled';
              }

              return (
                <div
                  key={dateStr}
                  onClick={() => setSelectedDayRecord(record)}
                  className={`h-28 sm:h-32 rounded-xl p-2 sm:p-2.5 border transition-all cursor-pointer flex flex-col justify-between group shadow-2xs relative ${cellBg} ${
                    isToday ? 'ring-2 ring-[#CAA05C] shadow-md z-10' : ''
                  }`}
                >
                  {/* Top Bar inside cell: Day number and Today badge */}
                  <div className="flex items-center justify-between">
                    <span
                      className={`text-xs sm:text-sm font-bold font-mono ${
                        isToday
                          ? 'w-6 h-6 rounded-full bg-[#CAA05C] text-[#171c1b] flex items-center justify-center font-bold shadow-xs'
                          : 'text-[#1c2120]'
                      }`}
                    >
                      {dayNumber}
                    </span>

                    <div className="flex items-center gap-1">
                      {statusText && (
                        <span
                          className={`text-[9px] sm:text-[10px] font-bold px-1.5 py-0.5 rounded border truncate max-w-[85px] sm:max-w-none ${badgeBg}`}
                        >
                          {statusText}
                        </span>
                      )}

                      {/* Admin Quick Edit Pencil Button */}
                      {canManage && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingRecord(record);
                            setIsEditModalOpen(true);
                          }}
                          title="Edit this day's attendance"
                          className="opacity-0 group-hover:opacity-100 p-1 rounded-md bg-[#1c2120] text-[#CAA05C] hover:bg-[#2b3532] transition-opacity cursor-pointer shadow-xs"
                        >
                          <Edit3 className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Middle Content: Check-In & Check-Out Times */}
                  <div className="space-y-1 my-1">
                    {checkInTimeFormatted ? (
                      <div className="text-[10px] sm:text-[11px] font-mono leading-tight">
                        <span className="text-emerald-700 font-bold">IN:</span>{' '}
                        <span className="font-semibold text-[#1c2120]">{checkInTimeFormatted}</span>
                      </div>
                    ) : isWeekend ? (
                      <span className="text-[10px] text-[#8e9894] italic block">Studio Closed</span>
                    ) : isFuture ? (
                      <span className="text-[10px] text-[#9ba5a1] block">Workday</span>
                    ) : computedCategory === 'absent' ? (
                      <span className="text-[10px] text-red-600 font-semibold block">No Punch</span>
                    ) : null}

                    {checkOutTimeFormatted && (
                      <div className="text-[10px] sm:text-[11px] font-mono leading-tight">
                        <span className="text-amber-700 font-bold">OUT:</span>{' '}
                        <span
                          className={`font-semibold ${
                            checkOutTimeFormatted === 'In Progress'
                              ? 'text-[#CAA05C] animate-pulse font-bold'
                              : checkOutTimeFormatted === 'Missing Punch'
                              ? 'text-red-600 font-bold'
                              : 'text-[#1c2120]'
                          }`}
                        >
                          {checkOutTimeFormatted}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Bottom: Worked duration & Details */}
                  <div className="flex items-center justify-between pt-1 border-t border-[#f0ece1]/70 text-[9px] sm:text-[10px] text-[#717b77]">
                    {workedMinutesFormatted ? (
                      <span className="font-mono font-bold text-[#1b4332] flex items-center gap-1">
                        <Timer className="w-2.5 h-2.5 text-[#CAA05C]" />
                        {workedMinutesFormatted}
                      </span>
                    ) : (
                      <span className="text-[9px] text-[#9ca6a2]">
                        {isWeekend ? 'Off' : isFuture ? 'Upcoming' : '—'}
                      </span>
                    )}

                    <span className="opacity-0 group-hover:opacity-100 text-[#CAA05C] font-bold transition-opacity">
                      {canManage ? 'Edit / View →' : 'Details →'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* MODE 2: CHRONOLOGICAL DAILY TIMELINE LIST */}
      {viewMode === 'list' && (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#faf9f5] text-[#6d7572] uppercase font-bold text-[10px] border-b border-[#f0ece1]">
              <tr>
                <th className="py-3 px-4">Date & Day</th>
                <th className="py-3 px-4">Check-In Time</th>
                <th className="py-3 px-4">Check-Out Time</th>
                <th className="py-3 px-4">Duration (Net)</th>
                <th className="py-3 px-4">Lunch Break</th>
                <th className="py-3 px-4">Late / Early</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Source Device</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f0ece1]">
              {filteredListDays.map((record) => {
                const {
                  dateStr,
                  fullDateLabel,
                  isWeekend,
                  isToday,
                  session,
                  computedCategory,
                  checkInTimeFormatted,
                  checkOutTimeFormatted,
                  workedMinutesFormatted,
                } = record;

                let rowStatusBadge = (
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-stone-100 text-stone-700">
                    Scheduled
                  </span>
                );

                if (computedCategory === 'present') {
                  rowStatusBadge = (
                    <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-900 border border-emerald-300">
                      Present
                    </span>
                  );
                } else if (computedCategory === 'late') {
                  rowStatusBadge = (
                    <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                      Late Arrival
                    </span>
                  );
                } else if (computedCategory === 'half_day') {
                  rowStatusBadge = (
                    <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-blue-100 text-blue-900 border border-blue-300">
                      Half Day
                    </span>
                  );
                } else if (computedCategory === 'leave') {
                  rowStatusBadge = (
                    <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-purple-100 text-purple-900 border border-purple-300">
                      On Leave
                    </span>
                  );
                } else if (computedCategory === 'missing') {
                  rowStatusBadge = (
                    <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                      Present (Missing Out)
                    </span>
                  );
                } else if (computedCategory === 'absent') {
                  rowStatusBadge = (
                    <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-red-100 text-red-900 border border-red-300">
                      Absent
                    </span>
                  );
                } else if (isWeekend) {
                  rowStatusBadge = (
                    <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[#ece6d8] text-[#6d7572]">
                      Studio Weekend
                    </span>
                  );
                }

                return (
                  <tr
                    key={dateStr}
                    className={`hover:bg-[#faf9f5] transition-colors ${
                      isToday ? 'bg-amber-50/20 font-semibold' : ''
                    }`}
                  >
                    <td className="py-3 px-4 font-mono font-medium">
                      <div className="flex items-center gap-2">
                        {isToday && (
                          <span className="w-2 h-2 rounded-full bg-[#CAA05C] animate-pulse" />
                        )}
                        <span>{fullDateLabel}</span>
                      </div>
                    </td>

                    <td className="py-3 px-4 font-mono">
                      {checkInTimeFormatted ? (
                        <span className="text-emerald-800 font-bold">{checkInTimeFormatted}</span>
                      ) : (
                        <span className="text-[#9aa4a0]">—</span>
                      )}
                    </td>

                    <td className="py-3 px-4 font-mono">
                      {checkOutTimeFormatted ? (
                        <span
                          className={`font-bold ${
                            checkOutTimeFormatted === 'In Progress'
                              ? 'text-[#CAA05C]'
                              : checkOutTimeFormatted === 'Missing Punch'
                              ? 'text-red-600'
                              : 'text-amber-800'
                          }`}
                        >
                          {checkOutTimeFormatted}
                        </span>
                      ) : (
                        <span className="text-[#9aa4a0]">—</span>
                      )}
                    </td>

                    <td className="py-3 px-4 font-mono font-bold text-[#1b4332]">
                      {workedMinutesFormatted || '—'}
                    </td>

                    <td className="py-3 px-4 text-[#717b77]">
                      {session?.breakMinutes ? (
                        <span className="font-mono">-{session.breakMinutes}m</span>
                      ) : isWeekend ? (
                        <span className="text-[#9aa4a0]">—</span>
                      ) : (
                        <span className="font-mono text-[#8f6927]">-60m</span>
                      )}
                    </td>

                    <td className="py-3 px-4">
                      {session?.lateMinutes ? (
                        <span className="text-amber-700 font-semibold font-mono text-[11px]">
                          +{session.lateMinutes}m Late
                        </span>
                      ) : session?.earlyDepartureMinutes ? (
                        <span className="text-orange-700 font-semibold font-mono text-[11px]">
                          -{session.earlyDepartureMinutes}m Early
                        </span>
                      ) : (
                        <span className="text-[#9aa4a0]">—</span>
                      )}
                    </td>

                    <td className="py-3 px-4">{rowStatusBadge}</td>

                    <td className="py-3 px-4 text-[#717b77]">
                      {session?.sourceType === 'kiosk' ? (
                        <span className="inline-flex items-center gap-1 text-[11px]">
                          <MonitorSmartphone className="w-3.5 h-3.5 text-[#CAA05C]" />
                          Kiosk Terminal
                        </span>
                      ) : session?.sourceType === 'office_network' ? (
                        <span className="inline-flex items-center gap-1 text-[11px]">
                          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                          Office Network
                        </span>
                      ) : session?.sourceType === 'manual_adjustment' ? (
                        <span className="inline-flex items-center gap-1 text-[11px] text-amber-800 font-semibold">
                          <Edit3 className="w-3 h-3 text-[#CAA05C]" />
                          Admin Adjusted
                        </span>
                      ) : (
                        <span>—</span>
                      )}
                    </td>

                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {canManage && (
                          <button
                            onClick={() => {
                              setEditingRecord(record);
                              setIsEditModalOpen(true);
                            }}
                            className="px-2.5 py-1 bg-[#1c2120] hover:bg-[#2b3532] rounded-md text-[11px] font-bold text-white transition-colors cursor-pointer flex items-center gap-1 shadow-2xs border border-[#3b4340]"
                          >
                            <Edit3 className="w-3 h-3 text-[#CAA05C]" />
                            <span>Edit</span>
                          </button>
                        )}
                        <button
                          onClick={() => setSelectedDayRecord(record)}
                          className="px-2.5 py-1 bg-[#f4f1ea] hover:bg-[#eae6dc] rounded-md text-[11px] font-semibold text-[#1c2120] transition-colors cursor-pointer"
                        >
                          Details
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* INTERACTIVE DAY DETAIL BREAKDOWN MODAL */}
      {selectedDayRecord && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 sm:p-7 border border-[#ded8cb] shadow-2xl animate-in zoom-in-95">
            <div className="flex items-center justify-between pb-4 border-b border-[#f0ece1]">
              <div>
                <span className="text-[11px] font-bold text-[#8f6927] uppercase tracking-wider">
                  Attendance Detail Breakdown
                </span>
                <h3 className="text-lg font-bold text-[#1c2120] mt-0.5">
                  {selectedDayRecord.fullDateLabel}
                </h3>
              </div>
              <button
                onClick={() => setSelectedDayRecord(null)}
                className="p-1 rounded-lg text-stone-400 hover:text-stone-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="my-5 space-y-3.5 text-xs">
              <div className="p-3.5 bg-[#faf9f5] rounded-xl border border-[#ece7dc] grid grid-cols-2 gap-4">
                <div>
                  <span className="text-[#717b77] block text-[11px]">Employee</span>
                  <span className="font-bold text-[#1c2120] block mt-0.5">
                    {employee?.fullName}
                  </span>
                  <span className="text-[10px] text-[#86928e]">
                    Code: {employee?.employeeCode} • {shift?.name}
                  </span>
                </div>
                <div>
                  <span className="text-[#717b77] block text-[11px]">Attendance Status</span>
                  <span className="font-bold uppercase text-[#1b4332] block mt-0.5">
                    {selectedDayRecord.computedCategory === 'missing'
                      ? 'Present (Missing Punch Out)'
                      : selectedDayRecord.computedCategory.replace('_', ' ')}
                  </span>
                  <span className="text-[10px] text-[#86928e]">
                    {selectedDayRecord.computedCategory === 'missing'
                      ? 'Attended workday • Counted as Present'
                      : selectedDayRecord.isToday
                      ? 'Today (Active)'
                      : 'Authoritative Record'}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-xl">
                  <span className="text-[11px] font-semibold text-emerald-800 block">Check-In Time</span>
                  <span className="text-base font-bold font-mono text-emerald-950 block mt-1">
                    {selectedDayRecord.checkInTimeFormatted || 'No Check-In Recorded'}
                  </span>
                  {selectedDayRecord.session?.lateMinutes ? (
                    <span className="text-[10px] text-amber-700 font-semibold block mt-0.5">
                      +{selectedDayRecord.session.lateMinutes} mins after grace threshold
                    </span>
                  ) : selectedDayRecord.session?.checkInAt ? (
                    <span className="text-[10px] text-emerald-700 font-semibold block mt-0.5">
                      ✓ On-time check in
                    </span>
                  ) : null}
                </div>

                <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-xl">
                  <span className="text-[11px] font-semibold text-amber-800 block">Check-Out Time</span>
                  <span className="text-base font-bold font-mono text-amber-950 block mt-1">
                    {selectedDayRecord.checkOutTimeFormatted || 'No Check-Out Recorded'}
                  </span>
                  {selectedDayRecord.session?.earlyDepartureMinutes ? (
                    <span className="text-[10px] text-orange-700 font-semibold block mt-0.5">
                      -{selectedDayRecord.session.earlyDepartureMinutes} mins early departure
                    </span>
                  ) : selectedDayRecord.session?.checkOutAt ? (
                    <span className="text-[10px] text-emerald-700 font-semibold block mt-0.5">
                      ✓ Completed standard workday
                    </span>
                  ) : null}
                </div>
              </div>

              <div className="p-3.5 bg-[#faf9f5] rounded-xl border border-[#ece7dc] space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-[#6d7773]">Total Worked Duration:</span>
                  <span className="font-mono font-bold text-[#1c2120]">
                    {selectedDayRecord.workedMinutesFormatted || '0h 0m'}
                  </span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-[#6d7773]">Mandatory Lunch Break:</span>
                  <span className="font-mono font-semibold text-[#8f6927]">
                    -{selectedDayRecord.session?.breakMinutes ?? 60} mins (Studio Matra Policy)
                  </span>
                </div>
                <div className="flex justify-between items-center text-xs pt-2 border-t border-[#f0ece1]">
                  <span className="text-[#1c2120] font-bold">Terminal Source:</span>
                  <span className="font-semibold text-[#1c2120]">
                    {selectedDayRecord.session?.sourceType === 'kiosk'
                      ? 'Studio Reception Kiosk #1 (Banani Terminal)'
                      : selectedDayRecord.session?.sourceType === 'office_network'
                      ? 'Authorized Office Wi-Fi Network'
                      : selectedDayRecord.session?.sourceType === 'manual_adjustment'
                      ? 'Administrative Manual Adjustment'
                      : 'None'}
                  </span>
                </div>
                {selectedDayRecord.session?.notes && (
                  <div className="flex justify-between items-center text-xs pt-2 border-t border-[#f0ece1]">
                    <span className="text-[#6d7773]">Audit Notes:</span>
                    <span className="font-medium text-[#1c2120] italic">
                      {selectedDayRecord.session.notes}
                    </span>
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-4 border-t border-[#f0ece1]">
              {canManage && (
                <button
                  onClick={() => {
                    const rec = selectedDayRecord;
                    setSelectedDayRecord(null);
                    setEditingRecord(rec);
                    setIsEditModalOpen(true);
                  }}
                  className="px-4 py-2 rounded-xl bg-[#1c2120] hover:bg-[#2b3532] text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs border border-[#3b4340]"
                >
                  <Edit3 className="w-3.5 h-3.5 text-[#CAA05C]" />
                  <span>Admin: Edit Attendance</span>
                </button>
              )}

              <button
                onClick={() => setSelectedDayRecord(null)}
                className="px-5 py-2 rounded-xl bg-[#CAA05C] hover:bg-[#ba904c] text-[#171c1b] text-xs font-bold cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ADMIN DIRECT ATTENDANCE EDIT MODAL */}
      {isEditModalOpen && editingRecord && employee && (
        <AdminAttendanceEditModal
          isOpen={isEditModalOpen}
          onClose={() => {
            setIsEditModalOpen(false);
            setEditingRecord(null);
          }}
          dateStr={editingRecord.dateStr}
          employee={employee}
          existingSession={editingRecord.session}
          currentUser={currentUser}
          onSaved={() => {
            setRefreshKey((k) => k + 1);
            if (selectedDayRecord && selectedDayRecord.dateStr === editingRecord.dateStr) {
              const updatedSession = db.getAttendanceSessions({
                employeeId: activeEmployeeId,
                startDate: editingRecord.dateStr,
                endDate: editingRecord.dateStr,
              })[0];
              setSelectedDayRecord((prev) =>
                prev ? { ...prev, session: updatedSession } : null
              );
            }
          }}
        />
      )}
    </div>
  );
};
