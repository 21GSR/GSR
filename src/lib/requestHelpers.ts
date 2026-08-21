import {
  collection,
  doc,
  getDocs,
  getDoc,
  updateDoc,
  query,
  where,
  orderBy,
  limit,
} from 'firebase/firestore';
import { db } from './firebase';
import { BudgetTier, QuoteRequest, ShopkerPricing, Bid } from '../types';
import { sendNotificationToUser } from './notifications';

// Default baseline rates in case no shopkers registered prices yet (in Rs / sqft)
export const DEFAULT_TIER_RATES = {
  classic: 1200, // ₹1,200/sqft
  mid: 1800,     // ₹1,800/sqft
  premium: 2800, // ₹2,800/sqft
};

export const DEFAULT_MARKUP_PERCENT = 10; // 10%

// Fetch average price per sqft across all registered shopkers for a given tier
export const calculateMarketRatePerSqFt = async (
  tier: BudgetTier
): Promise<{ avgRate: number; shopkerCount: number }> => {
  try {
    const snap = await getDocs(collection(db, 'ShopkerPricing'));
    if (snap.empty) {
      return { avgRate: DEFAULT_TIER_RATES[tier], shopkerCount: 0 };
    }

    let total = 0;
    let count = 0;

    snap.forEach((d) => {
      const data = d.data() as ShopkerPricing;
      let price = 0;
      if (tier === 'classic' && data.classic_price_per_sqft > 0) {
        price = data.classic_price_per_sqft;
      } else if (tier === 'mid' && data.mid_price_per_sqft > 0) {
        price = data.mid_price_per_sqft;
      } else if (tier === 'premium' && data.premium_price_per_sqft > 0) {
        price = data.premium_price_per_sqft;
      }

      if (price > 0) {
        total += price;
        count += 1;
      }
    });

    if (count === 0) {
      return { avgRate: DEFAULT_TIER_RATES[tier], shopkerCount: 0 };
    }

    return { avgRate: Math.round(total / count), shopkerCount: count };
  } catch (err) {
    console.error('Error fetching market rates:', err);
    return { avgRate: DEFAULT_TIER_RATES[tier], shopkerCount: 0 };
  }
};

// Calculate initial ceiling / estimate for quote request
export const calculateEstimatedQuote = (
  sqft: number,
  ratePerSqFt: number,
  markupPercent: number = DEFAULT_MARKUP_PERCENT
): number => {
  const baseCost = sqft * ratePerSqFt;
  const markupAmount = baseCost * (markupPercent / 100);
  return Math.round(baseCost + markupAmount);
};

// Auto-resolve / close request when timer ends
export const resolveQuoteRequest = async (requestId: string): Promise<QuoteRequest | null> => {
  try {
    const reqRef = doc(db, 'Requests', requestId);
    const reqSnap = await getDoc(reqRef);
    if (!reqSnap.exists()) return null;

    const currentReq = { id: reqSnap.id, ...reqSnap.data() } as QuoteRequest;
    if (currentReq.status !== 'open') {
      return currentReq;
    }

    // Query bids for this request, lowest first
    const bidsQuery = query(
      collection(db, 'Bids'),
      where('request_id', '==', requestId),
      orderBy('bid_amount', 'asc'),
      limit(1)
    );
    const bidsSnap = await getDocs(bidsQuery);

    if (bidsSnap.empty) {
      // No bids case
      const updatedData: Partial<QuoteRequest> = {
        status: 'no_bids',
        winner_id: null,
        final_bid: null,
        platform_fee: null,
        shopker_payout: null,
      };
      await updateDoc(reqRef, updatedData);

      // Notify customer
      await sendNotificationToUser(
        currentReq.customer_id,
        '⏰ Bidding Closed with No Bids',
        'No shopkers were available for your request right now. You can re-open or submit a new request anytime.',
        'request_closed',
        requestId
      );

      return { ...currentReq, ...updatedData };
    } else {
      // We have a winner!
      const winningBidDoc = bidsSnap.docs[0];
      const winningBid = winningBidDoc.data() as Bid;

      // Fetch shopker profile for details
      const shopkerUserRef = doc(db, 'Users', winningBid.shopker_id);
      const shopkerSnap = await getDoc(shopkerUserRef);
      const shopkerData = shopkerSnap.exists() ? shopkerSnap.data() : null;

      const finalBid = winningBid.bid_amount;
      const platformFee = Math.round(finalBid * 0.02 * 100) / 100; // 2% platform fee
      const shopkerPayout = Math.round(finalBid * 0.98 * 100) / 100; // 98% payout

      const updatedData: Partial<QuoteRequest> = {
        status: 'closed',
        winner_id: winningBid.shopker_id,
        winner_name: winningBid.shopker_name || shopkerData?.name || 'Verified Contractor',
        winner_phone: shopkerData?.phone || '',
        winner_email: shopkerData?.email || '',
        final_bid: finalBid,
        platform_fee: platformFee,
        shopker_payout: shopkerPayout,
      };

      await updateDoc(reqRef, updatedData);

      // 1. Notify winning shopker
      await sendNotificationToUser(
        winningBid.shopker_id,
        '🏆 You won this job!',
        `Congratulations! You won the ${currentReq.tier.toUpperCase()} project (${currentReq.sqft} sqft in ${currentReq.location}) with a final bid of ₹${finalBid.toLocaleString('en-IN')}. Customer: ${currentReq.customer_name} (${currentReq.customer_phone || currentReq.customer_email}).`,
        'won_job',
        requestId
      );

      // 2. Notify customer
      await sendNotificationToUser(
        currentReq.customer_id,
        '🎉 Quote Finalized!',
        `Your renovation request has been won by ${updatedData.winner_name} at ₹${finalBid.toLocaleString('en-IN')} (Saving you ₹${(currentReq.initial_estimated_price - finalBid).toLocaleString('en-IN')}!).`,
        'won_job',
        requestId
      );

      // 3. Notify other bidding shopkers
      const allBidsQuery = query(
        collection(db, 'Bids'),
        where('request_id', '==', requestId)
      );
      const allBidsSnap = await getDocs(allBidsQuery);
      allBidsSnap.forEach((bDoc) => {
        const bData = bDoc.data() as Bid;
        if (bData.shopker_id !== winningBid.shopker_id) {
          sendNotificationToUser(
            bData.shopker_id,
            'Request Closed',
            `The ${currentReq.tier} renovation job in ${currentReq.location} has closed. Another contractor placed the lowest bid (₹${finalBid.toLocaleString('en-IN')}).`,
            'request_closed',
            requestId
          );
        }
      });

      return { ...currentReq, ...updatedData };
    }
  } catch (err) {
    console.error('Error resolving request:', err);
    return null;
  }
};
