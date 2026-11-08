import React, { useState } from 'react';
import {
  Calendar,
  Clock,
  Download,
  FileCheck,
  FileSpreadsheet,
  FileText,
  Filter,
  Printer,
  Search,
  Wallet,
} from 'lucide-react';
import { db } from '../db/database';
import { downloadCSV } from '../services/exportService';
import { RoleName, User } from '../types';
import { formatMinutes } from '../utils/attendanceCalculator';
import { canViewSalary, hasPermission } from '../utils/permissions';
import { formatBDT } from '../utils/money';

interface ReportsViewProps {
  currentUser: User;
}

export const ReportsView: React.FC<ReportsViewProps> = ({ currentUser }) => {
  const canSeePayroll = canViewSalary(currentUser.role);
  const [selectedReport, setSelectedReport] = useState<string>('daily_attendance');
  const [selectedDept, setSelectedDept] = useState<string>('all');
  const [dateFrom, setDateFrom] = useState<string>('2026-10-01');
  const [dateTo, setDateTo] = useState<string>(
    new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Dhaka' }).format(new Date())
  );

  const employees = db.getEmployees();
  const departments = db.getDepartments();
  const sessions = db.getAttendanceSessions();
  const leaveRequests = db.getLeaveRequests();
  const leaveTypes = db.getLeaveTypes();
  const payrollRuns = db.getPayrollRuns();
  const payrollItems = db.getPayrollItems();
  const advances = db.getSalaryAdvances();
  const auditLogs = db.getAuditLogs();

  const reportList = [
    { id: 'daily_attendance', name: '1. Daily Office Attendance Register', category: 'attendance' },
    { id: 'monthly_attendance', name: '2. Monthly Employee Attendance Register', category: 'attendance' },
    { id: 'late_arrival', name: '3. Late Arrival & Grace Period Report', category: 'attendance' },
    { id: 'missing_punch', name: '4. Missing Punch Report', category: 'attendance' },
    { id: 'absence_report', name: '5. Employee Absence Report', category: 'attendance' },
    { id: 'working_hours', name: '6. Net Working Hours Summary', category: 'attendance' },
    { id: 'leave_register', name: '7. Leave Application Register', category: 'leave' },
    { id: 'leave_balance', name: '8. Annual Leave Balance Report', category: 'leave' },
    { id: 'payroll_register', name: '9. Monthly Payroll Register (BDT)', category: 'payroll', restricted: true },
    { id: 'salary_statement', name: '10. Employee Salary Statement', category: 'payroll', restricted: true },
    { id: 'overtime_report', name: '11. Overtime Hours & Compensation', category: 'payroll', restricted: true },
    { id: 'advance_recovery', name: '12. Salary Advance & Loan Recovery', category: 'payroll', restricted: true },
    { id: 'dept_payroll', name: '13. Department Payroll Summary', category: 'payroll', restricted: true },
    { id: 'payment_status', name: '14. Payment & Disbursement Status', category: 'payroll', restricted: true },
    { id: 'adjustment_audit', name: '15. Attendance Adjustment Audit Report', category: 'audit' },
  ];

  const handleExportCSV = () => {
    switch (selectedReport) {
      case 'daily_attendance': {
        const headers = ['Date', 'Employee Code', 'Full Name', 'Department', 'Check-In', 'Check-Out', 'Worked Minutes', 'Late Minutes', 'Status'];
        const rows = sessions.map((s) => {
          const emp = employees.find((e) => e.id === s.employeeId);
          const dept = departments.find((d) => d.id === emp?.departmentId);
          return [
            s.attendanceDate,
            emp?.employeeCode || '',
            emp?.fullName || '',
            dept?.name || '',
            s.checkInAt ? new Date(s.checkInAt).toLocaleTimeString('en-US', { timeZone: 'Asia/Dhaka' }) : '',
            s.checkOutAt ? new Date(s.checkOutAt).toLocaleTimeString('en-US', { timeZone: 'Asia/Dhaka' }) : '',
            s.workedMinutes,
            s.lateMinutes,
            s.computedStatus,
          ];
        });
        downloadCSV('Studio_Matra_Daily_Attendance_Register.csv', headers, rows);
        break;
      }
      case 'payroll_register': {
        const headers = ['Period', 'Employee Code', 'Employee Name', 'Department', 'Basic Pay', 'Allowances', 'Gross Pay', 'Unpaid Deductions', 'Advance Deductions', 'Total Deductions', 'Net Salary', 'Payment Status'];
        const rows = payrollItems.map((item) => [
          item.payrollRunId,
          item.employeeCode,
          item.employeeName,
          item.departmentName,
          item.basicSalary,
          item.allowancesTotal,
          item.grossAmount,
          item.unpaidDeduction,
          item.advanceRecoveryDeduction,
          item.totalDeductions,
          item.netAmount,
          item.paymentStatus,
        ]);
        downloadCSV('Studio_Matra_Monthly_Payroll_Register.csv', headers, rows);
        break;
      }
      case 'late_arrival': {
        const headers = ['Date', 'Employee Code', 'Full Name', 'Check-In Time', 'Late Minutes', 'Shift Start'];
        const rows = sessions.filter((s) => s.lateMinutes > 0).map((s) => {
          const emp = employees.find((e) => e.id === s.employeeId);
          return [
            s.attendanceDate,
            emp?.employeeCode || '',
            emp?.fullName || '',
            new Date(s.checkInAt).toLocaleTimeString('en-US', { timeZone: 'Asia/Dhaka' }),
            s.lateMinutes,
            '09:00 AM',
          ];
        });
        downloadCSV('Studio_Matra_Late_Arrival_Report.csv', headers, rows);
        break;
      }
      case 'missing_punch': {
        const headers = ['Date', 'Employee Code', 'Full Name', 'Check-In Time', 'Status'];
        const rows = sessions.filter((s) => s.isMissingPunch).map((s) => {
          const emp = employees.find((e) => e.id === s.employeeId);
          return [
            s.attendanceDate,
            emp?.employeeCode || '',
            emp?.fullName || '',
            new Date(s.checkInAt).toLocaleTimeString('en-US', { timeZone: 'Asia/Dhaka' }),
            'Missing Punch',
          ];
        });
        downloadCSV('Studio_Matra_Missing_Punch_Report.csv', headers, rows);
        break;
      }
      case 'advance_recovery': {
        const headers = ['Employee Code', 'Employee Name', 'Approved Amount', 'Disbursed Amount', 'Remaining Balance', 'Monthly Recovery', 'Status'];
        const rows = advances.map((adv) => {
          const emp = employees.find((e) => e.id === adv.employeeId);
          return [
            emp?.employeeCode || '',
            emp?.fullName || '',
            adv.approvedAmount,
            adv.disbursedAmount,
            adv.remainingBalance,
            adv.monthlyDeduction,
            adv.status,
          ];
        });
        downloadCSV('Studio_Matra_Advance_Recovery_Report.csv', headers, rows);
        break;
      }
      default: {
        const headers = ['Target Date / ID', 'Details', 'Recorded Timestamp'];
        const rows = auditLogs.map((a) => [a.targetId, a.details, a.createdAt]);
        downloadCSV('Studio_Matra_Report_Export.csv', headers, rows);
        break;
      }
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="bg-white rounded-2xl p-6 border border-[#e8e4da] shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <span className="text-xs uppercase font-bold tracking-wider text-[#8f6927] bg-[#f7efe0] border border-[#ebd8b7] px-2.5 py-0.5 rounded-full">
            Enterprise Reporting
          </span>
          <h1 className="text-2xl font-serif font-bold text-[#1c2120] mt-1.5">
            Registers, Statements & Audit Reports
          </h1>
          <p className="text-xs text-[#6e7774]">
            Export verified attendance registers, payroll statements, and adjustment audit histories
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleExportCSV}
            className="px-4 py-2.5 rounded-xl bg-[#CAA05C] hover:bg-[#ba904c] text-[#171c1b] text-xs font-bold flex items-center gap-2 transition-colors cursor-pointer shadow-xs"
          >
            <Download className="w-4 h-4 text-[#171c1b]" />
            <span>Export CSV</span>
          </button>
          <button
            onClick={() => window.print()}
            className="px-4 py-2.5 rounded-xl bg-[#f4f1ea] hover:bg-[#eae6dc] text-[#1c2120] text-xs font-bold flex items-center gap-2 transition-colors cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>Print View</span>
          </button>
        </div>
      </div>

      {/* Report Selection Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Sidebar list of 15 reports */}
        <div className="bg-white rounded-2xl p-4 border border-[#e8e4da] shadow-xs space-y-1">
          <p className="text-[11px] font-bold uppercase tracking-wider text-[#798480] px-2 mb-2">
            Available Reports (15)
          </p>
          <div className="space-y-1 max-h-[550px] overflow-y-auto">
            {reportList.map((r) => {
              if (r.restricted && !canSeePayroll) return null;
              const isSelected = selectedReport === r.id;
              return (
                <button
                  key={r.id}
                  onClick={() => setSelectedReport(r.id)}
                  className={`w-full text-left px-3 py-2.5 rounded-xl text-xs transition-colors cursor-pointer flex items-center justify-between ${
                    isSelected
                      ? 'bg-[#CAA05C] text-[#171c1b] font-bold shadow-xs'
                      : 'text-[#48524f] hover:bg-[#f5f2eb]'
                  }`}
                >
                  <span className="truncate">{r.name}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Report Preview Panel */}
        <div className="lg:col-span-3 bg-white rounded-2xl border border-[#e8e4da] overflow-hidden shadow-xs flex flex-col justify-between">
          <div className="p-5 border-b border-[#f0ece1] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="font-bold text-sm text-[#1c2120]">
                {reportList.find((r) => r.id === selectedReport)?.name}
              </h3>
              <p className="text-xs text-[#717b77]">STUDIO MATRA • Official System Register</p>
            </div>
            <span className="text-[11px] text-[#717b77] font-mono">
              Records: {selectedReport === 'payroll_register' ? payrollItems.length : sessions.length}
            </span>
          </div>

          {/* Interactive Report View Table */}
          <div className="overflow-x-auto p-4 flex-1">
            {selectedReport === 'daily_attendance' && (
              <table className="w-full text-left text-xs">
                <thead className="bg-[#f9f8f4] text-[#6d7572] uppercase font-bold text-[10px]">
                  <tr>
                    <th className="py-2.5 px-3">Date</th>
                    <th className="py-2.5 px-3">Employee</th>
                    <th className="py-2.5 px-3">Check-In</th>
                    <th className="py-2.5 px-3">Check-Out</th>
                    <th className="py-2.5 px-3">Worked</th>
                    <th className="py-2.5 px-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#f2eee6]">
                  {sessions.slice(0, 15).map((s) => {
                    const emp = employees.find((e) => e.id === s.employeeId);
                    return (
                      <tr key={s.id}>
                        <td className="py-2.5 px-3 font-mono font-medium">{s.attendanceDate}</td>
                        <td className="py-2.5 px-3 font-semibold">{emp?.fullName}</td>
                        <td className="py-2.5 px-3 font-mono">
                          {new Date(s.checkInAt).toLocaleTimeString('en-US', { timeZone: 'Asia/Dhaka' })}
                        </td>
                        <td className="py-2.5 px-3 font-mono">
                          {s.checkOutAt ? new Date(s.checkOutAt).toLocaleTimeString('en-US', { timeZone: 'Asia/Dhaka' }) : '—'}
                        </td>
                        <td className="py-2.5 px-3 font-bold text-[#1b4332]">{formatMinutes(s.workedMinutes)}</td>
                        <td className="py-2.5 px-3 uppercase text-[10px] font-bold text-emerald-800">{s.computedStatus}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}

            {selectedReport === 'payroll_register' && (
              <table className="w-full text-left text-xs">
                <thead className="bg-[#f9f8f4] text-[#6d7572] uppercase font-bold text-[10px]">
                  <tr>
                    <th className="py-2.5 px-3">Employee</th>
                    <th className="py-2.5 px-3">Department</th>
                    <th className="py-2.5 px-3">Basic</th>
                    <th className="py-2.5 px-3">Gross Earnings</th>
                    <th className="py-2.5 px-3">Total Deductions</th>
                    <th className="py-2.5 px-3">Net Salary</th>
                    <th className="py-2.5 px-3">Disbursement</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#f2eee6]">
                  {payrollItems.map((item) => (
                    <tr key={item.id}>
                      <td className="py-2.5 px-3 font-semibold">{item.employeeName}</td>
                      <td className="py-2.5 px-3">{item.departmentName}</td>
                      <td className="py-2.5 px-3 font-mono">{formatBDT(item.basicSalary, false)}</td>
                      <td className="py-2.5 px-3 font-mono">{formatBDT(item.grossAmount, false)}</td>
                      <td className="py-2.5 px-3 font-mono text-amber-800">{formatBDT(item.totalDeductions, false)}</td>
                      <td className="py-2.5 px-3 font-mono font-bold text-[#1b4332]">{formatBDT(item.netAmount)}</td>
                      <td className="py-2.5 px-3">
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold uppercase">
                          {item.paymentStatus}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {selectedReport === 'late_arrival' && (
              <table className="w-full text-left text-xs">
                <thead className="bg-[#f9f8f4] text-[#6d7572] uppercase font-bold text-[10px]">
                  <tr>
                    <th className="py-2.5 px-3">Date</th>
                    <th className="py-2.5 px-3">Employee</th>
                    <th className="py-2.5 px-3">Check-In</th>
                    <th className="py-2.5 px-3">Late Minutes</th>
                    <th className="py-2.5 px-3">Shift Start</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#f2eee6]">
                  {sessions.filter((s) => s.lateMinutes > 0).map((s) => {
                    const emp = employees.find((e) => e.id === s.employeeId);
                    return (
                      <tr key={s.id}>
                        <td className="py-2.5 px-3 font-mono font-medium">{s.attendanceDate}</td>
                        <td className="py-2.5 px-3 font-semibold">{emp?.fullName}</td>
                        <td className="py-2.5 px-3 font-mono">
                          {new Date(s.checkInAt).toLocaleTimeString('en-US', { timeZone: 'Asia/Dhaka' })}
                        </td>
                        <td className="py-2.5 px-3 font-bold text-amber-800">{s.lateMinutes} mins late</td>
                        <td className="py-2.5 px-3 font-mono">09:00 AM (10m Grace)</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}

            {selectedReport === 'advance_recovery' && (
              <table className="w-full text-left text-xs">
                <thead className="bg-[#f9f8f4] text-[#6d7572] uppercase font-bold text-[10px]">
                  <tr>
                    <th className="py-2.5 px-3">Employee</th>
                    <th className="py-2.5 px-3">Approved Advance</th>
                    <th className="py-2.5 px-3">Remaining Balance</th>
                    <th className="py-2.5 px-3">Monthly Deduction</th>
                    <th className="py-2.5 px-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#f2eee6]">
                  {advances.map((adv) => {
                    const emp = employees.find((e) => e.id === adv.employeeId);
                    return (
                      <tr key={adv.id}>
                        <td className="py-2.5 px-3 font-semibold">{emp?.fullName}</td>
                        <td className="py-2.5 px-3 font-mono">{formatBDT(adv.approvedAmount)}</td>
                        <td className="py-2.5 px-3 font-mono font-bold text-amber-800">{formatBDT(adv.remainingBalance)}</td>
                        <td className="py-2.5 px-3 font-mono">{formatBDT(adv.monthlyDeduction)}</td>
                        <td className="py-2.5 px-3 uppercase text-[10px] font-bold">{adv.status}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}

            {selectedReport === 'adjustment_audit' && (
              <table className="w-full text-left text-xs">
                <thead className="bg-[#f9f8f4] text-[#6d7572] uppercase font-bold text-[10px]">
                  <tr>
                    <th className="py-2.5 px-3">Timestamp</th>
                    <th className="py-2.5 px-3">Actor</th>
                    <th className="py-2.5 px-3">Action</th>
                    <th className="py-2.5 px-3">Audit Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#f2eee6]">
                  {auditLogs.slice(0, 15).map((log) => (
                    <tr key={log.id}>
                      <td className="py-2.5 px-3 font-mono text-[11px]">{new Date(log.createdAt).toLocaleString('en-US', { timeZone: 'Asia/Dhaka' })}</td>
                      <td className="py-2.5 px-3 font-semibold">{log.actorName}</td>
                      <td className="py-2.5 px-3 font-mono text-[10px] font-bold text-[#1b4332]">{log.action}</td>
                      <td className="py-2.5 px-3 text-[#505a56]">{log.details}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div className="p-4 border-t border-[#f0ece1] text-xs text-[#717b77] flex items-center justify-between">
            <span>Reconciled to Studio Matra PostgreSQL / Persistent Database</span>
            <span className="font-semibold text-[#1b4332]">Authoritative Asia/Dhaka Records</span>
          </div>
        </div>
      </div>
    </div>
  );
};
