import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowRight, Check } from 'lucide-react';
import { orderIdSchema, orderReceiptSchema } from '@gear-drop/contracts';
import { readStore } from '@/shared/api/store.server';
import { formatMoney } from '@/shared/lib/format-money';

export async function ReceiptPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!orderIdSchema.safeParse(id).success) notFound();
  const order = await readStore(`/orders/${id}`, orderReceiptSchema);
  if (!order) notFound();

  return (
    <section className="wrap checkout receipt">
      <div className="receipt-check"><Check size={25} aria-hidden="true" /></div>
      <p className="eyebrow section-kicker">03 / ORDER RECEIVED</p>
      <h1>Order confirmed<span>.</span></h1>
      <p className="muted">Your demo payment was approved and the order was saved.</p>
      <p className="receipt-number">ORDER / {order.id}</p>
      <div className="checkout-panel">
        <ul className="bag-lines">
          {order.items.map((item) => (
            <li key={item.variantId}>
              <div><strong>{item.name}</strong><small>{item.variant} · Qty {item.quantity}</small></div>
              <strong>{formatMoney(item.unitPriceCents * item.quantity)}</strong>
            </li>
          ))}
        </ul>
        <div className="order-total"><span>Total</span><strong>{formatMoney(order.totalCents)}</strong></div>
      </div>
      <Link href="/#catalog" className="action action-dark" prefetch={false}>Back to the drop <ArrowRight size={16} /></Link>
    </section>
  );
}
