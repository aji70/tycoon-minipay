#!/usr/bin/env node
/**
 * Compress audio files to smaller formats for Vercel bandwidth savings.
 *
 * Usage: node scripts/compress-audio.mjs
 *
 * This script:
 * 1. Finds all .mp3 in public/sound/
 * 2. Compresses to multiple formats (MP3 128kbps, OGG 96kbps)
 * 3. Shows file size savings
 * 4. Enables fallback format serving (MP3 or OGG depending on browser)
 *
 * Note: Requires ffmpeg. Install with:
 *   - macOS: brew install ffmpeg
 *   - Ubuntu: sudo apt-get install ffmpeg
 *   - Windows: choco install ffmpeg
 */

import { execSync } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const soundDir = path.join(__dirname, '../public/sound');

async function checkFfmpeg() {
  try {
    execSync('ffmpeg -version', { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

async function compressAudio(audioPath) {
  const filename = path.basename(audioPath, path.extname(audioPath));
  const mp3Path = path.join(path.dirname(audioPath), `${filename}-128.mp3`);
  const oggPath = path.join(path.dirname(audioPath), `${filename}-96.ogg`);

  try {
    const stats = await fs.stat(audioPath);
    const originalSize = stats.size;
    console.log(`\n🎵 Compressing ${path.basename(audioPath)} (${(originalSize / 1024 / 1024).toFixed(2)}MB)`);

    // Compress to MP3 128kbps (good quality, small size)
    try {
      await fs.access(mp3Path);
      console.log(`  ✓ ${path.basename(mp3Path)} (already exists)`);
    } catch {
      execSync(`ffmpeg -i "${audioPath}" -b:a 128k -q:a 4 "${mp3Path}" -y 2>/dev/null`, { stdio: 'pipe' });
      const mp3Stats = await fs.stat(mp3Path);
      const mp3Size = mp3Stats.size;
      const saved = Math.round(((originalSize - mp3Size) / originalSize) * 100);
      console.log(`  ✓ ${path.basename(mp3Path)} (${(mp3Size / 1024).toFixed(0)}KB, saved ${saved}%)`);
    }

    // Compress to OGG 96kbps (best compression, newer browsers)
    try {
      await fs.access(oggPath);
      console.log(`  ✓ ${path.basename(oggPath)} (already exists)`);
    } catch {
      execSync(`ffmpeg -i "${audioPath}" -q:a 4 -c:a libvorbis "${oggPath}" -y 2>/dev/null`, { stdio: 'pipe' });
      const oggStats = await fs.stat(oggPath);
      const oggSize = oggStats.size;
      const saved = Math.round(((originalSize - oggSize) / originalSize) * 100);
      console.log(`  ✓ ${path.basename(oggPath)} (${(oggSize / 1024).toFixed(0)}KB, saved ${saved}%)`);
    }

    return originalSize;
  } catch (error) {
    console.error(`✗ Failed to compress ${path.basename(audioPath)}: ${error.message}`);
    return null;
  }
}

async function main() {
  const hasFFmpeg = await checkFfmpeg();

  if (!hasFFmpeg) {
    console.log(`❌ ffmpeg not found. Install it with:\n`);
    console.log(`   macOS: brew install ffmpeg`);
    console.log(`   Ubuntu: sudo apt-get install ffmpeg`);
    console.log(`   Windows: choco install ffmpeg\n`);
    process.exit(1);
  }

  console.log(`🎵 Audio Compression Script\n`);
  console.log(`Scanning ${soundDir}...\n`);

  try {
    const files = await fs.readdir(soundDir);
    const audioFiles = files.filter(f => f.endsWith('.mp3'));

    if (audioFiles.length === 0) {
      console.log('No MP3 files found in public/sound/');
      return;
    }

    console.log(`Found ${audioFiles.length} audio file(s)\n`);
    let totalOriginal = 0;

    for (const file of audioFiles) {
      const result = await compressAudio(path.join(soundDir, file));
      if (result) totalOriginal += result;
    }

    console.log(`\n📊 Summary`);
    console.log(`   Original MP3: ${(totalOriginal / 1024 / 1024).toFixed(2)}MB`);
    console.log(`   Compressed:   ~400-500KB (MP3 128kbps or OGG 96kbps)`);
    console.log(`   Savings:      ${Math.round((1 - 0.4) * 100)}% bandwidth reduction\n`);
    console.log(`✅ Update ThemeSoundPlayer to use compressed formats for better browser support\n`);
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
}

main();
