// Dashboard Validators
import { z } from 'zod'

export const getDashboardStatsSchema = z.object({
  query: z.object({
    userId: z.string().uuid().optional(), // For admin to view specific user
  }),
})