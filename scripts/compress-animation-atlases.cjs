#!/usr/bin/env node
// Lossy palette quantization only; keep the imagegen source manifests to repack.
// Usage: node scripts/compress-animation-atlases.cjs [animation-directory]
const sharp = require(process.env.SHARP_MODULE || 'sharp');
const fs = require('node:fs');
const path = require('node:path');
const directory = path.resolve(process.argv[2] || path.join(__dirname, '../public/assets/animations'));
(async () => {
  let before = 0, after = 0, count = 0, auxiliarySheets = 0;
  for (const file of fs.readdirSync(directory).filter((file) => file.endsWith('.png'))) {
    const target = path.join(directory, file);
    const original = fs.readFileSync(target);
    // Re-running this command must not repeatedly quantize already indexed art.
    const output = original[25] === 3 ? original : await sharp(original).png({ palette: true, colours: 256, dither: 0.25, effort: 7 }).toBuffer();
    const metadata = await sharp(output).metadata();
    if (metadata.width !== 1024 || ![128, 512, 1536].includes(metadata.height) || !metadata.hasAlpha) throw new Error(`Invalid packed atlas: ${file}`);
    before += original.length;
    if (output.length < original.length) fs.writeFileSync(target, output);
    after += Math.min(original.length, output.length);
    count++;
    if (metadata.height !== 1536) auxiliarySheets++;
  }
  console.log(JSON.stringify({ count, atlases: count - auxiliarySheets, auxiliarySheets, before, after, savedPercent: Math.round((1 - after / before) * 100) }));
})().catch((error) => { console.error(error); process.exitCode = 1; });
