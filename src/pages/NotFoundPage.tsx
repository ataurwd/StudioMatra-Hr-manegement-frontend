import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Home, ArrowLeft } from 'lucide-react';

export const NotFoundPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="max-w-xl mx-auto my-16 p-8 bg-white border border-[#e8e4db] rounded-2xl shadow-sm text-center">
      <div className="w-16 h-16 mx-auto rounded-2xl bg-white border border-[#CAA05C]/50 p-2 flex items-center justify-center mb-5 shadow-xs">
        <img src="/logo.png" alt="Studio Matra Logo" className="w-full h-full object-contain" />
      </div>

      <span className="text-xs font-mono uppercase tracking-widest text-[#8f6927] bg-[#f7efe0] border border-[#ebd8b7] px-3 py-1 rounded-full font-bold">
        404 — Blueprint Not Found
      </span>

      <h1 className="text-2xl font-bold text-[#1c2120] mt-4 mb-2 font-serif">
        Page Does Not Exist
      </h1>

      <p className="text-sm text-[#5f6965] mb-8 max-w-sm mx-auto leading-relaxed">
        The studio space or resource URL you are trying to visit is not charted in the Studio Matra blueprint.
      </p>

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
          <span>Studio Dashboard</span>
        </button>
      </div>
    </div>
  );
};

export default NotFoundPage;

