# Setup Supabase untuk 9Router

9Router sekarang mendukung Supabase Postgres sebagai alternatif database SQLite.

## Langkah Setup

### 1. Buat Project di Supabase

1. Buka https://supabase.com
2. Create new project
3. Tunggu database selesai provisioning

### 2. Jalankan Migration Script

1. Buka Supabase Dashboard → SQL Editor
2. Copy isi file `src/lib/db/migrations/supabase-setup.sql`
3. Paste dan run di SQL Editor
4. Pastikan semua query berhasil (hijau)

### 3. Dapatkan Credentials

Di Supabase Dashboard → Settings → API:

- **Project URL**: `https://xxxxx.supabase.co`
- **Service Role Key** (bukan anon key!): `eyJhbGc...`

⚠️ **PENTING**: Gunakan **service_role** key, bukan anon key, karena kita perlu akses penuh ke database.

### 4. Set Environment Variables

Tambahkan ke `.env`:

```bash
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_ANON_KEY=eyJhbGc...  # Gunakan service_role key
```

### 5. Deploy ke Vercel

1. Push code ke GitHub
2. Import project di Vercel
3. Tambahkan environment variables di Vercel Dashboard:
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY` (isi dengan service_role key)
   - `JWT_SECRET` (random string)
   - `INITIAL_PASSWORD` (password login dashboard)
4. Deploy

## Cara Kerja

- Jika `SUPABASE_URL` dan `SUPABASE_ANON_KEY` tersedia → gunakan Supabase
- Jika tidak → fallback ke SQLite lokal (better-sqlite3/bun:sqlite/sql.js)

Database driver akan otomatis memilih Supabase sebagai prioritas pertama jika credentials tersedia.

## Verifikasi

Setelah deploy, cek logs di Vercel:

```
[DB] Driver: supabase-postgres | https://xxxxx.supabase.co
```

Jika muncul error tentang `exec_sql function not found`, pastikan migration script sudah dijalankan di Supabase SQL Editor.

## Migrasi Data dari SQLite

Jika Anda sudah punya data di SQLite lokal dan ingin migrasi ke Supabase:

1. Export data dari SQLite (bisa manual via dashboard)
2. Import ke Supabase via SQL INSERT statements
3. Atau gunakan tool seperti `pgloader` untuk migrasi otomatis

## Troubleshooting

**Error: "exec_sql function not found"**
→ Jalankan migration script di Supabase SQL Editor

**Error: "Row Level Security"**
→ Pastikan menggunakan service_role key, bukan anon key

**Error: "Connection failed"**
→ Cek SUPABASE_URL dan SUPABASE_ANON_KEY sudah benar
