import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET /api/system/status - Returns whether the system needs first-user registration
export async function GET() {
  const userCount = await db.employee.count()
  const scheduleCount = await db.scheduleSetting.count()
  return NextResponse.json({
    isFresh: userCount === 0,
    userCount,
    hasSchedule: scheduleCount > 0,
  })
}
