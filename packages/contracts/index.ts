import { z } from 'zod';

export const categorySchema = z.enum(['keyboards', 'keycaps', 'desk-gear']);
export const catalogSortSchema = z.enum(['featured', 'price-asc', 'price-desc']);
export const mockPaymentSchema = z.enum(['approve', 'decline']);
export const orderIdSchema = z.uuidv4();

const slugSchema = z.string().min(1).regex(/^[a-z0-9-]+$/);
const variantIdSchema = slugSchema.max(80);
const centsSchema = z.int().nonnegative();

const variantSchema = z.object({
  id: variantIdSchema,
  label: z.string(),
  swatch: z.string(),
  stock: z.int().nonnegative(),
});

export const productSchema = z.object({
  slug: slugSchema,
  name: z.string(),
  category: categorySchema,
  description: z.string(),
  detail: z.string(),
  image: z.string(),
  priceCents: centsSchema,
  variants: z.array(variantSchema),
});

export const productListSchema = z.array(productSchema);

export const checkoutInputSchema = z.strictObject({
  email: z.string().trim().toLowerCase().max(254).pipe(z.email()),
  payment: mockPaymentSchema,
  items: z.array(z.strictObject({ variantId: variantIdSchema, quantity: z.number() })),
});

export const orderReceiptSchema = z.object({
  id: orderIdSchema,
  totalCents: centsSchema,
  items: z.array(z.object({
    variantId: variantIdSchema,
    name: z.string(),
    variant: z.string(),
    quantity: z.int().positive(),
    unitPriceCents: centsSchema,
  })),
});

export const checkoutFailureSchema = z.object({
  code: z.enum([
    'INVALID_REQUEST',
    'ITEM_UNAVAILABLE',
    'OUT_OF_STOCK',
    'PAYMENT_DECLINED',
    'IDEMPOTENCY_CONFLICT',
    'SERVICE_UNAVAILABLE',
  ]),
  message: z.string(),
  variantId: variantIdSchema.optional(),
});

export type Category = z.infer<typeof categorySchema>;
export type CatalogSort = z.infer<typeof catalogSortSchema>;
export type MockPayment = z.infer<typeof mockPaymentSchema>;
export type Variant = z.infer<typeof variantSchema>;
export type Product = z.infer<typeof productSchema>;
export type CheckoutInput = z.infer<typeof checkoutInputSchema>;
export type OrderReceipt = z.infer<typeof orderReceiptSchema>;
export type CheckoutFailure = z.infer<typeof checkoutFailureSchema>;
