// Application Entry Point
import './middleware/asyncErrors.js'
import 'dotenv/config'
import app from './app.js'
import env from './config/env.js'
import prisma from './config/prisma.js'

async function startServer() {
  try {
    // Test database connection
    await prisma.$connect()
    console.log('✅ Database connected successfully')

    // Start HTTP server
    const server = app.listen(env.PORT, () => {
      console.log(`🚀 Server running on http://localhost:${env.PORT}`)
      console.log(`📝 Environment: ${env.NODE_ENV}`)
      console.log(`🔗 API prefix: ${env.API_PREFIX}`)
    })

    // Graceful shutdown
    const shutdown = async (signal: string) => {
      console.log(`\n📴 Received ${signal}. Shutting down gracefully...`)
      server.close(async () => {
        await prisma.$disconnect()
        console.log('✅ Database disconnected')
        process.exit(0)
      })

      // Force close after 10 seconds
      setTimeout(() => {
        console.error('❌ Forced shutdown after timeout')
        process.exit(1)
      }, 10000)
    }

    process.on('SIGTERM', () => shutdown('SIGTERM'))
    process.on('SIGINT', () => shutdown('SIGINT'))

  } catch (error) {
    console.error('❌ Failed to start server:', error)
    await prisma.$disconnect()
    process.exit(1)
  }
}

startServer()