import { Inject, Module } from '@nestjs/common';
import type { OnApplicationShutdown } from '@nestjs/common';
import { Checkout } from './application/checkout.js';
import { createDatabase } from './infrastructure/database.js';
import type { PrismaClient } from './infrastructure/generated/client.js';
import { MockPayment } from './infrastructure/mock-payment.js';
import { PrismaCatalog } from './infrastructure/prisma-catalog.js';
import { PrismaCheckoutStore } from './infrastructure/prisma-checkout.js';
import { CATALOG, RECEIPTS, StoreController } from './presentation/store.controller.js';

const DATABASE = Symbol('DATABASE');

@Module({
  controllers: [StoreController],
  providers: [
    { provide: DATABASE, useFactory: () => createDatabase() },
    { provide: CATALOG, useFactory: (db: PrismaClient) => new PrismaCatalog(db), inject: [DATABASE] },
    { provide: RECEIPTS, useFactory: (db: PrismaClient) => new PrismaCheckoutStore(db), inject: [DATABASE] },
    { provide: Checkout, useFactory: (store: PrismaCheckoutStore) => new Checkout(store, new MockPayment()), inject: [RECEIPTS] },
  ],
})
export class StoreModule implements OnApplicationShutdown {
  constructor(@Inject(DATABASE) private readonly db: PrismaClient) {}

  async onApplicationShutdown() {
    await this.db.$disconnect();
  }
}
