"use client";
import { api } from "./api";
import { checkFile, kindOf } from "@/content/media-rules";

export { formatBytes, IMAGE_TYPES, VIDEO_TYPES, kindOf } from "@/content/media-rules";

export type MediaAsset = {
  id: string;
  storage_path: string;
  public_url: string;
  file_name: string;
  mime_type: string;
  kind: "image" | "video" | "other";
  size_bytes: number;
  width: number | null;
  height: number | null;
  duration_seconds: number | null;
  alt_text: string | null;
  created_at: string;
  updated_at: string;
};

export const validateFile = (file: File, expect?: "image" | "video") => checkFile(file.type, file.size, expect);

export function probeImage(src: Blob): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(src);
    const img = new Image();
    img.onload = () => { resolve({ width: img.naturalWidth, height: img.naturalHeight }); URL.revokeObjectURL(url); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("File gambar rusak atau tidak dapat dibaca.")); };
    img.src = url;
  });
}

export function probeVideo(src: Blob): Promise<{ width: number; height: number; duration: number }> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(src);
    const v = document.createElement("video");
    v.preload = "metadata";
    v.muted = true;
    let done = false;
    const finish = (r: { width: number; height: number; duration: number }) => { if (done) return; done = true; URL.revokeObjectURL(url); resolve(r); };
    v.onloadedmetadata = () => finish({ width: v.videoWidth, height: v.videoHeight, duration: v.duration });
    v.onerror = () => finish({ width: 0, height: 0, duration: 0 });
    setTimeout(() => finish({ width: 0, height: 0, duration: 0 }), 8000);
    v.src = url;
  });
}

/** Upload straight to Neon Object Storage with a presigned URL; returns the registration payload. */
async function putFile(file: File) {
  const kind = kindOf(file.type);
  const dims: { width: number; height: number; duration?: number } =
    kind === "image" ? await probeImage(file) : kind === "video" ? await probeVideo(file) : { width: 0, height: 0 };
  const { key, uploadUrl, headers } = await api<{ key: string; uploadUrl: string; headers: Record<string, string> }>(
    "/api/admin/media/presign",
    { body: { fileName: file.name, contentType: file.type, size: file.size } },
  );
  const res = await fetch(uploadUrl, { method: "PUT", headers, body: file }).catch(() => null);
  if (!res || !res.ok) throw new Error(`Upload ke storage gagal${res ? ` (${res.status})` : ""}. Cek koneksi atau konfigurasi CORS bucket.`);
  return { key, fileName: file.name, width: dims.width, height: dims.height, duration: dims.duration };
}

export async function uploadAsset(file: File, expect?: "image" | "video"): Promise<MediaAsset> {
  const err = validateFile(file, expect);
  if (err) throw new Error(err);
  const body = await putFile(file);
  return (await api<{ asset: MediaAsset }>("/api/admin/media", { body })).asset;
}

/** Replace the file behind an asset; drafts that use it are updated server-side. */
export async function replaceAsset(asset: MediaAsset, file: File) {
  const err = validateFile(file, asset.kind === "other" ? undefined : asset.kind);
  if (err) throw new Error(err);
  const body = await putFile(file);
  return api<{ asset: MediaAsset; updatedFields: number }>(`/api/admin/media/${asset.id}`, { method: "PATCH", body });
}

export const deleteAsset = (asset: MediaAsset) => api(`/api/admin/media/${asset.id}`, { method: "DELETE" });

export const listAssets = async (kind?: "image" | "video") =>
  (await api<{ assets: MediaAsset[] }>(`/api/admin/media${kind ? `?kind=${kind}` : ""}`)).assets;

/** Move a bundled original asset (/assets/…) into Neon Object Storage and point drafts at it. */
export async function migrateBundledAsset(url: string): Promise<MediaAsset> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Tidak dapat membaca ${url}`);
  const blob = await res.blob();
  const name = url.split("/").pop() || "asset";
  const type = blob.type && blob.type !== "application/octet-stream" ? blob.type
    : name.endsWith(".mp4") ? "video/mp4" : name.endsWith(".webp") ? "image/webp" : name.endsWith(".png") ? "image/png" : "image/jpeg";
  const asset = await uploadAsset(new File([blob], name, { type }));
  await api("/api/admin/content/rewrite", { body: { from: url, to: asset.public_url, width: asset.width, height: asset.height } });
  return asset;
}

/** Which sections reference a URL, in draft and/or published content. */
export function usageOf(url: string, rows: { section_id: string; draft_value: unknown; published_value: unknown }[]) {
  const needle = JSON.stringify(url).slice(1, -1);
  const draft = new Set<string>();
  const live = new Set<string>();
  for (const r of rows) {
    if (JSON.stringify(r.draft_value ?? null).includes(needle)) draft.add(r.section_id);
    if (JSON.stringify(r.published_value ?? null).includes(needle)) live.add(r.section_id);
  }
  return { draft, live, used: draft.size > 0 || live.size > 0 };
}
