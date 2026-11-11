/**
 * Fidelity test: renders the landing page from the default (original) content and compares
 * the <body> markup with the original HTML file, token by token.
 * Only the intentional, invisible differences documented in src/site/render.ts are normalised away.
 *
 *   npm run test:fidelity
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { renderPage } from "../src/site/render";
import { resolveContent } from "../src/content/resolve";

const root = join(__dirname, "..");
let original = readFileSync(join(root, "scripts/.original-body.html"), "utf8");
let rendered = renderPage(resolveContent(null)).split("<body>")[1].split("</body>")[0];

// --- intentional changes, removed from the ORIGINAL side ---
original = original
  .replace(/\s*<div class="lp-stack">[\s\S]*?<\/div>/, "") // hidden at all breakpoints
  .replace(/<script>\s*\/\* ===== Ubah nomor[\s\S]*?<\/script>/, "") // WA href now server-rendered
  .replace(/<script>\s*\(function\(\)\{\s*var tabs=document\.querySelectorAll\("\.fw-tabs[\s\S]*?<\/script>/, "") // dead code
  .replace(/<script>\(function\(\)\{\[\]\.forEach\.call\(document\.querySelectorAll\("\.t-video video\[data-vid\]"\)[\s\S]*?<\/script>/, ""); // base64 video loader

// --- attribute-level normalisation, applied to BOTH sides ---
const norm = (h: string) =>
  h
    .replace(/<img\b[^>]*>/g, (t) => t.replace(/\s(width|height|loading|decoding|fetchpriority)="[^"]*"/g, "").replace(/\s+>/, ">"))
    .replace(/<a\b[^>]*data-wa[^>]*>/g, (t) => t.replace(/\s(href|target|rel)="[^"]*"/g, ""))
    .replace(/<video\b[^>]*>/g, (t) => t.replace(/\s(src|data-vid|preload)="[^"]*"/g, ""))
    .replace(/\s+/g, " ")
    .replace(/> </g, "><")
    .trim();

const a = norm(original), b = norm(rendered);
if (a === b) {
  console.log("✅ Fidelity check passed: rendered markup matches the original landing page.");
  process.exit(0);
}
let i = 0;
while (i < a.length && a[i] === b[i]) i++;
console.error("❌ Markup differs at char", i);
console.error("ORIGINAL:", a.slice(Math.max(0, i - 200), i + 300));
console.error("RENDERED:", b.slice(Math.max(0, i - 200), i + 300));
process.exit(1);
