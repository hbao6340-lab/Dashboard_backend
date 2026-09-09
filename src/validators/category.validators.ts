// Category Validators
import { z } from 'zod'

export const getCategoriesSchema = z.object({
  query: z.object({
    page: z.coerce.number().positive().default(1),
    limit: z.coerce.number().positive().max(100).default(50),
    isActive: z.coerce.boolean().optional(),
  }),
})

export const createCategorySchema = z.object({
  body: z.object({
    name: z.string().min(1).max(100),
    description: z.string().optional(),
    color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).default('#3B82F6'),
    icon: z.string().optional(),
    sortOrder: z.coerce.number().default(0),
  }),
})

export const updateCategorySchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z.object({
    name: z.string().max(100).optional(),
    description: z.string().optional(),
    color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
    icon: z.string().optional(),
    isActive: z.boolean().optional(),
    sortOrder: z.coerce.number().optional(),
  }),
})