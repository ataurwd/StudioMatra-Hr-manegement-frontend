import React, { useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  Check,
  Delete,
  Keyboard,
  LogIn,
  LogOut,
  ShieldAlert,
  ShieldCheck,
  UserCheck,
  X,
} from 'lucide-react';
import { db } from '../db/database';
import { AttendanceSession, Employee } from '../types';
import { formatMinutes } from '../utils/attendanceCalculator';
import { useAppContext } from '../context/AppContext';
import { apiCheckIn, apiCheckOut, syncWithBackend } from '../services/apiService';

interface KioskModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const KioskModal: React.FC<KioskModalProps> = ({ isOpen, onClose }) => {
  const { currentUser } = useAppContext();
  const [, setDbTick] = useState(0);
  useEffect(() => {
    return db.subscribe(() => setDbTick((t) => t + 1));
  }, []);

  const [pin, setPin] = useState('');
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [activeSession, setActiveSession] = useState<AttendanceSession | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [successResult, setSuccessResult] = useState<{
    action: 'check_in' | 'check_out';
    name: string;
    time: string;
    status: string;
    details: string;
  } | null>(null);

  const [dhakaTime, setDhakaTime] = useState('');
  const hiddenInputRef = useRef<HTMLInputElement | null>(null);

  // Reset state when modal opens or closes
  useEffect(() => {
    if (!isOpen) {
      setPin('');
      setSelectedEmployee(null);
      setActiveSession(null);
      setErrorMessage('');
      setSuccessResult(null);
    } else {
      // Auto focus input for immediate keyboard typing
      setTimeout(() => {
        hiddenInputRef.current?.focus();
      }, 100);
    }
  }, [isOpen]);

  // Live Authoritative Dhaka Clock
  useEffect(() => {
    const update = () => {
      const now = new Date();
      setDhakaTime(
        now.toLocaleTimeString('en-US', {
          timeZone: 'Asia/Dhaka',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: true,
        })
      );
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, []);

  // When employee is authenticated, check today's session
  useEffect(() => {
    if (selectedEmployee) {
      const active = db.getActiveSession(selectedEmployee.id);
      setActiveSession(active || null);
    } else {
      setActiveSession(null);
    }
  }, [selectedEmployee]);

  // Handle PIN input digit
  const handlePinDigit = (digit: string) => {
    let newPin = pin;
    if (newPin.length >= 4) {
      newPin = digit;
    } else {
      newPin = newPin + digit;
    }
    setPin(newPin);
    setErrorMessage('');

    if (newPin.length === 4) {
      authenticatePin(newPin);
    }
  };

  const authenticatePin = (pinCode: string) => {
    const users = db.getUsers();
    const matchedUser = users.find((u) => u.pinCode === pinCode);

    if (!matchedUser || !matchedUser.employeeId) {
      setErrorMessage('Invalid 4-digit PIN. Please enter your valid security PIN.');
      setPin('');
      return;
    }

    // Security & Anti-Proxy Attendance Check:
    // Whichever user is logged in, they can ONLY give their own attendance!
    // Never expose whose PIN it was, just strictly alert that proxy attendance is prohibited.
    if (currentUser) {
      const freshCurrent = db.getUserById(currentUser.id) || currentUser;
      const isOwnPin =
        (freshCurrent.pinCode && freshCurrent.pinCode === pinCode) ||
        (matchedUser && (
          matchedUser.id === freshCurrent.id ||
          (matchedUser.employeeId && freshCurrent.employeeId && matchedUser.employeeId === freshCurrent.employeeId) ||
          matchedUser.email.toLowerCase() === freshCurrent.email.toLowerCase()
        ));

      if (!isOwnPin) {
        setErrorMessage(
          'Security Alert: You can only record your own attendance. Giving attendance for someone else is strictly prohibited! (অন্যের attendance দেওয়া যাবে না)'
        );
        setPin('');

        try {
          db.logAudit(
            { userId: currentUser.id, name: currentUser.fullName },
            {
              targetType: 'attendance',
              targetId: currentUser.id,
              action: 'PROXY_ATTENDANCE_ATTEMPT_BLOCKED',
              details: `Attempted to punch attendance with a PIN not belonging to user account (${currentUser.fullName})`,
            }
          );
        } catch {}
        return;
      }
    }

    const emp = db.getEmployeeById(matchedUser.employeeId);
    if (emp) {
      setSelectedEmployee(emp);
      setErrorMessage('');
    } else {
      setErrorMessage('Employee record not found for this PIN');
      setPin('');
    }
  };

  const handleClearPin = () => {
    setPin('');
    setSelectedEmployee(null);
    setErrorMessage('');
    setTimeout(() => {
      hiddenInputRef.current?.focus();
    }, 50);
  };

  // Keyboard Event Listener
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // If success screen is open, Enter, Space, or Escape dismisses it
      if (successResult) {
        if (e.key === 'Enter' || e.key === 'Escape' || e.key === ' ') {
          e.preventDefault();
          handleClearPin();
          setSuccessResult(null);
        }
        return;
      }

      // If employee is selected (action screen)
      if (selectedEmployee) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          if (!activeSession) {
            handleKioskCheckIn();
          } else {
            handleKioskCheckOut();
          }
        } else if (e.key === 'Escape' || e.key === 'Backspace') {
          e.preventDefault();
          handleClearPin();
        }
        return;
      }

      // PIN Input Screen Keyboard Handling
      if (/^[0-9]$/.test(e.key)) {
        e.preventDefault();
        handlePinDigit(e.key);
      } else if (e.key === 'Backspace') {
        e.preventDefault();
        setPin((prev) => {
          const next = prev.slice(0, -1);
          setErrorMessage('');
          return next;
        });
      } else if (e.key === 'Escape') {
        e.preventDefault();
        if (pin.length > 0) {
          handleClearPin();
        } else {
          onClose();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, pin, selectedEmployee, activeSession, successResult]);

  const handleKioskCheckIn = async () => {
    if (!selectedEmployee) return;
    try {
      const apiRes = await apiCheckIn(selectedEmployee.id, 'kiosk');
      if (!apiRes.success || !apiRes.session) {
        await syncWithBackend().catch(() => {});
        setErrorMessage(apiRes.error || 'Failed to record kiosk check-in in database.');
        return;
      }

      const session = apiRes.session;
      db.upsertAttendanceSession(session);
      await syncWithBackend().catch(() => {});

      setSuccessResult({
        action: 'check_in',
        name: selectedEmployee.fullName,
        time: new Date(session.checkInAt).toLocaleTimeString('en-US', { timeZone: 'Asia/Dhaka' }),
        status: session.computedStatus,
        details: session.lateMinutes > 0 ? `Late arrival: ${session.lateMinutes} minutes past shift grace` : 'On Time Check-In Verified',
      });

      // Auto reset after 4 seconds
      setTimeout(() => {
        handleClearPin();
        setSuccessResult(null);
      }, 4000);
    } catch (err: any) {
      setErrorMessage(err.message || 'Check-in failed');
    }
  };

  const handleKioskCheckOut = async () => {
    if (!selectedEmployee) return;
    try {
      const apiRes = await apiCheckOut(selectedEmployee.id, 'kiosk');
      if (!apiRes.success || !apiRes.session) {
        await syncWithBackend().catch(() => {});
        setErrorMessage(apiRes.error || 'Failed to record kiosk check-out in database.');
        return;
      }

      const session = apiRes.session;
      db.upsertAttendanceSession(session);
      await syncWithBackend().catch(() => {});

      setSuccessResult({
        action: 'check_out',
        name: selectedEmployee.fullName,
        time: new Date(session.checkOutAt!).toLocaleTimeString('en-US', { timeZone: 'Asia/Dhaka' }),
        status: session.computedStatus,
        details: `Total Worked: ${formatMinutes(session.workedMinutes)} (Break deducted: ${session.breakMinutes}m)`,
      });

      setTimeout(() => {
        handleClearPin();
        setSuccessResult(null);
      }, 4000);
    } catch (err: any) {
      setErrorMessage(err.message || 'Check-out failed');
    }
  };

  if (!isOpen) return null;

  return (
    <div
      onClick={() => hiddenInputRef.current?.focus()}
      className="fixed inset-0 z-50 bg-[#121615] flex flex-col justify-between text-white p-6 sm:p-10 select-none overflow-y-auto"
    >
      {/* Hidden input for mobile virtual keyboards and accessibility */}
      <input
        ref={hiddenInputRef}
        type="password"
        inputMode="numeric"
        pattern="[0-9]*"
        maxLength={4}
        value={pin}
        onChange={(e) => {
          const val = e.target.value.replace(/\D/g, '').slice(0, 4);
          setPin(val);
          setErrorMessage('');
          if (val.length === 4) {
            authenticatePin(val);
          }
        }}
        className="sr-only opacity-0 absolute pointer-events-none"
        aria-label="Enter 4-digit PIN"
      />

      {/* Top Bar */}
      <div className="flex items-center justify-between border-b border-[#242c2a] pb-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-white p-2 flex items-center justify-center border border-[#CAA05C]/50 shadow-md">
            <img src="/logo.png" alt="Studio Matra Logo" className="w-full h-full object-contain" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-serif font-bold tracking-wide">STUDIO MATRA</h1>
            <p className="text-xs uppercase tracking-widest text-[#CAA05C] font-semibold">
              Office Attendance Terminal • Terminal #1 (Banani Studio)
            </p>
          </div>
        </div>

        <div className="flex items-center gap-6">
          <div className="text-right hidden sm:block">
            <p className="font-mono text-2xl font-bold text-[#CAA05C]">{dhakaTime}</p>
            <p className="text-xs text-[#879691]">Asia/Dhaka Time (Authoritative)</p>
          </div>
          <button
            onClick={onClose}
            className="p-3 rounded-xl bg-[#1e2523] hover:bg-[#28322f] text-[#a4b3ae] hover:text-white transition-colors cursor-pointer"
            aria-label="Exit Kiosk"
          >
            <X className="w-6 h-6" />
          </button>
        </div>
      </div>

      {/* Main Kiosk Area */}
      <div className="flex-1 flex items-center justify-center py-8">
        {successResult ? (
          /* Success Screen */
          <div className="max-w-md w-full bg-[#1b2220] border-2 border-[#CAA05C] rounded-2xl p-8 text-center shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="w-20 h-20 rounded-full bg-[#CAA05C] text-[#171c1b] flex items-center justify-center mx-auto mb-5 shadow-lg">
              <Check className="w-10 h-10" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-1">
              {successResult.action === 'check_in' ? 'Check-In Recorded!' : 'Check-Out Recorded!'}
            </h2>
            <p className="text-lg text-[#b8c9c3] font-medium">{successResult.name}</p>
            <div className="my-6 p-4 bg-[#141a18] rounded-xl border border-[#242d2a] space-y-1.5 text-sm">
              <div className="flex justify-between">
                <span className="text-[#7d8b86]">Timestamp:</span>
                <span className="font-mono font-semibold text-white">{successResult.time}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#7d8b86]">Status:</span>
                <span className="capitalize font-bold text-[#52b788]">{successResult.status}</span>
              </div>
              <div className="flex justify-between pt-1 border-t border-[#242d2a]">
                <span className="text-[#7d8b86]">Details:</span>
                <span className="text-stone-300 font-medium">{successResult.details}</span>
              </div>
            </div>
            <p className="text-xs text-[#71807b]">Terminal will automatically reset in 4 seconds...</p>
            <button
              onClick={() => {
                handleClearPin();
                setSuccessResult(null);
              }}
              className="mt-4 px-6 py-2 bg-[#232b29] hover:bg-[#2e3734] rounded-lg text-xs font-semibold text-white cursor-pointer"
            >
              Done / Next Employee
            </button>
          </div>
        ) : !selectedEmployee ? (
          /* Masked Confidential Authentication Screen */
          <div className="max-w-lg w-full bg-[#181f1d] border border-[#26302d] rounded-2xl p-6 sm:p-8 shadow-2xl">
            <div className="text-center mb-6">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#242d2a] border border-[#2f3b37] text-xs text-[#CAA05C] mb-2">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Masked Confidential PIN Entry</span>
              </div>

              {currentUser && (
                <div className="flex items-center justify-center gap-1.5 text-xs text-[#879691] mb-2 bg-[#121615] py-1 px-3 rounded-md border border-[#242c2a] max-w-fit mx-auto">
                  <UserCheck className="w-3.5 h-3.5 text-[#CAA05C]" />
                  <span>Logged in as: <strong className="text-white">{currentUser.fullName}</strong></span>
                </div>
              )}

              <h2 className="text-xl font-bold text-white">Enter Your 4-Digit Security PIN</h2>
              <p className="text-xs text-[#879691] mt-1">
                Type directly on your keyboard or tap the keypad below
              </p>
            </div>

            {/* Completely Masked PIN Display Dots */}
            <div className="flex justify-center items-center gap-4 mb-6" aria-label="Masked PIN">
              {[0, 1, 2, 3].map((idx) => (
                <div
                  key={idx}
                  className={`w-5 h-5 rounded-full border-2 transition-all flex items-center justify-center ${
                    idx < pin.length
                      ? 'bg-[#CAA05C] border-[#CAA05C] scale-110 shadow-[0_0_12px_rgba(202,160,92,0.4)]'
                      : 'border-[#3a4743] bg-[#121615]'
                  }`}
                >
                  {idx < pin.length && (
                    <span className="w-2 h-2 rounded-full bg-[#171c1b]" />
                  )}
                </div>
              ))}
            </div>

            {/* High Priority Security Alert Banner */}
            {errorMessage && (
              <div className="mb-5 p-3.5 rounded-xl bg-red-950/80 border border-red-600 text-red-200 text-xs flex items-start gap-3 shadow-xl animate-in fade-in slide-in-from-top-2">
                <ShieldAlert className="w-5 h-5 shrink-0 text-red-400 mt-0.5" />
                <div className="flex-1">
                  <p className="font-bold text-red-300 mb-0.5">Security Alert / সতর্কতা:</p>
                  <p className="leading-relaxed">{errorMessage}</p>
                </div>
              </div>
            )}

            {/* Touch Keypad */}
            <div className="grid grid-cols-3 gap-3 max-w-xs mx-auto mb-5">
              {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
                <button
                  key={digit}
                  onClick={() => handlePinDigit(digit)}
                  className="h-14 rounded-xl bg-[#212927] hover:bg-[#2c3734] active:bg-[#CAA05C] active:text-[#171c1b] text-xl font-bold text-white border border-[#2d3835] transition-all cursor-pointer shadow-xs active:scale-95"
                >
                  {digit}
                </button>
              ))}
              <button
                onClick={handleClearPin}
                className="h-14 rounded-xl bg-[#212927] hover:bg-[#2c3734] text-xs font-semibold text-[#879691] border border-[#2d3835] transition-all cursor-pointer active:scale-95"
              >
                CLEAR
              </button>
              <button
                onClick={() => handlePinDigit('0')}
                className="h-14 rounded-xl bg-[#212927] hover:bg-[#2c3734] active:bg-[#CAA05C] active:text-[#171c1b] text-xl font-bold text-white border border-[#2d3835] transition-all cursor-pointer shadow-xs active:scale-95"
              >
                0
              </button>
              <button
                onClick={() => {
                  setPin((p) => p.slice(0, -1));
                  setErrorMessage('');
                }}
                className="h-14 rounded-xl bg-[#212927] hover:bg-[#2c3734] text-white flex items-center justify-center border border-[#2d3835] transition-all cursor-pointer active:scale-95"
                aria-label="Backspace"
              >
                <Delete className="w-5 h-5 text-[#879691]" />
              </button>
            </div>

            {/* Keyboard Support Indicator Notice */}
            <div className="mt-4 pt-3 border-t border-[#26302d] flex items-center justify-center gap-2 text-xs text-[#71807b]">
              <Keyboard className="w-4 h-4 text-[#CAA05C]" />
              <span>Physical keyboard input enabled (press 0-9, Backspace, Esc)</span>
            </div>
          </div>
        ) : (
          /* Action Screen for Authenticated Employee */
          <div className="max-w-lg w-full bg-[#181f1d] border border-[#26302d] rounded-2xl p-6 sm:p-8 shadow-2xl">
            <div className="flex items-center gap-4 mb-6 pb-6 border-b border-[#26302d]">
              <div className="w-16 h-16 rounded-2xl bg-[#CAA05C]/20 border-2 border-[#CAA05C]/40 text-[#CAA05C] text-2xl font-bold flex items-center justify-center">
                {selectedEmployee.fullName.charAt(0)}
              </div>
              <div className="min-w-0 flex-1">
                <span className="text-[10px] uppercase font-bold tracking-wider text-[#171c1b] bg-[#CAA05C] px-2 py-0.5 rounded">
                  {selectedEmployee.employeeCode}
                </span>
                <h3 className="text-xl font-bold text-white mt-1 truncate">{selectedEmployee.fullName}</h3>
                {(() => {
                  const empShift = db.getShifts().find((s) => s.id === selectedEmployee.shiftId) || db.getShifts()[0];
                  return (
                    <p className="text-xs text-[#879691]">
                      Shift: {empShift?.name || 'Studio General'} ({empShift?.startTime || '10:15'} - {empShift?.endTime || '19:30'})
                    </p>
                  );
                })()}
              </div>
            </div>

            {/* Current State Info */}
            <div className="mb-6 p-4 bg-[#131816] rounded-xl border border-[#242e2b]">
              <div className="flex items-center justify-between text-xs">
                <span className="text-[#879691]">Current Attendance State:</span>
                {activeSession ? (
                  <span className="px-2.5 py-1 rounded-full bg-[#CAA05C]/20 text-[#CAA05C] font-bold border border-[#CAA05C]/40 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-[#CAA05C] animate-pulse" />
                    Currently In Session
                  </span>
                ) : (
                  <span className="px-2.5 py-1 rounded-full bg-[#2d3835] text-[#b0bfba] font-medium border border-[#3b4744]">
                    Not Checked In Today
                  </span>
                )}
              </div>

              {activeSession && (
                <div className="mt-3 pt-3 border-t border-[#202927] text-xs flex justify-between">
                  <span className="text-[#879691]">Checked In At:</span>
                  <span className="font-mono text-white font-semibold">
                    {new Date(activeSession.checkInAt).toLocaleTimeString('en-US', { timeZone: 'Asia/Dhaka' })}
                  </span>
                </div>
              )}
            </div>

            {errorMessage && (
              <div className="mb-4 p-3 rounded-lg bg-red-950/40 border border-red-800 text-red-300 text-xs">
                {errorMessage}
              </div>
            )}

            {/* Big Action Buttons */}
            {!activeSession ? (
              <button
                onClick={handleKioskCheckIn}
                className="w-full py-4 rounded-xl bg-[#1b4332] hover:bg-[#245b44] active:bg-[#2d6a4f] text-white font-bold text-lg flex items-center justify-center gap-3 border border-[#40916c] transition-all cursor-pointer shadow-lg active:scale-98"
              >
                <LogIn className="w-6 h-6 text-[#52b788]" />
                <span>CHECK IN NOW (Press Enter)</span>
              </button>
            ) : (
              <button
                onClick={handleKioskCheckOut}
                className="w-full py-4 rounded-xl bg-[#854d0e] hover:bg-[#a16207] active:bg-[#ca8a04] text-white font-bold text-lg flex items-center justify-center gap-3 border border-[#ca8a04] transition-all cursor-pointer shadow-lg active:scale-98"
              >
                <LogOut className="w-6 h-6 text-amber-300" />
                <span>CHECK OUT NOW (Press Enter)</span>
              </button>
            )}

            <div className="mt-6 flex justify-between items-center pt-4 border-t border-[#26302d]">
              <button
                onClick={handleClearPin}
                className="text-xs text-[#879691] hover:text-white transition-colors cursor-pointer"
              >
                ← Switch Employee (Esc)
              </button>
              <span className="text-[11px] text-[#55635f]">Office Terminal Policy Enforced</span>
            </div>
          </div>
        )}
      </div>

      {/* Footer Security Notice */}
      <div className="text-center text-xs text-[#55635f] border-t border-[#242c2a] pt-4 flex flex-col sm:flex-row items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-[#52b788]" />
          <span>Office Kiosk Mode Active • Confidential Masked Verification</span>
        </div>
        <p>STUDIO MATRA Bangladesh • Anti-Proxy Verification Active</p>
      </div>
    </div>
  );
};
