import React, { useEffect, useState } from 'react';
import { Clock, AlertTriangle } from 'lucide-react';

interface SyncedCountdownProps {
  closesAt: string; // ISO string
  onExpire?: () => void;
  compact?: boolean;
}

export const SyncedCountdown: React.FC<SyncedCountdownProps> = ({ closesAt, onExpire, compact = false }) => {
  const [timeLeft, setTimeLeft] = useState<{
    totalMs: number;
    hours: number;
    minutes: number;
    seconds: number;
    isExpired: boolean;
  }>({
    totalMs: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
    isExpired: false,
  });

  useEffect(() => {
    const calculateTime = () => {
      const targetTime = new Date(closesAt).getTime();
      const now = Date.now();
      const diff = targetTime - now;

      if (diff <= 0) {
        setTimeLeft({
          totalMs: 0,
          hours: 0,
          minutes: 0,
          seconds: 0,
          isExpired: true,
        });
        if (onExpire) {
          onExpire();
        }
        return false;
      }

      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      setTimeLeft({
        totalMs: diff,
        hours,
        minutes,
        seconds,
        isExpired: false,
      });
      return true;
    };

    calculateTime();
    const interval = setInterval(() => {
      const active = calculateTime();
      if (!active) {
        clearInterval(interval);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [closesAt]);

  const isLowTime = timeLeft.totalMs > 0 && timeLeft.totalMs <= 2 * 60 * 1000; // < 2 mins

  if (timeLeft.isExpired) {
    return (
      <div id="countdown-expired" className={`inline-flex items-center gap-1.5 font-medium ${compact ? 'text-[11px] text-slate-400' : 'px-2.5 py-1 bg-slate-100 text-slate-600 rounded-lg text-xs'}`}>
        <Clock className="w-3.5 h-3.5" />
        <span>Bidding Closed</span>
      </div>
    );
  }

  const formattedHours = timeLeft.hours > 0 ? `${timeLeft.hours}h ` : '';
  const formattedMins = String(timeLeft.minutes).padStart(2, '0');
  const formattedSecs = String(timeLeft.seconds).padStart(2, '0');

  if (compact) {
    return (
      <span
        id="countdown-timer-compact"
        className={`inline-flex items-center gap-1 font-mono font-bold text-xs ${
          isLowTime ? 'text-rose-600 animate-pulse' : 'text-sky-700'
        }`}
      >
        <Clock className="w-3 h-3" />
        {formattedHours}{formattedMins}:{formattedSecs}
      </span>
    );
  }

  return (
    <div
      id="countdown-timer-box"
      className={`inline-flex items-center gap-2 px-2.5 py-1 rounded-lg border font-mono transition-colors ${
        isLowTime
          ? 'bg-rose-50 border-rose-200 text-rose-700 animate-pulse'
          : 'bg-sky-50 border-sky-200 text-sky-900'
      }`}
    >
      {isLowTime ? <AlertTriangle className="w-3.5 h-3.5 text-rose-600" /> : <Clock className="w-3.5 h-3.5 text-sky-600" />}
      <div className="flex flex-col">
        <span className="text-[10px] font-sans font-bold uppercase tracking-wider text-slate-500">
          {isLowTime ? 'Ending Soon' : 'Time Remaining'}
        </span>
        <span className="text-xs font-bold tracking-tight">
          {formattedHours}{formattedMins}:{formattedSecs}
        </span>
      </div>
    </div>
  );
};
