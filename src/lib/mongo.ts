// src/lib/mongo.ts
// Lightweight MongoDB native driver helper — used for fast health checks
// and setup operations that bypass Prisma's slow cold start on Vercel.

import { MongoClient, Db } from 'mongodb'

let cachedClient: MongoClient | null = null
let cachedDb: Db | null = null

const MONGODB_TIMEOUT_MS = 5000 // fail fast on slow connections

/**
 * Get a MongoDB connection (cached across serverless invocations).
 * Uses the provided URL or falls back to process.env.DATABASE_URL.
 */
export async function getMongoClient(connectionString?: string): Promise<{ client: MongoClient; db: Db }> {
  const url = connectionString || process.env.DATABASE_URL
  if (!url) {
    throw new Error('DATABASE_URL is not set')
  }

  // If using a custom URL (e.g. setup-db), don't use the cache
  if (cachedClient && cachedDb && !connectionString) {
    return { client: cachedClient, db: cachedDb }
  }

  // Extract db name from URL or use default
  const dbName = extractDbName(url) || 'attendance_db'

  const client = new MongoClient(url, {
    serverSelectionTimeoutMS: MONGODB_TIMEOUT_MS,
    socketTimeoutMS: MONGODB_TIMEOUT_MS,
    connectTimeoutMS: MONGODB_TIMEOUT_MS,
  })

  await client.connect()
  const db = client.db(dbName)

  if (!connectionString) {
    cachedClient = client
    cachedDb = db
  }

  return { client, db }
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
