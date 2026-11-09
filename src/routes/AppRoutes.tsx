import React, { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AppLayout } from '../components/layout/AppLayout';
import { ProtectedRoute } from '../components/common/ProtectedRoute';
import { PageLoader } from '../components/common/PageLoader';
import { hasPermission } from '../utils/permissions';

// Lazy-loaded page components for optimal bundle performance
const LoginPage = lazy(() => import('../pages/LoginPage'));
const DashboardPage = lazy(() => import('../pages/DashboardPage'));
const AttendancePage = lazy(() => import('../pages/AttendancePage'));
const StaffAttendancePage = lazy(() => import('../pages/StaffAttendancePage'));
const LeavePage = lazy(() => import('../pages/LeavePage'));
const PayrollPage = lazy(() => import('../pages/PayrollPage'));
const EmployeesPage = lazy(() => import('../pages/EmployeesPage'));
const ReportsPage = lazy(() => import('../pages/ReportsPage'));
const SettingsPage = lazy(() => import('../pages/SettingsPage'));
const NotFoundPage = lazy(() => import('../pages/NotFoundPage'));

export const AppRoutes: React.FC = () => {
  return (
    <Routes>
      {/* Public Login Route (No registration permitted) */}
      <Route
        path="/login"
        element={
          <Suspense fallback={<PageLoader />}>
            <LoginPage />
          </Suspense>
        }
      />

      {/* Authenticated Application Shell */}
      <Route path="/" element={<AppLayout />}>
        {/* Main Dashboard */}
        <Route index element={<DashboardPage />} />
        <Route path="dashboard" element={<Navigate to="/" replace />} />

        {/* Attendance Register & Kiosk Logs */}
        <Route path="attendance" element={<AttendancePage />} />

        {/* Staff Monthly Attendance & Management (Super Admin Exclusive) */}
        <Route
          path="staff-attendance"
          element={
            <ProtectedRoute
              check={(role) => role === 'super_admin'}
              message="Staff Monthly Attendance & Management console is exclusively restricted to Studio Super Admin."
            >
              <StaffAttendancePage />
            </ProtectedRoute>
          }
        />
        <Route path="attendance/management" element={<Navigate to="/staff-attendance" replace />} />

        {/* Leave Requests & Balances */}
        <Route path="leave" element={<LeavePage />} />

        {/* Payroll & Compensation (Restricted) */}
        <Route
          path="payroll"
          element={
            <ProtectedRoute
              check={(role) =>
                hasPermission(role, 'payroll.calculate') ||
                hasPermission(role, 'salary.read') ||
                role === 'employee'
              }
              message="Payroll calculations and confidential studio contracts are restricted to authorized administrators, finance managers, or individual employees viewing their personal payslips."
            >
              <PayrollPage />
            </ProtectedRoute>
          }
        />

        {/* Studio Employees Directory (Restricted from basic Employee role) */}
        <Route
          path="employees"
          element={
            <ProtectedRoute
              check={(role) => role !== 'employee'}
              message="The studio employee directory and team management console is restricted to management and administrative staff."
            >
              <EmployeesPage />
            </ProtectedRoute>
          }
        />

        {/* Reports & Compliance Registers */}
        <Route
          path="reports"
          element={
            <ProtectedRoute
              check={(role) =>
                hasPermission(role, 'reports.hr') ||
                hasPermission(role, 'reports.payroll')
              }
              message="Official HR registers and financial export reports require elevated management permissions."
            >
              <ReportsPage />
            </ProtectedRoute>
          }
        />

        {/* Settings, Shift Policy & Audit Trail */}
        <Route
          path="settings"
          element={
            <ProtectedRoute
              check={(role) => role === 'super_admin' || role === 'hr_admin'}
              message="Studio configuration, IP address rules, and system audit logs can only be modified by Super Admins and HR Admins."
            >
              <SettingsPage />
            </ProtectedRoute>
          }
        />

        {/* 404 Route */}
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
};

