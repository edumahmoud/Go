import { PrismaClient } from '@prisma/client'

// Cache Prisma client across hot-reloads in dev, and reuse the same client
// across serverless function invocations on Vercel.
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    // Only log errors in development
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db
