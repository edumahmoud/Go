import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireEmployee } from '@/lib/auth'
import {
  getActiveSchedule,
  getTodayDate,
  computeCheckOutStatus,
} from '@/lib/attendance'
import { reverseGeocode } from '@/lib/geo'

// POST /api/attendance/check-out
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

  const attendance = await db.attendance.findUnique({
    where: {
      employeeId_date: { employeeId: employee.id, date: today },
    },
  })

  if (!attendance || !attendance.checkInTime) {
    return NextResponse.json(
      { error: 'لم يتم تسجيل الحضور بعد' },
      { status: 409 }
    )
  }

  if (attendance.checkOutTime) {
    return NextResponse.json(
      { error: 'تم تسجيل الانصراف مسبقاً اليوم' },
      { status: 409 }
    )
  }

  const now = new Date()
  const checkoutStatus = computeCheckOutStatus(now, today, schedule)
  const address = await reverseGeocode(lat, lng)

  // Final status: if was LATE on check-in, keep LATE even after checkout
  let finalStatus = checkoutStatus
  if (attendance.status === 'LATE' || attendance.status === 'LATE_OFF_DAY') {
    finalStatus = 'LATE_CHECKED_OUT'
  }

  const updated = await db.attendance.update({
    where: { id: attendance.id },
    data: {
      checkOutTime: now,
      checkOutLat: lat,
      checkOutLng: lng,
      checkOutAddress: address,
      status: finalStatus,
    },
  })

  await db.employee.update({
    where: { id: employee.id },
    data: { lastLat: lat, lastLng: lng, lastPingAt: now },
  })

  return NextResponse.json({
    attendance: updated,
    message: 'تم تسجيل الانصراف بنجاح',
  })
}
