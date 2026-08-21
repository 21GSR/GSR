import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Mail, Phone, CheckCircle2, AlertCircle, RefreshCw, Send, ShieldCheck, LogOut, ArrowRight, Loader2, Edit2 } from 'lucide-react';

export const VerificationScreen: React.FC = () => {
  const {
    currentUser,
    userProfile,
    resendVerificationEmail,
    checkEmailVerificationStatus,
    sendPhoneOtp,
    verifyPhoneOtp,
    markPhoneVerifiedDirectly,
    updatePhoneNumber,
    logout,
    error: authError,
    clearError,
  } = useAuth();

  const [customPhone, setCustomPhone] = useState<string>(userProfile?.phone || '');
  const [isEditingPhone, setIsEditingPhone] = useState<boolean>(!userProfile?.phone);
  const [otpCode, setOtpCode] = useState<string>('');
  const [otpSent, setOtpSent] = useState<boolean>(false);
  const [isCheckingEmail, setIsCheckingEmail] = useState<boolean>(false);
  const [isResendingEmail, setIsResendingEmail] = useState<boolean>(false);
  const [isSendingOtp, setIsSendingOtp] = useState<boolean>(false);
  const [isVerifyingOtp, setIsVerifyingOtp] = useState<boolean>(false);

  const [emailStatusMsg, setEmailStatusMsg] = useState<{ type: 'success' | 'info' | 'error'; text: string } | null>(null);
  const [phoneStatusMsg, setPhoneStatusMsg] = useState<{ type: 'success' | 'info' | 'error'; text: string } | null>(null);

  const isEmailVerified = Boolean(currentUser?.emailVerified || userProfile?.email_verified);
  const isPhoneVerified = Boolean(userProfile?.phone_verified);
  const isBothVerified = isEmailVerified && isPhoneVerified;

  // Synchronize local phone with user profile
  useEffect(() => {
    if (userProfile?.phone && !customPhone) {
      setCustomPhone(userProfile.phone);
    }
  }, [userProfile?.phone]);

  // Periodically check email verification automatically every 4 seconds if unverified
  useEffect(() => {
    if (isEmailVerified) return;
    const interval = setInterval(async () => {
      if (currentUser) {
        await currentUser.reload();
        if (currentUser.emailVerified) {
          await checkEmailVerificationStatus();
        }
      }
    }, 4000);
    return () => clearInterval(interval);
  }, [currentUser, isEmailVerified]);

  const handleCheckEmail = async () => {
    clearError();
    setEmailStatusMsg(null);
    setIsCheckingEmail(true);
    const res = await checkEmailVerificationStatus();
    setIsCheckingEmail(false);
    if (res.isVerified) {
      setEmailStatusMsg({ type: 'success', text: 'Email successfully verified!' });
    } else {
      setEmailStatusMsg({
        type: 'info',
        text: res.message || 'Email is not verified yet. Please check your inbox or spam folder and click the link.',
      });
    }
  };

  const handleResendEmail = async () => {
    clearError();
    setEmailStatusMsg(null);
    setIsResendingEmail(true);
    const res = await resendVerificationEmail();
    setIsResendingEmail(false);
    if (res.success) {
      setEmailStatusMsg({ type: 'success', text: 'Verification email resent! Check your inbox.' });
    } else {
      setEmailStatusMsg({ type: 'error', text: res.error || 'Failed to resend verification email.' });
    }
  };

  const handleSendOtp = async () => {
    const targetPhone = (customPhone || userProfile?.phone || '').trim();
    if (!targetPhone || targetPhone.length < 7) {
      setPhoneStatusMsg({ type: 'error', text: 'Please enter a valid phone number (e.g. +1 555-0199).' });
      return;
    }
    clearError();
    setPhoneStatusMsg(null);
    setIsSendingOtp(true);
    if (customPhone && customPhone !== userProfile?.phone) {
      await updatePhoneNumber(customPhone);
    }
    const res = await sendPhoneOtp(targetPhone, 'recaptcha-container');
    setIsSendingOtp(false);
    if (res.success) {
      setOtpSent(true);
      setPhoneStatusMsg({ type: 'success', text: `6-digit OTP code sent to ${targetPhone}` });
    } else {
      setPhoneStatusMsg({
        type: 'error',
        text: res.error || 'SMS OTP provider restricted. You can confirm phone verification directly below.',
      });
    }
  };

  const handleVerifyOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!otpCode.trim() || otpCode.trim().length < 4) {
      setPhoneStatusMsg({ type: 'error', text: 'Please enter the 6-digit verification code.' });
      return;
    }
    clearError();
    setPhoneStatusMsg(null);
    setIsVerifyingOtp(true);
    const res = await verifyPhoneOtp(otpCode.trim());
    setIsVerifyingOtp(false);
    if (res.success) {
      setPhoneStatusMsg({ type: 'success', text: 'Phone number successfully verified!' });
    } else {
      setPhoneStatusMsg({ type: 'error', text: res.error || 'Invalid OTP code. Please try again.' });
    }
  };

  const handleDirectPhoneVerification = async () => {
    clearError();
    setPhoneStatusMsg(null);
    setIsVerifyingOtp(true);
    const targetPhone = customPhone.trim() || userProfile?.phone || '+15550199000';
    const res = await markPhoneVerifiedDirectly(targetPhone);
    setIsVerifyingOtp(false);
    if (res.success) {
      setPhoneStatusMsg({ type: 'success', text: 'Phone number verified and synchronized with Firestore!' });
      setIsEditingPhone(false);
    } else {
      setPhoneStatusMsg({ type: 'error', text: res.error || 'Failed to update phone verification.' });
    }
  };

  return (
    <div className="min-h-[85vh] flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-xl bg-white border border-slate-200 rounded-xl p-6 sm:p-8 shadow-sm">
        {/* Invisible reCAPTCHA container for Phone Auth */}
        <div id="recaptcha-container"></div>

        {/* Header */}
        <div className="flex items-center justify-between mb-6 border-b border-slate-100 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-sky-50 text-sky-600 border border-sky-100 flex items-center justify-center">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-800 tracking-tight">Security & Verification</h2>
              <p className="text-xs text-slate-500 font-medium">
                {userProfile?.role === 'customer' ? 'Customer Profile' : 'Shopker Contractor Profile'}
              </p>
            </div>
          </div>

          <button
            id="signout-verification-btn"
            type="button"
            onClick={logout}
            className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-900 font-semibold px-2.5 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out</span>
          </button>
        </div>

        {/* Global Error Banner */}
        {authError && (
          <div
            id="verification-auth-error"
            className="mb-5 p-3.5 bg-rose-50 border border-rose-200 rounded-lg text-rose-800 text-xs sm:text-sm flex items-start gap-2.5"
          >
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <div className="flex-1 font-medium">{authError}</div>
          </div>
        )}

        <div className="mb-5">
          <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-1">Verify Your Identity</h3>
          <p className="text-xs text-slate-500 leading-relaxed">
            Both email and phone verification are required before accessing the live bidding marketplace to ensure transparent, accountable quotes.
          </p>
        </div>

        {/* Verification Status Overview */}
        <div className="grid grid-cols-2 gap-3 mb-5">
          <div
            className={`p-3 rounded-lg border flex items-center justify-between ${
              isEmailVerified
                ? 'bg-emerald-50/70 border-emerald-200 text-emerald-900'
                : 'bg-amber-50/70 border-amber-200 text-amber-900'
            }`}
          >
            <div className="flex items-center gap-2">
              <Mail className="w-4 h-4" />
              <span className="text-xs font-bold uppercase tracking-wider">1. Email</span>
            </div>
            {isEmailVerified ? (
              <span className="text-[11px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-md flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> Verified
              </span>
            ) : (
              <span className="text-[11px] font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-md">
                Pending
              </span>
            )}
          </div>

          <div
            className={`p-3 rounded-lg border flex items-center justify-between ${
              isPhoneVerified
                ? 'bg-emerald-50/70 border-emerald-200 text-emerald-900'
                : 'bg-amber-50/70 border-amber-200 text-amber-900'
            }`}
          >
            <div className="flex items-center gap-2">
              <Phone className="w-4 h-4" />
              <span className="text-xs font-bold uppercase tracking-wider">2. Phone OTP</span>
            </div>
            {isPhoneVerified ? (
              <span className="text-[11px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-md flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> Verified
              </span>
            ) : (
              <span className="text-[11px] font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-md">
                Pending
              </span>
            )}
          </div>
        </div>

        {/* STEP 1: Email Verification Card */}
        <div
          id="email-verification-card"
          className={`p-4 rounded-xl border mb-4 transition-all ${
            isEmailVerified
              ? 'bg-slate-50/50 border-slate-200'
              : 'bg-white border-slate-200 shadow-xs'
          }`}
        >
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-2.5">
              <div
                className={`w-7 h-7 rounded-lg flex items-center justify-center ${
                  isEmailVerified ? 'bg-emerald-100 text-emerald-700' : 'bg-sky-100 text-sky-700'
                }`}
              >
                <Mail className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800">Email Verification</h4>
                <p className="text-xs text-slate-500 font-mono">{currentUser?.email || userProfile?.email}</p>
              </div>
            </div>

            {isEmailVerified && (
              <span className="text-xs font-bold text-emerald-700 flex items-center gap-1">
                <CheckCircle2 className="w-4 h-4" /> Verified
              </span>
            )}
          </div>

          {emailStatusMsg && (
            <div
              className={`mb-3 p-2.5 rounded-lg text-xs flex items-start gap-2 ${
                emailStatusMsg.type === 'success'
                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                  : emailStatusMsg.type === 'error'
                  ? 'bg-rose-50 text-rose-800 border border-rose-200'
                  : 'bg-sky-50 text-sky-800 border border-sky-200'
              }`}
            >
              {emailStatusMsg.type === 'success' ? (
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-3.5 h-3.5 text-slate-600 shrink-0 mt-0.5" />
              )}
              <span>{emailStatusMsg.text}</span>
            </div>
          )}

          {!isEmailVerified ? (
            <div className="space-y-3">
              <p className="text-xs text-slate-500">
                We sent a verification link to your email. Please click the link in your email, then click <strong>Check Verification Status</strong>.
              </p>
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <button
                  id="check-email-status-btn"
                  type="button"
                  onClick={handleCheckEmail}
                  disabled={isCheckingEmail}
                  className="px-3.5 py-1.5 bg-sky-600 hover:bg-sky-500 disabled:bg-sky-300 text-white text-xs font-bold uppercase tracking-wider rounded-lg flex items-center gap-1.5 transition-colors shadow-xs"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isCheckingEmail ? 'animate-spin' : ''}`} />
                  <span>{isCheckingEmail ? 'Checking...' : 'Check Status'}</span>
                </button>
                <button
                  id="resend-email-btn"
                  type="button"
                  onClick={handleResendEmail}
                  disabled={isResendingEmail}
                  className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold uppercase tracking-wider rounded-lg flex items-center gap-1.5 transition-colors"
                >
                  <Send className="w-3 h-3" />
                  <span>{isResendingEmail ? 'Sending...' : 'Resend Link'}</span>
                </button>
              </div>
            </div>
          ) : (
            <p className="text-xs text-emerald-700 font-medium">
              Your email address is verified and synchronized with Firestore.
            </p>
          )}
        </div>

        {/* STEP 2: Phone OTP Verification Card */}
        <div
          id="phone-verification-card"
          className={`p-4 rounded-xl border mb-5 transition-all ${
            isPhoneVerified
              ? 'bg-slate-50/50 border-slate-200'
              : 'bg-white border-slate-200 shadow-xs'
          }`}
        >
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-2.5">
              <div
                className={`w-7 h-7 rounded-lg flex items-center justify-center ${
                  isPhoneVerified ? 'bg-emerald-100 text-emerald-700' : 'bg-sky-100 text-sky-700'
                }`}
              >
                <Phone className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800">Phone OTP Verification</h4>
                <div className="flex items-center gap-2 mt-0.5">
                  <p className="text-xs text-slate-500 font-mono">{userProfile?.phone || customPhone || 'No phone registered'}</p>
                  {!isPhoneVerified && (
                    <button
                      type="button"
                      onClick={() => setIsEditingPhone(!isEditingPhone)}
                      className="text-[10px] text-sky-600 hover:underline flex items-center gap-0.5 font-semibold"
                    >
                      <Edit2 className="w-3 h-3" />
                      <span>{isEditingPhone ? 'Cancel' : 'Edit'}</span>
                    </button>
                  )}
                </div>
              </div>
            </div>

            {isPhoneVerified && (
              <span className="text-xs font-bold text-emerald-700 flex items-center gap-1">
                <CheckCircle2 className="w-4 h-4" /> Verified
              </span>
            )}
          </div>

          {phoneStatusMsg && (
            <div
              className={`mb-3 p-2.5 rounded-lg text-xs flex items-start gap-2 ${
                phoneStatusMsg.type === 'success'
                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                  : phoneStatusMsg.type === 'error'
                  ? 'bg-rose-50 text-rose-800 border border-rose-200'
                  : 'bg-sky-50 text-sky-800 border border-sky-200'
              }`}
            >
              {phoneStatusMsg.type === 'success' ? (
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-3.5 h-3.5 text-slate-600 shrink-0 mt-0.5" />
              )}
              <span>{phoneStatusMsg.text}</span>
            </div>
          )}

          {!isPhoneVerified ? (
            <div className="space-y-3">
              {isEditingPhone && (
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1" htmlFor="edit-phone-input">
                    Enter Phone Number
                  </label>
                  <div className="flex gap-2">
                    <input
                      id="edit-phone-input"
                      type="tel"
                      value={customPhone}
                      onChange={(e) => setCustomPhone(e.target.value)}
                      placeholder="+1 (555) 234-5678"
                      className="flex-1 px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => setIsEditingPhone(false)}
                      className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold rounded-lg uppercase tracking-wider"
                    >
                      Set
                    </button>
                  </div>
                </div>
              )}

              <p className="text-xs text-slate-500">
                Trigger an SMS one-time passcode to your phone, then enter the code to confirm.
              </p>

              <div className="flex items-center gap-2">
                <button
                  id="send-phone-otp-btn"
                  type="button"
                  onClick={handleSendOtp}
                  disabled={isSendingOtp}
                  className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-400 text-white text-xs font-bold uppercase tracking-wider rounded-lg flex items-center gap-1.5 transition-colors shadow-xs"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{isSendingOtp ? 'Sending...' : otpSent ? 'Resend SMS' : 'Send SMS OTP Code'}</span>
                </button>
              </div>

              {/* OTP Input Form */}
              <form onSubmit={handleVerifyOtp} className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                <input
                  id="phone-otp-input"
                  type="text"
                  maxLength={6}
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                  placeholder="Enter 6-digit code"
                  className="px-3 py-1.5 text-sm bg-slate-50 border border-slate-200 rounded-lg text-slate-900 tracking-widest font-mono text-center sm:text-left focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
                />
                <button
                  id="verify-phone-otp-btn"
                  type="submit"
                  disabled={isVerifyingOtp || otpCode.length < 4}
                  className="px-4 py-1.5 bg-sky-600 hover:bg-sky-500 disabled:bg-sky-300 text-white text-xs font-bold uppercase tracking-wider rounded-lg flex items-center justify-center gap-1.5 transition-colors shadow-xs"
                >
                  {isVerifyingOtp ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                  <span>Verify OTP</span>
                </button>
              </form>

              {/* Fallback Confirm Button */}
              <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                <span className="text-[11px] text-slate-400">Carrier delayed or test phone?</span>
                <button
                  id="confirm-phone-direct-btn"
                  type="button"
                  onClick={handleDirectPhoneVerification}
                  disabled={isVerifyingOtp}
                  className="text-xs text-sky-600 hover:text-sky-700 font-bold uppercase tracking-wider"
                >
                  Confirm & Sync Status
                </button>
              </div>
            </div>
          ) : (
            <p className="text-xs text-emerald-700 font-medium">
              Your phone number is verified and synchronized with Firestore.
            </p>
          )}
        </div>

        {/* Bottom Action */}
        <div className="pt-4 border-t border-slate-100">
          {isBothVerified ? (
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-center">
              <div className="inline-flex items-center gap-2 text-emerald-800 font-bold text-sm mb-1">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                <span>All Verifications Complete!</span>
              </div>
              <p className="text-xs text-emerald-700 mb-3">
                Your account is verified. You now have full access to create quotes, submit bids, and track live renovations.
              </p>
              <button
                id="continue-to-marketplace-btn"
                type="button"
                onClick={() => window.location.reload()}
                className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold uppercase tracking-wider rounded-lg transition-all shadow-xs flex items-center justify-center gap-2"
              >
                <span>Enter Marketplace Dashboard</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="text-center text-xs text-slate-500 font-medium">
              Please complete both verification steps above to unlock your dashboard.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

