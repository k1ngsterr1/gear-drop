import { categorySchema } from '@gear-drop/contracts';
import type { CatalogProduct, CatalogQuery, CatalogReader } from '../application/catalog.js';
import type { Prisma, PrismaClient } from './generated/client.js';

const productSelect = {
  slug: true,
  name: true,
  category: true,
  description: true,
  detail: true,
  image: true,
  priceCents: true,
  variants: {
    orderBy: { position: 'asc' },
    select: { id: true, label: true, swatch: true, stock: true },
  },
} satisfies Prisma.ProductSelect;

function mapProduct(row: Prisma.ProductGetPayload<{ select: typeof productSelect }>): CatalogProduct {
  return { ...row, category: categorySchema.parse(row.category) };
}

export class PrismaCatalog implements CatalogReader {
  constructor(private readonly db: PrismaClient) {}

  async list({ category, q, sort }: CatalogQuery): Promise<CatalogProduct[]> {
    const orderBy: Prisma.ProductOrderByWithRelationInput = sort === 'featured'
      ? { featured: 'asc' }
      : { priceCents: sort === 'price-asc' ? 'asc' : 'desc' };
    const term = q?.replace(/[\\%_]/g, '\\$&');
    const products = await this.db.product.findMany({
      where: {
        category,
        OR: term ? [
          { name: { contains: term, mode: 'insensitive' } },
          { description: { contains: term, mode: 'insensitive' } },
        ] : undefined,
      },
      orderBy: [orderBy, { slug: 'asc' }],
      select: productSelect,
      take: 24,
    });
    return products.map(mapProduct);
  }

  async findBySlug(slug: string): Promise<CatalogProduct | null> {
    const product = await this.db.product.findUnique({ where: { slug }, select: productSelect });
    return product && mapProduct(product);
  }
}
