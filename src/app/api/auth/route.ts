import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import {
  createSession,
  getCurrentEmployee,
  hashPassword,
  verifyPassword,
  getDeviceId,
} from '@/lib/auth'
import { ROLE_DEFAULT_PERMISSIONS } from '@/lib/permissions'

// GET /api/auth - Get current logged-in employee
export async function GET() {
  const employee = await getCurrentEmployee()
  if (!employee) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
  }
  return NextResponse.json({
    id: employee.id,
    code: employee.code,
    name: employee.name,
    phone: employee.phone,
    role: employee.role,
    permissions: employee.permissions,
    isActive: employee.isActive,
    boundDeviceId: employee.boundDeviceId,
    isFirstUser: false,
  })
}

// POST /api/auth — Login (with code + password)
// OR Register the very first user (when no users exist in DB):
//   Body for first-time register: { action: 'register_first', code, name, password, phone? }
//   → the first user automatically becomes MANAGER with ALL permissions
// Body for normal login: { code, password, deviceId? }
export async function POST(req: NextRequest) {
  const body = await req.json()

  // ============== FIRST-USER REGISTRATION ==============
  if (body?.action === 'register_first') {
    const { code, name, password, phone } = body as {
      code?: string
      name?: string
      password?: string
      phone?: string
    }
    if (!code || !name || !password) {
      return NextResponse.json(
        { error: 'يرجى إدخال الكود والاسم وكلمة المرور' },
        { status: 400 }
      )
    }
    if (password.length < 6) {
      return NextResponse.json(
        { error: 'كلمة المرور يجب أن تكون 6 أحرف على الأقل' },
        { status: 400 }
      )
    }

    // Make sure no users exist yet (only the very first registration is allowed this way)
    const userCount = await db.employee.count()
    if (userCount > 0) {
      return NextResponse.json(
        { error: 'تم تهيئة النظام مسبقاً. يرجى تسجيل الدخول بحساب موجود' },
        { status: 403 }
      )
    }

    // Make sure code is unique
    const existing = await db.employee.findUnique({ where: { code: code.trim() } })
    if (existing) {
      return NextResponse.json({ error: 'الكود مستخدم بالفعل' }, { status: 409 })
    }

    const deviceId = getDeviceId(req.headers) || 'first_device'
    const newManager = await db.employee.create({
      data: {
        code: code.trim(),
        name: name.trim(),
        phone: phone?.trim() || null,
        hashedPassword: hashPassword(password),
        boundDeviceId: deviceId,
        role: 'MANAGER',
        permissions: ROLE_DEFAULT_PERMISSIONS.MANAGER,
        isActive: true,
      },
    })

    // Make sure a default schedule exists too
    await getActiveScheduleSafe()

    const session = await createSession(newManager.id, deviceId)
    return NextResponse.json({
      sessionId: session.id,
      employee: {
        id: newManager.id,
        code: newManager.code,
        name: newManager.name,
        role: newManager.role,
      },
      isFirstUser: true,
      message: 'تم إنشاء أول حساب مدير بصلاحيات كاملة',
    })
  }

  // ============== NORMAL LOGIN ==============
  const { code, password, deviceId } = body as {
    code?: string
    password?: string
    deviceId?: string
  }

  if (!code || !password) {
    return NextResponse.json(
      { error: 'يرجى إدخال كود الموظف وكلمة المرور' },
      { status: 400 }
    )
  }

  const employee = await db.employee.findUnique({
    where: { code: code.trim() },
  })

  if (!employee) {
    return NextResponse.json({ error: 'كود الموظف غير موجود' }, { status: 404 })
  }

  if (!employee.isActive) {
    return NextResponse.json(
      { error: 'تم إيقاف هذا الحساب من قبل الإدارة' },
      { status: 403 }
    )
  }

  const requestDeviceId = deviceId || getDeviceId(req.headers)

  // First-time login: password not set yet (account created by manager without password)
  if (!employee.hashedPassword) {
    if (password.length < 6) {
      return NextResponse.json(
        { error: 'كلمة المرور يجب أن تكون 6 أحرف على الأقل' },
        { status: 400 }
      )
    }
    if (!requestDeviceId) {
      return NextResponse.json({ error: 'تعذر قراءة معرف الجهاز' }, { status: 400 })
    }
    const updated = await db.employee.update({
      where: { id: employee.id },
      data: {
        hashedPassword: hashPassword(password),
        boundDeviceId: requestDeviceId,
      },
    })
    const session = await createSession(updated.id, requestDeviceId)
    return NextResponse.json({
      sessionId: session.id,
      employee: {
        id: updated.id,
        code: updated.code,
        name: updated.name,
        role: updated.role,
      },
      firstLogin: true,
    })
  }

  // Verify password
  if (!verifyPassword(password, employee.hashedPassword)) {
    return NextResponse.json({ error: 'كلمة المرور غير صحيحة' }, { status: 401 })
  }

  // Verify device binding
  if (employee.boundDeviceId && requestDeviceId && employee.boundDeviceId !== requestDeviceId) {
    return NextResponse.json(
      { error: 'هذا الحساب مرتبط بجهاز آخر. يرجى التواصل مع الإدارة' },
      { status: 403 }
    )
  }

  const session = await createSession(employee.id, requestDeviceId)
  return NextResponse.json({
    sessionId: session.id,
    employee: {
      id: employee.id,
      code: employee.code,
      name: employee.name,
      role: employee.role,
    },
    firstLogin: false,
  })
}

// DELETE /api/auth - Destroy current session
export async function DELETE() {
  const { destroySession } = await import('@/lib/auth')
  await destroySession()
  return NextResponse.json({ success: true })
}

// Helper to create a default schedule if none exists (used during first-user registration)
async function getActiveScheduleSafe() {
  const existing = await db.scheduleSetting.findFirst({ where: { isActive: true } })
  if (existing) return existing
  return db.scheduleSetting.create({
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
}

// Check if system is fresh (no users yet) — used by the login page UI
export async function HEAD() {
  const count = await db.employee.count()
  return new NextResponse(null, {
    status: count === 0 ? 200 : 204,
    headers: { 'x-system-fresh': count === 0 ? 'true' : 'false' },
  })
}
