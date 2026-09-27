// Mechanical packaging of the generated panoramas and transparent building atlas.
// Usage: SHARP_MODULE=/path/to/sharp node scripts/pack-world-refresh.cjs village.png valley.png architecture.png
const sharp = require(process.env.SHARP_MODULE || 'sharp');
const path = require('node:path');
const [village, valley, architecture] = process.argv.slice(2);
const output = path.join(__dirname, '../public/assets/world');
async function main() {
  for (const [input, name] of [[village, 'forest-village'], [valley, 'snow-valley']]) {
    const meta = await sharp(input).metadata();
    if (Math.abs(meta.width / meta.height - 3) > 0.02) throw new Error('Expected a continuous 3:1 panorama');
    await sharp(input).jpeg({ quality: 94, mozjpeg: true }).toFile(path.join(output, `${name}-panorama-v2.jpg`));
  }
  const meta = await sharp(architecture).metadata();
  if (!meta.hasAlpha) throw new Error('Architecture must have genuine transparency');
  // Cut only in the transparent gutters of this atlas; some silhouettes extend
  // slightly beyond a mathematically equal cell boundary.
  const crops = [
    [0, 0, 432, 444], [433, 0, 453, 444], [901, 0, 443, 444], [1344, 0, 430, 444],
    [0, 444, 449, 443], [455, 444, 423, 443], [880, 444, 464, 443], [1344, 444, 430, 443],
  ];
  for (let row = 0; row < 2; row++) for (let col = 0; col < 4; col++) {
    const index = row * 4 + col;
    const [left, top, width, height] = crops[index];
    const cell = await sharp(architecture).extract({ left, top, width, height }).png().toBuffer();
    const png = await sharp(cell).trim().resize(660, 400, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
    await sharp(png).toFile(path.join(output, `krok-house-${index}.png`));
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
