/**
 * Server-side renderer for the public landing page.
 *
 * It reproduces the original single-file HTML document 1:1 (same markup, same <style> blocks,
 * same inline scripts), with every editable value coming from the CMS content object.
 * The original CSS/JS run untouched – no React hydration on the public page.
 *
 * Differences vs. the original file (all invisible):
 *  - Base64 fonts/images/videos are now real files (Neon Object Storage or /public) -> ~24 MB HTML becomes ~60 KB.
 *  - <img> get width/height (no layout shift) and loading="lazy" below the fold.
 *  - Videos use a real src with preload="none" instead of a 7 MB Base64 blob each.
 *  - WhatsApp links are rendered server-side (works without JS); the dead `.fw-tabs` script is dropped.
 *  - SEO/Open Graph tags added to <head>.
 */
import type { ImageValue, SiteContent, VideoValue } from "@/content/types";
import { esc, inline, jsLiteral, plain, safeUrl } from "./format";
import { HEAD_STYLES, FRAMEWORK_STYLE } from "./generated/styles";
import { CARD_ICONS, MISC_ICONS, TAG_ICONS, WORKFLOW_ICONS } from "./generated/icons";
import { FRAMEWORK_SCRIPT, TESTIMONIAL_VIDEO_SCRIPT, WA_FLOAT_SCRIPT, WORKFLOW_CYCLE_SVG } from "./generated/scripts";
import { EXTENSION_STYLES } from "./extensions";
import { createHash } from "node:crypto";
import { ANALYTICS, TRACKER_VERSION } from "@/lib/analytics/config";

type Any = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

export type RenderOptions = {
  /** Absolute origin of the request, used for canonical / og:image URLs. */
  origin?: string;
  /** Draft preview: adds a badge and noindex. */
  preview?: boolean;
  /** Content came from the built-in fallback (database unreachable). Rendered as an HTML comment only. */
  fallback?: boolean;
  /** Include the first-party analytics tracker (default: on for the public page, off in previews). */
  analytics?: boolean;
};

/* ---------------- analytics hooks (invisible attributes) ---------------- */
const slug = (v: unknown, fallback: string) =>
  String(v ?? "").normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || fallback;
/** data-analytics-* attributes: a stable id (survives restyling / DOM changes) + a readable label. */
const ax = (id: string, label: string, kind?: string) =>
  ` data-analytics-id="${esc(id)}" data-analytics-label="${esc(label)}"${kind ? ` data-analytics-kind="${kind}"` : ""}`;
const sec = (id: string) => ` data-analytics-section="${id}"`;

/** Layout version = template version + hash of the published content. Heatmaps can be limited to one layout. */
export const TEMPLATE_VERSION = "t1";
export const layoutVersion = (c: SiteContent) =>
  `${TEMPLATE_VERSION}-${createHash("sha1").update(JSON.stringify(c)).digest("hex").slice(0, 10)}`;

const img = (v: ImageValue | undefined, attrs: { cls?: string; alt?: string; lazy?: boolean; style?: string; priority?: boolean } = {}) => {
  const url = safeUrl(v?.url);
  if (!url) return "";
  const parts = [`<img`];
  if (attrs.cls) parts.push(` class="${attrs.cls}"`);
  parts.push(` src="${esc(url)}" alt="${esc(attrs.alt ?? v?.alt ?? "")}"`);
  if (attrs.style) parts.push(` style="${attrs.style}"`);
  if (v?.width && v?.height) parts.push(` width="${Math.round(v.width)}" height="${Math.round(v.height)}"`);
  if (attrs.lazy) parts.push(` loading="lazy" decoding="async"`);
  if (attrs.priority) parts.push(` fetchpriority="high"`);
  parts.push(">");
  return parts.join("");
};

const num = (n: unknown) => {
  const x = typeof n === "number" ? n : parseFloat(String(n));
  return isFinite(x) ? String(Math.round(x * 100) / 100) : "30";
};

const tagIcon = (k: string) => (TAG_ICONS[k] ?? TAG_ICONS.research).svg;
const cardIcon = (k: string) => (CARD_ICONS[k] ?? CARD_ICONS.consulting).svg;

const tags = (list: Any[] | undefined, cls: string) => {
  const items = (list ?? []).filter((t) => t && String(t.label ?? "").trim());
  if (!items.length) return "";
  return `<ul class="${cls}">${items.map((t) => `<li>${tagIcon(t.icon)}${esc(t.label)}</li>`).join("")}</ul>`;
};

const clientLogos = (s: Any) => {
  const logos = (s.clients ?? []).filter((c: Any) => safeUrl(c?.logo?.url));
  if (!logos.length) return "";
  const imgs = logos
    .map((c: Any) => img(c.logo, { style: `--h:${num(c.height)}`, lazy: true }))
    .join("");
  const label = String(s.clientsLabel ?? "Featured clients");
  const more = String(s.moreText ?? "").trim();
  return `<div class="ur-clients"><small>${esc(label)}</small><div class="ur-logos"><div class="ur-row">${imgs}</div>${more ? `<span>${esc(more)}</span>` : ""}</div></div>`;
};

function waLink(settings: Any) {
  const n = String(settings.waNumber ?? "").replace(/[^\d]/g, "");
  return `https://wa.me/${n}?text=${encodeURIComponent(String(settings.waMessage ?? ""))}`;
}

/** Attributes for a CTA anchor: custom URL if set, else the WhatsApp link (same behaviour as the original script). */
function ctaAttrs(custom: unknown, settings: Any) {
  const url = safeUrl(custom) || waLink(settings);
  const external = /^https?:/i.test(url);
  return `href="${esc(url)}" data-wa${external ? ` target="_blank" rel="noopener"` : ""}`;
}

const absolute = (u: string, origin?: string) => (u.startsWith("/") && !u.startsWith("//") && origin ? origin + u : u);

export function renderPage(c: SiteContent, opts: RenderOptions = {}): string {
  const hero = c.hero as Any, clients = c.clients as Any, wf = c.workflow as Any, sv = c.services as Any,
    add = c.additional as Any, testi = c.testimonials as Any, cta = c.cta as Any, foot = c.footer as Any, set = c.settings as Any;

  /* ---------------- <head> ---------------- */
  const title = plain(set.metaTitle) || "MIL Digital";
  const desc = plain(set.metaDescription);
  const og = safeUrl(set.ogImage?.url);
  const fav = safeUrl(set.favicon?.url);
  const assetOrigins = new Set<string>();
  JSON.stringify(c).replace(/https:\/\/[a-z0-9.-]+\.neon\.tech/gi, (m) => (assetOrigins.add(m), m));

  const head = [
    `<!doctype html>`,
    `<html lang="id">`,
    `<head>`,
    `<meta charset="utf-8">`,
    `<meta name="viewport" content="width=device-width, initial-scale=1">`,
    `<title>${esc(title)}</title>`,
    `<meta name="description" content="${esc(desc)}">`,
    opts.preview ? `<meta name="robots" content="noindex, nofollow">` : "",
    opts.origin && !opts.preview ? `<link rel="canonical" href="${esc(opts.origin)}/">` : "",
    `<meta property="og:type" content="website">`,
    `<meta property="og:title" content="${esc(title)}">`,
    `<meta property="og:description" content="${esc(desc)}">`,
    opts.origin ? `<meta property="og:url" content="${esc(opts.origin)}/">` : "",
    og ? `<meta property="og:image" content="${esc(absolute(og, opts.origin))}">` : "",
    og && set.ogImage?.width ? `<meta property="og:image:width" content="${Math.round(set.ogImage.width)}"><meta property="og:image:height" content="${Math.round(set.ogImage.height)}">` : "",
    `<meta name="twitter:card" content="summary_large_image">`,
    fav ? `<link rel="icon" href="${esc(fav)}">` : "",
    ...[...assetOrigins].map((o) => `<link rel="preconnect" href="${o}" crossorigin>`),
    // Fonts were Base64-inlined (no flash); preloading keeps first paint identical.
    `<link rel="preload" href="/fonts/sf-pro-display-400.otf" as="font" type="font/otf" crossorigin>`,
    `<link rel="preload" href="/fonts/sf-pro-display-700.otf" as="font" type="font/otf" crossorigin>`,
    safeUrl(hero.background?.url) ? `<link rel="preload" href="${esc(safeUrl(hero.background.url))}" as="image" fetchpriority="high">` : "",
    ...HEAD_STYLES.map((s) => (s.id ? `<style id="${s.id}">${s.css}</style>` : `<style>${s.css}</style>`)),
    `<style id="cms-extensions">${EXTENSION_STYLES}</style>`,
    opts.fallback ? `<!-- content: built-in fallback (database unavailable) -->` : "",
    `</head>`,
  ].filter(Boolean).join("\n");

  /* ---------------- HERO ---------------- */
  const stats = (hero.stats ?? [])
    .filter((s: Any) => String(s.value ?? "").trim())
    .map((s: Any) => `          <li><b>${esc(s.value)}${s.suffix ? `<i>${esc(s.suffix)}</i>` : ""}</b><span>${esc(s.label)}</span></li>`)
    .join("\n");
  const line2 = String(hero.headlineLine2 ?? "").trim();
  const heroHtml = `
<!-- ================= HERO ================= -->
<header class="hero hv2"${sec("hero")}>
  <div class="hv2-bg" aria-hidden="true">${img(hero.background, { alt: "", priority: true })}</div>
  <div class="wrap hv2-inner">
    <nav class="nav">
      <a href="#"${ax("hero.logo", "Hero — Logo", "nav")}>${img(hero.logo)}</a>
      ${hero.tagline ? `<span class="tag">${esc(hero.tagline)}</span>` : ""}
    </nav>
    <div class="hv2-copy">
      <h1 class="display"><span class="l1">${inline(hero.headlineLine1, "accent")}</span>${line2 ? ` <span class="l2">${inline(line2, "accent")}</span>` : ""}</h1>
      <p class="lead">${inline(hero.description)}</p>
      ${stats ? `<div class="hv2-stats">
        <span class="hv2-tb">${esc(hero.statsLabel)}</span>
        <ul>
${stats}
        </ul>
      </div>` : ""}
      <div class="hv2-cta">
        <a ${ctaAttrs(hero.ctaUrl, set)} class="btn"${ax("hero.cta", `Hero — ${plain(hero.ctaText)} (CTA)`, "cta")}><span>${inline(hero.ctaText)}</span> <span>→</span></a>
        ${String(hero.ctaNote ?? "").trim() ? `<span class="hv2-note">${inline(hero.ctaNote)}</span>` : ""}
      </div>
    </div>
  </div>
</header>`;

  /* ---------------- CLIENTS ---------------- */
  const bc = String(clients.brandCount ?? "").trim();
  const clientsHtml = `
<!-- ================= CLIENTS ================= -->
<section class="sec clients"${sec("clients")}>
  <div class="wrap">
    <div class="head">
      <h2 class="display">${bc ? `<b>${esc(bc)}</b> ` : ""}${inline(clients.headline)}</h2>
      <p style="text-wrap:balance">${inline(clients.description)}</p>
    </div>
    <div class="logo-panel"${ax("clients.logo-wall", "Brand Statistics — Logo klien", "logos")}>
      ${img(clients.logoWallDesktop, { cls: "lp-full", lazy: true })}
      ${img(clients.logoWallMobile, { cls: "lp-m", lazy: true })}
    </div>
  </div>
</section>`;

  /* ---------------- WORKFLOW ---------------- */
  const stages: Any[] = (wf.stages ?? []).slice(0, 3);
  while (stages.length < 3) stages.push({ title: "", items: [] });
  const nodes = stages
    .map((st, i) => `          <button type="button" class="mw-node${i === 0 ? " on" : ""}" role="tab" aria-selected="${i === 0}" aria-controls="mw-p${i}" id="mw-t${i}" data-i="${i}"${i ? ` tabindex="-1"` : ""}${ax(`workflow.stage-${i + 1}`, `Workflow — ${plain(st.title) || `Tahap ${i + 1}`}`, "tab")}><span class="n">${WORKFLOW_ICONS[i]}<i class="b">${i + 1}</i></span><span class="t">${esc(st.title)}</span></button>`)
    .join("\n");
  const panes = stages
    .map((st, i) => {
      const items = (st.items ?? []).filter((x: unknown) => String(x ?? "").trim());
      return `        <div class="mw-pane${i === 0 ? " on" : ""}" role="tabpanel" id="mw-p${i}" aria-labelledby="mw-t${i}">
          <h3>${esc(st.title)}</h3>
          ${st.tagline ? `<p class="mw-q">${esc(st.tagline)}</p>` : ""}
          <p class="d">${inline(st.description)}</p>
          ${items.length ? `<div class="mw-method"><small>${esc(st.listLabel)}</small><ul>${items.map((x: unknown) => `<li>${esc(x)}</li>`).join("")}</ul></div>` : ""}
        </div>`;
    })
    .join("\n");
  const workflowHtml = `
<!-- ================= MIL DIGITAL FRAMEWORK ================= -->
<section class="sec fw" id="framework"${sec("workflow")}>
  <style>${FRAMEWORK_STYLE}</style>
  <div class="wrap">
    <div class="head">
      ${wf.eyebrow ? `<span class="eyebrow">${esc(wf.eyebrow)}</span>` : ""}
      <h2 class="display">${inline(wf.headline, "em")}</h2>
      <p class="lead">${inline(wf.description)}</p>
    </div>
    <div class="mw">
      <div class="mw-cycle">
        ${WORKFLOW_CYCLE_SVG}
        <p class="mw-hint">${esc(wf.hint)}</p>
        <div class="mw-center"><b>${esc(wf.centerLabel)}</b></div>
        <div role="tablist" aria-label="${esc(wf.tablistLabel)}">
${nodes}
        </div>
      </div>
      <div class="mw-panel">
${panes}
      </div>
    </div>
  </div>
  <script>${FRAMEWORK_SCRIPT}</script>
</section>`;

  /* ---------------- SERVICES ---------------- */
  const core = (sv.core ?? [])
    .map((s: Any, i: number) => `        <div class="c-card"${ax(`services.core-${slug(s.title, String(i + 1))}`, `Services — ${plain(s.title)}`, "card")}>
          <div class="ico">${cardIcon(s.icon)}</div>
          <span class="num">${String(i + 1).padStart(2, "0")}</span>
          <h3>${esc(s.title)}</h3>
          <p>${esc(s.description)}</p>
          ${tags(s.tags, "plat")}${clientLogos({ ...s, clientsLabel: s.clientsLabel ?? "Featured clients", moreText: s.moreText ?? "" })}
          <span class="arrow">↗</span>
        </div>`)
    .join("\n");
  const addCards = (add.items ?? [])
    .map((s: Any, i: number) => `          <div class="a-card"${ax(`services.additional-${slug(s.title, String(i + 1))}`, `Additional Services — ${plain(s.title)}`, "card")}>${cardIcon(s.icon)}<b>${esc(s.title)}</b><span class="a-desc">${esc(s.description)}</span>${tags(s.tags, "plat ur-plat")}${clientLogos(s)}</div>`)
    .join("\n");
  const servicesHtml = `
<!-- ================= SERVICES ================= -->
<section class="sec"${sec("services")}>
  <div class="wrap">
    <div class="services">
      ${sv.eyebrow ? `<span class="eyebrow">${esc(sv.eyebrow)}</span>` : ""}
      <h2 class="display">${esc(sv.headlineLine1)}${sv.headlineLine2 ? `<span>${esc(sv.headlineLine2)}</span>` : ""}</h2>
      <p class="lead">${inline(sv.description)}</p>

      <div class="label gold">${esc(sv.coreLabel)}</div>
      <div class="core">
${core}
      </div>
${addCards ? `
      <div class="add-wrap">
        <div class="label cyan">${esc(add.label)}</div>
        <div class="add">
${addCards}
        </div>
      </div>` : ""}
    </div>
  </div>
</section>`;

  /* ---------------- TESTIMONIALS ---------------- */
  const cards = (testi.items ?? [])
    .map((t: Any, i: number) => {
      const v = t.video as VideoValue | undefined;
      if (t.kind !== "video" || !safeUrl(v?.url)) {
        return `      <div class="t-card">${MISC_ICONS.placeholder}${esc(t.caption)}</div>`;
      }
      const poster = safeUrl((t.poster as ImageValue | undefined)?.url);
      return `      <div class="t-card t-video"><div class="tv-cap">${esc(t.caption)}</div><div class="tv-frame" data-analytics-video="testimonial-${i + 1}"><button type="button" class="tv-play" aria-label="${esc(testi.playLabel)}"${ax(`testimonials.play-${i + 1}`, `Testimonial — ${plain(t.caption) || `Video ${i + 1}`} (Play)`, "video")}>${MISC_ICONS.play}${MISC_ICONS.replay}</button><video src="${esc(safeUrl(v!.url))}" playsinline preload="none" controlslist="nodownload" disablepictureinpicture${poster ? ` poster="${esc(poster)}"` : ""} aria-label="${esc(t.ariaLabel || t.caption)}">${esc(testi.unsupportedText)}</video></div></div>`;
    })
    .join("\n");
  const testiHtml = `
<!-- ================= TESTIMONIALS ================= -->
<section class="sec testi"${sec("testimonials")}>
  <div class="wrap">
    <div class="head"><h2 class="display">${inline(testi.headline)}</h2></div>
    <div class="testi-grid">
${cards}
    </div>
  </div>
</section>`;

  /* ---------------- CTA ---------------- */
  const ctaLines = [cta.headlineLine1, cta.headlineLine2, cta.headlineLine3]
    .filter((l) => String(l ?? "").trim())
    .map((l) => `<span class="cl">${inline(l, "em")}</span>`)
    .join(" ");
  const ctaHtml = `
<!-- ================= CTA ================= -->
<section class="cta"${sec("cta")}>
  <div class="wrap">
    <div class="cta-card">
      <div>
        ${cta.eyebrow ? `<span class="eyebrow">${esc(cta.eyebrow)}</span>` : ""}
        <h2 class="display">${ctaLines}</h2>
        <p class="lead">${inline(cta.description)}</p>
        <a ${ctaAttrs(cta.ctaUrl, set)} class="btn cyan"${ax("cta.button", `Closing CTA — ${plain(cta.ctaText)}`, "cta")}><span>${inline(cta.ctaText)}</span> <span>→</span></a>
      </div>
      <div class="photo has-img" style="aspect-ratio:4/3">${img(cta.image, { style: "object-position:50% 50%", lazy: true })}</div>
    </div>
  </div>
</section>`;

  /* ---------------- FOOTER ---------------- */
  const year = String(new Date().getFullYear());
  const copyright = String(foot.copyright ?? "").replace(/\{brand\}/g, String(foot.brandName ?? "")).replace(/\{year\}/g, year);
  const socials = (foot.socials ?? []).filter((s: Any) => safeUrl(s?.url) && String(s?.label ?? "").trim());
  const contact: string[] = [];
  if (String(foot.email ?? "").trim()) contact.push(`<a href="mailto:${esc(String(foot.email).trim())}"${ax("footer.email", "Footer — Email", "contact")}>${esc(foot.email)}</a>`);
  if (String(foot.phone ?? "").trim()) contact.push(`<a href="tel:${esc(String(foot.phone).replace(/[^\d+]/g, ""))}"${ax("footer.phone", "Footer — Telepon", "contact")}>${esc(foot.phone)}</a>`);
  if (String(foot.address ?? "").trim()) contact.push(`<span>${esc(foot.address).replace(/\r?\n/g, "<br>")}</span>`);
  const meta = contact.length || socials.length
    ? `
    <div class="foot-meta">${contact.length ? `<div class="foot-contact">${contact.join("")}</div>` : ""}${socials.length ? `<ul class="foot-social">${socials.map((s: Any) => `<li><a href="${esc(safeUrl(s.url))}" target="_blank" rel="noopener"${ax(`footer.social-${slug(s.label, "link")}`, `Footer — ${plain(s.label)}`, "social")}>${esc(s.label)}</a></li>`).join("")}</ul>` : ""}</div>`
    : "";
  const footerHtml = `
<!-- ================= FOOTER ================= -->
<footer${sec("footer")}>
  <div class="wrap">
    <div class="big">${inline(foot.bigText, "i", true)}</div>${String(foot.tagline ?? "").trim() ? `
    <p class="foot-line">${esc(foot.tagline)}</p>` : ""}${meta}
    <div class="bot">
      ${img(foot.logo, { alt: foot.logo?.alt || foot.brandName, lazy: true })}
      <span>${esc(copyright)}</span>
    </div>
  </div>
</footer>`;

  /* ---------------- floating WA + scripts ---------------- */
  const tvScript = TESTIMONIAL_VIDEO_SCRIPT
    .replace(/"Putar ulang video testimoni"/g, jsLiteral(testi.replayLabel))
    .replace(/"Putar video testimoni"/g, jsLiteral(testi.playLabel));

  const withAnalytics = (opts.analytics ?? !opts.preview) && ANALYTICS.enabled;
  const tracker = withAnalytics
    ? `\n<script defer src="/mil-analytics.js?v=${TRACKER_VERSION}" data-mil-analytics data-consent="${ANALYTICS.consentMode}" data-layout="${layoutVersion(c)}"></script>`
    : "";

  const tail = `

<a href="${esc(waLink(set))}" data-wa target="_blank" rel="noopener" class="wa-float" aria-label="${esc(set.waFloatLabel)}"${ax("whatsapp.float", "WhatsApp — tombol melayang", "whatsapp")}>${MISC_ICONS.whatsapp}</a>
<script>${WA_FLOAT_SCRIPT}</script>
<script id="tv-js">${tvScript}</script>${tracker}${opts.preview ? `
<div style="position:fixed;left:16px;bottom:16px;z-index:9999;font:600 12px/1 system-ui,sans-serif;background:#111827;color:#fff;padding:9px 12px;border-radius:999px;box-shadow:0 6px 20px rgba(0,0,0,.25);letter-spacing:.02em">● PREVIEW — konten draft, belum dipublikasikan</div>` : ""}`;

  return `${head}\n\n<body>\n${heroHtml}\n${clientsHtml}\n${workflowHtml}\n${servicesHtml}\n${testiHtml}\n${ctaHtml}\n${footerHtml}${tail}</body>\n</html>\n`;
}
