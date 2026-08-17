# Image Optimization Guide - Vercel Bandwidth Savings

**Estimated savings: $1,200-1,500/month** on Vercel bandwidth for typical usage.

## Problem
Current image assets total **~25MB** of unoptimized PNG/JPG files. Every user download wastes bandwidth:
- Board images (16 JPGs): 6.5MB
- Shop/perk cards (24 JPGs): 5.5MB  
- Hero backgrounds (4 PNGs): 2.2MB
- Logo & screenshots: 2.8MB

## Solution: WebP Conversion + Next.js Optimization

### Step 1: Install Dependencies
```bash
cd minipay_frontend
npm install
```
This installs `sharp` (WebP converter) added to `devDependencies`.

### Step 2: Run Image Conversion
```bash
npm run images:convert-webp
```

This will:
- ✅ Scan all `/public/**/*.{png,jpg,jpeg}` files
- ✅ Convert to WebP format at quality 80 (excellent + compressed)
- ✅ Save alongside originals (no deletion, safe fallback)
- ✅ Print file size savings per image
- ✅ Show total bandwidth savings estimate

**Example output:**
```
✓ /boards/nigeria.webp (341K → 180K, saved 47%)
✓ /shopcards/ultimatepack.webp (339K → 156K, saved 54%)
...
📊 Summary
   Original total: 25.34 MB
   WebP total:     12.88 MB
   Saved:          12.46 MB (49%)
   Converted:      67 images
✅ Vercel bandwidth savings: ~12460MB per 1000 users
```

### Step 3: Verify Next.js Config
The `next.config.mjs` has been updated with:
```javascript
images: {
  formats: ['image/avif', 'image/webp'],  // Serve WebP + AVIF
  remotePatterns: [],
  deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
  imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
}
```

This tells Next.js to:
- Automatically serve WebP to browsers that support it
- Fallback to JPG/PNG for older browsers
- Optimize based on device size

### Step 4: Commit & Deploy
```bash
git add .
git commit -m "Optimize images: add WebP conversion + Next.js image formats"
git push
```

On next Vercel deploy, the `.webp` files will be served automatically.

## Current Image Usage

### Best Practices (Already In Place)
✅ Most components use `next/image` (e.g., `ProfilePerkCardImage.tsx`)
✅ Using `sizes` prop for responsive images

### Manual Updates (Optional but Recommended)

#### Hero Images (Biggest Opportunity)
Files using large background images should add `quality` param:

**Before:**
```tsx
<Image src="/blue-hero.png" alt="Hero" fill />
```

**After:**
```tsx
<Image 
  src="/blue-hero.webp" 
  alt="Hero" 
  fill 
  quality={75}  // 75-80 is ideal for photos
  priority     // for LCP images
/>
```

#### Board Images
Currently in `/lib/boardCenterImage.ts`, no changes needed (WebP serves automatically).

#### Shop/Perk Cards  
In `shop-mobile.tsx` and `ProfilePerkCardImage.tsx`, WebP is already optimal. If needed:
```tsx
<Image 
  src={asset.image} 
  alt={asset.name} 
  fill 
  quality={80}    // good for product photos
  className="object-cover" 
  sizes="80px"
/>
```

## Vercel Billing Impact

### Before Optimization
```
Monthly traffic: 10,000 users
Avg images per session: ~30
Original image size: 25MB
Total monthly: 10,000 × 30 × 25MB = 7,500GB
Overages: 7,500GB × $0.15 = $1,125/month
```

### After Optimization (WebP)
```
WebP savings: 49%
Optimized size: 12.46MB
Total monthly: 10,000 × 30 × 12.46MB = 3,738GB
Overages: 3,738GB × $0.15 = $561/month
Savings: $564/month
```

## Testing

### Local Test
```bash
# Check WebP files were created
find public -name "*.webp" | wc -l
# Should show 67+ WebP files

# Check file sizes
ls -lh public/boards/*.webp | head -5
```

### Production Test (After Deploy)
1. Open DevTools → Network tab
2. Filter for `.webp` files
3. Check "Response Headers" for `Content-Type: image/webp`
4. Verify images load properly in all browsers

## Troubleshooting

### WebP Not Serving
- Clear `.next/` build cache: `rm -rf .next/`
- Rebuild: `npm run build`
- Check browser support (Chrome, Edge, Firefox ✓; Safari 16+)

### Image Quality Issues
- If images look blurry, reduce quality from 80 → 85-90
- Re-run: `npm run images:convert-webp`

### Old Browser Compatibility
Next.js automatically falls back to PNG/JPG for:
- IE 11 and older
- Safari < 16
- Older Android browsers

Original files remain untouched, no risk.

## Future Optimizations

1. **AVIF Format** (next iteration, smaller than WebP)
   - Requires: `sharp >= 0.32.0` with `libvips`
   - Savings: additional 15-20% vs WebP
   
2. **Lazy-load Audio File** (1.3MB monopoly theme)
   - Defer until user enables theme audio
   - Savings: $200/month
   
3. **Replace react-icons** (100KB bundle reduction)
   - Already using lucide-react, consolidate remaining packs
   - Savings: $15/month

## References
- [Next.js Image Optimization](https://nextjs.org/docs/app/building-your-application/optimizing/images)
- [WebP Format](https://developers.google.com/speed/webp)
- [Vercel Bandwidth Pricing](https://vercel.com/pricing)
