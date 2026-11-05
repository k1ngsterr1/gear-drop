import { OrderError, priceOrder, validateRequestedItems } from '../domain/order.js';
import type { PaymentDecision, PricedOrder, Receipt, RequestedItem, SellableVariant } from '../domain/order.js';

export interface CheckoutCommand {
  idempotencyKey: string;
  email: string;
  payment: PaymentDecision;
  items: RequestedItem[];
}

export interface CheckoutTransaction {
  findOrder(): Promise<{ matches: boolean; receipt: Receipt } | null>;
  lockInventory(variantIds: string[]): Promise<SellableVariant[]>;
  deductStock(items: RequestedItem[]): Promise<void>;
  saveOrder(order: PricedOrder): Promise<Receipt>;
}

export interface CheckoutStore {
  transact<T>(
    idempotencyKey: string,
    requestFingerprint: string,
    run: (tx: CheckoutTransaction) => Promise<T>,
  ): Promise<T>;
}

export interface MockPaymentPort {
  authorize(decision: PaymentDecision, totalCents: number): boolean;
}

export class Checkout {
  constructor(private readonly store: CheckoutStore, private readonly payment: MockPaymentPort) {}

  async execute(command: CheckoutCommand): Promise<Receipt> {
    validateRequestedItems(command.items);
    const { idempotencyKey, email, payment } = command;
    const items = [...command.items].sort((a, b) => a.variantId.localeCompare(b.variantId));
    const fingerprint = JSON.stringify([email, payment, items.map(({ variantId, quantity }) => [variantId, quantity])]);

    return this.store.transact(idempotencyKey, fingerprint, async (tx) => {
      const existing = await tx.findOrder();
      if (existing) {
        if (!existing.matches) throw new OrderError('IDEMPOTENCY_CONFLICT', 'Use a new key for a different order.');
        return existing.receipt;
      }

      const inventory = await tx.lockInventory(items.map(({ variantId }) => variantId));
      const order = priceOrder(items, inventory);
      if (!this.payment.authorize(payment, order.totalCents)) {
        throw new OrderError('PAYMENT_DECLINED', 'Demo payment declined. Select Approve and try again.');
      }
      await tx.deductStock(items);
      return tx.saveOrder(order);
    });
  }
}
