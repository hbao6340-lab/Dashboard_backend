// Report Validators
import { z } from 'zod'

export const getReportsSchema = z.object({
  query: z.object({
    page: z.coerce.number().positive().default(1),
    limit: z.coerce.number().positive().max(100).default(20),
    search: z.string().optional(),
    type: z.enum(['TASK_SPECIFIC', 'MONTHLY', 'GENERAL']).optional(),
    categoryId: z.string().uuid().optional(),
    authorId: z.string().uuid().optional(),
    status: z.enum(['DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'REVISION_REQUESTED', 'APPROVED', 'REJECTED', 'FINALIZED']).optional(),
    reportingMonth: z.coerce.number().min(1).max(12).optional(),
    reportingYear: z.coerce.number().min(2020).max(2030).optional(),
    sortBy: z.string().default('createdAt'),
    sortOrder: z.enum(['asc', 'desc']).default('desc'),
  }),
})

export const getReportSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
})

export const createReportSchema = z.object({
  body: z.object({
    title: z.string().min(1, 'Title is required').max(255),
    type: z.enum(['TASK_SPECIFIC', 'MONTHLY', 'GENERAL']),
    categoryId: z.string().uuid().optional(),
    subject: z.string().optional(),
    summary: z.string().optional(),
    content: z.string().optional(),
    workCompleted: z.string().optional(),
    results: z.string().optional(),
    problems: z.string().optional(),
    recommendations: z.string().optional(),
    statistics: z.string().optional(),
    reportingMonth: z.coerce.number().min(1).max(12).optional(),
    reportingYear: z.coerce.number().min(2020).max(2030).optional(),
    relatedTaskId: z.string().uuid().optional(),
    relatedDocumentId: z.string().uuid().optional(),
  }),
})

export const updateReportSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z.object({
    title: z.string().max(255).optional(),
    type: z.enum(['TASK_SPECIFIC', 'MONTHLY', 'GENERAL']).optional(),
    categoryId: z.string().uuid().nullable().optional(),
    subject: z.string().optional(),
    summary: z.string().optional(),
    content: z.string().optional(),
    workCompleted: z.string().optional(),
    results: z.string().optional(),
    problems: z.string().optional(),
    recommendations: z.string().optional(),
    statistics: z.string().optional(),
    reportingMonth: z.coerce.number().min(1).max(12).nullable().optional(),
    reportingYear: z.coerce.number().min(2020).max(2030).nullable().optional(),
    relatedTaskId: z.string().uuid().nullable().optional(),
    relatedDocumentId: z.string().uuid().nullable().optional(),
  }),
})

export const submitReportSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
})

export const reviewReportSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z.object({
    status: z.enum(['UNDER_REVIEW', 'REVISION_REQUESTED', 'APPROVED', 'REJECTED']),
    comments: z.string().optional(),
  }),
})