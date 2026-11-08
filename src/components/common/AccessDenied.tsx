import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldAlert, ArrowLeft, Home } from 'lucide-react';
import { RoleName } from '../../types';
import { getRoleBadge } from '../../utils/permissions';

interface AccessDeniedProps {
  currentRole: RoleName;
  message?: string;
}

export const AccessDenied: React.FC<AccessDeniedProps> = ({
  currentRole,
  message = "You don't have the required administrative or departmental permissions to access this page.",
}) => {
  const navigate = useNavigate();
  const roleBadge = getRoleBadge(currentRole);

  return (
    <div className="max-w-2xl mx-auto my-12 p-8 bg-white border border-[#e8e4db] rounded-2xl shadow-sm text-center">
      <div className="w-14 h-14 mx-auto rounded-2xl bg-amber-50 border border-amber-200 text-amber-700 flex items-center justify-center mb-4">
        <ShieldAlert className="w-7 h-7" />
      </div>

      <span className="text-xs font-mono uppercase tracking-widest text-amber-700 bg-amber-100/60 px-2.5 py-1 rounded-full font-semibold">
        403 — Unauthorized Access
      </span>

      <h1 className="text-xl font-bold text-[#1c2120] mt-4 mb-2 font-serif">
        Restricted Studio Module
      </h1>

      <p className="text-sm text-[#5f6965] mb-6 max-w-md mx-auto leading-relaxed">
        {message}
      </p>

      <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#faf8f4] border border-[#e8e3d8] text-xs text-[#525d59] mb-8">
        <span>Your current active role:</span>
        <span className={`px-2 py-0.5 rounded text-[11px] font-semibold border ${roleBadge.colorClass}`}>
          {roleBadge.label}
        </span>
      </div>

      <div className="flex items-center justify-center gap-3">
        <button
          onClick={() => navigate(-1)}
          className="px-4 py-2.5 rounded-xl border border-[#dcd7cb] bg-white hover:bg-[#f6f3eb] text-xs font-semibold text-[#2c3532] flex items-center gap-2 transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Go Back</span>
        </button>
        <button
          onClick={() => navigate('/')}
          className="px-4 py-2.5 rounded-xl bg-[#CAA05C] hover:bg-[#ba904c] text-xs font-bold text-[#171c1b] flex items-center gap-2 transition-colors cursor-pointer shadow-xs"
        >
          <Home className="w-4 h-4 text-[#171c1b]" />
          <span>Return to Dashboard</span>
        </button>
      </div>
    </div>
  );
};

