import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireEmployee } from '@/lib/auth'
import {
  getActiveSchedule,
  getTodayDate,
  isWorkDay,
  computeCheckInStatus,
} from '@/lib/attendance'
import { reverseGeocode } from '@/lib/geo'

// POST /api/attendance/check-in
// Body: { lat, lng }
export async function POST(req: NextRequest) {
  let employee
  try {
    employee = await requireEmployee()
  } catch {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
  }

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

  // Allow check-in even on non-work days, but flag it
  const workDay = isWorkDay(today, schedule.workDays)

  // Find or create today's attendance record
  let attendance = await db.attendance.findUnique({
    where: {
      employeeId_date: { employeeId: employee.id, date: today },
    },
  })

  if (attendance && attendance.checkInTime) {
    return NextResponse.json(
      { error: 'تم تسجيل الحضور مسبقاً اليوم' },
      { status: 409 }
    )
  }

  const now = new Date()
  const status = computeCheckInStatus(now, today, schedule)
  const address = await reverseGeocode(lat, lng)

  if (attendance) {
    attendance = await db.attendance.update({
      where: { id: attendance.id },
      data: {
        checkInTime: now,
        checkInLat: lat,
        checkInLng: lng,
        checkInAddress: address,
        status: workDay ? status : status + '_OFF_DAY',
      },
    })
  } else {
    attendance = await db.attendance.create({
      data: {
        employeeId: employee.id,
        date: today,
        checkInTime: now,
        checkInLat: lat,
        checkInLng: lng,
        checkInAddress: address,
        status: workDay ? status : status + '_OFF_DAY',
      },
    })
  }

  // Also update employee's last known location
  await db.employee.update({
    where: { id: employee.id },
    data: { lastLat: lat, lastLng: lng, lastPingAt: now },
  })

  return NextResponse.json({
    attendance,
    message: 'تم تسجيل الحضور بنجاح',
  })
}
