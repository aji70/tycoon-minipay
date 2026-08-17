/**
 * Off-Vercel CDN for static images (boards, shop cards, hero, /game icons).
 *
 * Browser loads these from the CDN origin → they do not count as Vercel Edge Requests.
 * Local `/public` is used in development. Override in production with NEXT_PUBLIC_ASSET_CDN
 * (Cloudflare R2 public URL, no trailing slash).
 */
const ENV_CDN = (process.env.NEXT_PUBLIC_ASSET_CDN || "").replace(/\/$/, "");

/** GitHub → jsDelivr. Same files as /public in this repo. */
const JSDELIVR_PUBLIC =
  "https://cdn.jsdelivr.net/gh/aji70/tycoon-minipay@main/minipay_frontend/public";

export function getAssetCdnBase(): string {
  if (ENV_CDN) return ENV_CDN;
  if (process.env.NODE_ENV === "production") return JSDELIVR_PUBLIC;
  return "";
}

export function assetUrl(src: string | undefined | null): string {
  if (!src) return "";
  if (/^(https?:|data:|blob:)/i.test(src)) return src;
  // Webpack-hashed files live on Vercel; leave them unless we switch to /public paths.
  if (src.startsWith("/_next/")) return src;
  const path = src.startsWith("/") ? src : `/${src}`;
  const base = getAssetCdnBase();
  return base ? `${base}${path}` : path;
}
