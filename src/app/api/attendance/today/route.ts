import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireEmployee } from '@/lib/auth'
import { getActiveSchedule, getTodayDate } from '@/lib/attendance'

// GET /api/attendance/today - Today's attendance for current employee
export async function GET() {
  let employee
  try {
    employee = await requireEmployee()
  } catch {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
  }

  const schedule = await getActiveSchedule()
  const today = getTodayDate()

  const attendance = await db.attendance.findUnique({
    where: {
      employeeId_date: { employeeId: employee.id, date: today },
    },
  })

  return NextResponse.json({
    schedule,
    attendance,
    today: today.toISOString(),
    isWorkDay: schedule.workDays.split(',').map((d) => parseInt(d.trim(), 10)).includes(today.getUTCDay()),
  })
}
