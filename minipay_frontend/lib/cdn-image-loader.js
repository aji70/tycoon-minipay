/**
 * Next.js custom image loader — skips Vercel `/_next/image`.
 * Keep this file JS (no TS import) so Next can load it from next.config.
 */
const ENV_CDN = (process.env.NEXT_PUBLIC_ASSET_CDN || "").replace(/\/$/, "");
const JSDELIVR_PUBLIC =
  "https://cdn.jsdelivr.net/gh/aji70/tycoon-minipay@main/minipay_frontend/public";

function cdnBase() {
  if (ENV_CDN) return ENV_CDN;
  if (process.env.NODE_ENV === "production") return JSDELIVR_PUBLIC;
  return "";
}

export default function cdnImageLoader({ src }) {
  if (!src) return "";
  if (/^(https?:|data:|blob:)/i.test(src)) return src;
  if (src.startsWith("/_next/")) return src;
  const path = src.startsWith("/") ? src : `/${src}`;
  const base = cdnBase();
  return base ? `${base}${path}` : path;
}
