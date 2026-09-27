#!/usr/bin/env node
// Mechanical extraction/registration of authored cutout parts; no poses drawn.
// Usage: SHARP_MODULE=/path/to/sharp node scripts/pack-hero-rig.cjs hero-key source.png output.png
const sharp = require(process.env.SHARP_MODULE || 'sharp');
const layouts = require('../src/game/animation/heroRigLayout.json');
const [key, input, output] = process.argv.slice(2);
if (!layouts[key] || !input || !output) throw new Error('Usage: pack-hero-rig.cjs hero-key source.png output.png');

(async () => {
  const { data, info } = await sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const opaque = (x, y) => data[(y * info.width + x) * 4 + 3] > 40;
  const columnEdges = [0];
  for (let col = 1; col < 3; col++) {
    const guess = info.width * col / 3;
    let best = Math.round(guess), score = Infinity;
    for (let x = Math.round(guess - info.width * .13); x < guess + info.width * .13; x++) {
      let count = Math.abs(x - guess) * .03;
      for (let y = 0; y < info.height; y++) if (opaque(x, y)) count++;
      if (count < score) { score = count; best = x; }
    }
    columnEdges.push(best);
  }
  columnEdges.push(info.width);
  const cells = [];
  for (let column = 0; column < 3; column++) {
    const left = columnEdges[column], right = columnEdges[column + 1];
    const edges = [0];
    for (let row = 1; row < 4; row++) {
      const guess = info.height * row / 4;
      let best = Math.round(guess), score = Infinity;
      for (let y = Math.round(guess - info.height * .06); y < guess + info.height * .06; y++) {
        let count = Math.abs(y - guess) * .02;
        for (let x = left; x < right; x++) if (opaque(x, y)) count++;
        if (count < score) { score = count; best = y; }
      }
      edges.push(best);
    }
    edges.push(info.height);
    for (let row = 0; row < 4; row++) {
      let x0 = right, x1 = left, y0 = edges[row + 1], y1 = edges[row];
      for (let y = edges[row]; y < edges[row + 1]; y++) for (let x = left; x < right; x++) if (opaque(x, y)) {
        x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
      }
      if (x1 <= x0 || y1 <= y0) throw new Error(`Empty part ${row}:${column}`);
      // Alpha-measured centroids only guide registration, never alter pixels.
      const centroid = (from, to) => {
        let sum = 0, count = 0;
        for (let y = Math.round(y0 + (y1 - y0) * from); y <= y0 + (y1 - y0) * to; y++) {
          for (let x = x0; x <= x1; x++) if (opaque(x, y)) { sum += x - x0; count++; }
        }
        return count ? sum / count : (x1 - x0) / 2;
      };
      cells[row * 3 + column] = { left: x0, top: y0, width: x1 - x0 + 1, height: y1 - y0 + 1,
        anchor: centroid(column === 0 ? .5 : .05, column === 0 ? .85 : .25), ankle: centroid(.65, .78), toe: centroid(.9, 1) };
    }
  }
  const layers = [];
  const config = layouts[key];
  const report = [];
  for (let row = 0; row < 4; row++) for (let column = 0; column < 3; column++) {
    // The generated watermelon sheet swapped the two independently drawn side views.
    const sourceRow = key === 'hero-watermelon' && row >= 2 ? 5 - row : row;
    const frame = cells[sourceRow * 3 + column];
    const bodyHeight = config.heights[row], legLength = bodyHeight * config.legRatio;
    const hipY = 118 - legLength, overlap = 7;
    const desired = column === 0 ? bodyHeight - legLength + overlap : legLength + overlap;
    const scale = Math.min(desired / frame.height, (column === 0 ? 114 : 38) / frame.width);
    // Two source pixels per logical pixel keep rotated limbs crisp in the
    // world and in the enlarged gallery without nearest-neighbour filtering.
    const width = Math.round(frame.width * scale * 2), height = Math.round(frame.height * scale * 2);
    let source = sharp(data, { raw: info }).extract({ left: frame.left, top: frame.top, width: frame.width, height: frame.height });
    // Only isolated feet may flip, never the torso, weapon, or clothing.
    const flip = column > 0 && row >= 2 && Math.sign(frame.toe - frame.ankle) !== (row === 2 ? -1 : 1);
    if (flip) source = source.flop();
    const anchor = (flip ? frame.width - 1 - frame.anchor : frame.anchor) * scale;
    const spread = row < 2 ? config.hipSpread : 3;
    const hipX = 64 + (column === 1 ? -spread : spread);
    const x = column === 0 ? 64 - anchor : hipX - anchor;
    const y = column === 0 ? 118 - bodyHeight : hipY - overlap;
    layers.push({ input: await source.resize(width, height, { kernel: 'lanczos3' }).png().toBuffer(),
      left: column * 256 + Math.round(x * 2), top: row * 256 + Math.round(y * 2) });
    report.push({ row, column, sourceRow, flip, width, height });
  }
  await sharp({ create: { width: 768, height: 1024, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite(layers).png({ compressionLevel: 9 }).toFile(output);
  console.log(JSON.stringify({ output, parts: report }, null, 2));
})().catch((error) => { console.error(error); process.exitCode = 1; });
