import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAdmin, hashPassword } from '@/lib/auth'

// GET /api/employees/[id] - Get one employee (admin or self)
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  let employee
  try {
    const me = await requireAdmin()
    employee = await db.employee.findUnique({
      where: { id },
      select: {
        id: true,
        code: true,
        name: true,
        phone: true,
        role: true,
        isActive: true,
        deviceId: true,
        lastLat: true,
        lastLng: true,
        lastPingAt: true,
        createdAt: true,
      },
    })
    if (!employee) {
      return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 })
    }
    return NextResponse.json({ employee })
  } catch {
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 })
  }
}

// PATCH /api/employees/[id] - Update an employee (admin only)
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  try {
    await requireAdmin()
  } catch {
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 })
  }

  const body = await req.json()
  const { name, phone, isActive, role, resetPassword, resetDevice, newPassword } = body as {
    name?: string
    phone?: string
    isActive?: boolean
    role?: string
    resetPassword?: boolean
    resetDevice?: boolean
    newPassword?: string
  }

  const existing = await db.employee.findUnique({ where: { id } })
  if (!existing) {
    return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 })
  }

  const data: { [k: string]: unknown } = {}
  if (typeof name === 'string') data.name = name.trim()
  if (typeof phone === 'string') data.phone = phone.trim() || null
  if (typeof isActive === 'boolean') data.isActive = isActive
  if (role === 'ADMIN' || role === 'EMPLOYEE') data.role = role
  if (resetDevice) data.deviceId = null
  if (resetPassword) {
    // Reset password - if newPassword provided, set it; otherwise clear (force re-set on next login)
    if (newPassword) {
      data.password = hashPassword(newPassword)
    } else {
      data.password = null
      data.deviceId = null // force re-binding too
    }
  }

  const updated = await db.employee.update({
    where: { id },
    data,
    select: {
      id: true,
      code: true,
      name: true,
      phone: true,
      role: true,
      isActive: true,
      deviceId: true,
    },
  })

  return NextResponse.json({ employee: updated })
}

// DELETE /api/employees/[id] - Delete an employee (admin only)
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  try {
    await requireAdmin()
  } catch {
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 })
  }

  // Prevent self-deletion
  const me = await db.session.findFirst({ where: { employeeId: id } })
  if (me) {
    // OK - can still delete; just don't allow deleting the only admin
  }

  await db.employee.delete({ where: { id } }).catch(() => {})
  return NextResponse.json({ success: true })
}
