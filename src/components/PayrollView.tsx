import React, { useState, useEffect } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  Banknote,
  Check,
  CheckCircle2,
  ChevronRight,
  Download,
  Eye,
  FileCheck,
  FileText,
  Lock,
  PlusCircle,
  RefreshCw,
  Search,
  ShieldAlert,
  Wallet,
  X,
} from 'lucide-react';
import { db } from '../db/database';
import { generatePayslipPDF } from '../services/pdfGenerator';
import {
  apiCalculatePayroll,
  apiCreatePayrollPeriod,
  apiPublishPayslips,
  apiRecordPayment,
  apiUpdatePayrollRunStatus,
  syncWithBackend,
} from '../services/apiService';
import { PayrollItem, PayrollPeriod, PayrollRun, RoleName, SalaryAdvance, SalaryContract, User } from '../types';
import { canManagePayroll, canViewSalary } from '../utils/permissions';
import { formatBDT } from '../utils/money';

interface PayrollViewProps {
  currentUser: User;
}

export const PayrollView: React.FC<PayrollViewProps> = ({ currentUser }) => {
  const [, setDbTick] = useState(0);
  useEffect(() => {
    return db.subscribe(() => setDbTick((t) => t + 1));
  }, []);

  const isEmployeeRole = currentUser.role === 'employee';
  const currentEmp = currentUser.employeeId
    ? db.getEmployeeById(currentUser.employeeId)
    : db.getEmployeeByUserId(currentUser.id);
  const canManage = canManagePayroll(currentUser.role);
  const canViewComp = canViewSalary(currentUser.role);

  const [activeTab, setActiveTab] = useState<'runs' | 'advances' | 'contracts'>('runs');
  const [selectedPeriodId, setSelectedPeriodId] = useState<string>('period-2026-10');
  const [isNewPeriodModalOpen, setIsNewPeriodModalOpen] = useState(false);
  const [newMonth, setNewMonth] = useState(11);
  const [newYear, setNewYear] = useState(2026);

  // Modals
  const [previewItem, setPreviewItem] = useState<PayrollItem | null>(null);
  const [paymentModalItem, setPaymentModalItem] = useState<PayrollItem | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<'bank_transfer' | 'bkash' | 'cash'>('bank_transfer');
  const [paymentRef, setPaymentRef] = useState('');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);

  // Salary advance modal
  const [isAdvanceModalOpen, setIsAdvanceModalOpen] = useState(false);
  const [advanceEmpId, setAdvanceEmpId] = useState(currentEmp?.id || 'emp-0005');
  const [advanceAmount, setAdvanceAmount] = useState(20000);
  const [advanceMonthlyDeduction, setAdvanceMonthlyDeduction] = useState(5000);
  const [advancePurpose, setAdvancePurpose] = useState('');

  const employees = db.getEmployees();
  const periods = db.getPayrollPeriods();
  const allRuns = db.getPayrollRuns();
  const advances = db.getSalaryAdvances(isEmployeeRole && currentEmp ? currentEmp.id : undefined);
  const contracts = db.getSalaryContracts();

  const getPeriodLabel = (slip: PayrollItem) => {
    const run = allRuns.find((r) => r.id === slip.payrollRunId);
    const period = run ? periods.find((p) => p.id === run.payrollPeriodId) : null;
    const month = period?.month ?? run?.month;
    const year = period?.year ?? run?.year;
    if (month && year) {
      const monthNames = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December',
      ];
      return `${monthNames[month - 1] || month} ${year}`;
    }
    return slip.payrollRunId;
  };

  // If employee role, show only their published slips
  if (isEmployeeRole) {
    const publishedSlips = currentEmp ? db.getEmployeePublishedPayslips(currentEmp.id) : [];

    return (
      <div className="space-y-6 max-w-7xl mx-auto">
        <div className="bg-white rounded-2xl p-6 border border-[#e8e4da] shadow-xs">
          <span className="text-xs uppercase font-bold tracking-wider text-[#1b4332] bg-[#edf7f1] px-2.5 py-0.5 rounded-full">
            Employee Self-Service
          </span>
          <h1 className="text-2xl font-serif font-bold text-[#1c2120] mt-1.5">My Official Salary Payslips</h1>
          <p className="text-xs text-[#6e7774]">
            Confidential BDT salary slips with earnings, attendance deductions, and download options
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-[#e8e4da] overflow-hidden shadow-xs">
          <div className="p-5 border-b border-[#f0ece1]">
            <h3 className="font-bold text-sm text-[#1c2120]">Published Statements</h3>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#f9f8f4] text-[#6d7572] uppercase font-bold text-[10px] border-b border-[#f0ece1]">
                <tr>
                  <th className="py-3 px-4">Period</th>
                  <th className="py-3 px-4">Gross Earnings</th>
                  <th className="py-3 px-4">Total Deductions</th>
                  <th className="py-3 px-4">Net Salary</th>
                  <th className="py-3 px-4">Disbursement Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f2eee6] text-[#2c3330]">
                {publishedSlips.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-[#7e8884]">
                      No published payslips available yet.
                    </td>
                  </tr>
                ) : (
                  publishedSlips.map((slip) => (
                    <tr key={slip.id} className="hover:bg-[#faf9f5]">
                      <td className="py-3 px-4 font-bold text-[#1c2120] font-mono">
                        {getPeriodLabel(slip)}
                      </td>
                      <td className="py-3 px-4 font-mono font-medium">{formatBDT(slip.grossAmount)}</td>
                      <td className="py-3 px-4 font-mono text-amber-800">{formatBDT(slip.totalDeductions)}</td>
                      <td className="py-3 px-4 font-mono font-bold text-[#1b4332] text-sm">
                        {formatBDT(slip.netAmount)}
                      </td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                          {slip.paymentStatus.toUpperCase()} ({slip.paymentMethod?.replace('_', ' ') || 'Bank'})
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => setPreviewItem(slip)}
                            className="px-3 py-1.5 rounded-lg bg-[#f4f1ea] hover:bg-[#eae6dc] text-xs font-semibold cursor-pointer"
                          >
                            View
                          </button>
                          <button
                            onClick={() => {
                              const org = db.getSettings().organization;
                              const doc = generatePayslipPDF(slip, org);
                              doc.save(`Studio_Matra_Payslip_${slip.employeeCode}_${slip.payrollRunId}.pdf`);
                            }}
                            className="px-3 py-1.5 rounded-lg bg-[#1b4332] hover:bg-[#255742] text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer shadow-xs"
                          >
                            <Download className="w-3.5 h-3.5" />
                            <span>PDF</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Payslip Modal Preview */}
        {previewItem && (
          <PayslipModal
            item={previewItem}
            onClose={() => setPreviewItem(null)}
          />
        )}
      </div>
    );
  }

  // Admin / Finance View
  const selectedPeriod = periods.find((p) => p.id === selectedPeriodId) || periods[0];
  const activeRun = allRuns.find((r) => r.payrollPeriodId === selectedPeriod?.id);
  const runItems = activeRun ? db.getPayrollItems(activeRun.id) : [];

  const handleCreateNewPeriod = async () => {
    try {
      const p = db.createPayrollPeriod(newMonth, newYear, {
        userId: currentUser.id,
        name: currentUser.fullName,
      });
      setSelectedPeriodId(p.id);
      setIsNewPeriodModalOpen(false);
      apiCreatePayrollPeriod(newMonth, newYear).catch(() => {});
    } catch (err: any) {
      alert(err.message || 'Error creating period');
    }
  };

  const handleCalculateDraft = async () => {
    if (!selectedPeriod) return;
    try {
      db.calculateDraftPayroll(selectedPeriod.id, {
        userId: currentUser.id,
        name: currentUser.fullName,
      });
      const res = await apiCalculatePayroll(selectedPeriod.id, currentUser.fullName);
      if (res && res.run) {
        await syncWithBackend();
      }
    } catch (err: any) {
      alert(err.message || 'Draft calculation error');
    }
  };

  const handleReviewRun = async () => {
    if (!activeRun) return;
    try {
      db.reviewPayrollRun(activeRun.id, {
        userId: currentUser.id,
        name: currentUser.fullName,
      });
      apiUpdatePayrollRunStatus(activeRun.id, 'reviewed', currentUser.fullName).catch(() => {});
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleApproveRun = async () => {
    if (!activeRun) return;
    try {
      db.approvePayrollRun(
        activeRun.id,
        { userId: currentUser.id, name: currentUser.fullName },
        'Approved by authorized financial signatory.'
      );
      apiUpdatePayrollRunStatus(activeRun.id, 'approved', currentUser.fullName).catch(() => {});
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleFinalizeRun = async () => {
    if (!activeRun) return;
    try {
      db.finalizePayrollRun(activeRun.id, {
        userId: currentUser.id,
        name: currentUser.fullName,
      });
      apiUpdatePayrollRunStatus(activeRun.id, 'finalized', currentUser.fullName).catch(() => {});
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handlePublishPayslips = async () => {
    if (!activeRun) return;
    try {
      db.publishPayslips(activeRun.id, {
        userId: currentUser.id,
        name: currentUser.fullName,
      });
      await apiPublishPayslips(activeRun.id);
      await syncWithBackend();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleSavePayment = async () => {
    if (!paymentModalItem || !paymentRef.trim()) return;
    try {
      db.recordPayment({
        payrollItemId: paymentModalItem.id,
        paymentMethod,
        paymentReference: paymentRef,
        paymentDate,
        actor: { userId: currentUser.id, name: currentUser.fullName },
      });
      // Synchronize with backend API in background & reload fresh master data
      await apiRecordPayment({
        payrollItemId: paymentModalItem.id,
        paymentMethod,
        paymentReference: paymentRef,
        paymentDate,
      });
      await syncWithBackend();
      setPaymentModalItem(null);
      setPaymentRef('');
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleCreateAdvance = (e: React.FormEvent) => {
    e.preventDefault();
    try {
      db.createSalaryAdvance(
        {
          employeeId: advanceEmpId,
          approvedAmount: advanceAmount,
          disbursedAmount: advanceAmount,
          remainingBalance: advanceAmount,
          monthlyDeduction: advanceMonthlyDeduction,
          approvalDate: new Date().toISOString().split('T')[0],
          disbursementDate: new Date().toISOString().split('T')[0],
          status: 'active',
          purpose: advancePurpose,
        },
        { userId: currentUser.id, name: currentUser.fullName }
      );
      setIsAdvanceModalOpen(false);
      setAdvancePurpose('');
    } catch (err: any) {
      alert(err.message);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="bg-white rounded-2xl p-6 border border-[#e8e4da] shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <span className="text-xs uppercase font-bold tracking-wider text-[#8f6927] bg-[#f7efe0] border border-[#ebd8b7] px-2.5 py-0.5 rounded-full">
            Automated BDT ৳ Payroll
          </span>
          <h1 className="text-2xl font-serif font-bold text-[#1c2120] mt-1.5">
            Studio Compensation & Payroll Engine
          </h1>
          <p className="text-xs text-[#6e7774]">
            8-step controlled calculation workflow, advance recovery, and PDF payslip issuance
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {canManage && (
            <button
              onClick={() => setIsNewPeriodModalOpen(true)}
              className="px-4 py-2.5 rounded-xl bg-[#CAA05C] hover:bg-[#ba904c] text-[#171c1b] text-xs font-bold flex items-center gap-2 transition-colors cursor-pointer shadow-xs"
            >
              <PlusCircle className="w-4 h-4 text-[#171c1b]" />
              <span>Create Period</span>
            </button>
          )}

          <button
            onClick={() => setIsAdvanceModalOpen(true)}
            className="px-4 py-2.5 rounded-xl bg-[#f4f1ea] hover:bg-[#eae6dc] text-[#1c2120] text-xs font-bold flex items-center gap-2 transition-colors cursor-pointer"
          >
            <Banknote className="w-4 h-4 text-[#CAA05C]" />
            <span>New Salary Advance</span>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-[#e5e1d8] text-xs font-semibold gap-1">
        <button
          onClick={() => setActiveTab('runs')}
          className={`px-4 py-2.5 rounded-t-xl transition-colors cursor-pointer flex items-center gap-2 ${
            activeTab === 'runs'
              ? 'bg-white text-[#CAA05C] border-t-2 border-t-[#CAA05C] border-x border-[#e8e4da] font-bold'
              : 'text-[#6e7874] hover:text-[#1c2120]'
          }`}
        >
          <Wallet className="w-4 h-4" />
          <span>Payroll Periods & Runs</span>
        </button>

        <button
          onClick={() => setActiveTab('advances')}
          className={`px-4 py-2.5 rounded-t-xl transition-colors cursor-pointer flex items-center gap-2 ${
            activeTab === 'advances'
              ? 'bg-white text-[#CAA05C] border-t-2 border-t-[#CAA05C] border-x border-[#e8e4da] font-bold'
              : 'text-[#6e7874] hover:text-[#1c2120]'
          }`}
        >
          <Banknote className="w-4 h-4" />
          <span>Salary Advances & Loans</span>
          {advances.filter((a) => a.status === 'active').length > 0 && (
            <span className="px-1.5 py-0.2 rounded-full bg-[#CAA05C] text-[#171c1b] text-[10px] font-bold">
              {advances.filter((a) => a.status === 'active').length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('contracts')}
          className={`px-4 py-2.5 rounded-t-xl transition-colors cursor-pointer flex items-center gap-2 ${
            activeTab === 'contracts'
              ? 'bg-white text-[#CAA05C] border-t-2 border-t-[#CAA05C] border-x border-[#e8e4da] font-bold'
              : 'text-[#6e7874] hover:text-[#1c2120]'
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>Salary Contracts Directory</span>
        </button>
      </div>

      {activeTab === 'runs' && (
        <div className="space-y-6">
          {/* Period Selector & 8-Step Workflow Status Header */}
          <div className="bg-white rounded-2xl p-6 border border-[#e8e4da] shadow-xs space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#f0ece1]">
              <div className="flex items-center gap-3">
                <label className="text-xs font-bold text-[#1c2120]">Active Payroll Period:</label>
                <select
                  value={selectedPeriod?.id}
                  onChange={(e) => setSelectedPeriodId(e.target.value)}
                  className="px-3 py-1.5 rounded-lg border border-[#ded8cb] bg-[#faf9f5] text-xs font-semibold focus:outline-none focus:border-[#1b4332]"
                >
                  {periods.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.month}/{p.year} ({p.periodStart} to {p.periodEnd}) — Status: {p.status.toUpperCase()}
                    </option>
                  ))}
                </select>
              </div>

              {/* Action Buttons based on status */}
              <div className="flex flex-wrap items-center gap-2">
                {!activeRun && canManage && (
                  <button
                    onClick={handleCalculateDraft}
                    className="px-4 py-2 rounded-xl bg-[#CAA05C] hover:bg-[#ba904c] text-[#171c1b] text-xs font-bold flex items-center gap-1.5 shadow-xs cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Calculate Draft Payroll</span>
                  </button>
                )}

                {activeRun?.status === 'calculated' && canManage && (
                  <button
                    onClick={handleReviewRun}
                    className="px-4 py-2 rounded-xl bg-teal-800 hover:bg-teal-900 text-white text-xs font-bold cursor-pointer"
                  >
                    Mark Finance Review Complete
                  </button>
                )}

                {activeRun?.status === 'reviewed' && currentUser.role === 'super_admin' && (
                  <button
                    onClick={handleApproveRun}
                    className="px-4 py-2 rounded-xl bg-[#CAA05C] hover:bg-[#ba904c] text-[#171c1b] text-xs font-bold cursor-pointer shadow-xs"
                  >
                    Approve Payroll Run
                  </button>
                )}

                {activeRun?.status === 'approved' && canManage && (
                  <button
                    onClick={handleFinalizeRun}
                    className="px-4 py-2 rounded-xl bg-amber-800 hover:bg-amber-900 text-white text-xs font-bold cursor-pointer"
                  >
                    Finalize & Lock Snapshot
                  </button>
                )}

                {activeRun?.status === 'finalized' && canManage && (
                  <button
                    onClick={handlePublishPayslips}
                    className="px-4 py-2 rounded-xl bg-[#CAA05C] hover:bg-[#ba904c] text-[#171c1b] text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs"
                  >
                    <FileCheck className="w-4 h-4 text-[#171c1b]" />
                    <span>Publish Payslips to Staff</span>
                  </button>
                )}
              </div>
            </div>

            {/* 8-Step Progress Stepper Visual */}
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-[#737e7a] mb-3">
                8-Step Controlled Payroll Lifecycle:
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2 text-[10px]">
                {[
                  { step: 1, label: 'Create Period', done: Boolean(selectedPeriod) },
                  { step: 2, label: 'Audit Attendance', done: Boolean(activeRun) },
                  { step: 3, label: 'Draft Calculate', done: activeRun?.status !== undefined },
                  { step: 4, label: 'Review Line Items', done: activeRun?.status === 'reviewed' || activeRun?.status === 'approved' || activeRun?.status === 'finalized' || activeRun?.status === 'paid' },
                  { step: 5, label: 'Approver Decision', done: activeRun?.status === 'approved' || activeRun?.status === 'finalized' || activeRun?.status === 'paid' },
                  { step: 6, label: 'Finalize & Lock', done: activeRun?.status === 'finalized' || activeRun?.status === 'paid' },
                  { step: 7, label: 'Publish Payslips', done: runItems.some((i) => i.publishedAt) },
                  { step: 8, label: 'Record Payments', done: runItems.every((i) => i.paymentStatus === 'paid') },
                ].map((s) => (
                  <div
                    key={s.step}
                    className={`p-2.5 rounded-xl border flex flex-col justify-between ${
                      s.done
                        ? 'bg-[#edf7f1] border-[#c2e8d3] text-[#1b4332]'
                        : 'bg-[#faf9f5] border-[#ece7dc] text-[#87928e]'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold">Step {s.step}</span>
                      {s.done && <Check className="w-3.5 h-3.5 text-[#2d6a4f]" />}
                    </div>
                    <span className="font-medium mt-1 truncate">{s.label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Financial Totals Strip */}
            {activeRun && (
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 p-4 rounded-xl bg-[#faf9f5] border border-[#ece7dc]">
                <div>
                  <span className="text-[11px] text-[#717b77]">Eligible Staff:</span>
                  <p className="text-lg font-bold text-[#1c2120] font-mono mt-0.5">
                    {activeRun.totalEmployees} Employees
                  </p>
                </div>
                <div>
                  <span className="text-[11px] text-[#717b77]">Gross Earnings:</span>
                  <p className="text-lg font-bold text-[#1c2120] font-mono mt-0.5">
                    {formatBDT(activeRun.totalGross)}
                  </p>
                </div>
                <div>
                  <span className="text-[11px] text-[#717b77]">Total Deductions:</span>
                  <p className="text-lg font-bold text-amber-800 font-mono mt-0.5">
                    {formatBDT(activeRun.totalDeductions)}
                  </p>
                </div>
                <div>
                  <span className="text-[11px] text-[#1b4332] font-semibold">Net Payroll Payable:</span>
                  <p className="text-xl font-bold text-[#1b4332] font-mono mt-0.5">
                    {formatBDT(activeRun.totalNet)}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Payroll Items Table */}
          <div className="bg-white rounded-2xl border border-[#e8e4da] overflow-hidden shadow-xs">
            <div className="p-5 border-b border-[#f0ece1] flex items-center justify-between">
              <div>
                <h3 className="font-bold text-sm text-[#1c2120]">Individual Employee Salary Line Items</h3>
                <p className="text-xs text-[#717b77]">Accurate pro-rated earnings, leave deductions, and loan recoveries</p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#f9f8f4] text-[#6d7572] uppercase font-bold text-[10px] border-b border-[#f0ece1]">
                  <tr>
                    <th className="py-3 px-4">Employee</th>
                    <th className="py-3 px-4">Department</th>
                    <th className="py-3 px-4">Basic Pay</th>
                    <th className="py-3 px-4">Allowances</th>
                    <th className="py-3 px-4">Overtime Pay</th>
                    <th className="py-3 px-4">Deductions</th>
                    <th className="py-3 px-4">Net Salary</th>
                    <th className="py-3 px-4">Payment</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#f2eee6] text-[#2c3330]">
                  {runItems.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-10 text-center text-[#8e9894]">
                        No calculated payroll items for this period. Click "Calculate Draft Payroll" above.
                      </td>
                    </tr>
                  ) : (
                    runItems.map((item) => (
                      <tr key={item.id} className="hover:bg-[#faf9f5]">
                        <td className="py-3 px-4">
                          <div className="font-semibold text-[#1c2120]">{item.employeeName}</div>
                          <div className="text-[10px] text-[#78827e] font-mono">{item.employeeCode}</div>
                        </td>
                        <td className="py-3 px-4 text-[#505a56]">{item.departmentName}</td>
                        <td className="py-3 px-4 font-mono font-medium">{formatBDT(item.basicSalary, false)}</td>
                        <td className="py-3 px-4 font-mono text-[#505a56]">{formatBDT(item.allowancesTotal, false)}</td>
                        <td className="py-3 px-4 font-mono text-[#1b4332]">
                          {item.overtimePay > 0 ? formatBDT(item.overtimePay, false) : '—'}
                        </td>
                        <td className="py-3 px-4 font-mono text-amber-800">
                          {item.totalDeductions > 0 ? formatBDT(item.totalDeductions, false) : '—'}
                        </td>
                        <td className="py-3 px-4 font-mono font-bold text-[#1b4332] text-sm">
                          {formatBDT(item.netAmount)}
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                              item.paymentStatus === 'paid'
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-stone-100 text-stone-700'
                            }`}
                          >
                            {item.paymentStatus}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => setPreviewItem(item)}
                              title="Preview Payslip"
                              className="p-1.5 rounded-lg bg-[#f4f1ea] hover:bg-[#eae6dc] text-[#1c2120] cursor-pointer"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => {
                                const org = db.getSettings().organization;
                                const doc = generatePayslipPDF(item, org);
                                doc.save(`Studio_Matra_Payslip_${item.employeeCode}_${item.payrollRunId}.pdf`);
                              }}
                              title="Download PDF Payslip"
                              className="p-1.5 rounded-lg bg-[#1b4332] hover:bg-[#255742] text-white cursor-pointer shadow-xs"
                            >
                              <Download className="w-3.5 h-3.5" />
                            </button>
                            {canManage && item.paymentStatus !== 'paid' && (
                              <button
                                onClick={() => {
                                  setPaymentModalItem(item);
                                  setPaymentRef(`EBL-TRX-${Math.floor(100000 + Math.random() * 900000)}`);
                                }}
                                className="px-2 py-1 rounded-lg bg-emerald-800 hover:bg-emerald-900 text-white font-semibold text-[11px] cursor-pointer"
                              >
                                Pay
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Salary Advances */}
      {activeTab === 'advances' && (
        <div className="bg-white rounded-2xl border border-[#e8e4da] overflow-hidden shadow-xs">
          <div className="p-5 border-b border-[#f0ece1] flex items-center justify-between">
            <div>
              <h3 className="font-bold text-sm text-[#1c2120]">Salary Advances & Loan Agreements</h3>
              <p className="text-xs text-[#717b77]">
                Configured monthly installment recovery deducted seamlessly during payroll runs
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#f9f8f4] text-[#6d7572] uppercase font-bold text-[10px] border-b border-[#f0ece1]">
                <tr>
                  <th className="py-3 px-4">Employee</th>
                  <th className="py-3 px-4">Approved Amount</th>
                  <th className="py-3 px-4">Remaining Balance</th>
                  <th className="py-3 px-4">Monthly Installment</th>
                  <th className="py-3 px-4">Purpose / Reference</th>
                  <th className="py-3 px-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f2eee6] text-[#2c3330]">
                {advances.map((adv) => {
                  const emp = db.getEmployeeById(adv.employeeId);
                  return (
                    <tr key={adv.id} className="hover:bg-[#faf9f5]">
                      <td className="py-3 px-4 font-semibold text-[#1c2120]">
                        {emp?.fullName}{' '}
                        <span className="text-[10px] font-mono text-[#78827e]">({emp?.employeeCode})</span>
                      </td>
                      <td className="py-3 px-4 font-mono font-medium">{formatBDT(adv.approvedAmount)}</td>
                      <td className="py-3 px-4 font-mono font-bold text-amber-800">
                        {formatBDT(adv.remainingBalance)}
                      </td>
                      <td className="py-3 px-4 font-mono text-[#1b4332]">
                        {formatBDT(adv.monthlyDeduction)} / month
                      </td>
                      <td className="py-3 px-4 text-[#505a56]">{adv.purpose}</td>
                      <td className="py-3 px-4">
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                            adv.status === 'active'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-emerald-100 text-emerald-800'
                          }`}
                        >
                          {adv.status}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 3: Salary Contracts */}
      {activeTab === 'contracts' && (
        <div className="bg-white rounded-2xl border border-[#e8e4da] overflow-hidden shadow-xs">
          <div className="p-5 border-b border-[#f0ece1]">
            <h3 className="font-bold text-sm text-[#1c2120]">Employee Base Salary Structures</h3>
            <p className="text-xs text-[#717b77]">
              Date-effective compensation contracts defining basic salary, house rent, and statutory allowances
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#f9f8f4] text-[#6d7572] uppercase font-bold text-[10px] border-b border-[#f0ece1]">
                <tr>
                  <th className="py-3 px-4">Employee</th>
                  <th className="py-3 px-4">Basic Salary</th>
                  <th className="py-3 px-4">House Rent (50%)</th>
                  <th className="py-3 px-4">Medical</th>
                  <th className="py-3 px-4">Transport</th>
                  <th className="py-3 px-4">Special / Other</th>
                  <th className="py-3 px-4">Total Monthly Gross</th>
                  <th className="py-3 px-4">Effective Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f2eee6] text-[#2c3330]">
                {contracts.map((c) => {
                  const emp = db.getEmployeeById(c.employeeId);
                  const gross =
                    c.basicSalary +
                    c.houseRentAllowance +
                    c.medicalAllowance +
                    c.transportAllowance +
                    c.otherFixedAllowances;

                  return (
                    <tr key={c.id} className="hover:bg-[#faf9f5]">
                      <td className="py-3 px-4 font-semibold text-[#1c2120]">
                        {emp?.fullName}{' '}
                        <span className="text-[10px] font-mono text-[#78827e]">({emp?.employeeCode})</span>
                      </td>
                      <td className="py-3 px-4 font-mono font-medium">{formatBDT(c.basicSalary, false)}</td>
                      <td className="py-3 px-4 font-mono text-[#505a56]">{formatBDT(c.houseRentAllowance, false)}</td>
                      <td className="py-3 px-4 font-mono text-[#505a56]">{formatBDT(c.medicalAllowance, false)}</td>
                      <td className="py-3 px-4 font-mono text-[#505a56]">{formatBDT(c.transportAllowance, false)}</td>
                      <td className="py-3 px-4 font-mono text-[#505a56]">{formatBDT(c.otherFixedAllowances, false)}</td>
                      <td className="py-3 px-4 font-mono font-bold text-[#1b4332]">{formatBDT(gross, false)}</td>
                      <td className="py-3 px-4 font-mono text-[#78827e]">{c.effectiveFrom}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Create Period Modal */}
      {isNewPeriodModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 border border-[#ded8cb] shadow-2xl animate-in zoom-in-95">
            <div className="flex items-center justify-between pb-4 border-b border-[#f0ece1]">
              <h3 className="font-bold text-base text-[#1c2120]">Create New Payroll Period</h3>
              <button
                onClick={() => setIsNewPeriodModalOpen(false)}
                className="text-stone-400 hover:text-stone-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 mt-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-[#1c2120] mb-1">Month</label>
                  <select
                    value={newMonth}
                    onChange={(e) => setNewMonth(Number(e.target.value))}
                    className="w-full p-2.5 border border-[#ded8cb] rounded-lg bg-[#faf9f5]"
                  >
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((m) => (
                      <option key={m} value={m}>
                        {m} ({new Date(2026, m - 1, 1).toLocaleString('default', { month: 'long' })})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-[#1c2120] mb-1">Year</label>
                  <input
                    type="number"
                    value={newYear}
                    onChange={(e) => setNewYear(Number(e.target.value))}
                    className="w-full p-2.5 border border-[#ded8cb] rounded-lg bg-[#faf9f5] font-mono"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-[#f0ece1]">
                <button
                  onClick={() => setIsNewPeriodModalOpen(false)}
                  className="px-4 py-2 rounded-lg bg-[#f4f1ea] hover:bg-[#eae6dc] font-semibold text-stone-700 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateNewPeriod}
                  className="px-4 py-2 rounded-lg bg-[#CAA05C] hover:bg-[#ba904c] text-[#171c1b] font-bold cursor-pointer shadow-xs"
                >
                  Initialize Period
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Record Payment Modal */}
      {paymentModalItem && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 border border-[#ded8cb] shadow-2xl animate-in zoom-in-95">
            <div className="flex items-center justify-between pb-4 border-b border-[#f0ece1]">
              <h3 className="font-bold text-base text-[#1c2120]">Record Salary Payment</h3>
              <button
                onClick={() => setPaymentModalItem(null)}
                className="text-stone-400 hover:text-stone-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 mt-4 text-xs">
              <div className="p-3 bg-[#faf9f5] rounded-xl border border-[#ece7dc] space-y-1">
                <p>
                  <strong className="text-[#1c2120]">Beneficiary:</strong> {paymentModalItem.employeeName} (
                  {paymentModalItem.employeeCode})
                </p>
                <p>
                  <strong className="text-[#1c2120]">Net Payable:</strong>{' '}
                  <span className="font-bold text-[#1b4332] text-sm">
                    {formatBDT(paymentModalItem.netAmount)}
                  </span>
                </p>
              </div>

              <div>
                <label className="block font-bold text-[#1c2120] mb-1">Payment Method</label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value as any)}
                  className="w-full p-2.5 border border-[#ded8cb] rounded-lg bg-[#faf9f5]"
                >
                  <option value="bank_transfer">Corporate Bank Transfer (BEFTN / NPSB)</option>
                  <option value="bkash">bKash Corporate Payroll</option>
                  <option value="cash">Studio Cash Voucher</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-[#1c2120] mb-1">
                  Bank / MFS Transaction Reference
                </label>
                <input
                  type="text"
                  value={paymentRef}
                  onChange={(e) => setPaymentRef(e.target.value)}
                  placeholder="e.g. EBL-TRX-839201"
                  className="w-full p-2.5 border border-[#ded8cb] rounded-lg bg-[#faf9f5] font-mono"
                  required
                />
              </div>

              <div>
                <label className="block font-bold text-[#1c2120] mb-1">Payment Date</label>
                <input
                  type="date"
                  value={paymentDate}
                  onChange={(e) => setPaymentDate(e.target.value)}
                  className="w-full p-2.5 border border-[#ded8cb] rounded-lg bg-[#faf9f5] font-mono"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-[#f0ece1]">
                <button
                  onClick={() => setPaymentModalItem(null)}
                  className="px-4 py-2 rounded-lg bg-[#f4f1ea] hover:bg-[#eae6dc] font-semibold text-stone-700 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSavePayment}
                  className="px-4 py-2 rounded-lg bg-[#CAA05C] hover:bg-[#ba904c] text-[#171c1b] font-bold cursor-pointer shadow-xs"
                >
                  Confirm Payment
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Salary Advance Modal */}
      {isAdvanceModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 border border-[#ded8cb] shadow-2xl animate-in zoom-in-95">
            <div className="flex items-center justify-between pb-4 border-b border-[#f0ece1]">
              <h3 className="font-bold text-base text-[#1c2120]">Approve Salary Advance / Loan</h3>
              <button
                onClick={() => setIsAdvanceModalOpen(false)}
                className="text-stone-400 hover:text-stone-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateAdvance} className="space-y-4 mt-4 text-xs">
              <div>
                <label className="block font-bold text-[#1c2120] mb-1">Employee</label>
                <select
                  value={advanceEmpId}
                  onChange={(e) => setAdvanceEmpId(e.target.value)}
                  className="w-full p-2.5 border border-[#ded8cb] rounded-lg bg-[#faf9f5]"
                >
                  {employees.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.fullName} ({e.employeeCode})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-[#1c2120] mb-1">Disbursed Amount (BDT)</label>
                  <input
                    type="number"
                    value={advanceAmount}
                    onChange={(e) => setAdvanceAmount(Number(e.target.value))}
                    className="w-full p-2.5 border border-[#ded8cb] rounded-lg bg-[#faf9f5] font-mono"
                    required
                  />
                </div>
                <div>
                  <label className="block font-bold text-[#1c2120] mb-1">Monthly Deduction (BDT)</label>
                  <input
                    type="number"
                    value={advanceMonthlyDeduction}
                    onChange={(e) => setAdvanceMonthlyDeduction(Number(e.target.value))}
                    className="w-full p-2.5 border border-[#ded8cb] rounded-lg bg-[#faf9f5] font-mono"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-[#1c2120] mb-1">Purpose / Agreement Note</label>
                <textarea
                  rows={2}
                  value={advancePurpose}
                  onChange={(e) => setAdvancePurpose(e.target.value)}
                  placeholder="e.g. Architectural workstation hardware advance..."
                  className="w-full p-2.5 border border-[#ded8cb] rounded-lg bg-[#faf9f5]"
                  required
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-[#f0ece1]">
                <button
                  type="button"
                  onClick={() => setIsAdvanceModalOpen(false)}
                  className="px-4 py-2 rounded-lg bg-[#f4f1ea] hover:bg-[#eae6dc] font-semibold text-stone-700 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-[#CAA05C] hover:bg-[#ba904c] text-[#171c1b] font-bold cursor-pointer shadow-xs"
                >
                  Disburse Advance
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Payslip Modal Preview */}
      {previewItem && (
        <PayslipModal
          item={previewItem}
          onClose={() => setPreviewItem(null)}
        />
      )}
    </div>
  );
};

interface PayslipModalProps {
  item: PayrollItem;
  onClose: () => void;
}

const PayslipModal: React.FC<PayslipModalProps> = ({ item, onClose }) => {
  const org = db.getSettings().organization;

  const handleDownload = () => {
    const doc = generatePayslipPDF(item, org);
    doc.save(`Studio_Matra_Payslip_${item.employeeCode}_${item.payrollRunId}.pdf`);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-[#faf9f5] rounded-2xl max-w-2xl w-full p-6 sm:p-8 border border-[#ded8cb] shadow-2xl animate-in zoom-in-95 my-8">
        <div className="flex items-center justify-between pb-4 border-b border-[#e5e1d8]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white p-1.5 flex items-center justify-center border border-[#CAA05C]/50 shadow-xs">
              <img src="/logo.png" alt="Studio Matra Logo" className="w-full h-full object-contain" />
            </div>
            <div>
              <h2 className="font-serif font-bold text-lg text-[#1c2120]">STUDIO MATRA</h2>
              <p className="text-[10px] uppercase tracking-wider text-[#CAA05C] font-bold">
                Salary Statement & Verification
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-stone-400 hover:text-stone-700 cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Sheet */}
        <div className="my-6 p-6 bg-white rounded-xl border border-[#e8e4da] space-y-5 text-xs shadow-xs">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pb-4 border-b border-[#f0ece1]">
            <div>
              <p className="text-[10px] text-[#717b77] uppercase font-bold">Employee</p>
              <p className="font-bold text-[#1c2120] text-sm mt-0.5">{item.employeeName}</p>
              <p className="text-[11px] font-mono text-[#52b788] font-bold">{item.employeeCode}</p>
            </div>
            <div>
              <p className="text-[10px] text-[#717b77] uppercase font-bold">Designation</p>
              <p className="font-semibold text-[#1c2120] mt-0.5">{item.designationTitle}</p>
              <p className="text-[11px] text-[#717b77]">{item.departmentName}</p>
            </div>
            <div>
              <p className="text-[10px] text-[#717b77] uppercase font-bold">Attendance</p>
              <p className="font-semibold text-[#1c2120] mt-0.5">
                {item.presentDays} Present / {item.workingDays} Days
              </p>
              <p className="text-[11px] text-[#717b77]">{item.overtimeHours} Overtime Hrs</p>
            </div>
            <div>
              <p className="text-[10px] text-[#717b77] uppercase font-bold">Payment Status</p>
              <span className="inline-block mt-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                {item.paymentStatus.toUpperCase()}
              </span>
            </div>
          </div>

          {/* Financial Breakdown */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Earnings */}
            <div className="p-4 rounded-xl bg-[#faf9f5] border border-[#ece7dc] space-y-2">
              <p className="font-bold text-xs text-[#1b4332] pb-1 border-b border-[#ded8cb]">
                Earnings & Allowances
              </p>
              <div className="flex justify-between">
                <span>Basic Salary</span>
                <span className="font-mono font-medium">{formatBDT(item.basicSalary)}</span>
              </div>
              <div className="flex justify-between">
                <span>Allowances Total</span>
                <span className="font-mono font-medium">{formatBDT(item.allowancesTotal)}</span>
              </div>
              {item.overtimePay > 0 && (
                <div className="flex justify-between text-[#1b4332]">
                  <span>Overtime Pay ({item.overtimeHours} hrs)</span>
                  <span className="font-mono font-bold">{formatBDT(item.overtimePay)}</span>
                </div>
              )}
              {item.bonusAmount > 0 && (
                <div className="flex justify-between text-[#1b4332]">
                  <span>Bonus / Incentives</span>
                  <span className="font-mono font-bold">{formatBDT(item.bonusAmount)}</span>
                </div>
              )}
              <div className="pt-2 border-t border-[#ded8cb] flex justify-between font-bold text-[#1c2120]">
                <span>Gross Earnings</span>
                <span className="font-mono">{formatBDT(item.grossAmount)}</span>
              </div>
            </div>

            {/* Deductions */}
            <div className="p-4 rounded-xl bg-[#faf9f5] border border-[#ece7dc] space-y-2">
              <p className="font-bold text-xs text-amber-900 pb-1 border-b border-[#ded8cb]">
                Deductions & Recoveries
              </p>
              <div className="flex justify-between">
                <span>Unpaid Absence / Leave</span>
                <span className="font-mono text-amber-800">{formatBDT(item.unpaidDeduction)}</span>
              </div>
              <div className="flex justify-between">
                <span>Late Arrival Penalties</span>
                <span className="font-mono text-amber-800">{formatBDT(item.latePenaltyDeduction)}</span>
              </div>
              <div className="flex justify-between">
                <span>Salary Advance Recovery</span>
                <span className="font-mono text-amber-800">{formatBDT(item.advanceRecoveryDeduction)}</span>
              </div>
              <div className="pt-2 border-t border-[#ded8cb] flex justify-between font-bold text-amber-900">
                <span>Total Deductions</span>
                <span className="font-mono">{formatBDT(item.totalDeductions)}</span>
              </div>
            </div>
          </div>

          {/* Net Salary Payable */}
          <div className="p-4 rounded-xl bg-[#171c1b] border-2 border-[#CAA05C] text-white flex items-center justify-between shadow-sm">
            <div>
              <p className="text-[11px] text-[#CAA05C] uppercase font-bold tracking-wider">
                Net Salary Payable (BDT)
              </p>
              <p className="text-2xl font-bold font-mono mt-0.5">{formatBDT(item.netAmount)}</p>
            </div>
            <button
              onClick={handleDownload}
              className="px-4 py-2 rounded-xl bg-[#CAA05C] hover:bg-[#ba904c] text-[#171c1b] font-bold text-xs flex items-center gap-2 cursor-pointer transition-colors shadow-xs"
            >
              <Download className="w-4 h-4" />
              <span>Download Official PDF</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
