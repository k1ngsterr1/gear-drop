import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { CheckoutWorkspace } from '@/widgets/checkout-workspace';

export function CheckoutPage() {
  return (
    <section className="wrap checkout">
      <Link className="back-link" href="/#catalog" prefetch={false}><ArrowLeft size={16} /> Continue shopping</Link>
      <p className="eyebrow section-kicker">02 / CHECKOUT</p>
      <h1>Checkout<span>.</span></h1>
      <CheckoutWorkspace />
    </section>
  );
}
