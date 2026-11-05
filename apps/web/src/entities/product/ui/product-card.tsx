import Image from 'next/image';
import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import type { Product } from '@gear-drop/contracts';
import { formatMoney } from '@/shared/lib/format-money';

export function ProductCard({ product, badge }: { product: Product; badge?: string }) {
  const soldOut = product.variants.every((variant) => variant.stock === 0);

  return (
    <article>
      <Link className="product-card" href={`/products/${product.slug}`} prefetch={false}>
        <div className="product-card-media">
          <Image src={product.image} alt="" fill sizes="(max-width: 560px) 48vw, (max-width: 900px) 32vw, 25vw" />
          {(soldOut || badge) && <span className="product-badge">{soldOut ? 'Sold out' : badge}</span>}
          <span className="product-arrow" aria-hidden="true"><ArrowUpRight size={17} /></span>
        </div>
        <div className="product-card-title">
          <h3>{product.name}</h3><span>{formatMoney(product.priceCents)}</span>
        </div>
        <p>{product.description}</p>
      </Link>
    </article>
  );
}
