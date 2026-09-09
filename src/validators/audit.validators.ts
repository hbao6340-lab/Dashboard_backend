// Audit Validators
import { z } from 'zod'

export const getAuditLogsSchema = z.object({
  query: z.object({
    page: z.coerce.number().positive().default(1),
    limit: z.coerce.number().positive().max(100).default(50),
    userId: z.string().uuid().optional(),
    action: z.string().optional(),
    targetType: z.string().optional(),
    targetId: z.string().optional(),
    startDate: z.string().datetime().optional(),
    endDate: z.string().datetime().optional(),
  }),
})