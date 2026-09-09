// Main Express Application
import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import compression from 'compression'
import cookieParser from 'cookie-parser'
import rateLimit from 'express-rate-limit'

import env from './config/env.js'
import { errorHandler } from './middleware/errorHandler.js'
import { authMiddleware } from './middleware/auth.js'
import { auditMiddleware } from './middleware/audit.js'
import { requestLogger } from './middleware/requestLogger.js'

import authRoutes from './routes/auth.routes.js'
import userRoutes from './routes/user.routes.js'
import documentRoutes from './routes/document.routes.js'
import taskRoutes from './routes/task.routes.js'
import reportRoutes from './routes/report.routes.js'
import categoryRoutes from './routes/category.routes.js'
import tagRoutes from './routes/tag.routes.js'
import notificationRoutes from './routes/notification.routes.js'
import calendarRoutes from './routes/calendar.routes.js'
import dashboardRoutes from './routes/dashboard.routes.js'
import settingRoutes from './routes/setting.routes.js'
import auditRoutes from './routes/audit.routes.js'

const app = express()

// Trust proxy for correct IP detection behind reverse proxy
app.set('trust proxy', 1)

// Security middleware
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  contentSecurityPolicy: false, // Configure as needed for production
}))

// CORS configuration
app.use(cors({
  origin: env.CORS_ORIGIN,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
}))

// Rate limiting
const limiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: env.RATE_LIMIT_MAX_REQUESTS,
  message: { success: false, message: 'Too many requests, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
})
app.use(limiter)

// Body parsing
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))

// Cookie parser
app.use(cookieParser(env.SESSION_SECRET))

// Compression
app.use(compression())

// Request logging
app.use(requestLogger)

// Static file serving for uploads (protected by auth middleware in routes)
app.use('/uploads', express.static(env.UPLOAD_DIR))

// Health check endpoint
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// API routes
const apiPrefix = env.API_PREFIX

// Public routes (no auth required)
app.use(`${apiPrefix}/auth`, authRoutes)

// Protected routes (auth required)
app.use(`${apiPrefix}/users`, authMiddleware, userRoutes)
app.use(`${apiPrefix}/documents`, authMiddleware, documentRoutes)
app.use(`${apiPrefix}/tasks`, authMiddleware, taskRoutes)
app.use(`${apiPrefix}/reports`, authMiddleware, reportRoutes)
app.use(`${apiPrefix}/categories`, authMiddleware, categoryRoutes)
app.use(`${apiPrefix}/tags`, authMiddleware, tagRoutes)
app.use(`${apiPrefix}/notifications`, authMiddleware, notificationRoutes)
app.use(`${apiPrefix}/calendar`, authMiddleware, calendarRoutes)
app.use(`${apiPrefix}/dashboard`, authMiddleware, dashboardRoutes)
app.use(`${apiPrefix}/settings`, authMiddleware, settingRoutes)
app.use(`${apiPrefix}/audit`, authMiddleware, auditRoutes)

// 404 handler
app.use((_req, res) => {
  res.status(404).json({ success: false, message: 'Route not found', errorCode: 'ROUTE_NOT_FOUND' })
})

// Global error handler
app.use(errorHandler)

export default app