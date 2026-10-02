// Task Validators
import { z } from 'zod'

export const getTasksSchema = z.object({
  query: z.object({
    page: z.coerce.number().positive().default(1),
    limit: z.coerce.number().positive().max(100).default(20),
    search: z.string().optional(),
    categoryId: z.string().uuid().optional(),
    departmentId: z.string().uuid().optional(),
    status: z.enum(['NOT_STARTED', 'ASSIGNED', 'IN_PROGRESS', 'WAITING', 'COMPLETED', 'CANCELLED', 'OVERDUE']).optional(),
    // 3 priority levels: Thấp (LOW) / Trung bình (NORMAL) / Cao (HIGH)
    priority: z.enum(['LOW', 'NORMAL', 'HIGH']).optional(),
    assignedToId: z.string().uuid().optional(),
    createdById: z.string().uuid().optional(),
    sortBy: z.string().default('createdAt'),
    sortOrder: z.enum(['asc', 'desc']).default('desc'),
  }),
})

export const getTaskSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
})

export const createTaskSchema = z.object({
  body: z.object({
    title: z.string().min(1, 'Title is required').max(255),
    description: z.string().optional(),
    categoryId: z.string().uuid().optional(),
    departmentId: z.string().uuid().optional(),
    relatedDocumentId: z.string().uuid().optional(),
    relatedReportId: z.string().uuid().optional(),
    startDate: z.string().datetime().optional(),
    deadline: z.string().datetime().optional(),
    // 3 priority levels: Thấp (LOW) / Trung bình (NORMAL) / Cao (HIGH)
    priority: z.enum(['LOW', 'NORMAL', 'HIGH']).default('NORMAL'),
    assigneeIds: z.array(z.string().uuid()).optional(),
  }),
})

export const updateTaskSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z.object({
    title: z.string().max(255).optional(),
    description: z.string().optional(),
    categoryId: z.string().uuid().nullable().optional(),
    departmentId: z.string().uuid().nullable().optional(),
    relatedDocumentId: z.string().uuid().nullable().optional(),
    relatedReportId: z.string().uuid().nullable().optional(),
    startDate: z.string().datetime().nullable().optional(),
    deadline: z.string().datetime().nullable().optional(),
    // 3 priority levels: Thấp (LOW) / Trung bình (NORMAL) / Cao (HIGH)
    priority: z.enum(['LOW', 'NORMAL', 'HIGH']).optional(),
    status: z.enum(['NOT_STARTED', 'ASSIGNED', 'IN_PROGRESS', 'WAITING', 'COMPLETED', 'CANCELLED', 'OVERDUE']).optional(),
    progress: z.coerce.number().min(0).max(100).optional(),
  }),
})

export const assignTaskSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z.object({
    userId: z.string().uuid(),
    isPrimary: z.boolean().default(false),
  }),
})

export const updateTaskProgressSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z.object({
    progress: z.coerce.number().min(0).max(100),
    updateText: z.string().min(1, 'Update text is required'),
  }),
})

export const addTaskCommentSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z.object({
    content: z.string().min(1, 'Comment is required'),
  }),
})

export const addTaskDependencySchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z.object({
    dependsOnId: z.string().uuid(),
    type: z.enum(['BLOCKS', 'RELATES_TO']).default('BLOCKS'),
  }),
})