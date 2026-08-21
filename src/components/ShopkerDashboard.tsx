import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { QuoteRequest, ShopkerPricing, Bid, BudgetTier } from '../types';
import { SyncedCountdown } from './SyncedCountdown';
import { RequestDetailsModal } from './RequestDetailsModal';
import { resolveQuoteRequest } from '../lib/requestHelpers';
import {
  Hammer,
  Clock,
  MapPin,
  Maximize2,
  DollarSign,
  TrendingDown,
  Sparkles,
  ShieldCheck,
  AlertCircle,
  CheckCircle2,
  Send,
  Loader2,
  Award,
  Eye,
  Sliders,
  Phone,
  Mail,
  History,
  Check,
} from 'lucide-react';
import {
  collection,
  doc,
  getDoc,
  setDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  getDocs,
} from 'firebase/firestore';
import { db } from '../lib/firebase';

export const ShopkerDashboard: React.FC = () => {
  const { userProfile } = useAuth();

  // Pricing settings state (in Rs / sqft)
  const [classicRate, setClassicRate] = useState<number>(1200);
  const [midRate, setMidRate] = useState<number>(1800);
  const [premiumRate, setPremiumRate] = useState<number>(2800);
  const [isSavingPricing, setIsSavingPricing] = useState<boolean>(false);
  const [pricingSuccess, setPricingSuccess] = useState<string | null>(null);
  const [pricingError, setPricingError] = useState<string | null>(null);

  // Market requests state
  const [openRequests, setOpenRequests] = useState<QuoteRequest[]>([]);
  const [loadingRequests, setLoadingRequests] = useState<boolean>(true);

  // Shopker's projects & bids state
  const [myBids, setMyBids] = useState<Bid[]>([]);
  const [myWonRequests, setMyWonRequests] = useState<QuoteRequest[]>([]);
  const [myParticipatedRequests, setMyParticipatedRequests] = useState<QuoteRequest[]>([]);

  // Modal & Tabs
  const [selectedRequestForModal, setSelectedRequestForModal] = useState<QuoteRequest | null>(null);
  const [marketTab, setMarketTab] = useState<'open_market' | 'won_jobs' | 'my_bids'>('open_market');

  // Load existing pricing from Firestore
  useEffect(() => {
    if (!userProfile?.id) return;

    const loadPricing = async () => {
      try {
        const pricingDocRef = doc(db, 'ShopkerPricing', userProfile.id);
        const snap = await getDoc(pricingDocRef);
        if (snap.exists()) {
          const data = snap.data() as ShopkerPricing;
          setClassicRate(data.classic_price_per_sqft || 1200);
          setMidRate(data.mid_price_per_sqft || 1800);
          setPremiumRate(data.premium_price_per_sqft || 2800);
        }
      } catch (err) {
        console.error('Error loading shopker pricing:', err);
      }
    };

    loadPricing();
  }, [userProfile?.id]);

  // Listen to ALL Open Requests in real-time
  useEffect(() => {
    const q = query(
      collection(db, 'Requests'),
      where('status', '==', 'open'),
      orderBy('created_at', 'desc')
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const list: QuoteRequest[] = [];
        snapshot.forEach((d) => {
          const item = { id: d.id, ...d.data() } as QuoteRequest;
          list.push(item);

          // Check if expired and open
          const now = Date.now();
          const closeTime = new Date(item.closes_at).getTime();
          if (item.status === 'open' && closeTime <= now) {
            resolveQuoteRequest(item.id);
          }
        });
        setOpenRequests(list);
        setLoadingRequests(false);
      },
      (err) => {
        console.error('Error listening to open requests:', err);
        setLoadingRequests(false);
      }
    );

    return () => unsubscribe();
  }, []);

  // Listen to this Shopker's Bids and Won jobs
  useEffect(() => {
    if (!userProfile?.id) return;

    // Listen to bids placed by this shopker
    const bidsQuery = query(
      collection(db, 'Bids'),
      where('shopker_id', '==', userProfile.id),
      orderBy('submitted_at', 'desc')
    );

    const unsubscribeBids = onSnapshot(bidsQuery, async (snap) => {
      const bidList: Bid[] = [];
      const requestIds = new Set<string>();

      snap.forEach((d) => {
        const b = { id: d.id, ...d.data() } as Bid;
        bidList.push(b);
        requestIds.add(b.request_id);
      });
      setMyBids(bidList);

      // Fetch requests related to these bids
      if (requestIds.size > 0) {
        const participated: QuoteRequest[] = [];
        const won: QuoteRequest[] = [];

        for (const rId of Array.from(requestIds)) {
          const rSnap = await getDoc(doc(db, 'Requests', rId));
          if (rSnap.exists()) {
            const rData = { id: rSnap.id, ...rSnap.data() } as QuoteRequest;
            participated.push(rData);
            if (rData.status === 'closed' && rData.winner_id === userProfile.id) {
              won.push(rData);
            }
          }
        }
        setMyParticipatedRequests(participated);
        setMyWonRequests(won);
      }
    });

    return () => unsubscribeBids();
  }, [userProfile?.id]);

  const handleSavePricing = async (e: React.FormEvent) => {
    e.preventDefault();
    setPricingError(null);
    setPricingSuccess(null);

    if (!userProfile?.id) return;

    if (classicRate <= 0 || midRate <= 0 || premiumRate <= 0) {
      setPricingError('All tier rates per square foot must be greater than $0.');
      return;
    }

    setIsSavingPricing(true);
    try {
      const pricingData: ShopkerPricing = {
        shopker_id: userProfile.id,
        shopker_name: userProfile.name,
        classic_price_per_sqft: Number(classicRate),
        mid_price_per_sqft: Number(midRate),
        premium_price_per_sqft: Number(premiumRate),
        updated_at: new Date().toISOString(),
      };

      await setDoc(doc(db, 'ShopkerPricing', userProfile.id), pricingData);
      setPricingSuccess('Your base price-per-sqft rates have been saved to your profile!');
    } catch (err: any) {
      console.error('Error saving pricing:', err);
      setPricingError(`Failed to update rates: ${err.message}`);
    } finally {
      setIsSavingPricing(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Top Banner */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 sm:p-6 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 bg-slate-100 border border-slate-200 rounded-md text-slate-800 text-[11px] font-bold uppercase tracking-wider mb-2">
              <Hammer className="w-3.5 h-3.5 text-slate-900" />
              <span>Contractor Portal</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
              Contractor Console — {userProfile?.name}
            </h1>
            <p className="text-slate-500 text-xs sm:text-sm mt-1 leading-relaxed">
              Set your per-sqft pricing benchmarks, browse live renovation requests with active reverse bidding timers, and win verified client projects.
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-center min-w-[100px]">
              <span className="text-[11px] text-slate-400 font-bold uppercase tracking-wider block">Open Leads</span>
              <span className="text-xl font-bold text-slate-800">{openRequests.length}</span>
            </div>
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-center min-w-[100px]">
              <span className="text-[11px] text-emerald-800 font-bold uppercase tracking-wider block">Jobs Won</span>
              <span className="text-xl font-bold text-emerald-950">{myWonRequests.length}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* SHOPKER PRICING TIERS MANAGER (Left Column: 4 cols) */}
        <div className="lg:col-span-4 bg-white border border-slate-200 rounded-xl p-5 shadow-sm h-fit">
          <div className="flex items-center gap-2 mb-4 border-b border-slate-100 pb-3">
            <div className="w-7 h-7 rounded-lg bg-slate-100 text-slate-800 flex items-center justify-center">
              <Sliders className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold uppercase tracking-wider text-slate-800">Base Price per Sq Ft</h2>
              <p className="text-xs text-slate-400">Benchmark rates saved to profile</p>
            </div>
          </div>

          {pricingError && (
            <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-800 text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span>{pricingError}</span>
            </div>
          )}

          {pricingSuccess && (
            <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-800 text-xs flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <span>{pricingSuccess}</span>
            </div>
          )}

          <form onSubmit={handleSavePricing} className="space-y-3.5">
            {/* Classic Tier */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1" htmlFor="classic-rate-input">
                Classic Tier (₹/sqft)
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs">₹</span>
                <input
                  id="classic-rate-input"
                  type="number"
                  min="1"
                  step="1"
                  required
                  value={classicRate}
                  onChange={(e) => setClassicRate(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-full pl-7 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 font-semibold focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
                />
              </div>
              <span className="text-[10px] text-slate-400">Essential standard materials & basic finishes</span>
            </div>

            {/* Mid Tier */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1" htmlFor="mid-rate-input">
                Mid Tier (₹/sqft)
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs">₹</span>
                <input
                  id="mid-rate-input"
                  type="number"
                  min="1"
                  step="1"
                  required
                  value={midRate}
                  onChange={(e) => setMidRate(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-full pl-7 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 font-semibold focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
                />
              </div>
              <span className="text-[10px] text-slate-400">Premium laminates, false ceilings & modular units</span>
            </div>

            {/* Premium Tier */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1" htmlFor="premium-rate-input">
                Premium Tier (₹/sqft)
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs">₹</span>
                <input
                  id="premium-rate-input"
                  type="number"
                  min="1"
                  step="1"
                  required
                  value={premiumRate}
                  onChange={(e) => setPremiumRate(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-full pl-7 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 font-semibold focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
                />
              </div>
              <span className="text-[10px] text-slate-400">Luxury architectural veneers & designer fittings</span>
            </div>

            <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-[11px] text-slate-600">
              💡 These rates inform the marketplace customer estimate calculation. You can still bid competitively on individual jobs.
            </div>

            <button
              id="save-shopker-pricing-btn"
              type="submit"
              disabled={isSavingPricing}
              className="w-full py-2 px-4 bg-slate-900 hover:bg-black disabled:bg-slate-400 text-white text-xs font-bold uppercase tracking-wider rounded-lg transition-all shadow-xs flex items-center justify-center gap-1.5"
            >
              {isSavingPricing ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Saving Rates...</span>
                </>
              ) : (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>Update Profile Pricing</span>
                </>
              )}
            </button>
          </form>
        </div>

        {/* MARKETPLACE & WON JOBS (Right Column: 8 cols) */}
        <div className="lg:col-span-8 space-y-4">
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
              <div>
                <h2 className="text-sm font-bold uppercase tracking-wider text-slate-800">Contractor Opportunities</h2>
                <p className="text-xs text-slate-400">Live requests, bids & client contact handoffs</p>
              </div>

              {/* Tabs */}
              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg border border-slate-200 text-xs">
                <button
                  id="tab-open-market"
                  type="button"
                  onClick={() => setMarketTab('open_market')}
                  className={`px-2.5 py-1 rounded-md text-xs font-bold uppercase tracking-wider transition-all ${
                    marketTab === 'open_market'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Live Requests ({openRequests.length})
                </button>
                <button
                  id="tab-won-jobs"
                  type="button"
                  onClick={() => setMarketTab('won_jobs')}
                  className={`px-2.5 py-1 rounded-md text-xs font-bold uppercase tracking-wider transition-all ${
                    marketTab === 'won_jobs'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Won Jobs ({myWonRequests.length})
                </button>
                <button
                  id="tab-my-bids"
                  type="button"
                  onClick={() => setMarketTab('my_bids')}
                  className={`px-2.5 py-1 rounded-md text-xs font-bold uppercase tracking-wider transition-all ${
                    marketTab === 'my_bids'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  My Bids ({myBids.length})
                </button>
              </div>
            </div>

            {/* TAB CONTENT: LIVE OPEN MARKET */}
            {marketTab === 'open_market' && (
              <div className="mt-3">
                {loadingRequests ? (
                  <div className="py-12 text-center text-xs text-slate-500 flex items-center justify-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin text-sky-600" />
                    <span>Streaming live renovation requests...</span>
                  </div>
                ) : openRequests.length === 0 ? (
                  <div className="py-12 text-center text-xs text-slate-500">
                    No active renovation requests in the marketplace right now. 
                    You will receive a notification as soon as a customer posts a new project!
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {openRequests.map((req) => {
                      const currentPrice = req.current_lowest_bid ?? req.initial_estimated_price;
                      const hasBid = myBids.some((b) => b.request_id === req.id);
                      const isLeading = req.lowest_bid_shopker_id === userProfile?.id;

                      return (
                        <div
                          key={req.id}
                          className="py-3 flex flex-col gap-2.5 group hover:bg-slate-50/60 p-2.5 rounded-lg transition-colors"
                        >
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <span
                                className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider ${
                                  req.tier === 'premium'
                                    ? 'bg-amber-100 text-amber-900 border border-amber-300'
                                    : req.tier === 'mid'
                                    ? 'bg-sky-100 text-sky-900 border border-sky-200'
                                    : 'bg-slate-200 text-slate-800'
                                }`}
                              >
                                {req.tier}
                              </span>
                              <span className="font-bold text-xs text-slate-900">
                                {req.sqft.toLocaleString()} sqft Space
                              </span>
                              <span className="text-xs text-slate-400">•</span>
                              <span className="text-xs text-slate-600 truncate max-w-[200px]">
                                {req.location}
                              </span>
                            </div>

                            <SyncedCountdown
                              closesAt={req.closes_at}
                              compact
                              onExpire={() => resolveQuoteRequest(req.id)}
                            />
                          </div>

                          {/* Grid info */}
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs bg-white p-2.5 rounded-lg border border-slate-200">
                            <div>
                              <span className="text-slate-400 block text-[10px] font-bold uppercase tracking-wider">Ceiling Price:</span>
                              <span className="font-semibold text-slate-700 font-mono">
                                ₹{req.initial_estimated_price.toLocaleString('en-IN')}
                              </span>
                            </div>
                            <div>
                              <span className="text-slate-400 block text-[10px] font-bold uppercase tracking-wider">Current Lowest:</span>
                              <span className="font-bold text-sky-950 text-xs font-mono">
                                ₹{currentPrice.toLocaleString('en-IN')}
                              </span>
                            </div>
                            <div>
                              <span className="text-slate-400 block text-[10px] font-bold uppercase tracking-wider">Your Status:</span>
                              <span className="font-semibold">
                                {isLeading ? (
                                  <span className="text-emerald-700 font-bold">★ Lowest!</span>
                                ) : hasBid ? (
                                  <span className="text-rose-600 font-bold">Outbid</span>
                                ) : (
                                  <span className="text-slate-400">Not Bid</span>
                                )}
                              </span>
                            </div>
                            <div>
                              <span className="text-slate-400 block text-[10px] font-bold uppercase tracking-wider">Est. Payout (98%):</span>
                              <span className="font-bold text-slate-900 font-mono">
                                ₹{Math.round(currentPrice * 0.98).toLocaleString('en-IN')}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center justify-between pt-1">
                            <span className="text-[11px] text-slate-400">
                              {req.bid_count || 0} competing bids placed
                            </span>
                            <button
                              id={`bid-on-request-btn-${req.id}`}
                              type="button"
                              onClick={() => setSelectedRequestForModal(req)}
                              className="px-3 py-1.5 bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold uppercase tracking-wider rounded-lg flex items-center gap-1.5 transition-all shadow-xs"
                            >
                              <Send className="w-3.5 h-3.5" />
                              <span>{hasBid ? 'Update Bid' : 'Place Reverse Bid'}</span>
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* TAB CONTENT: WON JOBS */}
            {marketTab === 'won_jobs' && (
              <div className="mt-3">
                {myWonRequests.length === 0 ? (
                  <div className="py-12 text-center text-xs text-slate-500">
                    No finalized won jobs yet. Bid on open requests in the marketplace to win projects!
                  </div>
                ) : (
                  <div className="space-y-3">
                    {myWonRequests.map((job) => (
                      <div
                        key={job.id}
                        className="p-4 bg-emerald-50/60 border border-emerald-300 rounded-xl space-y-3"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-emerald-200/80 pb-2.5">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-lg bg-emerald-600 text-white flex items-center justify-center">
                              <Award className="w-4 h-4" />
                            </div>
                            <div>
                              <h3 className="font-bold text-slate-900 text-sm">You won this job! 🎉</h3>
                              <p className="text-[11px] text-emerald-800">
                                {job.tier.toUpperCase()} Tier • {job.sqft.toLocaleString()} sqft in {job.location}
                              </p>
                            </div>
                          </div>

                          <div className="text-right">
                            <span className="text-[10px] text-slate-500 uppercase tracking-wider block font-bold">Final Contract:</span>
                            <span className="text-sm font-black text-emerald-900 font-mono">
                              ₹{job.final_bid?.toLocaleString('en-IN')}
                            </span>
                          </div>
                        </div>

                        {/* Customer Direct Contact Details */}
                        <div className="bg-white p-3 rounded-lg border border-emerald-200 grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                          <div>
                            <span className="text-slate-400 block mb-0.5 text-[10px] font-bold uppercase tracking-wider">Customer Name:</span>
                            <span className="font-bold text-slate-900 text-xs">{job.customer_name}</span>
                          </div>
                          <div>
                            <span className="text-slate-400 block mb-0.5 text-[10px] font-bold uppercase tracking-wider">Site Address:</span>
                            <span className="font-semibold text-slate-800 text-xs">{job.location}</span>
                          </div>
                          <div>
                            <span className="text-slate-400 block mb-0.5 text-[10px] font-bold uppercase tracking-wider">Customer Phone:</span>
                            <a
                              href={`tel:${job.customer_phone}`}
                              className="font-bold text-emerald-700 hover:underline flex items-center gap-1 text-xs"
                            >
                              <Phone className="w-3.5 h-3.5" />
                              {job.customer_phone || 'Available'}
                            </a>
                          </div>
                          <div>
                            <span className="text-slate-400 block mb-0.5 text-[10px] font-bold uppercase tracking-wider">Customer Email:</span>
                            <a
                              href={`mailto:${job.customer_email}`}
                              className="font-bold text-emerald-700 hover:underline flex items-center gap-1 text-xs"
                            >
                              <Mail className="w-3.5 h-3.5" />
                              {job.customer_email || 'Available'}
                            </a>
                          </div>
                        </div>

                        {/* Financial Payout Calculation (2% fee deducted) */}
                        <div className="p-2.5 bg-white/80 rounded-lg border border-emerald-200 text-xs grid grid-cols-3 gap-2 text-center font-mono">
                          <div>
                            <span className="text-slate-400 block text-[10px] font-sans font-bold uppercase tracking-wider">Winning Bid</span>
                            <span className="font-bold text-slate-900">₹{job.final_bid?.toLocaleString('en-IN')}</span>
                          </div>
                          <div>
                            <span className="text-slate-400 block text-[10px] font-sans font-bold uppercase tracking-wider">Fee (2%)</span>
                            <span className="font-bold text-rose-700">-₹{job.platform_fee?.toLocaleString('en-IN')}</span>
                          </div>
                          <div>
                            <span className="text-slate-400 block text-[10px] font-sans font-bold uppercase tracking-wider">Net Payout</span>
                            <span className="font-black text-emerald-700 text-xs">
                              ₹{job.shopker_payout?.toLocaleString('en-IN')}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* TAB CONTENT: MY BIDS */}
            {marketTab === 'my_bids' && (
              <div className="mt-3">
                {myBids.length === 0 ? (
                  <div className="py-12 text-center text-xs text-slate-500">
                    You haven't submitted any bids yet. Check the Live Requests tab to place your first bid!
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {myBids.map((b) => {
                      const relatedReq = myParticipatedRequests.find((r) => r.id === b.request_id);

                      return (
                        <div key={b.id} className="py-2.5 flex items-center justify-between text-xs">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-slate-900 text-xs font-mono">
                                Bid: ₹{b.bid_amount.toLocaleString('en-IN')}
                              </span>
                              {relatedReq && (
                                <span className="text-slate-500">
                                  for {relatedReq.sqft} sqft ({relatedReq.tier})
                                </span>
                              )}
                            </div>
                            <span className="text-[10px] text-slate-400">
                              Placed on {new Date(b.submitted_at).toLocaleString()}
                            </span>
                          </div>

                          <div className="text-right">
                            {relatedReq?.status === 'open' ? (
                              <span className="px-2 py-0.5 bg-amber-100 text-amber-800 rounded-md font-bold text-[10px] uppercase tracking-wider">
                                Auction Live
                              </span>
                            ) : relatedReq?.status === 'closed' && relatedReq.winner_id === userProfile?.id ? (
                              <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-md font-bold text-[10px] uppercase tracking-wider">
                                Won Job 🏆
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 bg-slate-200 text-slate-700 rounded-md text-[10px] uppercase tracking-wider">
                                Closed
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Live Bidding Modal */}
      {selectedRequestForModal && userProfile && (
        <RequestDetailsModal
          request={selectedRequestForModal}
          currentUserProfile={userProfile}
          onClose={() => setSelectedRequestForModal(null)}
        />
      )}
    </div>
  );
};
