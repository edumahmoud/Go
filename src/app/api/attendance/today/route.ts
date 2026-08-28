import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentEmployee } from '@/lib/auth'
import { getActiveSchedule, getTodayDate, isWorkDay } from '@/lib/attendance'

// GET /api/attendance/today - Today's attendance for current employee
export async function GET() {
  const employee = await getCurrentEmployee()
  if (!employee) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })

  const schedule = await getActiveSchedule()
  const today = getTodayDate()

  const attendance = await db.attendance.findUnique({
    where: {
      employeeId_date: { employeeId: employee.id, date: today },
    },
  })

  // Normalize check-in/check-out sub-docs for client convenience
  const normalized = attendance
    ? {
        ...attendance,
        checkInTime: attendance.checkIn?.time ?? null,
        checkOutTime: attendance.checkOut?.time ?? null,
        checkInLat: attendance.checkIn?.lat ?? null,
        checkInLng: attendance.checkIn?.lng ?? null,
        checkOutLat: attendance.checkOut?.lat ?? null,
        checkOutLng: attendance.checkOut?.lng ?? null,
        checkInAddress: attendance.checkIn?.address ?? null,
        checkOutAddress: attendance.checkOut?.address ?? null,
      }
    : null

  return NextResponse.json({
    schedule,
    attendance: normalized,
    today: today.toISOString(),
    isWorkDay: isWorkDay(today, schedule.workDays),
  })
}
