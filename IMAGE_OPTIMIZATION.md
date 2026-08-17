# Why Vercel is expensive (and how we cut it)

The previous advice (enable AVIF/WebP **via** `next/image`) **increased** the bill. Vercel charges **Image Optimization** separately from bandwidth.

## What you are paying for

| Meter | What triggers it | This app |
| --- | --- | --- |
| **Image Optimization** | Every unique `/_next/image?url=…&w=…&q=…` | Board tiles, shop cards, perks, hero — many images × many device widths |
| **Bandwidth** | Bytes actually downloaded | Large PNG/JPG in `/public` |
| **Function duration** | Serverless / Fluid CPU time | Not the main driver here |

`next/image` on Vercel does **not** just “serve WebP”. It **transforms** the source on first request. Default config had:

- 8 `deviceSizes` + 8 `imageSizes` = **16 widths**
- `formats: ['image/avif', 'image/webp']` = **2 extra formats**
- Up to **~32 variants per source file**

A game session loads dozens of those files. Unique `w=` values from MiniPay phones count as **new transformations**. That is usually the line item that blows up.

Bandwidth math in the old doc (`10k users × 30 images × 25MB`) was also wrong: users do not download the entire asset folder each session.

## Fix (in code)

`next.config.mjs` now has:

```js
images: {
  unoptimized: true, // skip /_next/image — no Image Optimization invoice
}
```

`<Image>` still works; it just serves `/public/...` as static files (CDN + cache). Static image/audio also get a 1-year `Cache-Control`.

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

What does count:
- Board/shop images hosted on Vercel (one request per file, every uncached load)
- JS bundles (wagmi, three.js, etc.)
- `Link` prefetch of `/game-shop`, `/leaderboard`, `/profile`, …

Nav/footer prefetch is now off (`prefetch={false}`). Cache-Control on images cuts **repeat** visits.

To cut Edge Requests further, host `/public` images on Cloudflare R2 (or similar) so those files never hit Vercel.

## After deploy, check Vercel

1. **Usage → Image Optimization** should drop toward zero (no `/_next/image` in Network).
2. **Edge Requests** should fall as prefetch and `/_next/image` variants stop.
3. Confirm a board load: image URLs should be `/boards/...` or `/shopcards/...`, not `/_next/image?...`.
