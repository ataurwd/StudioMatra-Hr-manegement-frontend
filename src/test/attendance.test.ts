/**
 * Unit Tests for Attendance Calculations
 * Run with: npx --yes tsx --test src/test/attendance.test.ts
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateCheckInMetrics,
  calculateSessionMetrics,
  checkIsMissingPunch,
  formatMinutes,
  ShiftTimeConfig
} from '../utils/attendanceCalculator';

const standardShift: ShiftTimeConfig = {
  startTime: '09:00',
  endTime: '18:00',
  graceMinutes: 10,
  breakMinutes: 60,
};

test('On-time check-in at 08:55 AM produces 0 late minutes', () => {
  // 08:55 AM in Asia/Dhaka is 02:55 UTC
  const checkIn = new Date('2026-11-04T02:55:00.000Z');
  const metrics = calculateCheckInMetrics(checkIn, standardShift);
  assert.equal(metrics.isLate, false);
  assert.equal(metrics.lateMinutes, 0);
});

test('Check-in within grace period at 09:08 AM is not flagged as late', () => {
  // 09:08 AM in Asia/Dhaka is 03:08 UTC
  const checkIn = new Date('2026-11-04T03:08:00.000Z');
  const metrics = calculateCheckInMetrics(checkIn, standardShift);
  assert.equal(metrics.isLate, false);
  assert.equal(metrics.lateMinutes, 0);
});

test('Check-in beyond 10-min grace period at 09:18 AM records 18 late minutes', () => {
  // 09:18 AM in Asia/Dhaka is 03:18 UTC
  const checkIn = new Date('2026-11-04T03:18:00.000Z');
  const metrics = calculateCheckInMetrics(checkIn, standardShift);
  assert.equal(metrics.isLate, true);
  assert.equal(metrics.lateMinutes, 18);
});

test('Full workday with 1 hr break deducts 60 min and computes 480 min (8 hrs) worked', () => {
  const checkIn = new Date('2026-11-04T03:00:00.000Z'); // 09:00 AM Dhaka
  const checkOut = new Date('2026-11-04T12:00:00.000Z'); // 18:00 PM Dhaka (9 elapsed hrs)
  
  const result = calculateSessionMetrics({
    checkInAt: checkIn,
    checkOutAt: checkOut,
    shift: standardShift,
  });

  assert.equal(result.scheduledMinutes, 480); // (9 * 60) - 60 = 480
  assert.equal(result.totalElapsedMinutes, 540); // 9 hours
  assert.equal(result.breakMinutes, 60);
  assert.equal(result.workedMinutes, 480); // 8 hours net
  assert.equal(result.earlyDepartureMinutes, 0);
  assert.equal(result.overtimeMinutes, 0);
  assert.equal(result.status, 'present');
});

test('Early departure at 16:30 PM flags 90 minutes early departure', () => {
  const checkIn = new Date('2026-11-04T03:00:00.000Z'); // 09:00 AM Dhaka
  const checkOut = new Date('2026-11-04T10:30:00.000Z'); // 16:30 PM Dhaka
  
  const result = calculateSessionMetrics({
    checkInAt: checkIn,
    checkOutAt: checkOut,
    shift: standardShift,
  });

  assert.equal(result.earlyDepartureMinutes, 90);
});

test('Approved overtime beyond 18:00 records extra worked minutes', () => {
  const checkIn = new Date('2026-11-04T03:00:00.000Z'); // 09:00 AM Dhaka
  const checkOut = new Date('2026-11-04T14:00:00.000Z'); // 20:00 PM Dhaka (11 elapsed hours)
  
  const result = calculateSessionMetrics({
    checkInAt: checkIn,
    checkOutAt: checkOut,
    shift: standardShift,
    approvedOvertimeEligible: true,
  });

  // 11 hours elapsed - 1 hr break = 10 hours (600 min). Scheduled is 480 min. Overtime = 120 min (2 hrs)
  assert.equal(result.workedMinutes, 600);
  assert.equal(result.overtimeMinutes, 120);
});

test('Worked less than half scheduled day classifies as half_day', () => {
  const checkIn = new Date('2026-11-04T03:00:00.000Z'); // 09:00 AM Dhaka
  const checkOut = new Date('2026-11-04T06:00:00.000Z'); // 12:00 PM Dhaka (3 hrs elapsed = 180 min < 240)
  
  const result = calculateSessionMetrics({
    checkInAt: checkIn,
    checkOutAt: checkOut,
    shift: standardShift,
  });

  assert.equal(result.status, 'half_day');
});

test('checkIsMissingPunch identifies yesterday unclosed session', () => {
  const isMissing = checkIsMissingPunch('2026-11-03', '2026-11-03T03:00:00Z', undefined, '2026-11-04');
  assert.equal(isMissing, true);

  const notMissingToday = checkIsMissingPunch('2026-11-04', '2026-11-04T03:00:00Z', undefined, '2026-11-04');
  assert.equal(notMissingToday, false);
});

test('formatMinutes formats properly', () => {
  assert.equal(formatMinutes(480), '8h');
  assert.equal(formatMinutes(495), '8h 15m');
  assert.equal(formatMinutes(45), '45m');
  assert.equal(formatMinutes(0), '0m');
});
