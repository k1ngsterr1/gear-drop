import type { MockPaymentPort } from '../application/checkout.js';
import type { PaymentDecision } from '../domain/order.js';

export class MockPayment implements MockPaymentPort {
  authorize(decision: PaymentDecision, totalCents: number): boolean {
    return decision === 'approve' && totalCents > 0;
  }
}
