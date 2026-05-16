export interface CreateOrderResult {
  orderId: string;
  paymentUrl: string;
  expiresAt: Date;
}

export interface VerifyPaymentResult {
  success: boolean;
  amount: number;
  currency: string;
  gatewayPaymentId: string;
  rawResponse: Record<string, unknown>;
}

export interface RefundResult {
  success: boolean;
  refundId: string;
  refundedAmount: number;
}

export interface IPaymentGateway {
  createOrder(params: {
    amount: number;
    currency: string;
    orderId: string;
    callbackUrl: string;
    customerEmail: string;
    customerName: string;
    description: string;
  }): Promise<CreateOrderResult>;

  verifyPayment(orderId: string): Promise<VerifyPaymentResult>;

  processRefund(params: {
    orderId: string;
    amount: number;
    reason: string;
  }): Promise<RefundResult>;

  verifyWebhookSignature(payload: unknown, signature: string): boolean;
}
