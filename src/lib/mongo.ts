// src/lib/mongo.ts
// Lightweight MongoDB native driver helper — used for fast health checks
// and setup operations that bypass Prisma's slow cold start on Vercel.

import { MongoClient, Db } from 'mongodb'

let cachedClient: MongoClient | null = null
let cachedDb: Db | null = null

const MONGODB_TIMEOUT_MS = 8000 // allow time for TLS handshake

/**
 * Get a MongoDB connection (cached across serverless invocations).
 * Uses the provided URL or falls back to process.env.DATABASE_URL.
 *
 * Retries up to 3 times with exponential backoff because MongoDB Atlas
 * M0 clusters sometimes reject the first TLS handshake during cold start.
 */
export async function getMongoClient(connectionString?: string): Promise<{ client: MongoClient; db: Db }> {
  const url = connectionString || process.env.DATABASE_URL
  if (!url) {
    throw new Error('DATABASE_URL is not set')
  }

  // If using env var (not custom URL), use cache
  if (cachedClient && cachedDb && !connectionString) {
    return { client: cachedClient, db: cachedDb }
  }

  // Extract db name from URL or use default
  const dbName = extractDbName(url) || 'attendance_db'

  // Build connection options — retry with progressively more permissive TLS
  const baseOptions = {
    serverSelectionTimeoutMS: MONGODB_TIMEOUT_MS,
    socketTimeoutMS: MONGODB_TIMEOUT_MS,
    connectTimeoutMS: MONGODB_TIMEOUT_MS,
  }

  const tlsOptionsVariants = [
    // Attempt 1: standard options (mongodb+srv auto-enables TLS)
    { ...baseOptions },
    // Attempt 2: explicit TLS options
    { ...baseOptions, tls: true, retryWrites: true },
    // Attempt 3: permissive (sometimes needed for M0 free tier)
    { ...baseOptions, tls: true, tlsAllowInvalidCertificates: true, retryWrites: true },
  ]

  let lastError: Error | null = null
  for (let attempt = 0; attempt < tlsOptionsVariants.length; attempt++) {
    try {
      const client = new MongoClient(url, tlsOptionsVariants[attempt])
      await client.connect()
      const db = client.db(dbName)

      if (!connectionString) {
        cachedClient = client
        cachedDb = db
      }
      return { client, db }
    } catch (e) {
      lastError = e instanceof Error ? e : new Error(String(e))
      // Brief pause before retry
      if (attempt < tlsOptionsVariants.length - 1) {
        await new Promise((r) => setTimeout(r, 500 * (attempt + 1)))
      }
    }
  }

  // All retries failed — provide a clear, actionable error
  const originalMsg = lastError?.message || 'Unknown error'
  let friendlyHint = ''
  if (originalMsg.includes('SSL alert number 80') || originalMsg.includes('tlsv1 alert internal')) {
    friendlyHint = '\n\nالسبب الأكثر احتمالاً:\n' +
      '1. Cluster MongoDB Atlas ما زال قيد التهيئة — انتظر 2-3 دقائق ثم أعد المحاولة\n' +
      '2. Network Access غير مضبوط على 0.0.0.0/0 — اذهب إلى MongoDB Atlas → Network Access\n' +
      '3. كلمة المرور غير صحيحة — تأكد من Database Access'
  } else if (originalMsg.includes('authentication failed')) {
    friendlyHint = '\n\nالسبب: كلمة المرور أو اسم المستخدم غير صحيح.'
  } else if (originalMsg.includes('ENOTFOUND') || originalMsg.includes('getaddrinfo')) {
    friendlyHint = '\n\nالسبب: لم يتم العثور على host. تأكد أن اسم cluster صحيح في الـ URL.'
  } else if (originalMsg.includes('timed out') || originalMsg.includes('server selection')) {
    friendlyHint = '\n\nالسبب: انتهت المهلة — على الأرجح IP غير مسموح في Network Access.'
  }

  const err = new Error(`فشل الاتصال بـ MongoDB بعد 3 محاولات: ${originalMsg}${friendlyHint}`)
  throw err
}

function extractDbName(url: string): string | null {
  // mongodb+srv://user:pass@host/DBNAME?options
  const match = url.match(/@[^/]+\/([^?]+)/)
  return match ? match[1] : null
}

export async function disconnectMongo(): Promise<void> {
  if (cachedClient) {
    await cachedClient.close().catch(() => {})
    cachedClient = null
    cachedDb = null
  }
}

