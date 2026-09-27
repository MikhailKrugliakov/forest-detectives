// Lossless geometry: only encode the accepted, complete imagegen paintings as
// compressed JPEGs. Do not assemble houses or paint road rectangles here.
// Usage: SHARP_MODULE=/path/to/sharp node scripts/pack-krok-neighborhoods.cjs residential=source.png crafts=source.png market=source.png royal=source.png
const sharp = require(process.env.SHARP_MODULE || 'sharp');
const path = require('node:path');
const themes = new Set(['residential', 'crafts', 'market', 'royal']);

(async () => {
  for (const argument of process.argv.slice(2)) {
    const separator = argument.indexOf('=');
    const theme = argument.slice(0, separator), source = argument.slice(separator + 1);
    if (separator < 1 || !themes.has(theme) || !source) throw new Error('Expected theme=source.png');
    const { width, height } = await sharp(source).metadata();
    if (!width || !height || width < 1500 || Math.abs(width / height - 1.5) > .02) {
      throw new Error(`${theme}: expected a high-resolution 3:2 complete painting`);
    }
    const output = path.join(__dirname, `../public/assets/world/krok-city-${theme}-organic-v3.jpg`);
    const info = await sharp(source).jpeg({ quality: 94, mozjpeg: true }).toFile(output);
    console.log(JSON.stringify({ theme, output, width: info.width, height: info.height, bytes: info.size }));
  }
})().catch((error) => { console.error(error); process.exitCode = 1; });
