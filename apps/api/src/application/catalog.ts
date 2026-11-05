export type CatalogCategory = 'keyboards' | 'keycaps' | 'desk-gear';
export type CatalogOrder = 'featured' | 'price-asc' | 'price-desc';

export interface CatalogQuery {
  category?: CatalogCategory;
  q?: string;
  sort: CatalogOrder;
}

export interface CatalogProduct {
  slug: string;
  name: string;
  category: CatalogCategory;
  description: string;
  detail: string;
  image: string;
  priceCents: number;
  variants: { id: string; label: string; swatch: string; stock: number }[];
}

export interface CatalogReader {
  list(query: CatalogQuery): Promise<CatalogProduct[]>;
  findBySlug(slug: string): Promise<CatalogProduct | null>;
}
