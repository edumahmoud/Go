import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentEmployee, logAction } from '@/lib/auth'
import { hasPermission } from '@/lib/permissions'

// GET /api/schedule - Get current schedule
export async function GET() {
  const me = await getCurrentEmployee()
  if (!me) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
  // Anyone logged-in can view the schedule
  const schedules = await db.scheduleSetting.findMany({
    orderBy: { createdAt: 'desc' },
  })
  return NextResponse.json({ schedules })
}

// PUT /api/schedule - Update schedule (requires schedule:edit)
export async function PUT(req: NextRequest) {
  const me = await getCurrentEmployee()
  if (!me) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
  if (!hasPermission(me.role, me.permissions, 'schedule:edit')) {
    return NextResponse.json({ error: 'FORBIDDEN — تحتاج صلاحية تعديل المواعيد' }, { status: 403 })
  }

  const body = await req.json()
  const {
    id,
    checkInTime,
    checkOutTime,
    lateThresholdMinutes,
    earlyLeaveThresholdMinutes,
    workDays,
  } = body as {
    id?: string
    checkInTime?: string
    checkOutTime?: string
    lateThresholdMinutes?: number
    earlyLeaveThresholdMinutes?: number
    workDays?: string[]
  }

  let schedule = await db.scheduleSetting.findFirst({ where: { isActive: true } })
  if (!schedule) {
    schedule = await db.scheduleSetting.create({
      data: {
        name: 'default',
        checkInTime: '09:00',
        checkOutTime: '17:00',
        lateThresholdMinutes: 15,
        earlyLeaveThresholdMinutes: 15,
        workDays: ['0', '1', '2', '3', '4'],
        isActive: true,
      },
    })
  }

  const targetId = id || schedule.id
  const updated = await db.scheduleSetting.update({
    where: { id: targetId },
    data: {
      ...(checkInTime !== undefined ? { checkInTime } : {}),
      ...(checkOutTime !== undefined ? { checkOutTime } : {}),
      ...(lateThresholdMinutes !== undefined ? { lateThresholdMinutes } : {}),
      ...(earlyLeaveThresholdMinutes !== undefined ? { earlyLeaveThresholdMinutes } : {}),
      ...(workDays !== undefined ? { workDays } : {}),
    },
  })

  await logAction({
    actorId: me.id, actorCode: me.code, action: 'SCHEDULE_UPDATE',
    targetType: 'SCHEDULE', targetId: targetId,
    details: `Schedule updated by ${me.code}`,
  })

  return NextResponse.json({ schedule: updated })
}
