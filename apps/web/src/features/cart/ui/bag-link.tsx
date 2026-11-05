'use client';

import Link from 'next/link';
import { ShoppingBag } from 'lucide-react';
import { useCartCount } from '@/entities/cart';

export function BagLink() {
  const count = useCartCount();
  return (
    <Link className="bag-link" href="/checkout" prefetch={false} aria-label={`Bag, ${count} ${count === 1 ? 'item' : 'items'}`}>
      <ShoppingBag size={17} aria-hidden="true" />
      <span>Bag</span><span className="bag-count">{count}</span>
    </Link>
  );
}
