import assert from 'node:assert/strict';
import test from 'node:test';
import { priceOrder, OrderError, validateRequestedItems } from '../src/domain/order.js';

const inventory = [
  { variantId: 'board', name: 'Field 75', variant: 'Graphite', stock: 1, unitPriceCents: 14900 },
  { variantId: 'mat', name: 'Surface Mat', variant: 'Bone', stock: 5, unitPriceCents: 3200 },
];

test('prices items from inventory and returns a receipt snapshot in cents', () => {
  const order = priceOrder([{ variantId: 'board', quantity: 1 }, { variantId: 'mat', quantity: 2 }], inventory);
  assert.equal(order.totalCents, 21300);
  assert.deepEqual(order.items[0], {
    variantId: 'board', name: 'Field 75', variant: 'Graphite', unitPriceCents: 14900, quantity: 1,
  });
});

test('reports the exact unavailable variant', () => {
  assert.throws(
    () => priceOrder([{ variantId: 'board', quantity: 2 }], inventory),
    (error) => error instanceof OrderError && error.code === 'OUT_OF_STOCK' && error.variantId === 'board',
  );
  assert.throws(
    () => priceOrder([{ variantId: 'missing', quantity: 1 }], inventory),
    (error) => error instanceof OrderError && error.code === 'ITEM_UNAVAILABLE' && error.variantId === 'missing',
  );
});


test('rejects invalid or duplicate quantities before reaching inventory', () => {
  const valid = { variantId: 'board', quantity: 1 };
  for (const input of [[], [{ ...valid, quantity: 0 }], [{ ...valid, quantity: 1.5 }], [valid, valid]]) {
    assert.throws(() => validateRequestedItems(input), (error) => error instanceof OrderError && error.code === 'INVALID_REQUEST');
  }
});
