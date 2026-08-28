import { db } from '@/lib/db'
import { cookies } from 'next/headers'
import crypto from 'crypto'
import type { Role, Permission } from '@/lib/permissions'
import { hasPermission } from '@/lib/permissions'

export const SESSION_COOKIE = 'attendance_session'

export async function createSession(employeeId: string, deviceInfo?: string) {
  const token = crypto.randomBytes(32).toString('hex')
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7) // 7 days

  const session = await db.session.create({
    data: {
      employeeId,
      token,
      deviceInfo: deviceInfo || null,
      expiresAt,
    },
  })

  const cookieStore = await cookies()
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    expires: expiresAt,
    path: '/',
  })

  return session
}

export async function destroySession() {
  const cookieStore = await cookies()
  const token = cookieStore.get(SESSION_COOKIE)?.value
  if (token) {
    await db.session.deleteMany({ where: { token } }).catch(() => {})
  }
  cookieStore.delete(SESSION_COOKIE)
}

type CurrentEmployee = {
  id: string
  code: string
  name: string
  phone: string | null
  role: Role
  permissions: string[]
  isActive: boolean
  hashedPassword: string | null
  boundDeviceId: string | null
  lastLat: number | null
  lastLng: number | null
  lastPingAt: Date | null
  createdAt: Date
  updatedAt: Date
}

export async function getCurrentEmployee(): Promise<CurrentEmployee | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get(SESSION_COOKIE)?.value
  if (!token) return null

  const session = await db.session.findUnique({
    where: { token },
    include: { employee: true },
  })

  if (!session) return null
  if (session.expiresAt < new Date()) {
    await db.session.delete({ where: { id: session.id } }).catch(() => {})
    return null
  }

  return session.employee as unknown as CurrentEmployee
}

export async function requireEmployee() {
  const employee = await getCurrentEmployee()
  if (!employee) {
    throw new Error('UNAUTHORIZED')
  }
  return employee
}

export async function requireRole(minRole: Role) {
  const employee = await getCurrentEmployee()
  if (!employee) throw new Error('UNAUTHORIZED')
  const order: Role[] = ['EMPLOYEE', 'SUPERVISOR', 'MANAGER']
  if (order.indexOf(employee.role) < order.indexOf(minRole)) {
    throw new Error('FORBIDDEN')
  }
  return employee
}

export async function requireManager() {
  return requireRole('MANAGER')
}

// Require a specific permission; throws FORBIDDEN if missing.
export async function requirePermission(permission: Permission) {
  const employee = await getCurrentEmployee()
  if (!employee) throw new Error('UNAUTHORIZED')
  if (!hasPermission(employee.role, employee.permissions, permission)) {
    throw new Error('FORBIDDEN')
  }
  return employee
}

// Generate a stable device fingerprint from request headers + UA
export function getDeviceId(headers: Headers): string {
  const ua = headers.get('user-agent') || ''
  const lang = headers.get('accept-language') || ''
  const enc = headers.get('accept-encoding') || ''
  return crypto.createHash('sha256').update(`${ua}|${lang}|${enc}`).digest('hex')
}

export function hashPassword(password: string): string {
  // Salted hash for stronger security
  const salt = crypto.createHash('sha256').update('attendance_app_salt_v1').digest('hex')
  return crypto.createHash('sha256').update(salt + password).digest('hex')
}

export function verifyPassword(password: string, hash: string): boolean {
  return hashPassword(password) === hash
}

// Record an audit log entry (best-effort, never throws)
export async function logAction(params: {
  actorId?: string
  actorCode?: string
  action: string
  targetType?: string
  targetId?: string
  details?: string
}) {
  try {
    await db.auditLog.create({ data: params })
  } catch {
    // ignore
  }
}
