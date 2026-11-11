/** File rules shared by the browser (early feedback) and the server (enforcement). */
export const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/avif", "image/gif"];
export const VIDEO_TYPES = ["video/mp4", "video/webm", "video/quicktime"];
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
export const MAX_VIDEO_BYTES = 50 * 1024 * 1024;

export type MediaKind = "image" | "video" | "other";
export const kindOf = (mime: string): MediaKind =>
  mime.startsWith("image/") ? "image" : mime.startsWith("video/") ? "video" : "other";

export const formatBytes = (n: number | null | undefined) => {
  if (!n && n !== 0) return "—";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
};

/** Returns an error message, or null when acceptable. */
export function checkFile(type: string, size: number, expect?: "image" | "video"): string | null {
  const k = kindOf(type);
  if (expect && k !== expect) return expect === "image" ? "File harus berupa gambar (JPG, PNG, WebP, AVIF, GIF)." : "File harus berupa video (MP4, WebM, MOV).";
  if (k === "image" && !IMAGE_TYPES.includes(type)) return `Format gambar ${type || "ini"} tidak didukung. Gunakan JPG, PNG, WebP, AVIF atau GIF.`;
  if (k === "video" && !VIDEO_TYPES.includes(type)) return `Format video ${type || "ini"} tidak didukung. Gunakan MP4 (disarankan), WebM atau MOV.`;
  if (k === "other") return "Hanya gambar dan video yang dapat diunggah.";
  if (k === "image" && size > MAX_IMAGE_BYTES) return `Gambar terlalu besar (${formatBytes(size)}). Maksimal ${formatBytes(MAX_IMAGE_BYTES)} — kompres dulu agar website tetap cepat.`;
  if (k === "video" && size > MAX_VIDEO_BYTES) return `Video terlalu besar (${formatBytes(size)}). Maksimal ${formatBytes(MAX_VIDEO_BYTES)}.`;
  return null;
}

const EXT: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/avif": "avif", "image/gif": "gif", "video/mp4": "mp4", "video/webm": "webm", "video/quicktime": "mov" };

export function storageKey(fileName: string, type: string, rnd: string) {
  const slug = fileName.toLowerCase().replace(/\.[a-z0-9]+$/, "").normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "file";
  const d = new Date();
  return `${kindOf(type)}s/${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${rnd}-${slug}.${EXT[type] ?? "bin"}`;
}
export const KEY_RE = /^(images|videos)\/\d{4}\/\d{2}\/[a-f0-9]{8}-[a-z0-9-]{1,60}\.(jpg|png|webp|avif|gif|mp4|webm|mov)$/;
