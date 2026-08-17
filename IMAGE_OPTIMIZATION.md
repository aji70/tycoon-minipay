# Why Vercel is expensive (and how we cut it)

The previous advice (enable AVIF/WebP **via** `next/image`) **increased** the bill. Vercel charges **Image Optimization** separately from bandwidth.

## What you are paying for

| Meter | What triggers it | This app |
| --- | --- | --- |
| **Image Optimization** | Every unique `/_next/image?url=…&w=…&q=…` | Board tiles, shop cards, perks, hero — many images × many device widths |
| **Edge Requests** | Every CDN hit on Vercel (HTML, JS, CSS, `/public` images, prefetch) | Board/shop art was the bulk after Image Optimization |
| **Bandwidth** | Bytes actually downloaded | Large PNG/JPG in `/public` |
| **Function duration** | Serverless / Fluid CPU time | Not the main driver here |

`next/image` on Vercel does **not** just “serve WebP”. It **transforms** the source on first request. Default config had:

- 8 `deviceSizes` + 8 `imageSizes` = **16 widths**
- `formats: ['image/avif', 'image/webp']` = **2 extra formats**
- Up to **~32 variants per source file**

A game session loads dozens of those files. Unique `w=` values from MiniPay phones count as **new transformations**. That is usually the line item that blows up.

Bandwidth math in the old doc (`10k users × 30 images × 25MB`) was also wrong: users do not download the entire asset folder each session.

## Fix (in code)

`next.config.mjs` uses a **custom image loader** (not `unoptimized` alone):

```js
images: {
  loader: "custom",
  loaderFile: "./lib/cdn-image-loader.js",
}
```

That does two things:

1. **No `/_next/image`** → Image Optimization invoice goes to zero.
2. **Production `src` points at a CDN**, not Vercel `/public` → those files are **not** Edge Requests.

Default CDN is jsDelivr (same files as GitHub `main`):

`https://cdn.jsdelivr.net/gh/aji70/tycoon-minipay@main/minipay_frontend/public`

Override with `NEXT_PUBLIC_ASSET_CDN` (Cloudflare R2 public URL, no trailing slash) if you want your own origin.

Local `next dev` still uses `/public` on localhost.

Three.js board-center textures and theme audio use `assetUrl()` in `lib/assetUrl.ts` (they never go through `next/image`).

Nav/footer `Link` prefetch is off (`prefetch={false}`). Static files that still hit Vercel (JS/CSS/HTML) keep a 1-year `Cache-Control` where applicable.

Redeploy the MiniPay frontend for this to take effect on Vercel.

## Optional: shrink bandwidth further

Pre-compress files once (does **not** create Vercel transformations):

```bash
cd minipay_frontend
npm run images:convert-webp
```

Then point `src` at `.webp` where you still have huge PNG/JPG. Originals can stay as fallback.

## Edge Requests (separate meter)

Vercel counts **every** CDN hit: HTML, JS chunks, CSS, images, `/_next/image`, and Next.js **prefetch**.

Chat/game polling does **not** count — that goes to Railway (`NEXT_PUBLIC_API_URL`).

What still counts after this change:

- HTML + JS bundles (wagmi, three.js, etc.)
- CSS
- Favicon / app icons if they stay on Vercel

What should **stop** counting:

- `/boards/...`, `/shopcards/...`, hero, logos, theme MP3 (loaded from jsDelivr or `NEXT_PUBLIC_ASSET_CDN`)

## After deploy, check Vercel

1. **Usage → Image Optimization** should drop toward zero (no `/_next/image` in Network).
2. **Edge Requests** should fall as board/shop images leave Vercel.
3. Confirm a board load: image URLs should be `cdn.jsdelivr.net/gh/aji70/tycoon-minipay@...` (or your R2 host), not `tycoonworld.xyz/boards/...` and not `/_next/image?...`.
