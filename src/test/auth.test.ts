import test from 'node:test';
import assert from 'node:assert/strict';
import { db } from '../db/database';

test('Seed user Ishtiaque (Super Admin) authenticates with default password matra1234', () => {
  const user = db.authenticateUser('ishtiaque@studiomatra.com.bd', 'matra1234');
  assert.equal(user.email, 'ishtiaque@studiomatra.com.bd');
  assert.equal(user.role, 'super_admin');
  assert.equal(user.fullName, 'IAr. Md. Ishtiaque Haque');
});

test('Authentication fails with incorrect password', () => {
  assert.throws(
    () => {
      db.authenticateUser('ishtiaque@studiomatra.com.bd', 'wrongpassword');
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
  const user = db.authenticateUser('mohit@studiomatra.com.bd', 'matra1234');
  const success = db.changePassword(user.id, 'matra1234', 'mohitNew2026');
  assert.equal(success, true);

  // Old password no longer works
  assert.throws(() => {
    db.authenticateUser('mohit@studiomatra.com.bd', 'matra1234');
  });

  // New password works
  const reauthed = db.authenticateUser('mohit@studiomatra.com.bd', 'mohitNew2026');
  assert.equal(reauthed.id, user.id);

  // Restore for subsequent tests
  db.changePassword(user.id, 'mohitNew2026', 'matra1234');
});

test('User cannot change password with invalid current password', () => {
  const user = db.authenticateUser('iqbal@studiomatra.com.bd', 'matra1234');
  assert.throws(
    () => {
      db.changePassword(user.id, 'incorrectPassword', 'newSecret123');
    },
    { message: /Current password does not match/ }
  );
});

test('Admin can reset staff password and employee can authenticate with new password', () => {
  // Find employee Iqbal
  const employees = db.getEmployees();
  const iqbal = employees.find((e) => e.email.includes('iqbal'));
  assert.ok(iqbal, 'Iqbal employee record must exist');

  db.resetUserPassword(iqbal.id, 'iqbalReset99', {
    userId: 'user-0001',
    name: 'IAr. Md. Ishtiaque Haque',
  });

  const loggedIn = db.authenticateUser(iqbal.email, 'iqbalReset99');
  assert.equal(loggedIn.fullName, iqbal.fullName);

  // Restore
  db.resetUserPassword(iqbal.id, 'matra1234', {
    userId: 'user-0001',
    name: 'IAr. Md. Ishtiaque Haque',
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
      designationId: 'des-3d-intern',
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
    { userId: 'user-0001', name: 'IAr. Md. Ishtiaque Haque' },
    {
      pinCode: '7788',
      password: 'customSecurePass2026',
      role: 'employee',
    }
  );

  assert.ok(newEmp.id);

  // Verify that the new user can authenticate with the credentials provisioned by HR
  const authUser = db.authenticateUser(testEmail, 'customSecurePass2026');
  assert.equal(authUser.fullName, 'Test Newly Provisioned Architect');
  assert.equal(authUser.role, 'employee');
  assert.equal(authUser.pinCode, '7788');

  // Clean up
  db.deleteEmployee(newEmp.id, { userId: 'user-0001', name: 'IAr. Md. Ishtiaque Haque' });
});
