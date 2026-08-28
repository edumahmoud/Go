import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentEmployee, logAction } from '@/lib/auth'
import {
  getActiveSchedule,
  getTodayDate,
  computeCheckOutStatus,
} from '@/lib/attendance'
import { reverseGeocode } from '@/lib/geo'
import { broadcastEvent } from '@/lib/broadcast'

// POST /api/attendance/check-out
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
    return NextResponse.json({ error: 'بيانات الموقع غير صحيحة' }, { status: 400 })
  }

  const schedule = await getActiveSchedule()
  const today = getTodayDate()

  const attendance = await db.attendance.findUnique({
    where: {
      employeeId_date: { employeeId: employee.id, date: today },
    },
  })

  if (!attendance || !attendance.checkIn?.time) {
    return NextResponse.json(
      { error: 'لم يتم تسجيل الحضور بعد' },
      { status: 409 }
    )
  }

  if (attendance.checkOut?.time) {
    return NextResponse.json(
      { error: 'تم تسجيل الانصراف مسبقاً اليوم' },
      { status: 409 }
    )
  }

  const now = new Date()
  const checkoutStatus = computeCheckOutStatus(now, today, schedule)
  const address = await reverseGeocode(lat, lng)
  const checkOut = { time: now, lat, lng, address }

  // If check-in was LATE, keep that flag in the final status
  let finalStatus = checkoutStatus
  if (attendance.status === 'LATE' || attendance.status === 'LATE_OFF_DAY') {
    finalStatus = 'LATE_CHECKED_OUT'
  }

  const updated = await db.attendance.update({
    where: { id: attendance.id },
    data: { checkOut, status: finalStatus },
  })

  await db.employee.update({
    where: { id: employee.id },
    data: { lastLat: lat, lastLng: lng, lastPingAt: now },
  })

  await logAction({
    actorId: employee.id, actorCode: employee.code, action: 'CHECK_OUT',
    targetType: 'ATTENDANCE', targetId: attendance.id,
    details: `${employee.code} checked out at (${lat}, ${lng})`,
  })

  // Real-time notification to manager dashboards (no-op in production)
  await broadcastEvent('attendance:check-out', {
    employeeId: employee.id,
    code: employee.code,
    name: employee.name,
    checkOutTime: now.toISOString(),
    lat, lng,
    status: finalStatus,
  })

  return NextResponse.json({
    attendance: updated,
    message: 'تم تسجيل الانصراف بنجاح',
  })
}
