// Convert raw guide screenshot captures (PNG) to the WebP files the guide serves.
//
//   npm run guide:webp -- public/guide/<chapter>/<nn>-<name>.png [more.png ...]
//
// Writes <same-name>.webp beside each PNG, capped at MAX_WIDTH px wide (twice the
// 720 px display width, so retina screens stay sharp), and prints the w/h to put on
// the <Shot>. The PNG is left in place for you to delete once the WebP looks right.
// Screenshots are served straight from public/ (Shot renders them `unoptimized`),
// so this is the only resize that ever happens — nothing runs on the server.
// Exits 1 if any input was skipped or failed; the remaining inputs are still converted.
import path from "node:path";
import sharp from "sharp";

const MAX_WIDTH = 1440;
const QUALITY = 82;

const inputs = process.argv.slice(2);
if (inputs.length === 0) {
  console.error("usage: npm run guide:webp -- <capture.png> [...]");
  process.exit(1);
}

for (const input of inputs) {
  if (path.extname(input).toLowerCase() !== ".png") {
    console.error(`skip ${input}: not a .png`);
    process.exitCode = 1;
    continue;
  }
  const output = input.replace(/\.png$/i, ".webp");
  try {
    const info = await sharp(input)
      .resize({ width: MAX_WIDTH, withoutEnlargement: true })
      .webp({ quality: QUALITY })
      .toFile(output);
    console.log(`${output}  w={${info.width}} h={${info.height}}  ${(info.size / 1024).toFixed(0)} KB`);
  } catch (error) {
    console.error(`fail ${input}: ${error.message}`);
    process.exitCode = 1;
  }
}
