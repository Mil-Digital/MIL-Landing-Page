# MIL Digital — Landing Page + CMS

Landing page MIL Digital dengan **Content Studio** (admin CMS) sehingga seluruh teks, gambar, video, SEO dan nomor WhatsApp dapat dikelola tanpa mengedit kode.

- **Public website** (`/`): HTML, CSS, animasi dan JavaScript original dipertahankan 1:1 — diverifikasi **0 piksel berbeda** dibanding file original di lebar 1440 / 1024 / 820 / 390 px.
- **Admin CMS** (`/admin`): login khusus admin, editor per section, Media Library, Draft → Preview → Publish, riwayat versi & rollback.
- **Stack**: Next.js 16 (Vercel) · **Neon** Postgres + Object Storage · Better Auth (login admin) · RLS di semua tabel CMS.

> Panduan untuk klien (non-teknis): [`docs/PANDUAN-KLIEN.md`](docs/PANDUAN-KLIEN.md)
> **Analytics, heatmap & video analytics:** [`docs/ANALYTICS.md`](docs/ANALYTICS.md) — setup, definisi metric, privasi, hasil uji.

---

## 1. Arsitektur

```
Visitor ──► Vercel CDN ──► GET /  (app/route.ts, ISR)
                              │  renderPage(content)  ← template HTML original (src/site/render.ts)
                              │  getPublishedContent() ← unstable_cache, tag "site-content"
                              ▼
                      Neon Postgres: get_published_content()   (hanya published_value)

Admin ──► /admin/* (proxy.ts: wajib cookie sesi) ──► React UI
             │  /api/auth/*     Better Auth (email + password, tanpa registrasi publik)
             │  /api/admin/*    cek sesi + admin_users  → query sebagai role cms_app
             │                  dengan app.user_id → RLS is_admin() di database
             │  upload: browser ──PUT (presigned URL)──► Neon Object Storage (bucket public_read)
             └► POST /api/admin/publish ──► publish_site() ──► revalidateTag + revalidatePath
                                                     (website ter-update tanpa redeploy)
```

**Lapisan keamanan**
1. `proxy.ts` — tanpa cookie sesi → redirect ke login / 401.
2. Setiap halaman admin & API memverifikasi sesi Better Auth **dan** keanggotaan `admin_users` di server.
3. Database: aplikasi memakai role `cms_app` (dibuat via SQL → **tanpa** BYPASSRLS). Setiap request admin berjalan dalam transaksi yang menyetel `app.user_id`; semua policy RLS mensyaratkan `is_admin()`. `cms_app` hanya boleh menulis kolom draft; `published_value` hanya berubah lewat `publish_site()`; `admin_users` tidak bisa ditulis aplikasi sama sekali.
4. Semua input divalidasi ulang di server (schema field, URL, tipe & ukuran file, key storage).
5. Kredensial (database, storage, auth secret) hanya ada di server — tidak ada secret di browser.

**Mengapa public page bukan React?** Halaman `/` dirender di server sebagai dokumen HTML utuh dari template yang identik dengan file original (CSS & script original disalin verbatim oleh `scripts/extract_original.py`). Tidak ada hydration, tidak ada perubahan styling → desain, animasi dan perilaku sama persis. Semua nilai dari CMS di-escape (editor tidak bisa menyuntikkan HTML).

**Caching.** Halaman di-generate statis (ISR) dan disajikan dari CDN Vercel. Saat admin menekan Publish, cache langsung di-purge sehingga request berikutnya menampilkan konten baru. Database hanya diakses ±1× per publish (plus safety-refresh tiap 5 menit dari cache data 1 jam).

**Fallback.** Jika database tidak dapat diakses: (1) konten terakhir yang berhasil dimuat tetap dipakai, (2) jika belum ada, konten original bawaan (`DEFAULT_CONTENT`) dirender. Website tidak pernah kosong.

### Hasil audit HTML original

| Temuan | Tindakan |
|---|---|
| File 24 MB, 97% berupa Base64 | Semua asset diekstrak menjadi file → HTML kini ±77 KB |
| 2 video testimoni (7,6 MB + 6,9 MB) di `<script type="text/plain">` + di-decode ke Blob di browser | File MP4 biasa, `preload="none"` + poster; dapat dipindah ke Neon Object Storage |
| 3 font SF Pro Display OTF (Base64) | `/public/fonts`, cache 1 tahun, `preload` untuk 400 & 700 (tanpa flash) |
| 2 gambar logo wall PNG (±480 KB) | WebP **lossless** (piksel identik, ±275 KB) |
| 2 gambar `.lp-stack` | Tersembunyi di semua breakpoint (`display:none`) → dihapus |
| Logo footer = logo nav (byte-identik) | Satu file |
| Script `.fw-tabs` | Tidak ada elemen yang cocok (dead code) → dihapus |
| Link WhatsApp diisi via JS | Dirender di server (tetap berfungsi tanpa JS) |
| Gambar tanpa width/height | Ditambahkan (mencegah layout shift) + `loading="lazy"` di bawah fold |
| Meta SEO hanya title + description | Ditambah Open Graph, Twitter card, canonical, favicon, robots.txt, sitemap.xml |

Semua wording terdaftar di `src/content/schema.ts` (9 section, 60 field, termasuk label kecil, badge, tombol, label aksesibilitas & teks pemutar video).

---

## 2. Struktur folder

```
mil-cms/
├── db/
│   ├── 00_create_app_role.sql      # LANGKAH 1: role aplikasi cms_app
│   ├── migrations/001_schema.sql   # LANGKAH 2: tabel auth + CMS, RLS, fungsi
│   └── seed.sql                    # LANGKAH 3: konten awal = landing page original
├── public/
│   ├── assets/            # gambar & video original (fallback; dapat dipindah ke Object Storage dari CMS)
│   └── fonts/             # SF Pro Display 400/500/700
├── scripts/
│   ├── extract_original.py   # ekstraksi satu kali dari HTML original (asset, CSS, SVG, script)
│   ├── fidelity-check.ts     # tes: markup hasil render == markup original
│   ├── generate-seed.ts      # membuat db/seed.sql dari schema
│   ├── create-admin.ts       # membuat admin / reset password (lokal)
│   └── setup-storage.ts      # set CORS bucket (lokal)
├── src/
│   ├── proxy.ts              # gerbang /admin & /api/admin
│   ├── content/              # schema.ts (sumber kebenaran tunggal), validate, media-rules…
│   ├── site/                 # renderer public page + CSS/SVG/script original (generated/)
│   ├── lib/
│   │   ├── db.ts             # pg Pool + asUser() (set app.user_id per transaksi)
│   │   ├── auth.ts           # Better Auth (disableSignUp)
│   │   ├── admin.ts          # getAdmin(), adminRoute() guard untuk API
│   │   ├── storage.ts        # Neon Object Storage (S3, presigned PUT)
│   │   ├── media-server.ts · published.ts · env.ts
│   │   └── api.ts · media.ts · auth-client.ts   # sisi browser
│   ├── components/admin/     # Shell, form engine (fields/), MediaPicker, Toast, Modal…
│   └── app/
│       ├── route.ts          # GET /  (public landing page)
│       ├── api/auth/[...all] # Better Auth
│       ├── api/admin/…       # content, publish, versions, discard, media, team
│       └── admin/            # login, preview, (dash)/…
└── .env.example
```

---

## 3. Database

| Tabel | Isi |
|---|---|
| `user`, `session`, `account`, `verification` | Tabel Better Auth (hash password di `account`). |
| `admin_users` | User yang boleh masuk CMS (`owner` / `editor`). Tanpa baris di sini = tidak punya akses walau bisa login. Hanya bisa ditulis oleh owner database (script). |
| `page_sections` | 9 section (hero, clients, workflow, services, additional, testimonials, cta, footer, settings). |
| `page_content` | Satu baris per field: `draft_value` & `published_value` (JSONB) + `field_type`. Repeater (services, testimoni, statistik…) disimpan sebagai array dalam satu field. |
| `media_assets` | Metadata file di Object Storage: URL, nama, tipe, ukuran, dimensi, durasi. |
| `content_versions` | Snapshot lengkap setiap kali publish (rollback). |
| `site_status` | Waktu & pelaku draft/publish terakhir. |

Fungsi: `get_published_content()`, `publish_site(note)`, `restore_version(n)`, `discard_draft()`, `is_admin()`.

---

## 4. Setup

### 4.1 Neon — project & database
1. Neon Console → **Create project**: region **AWS Asia Pacific 1 (Singapore)**; Services: **Postgres database ON**, **Object storage ON**; Better Auth / Functions / AI gateway / Realtime **OFF** (login memakai library Better Auth di aplikasi ini).
2. **SQL Editor** (role `neondb_owner`, database `neondb`), jalankan berurutan:
   1. `db/00_create_app_role.sql` — **ganti password dulu** (mis. `openssl rand -hex 20`).
      > Jangan membuat role ini lewat Console: role Console otomatis mendapat `neon_superuser` (BYPASSRLS) sehingga RLS tidak berlaku.
   2. `db/migrations/001_schema.sql`
   3. `db/seed.sql`
   4. `db/migrations/002_analytics.sql` (analytics — lihat `docs/ANALYTICS.md`)
3. **Connect** → salin connection string **pooled** (host berisi `-pooler`). Buat dua versi:
   - `DATABASE_URL` → ganti user/password menjadi `cms_app` / password langkah 2.1 (untuk website).
   - `DATABASE_URL_OWNER` → versi `neondb_owner` (hanya untuk script lokal).

### 4.2 Neon — Object storage
1. Branch `main` → tab **Object storage** → **New bucket**: nama `mil-media`, access level **public_read** (tidak bisa diubah setelah dibuat).
2. Buat kredensial dengan scope `storage:read` + `storage:write` (Console, atau CLI `neon credentials create --scope storage:read --scope storage:write`). Simpan *secret* — hanya ditampilkan sekali.
3. Catat endpoint S3 branch (format `https://br-xxxx.storage.c-N.ap-southeast-1.aws.neon.tech`) → `AWS_ENDPOINT_URL_S3`; `token_id` → `AWS_ACCESS_KEY_ID`; `s3_secret_access_key` → `AWS_SECRET_ACCESS_KEY`.
4. Set CORS (agar browser bisa upload langsung):
   ```bash
   npm run storage:cors -- https://www.mildigital.id https://NAMA-PROJECT.vercel.app http://localhost:3000
   ```

### 4.3 Environment variables

| Variable | Vercel | Lokal | Keterangan |
|---|:-:|:-:|---|
| `DATABASE_URL` | ✅ | ✅ | Pooled connection string role **cms_app** |
| `BETTER_AUTH_SECRET` | ✅ | ✅ | Acak ≥32 karakter (`openssl rand -base64 32`) |
| `BETTER_AUTH_URL` | opsional | ✅ | URL website; di Vercel default domain produksi |
| `AWS_ENDPOINT_URL_S3` | ✅ | ✅ | Endpoint S3 branch Neon |
| `AWS_REGION` | ✅ | ✅ | `ap-southeast-1` |
| `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` | ✅ | ✅ | Kredensial storage |
| `S3_BUCKET` | ✅ | ✅ | `mil-media` |
| `SITE_URL` | opsional | ✅ | Untuk canonical & og:image absolut |
| `CRON_SECRET` | ✅ | — | Cron retensi analytics harian |
| `ANALYTICS_*` | opsional | opsional | Consent mode, zona waktu, retensi, IP dikecualikan — lihat `docs/ANALYTICS.md` |
| `DATABASE_URL_OWNER` | ❌ **jangan** | ✅ | Hanya script `admin:create` / `admin:password` |

Tidak ada variabel `NEXT_PUBLIC_*` — tidak ada kredensial yang dikirim ke browser.

```bash
cp .env.example .env.local   # isi nilainya
npm install
npm run dev                  # http://localhost:3000  ·  CMS: /admin
```

### 4.4 Akun admin
```bash
npm run admin:create -- klien@perusahaan.com "Nama Klien" owner     # password sementara dicetak sekali
ADMIN_PASSWORD='PasswordKuat123' npm run admin:create -- ...         # atau tentukan sendiri
npm run admin:password -- klien@perusahaan.com                      # reset password (sesi lama dikeluarkan)
```
- Tidak ada registrasi publik (`disableSignUp`), dan tidak ada email reset otomatis (tidak ada layanan email) — reset dilakukan pengelola dengan perintah di atas. Admin dapat mengganti password sendiri di **CMS › Akun**.
- Mencabut akses (SQL Editor): `delete from admin_users where email = '...';`

### 4.5 Deploy ke Vercel
1. Push ke GitHub; di Vercel **Add New Project** → import repo, set **Root Directory** = `mil-cms` bila berada dalam repo lain. Framework: Next.js. Node 22+ (otomatis dari `engines`).
2. Isi environment variables (tabel 4.3) untuk Production & Preview.
3. **Settings → Functions → Region**: pilih **Singapore (sin1)** agar dekat dengan database Neon.
4. Deploy, tambahkan custom domain, lalu jalankan ulang `npm run storage:cors -- <domain>` bila domain bertambah.
5. Login di `https://domain-anda.com/admin` → Media Library → **Pindahkan semua** → **Publish**.

Perubahan konten **tidak memerlukan redeploy**.

---

## 5. Pengujian

```bash
npm run lint             # TypeScript
npm run test:fidelity    # markup render == HTML original (token per token)
npm run test:analytics   # metric analytics vs event uji (database uji lokal, lihat docs/ANALYTICS.md)
npm run build
```

Yang sudah diuji selama pengembangan (Postgres 16 lokal yang meniru Neon: owner non-superuser + role `cms_app`; Object Storage diganti tiruan S3 path-style lokal):
- **Fidelity visual**: screenshot full-page HTML original vs website baru di Chrome headless pada 1440, 1024, 820 dan 390 px → **0 piksel berbeda**.
- **Markup**: `npm run test:fidelity` lolos (dan terbukti gagal bila satu karakter diubah).
- **RLS** sebagai role `cms_app`: tanpa user → 0 baris & tidak bisa publish; user non-admin → tidak bisa membaca/menulis/menjadikan diri admin/menambah media; admin → hanya bisa menulis draft, tidak bisa menulis `published_value` langsung; `app.user_id` tidak bocor antar transaksi.
- **API**: tanpa sesi / cookie palsu → 401; non-admin → 403; registrasi publik ditolak; validasi server menolak `javascript:` URL, field tak dikenal, SVG, file terlalu besar, key storage sembarang.
- **Alur admin end-to-end di browser**: login, validasi, draft, cancel, preview, upload/ganti/hapus media, testimoni (video + poster, urutan), publish → langsung live, restore versi, SEO & WhatsApp, pindahkan semua asset original ke Object Storage, logout.
- **Fallback**: database tidak tersedia → halaman tetap tampil.

---

## 6. Menambah field baru (developer)
1. Tambahkan field + nilai default di `src/content/schema.ts`.
2. Gunakan nilainya di `src/site/render.ts`.
3. `npm run db:seed-sql` lalu jalankan `db/seed.sql` (aman diulang — baris yang ada tidak ditimpa).
Form admin otomatis muncul dari schema.

## 7. Catatan
- **Lisensi font**: SF Pro Display adalah font Apple dengan lisensi terbatas untuk penggunaan web. Font ini sudah dipakai di file original; pastikan penggunaannya sesuai lisensi, atau ganti dengan font berlisensi web.
- Nomor WhatsApp default `6281234567890` berasal dari file original (placeholder) — **ganti di CMS › SEO & Settings**.
