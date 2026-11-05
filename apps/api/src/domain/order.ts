export type PaymentDecision = 'approve' | 'decline';
export type OrderErrorCode = 'INVALID_REQUEST' | 'ITEM_UNAVAILABLE' | 'OUT_OF_STOCK' | 'PAYMENT_DECLINED' | 'IDEMPOTENCY_CONFLICT';

export class OrderError extends Error {
  constructor(readonly code: OrderErrorCode, message: string, readonly variantId?: string) {
    super(message);
  }
}

export interface RequestedItem {
  variantId: string;
  quantity: number;
}

export function validateRequestedItems(items: RequestedItem[]) {
  if (items.length < 1 || items.length > 20) {
    throw new OrderError('INVALID_REQUEST', 'A bag must contain between 1 and 20 variants.');
  }
  const distinct = new Set<string>();
  for (const item of items) {
    if (!Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 10) {
      throw new OrderError('INVALID_REQUEST', 'Quantity must be between 1 and 10.', item.variantId);
    }
    if (distinct.has(item.variantId)) {
      throw new OrderError('INVALID_REQUEST', 'Each variant must occur once.', item.variantId);
    }
    distinct.add(item.variantId);
  }
}

export interface SellableVariant {
  variantId: string;
  name: string;
  variant: string;
  stock: number;
  unitPriceCents: number;
}

export type OrderItem = Omit<SellableVariant, 'stock'> & { quantity: number };

export interface PricedOrder {
  totalCents: number;
  items: OrderItem[];
}

export interface Receipt extends PricedOrder {
  id: string;
}

export function priceOrder(requested: RequestedItem[], inventory: SellableVariant[]): PricedOrder {
  const byId = new Map(inventory.map((variant) => [variant.variantId, variant]));
  const items = requested.map(({ variantId, quantity }) => {
    const match = byId.get(variantId);
    if (!match) throw new OrderError('ITEM_UNAVAILABLE', 'This variant is unavailable.', variantId);
    if (match.stock < quantity) {
      throw new OrderError('OUT_OF_STOCK', `${match.name} / ${match.variant} has only ${match.stock} left.`, variantId);
    }

    return { variantId, name: match.name, variant: match.variant, unitPriceCents: match.unitPriceCents, quantity };
  });

  return { items, totalCents: items.reduce((total, item) => total + item.unitPriceCents * item.quantity, 0) };
}
