#!/usr/bin/env node
// Packs an already drawn 4x2 transparent animation into one eight-frame row.
// It crops and aligns artwork only: no poses or mirrored frames are synthesized.
const sharp = require(process.env.SHARP_MODULE || 'sharp');
const [input, output] = process.argv.slice(2);
if (!input || !output) throw new Error('Usage: node scripts/pack-animation-strip.cjs input.png output.png');
(async () => {
  const { data, info } = await sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const occupied = (x, y) => data[(y * info.width + x) * 4 + 3] > 20;
  const frames = [];
  for (let row = 0; row < 2; row++) {
    const top = Math.floor(row * info.height / 2), bottom = Math.floor((row + 1) * info.height / 2);
    const edges = [0];
    for (let col = 1; col < 4; col++) {
      const guess = Math.round(col * info.width / 4);
      let best = guess, score = Infinity;
      for (let x = guess - 45; x <= guess + 45; x++) {
        let candidate = Math.abs(x - guess) * 0.04;
        for (let y = top; y < bottom; y++) if (occupied(x, y)) candidate++;
        if (candidate < score) { score = candidate; best = x; }
      }
      edges.push(best);
    }
    edges.push(info.width);
    for (let col = 0; col < 4; col++) {
      let left = info.width, right = -1, first = info.height, last = -1;
      for (let y = top; y < bottom; y++) for (let x = edges[col]; x < edges[col + 1]; x++) if (occupied(x, y)) {
        left = Math.min(left, x); right = Math.max(right, x); first = Math.min(first, y); last = Math.max(last, y);
      }
      if (right < left) throw new Error(`Empty frame ${row}:${col}`);
      frames.push({ left, top: first, width: right - left + 1, height: last - first + 1 });
    }
  }
  const scale = Math.min(114 / Math.max(...frames.map(f => f.width)), 114 / Math.max(...frames.map(f => f.height)));
  const layers = [];
  for (let index = 0; index < frames.length; index++) {
    const frame = frames[index], width = Math.round(frame.width * scale), height = Math.round(frame.height * scale);
    const buffer = await sharp(input).extract(frame).resize(width, height).png().toBuffer();
    layers.push({ input: buffer, left: index * 128 + Math.round((128 - width) / 2), top: 118 - height });
  }
  await sharp({ create: { width: 1024, height: 128, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } }).composite(layers).png().toFile(output);
})().catch(error => { console.error(error); process.exitCode = 1; });
