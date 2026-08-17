#!/usr/bin/env node
/**
 * Convert PNG/JPG images to WebP format for optimal Vercel bandwidth savings.
 * Reduces image size by 40-50% on average.
 *
 * Usage: node scripts/convert-images-webp.mjs
 *
 * This script:
 * 1. Finds all PNG/JPG in public/ (recursive)
 * 2. Converts to WebP with quality=80 (excellent visual quality, small size)
 * 3. Creates .webp alongside originals (no deletion, safe fallback)
 * 4. Logs file size savings per image
 */

import sharp from 'sharp';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, '../public');

const QUALITY = 80; // 80 = excellent quality, high compression
const EXTENSIONS = ['.png', '.jpg', '.jpeg'];

async function getFilesRecursive(dir) {
  const files = [];
  const entries = await fs.readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...await getFilesRecursive(fullPath));
    } else if (EXTENSIONS.includes(path.extname(entry.name).toLowerCase())) {
      files.push(fullPath);
    }
  }
  return files;
}

async function convertImage(imagePath) {
  const ext = path.extname(imagePath).toLowerCase();
  const webpPath = imagePath.replace(ext, '.webp');

  // Skip if WebP already exists
  try {
    await fs.access(webpPath);
    console.log(`✓ ${path.relative(publicDir, webpPath)} (already exists)`);
    return null;
  } catch {}

  try {
    const stats = await fs.stat(imagePath);
    const originalSize = stats.size;

    // Convert to WebP
    await sharp(imagePath)
      .webp({ quality: QUALITY })
      .toFile(webpPath);

    const newStats = await fs.stat(webpPath);
    const newSize = newStats.size;
    const saved = originalSize - newSize;
    const percent = Math.round((saved / originalSize) * 100);

    console.log(`✓ ${path.relative(publicDir, webpPath)} (${originalSize}B → ${newSize}B, saved ${percent}%)`);
    return { originalSize, newSize, saved };
  } catch (error) {
    console.error(`✗ ${imagePath}: ${error.message}`);
    return null;
  }
}

async function main() {
  console.log(`🖼️  Image WebP Conversion Script\n`);
  console.log(`Scanning ${publicDir}...\n`);

  const files = await getFilesRecursive(publicDir);
  console.log(`Found ${files.length} image files\n`);

  let totalOriginal = 0;
  let totalNew = 0;
  let count = 0;

  for (const file of files) {
    const result = await convertImage(file);
    if (result) {
      totalOriginal += result.originalSize;
      totalNew += result.newSize;
      count++;
    }
  }

  if (count > 0) {
    const totalSaved = totalOriginal - totalNew;
    const totalPercent = Math.round((totalSaved / totalOriginal) * 100);
    console.log(`\n📊 Summary`);
    console.log(`   Original total: ${(totalOriginal / 1024 / 1024).toFixed(2)} MB`);
    console.log(`   WebP total:     ${(totalNew / 1024 / 1024).toFixed(2)} MB`);
    console.log(`   Saved:          ${(totalSaved / 1024 / 1024).toFixed(2)} MB (${totalPercent}%)`);
    console.log(`   Converted:      ${count} images\n`);
    console.log(`✅ Vercel bandwidth savings: ~${(totalSaved / 1024 / 1024 * 1000).toFixed(0)}MB per 1000 users\n`);
  } else {
    console.log('No images converted (all WebP versions already exist)');
  }
}

main().catch(console.error);
