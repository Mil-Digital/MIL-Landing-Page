-- =====================================================================
--  MIL Digital — Update landing page (Nov 2026): carousel testimoni teks
--  Jalankan di Neon SQL Editor (sebagai neondb_owner) pada database yang
--  SUDAH berjalan. Aman dijalankan ulang (idempotent).
--  Database baru cukup menjalankan db/seed.sql (sudah berisi konten ini).
--
--  1. Menambah field testimonials.quotes (3 kutipan) + testimonials.quotesLabel.
--  2. Menghapus kartu placeholder "Testimonial 3" dari daftar video testimoni
--     (hanya item bawaan; item yang sudah diubah admin tidak disentuh).
--  3. Menyesuaikan ukuran foto hero (/assets/hero-bg.jpg kini 2576×1717).
--  Draft dan published sama-sama diperbarui, sehingga tidak ada draft
--  "belum dipublikasikan" yang muncul akibat migrasi ini.
-- =====================================================================
begin;

-- 1. new fields (existing rows are kept)
insert into public.page_content (section_id, field_key, field_type, draft_value, published_value, published_at) values
  ('testimonials', 'quotes', 'repeater', '[{"quote":"Bareng MIL, kami tidak lagi perlu khawatir untuk menentukan langkah bisnis karena setiap keputusan didukung data. Ditambah layanan yang konsisten dan selalu memberikan value bagi bisnis kami.","name":"Maggie","role":"Owner of @crabus.id (Fashion Retail)","background":{"url":"/assets/testi-quote-crabus-bg.jpg","alt":"","width":1400,"height":368},"logo":{"url":"/assets/testi-quote-crabus-logo.png","alt":"Logo Crabus","width":192,"height":192},"logoShape":"round"},{"quote":"MIL has helped us strengthen our brand visibility and improve our marketing and sales efforts. Their supportive and proactive team has made our collaboration truly valuable.","name":"Patricia","role":"Owner of @petitefleur_jkt (Florist)","background":{"url":"/assets/testi-quote-petitefleur-bg.jpg","alt":"","width":1400,"height":375},"logo":{"url":"/assets/testi-quote-petitefleur-logo.png","alt":"Logo Petite Fleur","width":220,"height":200},"logoShape":"square"},{"quote":"MIL membuat strategi digital marketing kami jadi lebih terarah. Kami juga melihat perkembangan positif pada engagement dan followers Instagram, didukung oleh komunikasi serta arahan tim MIL yang responsif.","name":"@valentinedecor (Wedding Decoration)","role":"","background":{"url":"/assets/testi-quote-valentine-bg.jpg","alt":"","width":1400,"height":375},"logo":{"url":"/assets/testi-quote-valentine-logo.png","alt":"Logo Valentine Decor","width":192,"height":192},"logoShape":"round"}]'::jsonb, '[{"quote":"Bareng MIL, kami tidak lagi perlu khawatir untuk menentukan langkah bisnis karena setiap keputusan didukung data. Ditambah layanan yang konsisten dan selalu memberikan value bagi bisnis kami.","name":"Maggie","role":"Owner of @crabus.id (Fashion Retail)","background":{"url":"/assets/testi-quote-crabus-bg.jpg","alt":"","width":1400,"height":368},"logo":{"url":"/assets/testi-quote-crabus-logo.png","alt":"Logo Crabus","width":192,"height":192},"logoShape":"round"},{"quote":"MIL has helped us strengthen our brand visibility and improve our marketing and sales efforts. Their supportive and proactive team has made our collaboration truly valuable.","name":"Patricia","role":"Owner of @petitefleur_jkt (Florist)","background":{"url":"/assets/testi-quote-petitefleur-bg.jpg","alt":"","width":1400,"height":375},"logo":{"url":"/assets/testi-quote-petitefleur-logo.png","alt":"Logo Petite Fleur","width":220,"height":200},"logoShape":"square"},{"quote":"MIL membuat strategi digital marketing kami jadi lebih terarah. Kami juga melihat perkembangan positif pada engagement dan followers Instagram, didukung oleh komunikasi serta arahan tim MIL yang responsif.","name":"@valentinedecor (Wedding Decoration)","role":"","background":{"url":"/assets/testi-quote-valentine-bg.jpg","alt":"","width":1400,"height":375},"logo":{"url":"/assets/testi-quote-valentine-logo.png","alt":"Logo Valentine Decor","width":192,"height":192},"logoShape":"round"}]'::jsonb, now()),
  ('testimonials', 'quotesLabel', 'text', '"Testimoni klien lainnya"'::jsonb, '"Testimoni klien lainnya"'::jsonb, now())
on conflict (section_id, field_key) do nothing;

-- 2. drop the default placeholder card
create or replace function pg_temp.drop_placeholder(v jsonb) returns jsonb language sql immutable as $$
  select case when jsonb_typeof(v) = 'array' then coalesce(
    (select jsonb_agg(e order by i) from jsonb_array_elements(v) with ordinality as t(e, i)
      where not (e->>'kind' = 'placeholder' and e->>'caption' = 'Testimonial 3')), '[]'::jsonb)
  else v end
$$;
update public.page_content
   set draft_value = pg_temp.drop_placeholder(draft_value),
       published_value = pg_temp.drop_placeholder(published_value)
 where section_id = 'testimonials' and field_key = 'items'
   and (draft_value is distinct from pg_temp.drop_placeholder(draft_value)
        or published_value is distinct from pg_temp.drop_placeholder(published_value));

-- 3. new hero photo dimensions (only while the bundled photo is used)
update public.page_content
   set draft_value = case when draft_value->>'url' = '/assets/hero-bg.jpg'
                          then draft_value || '{"width":2576,"height":1717}'::jsonb else draft_value end,
       published_value = case when published_value->>'url' = '/assets/hero-bg.jpg'
                              then published_value || '{"width":2576,"height":1717}'::jsonb else published_value end
 where (section_id, field_key) in (('hero', 'background'), ('settings', 'ogImage'))
   and (draft_value->>'url' = '/assets/hero-bg.jpg' or published_value->>'url' = '/assets/hero-bg.jpg');

commit;
