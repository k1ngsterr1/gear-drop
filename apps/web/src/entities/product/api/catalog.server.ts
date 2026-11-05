import 'server-only';
import { productListSchema, productSchema } from '@gear-drop/contracts';
import type { CatalogSort, Category } from '@gear-drop/contracts';
import { readStore } from '@/shared/api/store.server';

export async function getProducts(filters: { category?: Category; q?: string; sort: CatalogSort }) {
  const search = new URLSearchParams({ sort: filters.sort });
  if (filters.category) search.set('category', filters.category);
  if (filters.q) search.set('q', filters.q);
  const products = await readStore(`/products?${search}`, productListSchema);
  if (!products) throw new Error('Catalog is unavailable.');
  return products;
}

export function getProduct(slug: string) {
  return readStore(`/products/${encodeURIComponent(slug)}`, productSchema);
}
