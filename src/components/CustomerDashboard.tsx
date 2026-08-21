import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { BudgetTier, QuoteRequest, UserProfile } from '../types';
import { SyncedCountdown } from './SyncedCountdown';
import { RequestDetailsModal } from './RequestDetailsModal';
import {
  calculateMarketRatePerSqFt,
  calculateEstimatedQuote,
  DEFAULT_MARKUP_PERCENT,
  resolveQuoteRequest,
} from '../lib/requestHelpers';
import { broadcastNewRequestToShopkers } from '../lib/notifications';
import {
  Home,
  Clock,
  MapPin,
  Maximize2,
  DollarSign,
  TrendingDown,
  Sparkles,
  ShieldCheck,
  AlertCircle,
  CheckCircle2,
  PlusCircle,
  ArrowRight,
  Eye,
  Loader2,
  HelpCircle,
  Layers,
  Phone,
  Mail,
  RefreshCw,
} from 'lucide-react';
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  addDoc,
} from 'firebase/firestore';
import { db } from '../lib/firebase';

export const CustomerDashboard: React.FC = () => {
  const { userProfile } = useAuth();

  // Quote Request Form States
  const [sqft, setSqft] = useState<number>(1200);
  const [tier, setTier] = useState<BudgetTier>('mid');
  const [location, setLocation] = useState<string>('');
  const [durationMinutes, setDurationMinutes] = useState<number>(15); // 5 to 120 mins

  // Pricing calculation states
  const [marketRatePerSqft, setMarketRatePerSqft] = useState<number>(75);
  const [shopkerCount, setShopkerCount] = useState<number>(0);
  const [isEstimating, setIsEstimating] = useState<boolean>(false);

  // Form submission states
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);

  // Requests state
  const [requests, setRequests] = useState<QuoteRequest[]>([]);
  const [loadingRequests, setLoadingRequests] = useState<boolean>(true);
  const [selectedRequestForModal, setSelectedRequestForModal] = useState<QuoteRequest | null>(null);
  const [activeTab, setActiveTab] = useState<'all' | 'open' | 'closed'>('all');

  // Fetch real-time market rate average whenever tier changes
  useEffect(() => {
    let isMounted = true;
    const fetchRate = async () => {
      setIsEstimating(true);
      const res = await calculateMarketRatePerSqFt(tier);
      if (isMounted) {
        setMarketRatePerSqft(res.avgRate);
        setShopkerCount(res.shopkerCount);
        setIsEstimating(false);
      }
    };
    fetchRate();
    return () => {
      isMounted = false;
    };
  }, [tier]);

  // Listen to Customer's requests in real time
  useEffect(() => {
    if (!userProfile?.id) return;

    const reqQuery = query(
      collection(db, 'Requests'),
      where('customer_id', '==', userProfile.id),
      orderBy('created_at', 'desc')
    );

    const unsubscribe = onSnapshot(
      reqQuery,
      (snapshot) => {
        const reqList: QuoteRequest[] = [];
        snapshot.forEach((d) => {
          const item = { id: d.id, ...d.data() } as QuoteRequest;
          reqList.push(item);

          // Check if any open request is past closes_at time and resolve
          const now = Date.now();
          const closeTime = new Date(item.closes_at).getTime();
          if (item.status === 'open' && closeTime <= now) {
            resolveQuoteRequest(item.id);
          }
        });
        setRequests(reqList);
        setLoadingRequests(false);
      },
      (err) => {
        console.error('Error listening to customer requests:', err);
        setSubmitError(`Firestore Sync Error: ${err.message}`);
        setLoadingRequests(false);
      }
    );

    return () => unsubscribe();
  }, [userProfile?.id]);

  const estimatedPrice = calculateEstimatedQuote(sqft, marketRatePerSqft, DEFAULT_MARKUP_PERCENT);

  const handleCreateRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    setSubmitSuccess(null);

    if (!userProfile) return;

    if (!location.trim() || location.trim().length < 4) {
      setSubmitError('Please provide a specific street address or area location.');
      return;
    }

    if (sqft < 1) {
      setSubmitError('Square footage must be at least 1 sqft.');
      return;
    }

    if (durationMinutes < 5 || durationMinutes > 120) {
      setSubmitError('Bidding window must be between 5 minutes and 2 hours (120 minutes).');
      return;
    }

    setIsSubmitting(true);

    try {
      const now = new Date();
      const closesAt = new Date(now.getTime() + durationMinutes * 60 * 1000);

      const newRequestData: Omit<QuoteRequest, 'id'> = {
        customer_id: userProfile.id,
        customer_name: userProfile.name,
        customer_phone: userProfile.phone || '',
        customer_email: userProfile.email || '',
        sqft,
        tier,
        location: location.trim(),
        timer_duration: durationMinutes,
        initial_estimated_price: estimatedPrice,
        market_rate_per_sqft: marketRatePerSqft,
        markup_percent: DEFAULT_MARKUP_PERCENT,
        current_lowest_bid: null,
        lowest_bid_shopker_id: null,
        bid_count: 0,
        status: 'open',
        created_at: now.toISOString(),
        closes_at: closesAt.toISOString(),
        winner_id: null,
        winner_name: null,
        winner_phone: null,
        winner_email: null,
        final_bid: null,
        platform_fee: null,
        shopker_payout: null,
      };

      // 1. Write to Firestore
      const docRef = await addDoc(collection(db, 'Requests'), newRequestData);

      // 2. Broadcast notification to all verified shopkers
      await broadcastNewRequestToShopkers(
        docRef.id,
        sqft,
        tier,
        location.trim(),
        estimatedPrice
      );

      setSubmitSuccess(
        `Renovation quote request published! Bidding countdown of ${durationMinutes} minutes started.`
      );
      setLocation('');
      setSqft(1200);
      setDurationMinutes(15);
    } catch (err: any) {
      console.error('Failed creating quote request in Firestore:', err);
      setSubmitError(`Failed to publish quote request: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredRequests = requests.filter((r) => {
    if (activeTab === 'open') return r.status === 'open';
    if (activeTab === 'closed') return r.status === 'closed' || r.status === 'no_bids';
    return true;
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Top Banner */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 sm:p-6 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 bg-sky-50 border border-sky-100 rounded-md text-sky-700 text-[11px] font-bold uppercase tracking-wider mb-2">
              <Sparkles className="w-3.5 h-3.5 text-sky-600" />
              <span>Customer Console</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
              Welcome back, {userProfile?.name}
            </h1>
            <p className="text-slate-500 text-xs sm:text-sm mt-1 leading-relaxed">
              Post your space specs below to launch a live reverse bidding window. 
              Verified Shopkers compete to offer you the lowest renovation quote.
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-center min-w-[110px]">
              <span className="text-[11px] text-slate-400 uppercase tracking-wider font-bold block">Total Requests</span>
              <span className="text-xl font-bold text-slate-800">{requests.length}</span>
            </div>
            <div className="p-3 bg-sky-50 border border-sky-100 rounded-xl text-center min-w-[110px]">
              <span className="text-[11px] text-sky-800 uppercase tracking-wider font-bold block">Active Biddings</span>
              <span className="text-xl font-bold text-sky-950">
                {requests.filter((r) => r.status === 'open').length}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Grid: Quote Creation & Active Requests */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* CREATE QUOTE REQUEST FORM (Left Column: 5 cols) */}
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-4 border-b border-slate-100 pb-3">
            <div className="w-7 h-7 rounded-lg bg-sky-100 text-sky-700 flex items-center justify-center">
              <PlusCircle className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold uppercase tracking-wider text-slate-800">Request a Renovation Quote</h2>
              <p className="text-xs text-slate-400">Live competitive reverse auction</p>
            </div>
          </div>

          {/* Form Error Banner */}
          {submitError && (
            <div
              id="customer-submit-error"
              className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-800 text-xs flex items-start gap-2"
            >
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span>{submitError}</span>
            </div>
          )}

          {/* Form Success Banner */}
          {submitSuccess && (
            <div
              id="customer-submit-success"
              className="mb-4 p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-800 text-xs flex items-start gap-2"
            >
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <span>{submitSuccess}</span>
            </div>
          )}

          <form onSubmit={handleCreateRequest} className="space-y-3.5">
            {/* 1. Square Footage */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5" htmlFor="sqft-input">
                  <Maximize2 className="w-3.5 h-3.5 text-slate-400" />
                  <span>Square Footage (sqft)</span>
                </label>
                <span className="text-xs font-bold text-sky-800 bg-sky-50 px-2 py-0.5 rounded-md border border-sky-100 font-mono">
                  {sqft.toLocaleString()} sqft
                </span>
              </div>
              <input
                id="sqft-input"
                type="number"
                min={1}
                step={1}
                required
                value={sqft}
                onChange={(e) => setSqft(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-full px-3 py-1.5 text-sm bg-slate-50 border border-slate-200 rounded-lg text-slate-900 font-semibold focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 mb-1.5"
              />
              {/* Quick Presets */}
              <div className="flex items-center gap-1.5 flex-wrap">
                {[100, 500, 1000, 2000, 5000, 10000].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setSqft(preset)}
                    className={`px-2 py-0.5 text-[10px] rounded-md border font-bold transition-all ${
                      sqft === preset
                        ? 'bg-sky-600 text-white border-sky-600'
                        : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    {preset.toLocaleString()} sqft
                  </button>
                ))}
              </div>
            </div>

            {/* 2. Budget Tier */}
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5 mb-1.5">
                <Layers className="w-3.5 h-3.5 text-slate-400" />
                <span>Finish & Budget Tier</span>
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'classic', label: 'Classic', desc: 'Standard finishes, essential carpentry' },
                  { id: 'mid', label: 'Mid-Tier', desc: 'Premium laminates, false ceiling & modular' },
                  { id: 'premium', label: 'Premium', desc: 'Bespoke luxury, veneer & marble' },
                ].map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setTier(item.id as BudgetTier)}
                    className={`p-2 rounded-lg border text-left transition-all ${
                      tier === item.id
                        ? 'bg-sky-50 border-sky-500 ring-2 ring-sky-500/20'
                        : 'bg-white border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="font-bold text-xs text-slate-900 mb-0.5">{item.label}</div>
                    <div className="text-[10px] text-slate-400 leading-tight">{item.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Price Estimation Breakdown Box */}
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-700 flex items-center gap-1">
                  <span>Market Avg Rate ({tier}):</span>
                  {isEstimating && <RefreshCw className="w-3 h-3 animate-spin text-sky-600" />}
                </span>
                <span className="font-bold text-slate-900 font-mono">₹{marketRatePerSqft.toLocaleString('en-IN')} / sqft</span>
              </div>
              <div className="flex items-center justify-between text-slate-400 text-[11px]">
                <span>
                  Contractor Pool: {shopkerCount > 0 ? `${shopkerCount} registered Shopkers` : 'Benchmark Baseline'}
                </span>
                <span>+{DEFAULT_MARKUP_PERCENT}% ceiling</span>
              </div>
              <div className="pt-1.5 border-t border-slate-200 flex items-center justify-between">
                <span className="font-bold text-slate-800 uppercase tracking-wider text-[11px]">Estimated Ceiling:</span>
                <span className="text-sm font-black text-sky-900 font-mono">
                  ₹{estimatedPrice.toLocaleString('en-IN')}
                </span>
              </div>
            </div>

            {/* 3. Location Address */}
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5 mb-1" htmlFor="location-input">
                <MapPin className="w-3.5 h-3.5 text-slate-400" />
                <span>Project Location</span>
              </label>
              <input
                id="location-input"
                type="text"
                required
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="e.g. 742 Evergreen Terrace, Downtown District"
                className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
              />
            </div>

            {/* 4. Bidding Window Duration */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5" htmlFor="duration-slider">
                  <Clock className="w-3.5 h-3.5 text-slate-400" />
                  <span>Bidding Window (5m - 2h)</span>
                </label>
                <span className="text-xs font-bold text-slate-800 font-mono">
                  {durationMinutes >= 60
                    ? `${(durationMinutes / 60).toFixed(1)} hrs`
                    : `${durationMinutes} mins`}
                </span>
              </div>
              <input
                id="duration-slider"
                type="range"
                min={5}
                max={120}
                step={5}
                value={durationMinutes}
                onChange={(e) => setDurationMinutes(parseInt(e.target.value))}
                className="w-full accent-sky-600 mb-1.5 cursor-pointer"
              />
              <div className="flex items-center gap-1.5">
                {[5, 15, 30, 60, 120].map((mins) => (
                  <button
                    key={mins}
                    type="button"
                    onClick={() => setDurationMinutes(mins)}
                    className={`px-2 py-0.5 text-[10px] rounded-md border font-bold transition-all ${
                      durationMinutes === mins
                        ? 'bg-slate-900 text-white border-slate-900'
                        : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    {mins >= 60 ? `${mins / 60}h` : `${mins}m`}
                  </button>
                ))}
              </div>
            </div>

            {/* Submit Button */}
            <button
              id="submit-renovation-request-btn"
              type="submit"
              disabled={isSubmitting}
              className="w-full py-2.5 px-4 bg-sky-600 hover:bg-sky-500 disabled:bg-sky-400 text-white text-xs font-bold uppercase tracking-wider rounded-lg transition-all shadow-xs flex items-center justify-center gap-2 pt-2.5"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Publishing & Alerting Shopkers...</span>
                </>
              ) : (
                <>
                  <span>Publish & Start Reverse Bidding</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        </div>

        {/* ACTIVE & PAST REQUESTS LIST (Right Column: 7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
              <div>
                <h2 className="text-sm font-bold uppercase tracking-wider text-slate-800">My Renovation Requests</h2>
                <p className="text-xs text-slate-400">Real-time status, live countdowns & bids</p>
              </div>

              {/* Tabs */}
              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg border border-slate-200 text-xs">
                {(['all', 'open', 'closed'] as const).map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setActiveTab(tab)}
                    className={`px-2.5 py-1 rounded-md text-xs font-bold uppercase tracking-wider transition-all ${
                      activeTab === tab
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    {tab === 'all' ? `All (${requests.length})` : tab}
                  </button>
                ))}
              </div>
            </div>

            {/* Requests List */}
            {loadingRequests ? (
              <div className="py-12 text-center text-xs text-slate-500 flex items-center justify-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-sky-600" />
                <span>Loading your project requests from Firestore...</span>
              </div>
            ) : filteredRequests.length === 0 ? (
              <div className="py-12 text-center text-xs text-slate-500">
                {activeTab === 'open'
                  ? 'No active reverse biddings currently in progress.'
                  : activeTab === 'closed'
                  ? 'No completed renovation requests yet.'
                  : 'You have not submitted any quote requests yet. Fill out the form on the left to start receiving contractor bids!'}
              </div>
            ) : (
              <div className="divide-y divide-slate-100 mt-1">
                {filteredRequests.map((req) => {
                  const isLowestBidActive = req.current_lowest_bid !== null;
                  const discountPercentage = isLowestBidActive
                    ? Math.round(
                        ((req.initial_estimated_price - req.current_lowest_bid!) /
                          req.initial_estimated_price) *
                          100
                      )
                    : 0;

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
                            {req.sqft.toLocaleString()} sqft
                          </span>
                          <span className="text-xs text-slate-400">•</span>
                          <span className="text-xs text-slate-600 truncate max-w-[200px]">
                            {req.location}
                          </span>
                        </div>

                        {/* Status Badge & Synced Timer */}
                        <div className="flex items-center gap-2">
                          {req.status === 'open' ? (
                            <SyncedCountdown
                              closesAt={req.closes_at}
                              compact
                              onExpire={() => resolveQuoteRequest(req.id)}
                            />
                          ) : req.status === 'closed' ? (
                            <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 border border-emerald-200 text-[10px] font-bold uppercase tracking-wider rounded-md flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3" /> Finalized
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 bg-amber-100 text-amber-800 border border-amber-200 text-[10px] font-bold uppercase tracking-wider rounded-md">
                              No Bids
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Pricing Row */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs bg-white p-2.5 rounded-lg border border-slate-200">
                        <div>
                          <span className="text-slate-400 block text-[10px] font-bold uppercase tracking-wider">Ceiling:</span>
                          <span className="font-semibold text-slate-700 font-mono">
                            ₹{req.initial_estimated_price.toLocaleString('en-IN')}
                          </span>
                        </div>

                        <div>
                          <span className="text-slate-400 block text-[10px] font-bold uppercase tracking-wider">
                            {req.status === 'closed' ? 'Winning Price:' : 'Lowest Quote:'}
                          </span>
                          <span className="font-bold text-sky-950 text-xs font-mono">
                            ₹
                            {(
                              req.final_bid ??
                              req.current_lowest_bid ??
                              req.initial_estimated_price
                            ).toLocaleString('en-IN')}
                          </span>
                        </div>

                        <div>
                          <span className="text-slate-400 block text-[10px] font-bold uppercase tracking-wider">Savings:</span>
                          <span className="font-bold text-emerald-600">
                            {discountPercentage > 0 ? `${discountPercentage}% Off` : 'Awaiting Bids'}
                          </span>
                        </div>

                        <div>
                          <span className="text-slate-400 block text-[10px] font-bold uppercase tracking-wider">Bids:</span>
                          <span className="font-semibold text-slate-800">
                            {req.bid_count || 0} placed
                          </span>
                        </div>
                      </div>

                      {/* Winner Info or No-Bid banner if finalized */}
                      {req.status === 'closed' && req.winner_name && (
                        <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-lg text-xs flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <ShieldCheck className="w-4 h-4 text-emerald-700 shrink-0" />
                            <div>
                              <span className="text-slate-500">Winning Contractor: </span>
                              <span className="font-bold text-slate-900">{req.winner_name}</span>
                            </div>
                          </div>
                          <span className="font-bold text-emerald-800 text-xs font-mono">
                            ₹{req.final_bid?.toLocaleString('en-IN')}
                          </span>
                        </div>
                      )}

                      {req.status === 'no_bids' && (
                        <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800 font-medium">
                          No shopkers available right now, please try again later.
                        </div>
                      )}

                      {/* Action Button */}
                      <div className="flex items-center justify-end pt-1">
                        <button
                          id={`view-request-btn-${req.id}`}
                          type="button"
                          onClick={() => setSelectedRequestForModal(req)}
                          className="px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold uppercase tracking-wider rounded-lg flex items-center gap-1.5 transition-colors"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>{req.status === 'open' ? 'View Live Bidding Room' : 'View Full Details'}</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
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
