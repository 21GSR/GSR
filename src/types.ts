export type UserRole = 'customer' | 'shopker';

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: UserRole;
  email_verified: boolean;
  phone_verified: boolean;
  created_at: string;
  updated_at?: string;
}

export type BudgetTier = 'classic' | 'mid' | 'premium';

export interface ShopkerPricing {
  shopker_id: string;
  shopker_name?: string;
  classic_price_per_sqft: number;
  mid_price_per_sqft: number;
  premium_price_per_sqft: number;
  updated_at: string;
}

export type RequestStatus = 'open' | 'closed' | 'no_bids';

export interface QuoteRequest {
  id: string;
  customer_id: string;
  customer_name: string;
  customer_phone?: string;
  customer_email?: string;
  sqft: number;
  tier: BudgetTier;
  location: string;
  timer_duration: number; // in minutes (5 to 120)
  initial_estimated_price: number;
  market_rate_per_sqft: number;
  markup_percent: number;
  current_lowest_bid: number | null;
  lowest_bid_shopker_id: string | null;
  bid_count: number;
  status: RequestStatus;
  created_at: string; // ISO string
  closes_at: string; // ISO string
  winner_id: string | null;
  winner_name: string | null;
  winner_phone?: string | null;
  winner_email?: string | null;
  final_bid: number | null;
  platform_fee: number | null; // 2% of winning bid
  shopker_payout: number | null; // 98% of winning bid
}

export interface Bid {
  id: string;
  request_id: string;
  shopker_id: string;
  shopker_name: string;
  shopker_phone?: string;
  bid_amount: number;
  submitted_at: string; // ISO string
}

export interface AppNotification {
  id: string;
  recipient_id: string;
  title: string;
  message: string;
  link_id?: string;
  type: 'new_request' | 'outbid' | 'won_job' | 'request_closed' | 'bid_received';
  read: boolean;
  created_at: string;
}
