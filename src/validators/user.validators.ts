// User Validators
import { z } from 'zod'

export const getUsersSchema = z.object({
  query: z.object({
    page: z.coerce.number().positive().default(1),
    limit: z.coerce.number().positive().max(100).default(20),
    search: z.string().optional(),
    role: z.enum(['DEVELOPER', 'ADMINISTRATOR', 'USER']).optional(),
    status: z.enum(['ACTIVE', 'INACTIVE', 'DISABLED']).optional(),
    departmentId: z.string().uuid().optional(),
    sortBy: z.string().default('createdAt'),
    sortOrder: z.enum(['asc', 'desc']).default('desc'),
  }),
})

export const createUserSchema = z.object({
  body: z.object({
    username: z.string().min(3).max(50),
    email: z.string().email(),
    password: z.string().min(8),
    fullName: z.string().min(1).max(100),
    role: z.enum(['DEVELOPER', 'ADMINISTRATOR', 'USER']).default('USER'),
    departmentId: z.string().uuid().optional(),
    departmentName: z.string().max(100).optional(),
    position: z.string().max(100).optional(),
    phone: z.string().max(20).optional(),
  }),
})

export const updateUserSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z.object({
    fullName: z.string().max(100).optional(),
    email: z.string().email().optional(),
    role: z.enum(['DEVELOPER', 'ADMINISTRATOR', 'USER']).optional(),
    departmentId: z.string().uuid().nullable().optional(),
    departmentName: z.string().max(100).optional(),
    position: z.string().max(100).optional(),
    phone: z.string().max(20).optional(),
    status: z.enum(['ACTIVE', 'INACTIVE', 'DISABLED']).optional(),
  }),
})

export const resetPasswordSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z.object({
    newPassword: z.string().min(8),
    confirmPassword: z.string().min(8),
  }).refine(data => data.newPassword === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  }),
})