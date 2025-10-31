// Database model types for bKash payment channel

import type { D1Database } from '@cloudflare/workers-types'

// Cloudflare Worker Bindings
export interface Bindings {
  DB: D1Database
}

export type ReceiverStatus = 'active' | 'disabled';

export interface Receiver {
  phone: string;
  label: string;
  status: ReceiverStatus;
  notes: string | null;
  created_at: string;
}

export interface Transaction {
  id: string;
  trxid: string;
  amount_cents: number;
  receiver_phone: string;
  sender_phone: string | null;
  received_at: string;
  created_at: string;
}

export type TrackingStatus = 
  | 'pending' 
  | 'submitted_trx' 
  | 'verified' 
  | 'failed' 
  | 'expired' 
  | 'canceled';

export type VerificationMethod = 'auto' | 'manual';

export interface CustomerInfo {
  name: string;
  phone: string;
  email: string;
}

export interface Tracking {
  tracking_id: string;
  item_code: string;
  payment_amount_cents: number;
  offered_receivers: string; // JSON array of phone numbers
  user_entered_trxid: string | null;
  customer_info_json: string; // JSON CustomerInfo
  form_data_json: string | null; // JSON object for additional form data
  ticket_choice: string;
  verification_method: VerificationMethod;
  status: TrackingStatus;
  matched_transaction_id: string | null;
  created_at: string;
  updated_at: string;
  expires_at: string;
  notes: string | null;
}

// Parsed versions with JSON fields converted to objects
export interface TrackingParsed extends Omit<Tracking, 'offered_receivers' | 'customer_info_json' | 'form_data_json'> {
  offered_receivers: string[];
  customer_info_json: CustomerInfo;
  form_data_json: Record<string, any> | null;
}

// Request/Response types for API endpoints

export interface CreateTrackingRequest {
  item_code: string;
  payment_amount_cents: number;
  customer_info: CustomerInfo;
  form_data?: Record<string, any>;
  ticket_choice: string;
}

export interface CreateTrackingResponse {
  tracking_id: string;
  redirect_url: string;
  expires_at: string;
}

export interface SubmitTrxRequest {
  trxid: string;
}

export interface SubmitTrxResponse {
  status: 'submitted' | 'verified' | 'error';
  message: string;
}

export interface ParsedSMS {
  trxid: string;
  amount_cents: number;
  sender_phone: string;
  received_at: string;
}

export interface WebhookSMSRequest {
  raw_sms: string;
  receiver_phone: string;
}

export interface WebhookSMSResponse {
  status: 'ok' | 'error';
  transaction_id?: string;
  parsed?: ParsedSMS;
  error?: string;
  field?: string;
}

export interface VerificationResult {
  success: boolean;
  reason?: string;
  tracking_id?: string;
  transaction_id?: string;
}
