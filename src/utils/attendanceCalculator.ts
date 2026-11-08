/**
 * STUDIO MATRA — Attendance Calculation Engine
 * Pure business logic for office attendance metrics, shifts, late grace period,
 * early departure, break deduction, and status classification.
 */

import { AttendanceStatus, ShiftDefinition } from '../types';

export interface ShiftTimeConfig {
  startTime: string; // '09:00'
  endTime: string;   // '18:00'
  graceMinutes: number; // 10
  breakMinutes: number; // 60
}

/**
 * Parses 'HH:mm' time string into minutes from midnight.
 */
export function timeStringToMinutes(timeStr: string): number {
  if (!timeStr) return 0;
  const parts = timeStr.split(':');
  const hours = parseInt(parts[0], 10) || 0;
  const minutes = parseInt(parts[1], 10) || 0;
  return hours * 60 + minutes;
}

/**
 * Converts ISO datetime or Date object to Asia/Dhaka time in 'HH:mm' format
 */
export function getDhakaTimeMinutes(dateInput: string | Date): { hours: number; minutes: number; totalMinutes: number; timeStr: string } {
  const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
  
  // Format in Asia/Dhaka timezone
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Dhaka',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  
  const timeStr = formatter.format(date);
  const totalMinutes = timeStringToMinutes(timeStr);
  const [hours, minutes] = timeStr.split(':').map(n => parseInt(n, 10));

  return { hours, minutes, totalMinutes, timeStr };
}

/**
 * Calculates check-in metrics including late minutes against shift start and grace period.
 */
export function calculateCheckInMetrics(
  checkInDate: string | Date,
  shift: ShiftTimeConfig
): { lateMinutes: number; isLate: boolean; checkInTimeStr: string } {
  const { totalMinutes, timeStr } = getDhakaTimeMinutes(checkInDate);
  const shiftStartMin = timeStringToMinutes(shift.startTime);
  const graceThresholdMin = shiftStartMin + shift.graceMinutes;

  if (totalMinutes > graceThresholdMin) {
    const lateMinutes = totalMinutes - shiftStartMin;
    return { lateMinutes, isLate: true, checkInTimeStr: timeStr };
  }

  return { lateMinutes: 0, isLate: false, checkInTimeStr: timeStr };
}

/**
 * Calculates full session duration, net worked minutes, early departures, and overtime.
 */
export function calculateSessionMetrics(params: {
  checkInAt: string | Date;
  checkOutAt?: string | Date | null;
  shift: ShiftTimeConfig;
  approvedOvertimeEligible?: boolean;
}): {
  scheduledMinutes: number;
  totalElapsedMinutes: number;
  workedMinutes: number;
  breakMinutes: number;
  lateMinutes: number;
  earlyDepartureMinutes: number;
  overtimeMinutes: number;
  status: AttendanceStatus;
  isMissingPunch: boolean;
} {
  const { checkInAt, checkOutAt, shift, approvedOvertimeEligible = true } = params;
  
  const shiftStartMin = timeStringToMinutes(shift.startTime);
  const shiftEndMin = timeStringToMinutes(shift.endTime);
  const scheduledMinutes = Math.max(0, shiftEndMin - shiftStartMin - shift.breakMinutes);

  const checkIn = getDhakaTimeMinutes(checkInAt);
  const { lateMinutes } = calculateCheckInMetrics(checkInAt, shift);

  // If no checkout is provided yet
  if (!checkOutAt) {
    const isLate = lateMinutes > 0;
    return {
      scheduledMinutes,
      totalElapsedMinutes: 0,
      workedMinutes: 0,
      breakMinutes: shift.breakMinutes,
      lateMinutes,
      earlyDepartureMinutes: 0,
      overtimeMinutes: 0,
      status: isLate ? 'late' : 'present',
      isMissingPunch: false,
    };
  }

  const checkOut = getDhakaTimeMinutes(checkOutAt);
  const checkInDateObj = typeof checkInAt === 'string' ? new Date(checkInAt) : checkInAt;
  const checkOutDateObj = typeof checkOutAt === 'string' ? new Date(checkOutAt) : checkOutAt;

  // Real elapsed minutes based on timestamps
  const diffMs = checkOutDateObj.getTime() - checkInDateObj.getTime();
  const totalElapsedMinutes = Math.max(0, Math.floor(diffMs / (1000 * 60)));

  // Deduct unpaid lunch/rest break if worked more than break duration
  const breakToDeduct = totalElapsedMinutes >= (scheduledMinutes / 2) ? shift.breakMinutes : 0;
  const workedMinutes = Math.max(0, totalElapsedMinutes - breakToDeduct);

  // Early departure calculation (if employee leaves before scheduled shift end)
  let earlyDepartureMinutes = 0;
  if (checkOut.totalMinutes < shiftEndMin) {
    earlyDepartureMinutes = Math.max(0, shiftEndMin - checkOut.totalMinutes);
  }

  // Overtime calculation: net worked minutes beyond scheduled work time
  let overtimeMinutes = 0;
  if (approvedOvertimeEligible && workedMinutes > scheduledMinutes) {
    overtimeMinutes = workedMinutes - scheduledMinutes;
  }

  // Determine classification
  let status: AttendanceStatus = 'present';
  if (workedMinutes < (scheduledMinutes / 2)) {
    // Worked less than half of scheduled time
    status = 'half_day';
  } else if (lateMinutes > 0) {
    status = 'late';
  } else {
    status = 'present';
  }

  return {
    scheduledMinutes,
    totalElapsedMinutes,
    workedMinutes,
    breakMinutes: breakToDeduct,
    lateMinutes,
    earlyDepartureMinutes,
    overtimeMinutes,
    status,
    isMissingPunch: false,
  };
}

/**
 * Checks whether an unclosed session from a previous day is a missing punch.
 */
export function checkIsMissingPunch(
  sessionDate: string, // 'YYYY-MM-DD'
  checkInAt: string,
  checkOutAt: string | undefined,
  currentDhakaDate: string // 'YYYY-MM-DD'
): boolean {
  if (checkOutAt) return false;
  // If the session was started on a date strictly prior to current date, it's missing punch
  return sessionDate < currentDhakaDate;
}

/**
 * Formats minutes into human readable hours & minutes (e.g. 8h 15m)
 */
export function formatMinutes(minutes: number): string {
  if (!minutes || minutes <= 0) return '0m';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}
