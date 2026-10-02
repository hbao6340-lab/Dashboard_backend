// Database Seed Script — Live users for Đoàn Tân Hưng
import { PrismaClient } from '@prisma/client'
import argon2 from 'argon2'

const prisma = new PrismaClient()

// 6 work categories / tags for Đoàn Tân Hưng documents
const WORK_CATEGORIES = [
  { name: 'Xây dựng, Tổ chức Đoàn', description: 'Công tác xây dựng và tổ chức Đoàn', color: '#3B82F6', sortOrder: 1 },
  { name: 'Tuyên truyền, Giáo dục', description: 'Công tác tuyên truyền, giáo dục đoàn viên thanh niên', color: '#8B5CF6', sortOrder: 2 },
  { name: 'Phong trào', description: 'Các phong trào hành động của Đoàn', color: '#F59E0B', sortOrder: 3 },
  { name: 'Chuyển đổi số trong công tác Đoàn', description: 'Ứng dụng công nghệ và chuyển đổi số', color: '#06B6D4', sortOrder: 4 },
  { name: 'Đội & Thiếu nhi', description: 'Công tác Đội và phong trào thiếu nhi', color: '#EC4899', sortOrder: 5 },
  { name: 'Hội Liên hiệp Thanh niên Việt Nam', description: 'Công tác Hội LHTN Việt Nam', color: '#10B981', sortOrder: 6 },
]

async function main() {
  console.log('🌱 Starting database seed (live Đoàn Tân Hưng users)...')

  // Departments (keep generic + Đoàn unit)
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
    prisma.department.upsert({
      where: { code: 'DOAN_TANHUNG' },
      update: { name: 'Đoàn Tân Hưng', description: 'Đoàn Thanh niên Tân Hưng' },
      create: { name: 'Đoàn Tân Hưng', code: 'DOAN_TANHUNG', description: 'Đoàn Thanh niên Tân Hưng' },
    }),
  ])

  console.log('✅ Departments created')

  // Categories = 6 Vietnamese Đoàn work categories
  for (const cat of WORK_CATEGORIES) {
    await prisma.category.upsert({
      where: { name: cat.name },
      update: { description: cat.description, color: cat.color, sortOrder: cat.sortOrder, isActive: true },
      create: { name: cat.name, description: cat.description, color: cat.color, sortOrder: cat.sortOrder },
    })
  }

  console.log('✅ Categories created (6 Vietnamese Đoàn categories)')

  // Tags = same 6 Vietnamese labels to categorise documents
  for (const cat of WORK_CATEGORIES) {
    await prisma.tag.upsert({
      where: { name: cat.name },
      update: { description: cat.description, color: cat.color, isActive: true },
      create: { name: cat.name, description: cat.description, color: cat.color },
    })
  }

  console.log('✅ Tags created (6 Vietnamese Đoàn tags)')

  // --- Live users ---
  const developerHash = await argon2.hash('password123')
  const adminHash = await argon2.hash('Tanhung.Bithu')

  // Developer (kept)
  await prisma.user.upsert({
    where: { username: 'developer' },
    update: { passwordHash: developerHash, status: 'ACTIVE', role: 'DEVELOPER', deletedAt: null },
    create: {
      username: 'developer',
      email: 'developer@eoffice.local',
      passwordHash: developerHash,
      fullName: 'System Developer',
      role: 'DEVELOPER',
      status: 'ACTIVE',
      departmentId: departments[1].id,
      position: 'System Developer',
    },
  })

  // Admin: bithu.tanhung / Tanhung.Bithu
  await prisma.user.upsert({
    where: { username: 'bithu.tanhung' },
    update: {
      passwordHash: adminHash,
      status: 'ACTIVE',
      role: 'ADMINISTRATOR',
      email: 'bithu.tanhung@tanhung.local',
      fullName: 'Bí thư Tân Hưng',
      departmentId: departments[5].id,
      position: 'Bí thư Đoàn Tân Hưng',
      deletedAt: null,
    },
    create: {
      username: 'bithu.tanhung',
      email: 'bithu.tanhung@tanhung.local',
      passwordHash: adminHash,
      fullName: 'Bí thư Tân Hưng',
      role: 'ADMINISTRATOR',
      status: 'ACTIVE',
      departmentId: departments[5].id,
      position: 'Bí thư Đoàn Tân Hưng',
    },
  })

  console.log('✅ Developer + admin (bithu.tanhung) created')

  // KP users: kp1.tanhung .. kp35.tanhung / Tanhung.KpN
  for (let i = 1; i <= 35; i++) {
    const username = `kp${i}.tanhung`
    const password = `Tanhung.Kp${i}`
    const passwordHash = await argon2.hash(password)
    const dept = departments[i % departments.length]
    await prisma.user.upsert({
      where: { username },
      update: { passwordHash, status: 'ACTIVE', role: 'USER', deletedAt: null, departmentId: dept.id },
      create: {
        username,
        email: `${username}@tanhung.local`,
        passwordHash,
        fullName: `KP${i} Tân Hưng`,
        role: 'USER',
        status: 'ACTIVE',
        departmentId: dept.id,
        position: `Chi đoàn KP${i}`,
      },
    })
    if (i % 10 === 0) console.log(`   ... ${i}/35 KP users`)
  }

  console.log('✅ KP users created (kp1.tanhung - kp35.tanhung)')

  // Retire old demo accounts (admin, admin2, user001-user070) if present
  const legacyUsernames: string[] = ['admin', 'admin2']
  for (let i = 1; i <= 70; i++) {
    legacyUsernames.push(`user${i.toString().padStart(3, '0')}`)
  }
  const legacyUsers = await prisma.user.findMany({ where: { username: { in: legacyUsernames } }, select: { id: true } })
  if (legacyUsers.length > 0) {
    const ids = legacyUsers.map((u) => u.id)
    await prisma.session.deleteMany({ where: { userId: { in: ids } } })
    await prisma.user.updateMany({ where: { id: { in: ids } }, data: { status: 'DISABLED', deletedAt: new Date() } })
    console.log(`✅ Retired ${legacyUsers.length} legacy demo accounts`)
  }

  // System settings
  const settings = [
    { key: 'organization.name', value: 'Đoàn Tân Hưng', description: 'Organization name', category: 'ORGANIZATION', isPublic: true },
    { key: 'organization.timezone', value: 'Asia/Ho_Chi_Minh', description: 'Default timezone', category: 'ORGANIZATION', isPublic: true },
    { key: 'organization.language', value: 'vi', description: 'Default language', category: 'ORGANIZATION', isPublic: true },
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

  // Permissions
  const permissions = [
    { key: 'documents.view', name: 'View Documents', category: 'DOCUMENTS' },
    { key: 'documents.upload', name: 'Upload Documents', category: 'DOCUMENTS' },
    { key: 'documents.edit', name: 'Edit Documents', category: 'DOCUMENTS' },
    { key: 'documents.download', name: 'Download Documents', category: 'DOCUMENTS' },
    { key: 'documents.delete', name: 'Delete Documents', category: 'DOCUMENTS' },
    { key: 'documents.assign', name: 'Assign Documents', category: 'DOCUMENTS' },
    { key: 'documents.version', name: 'Manage Document Versions', category: 'DOCUMENTS' },
    { key: 'tasks.view', name: 'View Tasks', category: 'TASKS' },
    { key: 'tasks.create', name: 'Create Tasks', category: 'TASKS' },
    { key: 'tasks.assign', name: 'Assign Tasks', category: 'TASKS' },
    { key: 'tasks.edit', name: 'Edit Tasks', category: 'TASKS' },
    { key: 'tasks.complete', name: 'Complete Tasks', category: 'TASKS' },
    { key: 'tasks.progress', name: 'Update Task Progress', category: 'TASKS' },
    { key: 'reports.view', name: 'View Reports', category: 'REPORTS' },
    { key: 'reports.create', name: 'Create Reports', category: 'REPORTS' },
    { key: 'reports.review', name: 'Review Reports', category: 'REPORTS' },
    { key: 'reports.approve', name: 'Approve Reports', category: 'REPORTS' },
    { key: 'users.view', name: 'View Users', category: 'USERS' },
    { key: 'users.create', name: 'Create Users', category: 'USERS' },
    { key: 'users.edit', name: 'Edit Users', category: 'USERS' },
    { key: 'users.disable', name: 'Disable Users', category: 'USERS' },
    { key: 'settings.view', name: 'View Settings', category: 'SETTINGS' },
    { key: 'settings.manage', name: 'Manage Settings', category: 'SETTINGS' },
    { key: 'audit.view', name: 'View Audit Logs', category: 'AUDIT' },
    { key: 'developer.manage', name: 'Developer Management', category: 'DEVELOPER' },
  ]

  for (const perm of permissions) {
    await prisma.permission.upsert({
      where: { key: perm.key },
      update: { name: perm.name, category: perm.category },
      create: { key: perm.key, name: perm.name, category: perm.category },
    })
  }

  const allPermissions = await prisma.permission.findMany()

  for (const perm of allPermissions) {
    await prisma.rolePermission.upsert({
      where: { role_permissionId: { role: 'DEVELOPER', permissionId: perm.id } },
      update: {},
      create: { role: 'DEVELOPER', permissionId: perm.id },
    })
  }

  const adminPermissions = allPermissions.filter((p) => p.category !== 'DEVELOPER')
  for (const perm of adminPermissions) {
    await prisma.rolePermission.upsert({
      where: { role_permissionId: { role: 'ADMINISTRATOR', permissionId: perm.id } },
      update: {},
      create: { role: 'ADMINISTRATOR', permissionId: perm.id },
    })
  }

  // Regular users: view/download documents, tasks, create/view reports.
  // NOTE: no documents.upload — only admin and above can upload.
  const userPermissions = allPermissions.filter((p) =>
    ['documents.view', 'documents.download', 'tasks.view', 'tasks.progress', 'reports.create', 'reports.view'].includes(p.key),
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
  console.log('📋 Live credentials:')
  console.log('   Developer: developer / password123')
  console.log('   Admin: bithu.tanhung / Tanhung.Bithu')
  console.log('   Users: kp1.tanhung - kp35.tanhung / Tanhung.Kp1 - Tanhung.Kp35')
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
