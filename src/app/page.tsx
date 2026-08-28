'use client'

import { useEffect, useState, useCallback } from 'react'
import { toast } from 'sonner'
import { motion, AnimatePresence } from 'framer-motion'
import { Fingerprint, LogOut, MapPin, Clock, Calendar, Users, Settings, LayoutDashboard, LogIn, Moon, Sun, Loader2, ShieldCheck, ShieldOff, Phone, ChevronLeft, ChevronRight, Edit3, Trash2, Plus, X, CheckCircle2, AlertTriangle, Navigation, UserCog } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Calendar as CalendarComponent } from '@/components/ui/calendar'
import { ar as arLocale } from 'date-fns/locale'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Separator } from '@/components/ui/separator'
import { generateDeviceId, getCurrentPosition } from '@/lib/client'

/* ============================ Types ============================ */
type Employee = {
  id: string
  code: string
  name: string
  phone?: string | null
  role: 'ADMIN' | 'EMPLOYEE'
  isActive: boolean
  deviceId?: string | null
}

type Schedule = {
  id: string
  name: string
  checkInTime: string
  checkOutTime: string
  lateThresholdMinutes: number
  earlyLeaveThresholdMinutes: number
  workDays: string
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
  role: string
  isActive: boolean
  deviceId?: string | null
  lastLat: number | null
  lastLng: number | null
  lastPingAt: string | null
  today: TodayAttendance | null
}

/* ============================ Helpers ============================ */
const AR_DAYS = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت']

function fmtTime(d: string | null) {
  if (!d) return '—'
  try {
    return new Date(d).toLocaleTimeString('ar-EG', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    })
  } catch {
    return '—'
  }
}

function fmtDate(d: string | Date) {
  try {
    return new Date(d).toLocaleDateString('ar-EG', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
  } catch {
    return ''
  }
}

function fmtDateTime(d: string | null) {
  if (!d) return '—'
  try {
    return new Date(d).toLocaleString('ar-EG', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    })
  } catch {
    return '—'
  }
}

function statusBadge(status: string) {
  const map: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
    PENDING: { label: 'بانتظار التسجيل', variant: 'outline' },
    PRESENT: { label: 'حاضر', variant: 'default' },
    LATE: { label: 'متأخر', variant: 'destructive' },
    CHECKED_OUT: { label: 'تم الانصراف', variant: 'secondary' },
    EARLY_LEAVE: { label: 'انصراف مبكر', variant: 'destructive' },
    LATE_CHECKED_OUT: { label: 'متأخر + منصرف', variant: 'destructive' },
    ABSENT: { label: 'غائب', variant: 'destructive' },
  }
  const cfg = map[status] || { label: status, variant: 'outline' as const }
  return <Badge variant={cfg.variant}>{cfg.label}</Badge>
}

/* ============================ Main Page ============================ */
export default function Home() {
  const [user, setUser] = useState<Employee | null>(null)
  const [loading, setLoading] = useState(true)
  const [isDark, setIsDark] = useState<boolean>(false)

  // Apply theme on mount only (read once from localStorage / prefers-color-scheme)
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
    fetch('/api/auth', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data && !data.error) setUser(data)
        setLoading(false)
      })
      .catch(() => setLoading(false))
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
      {/* Top bar */}
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
                  <span className="text-xs text-muted-foreground">{user.code}</span>
                </div>
                <Avatar className="w-9 h-9">
                  <AvatarFallback className="bg-primary/10 text-primary text-sm">
                    {user.name.split(' ').slice(0, 2).map((w) => w[0]).join('')}
                  </AvatarFallback>
                </Avatar>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={async () => {
                    await fetch('/api/auth', { method: 'DELETE' })
                    setUser(null)
                  }}
                  aria-label="تسجيل الخروج"
                  title="تسجيل الخروج"
                >
                  <LogOut className="w-4 h-4" />
                </Button>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1 container mx-auto px-4 py-6">
        <AnimatePresence mode="wait">
          {!user ? (
            <motion.div
              key="login"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25 }}
            >
              <LoginScreen onLogin={setUser} />
            </motion.div>
          ) : user.role === 'ADMIN' ? (
            <motion.div
              key="admin"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25 }}
            >
              <AdminDashboard user={user} />
            </motion.div>
          ) : (
            <motion.div
              key="employee"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25 }}
            >
              <EmployeeDashboard user={user} />
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <footer className="border-t border-border bg-background/60 backdrop-blur-sm mt-auto">
        <div className="container mx-auto px-4 py-4 text-center text-xs text-muted-foreground">
          نظام الحضور والانصراف &copy; {new Date().getFullYear()} — يعمل عبر تحديد الموقع الجغرافي
        </div>
      </footer>
    </div>
  )
}

/* ============================ Login Screen ============================ */
function LoginScreen({ onLogin }: { onLogin: (u: Employee) => void }) {
  const [code, setCode] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [setupLoading, setSetupLoading] = useState(false)
  const [setupDone, setSetupDone] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const deviceId = generateDeviceId()
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, password, deviceId }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'فشل تسجيل الدخول')
        return
      }
      onLogin({
        id: data.employee.id,
        code: data.employee.code,
        name: data.employee.name,
        role: data.employee.role,
        isActive: true,
      })
      if (data.firstLogin) {
        toast.success('تم ربط الحساب بالجهاز وتعيين كلمة المرور بنجاح')
      }
    } catch {
      setError('تعذر الاتصال بالخادم')
    } finally {
      setLoading(false)
    }
  }

  const setup = async () => {
    setSetupLoading(true)
    try {
      const res = await fetch('/api/setup', { method: 'POST' })
      const data = await res.json()
      if (res.ok) {
        setSetupDone(true)
        toast.success('تم إنشاء حساب المدير الافتراضي', {
          description: 'الكود: ADMIN001 — كلمة المرور: admin123',
          duration: 8000,
        })
        setCode('ADMIN001')
        setPassword('admin123')
      } else {
        toast.error(data.error || 'النظام مهيأ مسبقاً')
      }
    } finally {
      setSetupLoading(false)
    }
  }

  return (
    <div className="max-w-md mx-auto pt-6">
      <Card className="shadow-xl border-border/60">
        <CardHeader className="text-center space-y-3 pb-6">
          <div className="mx-auto w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
            <Fingerprint className="w-8 h-8 text-primary" />
          </div>
          <div>
            <CardTitle className="text-2xl">تسجيل الدخول</CardTitle>
            <CardDescription className="mt-1">
              أدخل كود الموظف وكلمة المرور للمتابعة
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="code">كود الموظف</Label>
              <div className="relative">
                <UserCog className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="code"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="مثال: EMP001"
                  className="pr-9"
                  required
                  autoComplete="username"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">كلمة المرور</Label>
              <div className="relative">
                <ShieldCheck className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••"
                  className="pr-9"
                  required
                  autoComplete="current-password"
                />
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div className="rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground flex items-start gap-2">
              <ShieldCheck className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>
                في أول تسجيل دخول سيتم ربط حسابك بهذا الجهاز تلقائياً. إذا حاولت الدخول من جهاز آخر سيتم رفض الدخول حتى يقوم المدير بإعادة ضبط الجهاز.
              </span>
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? <Loader2 className="w-4 h-4 animate-spin ml-2" /> : <LogIn className="w-4 h-4 ml-2" />}
              دخول
            </Button>
          </form>
        </CardContent>
        <CardFooter className="flex flex-col gap-2 items-stretch">
          <div className="text-xs text-center text-muted-foreground">
            لأول مرة تستخدم النظام؟ قم بتهيئة حساب المدير الافتراضي:
          </div>
          <Button variant="outline" size="sm" onClick={setup} disabled={setupLoading || setupDone}>
            {setupLoading ? <Loader2 className="w-4 h-4 animate-spin ml-2" /> : <Plus className="w-4 h-4 ml-2" />}
            {setupDone ? 'تمت التهيئة' : 'تهيئة حساب المدير الافتراضي'}
          </Button>
        </CardFooter>
      </Card>
    </div>
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

  useEffect(() => {
    loadToday()
  }, [loadToday])

  // Periodic location updates (every 60 seconds) while logged in
  useEffect(() => {
    if (!user.isActive) return
    const timer = setInterval(async () => {
      try {
        const pos = await getCurrentPosition()
        await fetch('/api/location', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(pos),
        })
      } catch {
        // silent fail
      }
    }, 60_000)
    return () => clearInterval(timer)
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
      if (!res.ok) {
        toast.error(data.error || 'فشل تسجيل الحضور')
        return
      }
      toast.success('تم تسجيل الحضور بنجاح', {
        description: `الوقت: ${fmtTime(data.attendance.checkInTime)}`,
      })
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
      if (!res.ok) {
        toast.error(data.error || 'فشل تسجيل الانصراف')
        return
      }
      toast.success('تم تسجيل الانصراف بنجاح', {
        description: `الوقت: ${fmtTime(data.attendance.checkOutTime)}`,
      })
      await loadToday()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'تعذر الحصول على الموقع')
    } finally {
      setActionLoading(null)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!user.isActive) {
    return (
      <Card className="max-w-lg mx-auto border-destructive/30">
        <CardHeader>
          <CardTitle className="text-destructive flex items-center gap-2">
            <ShieldOff className="w-5 h-5" /> الحساب موقوف
          </CardTitle>
          <CardDescription>تم إيقاف حسابك من قبل الإدارة. يرجى التواصل مع المسؤول.</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  return (
    <Tabs value={tab} onValueChange={setTab} className="max-w-4xl mx-auto">
      <TabsList className="grid grid-cols-2 w-full">
        <TabsTrigger value="today" className="gap-2">
          <Clock className="w-4 h-4" /> اليوم
        </TabsTrigger>
        <TabsTrigger value="calendar" className="gap-2">
          <Calendar className="w-4 h-4" /> التقويم
        </TabsTrigger>
      </TabsList>

      <TabsContent value="today" className="space-y-4 mt-4">
        {/* Schedule info */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Clock className="w-4 h-4 text-primary" /> مواعيد العمل اليوم
            </CardTitle>
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

        {/* Action buttons */}
        <Card>
          <CardContent className="p-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Button
                size="lg"
                onClick={doCheckIn}
                disabled={!!actionLoading || !!todayRecord?.checkInTime}
                className="h-20 text-base gap-2"
              >
                {actionLoading === 'in' ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <LogIn className="w-5 h-5" />
                )}
                تسجيل الحضور
              </Button>
              <Button
                size="lg"
                variant="secondary"
                onClick={doCheckOut}
                disabled={!!actionLoading || !todayRecord?.checkInTime || !!todayRecord?.checkOutTime}
                className="h-20 text-base gap-2"
              >
                {actionLoading === 'out' ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <LogOut className="w-5 h-5" />
                )}
                تسجيل الانصراف
              </Button>
            </div>
            {!todayRecord?.checkInTime && (
              <p className="text-xs text-muted-foreground mt-3 text-center">
                لم تقم بتسجيل الحضور بعد اليوم
              </p>
            )}
            {todayRecord?.checkInTime && !todayRecord?.checkOutTime && (
              <p className="text-xs text-muted-foreground mt-3 text-center">
                تم تسجيل الحضور. لا تنسَ تسجيل الانصراف قبل المغادرة.
              </p>
            )}
            {todayRecord?.checkInTime && todayRecord?.checkOutTime && (
              <p className="text-xs text-center text-primary mt-3">
                تم تسجيل الحضور والانصراف اليوم بنجاح
              </p>
            )}
          </CardContent>
        </Card>

        {/* Today's record */}
        {todayRecord && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-primary" /> سجل اليوم
                </span>
                {statusBadge(todayRecord.status)}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <RecordBlock
                  title="وقت الحضور"
                  time={fmtTime(todayRecord.checkInTime)}
                  address={todayRecord.checkInAddress || undefined}
                  lat={todayRecord.checkInLat}
                  lng={todayRecord.checkInLng}
                />
                <RecordBlock
                  title="وقت الانصراف"
                  time={fmtTime(todayRecord.checkOutTime)}
                  address={todayRecord.checkOutAddress || undefined}
                  lat={todayRecord.checkOutLat}
                  lng={todayRecord.checkOutLng}
                />
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

function RecordBlock({
  title,
  time,
  address,
  lat,
  lng,
}: {
  title: string
  time: string
  address?: string
  lat?: number | null
  lng?: number | null
}) {
  const mapsUrl =
    lat != null && lng != null
      ? `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=16/${lat}/${lng}`
      : null
  return (
    <div className="rounded-lg border border-border bg-muted/30 p-3">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-muted-foreground">{title}</span>
        <Clock className="w-3.5 h-3.5 text-muted-foreground" />
      </div>
      <div className="text-2xl font-bold mb-1">{time}</div>
      {address && (
        <div className="text-xs text-muted-foreground line-clamp-2">{address}</div>
      )}
      {mapsUrl && (
        <a
          href={mapsUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 text-xs text-primary mt-2 hover:underline"
        >
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

  useEffect(() => {
    load()
  }, [load])

  const recordByDay = new Map<string, typeof records[number]>()
  for (const r of records) recordByDay.set(r.dateKey, r)

  const selectedKey = selectedDay ? selectedDay.toISOString().slice(0, 10) : null
  const selectedRecord = selectedKey ? recordByDay.get(selectedKey) : undefined

  // Compute summary
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
              <CardTitle className="text-base flex items-center gap-2">
                <Calendar className="w-4 h-4 text-primary" /> التقويم الشهري
              </CardTitle>
              <CardDescription>
                {month.toLocaleDateString('ar-EG', { month: 'long', year: 'numeric' })}
              </CardDescription>
            </div>
            <div className="flex items-center gap-1">
              <Button variant="outline" size="icon" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}>
                <ChevronRight className="w-4 h-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={() => setMonth(new Date())}>
                اليوم
              </Button>
              <Button variant="outline" size="icon" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}>
                <ChevronLeft className="w-4 h-4" />
              </Button>
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
              present: (date) => {
                const k = date.toISOString().slice(0, 10)
                const r = recordByDay.get(k)
                return !!r?.checkInTime && !r.status.includes('LATE')
              },
              late: (date) => {
                const k = date.toISOString().slice(0, 10)
                const r = recordByDay.get(k)
                return !!r?.status.includes('LATE')
              },
              offDay: (date) => {
                const k = date.toISOString().slice(0, 10)
                const r = recordByDay.get(k)
                return !!r?.status.includes('OFF_DAY')
              },
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
        {/* Summary */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">ملخص الشهر</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-3 text-center">
            <div className="rounded-lg bg-primary/10 p-3">
              <div className="text-2xl font-bold text-primary">{summary.present}</div>
              <div className="text-xs text-muted-foreground">أيام حضور</div>
            </div>
            <div className="rounded-lg bg-destructive/10 p-3">
              <div className="text-2xl font-bold text-destructive">{summary.late}</div>
              <div className="text-xs text-muted-foreground">أيام تأخير</div>
            </div>
            <div className="rounded-lg bg-muted p-3">
              <div className="text-2xl font-bold">{summary.completed}</div>
              <div className="text-xs text-muted-foreground">اكتمل الحضور والانصراف</div>
            </div>
            <div className="rounded-lg bg-muted p-3">
              <div className="text-2xl font-bold">{records.length}</div>
              <div className="text-xs text-muted-foreground">إجمالي السجلات</div>
            </div>
          </CardContent>
        </Card>

        {/* Selected day details */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">تفاصيل اليوم المحدد</CardTitle>
            <CardDescription>{selectedDay ? fmtDate(selectedDay) : 'اختر يوماً'}</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground mx-auto" />
            ) : selectedRecord ? (
              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">الحالة</span>
                  {statusBadge(selectedRecord.status)}
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">الحضور</span>
                  <span className="font-medium">{fmtTime(selectedRecord.checkInTime)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">الانصراف</span>
                  <span className="font-medium">{fmtTime(selectedRecord.checkOutTime)}</span>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">لا يوجد سجل لهذا اليوم</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

/* ============================ Admin Dashboard ============================ */
function AdminDashboard({ user }: { user: Employee }) {
  const [tab, setTab] = useState('overview')
  return (
    <Tabs value={tab} onValueChange={setTab} className="w-full">
      <TabsList className="grid grid-cols-2 sm:grid-cols-4 w-full mb-4 h-auto">
        <TabsTrigger value="overview" className="gap-2 py-2">
          <LayoutDashboard className="w-4 h-4" /> <span className="hidden sm:inline">نظرة عامة</span>
          <span className="sm:hidden">عامة</span>
        </TabsTrigger>
        <TabsTrigger value="employees" className="gap-2 py-2">
          <Users className="w-4 h-4" /> <span className="hidden sm:inline">الموظفين</span>
          <span className="sm:hidden">الموظفين</span>
        </TabsTrigger>
        <TabsTrigger value="calendar" className="gap-2 py-2">
          <Calendar className="w-4 h-4" /> <span className="hidden sm:inline">التقويم</span>
          <span className="sm:hidden">التقويم</span>
        </TabsTrigger>
        <TabsTrigger value="settings" className="gap-2 py-2">
          <Settings className="w-4 h-4" /> <span className="hidden sm:inline">الإعدادات</span>
          <span className="sm:hidden">إعدادات</span>
        </TabsTrigger>
      </TabsList>

      <TabsContent value="overview" className="space-y-4">
        <AdminOverview />
      </TabsContent>
      <TabsContent value="employees">
        <AdminEmployees adminId={user.id} />
      </TabsContent>
      <TabsContent value="calendar">
        <AdminCalendar />
      </TabsContent>
      <TabsContent value="settings">
        <AdminSettings />
      </TabsContent>
    </Tabs>
  )
}

/* -------- Admin Overview -------- */
function AdminOverview() {
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<{
    employees: DashboardEmployee[]
    summary: {
      totalEmployees: number
      activeEmployees: number
      presentToday: number
      lateToday: number
      checkedOutToday: number
      absentToday: number
    }
  } | null>(null)
  const [selectedEmp, setSelectedEmp] = useState<DashboardEmployee | null>(null)

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
    const t = setInterval(load, 30_000)
    return () => clearInterval(t)
  }, [load])

  if (loading || !data) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatCard icon={<Users className="w-4 h-4" />} label="إجمالي الموظفين" value={data.summary.totalEmployees} color="text-primary bg-primary/10" />
        <StatCard icon={<ShieldCheck className="w-4 h-4" />} label="موظفين نشطين" value={data.summary.activeEmployees} color="text-emerald-600 bg-emerald-50" />
        <StatCard icon={<CheckCircle2 className="w-4 h-4" />} label="حاضرون اليوم" value={data.summary.presentToday} color="text-emerald-600 bg-emerald-50" />
        <StatCard icon={<Clock className="w-4 h-4" />} label="متأخرون اليوم" value={data.summary.lateToday} color="text-amber-600 bg-amber-50" />
        <StatCard icon={<LogOut className="w-4 h-4" />} label="منصرفون اليوم" value={data.summary.checkedOutToday} color="text-blue-600 bg-blue-50" />
        <StatCard icon={<ShieldOff className="w-4 h-4" />} label="غائبون اليوم" value={data.summary.absentToday} color="text-destructive bg-destructive/10" />
      </div>

      {/* Map of all employees */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Navigation className="w-4 h-4 text-primary" /> مواقع الموظفين الحالية
          </CardTitle>
          <CardDescription>آخر تحديث للموقع لكل موظف مع موقع تسجيل الحضور اليوم</CardDescription>
        </CardHeader>
        <CardContent>
          <EmployeeMap employees={data.employees} onSelect={setSelectedEmp} selectedId={selectedEmp?.id} />
        </CardContent>
      </Card>

      {/* Employee table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="w-4 h-4 text-primary" /> سجل اليوم
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="max-h-[480px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-right">الموظف</TableHead>
                  <TableHead className="text-right">الحالة</TableHead>
                  <TableHead className="text-right">الحضور</TableHead>
                  <TableHead className="text-right">الانصراف</TableHead>
                  <TableHead className="text-right">آخر موقع</TableHead>
                  <TableHead className="text-right"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.employees.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                      لا يوجد موظفون مسجلون بعد
                    </TableCell>
                  </TableRow>
                )}
                {data.employees.map((emp) => (
                  <TableRow key={emp.id} className={emp.id === selectedEmp?.id ? 'bg-muted/40' : ''}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Avatar className="w-8 h-8">
                          <AvatarFallback className="text-xs bg-primary/10 text-primary">
                            {emp.name.split(' ').slice(0, 2).map((w) => w[0]).join('')}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="font-medium text-sm flex items-center gap-1">
                            {emp.name}
                            {!emp.isActive && <ShieldOff className="w-3 h-3 text-destructive" />}
                          </div>
                          <div className="text-xs text-muted-foreground">{emp.code}</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {emp.today ? statusBadge(emp.today.status) : <Badge variant="outline">لم يسجّل</Badge>}
                    </TableCell>
                    <TableCell className="text-sm">{fmtTime(emp.today?.checkInTime || null)}</TableCell>
                    <TableCell className="text-sm">{fmtTime(emp.today?.checkOutTime || null)}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {emp.lastPingAt ? fmtDateTime(emp.lastPingAt) : '—'}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelectedEmp(emp)}
                      >
                        <MapPin className="w-4 h-4" /> موقع
                      </Button>
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
                    <AvatarFallback className="text-xs bg-primary/10 text-primary">
                      {selectedEmp.name.split(' ').slice(0, 2).map((w) => w[0]).join('')}
                    </AvatarFallback>
                  </Avatar>
                  {selectedEmp.name}
                  <span className="text-xs text-muted-foreground">({selectedEmp.code})</span>
                </DialogTitle>
                <DialogDescription>تفاصيل الموقع الحالي وسجل اليوم</DialogDescription>
              </DialogHeader>
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <div className="text-xs text-muted-foreground mb-1">وقت الحضور</div>
                    <div className="font-medium">{fmtTime(selectedEmp.today?.checkInTime || null)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground mb-1">وقت الانصراف</div>
                    <div className="font-medium">{fmtTime(selectedEmp.today?.checkOutTime || null)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground mb-1">الحالة</div>
                    <div>{selectedEmp.today ? statusBadge(selectedEmp.today.status) : '—'}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground mb-1">آخر ظهور</div>
                    <div className="font-medium text-xs">{fmtDateTime(selectedEmp.lastPingAt)}</div>
                  </div>
                </div>
                {selectedEmp.today?.checkInAddress && (
                  <div className="rounded-lg bg-muted/50 p-3">
                    <div className="text-xs text-muted-foreground mb-1">عنوان الحضور</div>
                    <div className="text-xs">{selectedEmp.today.checkInAddress}</div>
                  </div>
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

/* -------- Employee Map (OpenStreetMap iframe) -------- */
function EmployeeMap({
  employees,
  selectedId,
  onSelect,
}: {
  employees: DashboardEmployee[]
  selectedId?: string
  onSelect?: (e: DashboardEmployee) => void
}) {
  // Build markers for all employees that have a lastLat/lng OR a check-in location
  const markers = employees
    .map((e) => {
      const lat = e.lastLat ?? e.today?.checkInLat ?? null
      const lng = e.lastLng ?? e.today?.checkInLng ?? null
      if (lat == null || lng == null) return null
      return { e, lat, lng }
    })
    .filter(Boolean) as Array<{ e: DashboardEmployee; lat: number; lng: number }>

  if (markers.length === 0) {
    return (
      <div className="text-center py-10 text-sm text-muted-foreground">
        لا توجد مواقع مسجلة للموظفين بعد
      </div>
    )
  }

  // Calculate bounding box
  const lats = markers.map((m) => m.lat)
  const lngs = markers.map((m) => m.lng)
  const minLat = Math.min(...lats)
  const maxLat = Math.max(...lats)
  const minLng = Math.min(...lngs)
  const maxLng = Math.max(...lngs)
  const centerLat = (minLat + maxLat) / 2
  const centerLng = (minLng + maxLng) / 2
  // Calculate zoom level by extent
  const latSpan = maxLat - minLat
  const lngSpan = maxLng - minLng
  const span = Math.max(latSpan, lngSpan, 0.01)
  const zoom = span > 1 ? 8 : span > 0.5 ? 9 : span > 0.1 ? 11 : span > 0.05 ? 12 : span > 0.02 ? 13 : 14

  const bbox = `${minLng - 0.005},${minLat - 0.005},${maxLng + 0.005},${maxLat + 0.005}`
  const markerParam = markers
    .map((m) => `${m.lat},${m.lng}`)
    .join(';')
  // Use a single marker dot via OSM static embed - we'll use an iframe with bbox + marker via "mlat" hash

  // Simpler approach: use OSM embed with markers via query string
  const embedUrl = `https://www.openstreetmap.org/export/embed.html?bbox=${encodeURIComponent(bbox)}&layer=mapnik&marker=${centerLat},${centerLng}`

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="md:col-span-2 relative rounded-lg overflow-hidden border border-border">
          <iframe
            title="map"
            src={embedUrl}
            className="w-full h-72 md:h-80"
            style={{ border: 0 }}
            loading="lazy"
          />
        </div>
        <div className="space-y-2 max-h-80 overflow-y-auto">
          {markers.map((m) => (
            <button
              key={m.e.id}
              onClick={() => onSelect?.(m.e)}
              className={`w-full text-right p-2 rounded-lg border text-sm transition-colors ${
                m.e.id === selectedId ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/50'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-medium">{m.e.name}</span>
                <MapPin className="w-3.5 h-3.5 text-primary" />
              </div>
              <div className="text-xs text-muted-foreground">
                {m.e.lastPingAt ? `آخر ظهور: ${fmtDateTime(m.e.lastPingAt)}` : 'غير معروف'}
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                {m.lat.toFixed(5)}, {m.lng.toFixed(5)}
              </div>
            </button>
          ))}
        </div>
      </div>
      {/* Hidden helper - keeping markerParam to satisfy TS for future enhancement */}
      <span className="hidden">{markerParam}</span>
    </div>
  )
}

/* -------- Admin Employees Tab -------- */
function AdminEmployees({ adminId }: { adminId: string }) {
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [addOpen, setAddOpen] = useState(false)
  const [editEmp, setEditEmp] = useState<Employee | null>(null)

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
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: !emp.isActive }),
    })
    if (res.ok) {
      toast.success(emp.isActive ? 'تم إيقاف الموظف' : 'تم تفعيل الموظف')
      await load()
    } else {
      toast.error('فشل تحديث الحالة')
    }
  }

  const resetDevice = async (emp: Employee) => {
    const res = await fetch(`/api/employees/${emp.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ resetDevice: true }),
    })
    if (res.ok) {
      toast.success('تم فك الارتباط بالجهاز. سيطلب الموظف تعيين كلمة مرور جديدة في أول دخول.')
      await load()
    } else {
      toast.error('فشل إعادة ضبط الجهاز')
    }
  }

  const resetPassword = async (emp: Employee) => {
    const res = await fetch(`/api/employees/${emp.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ resetPassword: true }),
    })
    if (res.ok) {
      toast.success('تمت إعادة تعيين كلمة المرور. سيطلب من الموظف تعيين كلمة مرور جديدة في أول دخول.')
      await load()
    } else {
      toast.error('فشلت إعادة تعيين كلمة المرور')
    }
  }

  const deleteEmp = async (emp: Employee) => {
    if (!confirm(`هل أنت متأكد من حذف الموظف "${emp.name}"؟ سيتم حذف جميع سجلاته.`)) return
    const res = await fetch(`/api/employees/${emp.id}`, { method: 'DELETE' })
    if (res.ok) {
      toast.success('تم حذف الموظف')
      await load()
    } else {
      toast.error('فشل حذف الموظف')
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="w-4 h-4 text-primary" /> إدارة الموظفين
            </CardTitle>
            <CardDescription>إضافة، تعديل، إيقاف، أو حذف الموظفين</CardDescription>
          </div>
          <Button onClick={() => setAddOpen(true)} size="sm">
            <Plus className="w-4 h-4 ml-1" /> إضافة موظف
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="mb-3">
          <Input
            placeholder="بحث بالكود أو الاسم أو الهاتف..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
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
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                      لا يوجد موظفون مطابقون
                    </TableCell>
                  </TableRow>
                )}
                {employees.map((emp) => (
                  <TableRow key={emp.id}>
                    <TableCell className="font-mono text-sm">{emp.code}</TableCell>
                    <TableCell className="font-medium">{emp.name}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{emp.phone || '—'}</TableCell>
                    <TableCell>
                      {emp.role === 'ADMIN'
                        ? <Badge>مدير</Badge>
                        : <Badge variant="outline">موظف</Badge>}
                    </TableCell>
                    <TableCell>
                      {emp.deviceId ? (
                        <span className="text-xs text-emerald-600 flex items-center gap-1">
                          <ShieldCheck className="w-3 h-3" /> مرتبط
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">غير مرتبط</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Switch checked={emp.isActive} onCheckedChange={() => toggleActive(emp)} />
                        <span className="text-xs">{emp.isActive ? 'نشط' : 'موقوف'}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" title="تعديل" onClick={() => setEditEmp(emp)}>
                          <Edit3 className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" title="إعادة ضبط الجهاز" onClick={() => resetDevice(emp)}>
                          <Fingerprint className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" title="إعادة تعيين كلمة المرور" onClick={() => resetPassword(emp)}>
                          <ShieldCheck className="w-4 h-4" />
                        </Button>
                        {emp.id !== adminId && (
                          <Button variant="ghost" size="icon" title="حذف" onClick={() => deleteEmp(emp)}>
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
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

      <AddEmployeeDialog open={addOpen} onOpenChange={setAddOpen} onSaved={load} />
      <EditEmployeeDialog employee={editEmp} onOpenChange={(o) => !o && setEditEmp(null)} onSaved={load} />
    </Card>
  )
}

function AddEmployeeDialog({ open, onOpenChange, onSaved }: { open: boolean; onOpenChange: (o: boolean) => void; onSaved: () => void }) {
  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [role, setRole] = useState<'EMPLOYEE' | 'ADMIN'>('EMPLOYEE')
  const [loading, setLoading] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await fetch('/api/employees', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, name, phone, role }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || 'فشل إضافة الموظف')
        return
      }
      toast.success('تم إضافة الموظف بنجاح')
      setCode(''); setName(''); setPhone(''); setRole('EMPLOYEE')
      onOpenChange(false)
      onSaved()
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>إضافة موظف جديد</DialogTitle>
          <DialogDescription>سيقوم الموظف بتعيين كلمة المرور وربط الجهاز عند أول تسجيل دخول</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div className="space-y-2">
            <Label>كود الموظف *</Label>
            <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="مثال: EMP001" required />
          </div>
          <div className="space-y-2">
            <Label>الاسم *</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="الاسم الكامل" required />
          </div>
          <div className="space-y-2">
            <Label>رقم الهاتف</Label>
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="01xxxxxxxxx" />
          </div>
          <div className="space-y-2">
            <Label>الدور</Label>
            <Select value={role} onValueChange={(v) => setRole(v as 'EMPLOYEE' | 'ADMIN')}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="EMPLOYEE">موظف</SelectItem>
                <SelectItem value="ADMIN">مدير</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>إلغاء</Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="w-4 h-4 animate-spin ml-1" />}
              إضافة
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function EditEmployeeDialog({ employee, onOpenChange, onSaved }: { employee: Employee | null; onOpenChange: (o: boolean) => void; onSaved: () => void }) {
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [role, setRole] = useState<'EMPLOYEE' | 'ADMIN'>('EMPLOYEE')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (employee) {
      setName(employee.name)
      setPhone(employee.phone || '')
      setRole(employee.role as 'EMPLOYEE' | 'ADMIN')
    }
  }, [employee])

  if (!employee) return null

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await fetch(`/api/employees/${employee.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, phone, role }),
      })
      if (!res.ok) {
        toast.error('فشل تحديث البيانات')
        return
      }
      toast.success('تم تحديث البيانات')
      onOpenChange(false)
      onSaved()
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={!!employee} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>تعديل بيانات الموظف</DialogTitle>
          <DialogDescription>{employee.code} — {employee.name}</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div className="space-y-2">
            <Label>الاسم</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label>رقم الهاتف</Label>
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>الدور</Label>
            <Select value={role} onValueChange={(v) => setRole(v as 'EMPLOYEE' | 'ADMIN')}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="EMPLOYEE">موظف</SelectItem>
                <SelectItem value="ADMIN">مدير</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>إلغاء</Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="w-4 h-4 animate-spin ml-1" />}
              حفظ
            </Button>
          </DialogFooter>
        </form>
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

  if (loading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
  }

  if (employees.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          لا يوجد موظفون بعد. أضف موظفاً من تبويب "الموظفين" أولاً.
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-3">
      <Card>
        <CardContent className="p-3">
          <div className="flex items-center gap-3 flex-wrap">
            <Label className="text-sm">عرض سجل:</Label>
            <Select
              value={selectedEmp?.id || ''}
              onValueChange={(v) => setSelectedEmp(employees.find((e) => e.id === v) || null)}
            >
              <SelectTrigger className="min-w-[240px]">
                <SelectValue placeholder="اختر موظفاً" />
              </SelectTrigger>
              <SelectContent>
                {employees.map((e) => (
                  <SelectItem key={e.id} value={e.id}>{e.code} — {e.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>
      {selectedEmp && (
        <EmployeeCalendar key={selectedEmp.id} employeeId={selectedEmp.id} employeeRole={selectedEmp.role} />
      )}
    </div>
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
          setWorkDays(data.schedule.workDays.split(',').map((d: string) => parseInt(d.trim(), 10)))
        }
      })
      .finally(() => setLoading(false))
  }, [])

  const save = async () => {
    setSaving(true)
    try {
      const res = await fetch('/api/schedule', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: schedule?.id,
          checkInTime,
          checkOutTime,
          lateThresholdMinutes: lateThreshold,
          earlyLeaveThresholdMinutes: earlyLeave,
          workDays: workDays.join(','),
        }),
      })
      if (res.ok) {
        const data = await res.json()
        setSchedule(data.schedule)
        toast.success('تم حفظ إعدادات المواعيد')
      } else {
        toast.error('فشل حفظ الإعدادات')
      }
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
  }

  return (
    <Card className="max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Settings className="w-4 h-4 text-primary" /> إعدادات مواعيد العمل
        </CardTitle>
        <CardDescription>تحكم في مواعيد الحضور والانصراف وأيام العمل. تطبق على جميع الموظفين.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label>موعد الحضور</Label>
            <Input type="time" value={checkInTime} onChange={(e) => setCheckInTime(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>موعد الانصراف</Label>
            <Input type="time" value={checkOutTime} onChange={(e) => setCheckOutTime(e.target.value)} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label>حد التأخير (دقائق)</Label>
            <Input
              type="number"
              min={0}
              value={lateThreshold}
              onChange={(e) => setLateThreshold(parseInt(e.target.value, 10) || 0)}
            />
            <p className="text-xs text-muted-foreground">بعد هذا الوقت يُعتبر الموظف متأخراً</p>
          </div>
          <div className="space-y-2">
            <Label>حد الانصراف المبكر (دقائق)</Label>
            <Input
              type="number"
              min={0}
              value={earlyLeave}
              onChange={(e) => setEarlyLeave(parseInt(e.target.value, 10) || 0)}
            />
            <p className="text-xs text-muted-foreground">قبل هذا الوقت يُعتبر الانصراف مبكراً</p>
          </div>
        </div>

        <div className="space-y-2">
          <Label>أيام العمل</Label>
          <div className="flex flex-wrap gap-2">
            {AR_DAYS.map((label, idx) => {
              const active = workDays.includes(idx)
              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setWorkDays((prev) => active ? prev.filter((d) => d !== idx) : [...prev, idx])}
                  className={`px-3 py-2 rounded-lg text-sm border transition-colors ${
                    active ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:bg-muted/50'
                  }`}
                >
                  {label}
                </button>
              )
            })}
          </div>
        </div>

        <Separator />

        <Button onClick={save} disabled={saving} className="w-full">
          {saving && <Loader2 className="w-4 h-4 animate-spin ml-1" />}
          حفظ الإعدادات
        </Button>
      </CardContent>
    </Card>
  )
}
