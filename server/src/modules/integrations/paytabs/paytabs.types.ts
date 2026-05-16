/**
 * PayTabs API Types
 * Based on PayTabs PT2 API Endpoints documentation
 * Region endpoint for UAE (ARE): https://secure.paytabs.com
 */

// ─── Create Payment Page ────────────────────────────────────────────────────

export interface PayTabsCreateOrderRequest {
  profile_id: number;
  tran_type: 'sale' | 'auth' | 'void' | 'capture' | 'refund' | 'void_refund';
  tran_class: 'ecom' | 'recurring' | 'moto';
  cart_id: string;
  cart_description: string;
  cart_currency: string;
  /** Amount in decimal units (NOT minor units — PayTabs uses e.g. 12.50 for AED 12.50) */
  cart_amount: number;
  /** Redirect URL after payment completes */
  return: string;
  /** IPN/Webhook callback URL */
  callback: string;
  customer_details?: PayTabsCustomerDetails;
  shipping_details?: PayTabsCustomerDetails;
  hide_shipping?: boolean;
  payment_methods?: string[];
  framed?: boolean;
}

export interface PayTabsCustomerDetails {
  name: string;
  email: string;
  phone?: string;
  street1?: string;
  city?: string;
  state?: string;
  country?: string;
  zip?: string;
  ip?: string;
}

export interface PayTabsCreateOrderResponse {
  tran_ref?: string;
  redirect_url?: string;
  payment_url?: string;
  /** HTTP response code (internal PayTabs field) */
  code?: string;
  message?: string;
  /** Non-zero if error */
  response_code?: string;
  response_message?: string;
}

// ─── Query / Verify Transaction ─────────────────────────────────────────────

export interface PayTabsQueryRequest {
  profile_id: number;
  tran_ref: string;
}

export interface PayTabsQueryResponse {
  tran_ref?: string;
  cart_id?: string;
  cart_currency?: string;
  /** Amount in decimal (e.g. 12.50) */
  cart_amount?: number;
  tran_type?: string;
  tran_class?: string;
  /** e.g. "A" = Authorised/Approved, "V" = Voided, "R" = Refunded */
  payment_result?: {
    response_status: string;
    response_code: string;
    response_message: string;
    transaction_time?: string;
  };
  payment_info?: {
    payment_method?: string;
    card_type?: string;
    card_scheme?: string;
    payment_description?: string;
  };
  response_code?: string;
  response_message?: string;
}

// ─── Refund Transaction ─────────────────────────────────────────────────────

export interface PayTabsRefundRequest {
  profile_id: number;
  tran_type: 'refund';
  tran_class: 'ecom';
  /** New unique cart ID for refund transaction */
  cart_id: string;
  cart_description: string;
  cart_currency: string;
  /** Amount to refund (decimal units) */
  cart_amount: number;
  /** Original transaction reference to refund */
  tran_ref: string;
}

export interface PayTabsRefundResponse {
  tran_ref?: string;
  payment_result?: {
    response_status: string;
    response_code: string;
    response_message: string;
  };
  response_code?: string;
  response_message?: string;
}

// ─── Webhook / IPN Payload ──────────────────────────────────────────────────

export interface PayTabsWebhookPayload {
  tran_ref: string;
  cart_id: string;
  cart_description?: string;
  cart_currency?: string;
  cart_amount?: number;
  tran_type?: string;
  tran_class?: string;
  payment_result?: {
    response_status: string;
    response_code: string;
    response_message: string;
    transaction_time?: string;
  };
  customer_details?: PayTabsCustomerDetails;
  /** Signature provided in the callback for verification */
  signature?: string;
}
