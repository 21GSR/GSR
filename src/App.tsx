import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { UserRole } from './types';
import { RoleSelection } from './components/RoleSelection';
import { AuthModal } from './components/AuthModal';
import { VerificationScreen } from './components/VerificationScreen';
import { Navbar } from './components/Navbar';
import { CustomerDashboard } from './components/CustomerDashboard';
import { ShopkerDashboard } from './components/ShopkerDashboard';
import { Loader2 } from 'lucide-react';

const MainLayout: React.FC = () => {
  const { currentUser, userProfile, loading, isFullyVerified } = useAuth();
  const [selectedRole, setSelectedRole] = useState<UserRole | null>(null);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex flex-col items-center justify-center text-slate-900">
        <div className="p-8 bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-sky-600" />
          <span className="text-xs font-bold text-slate-700 uppercase tracking-widest">Connecting to Marketplace...</span>
        </div>
      </div>
    );
  }

  // 1. Not logged in: Show Role Selection or Auth Modal
  if (!currentUser) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] text-slate-900 flex flex-col justify-between font-sans">
        <header className="h-16 bg-white border-b border-slate-200 px-6 sm:px-8 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-sky-600 rounded-lg flex items-center justify-center text-white shadow-xs font-bold text-sm">
              S
            </div>
            <span className="text-lg font-bold tracking-tight text-slate-800">
              SHOPKER<span className="text-sky-600">MARKET</span>
            </span>
          </div>
          <div className="flex items-center gap-2 px-3 py-1 bg-sky-50 text-sky-700 rounded-full border border-sky-100">
            <div className="w-2 h-2 bg-sky-500 rounded-full animate-pulse"></div>
            <span className="text-[11px] font-semibold uppercase tracking-wider">Real-Time Reverse Bidding</span>
          </div>
        </header>

        <main className="flex-1 flex items-center justify-center p-4">
          {!selectedRole ? (
            <RoleSelection onSelectRole={(role) => setSelectedRole(role)} />
          ) : (
            <AuthModal initialRole={selectedRole} onBackToRoles={() => setSelectedRole(null)} />
          )}
        </main>

        <footer className="h-10 bg-slate-900 text-slate-400 text-[10px] px-6 sm:px-8 flex items-center justify-between shrink-0 uppercase tracking-widest">
          <span>&copy; {new Date().getFullYear()} Shopker Interior Renovation Marketplace</span>
          <div className="hidden sm:flex gap-6">
            <span>Server Status: Online</span>
            <span className="text-emerald-400">Firebase Real-time: Syncing</span>
          </div>
        </footer>
      </div>
    );
  }

  // 2. Logged in but not fully verified: Show mandatory Verification Screen
  if (!isFullyVerified || !userProfile) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] text-slate-900 flex flex-col justify-between font-sans">
        <header className="h-16 bg-white border-b border-slate-200 px-6 sm:px-8 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-sky-600 rounded-lg flex items-center justify-center text-white shadow-xs font-bold text-sm">
              S
            </div>
            <span className="text-lg font-bold tracking-tight text-slate-800">
              SHOPKER<span className="text-sky-600">MARKET</span>
            </span>
          </div>
          <div className="flex items-center gap-2 px-3 py-1 bg-amber-50 text-amber-700 rounded-full border border-amber-200">
            <div className="w-2 h-2 bg-amber-500 rounded-full animate-pulse"></div>
            <span className="text-[11px] font-semibold uppercase tracking-wider">Verification Required</span>
          </div>
        </header>

        <main className="flex-1 flex items-center justify-center p-4">
          <VerificationScreen />
        </main>

        <footer className="h-10 bg-slate-900 text-slate-400 text-[10px] px-6 sm:px-8 flex items-center justify-between shrink-0 uppercase tracking-widest">
          <span>&copy; {new Date().getFullYear()} Shopker Security Gate</span>
          <span className="text-sky-400">ID Verification Protocol Active</span>
        </footer>
      </div>
    );
  }

  // 3. Fully logged in & verified: Show Role-specific Dashboard
  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 flex flex-col justify-between font-sans">
      <Navbar />

      <main className="flex-1 pb-10">
        {userProfile.role === 'customer' ? <CustomerDashboard /> : <ShopkerDashboard />}
      </main>

      <footer className="h-10 bg-slate-900 text-slate-400 text-[10px] px-6 sm:px-8 flex items-center justify-between shrink-0 uppercase tracking-widest border-t border-slate-800">
        <span>© {new Date().getFullYear()} Shopker Platform • Verified Licensed Contractor Network</span>
        <div className="hidden sm:flex gap-6">
          <span>Standard Platform Fee: 2%</span>
          <span className="text-emerald-400">Firebase Real-Time: Active</span>
        </div>
      </footer>
    </div>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <MainLayout />
    </AuthProvider>
  );
}
