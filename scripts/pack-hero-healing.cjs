#!/usr/bin/env node
// Mechanically places sixteen generated potion poses into a utility atlas.
// No poses, drawing, limb deformation, or mirrored artwork are created here.
const sharp = require(process.env.SHARP_MODULE || 'sharp');
const [atlasPath, healingPath, swapSides] = process.argv.slice(2);
if (!atlasPath || !healingPath) throw new Error('Usage: node scripts/pack-hero-healing.cjs utility.png healing-4x4.png [swap-sides]');

(async () => {
  const grid = await sharp(healingPath).resize(512, 512, { fit: 'fill' }).ensureAlpha().png().toBuffer();
  const frames = [];
  for (let row = 0; row < 4; row++) for (let col = 0; col < 4; col++) {
    const sourceRow = swapSides === 'swap-sides' && row > 1 ? 5 - row : row;
    const { data, info } = await sharp(grid).extract({ left: col * 128, top: sourceRow * 128, width: 128, height: 128 })
      .raw().toBuffer({ resolveWithObject: true });
    for (let index = 3; index < data.length; index += 4) if (data[index] < 24) data[index] = 0;
    const frame = await sharp(data, { raw: info }).trim({ threshold: 10 }).png().toBuffer();
    const metadata = await sharp(frame).metadata();
    frames.push({ frame, width: metadata.width, height: metadata.height });
  }
  const scale = Math.min(112 / Math.max(...frames.map((item) => item.height)), 112 / Math.max(...frames.map((item) => item.width)));
  const clear = await sharp({ create: { width: 512, height: 512, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 1 } } }).png().toBuffer();
  const base = await sharp(atlasPath).composite([{ input: clear, left: 512, top: 0, blend: 'dest-out' }]).png().toBuffer();
  const layers = [];
  for (let row = 0; row < 4; row++) for (let col = 0; col < 4; col++) {
    const item = frames[row * 4 + col];
    const width = Math.round(item.width * scale), height = Math.round(item.height * scale);
    const input = await sharp(item.frame).resize(width, height).png().toBuffer();
    layers.push({ input, left: 512 + col * 128 + Math.round((128 - width) / 2), top: row * 128 + 118 - height });
  }
  await sharp(base).composite(layers).png({ compressionLevel: 9 }).toFile(atlasPath);
  console.log(atlasPath);
})().catch((error) => { console.error(error); process.exitCode = 1; });
