import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireEmployee } from '@/lib/auth'

// POST /api/location - Update current location (called periodically by employee app)
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
    return NextResponse.json({ error: 'BAD_REQUEST' }, { status: 400 })
  }

  const now = new Date()
  await db.employee.update({
    where: { id: employee.id },
    data: { lastLat: lat, lastLng: lng, lastPingAt: now },
  })
  await db.locationPing.create({
    data: { employeeId: employee.id, lat, lng },
  })

  return NextResponse.json({ success: true, timestamp: now })
}
