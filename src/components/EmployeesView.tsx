import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  Briefcase,
  Building,
  Check,
  CheckCircle2,
  Clock,
  CreditCard,
  Edit3,
  Eye,
  EyeOff,
  Filter,
  Lock,
  Mail,
  Phone,
  PlusCircle,
  Save,
  Search,
  ShieldAlert,
  Sparkles,
  Trash2,
  UserCheck,
  Users,
  X,
} from 'lucide-react';
import { db } from '../db/database';
import { Department, Designation, Employee, EmploymentType, RoleName, SalaryContract, ShiftDefinition, User } from '../types';
import { canViewSalary, hasPermission } from '../utils/permissions';
import { formatBDT } from '../utils/money';

interface EmployeesViewProps {
  currentUser: User;
}

export const EmployeesView: React.FC<EmployeesViewProps> = ({ currentUser }) => {
  const canManageEmployees = hasPermission(currentUser.role, 'employee.manage');
  const canSeeComp = canViewSalary(currentUser.role);

  const [, setDbTick] = useState(0);
  useEffect(() => {
    return db.subscribe(() => setDbTick((t) => t + 1));
  }, []);

  const [selectedDept, setSelectedDept] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [employeeToDelete, setEmployeeToDelete] = useState<Employee | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [successBanner, setSuccessBanner] = useState('');

  // New Employee Form
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('+880 1711-');
  const [departmentId, setDepartmentId] = useState('dept-arch');
  const [designationId, setDesignationId] = useState('des-3d-intern');
  const [addCustomDesignation, setAddCustomDesignation] = useState('');
  const [addEmploymentType, setAddEmploymentType] = useState<EmploymentType>('full_time');
  const [addAdhocJobTitle, setAddAdhocJobTitle] = useState('');
  const [joiningDate, setJoiningDate] = useState(new Date().toISOString().split('T')[0]);
  const [basicSalary, setBasicSalary] = useState(15000);
  const [pinCode, setPinCode] = useState('1111');
  const [accountPassword, setAccountPassword] = useState('matra1234');
  const [assignedRole, setAssignedRole] = useState<RoleName>('employee');
  const [formError, setFormError] = useState('');

  const employees = db.getEmployees();
  const departments = db.getDepartments();
  const designations = db.getDesignations();
  const shifts = db.getShifts();

  const filteredEmployees = employees.filter((e) => {
    if (selectedDept !== 'all' && e.departmentId !== selectedDept) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      if (!e.fullName.toLowerCase().includes(q) && !e.employeeCode.toLowerCase().includes(q)) {
        return false;
      }
    }
    return true;
  });

  const handleCreateEmployee = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!fullName.trim() || !email.trim()) {
      setFormError('Please fill in required fields.');
      return;
    }

    if (accountPassword && accountPassword.trim().length < 6) {
      setFormError('Login password must be at least 6 characters.');
      return;
    }

    if (pinCode && !/^\d{4}$/.test(pinCode)) {
      setFormError('Kiosk PIN must be exactly 4 numeric digits.');
      return;
    }

    try {
      const newUserId = 'user-' + Date.now();
      const newEmp = db.createEmployee(
        {
          userId: newUserId,
          employeeCode: `SM-${String(employees.length + 1).padStart(4, '0')}`,
          fullName,
          email,
          phone,
          departmentId,
          designationId,
          customDesignation: addCustomDesignation.trim() || undefined,
          joiningDate,
          employmentStatus: 'active',
          employmentType: addEmploymentType,
          adhocJobTitle: addEmploymentType === 'adhoc' || addAdhocJobTitle.trim() ? addAdhocJobTitle.trim() : undefined,
          shiftId: 'shift-standard',
          emergencyContact: {
            name: 'Emergency Contact',
            relationship: 'Family',
            phone: '+880 1711-000000',
          },
          paymentDetails: {
            bankName: 'Eastern Bank Ltd',
            accountName: fullName,
            accountNumber: '104100' + Math.floor(1000000 + Math.random() * 9000000),
            branchName: 'Banani Branch',
          },
        },
        { userId: currentUser.id, name: currentUser.fullName },
        {
          pinCode: pinCode || undefined,
          password: accountPassword.trim() || 'matra1234',
          role: assignedRole,
        }
      );

      // Create salary contract
      db.getSalaryContracts().push({
        id: 'sc-' + Date.now(),
        employeeId: newEmp.id,
        salaryType: 'monthly',
        basicSalary,
        houseRentAllowance: Math.round(basicSalary * 0.5),
        medicalAllowance: 5000,
        transportAllowance: 5000,
        otherFixedAllowances: 2000,
        effectiveFrom: joiningDate,
        status: 'active',
      });

      setIsAddModalOpen(false);
      setFullName('');
      setEmail('');
      setAccountPassword('matra1234');
      setAssignedRole('employee');
      setSuccessBanner(`Employee ${newEmp.fullName} (${newEmp.employeeCode}) onboarded with Login Password & Kiosk PIN (${pinCode}).`);
      setTimeout(() => setSuccessBanner(''), 4500);
    } catch (err: any) {
      setFormError(err.message || 'Creation failed');
    }
  };

  const handleDeleteEmployee = (emp: Employee) => {
    try {
      db.deleteEmployee(emp.id, {
        userId: currentUser.id,
        name: currentUser.fullName,
      });
      setSuccessBanner(`Employee ${emp.fullName} (${emp.employeeCode}) was successfully deleted.`);
      setTimeout(() => setSuccessBanner(''), 4000);
      setEmployeeToDelete(null);
      if (selectedEmployee?.id === emp.id) setSelectedEmployee(null);
      if (editingEmployee?.id === emp.id) setEditingEmployee(null);
    } catch (err: any) {
      alert(err.message || 'Failed to delete employee');
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="bg-white rounded-2xl p-6 border border-[#e8e4da] shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <span className="text-xs uppercase font-bold tracking-wider text-[#8f6927] bg-[#f7efe0] border border-[#ebd8b7] px-2.5 py-0.5 rounded-full">
            Personnel Directory & Compensation
          </span>
          <h1 className="text-2xl font-serif font-bold text-[#1c2120] mt-1.5">
            Studio Matra Architecture & Design Team
          </h1>
          <p className="text-xs text-[#6e7774]">
            Employee profiles, departmental designations, salary structures, and emergency contacts
          </p>
        </div>

        {canManageEmployees && (
          <button
            onClick={() => {
              setFormError('');
              setPinCode(String(Math.floor(1000 + Math.random() * 9000)));
              setIsAddModalOpen(true);
            }}
            className="px-4 py-2.5 rounded-xl bg-[#CAA05C] hover:bg-[#ba904c] text-[#171c1b] text-xs font-bold flex items-center gap-2 transition-colors cursor-pointer shadow-xs"
          >
            <PlusCircle className="w-4 h-4 text-[#171c1b]" />
            <span>Add New Employee</span>
          </button>
        )}
      </div>

      {successBanner && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{successBanner}</span>
        </div>
      )}

      {/* Filter and Search */}
      <div className="bg-white p-4 rounded-2xl border border-[#e8e4da] shadow-2xs flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2">
          <label className="font-bold text-[#1c2120]">Department:</label>
          <select
            value={selectedDept}
            onChange={(e) => setSelectedDept(e.target.value)}
            className="px-3 py-1.5 rounded-lg border border-[#ded8cb] bg-[#faf9f5] focus:outline-none focus:border-[#1b4332]"
          >
            <option value="all">All Departments ({employees.length})</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name} ({employees.filter((e) => e.departmentId === d.id).length})
              </option>
            ))}
          </select>
        </div>

        <div className="w-full sm:w-64 relative">
          <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-[#8a9490]" />
          <input
            type="text"
            placeholder="Search employee..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-[#ded8cb] bg-[#faf9f5] focus:outline-none focus:border-[#1b4332]"
          />
        </div>
      </div>

      {/* Employees Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredEmployees.map((emp) => {
          const dept = departments.find((d) => d.id === emp.departmentId);
          const des = designations.find((d) => d.id === emp.designationId);
          const contract = canSeeComp ? db.getSalaryContractByEmployee(emp.id) : null;
          const gross = contract
            ? contract.basicSalary +
              contract.houseRentAllowance +
              contract.medicalAllowance +
              contract.transportAllowance +
              contract.otherFixedAllowances
            : null;

          return (
            <div
              key={emp.id}
              className="bg-white rounded-2xl p-5 border border-[#e8e4da] hover:border-[#1b4332]/40 transition-all shadow-xs flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between pb-3 border-b border-[#f0ece1]">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-xl bg-[#2d6a4f]/20 border border-[#2d6a4f]/30 text-[#1b4332] font-bold text-base flex items-center justify-center">
                      {emp.fullName.charAt(0)}
                    </div>
                    <div>
                      <h3 className="font-bold text-sm text-[#1c2120]">{emp.fullName}</h3>
                      <p className="text-[10px] font-mono font-bold text-[#1b4332] bg-[#edf7f1] px-1.5 py-0.2 rounded inline-block">
                        {emp.employeeCode}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold capitalize">
                      {emp.employmentStatus}
                    </span>
                    {canManageEmployees && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setEmployeeToDelete(emp);
                        }}
                        title={`Delete ${emp.fullName}`}
                        className="p-1 rounded-md text-stone-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                        aria-label={`Delete ${emp.fullName}`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                <div className="mt-4 space-y-2 text-xs text-[#505a56]">
                  <div className="flex items-center gap-2">
                    <Briefcase className="w-3.5 h-3.5 text-[#CAA05C]" />
                    <span className="font-semibold text-[#1c2120]">{emp.customDesignation || des?.title}</span>
                  </div>
                  {emp.employmentType === 'adhoc' && (
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 font-bold border border-purple-200">
                        Ad-hoc Job {emp.adhocJobTitle ? `• ${emp.adhocJobTitle}` : ''}
                      </span>
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <Building className="w-3.5 h-3.5 text-[#737e7a]" />
                    <span>{dept?.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Mail className="w-3.5 h-3.5 text-[#737e7a]" />
                    <span className="truncate">{emp.email}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Phone className="w-3.5 h-3.5 text-[#737e7a]" />
                      <span>{emp.phone}</span>
                    </div>
                    {canManageEmployees && (() => {
                      const u = db.getUserByEmployeeId(emp.id);
                      return u?.pinCode ? (
                        <span
                          title="4-digit Kiosk Attendance PIN"
                          className="font-mono text-[10px] font-bold text-[#1b4332] bg-[#edf7f1] border border-[#c2e8d3] px-1.5 py-0.5 rounded"
                        >
                          PIN: {u.pinCode}
                        </span>
                      ) : null;
                    })()}
                  </div>
                </div>

                {/* Salary Info snippet (Confidential) */}
                {canSeeComp && gross !== null ? (
                  <div className="mt-4 p-2.5 rounded-xl bg-[#faf9f5] border border-[#ece7dc] flex items-center justify-between text-xs">
                    <span className="text-[11px] text-[#717b77]">Monthly Gross:</span>
                    <span className="font-mono font-bold text-[#1b4332]">{formatBDT(gross, false)}</span>
                  </div>
                ) : (
                  <div className="mt-4 p-2 rounded-xl bg-[#faf9f5] text-[10px] text-[#8e9894] flex items-center gap-1.5">
                    <Lock className="w-3 h-3" />
                    <span>Compensation details restricted</span>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="mt-5 grid grid-cols-2 gap-2">
                <button
                  onClick={() => setSelectedEmployee(emp)}
                  className="py-2 px-3 rounded-xl bg-[#f4f1ea] hover:bg-[#eae6dc] text-xs font-semibold text-[#1c2120] transition-colors cursor-pointer text-center"
                >
                  View Dossier
                </button>
                {(canManageEmployees || canSeeComp) && (
                  <button
                    onClick={() => setEditingEmployee(emp)}
                    className="py-2 px-3 rounded-xl bg-[#1b4332] hover:bg-[#255742] text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-xs"
                  >
                    <Edit3 className="w-3.5 h-3.5 text-[#52b788]" />
                    <span>Edit / Salary</span>
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Full Dossier Modal */}
      {selectedEmployee && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 sm:p-8 border border-[#ded8cb] shadow-2xl animate-in zoom-in-95 my-8">
            <div className="flex items-center justify-between pb-4 border-b border-[#f0ece1]">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-[#1b4332] text-white font-bold text-lg flex items-center justify-center">
                  {selectedEmployee.fullName.charAt(0)}
                </div>
                <div>
                  <h2 className="font-bold text-base text-[#1c2120]">{selectedEmployee.fullName}</h2>
                  <p className="text-xs text-[#717b77] font-mono">
                    {selectedEmployee.employeeCode} • {selectedEmployee.employmentType.replace('_', ' ')}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedEmployee(null)}
                className="text-stone-400 hover:text-stone-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 mt-5 text-xs text-[#303835]">
              <div className="grid grid-cols-2 gap-3 p-4 bg-[#faf9f5] rounded-xl border border-[#ece7dc]">
                <div>
                  <p className="text-[10px] text-[#717b77] uppercase font-bold">Department</p>
                  <p className="font-semibold text-[#1c2120] mt-0.5">
                    {departments.find((d) => d.id === selectedEmployee.departmentId)?.name}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] text-[#717b77] uppercase font-bold">Designation</p>
                  <p className="font-semibold text-[#1c2120] mt-0.5">
                    {selectedEmployee.customDesignation ||
                      designations.find((d) => d.id === selectedEmployee.designationId)?.title}
                  </p>
                  {selectedEmployee.employmentType === 'adhoc' && (
                    <span className="inline-block mt-1 text-[10px] px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 font-bold border border-purple-200">
                      Ad-hoc Job {selectedEmployee.adhocJobTitle ? `• ${selectedEmployee.adhocJobTitle}` : ''}
                    </span>
                  )}
                </div>
                <div>
                  <p className="text-[10px] text-[#717b77] uppercase font-bold">Joining Date</p>
                  <p className="font-mono mt-0.5">{selectedEmployee.joiningDate}</p>
                </div>
                <div>
                  <p className="text-[10px] text-[#717b77] uppercase font-bold">Assigned Shift</p>
                  <p className="font-mono mt-0.5">
                    {shifts.find((s) => s.id === selectedEmployee.shiftId)?.name || 'Studio General Shift'}
                  </p>
                </div>
              </div>

              {/* Kiosk Attendance PIN */}
              {canManageEmployees && (() => {
                const u = db.getUserByEmployeeId(selectedEmployee.id);
                return (
                  <div className="p-3.5 bg-[#faf9f5] rounded-xl border border-[#ece7dc] flex items-center justify-between">
                    <div>
                      <p className="text-[10px] text-[#717b77] uppercase font-bold">Kiosk Attendance PIN</p>
                      <p className="font-mono font-bold text-base text-[#1b4332] mt-0.5 tracking-wider">
                        {u?.pinCode || 'Not Set'}
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        const emp = selectedEmployee;
                        setSelectedEmployee(null);
                        setEditingEmployee(emp);
                      }}
                      className="text-xs font-semibold text-[#1b4332] hover:underline cursor-pointer"
                    >
                      Change PIN →
                    </button>
                  </div>
                );
              })()}

              {/* Salary Structure (if authorized) */}
              {canSeeComp ? (
                (() => {
                  const contract = db.getSalaryContractByEmployee(selectedEmployee.id);
                  if (!contract) return null;
                  const gross =
                    contract.basicSalary +
                    contract.houseRentAllowance +
                    contract.medicalAllowance +
                    contract.transportAllowance +
                    contract.otherFixedAllowances;
                  return (
                    <div className="p-4 bg-[#faf9f5] rounded-xl border border-[#ece7dc] space-y-2">
                      <div className="flex justify-between items-center pb-1 border-b border-[#ded8cb]">
                        <span className="font-bold text-[#1b4332]">Current Salary Contract</span>
                        <span className="font-mono font-bold text-sm text-[#1b4332]">{formatBDT(gross)} / mo</span>
                      </div>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px]">
                        <div className="flex justify-between">
                          <span className="text-[#717b77]">Basic Salary:</span>
                          <span className="font-mono">{formatBDT(contract.basicSalary, false)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-[#717b77]">House Rent:</span>
                          <span className="font-mono">{formatBDT(contract.houseRentAllowance, false)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-[#717b77]">Medical:</span>
                          <span className="font-mono">{formatBDT(contract.medicalAllowance, false)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-[#717b77]">Transport:</span>
                          <span className="font-mono">{formatBDT(contract.transportAllowance, false)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-[#717b77]">Special / Other:</span>
                          <span className="font-mono">{formatBDT(contract.otherFixedAllowances, false)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-[#717b77]">Effective From:</span>
                          <span className="font-mono">{contract.effectiveFrom}</span>
                        </div>
                      </div>
                    </div>
                  );
                })()
              ) : (
                <div className="p-3 bg-stone-100 rounded-xl text-stone-500 text-xs flex items-center gap-2">
                  <Lock className="w-4 h-4" />
                  <span>Salary structure is confidential and restricted by RBAC policy.</span>
                </div>
              )}

              {/* Emergency Contact */}
              <div className="p-4 bg-[#faf9f5] rounded-xl border border-[#ece7dc] space-y-1.5">
                <p className="font-bold text-[#1c2120]">Emergency Contact</p>
                <div className="flex justify-between">
                  <span className="text-[#717b77]">Contact Name:</span>
                  <span className="font-medium text-[#1c2120]">
                    {selectedEmployee.emergencyContact.name} ({selectedEmployee.emergencyContact.relationship})
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#717b77]">Emergency Phone:</span>
                  <span className="font-mono font-medium text-[#1c2120]">{selectedEmployee.emergencyContact.phone}</span>
                </div>
              </div>

              {/* Payment Details */}
              {canSeeComp ? (
                <div className="p-4 bg-[#edf7f1] rounded-xl border border-[#c2e8d3] space-y-1.5">
                  <div className="flex items-center gap-1.5 font-bold text-[#1b4332]">
                    <CreditCard className="w-4 h-4" />
                    <span>Payment & Banking Information</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#527768]">Bank Name:</span>
                    <span className="font-medium text-[#1c2120]">{selectedEmployee.paymentDetails.bankName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#527768]">Account Number:</span>
                    <span className="font-mono font-bold text-[#1c2120]">{selectedEmployee.paymentDetails.accountNumber}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#527768]">Branch / bKash:</span>
                    <span className="font-medium text-[#1c2120]">
                      {selectedEmployee.paymentDetails.branchName} | {selectedEmployee.paymentDetails.bkashNumber || 'N/A'}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="p-3 bg-stone-100 rounded-xl text-stone-500 text-xs flex items-center gap-2">
                  <Lock className="w-4 h-4" />
                  <span>Bank details and accounts are confidential.</span>
                </div>
              )}

              {/* Actions from inside Dossier */}
              <div className="pt-2 flex flex-wrap items-center justify-between gap-2">
                {canManageEmployees && (
                  <button
                    onClick={() => {
                      const emp = selectedEmployee;
                      setSelectedEmployee(null);
                      setEmployeeToDelete(emp);
                    }}
                    className="px-3.5 py-2.5 rounded-xl border border-red-200 bg-red-50 hover:bg-red-100 text-red-700 text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors"
                  >
                    <Trash2 className="w-4 h-4 text-red-600" />
                    <span>Delete Employee</span>
                  </button>
                )}
                {(canManageEmployees || canSeeComp) && (
                  <button
                    onClick={() => {
                      const emp = selectedEmployee;
                      setSelectedEmployee(null);
                      setEditingEmployee(emp);
                    }}
                    className="px-4 py-2.5 rounded-xl bg-[#1b4332] hover:bg-[#255742] text-white text-xs font-bold flex items-center gap-2 cursor-pointer shadow-xs ml-auto"
                  >
                    <Edit3 className="w-4 h-4 text-[#52b788]" />
                    <span>Edit Profile & Salary Structure</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Employee & Salary Modal */}
      {editingEmployee && (
        <EditEmployeeModal
          employee={editingEmployee}
          departments={departments}
          designations={designations}
          shifts={shifts}
          canSeeComp={canSeeComp}
          canManageEmployees={canManageEmployees}
          currentUser={currentUser}
          onClose={() => setEditingEmployee(null)}
          onSuccess={(msg) => {
            setEditingEmployee(null);
            setSuccessBanner(msg);
            setTimeout(() => setSuccessBanner(''), 4000);
          }}
          onDeleteRequest={(emp) => setEmployeeToDelete(emp)}
        />
      )}

      {/* Delete Employee Confirmation Modal */}
      {employeeToDelete && (
        <DeleteEmployeeModal
          employee={employeeToDelete}
          currentUser={currentUser}
          onClose={() => setEmployeeToDelete(null)}
          onConfirm={() => handleDeleteEmployee(employeeToDelete)}
        />
      )}

      {/* Add Employee Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 border border-[#ded8cb] shadow-2xl animate-in zoom-in-95 my-8">
            <div className="flex items-center justify-between pb-4 border-b border-[#f0ece1]">
              <h3 className="font-bold text-base text-[#1c2120]">Register New Studio Employee</h3>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="text-stone-400 hover:text-stone-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateEmployee} className="space-y-4 mt-4 text-xs">
              {formError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-800">
                  {formError}
                </div>
              )}

              <div>
                <label className="block font-bold text-[#1c2120] mb-1">Full Legal Name</label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="e.g. Ar. Shafiqul Alam"
                  className="w-full p-2.5 border border-[#ded8cb] rounded-lg bg-[#faf9f5]"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-[#1c2120] mb-1">Email Address</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="shafiq@studiomatra.com.bd"
                    className="w-full p-2.5 border border-[#ded8cb] rounded-lg bg-[#faf9f5]"
                    required
                  />
                </div>
                <div>
                  <label className="block font-bold text-[#1c2120] mb-1">Phone Number</label>
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full p-2.5 border border-[#ded8cb] rounded-lg bg-[#faf9f5] font-mono"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-[#1c2120] mb-1">Department</label>
                  <select
                    value={departmentId}
                    onChange={(e) => setDepartmentId(e.target.value)}
                    className="w-full p-2.5 border border-[#ded8cb] rounded-lg bg-[#faf9f5]"
                  >
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-[#1c2120] mb-1">Designation</label>
                  <select
                    value={designationId}
                    onChange={(e) => setDesignationId(e.target.value)}
                    className="w-full p-2.5 border border-[#ded8cb] rounded-lg bg-[#faf9f5]"
                  >
                    {designations.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.title}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#505a56] mb-1">
                  Or Custom Designation Title / পদবী টাইপ করুন (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Senior 3D Visualiser, Lead Architect..."
                  value={addCustomDesignation}
                  onChange={(e) => setAddCustomDesignation(e.target.value)}
                  className="w-full p-2.5 border border-[#ded8cb] rounded-lg bg-[#faf9f5] text-xs"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-bold text-[#1c2120] mb-1">Employment Type</label>
                  <select
                    value={addEmploymentType}
                    onChange={(e) => setAddEmploymentType(e.target.value as any)}
                    className="w-full p-2.5 border border-[#ded8cb] rounded-lg bg-[#faf9f5]"
                  >
                    <option value="full_time">Full-Time Regular</option>
                    <option value="contractual">Contractual</option>
                    <option value="intern">Intern</option>
                    <option value="adhoc">Ad-hoc Job (এডহক জব)</option>
                    <option value="consultant">Consultant</option>
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-[#1c2120] mb-1">Joining Date</label>
                  <input
                    type="date"
                    value={joiningDate}
                    onChange={(e) => setJoiningDate(e.target.value)}
                    className="w-full p-2.5 border border-[#ded8cb] rounded-lg bg-[#faf9f5] font-mono"
                    required
                  />
                </div>
                <div>
                  <label className="block font-bold text-[#1c2120] mb-1">Basic Salary (BDT)</label>
                  <input
                    type="number"
                    value={basicSalary}
                    onChange={(e) => setBasicSalary(Number(e.target.value))}
                    className="w-full p-2.5 border border-[#ded8cb] rounded-lg bg-[#faf9f5] font-mono"
                    required
                  />
                </div>
              </div>

              {addEmploymentType === 'adhoc' && (
                <div className="p-3 bg-purple-50 border border-purple-200 rounded-xl space-y-1">
                  <label className="block text-xs font-bold text-purple-900">
                    Ad-hoc Job / Project Assignment Details (এডহক প্রজেক্ট / কাজের বিবরণ)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Banani Residential Drafting & 3D Render Handover"
                    value={addAdhocJobTitle}
                    onChange={(e) => setAddAdhocJobTitle(e.target.value)}
                    className="w-full p-2 border border-purple-300 rounded-lg bg-white text-xs text-purple-900 font-medium"
                  />
                </div>
              )}

              {/* Studio Portal Login Credentials */}
              <div className="p-3.5 bg-[#faf9f5] rounded-xl border border-[#ece7dc] space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <label className="block font-bold text-[#1c2120] flex items-center gap-1.5">
                      <Lock className="w-3.5 h-3.5 text-[#1b4332]" />
                      <span>Studio Portal Login Password</span>
                    </label>
                    <p className="text-[11px] text-[#717b77]">
                      Staff credentials for secure dashboard sign-in (strictly HR-provisioned).
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setAccountPassword('matra1234')}
                    className="text-[11px] text-[#1b4332] font-semibold hover:underline cursor-pointer"
                  >
                    Reset Default (matra1234)
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-[#1c2120] mb-1">
                      Assigned System Role
                    </label>
                    <select
                      value={assignedRole}
                      onChange={(e) => setAssignedRole(e.target.value as RoleName)}
                      className="w-full p-2 border border-[#ded8cb] rounded-lg bg-white"
                    >
                      <option value="employee">Employee (Standard Staff)</option>
                      <option value="department_manager">Department Manager (Lead Architect)</option>
                      <option value="finance_manager">Finance Manager (Accounts)</option>
                      <option value="hr_admin">HR Administrator</option>
                      <option value="super_admin">Super Admin</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-[#1c2120] mb-1">
                      Initial Password (min 6 chars)
                    </label>
                    <input
                      type="text"
                      value={accountPassword}
                      onChange={(e) => setAccountPassword(e.target.value)}
                      placeholder="e.g. matra1234"
                      className="w-full p-2 border border-[#ded8cb] rounded-lg bg-white font-mono font-medium text-xs"
                      required
                      minLength={6}
                    />
                  </div>
                </div>
              </div>

              {/* Kiosk Attendance PIN */}
              <div className="p-3.5 bg-[#faf9f5] rounded-xl border border-[#ece7dc] space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <label className="block font-bold text-[#1c2120]">Kiosk Attendance PIN (4 Digits)</label>
                    <p className="text-[11px] text-[#717b77]">
                      Security PIN for fast kiosk punch-in at the studio terminal. Can be modified later.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setPinCode(String(Math.floor(1000 + Math.random() * 9000)))}
                    className="text-[11px] text-[#1b4332] font-semibold hover:underline cursor-pointer"
                  >
                    Generate Random
                  </button>
                </div>
                <input
                  type="text"
                  maxLength={4}
                  pattern="\d{4}"
                  value={pinCode}
                  onChange={(e) => setPinCode(e.target.value.replace(/\D/g, '').slice(0, 4))}
                  placeholder="e.g. 5555"
                  className="w-full p-2.5 border border-[#ded8cb] rounded-lg bg-white font-mono font-bold text-center tracking-widest text-base text-[#CAA05C]"
                  required
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-[#f0ece1]">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 rounded-lg bg-[#f4f1ea] hover:bg-[#eae6dc] font-semibold text-stone-700 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-lg bg-[#CAA05C] hover:bg-[#ba904c] text-[#171c1b] font-bold cursor-pointer shadow-xs"
                >
                  Save & Onboard
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

// -------------------------------------------------------------
// Dedicated Edit Employee & Salary Modal
// -------------------------------------------------------------

interface EditEmployeeModalProps {
  employee: Employee;
  departments: Department[];
  designations: Designation[];
  shifts: ShiftDefinition[];
  canSeeComp: boolean;
  canManageEmployees: boolean;
  currentUser: User;
  onClose: () => void;
  onSuccess: (message: string) => void;
  onDeleteRequest: (employee: Employee) => void;
}

const EditEmployeeModal: React.FC<EditEmployeeModalProps> = ({
  employee,
  departments,
  designations,
  shifts,
  canSeeComp,
  canManageEmployees,
  currentUser,
  onClose,
  onSuccess,
  onDeleteRequest,
}) => {
  const [activeTab, setActiveTab] = useState<'profile' | 'salary' | 'payment'>('profile');

  // User Account & Kiosk PIN
  const userAccount = db.getUserByEmployeeId(employee.id);
  const [pinCode, setPinCode] = useState(userAccount?.pinCode || '');
  const [resetPassword, setResetPassword] = useState('');
  const [showResetPassword, setShowResetPassword] = useState(false);

  // Profile Fields
  const [fullName, setFullName] = useState(employee.fullName);
  const [email, setEmail] = useState(employee.email);
  const [phone, setPhone] = useState(employee.phone);
  const [departmentId, setDepartmentId] = useState(employee.departmentId);
  const [designationId, setDesignationId] = useState(employee.designationId);
  const [customDesignation, setCustomDesignation] = useState(
    employee.customDesignation ||
      designations.find((d) => d.id === employee.designationId)?.title ||
      ''
  );
  const [employmentStatus, setEmploymentStatus] = useState(employee.employmentStatus);
  const [employmentType, setEmploymentType] = useState<EmploymentType>(employee.employmentType);
  const [adhocJobTitle, setAdhocJobTitle] = useState(employee.adhocJobTitle || '');
  const [shiftId, setShiftId] = useState(employee.shiftId || 'shift-standard');

  // Emergency Contact
  const [emergencyName, setEmergencyName] = useState(employee.emergencyContact.name);
  const [emergencyRelation, setEmergencyRelation] = useState(employee.emergencyContact.relationship);
  const [emergencyPhone, setEmergencyPhone] = useState(employee.emergencyContact.phone);

  // Payment Details
  const [bankName, setBankName] = useState(employee.paymentDetails.bankName);
  const [accountName, setAccountName] = useState(employee.paymentDetails.accountName);
  const [accountNumber, setAccountNumber] = useState(employee.paymentDetails.accountNumber);
  const [branchName, setBranchName] = useState(employee.paymentDetails.branchName);
  const [bkashNumber, setBkashNumber] = useState(employee.paymentDetails.bkashNumber || '');

  // Salary Contract Fields
  const existingContract = db.getSalaryContractByEmployee(employee.id);
  const [basicSalary, setBasicSalary] = useState(existingContract ? existingContract.basicSalary : 45000);
  const [houseRentAllowance, setHouseRentAllowance] = useState(
    existingContract ? existingContract.houseRentAllowance : Math.round(basicSalary * 0.5)
  );
  const [medicalAllowance, setMedicalAllowance] = useState(
    existingContract ? existingContract.medicalAllowance : 5000
  );
  const [transportAllowance, setTransportAllowance] = useState(
    existingContract ? existingContract.transportAllowance : 5000
  );
  const [otherFixedAllowances, setOtherFixedAllowances] = useState(
    existingContract ? existingContract.otherFixedAllowances : 2000
  );
  const [effectiveFrom, setEffectiveFrom] = useState(
    new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Dhaka' }).format(new Date())
  );
  const [salaryNotes, setSalaryNotes] = useState('');

  const [errorMsg, setErrorMsg] = useState('');

  const totalGrossPreview =
    Number(basicSalary || 0) +
    Number(houseRentAllowance || 0) +
    Number(medicalAllowance || 0) +
    Number(transportAllowance || 0) +
    Number(otherFixedAllowances || 0);

  const handleAutoCalcHouseRent = () => {
    setHouseRentAllowance(Math.round(Number(basicSalary || 0) * 0.5));
  };

  const handleSaveAll = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!fullName.trim() || !email.trim()) {
      setErrorMsg('Full Name and Email are required.');
      return;
    }

    try {
      // 1. Update Core Employee Details
      db.updateEmployee(
        employee.id,
        {
          fullName,
          email,
          phone,
          departmentId,
          designationId,
          customDesignation: customDesignation.trim() || undefined,
          employmentStatus,
          employmentType,
          adhocJobTitle: employmentType === 'adhoc' || adhocJobTitle.trim() ? adhocJobTitle.trim() : undefined,
          shiftId,
          emergencyContact: {
            name: emergencyName,
            relationship: emergencyRelation,
            phone: emergencyPhone,
          },
          paymentDetails: {
            bankName,
            accountName,
            accountNumber,
            branchName,
            bkashNumber,
          },
        },
        { userId: currentUser.id, name: currentUser.fullName }
      );

      // 2. Update Salary Structure (if authorized)
      if (canSeeComp) {
        db.updateSalaryContract(
          employee.id,
          {
            basicSalary: Number(basicSalary),
            houseRentAllowance: Number(houseRentAllowance),
            medicalAllowance: Number(medicalAllowance),
            transportAllowance: Number(transportAllowance),
            otherFixedAllowances: Number(otherFixedAllowances),
            effectiveFrom,
            notes: salaryNotes || 'Salary contract revision',
          },
          { userId: currentUser.id, name: currentUser.fullName }
        );
      }

      // 3. Update Kiosk Security PIN (if authorized)
      if (canManageEmployees && pinCode) {
        if (!/^\d{4}$/.test(pinCode)) {
          setErrorMsg('Kiosk Security PIN must be exactly 4 numeric digits.');
          return;
        }
        db.updateEmployeePin(employee.id, pinCode, {
          userId: currentUser.id,
          name: currentUser.fullName,
          role: currentUser.role,
        });
      }

      // 4. Reset Portal Password (if authorized and provided)
      if (canManageEmployees && resetPassword.trim()) {
        if (resetPassword.trim().length < 6) {
          setErrorMsg('New password must be at least 6 characters.');
          return;
        }
        db.resetUserPassword(employee.id, resetPassword.trim(), {
          userId: currentUser.id,
          name: currentUser.fullName,
        });
      }

      onSuccess(`Successfully updated profile${resetPassword.trim() ? ', login password' : ''} & details for ${fullName}.`);
    } catch (err: any) {
      setErrorMsg(err.message || 'Update failed');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-2xl w-full p-6 sm:p-8 border border-[#ded8cb] shadow-2xl animate-in zoom-in-95 my-8">
        <div className="flex items-center justify-between pb-4 border-b border-[#f0ece1]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#CAA05C] text-[#171c1b] flex items-center justify-center font-bold text-sm shadow-xs">
              <Edit3 className="w-5 h-5 text-[#171c1b]" />
            </div>
            <div>
              <h2 className="font-bold text-base text-[#1c2120]">Edit Employee & Salary Structure</h2>
              <p className="text-xs text-[#717b77] font-mono">
                {employee.fullName} • {employee.employeeCode}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-stone-400 hover:text-stone-700 cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex border-b border-[#ece7dc] text-xs font-semibold mt-4 gap-1">
          <button
            type="button"
            onClick={() => setActiveTab('profile')}
            className={`px-4 py-2 rounded-t-xl transition-colors cursor-pointer ${
              activeTab === 'profile'
                ? 'bg-[#faf9f5] text-[#CAA05C] font-bold border-t-2 border-t-[#CAA05C] border-x border-[#ece7dc]'
                : 'text-[#717b77] hover:text-[#1c2120]'
            }`}
          >
            Profile & Shift
          </button>

          {canSeeComp && (
            <button
              type="button"
              onClick={() => setActiveTab('salary')}
              className={`px-4 py-2 rounded-t-xl transition-colors cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'salary'
                  ? 'bg-[#faf9f5] text-[#CAA05C] font-bold border-t-2 border-t-[#CAA05C] border-x border-[#ece7dc]'
                  : 'text-[#717b77] hover:text-[#1c2120]'
              }`}
            >
              <span>Salary & Allowances (BDT)</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded bg-[#f7efe0] border border-[#ebd8b7] text-[#8f6927] font-bold">
                ৳
              </span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setActiveTab('payment')}
            className={`px-4 py-2 rounded-t-xl transition-colors cursor-pointer ${
              activeTab === 'payment'
                ? 'bg-[#faf9f5] text-[#CAA05C] font-bold border-t-2 border-t-[#CAA05C] border-x border-[#ece7dc]'
                : 'text-[#717b77] hover:text-[#1c2120]'
            }`}
          >
            Bank & Emergency
          </button>
        </div>

        <form onSubmit={handleSaveAll} className="mt-4 space-y-4 text-xs">
          {errorMsg && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-800 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* TAB 1: Profile & Shift */}
          {activeTab === 'profile' && (
            <div className="space-y-3.5">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-[#1c2120] mb-1">Full Legal Name</label>
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full p-2.5 border border-[#ded8cb] rounded-lg bg-[#faf9f5]"
                    required
                  />
                </div>
                <div>
                  <label className="block font-bold text-[#1c2120] mb-1">Email Address</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full p-2.5 border border-[#ded8cb] rounded-lg bg-[#faf9f5]"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-bold text-[#1c2120] mb-1">Phone Number</label>
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full p-2.5 border border-[#ded8cb] rounded-lg bg-[#faf9f5] font-mono"
                    required
                  />
                </div>
                <div>
                  <label className="block font-bold text-[#1c2120] mb-1">Department</label>
                  <select
                    value={departmentId}
                    onChange={(e) => setDepartmentId(e.target.value)}
                    className="w-full p-2.5 border border-[#ded8cb] rounded-lg bg-[#faf9f5]"
                  >
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-[#1c2120] mb-1">Standard Designation</label>
                  <select
                    value={designationId}
                    onChange={(e) => {
                      setDesignationId(e.target.value);
                      const match = designations.find((d) => d.id === e.target.value);
                      if (match) setCustomDesignation(match.title);
                    }}
                    className="w-full p-2.5 border border-[#ded8cb] rounded-lg bg-[#faf9f5]"
                  >
                    {designations.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.title}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#505a56] mb-1">
                  Official Designation Title / পদবী পরিবর্তন করুন (Admin Direct Edit)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Principal Architect (Intern) or 3D Visualiser (Intern)"
                  value={customDesignation}
                  onChange={(e) => setCustomDesignation(e.target.value)}
                  className="w-full p-2.5 border border-[#ded8cb] rounded-lg bg-white text-xs font-bold text-[#1c2120]"
                />
                <p className="text-[10px] text-[#717b77] mt-0.5">
                  This title is displayed on the employee's dashboard, attendance calendar, and studio directory.
                </p>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-bold text-[#1c2120] mb-1">Employment Status</label>
                  <select
                    value={employmentStatus}
                    onChange={(e) => setEmploymentStatus(e.target.value as any)}
                    className="w-full p-2.5 border border-[#ded8cb] rounded-lg bg-[#faf9f5]"
                  >
                    <option value="active">Active</option>
                    <option value="probationary">Probationary</option>
                    <option value="resigned">Resigned</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-[#1c2120] mb-1">Employment Type</label>
                  <select
                    value={employmentType}
                    onChange={(e) => setEmploymentType(e.target.value as any)}
                    className="w-full p-2.5 border border-[#ded8cb] rounded-lg bg-[#faf9f5]"
                  >
                    <option value="full_time">Full-Time Regular</option>
                    <option value="contractual">Contractual</option>
                    <option value="intern">Intern</option>
                    <option value="adhoc">Ad-hoc Job (এডহক জব)</option>
                    <option value="consultant">Consultant</option>
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-[#1c2120] mb-1">Assigned Office Shift</label>
                  <select
                    value={shiftId}
                    onChange={(e) => setShiftId(e.target.value)}
                    className="w-full p-2.5 border border-[#ded8cb] rounded-lg bg-[#faf9f5]"
                  >
                    {shifts.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.startTime}–{s.endTime})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {employmentType === 'adhoc' && (
                <div className="p-3.5 bg-purple-50 border border-purple-200 rounded-xl space-y-1">
                  <label className="block text-xs font-bold text-purple-900">
                    Ad-hoc Job / Project Assignment Details (এডহক প্রজেক্ট / কাজের বিবরণ)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Banani Residential Drafting & 3D Render Handover"
                    value={adhocJobTitle}
                    onChange={(e) => setAdhocJobTitle(e.target.value)}
                    className="w-full p-2 border border-purple-300 rounded-lg bg-white text-xs text-purple-900 font-medium"
                  />
                  <p className="text-[10px] text-purple-700">
                    This project note will be shown on the employee's personal dashboard banner.
                  </p>
                </div>
              )}

              {/* Kiosk Attendance PIN Card */}
              {canManageEmployees && (
                <div className="p-4 bg-[#faf9f5] rounded-xl border border-[#ece7dc] space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <label className="block font-bold text-[#1c2120]">Kiosk Attendance Security PIN (4 Digits)</label>
                      <p className="text-[11px] text-[#717b77]">
                        Confidential PIN for employee punch in/out on the office kiosk terminal.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setPinCode(String(Math.floor(1000 + Math.random() * 9000)))}
                      className="text-[11px] text-[#1b4332] font-semibold hover:underline cursor-pointer"
                    >
                      Generate Random PIN
                    </button>
                  </div>
                  <div className="flex items-center gap-3">
                    <input
                      type="text"
                      maxLength={4}
                      pattern="\d{4}"
                      value={pinCode}
                      onChange={(e) => setPinCode(e.target.value.replace(/\D/g, '').slice(0, 4))}
                      className="w-32 p-2.5 border border-[#ded8cb] rounded-lg bg-white font-mono font-bold text-center tracking-widest text-base text-[#1b4332]"
                      placeholder="4-digit"
                      required
                    />
                    <span className="text-xs text-[#6e7774]">
                      Current PIN: <strong className="font-mono text-[#1b4332]">{userAccount?.pinCode || 'Not Set'}</strong>
                    </span>
                  </div>
                </div>
              )}

              {/* Reset Portal Password (Admin Only) */}
              {canManageEmployees && (
                <div className="p-4 bg-[#faf9f5] rounded-xl border border-[#ece7dc] space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <label className="block font-bold text-[#1c2120] flex items-center gap-1.5">
                        <Lock className="w-3.5 h-3.5 text-[#1b4332]" />
                        <span>Reset Portal Login Password</span>
                      </label>
                      <p className="text-[11px] text-[#717b77]">
                        Assign a new web login password for this staff member. Leave blank to keep current password unchanged.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <input
                        type={showResetPassword ? 'text' : 'password'}
                        value={resetPassword}
                        onChange={(e) => setResetPassword(e.target.value)}
                        placeholder="Leave blank to keep unchanged, or enter new password"
                        className="w-full p-2.5 pr-10 border border-[#ded8cb] rounded-lg bg-white font-mono text-xs text-[#1c2120]"
                      />
                      <button
                        type="button"
                        onClick={() => setShowResetPassword(!showResetPassword)}
                        className="absolute right-3 top-2.5 text-[#717b77] hover:text-[#1c2120] cursor-pointer"
                        aria-label={showResetPassword ? 'Hide password' : 'Show password'}
                      >
                        {showResetPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setResetPassword('matra1234');
                        setShowResetPassword(true);
                      }}
                      className="px-3 py-2.5 rounded-lg border border-[#ded8cb] bg-white hover:bg-[#f0ece1] text-[11px] font-semibold text-[#1c2120] whitespace-nowrap cursor-pointer"
                    >
                      Default: matra1234
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: Salary Structure (BDT) */}
          {activeTab === 'salary' && canSeeComp && (
            <div className="space-y-4">
              <div className="p-3.5 rounded-xl bg-[#edf7f1] border border-[#c2e8d3] flex items-center justify-between">
                <div>
                  <span className="text-[11px] text-[#1b4332] font-semibold uppercase tracking-wider block">
                    Calculated Monthly Gross Salary:
                  </span>
                  <span className="text-xl font-bold font-mono text-[#1b4332]">
                    {formatBDT(totalGrossPreview)}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleAutoCalcHouseRent}
                  className="px-3 py-1.5 rounded-lg bg-[#1b4332] hover:bg-[#255742] text-white font-semibold text-[11px] cursor-pointer shadow-xs"
                >
                  Auto-Calculate 50% House Rent
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-[#1c2120] mb-1">Basic Salary (BDT)</label>
                  <input
                    type="number"
                    value={basicSalary}
                    onChange={(e) => setBasicSalary(Number(e.target.value))}
                    className="w-full p-2.5 border border-[#ded8cb] rounded-lg bg-[#faf9f5] font-mono font-semibold"
                    required
                  />
                </div>
                <div>
                  <label className="block font-bold text-[#1c2120] mb-1">
                    House Rent Allowance (50% Standard)
                  </label>
                  <input
                    type="number"
                    value={houseRentAllowance}
                    onChange={(e) => setHouseRentAllowance(Number(e.target.value))}
                    className="w-full p-2.5 border border-[#ded8cb] rounded-lg bg-[#faf9f5] font-mono"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-bold text-[#1c2120] mb-1">Medical Allowance (BDT)</label>
                  <input
                    type="number"
                    value={medicalAllowance}
                    onChange={(e) => setMedicalAllowance(Number(e.target.value))}
                    className="w-full p-2.5 border border-[#ded8cb] rounded-lg bg-[#faf9f5] font-mono"
                  />
                </div>
                <div>
                  <label className="block font-bold text-[#1c2120] mb-1">Transport Allowance (BDT)</label>
                  <input
                    type="number"
                    value={transportAllowance}
                    onChange={(e) => setTransportAllowance(Number(e.target.value))}
                    className="w-full p-2.5 border border-[#ded8cb] rounded-lg bg-[#faf9f5] font-mono"
                  />
                </div>
                <div>
                  <label className="block font-bold text-[#1c2120] mb-1">Special / Project Allowance</label>
                  <input
                    type="number"
                    value={otherFixedAllowances}
                    onChange={(e) => setOtherFixedAllowances(Number(e.target.value))}
                    className="w-full p-2.5 border border-[#ded8cb] rounded-lg bg-[#faf9f5] font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-[#1c2120] mb-1">Effective Date</label>
                  <input
                    type="date"
                    value={effectiveFrom}
                    onChange={(e) => setEffectiveFrom(e.target.value)}
                    className="w-full p-2.5 border border-[#ded8cb] rounded-lg bg-[#faf9f5] font-mono"
                  />
                </div>
                <div>
                  <label className="block font-bold text-[#1c2120] mb-1">Adjustment Note / Reason</label>
                  <input
                    type="text"
                    value={salaryNotes}
                    onChange={(e) => setSalaryNotes(e.target.value)}
                    placeholder="e.g. Annual merit increment / promotion"
                    className="w-full p-2.5 border border-[#ded8cb] rounded-lg bg-[#faf9f5]"
                  />
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: Payment & Emergency */}
          {activeTab === 'payment' && (
            <div className="space-y-4">
              <div className="p-3.5 bg-[#faf9f5] rounded-xl border border-[#ece7dc] space-y-3">
                <p className="font-bold text-[#1c2120]">Banking & Disbursement Account</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[#717b77] mb-1">Bank Name</label>
                    <input
                      type="text"
                      value={bankName}
                      onChange={(e) => setBankName(e.target.value)}
                      className="w-full p-2 border border-[#ded8cb] rounded-lg bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[#717b77] mb-1">Account Holder Name</label>
                    <input
                      type="text"
                      value={accountName}
                      onChange={(e) => setAccountName(e.target.value)}
                      className="w-full p-2 border border-[#ded8cb] rounded-lg bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[#717b77] mb-1">Bank Account Number</label>
                    <input
                      type="text"
                      value={accountNumber}
                      onChange={(e) => setAccountNumber(e.target.value)}
                      className="w-full p-2 border border-[#ded8cb] rounded-lg bg-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[#717b77] mb-1">Branch Name</label>
                    <input
                      type="text"
                      value={branchName}
                      onChange={(e) => setBranchName(e.target.value)}
                      className="w-full p-2 border border-[#ded8cb] rounded-lg bg-white"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-[#717b77] mb-1">bKash Mobile Wallet (Optional)</label>
                    <input
                      type="text"
                      value={bkashNumber}
                      onChange={(e) => setBkashNumber(e.target.value)}
                      placeholder="e.g. 01711000005"
                      className="w-full p-2 border border-[#ded8cb] rounded-lg bg-white font-mono"
                    />
                  </div>
                </div>
              </div>

              <div className="p-3.5 bg-[#faf9f5] rounded-xl border border-[#ece7dc] space-y-3">
                <p className="font-bold text-[#1c2120]">Emergency Contact Details</p>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[#717b77] mb-1">Contact Name</label>
                    <input
                      type="text"
                      value={emergencyName}
                      onChange={(e) => setEmergencyName(e.target.value)}
                      className="w-full p-2 border border-[#ded8cb] rounded-lg bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[#717b77] mb-1">Relationship</label>
                    <input
                      type="text"
                      value={emergencyRelation}
                      onChange={(e) => setEmergencyRelation(e.target.value)}
                      className="w-full p-2 border border-[#ded8cb] rounded-lg bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[#717b77] mb-1">Emergency Phone</label>
                    <input
                      type="text"
                      value={emergencyPhone}
                      onChange={(e) => setEmergencyPhone(e.target.value)}
                      className="w-full p-2 border border-[#ded8cb] rounded-lg bg-white font-mono"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="flex flex-col sm:flex-row justify-between items-center gap-3 pt-3 border-t border-[#f0ece1]">
            <div>
              {canManageEmployees && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onDeleteRequest(employee);
                  }}
                  className="px-3.5 py-2 rounded-lg border border-red-200 bg-red-50 hover:bg-red-100 text-red-700 font-bold text-xs flex items-center gap-1.5 cursor-pointer transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5 text-red-600" />
                  <span>Delete Employee</span>
                </button>
              )}
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-lg bg-[#f4f1ea] hover:bg-[#eae6dc] font-semibold text-stone-700 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 rounded-lg bg-[#CAA05C] hover:bg-[#ba904c] text-[#171c1b] font-bold flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <Save className="w-3.5 h-3.5 text-[#171c1b]" />
                <span>Save All Changes</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

// -------------------------------------------------------------
// Delete Employee Confirmation Modal
// -------------------------------------------------------------

interface DeleteEmployeeModalProps {
  employee: Employee;
  currentUser: User;
  onClose: () => void;
  onConfirm: () => void;
}

const DeleteEmployeeModal: React.FC<DeleteEmployeeModalProps> = ({
  employee,
  currentUser,
  onClose,
  onConfirm,
}) => {
  const isSelf = currentUser.employeeId === employee.id || currentUser.id === employee.userId;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-md w-full p-6 border border-[#ded8cb] shadow-2xl animate-in zoom-in-95">
        <div className="flex items-center justify-between pb-3 border-b border-[#f0ece1]">
          <div className="flex items-center gap-2 text-red-700">
            <div className="w-8 h-8 rounded-lg bg-red-100 flex items-center justify-center">
              <Trash2 className="w-4 h-4 text-red-700" />
            </div>
            <h3 className="font-bold text-sm text-[#1c2120]">Delete Studio Employee</h3>
          </div>
          <button onClick={onClose} className="text-stone-400 hover:text-stone-700 cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        {isSelf ? (
          <div className="mt-4 space-y-4 text-xs">
            <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 flex items-start gap-2.5">
              <ShieldAlert className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">Cannot Delete Active Account</p>
                <p className="mt-0.5 text-[#5e6663]">
                  You are currently logged in as <strong>{employee.fullName}</strong>. To delete this account, please switch to another administrator first.
                </p>
              </div>
            </div>
            <div className="flex justify-end">
              <button
                onClick={onClose}
                className="px-4 py-2 rounded-xl bg-[#f4f1ea] hover:bg-[#eae6dc] font-semibold text-stone-700 cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-4 space-y-4 text-xs">
            <p className="text-[#3a4440] leading-relaxed">
              Are you sure you want to permanently delete <strong>{employee.fullName}</strong> (
              <span className="font-mono font-bold text-[#1b4332]">{employee.employeeCode}</span>)?
            </p>

            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-800 text-[11px] space-y-1">
              <p className="font-bold flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5" />
                This action is irreversible and will remove:
              </p>
              <ul className="list-disc list-inside space-y-0.5 text-red-700 pl-1">
                <li>Employee studio profile & directory record</li>
                <li>System user login credentials and kiosk PIN</li>
                <li>Active salary contracts and compensation details</li>
                <li>Leave balances and historical logs</li>
              </ul>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl bg-[#f4f1ea] hover:bg-[#eae6dc] font-semibold text-stone-700 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={onConfirm}
                className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Confirm & Delete</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
