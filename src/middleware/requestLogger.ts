// Request Logger Middleware
import { Request, Response, NextFunction } from 'express'

export const requestLogger = (req: Request, res: Response, next: NextFunction) => {
  const start = Date.now()

  // Log request
  console.log(`📥 ${req.method} ${req.originalUrl}`, {
    ip: req.ip,
    userAgent: req.get('user-agent'),
  })

  // Log response
  res.on('finish', () => {
    const duration = Date.now() - start
    const statusColor = res.statusCode >= 400 ? '🔴' : res.statusCode >= 300 ? '🟡' : '🟢'
    console.log(`${statusColor} ${req.method} ${req.originalUrl} - ${res.statusCode} (${duration}ms)`)
  })

  next()
}