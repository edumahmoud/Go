// scripts/seed-admin.js
// Ensures a default MANAGER account exists after a fresh database setup.
// Runs idempotently: if ADMIN001 already exists, it does nothing.
//
// Default credentials:
//   Code:     ADMIN001
//   Password: admin123
//
// Usage:
//   node scripts/seed-admin.js
//
// This script is invoked automatically by scripts/start-all.sh.

const { PrismaClient } = require('@prisma/client')

const DEFAULT_CODE = 'ADMIN001'
const DEFAULT_PASSWORD = 'admin123'
const DEFAULT_NAME = 'مدير النظام'
const DEFAULT_PHONE = '01000000000'

// All 15 permissions granted to the default MANAGER
const ALL_PERMISSIONS = [
  'dashboard:view',
  'employees:view',
  'employees:create',
  'employees:edit',
  'employees:delete',
  'employees:suspend',
  'employees:reset_device',
  'employees:reset_password',
  'employees:promote',
  'employees:demote',
  'permissions:manage',
  'attendance:edit',
  'schedule:edit',
  'locations:view',
  'auditlog:view',
]

// SHA-256 + salt (must match src/lib/auth.ts hashPassword)
const crypto = require('crypto')
function hashPassword(password) {
  const salt = crypto.createHash('sha256').update('attendance_app_salt_v1').digest('hex')
  return crypto.createHash('sha256').update(salt + password).digest('hex')
}

async function main() {
  const prisma = new PrismaClient()
  try {
    const existing = await prisma.employee.findUnique({ where: { code: DEFAULT_CODE } })
    if (existing) {
      console.log(`[seed] Admin account "${DEFAULT_CODE}" already exists — skipping.`)
      return
    }

    // Create the default manager
    const manager = await prisma.employee.create({
      data: {
        code: DEFAULT_CODE,
        name: DEFAULT_NAME,
        phone: DEFAULT_PHONE,
        hashedPassword: hashPassword(DEFAULT_PASSWORD),
        boundDeviceId: null, // will be bound on first login
        role: 'MANAGER',
        permissions: ALL_PERMISSIONS,
        isActive: true,
      },
    })

    // Ensure a default schedule exists too
    const scheduleExists = await prisma.scheduleSetting.findFirst({ where: { isActive: true } })
    if (!scheduleExists) {
      await prisma.scheduleSetting.create({
        data: {
          name: 'default',
          checkInTime: '09:00',
          checkOutTime: '17:00',
          lateThresholdMinutes: 15,
          earlyLeaveThresholdMinutes: 15,
          workDays: ['0', '1', '2', '3', '4'], // Sun–Thu
          isActive: true,
        },
      })
      console.log('[seed] Default work schedule created.')
    }

    console.log(`[seed] ✅ Default manager created successfully.`)
    console.log(`[seed]    Code:     ${DEFAULT_CODE}`)
    console.log(`[seed]    Password: ${DEFAULT_PASSWORD}`)
    console.log(`[seed]    Role:     MANAGER (15 permissions)`)
    console.log(`[seed]    ID:       ${manager.id}`)
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((err) => {
  console.error('[seed] Failed to seed default admin:', err.message)
  process.exit(1)
})
