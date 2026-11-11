/**
 * Analytics configuration (server-side only). See docs/ANALYTICS.md.
 */
export type ConsentMode = "opt-in" | "notice" | "none";

const mode = (process.env.ANALYTICS_CONSENT_MODE ?? "none").trim() as ConsentMode;

export const ANALYTICS = {
  /** Master switch: set ANALYTICS_ENABLED=false to stop collecting (dashboard keeps working). */
  enabled: (process.env.ANALYTICS_ENABLED ?? "true").toLowerCase() !== "false",
  /**
   * none   : no banner, anonymous analytics start immediately (default — decided by MIL Digital:
   *          no personal data is collected, see docs/ANALYTICS.md › Privasi).
   * opt-in : nothing is tracked until the visitor clicks "Izinkan".
   * notice : tracking runs, the banner informs and lets the visitor refuse.
   * Do-Not-Track / Global Privacy Control are always respected.
   */
  consentMode: (["opt-in", "notice", "none"].includes(mode) ? mode : "none") as ConsentMode,
  /** Timezone used for all dashboard dates. */
  timezone: process.env.ANALYTICS_TZ || "Asia/Jakarta",
  /** Raw data older than this is deleted by the daily cron (min. 30). */
  retentionDays: Math.max(30, Number(process.env.ANALYTICS_RETENTION_DAYS) || 395),
  /** Comma separated IPs (office / agency) whose traffic is ignored. IPs are never stored. */
  excludeIps: (process.env.ANALYTICS_EXCLUDE_IPS ?? "").split(",").map((s) => s.trim()).filter(Boolean),
};

/** Session timeout used by the tracker (documented; the browser enforces it). */
export const SESSION_TIMEOUT_MIN = 30;
/** Hover shorter than this is ignored (accidental pass-over). */
export const HOVER_MIN_MS = 500;
/** Heatmaps below this many interactions are flagged as "not yet representative". */
export const HEATMAP_MIN_SAMPLE = 30;
/** Tracker file version (cache-busting for /mil-analytics.js). Bump when the file changes. */
export const TRACKER_VERSION = "2";
