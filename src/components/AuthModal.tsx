import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { UserRole } from '../types';
import { User, Mail, Phone, Lock, AlertCircle, ArrowLeft, Loader2, CheckCircle2, Shield } from 'lucide-react';

interface AuthModalProps {
  initialRole: UserRole;
  onBackToRoles: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ initialRole, onBackToRoles }) => {
  const { signup, login, resetPassword, signInWithGoogle, error: authError, clearError } = useAuth();

  const [isLogin, setIsLogin] = useState<boolean>(false);
  const [isForgotPassword, setIsForgotPassword] = useState<boolean>(false);

  const [role, setRole] = useState<UserRole>(initialRole);
  const [name, setName] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [phone, setPhone] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');

  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [isGoogleSubmitting, setIsGoogleSubmitting] = useState<boolean>(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const activeError = localError || authError;

  const handleGoogleSignIn = async () => {
    setLocalError(null);
    clearError();
    setSuccessMessage(null);
    setIsGoogleSubmitting(true);
    const res = await signInWithGoogle(role);
    setIsGoogleSubmitting(false);
    if (!res.success && res.error) {
      setLocalError(res.error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    clearError();
    setSuccessMessage(null);

    // Form validations
    if (isForgotPassword) {
      if (!email.trim() || !email.includes('@')) {
        setLocalError('Please enter a valid email address.');
        return;
      }
      setIsSubmitting(true);
      const res = await resetPassword(email.trim());
      setIsSubmitting(false);
      if (res.success) {
        setSuccessMessage('Password reset link sent! Check your inbox.');
      }
      return;
    }

    if (isLogin) {
      if (!email.trim() || !email.includes('@')) {
        setLocalError('Please enter a valid email address.');
        return;
      }
      if (!password) {
        setLocalError('Please enter your password.');
        return;
      }

      setIsSubmitting(true);
      const res = await login(email.trim(), password);
      setIsSubmitting(false);
      if (!res.success && res.error) {
        setLocalError(res.error);
      }
    } else {
      // Signup validations
      if (!name.trim() || name.trim().length < 2) {
        setLocalError('Please enter your full name.');
        return;
      }
      if (!email.trim() || !email.includes('@')) {
        setLocalError('Please enter a valid email address.');
        return;
      }
      const cleanedPhone = phone.replace(/\D/g, '');
      if (cleanedPhone.length < 8) {
        setLocalError('Please enter a valid phone number with country code (e.g. +1 555-0199).');
        return;
      }
      if (password.length < 6) {
        setLocalError('Password must be at least 6 characters long.');
        return;
      }
      if (password !== confirmPassword) {
        setLocalError('Passwords do not match.');
        return;
      }

      setIsSubmitting(true);
      const res = await signup(name.trim(), email.trim(), phone.trim(), password, role);
      setIsSubmitting(false);
      if (!res.success && res.error) {
        setLocalError(res.error);
      }
    }
  };

  return (
    <div className="min-h-[85vh] flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-md bg-white border border-slate-200 rounded-xl p-6 sm:p-8 shadow-sm">
        {/* Back navigation */}
        <button
          id="auth-back-button"
          type="button"
          onClick={onBackToRoles}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900 transition-colors mb-5"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Switch Role / Back</span>
        </button>

        {/* Role & Title */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span
              className={`px-2.5 py-0.5 rounded-md text-[11px] font-bold uppercase tracking-wider ${
                role === 'customer'
                  ? 'bg-sky-50 text-sky-700 border border-sky-100'
                  : 'bg-slate-100 text-slate-800 border border-slate-200'
              }`}
            >
              {role === 'customer' ? 'Customer Account' : 'Shopker Contractor Account'}
            </span>
          </div>

          <div className="flex text-xs bg-slate-100 p-0.5 rounded-lg border border-slate-200">
            <button
              id="role-customer-toggle"
              type="button"
              onClick={() => {
                setRole('customer');
                clearError();
                setLocalError(null);
              }}
              className={`px-2 py-1 rounded-md font-bold text-[11px] uppercase tracking-wider transition-all ${
                role === 'customer' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Customer
            </button>
            <button
              id="role-shopker-toggle"
              type="button"
              onClick={() => {
                setRole('shopker');
                clearError();
                setLocalError(null);
              }}
              className={`px-2 py-1 rounded-md font-bold text-[11px] uppercase tracking-wider transition-all ${
                role === 'shopker' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Shopker
            </button>
          </div>
        </div>

        <h2 className="text-xl sm:text-2xl font-bold text-slate-800 tracking-tight mb-1">
          {isForgotPassword
            ? 'Reset Password'
            : isLogin
            ? 'Welcome Back'
            : 'Create Real Account'}
        </h2>
        <p className="text-xs sm:text-sm text-slate-500 mb-5">
          {isForgotPassword
            ? 'Enter your registered email to receive recovery instructions.'
            : isLogin
            ? 'Sign in to access your live bidding dashboard.'
            : 'Register your account to access real-time reverse quotes.'}
        </p>

        {/* 1-Click Google Sign-In Button */}
        {!isForgotPassword && (
          <div className="mb-5">
            <button
              id="google-signin-btn"
              type="button"
              onClick={handleGoogleSignIn}
              disabled={isGoogleSubmitting || isSubmitting}
              className="w-full py-2.5 px-4 bg-white hover:bg-slate-50 border border-slate-300 text-slate-800 font-bold text-xs uppercase tracking-wider rounded-lg transition-all shadow-xs flex items-center justify-center gap-3 disabled:opacity-60"
            >
              {isGoogleSubmitting ? (
                <Loader2 className="w-4 h-4 animate-spin text-sky-600" />
              ) : (
                <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.8-2.4 3.66v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.15z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.94H1.24v3.15C3.26 21.36 7.33 24 12 24z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.28 14.26c-.25-.72-.38-1.49-.38-2.26s.13-1.54.38-2.26V6.59H1.24C.45 8.16 0 9.93 0 12s.45 3.84 1.24 5.41l4.04-3.15z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.24 6.59l4.04 3.15c.95-2.84 3.6-4.99 6.72-4.99z"
                  />
                </svg>
              )}
              <span>
                {isLogin
                  ? `Sign In with Google (${role === 'customer' ? 'Customer' : 'Shopker'})`
                  : `Continue with Google (${role === 'customer' ? 'Customer' : 'Shopker'})`}
              </span>
            </button>

            <div className="relative my-4">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-200"></div>
              </div>
              <div className="relative flex justify-center text-[10px] uppercase font-bold tracking-wider">
                <span className="bg-white px-2.5 text-slate-400">or use email credentials</span>
              </div>
            </div>
          </div>
        )}

        {/* Display Active Error if any */}
        {activeError && (
          <div
            id="auth-error-banner"
            className="mb-5 p-3.5 bg-rose-50 border border-rose-200 rounded-lg text-rose-800 text-xs sm:text-sm flex items-start gap-2.5"
          >
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <div className="flex-1 font-medium">{activeError}</div>
          </div>
        )}

        {/* Success Message */}
        {successMessage && (
          <div
            id="auth-success-banner"
            className="mb-5 p-3.5 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-800 text-xs sm:text-sm flex items-start gap-2.5"
          >
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <div className="flex-1 font-medium">{successMessage}</div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Full Name (Sign Up only) */}
          {!isLogin && !isForgotPassword && (
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5" htmlFor="full-name-input">
                Full Name
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  id="full-name-input"
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={role === 'customer' ? 'e.g. Sarah Jenkins' : 'e.g. Apex Renovation Studios'}
                  className="w-full pl-10 pr-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all"
                />
              </div>
            </div>
          )}

          {/* Email Address */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5" htmlFor="email-input">
              Email Address
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                id="email-input"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
                className="w-full pl-10 pr-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all"
              />
            </div>
          </div>

          {/* Phone Number (Sign Up only) */}
          {!isLogin && !isForgotPassword && (
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5" htmlFor="phone-input">
                Phone Number <span className="text-slate-400 font-normal lowercase">(for OTP verification)</span>
              </label>
              <div className="relative">
                <Phone className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  id="phone-input"
                  type="tel"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+1 (555) 234-5678"
                  className="w-full pl-10 pr-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all"
                />
              </div>
            </div>
          )}

          {/* Password */}
          {!isForgotPassword && (
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600" htmlFor="password-input">
                  Password
                </label>
                {isLogin && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsForgotPassword(true);
                      clearError();
                      setLocalError(null);
                    }}
                    className="text-xs text-sky-600 hover:text-sky-700 font-bold"
                  >
                    Forgot?
                  </button>
                )}
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  id="password-input"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all"
                />
              </div>
            </div>
          )}

          {/* Confirm Password (Sign Up only) */}
          {!isLogin && !isForgotPassword && (
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5" htmlFor="confirm-password-input">
                Confirm Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  id="confirm-password-input"
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all"
                />
              </div>
            </div>
          )}

          {/* Verification disclosure for signup */}
          {!isLogin && !isForgotPassword && (
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-600 flex items-start gap-2">
              <Shield className="w-4 h-4 text-sky-600 shrink-0 mt-0.5" />
              <span>
                To maintain marketplace integrity, both your <strong>email</strong> and <strong>phone number</strong> are verified before your account can place quotes or bids.
              </span>
            </div>
          )}

          {/* Submit Button */}
          <button
            id="auth-submit-button"
            type="submit"
            disabled={isSubmitting || isGoogleSubmitting}
            className={`w-full py-2.5 px-4 font-bold text-white text-xs uppercase tracking-wider rounded-lg transition-all shadow-sm flex items-center justify-center gap-2 ${
              role === 'customer'
                ? 'bg-sky-600 hover:bg-sky-500 disabled:bg-sky-400 shadow-sky-600/20'
                : 'bg-slate-900 hover:bg-slate-800 disabled:bg-slate-400'
            }`}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Processing...</span>
              </>
            ) : isForgotPassword ? (
              <span>Send Reset Link</span>
            ) : isLogin ? (
              <span>Sign In with Email</span>
            ) : (
              <span>Create Account & Verify</span>
            )}
          </button>
        </form>

        {/* Toggle Login / Signup */}
        <div className="mt-6 pt-5 border-t border-slate-100 text-center">
          {isForgotPassword ? (
            <button
              id="back-to-login-btn"
              type="button"
              onClick={() => {
                setIsForgotPassword(false);
                setIsLogin(true);
                clearError();
                setLocalError(null);
                setSuccessMessage(null);
              }}
              className="text-xs text-sky-600 hover:text-sky-700 font-bold uppercase tracking-wider"
            >
              Back to Sign In
            </button>
          ) : isLogin ? (
            <p className="text-xs text-slate-500">
              Don't have an account yet?{' '}
              <button
                id="toggle-to-signup-btn"
                type="button"
                onClick={() => {
                  setIsLogin(false);
                  clearError();
                  setLocalError(null);
                  setSuccessMessage(null);
                }}
                className="text-sky-600 hover:text-sky-700 font-bold ml-1"
              >
                Sign up as {role === 'customer' ? 'Customer' : 'Shopker'}
              </button>
            </p>
          ) : (
            <p className="text-xs text-slate-500">
              Already have an account?{' '}
              <button
                id="toggle-to-login-btn"
                type="button"
                onClick={() => {
                  setIsLogin(true);
                  clearError();
                  setLocalError(null);
                  setSuccessMessage(null);
                }}
                className="text-sky-600 hover:text-sky-700 font-bold ml-1"
              >
                Sign In
              </button>
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

