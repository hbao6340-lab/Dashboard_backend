// Notification Validators
import { z } from 'zod'

export const getNotificationsSchema = z.object({
  query: z.object({
    page: z.coerce.number().positive().default(1),
    limit: z.coerce.number().positive().max(100).default(20),
    isRead: z.coerce.boolean().optional(),
    type: z.string().optional(),
  }),
})

export const markNotificationReadSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
})

export const markAllNotificationsReadSchema = z.object({
  body: z.object({}).optional(),
})