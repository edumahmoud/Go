import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentEmployee } from '@/lib/auth'

// POST /api/location - Update current location
// Body: { lat, lng, accuracy? }
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
  const { lat, lng, accuracy } = body as { lat?: number; lng?: number; accuracy?: number }

  if (typeof lat !== 'number' || typeof lng !== 'number') {
    return NextResponse.json({ error: 'BAD_REQUEST' }, { status: 400 })
  }

  const now = new Date()
  await db.employee.update({
    where: { id: employee.id },
    data: { lastLat: lat, lastLng: lng, lastPingAt: now },
  })
  await db.locationPing.create({
    data: { employeeId: employee.id, lat, lng, accuracy: accuracy ?? null },
  })

  // Notify real-time listeners via WebSocket
  try {
    await fetch('http://127.0.0.1:3004/broadcast', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event: 'location:update',
        payload: {
          employeeId: employee.id,
          code: employee.code,
          name: employee.name,
          lat,
          lng,
          accuracy: accuracy ?? null,
          timestamp: now.toISOString(),
        },
      }),
    })
  } catch {
    // WebSocket service may be down; ignore silently
  }

  return NextResponse.json({ success: true, timestamp: now })
}
