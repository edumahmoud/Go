import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAdmin } from '@/lib/auth'

// GET /api/schedule - Get current schedule (any logged-in user)
export async function GET() {
  try {
    await requireAdmin()
  } catch {
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 })
  }

  const schedules = await db.scheduleSetting.findMany({
    orderBy: { createdAt: 'desc' },
  })
  return NextResponse.json({ schedules })
}

// PUT /api/schedule - Update schedule (admin only)
export async function PUT(req: NextRequest) {
  try {
    await requireAdmin()
  } catch {
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 })
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
    workDays?: string
  }

  // Find the active schedule (or first one)
  let schedule = await db.scheduleSetting.findFirst({ where: { isActive: true } })
  if (!schedule) {
    schedule = await db.scheduleSetting.create({
      data: {
        name: 'default',
        checkInTime: '09:00',
        checkOutTime: '17:00',
        lateThresholdMinutes: 15,
        earlyLeaveThresholdMinutes: 15,
        workDays: '0,1,2,3,4',
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

  return NextResponse.json({ schedule: updated })
}
