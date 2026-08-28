// =========================================================
// Permissions & Roles definitions
// =========================================================

export type Role = 'EMPLOYEE' | 'SUPERVISOR' | 'MANAGER'

// All available permissions in the system
export const ALL_PERMISSIONS = [
  'dashboard:view',
  'employees:view',
  'employees:create',
  'employees:edit',
  'employees:delete',
  'employees:suspend',
  'employees:reset_device',
  'employees:reset_password',
  'employees:promote',
  'employees:demote',
  'permissions:manage',
  'attendance:edit',
  'schedule:edit',
  'locations:view',
  'auditlog:view',
] as const

export type Permission = (typeof ALL_PERMISSIONS)[number]

// Permission → human readable Arabic label
export const PERMISSION_LABELS: Record<Permission, string> = {
  'dashboard:view': 'عرض لوحة التحكم',
  'employees:view': 'عرض بيانات الموظفين',
  'employees:create': 'إضافة موظف',
  'employees:edit': 'تعديل بيانات الموظفين',
  'employees:delete': 'حذف موظف',
  'employees:suspend': 'إيقاف/تفعيل موظف',
  'employees:reset_device': 'إعادة ضبط جهاز موظف',
  'employees:reset_password': 'إعادة تعيين كلمة مرور',
  'employees:promote': 'ترقية موظف إلى مشرف',
  'employees:demote': 'تخفيض مشرف إلى موظف',
  'permissions:manage': 'إدارة صلاحيات المشرفين',
  'attendance:edit': 'تعديل سجلات الحضور',
  'schedule:edit': 'تعديل مواعيد العمل',
  'locations:view': 'عرض مواقع الموظفين الحية',
  'auditlog:view': 'عرض سجل العمليات',
}

// Role → default permissions granted automatically when someone becomes that role
export const ROLE_DEFAULT_PERMISSIONS: Record<Role, Permission[]> = {
  EMPLOYEE: [],
  SUPERVISOR: [
    'dashboard:view',
    'employees:view',
    'locations:view',
    'attendance:edit',
    'auditlog:view',
  ],
  // MANAGER has *all* permissions implicitly — see `hasPermission` below.
  MANAGER: [...ALL_PERMISSIONS],
}

// Check whether a (role, permissions) pair grants a specific permission
// MANAGER always has every permission, regardless of the permissions array.
export function hasPermission(
  role: Role,
  permissions: string[],
  required: Permission
): boolean {
  if (role === 'MANAGER') return true
  return permissions.includes(required)
}

// Check multiple permissions at once (returns true if ANY is granted)
export function hasAnyPermission(
  role: Role,
  permissions: string[],
  required: Permission[]
): boolean {
  if (role === 'MANAGER') return true
  return required.some((p) => permissions.includes(p))
}

// Check all permissions required (returns true only if ALL granted)
export function hasAllPermissions(
  role: Role,
  permissions: string[],
  required: Permission[]
): boolean {
  if (role === 'MANAGER') return true
  return required.every((p) => permissions.includes(p))
}

// Effective permissions for a user (used to display in UI)
export function effectivePermissions(role: Role, permissions: string[]): Permission[] {
  if (role === 'MANAGER') return [...ALL_PERMISSIONS]
  return permissions.filter((p) =>
    (ALL_PERMISSIONS as readonly string[]).includes(p)
  ) as Permission[]
}
