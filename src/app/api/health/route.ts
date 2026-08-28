import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

// Extend Vercel function timeout for MongoDB Atlas cold starts
export const maxDuration = 15

// GET /api/health — Diagnostics endpoint (no auth required)
// Returns DB connection status, env vars presence, and timing.
export async function GET() {
  const diagnostics: {
    status: 'ok' | 'error'
    timestamp: string
    environment: string
    env: { DATABASE_URL: boolean; REALTIME_BROADCAST_URL: boolean }
    db: {
      connected: boolean
      error?: string
      latencyMs?: number
      collections?: string[]
    }
  } = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    env: {
      DATABASE_URL: !!process.env.DATABASE_URL,
      REALTIME_BROADCAST_URL: !!process.env.REALTIME_BROADCAST_URL,
    },
    db: { connected: false },
  }

  // Test DB connection
  const start = Date.now()
  try {
    if (!process.env.DATABASE_URL) {
      diagnostics.db.error = 'DATABASE_URL is not set'
      diagnostics.status = 'error'
    } else if (!process.env.DATABASE_URL.startsWith('mongodb')) {
      diagnostics.db.error = `DATABASE_URL must start with 'mongodb' or 'mongodb+srv' — got: ${process.env.DATABASE_URL.slice(0, 30)}...`
      diagnostics.status = 'error'
    } else {
      // Try a simple count operation
      const count = await db.employee.count()
      diagnostics.db.connected = true
      diagnostics.db.latencyMs = Date.now() - start
      diagnostics.db.collections = ['employees', 'sessions', 'attendances', 'locationpings', 'schedulesettings', 'auditlogs']
      // Include employee count for sanity check
      ;(diagnostics as Record<string, unknown>).employeeCount = count
    }
  } catch (e) {
    diagnostics.db.connected = false
    diagnostics.db.error = e instanceof Error ? `${e.name}: ${e.message}` : String(e)
    diagnostics.db.latencyMs = Date.now() - start
    diagnostics.status = 'error'
  }

  const httpStatus = diagnostics.status === 'ok' ? 200 : 500
  return NextResponse.json(diagnostics, { status: httpStatus })
}
