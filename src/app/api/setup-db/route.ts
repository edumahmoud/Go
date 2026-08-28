import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import crypto from 'crypto'

// POST /api/setup-db
// One-time setup endpoint that:
// 1. Tests connection to MongoDB Atlas with the provided URL
// 2. Creates the default admin (ADMIN001 / admin123) if missing
// 3. Creates a default work schedule if missing
//
// Body: { "databaseUrl": "mongodb+srv://user:pass@cluster.../attendance_db?..." }
//
// NOTE: Vercel has a default 10s timeout for serverless functions.
// We keep this endpoint minimal and fast:
//   - Test connection (1s)
//   - Create admin (1-2s)
//   - Create schedule (1s)
// Total: ~3-5s, well within Vercel's default.

// Use `export const maxDuration` to extend Vercel function timeout
export const maxDuration = 30

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

function hashPassword(password: string): string {
  const salt = crypto.createHash('sha256').update('attendance_app_salt_v1').digest('hex')
  return crypto.createHash('sha256').update(salt + password).digest('hex')
}

export async function POST(req: NextRequest) {
  const startTime = Date.now()
  const body = await req.json().catch(() => ({}))
  const { databaseUrl } = body as { databaseUrl?: string }

  if (!databaseUrl) {
    return NextResponse.json(
      { error: 'يرجى تمرير databaseUrl في الطلب' },
      { status: 400 }
    )
  }

  if (!databaseUrl.startsWith('mongodb://') && !databaseUrl.startsWith('mongodb+srv://')) {
    return NextResponse.json(
      { error: 'databaseUrl يجب أن يبدأ بـ mongodb:// أو mongodb+srv://' },
      { status: 400 }
    )
  }

  const maskedUrl = databaseUrl.replace(/\/\/([^:]+):([^@]+)@/, '//$1:****@')

  // Create a fresh PrismaClient with the provided URL
  let prisma: PrismaClient
  try {
    prisma = new PrismaClient({
      datasources: { db: { url: databaseUrl } },
      log: ['error'],
    })
  } catch (e) {
    return NextResponse.json(
      { error: 'فشل إنشاء Prisma client', details: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    )
  }

  try {
    // 1. Connect (with timeout)
    await Promise.race([
      prisma.$connect(),
      new Promise((_, reject) => setTimeout(() => reject(new Error('انتهت مهلة الاتصال (10 ثواني) — تأكد أن IP 0.0.0.0/0 مسموح في MongoDB Atlas Network Access')), 10000)),
    ])

    // 2. Create default schedule (fast, single insert)
    const existingSchedule = await prisma.scheduleSetting.findFirst({ where: { isActive: true } })
    let scheduleCreated = false
    if (!existingSchedule) {
      await prisma.scheduleSetting.create({
        data: {
          name: 'default',
          checkInTime: '09:00',
          checkOutTime: '17:00',
          lateThresholdMinutes: 15,
          earlyLeaveThresholdMinutes: 15,
          workDays: ['0', '1', '2', '3', '4'],
          isActive: true,
        },
      })
      scheduleCreated = true
    }

    // 3. Create default admin if missing
    const existing = await prisma.employee.findUnique({ where: { code: 'ADMIN001' } })
    let adminCreated = false
    let adminInfo: { code: string; name: string; role: string } | null = null

    if (existing) {
      adminInfo = { code: existing.code, name: existing.name, role: existing.role }
    } else {
      const admin = await prisma.employee.create({
        data: {
          code: 'ADMIN001',
          name: 'مدير النظام',
          phone: '01000000000',
          hashedPassword: hashPassword('admin123'),
          boundDeviceId: null,
          role: 'MANAGER',
          permissions: ALL_PERMISSIONS,
          isActive: true,
        },
      })
      adminCreated = true
      adminInfo = { code: admin.code, name: admin.name, role: admin.role }
    }

    await prisma.$disconnect()
    const elapsedMs = Date.now() - startTime

    return NextResponse.json({
      success: true,
      message: adminCreated
        ? 'تم إعداد قاعدة البيانات وإنشاء حساب المدير بنجاح'
        : 'قاعدة البيانات جاهزة (المدير موجود مسبقاً)',
      elapsedMs,
      connectionOk: true,
      scheduleCreated,
      adminCreated,
      adminAlreadyExisted: !adminCreated,
      admin: adminInfo,
      nextStep:
        'أضف databaseUrl إلى Vercel Environment Variables باسم DATABASE_URL ثم أعد النشر لتسجيل الدخول الدائم',
      credentials: {
        code: 'ADMIN001',
        password: 'admin123',
      },
    })
  } catch (e) {
    await prisma.$disconnect().catch(() => {})
    const elapsedMs = Date.now() - startTime
    const errorMessage = e instanceof Error ? e.message : String(e)
    return NextResponse.json(
      {
        error: 'فشل الاتصال بقاعدة البيانات',
        details: errorMessage,
        elapsedMs,
        providedUrl: maskedUrl,
        hint: 'تأكد أن: (1) كلمة المرور صحيحة (2) IP 0.0.0.0/0 مسموح في MongoDB Atlas Network Access (3) الـ URL يحتوي على اسم database (attendance_db) قبل علامة ?',
      },
      { status: 500 }
    )
  }
}
