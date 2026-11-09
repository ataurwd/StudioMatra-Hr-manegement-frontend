/**
 * Unit Tests for Attendance Calculations
 * Run with: npx --yes tsx --test src/test/attendance.test.ts
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { db } from '../db/database';
import { TEST_STATE } from './testFixtures';

// Initialize in-memory test fixtures for headless test runner
db.syncFromRemote(TEST_STATE);
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

test('Super Admin can directly override and upsert attendance session for an individual employee', () => {
  const adminActor = { userId: 'user-0001', name: 'Ar. Nahid Rahman' };
  const employees = db.getEmployees();
  assert.ok(employees.length > 0);
  const targetEmp = employees[0];

  const session = db.adminUpsertAttendanceSession(
    {
      employeeId: targetEmp.id,
      attendanceDate: '2026-11-20',
      checkInTime: '09:00',
      checkOutTime: '18:00',
      computedStatus: 'present',
      breakMinutes: 60,
      notes: 'Super Admin manual adjustment',
    },
    adminActor
  );

  assert.ok(session);
  assert.equal(session.employeeId, targetEmp.id);
  assert.equal(session.attendanceDate, '2026-11-20');
  assert.equal(session.computedStatus, 'present');
  assert.equal(session.workedMinutes, 480);
  assert.equal(session.sourceType, 'manual_adjustment');

  // Verify it can be retrieved by employeeId
  const retrieved = db.getAttendanceSessions({
    employeeId: targetEmp.id,
    startDate: '2026-11-20',
    endDate: '2026-11-20',
  });
  assert.equal(retrieved.length, 1);
  assert.equal(retrieved[0].id, session.id);
});

test('Super Admin can delete attendance session to clear or mark absent', () => {
  const adminActor = { userId: 'user-0001', name: 'Ar. Nahid Rahman' };
  const employees = db.getEmployees();
  const targetEmp = employees[0];

  // Create temporary session
  const session = db.adminUpsertAttendanceSession(
    {
      employeeId: targetEmp.id,
      attendanceDate: '2026-11-21',
      checkInTime: '09:30',
      checkOutTime: '18:00',
      computedStatus: 'late',
      notes: 'Temporary session to delete',
    },
    adminActor
  );

  const deleted = db.adminDeleteAttendanceSession(session.id, adminActor);
  assert.equal(deleted, true);

  const afterDelete = db.getAttendanceSessions({
    employeeId: targetEmp.id,
    startDate: '2026-11-21',
    endDate: '2026-11-21',
  });
  assert.equal(afterDelete.length, 0);
});

test('Employee can submit attendance correction request, Super Admin receives notification, and Admin review marks attendance present and notifies employee', () => {
  const empActor = { userId: 'user-0003', name: 'Ar. Iqbal Hossain' };
  const adminActor = { userId: 'user-0001', name: 'IAr. Md. Ishtiaque Haque', role: 'super_admin' };

  // 1. Employee submits correction request for 2026-11-15 (which had no punches / absent)
  const correction = db.submitCorrectionRequest(
    {
      employeeId: 'emp-0003',
      attendanceDate: '2026-11-15',
      requestedCheckIn: '09:00',
      requestedCheckOut: '18:00',
      reason: 'Was supervising site construction in Banani, forgot to punch at office reception terminal',
    },
    empActor
  );

  assert.ok(correction);
  assert.equal(correction.status, 'submitted');
  assert.equal(correction.employeeId, 'emp-0003');
  assert.equal(correction.attendanceDate, '2026-11-15');

  // 2. Super Admin receives an in-app notification
  const adminNotifications = db.getNotifications('user-0001');
  const foundNotif = adminNotifications.find(
    (n) => n.type === 'correction' && n.message.includes('Ar. Iqbal Hossain') && n.message.includes('2026-11-15')
  );
  assert.ok(foundNotif, 'Super Admin must receive a notification for the correction request');
  assert.equal(foundNotif.title, 'New Attendance Correction Request');

  // 3. Super Admin reviews and approves the correction request
  db.reviewCorrectionRequest({
    requestId: correction.id,
    action: 'apply',
    comment: 'Verified with site supervisor logbook. Approved as Present.',
    reviewer: adminActor,
  });

  // 4. Verify correction status is now 'applied'
  const updatedCorrection = db.getCorrectionRequests('emp-0003').find((c) => c.id === correction.id);
  assert.ok(updatedCorrection);
  assert.equal(updatedCorrection.status, 'applied');
  assert.equal(updatedCorrection.approvedBy, 'user-0001');

  // 5. Verify attendance session for that date now exists with status 'present'
  const sessions = db.getAttendanceSessions({
    employeeId: 'emp-0003',
    startDate: '2026-11-15',
    endDate: '2026-11-15',
  });
  assert.equal(sessions.length, 1);
  assert.equal(sessions[0].computedStatus, 'present');
  assert.equal(sessions[0].correctionStatus, 'applied');

  // 6. Verify employee receives notification that correction was approved
  const empNotifications = db.getNotifications('user-0003');
  const approvalNotif = empNotifications.find(
    (n) => n.type === 'correction' && n.title === 'Attendance Correction Approved'
  );
  assert.ok(approvalNotif, 'Employee must receive approval notification');
});

