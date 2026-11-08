import test from 'node:test';
import assert from 'node:assert/strict';
import { db } from '../db/database';

test('Seed user Nahid (Super Admin) authenticates with default password matra1234', () => {
  const user = db.authenticateUser('nahid@studiomatra.com.bd', 'matra1234');
  assert.equal(user.email, 'nahid@studiomatra.com.bd');
  assert.equal(user.role, 'super_admin');
  assert.equal(user.fullName, 'Ar. Nahid Rahman');
});

test('Authentication fails with incorrect password', () => {
  assert.throws(
    () => {
      db.authenticateUser('nahid@studiomatra.com.bd', 'wrongpassword');
    },
    { message: /Incorrect password/ }
  );
});

test('Authentication fails for non-existent email', () => {
  assert.throws(
    () => {
      db.authenticateUser('unknown@studiomatra.com.bd', 'matra1234');
    },
    { message: /No account found with this email/ }
  );
});

test('User can change password when providing correct current password', () => {
  const user = db.authenticateUser('tasnim@studiomatra.com.bd', 'matra1234');
  const success = db.changePassword(user.id, 'matra1234', 'tasnimNew2026');
  assert.equal(success, true);

  // Old password no longer works
  assert.throws(() => {
    db.authenticateUser('tasnim@studiomatra.com.bd', 'matra1234');
  });

  // New password works
  const reauthed = db.authenticateUser('tasnim@studiomatra.com.bd', 'tasnimNew2026');
  assert.equal(reauthed.id, user.id);

  // Restore for subsequent tests
  db.changePassword(user.id, 'tasnimNew2026', 'matra1234');
});

test('User cannot change password with invalid current password', () => {
  const user = db.authenticateUser('tanvir@studiomatra.com.bd', 'matra1234');
  assert.throws(
    () => {
      db.changePassword(user.id, 'incorrectPassword', 'newSecret123');
    },
    { message: /Current password does not match/ }
  );
});

test('Admin can reset staff password and employee can authenticate with new password', () => {
  // Find employee Tanvir
  const employees = db.getEmployees();
  const tanvir = employees.find((e) => e.email.includes('tanvir'));
  assert.ok(tanvir, 'Tanvir employee record must exist');

  db.resetUserPassword(tanvir.id, 'tanvirReset99', {
    userId: 'user-0001',
    name: 'Ar. Nahid Rahman',
  });

  const loggedIn = db.authenticateUser(tanvir.email, 'tanvirReset99');
  assert.equal(loggedIn.fullName, tanvir.fullName);

  // Restore
  db.resetUserPassword(tanvir.id, 'matra1234', {
    userId: 'user-0001',
    name: 'Ar. Nahid Rahman',
  });
});

test('createEmployee with custom password and role allows immediate login', () => {
  const uniqueId = Date.now();
  const testEmail = `newarchitect_${uniqueId}@studiomatra.com.bd`;

  const newEmp = db.createEmployee(
    {
      userId: `user-temp-${uniqueId}`,
      employeeCode: `SM-99${String(uniqueId).slice(-2)}`,
      fullName: 'Test Newly Provisioned Architect',
      email: testEmail,
      phone: '+880 1711-999999',
      departmentId: 'dept-arch',
      designationId: 'des-sr-arch',
      joiningDate: '2026-11-01',
      employmentStatus: 'active',
      employmentType: 'full_time',
      shiftId: 'shift-standard',
      emergencyContact: {
        name: 'Emergency',
        relationship: 'Sibling',
        phone: '+880 1711-000000',
      },
      paymentDetails: {
        bankName: 'Eastern Bank Ltd',
        accountName: 'Test Architect',
        accountNumber: '10410099999',
        branchName: 'Gulshan Branch',
      },
    },
    { userId: 'user-0001', name: 'Ar. Nahid Rahman' },
    {
      pinCode: '7788',
      password: 'customSecurePass2026',
      role: 'department_manager',
    }
  );

  assert.ok(newEmp.id);

  // Verify that the new user can authenticate with the credentials provisioned by HR
  const authUser = db.authenticateUser(testEmail, 'customSecurePass2026');
  assert.equal(authUser.fullName, 'Test Newly Provisioned Architect');
  assert.equal(authUser.role, 'department_manager');
  assert.equal(authUser.pinCode, '7788');

  // Clean up
  db.deleteEmployee(newEmp.id, { userId: 'user-0001', name: 'Ar. Nahid Rahman' });
});
