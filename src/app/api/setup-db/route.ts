import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import crypto from 'crypto'

// POST /api/setup-db
// One-time setup endpoint that:
// 1. Pushes the Prisma schema implicitly (when first record is created)
// 2. Creates the default admin (ADMIN001 / admin123) if missing
// 3. Creates a default work schedule if missing
//
// Body: { "databaseUrl": "mongodb+srv://user:pass@cluster.../attendance_db?..." }
// The DATABASE_URL is provided in the request body so the user can set it
// without having to use Vercel dashboard (handy for first-time setup).
//
// Once setup is complete, the user should add DATABASE_URL to Vercel env vars
// for permanent use.

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
  const body = await req.json().catch(() => ({}))
  const { databaseUrl } = body as { databaseUrl?: string }

  if (!databaseUrl) {
    return NextResponse.json(
      {
        error: 'يرجى تمرير databaseUrl في الطلب',
        example: {
          databaseUrl: 'mongodb+srv://USER:PASSWORD@cluster0.xxxxx.mongodb.net/attendance_db?retryWrites=true&w=majority',
        },
      },
      { status: 400 }
    )
  }

  if (!databaseUrl.startsWith('mongodb://') && !databaseUrl.startsWith('mongodb+srv://')) {
    return NextResponse.json(
      { error: 'databaseUrl يجب أن يبدأ بـ mongodb:// أو mongodb+srv://' },
      { status: 400 }
    )
  }

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

  const result: {
    databaseUrl: string
    connectionOk: boolean
    connectionError?: string
    collections: string[]
    adminCreated: boolean
    adminAlreadyExisted: boolean
    scheduleCreated: boolean
    admin: { code: string; name: string; role: string } | null
    error?: string
  } = {
    databaseUrl: databaseUrl.replace(/\/\/([^:]+):([^@]+)@/, '//$1:****@'),
    connectionOk: false,
    collections: [],
    adminCreated: false,
    adminAlreadyExisted: false,
    scheduleCreated: false,
    admin: null,
  }

  try {
    // Test connection
    await prisma.$connect()
    result.connectionOk = true

    // Try to count employees — this also implicitly creates the collection
    let employeeCount = 0
    try {
      employeeCount = await prisma.employee.count()
    } catch {
      // Collection doesn't exist yet — that's fine, will be created on first insert
    }

    // Create default schedule if missing
    const existingSchedule = await prisma.scheduleSetting.findFirst({ where: { isActive: true } })
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
      result.scheduleCreated = true
    }

    // Create default admin if missing
    const existing = await prisma.employee.findUnique({ where: { code: 'ADMIN001' } })
    if (existing) {
      result.adminAlreadyExisted = true
      result.admin = { code: existing.code, name: existing.name, role: existing.role }
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
      result.adminCreated = true
      result.admin = { code: admin.code, name: admin.name, role: admin.role }
    }

    // List collections
    try {
      const collections = await (prisma as unknown as {
        db: { db: { listCollections: () => Promise<Array<{ name: string }>> } }
      }).db.db.listCollections()
      result.collections = collections.map((c) => c.name)
    } catch {
      // Fallback: list known collections from schema
      result.collections = [
        'employees',
        'sessions',
        'attendances',
        'locationpings',
        'schedulesettings',
        'auditlogs',
      ]
    }

    await prisma.$disconnect()

    return NextResponse.json({
      success: true,
      message: result.adminCreated
        ? 'تم إعداد قاعدة البيانات وإنشاء حساب المدير بنجاح'
        : 'قاعدة البيانات جاهزة (المدير موجود مسبقاً)',
      employeeCount,
      ...result,
      nextStep:
        'الآن أضف databaseUrl إلى Vercel Environment Variables باسم DATABASE_URL ثم أعد النشر',
      credentials: {
        code: 'ADMIN001',
        password: 'admin123',
      },
    })
  } catch (e) {
    await prisma.$disconnect().catch(() => {})
    result.connectionError = e instanceof Error ? `${e.name}: ${e.message}` : String(e)
    return NextResponse.json(
      {
        error: 'فشل الاتصال بقاعدة البيانات',
        details: result.connectionError,
        hint:
          'تأكد أن: (1) كلمة المرور صحيحة (2) IP 0.0.0.0/0 مسموح في MongoDB Atlas Network Access (3) الـ URL يحتوي على اسم database قبل علامة ?',
        providedUrl: result.databaseUrl,
      },
      { status: 500 }
    )
  }
}
