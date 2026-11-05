import Link from 'next/link';
import { ArrowDownRight } from 'lucide-react';
import { BagLink } from '@/features/cart';

export function StoreHeader() {
  return (
    <header className="store-header">
      <div className="wrap header-inner">
        <Link href="/" className="wordmark" aria-label="Gear Drop home" prefetch={false}>
          <span className="brand-mark"><ArrowDownRight size={19} strokeWidth={3} /></span>GEAR<span className="wordmark-light">DROP</span>
        </Link>
        <nav aria-label="Store categories">
          <Link href="/?category=keyboards#catalog" prefetch={false}>Keyboards</Link>
          <Link href="/?category=keycaps#catalog" prefetch={false}>Keycaps</Link>
          <Link href="/?category=desk-gear#catalog" prefetch={false}>Desk gear</Link>
        </nav>
        <BagLink />
      </div>
    </header>
  );
}
