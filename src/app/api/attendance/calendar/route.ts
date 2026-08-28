import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireEmployee, getCurrentEmployee } from '@/lib/auth'
import { getDateFor } from '@/lib/attendance'

// GET /api/attendance/calendar?month=YYYY-MM&employeeId=...
// Returns attendance records for a given month for current employee or (admin) any employee
export async function GET(req: NextRequest) {
  let me
  try {
    me = await requireEmployee()
  } catch {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
  }

  const monthParam = req.nextUrl.searchParams.get('month') // YYYY-MM
  const employeeId = req.nextUrl.searchParams.get('employeeId')

  let targetEmployeeId = me.id
  if (employeeId && employeeId !== me.id) {
    // Only admin can view others
    if (me.role !== 'ADMIN') {
      return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 })
    }
    targetEmployeeId = employeeId
  }

  // Build date range for the month (UTC)
  let startDate: Date
  let endDate: Date
  if (monthParam) {
    const [year, month] = monthParam.split('-').map((n) => parseInt(n, 10))
    startDate = new Date(Date.UTC(year, month - 1, 1))
    endDate = new Date(Date.UTC(year, month, 1))
  } else {
    const now = new Date()
    startDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
    endDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1))
  }

  const records = await db.attendance.findMany({
    where: {
      employeeId: targetEmployeeId,
      date: { gte: startDate, lt: endDate },
    },
    orderBy: { date: 'asc' },
  })

  const normalized = records.map((r) => ({
    ...r,
    dateKey: r.date.toISOString().slice(0, 10),
  }))

  return NextResponse.json({ records: normalized })
}

// POST /api/attendance/calendar - Admin manually creates/updates a record
export async function POST(req: NextRequest) {
  let me
  try {
    me = await getCurrentEmployee()
    if (!me || me.role !== 'ADMIN') {
      return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 })
    }
  } catch {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
  }

  const body = await req.json()
  const {
    employeeId,
    dateKey, // YYYY-MM-DD
    checkInTime,
    checkOutTime,
    checkInLat,
    checkInLng,
    checkOutLat,
    checkOutLng,
    status,
    notes,
  } = body as {
    employeeId: string
    dateKey: string
    checkInTime?: string
    checkOutTime?: string
    checkInLat?: number
    checkInLng?: number
    checkOutLat?: number
    checkOutLng?: number
    status?: string
    notes?: string
  }

  if (!employeeId || !dateKey) {
    return NextResponse.json({ error: 'BAD_REQUEST' }, { status: 400 })
  }

  const [y, m, d] = dateKey.split('-').map((n) => parseInt(n, 10))
  const date = getDateFor(new Date(Date.UTC(y, m - 1, d)))

  const data: {
    checkInTime?: Date | null
    checkOutTime?: Date | null
    checkInLat?: number | null
    checkInLng?: number | null
    checkOutLat?: number | null
    checkOutLng?: number | null
    status?: string
    notes?: string | null
  } = {}

  if (checkInTime !== undefined) {
    data.checkInTime = checkInTime ? new Date(`${dateKey}T${checkInTime}:00Z`) : null
    data.checkInLat = checkInLat ?? null
    data.checkInLng = checkInLng ?? null
  }
  if (checkOutTime !== undefined) {
    data.checkOutTime = checkOutTime ? new Date(`${dateKey}T${checkOutTime}:00Z`) : null
    data.checkOutLat = checkOutLat ?? null
    data.checkOutLng = checkOutLng ?? null
  }
  if (status) data.status = status
  if (notes !== undefined) data.notes = notes || null

  const record = await db.attendance.upsert({
    where: { employeeId_date: { employeeId, date } },
    update: data,
    create: {
      employeeId,
      date,
      ...data,
      status: status || (checkInTime ? 'PRESENT' : 'PENDING'),
    },
  })

  return NextResponse.json({ record })
}
