import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bell,
  Clock,
  KeyRound,
  LogOut,
  Menu,
  MonitorSmartphone,
  Shield,
  User as UserIcon,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { useAppContext } from '../../context/AppContext';
import { getRoleBadge } from '../../utils/permissions';

export const Header: React.FC = () => {
  const {
    currentUser,
    logout,
    openChangePassword,
    unreadCount,
    isOfficeNetwork,
    setIsOfficeNetwork,
    setIsKioskOpen,
    setIsNotificationsOpen,
    isMobileNavOpen,
    setIsMobileNavOpen,
  } = useAppContext();

  const navigate = useNavigate();

  const [dhakaTime, setDhakaTime] = useState<string>('');
  const [dhakaDate, setDhakaDate] = useState<string>('');
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const timeFormatter = new Intl.DateTimeFormat('en-US', {
        timeZone: 'Asia/Dhaka',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true,
      });
      const dateFormatter = new Intl.DateTimeFormat('en-US', {
        timeZone: 'Asia/Dhaka',
        weekday: 'short',
        month: 'short',
        day: 'numeric',
      });
      setDhakaTime(timeFormatter.format(now));
      setDhakaDate(dateFormatter.format(now));
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleLogout = () => {
    setIsUserMenuOpen(false);
    logout();
    navigate('/login', { replace: true });
  };

  const handleChangePassword = () => {
    setIsUserMenuOpen(false);
    openChangePassword();
  };

  const currentBadge = getRoleBadge(currentUser?.role || 'employee');

  return (
    <header className="sticky top-0 z-30 h-16 bg-[#faf9f5] border-b border-[#e5e1d8] px-4 lg:px-8 flex items-center justify-between">
      {/* Left: Mobile hamburger & live Dhaka time */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => setIsMobileNavOpen(!isMobileNavOpen)}
          className="lg:hidden p-2 rounded-lg text-[#3b4340] hover:bg-[#eae6dc] transition-colors cursor-pointer"
          aria-label="Toggle navigation menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Live Dhaka Studio Clock */}
        <div className="flex items-center gap-2 bg-[#f0ece1] border border-[#e2ddd0] px-3 py-1.5 rounded-lg text-xs">
          <Clock className="w-3.5 h-3.5 text-[#CAA05C]" />
          <div className="flex items-center gap-1.5 font-mono">
            <span className="font-semibold text-[#1c2120]">{dhakaTime || '09:00:00 AM'}</span>
            <span className="text-[#6d7571] hidden sm:inline">• {dhakaDate || 'Today'}</span>
            <span className="text-[10px] text-[#8f6927] bg-[#f7efe0] border border-[#ebd8b7] px-1 py-0.2 rounded font-sans font-bold">
              Dhaka GMT+6
            </span>
          </div>
        </div>

        {/* Office Network Status Pill */}
        <button
          onClick={() => setIsOfficeNetwork((prev) => !prev)}
          title="Click to toggle between Office Network and External Network simulation"
          className={`hidden md:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors cursor-pointer ${
            isOfficeNetwork
              ? 'bg-[#edf7f1] border-[#c0e6d0] text-[#1b4332] hover:bg-[#e2f2e8]'
              : 'bg-[#fff1f0] border-[#fed7d5] text-[#b91c1c] hover:bg-[#fee2e1]'
          }`}
        >
          {isOfficeNetwork ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
          <span>{isOfficeNetwork ? 'Studio Network (192.168.1.105)' : 'External Network'}</span>
          <span className="text-[10px] opacity-75 underline ml-1">Toggle</span>
        </button>
      </div>

      {/* Right Controls */}
      <div className="flex items-center gap-2.5">
        {/* Office Kiosk Terminal Button */}
        <button
          onClick={() => setIsKioskOpen(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1c2120] hover:bg-[#2b3331] text-white text-xs font-medium transition-colors cursor-pointer shadow-xs border border-[#353d3a]"
        >
          <MonitorSmartphone className="w-3.5 h-3.5 text-[#CAA05C]" />
          <span className="hidden sm:inline">Kiosk Mode</span>
        </button>

        {/* Notifications Bell */}
        <button
          onClick={() => setIsNotificationsOpen(true)}
          className="relative p-2 rounded-lg text-[#3b4340] hover:bg-[#eae6dc] transition-colors cursor-pointer"
          aria-label={`Notifications: ${unreadCount} unread`}
        >
          <Bell className="w-4 h-4" />
          {unreadCount > 0 && (
            <span className="absolute top-1 right-1 w-4 h-4 rounded-full bg-[#CAA05C] text-[#171c1b] text-[9px] font-bold flex items-center justify-center">
              {unreadCount}
            </span>
          )}
        </button>

        {/* Authenticated User Profile Menu (Replaces demo switcher) */}
        <div className="relative">
          <button
            onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white border border-[#ded8cb] hover:border-[#CAA05C] transition-all cursor-pointer shadow-2xs"
            aria-label="User account menu"
          >
            <div className="w-7 h-7 rounded-full bg-[#CAA05C] text-[#171c1b] text-xs font-bold flex items-center justify-center">
              {currentUser?.fullName?.charAt(0) || 'U'}
            </div>
            <div className="text-left hidden sm:block">
              <p className="text-xs font-semibold text-[#1c2120] leading-none">
                {currentUser?.fullName || 'User'}
              </p>
              <p className="text-[10px] text-[#6b7370] leading-none mt-0.5">{currentBadge.label}</p>
            </div>
          </button>

          {isUserMenuOpen && (
            <div className="absolute right-0 mt-2 w-64 bg-white rounded-2xl shadow-2xl border border-[#ded8cb] py-2 z-50 animate-in fade-in zoom-in-95">
              {/* User Identity Info */}
              <div className="px-4 py-3 border-b border-[#f0ece1]">
                <p className="text-xs font-bold text-[#1c2120]">{currentUser?.fullName}</p>
                <p className="text-[11px] text-[#707976] truncate mt-0.5">{currentUser?.email}</p>
                <div className="mt-2 flex items-center gap-1.5">
                  <span className={`text-[10px] px-2 py-0.5 rounded-full border font-semibold ${currentBadge.colorClass}`}>
                    {currentBadge.label}
                  </span>
                </div>
              </div>

              {/* Menu Actions */}
              <div className="p-1.5 space-y-1">
                <button
                  onClick={handleChangePassword}
                  className="w-full text-left px-3 py-2 rounded-xl text-xs text-[#2a3230] hover:bg-[#faf7f0] flex items-center gap-2.5 transition-colors cursor-pointer font-medium"
                >
                  <KeyRound className="w-4 h-4 text-[#CAA05C]" />
                  <span>Change Password</span>
                </button>

                <div className="border-t border-[#f0ece1] my-1" />

                <button
                  onClick={handleLogout}
                  className="w-full text-left px-3 py-2 rounded-xl text-xs text-red-600 hover:bg-red-50 flex items-center gap-2.5 transition-colors cursor-pointer font-semibold"
                >
                  <LogOut className="w-4 h-4 text-red-500" />
                  <span>Sign Out</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

