import React, { useState, useEffect } from 'react';
import { Calendar, Clock, FileText, Send, Sparkles, X } from 'lucide-react';
import { db } from '../db/database';
import { apiSubmitCorrection, syncWithBackend } from '../services/apiService';
import { AttendanceSession, User } from '../types';

interface AttendanceCorrectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User;
  employeeId: string;
  initialDate?: string;
  initialSession?: AttendanceSession | null;
  onSuccess?: () => void;
}

export const AttendanceCorrectionModal: React.FC<AttendanceCorrectionModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  employeeId,
  initialDate,
  initialSession,
  onSuccess,
}) => {
  const todayDhaka = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Dhaka' }).format(new Date());

  const [targetDate, setTargetDate] = useState<string>(initialDate || todayDhaka);
  const [checkInTime, setCheckInTime] = useState<string>('09:00');
  const [checkOutTime, setCheckOutTime] = useState<string>('18:00');
  const [reason, setReason] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [successMsg, setSuccessMsg] = useState<string>('');

  // Find session for the selected targetDate if not provided
  const existingSession = initialSession || db.getAttendanceSessions({ employeeId }).find((s) => s.attendanceDate === targetDate);

  useEffect(() => {
    if (initialDate) {
      setTargetDate(initialDate);
    }
  }, [initialDate]);

  useEffect(() => {
    if (existingSession) {
      if (existingSession.checkInAt) {
        setCheckInTime(
          new Date(existingSession.checkInAt).toLocaleTimeString('en-GB', {
            timeZone: 'Asia/Dhaka',
            hour: '2-digit',
            minute: '2-digit',
          })
        );
      }
      if (existingSession.checkOutAt) {
        setCheckOutTime(
          new Date(existingSession.checkOutAt).toLocaleTimeString('en-GB', {
            timeZone: 'Asia/Dhaka',
            hour: '2-digit',
            minute: '2-digit',
          })
        );
      } else {
        setCheckOutTime('18:00');
      }
    } else {
      setCheckInTime('09:00');
      setCheckOutTime('18:00');
    }
    setErrorMsg('');
    setSuccessMsg('');
  }, [targetDate, existingSession]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (!targetDate) {
      setErrorMsg('Please select an attendance date.');
      return;
    }

    if (targetDate > todayDhaka) {
      setErrorMsg('Cannot request attendance correction for future dates.');
      return;
    }

    if (!reason.trim()) {
      setErrorMsg('Please write a specific reason for this attendance correction request.');
      return;
    }

    setSubmitting(true);
    try {
      const actor = { userId: currentUser.id, name: currentUser.fullName };
      const correctionData = {
        employeeId,
        sessionId: existingSession?.id,
        attendanceDate: targetDate,
        requestedCheckIn: checkInTime,
        requestedCheckOut: checkOutTime,
        reason: reason.trim(),
      };

      // 1. Submit to local/client DB (immediately triggers reactive UI & Admin in-app notification)
      db.submitCorrectionRequest(correctionData, actor);

      // 2. Persist to MySQL Backend via REST API
      apiSubmitCorrection(correctionData, actor).catch(() => {});

      setSuccessMsg(
        'Attendance correction request submitted successfully! Super Admin has been notified and will review your request.'
      );

      setTimeout(() => {
        setSubmitting(false);
        setReason('');
        if (onSuccess) onSuccess();
        onClose();
        syncWithBackend().catch(() => {});
      }, 1500);
    } catch (err: any) {
      setSubmitting(false);
      setErrorMsg(err.message || 'Failed to submit correction request.');
    }
  };

  const employee = db.getEmployeeById(employeeId);

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-lg w-full p-6 sm:p-7 border border-[#ded8cb] shadow-2xl animate-in zoom-in-95">
        <div className="flex items-center justify-between pb-4 border-b border-[#f0ece1]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#faf7f0] border border-[#ebd8b7] flex items-center justify-center text-[#CAA05C]">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-[#1c2120]">Request Attendance Correction</h3>
              <p className="text-xs text-[#717b77]">
                Submit official punch correction or missed attendance request to Super Admin
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-stone-400 hover:text-stone-700 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 mt-5 text-xs">
          {errorMsg && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-800 font-medium text-xs">
              {errorMsg}
            </div>
          )}

          {successMsg && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 font-medium text-xs flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Employee Info Header */}
          <div className="p-3.5 bg-[#faf9f5] rounded-xl border border-[#ece7dc] flex items-center justify-between">
            <div>
              <span className="text-[10px] uppercase font-bold text-[#717b77] block">Applicant</span>
              <p className="font-bold text-sm text-[#1c2120] mt-0.5">{employee?.fullName}</p>
              <span className="text-[10px] text-[#8f6927] font-mono font-bold">
                {employee?.employeeCode}
              </span>
            </div>
            <div className="text-right">
              <span className="text-[10px] uppercase font-bold text-[#717b77] block">Status on Date</span>
              <span
                className={`inline-block mt-0.5 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                  existingSession
                    ? existingSession.computedStatus === 'present'
                      ? 'bg-emerald-100 text-emerald-800'
                      : existingSession.computedStatus === 'late'
                      ? 'bg-amber-100 text-amber-800'
                      : 'bg-stone-200 text-stone-800'
                    : 'bg-red-100 text-red-800'
                }`}
              >
                {existingSession ? existingSession.computedStatus.replace('_', ' ') : 'No Punch Recorded (Absent)'}
              </span>
            </div>
          </div>

          {/* Target Attendance Date */}
          <div>
            <label className="block font-bold text-[#1c2120] mb-1">
              Attendance Date to Correct <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <input
                type="date"
                max={todayDhaka}
                value={targetDate}
                onChange={(e) => setTargetDate(e.target.value)}
                className="w-full p-2.5 border border-[#ded8cb] rounded-xl font-mono text-xs bg-[#faf9f5] focus:outline-none focus:border-[#CAA05C]"
                required
              />
            </div>
            <p className="text-[10px] text-[#717b77] mt-1">
              Select the workday for which you need to record presence or correct in/out punch times.
            </p>
          </div>

          {/* Requested Punch Times */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-[#1c2120] mb-1">
                Requested Check-In (HH:mm) <span className="text-red-500">*</span>
              </label>
              <input
                type="time"
                value={checkInTime}
                onChange={(e) => setCheckInTime(e.target.value)}
                className="w-full p-2.5 border border-[#ded8cb] rounded-xl font-mono text-xs bg-[#faf9f5] focus:outline-none focus:border-[#CAA05C]"
                required
              />
              <span className="text-[10px] text-[#717b77] mt-0.5 block">Standard: 09:00 AM</span>
            </div>

            <div>
              <label className="block font-bold text-[#1c2120] mb-1">
                Requested Check-Out (HH:mm) <span className="text-red-500">*</span>
              </label>
              <input
                type="time"
                value={checkOutTime}
                onChange={(e) => setCheckOutTime(e.target.value)}
                className="w-full p-2.5 border border-[#ded8cb] rounded-xl font-mono text-xs bg-[#faf9f5] focus:outline-none focus:border-[#CAA05C]"
                required
              />
              <span className="text-[10px] text-[#717b77] mt-0.5 block">Standard: 18:00 PM</span>
            </div>
          </div>

          {/* Reason / Justification */}
          <div>
            <label className="block font-bold text-[#1c2120] mb-1">
              Reason / Justification <span className="text-red-500">*</span>
            </label>
            <textarea
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. On-site architectural site measurement in Dhanmondi; couldn't check in at reception terminal..."
              className="w-full p-2.5 border border-[#ded8cb] rounded-xl text-xs bg-[#faf9f5] focus:outline-none focus:border-[#CAA05C]"
              required
            />
            <p className="text-[10px] text-[#717b77] mt-1">
              Please provide clear operational details. The Super Admin will review this note before approving.
            </p>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#f0ece1]">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2 rounded-xl bg-[#f4f1ea] hover:bg-[#eae6dc] text-[#1c2120] font-semibold text-xs transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 rounded-xl bg-[#CAA05C] hover:bg-[#ba904c] text-[#171c1b] font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs disabled:opacity-50"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{submitting ? 'Submitting...' : 'Submit Request'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
