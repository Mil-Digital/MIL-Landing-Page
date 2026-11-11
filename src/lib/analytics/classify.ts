/**
 * Server-side classification helpers: user agent → device/browser/OS, bot detection,
 * referrer + UTM → traffic channel. Deliberately simple and dependency-free.
 */

const BOT_RE =
  /bot|crawl|spider|slurp|bingpreview|facebookexternalhit|embedly|quora link preview|whatsapp|telegrambot|discordbot|skypeuripreview|headlesschrome|phantomjs|puppeteer|playwright|lighthouse|pagespeed|gtmetrix|pingdom|uptime|monitor|curl|wget|python-requests|python-urllib|axios|node-fetch|go-http-client|java\/|okhttp|httpclient|postman|insomnia|scrapy|ahrefs|semrush|mj12|dotbot|petalbot|yandex|baiduspider|bytespider|gptbot|ccbot|claudebot|perplexity|amazonbot|applebot/i;

export const isBot = (ua: string) => !ua || ua.length < 20 || BOT_RE.test(ua);

export type DeviceType = "desktop" | "mobile" | "tablet";

export function parseUserAgent(ua: string, viewportWidth?: number): { device: DeviceType; browser: string; os: string } {
  let os = "Other";
  if (/Windows NT/i.test(ua)) os = "Windows";
  else if (/iPhone|iPod/i.test(ua)) os = "iOS";
  else if (/iPad/i.test(ua)) os = "iPadOS";
  else if (/Android/i.test(ua)) os = "Android";
  else if (/CrOS/i.test(ua)) os = "ChromeOS";
  else if (/Mac OS X|Macintosh/i.test(ua)) os = "macOS";
  else if (/Linux/i.test(ua)) os = "Linux";

  let browser = "Other";
  if (/Edg(e|A|iOS)?\//i.test(ua)) browser = "Edge";
  else if (/OPR\/|Opera/i.test(ua)) browser = "Opera";
  else if (/SamsungBrowser/i.test(ua)) browser = "Samsung Internet";
  else if (/FBAN|FBAV|Instagram|Line\//i.test(ua)) browser = "In-app (social)";
  else if (/Firefox|FxiOS/i.test(ua)) browser = "Firefox";
  else if (/Chrome|CriOS/i.test(ua)) browser = "Chrome";
  else if (/Safari/i.test(ua)) browser = "Safari";

  let device: DeviceType = "desktop";
  if (/iPad|Tablet|PlayBook|Silk/i.test(ua) || (/Android/i.test(ua) && !/Mobile/i.test(ua))) device = "tablet";
  else if (/Mobi|iPhone|iPod|Android.*Mobile|Windows Phone/i.test(ua)) device = "mobile";
  // iPadOS 13+ reports itself as macOS: a touch-sized viewport on "macOS" Safari is a tablet.
  else if (os === "macOS" && viewportWidth && viewportWidth <= 1366 && /Safari/i.test(ua) && !/Chrome/i.test(ua) && viewportWidth < 1100) device = "tablet";
  if (device === "tablet" && os === "macOS") os = "iPadOS";
  return { device, browser, os };
}

export type Channel = "direct" | "organic" | "social" | "referral" | "paid" | "email" | "other";

const SEARCH = /(^|\.)(google|bing|yahoo|duckduckgo|ecosia|yandex|baidu|naver|seznam|qwant|brave|startpage|ask)\./i;
const SOCIAL =
  /(^|\.)(facebook|fb|instagram|t\.co|twitter|x\.com|linkedin|lnkd|tiktok|youtube|youtu\.be|pinterest|reddit|threads|whatsapp|wa\.me|telegram|line\.me|snapchat|lnk\.bio|linktr\.ee)/i;
const EMAIL_HOSTS = /(^|\.)(mail\.google|outlook\.live|mail\.yahoo|webmail)/i;
const SOCIAL_SOURCES = /^(facebook|fb|ig|instagram|twitter|x|linkedin|tiktok|youtube|pinterest|reddit|threads|whatsapp|wa|telegram|line|meta)$/i;

/**
 * Channel grouping (GA4-like, simplified):
 * 1. UTM medium wins (cpc/ppc/paid → Paid Ads, email → Email, social → Social, organic → Organic Search…)
 * 2. Click IDs (gclid, fbclid with paid medium…) → Paid Ads (gclid / msclkid / dclid only)
 * 3. Referrer domain: search engine → Organic Search, social network → Social, other site → Referral
 * 4. No referrer and no campaign → Direct
 */
export function classifyChannel(i: {
  referrerDomain?: string | null;
  utmSource?: string | null;
  utmMedium?: string | null;
  paidClickId?: boolean;
}): Channel {
  const medium = (i.utmMedium ?? "").toLowerCase();
  const source = (i.utmSource ?? "").toLowerCase();
  const ref = (i.referrerDomain ?? "").toLowerCase();

  if (medium) {
    if (/^(cpc|ppc|paid|paidsearch|paid[_-]?social|cpm|cpv|cpa|display|banner|ads?|retargeting|sponsored)$/.test(medium) || medium.includes("paid")) return "paid";
    if (/e-?mail|newsletter/.test(medium)) return "email";
    if (/social|sm|social-network|social-media/.test(medium) || SOCIAL_SOURCES.test(source)) return "social";
    if (medium === "organic") return "organic";
    if (medium === "referral") return "referral";
    if (medium === "none" || medium === "(none)") return "direct";
    return "other";
  }
  if (i.paidClickId) return "paid";
  if (source) {
    if (SOCIAL_SOURCES.test(source)) return "social";
    if (/newsletter|email/.test(source)) return "email";
    if (SEARCH.test(source + ".")) return "organic";
    return "other";
  }
  if (!ref) return "direct";
  if (SEARCH.test(ref)) return "organic";
  if (SOCIAL.test(ref)) return "social";
  if (EMAIL_HOSTS.test(ref)) return "email";
  return "referral";
}

export const CHANNEL_LABELS: Record<Channel, string> = {
  direct: "Direct",
  organic: "Organic Search",
  social: "Social",
  referral: "Referral",
  paid: "Paid Ads",
  email: "Email",
  other: "Other",
};
