import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentEmployee } from '@/lib/auth'
import { getTodayDate } from '@/lib/attendance'

// GET /api/dashboard - Returns all employees + today's attendance + summary
// Required permission: dashboard:view (also implicit for SUPERVISOR/MANAGER)
export async function GET() {
  const me = await getCurrentEmployee()
  if (!me) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })

  // Self service: a plain employee with no dashboard:view permission gets only their own data
  const canViewAll =
    me.role === 'MANAGER' ||
    me.role === 'SUPERVISOR' ||
    me.permissions.includes('dashboard:view')

  const today = getTodayDate()

  if (!canViewAll) {
    // Return only self data
    const myAttendance = await db.attendance.findUnique({
      where: { employeeId_date: { employeeId: me.id, date: today } },
    })
    return NextResponse.json({
      scope: 'self',
      employees: [
        {
          id: me.id,
          code: me.code,
          name: me.name,
          phone: me.phone,
          role: me.role,
          isActive: me.isActive,
          lastLat: me.lastLat,
          lastLng: me.lastLng,
          lastPingAt: me.lastPingAt,
          today: myAttendance
            ? {
                id: myAttendance.id,
                checkInTime: myAttendance.checkIn?.time ?? null,
                checkOutTime: myAttendance.checkOut?.time ?? null,
                checkInLat: myAttendance.checkIn?.lat ?? null,
                checkInLng: myAttendance.checkIn?.lng ?? null,
                checkOutLat: myAttendance.checkOut?.lat ?? null,
                checkOutLng: myAttendance.checkOut?.lng ?? null,
                checkInAddress: myAttendance.checkIn?.address ?? null,
                checkOutAddress: myAttendance.checkOut?.address ?? null,
                status: myAttendance.status,
              }
            : null,
        },
      ],
      summary: { totalEmployees: 1, activeEmployees: 1, presentToday: myAttendance?.checkIn ? 1 : 0, lateToday: 0, checkedOutToday: myAttendance?.checkOut ? 1 : 0, absentToday: myAttendance?.checkIn ? 0 : 1 },
    })
  }

  const employees = await db.employee.findMany({
    orderBy: { name: 'asc' },
    include: {
      attendances: { where: { date: today }, take: 1 },
    },
  })

  const canViewLocations =
    me.role === 'MANAGER' ||
    me.permissions.includes('locations:view')

  const list = employees.map((e) => {
    const todayRecord = e.attendances[0]
    return {
      id: e.id,
      code: e.code,
      name: e.name,
      phone: e.phone,
      role: e.role,
      permissions: e.permissions,
      isActive: e.isActive,
      boundDeviceId: e.boundDeviceId,
      // Hide live location if supervisor lacks locations:view permission
      lastLat: canViewLocations ? e.lastLat : null,
      lastLng: canViewLocations ? e.lastLng : null,
      lastPingAt: canViewLocations ? e.lastPingAt : null,
      today: todayRecord
        ? {
            id: todayRecord.id,
            checkInTime: todayRecord.checkIn?.time ?? null,
            checkOutTime: todayRecord.checkOut?.time ?? null,
            checkInLat: todayRecord.checkIn?.lat ?? null,
            checkInLng: todayRecord.checkIn?.lng ?? null,
            checkOutLat: todayRecord.checkOut?.lat ?? null,
            checkOutLng: todayRecord.checkOut?.lng ?? null,
            checkInAddress: todayRecord.checkIn?.address ?? null,
            checkOutAddress: todayRecord.checkOut?.address ?? null,
            status: todayRecord.status,
          }
        : null,
    }
  })

  const summary = {
    totalEmployees: list.length,
    activeEmployees: list.filter((e) => e.isActive).length,
    presentToday: list.filter((e) => e.today && e.today.checkInTime).length,
    lateToday: list.filter((e) => e.today && e.today.status?.startsWith('LATE')).length,
    checkedOutToday: list.filter((e) => e.today && e.today.checkOutTime).length,
    absentToday: list.filter((e) => e.isActive && (!e.today || !e.today.checkInTime)).length,
  }

  return NextResponse.json({
    scope: 'all',
    employees: list,
    summary,
    currentUser: { id: me.id, code: me.code, name: me.name, role: me.role, permissions: me.permissions },
  })
}
