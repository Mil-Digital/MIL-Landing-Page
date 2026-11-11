/** HTML helpers shared by the public renderer and the admin live-preview of inline fields. */

export const esc = (v: unknown): string =>
  String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

/** Escape a value for use inside an inline <script> as a JS literal. */
export const jsLiteral = (v: unknown): string =>
  JSON.stringify(v ?? "")
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(new RegExp(String.fromCharCode(0x2028), "g"), "\\u2028")
    .replace(new RegExp(String.fromCharCode(0x2029), "g"), "\\u2029");

const HIGHLIGHT: Record<string, [string, string]> = {
  accent: ['<span class="accent">', "</span>"],
  em: ["<em>", "</em>"],
  b: ["<b>", "</b>"],
  i: ["<i>", "</i>"],
};

/**
 * Render the lightweight inline markup used by "inline" fields:
 *   *text*   -> highlight (accent span / em / b / i depending on the field)
 *   [[text]] -> keep together on one line
 *   newline  -> <br> (only when allowBreaks), otherwise a space
 * Everything else is HTML-escaped, so editors can never inject markup.
 */
export function inline(src: unknown, highlight?: string, allowBreaks?: boolean): string {
  let s = esc(src);
  s = s.replace(/\[\[([\s\S]+?)\]\]/g, '<span style="white-space:nowrap">$1</span>');
  const h = highlight ? HIGHLIGHT[highlight] : undefined;
  if (h) s = s.replace(/\*([^*\n]+?)\*/g, `${h[0]}$1${h[1]}`);
  else s = s.replace(/\*([^*\n]+?)\*/g, "$1");
  s = allowBreaks ? s.replace(/\r?\n/g, "<br>") : s.replace(/\s*\r?\n\s*/g, " ");
  return s;
}

/** Plain text version of an inline value (for <title>, alt text, etc.). */
export const plain = (src: unknown): string =>
  String(src ?? "")
    .replace(/\[\[([\s\S]+?)\]\]/g, "$1")
    .replace(/\*([^*\n]+?)\*/g, "$1")
    .replace(/\s+/g, " ")
    .trim();

/** Allow only safe URL schemes in href/src attributes. */
export function safeUrl(u: unknown): string {
  const s = String(u ?? "").trim();
  if (!s) return "";
  if (/^(https?:|mailto:|tel:|\/|#)/i.test(s)) return s;
  return "";
}
