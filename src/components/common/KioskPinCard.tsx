import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Check,
  Copy,
  Eye,
  EyeOff,
  KeyRound,
  Lock,
  ShieldAlert,
  ShieldCheck,
  UserCheck,
} from 'lucide-react';
import { User } from '../../types';
import { db } from '../../db/database';

interface KioskPinCardProps {
  currentUser: User;
  className?: string;
  onNavigate?: (tab: string) => void;
}

export const KioskPinCard: React.FC<KioskPinCardProps> = ({
  currentUser,
  className = '',
  onNavigate,
}) => {
  const navigate = useNavigate();
  const [showPin, setShowPin] = useState(false);
  const [copied, setCopied] = useState(false);

  // Read the live user object from database to ensure fresh PIN
  const freshUser = db.getUserById(currentUser.id) || currentUser;
  const pin = freshUser.pinCode || '----';

  const isSuperOrHrAdmin = currentUser.role === 'super_admin' || currentUser.role === 'hr_admin';

  const handleCopy = () => {
    if (!freshUser.pinCode) return;
    navigator.clipboard.writeText(freshUser.pinCode).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleGoToDirectory = () => {
    if (onNavigate) {
      onNavigate('employees');
    } else {
      navigate('/employees');
    }
  };

  return (
    <div
      className={`bg-white rounded-2xl p-6 border border-[#e8e4da] shadow-xs flex flex-col justify-between ${className}`}
    >
      <div>
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-[#f0ece1]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#CAA05C] text-[#171c1b] flex items-center justify-center font-bold shadow-xs">
              <KeyRound className="w-4 h-4 text-[#171c1b]" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-[#1c2120]">Your Kiosk Attendance PIN</h3>
              <p className="text-[11px] text-[#76807c]">Office terminal check-in security code</p>
            </div>
          </div>

          <span className="text-[10px] font-bold uppercase tracking-wider text-[#8f6927] bg-[#f7efe0] border border-[#ebd8b7] px-2 py-0.5 rounded-full flex items-center gap-1">
            <Lock className="w-2.5 h-2.5 text-[#CAA05C]" />
            Admin Managed
          </span>
        </div>

        {/* PIN Box Display */}
        <div className="mt-4 p-4 rounded-xl bg-[#faf9f5] border border-[#ece7dc] text-center">
          <p className="text-[11px] text-[#717b77] mb-2 font-medium">
            Personal 4-Digit Attendance PIN
          </p>

          <div className="flex items-center justify-center gap-2.5 my-2">
            {[0, 1, 2, 3].map((idx) => {
              const char = pin[idx] || '•';
              return (
                <div
                  key={idx}
                  className="w-11 h-12 rounded-xl bg-white border-2 border-[#ded8cb] flex items-center justify-center shadow-xs"
                >
                  <span
                    className={`font-mono text-xl font-bold ${
                      showPin ? 'text-[#1c2120]' : 'text-[#CAA05C] text-2xl leading-none'
                    }`}
                  >
                    {showPin ? char : '•'}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Action buttons (Show/Hide, Copy) */}
          <div className="flex items-center justify-center gap-2 mt-3">
            <button
              onClick={() => setShowPin(!showPin)}
              className="px-3 py-1.5 rounded-lg bg-white border border-[#ded8cb] hover:bg-[#f4f1ea] text-[11px] font-semibold text-[#1c2120] flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              {showPin ? (
                <>
                  <EyeOff className="w-3.5 h-3.5 text-[#717b77]" />
                  <span>Hide PIN</span>
                </>
              ) : (
                <>
                  <Eye className="w-3.5 h-3.5 text-[#CAA05C]" />
                  <span>Show PIN</span>
                </>
              )}
            </button>

            <button
              onClick={handleCopy}
              className="px-3 py-1.5 rounded-lg bg-white border border-[#ded8cb] hover:bg-[#f4f1ea] text-[11px] font-semibold text-[#1c2120] flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Copy PIN"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="text-emerald-700 font-bold">Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-[#717b77]" />
                  <span>Copy</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Security Rule Explanation */}
        <div className="mt-3.5 p-3 rounded-xl bg-[#fdfaf3] border border-[#f3e7ce] text-[11px] text-[#6d5b38] space-y-1">
          <div className="flex items-center gap-1.5 font-bold text-[#8f6927]">
            <ShieldCheck className="w-3.5 h-3.5 text-[#CAA05C]" />
            <span>PIN Policy (শুধুমাত্র অ্যাডমিন পরিবর্তন করতে পারবেন)</span>
          </div>
          <p className="leading-relaxed text-[11px] text-[#7a6a48]">
            For attendance integrity, employees cannot edit their own PIN. Only a Studio Matra Administrator can change or reset your PIN.
          </p>
        </div>
      </div>

      {/* Footer CTA for Admins vs Regular Employees */}
      <div className="mt-4 pt-3 border-t border-[#f0ece1]">
        {isSuperOrHrAdmin ? (
          <button
            onClick={handleGoToDirectory}
            className="w-full py-2 px-3 rounded-xl bg-[#CAA05C] hover:bg-[#ba904c] text-[#171c1b] font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
          >
            <span>Manage Staff PINs in Studio Directory →</span>
          </button>
        ) : (
          <p className="text-[10px] text-center text-[#8d9692]">
            Need a new PIN? Please contact your HR Manager or Studio Administrator.
          </p>
        )}
      </div>
    </div>
  );
};

