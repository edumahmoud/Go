import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentEmployee, logAction } from '@/lib/auth'
import {
  getActiveSchedule,
  getTodayDate,
  isWorkDay,
  computeCheckInStatus,
} from '@/lib/attendance'
import { reverseGeocode } from '@/lib/geo'
import { broadcastEvent } from '@/lib/broadcast'

// POST /api/attendance/check-in
// Body: { lat, lng }
export async function POST(req: NextRequest) {
  const employee = await getCurrentEmployee()
  if (!employee) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })

  if (!employee.isActive) {
    return NextResponse.json(
      { error: 'تم إيقاف حسابك من قبل الإدارة' },
      { status: 403 }
    )
  }

  const body = await req.json()
  const { lat, lng } = body as { lat?: number; lng?: number }

  if (typeof lat !== 'number' || typeof lng !== 'number') {
    return NextResponse.json(
      { error: 'بيانات الموقع غير صحيحة' },
      { status: 400 }
    )
  }

  const schedule = await getActiveSchedule()
  const today = getTodayDate()
  const workDay = isWorkDay(today, schedule.workDays)

  // Find or create today's attendance record
  let attendance = await db.attendance.findUnique({
    where: {
      employeeId_date: { employeeId: employee.id, date: today },
    },
  })

  if (attendance && attendance.checkIn?.time) {
    return NextResponse.json(
      { error: 'تم تسجيل الحضور مسبقاً اليوم' },
      { status: 409 }
    )
  }

  const now = new Date()
  const status = computeCheckInStatus(now, today, schedule)
  const address = await reverseGeocode(lat, lng)
  const checkIn = { time: now, lat, lng, address }

  if (attendance) {
    attendance = await db.attendance.update({
      where: { id: attendance.id },
      data: {
        checkIn,
        status: workDay ? status : status + '_OFF_DAY',
      },
    })
  } else {
    attendance = await db.attendance.create({
      data: {
        employeeId: employee.id,
        date: today,
        checkIn,
        status: workDay ? status : status + '_OFF_DAY',
      },
    })
  }

  // Update employee's live location
  await db.employee.update({
    where: { id: employee.id },
    data: { lastLat: lat, lastLng: lng, lastPingAt: now },
  })

  await logAction({
    actorId: employee.id, actorCode: employee.code, action: 'CHECK_IN',
    targetType: 'ATTENDANCE', targetId: attendance.id,
    details: `${employee.code} checked in at (${lat}, ${lng})`,
  })

  // Real-time notification to manager dashboards (no-op in production)
  await broadcastEvent('attendance:check-in', {
    employeeId: employee.id,
    code: employee.code,
    name: employee.name,
    checkInTime: now.toISOString(),
    lat, lng,
    status: attendance.status,
  })

  return NextResponse.json({
    attendance,
    message: 'تم تسجيل الحضور بنجاح',
  })
}
