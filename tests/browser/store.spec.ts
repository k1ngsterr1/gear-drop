import { orderReceiptSchema } from '@gear-drop/contracts';
import { expect, test } from '@playwright/test';

test('desktop filters the catalog and completes one guest checkout', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  const documentRequests: string[] = [];
  const checkoutRequests: string[] = [];
  const rscRequests: string[] = [];
  page.on('request', (request) => {
    if (request.isNavigationRequest()) documentRequests.push(request.url());
    if (request.url().includes('/api/checkout')) checkoutRequests.push(request.method());
    if (request.headers().rsc === '1') rscRequests.push(request.url());
  });

  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Good gear. Better desks.' })).toBeVisible();
  await expect(page.locator('.product-grid article')).toHaveCount(24);
  await page.getByRole('navigation', { name: 'Filter by category' }).getByRole('link', { name: 'Keyboards' }).click();
  await expect(page.locator('.product-grid article')).toHaveCount(8);
  await page.getByRole('searchbox', { name: 'Search gear' }).fill('Field');
  await page.getByRole('button', { name: 'Apply search and sort' }).click();
  await expect(page.locator('.product-grid article')).toHaveCount(1);
  await page.getByRole('link', { name: /Field 75/ }).click();
  await expect(page.getByRole('heading', { name: 'Field 75.' })).toBeVisible();
  await page.getByRole('radio', { name: 'Bone' }).check();

  const beforeAdd = { documents: documentRequests.length, rsc: rscRequests.length };
  await page.getByRole('button', { name: 'Add to bag' }).click();
  await expect(page.getByRole('status')).toContainText('Added to your bag.');
  expect(documentRequests.length).toBe(beforeAdd.documents);
  expect(rscRequests.length).toBe(beforeAdd.rsc);
  expect(checkoutRequests).toEqual([]);

  await page.getByRole('link', { name: 'Bag, 1 item' }).click();
  await expect(page).toHaveURL('/checkout');
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Order summary' })).toBeVisible();
  await expect(page.getByText('Bone', { exact: true })).toBeVisible();
  await page.getByLabel('Demo email').fill('shopper@example.test');
  await page.getByRole('button', { name: 'Place demo order' }).click();
  await expect(page.getByRole('heading', { name: 'Order confirmed.' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Bag, 0 items' })).toBeVisible();
  expect(checkoutRequests).toEqual(['POST']);
  console.log('Desktop interaction: add to bag produced 0 document, 0 RSC, 0 checkout requests. Submit produced 1 checkout POST.');
});

test('mobile checkout shows a declined payment and keeps the bag', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await expect(page.getByRole('link', { name: /Clay Keycaps/ })).toBeVisible();
  await page.getByRole('link', { name: /Clay Keycaps/ }).click();
  await page.getByRole('button', { name: 'Add to bag' }).click();
  await page.getByRole('link', { name: 'Bag, 1 item' }).click();
  await page.getByLabel('Demo email').fill('mobile@example.test');
  await page.getByLabel('Demo payment').selectOption('decline');
  await page.getByRole('button', { name: 'Place demo order' }).click();
  await expect(page.getByRole('main').getByRole('alert')).toContainText('Demo payment declined');
  await expect(page.getByRole('link', { name: 'Bag, 1 item' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
});

test('retry after a lost response reuses the checkout key across reload', async ({ page }) => {
  await page.goto('/products/surface-mat');
  await page.getByRole('button', { name: 'Add to bag' }).click();
  await page.getByRole('link', { name: 'Bag, 1 item' }).click();
  await expect(page).toHaveURL('/checkout');
  const keys: Array<string | undefined> = [];
  let acceptedId = '';
  await page.route('**/api/checkout', async (route) => {
    keys.push(route.request().headers()['idempotency-key']);
    if (keys.length === 1) {
      const result = await route.fetch();
      expect(result.status()).toBe(201);
      acceptedId = orderReceiptSchema.parse(await result.json()).id;
      await route.abort('connectionreset');
      return;
    }
    await route.continue();
  });

  await page.getByLabel('Demo email').fill('replay@example.test');
  await page.getByRole('button', { name: 'Place demo order' }).click();
  await expect(page.getByRole('main').getByRole('alert')).toContainText('Try again');
  await page.reload();
  await page.getByLabel('Demo email').fill('replay@example.test');
  await page.getByRole('button', { name: 'Place demo order' }).click();
  expect(acceptedId).not.toBe('');
  await expect(page).toHaveURL(`/orders/${acceptedId}`);
  expect(keys).toHaveLength(2);
  expect(keys[0]).toBe(keys[1]);
});

function gate() {
  const { promise: wait, resolve: release } = Promise.withResolvers<void>();
  return { wait, release };
}

test('shared checkout replays preserve both the newer bag and the newer receipt', async ({ page, context }) => {
  await page.goto('/products/clay-keycaps');
  await page.getByRole('button', { name: 'Add to bag' }).click();
  await expect(page.getByRole('link', { name: 'Bag, 1 item' })).toBeVisible();
  const second = await context.newPage();
  const third = await context.newPage();
  const tabs = [page, second, third];
  await Promise.all(tabs.map(async (tab) => {
    await tab.goto('/checkout');
    await tab.getByLabel('Demo email').fill('shared-bag@example.test');
  }));

  const requests = gate();
  const secondResponse = gate();
  const thirdResponse = gate();
  const keys: Array<string | undefined> = [];
  try {
    for (const tab of tabs) {
      await tab.route('**/api/checkout', async (route) => {
        keys.push(route.request().headers()['idempotency-key']);
        await requests.wait;
        const response = await route.fetch();
        if (tab === second) await secondResponse.wait;
        if (tab === third) await thirdResponse.wait;
        await route.fulfill({ response });
      });
    }

    await Promise.all(tabs.map((tab) => tab.getByRole('button', { name: 'Place demo order' }).click()));
    await expect.poll(() => keys.length).toBe(3);
    expect(keys[0]).toBeTruthy();
    expect(new Set(keys).size).toBe(1);
    requests.release();

    await expect(page.getByRole('heading', { name: 'Order confirmed.' })).toBeVisible();
    const firstOrder = new URL(page.url()).pathname;
    await page.goto('/products/clay-keycaps');
    await page.getByRole('button', { name: 'Add to bag' }).click();
    await expect(page.getByRole('link', { name: 'Bag, 1 item' })).toBeVisible();

    secondResponse.release();
    await expect(second).toHaveURL(firstOrder);
    await expect(second.getByRole('heading', { name: 'Order confirmed.' })).toBeVisible();
    await expect(second.getByRole('link', { name: 'Bag, 1 item' })).toBeVisible();

    await page.unroute('**/api/checkout');
    await page.goto('/checkout');
    await page.getByLabel('Demo email').fill('shared-bag@example.test');
    const request = page.waitForRequest((candidate) => candidate.url().endsWith('/api/checkout'));
    await page.getByRole('button', { name: 'Place demo order' }).click();
    expect((await request).headers()['idempotency-key']).not.toBe(keys[0]);
    await expect(page.getByRole('heading', { name: 'Order confirmed.' })).toBeVisible();
    await expect(page).not.toHaveURL(firstOrder);
    const latestOrder = new URL(page.url()).pathname;

    thirdResponse.release();
    await expect(third).toHaveURL(firstOrder);
    await page.goto('/checkout');
    await expect(page.getByRole('link', { name: 'View last order' })).toHaveAttribute('href', latestOrder);
  } finally {
    requests.release();
    secondResponse.release();
    thirdResponse.release();
  }
});

test('checkout keeps a receipt link after the confirmation page fails', async ({ page }) => {
  await page.goto('/products/surface-mat');
  await page.getByRole('button', { name: 'Add to bag' }).click();
  await expect(page.getByRole('link', { name: 'Bag, 1 item' })).toBeVisible();
  await page.goto('/checkout');
  await page.getByLabel('Demo email').fill('receipt@example.test');
  await page.route('**/orders/**', (route) => route.fulfill({
    status: 503,
    contentType: 'text/html',
    body: '<h1>Receipt temporarily unavailable</h1>',
  }));
  const response = page.waitForResponse((result) => result.url().endsWith('/api/checkout'));
  await page.getByRole('button', { name: 'Place demo order' }).click();
  const posted = await response;
  expect(posted.status()).toBe(201);
  const receipt = orderReceiptSchema.parse(await posted.json());
  await expect(page.getByRole('heading', { name: 'Receipt temporarily unavailable' })).toBeVisible();

  await page.goto('/checkout');
  await page.reload();
  const link = page.getByRole('link', { name: 'View last order' });
  await expect(link).toHaveAttribute('href', `/orders/${receipt.id}`);
  await expect(page.getByRole('heading', { name: 'Your bag is empty' })).toBeVisible();
  await page.unroute('**/orders/**');
  await link.click();
  await expect(page.getByRole('heading', { name: 'Order confirmed.' })).toBeVisible();
});

test('an invalid success response leaves the bag available for retry', async ({ page }) => {
  await page.goto('/products/surface-mat');
  await page.getByRole('button', { name: 'Add to bag' }).click();
  await page.getByRole('link', { name: 'Bag, 1 item' }).click();
  await page.getByLabel('Demo email').fill('invalid-response@example.test');
  await page.route('**/api/checkout', (route) => route.fulfill({ status: 201, json: { id: crypto.randomUUID() } }));

  await page.getByRole('button', { name: 'Place demo order' }).click();

  await expect(page.getByRole('main').getByRole('alert')).toContainText('We could not confirm checkout');
  await expect(page.getByRole('link', { name: 'Bag, 1 item' })).toBeVisible();
  await expect(page).toHaveURL('/checkout');
});

test('the bag honors the last known stock after reload', async ({ page }) => {
  await page.goto('/products/field-75');
  await page.getByRole('radio', { name: 'Graphite' }).check();
  await expect(page.getByText('Last one available')).toBeVisible();
  await page.getByRole('button', { name: 'Add to bag' }).click();
  await expect(page.getByRole('link', { name: 'Bag, 1 item' })).toBeVisible();
  await page.goto('/checkout');
  const increase = page.getByRole('button', { name: 'Increase Field 75 quantity' });
  await expect(increase).toBeDisabled();
  await page.reload();
  await expect(increase).toBeDisabled();
  await page.getByRole('button', { name: 'Decrease Field 75 quantity' }).click();
  await expect(page.getByRole('heading', { name: 'Your bag is empty' })).toBeVisible();
});

test('an older bag needs its saved retry key or explicit confirmation in a new tab', async ({ page, context, request }) => {
  const variantId = 'surface-mat-graphite';
  const input = { email: 'legacy@example.test', payment: 'approve', items: [{ variantId, quantity: 1 }] };
  const key = crypto.randomUUID();
  const original = await request.post('/api/checkout', { data: input, headers: { 'idempotency-key': key } });
  expect(original.status()).toBe(201);
  const receipt = orderReceiptSchema.parse(await original.json());

  await page.goto('/checkout');
  await page.evaluate(async ({ input, key, variantId }) => {
    localStorage.setItem('gear-drop:bag:v1', JSON.stringify([{
      variantId, slug: 'surface-mat', name: 'Surface Mat', variant: 'Graphite', priceCents: 3200, quantity: 1,
    }]));
    const fingerprint = JSON.stringify([input.email, input.payment, input.items]);
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(fingerprint));
    const hash = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
    sessionStorage.setItem(`gear-drop:order:${hash}`, key);
  }, { input, key, variantId });
  await page.reload();

  const second = await context.newPage();
  let checkoutPosts = 0;
  second.on('request', (candidate) => {
    if (candidate.method() === 'POST' && candidate.url().endsWith('/api/checkout')) checkoutPosts++;
  });
  await second.goto('/checkout');
  await second.getByLabel('Demo email').fill(input.email);
  await second.getByRole('button', { name: 'Place demo order' }).click();
  await expect(second.getByRole('main').getByRole('alert')).toContainText('Use the original tab');
  expect(checkoutPosts).toBe(0);

  await page.getByLabel('Demo email').fill(input.email);
  await page.getByRole('button', { name: 'Place demo order' }).click();
  await expect(page).toHaveURL(`/orders/${receipt.id}`);
  await expect(page.getByRole('heading', { name: 'Order confirmed.' })).toBeVisible();
  await expect(second.getByRole('link', { name: 'View last order' })).toHaveAttribute('href', `/orders/${receipt.id}`);
});

test('a browser without Web Locks keeps a reloadable bag and receipt per tab', async ({ page, context }) => {
  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'locks', { value: undefined });
  });
  await page.goto('/products/form-65');
  await page.getByRole('button', { name: 'Add to bag' }).click();
  await expect(page.getByRole('link', { name: 'Bag, 1 item' })).toBeVisible();

  const second = await context.newPage();
  await second.goto('/checkout');
  await expect(second.getByRole('heading', { name: 'Your bag is empty' })).toBeVisible();

  await page.goto('/checkout');
  await page.reload();
  await page.getByLabel('Demo email').fill('tab-only@example.test');
  await page.getByRole('button', { name: 'Place demo order' }).click();
  await expect(page.getByRole('heading', { name: 'Order confirmed.' })).toBeVisible();
  const order = new URL(page.url()).pathname;
  await page.goto('/checkout');
  await page.reload();
  await expect(page.getByRole('link', { name: 'View last order' })).toHaveAttribute('href', order);
  await second.reload();
  await expect(second.getByRole('link', { name: 'View last order' })).toHaveCount(0);
});

test('a legacy bag is imported once per tab when Web Locks are unavailable', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'locks', { value: undefined });
    if (localStorage.getItem('gear-drop:bag:v1') === null) {
      localStorage.setItem('gear-drop:bag:v1', JSON.stringify([{
        variantId: 'surface-mat-graphite', slug: 'surface-mat', name: 'Surface Mat',
        variant: 'Graphite', priceCents: 3200, quantity: 1,
      }]));
    }
  });
  await page.goto('/checkout');
  await expect(page.getByRole('link', { name: 'Bag, 1 item' })).toBeVisible();
  await page.getByLabel('Demo email').fill('legacy-tab-only@example.test');
  const confirmation = page.getByRole('checkbox', { name: 'I checked the earlier attempt and want to place a new order.' });
  await confirmation.check();
  await page.getByRole('button', { name: 'Increase Surface Mat quantity' }).click();
  await expect(page.getByRole('link', { name: 'Bag, 2 items' })).toBeVisible();
  await expect(confirmation).not.toBeChecked();
  await page.getByRole('button', { name: 'Decrease Surface Mat quantity' }).click();
  await expect(page.getByRole('link', { name: 'Bag, 1 item' })).toBeVisible();

  await page.getByRole('button', { name: 'Remove Surface Mat' }).click();
  await expect(page.getByRole('heading', { name: 'Your bag is empty' })).toBeVisible();
  await page.goto('/products/surface-mat');
  await page.getByRole('button', { name: 'Add to bag' }).click();
  await expect(page.getByRole('link', { name: 'Bag, 1 item' })).toBeVisible();
  await page.goto('/checkout');
  await page.getByLabel('Demo email').fill('legacy-tab-only@example.test');
  await page.getByRole('button', { name: 'Place demo order' }).click();
  await expect(page.getByRole('main').getByRole('alert')).toContainText('Use the original tab');
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);

  await confirmation.check();
  await page.getByRole('button', { name: 'Place demo order' }).click();
  await expect(page.getByRole('heading', { name: 'Order confirmed.' })).toBeVisible();
  const order = new URL(page.url()).pathname;
  await page.goto('/checkout');
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Your bag is empty' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'View last order' })).toHaveAttribute('href', order);
});
