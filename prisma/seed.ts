// Database Seed Script
import { PrismaClient } from '@prisma/client'
import argon2 from 'argon2'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Starting database seed...')

  // Hash password for all seeded accounts
  const passwordHash = await argon2.hash('password123')

  // Create departments
  const departments = await Promise.all([
    prisma.department.upsert({
      where: { code: 'ADMIN' },
      update: {},
      create: { name: 'Administration', code: 'ADMIN', description: 'Administrative department' },
    }),
    prisma.department.upsert({
      where: { code: 'IT' },
      update: {},
      create: { name: 'Information Technology', code: 'IT', description: 'IT department' },
    }),
    prisma.department.upsert({
      where: { code: 'HR' },
      update: {},
      create: { name: 'Human Resources', code: 'HR', description: 'HR department' },
    }),
    prisma.department.upsert({
      where: { code: 'FINANCE' },
      update: {},
      create: { name: 'Finance', code: 'FINANCE', description: 'Finance department' },
    }),
    prisma.department.upsert({
      where: { code: 'OPERATIONS' },
      update: {},
      create: { name: 'Operations', code: 'OPERATIONS', description: 'Operations department' },
    }),
  ])

  console.log('✅ Departments created')

  // Create categories
  const categories = await Promise.all([
    prisma.category.upsert({
      where: { name: 'Community Outreach' },
      update: {},
      create: { name: 'Community Outreach', description: 'Community engagement activities', color: '#3B82F6', sortOrder: 1 },
    }),
    prisma.category.upsert({
      where: { name: 'Public Safety' },
      update: {},
      create: { name: 'Public Safety', description: 'Public safety and security', color: '#EF4444', sortOrder: 2 },
    }),
    prisma.category.upsert({
      where: { name: 'Administration' },
      update: {},
      create: { name: 'Administration', description: 'Administrative tasks', color: '#6B7280', sortOrder: 3 },
    }),
    prisma.category.upsert({
      where: { name: 'Education' },
      update: {},
      create: { name: 'Education', description: 'Educational programs', color: '#8B5CF6', sortOrder: 4 },
    }),
    prisma.category.upsert({
      where: { name: 'Events' },
      update: {},
      create: { name: 'Events', description: 'Event planning and management', color: '#F59E0B', sortOrder: 5 },
    }),
    prisma.category.upsert({
      where: { name: 'Security' },
      update: {},
      create: { name: 'Security', description: 'Security operations', color: '#DC2626', sortOrder: 6 },
    }),
    prisma.category.upsert({
      where: { name: 'Communication' },
      update: {},
      create: { name: 'Communication', description: 'Internal and external communication', color: '#06B6D4', sortOrder: 7 },
    }),
    prisma.category.upsert({
      where: { name: 'Documentation' },
      update: {},
      create: { name: 'Documentation', description: 'Documentation and records', color: '#84CC16', sortOrder: 8 },
    }),
    prisma.category.upsert({
      where: { name: 'Other' },
      update: {},
      create: { name: 'Other', description: 'Miscellaneous', color: '#9CA3AF', sortOrder: 9 },
    }),
  ])

  console.log('✅ Categories created')

  // Create tags
  const tags = await Promise.all([
    prisma.tag.upsert({ where: { name: 'Urgent' }, update: {}, create: { name: 'Urgent', color: '#EF4444' } }),
    prisma.tag.upsert({ where: { name: 'Important' }, update: {}, create: { name: 'Important', color: '#F59E0B' } }),
    prisma.tag.upsert({ where: { name: 'Routine' }, update: {}, create: { name: 'Routine', color: '#3B82F6' } }),
    prisma.tag.upsert({ where: { name: 'Meeting' }, update: {}, create: { name: 'Meeting', color: '#8B5CF6' } }),
    prisma.tag.upsert({ where: { name: 'Report' }, update: {}, create: { name: 'Report', color: '#06B6D4' } }),
    prisma.tag.upsert({ where: { name: 'Review' }, update: {}, create: { name: 'Review', color: '#84CC16' } }),
  ])

  console.log('✅ Tags created')

  // Create developer user
  const developer = await prisma.user.upsert({
    where: { username: 'developer' },
    update: {},
    create: {
      username: 'developer',
      email: 'developer@eoffice.local',
      passwordHash,
      fullName: 'System Developer',
      role: 'DEVELOPER',
      status: 'ACTIVE',
      departmentId: departments[1].id, // IT
      position: 'System Developer',
    },
  })

  // Create admin users
  const admin1 = await prisma.user.upsert({
    where: { username: 'admin' },
    update: {},
    create: {
      username: 'admin',
      email: 'admin@eoffice.local',
      passwordHash,
      fullName: 'System Administrator',
      role: 'ADMINISTRATOR',
      status: 'ACTIVE',
      departmentId: departments[0].id, // ADMIN
      position: 'System Administrator',
    },
  })

  const admin2 = await prisma.user.upsert({
    where: { username: 'admin2' },
    update: {},
    create: {
      username: 'admin2',
      email: 'admin2@eoffice.local',
      passwordHash,
      fullName: 'Deputy Administrator',
      role: 'ADMINISTRATOR',
      status: 'ACTIVE',
      departmentId: departments[0].id,
      position: 'Deputy Administrator',
    },
  })

  // Create regular users (75 users total)
  const positions = [
    'Office Manager', 'Senior Clerk', 'Clerk', 'Assistant', 'Coordinator',
    'Analyst', 'Specialist', 'Officer', 'Supervisor', 'Team Lead',
  ]

  const users = []
  for (let i = 1; i <= 70; i++) {
    const dept = departments[Math.floor(Math.random() * departments.length)]
    const pos = positions[Math.floor(Math.random() * positions.length)]
    const user = await prisma.user.upsert({
      where: { username: `user${i.toString().padStart(3, '0')}` },
      update: {},
      create: {
        username: `user${i.toString().padStart(3, '0')}`,
        email: `user${i.toString().padStart(3, '0')}@eoffice.local`,
        passwordHash,
        fullName: `User ${i.toString().padStart(3, '0')}`,
        role: 'USER',
        status: 'ACTIVE',
        departmentId: dept.id,
        position: pos,
        phone: `555-${Math.floor(Math.random() * 900 + 100)}-${Math.floor(Math.random() * 9000 + 1000).toString().padStart(4, '0')}`,
      },
    })
    users.push(user)
  }

  console.log('✅ Users created (1 Developer, 2 Admins, 70 Users)')

  // Create system settings
  const settings = [
    { key: 'organization.name', value: 'E-Office Organization', description: 'Organization name', category: 'ORGANIZATION', isPublic: true },
    { key: 'organization.timezone', value: 'Asia/Ho_Chi_Minh', description: 'Default timezone', category: 'ORGANIZATION', isPublic: true },
    { key: 'organization.language', value: 'en', description: 'Default language', category: 'ORGANIZATION', isPublic: true },
    { key: 'security.sessionTimeout', value: 3600, description: 'Session timeout in seconds', category: 'SECURITY' },
    { key: 'security.maxLoginAttempts', value: 5, description: 'Maximum login attempts before lockout', category: 'SECURITY' },
    { key: 'security.passwordMinLength', value: 8, description: 'Minimum password length', category: 'SECURITY' },
    { key: 'storage.maxFileSize', value: 52428800, description: 'Maximum file size in bytes (50MB)', category: 'STORAGE' },
    { key: 'storage.allowedExtensions', value: ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'jpg', 'jpeg', 'png', 'zip'], description: 'Allowed file extensions', category: 'STORAGE' },
    { key: 'tasks.defaultPriority', value: 'NORMAL', description: 'Default task priority', category: 'TASKS', isPublic: true },
    { key: 'reports.requireApproval', value: true, description: 'Whether reports require approval', category: 'REPORTS', isPublic: true },
  ]

  for (const setting of settings) {
    await prisma.systemSetting.upsert({
      where: { key: setting.key },
      update: { value: setting.value, description: setting.description, category: setting.category, isPublic: setting.isPublic ?? false },
      create: { key: setting.key, value: setting.value, description: setting.description, category: setting.category, isPublic: setting.isPublic ?? false },
    })
  }

  console.log('✅ System settings created')

  // Create default permissions
  const permissions = [
    // Documents
    { key: 'documents.view', name: 'View Documents', category: 'DOCUMENTS' },
    { key: 'documents.upload', name: 'Upload Documents', category: 'DOCUMENTS' },
    { key: 'documents.edit', name: 'Edit Documents', category: 'DOCUMENTS' },
    { key: 'documents.download', name: 'Download Documents', category: 'DOCUMENTS' },
    { key: 'documents.delete', name: 'Delete Documents', category: 'DOCUMENTS' },
    { key: 'documents.assign', name: 'Assign Documents', category: 'DOCUMENTS' },
    { key: 'documents.version', name: 'Manage Document Versions', category: 'DOCUMENTS' },

    // Tasks
    { key: 'tasks.view', name: 'View Tasks', category: 'TASKS' },
    { key: 'tasks.create', name: 'Create Tasks', category: 'TASKS' },
    { key: 'tasks.assign', name: 'Assign Tasks', category: 'TASKS' },
    { key: 'tasks.edit', name: 'Edit Tasks', category: 'TASKS' },
    { key: 'tasks.complete', name: 'Complete Tasks', category: 'TASKS' },
    { key: 'tasks.progress', name: 'Update Task Progress', category: 'TASKS' },

    // Reports
    { key: 'reports.view', name: 'View Reports', category: 'REPORTS' },
    { key: 'reports.create', name: 'Create Reports', category: 'REPORTS' },
    { key: 'reports.review', name: 'Review Reports', category: 'REPORTS' },
    { key: 'reports.approve', name: 'Approve Reports', category: 'REPORTS' },

    // Users
    { key: 'users.view', name: 'View Users', category: 'USERS' },
    { key: 'users.create', name: 'Create Users', category: 'USERS' },
    { key: 'users.edit', name: 'Edit Users', category: 'USERS' },
    { key: 'users.disable', name: 'Disable Users', category: 'USERS' },

    // Settings
    { key: 'settings.view', name: 'View Settings', category: 'SETTINGS' },
    { key: 'settings.manage', name: 'Manage Settings', category: 'SETTINGS' },

    // Audit
    { key: 'audit.view', name: 'View Audit Logs', category: 'AUDIT' },

    // Developer
    { key: 'developer.manage', name: 'Developer Management', category: 'DEVELOPER' },
  ]

  for (const perm of permissions) {
    await prisma.permission.upsert({
      where: { key: perm.key },
      update: { name: perm.name, category: perm.category },
      create: { key: perm.key, name: perm.name, category: perm.category },
    })
  }

  // Assign permissions to roles
  const allPermissions = await prisma.permission.findMany()

  // Developer gets all permissions
  for (const perm of allPermissions) {
    await prisma.rolePermission.upsert({
      where: { role_permissionId: { role: 'DEVELOPER', permissionId: perm.id } },
      update: {},
      create: { role: 'DEVELOPER', permissionId: perm.id },
    })
  }

  // Administrator gets most permissions except developer
  const adminPermissions = allPermissions.filter(p => p.category !== 'DEVELOPER')
  for (const perm of adminPermissions) {
    await prisma.rolePermission.upsert({
      where: { role_permissionId: { role: 'ADMINISTRATOR', permissionId: perm.id } },
      update: {},
      create: { role: 'ADMINISTRATOR', permissionId: perm.id },
    })
  }

  // User gets basic permissions
  const userPermissions = allPermissions.filter(p =>
    ['documents.view', 'documents.download', 'tasks.view', 'tasks.progress', 'reports.create', 'reports.view'].includes(p.key)
  )
  for (const perm of userPermissions) {
    await prisma.rolePermission.upsert({
      where: { role_permissionId: { role: 'USER', permissionId: perm.id } },
      update: {},
      create: { role: 'USER', permissionId: perm.id },
    })
  }

  console.log('✅ Permissions and role assignments created')

  console.log('🎉 Database seed completed successfully!')
  console.log('')
  console.log('📋 Default credentials:')
  console.log('   Developer: developer / password123')
  console.log('   Admin: admin / password123')
  console.log('   Admin2: admin2 / password123')
  console.log('   Users: user001 - user070 / password123')
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })