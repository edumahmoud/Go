import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAdmin } from '@/lib/auth'
import { getTodayDate } from '@/lib/attendance'

// GET /api/dashboard
// Returns: all employees with their current location + today's attendance
export async function GET() {
  try {
    await requireAdmin()
  } catch {
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 })
  }

  const today = getTodayDate()
  const employees = await db.employee.findMany({
    orderBy: { name: 'asc' },
    include: {
      attendances: {
        where: { date: today },
        take: 1,
      },
    },
  })

  const list = employees.map((e) => {
    const todayRecord = e.attendances[0]
    return {
      id: e.id,
      code: e.code,
      name: e.name,
      phone: e.phone,
      role: e.role,
      isActive: e.isActive,
      deviceId: e.deviceId,
      lastLat: e.lastLat,
      lastLng: e.lastLng,
      lastPingAt: e.lastPingAt,
      // Strip password for safety (already excluded via select, but ensure)
      today: todayRecord
        ? {
            id: todayRecord.id,
            checkInTime: todayRecord.checkInTime,
            checkOutTime: todayRecord.checkOutTime,
            checkInLat: todayRecord.checkInLat,
            checkInLng: todayRecord.checkInLng,
            checkOutLat: todayRecord.checkOutLat,
            checkOutLng: todayRecord.checkOutLng,
            checkInAddress: todayRecord.checkInAddress,
            checkOutAddress: todayRecord.checkOutAddress,
            status: todayRecord.status,
          }
        : null,
    }
  })

  // Summary stats
  const summary = {
    totalEmployees: list.length,
    activeEmployees: list.filter((e) => e.isActive).length,
    presentToday: list.filter((e) => e.today && e.today.checkInTime).length,
    lateToday: list.filter((e) => e.today && e.today.status?.startsWith('LATE')).length,
    checkedOutToday: list.filter((e) => e.today && e.today.checkOutTime).length,
    absentToday: list.filter((e) => e.isActive && (!e.today || !e.today.checkInTime)).length,
  }

  return NextResponse.json({ employees: list, summary })
}
