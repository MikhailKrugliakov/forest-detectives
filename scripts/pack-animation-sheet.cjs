#!/usr/bin/env node
// Mechanical chroma-key extraction only; no artwork or animation poses are synthesized.
// Usage: node scripts/pack-animation-sheet.cjs source.png output.png [swap-sides]
// Install sharp locally, or provide SHARP_MODULE pointing to an existing installation.
// ANIMATION_SHEET_ROWS=8 supports separately generated eight-row motion blocks.
const sharp = require(process.env.SHARP_MODULE || 'sharp');
const [input, output, swapSides] = process.argv.slice(2);
if (!input || !output) throw new Error('Usage: node scripts/pack-animation-sheet.cjs source.png output.png [swap-sides]');
const rowCount = Number(process.env.ANIMATION_SHEET_ROWS || 12);
if (![4, 8, 12].includes(rowCount)) throw new Error('ANIMATION_SHEET_ROWS must be 4, 8 or 12');
const canvasHeight = rowCount * 128;
// Opt in only for artwork without violet fabric (inspect before enabling).
const wideKey = process.env.CHROMA_PROFILE === 'magenta-wide';
const greenKey = process.env.CHROMA_PROFILE === 'green';
const keyRgb = greenKey ? [0, 255, 0] : [255, 0, 255];

function removeMagenta(data, width, height) {
  const pixels = width * height;
  const background = new Uint8Array(pixels);
  const queue = new Int32Array(pixels);
  const isKey = (i) => {
    const r = data[i * 4], g = data[i * 4 + 1], b = data[i * 4 + 2];
    const key = greenKey ? g > 80 && g - Math.max(r, b) > 25 : wideKey
      ? Math.min(r, b) > 70 && Math.min(r, b) - g > 40 && Math.abs(r - b) < 110
      : r > 185 && b > 185 && g < 100;
    return data[i * 4 + 3] < 4 || key;
  };
  let start = 0;
  let end = 0;
  const add = (i) => {
    if (i < 0 || i >= pixels || background[i] || !isKey(i)) return;
    background[i] = 1;
    queue[end++] = i;
  };
  // Seed each cell boundary, not purple costume details inside the silhouette.
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const p = (y * width + x) * 4;
    const pureKey = greenKey ? data[p + 1] > 140 && data[p + 1] - Math.max(data[p], data[p + 2]) > 75 :
      data[p] > 235 && data[p + 2] > 235 && data[p + 1] < 40 || wideKey &&
      Math.min(data[p], data[p + 2]) > 140 && Math.min(data[p], data[p + 2]) - data[p + 1] > 110 && Math.abs(data[p] - data[p + 2]) < 70;
    if (pureKey || x % 128 === 0 || x % 128 === 127 || y % 128 === 0 || y % 128 === 127) add(y * width + x);
  }
  while (start < end) {
    const i = queue[start++];
    const x = i % width;
    if (x) add(i - 1);
    if (x + 1 < width) add(i + 1);
    add(i - width);
    add(i + width);
  }
  const source = Buffer.from(data);
  const nearBackground = (x, y, radius) => {
    for (let dy = -radius; dy <= radius; dy++) for (let dx = -radius; dx <= radius; dx++) {
      const nx = x + dx, ny = y + dy;
      if (nx >= 0 && ny >= 0 && nx < width && ny < height && background[ny * width + nx]) return true;
    }
    return false;
  };
  for (let i = 0; i < pixels; i++) {
    const p = i * 4;
    if (background[i]) { data[p] = data[p + 1] = data[p + 2] = data[p + 3] = 0; continue; }
    const r = source[p], g = source[p + 1], b = source[p + 2];
    if (greenKey ? g - Math.max(r, b) < 15 : Math.min(r, b) - g < 15) continue;
    const x = i % width, y = Math.floor(i / width);
    if (!nearBackground(x, y, 2)) continue;
    // Recover the original edge color from a nearby interior sample. The
    // projection estimates the foreground fraction in C = a*F + (1-a)*key.
    // Only the two-pixel keyed boundary is processed; interior purple survives.
    let sample = -1;
    let distance = Infinity;
    for (let dy = -5; dy <= 5; dy++) for (let dx = -5; dx <= 5; dx++) {
      const nx = x + dx, ny = y + dy;
      const d = dx * dx + dy * dy;
      if (!d || d >= distance || nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
      const j = ny * width + nx;
      if (background[j] || source[j * 4 + 3] < 240 || nearBackground(nx, ny, 1)) continue;
      sample = j * 4;
      distance = d;
    }
    if (sample < 0) continue;
    const fr = source[sample] - keyRgb[0], fg = source[sample + 1] - keyRgb[1], fb = source[sample + 2] - keyRgb[2];
    const denominator = fr * fr + fg * fg + fb * fb;
    const alpha = Math.max(0, Math.min(1, ((r - keyRgb[0]) * fr + (g - keyRgb[1]) * fg + (b - keyRgb[2]) * fb) / Math.max(1, denominator)));
    const error = Math.hypot(r - (keyRgb[0] + alpha * fr), g - (keyRgb[1] + alpha * fg), b - (keyRgb[2] + alpha * fb));
    // Reject unrelated colors: important for violet scarves and pink ears.
    if (error > 65 || alpha >= 0.98) continue;
    data[p + 3] = Math.round(source[p + 3] * alpha);
    for (let c = 0; c < 3; c++) {
      const key = keyRgb[c];
      data[p + c] = alpha > 0.08 ? Math.max(0, Math.min(255, Math.round((source[p + c] - (1 - alpha) * key) / alpha))) : source[sample + c];
    }
  }
  return data;
}

(async () => {
  const { data, info } = await sharp(input).resize(1024, canvasHeight, { fit: 'fill' }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  removeMagenta(data, info.width, info.height);
  const source = await sharp(data, { raw: info }).png().toBuffer();
  const occupied = (x, y) => data[(y * 1024 + x) * 4 + 3] > 20;
  const occupancy = new Float64Array(canvasHeight + 1);
  for (let y = 0; y < canvasHeight; y++) for (let x = 0; x < 1024; x++) if (occupied(x, y)) occupancy[y]++;
  // Find all row bands together: generated sheets can have unequal
  // spacing, and independently snapping fixed 128px edges can bisect faces.
  const scores = Array.from({ length: rowCount + 1 }, () => new Float64Array(canvasHeight + 1).fill(Infinity));
  const previous = Array.from({ length: rowCount + 1 }, () => new Int32Array(canvasHeight + 1).fill(-1));
  scores[0][0] = 0;
  for (let row = 1; row <= rowCount; row++) {
    const first = row === rowCount ? canvasHeight : Math.max(row * 70, canvasHeight - (rowCount - row) * 190);
    const last = row === rowCount ? canvasHeight : Math.min(row * 190, canvasHeight - (rowCount - row) * 70);
    for (let y = first; y <= last; y++) {
      for (let old = Math.max(0, y - 190); old <= y - 70; old++) {
        const cost = scores[row - 1][old] + occupancy[y] * 5 + Math.pow(y - old - 128, 2) * 0.01;
        if (cost < scores[row][y]) { scores[row][y] = cost; previous[row][y] = old; }
      }
    }
  }
  const rowEdges = [canvasHeight];
  for (let row = rowCount; row > 0; row--) rowEdges.unshift(previous[row][rowEdges[0]]);
  if (rowEdges.slice(1, -1).some((edge) => edge < 0 || occupancy[edge] > 18)) {
    throw new Error(`Cannot identify ${rowCount} separate sprite rows without cutting artwork; regenerate the source sheet.`);
  }
  const frames = [];
  for (let row = 0; row < rowCount; row++) {
    const top = rowEdges[row], bottom = rowEdges[row + 1];
    const columnEdges = [0];
    for (let col = 1; col < 8; col++) {
      const guess = col * 128;
      let best = guess, score = Infinity;
      for (let x = guess - 24; x <= guess + 24; x++) {
        let count = Math.abs(x - guess) * 0.08;
        for (let y = top; y < bottom; y++) if (occupied(x, y)) count++;
        if (count < score) { score = count; best = x; }
      }
      columnEdges.push(best);
    }
    columnEdges.push(1024);
    for (let col = 0; col < 8; col++) {
      let left = 1024, right = -1, first = canvasHeight, last = -1;
      for (let y = top; y < bottom; y++) for (let x = columnEdges[col]; x < columnEdges[col + 1]; x++) {
        if (!occupied(x, y)) continue;
        left = Math.min(left, x); right = Math.max(right, x);
        first = Math.min(first, y); last = Math.max(last, y);
      }
      if (right < left) throw new Error(`Empty animation frame ${row}:${col}`);
      frames.push({ left, top: first, width: right - left + 1, height: last - first + 1 });
    }
  }
  // One scale for the entire sheet: falling bodies stay short, not stretched.
  // The generated row spacing is approximate, so normalize only the packing.
  const scale = Math.min(114 / Math.max(...frames.map((f) => f.height)), 114 / Math.max(...frames.map((f) => f.width)));
  const layers = [];
  for (let row = 0; row < rowCount; row++) for (let col = 0; col < 8; col++) {
    const sourceRow = swapSides === 'swap-sides' && (row % 4 === 2 || row % 4 === 3) ? row + (row % 4 === 2 ? 1 : -1) : row;
    const frame = frames[sourceRow * 8 + col];
    const width = Math.max(1, Math.round(frame.width * scale));
    const height = Math.max(1, Math.round(frame.height * scale));
    const buffer = await sharp(source).extract(frame).resize(width, height).png().toBuffer();
    layers.push({ input: buffer, left: col * 128 + Math.round((128 - width) / 2), top: row * 128 + 118 - height });
  }
  await sharp({ create: { width: 1024, height: canvasHeight, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite(layers).png({ compressionLevel: 9 }).toFile(output);
  console.log(output);
})().catch((error) => { console.error(error); process.exitCode = 1; });
