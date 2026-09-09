// Dashboard Controller
import { Request, Response } from 'express'
import { prisma } from '../config/prisma.js'
import { AuthenticatedRequest } from '../middleware/auth.js'
import { AppError } from '../middleware/errorHandler.js'

export const getDashboardStats = async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.role === 'USER' ? req.user!.id : (req.query.userId as string) || req.user!.id
  const isAdmin = ['ADMINISTRATOR', 'DEVELOPER'].includes(req.user!.role)

  // Build where clauses based on role
  const taskWhere: any = { deletedAt: null }
  const docWhere: any = { deletedAt: null }
  const reportWhere: any = { deletedAt: null }

  if (!isAdmin) {
    taskWhere.OR = [{ createdById: userId }, { assignments: { some: { userId } } }]
    docWhere.OR = [{ uploadedById: userId }, { assignments: { some: { userId } } }]
    reportWhere.OR = [{ authorId: userId }, { reviews: { some: { reviewerId: userId } } }]
  } else if (req.query.userId) {
    taskWhere.OR = [{ createdById: userId }, { assignments: { some: { userId } } }]
    docWhere.OR = [{ uploadedById: userId }, { assignments: { some: { userId } } }]
    reportWhere.OR = [{ authorId: userId }, { reviews: { some: { reviewerId: userId } } }]
  }

  const now = new Date()
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const startOfWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay())
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

  // Parallel queries for performance
  const [
    // User stats
    totalUsers,
    activeUsers,
    // Document stats
    totalDocuments,
    // Task stats
    totalTasks,
    activeTasks,
    completedTasks,
    overdueTasks,
    tasksDueToday,
    tasksDueThisWeek,
    // Report stats
    pendingReports,
    approvedReports,
    // Charts data
    tasksByStatus,
    tasksByCategory,
    tasksByPriority,
    monthlyActivity,
    userWorkload,
    reportStats,
    // Recent activity
    recentTasks,
    recentDocuments,
    recentReports,
  ] = await Promise.all([
    // User stats
    isAdmin ? prisma.user.count({ where: { status: 'ACTIVE', deletedAt: null } }) : Promise.resolve(1),
    isAdmin ? prisma.user.count({ where: { status: 'ACTIVE', lastLoginAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }, deletedAt: null } }) : Promise.resolve(1),
    // Document stats
    prisma.document.count({ where: docWhere }),
    // Task stats
    prisma.task.count({ where: taskWhere }),
    prisma.task.count({ where: { ...taskWhere, status: { in: ['ASSIGNED', 'IN_PROGRESS', 'WAITING'] } } }),
    prisma.task.count({ where: { ...taskWhere, status: 'COMPLETED' } }),
    prisma.task.count({ where: { ...taskWhere, deadline: { lt: now }, status: { notIn: ['COMPLETED', 'CANCELLED'] } } }),
    prisma.task.count({ where: { ...taskWhere, deadline: { gte: startOfToday, lt: new Date(startOfToday.getTime() + 24 * 60 * 60 * 1000) }, status: { notIn: ['COMPLETED', 'CANCELLED'] } } }),
    prisma.task.count({ where: { ...taskWhere, deadline: { gte: startOfWeek, lt: new Date(startOfWeek.getTime() + 7 * 24 * 60 * 60 * 1000) }, status: { notIn: ['COMPLETED', 'CANCELLED'] } } }),
    // Report stats
    prisma.report.count({ where: { ...reportWhere, status: { in: ['SUBMITTED', 'UNDER_REVIEW'] } } }),
    prisma.report.count({ where: { ...reportWhere, status: 'APPROVED' } }),
    // Charts
    prisma.task.groupBy({ by: ['status'], where: taskWhere, _count: { status: true } }),
    prisma.task.groupBy({ by: ['categoryId'], where: { ...taskWhere, categoryId: { not: null } }, _count: { categoryId: true } }),
    prisma.task.groupBy({ by: ['priority'], where: taskWhere, _count: { priority: true } }),
    getMonthlyActivity(taskWhere),
    isAdmin ? getUserWorkload() : Promise.resolve([]),
    prisma.report.groupBy({ by: ['status'], where: reportWhere, _count: { status: true } }),
    // Recent
    prisma.task.findMany({ where: taskWhere, take: 5, orderBy: { createdAt: 'desc' }, include: { category: true, assignments: { include: { user: { select: { fullName: true } } } } } }),
    prisma.document.findMany({ where: docWhere, take: 5, orderBy: { createdAt: 'desc' }, include: { category: true, uploadedBy: { select: { fullName: true } } } }),
    prisma.report.findMany({ where: reportWhere, take: 5, orderBy: { createdAt: 'desc' }, include: { category: true, author: { select: { fullName: true } } } }),
  ])

  // Get category names for chart
  const categoryIds = tasksByCategory.map(t => t.categoryId).filter(Boolean) as string[]
  const categories = await prisma.category.findMany({ where: { id: { in: categoryIds } }, select: { id: true, name: true, color: true } })
  const categoryMap = new Map(categories.map(c => [c.id, c]))

  // Get user names for workload
  const userIds = userWorkload.map(u => u.userId)
  const users = await prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, fullName: true } })
  const userMap = new Map(users.map(u => [u.id, u.fullName]))

  res.json({
    success: true,
    data: {
      stats: {
        totalUsers,
        activeUsers,
        totalDocuments,
        totalTasks,
        activeTasks,
        completedTasks,
        overdueTasks,
        tasksDueToday,
        tasksDueThisWeek,
        pendingReports,
        approvedReports,
      },
      charts: {
        tasksByStatus: tasksByStatus.map(t => ({ status: t.status, count: t._count.status })),
        tasksByCategory: tasksByCategory.map(t => ({
          category: categoryMap.get(t.categoryId!)?.name || 'Unknown',
          color: categoryMap.get(t.categoryId!)?.color || '#6B7280',
          count: t._count.categoryId,
        })),
        tasksByPriority: tasksByPriority.map(t => ({ priority: t.priority, count: t._count.priority })),
        monthlyActivity,
        userWorkload: userWorkload.map(u => ({
          user: userMap.get(u.userId) || 'Unknown',
          activeTasks: u.activeTasks,
          completedTasks: u.completedTasks,
          overdueTasks: u.overdueTasks,
        })),
        reportStats: reportStats.map(r => ({ status: r.status, count: r._count.status })),
      },
      recent: {
        tasks: recentTasks.map(t => ({
          id: t.id,
          taskNumber: t.taskNumber,
          title: t.title,
          status: t.status,
          priority: t.priority,
          deadline: t.deadline,
          category: t.category,
          assignees: t.assignments.map(a => a.user.fullName),
        })),
        documents: recentDocuments.map(d => ({
          id: d.id,
          documentNumber: d.documentNumber,
          title: d.title,
          type: d.type,
          status: d.status,
          category: d.category,
          uploadedBy: d.uploadedBy.fullName,
          createdAt: d.createdAt,
        })),
        reports: recentReports.map(r => ({
          id: r.id,
          reportNumber: r.reportNumber,
          title: r.title,
          type: r.type,
          status: r.status,
          category: r.category,
          author: r.author.fullName,
          createdAt: r.createdAt,
        })),
      },
    },
  })
}

async function getMonthlyActivity(taskWhere: any) {
  const months = 12
  const data = []
  const now = new Date()

  for (let i = months - 1; i >= 0; i--) {
    const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 1)

    const created = await prisma.task.count({
      where: { ...taskWhere, createdAt: { gte: monthStart, lt: monthEnd } },
    })
    const completed = await prisma.task.count({
      where: { ...taskWhere, status: 'COMPLETED', completedAt: { gte: monthStart, lt: monthEnd } },
    })

    data.push({
      month: monthStart.toLocaleString('default', { month: 'short', year: 'numeric' }),
      created,
      completed,
    })
  }

  return data
}

async function getUserWorkload() {
  const users = await prisma.user.findMany({
    where: { status: 'ACTIVE', deletedAt: null },
    select: { id: true },
    take: 20,
  })

  const workload = []
  for (const user of users) {
    const [activeTasks, completedTasks, overdueTasks] = await Promise.all([
      prisma.task.count({ where: { assignments: { some: { userId: user.id } }, status: { in: ['ASSIGNED', 'IN_PROGRESS', 'WAITING'] }, deletedAt: null } }),
      prisma.task.count({ where: { assignments: { some: { userId: user.id } }, status: 'COMPLETED', deletedAt: null } }),
      prisma.task.count({ where: { assignments: { some: { userId: user.id } }, deadline: { lt: new Date() }, status: { notIn: ['COMPLETED', 'CANCELLED'] }, deletedAt: null } }),
    ])

    if (activeTasks > 0 || completedTasks > 0 || overdueTasks > 0) {
      workload.push({ userId: user.id, activeTasks, completedTasks, overdueTasks })
    }
  }

  return workload.sort((a, b) => b.activeTasks - a.activeTasks).slice(0, 10)
}