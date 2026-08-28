import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { hashPassword } from '@/lib/auth'

// POST /api/setup - Initial setup: create default admin + default schedule
export async function POST() {
  const adminCount = await db.employee.count({ where: { role: 'ADMIN' } })
  if (adminCount > 0) {
    return NextResponse.json(
      { error: 'النظام تم تهيئته مسبقاً' },
      { status: 400 }
    )
  }

  // Create default admin
  const admin = await db.employee.create({
    data: {
      code: 'ADMIN001',
      name: 'مدير النظام',
      password: hashPassword('admin123'),
      role: 'ADMIN',
      isActive: true,
    },
  })

  // Create default schedule
  const schedule = await db.scheduleSetting.create({
    data: {
      name: 'default',
      checkInTime: '09:00',
      checkOutTime: '17:00',
      lateThresholdMinutes: 15,
      earlyLeaveThresholdMinutes: 15,
      workDays: '0,1,2,3,4',
      isActive: true,
    },
  })

  return NextResponse.json({
    admin: { code: admin.code, name: admin.name },
    schedule,
    message: 'تم إنشاء حساب المدير الافتراضي. كود: ADMIN001، كلمة المرور: admin123',
  })
}
