#!/usr/bin/env node
// Mechanical packing/compositing of imagegen artwork; no poses are synthesized.
// Usage: node scripts/pack-hero-motion.cjs full-twelve-rows.png corrected-top-eight-rows.png output.png
const sharp = require(process.env.SHARP_MODULE || 'sharp');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const [full, top, output] = process.argv.slice(2);
if (!full || !top || !output) throw new Error('Expected full sheet, corrected top block and output paths');
const staging = fs.mkdtempSync(path.join(os.tmpdir(), 'forest-motion-'));
(async () => {
  const pack = path.join(__dirname, 'pack-animation-sheet.cjs');
  const fullPacked = path.join(staging, 'full.png');
  const topPacked = path.join(staging, 'top.png');
  execFileSync(process.execPath, [pack, full, fullPacked], { env: { ...process.env, ANIMATION_SHEET_ROWS: '12' }, stdio: 'inherit' });
  execFileSync(process.execPath, [pack, top, topPacked], { env: { ...process.env, ANIMATION_SHEET_ROWS: '8' }, stdio: 'inherit' });
  const bottom = await sharp(fullPacked).extract({ left: 0, top: 1024, width: 1024, height: 512 }).png().toBuffer();
  await sharp({ create: { width: 1024, height: 1536, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: topPacked, top: 0, left: 0 }, { input: bottom, top: 1024, left: 0 }])
    .png({ compressionLevel: 9 }).toFile(output);
  console.log(output);
})().catch((error) => { console.error(error); process.exitCode = 1; }).finally(() => fs.rmSync(staging, { recursive: true }));
