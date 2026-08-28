# 🚀 دليل النشر على Vercel | Vercel Deployment Guide

This guide explains how to deploy the Attendance Tracking System to Vercel with a free MongoDB Atlas database.

---

## ⚠️ مشاكل شائعة عند النشر على Vercel

| المشكلة | السبب | الحل |
|---------|------|------|
| "تعذر الاتصال بالخادم" عند الدخول | API لا يستطيع الوصول لـ MongoDB المحلية | استخدم MongoDB Atlas (الخطوة 1) |
| التحميل بطيء جداً | الـ API يحاول الاتصال بـ WebSocket service محلي | تم إصلاحه: polling fallback في الإنتاج |
| الصفحة لا تظهر بعد الـ deploy | نسيت إعداد `DATABASE_URL` | أضفها من Vercel Dashboard |

---

## 📋 الخطوات (10 دقائق)

### 1️⃣ إنشاء قاعدة بيانات MongoDB Atlas (مجاني)

1. اذهب إلى: https://www.mongodb.com/cloud/atlas/register
2. سجّل حساب جديد (يمكن استخدام Google)
3. اختر **Free** (M0) — مجاني للأبد حتى 512MB
4. اختر الـ region الأقرب (مثلاً: Google Cloud / AWS / Azure - sin1 للشرق الأوسط)
5. اضغط **Create Cluster** (يستغرق 1-3 دقائق)

**بعد إنشاء الـ Cluster:**

1. اذهب إلى **Database Access** (من القائمة الجانبية)
2. اضغط **Add New Database User**
   - Username: `attendance_user`
   - Password: اختر كلمة مرور قوية (مثلاً: `MyStr0ngPass2024!`)
   - **احفظها!** ستحتاجها
3. اذهب إلى **Network Access**
4. اضغط **Add IP Address** → **Allow Access From Anywhere** (`0.0.0.0/0`)
5. اذهب إلى **Database** → **Connect** → **Drivers**
6. انسخ الـ connection string:
   ```
   mongodb+srv://attendance_user:<password>@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0
   ```
7. استبدل `<password>` بكلمة المرور الحقيقية

### 2️⃣ إعداد متغيرات البيئة في Vercel

1. اذهب إلى مشروعك على Vercel: https://vercel.com/dashboard
2. اختر المشروع → **Settings** → **Environment Variables**
3. أضف المتغيرات التالية:

| Name | Value |
|------|-------|
| `DATABASE_URL` | `mongodb+srv://attendance_user:PASSWORD@cluster0.xxxxx.mongodb.net/attendance_db?retryWrites=true&w=majority` |
| `REALTIME_BROADCAST_URL` | (اتركه فارغاً — polling fallback) |
| `NODE_ENV` | `production` |

> ⚠️ **مهم**: استبدل `PASSWORD` و `cluster0.xxxxx` ببياناتك الحقيقية.
> اسم الـ database في الـ URL هو `attendance_db` (سيُنشأ تلقائياً).

### 3️⃣ إعداد Prisma وإنشاء الـ Schema

عند الـ deploy على Vercel، Prisma سيُولّد الـ client تلقائياً من `postinstall` script.

لكن **قبل أول deploy**، تحتاج لإنشاء الـ collections في MongoDB Atlas:

**الطريقة 1: استخدام Prisma من جهازك المحلي**
```bash
# اضبط DATABASE_URL مؤقتاً لمطابقة Vercel
export DATABASE_URL="mongodb+srv://attendance_user:PASSWORD@cluster0.xxxxx.mongodb.net/attendance_db?retryWrites=true&w=majority"

# ادفع الـ schema إلى MongoDB Atlas
bun run db:push

# أنشئ المدير الافتراضي
node scripts/seed-admin.js
```

**الطريقة 2: استخدام MongoDB Atlas UI**
1. اذهب إلى **Database** → **Browse Collections** → **Add My Own Data**
2. أنشئ database باسم `attendance_db`
3. الـ collections سيُنشئها Prisma تلقائياً عند أول request

### 4️⃣ النشر على Vercel

**الطريقة الأسهل: ربط GitHub**
1. اذهب إلى https://vercel.com/new
2. اختر الـ repo الخاص بك (`edumahmoud/Go`)
3. تأكد أن Framework Preset = **Next.js**
4. لا تغيّر أي إعداد آخر
5. اضغط **Deploy**

أو عبر CLI:
```bash
npm i -g vercel
vercel login
vercel --prod
```

### 5️⃣ تسجيل الدخول الأول

بعد النشر الناجح، افتح الـ URL الخاص بك (مثلاً: `https://go-xxx.vercel.app`):

- **كود الموظف**: `ADMIN001`
- **كلمة المرور**: `admin123`

> 💡 إذا لم تجد المدير الافتراضي، شغّل `node scripts/seed-admin.js` محلياً مع `DATABASE_URL` مطابق لـ Vercel.

---

## 🔧 ما الذي تغيّر للنشر على Vercel؟

تم تعديل الكود ليكون متوافقاً مع serverless:

| الملف | التغيير |
|------|---------|
| `prisma/schema.prisma` | استخدم `env("DATABASE_URL")` بدلاً من hardcoded URL |
| `src/lib/db.ts` | إعادة استخدام Prisma client عبر invocations |
| `src/lib/realtime-client.ts` | تعطيل WebSocket في الإنتاج (polling fallback) |
| `src/lib/broadcast.ts` | جديد: no-op في الإنتاج |
| `src/app/api/location/route.ts` | استخدم `broadcastEvent` بدلاً من fetch مباشر |
| `src/app/api/attendance/check-in/route.ts` | نفس الشيء |
| `src/app/api/attendance/check-out/route.ts` | نفس الشيء |
| `src/app/page.tsx` | polling كل 8 ثواني في الإنتاج (بدل 15) |
| `next.config.ts` | `optimizePackageImports` لتقليل حجم الـ bundle |
| `vercel.json` | إعدادات النشر |

---

## 🐛 استكشاف الأخطاء | Troubleshooting

### "تعذر الاتصال بالخادم" عند الدخول

**السبب**: الـ API فشل في الاتصال بـ MongoDB.

**الحل**:
1. تحقق من Vercel → Settings → Environment Variables
2. تأكد أن `DATABASE_URL` صحيح وبدون `<password>`
3. في Vercel → Functions → Logs، ابحث عن خطأ Prisma
4. راجع أن MongoDB Atlas Network Access = `0.0.0.0/0`

### التطبيق يعمل لكن بطيء

**السبب**: منطقة Vercel بعيدة عن منطقة MongoDB Atlas.

**الحل**:
- اختر نفس region لكليهما (مثلاً: `sin1` في Singapore للشرق الأوسط)
- `vercel.json` يحدد `sin1` افتراضياً

### الـ deploy فشل في `prisma generate`

**السبب**: missing `postinstall` script.

**الحل**: تأكد أن `package.json` يحتوي على:
```json
"scripts": {
  "postinstall": "prisma generate"
}
```

### صفحة فارغة (white screen)

**السبب**: خطأ في client-side (عادة في env vars).

**الحل**: افتح browser console (F12) وراجع الأخطاء.

---

## 💡 نصائح للأداء

1. **استخدم MongoDB Atlas في نفس region** مثل Vercel
2. **فعّل Vercel Edge Functions** للـ public APIs (مستقبلاً)
3. **استخدم Vercel KV** للـ caching (اختياري)
4. **راقب الـ function duration** في Vercel → Functions

---

## 🔒 الأمان في الإنتاج

- ✅ كلمات المرور مشفّرة (SHA-256 + salt)
- ✅ HttpOnly cookies للجلسات
- ✅ RBAC كامل على كل API
- ✅ Device binding يمنع الدخول من أجهزة أخرى
- ⚠️ **غيّر كلمة مرور المدير الافتراضية** بعد أول تسجيل دخول
- ⚠️ **أضف Vercel Password** أو Vercel Authentication للـ preview URLs
- ⚠️ فكّر في تفعيل MongoDB Atlas IP Allowlist (بدل `0.0.0.0/0`)

---

## 📞 الدعم

إذا واجهت مشاكل:
1. راجع Vercel Function Logs
2. راجع MongoDB Atlas Logs
3. شغّل `node scripts/seed-admin.js` للتأكد من الاتصال بقاعدة البيانات
