# نظام الحضور والانصراف | Attendance Tracking System

نظام متكامل لإدارة حضور وانصراف الموظفين عبر الموقع الجغرافي (GPS) مبني بأحدث التقنيات مع دعم كامل للعربية (RTL).

A comprehensive employee attendance & location-tracking system built with Next.js 16, MongoDB, and WebSocket real-time updates.

---

## ✨ المميزات الرئيسية | Key Features

### 🔐 المصادقة والأمان
- تسجيل دخول بكود الموظف + كلمة المرور
- **ربط تلقائي بالجهاز** عند أول تسجيل دخول (Device Fingerprint)
- منع الدخول من أجهزة أخرى (يحتاج إعادة ضبط من الإدارة)
- جلسات آمنة (HttpOnly cookies، 7 أيام)
- كلمات مرور بـ SHA-256 مع salt

### 👥 نظام الأدوار والصلاحيات (RBAC)
ثلاثة أدوار مع 15 صلاحية دقيقة:

| الدور | الوصف | الصلاحيات |
|------|-------|-----------|
| **EMPLOYEE** (موظف) | تسجيل حضور/انصراف لنفسه فقط | — |
| **SUPERVISOR** (مشرف) | صلاحيات حسب ما يمنحه المدير | قابلة للتخصيص |
| **MANAGER** (مدير) | جميع الصلاحيات تلقائياً | كل الـ 15 صلاحية |

**الصلاحيات الـ 15:**
```
dashboard:view          - عرض لوحة التحكم
employees:view          - عرض بيانات الموظفين
employees:create        - إضافة موظف
employees:edit          - تعديل بيانات الموظفين
employees:delete        - حذف موظف
employees:suspend       - إيقاف/تفعيل موظف
employees:reset_device  - إعادة ضبط جهاز موظف
employees:reset_password - إعادة تعيين كلمة مرور
employees:promote       - ترقية موظف إلى مشرف
employees:demote        - تخفيض مشرف إلى موظف
permissions:manage      - إدارة صلاحيات المشرفين
attendance:edit         - تعديل سجلات الحضور
schedule:edit           - تعديل مواعيد العمل
locations:view          - عرض مواقع الموظفين الحية
auditlog:view           - عرض سجل العمليات
```

### 🗺️ الموقع الجغرافي (Geo)
- التقاط GPS عند تسجيل الحضور/الانصراف
- **تحديث الموقع كل 30 ثانية** تلقائياً للموظفين النشطين
- عرض الخريطة (OpenStreetMap) لكل الموظفين في لوحة الإدارة
- Reverse geocoding لتحويل الإحداثيات إلى عنوان عربي
- رابط "عرض على الخريطة" لكل تسجيل

### ⚡ الوقت الحقيقي (Real-time)
- WebSocket service مستقل (socket.io)
- بث فوري لتحديثات الموقع لكل لوحات الإدارة
- إشعارات toast عند كل تسجيل حضور/انصراف
- مؤشر "البث المباشر مفعّل" بنقطة خضراء نابضة

### 📅 التقويم
- تقويم شهري عربي كامل
- تمييز الأيام بالألوان:
  - 🟢 أخضر: حاضر
  - 🔴 أحمر: متأخر
  - ⚪ رمادي: يوم عطلة
- ملخص شهري (أيام الحضور، التأخير، الانصراف الكامل)
- تفاصيل اليوم المحدد

### 📊 لوحة تحكم الإدارة
4 تبويبات رئيسية:
1. **نظرة عامة** - 6 بطاقات إحصائية + خريطة + جدول اليوم
2. **الموظفين** - إضافة/تعديل/حذف/ترقية/تخفيض/إدارة صلاحيات
3. **التقويم** - عرض تقويم أي موظف
4. **الإعدادات** - مواعيد العمل + أيام العمل + حدود التأخير
5. **السجل** - audit log كامل لكل العمليات

---

## 🛠️ التقنيات المستخدمة | Tech Stack

| الفئة | التقنية |
|------|---------|
| Framework | Next.js 16 (App Router) + TypeScript 5 |
| Styling | Tailwind CSS 4 + shadcn/ui (New York) |
| Database | **MongoDB 7.0.14** (NoSQL) |
| ORM | Prisma 6.19 |
| Real-time | Socket.io 4.8 (mini-service) |
| Auth | Custom JWT-like sessions + cookies |
| Maps | OpenStreetMap + Nominatim |
| Animations | Framer Motion |
| Notifications | Sonner |
| Icons | Lucide React |
| Fonts | Cairo (Arabic) + Geist (Latin) |

---

## 📊 قاعدة البيانات (MongoDB)

6 collections منظمة:

```
attendance_db
├── employees          # المستخدمون + RBAC + موقع حي
├── sessions           # جلسات تسجيل الدخول
├── attendances        # سجلات الحضور (checkIn/checkOut embedded)
├── locationpings      # سجل كل تحديثات الموقع (append-only)
├── schedulesettings   # إعدادات مواعيد العمل
└── auditlogs          # سجل جميع العمليات
```

**Embedded sub-documents:**
- `Attendance.checkIn: CheckInOut` - { time, lat, lng, address }
- `Attendance.checkOut: CheckInOut` - { time, lat, lng, address }

**Indexes:**
- `Employee.code` (unique)
- `Attendance.{employeeId, date}` (unique)
- `LocationPing.{employeeId, timestamp}`
- `AuditLog.{action, timestamp}`

---

## 🚀 التشغيل | Quick Start

### المتطلبات | Prerequisites
- Node.js 18+ أو Bun
- MongoDB 7+ (أو سيتم تنزيله تلقائياً)

### 1. تثبيت الاعتمادات
```bash
bun install
cd mini-services/realtime-service && bun install && cd ../..
```

### 2. تشغيل MongoDB (إذا لم يكن مثبتاً)
```bash
# تنزيل MongoDB binary
curl -sL "https://fastdl.mongodb.org/linux/mongodb-linux-x86_64-debian12-7.0.14.tgz" -o /tmp/mongodb.tgz
mkdir -p .mongodb/bin .mongodb/data .mongodb/log
tar xzf /tmp/mongodb.tgz -C /tmp/
cp /tmp/mongodb-linux-*/bin/mongod .mongodb/bin/

# تشغيل كـ replica set (مطلوب لـ Prisma)
.mongodb/bin/mongod --dbpath .mongodb/data --logpath .mongodb/log/mongod.log \
  --fork --port 27017 --bind_ip 127.0.0.1 --replSet rs0

# تهيئة الـ replica set
node scripts/init-replset.js
```

### 3. تطبيق schema على قاعدة البيانات
```bash
bun run db:push
```

### 4. تشغيل جميع الخدمات (الطريقة الأسهل)
```bash
./scripts/start-all.sh
```
هذا السكريبت سيشغّل:
- MongoDB (مع تهيئة الـ replica set)
- WebSocket service (port 3003)
- Next.js dev server (port 3000)

### 5. فتح التطبيق
```
http://localhost:3000
```

### 🔑 حساب المدير الافتراضي (يُنشأ تلقائياً)

عند تشغيل `start-all.sh` لأول مرة، يتم إنشاء حساب مدير افتراضي تلقائياً:

| الحقل | القيمة |
|------|-------|
| **كود الموظف** | `ADMIN001` |
| **كلمة المرور** | `admin123` |
| **الاسم** | مدير النظام |
| **الدور** | MANAGER (15 صلاحية كاملة) |

سجّل الدخول مباشرة بهذه البيانات. عند أول تسجيل دخول، سيتم ربط الحساب بجهازك تلقائياً.

> 💡 **ملاحظة أمنية**: يُنصح بتغيير كلمة المرور الافتراضية بعد أول تسجيل دخول من خلال تبويب "الموظفين" → تعديل → إعادة تعيين كلمة المرور.

> 📌 **السلوك**: 
> - إذا لم يكن هناك أي مستخدم في النظام، يتم إنشاء المدير الافتراضي تلقائياً عند تشغيل `start-all.sh`.
> - إذا كان المدير موجوداً بالفعل، يتخطى السكريبت الإنشاء (idempotent).
> - يمكن حذف المدير الافتراضي من لوحة الإدارة بعد إنشاء مدراء آخرين.

---

## 📁 بنية المشروع | Project Structure

```
.
├── prisma/
│   └── schema.prisma              # MongoDB schema (6 collections)
├── src/
│   ├── app/
│   │   ├── api/                    # REST API endpoints
│   │   │   ├── auth/               # login + register_first + me
│   │   │   ├── employees/          # CRUD + promote/demote + permissions
│   │   │   ├── attendance/         # check-in/out + today + calendar
│   │   │   ├── location/           # live location updates
│   │   │   ├── dashboard/          # admin dashboard data
│   │   │   ├── schedule/           # work schedule settings
│   │   │   ├── audit-log/          # audit log
│   │   │   └── system/status/      # system freshness check
│   │   ├── layout.tsx              # RTL + Arabic font
│   │   ├── page.tsx                # main UI (login + dashboards)
│   │   └── globals.css             # theme (light/dark)
│   ├── lib/
│   │   ├── auth.ts                 # sessions + RBAC + audit log
│   │   ├── attendance.ts           # schedule logic
│   │   ├── client.ts               # browser helpers (device id, GPS)
│   │   ├── db.ts                   # Prisma client
│   │   ├── geo.ts                  # reverse geocoding
│   │   ├── permissions.ts          # 15 permissions definitions
│   │   └── realtime-client.ts      # socket.io client
│   └── components/ui/              # shadcn/ui components
├── mini-services/
│   └── realtime-service/          # WebSocket service (socket.io)
│       ├── index.ts                # server code
│       └── package.json
├── scripts/
│   ├── start-all.sh                # one-command startup
│   └── init-replset.js             # MongoDB replica set init
├── .mongodb/                       # MongoDB data (gitignored)
└── package.json
```

---

## 🔌 الـ APIs

| Endpoint | Method | الوصف | الصلاحية |
|----------|--------|-------|----------|
| `/api/auth` | GET | بيانات المستخدم الحالي | — |
| `/api/auth` | POST | تسجيل دخول أو `register_first` | — |
| `/api/auth` | DELETE | تسجيل خروج | — |
| `/api/system/status` | GET | حالة النظام (fresh أم لا) | — |
| `/api/employees` | GET | قائمة الموظفين | employees:view |
| `/api/employees` | POST | إضافة موظف | employees:create |
| `/api/employees/[id]` | GET | موظف واحد | employees:view |
| `/api/employees/[id]` | PATCH | تعديل / ترقية / تخفيض / صلاحيات | يختلف |
| `/api/employees/[id]` | DELETE | حذف موظف | employees:delete |
| `/api/attendance/today` | GET | سجل اليوم للمستخدم الحالي | — |
| `/api/attendance/check-in` | POST | تسجيل حضور | — |
| `/api/attendance/check-out` | POST | تسجيل انصراف | — |
| `/api/attendance/calendar` | GET | سجلات الشهر | — |
| `/api/location` | POST | تحديث الموقع الحي | — |
| `/api/dashboard` | GET | بيانات لوحة الإدارة | dashboard:view |
| `/api/schedule` | GET/PUT | إعدادات المواعيد | schedule:edit (PUT) |
| `/api/audit-log` | GET | سجل العمليات | auditlog:view |

---

## 🎨 الواجهة | UI

- **دعم كامل للعربية** (RTL)
- خط **Cairo** العربي
- **Light/Dark mode** قابل للتبديل
- تصميم **متجاوب** (Mobile-first)
- Framer Motion للحركات السلسة
- Sonner للإشعارات
- OpenStreetMap للخرائط

---

## 🔒 الأمان

- كلمات المرور مشفّرة (SHA-256 + salt)
- Sessions في HttpOnly cookies
- كل API endpoint محمي بصلاحيات
- Device binding يمنع تسجيل الدخول من أجهزة غير مصرح بها
- Audit log يسجّل كل عملية حساسة

---

## 📝 ملاحظات

- MongoDB يعمل كـ **replica set** (مطلوب من Prisma للـ transactions)
- في الإنتاج، استخدم MongoDB Atlas أو replica set من 3 nodes
- الـ WebSocket service يعمل على port 3003، والـ broadcast HTTP على 3004
- عند نشر التطبيق، تأكد من فتح المنافذ 3000, 3003, 3004

---

## 📜 الترخيص

MIT License - حر للاستخدام والتعديل.
