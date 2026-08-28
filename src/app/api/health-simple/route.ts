import { NextResponse } from 'next/server'

// GET /api/health-simple — Lightning-fast endpoint that only checks env vars
// (no DB call). Used to verify that Vercel has picked up the DATABASE_URL env
// var, without triggering MongoDB cold start.
//
// Returns 200 OK if DATABASE_URL is set, 500 otherwise.

export const maxDuration = 5 // very fast

export async function GET() {
  const dbUrl = process.env.DATABASE_URL
  const hasDbUrl = !!dbUrl
  const isValidUrl = hasDbUrl && (dbUrl!.startsWith('mongodb://') || dbUrl!.startsWith('mongodb+srv://'))
  const hasDbName = hasDbUrl && /\/[^/?]+(\?|$)/.test(dbUrl!.replace(/\/\//, '//').split('@')[1] || '')

  return NextResponse.json({
    status: hasDbUrl && isValidUrl ? 'ok' : 'error',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    env: {
      DATABASE_URL: hasDbUrl,
      REALTIME_BROADCAST_URL: !!process.env.REALTIME_BROADCAST_URL,
    },
    urlValidation: {
      isValid: isValidUrl,
      hasDatabaseName: hasDbName,
      hint: !hasDbUrl
        ? 'DATABASE_URL غير مضبوط في Vercel Environment Variables'
        : !isValidUrl
        ? 'DATABASE_URL يجب أن يبدأ بـ mongodb:// أو mongodb+srv://'
        : !hasDbName
        ? 'الـ URL يجب أن يحتوي على اسم database (مثلاً /attendance_db) قبل علامة ?'
        : 'الـ URL صحيح',
    },
  }, { status: hasDbUrl && isValidUrl ? 200 : 500 })
}
