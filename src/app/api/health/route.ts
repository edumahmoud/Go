import { NextResponse } from 'next/server'
import { getMongoClient } from '@/lib/mongo'

// Extend Vercel function timeout for MongoDB Atlas cold starts
export const maxDuration = 15

// GET /api/health — Fast diagnostics endpoint (no Prisma, no auth)
// Uses MongoDB native driver directly for faster cold start.
// Returns DB connection status, env vars presence, and timing.
export async function GET() {
  const startTime = Date.now()
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
      employeeCount?: number
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

  // Quick env var check (no DB call) — useful when DATABASE_URL is missing
  if (!process.env.DATABASE_URL) {
    diagnostics.db.error = 'DATABASE_URL is not set'
    diagnostics.status = 'error'
    return NextResponse.json(diagnostics, { status: 500 })
  }

  if (!process.env.DATABASE_URL.startsWith('mongodb')) {
    diagnostics.db.error = `DATABASE_URL must start with 'mongodb' or 'mongodb+srv'`
    diagnostics.status = 'error'
    return NextResponse.json(diagnostics, { status: 500 })
  }

  // Try MongoDB native driver connection (much faster than Prisma cold start)
  try {
    const { db } = await getMongoClient()
    diagnostics.db.connected = true
    diagnostics.db.latencyMs = Date.now() - startTime

    // Quick count of employees
    try {
      const employeeCount = await db.collection('employees').countDocuments()
      diagnostics.db.employeeCount = employeeCount
    } catch {
      // Collection might not exist yet — that's fine
      diagnostics.db.employeeCount = 0
    }

    // List collections (best-effort)
    try {
      const collections = await db.listCollections().toArray()
      diagnostics.db.collections = collections.map((c) => c.name)
    } catch {
      diagnostics.db.collections = []
    }
  } catch (e) {
    diagnostics.db.connected = false
    diagnostics.db.error = e instanceof Error ? `${e.name}: ${e.message}` : String(e)
    diagnostics.db.latencyMs = Date.now() - startTime
    diagnostics.status = 'error'
  }

  const httpStatus = diagnostics.status === 'ok' ? 200 : 500
  return NextResponse.json(diagnostics, { status: httpStatus })
}
