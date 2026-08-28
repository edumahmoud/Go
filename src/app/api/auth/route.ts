import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { createSession, getCurrentEmployee, hashPassword, verifyPassword, getDeviceId } from '@/lib/auth'

// GET /api/auth/me - Get current logged-in employee
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
    isActive: employee.isActive,
    deviceId: employee.deviceId,
  })
}

// POST /api/auth/login - Login with employee code + password
export async function POST(req: NextRequest) {
  const body = await req.json()
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
    return NextResponse.json(
      { error: 'كود الموظف غير موجود' },
      { status: 404 }
    )
  }

  if (!employee.isActive) {
    return NextResponse.json(
      { error: 'تم إيقاف هذا الحساب من قبل الإدارة' },
      { status: 403 }
    )
  }

  const requestDeviceId = deviceId || getDeviceId(req.headers)

  // First-time login: password not set yet
  if (!employee.password) {
    if (!requestDeviceId) {
      return NextResponse.json(
        { error: 'تعذر قراءة معرف الجهاز' },
        { status: 400 }
      )
    }
    const updated = await db.employee.update({
      where: { id: employee.id },
      data: {
        password: hashPassword(password),
        deviceId: requestDeviceId,
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

  // Subsequent logins: verify password
  if (!verifyPassword(password, employee.password)) {
    return NextResponse.json(
      { error: 'كلمة المرور غير صحيحة' },
      { status: 401 }
    )
  }

  // Verify device binding
  if (employee.deviceId && requestDeviceId && employee.deviceId !== requestDeviceId) {
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

// DELETE /api/auth/logout - Destroy current session
export async function DELETE() {
  const { destroySession } = await import('@/lib/auth')
  await destroySession()
  return NextResponse.json({ success: true })
}
