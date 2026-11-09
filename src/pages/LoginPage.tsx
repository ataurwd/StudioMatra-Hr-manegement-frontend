import React, { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  ArrowRight,
  Eye,
  EyeOff,
  Lock,
  Mail,
  ShieldCheck,
} from 'lucide-react';
import { useAppContext } from '../context/AppContext';

export const LoginPage: React.FC = () => {
  const { isAuthenticated, login } = useAppContext();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // If already authenticated, redirect to root dashboard
  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setIsLoading(true);

    try {
      await login(email, password);
      navigate('/', { replace: true });
    } catch (err: any) {
      setErrorMessage(err.message || 'Login failed. Please check your credentials.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#171c1b] text-[#eae7e1] flex flex-col justify-center items-center p-4 selection:bg-[#1b4332] selection:text-white font-sans">
      {/* Background Architectural Grid Pattern */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#1f2624_1px,transparent_1px),linear-gradient(to_bottom,#1f2624_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)] opacity-40 pointer-events-none" />

      <div className="max-w-md w-full relative z-10">
        {/* Brand Header */}
        <div className="text-center mb-8">
          <div
            className="w-20 h-20 mx-auto rounded-3xl bg-white p-2.5 flex items-center justify-center border-2 border-[#CAA05C]/50 shadow-2xl mb-4 overflow-hidden"
            style={{ width: 80, height: 80, minWidth: 80, minHeight: 80, maxWidth: 80, maxHeight: 80 }}
          >
            <img
              src="/logo.png"
              alt="Studio Matra Logo"
              width={64}
              height={64}
              className="w-full h-full object-contain"
              style={{ maxWidth: 64, maxHeight: 64, width: '100%', height: '100%' }}
            />
          </div>
          <h1 className="text-2xl font-serif font-bold text-white tracking-wider">
            STUDIO MATRA
          </h1>
          <p className="text-xs uppercase tracking-widest text-[#CAA05C] font-semibold mt-1">
            Interior Architecture & HR Portal
          </p>
        </div>

        {/* Login Card */}
        <div className="bg-[#1e2422] border border-[#2b3532] rounded-3xl p-7 sm:p-8 shadow-2xl backdrop-blur-md">
          <div className="mb-6 pb-4 border-b border-[#2b3532]">
            <h2 className="text-lg font-bold text-white font-serif">Staff Sign In</h2>
            <p className="text-xs text-[#95a39e] mt-1">
              Enter your corporate credentials to access your dashboard
            </p>
          </div>

          {errorMessage && (
            <div className="mb-5 p-3.5 bg-red-950/50 border border-red-800/80 rounded-xl text-red-200 text-xs flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4 text-xs">
            <div>
              <label className="block text-xs font-semibold text-[#c8d4cf] mb-1.5">
                Work Email Address
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 absolute left-3.5 top-3 text-[#70807a]" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="e.g. nahid@studiomatra.com.bd"
                  className="w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-[#171c1b] border border-[#2f3b38] text-white placeholder-[#5d6c66] focus:outline-none focus:border-[#CAA05C] transition-colors"
                  required
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-[#c8d4cf]">Account Password</label>
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 absolute left-3.5 top-3 text-[#70807a]" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="w-full pl-10 pr-10 py-2.5 rounded-xl bg-[#171c1b] border border-[#2f3b38] text-white placeholder-[#5d6c66] focus:outline-none focus:border-[#CAA05C] transition-colors font-mono"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-3 text-[#70807a] hover:text-white transition-colors cursor-pointer"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full mt-2 py-3 px-4 rounded-xl bg-[#CAA05C] hover:bg-[#ba904c] active:bg-[#a67e3a] text-[#171c1b] font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-lg disabled:opacity-50"
            >
              <span>{isLoading ? 'Verifying Credentials...' : 'Sign In to Portal'}</span>
              <ArrowRight className="w-4 h-4 text-[#171c1b]" />
            </button>
          </form>

          {/* Secure System Notice: NO PUBLIC REGISTRATION */}
          <div className="mt-6 pt-4 border-t border-[#2b3532] text-center">
            <p className="text-[11px] text-[#71807a] flex items-center justify-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-[#CAA05C]" />
              <span>Accounts are provisioned exclusively by Studio Matra HR.</span>
            </p>
          </div>
        </div>

        {/* Footer info */}
        <div className="mt-6 text-center text-[10px] text-[#55635e]">
          STUDIO MATRA Architecture & Design • Asia/Dhaka (GMT+6)
        </div>
      </div>
    </div>
  );
};

export default LoginPage;

