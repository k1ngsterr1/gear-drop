'use client';

import { useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight } from 'lucide-react';
import { checkoutFailureSchema, checkoutInputSchema, orderReceiptSchema } from '@gear-drop/contracts';
import { prepareCheckout, recordOrder, useCartSnapshot } from '@/entities/cart';
import { getLegacyOrderKey } from '../model/order-attempt';

export function PlaceOrderForm({ pending, onPendingChange }: { pending: boolean; onPendingChange: (value: boolean) => void }) {
  const cart = useCartSnapshot();
  const router = useRouter();
  const lock = useRef(false);
  const [error, setError] = useState('');
  const isLegacyBag = cart.version === null && cart.lines.length > 0;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (lock.current || !cart.lines.length) return;
    const data = new FormData(event.currentTarget);
    const checkout = checkoutInputSchema.safeParse({
      email: data.get('email'),
      payment: data.get('payment'),
      items: cart.lines.map(({ variantId, quantity }) => ({ variantId, quantity })),
    });
    if (!checkout.success) {
      setError(checkout.error.issues[0]?.message ?? 'Check your checkout details.');
      return;
    }

    const input = checkout.data;
    lock.current = true;
    setError('');
    onPendingChange(true);
    try {
      const previousOrderKey = cart.version ? null : await getLegacyOrderKey(input);
      const preparation = await prepareCheckout(cart, previousOrderKey, data.has('confirmNewOrder'));
      if (preparation.status === 'legacy-unverified') {
        setError('Use the original tab and checkout details to retry, or confirm that you want to place a new order.');
        return;
      }
      if (preparation.status === 'changed') {
        setError('Your bag changed in another tab. Review it and try again.');
        return;
      }
      const { attempt } = preparation;
      const response = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'idempotency-key': attempt.key },
        body: JSON.stringify(input),
      });
      if (!response.ok) {
        const failure = checkoutFailureSchema.parse(await response.json());
        setError(failure.code === 'IDEMPOTENCY_CONFLICT'
          ? 'This bag was already ordered with different details. Use the original checkout details to recover the order.'
          : failure.message);
        return;
      }
      const receipt = orderReceiptSchema.parse(await response.json());
      await recordOrder(attempt, receipt.id);
      router.replace(`/orders/${receipt.id}`);
    } catch {
      setError('We could not confirm checkout. Try again to check the same order.');
    } finally {
      lock.current = false;
      onPendingChange(false);
    }
  }

  return (
    <form className="checkout-panel checkout-form" onSubmit={submit}>
      <h2>Guest details</h2>
      <fieldset disabled={pending}>
        <label>
          Demo email
          <input type="email" name="email" placeholder="you@example.com" autoComplete="email" maxLength={254} required />
        </label>
        <label>
          Demo payment
          <select name="payment" defaultValue="approve">
            <option value="approve">Approve payment</option>
            <option value="decline">Decline payment</option>
          </select>
        </label>
        {isLegacyBag && (
          <div className="demo-payment checkout-migration">
            <p>To retry an earlier checkout for this saved bag, use the original tab with the same email and payment option.</p>
            <label className="checkout-confirmation" key={cart.revision}>
              <input type="checkbox" name="confirmNewOrder" />
              I checked the earlier attempt and want to place a new order.
            </label>
          </div>
        )}
      </fieldset>
      <p className="demo-payment">This is a demo checkout. Use a sample email such as shopper@example.test.</p>
      {error && <p className="checkout-error" role="alert">{error}</p>}
      <button className="action action-dark wide" type="submit" disabled={pending}>
        {pending ? 'Placing order…' : 'Place demo order'} <ArrowRight size={18} aria-hidden="true" />
      </button>
    </form>
  );
}
