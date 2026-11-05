import { BadRequestException, Body, ConflictException, Controller, Get, Headers, Inject, NotFoundException, Param, Post, Query, UnprocessableEntityException } from '@nestjs/common';
import { checkoutInputSchema } from '@gear-drop/contracts';
import type { CheckoutFailure, OrderReceipt, Product } from '@gear-drop/contracts';
import type { CatalogReader } from '../application/catalog.js';
import { Checkout } from '../application/checkout.js';
import { OrderError } from '../domain/order.js';
import { catalogQuery, identifier, parse } from './validation.js';

export const CATALOG = Symbol('CATALOG');
export const RECEIPTS = Symbol('RECEIPTS');

interface ReceiptReader {
  findReceipt(id: string): Promise<OrderReceipt | null>;
}

@Controller()
export class StoreController {
  constructor(
    @Inject(CATALOG) private readonly catalog: CatalogReader,
    @Inject(Checkout) private readonly checkout: Checkout,
    @Inject(RECEIPTS) private readonly receipts: ReceiptReader,
  ) {}

  @Get('products')
  list(@Query() query: unknown): Promise<Product[]> {
    return this.catalog.list(parse(catalogQuery, query));
  }

  @Get('products/:slug')
  async product(@Param('slug') slug: string): Promise<Product> {
    const product = await this.catalog.findBySlug(slug);
    if (!product) throw new NotFoundException('Product not found.');
    return product;
  }

  @Post('orders')
  async placeOrder(@Headers('idempotency-key') key: unknown, @Body() body: unknown): Promise<OrderReceipt> {
    const input = parse(checkoutInputSchema, body);
    const idempotencyKey = parse(identifier, key);

    try {
      return await this.checkout.execute({ idempotencyKey, ...input });
    } catch (error) {
      if (!(error instanceof OrderError)) throw error;
      const failure: CheckoutFailure = { code: error.code, message: error.message, variantId: error.variantId };
      if (error.code === 'INVALID_REQUEST') throw new BadRequestException(failure);
      if (error.code === 'PAYMENT_DECLINED') throw new UnprocessableEntityException(failure);
      throw new ConflictException(failure);
    }
  }

  @Get('orders/:id')
  async receipt(@Param('id') id: string): Promise<OrderReceipt> {
    const order = await this.receipts.findReceipt(parse(identifier, id));
    if (!order) throw new NotFoundException('Order not found.');
    return order;
  }
}
