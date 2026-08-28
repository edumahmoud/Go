import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentEmployee } from '@/lib/auth'
import { getDateFor } from '@/lib/attendance'

// GET /api/attendance/calendar?month=YYYY-MM&employeeId=...
export async function GET(req: NextRequest) {
  const me = await getCurrentEmployee()
  if (!me) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })

  const monthParam = req.nextUrl.searchParams.get('month')
  const employeeId = req.nextUrl.searchParams.get('employeeId')

  let targetEmployeeId = me.id
  if (employeeId && employeeId !== me.id) {
    // Only supervisors/managers can view others
    if (me.role === 'EMPLOYEE') {
      return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 })
    }
    targetEmployeeId = employeeId
  }

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
    checkInTime: r.checkIn?.time ?? null,
    checkOutTime: r.checkOut?.time ?? null,
    checkInLat: r.checkIn?.lat ?? null,
    checkInLng: r.checkIn?.lng ?? null,
    checkOutLat: r.checkOut?.lat ?? null,
    checkOutLng: r.checkOut?.lng ?? null,
    checkInAddress: r.checkIn?.address ?? null,
    checkOutAddress: r.checkOut?.address ?? null,
  }))

  return NextResponse.json({ records: normalized })
}

// POST /api/attendance/calendar - Admin/Supervisor manually creates/updates a record
export async function POST(req: NextRequest) {
  const me = await getCurrentEmployee()
  if (!me) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })

  // Only MANAGER or SUPERVISOR with attendance:edit can edit
  const allowed = me.role === 'MANAGER' || me.permissions.includes('attendance:edit')
  if (!allowed) {
    return NextResponse.json({ error: 'FORBIDDEN — تحتاج صلاحية تعديل الحضور' }, { status: 403 })
  }

  const body = await req.json()
  const {
    employeeId,
    dateKey,
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
    checkIn?: { time: Date; lat: number; lng: number; address?: string } | undefined
    checkOut?: { time: Date; lat: number; lng: number; address?: string } | undefined
    status?: string
    notes?: string | null
  } = {}

  if (checkInTime !== undefined) {
    data.checkIn = checkInTime
      ? {
          time: new Date(`${dateKey}T${checkInTime}:00Z`),
          lat: checkInLat ?? 0,
          lng: checkInLng ?? 0,
        }
      : undefined
  }
  if (checkOutTime !== undefined) {
    data.checkOut = checkOutTime
      ? {
          time: new Date(`${dateKey}T${checkOutTime}:00Z`),
          lat: checkOutLat ?? 0,
          lng: checkOutLng ?? 0,
        }
      : undefined
  }
  if (status) data.status = status
  if (notes !== undefined) data.notes = notes || null

  const record = await db.attendance.upsert({
    where: { employeeId_date: { employeeId, date } },
    update: data,
    create: {
      employeeId,
      date,
      checkIn: data.checkIn,
      checkOut: data.checkOut,
      status: status || (checkInTime ? 'PRESENT' : 'PENDING'),
      notes: notes || null,
    },
  })

  return NextResponse.json({ record })
}
