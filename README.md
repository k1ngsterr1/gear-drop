# Gear Drop

A demo shop for mechanical keyboards, keycaps, and desk accessories. Browse 24 seeded products, pick a finish, and place a guest order with simulated payment. PostgreSQL stores orders and inventory changes.

![Gear Drop storefront](docs/storefront.webp)

## Run locally

```sh
docker compose up --build
```

Open [the storefront](http://localhost:3000). Compose runs the migration and seed before starting the API. The seed preserves existing stock, so restarting the app preserves purchases.

With Node.js 24 and a running PostgreSQL instance, you can also run the apps directly. Create an empty database and set `DATABASE_URL` to its connection string.

```sh
npm ci
export DATABASE_URL=postgresql://USER:PASSWORD@127.0.0.1:5432/gear_drop
npm run db:generate
npm run db:migrate
npm run db:seed
npm run dev
```

## Try the last-unit demo

1. On a fresh database, open **Field 75** in two independent browser sessions and add the **Graphite** finish to both bags. It starts with one unit.
2. Place both orders using a sample email such as `shopper@example.test` and the **Approve payment** option.
3. One session receives a receipt. The other sees an out-of-stock error and keeps its bag.

Selecting **Decline payment** keeps both the bag and inventory intact. Tabs that share a bag also share its checkout key for that version. Browsers with Web Locks disabled keep a separate bag in each tab. The **View last order** link in the bag lets you reopen the latest saved confirmation after a failed navigation. Checkout uses the sample email only as input to the request fingerprint and stores no plaintext email.

A bag from the older checkout can reuse its saved key in the original tab with the same checkout details. When that key is unavailable, check the earlier attempt before confirming a new order. In tab-only mode, each tab imports the saved bag once and keeps its own copy across reloads.

## Architecture

```text
apps/api/src
  domain/          order quantities, stock checks, pricing
  application/     checkout use case and persistence/payment ports
  infrastructure/  Prisma adapters, PostgreSQL transaction, mock payment
  presentation/    NestJS HTTP routes and validation
  store.module.ts  dependency composition

apps/web
  app/             thin Next.js App Router entries
  src/_app/        app shell and same-origin checkout proxy
  src/_pages/      catalog, product, checkout, receipt
  src/widgets/     header and checkout workspace
  src/features/    bag controls, variant selection, place order
  src/entities/    product and bag slices
  src/shared/      HTTP and formatting primitives
```

The application use case computes prices from locked inventory. The PostgreSQL adapter serializes retries of an idempotency key, locks the affected variants in stable order, then persists the stock decrement and order in one transaction. The browser stores the bag version and receipt link together. A retry reuses the version's checkout key. An order clears only the bag version it purchased, and the link tracks the newest confirmed version, so edits and newer confirmations survive a delayed response.

Next.js reads the catalog from NestJS on the server. Client-side state covers the bag and checkout interaction. Next.js routing files re-export the FSD page entries. [FSD guide for Next.js](https://feature-sliced.design/docs/guides/tech/with-nextjs)

## Checks

```sh
npm run check
npm run build
```

`check` builds the shared TypeScript contracts, generates the Prisma client, checks the apps and test tooling, verifies the Clean Architecture and FSD import boundaries, and runs the order domain tests. The shared Zod schemas define the TypeScript contracts and validate checkout input and API responses.

For integration tests, create a separate PostgreSQL database whose name ends in `_test`.

```sh
export TEST_DATABASE_URL=postgresql://USER:PASSWORD@127.0.0.1:5432/gear_drop_test
DATABASE_URL="$TEST_DATABASE_URL" npm run db:migrate
npm run test:integration
```

With a fresh demo storefront running, install Chromium and run the browser tests. The tests place orders on seeded SKUs, so use a disposable demo database. Set `BROWSER_CHANNEL=chrome` to use an existing Chrome installation.

```sh
npx playwright install chromium
npm run test:browser
```

The [GitHub Actions workflow](.github/workflows/ci.yml) runs the checks, PostgreSQL integration tests, a production build, and the Chromium suite on pull requests. The workflow uses a fresh service database. Locally, set `PLAYWRIGHT_START_SERVERS=1` with a migrated and seeded database to have Playwright start both production servers after the build.

## Local performance baseline

Chrome on the production build recorded zero navigation, RSC, or checkout requests when adding a variant to the bag. Confirming checkout sent one POST. On the 24-product, 48-variant seed, `pg_stat_statements` recorded two catalog queries and eight checkout statements for either one or four distinct items, excluding transaction control.

## Visual references

- Modesk informed the category navigation and compact card hierarchy. [Dribbble](https://dribbble.com/shots/26708016-Modesk-Mechanical-Keyboard-E-commerce)
- NuPhy Field75 informed the large product image and placement of finish options near the price. [Dribbble](https://dribbble.com/shots/27078889-NuPhy-High-Conversion-Keyboard-Ecommerce-Website-Product-Page)
- Awe Studio informed the high-contrast typography and single accent. [Dribbble](https://dribbble.com/shots/27707593-Mechanical-Keyboard-Custom-Hardware-E-commerce-Landing-Page)

Behance was searched, but the case-study pages returned HTTP 403 when opened.

The demo imagery was created with the built-in ImageGen tool. [Asset prompts](docs/image-prompts.md)
