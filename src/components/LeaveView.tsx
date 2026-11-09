import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  ArrowRight,
  Briefcase,
  Building,
  Calendar,
  Check,
  CheckCircle2,
  Clock,
  Edit3,
  FileText,
  Filter,
  PlusCircle,
  Save,
  Search,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  UserCheck,
  Users,
  X,
} from 'lucide-react';
import { db } from '../db/database';
import { Employee, LeaveBalance, LeaveRequest, LeaveType, RoleName, User } from '../types';
import { canApproveLeave, hasPermission } from '../utils/permissions';

interface LeaveViewProps {
  currentUser: User;
}

export const LeaveView: React.FC<LeaveViewProps> = ({ currentUser }) => {
  const currentEmp = db.getEmployeeByUserId(currentUser.id);
  const isEmployeeRole = currentUser.role === 'employee';
  const canApprove = canApproveLeave(currentUser.role);
  const isDeptManager = currentUser.role === 'department_manager';
  const canManageLeaves = hasPermission(currentUser.role, 'leave.manage') || canApprove;

  // Real-time reactive subscriber
  const [, setDbTick] = useState(0);
  useEffect(() => {
    return db.subscribe(() => setDbTick((t) => t + 1));
  }, []);

  // Main navigation tab for admin/manager view
  const [adminViewTab, setAdminViewTab] = useState<'requests' | 'balances'>('requests');
  const [activeFilter, setActiveFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
  const [deptFilter, setDeptFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Modals state
  const [isApplyModalOpen, setIsApplyModalOpen] = useState(false);
  const [reviewRequest, setReviewRequest] = useState<LeaveRequest | null>(null);
  const [reviewComment, setReviewComment] = useState('');
  const [editingRequest, setEditingRequest] = useState<LeaveRequest | null>(null);
  const [editingEmployeeBalance, setEditingEmployeeBalance] = useState<Employee | null>(null);
  const [viewHistoryEmployee, setViewHistoryEmployee] = useState<Employee | null>(null);
  const [successBanner, setSuccessBanner] = useState('');

  // Data fetching
  const leaveTypes = db.getLeaveTypes();
  const allEmployees = db.getEmployees();
  const departments = db.getDepartments();
  const designations = db.getDesignations();
  const allLeaveRequests = db.getLeaveRequests(isEmployeeRole && currentEmp ? currentEmp.id : undefined);
  const userBalances = currentEmp
    ? (db.getLeaveBalances(currentEmp.id).length > 0
        ? db.getLeaveBalances(currentEmp.id)
        : leaveTypes.map((lt) => ({
            id: `lb-${currentEmp.id}-${lt.code.toLowerCase()}`,
            employeeId: currentEmp.id,
            leaveTypeId: lt.id,
            year: 2026,
            openingBalance: lt.annualQuota,
            accrued: lt.annualQuota,
            used: 0,
            closingBalance: lt.annualQuota,
          })))
    : [];

  // Filtered requests
  const filteredRequests = allLeaveRequests.filter((r) => {
    if (activeFilter === 'pending' && r.status !== 'pending' && r.status !== 'manager_approved') return false;
    if (activeFilter === 'approved' && r.status !== 'approved') return false;
    if (activeFilter === 'rejected' && r.status !== 'rejected') return false;

    if (deptFilter !== 'all') {
      const emp = db.getEmployeeById(r.employeeId);
      if (emp?.departmentId !== deptFilter) return false;
    }

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const emp = db.getEmployeeById(r.employeeId);
      const nameMatch = emp?.fullName.toLowerCase().includes(q) || emp?.employeeCode.toLowerCase().includes(q);
      const reasonMatch = r.reason.toLowerCase().includes(q);
      if (!nameMatch && !reasonMatch) return false;
    }

    return true;
  });

  // Filtered employees for balance directory
  const filteredEmployeesForBalances = allEmployees.filter((emp) => {
    if (deptFilter !== 'all' && emp.departmentId !== deptFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return emp.fullName.toLowerCase().includes(q) || emp.employeeCode.toLowerCase().includes(q);
    }
    return true;
  });

  const handleReviewAction = (action: 'recommend' | 'approve' | 'reject') => {
    if (!reviewRequest) return;
    try {
      db.reviewLeaveRequest({
        requestId: reviewRequest.id,
        action,
        comment: reviewComment,
        reviewer: { userId: currentUser.id, name: currentUser.fullName, role: currentUser.role },
      });
      setSuccessBanner(`Leave request successfully ${action === 'recommend' ? 'recommended' : action + 'd'}.`);
      setTimeout(() => setSuccessBanner(''), 4000);
      setReviewRequest(null);
      setReviewComment('');
    } catch (err: any) {
      alert(err.message || 'Action failed');
    }
  };

  const handleDeleteRequest = (req: LeaveRequest) => {
    if (!confirm(`Are you sure you want to delete this leave request?`)) return;
    try {
      db.deleteLeaveRequest(req.id, {
        userId: currentUser.id,
        name: currentUser.fullName,
      });
      setSuccessBanner('Leave request deleted and quota balance restored.');
      setTimeout(() => setSuccessBanner(''), 4000);
    } catch (err: any) {
      alert(err.message || 'Deletion failed');
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="bg-white rounded-2xl p-6 border border-[#e8e4da] shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <span className="text-xs uppercase font-bold tracking-wider text-[#8f6927] bg-[#f7efe0] border border-[#ebd8b7] px-2.5 py-0.5 rounded-full">
            Time-Off & Leave Management System
          </span>
          <h1 className="text-2xl font-serif font-bold text-[#1c2120] mt-1.5">
            Leave Applications & Staff Quota Balances
          </h1>
          <p className="text-xs text-[#6e7774]">
            Review who applied, inspect remaining quota per employee, and customize balance allocations
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => setIsApplyModalOpen(true)}
            className="px-4 py-2.5 rounded-xl bg-[#CAA05C] hover:bg-[#ba904c] text-[#171c1b] text-xs font-bold flex items-center gap-2 transition-colors cursor-pointer shadow-xs"
          >
            <PlusCircle className="w-4 h-4 text-[#171c1b]" />
            <span>{isEmployeeRole ? 'Apply For Leave' : 'Submit Leave Request'}</span>
          </button>
        </div>
      </div>

      {/* Success Notification Banner */}
      {successBanner && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span className="font-medium">{successBanner}</span>
        </div>
      )}

      {/* Employee Personal Balances Preview (Visible to any logged-in user with an employee profile) */}
      {currentEmp && (
        <div className="bg-gradient-to-r from-[#faf7f0] to-white p-5 rounded-2xl border border-[#e8e4da] shadow-xs">
          <div className="flex items-center justify-between mb-3.5">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#8e6826] flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-[#CAA05C]" />
                <span>Your Official Studio Leave Quotas & Remaining Balances (2026)</span>
              </h3>
              <p className="text-[11px] text-[#6d7773] mt-0.5">
                Overview of your available leaves — tracking days remaining for Casual and Sick leave categories.
              </p>
            </div>
            <button
              onClick={() => setIsApplyModalOpen(true)}
              className="px-3.5 py-1.5 rounded-xl bg-[#CAA05C] hover:bg-[#ba904c] text-[#171c1b] text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              <span>Apply for Leave</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {userBalances.map((bal) => {
              const lt = leaveTypes.find((t) => t.id === bal.leaveTypeId);
              const remaining = bal.closingBalance;
              const total = bal.accrued;
              const used = bal.used;
              const percentage = total > 0 ? Math.round((remaining / total) * 100) : 0;
              const isLow = remaining <= 2;

              return (
                <div
                  key={bal.id}
                  className="bg-white p-5 rounded-2xl border border-[#ded8cb] hover:border-[#CAA05C]/50 transition-all shadow-xs flex flex-col justify-between"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-serif font-bold text-base text-[#1c2120]">{lt?.name || 'Leave'}</span>
                        <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-[#f4ece0] text-[#8e6826] border border-[#ebd8b7]">
                          {lt?.code}
                        </span>
                      </div>
                      <p className="text-xs text-[#717b77] mt-0.5">{lt?.description}</p>
                    </div>

                    <span
                      className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                        isLow ? 'bg-amber-100 text-amber-900 border border-amber-200' : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                      }`}
                    >
                      {remaining} Days Left
                    </span>
                  </div>

                  <div className="mt-4">
                    <div className="flex items-baseline justify-between mb-1.5">
                      <div className="flex items-baseline gap-1.5">
                        <span className="text-3xl font-extrabold text-[#1b4332] font-mono">{remaining}</span>
                        <span className="text-xs text-[#717b77] font-medium">/ {total} days total quota</span>
                      </div>
                      <span className="text-xs font-semibold text-[#8e6826] font-mono">{percentage}% available</span>
                    </div>

                    {/* Progress Bar */}
                    <div className="w-full h-2.5 rounded-full bg-[#f0ece1] overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${
                          isLow ? 'bg-amber-500' : 'bg-[#CAA05C]'
                        }`}
                        style={{ width: `${Math.min(100, Math.max(0, percentage))}%` }}
                      />
                    </div>

                    <div className="mt-2.5 flex items-center justify-between text-[11px] text-[#717b77]">
                      <span>Used: <strong className="text-[#1c2120]">{used}</strong> day(s) taken</span>
                      <span>Remaining: <strong className="text-[#1b4332] font-bold">{remaining}</strong> day(s)</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Admin / Manager Dual View Tabs */}
      {!isEmployeeRole && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#e5e0d3] pb-3">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setAdminViewTab('requests')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
                adminViewTab === 'requests'
                  ? 'bg-[#CAA05C] text-[#171c1b] shadow-xs'
                  : 'bg-white text-[#525d59] border border-[#e0dad0] hover:bg-[#f6f3eb]'
              }`}
            >
              <FileText className="w-4 h-4" />
              <span>Leave Applications Review</span>
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                  adminViewTab === 'requests' ? 'bg-[#171c1b] text-[#CAA05C]' : 'bg-[#ece7dc] text-[#525d59]'
                }`}
              >
                {allLeaveRequests.length}
              </span>
            </button>

            <button
              onClick={() => setAdminViewTab('balances')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
                adminViewTab === 'balances'
                  ? 'bg-[#CAA05C] text-[#171c1b] shadow-xs'
                  : 'bg-white text-[#525d59] border border-[#e0dad0] hover:bg-[#f6f3eb]'
              }`}
            >
              <Users className="w-4 h-4" />
              <span>Staff Quotas & Balances Directory</span>
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                  adminViewTab === 'balances' ? 'bg-[#171c1b] text-[#CAA05C]' : 'bg-[#ece7dc] text-[#525d59]'
                }`}
              >
                {allEmployees.length} Staff
              </span>
            </button>
          </div>

          <div className="text-xs text-[#717b77] italic">
            {adminViewTab === 'requests'
              ? 'Showing who applied and their remaining days'
              : 'Individual balance management & quota adjustments'}
          </div>
        </div>
      )}

      {/* Shared Filter & Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-[#e8e4da] shadow-2xs flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex flex-wrap items-center gap-2.5">
          {adminViewTab === 'requests' && (
            <div className="flex items-center gap-1.5 bg-[#faf9f5] p-1 rounded-xl border border-[#ece7dc]">
              {(['all', 'pending', 'approved', 'rejected'] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setActiveFilter(f)}
                  className={`px-3 py-1 rounded-lg capitalize font-medium transition-colors cursor-pointer ${
                    activeFilter === f
                      ? 'bg-white text-[#1b4332] font-bold shadow-2xs border border-[#ded8cb]'
                      : 'text-[#6e7774] hover:text-[#1c2120]'
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
          )}

          <div className="flex items-center gap-2">
            <label className="font-bold text-[#1c2120]">Department:</label>
            <select
              value={deptFilter}
              onChange={(e) => setDeptFilter(e.target.value)}
              className="px-3 py-1.5 rounded-lg border border-[#ded8cb] bg-[#faf9f5] focus:outline-none focus:border-[#1b4332]"
            >
              <option value="all">All Departments</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="w-full sm:w-64 relative">
          <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-[#8a9490]" />
          <input
            type="text"
            placeholder="Search employee, ID, reason..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-[#ded8cb] bg-[#faf9f5] focus:outline-none focus:border-[#1b4332]"
          />
        </div>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: APPLICATIONS & REVIEW ("keke apply korche" + "jar koto din leave ace") */}
      {/* ========================================================================= */}
      {(adminViewTab === 'requests' || isEmployeeRole) && (
        <div className="bg-white rounded-2xl border border-[#e8e4da] overflow-hidden shadow-xs">
          <div className="p-5 border-b border-[#f0ece1] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="font-bold text-sm text-[#1c2120]">
                {isEmployeeRole ? 'Your Leave Applications' : 'Leave Applications Register'}
              </h3>
              <p className="text-xs text-[#717b77]">
                {isEmployeeRole
                  ? 'Track your submitted requests and approval status'
                  : 'Review each applicant, inspect remaining balances, and decide or edit requests'}
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#f9f8f4] text-[#6d7572] uppercase font-bold text-[10px] border-b border-[#f0ece1]">
                <tr>
                  <th className="py-3 px-4">Applicant</th>
                  <th className="py-3 px-4">Remaining Leave Quota</th>
                  <th className="py-3 px-4">Leave Category</th>
                  <th className="py-3 px-4">Requested Dates</th>
                  <th className="py-3 px-4">Duration</th>
                  <th className="py-3 px-4">Reason</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f2eee6] text-[#2c3330]">
                {filteredRequests.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-10 text-center text-[#7e8884]">
                      No leave requests match this filter.
                    </td>
                  </tr>
                ) : (
                  filteredRequests.map((req) => {
                    const emp = db.getEmployeeById(req.employeeId);
                    const lt = leaveTypes.find((t) => t.id === req.leaveTypeId);
                    const applicantBalances = db.getLeaveBalances(req.employeeId);
                    const dept = departments.find((d) => d.id === emp?.departmentId);

                    return (
                      <tr key={req.id} className="hover:bg-[#faf9f5] transition-colors">
                        {/* Applicant details */}
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-lg bg-[#1b4332]/10 border border-[#1b4332]/20 text-[#1b4332] font-bold text-xs flex items-center justify-center shrink-0">
                              {emp?.fullName.charAt(0) || 'U'}
                            </div>
                            <div>
                              <div className="font-semibold text-[#1c2120]">{emp?.fullName || 'Unknown'}</div>
                              <div className="text-[10px] text-[#717a76] font-mono">
                                {emp?.employeeCode} • {dept?.name || 'Studio'}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* "jar koto din leave ace" - Remaining Quotas badges */}
                        <td className="py-3 px-4">
                          <div className="flex flex-wrap items-center gap-1.5 max-w-xs">
                            {applicantBalances.length === 0 ? (
                              <span className="text-[11px] text-[#8e9794]">No balances initialized</span>
                            ) : (
                              applicantBalances.map((b) => {
                                const type = leaveTypes.find((t) => t.id === b.leaveTypeId);
                                const isThisReqType = b.leaveTypeId === req.leaveTypeId;
                                return (
                                  <span
                                    key={b.id}
                                    title={`${type?.name}: ${b.closingBalance} days left out of ${b.accrued}`}
                                    className={`text-[10px] font-mono px-2 py-0.5 rounded-md border font-semibold ${
                                      isThisReqType
                                        ? 'bg-[#eaf4ee] border-[#2d6a4f]/40 text-[#1b4332] ring-1 ring-[#2d6a4f]/20'
                                        : 'bg-[#faf9f5] border-[#ded8cb] text-[#55605c]'
                                    }`}
                                  >
                                    {type?.code}: <strong className="font-bold">{b.closingBalance}d</strong>
                                  </span>
                                );
                              })
                            )}
                          </div>
                        </td>

                        {/* Category */}
                        <td className="py-3 px-4">
                          <span className="font-semibold text-[#1c2120]">{lt?.name}</span>
                          <span className="text-[10px] text-[#717a76] block">
                            {lt?.isPaid ? 'Paid Leave' : 'Unpaid (LWP)'}
                          </span>
                        </td>

                        {/* Dates */}
                        <td className="py-3 px-4 font-mono font-medium">
                          {req.startDate} → {req.endDate}
                        </td>

                        {/* Duration */}
                        <td className="py-3 px-4">
                          <span className="font-bold text-[#1b4332] bg-[#edf7f1] px-2 py-0.5 rounded">
                            {req.durationDays} day(s)
                          </span>
                        </td>

                        {/* Reason */}
                        <td className="py-3 px-4 max-w-xs truncate text-[#505a56]" title={req.reason}>
                          {req.reason}
                        </td>

                        {/* Status */}
                        <td className="py-3 px-4">
                          <span
                            className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                              req.status === 'approved'
                                ? 'bg-emerald-100 text-emerald-800'
                                : req.status === 'rejected'
                                ? 'bg-red-100 text-red-800'
                                : req.status === 'manager_approved'
                                ? 'bg-teal-100 text-teal-800'
                                : 'bg-amber-100 text-amber-800'
                            }`}
                          >
                            {req.status.replace('_', ' ')}
                          </span>
                        </td>

                        {/* Action buttons */}
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {/* Review button if pending */}
                            {(canApprove || isDeptManager) && req.status !== 'approved' && req.status !== 'rejected' && (
                              <button
                                onClick={() => {
                                  setReviewRequest(req);
                                  setReviewComment('');
                                }}
                                className="px-2.5 py-1 rounded-lg bg-[#CAA05C] hover:bg-[#ba904c] text-[#171c1b] font-bold text-xs transition-colors cursor-pointer shadow-2xs"
                              >
                                Review
                              </button>
                            )}

                            {/* Edit request for management */}
                            {canManageLeaves && (
                              <button
                                onClick={() => setEditingRequest(req)}
                                title="Edit leave dates, type, or status"
                                className="p-1.5 rounded-lg border border-[#ded8cb] hover:bg-[#f2eee6] text-[#303835] transition-colors cursor-pointer"
                              >
                                <Edit3 className="w-3.5 h-3.5 text-[#CAA05C]" />
                              </button>
                            )}

                            {/* Delete request for management */}
                            {canManageLeaves && (
                              <button
                                onClick={() => handleDeleteRequest(req)}
                                title="Delete this application"
                                className="p-1.5 rounded-lg text-stone-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: INDIVIDUAL PERSON QUOTAS DIRECTORY ("indivisual person onujai details thakbe") */}
      {/* ========================================================================= */}
      {adminViewTab === 'balances' && !isEmployeeRole && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-sm text-[#1c2120]">
              Staff Quota Directory ({filteredEmployeesForBalances.length} Employees)
            </h3>
            <span className="text-xs text-[#717b77]">
              Click <strong>"Adjust / Edit Balances"</strong> on any employee to update their leave quotas
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredEmployeesForBalances.map((emp) => {
              const dept = departments.find((d) => d.id === emp.departmentId);
              const des = designations.find((d) => d.id === emp.designationId);
              const empBalances = db.getLeaveBalances(emp.id);
              const totalAccrued = empBalances.reduce((sum, b) => sum + b.accrued, 0);
              const totalUsed = empBalances.reduce((sum, b) => sum + b.used, 0);
              const totalRemaining = empBalances.reduce((sum, b) => sum + b.closingBalance, 0);

              return (
                <div
                  key={emp.id}
                  className="bg-white rounded-2xl p-5 border border-[#e8e4da] hover:border-[#1b4332]/40 transition-all shadow-xs flex flex-col justify-between"
                >
                  <div>
                    {/* Employee Profile Header */}
                    <div className="flex items-start justify-between pb-3 border-b border-[#f0ece1]">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-[#2d6a4f]/20 border border-[#2d6a4f]/30 text-[#1b4332] font-bold text-sm flex items-center justify-center">
                          {emp.fullName.charAt(0)}
                        </div>
                        <div>
                          <h4 className="font-bold text-sm text-[#1c2120]">{emp.fullName}</h4>
                          <p className="text-[10px] text-[#717b77]">
                            <span className="font-mono font-bold text-[#1b4332] bg-[#edf7f1] px-1.5 py-0.2 rounded mr-1">
                              {emp.employeeCode}
                            </span>
                            {des?.title}
                          </p>
                        </div>
                      </div>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 font-bold border border-emerald-200">
                        {dept?.name}
                      </span>
                    </div>

                    {/* Total Leave Metric Badge */}
                    <div className="mt-3.5 p-2.5 rounded-xl bg-[#faf9f5] border border-[#ece7dc] flex items-center justify-between text-xs">
                      <span className="text-[11px] text-[#717b77]">Total 2026 Balance:</span>
                      <div className="flex items-baseline gap-1 font-mono">
                        <strong className="text-base text-[#1b4332]">{totalRemaining}</strong>
                        <span className="text-[10px] text-[#7d8783]">/ {totalAccrued} days left</span>
                      </div>
                    </div>

                    {/* Individual Quota Rows */}
                    <div className="mt-3.5 space-y-2.5">
                      {leaveTypes.map((lt) => {
                        const bal = empBalances.find((b) => b.leaveTypeId === lt.id);
                        const accrued = bal?.accrued ?? lt.annualQuota;
                        const used = bal?.used ?? 0;
                        const remaining = bal?.closingBalance ?? Math.max(0, accrued - used);
                        const percent = accrued > 0 ? Math.round((remaining / accrued) * 100) : 0;

                        return (
                          <div key={lt.id} className="space-y-1 text-xs">
                            <div className="flex justify-between items-center text-[11px]">
                              <span className="font-medium text-[#2d3331]">
                                {lt.name} ({lt.code})
                              </span>
                              <span className="font-mono">
                                <strong className="text-[#1b4332]">{remaining}</strong> / {accrued} left
                                <span className="text-[10px] text-[#8e9894] ml-1">({used} taken)</span>
                              </span>
                            </div>
                            <div className="w-full h-1.5 bg-[#f0ece1] rounded-full overflow-hidden">
                              <div
                                className="h-full bg-[#2d6a4f] rounded-full transition-all"
                                style={{ width: `${Math.min(100, percent)}%` }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Individual Actions */}
                  <div className="mt-5 pt-3 border-t border-[#f0ece1] flex items-center justify-between gap-2">
                    <button
                      onClick={() => setViewHistoryEmployee(emp)}
                      className="py-1.5 px-2.5 rounded-lg bg-[#faf9f5] hover:bg-[#f2eee6] text-[11px] font-semibold text-[#48534f] transition-colors cursor-pointer"
                    >
                      History
                    </button>
                    {canManageLeaves && (
                      <button
                        onClick={() => setEditingEmployeeBalance(emp)}
                        className="py-1.5 px-3 rounded-lg bg-[#CAA05C] hover:bg-[#ba904c] text-[#171c1b] text-[11px] font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs ml-auto"
                      >
                        <Edit3 className="w-3.5 h-3.5 text-[#171c1b]" />
                        <span>Adjust / Edit Balances</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 1: EDIT EMPLOYEE LEAVE BALANCE / QUOTA ("oigula edit o korte parbe") */}
      {/* ========================================================================= */}
      {editingEmployeeBalance && (
        <EditLeaveBalanceModal
          employee={editingEmployeeBalance}
          leaveTypes={leaveTypes}
          currentUser={currentUser}
          onClose={() => setEditingEmployeeBalance(null)}
          onSuccess={(msg) => {
            setEditingEmployeeBalance(null);
            setSuccessBanner(msg);
            setTimeout(() => setSuccessBanner(''), 4000);
          }}
        />
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: EDIT EXISTING LEAVE REQUEST */}
      {/* ========================================================================= */}
      {editingRequest && (
        <EditLeaveRequestModal
          request={editingRequest}
          leaveTypes={leaveTypes}
          currentUser={currentUser}
          onClose={() => setEditingRequest(null)}
          onSuccess={(msg) => {
            setEditingRequest(null);
            setSuccessBanner(msg);
            setTimeout(() => setSuccessBanner(''), 4000);
          }}
        />
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: APPLY FOR LEAVE (Self or on behalf of staff) */}
      {/* ========================================================================= */}
      {isApplyModalOpen && (
        <ApplyLeaveModal
          currentUser={currentUser}
          currentEmp={currentEmp}
          employees={allEmployees}
          leaveTypes={leaveTypes}
          isEmployeeRole={isEmployeeRole}
          onClose={() => setIsApplyModalOpen(false)}
          onSuccess={(msg) => {
            setIsApplyModalOpen(false);
            setSuccessBanner(msg);
            setTimeout(() => setSuccessBanner(''), 4000);
          }}
        />
      )}

      {/* ========================================================================= */}
      {/* MODAL 4: REVIEW & DECIDE APPLICATION */}
      {/* ========================================================================= */}
      {reviewRequest && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 border border-[#ded8cb] shadow-2xl animate-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-[#f0ece1]">
              <h3 className="font-bold text-base text-[#1c2120]">Review Leave Application</h3>
              <button
                onClick={() => setReviewRequest(null)}
                className="text-stone-400 hover:text-stone-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {(() => {
              const emp = db.getEmployeeById(reviewRequest.employeeId);
              const lt = leaveTypes.find((t) => t.id === reviewRequest.leaveTypeId);
              const empBalances = db.getLeaveBalances(reviewRequest.employeeId);
              const currentBal = empBalances.find((b) => b.leaveTypeId === reviewRequest.leaveTypeId);

              return (
                <div className="mt-4 space-y-4 text-xs">
                  <div className="p-3.5 bg-[#faf9f5] rounded-xl border border-[#ece7dc] space-y-2">
                    <div className="flex justify-between">
                      <span className="text-[#717b77]">Applicant:</span>
                      <strong className="text-[#1c2120] font-semibold">{emp?.fullName}</strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#717b77]">Category:</span>
                      <span className="font-semibold">{lt?.name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#717b77]">Requested Dates:</span>
                      <span className="font-mono">
                        {reviewRequest.startDate} → {reviewRequest.endDate} ({reviewRequest.durationDays} days)
                      </span>
                    </div>
                    <div className="flex justify-between border-t border-[#ece7dc] pt-1.5">
                      <span className="text-[#717b77]">Current Remaining Balance:</span>
                      <span className="font-bold text-[#1b4332] font-mono">
                        {currentBal ? `${currentBal.closingBalance} days available` : 'N/A'}
                      </span>
                    </div>
                    <div className="pt-1">
                      <span className="text-[#717b77] block mb-0.5">Application Reason:</span>
                      <p className="p-2 bg-white rounded border border-[#ded8cb] text-[#2c3532] italic">
                        "{reviewRequest.reason}"
                      </p>
                    </div>
                  </div>

                  <div>
                    <label className="block font-bold text-[#1c2120] mb-1">Approver Review Comments / Notes</label>
                    <textarea
                      value={reviewComment}
                      onChange={(e) => setReviewComment(e.target.value)}
                      placeholder="Add an internal note or justification..."
                      rows={2}
                      className="w-full p-2.5 border border-[#ded8cb] rounded-lg bg-[#faf9f5] focus:outline-none focus:border-[#1b4332]"
                    />
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#f0ece1]">
                    <button
                      onClick={() => handleReviewAction('reject')}
                      className="px-4 py-2 rounded-xl bg-red-50 hover:bg-red-100 text-red-700 font-bold border border-red-200 cursor-pointer"
                    >
                      Reject Application
                    </button>
                    {isDeptManager && (
                      <button
                        onClick={() => handleReviewAction('recommend')}
                        className="px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold cursor-pointer"
                      >
                        Recommend to HR
                      </button>
                    )}
                    {canApprove && (
                      <button
                        onClick={() => handleReviewAction('approve')}
                        className="px-5 py-2 rounded-xl bg-[#CAA05C] hover:bg-[#ba904c] text-[#171c1b] font-bold cursor-pointer shadow-xs"
                      >
                        Approve & Deduct Quota
                      </button>
                    )}
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 5: EMPLOYEE LEAVE HISTORY */}
      {/* ========================================================================= */}
      {viewHistoryEmployee && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 border border-[#ded8cb] shadow-2xl animate-in zoom-in-95 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-[#f0ece1]">
              <div>
                <h3 className="font-bold text-base text-[#1c2120]">
                  Leave History — {viewHistoryEmployee.fullName}
                </h3>
                <p className="text-xs text-[#717b77] font-mono">{viewHistoryEmployee.employeeCode}</p>
              </div>
              <button
                onClick={() => setViewHistoryEmployee(null)}
                className="text-stone-400 hover:text-stone-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="overflow-y-auto mt-4 space-y-2.5 text-xs">
              {(() => {
                const reqs = db.getLeaveRequests(viewHistoryEmployee.id);
                if (reqs.length === 0) {
                  return <p className="text-center py-8 text-[#78827f]">No leave requests found for this employee.</p>;
                }
                return reqs.map((r) => {
                  const lt = leaveTypes.find((t) => t.id === r.leaveTypeId);
                  return (
                    <div key={r.id} className="p-3 bg-[#faf9f5] rounded-xl border border-[#ece7dc] space-y-1">
                      <div className="flex justify-between items-center">
                        <span className="font-bold text-[#1b4332]">{lt?.name}</span>
                        <span
                          className={`text-[9px] px-2 py-0.5 rounded-full font-bold uppercase ${
                            r.status === 'approved'
                              ? 'bg-emerald-100 text-emerald-800'
                              : r.status === 'rejected'
                              ? 'bg-red-100 text-red-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {r.status}
                        </span>
                      </div>
                      <div className="flex justify-between text-[#505a56] font-mono text-[11px]">
                        <span>{r.startDate} → {r.endDate}</span>
                        <strong>{r.durationDays} day(s)</strong>
                      </div>
                      <p className="text-[11px] text-[#6d7572] italic">"{r.reason}"</p>
                    </div>
                  );
                });
              })()}
            </div>

            <div className="mt-4 pt-3 border-t border-[#f0ece1] flex justify-end">
              <button
                onClick={() => setViewHistoryEmployee(null)}
                className="px-4 py-2 rounded-xl bg-[#f4f1ea] hover:bg-[#eae6dc] font-semibold text-stone-700 cursor-pointer text-xs"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// MODAL: Edit Leave Quota & Balances for an Individual Employee
// ---------------------------------------------------------------------------

interface EditLeaveBalanceModalProps {
  employee: Employee;
  leaveTypes: LeaveType[];
  currentUser: User;
  onClose: () => void;
  onSuccess: (message: string) => void;
}

const EditLeaveBalanceModal: React.FC<EditLeaveBalanceModalProps> = ({
  employee,
  leaveTypes,
  currentUser,
  onClose,
  onSuccess,
}) => {
  const currentBalances = db.getLeaveBalances(employee.id);

  // Maintain local state for each leave type
  const [balancesState, setBalancesState] = useState<
    Record<string, { accrued: number; used: number; closingBalance: number }>
  >(() => {
    const map: Record<string, { accrued: number; used: number; closingBalance: number }> = {};
    for (const lt of leaveTypes) {
      const existing = currentBalances.find((b) => b.leaveTypeId === lt.id);
      map[lt.id] = {
        accrued: existing ? existing.accrued : lt.annualQuota,
        used: existing ? existing.used : 0,
        closingBalance: existing ? existing.closingBalance : lt.annualQuota,
      };
    }
    return map;
  });

  const [adjustmentReason, setAdjustmentReason] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const handleChange = (
    leaveTypeId: string,
    field: 'accrued' | 'used' | 'closingBalance',
    value: number
  ) => {
    setBalancesState((prev) => {
      const current = prev[leaveTypeId] || { accrued: 10, used: 0, closingBalance: 10 };
      const updated = { ...current, [field]: Math.max(0, value) };

      // Auto update closing balance if accrued or used changes
      if (field === 'accrued' || field === 'used') {
        updated.closingBalance = Math.max(0, updated.accrued - updated.used);
      }
      return { ...prev, [leaveTypeId]: updated };
    });
  };

  const handleSaveAll = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    try {
      for (const lt of leaveTypes) {
        const item = balancesState[lt.id];
        if (item) {
          db.updateLeaveBalance(
            {
              employeeId: employee.id,
              leaveTypeId: lt.id,
              accrued: item.accrued,
              used: item.used,
              closingBalance: item.closingBalance,
              notes: adjustmentReason || 'Admin quota adjustment',
            },
            { userId: currentUser.id, name: currentUser.fullName }
          );
        }
      }

      onSuccess(`Successfully updated leave balances and quotas for ${employee.fullName}.`);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to save balance adjustments');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-xl w-full p-6 sm:p-8 border border-[#ded8cb] shadow-2xl animate-in zoom-in-95 my-8">
        <div className="flex items-center justify-between pb-4 border-b border-[#f0ece1]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#1b4332] text-white flex items-center justify-center font-bold text-sm">
              <Calendar className="w-5 h-5 text-[#52b788]" />
            </div>
            <div>
              <h3 className="font-bold text-base text-[#1c2120]">Adjust Leave Quotas & Balances</h3>
              <p className="text-xs text-[#717b77] font-mono">
                {employee.fullName} ({employee.employeeCode})
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-stone-400 hover:text-stone-700 cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSaveAll} className="mt-4 space-y-4 text-xs">
          {errorMsg && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-800">{errorMsg}</div>
          )}

          <div className="p-3 bg-[#edf7f1] border border-[#c2e8d3] rounded-xl text-[#1b4332] text-[11px] leading-relaxed">
            Modify total accrued annual quota, days taken/used, and remaining closing balance for each statutory category.
          </div>

          <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-1">
            {leaveTypes.map((lt) => {
              const state = balancesState[lt.id] || { accrued: lt.annualQuota, used: 0, closingBalance: lt.annualQuota };

              return (
                <div key={lt.id} className="p-4 bg-[#faf9f5] rounded-xl border border-[#ece7dc] space-y-2.5">
                  <div className="flex items-center justify-between pb-1 border-b border-[#ece7dc]">
                    <span className="font-bold text-sm text-[#1c2120]">{lt.name}</span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-white border border-[#ded8cb] text-[#1b4332]">
                      {lt.isPaid ? 'Paid Leave' : 'Unpaid'} • Code: {lt.code}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[11px] text-[#717b77] mb-1">Total Accrued Quota</label>
                      <input
                        type="number"
                        min="0"
                        max="365"
                        value={state.accrued}
                        onChange={(e) => handleChange(lt.id, 'accrued', parseInt(e.target.value) || 0)}
                        className="w-full p-2 border border-[#ded8cb] rounded-lg bg-white font-mono font-bold"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-[#717b77] mb-1">Days Used / Taken</label>
                      <input
                        type="number"
                        min="0"
                        max="365"
                        value={state.used}
                        onChange={(e) => handleChange(lt.id, 'used', parseInt(e.target.value) || 0)}
                        className="w-full p-2 border border-[#ded8cb] rounded-lg bg-white font-mono font-bold text-amber-800"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-[#717b77] mb-1">Remaining Days</label>
                      <input
                        type="number"
                        min="0"
                        max="365"
                        value={state.closingBalance}
                        onChange={(e) => handleChange(lt.id, 'closingBalance', parseInt(e.target.value) || 0)}
                        className="w-full p-2 border border-[#ded8cb] rounded-lg bg-[#edf7f1] font-mono font-bold text-[#1b4332]"
                        required
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div>
            <label className="block font-bold text-[#1c2120] mb-1">Adjustment Reason / Audit Trail Note</label>
            <input
              type="text"
              value={adjustmentReason}
              onChange={(e) => setAdjustmentReason(e.target.value)}
              placeholder="e.g. Added 2 bonus leave days for project completion / manual correction"
              className="w-full p-2.5 border border-[#ded8cb] rounded-lg bg-[#faf9f5]"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#f0ece1]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-[#f4f1ea] hover:bg-[#eae6dc] font-semibold text-stone-700 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl bg-[#CAA05C] hover:bg-[#ba904c] text-[#171c1b] font-bold flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              <Save className="w-3.5 h-3.5 text-[#171c1b]" />
              <span>Save Quotas & Balances</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// MODAL: Edit an Existing Leave Request
// ---------------------------------------------------------------------------

interface EditLeaveRequestModalProps {
  request: LeaveRequest;
  leaveTypes: LeaveType[];
  currentUser: User;
  onClose: () => void;
  onSuccess: (message: string) => void;
}

const EditLeaveRequestModal: React.FC<EditLeaveRequestModalProps> = ({
  request,
  leaveTypes,
  currentUser,
  onClose,
  onSuccess,
}) => {
  const [leaveTypeId, setLeaveTypeId] = useState(request.leaveTypeId);
  const [startDate, setStartDate] = useState(request.startDate);
  const [endDate, setEndDate] = useState(request.endDate);
  const [durationDays, setDurationDays] = useState(request.durationDays);
  const [reason, setReason] = useState(request.reason);
  const [status, setStatus] = useState<LeaveRequest['status']>(request.status);
  const [hrComment, setHrComment] = useState(request.hrComment || '');
  const [errorMsg, setErrorMsg] = useState('');

  // Auto calculate duration when dates change
  const handleDateChange = (start: string, end: string) => {
    setStartDate(start);
    setEndDate(end);
    if (start && end && end >= start) {
      const s = new Date(start);
      const e = new Date(end);
      const diff = Math.floor((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24)) + 1;
      setDurationDays(diff);
    }
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (endDate < startDate) {
      setErrorMsg('End date cannot precede start date.');
      return;
    }

    try {
      db.updateLeaveRequest(
        {
          requestId: request.id,
          leaveTypeId,
          startDate,
          endDate,
          durationDays: Number(durationDays),
          reason,
          status,
          hrComment,
        },
        { userId: currentUser.id, name: currentUser.fullName }
      );

      onSuccess('Leave application successfully updated.');
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to update request');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-lg w-full p-6 border border-[#ded8cb] shadow-2xl animate-in zoom-in-95">
        <div className="flex items-center justify-between pb-3 border-b border-[#f0ece1]">
          <div className="flex items-center gap-2">
            <Edit3 className="w-5 h-5 text-[#1b4332]" />
            <h3 className="font-bold text-base text-[#1c2120]">Edit Leave Application</h3>
          </div>
          <button onClick={onClose} className="text-stone-400 hover:text-stone-700 cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSave} className="mt-4 space-y-4 text-xs">
          {errorMsg && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-800">{errorMsg}</div>
          )}

          <div>
            <label className="block font-bold text-[#1c2120] mb-1">Leave Category</label>
            <select
              value={leaveTypeId}
              onChange={(e) => setLeaveTypeId(e.target.value)}
              className="w-full p-2.5 border border-[#ded8cb] rounded-lg bg-[#faf9f5]"
            >
              {leaveTypes.map((lt) => (
                <option key={lt.id} value={lt.id}>
                  {lt.name} ({lt.code}) — {lt.isPaid ? 'Paid' : 'Unpaid'}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-[#1c2120] mb-1">Start Date</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => handleDateChange(e.target.value, endDate)}
                className="w-full p-2.5 border border-[#ded8cb] rounded-lg bg-[#faf9f5]"
                required
              />
            </div>
            <div>
              <label className="block font-bold text-[#1c2120] mb-1">End Date</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => handleDateChange(startDate, e.target.value)}
                className="w-full p-2.5 border border-[#ded8cb] rounded-lg bg-[#faf9f5]"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-[#1c2120] mb-1">Duration (Days)</label>
              <input
                type="number"
                min="1"
                max="90"
                value={durationDays}
                onChange={(e) => setDurationDays(parseInt(e.target.value) || 1)}
                className="w-full p-2.5 border border-[#ded8cb] rounded-lg bg-[#faf9f5] font-mono font-bold"
                required
              />
            </div>
            <div>
              <label className="block font-bold text-[#1c2120] mb-1">Approval Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as any)}
                className="w-full p-2.5 border border-[#ded8cb] rounded-lg bg-[#faf9f5] font-bold"
              >
                <option value="pending">Pending</option>
                <option value="manager_approved">Manager Approved</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block font-bold text-[#1c2120] mb-1">Applicant Reason</label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={2}
              className="w-full p-2.5 border border-[#ded8cb] rounded-lg bg-[#faf9f5]"
              required
            />
          </div>

          <div>
            <label className="block font-bold text-[#1c2120] mb-1">HR Approver Remarks / Comment</label>
            <input
              type="text"
              value={hrComment}
              onChange={(e) => setHrComment(e.target.value)}
              placeholder="e.g. Approved per annual schedule"
              className="w-full p-2.5 border border-[#ded8cb] rounded-lg bg-[#faf9f5]"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#f0ece1]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-[#f4f1ea] hover:bg-[#eae6dc] font-semibold text-stone-700 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl bg-[#CAA05C] hover:bg-[#ba904c] text-[#171c1b] font-bold flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              <Save className="w-3.5 h-3.5 text-[#171c1b]" />
              <span>Save Changes</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// MODAL: Apply for Leave (Supports self or admin on-behalf)
// ---------------------------------------------------------------------------

interface ApplyLeaveModalProps {
  currentUser: User;
  currentEmp?: Employee;
  employees: Employee[];
  leaveTypes: LeaveType[];
  isEmployeeRole: boolean;
  onClose: () => void;
  onSuccess: (message: string) => void;
}

const ApplyLeaveModal: React.FC<ApplyLeaveModalProps> = ({
  currentUser,
  currentEmp,
  employees,
  leaveTypes,
  isEmployeeRole,
  onClose,
  onSuccess,
}) => {
  const [selectedEmpId, setSelectedEmpId] = useState<string>(
    currentEmp ? currentEmp.id : employees[0]?.id || ''
  );
  const [selectedLeaveTypeId, setSelectedLeaveTypeId] = useState(leaveTypes[0]?.id || 'lt-casual');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [reason, setReason] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Selected employee balances preview
  const selectedEmpBalances = db.getLeaveBalances(selectedEmpId);
  const activeBal = selectedEmpBalances.find((b) => b.leaveTypeId === selectedLeaveTypeId);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!startDate || !endDate) {
      setErrorMsg('Please select both start date and end date.');
      return;
    }

    if (endDate < startDate) {
      setErrorMsg('End date cannot precede start date.');
      return;
    }

    const s = new Date(startDate);
    const end = new Date(endDate);
    const diff = Math.floor((end.getTime() - s.getTime()) / (1000 * 60 * 60 * 24)) + 1;

    const targetEmp = employees.find((emp) => emp.id === selectedEmpId);

    try {
      db.applyLeave(
        {
          employeeId: selectedEmpId,
          leaveTypeId: selectedLeaveTypeId,
          startDate,
          endDate,
          durationDays: diff,
          isHalfDay: false,
          reason,
          managerId: targetEmp?.managerId,
        },
        { userId: currentUser.id, name: currentUser.fullName }
      );

      onSuccess(`Leave application submitted successfully for ${targetEmp?.fullName || 'employee'}.`);
    } catch (err: any) {
      setErrorMsg(err.message || 'Application failed');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-lg w-full p-6 border border-[#ded8cb] shadow-2xl animate-in zoom-in-95">
        <div className="flex items-center justify-between pb-3 border-b border-[#f0ece1]">
          <h3 className="font-bold text-base text-[#1c2120]">
            {isEmployeeRole ? 'Apply for Leave' : 'Submit Leave Application'}
          </h3>
          <button onClick={onClose} className="text-stone-400 hover:text-stone-700 cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4 text-xs">
          {errorMsg && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-800">{errorMsg}</div>
          )}

          {/* Employee selector if admin */}
          {!isEmployeeRole && (
            <div>
              <label className="block font-bold text-[#1c2120] mb-1">Select Employee</label>
              <select
                value={selectedEmpId}
                onChange={(e) => setSelectedEmpId(e.target.value)}
                className="w-full p-2.5 border border-[#ded8cb] rounded-lg bg-[#faf9f5] font-semibold"
              >
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.fullName} ({emp.employeeCode})
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block font-bold text-[#1c2120] mb-1">Leave Category</label>
            <select
              value={selectedLeaveTypeId}
              onChange={(e) => setSelectedLeaveTypeId(e.target.value)}
              className="w-full p-2.5 border border-[#ded8cb] rounded-lg bg-[#faf9f5]"
            >
              {leaveTypes.map((lt) => (
                <option key={lt.id} value={lt.id}>
                  {lt.name} ({lt.code}) — {lt.isPaid ? 'Paid' : 'Unpaid'}
                </option>
              ))}
            </select>
          </div>

          {/* Live Remaining Balance Pill */}
          <div className="p-2.5 bg-[#edf7f1] border border-[#c2e8d3] rounded-xl flex items-center justify-between text-xs">
            <span className="text-[#1b4332]">Current Remaining Quota:</span>
            <span className="font-bold text-[#1b4332] font-mono">
              {activeBal ? `${activeBal.closingBalance} days left` : '10 days (Standard)'}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-[#1c2120] mb-1">Start Date</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full p-2.5 border border-[#ded8cb] rounded-lg bg-[#faf9f5]"
                required
              />
            </div>
            <div>
              <label className="block font-bold text-[#1c2120] mb-1">End Date</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full p-2.5 border border-[#ded8cb] rounded-lg bg-[#faf9f5]"
                required
              />
            </div>
          </div>

          <div>
            <label className="block font-bold text-[#1c2120] mb-1">Reason for Leave</label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Please provide the purpose or reason for your leave..."
              rows={3}
              className="w-full p-2.5 border border-[#ded8cb] rounded-lg bg-[#faf9f5]"
              required
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#f0ece1]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-[#f4f1ea] hover:bg-[#eae6dc] font-semibold text-stone-700 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl bg-[#CAA05C] hover:bg-[#ba904c] text-[#171c1b] font-bold flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              <Check className="w-4 h-4 text-[#171c1b]" />
              <span>Submit Application</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
