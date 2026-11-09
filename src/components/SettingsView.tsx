import React, { useState, useEffect } from 'react';
import {
  AlertCircle,
  Building,
  Check,
  CheckCircle2,
  Clock,
  Compass,
  Database,
  History,
  Image,
  Key,
  Lock,
  Plus,
  RefreshCcw,
  Save,
  Shield,
  Upload,
  Wifi,
} from 'lucide-react';
import { db } from '../db/database';
import { DivisorMethod, Organization, PayrollPolicy, ShiftDefinition, User } from '../types';
import { apiUpdateShift } from '../services/apiService';

interface SettingsViewProps {
  currentUser: User;
}

const WEEK_DAYS = [
  { id: 0, name: 'Sun', full: 'Sunday', isWeekend: false },
  { id: 1, name: 'Mon', full: 'Monday', isWeekend: false },
  { id: 2, name: 'Tue', full: 'Tuesday', isWeekend: false },
  { id: 3, name: 'Wed', full: 'Wednesday', isWeekend: false },
  { id: 4, name: 'Thu', full: 'Thursday', isWeekend: false },
  { id: 5, name: 'Fri', full: 'Friday', isWeekend: true },
  { id: 6, name: 'Sat', full: 'Saturday', isWeekend: false },
];

function calculateShiftHours(
  startTime: string,
  endTime: string,
  breakMinutes: number = 60,
  isOvernight?: boolean
) {
  const [sH, sM] = startTime.split(':').map(Number);
  const [eH, eM] = endTime.split(':').map(Number);
  const startTotal = (sH || 0) * 60 + (sM || 0);
  const endTotal = (eH || 0) * 60 + (eM || 0);
  let elapsed = endTotal - startTotal;
  if (elapsed <= 0 || isOvernight) {
    elapsed += 24 * 60;
  }
  const grossHours = (elapsed / 60).toFixed(1);
  const netMin = Math.max(0, elapsed - breakMinutes);
  const netHours = (netMin / 60).toFixed(1);
  return { grossHours, netHours, elapsedMinutes: elapsed, netMinutes: netMin };
}

export const SettingsView: React.FC<SettingsViewProps> = ({ currentUser }) => {
  const canEditSettings = currentUser.role === 'super_admin' || currentUser.role === 'hr_admin';
  const settings = db.getSettings();
  const [orgName, setOrgName] = useState(settings.organization.name);
  const [orgSubtitle, setOrgSubtitle] = useState(settings.organization.subtitle);
  const [address, setAddress] = useState(settings.organization.address);
  const [phone, setPhone] = useState(settings.organization.phone);
  const [email, setEmail] = useState(settings.organization.email);
  const [logoUrl, setLogoUrl] = useState<string | null>(settings.organization.logoUrl);

  // Policy Settings
  const [divisorMethod, setDivisorMethod] = useState<DivisorMethod>(
    settings.payrollPolicy.divisorMethod
  );
  const [overtimeMultiplier, setOvertimeMultiplier] = useState(
    settings.payrollPolicy.overtimeMultiplier
  );
  const [lateThreshold, setLateThreshold] = useState(
    settings.payrollPolicy.latePenaltyThresholdDays
  );

  // Shifts Management State
  const [shifts, setShifts] = useState<ShiftDefinition[]>(() => db.getShifts());
  const [selectedShiftId, setSelectedShiftId] = useState<string>(() => db.getShifts()[0]?.id || '');
  const selectedShift = shifts.find((s) => s.id === selectedShiftId) || shifts[0];

  const [shiftForm, setShiftForm] = useState({
    name: selectedShift?.name || '',
    startTime: selectedShift?.startTime || '10:15',
    endTime: selectedShift?.endTime || '19:30',
    breakMinutes: selectedShift?.breakMinutes ?? 60,
    graceMinutes: selectedShift?.graceMinutes ?? 10,
    weeklyWorkDays: selectedShift?.weeklyWorkDays ? [...selectedShift.weeklyWorkDays] : [0, 1, 2, 3, 4, 6],
    isOvernight: !!selectedShift?.isOvernight,
    status: selectedShift?.status || ('active' as const),
  });

  const [showAddShiftModal, setShowAddShiftModal] = useState(false);
  const [newShiftForm, setNewShiftForm] = useState({
    name: '',
    startTime: '10:15',
    endTime: '19:30',
    breakMinutes: 60,
    graceMinutes: 10,
    weeklyWorkDays: [0, 1, 2, 3, 4, 6],
    isOvernight: false,
    status: 'active' as const,
    timezone: 'Asia/Dhaka',
  });

  const [saveSuccess, setSaveSuccess] = useState('');
  const [activeSection, setActiveSection] = useState<'profile' | 'shifts' | 'policy' | 'audit'>(
    'profile'
  );

  useEffect(() => {
    const unsub = db.subscribe(() => {
      const current = db.getShifts();
      setShifts(current);
    });
    return unsub;
  }, []);

  const handleSaveShift = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedShift) return;
    const updates = {
      name: shiftForm.name,
      startTime: shiftForm.startTime,
      endTime: shiftForm.endTime,
      breakMinutes: shiftForm.breakMinutes,
      graceMinutes: shiftForm.graceMinutes,
      weeklyWorkDays: shiftForm.weeklyWorkDays,
      isOvernight: shiftForm.isOvernight,
      status: shiftForm.status,
    };
    db.updateShift(
      selectedShift.id,
      updates,
      { userId: currentUser.id, name: currentUser.fullName }
    );
    // Push update live to MySQL via REST API
    apiUpdateShift(selectedShift.id, updates).catch(() => {});
    const refreshed = db.getShifts();
    setShifts(refreshed);
    setSaveSuccess(`Office shift "${shiftForm.name}" updated successfully across all systems.`);
    setTimeout(() => setSaveSuccess(''), 3000);
  };

  const handleCreateShift = (e: React.FormEvent) => {
    e.preventDefault();
    const created = db.createShift(
      {
        name: newShiftForm.name,
        startTime: newShiftForm.startTime,
        endTime: newShiftForm.endTime,
        breakMinutes: newShiftForm.breakMinutes,
        graceMinutes: newShiftForm.graceMinutes,
        weeklyWorkDays: newShiftForm.weeklyWorkDays,
        isOvernight: newShiftForm.isOvernight,
        status: newShiftForm.status,
        timezone: 'Asia/Dhaka',
      },
      { userId: currentUser.id, name: currentUser.fullName }
    );
    const refreshed = db.getShifts();
    setShifts(refreshed);
    setSelectedShiftId(created.id);
    setShiftForm({
      name: created.name,
      startTime: created.startTime,
      endTime: created.endTime,
      breakMinutes: created.breakMinutes,
      graceMinutes: created.graceMinutes,
      weeklyWorkDays: [...created.weeklyWorkDays],
      isOvernight: !!created.isOvernight,
      status: created.status,
    });
    setShowAddShiftModal(false);
    setNewShiftForm({
      name: '',
      startTime: '09:00',
      endTime: '18:00',
      breakMinutes: 60,
      graceMinutes: 10,
      weeklyWorkDays: [0, 1, 2, 3, 4, 6],
      isOvernight: false,
      status: 'active',
      timezone: 'Asia/Dhaka',
    });
    setSaveSuccess(`New office shift "${created.name}" created and configured.`);
    setTimeout(() => setSaveSuccess(''), 3000);
  };

  const auditLogs = db.getAuditLogs();

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        setLogoUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSaveOrganization = (e: React.FormEvent) => {
    e.preventDefault();
    db.updateOrganization(
      {
        name: orgName,
        subtitle: orgSubtitle,
        address,
        phone,
        email,
        logoUrl,
      },
      { userId: currentUser.id, name: currentUser.fullName }
    );
    setSaveSuccess('Studio Matra company details & branding saved successfully.');
    setTimeout(() => setSaveSuccess(''), 3000);
  };

  const handleSavePolicy = (e: React.FormEvent) => {
    e.preventDefault();
    db.updatePayrollPolicy(
      {
        divisorMethod,
        overtimeMultiplier,
        latePenaltyThresholdDays: lateThreshold,
      },
      { userId: currentUser.id, name: currentUser.fullName }
    );
    setSaveSuccess('Payroll policy parameters updated and logged in audit history.');
    setTimeout(() => setSaveSuccess(''), 3000);
  };

  const handleResetDatabase = () => {
    if (
      window.confirm(
        'Are you sure you want to restore pristine initial Studio Matra demonstration data? All current changes will reset.'
      )
    ) {
      db.resetToSeed();
      window.location.reload();
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="bg-white rounded-2xl p-6 border border-[#e8e4da] shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <span className="text-xs uppercase font-bold tracking-wider text-[#8f6927] bg-[#f7efe0] border border-[#ebd8b7] px-2.5 py-0.5 rounded-full">
            System Administration
          </span>
          <h1 className="text-2xl font-serif font-bold text-[#1c2120] mt-1.5">
            Settings, Policies & Security Audit
          </h1>
          <p className="text-xs text-[#6e7774]">
            Corporate branding, official logo asset, shift schedules, payroll rules, and immutable audit logs
          </p>
        </div>

        <button
          onClick={handleResetDatabase}
          className="px-4 py-2.5 rounded-xl bg-red-50 hover:bg-red-100 text-red-800 text-xs font-bold flex items-center gap-2 border border-red-200 transition-colors cursor-pointer"
        >
          <RefreshCcw className="w-4 h-4 text-red-700" />
          <span>Reset Demo Database</span>
        </button>
      </div>

      {saveSuccess && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          <span>{saveSuccess}</span>
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-[#e5e1d8] text-xs font-semibold gap-1">
        <button
          onClick={() => setActiveSection('profile')}
          className={`px-4 py-2.5 rounded-t-xl transition-colors cursor-pointer flex items-center gap-2 ${
            activeSection === 'profile'
              ? 'bg-white text-[#CAA05C] border-t-2 border-t-[#CAA05C] border-x border-[#e8e4da] font-bold'
              : 'text-[#6e7874] hover:text-[#1c2120]'
          }`}
        >
          <Building className="w-4 h-4" />
          <span>Company & Logo</span>
        </button>

        <button
          onClick={() => setActiveSection('shifts')}
          className={`px-4 py-2.5 rounded-t-xl transition-colors cursor-pointer flex items-center gap-2 ${
            activeSection === 'shifts'
              ? 'bg-white text-[#CAA05C] border-t-2 border-t-[#CAA05C] border-x border-[#e8e4da] font-bold'
              : 'text-[#6e7874] hover:text-[#1c2120]'
          }`}
        >
          <Clock className="w-4 h-4" />
          <span>Office Shifts</span>
        </button>

        <button
          onClick={() => setActiveSection('policy')}
          className={`px-4 py-2.5 rounded-t-xl transition-colors cursor-pointer flex items-center gap-2 ${
            activeSection === 'policy'
              ? 'bg-white text-[#CAA05C] border-t-2 border-t-[#CAA05C] border-x border-[#e8e4da] font-bold'
              : 'text-[#6e7874] hover:text-[#1c2120]'
          }`}
        >
          <Compass className="w-4 h-4" />
          <span>Payroll Policies</span>
        </button>

        <button
          onClick={() => setActiveSection('audit')}
          className={`px-4 py-2.5 rounded-t-xl transition-colors cursor-pointer flex items-center gap-2 ${
            activeSection === 'audit'
              ? 'bg-white text-[#CAA05C] border-t-2 border-t-[#CAA05C] border-x border-[#e8e4da] font-bold'
              : 'text-[#6e7874] hover:text-[#1c2120]'
          }`}
        >
          <History className="w-4 h-4" />
          <span>System Audit Logs</span>
        </button>
      </div>

      {/* Section 1: Company Profile & Logo Upload */}
      {activeSection === 'profile' && (
        <form onSubmit={handleSaveOrganization} className="bg-white rounded-2xl p-6 border border-[#e8e4da] shadow-xs space-y-6">
          <div>
            <h3 className="font-bold text-sm text-[#1c2120]">Corporate Entity & Branding</h3>
            <p className="text-xs text-[#717b77] mt-0.5">
              Official company information rendered on all payslips and government registers
            </p>
          </div>

          {/* Logo Upload Container */}
          <div className="p-4 rounded-xl bg-[#faf9f5] border border-[#ece7dc] flex flex-col sm:flex-row items-center gap-5">
            <div className="w-24 h-24 rounded-2xl bg-white border-2 border-dashed border-[#CAA05C]/40 flex items-center justify-center overflow-hidden shrink-0 shadow-xs">
              <img
                src={logoUrl || '/logo.png'}
                alt="Studio Matra Logo"
                className="w-full h-full object-contain p-2"
              />
            </div>

            <div className="flex-1 space-y-1.5 text-xs text-center sm:text-left">
              <h4 className="font-bold text-[#1c2120]">Studio Matra Official Logo Artwork</h4>
              <p className="text-[#646e6a] text-[11px]">
                Official company emblem. Rendered authentically across the web portal, navigation headers,
                office terminal, and downloadable PDF payslips.
              </p>
              <label className="inline-block mt-2 px-3.5 py-1.5 rounded-lg bg-[#CAA05C] hover:bg-[#ba904c] text-[#171c1b] text-xs font-bold cursor-pointer shadow-xs transition-colors">
                <input type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" />
                Upload New Logo File
              </label>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block font-bold text-[#1c2120] mb-1">Company Legal Name</label>
              <input
                type="text"
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
                className="w-full p-2.5 border border-[#ded8cb] rounded-lg bg-[#faf9f5] font-semibold"
                required
              />
            </div>
            <div>
              <label className="block font-bold text-[#1c2120] mb-1">Subtitle / Line of Business</label>
              <input
                type="text"
                value={orgSubtitle}
                onChange={(e) => setOrgSubtitle(e.target.value)}
                className="w-full p-2.5 border border-[#ded8cb] rounded-lg bg-[#faf9f5]"
                required
              />
            </div>
            <div>
              <label className="block font-bold text-[#1c2120] mb-1">Official Address</label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="w-full p-2.5 border border-[#ded8cb] rounded-lg bg-[#faf9f5]"
                required
              />
            </div>
            <div>
              <label className="block font-bold text-[#1c2120] mb-1">Contact Phone Number</label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full p-2.5 border border-[#ded8cb] rounded-lg bg-[#faf9f5] font-mono"
                required
              />
            </div>
          </div>

          <div className="flex justify-end pt-3 border-t border-[#f0ece1]">
            <button
              type="submit"
              className="px-5 py-2.5 rounded-xl bg-[#CAA05C] hover:bg-[#ba904c] text-[#171c1b] text-xs font-bold flex items-center gap-2 cursor-pointer shadow-xs"
            >
              <Save className="w-4 h-4 text-[#171c1b]" />
              <span>Save Company Profile</span>
            </button>
          </div>
        </form>
      )}

      {/* Section 2: Shift Schedules */}
      {activeSection === 'shifts' && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl p-6 border border-[#e8e4da] shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="font-bold text-sm text-[#1c2120]">Studio Office Shifts & Working Schedules</h3>
              <p className="text-xs text-[#717b77] mt-0.5">
                Configure shift hours, grace windows, mandatory rest breaks, and active workdays for attendance evaluation
              </p>
            </div>
            {canEditSettings && (
              <button
                type="button"
                onClick={() => setShowAddShiftModal(true)}
                className="px-4 py-2.5 rounded-xl bg-[#CAA05C] hover:bg-[#ba904c] text-[#171c1b] text-xs font-bold flex items-center gap-2 cursor-pointer shadow-xs transition-colors self-start sm:self-auto"
              >
                <Plus className="w-4 h-4 text-[#171c1b]" />
                <span>Add New Shift</span>
              </button>
            )}
          </div>

          {/* Shift Selection Pills */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {shifts.map((s) => {
              const isSelected = s.id === selectedShift?.id;
              const { grossHours, netHours } = calculateShiftHours(s.startTime, s.endTime, s.breakMinutes, s.isOvernight);
              return (
                <div
                  key={s.id}
                  onClick={() => {
                    setSelectedShiftId(s.id);
                    setShiftForm({
                      name: s.name,
                      startTime: s.startTime,
                      endTime: s.endTime,
                      breakMinutes: s.breakMinutes,
                      graceMinutes: s.graceMinutes,
                      weeklyWorkDays: [...s.weeklyWorkDays],
                      isOvernight: !!s.isOvernight,
                      status: s.status,
                    });
                  }}
                  className={`p-4 rounded-2xl border cursor-pointer transition-all ${
                    isSelected
                      ? 'bg-white border-[#1b4332] shadow-md ring-2 ring-[#1b4332]/10'
                      : 'bg-white/80 hover:bg-white border-[#e8e4da] shadow-xs'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-sm text-[#1c2120]">{s.name}</span>
                    <span
                      className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${
                        s.status === 'active'
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-stone-100 text-stone-600'
                      }`}
                    >
                      {s.status}
                    </span>
                  </div>
                  <p className="text-base font-mono font-bold text-[#1b4332]">
                    {s.startTime} – {s.endTime}
                  </p>
                  <div className="flex items-center gap-3 text-[11px] text-[#6e7874] mt-2 pt-2 border-t border-[#f0ece1]">
                    <span>{netHours}h net ({grossHours}h gross)</span>
                    <span>•</span>
                    <span>{s.graceMinutes}m grace</span>
                    <span>•</span>
                    <span>{s.weeklyWorkDays.length} days/wk</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Active Shift Editor Form */}
          {selectedShift && (
            <form onSubmit={handleSaveShift} className="bg-white rounded-2xl p-6 border border-[#e8e4da] shadow-xs space-y-6">
              <div className="flex items-center justify-between border-b border-[#f0ece1] pb-4">
                <div>
                  <h4 className="font-bold text-sm text-[#1c2120] flex items-center gap-2">
                    <Clock className="w-4 h-4 text-[#1b4332]" />
                    <span>Edit Shift: {selectedShift.name}</span>
                  </h4>
                  <p className="text-xs text-[#717b77] mt-0.5">
                    Changes take effect immediately and apply to real-time attendance punch evaluation
                  </p>
                </div>
                <span className="text-xs font-mono px-2.5 py-1 rounded-md bg-[#faf9f5] border border-[#ece7dc] text-[#636c69]">
                  ID: {selectedShift.id}
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-5 text-xs">
                <div>
                  <label className="block font-bold text-[#1c2120] mb-1">Shift Name</label>
                  <input
                    type="text"
                    value={shiftForm.name}
                    onChange={(e) => setShiftForm({ ...shiftForm, name: e.target.value })}
                    className="w-full p-2.5 border border-[#ded8cb] rounded-lg bg-[#faf9f5] font-semibold"
                    required
                    disabled={!canEditSettings}
                  />
                </div>

                <div>
                  <label className="block font-bold text-[#1c2120] mb-1">Shift Start Time</label>
                  <input
                    type="time"
                    value={shiftForm.startTime}
                    onChange={(e) => setShiftForm({ ...shiftForm, startTime: e.target.value })}
                    className="w-full p-2.5 border border-[#ded8cb] rounded-lg bg-[#faf9f5] font-mono font-bold text-sm"
                    required
                    disabled={!canEditSettings}
                  />
                  <p className="text-[10px] text-[#717b77] mt-1">Official studio arrival time</p>
                </div>

                <div>
                  <label className="block font-bold text-[#1c2120] mb-1">Shift End Time</label>
                  <input
                    type="time"
                    value={shiftForm.endTime}
                    onChange={(e) => setShiftForm({ ...shiftForm, endTime: e.target.value })}
                    className="w-full p-2.5 border border-[#ded8cb] rounded-lg bg-[#faf9f5] font-mono font-bold text-sm"
                    required
                    disabled={!canEditSettings}
                  />
                  <p className="text-[10px] text-[#717b77] mt-1">Official studio departure time</p>
                </div>

                <div>
                  <label className="block font-bold text-[#1c2120] mb-1">
                    Late Grace Window (Minutes)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="60"
                    value={shiftForm.graceMinutes}
                    onChange={(e) => setShiftForm({ ...shiftForm, graceMinutes: parseInt(e.target.value) || 0 })}
                    className="w-full p-2.5 border border-[#ded8cb] rounded-lg bg-[#faf9f5] font-mono"
                    required
                    disabled={!canEditSettings}
                  />
                  <p className="text-[10px] text-[#717b77] mt-1">
                    Punches up to {shiftForm.graceMinutes} min after start count as on-time
                  </p>
                </div>

                <div>
                  <label className="block font-bold text-[#1c2120] mb-1">
                    Unpaid Rest/Lunch Break (Minutes)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="180"
                    value={shiftForm.breakMinutes}
                    onChange={(e) => setShiftForm({ ...shiftForm, breakMinutes: parseInt(e.target.value) || 0 })}
                    className="w-full p-2.5 border border-[#ded8cb] rounded-lg bg-[#faf9f5] font-mono"
                    required
                    disabled={!canEditSettings}
                  />
                  <p className="text-[10px] text-[#717b77] mt-1">
                    Mandatory 60 min meal break automatically deducted from gross hours
                  </p>
                </div>

                <div>
                  <label className="block font-bold text-[#1c2120] mb-1">Shift Status</label>
                  <select
                    value={shiftForm.status}
                    onChange={(e) => setShiftForm({ ...shiftForm, status: e.target.value as 'active' | 'inactive' })}
                    className="w-full p-2.5 border border-[#ded8cb] rounded-lg bg-[#faf9f5] font-semibold"
                    disabled={!canEditSettings}
                  >
                    <option value="active">Active (Available for Employee Assignment)</option>
                    <option value="inactive">Inactive (Archived)</option>
                  </select>
                </div>
              </div>

              {/* Working Days Selector */}
              <div>
                <label className="block font-bold text-xs text-[#1c2120] mb-1.5">
                  Scheduled Working Days (Weekly Work Schedule)
                </label>
                <p className="text-xs text-[#717b77] mb-2.5">
                  Select studio workdays. Unselected days automatically count as statutory Weekly Off (Friday & Saturday in Bangladesh standard).
                </p>
                <div className="flex flex-wrap gap-2">
                  {WEEK_DAYS.map((d) => {
                    const isChecked = shiftForm.weeklyWorkDays.includes(d.id);
                    return (
                      <button
                        type="button"
                        key={d.id}
                        disabled={!canEditSettings}
                        onClick={() => {
                          const updated = isChecked
                            ? shiftForm.weeklyWorkDays.filter((x) => x !== d.id)
                            : [...shiftForm.weeklyWorkDays, d.id].sort((a, b) => a - b);
                          setShiftForm({ ...shiftForm, weeklyWorkDays: updated });
                        }}
                        className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 border transition-colors cursor-pointer ${
                          isChecked
                            ? 'bg-[#1b4332] text-white border-[#1b4332] shadow-xs'
                            : 'bg-[#faf9f5] text-[#6b7571] border-[#ded8cb] hover:border-[#1b4332]/40'
                        }`}
                      >
                        <span className={`w-2 h-2 rounded-full ${isChecked ? 'bg-[#52b788]' : 'bg-stone-300'}`} />
                        <span>{d.name}</span>
                        {d.isWeekend && (
                          <span className={`text-[10px] px-1.5 py-0.2 rounded font-normal ${isChecked ? 'bg-white/20 text-white' : 'bg-stone-200 text-stone-600'}`}>
                            Weekend
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Live Shift Metrics & Breakdown */}
              {(() => {
                const hours = calculateShiftHours(
                  shiftForm.startTime,
                  shiftForm.endTime,
                  shiftForm.breakMinutes,
                  shiftForm.isOvernight
                );
                return (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 rounded-xl bg-[#faf9f5] border border-[#ece7dc] text-xs">
                    <div>
                      <span className="text-[#717b77] block text-[11px]">Scheduled Elapsed:</span>
                      <p className="font-bold font-mono text-base text-[#1c2120] mt-0.5">
                        {hours.grossHours} Hours
                      </p>
                      <span className="text-[10px] text-[#7d8884]">{shiftForm.startTime} to {shiftForm.endTime}</span>
                    </div>

                    <div>
                      <span className="text-[#717b77] block text-[11px]">Mandatory Rest Break:</span>
                      <p className="font-bold font-mono text-base text-[#1c2120] mt-0.5">
                        {shiftForm.breakMinutes} Minutes
                      </p>
                      <span className="text-[10px] text-[#7d8884]">Unpaid deduction</span>
                    </div>

                    <div>
                      <span className="text-[#717b77] block text-[11px]">Net Work Obligation:</span>
                      <p className="font-bold font-mono text-base text-[#1b4332] mt-0.5">
                        {hours.netHours} Hours / Day
                      </p>
                      <span className="text-[10px] text-[#52b788] font-semibold">Standard shift expectation</span>
                    </div>

                    <div>
                      <span className="text-[#717b77] block text-[11px]">Weekly Work Obligation:</span>
                      <p className="font-bold font-mono text-base text-[#1c2120] mt-0.5">
                        {(parseFloat(hours.netHours) * shiftForm.weeklyWorkDays.length).toFixed(1)} Hours
                      </p>
                      <span className="text-[10px] text-[#7d8884]">{shiftForm.weeklyWorkDays.length} working days</span>
                    </div>
                  </div>
                );
              })()}

              {canEditSettings && (
                <div className="flex justify-end pt-3 border-t border-[#f0ece1]">
                  <button
                    type="submit"
                    className="px-5 py-2.5 rounded-xl bg-[#CAA05C] hover:bg-[#ba904c] text-[#171c1b] text-xs font-bold flex items-center gap-2 cursor-pointer shadow-xs transition-colors"
                  >
                    <Save className="w-4 h-4 text-[#171c1b]" />
                    <span>Save Shift Schedule</span>
                  </button>
                </div>
              )}
            </form>
          )}

          {/* Modal to Add New Shift */}
          {showAddShiftModal && (
            <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
              <div className="bg-white rounded-2xl max-w-xl w-full p-6 border border-[#ded8cb] shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-150">
                <div className="flex items-center justify-between border-b border-[#f0ece1] pb-3">
                  <div>
                    <h3 className="font-bold text-base text-[#1c2120]">Add New Office Shift</h3>
                    <p className="text-xs text-[#717b77] mt-0.5">
                      Define a new working shift schedule for studio personnel
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowAddShiftModal(false)}
                    className="text-stone-400 hover:text-stone-700 text-lg font-bold p-1"
                  >
                    ✕
                  </button>
                </div>

                <form onSubmit={handleCreateShift} className="space-y-4 text-xs">
                  <div>
                    <label className="block font-bold text-[#1c2120] mb-1">Shift Name</label>
                    <input
                      type="text"
                      placeholder="e.g. Site Supervision Shift, Evening Studio Shift"
                      value={newShiftForm.name}
                      onChange={(e) => setNewShiftForm({ ...newShiftForm, name: e.target.value })}
                      className="w-full p-2.5 border border-[#ded8cb] rounded-lg bg-[#faf9f5]"
                      required
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block font-bold text-[#1c2120] mb-1">Start Time</label>
                      <input
                        type="time"
                        value={newShiftForm.startTime}
                        onChange={(e) => setNewShiftForm({ ...newShiftForm, startTime: e.target.value })}
                        className="w-full p-2.5 border border-[#ded8cb] rounded-lg bg-[#faf9f5] font-mono font-bold"
                        required
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-[#1c2120] mb-1">End Time</label>
                      <input
                        type="time"
                        value={newShiftForm.endTime}
                        onChange={(e) => setNewShiftForm({ ...newShiftForm, endTime: e.target.value })}
                        className="w-full p-2.5 border border-[#ded8cb] rounded-lg bg-[#faf9f5] font-mono font-bold"
                        required
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block font-bold text-[#1c2120] mb-1">Grace Period (Minutes)</label>
                      <input
                        type="number"
                        min="0"
                        max="60"
                        value={newShiftForm.graceMinutes}
                        onChange={(e) => setNewShiftForm({ ...newShiftForm, graceMinutes: parseInt(e.target.value) || 0 })}
                        className="w-full p-2.5 border border-[#ded8cb] rounded-lg bg-[#faf9f5] font-mono"
                        required
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-[#1c2120] mb-1">Unpaid Break (Minutes)</label>
                      <input
                        type="number"
                        min="0"
                        max="180"
                        value={newShiftForm.breakMinutes}
                        onChange={(e) => setNewShiftForm({ ...newShiftForm, breakMinutes: parseInt(e.target.value) || 0 })}
                        className="w-full p-2.5 border border-[#ded8cb] rounded-lg bg-[#faf9f5] font-mono"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block font-bold text-[#1c2120] mb-1.5">Scheduled Working Days</label>
                    <div className="flex flex-wrap gap-2">
                      {WEEK_DAYS.map((d) => {
                        const isChecked = newShiftForm.weeklyWorkDays.includes(d.id);
                        return (
                          <button
                            type="button"
                            key={d.id}
                            onClick={() => {
                              const updated = isChecked
                                ? newShiftForm.weeklyWorkDays.filter((x) => x !== d.id)
                                : [...newShiftForm.weeklyWorkDays, d.id].sort((a, b) => a - b);
                              setNewShiftForm({ ...newShiftForm, weeklyWorkDays: updated });
                            }}
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 border transition-colors cursor-pointer ${
                              isChecked
                                ? 'bg-[#1b4332] text-white border-[#1b4332]'
                                : 'bg-[#faf9f5] text-[#6b7571] border-[#ded8cb]'
                            }`}
                          >
                            <span>{d.name}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="flex justify-end gap-3 pt-3 border-t border-[#f0ece1]">
                    <button
                      type="button"
                      onClick={() => setShowAddShiftModal(false)}
                      className="px-4 py-2 rounded-xl border border-[#ded8cb] text-[#6b7571] hover:bg-[#faf9f5] font-semibold"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-5 py-2 rounded-xl bg-[#CAA05C] hover:bg-[#ba904c] text-[#171c1b] font-bold flex items-center gap-2 shadow-xs cursor-pointer"
                    >
                      <Plus className="w-4 h-4 text-[#171c1b]" />
                      <span>Create Shift</span>
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Section 3: Payroll Policy */}
      {activeSection === 'policy' && (
        <form onSubmit={handleSavePolicy} className="bg-white rounded-2xl p-6 border border-[#e8e4da] shadow-xs space-y-6">
          <div>
            <h3 className="font-bold text-sm text-[#1c2120]">Salary Calculation Policies</h3>
            <p className="text-xs text-[#717b77] mt-0.5">
              Statutory divisor method, overtime calculation multiplier, and late penalty configurations
            </p>
          </div>

          <div className="space-y-4 text-xs">
            <div>
              <label className="block font-bold text-[#1c2120] mb-1">
                Paid-Day Divisor Method (Daily Salary Base)
              </label>
              <select
                value={divisorMethod}
                onChange={(e) => setDivisorMethod(e.target.value as any)}
                className="w-full sm:w-96 p-2.5 border border-[#ded8cb] rounded-lg bg-[#faf9f5]"
              >
                <option value="fixed_30_days">Fixed 30 Days (Standard Commercial Practice)</option>
                <option value="calendar_days">Calendar Days in Month (30 / 31 / 28)</option>
                <option value="scheduled_workdays">Actual Scheduled Workdays (e.g. 22 days)</option>
              </select>
              <p className="text-[11px] text-[#717b77] mt-1">
                Used to determine daily rate: Daily Rate = Monthly Gross / Divisor.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block font-bold text-[#1c2120] mb-1">Overtime Multiplier</label>
                <select
                  value={overtimeMultiplier}
                  onChange={(e) => setOvertimeMultiplier(Number(e.target.value))}
                  className="w-full p-2.5 border border-[#ded8cb] rounded-lg bg-[#faf9f5]"
                >
                  <option value={1.5}>1.5x Hourly Basic Rate</option>
                  <option value={2.0}>2.0x Hourly Basic Rate</option>
                  <option value={1.0}>1.0x (Regular Hourly Rate)</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-[#1c2120] mb-1">
                  Late Arrival Penalty Threshold
                </label>
                <select
                  value={lateThreshold}
                  onChange={(e) => setLateThreshold(Number(e.target.value))}
                  className="w-full p-2.5 border border-[#ded8cb] rounded-lg bg-[#faf9f5]"
                >
                  <option value={3}>Every 3 Late Days = 1 Day Deduction</option>
                  <option value={4}>Every 4 Late Days = 1 Day Deduction</option>
                  <option value={999}>Disabled (No automatic late deduction)</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end pt-3 border-t border-[#f0ece1]">
              <button
                type="submit"
                className="px-5 py-2.5 rounded-xl bg-[#CAA05C] hover:bg-[#ba904c] text-[#171c1b] text-xs font-bold flex items-center gap-2 cursor-pointer shadow-xs"
              >
                <Save className="w-4 h-4 text-[#171c1b]" />
                <span>Update Policy Parameters</span>
              </button>
            </div>
          </div>
        </form>
      )}

      {/* Section 4: System Audit Logs */}
      {activeSection === 'audit' && (
        <div className="bg-white rounded-2xl border border-[#e8e4da] overflow-hidden shadow-xs">
          <div className="p-5 border-b border-[#f0ece1]">
            <h3 className="font-bold text-sm text-[#1c2120]">Immutable Security & Audit History</h3>
            <p className="text-xs text-[#717b77]">
              Records all employee creations, punch events, attendance adjustments, and payroll approvals
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#f9f8f4] text-[#6d7572] uppercase font-bold text-[10px] border-b border-[#f0ece1]">
                <tr>
                  <th className="py-3 px-4">Timestamp (Dhaka)</th>
                  <th className="py-3 px-4">Actor</th>
                  <th className="py-3 px-4">Target Type</th>
                  <th className="py-3 px-4">Action</th>
                  <th className="py-3 px-4">Audit Details</th>
                  <th className="py-3 px-4">Client IP</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f2eee6] text-[#2c3330]">
                {auditLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-[#faf9f5]">
                    <td className="py-3 px-4 font-mono text-[11px]">
                      {new Date(log.createdAt).toLocaleString('en-US', { timeZone: 'Asia/Dhaka' })}
                    </td>
                    <td className="py-3 px-4 font-semibold text-[#1c2120]">{log.actorName}</td>
                    <td className="py-3 px-4 uppercase text-[10px] text-[#717b77] font-bold">
                      {log.targetType}
                    </td>
                    <td className="py-3 px-4">
                      <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-[#f4f1ea] font-bold text-[#1b4332]">
                        {log.action}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-[#505a56] max-w-sm truncate" title={log.details}>
                      {log.details}
                    </td>
                    <td className="py-3 px-4 font-mono text-[#717b77]">{log.ipAddress || 'Internal'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
