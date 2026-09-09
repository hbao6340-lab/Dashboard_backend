// Calendar Validators
import { z } from 'zod'

export const getCalendarEventsSchema = z.object({
  query: z.object({
    start: z.string().datetime().optional(),
    end: z.string().datetime().optional(),
    type: z.string().optional(),
  }),
})

export const createCalendarEventSchema = z.object({
  body: z.object({
    title: z.string().min(1).max(255),
    description: z.string().optional(),
    startAt: z.string().datetime(),
    endAt: z.string().datetime(),
    allDay: z.boolean().default(false),
    type: z.enum(['TASK', 'MEETING', 'DEADLINE', 'REPORT', 'CUSTOM']).default('TASK'),
    relatedId: z.string().uuid().optional(),
    color: z.string().optional(),
  }),
})

export const updateCalendarEventSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z.object({
    title: z.string().max(255).optional(),
    description: z.string().optional(),
    startAt: z.string().datetime().optional(),
    endAt: z.string().datetime().optional(),
    allDay: z.boolean().optional(),
    type: z.enum(['TASK', 'MEETING', 'DEADLINE', 'REPORT', 'CUSTOM']).optional(),
    color: z.string().optional(),
  }),
})