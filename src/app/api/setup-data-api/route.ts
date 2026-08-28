import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'

// POST /api/setup-data-api
// Sets up the database via MongoDB Atlas Data API (HTTPS only — no driver needed)
//
// Body: {
//   apiUrl: "https://data.mongodb-api.com/app/xxx/endpoint/data/v1",
//   apiKey: "xxxxxxxxxxxxxxxx",
//   dataSource?: "Cluster0" (default),
//   database?: "attendance_db" (default)
// }
//
// This endpoint:
// 1. Tests Data API connection
// 2. Creates default schedule if missing
// 3. Creates default admin (ADMIN001 / admin123) if missing
// 4. Returns success with credentials
//
// Once setup is complete, the user should add the same credentials
// to Vercel Environment Variables:
//   MONGODB_DATA_API_URL
//   MONGODB_DATA_API_KEY
//   MONGODB_DATA_SOURCE (optional)
//   MONGODB_DATABASE (optional)

export const maxDuration = 15

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

async function dataApiCall(
  apiUrl: string,
  apiKey: string,
  dataSource: string,
  database: string,
  action: string,
  body: Record<string, unknown>
) {
  const res = await fetch(`${apiUrl}/action/${action}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Request-Headers': '*',
      'api-key': apiKey,
    },
    body: JSON.stringify({ dataSource, database, ...body }),
  })
  const data = await res.json().catch(() => ({ error: 'Invalid JSON response' }))
  if (!res.ok) {
    throw new Error(`Data API error (${res.status}): ${data.error || data.errorCode || JSON.stringify(data)}`)
  }
  return data
}

export async function POST(req: NextRequest) {
  const startTime = Date.now()
  const body = await req.json().catch(() => ({}))
  const {
    apiUrl,
    apiKey,
    dataSource = 'Cluster0',
    database = 'attendance_db',
  } = body as {
    apiUrl?: string
    apiKey?: string
    dataSource?: string
    database?: string
  }

  if (!apiUrl || !apiKey) {
    return NextResponse.json(
      { error: 'يرجى تمرير apiUrl و apiKey' },
      { status: 400 }
    )
  }

  if (!apiUrl.startsWith('https://')) {
    return NextResponse.json(
      { error: 'apiUrl يجب أن يبدأ بـ https://' },
      { status: 400 }
    )
  }

  const maskedKey = apiKey.slice(0, 6) + '...' + apiKey.slice(-4)

  try {
    // 1. Test connection by counting employees
    let employeeCount = 0
    try {
      const result = await dataApiCall(apiUrl, apiKey, dataSource, database, 'aggregate', {
        collection: 'employees',
        pipeline: [{ $match: {} }, { $count: 'total' }],
      })
      employeeCount = (result as unknown as Array<{ total: number }>)?.[0]?.total ?? 0
    } catch {
      // Collection doesn't exist yet — that's fine, will be created on first insert
    }

    // 2. Check/create default schedule
    const existingSchedule = await dataApiCall(apiUrl, apiKey, dataSource, database, 'findOne', {
      collection: 'schedulesettings',
      filter: { isActive: true },
    })

    let scheduleCreated = false
    if (!existingSchedule.document) {
      await dataApiCall(apiUrl, apiKey, dataSource, database, 'insertOne', {
        collection: 'schedulesettings',
        document: {
          name: 'default',
          checkInTime: '09:00',
          checkOutTime: '17:00',
          lateThresholdMinutes: 15,
          earlyLeaveThresholdMinutes: 15,
          workDays: ['0', '1', '2', '3', '4'],
          isActive: true,
          updatedAt: { $date: new Date().toISOString() },
        },
      })
      scheduleCreated = true
    }

    // 3. Check/create default admin
    const existing = await dataApiCall(apiUrl, apiKey, dataSource, database, 'findOne', {
      collection: 'employees',
      filter: { code: 'ADMIN001' },
    })

    let adminCreated = false
    let adminInfo: { code: string; name: string; role: string } | null = null

    if (existing.document) {
      const doc = existing.document as { code: string; name: string; role: string }
      adminInfo = { code: doc.code, name: doc.name, role: doc.role }
    } else {
      const insertResult = await dataApiCall(apiUrl, apiKey, dataSource, database, 'insertOne', {
        collection: 'employees',
        document: {
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
          createdAt: { $date: new Date().toISOString() },
          updatedAt: { $date: new Date().toISOString() },
        },
      })
      adminCreated = true
      adminInfo = { code: 'ADMIN001', name: 'مدير النظام', role: 'MANAGER' }
      void insertResult
    }

    const elapsedMs = Date.now() - startTime

    return NextResponse.json({
      success: true,
      message: adminCreated
        ? 'تم إعداد قاعدة البيانات وإنشاء حساب المدير بنجاح'
        : 'قاعدة البيانات جاهزة (المدير موجود مسبقاً)',
      elapsedMs,
      connectionOk: true,
      employeeCount,
      scheduleCreated,
      adminCreated,
      admin: adminInfo,
      credentials: {
        code: 'ADMIN001',
        password: 'admin123',
      },
      nextStep: 'أضف هذه المتغيرات إلى Vercel Environment Variables:\n' +
        '  MONGODB_DATA_API_URL = ' + apiUrl + '\n' +
        '  MONGODB_DATA_API_KEY = ' + maskedKey + ' (full key you provided)\n' +
        '  MONGODB_DATA_SOURCE = ' + dataSource + '\n' +
        '  MONGODB_DATABASE = ' + database,
    })
  } catch (e) {
    const elapsedMs = Date.now() - startTime
    const errorMessage = e instanceof Error ? e.message : String(e)
    return NextResponse.json(
      {
        error: 'فشل الاتصال بـ Data API',
        details: errorMessage,
        elapsedMs,
        providedUrl: apiUrl,
        maskedKey,
        hint: 'تأكد أن:\n' +
          '1. Data API مُفعّل في MongoDB Atlas (Cluster → Data API tab)\n' +
          '2. الـ apiKey صحيح (Atlas → Access Manager → API Keys)\n' +
          '3. الـ dataSource صحيح (عادةً "Cluster0")\n' +
          '4. الـ apiUrl ينتهي بـ /endpoint/data/v1',
      },
      { status: 500 }
    )
  }
}
