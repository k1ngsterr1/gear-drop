-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "Product" (
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "detail" TEXT NOT NULL,
    "image" TEXT NOT NULL,
    "priceCents" INTEGER NOT NULL,
    "featured" INTEGER NOT NULL,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("slug")
);

-- CreateTable
CREATE TABLE "Variant" (
    "id" TEXT NOT NULL,
    "productSlug" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "swatch" TEXT NOT NULL,
    "stock" INTEGER NOT NULL,
    "position" INTEGER NOT NULL,

    CONSTRAINT "Variant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Order" (
    "id" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "requestHash" TEXT NOT NULL,
    "totalCents" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderItem" (
    "orderId" TEXT NOT NULL,
    "variantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "variant" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitPriceCents" INTEGER NOT NULL,

    CONSTRAINT "OrderItem_pkey" PRIMARY KEY ("orderId","variantId")
);

-- CreateIndex
CREATE INDEX "Product_category_featured_slug_idx" ON "Product"("category", "featured", "slug");

-- CreateIndex
CREATE INDEX "Variant_productSlug_position_idx" ON "Variant"("productSlug", "position");

-- CreateIndex
CREATE UNIQUE INDEX "Order_idempotencyKey_key" ON "Order"("idempotencyKey");

-- AddForeignKey
ALTER TABLE "Variant" ADD CONSTRAINT "Variant_productSlug_fkey" FOREIGN KEY ("productSlug") REFERENCES "Product"("slug") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


ALTER TABLE "Variant" ADD CONSTRAINT "Variant_stock_nonnegative" CHECK (stock >= 0);
ALTER TABLE "Product" ADD CONSTRAINT "Product_valid_category" CHECK (category IN ('keyboards', 'keycaps', 'desk-gear'));
ALTER TABLE "Product" ADD CONSTRAINT "Product_positive_price" CHECK ("priceCents" BETWEEN 1 AND 1000000);
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_valid_quantity" CHECK (quantity BETWEEN 1 AND 10);
