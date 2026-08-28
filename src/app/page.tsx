'use client'

import { useEffect, useState, useCallback } from 'react'
import { toast } from 'sonner'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Fingerprint, LogOut, MapPin, Clock, Calendar, Users, Settings,
  LayoutDashboard, LogIn, Moon, Sun, Loader2, ShieldCheck, ShieldOff,
  Phone, ChevronLeft, ChevronRight, Edit3, Trash2, Plus, X,
  CheckCircle2, AlertTriangle, Navigation, UserCog, History,
  KeyRound, UserPlus, Crown, ArrowUp, ArrowDown, Radio, Database
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Calendar as CalendarComponent } from '@/components/ui/calendar'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Separator } from '@/components/ui/separator'
import { generateDeviceId, getCurrentPosition } from '@/lib/client'
import { ar as arLocale } from 'date-fns/locale'
import {
  ALL_PERMISSIONS, PERMISSION_LABELS,
  type Permission, type Role,
} from '@/lib/permissions'
import { getRealtimeSocket } from '@/lib/realtime-client'

/* ============================ Types ============================ */
type Employee = {
  id: string
  code: string
  name: string
  phone?: string | null
  role: Role
  permissions: string[]
  isActive: boolean
  boundDeviceId?: string | null
  hasPassword?: boolean
}

type Schedule = {
  id: string
  name: string
  checkInTime: string
  checkOutTime: string
  lateThresholdMinutes: number
  earlyLeaveThresholdMinutes: number
  workDays: string[]
  isActive: boolean
}

type TodayAttendance = {
  id: string
  checkInTime: string | null
  checkOutTime: string | null
  checkInLat: number | null
  checkInLng: number | null
  checkOutLat: number | null
  checkOutLng: number | null
  checkInAddress: string | null
  checkOutAddress: string | null
  status: string
}

type DashboardEmployee = {
  id: string
  code: string
  name: string
  phone?: string | null
  role: Role
  permissions: string[]
  isActive: boolean
  boundDeviceId?: string | null
  lastLat: number | null
  lastLng: number | null
  lastPingAt: string | null
  today: TodayAttendance | null
}

type AuditLogEntry = {
  id: string
  actorId: string | null
  actorCode: string | null
  action: string
  targetType: string | null
  targetId: string | null
  details: string | null
  timestamp: string
}

/* ============================ Helpers ============================ */
const AR_DAYS = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت']

function fmtTime(d: string | null) {
  if (!d) return '—'
  try {
    return new Date(d).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit', hour12: true })
  } catch { return '—' }
}

function fmtDate(d: string | Date) {
  try {
    return new Date(d).toLocaleDateString('ar-EG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
  } catch { return '' }
}

function fmtDateTime(d: string | null) {
  if (!d) return '—'
  try {
    return new Date(d).toLocaleString('ar-EG', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true })
  } catch { return '—' }
}

function statusBadge(status: string) {
  const map: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
    PENDING: { label: 'بانتظار التسجيل', variant: 'outline' },
    PRESENT: { label: 'حاضر', variant: 'default' },
    PRESENT_OFF_DAY: { label: 'حاضر (يوم عطلة)', variant: 'secondary' },
    LATE: { label: 'متأخر', variant: 'destructive' },
    LATE_OFF_DAY: { label: 'متأخر (يوم عطلة)', variant: 'destructive' },
    CHECKED_OUT: { label: 'تم الانصراف', variant: 'secondary' },
    EARLY_LEAVE: { label: 'انصراف مبكر', variant: 'destructive' },
    LATE_CHECKED_OUT: { label: 'متأخر + منصرف', variant: 'destructive' },
    ABSENT: { label: 'غائب', variant: 'destructive' },
  }
  const cfg = map[status] || { label: status, variant: 'outline' as const }
  return <Badge variant={cfg.variant}>{cfg.label}</Badge>
}

function roleBadge(role: Role) {
  if (role === 'MANAGER') return <Badge className="bg-amber-500 hover:bg-amber-600 text-white"><Crown className="w-3 h-3 ml-1" /> مدير</Badge>
  if (role === 'SUPERVISOR') return <Badge className="bg-blue-500 hover:bg-blue-600 text-white"><ShieldCheck className="w-3 h-3 ml-1" /> مشرف</Badge>
  return <Badge variant="outline">موظف</Badge>
}

/* ============================ Main Page ============================ */
export default function Home() {
  const [user, setUser] = useState<Employee | null>(null)
  const [loading, setLoading] = useState(true)
  const [isDark, setIsDark] = useState<boolean>(false)
  const [systemFresh, setSystemFresh] = useState<boolean>(false)
  const [needsDbSetup, setNeedsDbSetup] = useState<boolean>(false)

  useEffect(() => {
    const root = document.documentElement
    const stored = localStorage.getItem('theme')
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    const dark = stored === 'dark' || (!stored && prefersDark)
    root.classList.toggle('dark', dark)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsDark(dark)
  }, [])

  const toggleTheme = () => {
    const next = !isDark
    setIsDark(next)
    document.documentElement.classList.toggle('dark', next)
    localStorage.setItem('theme', next ? 'dark' : 'light')
  }

  useEffect(() => {
    Promise.all([
      fetch('/api/auth', { cache: 'no-store' }).then((r) => (r.ok ? r.json() : null)).catch(() => null),
      fetch('/api/system/status', { cache: 'no-store' }).then((r) => r.json()).catch(() => ({ isFresh: false })),
      fetch('/api/health', { cache: 'no-store' }).then((r) => r.json()).catch(() => ({ status: 'ok' })),
    ]).then(([userData, sysData, healthData]) => {
      if (userData && !userData.error) setUser(userData)
      if (sysData?.isFresh) setSystemFresh(true)
      // Show DB setup screen if DATABASE_URL is missing or DB connection failed
      if (healthData?.status === 'error' && healthData?.db?.connected === false) {
        setNeedsDbSetup(true)
      }
      setLoading(false)
    })
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-background via-background to-muted/30">
      <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur-md supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
              <Fingerprint className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="text-base font-bold leading-tight">نظام الحضور والانصراف</h1>
              <p className="text-xs text-muted-foreground hidden sm:block">إدارة الموظفين عبر الموقع الجغرافي</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={toggleTheme} aria-label="تبديل السمة">
              {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </Button>
            {user && (
              <div className="flex items-center gap-2">
                <div className="hidden sm:flex flex-col items-end leading-tight">
                  <span className="text-sm font-medium">{user.name}</span>
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-muted-foreground">{user.code}</span>
                    {roleBadge(user.role)}
                  </div>
                </div>
                <Avatar className="w-9 h-9">
                  <AvatarFallback className="bg-primary/10 text-primary text-sm">
                    {user.name.split(' ').slice(0, 2).map((w) => w[0]).join('')}
                  </AvatarFallback>
                </Avatar>
                <Button variant="ghost" size="icon" onClick={async () => {
                  await fetch('/api/auth', { method: 'DELETE' })
                  setUser(null)
                }} aria-label="تسجيل الخروج" title="تسجيل الخروج">
                  <LogOut className="w-4 h-4" />
                </Button>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1 container mx-auto px-4 py-6">
        <AnimatePresence mode="wait">
          {!user && needsDbSetup ? (
            <motion.div key="setup" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
              <DatabaseSetupScreen onSetupComplete={() => setNeedsDbSetup(false)} />
            </motion.div>
          ) : !user ? (
            <motion.div key="login" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
              <LoginScreen onLogin={setUser} systemFresh={systemFresh} onRegistered={() => setSystemFresh(false)} />
            </motion.div>
          ) : user.role === 'MANAGER' || user.role === 'SUPERVISOR' ? (
            <motion.div key="admin" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
              <AdminDashboard user={user} />
            </motion.div>
          ) : (
            <motion.div key="employee" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
              <EmployeeDashboard user={user} />
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <footer className="border-t border-border bg-background/60 backdrop-blur-sm mt-auto">
        <div className="container mx-auto px-4 py-4 text-center text-xs text-muted-foreground">
          نظام الحضور والانصراف &copy; {new Date().getFullYear()} — MongoDB · WebSocket · RBAC
        </div>
      </footer>
    </div>
  )
}

/* ============================ Login Screen ============================ */
function LoginScreen({
  onLogin,
  systemFresh,
  onRegistered,
}: {
  onLogin: (u: Employee) => void
  systemFresh: boolean
  onRegistered: () => void
}) {
  const [mode, setMode] = useState<'login' | 'register_first'>(systemFresh ? 'register_first' : 'login')
  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (systemFresh) setMode('register_first')
  }, [systemFresh])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const deviceId = generateDeviceId()
      const payload =
        mode === 'register_first'
          ? { action: 'register_first', code, name, password, phone, deviceId }
          : { code, password, deviceId }

      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      // Try to parse JSON; if not JSON (e.g. HTML error page), give clearer message
      let data: { error?: string; employee?: { id: string; code: string; name: string; role: string; permissions?: string[] }; isFirstUser?: boolean; firstLogin?: boolean }
      try {
        data = await res.json()
      } catch {
        setError(`استجابة غير صالحة من الخادم (HTTP ${res.status}). قد تكون قاعدة البيانات غير مهيأة.`)
        return
      }
      if (!res.ok) {
        setError(data.error || `فشل العملية (HTTP ${res.status})`)
        return
      }
      onLogin({
        id: data.employee.id,
        code: data.employee.code,
        name: data.employee.name,
        role: data.employee.role,
        permissions: data.employee.permissions || [],
        isActive: true,
      })
      if (data.isFirstUser) {
        toast.success('تم إنشاء أول حساب مدير بصلاحيات كاملة', { description: 'مرحباً بك في النظام' })
        onRegistered()
      } else if (data.firstLogin) {
        toast.success('تم ربط الحساب بالجهاز وتعيين كلمة المرور بنجاح')
      }
    } catch {
      setError('تعذر الاتصال بالخادم')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-md mx-auto pt-6">
      <Card className="shadow-xl border-border/60">
        <CardHeader className="text-center space-y-3 pb-6">
          <div className="mx-auto w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
            {mode === 'register_first' ? <Crown className="w-8 h-8 text-primary" /> : <Fingerprint className="w-8 h-8 text-primary" />}
          </div>
          <div>
            <CardTitle className="text-2xl">
              {mode === 'register_first' ? 'إنشاء أول حساب مدير' : 'تسجيل الدخول'}
            </CardTitle>
            <CardDescription className="mt-1">
              {mode === 'register_first'
                ? 'النظام جديد — سيتم منح هذا الحساب صلاحيات المدير الكاملة تلقائياً'
                : 'أدخل كود الموظف وكلمة المرور للمتابعة'}
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="code">كود الموظف</Label>
              <div className="relative">
                <UserCog className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input id="code" value={code} onChange={(e) => setCode(e.target.value)} placeholder="EMP001" className="pr-9" required autoComplete="username" />
              </div>
            </div>

            {mode === 'register_first' && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="name">الاسم الكامل</Label>
                  <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="مثال: محمد أحمد" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">رقم الهاتف (اختياري)</Label>
                  <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="01xxxxxxxxx" />
                </div>
              </>
            )}

            <div className="space-y-2">
              <Label htmlFor="password">كلمة المرور</Label>
              <div className="relative">
                <ShieldCheck className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••" className="pr-9" required autoComplete={mode === 'register_first' ? 'new-password' : 'current-password'} />
              </div>
              {mode === 'register_first' && (
                <p className="text-xs text-muted-foreground">6 أحرف على الأقل</p>
              )}
            </div>

            {error && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {mode === 'register_first' && (
              <div className="rounded-lg bg-amber-50 dark:bg-amber-950/30 p-3 text-xs text-amber-700 dark:text-amber-300 flex items-start gap-2">
                <Crown className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>أول حساب يتم إنشاؤه في النظام يحصل تلقائياً على دور <b>المدير</b> مع <b>جميع الصلاحيات</b>. لن تتمكن من إنشاء حساب مدير آخر لاحقاً بهذه الطريقة.</span>
              </div>
            )}

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? <Loader2 className="w-4 h-4 animate-spin ml-2" /> : <LogIn className="w-4 h-4 ml-2" />}
              {mode === 'register_first' ? 'إنشاء الحساب' : 'دخول'}
            </Button>
          </form>
        </CardContent>
        <CardFooter className="flex-col gap-2 justify-center">
          <HealthCheckButton />
          {!systemFresh && (
            <p className="text-xs text-muted-foreground text-center">
              عند أول تسجيل دخول سيتم ربط حسابك بهذا الجهاز.
            </p>
          )}
        </CardFooter>
      </Card>
    </div>
  )
}

/* -------- Database Setup Screen (shown when DATABASE_URL is missing) -------- */
function DatabaseSetupScreen({ onSetupComplete }: { onSetupComplete: () => void }) {
  const [dbUrl, setDbUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<unknown>(null)
  const [error, setError] = useState('')

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    setResult(null)
    try {
      const res = await fetch('/api/setup-db', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ databaseUrl: dbUrl.trim() }),
      })
      const data = await res.json().catch(() => ({ error: 'استجابة غير صالحة' }))
      setResult({ httpStatus: res.status, data })
      if (res.ok && data.success) {
        toast.success('تم إعداد قاعدة البيانات بنجاح!', {
          description: 'يمكنك الآن تسجيل الدخول بـ ADMIN001 / admin123',
          duration: 8000,
        })
        setTimeout(() => onSetupComplete(), 2500)
      } else {
        setError(data.error || `فشل الإعداد (HTTP ${res.status})`)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto pt-2">
      <Card className="shadow-xl border-amber-500/30">
        <CardHeader className="text-center space-y-3 pb-6">
          <div className="mx-auto w-16 h-16 rounded-2xl bg-amber-500/10 flex items-center justify-center">
            <Database className="w-8 h-8 text-amber-600" />
          </div>
          <div>
            <CardTitle className="text-2xl">إعداد قاعدة البيانات</CardTitle>
            <CardDescription className="mt-1">
              لم يتم العثور على <code className="bg-muted px-1 py-0.5 rounded text-xs">DATABASE_URL</code>.
              اربط قاعدة بيانات MongoDB لتفعيل النظام.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Instructions */}
          <div className="rounded-lg bg-muted/50 p-4 space-y-2 text-sm">
            <p className="font-medium">📋 الخطوات:</p>
            <ol className="list-decimal list-inside space-y-1 text-xs text-muted-foreground mr-2">
              <li>أنشئ حساب مجاني على <a href="https://www.mongodb.com/cloud/atlas/register" target="_blank" rel="noreferrer" className="text-primary hover:underline">MongoDB Atlas</a></li>
              <li>أنشئ cluster من نوع <b>M0 Free</b></li>
              <li>من <b>Database Access</b>: أنشئ user باسم وكلمة مرور</li>
              <li>من <b>Network Access</b>: اختر <code className="bg-background px-1 rounded">Allow Access From Anywhere</code></li>
              <li>من <b>Database → Connect → Drivers</b>: انسخ connection string</li>
              <li>استبدل <code className="bg-background px-1 rounded">&lt;password&gt;</code> بكلمة المرور الحقيقية</li>
              <li>أضف <code className="bg-background px-1 rounded">/attendance_db</code> قبل <code className="bg-background px-1 rounded">?</code> في الـ URL</li>
            </ol>
          </div>

          <form onSubmit={submit} className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="dbUrl">MongoDB Connection String</Label>
              <textarea
                id="dbUrl"
                value={dbUrl}
                onChange={(e) => setDbUrl(e.target.value)}
                placeholder="mongodb+srv://USER:PASSWORD@cluster0.xxxxx.mongodb.net/attendance_db?retryWrites=true&w=majority"
                className="font-mono text-xs min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2"
                required
                dir="ltr"
              />
              <p className="text-xs text-muted-foreground">
                مثال: <code dir="ltr" className="bg-muted px-1 rounded">mongodb+srv://user:pass@cluster0.abcde.mongodb.net/attendance_db?retryWrites=true&amp;w=majority</code>
              </p>
            </div>

            {error && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
                <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span className="break-all">{error}</span>
              </div>
            )}

            {result && (
              <div className="rounded-lg bg-muted p-3">
                <div className="text-xs font-medium mb-2">النتيجة:</div>
                <pre className="text-[10px] overflow-x-auto whitespace-pre-wrap break-all" dir="ltr">
                  {JSON.stringify(result, null, 2)}
                </pre>
              </div>
            )}

            <Button type="submit" className="w-full" disabled={loading || !dbUrl.trim()}>
              {loading ? <Loader2 className="w-4 h-4 animate-spin ml-2" /> : <Database className="w-4 h-4 ml-2" />}
              إعداد قاعدة البيانات + إنشاء المدير الافتراضي
            </Button>
          </form>

          <div className="rounded-lg bg-emerald-50 dark:bg-emerald-950/30 p-3 text-xs text-emerald-700 dark:text-emerald-300">
            <p className="font-medium mb-1">✅ بعد نجاح الإعداد:</p>
            <ol className="list-decimal list-inside space-y-1 mr-2">
              <li>سجّل الدخول بـ: <code className="bg-background px-1 rounded">ADMIN001</code> / <code className="bg-background px-1 rounded">admin123</code></li>
              <li>للاستخدام الدائم: أضف نفس الـ URL إلى Vercel Environment Variables باسم <code className="bg-background px-1 rounded">DATABASE_URL</code></li>
            </ol>
          </div>
        </CardContent>
        <CardFooter className="justify-center">
          <Button variant="ghost" size="sm" onClick={onSetupComplete}>
            تخطي (سجّل الدخول فقط)
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
}

/* -------- Health Check Button (diagnostics for production debugging) -------- */
function HealthCheckButton() {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<unknown>(null)

  const check = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/health', { cache: 'no-store' })
      const data = await res.json().catch(() => ({ error: 'Invalid JSON' }))
      setResult({ httpStatus: res.status, data })
    } catch (e) {
      setResult({ error: e instanceof Error ? e.message : String(e) })
    } finally {
      setLoading(false)
      setOpen(true)
    }
  }

  return (
    <>
      <Button type="button" variant="ghost" size="sm" onClick={check} disabled={loading}>
        {loading ? <Loader2 className="w-3 h-3 animate-spin ml-1" /> : <Navigation className="w-3 h-3 ml-1" />}
        فحص حالة النظام
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>تشخيص حالة النظام</DialogTitle>
            <DialogDescription>
              يعرض هذا المتغيرات البيئية وحالة الاتصال بقاعدة البيانات
            </DialogDescription>
          </DialogHeader>
          <pre className="text-xs bg-muted p-3 rounded-lg overflow-x-auto whitespace-pre-wrap break-all" dir="ltr">
            {JSON.stringify(result, null, 2)}
          </pre>
          <div className="text-xs text-muted-foreground space-y-1">
            <p>إذا كان <code>db.connected</code> = <code>false</code>:</p>
            <ul className="list-disc list-inside mr-4 space-y-1">
              <li>تأكد أن <code>DATABASE_URL</code> مضبوط في Vercel Environment Variables</li>
              <li>تأكد أن MongoDB Atlas يسمح بـ IP <code>0.0.0.0/0</code></li>
              <li>تأكد أن كلمة المرور في الـ URL صحيحة</li>
              <li>شغّل <code>node scripts/seed-admin.js</code> بعد ضبط DATABASE_URL</li>
            </ul>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

/* ============================ Employee Dashboard ============================ */
function EmployeeDashboard({ user }: { user: Employee }) {
  const [tab, setTab] = useState('today')
  const [schedule, setSchedule] = useState<Schedule | null>(null)
  const [todayRecord, setTodayRecord] = useState<TodayAttendance | null>(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<'in' | 'out' | null>(null)

  const loadToday = useCallback(async () => {
    try {
      const res = await fetch('/api/attendance/today', { cache: 'no-store' })
      const data = await res.json()
      setSchedule(data.schedule)
      setTodayRecord(data.attendance)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadToday() }, [loadToday])

  // Live location updates every 30s + WebSocket for manager dashboards
  useEffect(() => {
    if (!user.isActive) return
    const sendPing = async () => {
      try {
        const pos = await getCurrentPosition()
        await fetch('/api/location', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(pos),
        })
      } catch { /* silent */ }
    }
    // Initial ping after 3 seconds (so browser asks for geolocation permission early)
    const t0 = setTimeout(sendPing, 3000)
    const timer = setInterval(sendPing, 30_000)
    return () => { clearTimeout(t0); clearInterval(timer) }
  }, [user.isActive])

  const doCheckIn = async () => {
    setActionLoading('in')
    try {
      const pos = await getCurrentPosition()
      const res = await fetch('/api/attendance/check-in', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(pos),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error || 'فشل تسجيل الحضور'); return }
      toast.success('تم تسجيل الحضور بنجاح', { description: `الوقت: ${fmtTime(data.attendance.checkIn?.time)}` })
      await loadToday()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'تعذر الحصول على الموقع')
    } finally {
      setActionLoading(null)
    }
  }

  const doCheckOut = async () => {
    setActionLoading('out')
    try {
      const pos = await getCurrentPosition()
      const res = await fetch('/api/attendance/check-out', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(pos),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error || 'فشل تسجيل الانصراف'); return }
      toast.success('تم تسجيل الانصراف بنجاح', { description: `الوقت: ${fmtTime(data.attendance.checkOut?.time)}` })
      await loadToday()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'تعذر الحصول على الموقع')
    } finally {
      setActionLoading(null)
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
  }

  if (!user.isActive) {
    return (
      <Card className="max-w-lg mx-auto border-destructive/30">
        <CardHeader>
          <CardTitle className="text-destructive flex items-center gap-2"><ShieldOff className="w-5 h-5" /> الحساب موقوف</CardTitle>
          <CardDescription>تم إيقاف حسابك من قبل الإدارة. يرجى التواصل مع المسؤول.</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  return (
    <Tabs value={tab} onValueChange={setTab} className="max-w-4xl mx-auto">
      <TabsList className="grid grid-cols-2 w-full">
        <TabsTrigger value="today" className="gap-2"><Clock className="w-4 h-4" /> اليوم</TabsTrigger>
        <TabsTrigger value="calendar" className="gap-2"><Calendar className="w-4 h-4" /> التقويم</TabsTrigger>
      </TabsList>

      <TabsContent value="today" className="space-y-4 mt-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2"><Clock className="w-4 h-4 text-primary" /> مواعيد العمل اليوم</CardTitle>
            <CardDescription>{fmtDate(new Date())}</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4">
            <div className="rounded-lg bg-muted/50 p-3 text-center">
              <div className="text-xs text-muted-foreground mb-1">موعد الحضور</div>
              <div className="text-xl font-bold">{schedule?.checkInTime || '—'}</div>
            </div>
            <div className="rounded-lg bg-muted/50 p-3 text-center">
              <div className="text-xs text-muted-foreground mb-1">موعد الانصراف</div>
              <div className="text-xl font-bold">{schedule?.checkOutTime || '—'}</div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Button size="lg" onClick={doCheckIn} disabled={!!actionLoading || !!todayRecord?.checkInTime} className="h-20 text-base gap-2">
                {actionLoading === 'in' ? <Loader2 className="w-5 h-5 animate-spin" /> : <LogIn className="w-5 h-5" />}
                تسجيل الحضور
              </Button>
              <Button size="lg" variant="secondary" onClick={doCheckOut} disabled={!!actionLoading || !todayRecord?.checkInTime || !!todayRecord?.checkOutTime} className="h-20 text-base gap-2">
                {actionLoading === 'out' ? <Loader2 className="w-5 h-5 animate-spin" /> : <LogOut className="w-5 h-5" />}
                تسجيل الانصراف
              </Button>
            </div>
            {!todayRecord?.checkInTime && (
              <p className="text-xs text-muted-foreground mt-3 text-center">لم تقم بتسجيل الحضور بعد اليوم</p>
            )}
            {todayRecord?.checkInTime && !todayRecord?.checkOutTime && (
              <p className="text-xs text-muted-foreground mt-3 text-center">تم تسجيل الحضور. لا تنسَ تسجيل الانصراف قبل المغادرة.</p>
            )}
            {todayRecord?.checkInTime && todayRecord?.checkOutTime && (
              <p className="text-xs text-center text-primary mt-3">تم تسجيل الحضور والانصراف اليوم بنجاح</p>
            )}
          </CardContent>
        </Card>

        {todayRecord && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center justify-between">
                <span className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-primary" /> سجل اليوم</span>
                {statusBadge(todayRecord.status)}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <RecordBlock title="وقت الحضور" time={fmtTime(todayRecord.checkInTime)} address={todayRecord.checkInAddress || undefined} lat={todayRecord.checkInLat} lng={todayRecord.checkInLng} />
                <RecordBlock title="وقت الانصراف" time={fmtTime(todayRecord.checkOutTime)} address={todayRecord.checkOutAddress || undefined} lat={todayRecord.checkOutLat} lng={todayRecord.checkOutLng} />
              </div>
            </CardContent>
          </Card>
        )}
      </TabsContent>

      <TabsContent value="calendar" className="mt-4">
        <EmployeeCalendar employeeId={user.id} employeeRole={user.role} />
      </TabsContent>
    </Tabs>
  )
}

function RecordBlock({ title, time, address, lat, lng }: {
  title: string; time: string; address?: string; lat?: number | null; lng?: number | null
}) {
  const mapsUrl = lat != null && lng != null ? `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=16/${lat}/${lng}` : null
  return (
    <div className="rounded-lg border border-border bg-muted/30 p-3">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-muted-foreground">{title}</span>
        <Clock className="w-3.5 h-3.5 text-muted-foreground" />
      </div>
      <div className="text-2xl font-bold mb-1">{time}</div>
      {address && <div className="text-xs text-muted-foreground line-clamp-2">{address}</div>}
      {mapsUrl && (
        <a href={mapsUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-primary mt-2 hover:underline">
          <MapPin className="w-3 h-3" /> عرض على الخريطة
        </a>
      )}
    </div>
  )
}

/* ============================ Employee Calendar ============================ */
function EmployeeCalendar({ employeeId, employeeRole }: { employeeId: string; employeeRole: string }) {
  const [month, setMonth] = useState<Date>(new Date())
  const [records, setRecords] = useState<Array<{ dateKey: string; status: string; checkInTime: string | null; checkOutTime: string | null }>>([])
  const [loading, setLoading] = useState(true)
  const [selectedDay, setSelectedDay] = useState<Date | undefined>(new Date())

  const monthKey = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, '0')}`

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/attendance/calendar?month=${monthKey}&employeeId=${employeeId}`, { cache: 'no-store' })
      const data = await res.json()
      setRecords(data.records || [])
    } finally {
      setLoading(false)
    }
  }, [monthKey, employeeId])

  useEffect(() => { load() }, [load])

  const recordByDay = new Map<string, typeof records[number]>()
  for (const r of records) recordByDay.set(r.dateKey, r)

  const selectedKey = selectedDay ? selectedDay.toISOString().slice(0, 10) : null
  const selectedRecord = selectedKey ? recordByDay.get(selectedKey) : undefined

  const summary = {
    present: records.filter((r) => r.checkInTime && !r.status.includes('LATE')).length,
    late: records.filter((r) => r.status.includes('LATE')).length,
    offDays: records.filter((r) => r.status.includes('OFF_DAY')).length,
    completed: records.filter((r) => r.checkInTime && r.checkOutTime).length,
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <Card className="lg:col-span-2">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base flex items-center gap-2"><Calendar className="w-4 h-4 text-primary" /> التقويم الشهري</CardTitle>
              <CardDescription>{month.toLocaleDateString('ar-EG', { month: 'long', year: 'numeric' })}</CardDescription>
            </div>
            <div className="flex items-center gap-1">
              <Button variant="outline" size="icon" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}><ChevronRight className="w-4 h-4" /></Button>
              <Button variant="outline" size="sm" onClick={() => setMonth(new Date())}>اليوم</Button>
              <Button variant="outline" size="icon" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}><ChevronLeft className="w-4 h-4" /></Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <CalendarComponent
            mode="single"
            selected={selectedDay}
            onSelect={setSelectedDay}
            month={month}
            onMonthChange={setMonth}
            dir="rtl"
            locale={arLocale}
            className="p-0"
            modifiers={{
              present: (date) => { const r = recordByDay.get(date.toISOString().slice(0, 10)); return !!r?.checkInTime && !r.status.includes('LATE') },
              late: (date) => { const r = recordByDay.get(date.toISOString().slice(0, 10)); return !!r?.status.includes('LATE') },
              offDay: (date) => { const r = recordByDay.get(date.toISOString().slice(0, 10)); return !!r?.status.includes('OFF_DAY') },
            }}
            modifiersClassNames={{
              present: '!bg-primary/15 !text-primary',
              late: '!bg-destructive/15 !text-destructive',
              offDay: '!bg-muted !text-muted-foreground',
            }}
          />
          <div className="flex flex-wrap items-center gap-3 mt-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-primary/30" /> حاضر</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-destructive/30" /> متأخر</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-muted" /> يوم عطلة</span>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-4">
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-sm">ملخص الشهر</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-2 gap-3 text-center">
            <div className="rounded-lg bg-primary/10 p-3"><div className="text-2xl font-bold text-primary">{summary.present}</div><div className="text-xs text-muted-foreground">أيام حضور</div></div>
            <div className="rounded-lg bg-destructive/10 p-3"><div className="text-2xl font-bold text-destructive">{summary.late}</div><div className="text-xs text-muted-foreground">أيام تأخير</div></div>
            <div className="rounded-lg bg-muted p-3"><div className="text-2xl font-bold">{summary.completed}</div><div className="text-xs text-muted-foreground">اكتمل الحضور والانصراف</div></div>
            <div className="rounded-lg bg-muted p-3"><div className="text-2xl font-bold">{records.length}</div><div className="text-xs text-muted-foreground">إجمالي السجلات</div></div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">تفاصيل اليوم المحدد</CardTitle>
            <CardDescription>{selectedDay ? fmtDate(selectedDay) : 'اختر يوماً'}</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? <Loader2 className="w-5 h-5 animate-spin text-muted-foreground mx-auto" /> : selectedRecord ? (
              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between"><span className="text-muted-foreground">الحالة</span>{statusBadge(selectedRecord.status)}</div>
                <div className="flex items-center justify-between"><span className="text-muted-foreground">الحضور</span><span className="font-medium">{fmtTime(selectedRecord.checkInTime)}</span></div>
                <div className="flex items-center justify-between"><span className="text-muted-foreground">الانصراف</span><span className="font-medium">{fmtTime(selectedRecord.checkOutTime)}</span></div>
              </div>
            ) : <p className="text-sm text-muted-foreground text-center py-4">لا يوجد سجل لهذا اليوم</p>}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

/* ============================ Admin Dashboard ============================ */
function AdminDashboard({ user }: { user: Employee }) {
  const [tab, setTab] = useState('overview')
  // Subscribe to real-time socket on mount
  useEffect(() => {
    const sock = getRealtimeSocket()
    if (!sock) return
    sock.on('connect', () => {
      sock.emit('identify', { role: user.role })
      sock.emit('subscribe:locations')
    })
    return () => { sock.off('connect') }
  }, [user.role])

  const canManageEmployees = user.role === 'MANAGER' || user.permissions.includes('employees:view')
  const canViewAudit = user.role === 'MANAGER' || user.permissions.includes('auditlog:view')
  const canEditSchedule = user.role === 'MANAGER' || user.permissions.includes('schedule:edit')

  return (
    <Tabs value={tab} onValueChange={setTab} className="w-full">
      <TabsList className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 w-full mb-4 h-auto">
        <TabsTrigger value="overview" className="gap-2 py-2"><LayoutDashboard className="w-4 h-4" /> <span className="hidden sm:inline">نظرة عامة</span></TabsTrigger>
        {canManageEmployees && (
          <TabsTrigger value="employees" className="gap-2 py-2"><Users className="w-4 h-4" /> <span className="hidden sm:inline">الموظفين</span></TabsTrigger>
        )}
        <TabsTrigger value="calendar" className="gap-2 py-2"><Calendar className="w-4 h-4" /> <span className="hidden sm:inline">التقويم</span></TabsTrigger>
        {canEditSchedule && (
          <TabsTrigger value="settings" className="gap-2 py-2"><Settings className="w-4 h-4" /> <span className="hidden sm:inline">الإعدادات</span></TabsTrigger>
        )}
        {canViewAudit && (
          <TabsTrigger value="audit" className="gap-2 py-2"><History className="w-4 h-4" /> <span className="hidden sm:inline">السجل</span></TabsTrigger>
        )}
      </TabsList>

      <TabsContent value="overview"><AdminOverview user={user} /></TabsContent>
      {canManageEmployees && <TabsContent value="employees"><AdminEmployees adminId={user.id} adminRole={user.role} adminPermissions={user.permissions} /></TabsContent>}
      <TabsContent value="calendar"><AdminCalendar /></TabsContent>
      {canEditSchedule && <TabsContent value="settings"><AdminSettings /></TabsContent>}
      {canViewAudit && <TabsContent value="audit"><AdminAuditLog /></TabsContent>}
    </Tabs>
  )
}

/* -------- Admin Overview (with real-time location updates) -------- */
function AdminOverview({ user }: { user: Employee }) {
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<{ employees: DashboardEmployee[]; summary: any } | null>(null)
  const [selectedEmp, setSelectedEmp] = useState<DashboardEmployee | null>(null)
  const [realtimeUpdate, setRealtimeUpdate] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/dashboard', { cache: 'no-store' })
      const d = await res.json()
      setData(d)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
    // In production (Vercel), WebSocket is disabled → poll faster (8s).
    // In dev, WebSocket handles updates → poll every 15s as backup.
    const intervalMs = process.env.NODE_ENV === 'production' ? 8_000 : 15_000
    const t = setInterval(load, intervalMs)
    return () => clearInterval(t)
  }, [load])

  // Listen for real-time updates via WebSocket (skipped in production)
  useEffect(() => {
    const sock = getRealtimeSocket()
    if (!sock) return
    const onLocationUpdate = (payload: { employeeId: string; code: string; name: string; lat: number; lng: number }) => {
      setRealtimeUpdate(`${payload.name} (${payload.code}) → (${payload.lat.toFixed(5)}, ${payload.lng.toFixed(5)})`)
      // Also update the local state
      setData((prev) => {
        if (!prev) return prev
        const updated = prev.employees.map((e) =>
          e.id === payload.employeeId
            ? { ...e, lastLat: payload.lat, lastLng: payload.lng, lastPingAt: new Date().toISOString() }
            : e
        )
        return { ...prev, employees: updated }
      })
      // Auto-clear the toast after 3s
      setTimeout(() => setRealtimeUpdate(null), 3000)
    }
    const onCheckIn = (payload: { name: string; code: string }) => {
      toast.success(`${payload.name} سجّل الحضور`, { description: `الكود: ${payload.code}` })
      load() // refresh dashboard
    }
    const onCheckOut = (payload: { name: string; code: string }) => {
      toast.info(`${payload.name} سجّل الانصراف`, { description: `الكود: ${payload.code}` })
      load()
    }
    sock.on('location:update', onLocationUpdate)
    sock.on('attendance:check-in', onCheckIn)
    sock.on('attendance:check-out', onCheckOut)
    return () => {
      sock.off('location:update', onLocationUpdate)
      sock.off('attendance:check-in', onCheckIn)
      sock.off('attendance:check-out', onCheckOut)
    }
  }, [load])

  if (loading || !data) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
  }

  return (
    <div className="space-y-4">
      {/* Real-time indicator */}
      <div className="flex items-center gap-2 text-xs">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
        </span>
        <span className="text-emerald-600 font-medium">البث المباشر مفعّل</span>
        {realtimeUpdate && <span className="text-muted-foreground">— آخر تحديث: {realtimeUpdate}</span>}
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatCard icon={<Users className="w-4 h-4" />} label="إجمالي الموظفين" value={data.summary.totalEmployees} color="text-primary bg-primary/10" />
        <StatCard icon={<ShieldCheck className="w-4 h-4" />} label="نشط" value={data.summary.activeEmployees} color="text-emerald-600 bg-emerald-50" />
        <StatCard icon={<CheckCircle2 className="w-4 h-4" />} label="حاضرون اليوم" value={data.summary.presentToday} color="text-emerald-600 bg-emerald-50" />
        <StatCard icon={<Clock className="w-4 h-4" />} label="متأخرون اليوم" value={data.summary.lateToday} color="text-amber-600 bg-amber-50" />
        <StatCard icon={<LogOut className="w-4 h-4" />} label="منصرفون اليوم" value={data.summary.checkedOutToday} color="text-blue-600 bg-blue-50" />
        <StatCard icon={<ShieldOff className="w-4 h-4" />} label="غائبون اليوم" value={data.summary.absentToday} color="text-destructive bg-destructive/10" />
      </div>

      {/* Map */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2"><Navigation className="w-4 h-4 text-primary" /> مواقع الموظفين الحية</CardTitle>
          <CardDescription>آخر تحديث للموقع لكل موظف مع موقع تسجيل الحضور اليوم</CardDescription>
        </CardHeader>
        <CardContent>
          <EmployeeMap employees={data.employees} onSelect={setSelectedEmp} selectedId={selectedEmp?.id} />
        </CardContent>
      </Card>

      {/* Employee table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2"><Users className="w-4 h-4 text-primary" /> سجل اليوم</CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="max-h-[480px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-right">الموظف</TableHead>
                  <TableHead className="text-right">الدور</TableHead>
                  <TableHead className="text-right">الحالة</TableHead>
                  <TableHead className="text-right">الحضور</TableHead>
                  <TableHead className="text-right">الانصراف</TableHead>
                  <TableHead className="text-right">آخر موقع</TableHead>
                  <TableHead className="text-right"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.employees.length === 0 && (
                  <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">لا يوجد موظفون مسجلون بعد</TableCell></TableRow>
                )}
                {data.employees.map((emp) => (
                  <TableRow key={emp.id} className={emp.id === selectedEmp?.id ? 'bg-muted/40' : ''}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Avatar className="w-8 h-8">
                          <AvatarFallback className="text-xs bg-primary/10 text-primary">{emp.name.split(' ').slice(0, 2).map((w) => w[0]).join('')}</AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="font-medium text-sm flex items-center gap-1">{emp.name}{!emp.isActive && <ShieldOff className="w-3 h-3 text-destructive" />}</div>
                          <div className="text-xs text-muted-foreground">{emp.code}</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>{roleBadge(emp.role)}</TableCell>
                    <TableCell>{emp.today ? statusBadge(emp.today.status) : <Badge variant="outline">لم يسجّل</Badge>}</TableCell>
                    <TableCell className="text-sm">{fmtTime(emp.today?.checkInTime || null)}</TableCell>
                    <TableCell className="text-sm">{fmtTime(emp.today?.checkOutTime || null)}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{emp.lastPingAt ? fmtDateTime(emp.lastPingAt) : '—'}</TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm" onClick={() => setSelectedEmp(emp)}><MapPin className="w-4 h-4" /> موقع</Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollArea>
        </CardContent>
      </Card>

      {selectedEmp && (
        <Dialog open={!!selectedEmp} onOpenChange={(o) => !o && setSelectedEmp(null)}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Avatar className="w-8 h-8">
                  <AvatarFallback className="text-xs bg-primary/10 text-primary">{selectedEmp.name.split(' ').slice(0, 2).map((w) => w[0]).join('')}</AvatarFallback>
                </Avatar>
                {selectedEmp.name}
                <span className="text-xs text-muted-foreground">({selectedEmp.code})</span>
                {roleBadge(selectedEmp.role)}
              </DialogTitle>
              <DialogDescription>تفاصيل الموقع الحالي وسجل اليوم</DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><div className="text-xs text-muted-foreground mb-1">وقت الحضور</div><div className="font-medium">{fmtTime(selectedEmp.today?.checkInTime || null)}</div></div>
                <div><div className="text-xs text-muted-foreground mb-1">وقت الانصراف</div><div className="font-medium">{fmtTime(selectedEmp.today?.checkOutTime || null)}</div></div>
                <div><div className="text-xs text-muted-foreground mb-1">الحالة</div><div>{selectedEmp.today ? statusBadge(selectedEmp.today.status) : '—'}</div></div>
                <div><div className="text-xs text-muted-foreground mb-1">آخر ظهور</div><div className="font-medium text-xs">{fmtDateTime(selectedEmp.lastPingAt)}</div></div>
              </div>
              {selectedEmp.today?.checkInAddress && (
                <div className="rounded-lg bg-muted/50 p-3"><div className="text-xs text-muted-foreground mb-1">عنوان الحضور</div><div className="text-xs">{selectedEmp.today.checkInAddress}</div></div>
              )}
              <EmployeeMap employees={[selectedEmp]} selectedId={selectedEmp.id} />
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}

function StatCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: number; color: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center mb-2 ${color}`}>{icon}</div>
        <div className="text-2xl font-bold">{value}</div>
        <div className="text-xs text-muted-foreground">{label}</div>
      </CardContent>
    </Card>
  )
}

/* -------- Employee Map -------- */
function EmployeeMap({ employees, selectedId, onSelect }: {
  employees: DashboardEmployee[]
  selectedId?: string
  onSelect?: (e: DashboardEmployee) => void
}) {
  const markers = employees
    .map((e) => {
      const lat = e.lastLat ?? e.today?.checkInLat ?? null
      const lng = e.lastLng ?? e.today?.checkInLng ?? null
      if (lat == null || lng == null) return null
      return { e, lat, lng }
    })
    .filter(Boolean) as Array<{ e: DashboardEmployee; lat: number; lng: number }>

  if (markers.length === 0) {
    return <div className="text-center py-10 text-sm text-muted-foreground">لا توجد مواقع مسجلة للموظفين بعد</div>
  }

  const lats = markers.map((m) => m.lat)
  const lngs = markers.map((m) => m.lng)
  const minLat = Math.min(...lats), maxLat = Math.max(...lats)
  const minLng = Math.min(...lngs), maxLng = Math.max(...lngs)
  const centerLat = (minLat + maxLat) / 2
  const centerLng = (minLng + maxLng) / 2
  const latSpan = maxLat - minLat, lngSpan = maxLng - minLng
  const span = Math.max(latSpan, lngSpan, 0.01)
  const zoom = span > 1 ? 8 : span > 0.5 ? 9 : span > 0.1 ? 11 : span > 0.05 ? 12 : span > 0.02 ? 13 : 14
  void zoom
  const bbox = `${minLng - 0.005},${minLat - 0.005},${maxLng + 0.005},${maxLat + 0.005}`
  const embedUrl = `https://www.openstreetmap.org/export/embed.html?bbox=${encodeURIComponent(bbox)}&layer=mapnik&marker=${centerLat},${centerLng}`

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="md:col-span-2 relative rounded-lg overflow-hidden border border-border">
          <iframe title="map" src={embedUrl} className="w-full h-72 md:h-80" style={{ border: 0 }} loading="lazy" />
        </div>
        <div className="space-y-2 max-h-80 overflow-y-auto">
          {markers.map((m) => (
            <button key={m.e.id} onClick={() => onSelect?.(m.e)} className={`w-full text-right p-2 rounded-lg border text-sm transition-colors ${m.e.id === selectedId ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/50'}`}>
              <div className="flex items-center justify-between">
                <span className="font-medium">{m.e.name}</span>
                <MapPin className="w-3.5 h-3.5 text-primary" />
              </div>
              <div className="text-xs text-muted-foreground">{m.e.lastPingAt ? `آخر ظهور: ${fmtDateTime(m.e.lastPingAt)}` : 'غير معروف'}</div>
              <div className="text-xs text-muted-foreground mt-1">{m.lat.toFixed(5)}, {m.lng.toFixed(5)}</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

/* -------- Admin Employees Tab (with promote/demote + permissions) -------- */
function AdminEmployees({ adminId, adminRole, adminPermissions }: {
  adminId: string
  adminRole: Role
  adminPermissions: string[]
}) {
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [addOpen, setAddOpen] = useState(false)
  const [editEmp, setEditEmp] = useState<Employee | null>(null)
  const [permissionsEmp, setPermissionsEmp] = useState<Employee | null>(null)

  const canCreate = adminRole === 'MANAGER' || adminPermissions.includes('employees:create')
  const canEdit = adminRole === 'MANAGER' || adminPermissions.includes('employees:edit')
  const canSuspend = adminRole === 'MANAGER' || adminPermissions.includes('employees:suspend')
  const canDelete = adminRole === 'MANAGER' || adminPermissions.includes('employees:delete')
  const canPromote = adminRole === 'MANAGER' || adminPermissions.includes('employees:promote')
  const canDemote = adminRole === 'MANAGER' || adminPermissions.includes('employees:demote')
  const canResetDevice = adminRole === 'MANAGER' || adminPermissions.includes('employees:reset_device')
  const canResetPassword = adminRole === 'MANAGER' || adminPermissions.includes('employees:reset_password')
  const canManagePermissions = adminRole === 'MANAGER' || adminPermissions.includes('permissions:manage')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/employees?search=${encodeURIComponent(search)}`, { cache: 'no-store' })
      const data = await res.json()
      setEmployees(data.employees || [])
    } finally {
      setLoading(false)
    }
  }, [search])

  useEffect(() => {
    const t = setTimeout(load, 250)
    return () => clearTimeout(t)
  }, [load])

  const toggleActive = async (emp: Employee) => {
    const res = await fetch(`/api/employees/${emp.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: !emp.isActive }),
    })
    if (res.ok) { toast.success(emp.isActive ? 'تم إيقاف الموظف' : 'تم تفعيل الموظف'); await load() }
    else { const d = await res.json(); toast.error(d.error || 'فشل تحديث الحالة') }
  }

  const resetDevice = async (emp: Employee) => {
    const res = await fetch(`/api/employees/${emp.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ resetDevice: true }),
    })
    if (res.ok) { toast.success('تم فك الارتباط بالجهاز'); await load() }
    else toast.error('فشل إعادة ضبط الجهاز')
  }

  const resetPassword = async (emp: Employee) => {
    const res = await fetch(`/api/employees/${emp.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ resetPassword: true }),
    })
    if (res.ok) { toast.success('تمت إعادة تعيين كلمة المرور. سيطلب من الموظف تعيين كلمة مرور جديدة في أول دخول.'); await load() }
    else toast.error('فشلت إعادة تعيين كلمة المرور')
  }

  const promote = async (emp: Employee) => {
    if (!confirm(`ترقية "${emp.name}" إلى مشرف؟`)) return
    const res = await fetch(`/api/employees/${emp.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'promote' }),
    })
    if (res.ok) { toast.success('تمت الترقية إلى مشرف'); await load() }
    else { const d = await res.json(); toast.error(d.error || 'فشلت الترقية') }
  }

  const demote = async (emp: Employee) => {
    if (!confirm(`تخفيض "${emp.name}" إلى موظف عادي؟`)) return
    const res = await fetch(`/api/employees/${emp.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'demote' }),
    })
    if (res.ok) { toast.success('تم التخفيض إلى موظف'); await load() }
    else { const d = await res.json(); toast.error(d.error || 'فشل التخفيض') }
  }

  const deleteEmp = async (emp: Employee) => {
    if (!confirm(`هل أنت متأكد من حذف الموظف "${emp.name}"؟ سيتم حذف جميع سجلاته.`)) return
    const res = await fetch(`/api/employees/${emp.id}`, { method: 'DELETE' })
    if (res.ok) { toast.success('تم حذف الموظف'); await load() }
    else { const d = await res.json(); toast.error(d.error || 'فشل حذف الموظف') }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div>
            <CardTitle className="text-base flex items-center gap-2"><Users className="w-4 h-4 text-primary" /> إدارة الموظفين</CardTitle>
            <CardDescription>إضافة، تعديل، ترقية، تخفيض، إيقاف، أو حذف</CardDescription>
          </div>
          {canCreate && <Button onClick={() => setAddOpen(true)} size="sm"><Plus className="w-4 h-4 ml-1" /> إضافة موظف</Button>}
        </div>
      </CardHeader>
      <CardContent>
        <div className="mb-3">
          <Input placeholder="بحث بالكود أو الاسم أو الهاتف..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        {loading ? (
          <div className="text-center py-8"><Loader2 className="w-6 h-6 animate-spin text-primary mx-auto" /></div>
        ) : (
          <ScrollArea className="max-h-[600px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-right">الكود</TableHead>
                  <TableHead className="text-right">الاسم</TableHead>
                  <TableHead className="text-right">الهاتف</TableHead>
                  <TableHead className="text-right">الدور</TableHead>
                  <TableHead className="text-right">الجهاز</TableHead>
                  <TableHead className="text-right">الحالة</TableHead>
                  <TableHead className="text-right">إجراءات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {employees.length === 0 && (
                  <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">لا يوجد موظفون مطابقون</TableCell></TableRow>
                )}
                {employees.map((emp) => (
                  <TableRow key={emp.id}>
                    <TableCell className="font-mono text-sm">{emp.code}</TableCell>
                    <TableCell className="font-medium">{emp.name}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{emp.phone || '—'}</TableCell>
                    <TableCell>{roleBadge(emp.role)}</TableCell>
                    <TableCell>
                      {emp.boundDeviceId ? (
                        <span className="text-xs text-emerald-600 flex items-center gap-1"><ShieldCheck className="w-3 h-3" /> مرتبط</span>
                      ) : (
                        <span className="text-xs text-muted-foreground">غير مرتبط</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {canSuspend ? (
                        <div className="flex items-center gap-2">
                          <Switch checked={emp.isActive} onCheckedChange={() => toggleActive(emp)} disabled={emp.id === adminId} />
                          <span className="text-xs">{emp.isActive ? 'نشط' : 'موقوف'}</span>
                        </div>
                      ) : (
                        <Badge variant={emp.isActive ? 'default' : 'destructive'}>{emp.isActive ? 'نشط' : 'موقوف'}</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 flex-wrap">
                        {canEdit && (
                          <Button variant="ghost" size="icon" title="تعديل" onClick={() => setEditEmp(emp)}><Edit3 className="w-4 h-4" /></Button>
                        )}
                        {canPromote && emp.role === 'EMPLOYEE' && (
                          <Button variant="ghost" size="icon" title="ترقية إلى مشرف" onClick={() => promote(emp)} className="text-emerald-600"><ArrowUp className="w-4 h-4" /></Button>
                        )}
                        {canDemote && emp.role === 'SUPERVISOR' && (
                          <Button variant="ghost" size="icon" title="تخفيض إلى موظف" onClick={() => demote(emp)} className="text-amber-600"><ArrowDown className="w-4 h-4" /></Button>
                        )}
                        {canManagePermissions && emp.role === 'SUPERVISOR' && (
                          <Button variant="ghost" size="icon" title="إدارة الصلاحيات" onClick={() => setPermissionsEmp(emp)}><KeyRound className="w-4 h-4" /></Button>
                        )}
                        {canResetDevice && (
                          <Button variant="ghost" size="icon" title="إعادة ضبط الجهاز" onClick={() => resetDevice(emp)}><Fingerprint className="w-4 h-4" /></Button>
                        )}
                        {canResetPassword && (
                          <Button variant="ghost" size="icon" title="إعادة تعيين كلمة المرور" onClick={() => resetPassword(emp)}><ShieldCheck className="w-4 h-4" /></Button>
                        )}
                        {canDelete && emp.id !== adminId && (
                          <Button variant="ghost" size="icon" title="حذف" onClick={() => deleteEmp(emp)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollArea>
        )}
      </CardContent>

      <AddEmployeeDialog open={addOpen} onOpenChange={setAddOpen} onSaved={load} adminRole={adminRole} />
      <EditEmployeeDialog employee={editEmp} onOpenChange={(o) => !o && setEditEmp(null)} onSaved={load} />
      <PermissionsDialog employee={permissionsEmp} onOpenChange={(o) => !o && setPermissionsEmp(null)} onSaved={load} />
    </Card>
  )
}

function AddEmployeeDialog({ open, onOpenChange, onSaved, adminRole }: {
  open: boolean; onOpenChange: (o: boolean) => void; onSaved: () => void; adminRole: Role
}) {
  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [role, setRole] = useState<'EMPLOYEE' | 'SUPERVISOR' | 'MANAGER'>('EMPLOYEE')
  const [loading, setLoading] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await fetch('/api/employees', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, name, phone, role }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error || 'فشل إضافة الموظف'); return }
      toast.success('تم إضافة الموظف بنجاح')
      setCode(''); setName(''); setPhone(''); setRole('EMPLOYEE')
      onOpenChange(false); onSaved()
    } finally { setLoading(false) }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>إضافة موظف جديد</DialogTitle>
          <DialogDescription>سيقوم الموظف بتعيين كلمة المرور وربط الجهاز عند أول تسجيل دخول</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div className="space-y-2"><Label>كود الموظف *</Label><Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="EMP001" required /></div>
          <div className="space-y-2"><Label>الاسم *</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="الاسم الكامل" required /></div>
          <div className="space-y-2"><Label>رقم الهاتف</Label><Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="01xxxxxxxxx" /></div>
          <div className="space-y-2">
            <Label>الدور</Label>
            <Select value={role} onValueChange={(v) => setRole(v as 'EMPLOYEE' | 'SUPERVISOR' | 'MANAGER')}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="EMPLOYEE">موظف</SelectItem>
                {adminRole === 'MANAGER' && <SelectItem value="SUPERVISOR">مشرف</SelectItem>}
                {adminRole === 'MANAGER' && <SelectItem value="MANAGER">مدير</SelectItem>}
              </SelectContent>
            </Select>
            {adminRole !== 'MANAGER' && role !== 'EMPLOYEE' && (
              <p className="text-xs text-amber-600">يمكن للمدير فقط إنشاء حسابات مشرفين/مدراء</p>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>إلغاء</Button>
            <Button type="submit" disabled={loading}>{loading && <Loader2 className="w-4 h-4 animate-spin ml-1" />} إضافة</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function EditEmployeeDialog({ employee, onOpenChange, onSaved }: {
  employee: Employee | null; onOpenChange: (o: boolean) => void; onSaved: () => void
}) {
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [role, setRole] = useState<'EMPLOYEE' | 'SUPERVISOR' | 'MANAGER'>('EMPLOYEE')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (employee) {
      setName(employee.name); setPhone(employee.phone || ''); setRole(employee.role)
    }
  }, [employee])

  if (!employee) return null

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await fetch(`/api/employees/${employee.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, phone, role }),
      })
      if (!res.ok) { toast.error('فشل تحديث البيانات'); return }
      toast.success('تم تحديث البيانات'); onOpenChange(false); onSaved()
    } finally { setLoading(false) }
  }

  return (
    <Dialog open={!!employee} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>تعديل بيانات الموظف</DialogTitle>
          <DialogDescription>{employee.code} — {employee.name}</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div className="space-y-2"><Label>الاسم</Label><Input value={name} onChange={(e) => setName(e.target.value)} required /></div>
          <div className="space-y-2"><Label>رقم الهاتف</Label><Input value={phone} onChange={(e) => setPhone(e.target.value)} /></div>
          <div className="space-y-2">
            <Label>الدور</Label>
            <Select value={role} onValueChange={(v) => setRole(v as 'EMPLOYEE' | 'SUPERVISOR' | 'MANAGER')}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="EMPLOYEE">موظف</SelectItem>
                <SelectItem value="SUPERVISOR">مشرف</SelectItem>
                <SelectItem value="MANAGER">مدير</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>إلغاء</Button>
            <Button type="submit" disabled={loading}>{loading && <Loader2 className="w-4 h-4 animate-spin ml-1" />} حفظ</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function PermissionsDialog({ employee, onOpenChange, onSaved }: {
  employee: Employee | null; onOpenChange: (o: boolean) => void; onSaved: () => void
}) {
  const [permissions, setPermissions] = useState<string[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (employee) setPermissions(employee.permissions)
  }, [employee])

  if (!employee) return null

  const toggle = (p: Permission) => {
    setPermissions((prev) => prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p])
  }

  const save = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/employees/${employee.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ permissions }),
      })
      if (!res.ok) { toast.error('فشل تحديث الصلاحيات'); return }
      toast.success('تم تحديث الصلاحيات'); onOpenChange(false); onSaved()
    } finally { setLoading(false) }
  }

  return (
    <Dialog open={!!employee} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRound className="w-5 h-5 text-primary" />
            إدارة صلاحيات: {employee.name}
          </DialogTitle>
          <DialogDescription>
            {employee.role === 'SUPERVISOR' ? 'مشرف — اختر الصلاحيات التي تريد منحها له' : 'لا يمكن تعديل صلاحيات المدير'}
          </DialogDescription>
        </DialogHeader>
        {employee.role === 'SUPERVISOR' ? (
          <div className="space-y-3 max-h-[60vh] overflow-y-auto">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {ALL_PERMISSIONS.map((p) => (
                <label key={p} className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${permissions.includes(p) ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/50'}`}>
                  <Switch checked={permissions.includes(p)} onCheckedChange={() => toggle(p)} />
                  <span className="text-sm flex-1">{PERMISSION_LABELS[p]}</span>
                  <code className="text-[10px] text-muted-foreground">{p}</code>
                </label>
              ))}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>إلغاء</Button>
              <Button onClick={save} disabled={loading}>{loading && <Loader2 className="w-4 h-4 animate-spin ml-1" />} حفظ الصلاحيات</Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="text-center py-6 text-muted-foreground">
            {employee.role === 'MANAGER' ? 'المدير لديه جميع الصلاحيات تلقائياً.' : 'لا توجد صلاحيات قابلة للتعديل للموظف العادي.'}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

/* -------- Admin Calendar Tab -------- */
function AdminCalendar() {
  const [employees, setEmployees] = useState<Employee[]>([])
  const [selectedEmp, setSelectedEmp] = useState<Employee | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/employees', { cache: 'no-store' })
      .then((r) => r.json())
      .then((data) => {
        setEmployees(data.employees || [])
        if (data.employees?.length > 0) setSelectedEmp(data.employees[0])
      })
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>

  if (employees.length === 0) {
    return <Card><CardContent className="py-12 text-center text-muted-foreground">لا يوجد موظفون بعد. أضف موظفاً من تبويب "الموظفين" أولاً.</CardContent></Card>
  }

  return (
    <div className="space-y-3">
      <Card>
        <CardContent className="p-3">
          <div className="flex items-center gap-3 flex-wrap">
            <Label className="text-sm">عرض سجل:</Label>
            <Select value={selectedEmp?.id || ''} onValueChange={(v) => setSelectedEmp(employees.find((e) => e.id === v) || null)}>
              <SelectTrigger className="min-w-[240px]"><SelectValue placeholder="اختر موظفاً" /></SelectTrigger>
              <SelectContent>{employees.map((e) => <SelectItem key={e.id} value={e.id}>{e.code} — {e.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>
      {selectedEmp && <EmployeeCalendar key={selectedEmp.id} employeeId={selectedEmp.id} employeeRole={selectedEmp.role} />}
    </div>
  )
}

/* -------- Admin Audit Log Tab -------- */
function AdminAuditLog() {
  const [logs, setLogs] = useState<AuditLogEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [actionFilter, setActionFilter] = useState('ALL')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const url = `/api/audit-log?limit=100${actionFilter && actionFilter !== 'ALL' ? `&action=${actionFilter}` : ''}`
      const res = await fetch(url, { cache: 'no-store' })
      const data = await res.json()
      setLogs(data.logs || [])
    } finally {
      setLoading(false)
    }
  }, [actionFilter])

  useEffect(() => { load() }, [load])

  const actionLabels: Record<string, string> = {
    CHECK_IN: 'تسجيل حضور', CHECK_OUT: 'تسجيل انصراف',
    EMPLOYEE_CREATE: 'إضافة موظف', EMPLOYEE_UPDATE: 'تعديل موظف', EMPLOYEE_DELETE: 'حذف موظف',
    PROMOTE: 'ترقية', DEMOTE: 'تخفيض',
    PERMISSIONS_UPDATE: 'تحديث صلاحيات',
    DEVICE_RESET: 'إعادة ضبط جهاز', PASSWORD_RESET: 'إعادة تعيين كلمة مرور',
    SUSPEND: 'إيقاف', ACTIVATE: 'تفعيل',
    SCHEDULE_UPDATE: 'تحديث مواعيد',
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div>
            <CardTitle className="text-base flex items-center gap-2"><History className="w-4 h-4 text-primary" /> سجل العمليات</CardTitle>
            <CardDescription>آخر 100 عملية تم تنفيذها في النظام</CardDescription>
          </div>
          <Select value={actionFilter} onValueChange={setActionFilter}>
            <SelectTrigger className="w-[200px]"><SelectValue placeholder="كل العمليات" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">كل العمليات</SelectItem>
              {Object.entries(actionLabels).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="text-center py-8"><Loader2 className="w-6 h-6 animate-spin text-primary mx-auto" /></div>
        ) : logs.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">لا توجد سجلات</div>
        ) : (
          <ScrollArea className="max-h-[600px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-right">الوقت</TableHead>
                  <TableHead className="text-right">المنفذ</TableHead>
                  <TableHead className="text-right">العملية</TableHead>
                  <TableHead className="text-right">التفاصيل</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="text-xs text-muted-foreground">{fmtDateTime(log.timestamp)}</TableCell>
                    <TableCell className="text-sm font-mono">{log.actorCode || '—'}</TableCell>
                    <TableCell><Badge variant="outline">{actionLabels[log.action] || log.action}</Badge></TableCell>
                    <TableCell className="text-xs">{log.details || '—'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  )
}

/* -------- Admin Settings Tab -------- */
function AdminSettings() {
  const [schedule, setSchedule] = useState<Schedule | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [checkInTime, setCheckInTime] = useState('09:00')
  const [checkOutTime, setCheckOutTime] = useState('17:00')
  const [lateThreshold, setLateThreshold] = useState(15)
  const [earlyLeave, setEarlyLeave] = useState(15)
  const [workDays, setWorkDays] = useState<number[]>([0, 1, 2, 3, 4])

  useEffect(() => {
    fetch('/api/attendance/today', { cache: 'no-store' })
      .then((r) => r.json())
      .then((data) => {
        if (data.schedule) {
          setSchedule(data.schedule)
          setCheckInTime(data.schedule.checkInTime)
          setCheckOutTime(data.schedule.checkOutTime)
          setLateThreshold(data.schedule.lateThresholdMinutes)
          setEarlyLeave(data.schedule.earlyLeaveThresholdMinutes)
          setWorkDays(data.schedule.workDays.map((d: string) => parseInt(d.trim(), 10)))
        }
      })
      .finally(() => setLoading(false))
  }, [])

  const save = async () => {
    setSaving(true)
    try {
      const res = await fetch('/api/schedule', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: schedule?.id,
          checkInTime, checkOutTime,
          lateThresholdMinutes: lateThreshold,
          earlyLeaveThresholdMinutes: earlyLeave,
          workDays: workDays.map(String),
        }),
      })
      if (res.ok) {
        const data = await res.json()
        setSchedule(data.schedule)
        toast.success('تم حفظ إعدادات المواعيد')
      } else toast.error('فشل حفظ الإعدادات')
    } finally { setSaving(false) }
  }

  if (loading) return <div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>

  return (
    <Card className="max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2"><Settings className="w-4 h-4 text-primary" /> إعدادات مواعيد العمل</CardTitle>
        <CardDescription>تحكم في مواعيد الحضور والانصراف وأيام العمل. تطبق على جميع الموظفين.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2"><Label>موعد الحضور</Label><Input type="time" value={checkInTime} onChange={(e) => setCheckInTime(e.target.value)} /></div>
          <div className="space-y-2"><Label>موعد الانصراف</Label><Input type="time" value={checkOutTime} onChange={(e) => setCheckOutTime(e.target.value)} /></div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2"><Label>حد التأخير (دقائق)</Label><Input type="number" min={0} value={lateThreshold} onChange={(e) => setLateThreshold(parseInt(e.target.value, 10) || 0)} /><p className="text-xs text-muted-foreground">بعد هذا الوقت يُعتبر الموظف متأخراً</p></div>
          <div className="space-y-2"><Label>حد الانصراف المبكر (دقائق)</Label><Input type="number" min={0} value={earlyLeave} onChange={(e) => setEarlyLeave(parseInt(e.target.value, 10) || 0)} /><p className="text-xs text-muted-foreground">قبل هذا الوقت يُعتبر الانصراف مبكراً</p></div>
        </div>
        <div className="space-y-2">
          <Label>أيام العمل</Label>
          <div className="flex flex-wrap gap-2">
            {AR_DAYS.map((label, idx) => {
              const active = workDays.includes(idx)
              return (
                <button key={idx} type="button" onClick={() => setWorkDays((prev) => active ? prev.filter((d) => d !== idx) : [...prev, idx])}
                  className={`px-3 py-2 rounded-lg text-sm border transition-colors ${active ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:bg-muted/50'}`}>
                  {label}
                </button>
              )
            })}
          </div>
        </div>
        <Separator />
        <Button onClick={save} disabled={saving} className="w-full">{saving && <Loader2 className="w-4 h-4 animate-spin ml-1" />} حفظ الإعدادات</Button>
      </CardContent>
    </Card>
  )
}
