'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowRight, ShoppingBag } from 'lucide-react';
import { useCartCount, useCartReady, useLastOrderId } from '@/entities/cart';
import { BagSummary } from '@/features/cart';
import { PlaceOrderForm } from '@/features/place-order';

export function CheckoutWorkspace() {
  const [pending, setPending] = useState(false);
  const ready = useCartReady();
  const count = useCartCount();
  const lastOrderId = useLastOrderId();

  if (!ready) return <p className="checkout-loading" role="status">Loading your bag…</p>;
  return (
    <>
      {lastOrderId && (
        <Link href={`/orders/${lastOrderId}`} className="back-link" prefetch={false}>
          View last order <ArrowRight size={16} aria-hidden="true" />
        </Link>
      )}
      {count || pending ? (
        <div className="checkout-grid">
          <BagSummary locked={pending} />
          <PlaceOrderForm pending={pending} onPendingChange={setPending} />
        </div>
      ) : (
        <div className="empty-state">
          <ShoppingBag size={26} aria-hidden="true" />
          <h2>Your bag is empty</h2>
          <p>Explore the collection to find something for your desk.</p>
          <Link href="/#catalog" className="action action-dark" prefetch={false}>Browse gear <ArrowRight size={16} /></Link>
        </div>
      )}
    </>
  );
}
