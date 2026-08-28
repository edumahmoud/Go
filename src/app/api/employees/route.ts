import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAdmin, hashPassword } from '@/lib/auth'

// GET /api/employees - List all employees (admin only)
export async function GET(req: NextRequest) {
  try {
    await requireAdmin()
  } catch {
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 })
  }

  const search = req.nextUrl.searchParams.get('search') || ''
  const role = req.nextUrl.searchParams.get('role') // optional filter

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

  return NextResponse.json({ employees })
}

// POST /api/employees - Create a new employee (admin only)
export async function POST(req: NextRequest) {
  try {
    await requireAdmin()
  } catch {
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

  const employee = await db.employee.create({
    data: {
      code: code.trim(),
      name: name.trim(),
      phone: phone?.trim() || null,
      role: role === 'ADMIN' ? 'ADMIN' : 'EMPLOYEE',
      // password set on first login
    },
  })

  return NextResponse.json({
    id: employee.id,
    code: employee.code,
    name: employee.name,
    phone: employee.phone,
    role: employee.role,
    isActive: employee.isActive,
  })
}
