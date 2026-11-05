import 'reflect-metadata';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, test } from 'node:test';
import { NestFactory } from '@nestjs/core';
import type { INestApplication } from '@nestjs/common';
import { checkoutFailureSchema, orderReceiptSchema, productListSchema } from '@gear-drop/contracts';
import type { CheckoutInput } from '@gear-drop/contracts';
import { createDatabase } from '../src/infrastructure/database.js';
import { StoreModule } from '../src/store.module.js';

const url = process.env.TEST_DATABASE_URL;
if (!url || !new URL(url).pathname.endsWith('_test')) {
  throw new Error('Set TEST_DATABASE_URL to a dedicated migrated database with a name ending in _test.');
}

process.env.DATABASE_URL = url;
const db = createDatabase(url);
const testRun = randomUUID();
const slug = `test-${testRun}`;
const sku = (kind: string) => `${slug}-${kind}`;
const keys: string[] = [];
let app: INestApplication;
let base: string;

before(async () => {
  await db.product.create({
    data: {
      slug, name: `Field 75 ${testRun}`, category: 'keyboards', description: 'A test fixture',
      detail: '', image: '/gear/board-graphite.webp', priceCents: 14900, featured: 1000,
      variants: {
        create: ['race', 'retry', 'decline', 'atomic', 'rollback'].map((kind, position) => ({
          id: sku(kind), stock: kind === 'retry' ? 3 : 1, label: kind, swatch: '#fff', position,
        })),
      },
    },
  });
  app = await NestFactory.create(StoreModule, { logger: false });
  await app.listen(0, '127.0.0.1');
  base = await app.getUrl();
});

after(async () => {
  try {
    await app?.close();
    await db.orderItem.deleteMany({ where: { order: { idempotencyKey: { in: keys } } } });
    await db.order.deleteMany({ where: { idempotencyKey: { in: keys } } });
    await db.variant.deleteMany({ where: { productSlug: slug } });
    await db.product.deleteMany({ where: { slug } });
  } finally {
    await db.$disconnect();
  }
});

function orderKey() {
  const key = randomUUID();
  keys.push(key);
  return key;
}

function postOrder(kind: string, key = orderKey(), changes: Partial<CheckoutInput> = {}) {
  return fetch(`${base}/orders`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'idempotency-key': key },
    body: JSON.stringify({
      email: 'shopper@example.test', payment: 'approve', items: [{ variantId: sku(kind), quantity: 1 }], ...changes,
    }),
  });
}

async function stockOf(kind: string) {
  return (await db.variant.findUniqueOrThrow({ where: { id: sku(kind) }, select: { stock: true } })).stock;
}

test('catalog filters by search and category, preserving literal wildcard characters', async () => {
  const response = await fetch(`${base}/products?category=keyboards&q=${testRun}`);
  assert.equal(response.status, 200);
  const products = productListSchema.parse(await response.json());
  assert.deepEqual(products.map((product) => product.slug), [slug]);
  const [product] = products;
  assert.ok(product);
  assert.equal(product.variants.length, 5);
  const differentCategory = await fetch(`${base}/products?category=keycaps&q=${testRun}`);
  assert.deepEqual(await differentCategory.json(), []);
  const wildcard = await fetch(`${base}/products?q=%25${testRun}`);
  assert.deepEqual(await wildcard.json(), []);
});

test('concurrent checkouts for the last unit create exactly one order', async () => {
  const left = orderKey();
  const right = orderKey();
  const results = await Promise.all([postOrder('race', left), postOrder('race', right)]);
  assert.deepEqual(results.map((response) => response.status).sort(), [201, 409]);
  const accepted = results.find((response) => response.status === 201);
  const rejected = results.find((response) => response.status === 409);
  assert.ok(accepted && rejected);
  const receipt = orderReceiptSchema.parse(await accepted.json());
  assert.equal(checkoutFailureSchema.parse(await rejected.json()).code, 'OUT_OF_STOCK');
  assert.equal(receipt.totalCents, 14900);
  assert.deepEqual(await (await fetch(`${base}/orders/${receipt.id}`)).json(), receipt);
  assert.equal(await stockOf('race'), 0);
  assert.equal(await db.order.count({ where: { idempotencyKey: { in: [left, right] } } }), 1);
});

test('concurrent and later retries return the same receipt and reject conflicting payloads', async () => {
  const key = orderKey();
  const responses = await Promise.all([postOrder('retry', key), postOrder('retry', key)]);
  assert.deepEqual(responses.map((response) => response.status), [201, 201]);
  const [first, second] = await Promise.all(responses.map(async (response) => orderReceiptSchema.parse(await response.json())));
  assert.deepEqual(first, second);
  const repeat = await postOrder('retry', key);
  assert.deepEqual(await repeat.json(), first);
  const conflict = await postOrder('retry', key, { email: 'another@example.test' });
  assert.equal(conflict.status, 409);
  assert.equal(checkoutFailureSchema.parse(await conflict.json()).code, 'IDEMPOTENCY_CONFLICT');
  assert.equal(await stockOf('retry'), 2);
});

test('declined payment leaves stock untouched and the key reusable', async () => {
  const key = orderKey();
  const declined = await postOrder('decline', key, { payment: 'decline' });
  assert.equal(declined.status, 422);
  assert.equal(checkoutFailureSchema.parse(await declined.json()).code, 'PAYMENT_DECLINED');
  assert.equal(await stockOf('decline'), 1);
  assert.equal(await db.order.count({ where: { idempotencyKey: key } }), 0);
  assert.equal((await postOrder('decline', key)).status, 201);
});

test('a multi-line order with an unavailable item leaves every SKU unchanged', async () => {
  const response = await postOrder('atomic', orderKey(), {
    items: [{ variantId: sku('atomic'), quantity: 1 }, { variantId: sku('rollback'), quantity: 2 }],
  });
  assert.equal(response.status, 409);
  assert.equal(await stockOf('atomic'), 1);
  assert.equal(await stockOf('rollback'), 1);
});

test('invalid quantity, duplicate variants and spoofed prices are rejected at the boundary', async () => {
  const item = { variantId: sku('atomic'), quantity: 1 };
  const invalid = [
    { items: [{ ...item, quantity: 0 }] },
    { items: [item, item] },
    { items: [{ ...item, unitPriceCents: 1 }] },
  ];
  for (const changes of invalid) {
    const response = await postOrder('atomic', orderKey(), changes);
    assert.equal(response.status, 400);
  }
  assert.equal(await stockOf('atomic'), 1);
});
