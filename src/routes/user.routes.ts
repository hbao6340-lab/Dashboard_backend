// User Routes
import { Router } from 'express'
import { validate } from '../middleware/validate.js'
import {
  getUsers,
  getUser,
  createUser,
  updateUser,
  deleteUser,
  resetUserPassword,
  toggleUserStatus,
  getDepartments,
} from '../controllers/user.controller.js'
import { getUsersSchema, createUserSchema, updateUserSchema } from '../validators/user.validators.js'
import { authMiddleware, requireRole } from '../middleware/auth.js'
import { z } from 'zod'

const router = Router()

router.use(authMiddleware)

router.get('/', requireRole('ADMINISTRATOR', 'DEVELOPER'), validate(getUsersSchema), getUsers)
router.get('/departments', getDepartments)
router.get('/:id', validate(getUsersSchema), getUser)
router.post('/', requireRole('DEVELOPER'), validate(createUserSchema), createUser)
router.patch('/:id', validate(updateUserSchema), updateUser)
router.patch('/:id/status', requireRole('ADMINISTRATOR', 'DEVELOPER'), validate(z.object({ params: z.object({ id: z.string().uuid() }), body: z.object({ status: z.enum(['ACTIVE', 'INACTIVE', 'DISABLED']) }) })), toggleUserStatus)
router.delete('/:id', requireRole('DEVELOPER'), deleteUser)
router.post('/:id/reset-password', requireRole('ADMINISTRATOR', 'DEVELOPER'), validate(z.object({ params: z.object({ id: z.string().uuid() }), body: z.object({ newPassword: z.string().min(8) }) })), resetUserPassword)

export default router