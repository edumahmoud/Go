import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentEmployee, hashPassword, logAction } from '@/lib/auth'
import { hasPermission } from '@/lib/permissions'

// GET /api/employees/[id] - Get one employee
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const me = await getCurrentEmployee()
  if (!me) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
  // Self can view own profile, otherwise need employees:view
  if (me.id !== id && !hasPermission(me.role, me.permissions, 'employees:view')) {
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 })
  }

  const employee = await db.employee.findUnique({ where: { id } })
  if (!employee) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 })

  return NextResponse.json({
    employee: {
      id: employee.id,
      code: employee.code,
      name: employee.name,
      phone: employee.phone,
      role: employee.role,
      permissions: employee.permissions,
      isActive: employee.isActive,
      boundDeviceId: employee.boundDeviceId,
      hasPassword: !!employee.hashedPassword,
      lastLat: employee.lastLat,
      lastLng: employee.lastLng,
      lastPingAt: employee.lastPingAt,
      createdAt: employee.createdAt,
    },
  })
}

// PATCH /api/employees/[id] - Update an employee
// Body fields: name, phone, isActive, role, resetDevice, resetPassword, newPassword,
//              permissions (grant/revoke), action: 'promote'|'demote'
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const me = await getCurrentEmployee()
  if (!me) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })

  const body = await req.json()
  const {
    name,
    phone,
    isActive,
    role,
    resetDevice,
    resetPassword,
    newPassword,
    permissions,
    action,
  } = body as {
    name?: string
    phone?: string
    isActive?: boolean
    role?: string
    resetDevice?: boolean
    resetPassword?: boolean
    newPassword?: string
    permissions?: string[]
    action?: 'promote' | 'demote'
  }

  const existing = await db.employee.findUnique({ where: { id } })
  if (!existing) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 })

  // ============== SUSPEND / ACTIVATE ==============
  if (typeof isActive === 'boolean') {
    if (!hasPermission(me.role, me.permissions, 'employees:suspend')) {
      return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 })
    }
    if (me.id === id && !isActive) {
      return NextResponse.json({ error: 'لا يمكنك إيقاف حسابك الحالي' }, { status: 400 })
    }
  }

  // ============== NAME / PHONE ==============
  if (typeof name === 'string' || typeof phone === 'string') {
    if (!hasPermission(me.role, me.permissions, 'employees:edit')) {
      return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 })
    }
  }

  // ============== ROLE CHANGE / PROMOTE / DEMOTE ==============
  if (action === 'promote') {
    if (!hasPermission(me.role, me.permissions, 'employees:promote')) {
      return NextResponse.json({ error: 'FORBIDDEN — تحتاج صلاحية الترقية' }, { status: 403 })
    }
    if (existing.role !== 'EMPLOYEE') {
      return NextResponse.json({ error: 'يمكن ترقية الموظف فقط إلى مشرف' }, { status: 400 })
    }
    if (me.id === id) {
      return NextResponse.json({ error: 'لا يمكنك ترقية حسابك الحالي' }, { status: 400 })
    }
    // promote to SUPERVISOR with default permissions
    await db.employee.update({
      where: { id },
      data: {
        role: 'SUPERVISOR',
        permissions: ['dashboard:view','employees:view','locations:view','attendance:edit','auditlog:view'],
      },
    })
    await logAction({
      actorId: me.id, actorCode: me.code, action: 'PROMOTE',
      targetType: 'EMPLOYEE', targetId: id,
      details: `${existing.code} promoted to SUPERVISOR`,
    })
    const updated = await db.employee.findUnique({ where: { id } })
    return NextResponse.json({ employee: updated })
  }

  if (action === 'demote') {
    if (!hasPermission(me.role, me.permissions, 'employees:demote')) {
      return NextResponse.json({ error: 'FORBIDDEN — تحتاج صلاحية التخفيض' }, { status: 403 })
    }
    if (existing.role === 'MANAGER') {
      return NextResponse.json({ error: 'لا يمكن تخفيض مدير' }, { status: 400 })
    }
    if (existing.role !== 'SUPERVISOR') {
      return NextResponse.json({ error: 'يمكن تخفيض المشرف فقط إلى موظف' }, { status: 400 })
    }
    if (me.id === id) {
      return NextResponse.json({ error: 'لا يمكنك تخفيض حسابك الحالي' }, { status: 400 })
    }
    await db.employee.update({
      where: { id },
      data: { role: 'EMPLOYEE', permissions: [] },
    })
    await logAction({
      actorId: me.id, actorCode: me.code, action: 'DEMOTE',
      targetType: 'EMPLOYEE', targetId: id,
      details: `${existing.code} demoted to EMPLOYEE`,
    })
    const updated = await db.employee.findUnique({ where: { id } })
    return NextResponse.json({ employee: updated })
  }

  // ============== ROLE DIRECT CHANGE (MANAGER only) ==============
  if (role && role !== existing.role) {
    if (me.role !== 'MANAGER') {
      return NextResponse.json({ error: 'FORBIDDEN — تغيير الدور متاح للمدير فقط' }, { status: 403 })
    }
    if (me.id === id && role !== 'MANAGER') {
      return NextResponse.json({ error: 'لا يمكنك تخفيض نفسك من المدير' }, { status: 400 })
    }
  }

  // ============== PERMISSIONS UPDATE ==============
  if (permissions !== undefined) {
    if (!hasPermission(me.role, me.permissions, 'permissions:manage')) {
      return NextResponse.json({ error: 'FORBIDDEN — إدارة الصلاحيات متاحة للمدير فقط' }, { status: 403 })
    }
    if (existing.role === 'MANAGER') {
      return NextResponse.json({ error: 'لا يمكن تعديل صلاحيات مدير' }, { status: 400 })
    }
  }

  // ============== DEVICE / PASSWORD RESET ==============
  if (resetDevice || resetPassword) {
    if (resetDevice && !hasPermission(me.role, me.permissions, 'employees:reset_device')) {
      return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 })
    }
    if (resetPassword && !hasPermission(me.role, me.permissions, 'employees:reset_password')) {
      return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 })
    }
  }

  // Build update payload
  const data: { [k: string]: unknown } = {}
  if (typeof name === 'string') data.name = name.trim()
  if (typeof phone === 'string') data.phone = phone.trim() || null
  if (typeof isActive === 'boolean') data.isActive = isActive
  if (role && role !== existing.role) {
    data.role = role
    // When promoting directly to MANAGER, give all permissions
    if (role === 'MANAGER') {
      data.permissions = ['dashboard:view','employees:view','employees:create','employees:edit','employees:delete','employees:suspend','employees:reset_device','employees:reset_password','employees:promote','employees:demote','permissions:manage','attendance:edit','schedule:edit','locations:view','auditlog:view']
    } else if (role === 'SUPERVISOR' && existing.role === 'EMPLOYEE') {
      data.permissions = ['dashboard:view','employees:view','locations:view','attendance:edit','auditlog:view']
    } else if (role === 'EMPLOYEE') {
      data.permissions = []
    }
  }
  if (permissions !== undefined) data.permissions = permissions
  if (resetDevice) data.boundDeviceId = null
  if (resetPassword) {
    if (newPassword) {
      data.hashedPassword = hashPassword(newPassword)
    } else {
      data.hashedPassword = null
      data.boundDeviceId = null
    }
  }

  const updated = await db.employee.update({
    where: { id },
    data,
  })

  // Audit log
  if (permissions !== undefined) {
    await logAction({
      actorId: me.id, actorCode: me.code, action: 'PERMISSIONS_UPDATE',
      targetType: 'EMPLOYEE', targetId: id,
      details: `${existing.code} permissions set to: ${JSON.stringify(permissions)}`,
    })
  } else if (resetDevice) {
    await logAction({
      actorId: me.id, actorCode: me.code, action: 'DEVICE_RESET',
      targetType: 'EMPLOYEE', targetId: id,
      details: `${existing.code} device unbound`,
    })
  } else if (resetPassword) {
    await logAction({
      actorId: me.id, actorCode: me.code, action: 'PASSWORD_RESET',
      targetType: 'EMPLOYEE', targetId: id,
      details: `${existing.code} password reset`,
    })
  } else if (typeof isActive === 'boolean') {
    await logAction({
      actorId: me.id, actorCode: me.code, action: isActive ? 'ACTIVATE' : 'SUSPEND',
      targetType: 'EMPLOYEE', targetId: id,
      details: `${existing.code} ${isActive ? 'activated' : 'suspended'}`,
    })
  } else {
    await logAction({
      actorId: me.id, actorCode: me.code, action: 'EMPLOYEE_UPDATE',
      targetType: 'EMPLOYEE', targetId: id,
      details: `${existing.code} updated`,
    })
  }

  return NextResponse.json({
    employee: {
      id: updated.id,
      code: updated.code,
      name: updated.name,
      phone: updated.phone,
      role: updated.role,
      permissions: updated.permissions,
      isActive: updated.isActive,
      boundDeviceId: updated.boundDeviceId,
    },
  })
}

// DELETE /api/employees/[id] - Delete an employee
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const me = await getCurrentEmployee()
  if (!me) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
  if (!hasPermission(me.role, me.permissions, 'employees:delete')) {
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 })
  }
  if (me.id === id) {
    return NextResponse.json({ error: 'لا يمكنك حذف حسابك الحالي' }, { status: 400 })
  }

  const existing = await db.employee.findUnique({ where: { id } })
  if (!existing) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 })

  if (existing.role === 'MANAGER') {
    // Make sure we don't delete the last manager
    const managerCount = await db.employee.count({ where: { role: 'MANAGER', isActive: true } })
    if (managerCount <= 1) {
      return NextResponse.json({ error: 'لا يمكن حذف آخر مدير في النظام' }, { status: 400 })
    }
  }

  await db.employee.delete({ where: { id } })

  await logAction({
    actorId: me.id, actorCode: me.code, action: 'EMPLOYEE_DELETE',
    targetType: 'EMPLOYEE', targetId: id,
    details: `Deleted ${existing.code} - ${existing.name}`,
  })

  return NextResponse.json({ success: true })
}
