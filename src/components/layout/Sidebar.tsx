import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  CalendarCheck,
  CalendarDays,
  Clock,
  Compass,
  FileSpreadsheet,
  LayoutDashboard,
  MonitorSmartphone,
  Settings,
  Users,
  Wallet,
} from 'lucide-react';
import { useAppContext } from '../../context/AppContext';
import { getRoleBadge, hasPermission } from '../../utils/permissions';
import { db } from '../../db/database';

export const Sidebar: React.FC = () => {
  const {
    currentUser,
    isMobileNavOpen,
    setIsMobileNavOpen,
    setIsKioskOpen,
  } = useAppContext();

  const currentRole = currentUser?.role || 'employee';
  const roleBadge = getRoleBadge(currentRole);

  const navItems = [
    {
      to: '/',
      label: 'Dashboard',
      icon: LayoutDashboard,
      show: true,
      end: true,
    },
    {
      to: '/attendance',
      label: 'Office Attendance',
      icon: Clock,
      show: true,
    },
    {
      to: '/staff-attendance',
      label: 'Staff Attendance',
      icon: CalendarCheck,
      show: currentRole === 'super_admin',
      badge: 'Super Admin',
    },
    {
      to: '/leave',
      label: 'Leave Management',
      icon: CalendarDays,
      show: true,
    },
    {
      to: '/payroll',
      label: 'Payroll & Compensation',
      icon: Wallet,
      show:
        hasPermission(currentRole, 'payroll.calculate') ||
        hasPermission(currentRole, 'salary.read') ||
        currentRole === 'employee',
      badge: currentRole === 'employee' ? 'My Slips' : 'BDT ৳',
    },
    {
      to: '/employees',
      label: 'Studio Directory',
      icon: Users,
      show: currentRole !== 'employee',
    },
    {
      to: '/reports',
      label: 'Reports & Registers',
      icon: FileSpreadsheet,
      show: hasPermission(currentRole, 'reports.hr') || hasPermission(currentRole, 'reports.payroll'),
    },
    {
      to: '/settings',
      label: 'Settings & Audit',
      icon: Settings,
      show: currentRole === 'super_admin' || currentRole === 'hr_admin',
    },
  ];

  return (
    <>
      {/* Mobile backdrop */}
      {isMobileNavOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-xs z-40 lg:hidden"
          onClick={() => setIsMobileNavOpen(false)}
        />
      )}

      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 w-68 bg-[#171c1b] text-[#eae7e1] flex flex-col border-r border-[#242b29] transition-transform duration-200 lg:translate-x-0 ${
          isMobileNavOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Brand Header */}
        <div className="p-5 border-b border-[#242b29] flex items-center justify-between">
          <NavLink
            to="/"
            onClick={() => setIsMobileNavOpen(false)}
            className="flex items-center gap-3 group"
          >
            <div
              className="w-10 h-10 rounded-xl bg-white p-1.5 flex items-center justify-center border border-[#CAA05C]/40 shadow-xs group-hover:border-[#CAA05C] transition-colors shrink-0 overflow-hidden"
              style={{ width: 40, height: 40, minWidth: 40, minHeight: 40, maxWidth: 40, maxHeight: 40 }}
            >
              <img
                src="/logo.png"
                alt="Studio Matra Logo"
                width={32}
                height={32}
                className="w-full h-full object-contain"
                style={{ maxWidth: 32, maxHeight: 32, width: '100%', height: '100%' }}
              />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-serif tracking-wider font-bold text-base text-white">STUDIO MATRA</span>
              </div>
              <p className="text-[10px] uppercase tracking-widest text-[#CAA05C] font-semibold">
                Interior Architecture
              </p>
            </div>
          </NavLink>
        </div>

        {/* User Identity Snippet */}
        {(() => {
          const emp = currentUser?.employeeId ? db.getEmployeeById(currentUser.employeeId) : null;
          const desTitle = emp
            ? (emp.customDesignation || db.getDesignations().find((d) => d.id === emp.designationId)?.title)
            : null;
          return (
            <div className="px-5 py-3.5 bg-[#131716] border-b border-[#242b29] flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-[#CAA05C]/20 border border-[#CAA05C]/40 text-[#CAA05C] font-semibold text-xs flex items-center justify-center shrink-0">
                {currentUser?.fullName?.charAt(0) || 'U'}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-white truncate">{currentUser?.fullName || 'User'}</p>
                {desTitle && (
                  <p className="text-[10px] text-[#CAA05C] font-medium truncate mt-0.5">{desTitle}</p>
                )}
                <div className="flex items-center gap-1.5 mt-1">
                  <span className={`text-[9px] px-1.5 py-0.2 rounded border font-medium ${roleBadge.colorClass}`}>
                    {roleBadge.label}
                  </span>
                  {emp?.employmentType === 'adhoc' && (
                    <span className="text-[9px] px-1.5 py-0.2 rounded border border-purple-500/40 bg-purple-950/60 text-purple-300 font-medium">
                      Ad-hoc
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })()}

        {/* Quick Kiosk Launch Button */}
        <div className="p-3">
          <button
            onClick={() => {
              setIsKioskOpen(true);
              setIsMobileNavOpen(false);
            }}
            className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg bg-[#1f2725] hover:bg-[#25302d] border border-[#2d3835] text-xs font-medium text-[#c8d4cf] hover:text-white transition-colors cursor-pointer shadow-xs group"
          >
            <MonitorSmartphone className="w-4 h-4 text-[#CAA05C] group-hover:scale-110 transition-transform" />
            <span>Launch Office Kiosk</span>
          </button>
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 px-3 py-2 space-y-1 overflow-y-auto">
          {navItems
            .filter((item) => item.show)
            .map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  onClick={() => setIsMobileNavOpen(false)}
                  className={({ isActive }) =>
                    `w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                      isActive
                        ? 'bg-[#CAA05C] text-[#171c1b] shadow-xs font-bold'
                        : 'text-[#9ea8a4] hover:bg-[#1e2422] hover:text-[#e1ded8]'
                    }`
                  }
                >
                  {({ isActive }) => (
                    <>
                      <div className="flex items-center gap-2.5 min-w-0">
                        <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-[#171c1b]' : 'text-[#CAA05C]'}`} />
                        <span className="truncate whitespace-nowrap">{item.label}</span>
                      </div>
                      {item.badge && (
                        <span
                          className={`text-[9.5px] px-1.5 py-0.5 rounded font-mono font-bold tracking-wider uppercase shrink-0 whitespace-nowrap ml-2 ${
                            isActive ? 'bg-[#171c1b] text-[#CAA05C]' : 'bg-[#242b29] text-[#CAA05C] border border-[#CAA05C]/20'
                          }`}
                        >
                          {item.badge}
                        </span>
                      )}
                    </>
                  )}
                </NavLink>
              );
            })}
        </nav>

        {/* Footer info */}
        <div className="p-4 border-t border-[#242b29] text-[11px] text-[#717a77]">
          <div className="flex items-center justify-between mb-1">
            <span>Dhaka Timezone</span>
            <span className="text-[#a0aba6] font-mono">Asia/Dhaka</span>
          </div>
          <div className="flex items-center justify-between">
            <span>Currency</span>
            <span className="text-[#CAA05C] font-semibold">BDT (৳)</span>
          </div>
        </div>
      </aside>
    </>
  );
};

