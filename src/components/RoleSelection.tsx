import React from 'react';
import { UserRole } from '../types';
import { Home, Hammer, ShieldCheck, TrendingDown, Clock, Sparkles } from 'lucide-react';

interface RoleSelectionProps {
  onSelectRole: (role: UserRole) => void;
}

export const RoleSelection: React.FC<RoleSelectionProps> = ({ onSelectRole }) => {
  return (
    <div className="min-h-[80vh] flex flex-col items-center justify-center px-4 py-8 max-w-5xl mx-auto">
      <div className="text-center max-w-2xl mb-10">
        <div className="inline-flex items-center gap-2 px-3 py-1 bg-sky-50 border border-sky-100 rounded-full text-sky-700 text-xs font-bold uppercase tracking-widest mb-4">
          <Sparkles className="w-3.5 h-3.5 text-sky-600" />
          <span>Real-Time Interior Renovation Marketplace</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-slate-800 mb-3">
          Fair Pricing, Live Reverse Bidding & Verified Contractors
        </h1>
        <p className="text-slate-500 text-sm sm:text-base leading-relaxed">
          Connect directly with licensed interior design and renovation contractors. 
          Post your space requirements and watch vetted Shopkers bid down to give you the lowest price.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-4xl">
        {/* Customer Card */}
        <div
          id="select-customer-role-card"
          onClick={() => onSelectRole('customer')}
          className="group relative bg-white border border-slate-200 hover:border-sky-500 rounded-xl p-6 shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer flex flex-col justify-between"
        >
          <div className="flex items-start justify-between mb-5">
            <div className="w-12 h-12 bg-sky-50 rounded-lg flex items-center justify-center text-sky-600 border border-sky-100 group-hover:scale-105 transition-transform">
              <Home className="w-6 h-6" />
            </div>
            <span className="px-2.5 py-1 bg-sky-50 text-sky-700 text-xs font-bold uppercase tracking-wider rounded-md border border-sky-100">
              For Homeowners
            </span>
          </div>

          <div>
            <h2 className="text-xl font-bold text-slate-800 mb-2 group-hover:text-sky-600 transition-colors">
              I'm a Customer
            </h2>
            <p className="text-slate-500 text-xs sm:text-sm mb-6 leading-relaxed">
              Looking to renovate or design your home, apartment, or commercial space. Post your square footage, select your finish tier, and get the lowest competitive quotes from verified contractors.
            </p>

            <ul className="space-y-2.5 text-xs text-slate-600 mb-6 border-t border-slate-100 pt-4">
              <li className="flex items-center gap-2">
                <TrendingDown className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Transparent price calculator based on real market averages</span>
              </li>
              <li className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-sky-600 shrink-0" />
                <span>Live reverse bidding windows from 5 mins to 2 hours</span>
              </li>
              <li className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Lowest verified bidder wins with full project transparency</span>
              </li>
            </ul>
          </div>

          <button
            id="continue-as-customer-btn"
            type="button"
            className="w-full py-2.5 px-4 bg-sky-600 hover:bg-sky-500 text-white font-bold rounded-lg transition-colors shadow-sm shadow-sky-600/20 flex items-center justify-center gap-2 text-xs uppercase tracking-wider"
          >
            <span>Continue as Customer</span>
            <span>&rarr;</span>
          </button>
        </div>

        {/* Shopker Card */}
        <div
          id="select-shopker-role-card"
          onClick={() => onSelectRole('shopker')}
          className="group relative bg-white border border-slate-200 hover:border-slate-800 rounded-xl p-6 shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer flex flex-col justify-between"
        >
          <div className="flex items-start justify-between mb-5">
            <div className="w-12 h-12 bg-slate-100 rounded-lg flex items-center justify-center text-slate-800 border border-slate-200 group-hover:scale-105 transition-transform">
              <Hammer className="w-6 h-6" />
            </div>
            <span className="px-2.5 py-1 bg-slate-100 text-slate-700 text-xs font-bold uppercase tracking-wider rounded-md border border-slate-200">
              For Contractors
            </span>
          </div>

          <div>
            <h2 className="text-xl font-bold text-slate-800 mb-2 group-hover:text-slate-950 transition-colors">
              I'm a Shopker
            </h2>
            <p className="text-slate-500 text-xs sm:text-sm mb-6 leading-relaxed">
              Interior design & renovation contractor, carpenter, or firm. Set your per-sqft rates across Classic, Mid, and Premium tiers, receive live project leads, and win contracts with instant reverse bids.
            </p>

            <ul className="space-y-2.5 text-xs text-slate-600 mb-6 border-t border-slate-100 pt-4">
              <li className="flex items-center gap-2">
                <TrendingDown className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Customize your base per-sqft pricing anytime</span>
              </li>
              <li className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-sky-600 shrink-0" />
                <span>Instant notifications for new renovation requests</span>
              </li>
              <li className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Clear 2% platform fee calculation with direct client handoff</span>
              </li>
            </ul>
          </div>

          <button
            id="continue-as-shopker-btn"
            type="button"
            className="w-full py-2.5 px-4 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-lg transition-colors shadow-sm flex items-center justify-center gap-2 text-xs uppercase tracking-wider"
          >
            <span>Continue as Shopker</span>
            <span>&rarr;</span>
          </button>
        </div>
      </div>
    </div>
  );
};
