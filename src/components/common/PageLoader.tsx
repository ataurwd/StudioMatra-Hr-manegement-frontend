import React from 'react';

export const PageLoader: React.FC = () => {
  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] p-8 text-center animate-pulse">
      <div className="w-14 h-14 rounded-2xl bg-white border border-[#CAA05C]/40 p-2 flex items-center justify-center mb-4 shadow-sm">
        <img src="/logo.png" alt="Studio Matra Logo" className="w-full h-full object-contain" />
      </div>
      <p className="text-sm font-bold text-[#1c2120]">Loading Studio Matra...</p>
      <p className="text-xs text-[#CAA05C] mt-1 font-mono font-semibold">Synchronizing state & database</p>
    </div>
  );
};

