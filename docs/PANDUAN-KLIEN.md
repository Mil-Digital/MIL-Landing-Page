# Panduan Content Studio — Website MIL Digital

Content Studio adalah halaman admin untuk mengubah isi website MIL Digital (teks, gambar, video, SEO dan nomor WhatsApp) tanpa perlu developer.

## 1. Masuk
1. Buka **https://[domain-website]/admin**
2. Masukkan email dan password yang diberikan.
3. Setelah login pertama, **ganti password** di menu **Akun** (klik nama Anda di kiri bawah).
4. Lupa password? Hubungi pengelola/developer website untuk dibuatkan password baru, lalu segera ganti di menu **Akun**.

## 2. Cara kerja: Draft → Preview → Publish
Perubahan **tidak langsung terlihat** oleh pengunjung. Alurnya:

1. **Edit** isian di salah satu section.
2. Klik **Simpan draft** (bar hitam di bawah layar, atau tekan Ctrl/⌘ + S).
3. Klik **Preview** (kanan atas) untuk melihat hasilnya. Ada label “PREVIEW” di pojok kiri bawah.
4. Kalau sudah sesuai, klik **Publish** → isi catatan singkat (opsional) → **Publish sekarang**.
5. Website langsung ter-update dalam hitungan detik.

Status di kanan atas:
- 🟢 **Published**: semua perubahan sudah tampil di website.
- 🟠 **Draft · N perubahan**: ada perubahan tersimpan yang belum dipublikasikan. Section yang berubah ditandai titik oranye di menu kiri.

Klik **Batalkan perubahan** untuk membuang editan yang belum disimpan.

## 3. Mengedit teks
Setiap section punya form yang dikelompokkan sesuai tampilan di website (Hero, Brand Statistics, MIL Workflow, Our Services, Additional Services, Testimonials, Closing CTA, Footer).

Beberapa isian punya tombol format kecil:
- **✦ Warna oranye / Miring berwarna**: blok kata lalu klik. Kata akan diberi tanda `*kata*` dan tampil berwarna di website.
- **⟷ Jangan dipisah baris**: blok beberapa kata agar tidak terpotong ke baris berikutnya, misalnya “lebih efektif.” Tandanya `[[...]]`.
- Kotak **Pratinjau** di bawah isian menunjukkan hasil formatnya.

Kolom bertanda **\*** wajib diisi. Bila ada yang salah (misalnya URL tidak valid), isian ditandai merah dan draft belum tersimpan.

## 4. Gambar & video
Di isian gambar/video:
- **Upload / Ganti**: pilih file dari komputer (atau tarik & lepas file ke kotaknya).
- **Media Library**: pilih file yang sudah pernah diunggah.
- Isi **teks alternatif (alt)**: deskripsi singkat gambar, penting untuk Google & aksesibilitas.

Ketentuan file:
- Gambar: JPG, PNG, WebP, AVIF, GIF, maksimal 10 MB. Kompres dulu agar website tetap cepat (mis. squoosh.app).
- Video: MP4 (disarankan), WebM, MOV, maksimal 50 MB. Testimoni sebaiknya rasio 9:16 (vertikal).
- Logo klien sebaiknya PNG transparan berwarna putih.

### Menu Media Library
- Lihat semua file beserta nama, ukuran, tipe dan dimensinya. Klik gambar untuk memperbesar.
- Label **Live / Draft** menunjukkan di section mana file sedang dipakai.
- **Ganti**: mengganti file. Semua konten yang memakai file itu ikut diperbarui (lalu Publish).
- **Hapus**: hanya bisa untuk file yang **tidak dipakai**.
- **File original (bawaan website)**: klik **Pindahkan semua** sekali saja agar file bawaan bisa dikelola dari Media Library, lalu Publish.

## 5. Testimoni, layanan & daftar lain
Untuk daftar berulang (testimoni, kartu layanan, tag, logo klien, statistik, link sosial media):
- **+ Tambah …** untuk menambah item baru.
- Klik judul item untuk membuka atau menutupnya.
- **↑ ↓** untuk mengubah urutan, **⧉** untuk menduplikasi, **🗑** untuk menghapus.

Testimoni: pilih jenis **Video testimoni**, isi nama klien (mis. @namabrand), upload **Video** dan **Thumbnail/poster** (gambar sebelum video diputar). Keduanya bisa diganti terpisah.

Testimoni teks (carousel di bawah video): di **Testimonials › Testimoni teks (carousel)**, tiap kutipan berisi **Isi testimoni** (tanpa tanda kutip — ditambahkan otomatis), **Nama**, **Jabatan / brand**, **Foto latar** (foto lebar ±1400×375 px) dan **Logo brand** (pilih bentuk bulat atau kotak). Carousel bergeser otomatis dan berhenti saat kursor di atasnya. Kosongkan daftar untuk menyembunyikan carousel.

## 6. SEO & Settings
- **Meta title & description**: judul dan ringkasan yang tampil di Google.
- **Gambar share**: gambar yang muncul saat link dibagikan di WhatsApp/LinkedIn (ideal 1200×630 px).
- **Nomor WhatsApp**: format `62` + nomor tanpa 0 di depan, contoh `6281234567890`. Dipakai oleh semua tombol “Klik untuk ngobrol” dan tombol WhatsApp melayang.
- **Pesan otomatis**: teks yang sudah terisi ketika pengunjung membuka WhatsApp.

Tombol CTA di Hero dan Closing CTA otomatis membuka WhatsApp. Isi **Link tujuan tombol** hanya bila tombol harus mengarah ke halaman lain.

## 7. Riwayat versi
Setiap Publish menyimpan salinan lengkap website.
- **Lihat**: membuka tampilan versi tersebut.
- **Pulihkan**: memuat versi lama ke draft. Cek Preview, lalu Publish untuk menerapkannya.
- **Buang draft belum publish**: menghapus semua perubahan yang belum dipublikasikan.
- Versi 1 adalah konten original website, jadi selalu bisa dikembalikan.

## 8. Preview responsif
Menu **Preview responsif** menampilkan draft atau website live dalam ukuran Desktop, Laptop, Tablet dan Mobile sebelum Publish.

## 9. Tips
- Selalu cek **Preview** (termasuk tampilan Mobile) sebelum Publish.
- Headline yang terlalu panjang bisa membuat baris turun. Usahakan panjangnya mirip dengan teks aslinya.
- Tombol **Konten original** di tiap section mengisi ulang form dengan teks asli website (perlu Simpan draft + Publish).
- Butuh akses untuk anggota tim lain? Hubungi developer/pengelola website.
