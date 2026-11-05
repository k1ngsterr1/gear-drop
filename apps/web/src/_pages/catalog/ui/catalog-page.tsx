import Image from 'next/image';
import Link from 'next/link';
import { ArrowDown, ArrowRight, Search } from 'lucide-react';
import type { CatalogSort, Category } from '@gear-drop/contracts';
import { ProductCard } from '@/entities/product';
import { getProducts } from '@/entities/product/index.server';

const categories: { id?: Category; label: string }[] = [
  { label: 'All gear' },
  { id: 'keyboards', label: 'Keyboards' },
  { id: 'keycaps', label: 'Keycaps' },
  { id: 'desk-gear', label: 'Desk gear' },
];

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export async function CatalogPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const category = categories.find((item) => item.id === params.category)?.id;
  const q = typeof params.q === 'string' ? params.q.trim().slice(0, 80) : '';
  const sort: CatalogSort = params.sort === 'price-asc' || params.sort === 'price-desc' ? params.sort : 'featured';
  const products = await getProducts({ category, q, sort });
  const filtered = Boolean(category || q || sort !== 'featured');

  function categoryHref(id?: Category) {
    const next = new URLSearchParams();
    if (id) next.set('category', id);
    if (q) next.set('q', q);
    if (sort !== 'featured') next.set('sort', sort);
    return next.size ? `/?${next}#catalog` : '/#catalog';
  }

  return (
    <>
      {!filtered && (
        <section className="hero wrap" aria-labelledby="hero-title">
          <div className="hero-copy">
            <div className="eyebrow hero-kicker"><span /> THE DESK EDIT / 001</div>
            <h1 id="hero-title">Good gear.<br />Better desks<span>.</span></h1>
            <p>Mechanical keyboards and everyday desk essentials, picked for the way you work and play.</p>
            <a className="action action-accent" href="#catalog">Shop the drop <ArrowDown size={17} aria-hidden="true" /></a>
          </div>
          <div className="hero-photo">
            <Image src="/gear/hero.webp" alt="Graphite mechanical keyboard with cream keycaps and an orange escape key" fill preload sizes="(max-width: 760px) 96vw, 56vw" />
            <Link className="hero-tag" href="/products/field-75" prefetch={false}>01 / FIELD 75 <ArrowRight size={15} aria-hidden="true" /></Link>
          </div>
        </section>
      )}

      <section className="catalog wrap" id="catalog" aria-labelledby="catalog-title">
        <div className="catalog-heading">
          <div>
            <p className="eyebrow section-kicker">01 / THE COLLECTION</p>
            {filtered ? <h1 id="catalog-title">Shop the drop<span>.</span></h1> : <h2 id="catalog-title">Shop the drop<span>.</span></h2>}
          </div>
          <p className="catalog-count">{products.length} {products.length === 1 ? 'item' : 'items'}</p>
        </div>
        <div className="catalog-toolbar">
          <nav className="category-tabs" aria-label="Filter by category">
            {categories.map(({ id, label }) => (
              <Link key={label} href={categoryHref(id)} aria-current={category === id ? 'page' : undefined} prefetch={false}>{label}</Link>
            ))}
          </nav>
          <form className="catalog-filter" action="/#catalog" method="get">
            {category && <input type="hidden" name="category" value={category} />}
            <input className="search-input" type="search" name="q" aria-label="Search gear" placeholder="Search gear" defaultValue={q} maxLength={80} />
            <select name="sort" defaultValue={sort} aria-label="Sort gear">
              <option value="featured">Featured</option>
              <option value="price-asc">Price: low to high</option>
              <option value="price-desc">Price: high to low</option>
            </select>
            <button type="submit" className="icon-button search-submit" aria-label="Apply search and sort"><Search size={17} /></button>
          </form>
        </div>
        {products.length ? (
          <div className="product-grid">
            {products.map((product) => (
              <ProductCard key={product.slug} product={product} badge={product.slug === 'field-75' ? 'Drop 001' : undefined} />
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <h2>No gear found</h2>
            <p>Try a different search or browse the full collection.</p>
            <Link className="action action-dark" href="/#catalog" prefetch={false}>Clear filters <ArrowRight size={16} /></Link>
          </div>
        )}
      </section>
    </>
  );
}
