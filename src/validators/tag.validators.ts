// Tag Validators
import { z } from 'zod'

export const getTagsSchema = z.object({
  query: z.object({
    page: z.coerce.number().positive().default(1),
    limit: z.coerce.number().positive().max(100).default(50),
    isActive: z.coerce.boolean().optional(),
  }),
})

export const createTagSchema = z.object({
  body: z.object({
    name: z.string().min(1).max(50),
    description: z.string().optional(),
    color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).default('#6B7280'),
  }),
})

export const updateTagSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z.object({
    name: z.string().max(50).optional(),
    description: z.string().optional(),
    color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
    isActive: z.boolean().optional(),
  }),
})