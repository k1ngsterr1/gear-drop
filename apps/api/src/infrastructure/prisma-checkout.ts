import { createHash } from 'node:crypto';
import type { CheckoutStore, CheckoutTransaction } from '../application/checkout.js';
import { OrderError } from '../domain/order.js';
import type { Receipt, SellableVariant } from '../domain/order.js';
import { Prisma } from './generated/client.js';
import type { PrismaClient } from './generated/client.js';

const receiptSelect = {
  id: true,
  totalCents: true,
  items: {
    orderBy: { variantId: 'asc' },
    select: { variantId: true, name: true, variant: true, quantity: true, unitPriceCents: true },
  },
} as const;

export class PrismaCheckoutStore implements CheckoutStore {
  constructor(private readonly db: PrismaClient) {}

  transact<T>(idempotencyKey: string, requestFingerprint: string, run: (tx: CheckoutTransaction) => Promise<T>) {
    const requestHash = createHash('sha256').update(requestFingerprint).digest('hex');

    return this.db.$transaction(async (tx) => {
      // Serialize retries of a single key before inspecting the existing order.
      await tx.$queryRaw`SELECT 1 FROM pg_advisory_xact_lock(hashtextextended(${idempotencyKey}, 0))`;

      return run({
        findOrder: async () => {
          const order = await tx.order.findUnique({ where: { idempotencyKey }, select: { ...receiptSelect, requestHash: true } });
          if (!order) return null;
          const { requestHash: savedHash, ...receipt } = order;
          return { matches: savedHash === requestHash, receipt };
        },
        lockInventory: (variantIds) => tx.$queryRaw<SellableVariant[]>`
          SELECT v.id AS "variantId", p.name, v.label AS variant, v.stock, p."priceCents" AS "unitPriceCents"
          FROM "Variant" v JOIN "Product" p ON p.slug = v."productSlug"
          WHERE v.id IN (${Prisma.join(variantIds)})
          ORDER BY v.id
          FOR UPDATE OF v
        `,
        deductStock: async (items) => {
          const values = Prisma.join(items.map(({ variantId, quantity }) => Prisma.sql`(${variantId}, ${quantity}::integer)`));
          const changed = await tx.$executeRaw`
            UPDATE "Variant" AS v SET stock = v.stock - requested.quantity
            FROM (VALUES ${values}) AS requested(id, quantity)
            WHERE v.id = requested.id AND v.stock >= requested.quantity
          `;
          if (changed !== items.length) throw new OrderError('OUT_OF_STOCK', 'Stock changed during checkout.');
        },
        saveOrder: ({ items, totalCents }) => tx.order.create({
          data: { idempotencyKey, requestHash, totalCents, items: { create: items } },
          select: receiptSelect,
        }),
      });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted });
  }

  findReceipt(id: string): Promise<Receipt | null> {
    return this.db.order.findUnique({ where: { id }, select: receiptSelect });
  }
}
