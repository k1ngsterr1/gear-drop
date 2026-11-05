'use client';

import Link from 'next/link';
import { Minus, Plus, X } from 'lucide-react';
import { formatMoney } from '@/shared/lib/format-money';
import { canIncrease, changeQuantity, useCart } from '@/entities/cart';

export function BagSummary({ locked }: { locked: boolean }) {
  const lines = useCart();
  const subtotal = lines.reduce((total, line) => total + line.quantity * line.priceCents, 0);

  return (
    <section className="checkout-panel" aria-labelledby="bag-title">
      <h2 id="bag-title">Order summary</h2>
      <ul className="bag-lines">
        {lines.map((line) => (
          <li key={line.variantId}>
            <div>
              <Link href={`/products/${line.slug}`} prefetch={false}>{line.name}</Link>
              <small>{line.variant}</small>
              <div className="stepper">
                <button type="button" disabled={locked} aria-label={`Decrease ${line.name} quantity`} onClick={() => changeQuantity(line.variantId, -1)}><Minus size={14} /></button>
                <span>{line.quantity}</span>
                <button type="button" disabled={locked || !canIncrease(line)} aria-label={`Increase ${line.name} quantity`} onClick={() => changeQuantity(line.variantId, 1)}><Plus size={14} /></button>
              </div>
            </div>
            <div className="bag-line-end">
              <strong>{formatMoney(line.priceCents * line.quantity)}</strong>
              <button type="button" disabled={locked} className="icon-button" aria-label={`Remove ${line.name}`} onClick={() => changeQuantity(line.variantId, 'remove')}><X size={16} /></button>
            </div>
          </li>
        ))}
      </ul>
      <div className="order-total"><span>Subtotal</span><strong>{formatMoney(subtotal)}</strong></div>
      <p className="muted">Prices and availability are checked at checkout.</p>
    </section>
  );
}
