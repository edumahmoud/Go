import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentEmployee } from '@/lib/auth'
import { hasPermission } from '@/lib/permissions'

// GET /api/audit-log - Returns recent audit log entries
export async function GET(req: NextRequest) {
  const me = await getCurrentEmployee()
  if (!me) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
  if (!hasPermission(me.role, me.permissions, 'auditlog:view')) {
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 })
  }

  const limit = Math.min(parseInt(req.nextUrl.searchParams.get('limit') || '50', 10), 200)
  const action = req.nextUrl.searchParams.get('action')

  const where: { [k: string]: unknown } = {}
  if (action) where.action = action

  const logs = await db.auditLog.findMany({
    where,
    orderBy: { timestamp: 'desc' },
    take: limit,
  })

  return NextResponse.json({ logs })
}
