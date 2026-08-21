import React, { useState, useEffect } from 'react';
import { QuoteRequest, Bid, UserProfile } from '../types';
import { SyncedCountdown } from './SyncedCountdown';
import {
  X,
  Clock,
  MapPin,
  Maximize2,
  DollarSign,
  TrendingDown,
  ShieldCheck,
  AlertCircle,
  CheckCircle2,
  Phone,
  Mail,
  User,
  History,
  Send,
  Loader2,
  Award,
} from 'lucide-react';
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  addDoc,
  doc,
  updateDoc,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { resolveQuoteRequest } from '../lib/requestHelpers';
import { sendNotificationToUser } from '../lib/notifications';
import confetti from 'canvas-confetti';

interface RequestDetailsModalProps {
  request: QuoteRequest;
  currentUserProfile: UserProfile;
  onClose: () => void;
}

export const RequestDetailsModal: React.FC<RequestDetailsModalProps> = ({
  request: initialRequest,
  currentUserProfile,
  onClose,
}) => {
  const [request, setRequest] = useState<QuoteRequest>(initialRequest);
  const [bids, setBids] = useState<Bid[]>([]);
  const [newBidAmount, setNewBidAmount] = useState<string>('');
  const [isSubmittingBid, setIsSubmittingBid] = useState<boolean>(false);
  const [bidError, setBidError] = useState<string | null>(null);
  const [bidSuccess, setBidSuccess] = useState<string | null>(null);

  const isCustomerOwner = currentUserProfile.id === request.customer_id;
  const isShopker = currentUserProfile.role === 'shopker';

  // Listen to request doc changes in real-time
  useEffect(() => {
    const reqRef = doc(db, 'Requests', initialRequest.id);
    const unsubscribeReq = onSnapshot(reqRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = { id: docSnap.id, ...docSnap.data() } as QuoteRequest;
        setRequest(data);

        // Check if expired and open
        const now = Date.now();
        const closeTime = new Date(data.closes_at).getTime();
        if (data.status === 'open' && closeTime <= now) {
          resolveQuoteRequest(data.id);
        }

        // Trigger confetti if closed and current user won
        if (data.status === 'closed' && data.winner_id === currentUserProfile.id) {
          confetti({
            particleCount: 80,
            spread: 70,
            origin: { y: 0.6 },
          });
        }
      }
    });

    // Listen to bids stream in real-time
    const bidsQuery = query(
      collection(db, 'Bids'),
      where('request_id', '==', initialRequest.id),
      orderBy('bid_amount', 'asc')
    );

    const unsubscribeBids = onSnapshot(bidsQuery, (snap) => {
      const bidList: Bid[] = [];
      snap.forEach((bDoc) => {
        bidList.push({ id: bDoc.id, ...bDoc.data() } as Bid);
      });
      setBids(bidList);
    });

    return () => {
      unsubscribeReq();
      unsubscribeBids();
    };
  }, [initialRequest.id, currentUserProfile.id]);

  const currentLowestPrice =
    request.current_lowest_bid !== null
      ? request.current_lowest_bid
      : request.initial_estimated_price;

  const handleExpire = async () => {
    if (request.status === 'open') {
      await resolveQuoteRequest(request.id);
    }
  };

  const handlePlaceBid = async (e: React.FormEvent) => {
    e.preventDefault();
    setBidError(null);
    setBidSuccess(null);

    if (!isShopker) {
      setBidError('Only verified Shopkers can place bids on requests.');
      return;
    }

    if (!currentUserProfile.email_verified || !currentUserProfile.phone_verified) {
      setBidError('Account must be fully verified (email & phone) to submit bids.');
      return;
    }

    const amount = parseFloat(newBidAmount);
    if (isNaN(amount) || amount <= 0) {
      setBidError('Please enter a valid numeric bid amount.');
      return;
    }

    if (amount >= currentLowestPrice) {
      setBidError(
        `Your bid (₹${amount.toLocaleString('en-IN')}) must be lower than the current lowest price (₹${currentLowestPrice.toLocaleString('en-IN')}).`
      );
      return;
    }

    setIsSubmittingBid(true);
    try {
      // 1. Create Bid document
      const bidData: Omit<Bid, 'id'> = {
        request_id: request.id,
        shopker_id: currentUserProfile.id,
        shopker_name: currentUserProfile.name,
        shopker_phone: currentUserProfile.phone,
        bid_amount: amount,
        submitted_at: new Date().toISOString(),
      };

      await addDoc(collection(db, 'Bids'), bidData);

      // 2. Update Request doc with new lowest bid & bid count
      const updatedBidCount = (request.bid_count || 0) + 1;
      await updateDoc(doc(db, 'Requests', request.id), {
        current_lowest_bid: amount,
        lowest_bid_shopker_id: currentUserProfile.id,
        bid_count: updatedBidCount,
      });

      // 3. Notify the customer in real-time
      await sendNotificationToUser(
        request.customer_id,
        '📉 New Lower Bid Received!',
        `A contractor just lowered the quote to ₹${amount.toLocaleString('en-IN')} for your ${request.sqft} sqft project!`,
        'bid_received',
        request.id
      );

      // 4. Notify previously lowest shopker if outbid
      if (
        request.lowest_bid_shopker_id &&
        request.lowest_bid_shopker_id !== currentUserProfile.id
      ) {
        await sendNotificationToUser(
          request.lowest_bid_shopker_id,
          '⚠️ You were outbid!',
          `A contractor placed a lower bid of ₹${amount.toLocaleString('en-IN')} on the ${request.tier} job in ${request.location}. Bid again to win!`,
          'outbid',
          request.id
        );
      }

      setBidSuccess(`Bid placed successfully at ₹${amount.toLocaleString('en-IN')}!`);
      setNewBidAmount('');
    } catch (err: any) {
      console.error('Bid placement error:', err);
      setBidError(`Failed to submit bid: ${err.message}`);
    } finally {
      setIsSubmittingBid(false);
    }
  };

  const parsedBidAmount = parseFloat(newBidAmount) || 0;
  const estimatedPlatformFee = Math.round(parsedBidAmount * 0.02 * 100) / 100;
  const estimatedPayout = Math.round(parsedBidAmount * 0.98 * 100) / 100;

  const isUserWinner = request.status === 'closed' && request.winner_id === currentUserProfile.id;
  const isUserCustomer = currentUserProfile.id === request.customer_id;

  return (
    <div
      id="request-details-modal-overlay"
      className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto animate-in fade-in"
    >
      <div
        id="request-details-modal-content"
        className="bg-white border border-slate-200 rounded-xl w-full max-w-3xl shadow-xl overflow-hidden my-8 max-h-[90vh] flex flex-col"
      >
        {/* Header */}
        <div className="p-5 border-b border-slate-200 bg-slate-50/70 flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span
                className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider ${
                  request.tier === 'premium'
                    ? 'bg-amber-100 text-amber-900 border border-amber-300'
                    : request.tier === 'mid'
                    ? 'bg-sky-100 text-sky-900 border border-sky-200'
                    : 'bg-slate-200 text-slate-800'
                }`}
              >
                {request.tier} Tier
              </span>
              <span className="text-[11px] text-slate-400 font-mono">ID: {request.id.slice(0, 8)}</span>
            </div>
            <h3 className="text-lg sm:text-xl font-bold text-slate-800 tracking-tight">
              {request.sqft.toLocaleString()} sqft Renovation & Interior Design
            </h3>
            <div className="flex items-center gap-1.5 text-xs text-slate-500 mt-1">
              <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span>{request.location}</span>
            </div>
          </div>

          <button
            id="close-request-modal-btn"
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-900 hover:bg-slate-200/60 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="p-5 overflow-y-auto space-y-5">
          {/* Status & Synced Countdown Banner */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-slate-50 border border-slate-200 rounded-xl gap-4">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
                Bidding Status
              </span>
              <div className="flex items-center gap-2">
                <span
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold ${
                    request.status === 'open'
                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                      : request.status === 'closed'
                      ? 'bg-slate-800 text-white'
                      : 'bg-amber-100 text-amber-800 border border-amber-200'
                  }`}
                >
                  <span
                    className={`w-2 h-2 rounded-full ${
                      request.status === 'open'
                        ? 'bg-emerald-500 animate-ping'
                        : request.status === 'closed'
                        ? 'bg-slate-400'
                        : 'bg-amber-500'
                    }`}
                  />
                  {request.status === 'open'
                    ? 'Live Reverse Auction'
                    : request.status === 'closed'
                    ? 'Bidding Finalized'
                    : 'Closed (No Bids)'}
                </span>

                <span className="text-xs text-slate-500 font-medium">
                  {request.bid_count || bids.length} bids placed
                </span>
              </div>
            </div>

            {request.status === 'open' ? (
              <SyncedCountdown closesAt={request.closes_at} onExpire={handleExpire} />
            ) : (
              <div className="text-right">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-0.5">
                  Ended At
                </span>
                <span className="text-xs text-slate-700 font-mono font-medium">
                  {new Date(request.closes_at).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </div>
            )}
          </div>

          {/* Pricing Highlight Bento */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block mb-1">Ceiling Price</span>
              <span className="text-lg font-bold text-slate-700">
                ₹{request.initial_estimated_price.toLocaleString('en-IN')}
              </span>
              <span className="text-[11px] text-slate-400 block mt-0.5">
                Market rate + {request.markup_percent}%
              </span>
            </div>

            <div className="p-3.5 bg-sky-50/70 border border-sky-200 rounded-xl">
              <span className="text-[11px] font-bold uppercase tracking-wider text-sky-800 block mb-1">Lowest Quote</span>
              <span className="text-xl font-bold text-sky-950">
                ₹{(request.current_lowest_bid ?? request.initial_estimated_price).toLocaleString('en-IN')}
              </span>
              <span className="text-[11px] text-sky-700 block mt-0.5 font-medium">
                {request.current_lowest_bid !== null
                  ? `Saved ₹${(request.initial_estimated_price - request.current_lowest_bid).toLocaleString('en-IN')}!`
                  : 'Awaiting first reverse bid'}
              </span>
            </div>

            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block mb-1">Total Savings</span>
              <span className="text-lg font-bold text-emerald-600">
                {request.current_lowest_bid !== null
                  ? `${Math.round(
                      ((request.initial_estimated_price - request.current_lowest_bid) /
                        request.initial_estimated_price) *
                        100
                    )}% Discount`
                  : '0%'}
              </span>
              <span className="text-[11px] text-slate-400 block mt-0.5">Reverse auction bidding</span>
            </div>
          </div>

          {/* POST-CLOSING RESULT CARDS */}
          {request.status === 'closed' && (
            <div
              id="closed-result-card"
              className={`p-4 sm:p-5 rounded-xl border ${
                isUserWinner
                  ? 'bg-emerald-50 border-emerald-300 text-emerald-950'
                  : 'bg-slate-50 border-slate-200 text-slate-900'
              }`}
            >
              {isUserWinner ? (
                <div>
                  <div className="flex items-center gap-2 mb-2 text-emerald-800">
                    <Award className="w-5 h-5 text-emerald-600" />
                    <h4 className="text-base font-bold">You Won This Project! 🎉</h4>
                  </div>
                  <p className="text-xs text-emerald-800 mb-4 leading-relaxed">
                    Congratulations! Your bid of <strong>₹{request.final_bid?.toLocaleString('en-IN')}</strong> was the lowest.
                    Here are the customer's direct contact details to coordinate site visits and contracts.
                  </p>

                  <div className="bg-white p-3.5 rounded-lg border border-emerald-200 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs mb-3">
                    <div>
                      <span className="text-slate-400 text-[11px] uppercase tracking-wider font-bold block mb-0.5">Customer Name:</span>
                      <span className="font-bold text-slate-900">{request.customer_name}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 text-[11px] uppercase tracking-wider font-bold block mb-0.5">Location:</span>
                      <span className="font-semibold text-slate-800">{request.location}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 text-[11px] uppercase tracking-wider font-bold block mb-0.5">Phone Contact:</span>
                      <a
                        href={`tel:${request.customer_phone}`}
                        className="font-bold text-emerald-700 hover:underline flex items-center gap-1"
                      >
                        <Phone className="w-3.5 h-3.5" />
                        {request.customer_phone || 'Provided upon connection'}
                      </a>
                    </div>
                    <div>
                      <span className="text-slate-400 text-[11px] uppercase tracking-wider font-bold block mb-0.5">Email Contact:</span>
                      <a
                        href={`mailto:${request.customer_email}`}
                        className="font-bold text-emerald-700 hover:underline flex items-center gap-1"
                      >
                        <Mail className="w-3.5 h-3.5" />
                        {request.customer_email || 'Provided upon connection'}
                      </a>
                    </div>
                  </div>

                  {/* Payout breakdown */}
                  <div className="p-3 bg-emerald-100/50 rounded-lg text-xs space-y-1 text-emerald-900 font-medium">
                    <div className="flex justify-between">
                      <span>Winning Contract Bid:</span>
                      <span className="font-bold">₹{request.final_bid?.toLocaleString('en-IN')}</span>
                    </div>
                    <div className="flex justify-between text-emerald-700">
                      <span>Platform Fee (2%):</span>
                      <span>-₹{request.platform_fee?.toLocaleString('en-IN')}</span>
                    </div>
                    <div className="flex justify-between pt-1 border-t border-emerald-200 text-emerald-950 font-bold text-sm">
                      <span>Your Net Payout:</span>
                      <span>₹{request.shopker_payout?.toLocaleString('en-IN')}</span>
                    </div>
                  </div>
                </div>
              ) : isUserCustomer ? (
                <div>
                  <div className="flex items-center gap-2 mb-2 text-slate-900">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                    <h4 className="text-base font-bold">Winning Contractor Finalized</h4>
                  </div>
                  <p className="text-xs text-slate-600 mb-3">
                    The reverse bidding window has closed. The lowest verified bid was submitted by{' '}
                    <strong>{request.winner_name}</strong> at{' '}
                    <span className="font-bold text-emerald-700">
                      ₹{request.final_bid?.toLocaleString('en-IN')}
                    </span>
                    .
                  </p>

                  <div className="bg-white p-3.5 rounded-lg border border-slate-200 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div>
                      <span className="text-slate-400 text-[11px] uppercase tracking-wider font-bold block mb-0.5">Contractor:</span>
                      <span className="font-bold text-slate-900">{request.winner_name}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 text-[11px] uppercase tracking-wider font-bold block mb-0.5">Final Project Price:</span>
                      <span className="font-bold text-emerald-700">
                        ₹{request.final_bid?.toLocaleString('en-IN')}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 text-[11px] uppercase tracking-wider font-bold block mb-0.5">Contractor Phone:</span>
                      <a
                        href={`tel:${request.winner_phone}`}
                        className="font-bold text-sky-600 hover:underline flex items-center gap-1"
                      >
                        <Phone className="w-3.5 h-3.5" />
                        {request.winner_phone || 'Verified on platform'}
                      </a>
                    </div>
                    <div>
                      <span className="text-slate-400 text-[11px] uppercase tracking-wider font-bold block mb-0.5">Contractor Email:</span>
                      <a
                        href={`mailto:${request.winner_email}`}
                        className="font-bold text-sky-600 hover:underline flex items-center gap-1"
                      >
                        <Mail className="w-3.5 h-3.5" />
                        {request.winner_email || 'Verified on platform'}
                      </a>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-2">
                  <h4 className="text-sm font-bold text-slate-800 mb-1">Request Closed</h4>
                  <p className="text-xs text-slate-600">
                    This job finalized at <strong>₹{request.final_bid?.toLocaleString('en-IN')}</strong> by{' '}
                    {request.winner_name}. Thank you for participating!
                  </p>
                </div>
              )}
            </div>
          )}

          {/* NO-BIDS BANNER (Requirement 8) */}
          {request.status === 'no_bids' && (
            <div
              id="no-bids-result-banner"
              className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-center"
            >
              <div className="w-9 h-9 bg-amber-100 text-amber-800 rounded-lg mx-auto flex items-center justify-center mb-2">
                <Clock className="w-5 h-5" />
              </div>
              <h4 className="text-sm font-bold text-amber-900 mb-1">
                No shopkers available right now, please try again later
              </h4>
              <p className="text-xs text-amber-800 max-w-md mx-auto">
                No contractor bids were submitted before the timer expired. You can re-open this quote request or adjust the square footage and timing window.
              </p>
            </div>
          )}

          {/* SHOPKER BIDDING INPUT (Only for Shopkers when Request is Open) */}
          {isShopker && request.status === 'open' && (
            <div className="p-4 bg-slate-900 text-white rounded-xl">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-200">Submit Lower Reverse Bid</h4>
                <span className="text-xs text-slate-400">
                  Ceiling: ₹{currentLowestPrice.toLocaleString('en-IN')}
                </span>
              </div>

              {bidError && (
                <div className="mb-3 p-3 bg-rose-500/20 border border-rose-500/40 rounded-lg text-rose-200 text-xs flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  <span>{bidError}</span>
                </div>
              )}

              {bidSuccess && (
                <div className="mb-3 p-3 bg-emerald-500/20 border border-emerald-500/40 rounded-lg text-emerald-200 text-xs flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <span>{bidSuccess}</span>
                </div>
              )}

              <form onSubmit={handlePlaceBid} className="space-y-3">
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs">
                      ₹
                    </span>
                    <input
                      id="shopker-bid-input"
                      type="number"
                      step="1"
                      min="1"
                      max={currentLowestPrice - 1}
                      value={newBidAmount}
                      onChange={(e) => setNewBidAmount(e.target.value)}
                      placeholder={`Amount < ₹${currentLowestPrice.toLocaleString('en-IN')}`}
                      className="w-full pl-7 pr-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-xs font-semibold focus:outline-hidden focus:ring-2 focus:ring-sky-500"
                    />
                  </div>

                  <button
                    id="submit-reverse-bid-btn"
                    type="submit"
                    disabled={isSubmittingBid || !newBidAmount}
                    className="px-4 py-2 bg-sky-600 hover:bg-sky-500 disabled:bg-slate-800 text-white text-xs font-bold uppercase tracking-wider rounded-lg transition-all shadow-xs flex items-center gap-1.5 shrink-0"
                  >
                    {isSubmittingBid ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Send className="w-4 h-4" />
                    )}
                    <span>Place Bid</span>
                  </button>
                </div>

                {parsedBidAmount > 0 && parsedBidAmount < currentLowestPrice && (
                  <div className="p-2.5 bg-slate-800/80 rounded-lg text-xs flex items-center justify-between text-slate-300">
                    <span>
                      Platform Fee (2%): <strong>₹{estimatedPlatformFee.toLocaleString('en-IN')}</strong>
                    </span>
                    <span className="text-emerald-400 font-bold">
                      Payout: ₹{estimatedPayout.toLocaleString('en-IN')}
                    </span>
                  </div>
                )}
              </form>
            </div>
          )}

          {/* REAL-TIME BIDS LOG / AUDIT STREAM */}
          <div>
            <div className="flex items-center justify-between mb-2.5">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                <History className="w-4 h-4 text-slate-500" />
                <span>Reverse Bidding Activity ({bids.length})</span>
              </h4>
              <span className="text-[11px] text-slate-400 font-medium">
                {request.status === 'open' ? 'Live Updating' : 'Finalized'}
              </span>
            </div>

            {bids.length === 0 ? (
              <div className="py-6 text-center bg-slate-50 rounded-xl border border-slate-200 text-slate-500 text-xs">
                No contractor bids placed yet. As Shopkers submit competitive lower bids, they will appear here live.
              </div>
            ) : (
              <div className="space-y-1.5 max-h-60 overflow-y-auto">
                {bids.map((bid, idx) => {
                  const isLowest = idx === 0;
                  const isMyBid = bid.shopker_id === currentUserProfile.id;

                  return (
                    <div
                      key={bid.id}
                      className={`p-2.5 rounded-lg border flex items-center justify-between text-xs transition-all ${
                        isLowest
                          ? 'bg-sky-50/80 border-sky-200 font-semibold text-sky-950 shadow-xs'
                          : 'bg-slate-50 border-slate-200 text-slate-700'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className={`w-5 h-5 rounded-md flex items-center justify-center text-[10px] font-bold ${
                            isLowest ? 'bg-sky-600 text-white' : 'bg-slate-200 text-slate-600'
                          }`}
                        >
                          #{idx + 1}
                        </span>

                        <div>
                          <div className="flex items-center gap-1.5">
                            {/* Hide contractor name from customer during open bidding */}
                            <span className="text-xs">
                              {request.status === 'closed' || isShopker
                                ? bid.shopker_name
                                : isMyBid
                                ? 'Your Bid'
                                : `Contractor #${bid.shopker_id.slice(0, 4)}`}
                            </span>
                            {isMyBid && (
                              <span className="px-1.5 py-0.2 bg-slate-200 text-slate-800 rounded-sm text-[10px] font-bold">
                                You
                              </span>
                            )}
                            {isLowest && (
                              <span className="px-1.5 py-0.2 bg-sky-200 text-sky-900 rounded-sm text-[10px] font-bold">
                                Current Lowest
                              </span>
                            )}
                          </div>
                          <span className="text-[10px] text-slate-400 font-mono">
                            {new Date(bid.submitted_at).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                              second: '2-digit',
                            })}
                          </span>
                        </div>
                      </div>

                      <div className="text-right">
                        <span className="text-xs font-bold">₹{bid.bid_amount.toLocaleString('en-IN')}</span>
                        {idx < bids.length - 1 && (
                          <span className="text-[10px] text-emerald-600 block font-medium">
                            -₹{(request.initial_estimated_price - bid.bid_amount).toLocaleString('en-IN')} saved
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-3.5 border-t border-slate-200 bg-slate-50/80 flex items-center justify-end">
          <button
            id="modal-close-action-btn"
            type="button"
            onClick={onClose}
            className="px-3.5 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-bold uppercase tracking-wider rounded-lg transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
