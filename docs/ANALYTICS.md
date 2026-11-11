# Website Analytics, Heatmap & Video Analytics — MIL Digital

Analytics first-party yang terintegrasi dengan Content Studio (CMS). Tidak memakai layanan pihak ketiga:
data disimpan di database Neon yang sama, login memakai Better Auth yang sama, dan dashboard ada di
**CMS › Analytics**.

> Catatan audit: project ini memakai **Neon Postgres + Better Auth + Neon Object Storage** (bukan Supabase).
> Sesuai brief ("gunakan infrastruktur yang sudah ada"), analytics dibangun di atas stack tersebut —
> tidak ada database, auth, atau backend baru.

---

## 1. Arsitektur

```
Pengunjung ──► /  (HTML original + atribut data-analytics-* + <script defer src="/mil-analytics.js">)
                 │  tracker (±9 KB, tanpa dependency, tanpa cookie)
                 │  · consent banner (opt-in default) · DNT/GPC dihormati
                 │  · batching: kirim tiap 10 dtk / 40 event / saat tab ditutup (sendBeacon)
                 ▼
         POST /api/collect   (publik, anonim)
                 │  tolak: bot, admin (cookie sesi CMS), IP dikecualikan, cross-site, body > 64 KB
                 │  rate limit per IP (in-memory) · validasi + normalisasi payload di server
                 ▼
         analytics_ingest(jsonb)  ← fungsi SECURITY DEFINER (cms_app TIDAK punya hak INSERT)
                 ▼
         analytics_* tables  (RLS: SELECT hanya is_admin())

Admin ──► /admin/analytics ──► GET /api/admin/analytics?view=…  (sesi + admin_users + RLS)
                                  agregasi di Postgres (tidak pernah mengunduh raw events)
Vercel Cron (harian) ──► /api/cron/analytics-retention ──► analytics_purge('older_than', N)
```

### File

| File | Fungsi |
|---|---|
| `db/migrations/002_analytics.sql` | Tabel, index, RLS, `analytics_ingest()`, `analytics_purge()` |
| `public/mil-analytics.js` | Tracker browser |
| `src/site/render.ts` | Atribut `data-analytics-id/label/kind`, `data-analytics-section`, `data-analytics-video`, tag script |
| `src/app/api/collect/route.ts` | Endpoint publik penerima event |
| `src/lib/analytics/ingest.ts` | Validasi & normalisasi payload |
| `src/lib/analytics/classify.ts` | Bot filter, parsing user agent, klasifikasi channel |
| `src/lib/analytics/queries.ts` | Query dashboard (agregasi SQL) |
| `src/lib/analytics/config.ts` | Konfigurasi (env) |
| `src/app/api/admin/analytics/…` | API dashboard + hapus data |
| `src/app/api/cron/analytics-retention/route.ts` | Retensi harian |
| `src/app/admin/(dash)/analytics/page.tsx`, `src/components/admin/analytics/*` | Dashboard |
| `scripts/analytics-test.ts` | Tes metric dengan event uji (73 assertion) |
| `vercel.json` | Jadwal cron retensi |

### Tabel

| Tabel | Isi | Index utama |
|---|---|---|
| `analytics_visitors` | ID pseudonim, first/last seen | `first_seen` |
| `analytics_sessions` | Atribusi (referrer, UTM, channel), device/browser/OS, geo perkiraan, ringkasan (page views, durasi aktif, engaged) | `started_at`, `(channel, started_at)`, `(device, started_at)`, `(visitor_id, started_at)` |
| `analytics_pageviews` | Path, layout version, layout bucket, viewport, waktu aktif, scroll maksimum, waktu per section | `(session_id, started_at)`, `started_at` |
| `analytics_events` | click / hover / exposure / scroll — posisi relatif (bukan piksel layar) | `(session_id, type)`, `(element, type)`, `ts` |
| `analytics_elements` | Nama elemen yang mudah dibaca | PK |
| `analytics_video_views` | Ringkasan per page view per video (waktu tonton nyata, titik terjauh, selesai) | `session_id`, `(video_id, first_ts)` |
| `analytics_video_events` | play, pause, resume, seek, complete, exit, milestone | `(session_id, video_id, type)` |

Dedup: setiap event punya `(pageview_id, seq)` unik → retry jaringan / batch ganda tidak menghitung dua kali.
Nilai kumulatif (waktu aktif, scroll, waktu tonton) di-upsert dengan `greatest()` sehingga batch yang
datang terlambat tidak menurunkan angka.

---

## 2. Setup

### 2.1 Database (Neon SQL Editor, sebagai `neondb_owner`)
Jalankan **`db/migrations/002_analytics.sql`** (setelah `001_schema.sql`). Aman diulang.

### 2.2 Environment variables (Vercel › Settings › Environment Variables)

| Variable | Wajib | Default | Keterangan |
|---|:-:|---|---|
| `CRON_SECRET` | ✅ | — | String acak (`openssl rand -hex 32`). Vercel otomatis mengirimnya ke cron retensi. |
| `ANALYTICS_CONSENT_MODE` | | `opt-in` | `opt-in` (tidak merekam sebelum "Izinkan"), `notice` (merekam, pengunjung bisa "Tolak"), `none` (tanpa banner — hanya jika consent dikelola alat lain). |
| `ANALYTICS_TZ` | | `Asia/Jakarta` | Zona waktu semua tanggal di dashboard. |
| `ANALYTICS_RETENTION_DAYS` | | `395` | Data lebih lama dihapus otomatis (min. 30). |
| `ANALYTICS_EXCLUDE_IPS` | | — | IP kantor/agency dipisah koma; tidak dihitung (IP tidak pernah disimpan). |
| `ANALYTICS_ENABLED` | | `true` | `false` = berhenti merekam (dashboard tetap bisa dibuka). |

Variabel lama (`DATABASE_URL`, `BETTER_AUTH_SECRET`, …) tidak berubah. Tidak ada variabel `NEXT_PUBLIC_*`.

### 2.3 Deploy ke Vercel
1. Jalankan migration 2.1 di Neon **sebelum** deploy (kalau belum, `/api/collect` menjawab 503 dan tracker menyimpan antrean untuk dikirim ulang — website tetap normal).
2. Set `CRON_SECRET` (+ opsional lainnya), lalu deploy seperti biasa. `vercel.json` mendaftarkan cron harian 19:30 UTC (02:30 WIB).
3. **Disarankan:** Vercel › Firewall › tambah *Rate Limit rule* untuk path `/api/collect` (mis. 120 request / 60 detik per IP). Rate limit di kode bersifat per-instance (best effort).
4. Region fungsi tetap **sin1** (dekat Neon Singapore).
5. Buka website di browser biasa (tidak login CMS), setujui banner, klik beberapa tombol → dalam ±10 detik data muncul di **CMS › Analytics** (rentang "Hari ini").

### 2.4 Tes
```bash
npm run lint && npm run test:fidelity && npm run build
# Tes metric — HANYA ke database uji (nama database harus mengandung "test"; tabel analytics dikosongkan):
ANALYTICS_TEST_OWNER_URL=postgresql://<owner>@localhost/mil_analytics_test \
ANALYTICS_TEST_APP_URL=postgresql://cms_app@localhost/mil_analytics_test npm run test:analytics
```

---

## 3. Panduan dashboard (CMS › Analytics)

Filter di atas berlaku untuk semua tab: **periode** (Hari ini, Kemarin, 7/30/90 hari, kustom),
**interval grafik** (Auto/Harian/Mingguan/Bulanan; "Hari ini/Kemarin" otomatis per jam), **device**, dan
**sumber traffic**. Setiap kartu membandingkan dengan periode sebelumnya yang sama panjangnya
("baru" = periode sebelumnya belum ada data). Ikon ⓘ menjelaskan definisi & penyebut setiap metric.

| Tab | Isi |
|---|---|
| Overview | 10 KPI utama, grafik traffic, interaksi teratas |
| Traffic | 9 metric traffic, grafik (visitors/sessions/page views), channel (donut + tabel), kampanye UTM, referring domain, negara/kota, device, browser, OS, new vs returning, top pages, performa tiap section |
| Clicks & Interactions | Klik, CTR, hover; ranking Most clicked / Highest CTR / Most hovered / Highest engagement; clicks over time; tabel semua elemen |
| Heatmaps | Pilih Desktop/Tablet/Mobile dan Click heatmap / Attention (hover) / Scroll map, di atas website live. Default hanya **layout saat ini**. |
| Video Analytics | Ringkasan, tabel perbandingan video, retention chart dengan drop-off, semua metric per video |
| Data & Privasi | Status consent & retensi, kecualikan browser ini, hapus data (lama / satu pengunjung / semua — owner) |

**Cara membaca heatmap**
- *Click*: makin pekat = makin banyak klik. Angka di atas elemen = jumlah klik & persentase dari semua klik. Elemen melayang (tombol WhatsApp) ditampilkan di panel samping karena posisinya mengikuti layar, bukan halaman.
- *Attention (hover)*: kotak makin oranye = total waktu kursor makin lama. **Hover adalah indikator gerakan mouse, bukan bukti pengunjung melihat area itu dengan mata.** Hanya dari perangkat dengan mouse.
- *Scroll map*: area makin gelap = makin sedikit yang scroll sampai sana. Garis putus-putus menandai titik 75% / 50% / 25% pengunjung; label kiri = persentase page view yang melihat tiap section.
- Di bawah **30 interaksi** dashboard menampilkan "Data belum representatif" (bisa tetap ditampilkan dengan peringatan).
- Setelah konten dipublish ulang, "layout saat ini" mulai dari nol; pilih "Semua versi layout" atau versi lama untuk data sebelumnya.

**Cara kerja posisi heatmap.** Klik disimpan relatif terhadap elemen (`data-analytics-id`, posisi 0–1 di dalam elemen) atau relatif terhadap section (x = % lebar layar, y = % tinggi section). Saat ditampilkan, posisi dihitung ulang dari elemen/section di preview → tetap akurat di resolusi berbeda dan ketika layout responsif berubah. Data dikelompokkan per *layout bucket* sesuai breakpoint CSS website: Desktop > 1100 px (preview 1440), Tablet 701–1100 px (preview 820), Mobile ≤ 700 px (preview 390). Setiap page view menyimpan *layout version* (versi template + hash konten yang dipublish).

---

## 4. Definisi metric

Semua metric dihitung dari sesi yang **dimulai** di periode terpilih (zona waktu `ANALYTICS_TZ`) dan cocok
dengan filter device/sumber, sehingga pembilang & penyebut setiap rasio berasal dari kumpulan sesi yang sama.

### Traffic
| Metric | Definisi |
|---|---|
| Unique Visitors | Jumlah ID pengunjung berbeda (per browser/perangkat). |
| Total Visitors | Jumlah pengunjung unik per hari, dijumlahkan (orang yang sama di 2 hari = 2). |
| Sessions | Kunjungan. Berakhir setelah **30 menit** tanpa aktivitas; sesi baru juga dimulai bila datang lewat kampanye UTM berbeda. Refresh ≠ sesi baru. |
| Page Views | Halaman dimuat (refresh = page view baru). |
| Pages / Session | Page views ÷ sessions. |
| Avg. Session Duration | Rata-rata waktu **aktif** per sesi (tab terlihat, tidak idle > 2 menit). |
| Bounce Rate | Sesi tidak engaged ÷ semua sesi. Engaged = aktif ≥ 10 dtk, atau ≥ 2 page view, atau ≥ 1 klik pada elemen dilacak. |
| New / Returning Visitors | Pengunjung dengan sesi pertama-kali / sesi kembali di periode ini (satu orang bisa masuk keduanya). |
| Channel | UTM medium → click ID iklan (gclid/msclkid/dclid) → domain referrer (search/social/lainnya) → Direct. |
| Top pages: Bounce / Exit rate | Bounce = sesi masuk di halaman itu & tidak engaged ÷ sesi masuk di halaman itu. Exit = page view terakhir sesi ÷ page view halaman itu. |
| Section reach / time | Page view di mana section terlihat (≥ 30% section atau ≥ 50% layar) ÷ page views; rata-rata waktu terlihat. |

### Klik & hover
| Metric | Definisi |
|---|---|
| Exposure | Page view di mana elemen ≥ 50% terlihat (dan benar-benar tampil) — sekali per page view. |
| Clicks / Unique clicks | Semua klik / jumlah sesi yang mengklik. |
| **CTR** | Sesi yang mengklik ÷ **sesi yang melihat elemen** (exposure). Ranking CTR hanya untuk elemen dengan ≥ 20 sesi exposure. |
| Hover | Kursor ≥ 500 ms di atas elemen (maks. 30 dtk dicatat, maks. 20 per elemen per page view). Desktop/mouse saja. |
| Engagement | Sesi yang klik atau hover elemen ÷ sesi exposure. |
| Total CTA Clicks | Klik elemen ber-`kind` `cta` (Hero, Closing CTA) dan `whatsapp` (tombol melayang). |
| Overall Click Rate | Sesi dengan ≥ 1 klik elemen ÷ semua sesi. |

### Video
Waktu tonton = **waktu putar nyata** (dijumlahkan dari kemajuan `currentTime` saat memutar; pause, buffering, dan seek tidak dihitung). Persentase progress dihitung dari titik terjauh yang dicapai **dengan menonton**, bukan dengan seek. Unit "unique" = satu page view per video.

| Metric | Definisi | Penyebut |
|---|---|---|
| Impressions | Page view di mana video ≥ 50% terlihat | — |
| Total Plays | Mulai memutar (termasuk replay setelah selesai; resume setelah pause tidak) | — |
| Unique Plays | Page view di mana video diputar | — |
| 3-Second / 10-Second Plays | Unique plays dengan waktu tonton ≥ 3 / 10 dtk | — |
| 25/50/75/95% Views | Unique plays yang mencapai titik itu | — |
| Completed Views | Unique plays yang sampai akhir (`ended`) | — |
| **ThruPlay** | Ditonton ≥ 15 dtk, atau sampai selesai bila video < 15 dtk (definisi Meta) | — |
| Average Watch Time | Rata-rata waktu tonton nyata | unique plays |
| Avg. % Watched | Rata-rata titik terjauh ÷ durasi | unique plays |
| Video Play Rate | Impressions yang diputar | **impressions** |
| 3-Second View Rate | Unique 3-second plays | **impressions** |
| ThruPlay Rate | Unique ThruPlays | **impressions** |
| Completion Rate | Unique completed views | **unique plays** |
| Retention | % unique plays yang mencapai 0%, 3 dtk, 25/50/75/95/100%; drop-off = selisih dengan titik sebelumnya | unique plays |
| Exit | Halaman ditinggalkan saat video sudah diputar tapi belum selesai | — |

---

## 5. Privasi
- **Tanpa cookie**, tanpa fingerprinting. ID visitor & sesi = UUID acak di `localStorage`, hanya dibuat setelah persetujuan (mode opt-in).
- **Tidak disimpan:** alamat IP (hanya dipakai sementara di memori untuk rate limit, di-hash), isi input/textarea/form, teks halaman, query string URL & referrer, gerakan mouse mentah, posisi scroll mentah, rekaman layar.
- Geo = negara/region/kota dari header edge Vercel (perkiraan, bukan GPS).
- **Do-Not-Track / Global Privacy Control** → tidak ada tracking, tidak ada banner.
- **Tolak** pada banner → tracking berhenti, ID dihapus dari browser; ditanya ulang setelah 6 bulan. Reset: `?mil_consent=reset`.
- Traffic internal: browser yang membuka CMS otomatis dikecualikan; selama login CMS, server membuang request-nya; perangkat lain: `?mil_internal=1` (batalkan: `?mil_internal=0`); kantor: `ANALYTICS_EXCLUDE_IPS`.
- Retensi otomatis (default 395 hari), hapus manual di tab **Data & Privasi**, termasuk per pengunjung (ID dapat dilihat pengunjung via `milAnalytics.visitorId()` di console).
- Bot: user agent crawler/headless/monitoring dibuang di server; browser otomatis (`navigator.webdriver`) dilewati tracker.
- Disarankan memperbarui Kebijakan Privasi website: sebutkan analytics first-party, data yang dikumpulkan (di atas), tujuan, retensi, dan cara menolak.

---

## 6. Yang sudah diuji

Di Postgres 16 lokal yang meniru Neon (owner non-superuser + role `cms_app` tanpa BYPASSRLS), build produksi (`next build && next start`), dan Google Chrome sungguhan (H.264) via Playwright:

| # | Fitur | Hasil |
|---|---|---|
| 1 | Page view tracking | ✅ batch pertama 1,5 dtk; sendBeacon saat halaman ditutup |
| 2 | Visitor & session | ✅ refresh = sesi & visitor sama, page view baru; visitor kembali = returning |
| 3 | UTM attribution | ✅ source/medium/campaign/content/term tersimpan, tetap melekat setelah pindah halaman; Google → Organic, gclid/cpc → Paid, email → Email |
| 4 | Click tracking CTA | ✅ Hero CTA, Closing CTA, WhatsApp melayang (ditandai fixed), workflow tabs, service cards, tombol play |
| 5 | Hover desktop | ✅ ≥ 500 ms tercatat; tidak ada hover dari perangkat sentuh |
| 6 | Scroll depth | ✅ milestone 25/50/75/90/100 + waktu per section |
| 7 | Heatmap rendering | ✅ click / attention / scroll di Desktop, Tablet, Mobile; empty state & peringatan sampel kecil |
| 8–11 | Video play, 3 dtk, ThruPlay, completion | ✅ ThruPlay terpicu tepat di 15,0 dtk waktu putar; completion & retention benar (juga di 8× playback rate) |
| 12–13 | Filter device & tanggal | ✅ (`npm run test:analytics`) |
| 14 | Auth admin | ✅ API tanpa admin → 401/403; RLS: tanpa user / non-admin → 0 baris; `cms_app` tidak bisa INSERT langsung |
| 15 | Internal traffic | ✅ `?mil_internal=1`, browser CMS, dan request dengan cookie sesi CMS tidak tercatat |
| 16 | Duplicate prevention | ✅ batch dikirim ulang tidak menggandakan; inisialisasi tracker kedua diabaikan; snapshot lama tidak menurunkan angka; session ID milik visitor lain ditolak |
| 17 | Privacy & consent | ✅ opt-in: 0 request & tanpa ID sebelum "Izinkan"; "Tolak": 0 request, ID dihapus; DNT: 0 request, tanpa banner |
| 18 | Performa | ✅ script `defer` + inisialisasi saat idle, listener pasif, 1 request / 10 dtk; tidak mengubah markup/CSS (tes fidelity tetap lolos) |
| — | Metric | ✅ `npm run test:analytics`: 73/73 assertion (semua metric di atas dihitung dari event uji dengan nilai yang diketahui) |

---

## 7. Konfigurasi manual yang masih perlu dilakukan
1. Jalankan `db/migrations/002_analytics.sql` di Neon production.
2. Set `CRON_SECRET` di Vercel (dan opsional `ANALYTICS_*`).
3. Tambah Vercel Firewall rate-limit rule untuk `/api/collect`.
4. Putuskan mode consent dengan tim legal (default `opt-in` = paling aman, tetapi hanya pengunjung yang setuju yang terhitung — angka akan lebih rendah dari Google Analytics tanpa consent).
5. Perbarui Kebijakan Privasi website.
6. Kecualikan perangkat tim yang tidak login CMS (`?mil_internal=1`) dan/atau set `ANALYTICS_EXCLUDE_IPS`.

## 8. Keterbatasan & alternatif
- **Video:** website saat ini hanya memakai video **HTML5** (2 testimoni, file MP4) — tidak ada YouTube/Vimeo, jadi hanya adaptor HTML5 yang dibuat. Bila nanti memakai embed, tambahkan adaptor dengan API resmi (YouTube IFrame Player API `onStateChange` + polling `getCurrentTime()`, atau Vimeo Player SDK `timeupdate`) yang mengisi struktur event yang sama (`play`, `m3s`, `thruplay`, `p25`…).
- **Opt-in consent** berarti pengunjung yang tidak memilih/menolak tidak terhitung sama sekali.
- **Geo** kosong ("Unknown") saat dijalankan di luar Vercel (header geolokasi hanya ada di Vercel).
- **Unique visitors** dihitung per browser: orang yang sama di HP & laptop, atau yang menghapus storage, dihitung dua kali (konsekuensi tidak memakai fingerprinting).
- **Hover** bukan eye-tracking; di perangkat sentuh tidak diukur (klik/tap tetap tercatat).
- **Rate limit** di aplikasi bersifat per instance serverless — gunakan Vercel Firewall untuk batas global.
- **Heatmap** untuk klik di luar elemen yang dilacak dipetakan per section (posisi horizontal relatif lebar layar) — cukup akurat untuk layout yang terpusat, bukan per piksel.
- Agregasi dilakukan langsung di Postgres dengan index; untuk volume sangat besar (jutaan event/bulan) tambahkan tabel rollup harian/materialized view.
