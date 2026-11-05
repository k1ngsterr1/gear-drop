'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Check, ShoppingBag } from 'lucide-react';
import type { Product } from '@gear-drop/contracts';
import { addLine, canIncrease, useCartQuantity, useCartReady } from '@/entities/cart';

export function ProductOptions({ product }: { product: Product }) {
  const first = product.variants.find((variant) => variant.stock > 0) ?? product.variants[0];
  const [selectedId, setSelectedId] = useState(first?.id);
  const [message, setMessage] = useState('');
  const selected = product.variants.find((variant) => variant.id === selectedId) ?? first;
  const ready = useCartReady();
  const inBag = useCartQuantity(selected?.id ?? '');

  if (!selected) return <p className="muted">This item is unavailable.</p>;
  const canAdd = canIncrease({ quantity: inBag, stock: selected.stock });

  return (
    <div className="product-options">
      <fieldset disabled={!ready}>
        <legend>Finish <strong>{selected.label}</strong></legend>
        <div className="swatches">
          {product.variants.map((variant) => (
            <label key={variant.id} className="swatch" style={{ backgroundColor: variant.swatch }}>
              <input
                type="radio"
                name="variant"
                value={variant.id}
                checked={selected.id === variant.id}
                onChange={() => { setSelectedId(variant.id); setMessage(''); }}
                aria-label={variant.label}
              />
            </label>
          ))}
        </div>
      </fieldset>
      <p className={selected.stock === 1 ? 'stock stock-low' : 'stock'}>
        <span />{selected.stock === 0 ? 'Sold out' : selected.stock === 1 ? 'Last one available' : 'In stock'}
      </p>
      <button
        className="action action-dark wide"
        type="button"
        disabled={!ready || !canAdd}
        onClick={async () => {
          const added = await addLine({
            variantId: selected.id,
            slug: product.slug,
            name: product.name,
            variant: selected.label,
            priceCents: product.priceCents,
            stock: selected.stock,
          });
          setMessage(added ? 'Added to your bag.' : 'Your bag is full.');
        }}
      >
        <ShoppingBag size={18} aria-hidden="true" /> {selected.stock === 0 ? 'Sold out' : canAdd ? 'Add to bag' : 'Limit reached'}
      </button>
      <div className="bag-feedback" role="status">
        {message && <><Check size={16} /> {message}</>}
        {inBag > 0 && <Link href="/checkout" prefetch={false}>View bag ({inBag})</Link>}
      </div>
    </div>
  );
}
