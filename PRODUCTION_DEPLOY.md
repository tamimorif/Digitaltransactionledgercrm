# راهنمای سوئیچ به PostgreSQL در Production

## روش ۱: استفاده از فایل schema جداگانه

### مراحل Deploy در Production:

1. **تغییر نام schema file**:
```bash
# پاک کردن schema فعلی (SQLite)
rm prisma/schema.prisma

# استفاده از schema PostgreSQL
mv prisma/schema.postgresql.prisma prisma/schema.prisma
```

2. **تنظیم DATABASE_URL** در environment variables پلتفرم deploy (Vercel, Railway, etc.):
```env
DATABASE_URL="postgresql://user:password@host:5432/dbname?schema=public"
```

3. **اجرای Migration در Production**:
```bash
npx prisma migrate deploy
```

---

## روش ۲: استفاده از prisma db push (ساده‌تر برای شروع)

اگر فقط می‌خواهید سریع تست کنید:

1. **تنظیم DATABASE_URL** در `.env` به PostgreSQL:
```env
DATABASE_URL="postgresql://user:password@localhost:5432/dbname"
```

2. **تغییر provider در `schema.prisma`**:
```prisma
datasource db {
  provider = "postgresql"  // تغییر از sqlite به postgresql
  url      = env("DATABASE_URL")
}
```

3. **Push کردن schema**:
```bash
npm run db:push
```

---

## نکات مهم:

### تفاوت‌های SQLite و PostgreSQL:

- **SQLite**: 
  - نیازی به سرور جداگانه نیست
  - فایل `.db` در پوشه `prisma/` ذخیره می‌شود
  - مناسب برای Development

- **PostgreSQL**:
  - نیاز به سرور PostgreSQL دارد
  - مناسب برای Production
  - Performance بهتر برای concurrent requests

### محیط Development و Production:

برای اینکه هم در local SQLite و هم در production PostgreSQL استفاده کنید:

1. **Local**: `DATABASE_URL="file:./dev.db"`
2. **Production**: از environment variables پلتفرم استفاده کنید

### Deployment چک‌لیست:

- [ ] DATABASE_URL در environment variables تنظیم شده
- [ ] Schema PostgreSQL استفاده می‌شود
- [ ] Migration اجرا شده (`prisma migrate deploy`)
- [ ] Prisma Client generate شده (معمولاً در `postinstall` خودکار انجام می‌شود)
