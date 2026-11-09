import React, { useState, useMemo } from 'react';
import {
  AlertTriangle,
  CalendarCheck,
  CheckCircle2,
  Clock,
  ShieldCheck,
  UserCheck,
  Users,
} from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { db } from '../db/database';
import { PageHeader } from '../components/common/PageHeader';
import { AccessDenied } from '../components/common/AccessDenied';
import { AttendanceCalendarView } from '../components/AttendanceCalendarView';
import { Employee } from '../types';

export const StaffAttendancePage: React.FC = () => {
  const { currentUser } = useAppContext();

  if (!currentUser) return null;

  // Strict Super Admin Access Restriction
  if (currentUser.role !== 'super_admin') {
    return (
      <AccessDenied
        currentRole={currentUser.role}
        message="Staff Monthly Attendance & Management is an exclusive administrative console reserved solely for Super Admin partners."
      />
    );
  }

  const employees = db.getEmployees();
  const designations = db.getDesignations();
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>(employees[0]?.id || '');

  // Calculate current month's late statistics for all employees
  const currentMonth = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Dhaka' })
    .format(new Date())
    .slice(0, 7); // 'YYYY-MM'

  const employeeStats = useMemo(() => {
    return employees.map((emp) => {
      const sessions = db
        .getAttendanceSessions({ employeeId: emp.id })
        .filter((s) => s.attendanceDate.startsWith(currentMonth));

      let presentDays = 0;
      let lateDays = 0;
      let absentDays = 0;

      for (const s of sessions) {
        if (s.computedStatus === 'present' || s.computedStatus === 'missing_punch' || s.isMissingPunch) {
          presentDays++;
          if (s.lateMinutes > 0) lateDays++;
        } else if (s.computedStatus === 'late') {
          presentDays++;
          lateDays++;
        } else if (s.computedStatus === 'half_day') {
          presentDays += 0.5;
        } else if (s.computedStatus === 'absent') {
          absentDays++;
        }
      }

      const des = designations.find((d) => d.id === emp.designationId);
      const designationTitle = emp.customDesignation || des?.title || 'Staff';

      return {
        emp,
        designationTitle,
        presentDays,
        lateDays,
        absentDays,
        hasLatePenalty: lateDays >= 3,
      };
    });
  }, [employees, designations, currentMonth]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <PageHeader
        title="Staff Monthly Attendance & Management"
        subtitle="Full-month individual attendance calendar, late penalty monitoring, and super admin attendance override management."
        badge={
          <span className="px-3 py-1 rounded-full text-xs font-bold bg-[#f4ece0] text-[#8e6826] border border-[#d8be94] flex items-center gap-1.5 shadow-2xs">
            <ShieldCheck className="w-3.5 h-3.5 text-[#CAA05C]" />
            <span>Super Admin Console</span>
          </span>
        }
        actions={
          <div className="flex items-center gap-2">
            <div className="px-3 py-1.5 rounded-xl bg-white border border-[#ded8cb] text-xs font-semibold text-[#1c2120] flex items-center gap-1.5 shadow-2xs">
              <Users className="w-4 h-4 text-[#CAA05C]" />
              <span>{employees.length} Personnel Active</span>
            </div>
          </div>
        }
      />

      {/* Quick Personnel Selection & Late Penalty Warning Bar */}
      <div className="bg-white p-4 rounded-2xl border border-[#e8e4da] shadow-xs space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <CalendarCheck className="w-4 h-4 text-[#CAA05C]" />
            <h2 className="text-xs font-bold text-[#1c2120] uppercase tracking-wider">
              Studio Personnel Overview ({currentMonth})
            </h2>
          </div>
          <span className="text-[11px] text-[#717b77]">
            Policy Rule: <strong className="text-[#8e6826]">3 Days Late = 1 Day Salary Deduction</strong>
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2.5">
          {employeeStats.map(({ emp, designationTitle, presentDays, lateDays, hasLatePenalty }) => {
            const isSelected = emp.id === selectedEmployeeId;
            return (
              <button
                key={emp.id}
                onClick={() => setSelectedEmployeeId(emp.id)}
                className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                  isSelected
                    ? 'bg-[#fcf9f2] border-[#CAA05C] ring-2 ring-[#CAA05C]/30 shadow-xs'
                    : 'bg-[#faf9f5] border-[#ece7dc] hover:border-[#ded8cb] hover:bg-white'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-mono text-[10px] font-bold text-[#8e6826] bg-[#f7efe0] border border-[#ebd8b7] px-1.5 py-0.2 rounded">
                      {emp.employeeCode}
                    </span>
                    {hasLatePenalty ? (
                      <span
                        title="Late penalty triggered (≥3 late days)"
                        className="p-0.5 rounded-full bg-red-100 text-red-700"
                      >
                        <AlertTriangle className="w-3.5 h-3.5" />
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1 rounded">
                        {presentDays}d
                      </span>
                    )}
                  </div>
                  <p className="text-xs font-bold text-[#1c2120] truncate">{emp.fullName}</p>
                  <p className="text-[10px] text-[#6d7773] truncate mt-0.5">{designationTitle}</p>
                </div>

                <div className="mt-2.5 pt-2 border-t border-[#f0ece1] flex items-center justify-between text-[10px]">
                  <span className="text-[#6d7773]">Late Days:</span>
                  <span
                    className={`font-bold font-mono px-1.5 py-0.2 rounded ${
                      hasLatePenalty
                        ? 'bg-red-100 text-red-800 font-extrabold'
                        : lateDays > 0
                        ? 'bg-amber-100 text-amber-900'
                        : 'bg-emerald-100 text-emerald-900'
                    }`}
                  >
                    {lateDays} {lateDays >= 3 ? '⚠️' : ''}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Interactive Attendance Calendar View with Super Admin Controls */}
      <AttendanceCalendarView
        key={selectedEmployeeId}
        employeeId={selectedEmployeeId}
        currentUser={currentUser}
        allowEmployeeSwitch={true}
      />
    </div>
  );
};

export default StaffAttendancePage;

