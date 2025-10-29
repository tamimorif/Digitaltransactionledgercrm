# Digital Transaction Ledger CRM - Backend راه‌اندازی کامل شد! 🎉

## ✅ تبدیل کامل به Next.js Backend با Prisma

پروژه به طور کامل از Supabase جدا شده و تمام عملیات backend از طریق **Next.js API Routes** و **Prisma ORM** انجام می‌شود.

### تنظیمات دیتابیس:

- **Local Development**: SQLite (نیاز به نصب چیزی نیست!)
- **Production**: PostgreSQL

---

## 📁 ساختار Backend

### API Routes (app/api):

1. **`/api/clients`** - مدیریت کلاینت‌ها
   - `GET /api/clients` - دریافت تمام کلاینت‌ها
   - `POST /api/clients` - ایجاد کلاینت جدید

2. **`/api/transactions`** - مدیریت تراکنش‌ها
   - `GET /api/transactions?clientId=xyz` - دریافت تراکنش‌ها (با فیلتر اختیاری)
   - `POST /api/transactions` - ایجاد تراکنش جدید

3. **`/api/transactions/[id]`** - مدیریت تراکنش منفرد
   - `PUT /api/transactions/[id]` - ویرایش تراکنش
   - `DELETE /api/transactions/[id]` - حذف تراکنش

4. **`/api/daily-rates`** - نرخ‌های روزانه ارز
   - `GET /api/daily-rates` - دریافت نرخ‌های امروز
   - `POST /api/daily-rates` - بروزرسانی نرخ‌ها

### Prisma Schema:

- **Client Model**: id, name, phoneNumber, email, joinDate
- **Transaction Model**: 
  - Basic: id, clientId, type (CASH_EXCHANGE / BANK_TRANSFER)
  - Currency: sendCurrency, sendAmount, receiveCurrency, receiveAmount
  - Details: rateApplied, feeCharged, beneficiaryName, beneficiaryDetails, userNotes
  - History: isEdited, lastEditedAt, editHistory (JSON)

---

## 🚀 راه‌اندازی سریع (Local با SQLite):

```bash
# 1. Migration اجرا کن (دیتابیس SQLite خودکار ساخته می‌شه)
npm run prisma:migrate:dev

# 2. سرور Next رو اجرا کن
npm run dev

# 3. (اختیاری) Prisma Studio برای مشاهده دیتا
npm run prisma:studio
```

فایل `.env` الان فقط SQLite داره:
```env
DATABASE_URL="file:./dev.db"
```

---

## 📦 Production (PostgreSQL):

برای deploy کردن در production:

1. **تغییر Schema**: 
   ```bash
   # پاک کردن schema فعلی (SQLite)
   rm prisma/schema.prisma
   
   # استفاده از schema PostgreSQL
   mv prisma/schema.postgresql.prisma prisma/schema.prisma
   ```

2. **تنظیم DATABASE_URL** در environment variables:
   ```env
   DATABASE_URL="postgresql://user:pass@host:5432/dbname"
   ```

3. **اجرای Migration**:
   ```bash
   npm run prisma:migrate:deploy
   ```

---

## 🗑️ تغییرات نسبت به نسخه قبل:

### ❌ حذف شده:
- ❌ Supabase Functions
- ❌ Supabase Client
- ❌ `@supabase/supabase-js` package
- ❌ فایل `src/utils/supabase/info.tsx`
- ❌ فایل‌های `src/supabase/functions/`

### ✅ اضافه شده:
- ✅ Next.js API Routes در `app/api/`
- ✅ Prisma Client در `src/lib/prisma.ts`
- ✅ Prisma Schema در `prisma/schema.prisma`
- ✅ Migration system با Prisma
- ✅ پشتیبانی از SQLite (local) و PostgreSQL (production)

---

## 💡 نکات مهم:

### Frontend ↔ Backend:
- همه درخواست‌های frontend از `fetch('/api/...')` استفاده می‌کنند
- دیگر نیازی به API Keys یا Authorization Headers نیست
- همه چیز در یک پروژه Next.js واحد است

### Database:
- SQLite برای development (فایل `dev.db` در پوشه prisma/)
- PostgreSQL برای production (نیاز به DATABASE_URL)
- تمام queries از طریق Prisma ORM انجام می‌شود

### امنیت:
- API Routes فقط در سمت سرور اجرا می‌شوند
- دیتابیس credentials در `.env` محفوظ است
- نیازی به expose کردن API keys در client نیست

### API Endpoints:

#### Clients:
- **GET** `/api/clients` - دریافت تمام کلاینت‌ها
- **POST** `/api/clients` - ایجاد کلاینت جدید
  ```json
  {
    "name": "John Doe",
    "phoneNumber": "+1234567890",
    "email": "john@example.com"
  }
  ```

#### Transactions:
- **GET** `/api/transactions?clientId=xyz` - دریافت تراکنش‌ها (با فیلتر اختیاری)
- **POST** `/api/transactions` - ایجاد تراکنش جدید
  ```json
  {
    "clientId": "client_id_here",
    "type": "deposit",
    "amount": 1000,
    "currency": "USD",
    "exchangeRate": 1.2,
    "notes": "Initial deposit"
  }
  ```

### نکات مهم:

- همه API routes در سمت سرور اجرا می‌شوند (Server Components)
- Prisma Client فقط در سرور قابل استفاده است
- برای استفاده در کامپوننت‌ها، از fetch به این API endpoints استفاده کنید

