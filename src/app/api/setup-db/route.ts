import { NextRequest, NextResponse } from 'next/server'
import { getMongoClient } from '@/lib/mongo'
import crypto from 'crypto'

// POST /api/setup-db
// One-time setup endpoint that:
// 1. Tests connection to MongoDB Atlas (fast — uses native driver)
// 2. Creates the default admin (ADMIN001 / admin123) if missing
// 3. Creates a default work schedule if missing
//
// Body: { "databaseUrl": "mongodb+srv://user:pass@cluster.../attendance_db?..." }
//
// Uses MongoDB native driver directly — much faster than Prisma's cold start.
// Total time: 1-3s (vs 10-15s with Prisma), well within Vercel's 10s limit.

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

  try {
    // Use MongoDB native driver (fast — no Prisma cold start)
    const { db } = await getMongoClient(databaseUrl)

    // 1. Create default schedule if missing
    const existingSchedule = await db.collection('schedulesettings').findOne({ isActive: true })
    let scheduleCreated = false
    if (!existingSchedule) {
      await db.collection('schedulesettings').insertOne({
        name: 'default',
        checkInTime: '09:00',
        checkOutTime: '17:00',
        lateThresholdMinutes: 15,
        earlyLeaveThresholdMinutes: 15,
        workDays: ['0', '1', '2', '3', '4'],
        isActive: true,
        updatedAt: new Date(),
      })
      scheduleCreated = true
    }

    // 2. Create default admin if missing
    const existing = await db.collection('employees').findOne({ code: 'ADMIN001' })
    let adminCreated = false
    let adminInfo: { code: string; name: string; role: string } | null = null

    if (existing) {
      adminInfo = {
        code: existing.code,
        name: existing.name,
        role: existing.role,
      }
    } else {
      const result = await db.collection('employees').insertOne({
        code: 'ADMIN001',
        name: 'مدير النظام',
        phone: '01000000000',
        hashedPassword: hashPassword('admin123'),
        boundDeviceId: null,
        role: 'MANAGER',
        permissions: ALL_PERMISSIONS,
        isActive: true,
        lastLat: null,
        lastLng: null,
        lastPingAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      adminCreated = true
      adminInfo = { code: 'ADMIN001', name: 'مدير النظام', role: 'MANAGER' }
    }

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
