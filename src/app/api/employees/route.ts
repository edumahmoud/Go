import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentEmployee, hashPassword, logAction } from '@/lib/auth'
import { hasPermission } from '@/lib/permissions'

// GET /api/employees - List all employees
// Required: dashboard:view OR employees:view (also implicit for MANAGER)
export async function GET(req: NextRequest) {
  const me = await getCurrentEmployee()
  if (!me) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
  if (!hasPermission(me.role, me.permissions, 'employees:view') &&
      !hasPermission(me.role, me.permissions, 'dashboard:view')) {
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 })
  }

  const search = req.nextUrl.searchParams.get('search') || ''
  const role = req.nextUrl.searchParams.get('role')

  const where: { [k: string]: unknown } = {}
  if (search) {
    where.OR = [
      { code: { contains: search } },
      { name: { contains: search } },
      { phone: { contains: search } },
    ]
  }
  if (role) where.role = role

  const employees = await db.employee.findMany({
    where,
    orderBy: { createdAt: 'desc' },
  })

  // Strip sensitive fields
  const list = employees.map((e) => ({
    id: e.id,
    code: e.code,
    name: e.name,
    phone: e.phone,
    role: e.role,
    permissions: e.permissions,
    isActive: e.isActive,
    boundDeviceId: e.boundDeviceId,
    lastLat: e.lastLat,
    lastLng: e.lastLng,
    lastPingAt: e.lastPingAt,
    hasPassword: !!e.hashedPassword,
    createdAt: e.createdAt,
  }))

  return NextResponse.json({ employees: list, currentUser: { id: me.id, role: me.role, permissions: me.permissions } })
}

// POST /api/employees - Create a new employee (no password; first login binds device)
// Required: employees:create
export async function POST(req: NextRequest) {
  const me = await getCurrentEmployee()
  if (!me) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
  if (!hasPermission(me.role, me.permissions, 'employees:create')) {
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 })
  }

  const body = await req.json()
  const { code, name, phone, role } = body as {
    code?: string
    name?: string
    phone?: string
    role?: string
  }

  if (!code || !name) {
    return NextResponse.json(
      { error: 'كود الموظف والاسم مطلوبان' },
      { status: 400 }
    )
  }

  const existing = await db.employee.findUnique({ where: { code: code.trim() } })
  if (existing) {
    return NextResponse.json(
      { error: 'كود الموظف مستخدم بالفعل' },
      { status: 409 }
    )
  }

  // Only MANAGER can create MANAGER or SUPERVISOR; supervisor can only create EMPLOYEE
  const newRole = role === 'SUPERVISOR' || role === 'MANAGER'
    ? (me.role === 'MANAGER' ? role : 'EMPLOYEE')
    : 'EMPLOYEE'

  const employee = await db.employee.create({
    data: {
      code: code.trim(),
      name: name.trim(),
      phone: phone?.trim() || null,
      role: newRole,
      permissions: newRole === 'SUPERVISOR' || newRole === 'MANAGER'
        ? (me.role === 'MANAGER'
          ? (newRole === 'MANAGER'
            ? ['dashboard:view','employees:view','employees:create','employees:edit','employees:delete','employees:suspend','employees:reset_device','employees:reset_password','employees:promote','employees:demote','permissions:manage','attendance:edit','schedule:edit','locations:view','auditlog:view']
            : ['dashboard:view','employees:view','locations:view','attendance:edit','auditlog:view'])
          : [])
        : [],
    },
  })

  await logAction({
    actorId: me.id,
    actorCode: me.code,
    action: 'EMPLOYEE_CREATE',
    targetType: 'EMPLOYEE',
    targetId: employee.id,
    details: `Created ${employee.code} - ${employee.name} as ${newRole}`,
  })

  return NextResponse.json({
    id: employee.id,
    code: employee.code,
    name: employee.name,
    phone: employee.phone,
    role: employee.role,
    permissions: employee.permissions,
    isActive: employee.isActive,
  })
}

// Helper for unused imports (prevents TS errors)
void hashPassword
