// Document Validators
import { z } from 'zod'

// Query strings often arrive as "" for "no filter" — treat them as absent.
const emptyToUndefined = (v: unknown) => (v === '' ? undefined : v)

export const getDocumentsSchema = z.object({
  query: z.object({
    page: z.coerce.number().positive().default(1),
    limit: z.coerce.number().positive().max(100).default(20),
    search: z.preprocess(emptyToUndefined, z.string().optional()),
    categoryId: z.preprocess(emptyToUndefined, z.string().uuid().optional()),
    status: z.preprocess(emptyToUndefined, z.enum(['DRAFT', 'SUBMITTED', 'ACTIVE', 'IN_PROGRESS', 'COMPLETED', 'ARCHIVED']).optional()),
    type: z.preprocess(emptyToUndefined, z.enum(['PDF', 'DOC', 'DOCX', 'XLS', 'XLSX', 'PPT', 'PPTX', 'TXT', 'JPG', 'JPEG', 'PNG', 'ZIP', 'OTHER']).optional()),
    uploadedById: z.preprocess(emptyToUndefined, z.string().uuid().optional()),
    sortBy: z.string().default('createdAt'),
    sortOrder: z.enum(['asc', 'desc']).default('desc'),
  }),
})

export const getDocumentSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
})

export const createDocumentSchema = z.object({
  body: z.object({
    title: z.string().min(1, 'Title is required').max(255),
    description: z.string().optional(),
    type: z.enum(['PDF', 'DOC', 'DOCX', 'XLS', 'XLSX', 'PPT', 'PPTX', 'TXT', 'JPG', 'JPEG', 'PNG', 'ZIP', 'OTHER']),
    categoryId: z.string().uuid().optional(),
    confidentiality: z.enum(['PUBLIC', 'INTERNAL', 'CONFIDENTIAL', 'RESTRICTED']).default('INTERNAL'),
    relatedTaskId: z.string().uuid().optional(),
    relatedReportId: z.string().uuid().optional(),
  }),
})

export const updateDocumentSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z.object({
    title: z.string().max(255).optional(),
    description: z.string().optional(),
    categoryId: z.string().uuid().nullable().optional(),
    status: z.enum(['DRAFT', 'SUBMITTED', 'ACTIVE', 'IN_PROGRESS', 'COMPLETED', 'ARCHIVED']).optional(),
    confidentiality: z.enum(['PUBLIC', 'INTERNAL', 'CONFIDENTIAL', 'RESTRICTED']).optional(),
    relatedTaskId: z.string().uuid().nullable().optional(),
    relatedReportId: z.string().uuid().nullable().optional(),
  }),
})

export const assignDocumentSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z.object({
    userId: z.string().uuid(),
    responsibility: z.string().optional(),
    instructions: z.string().optional(),
    deadline: z.string().datetime().optional(),
    // 3 priority levels: Thấp (LOW) / Trung bình (NORMAL) / Cao (HIGH)
    priority: z.enum(['LOW', 'NORMAL', 'HIGH']).default('NORMAL'),
    notes: z.string().optional(),
  }),
})

export const createDocumentVersionSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z.object({
    changeNotes: z.string().optional(),
  }),
})