import type { SectionDef, SiteContent, Field } from "./types";

/* ------------------------------------------------------------------ *
 * Reusable field sets
 * ------------------------------------------------------------------ */

const tagRepeater = (key: string, label: string, help?: string): Field => ({
  key,
  type: "repeater",
  label,
  help,
  itemLabel: "Tag",
  titleKey: "label",
  newItem: { label: "", icon: "research" },
  fields: [
    { key: "label", type: "text", label: "Teks tag", required: true },
    { key: "icon", type: "icon", set: "tag", label: "Ikon" },
  ],
});

const clientLogoRepeater: Field = {
  key: "clients",
  type: "repeater",
  label: "Featured clients (logo)",
  help: "Logo klien yang ditampilkan di bawah kartu. Kosongkan untuk menyembunyikan bagian ini.",
  itemLabel: "Logo klien",
  titleKey: "logo.alt",
  max: 6,
  newItem: { logo: { url: "", alt: "" }, height: 30 },
  fields: [
    { key: "logo", type: "image", label: "Logo", withAlt: true, required: true, help: "PNG transparan berwarna putih direkomendasikan." },
    {
      key: "height",
      type: "number",
      label: "Tinggi visual logo",
      min: 10,
      max: 60,
      step: 0.1,
      help: "Mengatur tinggi tampilan logo agar seimbang secara visual (nilai asli: 18–44).",
    },
  ],
};

const ctaLinkHelp =
  "Kosongkan untuk otomatis membuka WhatsApp (nomor & pesan diatur di Settings). Isi dengan URL lain (https://…) untuk mengarahkan tombol ke halaman berbeda.";

/* ------------------------------------------------------------------ *
 * Sections (order = order in the admin sidebar and on the page)
 * ------------------------------------------------------------------ */

export const SECTIONS: SectionDef[] = [
  {
    id: "hero",
    label: "Hero",
    icon: "hero",
    description: "Bagian paling atas halaman: logo, headline utama, statistik, dan tombol ajakan.",
    groups: [
      {
        title: "Navigasi",
        fields: [
          { key: "logo", type: "image", label: "Logo", withAlt: true, required: true, help: "Logo putih di atas latar foto." },
          { key: "tagline", type: "text", label: "Tagline di kanan logo", maxLength: 60 },
        ],
      },
      {
        title: "Latar belakang",
        fields: [
          {
            key: "background",
            type: "image",
            label: "Foto latar hero",
            decorative: true,
            required: true,
            help: "Foto penuh di belakang headline. Rekomendasi minimal 1500×1000 px (landscape).",
          },
        ],
      },
      {
        title: "Headline & deskripsi",
        fields: [
          { key: "headlineLine1", type: "inline", label: "Headline – baris 1", highlight: "accent", required: true },
          {
            key: "headlineLine2",
            type: "inline",
            label: "Headline – baris 2",
            highlight: "accent",
            help: "Gunakan *kata* untuk warna oranye.",
          },
          { key: "description", type: "inline", label: "Deskripsi pendukung", multiline: true },
        ],
      },
      {
        title: "Statistik",
        fields: [
          { key: "statsLabel", type: "text", label: "Label statistik", help: "Teks kecil sebelum angka, mis. “Trusted by”." },
          {
            key: "stats",
            type: "repeater",
            label: "Angka statistik",
            itemLabel: "Statistik",
            titleKey: "label",
            max: 4,
            newItem: { value: "", suffix: "+", label: "" },
            fields: [
              { key: "value", type: "text", label: "Angka", required: true, placeholder: "150" },
              { key: "suffix", type: "text", label: "Akhiran", placeholder: "+", maxLength: 4 },
              { key: "label", type: "text", label: "Keterangan", required: true, placeholder: "Brands" },
            ],
          },
        ],
      },
      {
        title: "Tombol CTA",
        fields: [
          { key: "ctaText", type: "inline", label: "Teks tombol", required: true },
          { key: "ctaUrl", type: "url", label: "Link tujuan tombol", help: ctaLinkHelp, placeholder: "(WhatsApp)" },
          { key: "ctaNote", type: "inline", label: "Catatan di samping tombol", multiline: true },
        ],
      },
    ],
  },

  {
    id: "clients",
    label: "Brand Statistics",
    icon: "stats",
    description: "Section jumlah brand yang telah berkolaborasi beserta panel logo klien.",
    groups: [
      {
        title: "Judul & deskripsi",
        fields: [
          { key: "brandCount", type: "text", label: "Angka sorotan di judul", placeholder: "150+", help: "Ditampilkan tebal di awal judul." },
          { key: "headline", type: "inline", label: "Judul", required: true },
          { key: "description", type: "inline", label: "Deskripsi", multiline: true },
        ],
      },
      {
        title: "Panel logo klien",
        description: "Gambar berisi kumpulan logo klien. Versi desktop dan mobile memiliki tata letak berbeda.",
        fields: [
          { key: "logoWallDesktop", type: "image", label: "Logo wall – desktop", withAlt: true, required: true, help: "Rasio asli 2700×840 px." },
          { key: "logoWallMobile", type: "image", label: "Logo wall – mobile", withAlt: true, required: true, help: "Rasio asli 1800×1260 px." },
        ],
      },
    ],
  },

  {
    id: "workflow",
    label: "MIL Workflow",
    icon: "workflow",
    description: "Diagram siklus 3 tahap (Assessment, Strategize, Monitoring) beserta detailnya.",
    groups: [
      {
        title: "Judul section",
        fields: [
          { key: "eyebrow", type: "text", label: "Label kecil (badge)" },
          { key: "headline", type: "inline", label: "Judul", highlight: "em", required: true, help: "Gunakan *kata* untuk teks miring berwarna." },
          { key: "description", type: "inline", label: "Deskripsi", multiline: true },
        ],
      },
      {
        title: "Diagram",
        fields: [
          { key: "centerLabel", type: "text", label: "Teks di tengah diagram" },
          { key: "hint", type: "text", label: "Petunjuk interaksi" },
          { key: "tablistLabel", type: "text", label: "Label aksesibilitas diagram", help: "Dibacakan oleh screen reader." },
        ],
      },
      {
        title: "Tahapan",
        description: "Diagram dirancang untuk tepat 3 tahap, jadi jumlah tahap tidak dapat ditambah atau dikurangi.",
        fields: [
          {
            key: "stages",
            type: "repeater",
            label: "Tahap workflow",
            itemLabel: "Tahap",
            titleKey: "title",
            fixed: true,
            min: 3,
            max: 3,
            newItem: {},
            fields: [
              { key: "title", type: "text", label: "Nama tahap", required: true },
              { key: "tagline", type: "text", label: "Tagline" },
              { key: "description", type: "inline", label: "Deskripsi", multiline: true },
              { key: "listLabel", type: "text", label: "Judul daftar", placeholder: "Our Methods" },
              { key: "items", type: "list", label: "Daftar metode / fokus / aktivitas", itemLabel: "Item" },
            ],
          },
        ],
      },
    ],
  },

  {
    id: "services",
    label: "Our Services",
    icon: "services",
    description: "Judul section layanan dan kartu Core Services.",
    groups: [
      {
        title: "Judul section",
        fields: [
          { key: "eyebrow", type: "text", label: "Label kecil (badge)" },
          { key: "headlineLine1", type: "text", label: "Judul – baris 1", required: true },
          { key: "headlineLine2", type: "text", label: "Judul – baris 2" },
          { key: "description", type: "inline", label: "Deskripsi", multiline: true },
          { key: "coreLabel", type: "text", label: "Label grup layanan utama" },
        ],
      },
      {
        title: "Core services",
        description: "Nomor kartu (01, 02, …) dibuat otomatis sesuai urutan.",
        fields: [
          {
            key: "core",
            type: "repeater",
            label: "Kartu layanan",
            itemLabel: "Layanan",
            titleKey: "title",
            max: 6,
            newItem: { icon: "consulting", title: "", description: "", tags: [], clients: [] },
            fields: [
              { key: "icon", type: "icon", set: "card", label: "Ikon kartu" },
              { key: "title", type: "text", label: "Nama layanan", required: true },
              { key: "description", type: "textarea", label: "Deskripsi", rows: 3 },
              tagRepeater("tags", "Tag / kategori layanan"),
              clientLogoRepeater,
            ],
          },
        ],
      },
    ],
  },

  {
    id: "additional",
    label: "Additional Services",
    icon: "plus",
    description: "Kartu layanan tambahan (User Research, Website Development & SEO) dengan logo klien.",
    groups: [
      {
        title: "Judul grup",
        fields: [{ key: "label", type: "text", label: "Label grup" }],
      },
      {
        title: "Kartu layanan tambahan",
        fields: [
          {
            key: "items",
            type: "repeater",
            label: "Layanan tambahan",
            itemLabel: "Layanan",
            titleKey: "title",
            max: 4,
            newItem: { icon: "user-research", title: "", description: "", tags: [], clientsLabel: "Featured clients", clients: [], moreText: "& many more" },
            fields: [
              { key: "icon", type: "icon", set: "card", label: "Ikon" },
              { key: "title", type: "text", label: "Nama layanan", required: true },
              { key: "description", type: "textarea", label: "Deskripsi", rows: 3 },
              tagRepeater("tags", "Daftar aktivitas"),
              { key: "clientsLabel", type: "text", label: "Judul featured clients" },
              clientLogoRepeater,
              { key: "moreText", type: "text", label: "Teks di bawah logo", placeholder: "& many more" },
            ],
          },
        ],
      },
    ],
  },

  {
    id: "testimonials",
    label: "Testimonials",
    icon: "video",
    description: "Video testimoni klien. Urutan kartu sama dengan urutan di halaman.",
    groups: [
      {
        title: "Judul",
        fields: [{ key: "headline", type: "inline", label: "Judul section", required: true }],
      },
      {
        title: "Testimoni",
        description: "Video dan thumbnail (poster) dapat diganti secara terpisah. Gunakan ↑ ↓ untuk mengubah urutan.",
        fields: [
          {
            key: "items",
            type: "repeater",
            label: "Daftar testimoni",
            itemLabel: "Testimoni",
            titleKey: "caption",
            max: 9,
            newItem: { kind: "video", caption: "", video: { url: "" }, poster: { url: "" }, ariaLabel: "" },
            fields: [
              {
                key: "kind",
                type: "select",
                label: "Jenis kartu",
                options: [
                  { value: "video", label: "Video testimoni" },
                  { value: "placeholder", label: "Placeholder (segera hadir)" },
                ],
              },
              { key: "caption", type: "text", label: "Nama klien / brand", required: true, help: "Contoh: @wheelscoffeeroasters" },
              { key: "video", type: "video", label: "Video", required: true, showIf: { field: "kind", equals: "video" }, help: "MP4 (H.264), rasio 9:16, maks. 50 MB." },
              { key: "poster", type: "image", label: "Thumbnail / poster", showIf: { field: "kind", equals: "video" }, help: "Gambar yang tampil sebelum video diputar. Rasio 9:16." },
              { key: "ariaLabel", type: "text", label: "Deskripsi video (aksesibilitas)", showIf: { field: "kind", equals: "video" } },
            ],
          },
        ],
      },
      {
        title: "Label pemutar video",
        fields: [
          { key: "playLabel", type: "text", label: "Label tombol putar" },
          { key: "replayLabel", type: "text", label: "Label tombol putar ulang" },
          { key: "unsupportedText", type: "text", label: "Pesan jika browser tidak mendukung video" },
        ],
      },
    ],
  },

  {
    id: "cta",
    label: "Closing CTA",
    icon: "cta",
    description: "Ajakan penutup sebelum footer, lengkap dengan foto tim.",
    groups: [
      {
        title: "Konten",
        fields: [
          { key: "eyebrow", type: "text", label: "Label kecil (badge)" },
          { key: "headlineLine1", type: "inline", label: "Headline – baris 1", highlight: "em", required: true },
          { key: "headlineLine2", type: "inline", label: "Headline – baris 2", highlight: "em" },
          { key: "headlineLine3", type: "inline", label: "Headline – baris 3", highlight: "em", help: "Gunakan *kata* untuk teks miring berwarna." },
          { key: "description", type: "inline", label: "Deskripsi", multiline: true },
        ],
      },
      {
        title: "Tombol",
        fields: [
          { key: "ctaText", type: "inline", label: "Teks tombol", required: true },
          { key: "ctaUrl", type: "url", label: "Link tujuan (WhatsApp)", help: ctaLinkHelp, placeholder: "(WhatsApp)" },
        ],
      },
      {
        title: "Foto",
        fields: [{ key: "image", type: "image", label: "Foto", withAlt: true, required: true, help: "Rasio 4:3 (desktop) / 16:9 (mobile)." }],
      },
    ],
  },

  {
    id: "footer",
    label: "Footer",
    icon: "footer",
    description: "Kalimat penutup besar, logo, copyright, kontak, dan media sosial.",
    groups: [
      {
        title: "Kalimat penutup",
        fields: [
          {
            key: "bigText",
            type: "inline",
            label: "Teks besar",
            highlight: "i",
            allowBreaks: true,
            multiline: true,
            required: true,
            help: "Tekan Enter untuk pindah baris. *kata* = warna oranye.",
          },
          { key: "tagline", type: "textarea", label: "Kalimat pendukung (opsional)", rows: 2, help: "Muncul di bawah teks besar. Kosongkan untuk menyembunyikan." },
        ],
      },
      {
        title: "Brand",
        fields: [
          { key: "brandName", type: "text", label: "Nama brand", required: true },
          { key: "logo", type: "image", label: "Logo footer", withAlt: true, required: true },
          {
            key: "copyright",
            type: "text",
            label: "Teks copyright",
            help: "Gunakan {brand} untuk nama brand dan {year} untuk tahun berjalan.",
          },
        ],
      },
      {
        title: "Kontak",
        description: "Opsional. Hanya ditampilkan jika diisi.",
        fields: [
          { key: "email", type: "text", label: "Email", placeholder: "hello@mildigital.id" },
          { key: "phone", type: "text", label: "Telepon", placeholder: "+62 …" },
          { key: "address", type: "textarea", label: "Alamat", rows: 2 },
        ],
      },
      {
        title: "Media sosial",
        description: "Opsional. Hanya ditampilkan jika diisi.",
        fields: [
          {
            key: "socials",
            type: "repeater",
            label: "Link media sosial",
            itemLabel: "Link",
            titleKey: "label",
            max: 8,
            newItem: { label: "Instagram", url: "" },
            fields: [
              { key: "label", type: "text", label: "Nama platform", required: true, placeholder: "Instagram" },
              { key: "url", type: "url", label: "URL", required: true, placeholder: "https://instagram.com/…" },
            ],
          },
        ],
      },
    ],
  },

  {
    id: "settings",
    label: "SEO & Settings",
    icon: "settings",
    description: "Metadata SEO, gambar share (Open Graph), dan nomor WhatsApp.",
    groups: [
      {
        title: "SEO",
        fields: [
          { key: "metaTitle", type: "text", label: "Meta title", required: true, maxLength: 70, help: "Judul di tab browser & hasil Google. Ideal ≤ 60 karakter." },
          { key: "metaDescription", type: "textarea", label: "Meta description", rows: 3, maxLength: 200, help: "Ringkasan di hasil Google. Ideal 120–160 karakter." },
          { key: "ogImage", type: "image", label: "Gambar share (Open Graph)", help: "Muncul saat link dibagikan di WhatsApp/LinkedIn dll. Ideal 1200×630 px." },
          { key: "favicon", type: "image", label: "Favicon (opsional)", help: "PNG persegi, minimal 64×64 px." },
        ],
      },
      {
        title: "WhatsApp",
        description: "Dipakai oleh semua tombol yang link-nya dikosongkan dan tombol WhatsApp melayang.",
        fields: [
          { key: "waNumber", type: "text", label: "Nomor WhatsApp", required: true, placeholder: "6281234567890", help: "Format: 62 + nomor tanpa 0 di depan, tanpa spasi atau tanda +." },
          { key: "waMessage", type: "textarea", label: "Pesan otomatis", rows: 3 },
          { key: "waFloatLabel", type: "text", label: "Label tombol WhatsApp melayang (aksesibilitas)" },
        ],
      },
    ],
  },
];

export const SECTION_IDS = SECTIONS.map((s) => s.id);
export const getSection = (id: string) => SECTIONS.find((s) => s.id === id);

/** All top-level fields of a section, flattened across groups. */
export const sectionFields = (s: SectionDef): Field[] => s.groups.flatMap((g) => g.fields);

/* ------------------------------------------------------------------ *
 * Default content — copied verbatim from the original HTML.
 * Used as (1) seed data and (2) fallback when the database is unavailable.
 * ------------------------------------------------------------------ */

export const DEFAULT_CONTENT: SiteContent = {
  hero: {
    logo: { url: "/assets/logo-mil.png", alt: "MIL Digital — Digital Marketing Consultant", width: 787, height: 168 },
    tagline: "Strategic Thinking Partner",
    background: { url: "/assets/hero-bg.jpg", alt: "", width: 1500, height: 1000 },
    headlineLine1: "Biaya iklan naik,",
    headlineLine2: "tapi *hasilnya* gak ikut naik?",
    description:
      "Budget lebih besar belum tentu menghasilkan performa lebih baik. Masalahnya bisa ada di alokasi budget, strategi yang kurang tepat, atau keputusan tanpa dukungan data. MIL Digital membantu menemukan akar masalahnya dan mengoptimalkan iklan agar setiap budget bekerja [[lebih efektif.]]",
    statsLabel: "Trusted by",
    stats: [
      { value: "150", suffix: "+", label: "Brands" },
      { value: "20", suffix: "+", label: "Industries" },
    ],
    ctaText: "Klik untuk ngobrol dengan [[MIL Digital]]",
    ctaUrl: "",
    ctaNote: "Ceritakan kondisi bisnismu, lalu kita diskusikan [[langkah awal yang tepat.]]",
  },

  clients: {
    brandCount: "150+",
    headline: "brand telah berkolaborasi dengan MIL Digital",
    description:
      "Dari F&B, Fashion, Beauty hingga Jasa dan B2B, pengalaman lintas industri memberi kami perspektif yang lebih luas untuk [[setiap brand.]]",
    logoWallDesktop: { url: "/assets/clients-desktop.webp", alt: "Logo brand klien MIL Digital", width: 2700, height: 840 },
    logoWallMobile: { url: "/assets/clients-mobile.webp", alt: "Logo brand klien MIL Digital", width: 1800, height: 1260 },
  },

  workflow: {
    eyebrow: "MIL Workflow",
    headline: "Melihat bisnis *secara menyeluruh*, mengembangkan strategi, dan mengevaluasi setiap langkahnya.",
    description:
      "Kami memahami kondisi bisnis mulai dari produk, positioning, pelanggan, hingga pasar untuk menyusun strategi marketing yang relevan dan iklan dapat berjalan lebih optimal.",
    centerLabel: "MIL Workflow",
    hint: "Klik tiap tahap untuk melihat detailnya",
    tablistLabel: "Tiga tahap MIL Workflow",
    stages: [
      {
        title: "Assessment",
        tagline: "Understand Your Business Holistically.",
        description:
          "Kami mempelajari bisnis dari berbagai sisi, mulai dari produk, positioning, target pasar, pelanggan, hingga kondisi marketing saat ini untuk memahami konteks brand [[secara utuh.]]",
        listLabel: "Our Methods",
        items: ["Foundational Assessment", "Market Insights", "Competitor Intelligence", "Cost / Revenue Analysis", "Data Analysis"],
      },
      {
        title: "Strategize",
        tagline: "Spend Smarter, Grow Better.",
        description:
          "Kami menyelaraskan audiens, channel, pendekatan marketing, dan alokasi budget berdasarkan prioritas bisnis agar setiap pengeluaran digunakan secara [[lebih efektif.]]",
        listLabel: "Our Focus",
        items: ["Relevant Business Strategy", "Go-to-Market Strategy", "Content & Creative Strategy"],
      },
      {
        title: "Monitoring",
        tagline: "Turn Performance Into Progress.",
        description:
          "Kami mengevaluasi performa secara berkala, membaca perubahan yang terjadi, dan menyesuaikan strategi berdasarkan data agar aktivitas marketing tetap efektif dan penggunaan budget semakin efisien.",
        listLabel: "What We Handle",
        items: ["Ads Optimization", "Tools Utilization", "Problem Support"],
      },
    ],
  },

  services: {
    eyebrow: "Our Services",
    headlineLine1: "Solutions Built",
    headlineLine2: "Around Your Business",
    description:
      "Kami menawarkan layanan yang saling terhubung, mulai dari konsultasi, iklan, hingga kreatif, agar strategi lebih utuh dan setiap budget bekerja [[lebih efektif.]]",
    coreLabel: "Core Services",
    core: [
      {
        icon: "consulting",
        title: "Consulting",
        description: "Bukan sekadar memberi rekomendasi, tetapi menjadi partner dalam setiap keputusan strategis.",
        tags: [
          { label: "Research", icon: "research" },
          { label: "Go-to-Market Strategy", icon: "go-to-market" },
          { label: "Competitive Analysis", icon: "competitive" },
        ],
        clients: [],
      },
      {
        icon: "advertising",
        title: "Advertising Strategy & Optimization",
        description: "Maksimalkan efektivitas iklan secara strategis untuk menjangkau audiens dan menghasilkan performa yang lebih optimal.",
        tags: [
          { label: "Meta", icon: "meta" },
          { label: "TikTok", icon: "tiktok" },
          { label: "Shopee", icon: "shopee" },
          { label: "Google", icon: "google" },
        ],
        clients: [],
      },
      {
        icon: "creative",
        title: "Creative Solution",
        description: "Mengembangkan ide dan materi kreatif yang relevan dengan pesan brand, audiens, dan tujuan bisnis.",
        tags: [
          { label: "Social Media Management", icon: "social-media" },
          { label: "Advertising Creative Production", icon: "ad-creative" },
          { label: "Brand Identity Design", icon: "brand-identity" },
        ],
        clients: [],
      },
    ],
  },

  additional: {
    label: "Additional Services",
    items: [
      {
        icon: "user-research",
        title: "User Research",
        description: "Kenali pelanggan lebih dalam agar strategi marketing & komunikasi lebih relevan dan biaya lebih efisien.",
        tags: [
          { label: "In-Depth Interview", icon: "interview" },
          { label: "Focus Group Discussion", icon: "focus-group" },
          { label: "Customer Survey", icon: "survey" },
        ],
        clientsLabel: "Featured clients",
        clients: [
          { logo: { url: "/assets/client-kabobs.png", alt: "Kabobs Premium Kebab", width: 133, height: 110 }, height: 44 },
          { logo: { url: "/assets/client-paddy.png", alt: "Paddy", width: 191, height: 62 }, height: 24.6 },
          { logo: { url: "/assets/client-tumbuh-lab.png", alt: "Tumbuh Lab", width: 316, height: 47 }, height: 18.8 },
        ],
        moreText: "& many more",
      },
      {
        icon: "website",
        title: "Website Development & SEO",
        description:
          "Pengembangan dan optimalisasi website untuk memperkuat digital presence, meningkatkan visibilitas brand di search engine, serta memudahkan calon pelanggan menemukan dan mengenal bisnis.",
        tags: [
          { label: "Website Development", icon: "web-dev" },
          { label: "Keyword Research", icon: "keyword" },
          { label: "Content Optimization", icon: "content-opt" },
        ],
        clientsLabel: "Featured clients",
        clients: [
          { logo: { url: "/assets/client-manaaji.png", alt: "Manaaji", width: 129, height: 84 }, height: 33.8 },
          { logo: { url: "/assets/client-ganeca.png", alt: "Ganeca", width: 148, height: 97 }, height: 38.7 },
          { logo: { url: "/assets/client-charlene-clinic.png", alt: "Charlene Clinic", width: 245, height: 78 }, height: 31.4 },
        ],
        moreText: "& many more",
      },
    ],
  },

  testimonials: {
    headline: "Kata mereka yang berkolaborasi dengan MIL",
    items: [
      {
        kind: "video",
        caption: "@wheelscoffeeroasters",
        video: { url: "/assets/testi-wheels.mp4" },
        poster: { url: "/assets/testi-wheels-poster.jpg", width: 540, height: 960 },
        ariaLabel: "Video testimoni Wheels",
      },
      {
        kind: "video",
        caption: "@lyla.officielle",
        video: { url: "/assets/testi-lyla.mp4" },
        poster: { url: "/assets/testi-lyla-poster.jpg", width: 540, height: 960 },
        ariaLabel: "Video testimoni Lyla",
      },
      { kind: "placeholder", caption: "Testimonial 3", video: { url: "" }, poster: { url: "" }, ariaLabel: "" },
    ],
    playLabel: "Putar video testimoni",
    replayLabel: "Putar ulang video testimoni",
    unsupportedText: "Browser kamu tidak mendukung pemutaran video.",
  },

  cta: {
    eyebrow: "Mulai dari sini",
    headlineLine1: "Sebelum menaikkan budget marketing",
    headlineLine2: "pastikan kamu tahu ke mana",
    headlineLine3: "*investasi berikutnya* harus diarahkan.",
    description:
      "Diskusikan kondisi bisnismu bersama tim MIL untuk memahami prioritas, menemukan peluang, dan menentukan langkah marketing yang paling relevan.",
    ctaText: "Klik untuk ngobrol dengan [[MIL Digital]]",
    ctaUrl: "",
    image: { url: "/assets/cta-team.jpg", alt: "Tim MIL Digital berdiskusi di ruang meeting", width: 1816, height: 1361 },
  },

  footer: {
    bigText: "Let's grow *MIL*es\naway together!",
    tagline: "",
    brandName: "MIL Digital",
    logo: { url: "/assets/logo-mil.png", alt: "MIL Digital", width: 787, height: 168 },
    copyright: "{brand} — 2026",
    email: "",
    phone: "",
    address: "",
    socials: [],
  },

  settings: {
    metaTitle: "MIL Digital — Strategic Thinking Partner",
    metaDescription:
      "MIL Digital: Strategic Thinking Partner untuk business growth dan more profit lewat strategi, data, kreatif, dan ads optimization.",
    ogImage: { url: "/assets/hero-bg.jpg", alt: "", width: 1500, height: 1000 },
    favicon: { url: "" },
    waNumber: "6281234567890",
    waMessage: "Halo MIL Digital, saya ingin diskusi soal growth dan efisiensi marketing bisnis saya.",
    waFloatLabel: "Chat WhatsApp MIL Digital",
  },
};

/** Map a field type to the value stored in the DB `field_type` column. */
export const fieldTypeOf = (sectionId: string, key: string): string => {
  const s = getSection(sectionId);
  const f = s && sectionFields(s).find((x) => x.key === key);
  return f ? f.type : "text";
};
