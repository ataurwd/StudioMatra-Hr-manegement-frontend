import React, { useState, useMemo } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  Calendar,
  CheckCircle2,
  Clock,
  Coffee,
  HelpCircle,
  Save,
  ShieldAlert,
  Trash2,
  UserCheck,
  X,
  Zap,
} from 'lucide-react';
import { db } from '../db/database';
import { apiAdminDeleteAttendance, apiAdminOverrideAttendance } from '../services/apiService';
import { AttendanceSession, AttendanceStatus, Employee, User } from '../types';

interface AdminAttendanceEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  dateStr: string; // 'YYYY-MM-DD'
  employee: Employee;
  existingSession?: AttendanceSession;
  currentUser: User;
  onSaved: () => void;
}

export const AdminAttendanceEditModal: React.FC<AdminAttendanceEditModalProps> = ({
  isOpen,
  onClose,
  dateStr,
  employee,
  existingSession,
  currentUser,
  onSaved,
}) => {
  if (!isOpen) return null;

  const shift = db.getShifts().find((s) => s.id === employee.shiftId) || db.getShifts()[0];

  // Helper to extract HH:MM in Asia/Dhaka from ISO string
  const getDhakaTime = (isoStr?: string, defaultVal: string = '') => {
    if (!isoStr) return defaultVal;
    try {
      const d = new Date(isoStr);
      if (isNaN(d.getTime())) return defaultVal;
      return d.toLocaleTimeString('en-GB', {
        timeZone: 'Asia/Dhaka',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return defaultVal;
    }
  };

  const initialCheckIn = getDhakaTime(existingSession?.checkInAt, shift?.startTime || '10:15');
  const initialCheckOut = getDhakaTime(existingSession?.checkOutAt, shift?.endTime || '19:30');

  const [status, setStatus] = useState<AttendanceStatus>(
    existingSession?.computedStatus || 'present'
  );
  const [checkIn, setCheckIn] = useState<string>(initialCheckIn);
  const [checkOut, setCheckOut] = useState<string>(initialCheckOut);
  const [breakMinutes, setBreakMinutes] = useState<number>(existingSession?.breakMinutes ?? 60);
  const [notes, setNotes] = useState<string>(
    existingSession?.notes || 'Administrative review & approval'
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Formatted date label
  const formattedDateLabel = useMemo(() => {
    try {
      const [year, month, day] = dateStr.split('-').map(Number);
      const d = new Date(year, month - 1, day);
      return d.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    } catch {
      return dateStr;
    }
  }, [dateStr]);

  // Real-time calculation preview
  const liveMetrics = useMemo(() => {
    if (status === 'absent') {
      return { workedMin: 0, lateMin: 0, overtimeMin: 0, earlyMin: 0 };
    }

    if (!checkIn) return { workedMin: 0, lateMin: 0, overtimeMin: 0, earlyMin: 0 };

    const [inH, inM] = checkIn.split(':').map(Number);
    const [shiftH, shiftM] = (shift?.startTime || '10:15').split(':').map(Number);
    const shiftStartMin = shiftH * 60 + shiftM;
    const checkInMin = inH * 60 + inM;
    const graceMin = shiftStartMin + (shift?.graceMinutes || 10);

    const lateMin = checkInMin > graceMin ? checkInMin - shiftStartMin : 0;

    let workedMin = 0;
    let overtimeMin = 0;
    let earlyMin = 0;

    if (checkOut) {
      const [outH, outM] = checkOut.split(':').map(Number);
      const checkOutMin = outH * 60 + outM;
      if (checkOutMin > checkInMin) {
        const rawDuration = checkOutMin - checkInMin;
        workedMin = Math.max(0, rawDuration - (breakMinutes || 0));

        const [shiftEndH, shiftEndM] = (shift?.endTime || '19:30').split(':').map(Number);
        const shiftEndMin = shiftEndH * 60 + shiftEndM;

        if (checkOutMin < shiftEndMin) {
          earlyMin = shiftEndMin - checkOutMin;
        } else if (checkOutMin > shiftEndMin) {
          overtimeMin = checkOutMin - shiftEndMin;
        }
      }
    }

    return { workedMin, lateMin, overtimeMin, earlyMin };
  }, [checkIn, checkOut, breakMinutes, status, shift]);

  const handleApplyPreset = (type: 'present' | 'late' | 'half_day' | 'absent') => {
    setErrorMsg('');
    const sStart = shift?.startTime || '10:15';
    const sEnd = shift?.endTime || '19:30';
    if (type === 'present') {
      setStatus('present');
      setCheckIn(sStart);
      setCheckOut(sEnd);
      setBreakMinutes(60);
      setNotes('Standard workday recorded by Admin');
    } else if (type === 'late') {
      setStatus('late');
      setCheckIn('10:45');
      setCheckOut(sEnd);
      setBreakMinutes(60);
      setNotes('Late arrival (grace period exceeded) recorded by Admin');
    } else if (type === 'half_day') {
      setStatus('half_day');
      setCheckIn(sStart);
      setCheckOut('15:00');
      setBreakMinutes(0);
      setNotes('Half-day attendance approved by Admin');
    } else if (type === 'absent') {
      setStatus('absent');
      setCheckIn('');
      setCheckOut('');
      setBreakMinutes(0);
      setNotes('Marked absent by Admin');
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');
    setIsSubmitting(true);

    try {
      if (status !== 'absent' && !checkIn) {
        setErrorMsg('Please specify a check-in time, or select Absent.');
        setIsSubmitting(false);
        return;
      }

      // If marked absent and session exists, option to delete or update to absent
      if (status === 'absent' && existingSession) {
        db.adminDeleteAttendanceSession(existingSession.id, {
          userId: currentUser.id,
          name: currentUser.fullName,
        });
        await apiAdminDeleteAttendance(existingSession.id);
        setSuccessMsg('Record cleared and day marked as Absent.');
        setTimeout(() => {
          onSaved();
          onClose();
        }, 1000);
        return;
      }

      const payload = {
        sessionId: existingSession?.id,
        employeeId: employee.id,
        attendanceDate: dateStr,
        checkInTime: status === 'absent' ? undefined : checkIn,
        checkOutTime: status === 'absent' ? undefined : checkOut,
        computedStatus: status,
        breakMinutes: status === 'absent' ? 0 : breakMinutes,
        notes: notes.trim(),
        adminUserId: currentUser.id,
        adminName: currentUser.fullName,
      };

      // 1. Save in local frontend db
      db.adminUpsertAttendanceSession(payload, {
        userId: currentUser.id,
        name: currentUser.fullName,
      });

      // 2. Sync live to backend and MySQL
      await apiAdminOverrideAttendance(payload);

      setSuccessMsg('Attendance record updated and saved to MongoDB successfully.');
      setTimeout(() => {
        onSaved();
        onClose();
      }, 1000);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to save attendance record');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteSession = async () => {
    if (!existingSession) return;
    const confirmDelete = window.confirm(
      `Are you sure you want to completely clear and delete this attendance record for ${employee.fullName} on ${formattedDateLabel}? The day will revert to Absent / Scheduled.`
    );
    if (!confirmDelete) return;

    try {
      setIsSubmitting(true);
      db.adminDeleteAttendanceSession(existingSession.id, {
        userId: currentUser.id,
        name: currentUser.fullName,
      });
      await apiAdminDeleteAttendance(existingSession.id);
      setSuccessMsg('Session deleted.');
      setTimeout(() => {
        onSaved();
        onClose();
      }, 800);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to delete record');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-xl w-full p-6 sm:p-7 border border-[#ded8cb] shadow-2xl animate-in zoom-in-95 my-8">
        {/* Header */}
        <div className="flex items-start justify-between pb-4 border-b border-[#f0ece1]">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] uppercase font-bold tracking-wider text-[#8f6927] bg-[#f7efe0] border border-[#ebd8b7] px-2 py-0.5 rounded-full flex items-center gap-1">
                <ShieldAlert className="w-3 h-3 text-[#CAA05C]" />
                Super Admin Attendance Override
              </span>
              <span className="text-[11px] text-[#717b77]">• Direct Database Edit</span>
            </div>
            <h3 className="text-lg sm:text-xl font-bold font-serif text-[#1c2120]">
              Edit Attendance Record
            </h3>
            <p className="text-xs text-[#525d59] mt-0.5 font-medium">
              {formattedDateLabel}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-stone-400 hover:text-stone-700 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Employee Banner */}
        <div className="my-4 p-3.5 bg-[#faf9f5] rounded-xl border border-[#ece7dc] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#1c2120] text-white flex items-center justify-center font-bold text-sm border border-[#37403d]">
              {employee.fullName
                .split(' ')
                .map((n) => n[0])
                .slice(0, 2)
                .join('')}
            </div>
            <div>
              <h4 className="text-sm font-bold text-[#1c2120]">{employee.fullName}</h4>
              <p className="text-xs text-[#6e7774]">
                Code: <strong className="text-[#1c2120]">{employee.employeeCode}</strong> • Shift: {shift?.startTime} – {shift?.endTime}
              </p>
            </div>
          </div>
          <span className="text-xs font-semibold px-2.5 py-1 rounded-md bg-[#eee9dc] text-[#3d4542]">
            {existingSession ? 'Existing Record' : 'No Prior Record'}
          </span>
        </div>

        {/* Quick Presets */}
        <div className="mb-4">
          <label className="block text-[11px] uppercase font-bold text-[#6e7774] mb-1.5 flex items-center gap-1">
            <Zap className="w-3.5 h-3.5 text-[#CAA05C]" />
            Quick Presets / দ্রুত স্ট্যাটাস নির্বাচন:
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
            <button
              type="button"
              onClick={() => handleApplyPreset('present')}
              className="px-2.5 py-1.5 rounded-lg border border-emerald-300 bg-emerald-50 text-emerald-900 font-semibold hover:bg-emerald-100 transition-colors cursor-pointer text-center"
            >
              ✓ Standard Present
            </button>
            <button
              type="button"
              onClick={() => handleApplyPreset('late')}
              className="px-2.5 py-1.5 rounded-lg border border-amber-300 bg-amber-50 text-amber-900 font-semibold hover:bg-amber-100 transition-colors cursor-pointer text-center"
            >
              ⏱ Late Arrival
            </button>
            <button
              type="button"
              onClick={() => handleApplyPreset('half_day')}
              className="px-2.5 py-1.5 rounded-lg border border-blue-300 bg-blue-50 text-blue-900 font-semibold hover:bg-blue-100 transition-colors cursor-pointer text-center"
            >
              ◐ Half Day
            </button>
            <button
              type="button"
              onClick={() => handleApplyPreset('absent')}
              className="px-2.5 py-1.5 rounded-lg border border-red-300 bg-red-50 text-red-900 font-semibold hover:bg-red-100 transition-colors cursor-pointer text-center"
            >
              ✕ Mark Absent
            </button>
          </div>
        </div>

        <form onSubmit={handleSave} className="space-y-4 text-xs">
          {/* Status Selection */}
          <div>
            <label className="block text-[11px] uppercase font-bold text-[#6e7774] mb-1.5">
              Attendance Classification Status:
            </label>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
              {[
                { val: 'present', label: 'Present', color: 'emerald' },
                { val: 'late', label: 'Late', color: 'amber' },
                { val: 'half_day', label: 'Half Day', color: 'blue' },
                { val: 'paid_leave', label: 'Leave', color: 'purple' },
                { val: 'missing_punch', label: 'Missing Punch', color: 'rose' },
                { val: 'absent', label: 'Absent', color: 'red' },
              ].map((s) => (
                <button
                  type="button"
                  key={s.val}
                  onClick={() => setStatus(s.val as AttendanceStatus)}
                  className={`py-2 px-1 rounded-lg font-bold text-center border text-[11px] transition-all cursor-pointer ${
                    status === s.val
                      ? 'bg-[#1c2120] text-white border-[#1c2120] shadow-xs'
                      : 'bg-[#faf9f5] text-[#55605c] border-[#ded8cb] hover:bg-[#ede8dc]'
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* Time Fields (hidden if absent) */}
          {status !== 'absent' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 bg-[#faf9f5] rounded-xl border border-[#ece7dc]">
              <div>
                <label className="block text-[11px] font-bold text-[#1c2120] mb-1 flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-emerald-700" />
                  Check-In Time (Dhaka):
                </label>
                <input
                  type="time"
                  value={checkIn}
                  onChange={(e) => setCheckIn(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-[#ded8cb] bg-white font-mono text-xs font-semibold focus:outline-none focus:border-[#CAA05C]"
                  required
                />
                <div className="flex items-center gap-1 mt-1 text-[10px] text-[#788480]">
                  <span>Quick:</span>
                  {['10:10', '10:15', '10:25', '10:45'].map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setCheckIn(t)}
                      className="px-1.5 py-0.5 rounded bg-white border border-[#ded8cb] hover:border-[#CAA05C] font-mono cursor-pointer"
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-[#1c2120] mb-1 flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-amber-700" />
                  Check-Out Time (Dhaka):
                </label>
                <input
                  type="time"
                  value={checkOut}
                  onChange={(e) => setCheckOut(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-[#ded8cb] bg-white font-mono text-xs font-semibold focus:outline-none focus:border-[#CAA05C]"
                />
                <div className="flex items-center gap-1 mt-1 text-[10px] text-[#788480]">
                  <span>Quick:</span>
                  {['19:00', '19:30', '19:45', '20:00'].map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setCheckOut(t)}
                      className="px-1.5 py-0.5 rounded bg-white border border-[#ded8cb] hover:border-[#CAA05C] font-mono cursor-pointer"
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              <div className="sm:col-span-2 flex items-center justify-between pt-2 border-t border-[#f0ece1]">
                <label className="text-[11px] font-semibold text-[#525d59] flex items-center gap-1">
                  <Coffee className="w-3.5 h-3.5 text-[#CAA05C]" />
                  Mandatory Lunch Break Deduction (mins):
                </label>
                <input
                  type="number"
                  min="0"
                  max="180"
                  step="5"
                  value={breakMinutes}
                  onChange={(e) => setBreakMinutes(Number(e.target.value) || 0)}
                  className="w-20 px-2 py-1 rounded-lg border border-[#ded8cb] bg-white font-mono text-xs text-center font-bold"
                />
              </div>
            </div>
          )}

          {/* Real-time Calculation Summary Box */}
          {status !== 'absent' && (
            <div className="p-3 bg-[#fdfcf9] rounded-xl border border-[#ded8cb] grid grid-cols-3 gap-2 text-center text-xs">
              <div className="p-2 bg-white rounded-lg border border-[#f0ece1]">
                <span className="text-[10px] text-[#717b77] block">Net Worked</span>
                <span className="font-mono font-bold text-emerald-800 text-sm">
                  {Math.floor(liveMetrics.workedMin / 60)}h {liveMetrics.workedMin % 60}m
                </span>
              </div>
              <div className="p-2 bg-white rounded-lg border border-[#f0ece1]">
                <span className="text-[10px] text-[#717b77] block">Late Duration</span>
                <span className={`font-mono font-bold text-sm ${liveMetrics.lateMin > 0 ? 'text-amber-700' : 'text-stone-400'}`}>
                  {liveMetrics.lateMin}m
                </span>
              </div>
              <div className="p-2 bg-white rounded-lg border border-[#f0ece1]">
                <span className="text-[10px] text-[#717b77] block">Overtime</span>
                <span className={`font-mono font-bold text-sm ${liveMetrics.overtimeMin > 0 ? 'text-[#CAA05C]' : 'text-stone-400'}`}>
                  {liveMetrics.overtimeMin}m
                </span>
              </div>
            </div>
          )}

          {/* Admin Override Notes */}
          <div>
            <label className="block text-[11px] uppercase font-bold text-[#6e7774] mb-1">
              Administrative Reason / Audit Note:
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Approved site inspection or HR manual verification"
              className="w-full px-3 py-2 rounded-lg border border-[#ded8cb] bg-white text-xs focus:outline-none focus:border-[#CAA05C]"
            />
          </div>

          {/* Error & Success Alerts */}
          {errorMsg && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-800 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-900 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Modal Actions */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-[#f0ece1]">
            <div>
              {existingSession && (
                <button
                  type="button"
                  onClick={handleDeleteSession}
                  disabled={isSubmitting}
                  className="text-red-600 hover:text-red-700 font-semibold text-xs flex items-center gap-1.5 cursor-pointer py-1.5"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete / Clear Record</span>
                </button>
              )}
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="px-4 py-2 rounded-xl border border-[#ded8cb] bg-white text-[#525d59] font-bold hover:bg-[#faf9f5] cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-5 py-2 rounded-xl bg-[#CAA05C] hover:bg-[#ba904c] text-[#171c1b] font-bold flex items-center gap-2 cursor-pointer shadow-xs disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                <span>{isSubmitting ? 'Saving to Database...' : 'Save Changes'}</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
