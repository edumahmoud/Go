import { db } from '@/lib/db'

// Get active schedule settings, create default if not exists
export async function getActiveSchedule() {
  let schedule = await db.scheduleSetting.findFirst({
    where: { isActive: true },
  })

  if (!schedule) {
    schedule = await db.scheduleSetting.create({
      data: {
        name: 'default',
        checkInTime: '09:00',
        checkOutTime: '17:00',
        lateThresholdMinutes: 15,
        earlyLeaveThresholdMinutes: 15,
        workDays: '0,1,2,3,4', // Sun-Thu
        isActive: true,
      },
    })
  }
  return schedule
}

// Get the date for "today" (midnight UTC)
export function getTodayDate(): Date {
  const now = new Date()
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
}

export function getDateFor(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
}

// Check if a given date is a work day
export function isWorkDay(date: Date, workDays: string): boolean {
  // getUTCDay: 0=Sun ... 6=Sat
  const day = date.getUTCDay()
  const days = workDays.split(',').map((d) => parseInt(d.trim(), 10))
  return days.includes(day)
}

// Determine attendance status from check-in time vs schedule
export function computeCheckInStatus(
  checkInTime: Date,
  date: Date,
  schedule: { checkInTime: string; lateThresholdMinutes: number }
): string {
  const [h, m] = schedule.checkInTime.split(':').map((n) => parseInt(n, 10))
  const scheduledTime = new Date(date)
  scheduledTime.setUTCHours(h, m, 0, 0)

  const diffMs = checkInTime.getTime() - scheduledTime.getTime()
  const diffMin = diffMs / 60000

  if (diffMin > schedule.lateThresholdMinutes) return 'LATE'
  return 'PRESENT'
}

export function computeCheckOutStatus(
  checkOutTime: Date,
  date: Date,
  schedule: { checkOutTime: string; earlyLeaveThresholdMinutes: number }
): string {
  const [h, m] = schedule.checkOutTime.split(':').map((n) => parseInt(n, 10))
  const scheduledTime = new Date(date)
  scheduledTime.setUTCHours(h, m, 0, 0)

  const diffMs = scheduledTime.getTime() - checkOutTime.getTime()
  const diffMin = diffMs / 60000

  if (diffMin > schedule.earlyLeaveThresholdMinutes) return 'EARLY_LEAVE'
  return 'CHECKED_OUT'
}

// Format time to HH:mm
export function formatTime(date: Date | null | undefined): string {
  if (!date) return '—'
  return date.toLocaleTimeString('ar-EG', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  })
}

// Format date to yyyy-mm-dd
export function formatDateKey(date: Date): string {
  return date.toISOString().slice(0, 10)
}

// Format date to a human-readable Arabic date
export function formatDateAr(date: Date): string {
  return date.toLocaleDateString('ar-EG', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}
