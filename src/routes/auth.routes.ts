// Auth Routes
import { Router } from 'express'
import { validate } from '../middleware/validate.js'
import {
  login,
  logout,
  register,
  me,
  changePassword,
  resetPassword,
  refreshToken,
} from '../controllers/auth.controller.js'
import { loginSchema, registerSchema, changePasswordSchema, resetPasswordSchema, refreshTokenSchema } from '../validators/auth.validators.js'
import { authMiddleware } from '../middleware/auth.js'

const router = Router()

// Public routes
router.post('/login', validate(loginSchema), login)
router.post('/refresh', validate(refreshTokenSchema), refreshToken)

// Protected routes
router.post('/logout', authMiddleware, logout)
router.get('/me', authMiddleware, me)
router.post('/change-password', authMiddleware, validate(changePasswordSchema), changePassword)
router.post('/reset-password', authMiddleware, validate(resetPasswordSchema), resetPassword)
router.post('/register', authMiddleware, validate(registerSchema), register)

export default router