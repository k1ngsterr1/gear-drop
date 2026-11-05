import { BadRequestException } from '@nestjs/common';
import { catalogSortSchema, categorySchema } from '@gear-drop/contracts';
import { z } from 'zod';

export const catalogQuery = z.object({
  category: categorySchema.optional(),
  q: z.string().trim().max(80).optional(),
  sort: catalogSortSchema.default('featured'),
}).strict();

export const identifier = z.uuid();

export function parse<T>(schema: z.ZodType<T>, data: unknown): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    throw new BadRequestException({ code: 'INVALID_REQUEST', message: result.error.issues[0]?.message ?? 'Invalid request.' });
  }
  return result.data;
}
