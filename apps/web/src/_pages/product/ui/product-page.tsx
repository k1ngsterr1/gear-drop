import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { getProduct } from '@/entities/product/index.server';
import { ProductOptions } from '@/features/add-to-cart';
import { formatMoney } from '@/shared/lib/format-money';

export async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const product = await getProduct(slug);
  if (!product) notFound();

  return (
    <section className="wrap detail">
      <Link href="/#catalog" className="back-link" prefetch={false}><ArrowLeft size={16} /> All gear</Link>
      <div className="detail-grid">
        <div className="detail-media">
          <Image src={product.image} alt={product.name} fill preload sizes="(max-width: 760px) 96vw, 54vw" />
        </div>
        <div className="detail-copy">
          <p className="eyebrow section-kicker">{product.category.replace('-', ' ')} / GEAR DROP</p>
          <h1>{product.name}<span>.</span></h1>
          <p className="detail-spec">{product.description}</p>
          <p className="detail-price">{formatMoney(product.priceCents)}</p>
          <p className="detail-description">{product.detail}</p>
          <ProductOptions key={product.slug} product={product} />
        </div>
      </div>
    </section>
  );
}
