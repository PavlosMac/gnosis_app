// Build the local thumbnail set the manual picker (FaceUpDeck) shows for all 78 cards.
//
//   npm run cards:thumbs
//
// Downloads each card's full "small" image (320x533) from the external host once and
// writes a 144x240 WebP to public/cards/thumbs/<same basename>. The picker draws cards
// at 60-70 px wide, so 144 px is twice that for retina screens; the browser then keeps a
// ~140 KB decoded bitmap per card instead of ~680 KB, about 10 MB for the whole deck
// instead of 53 MB. Rerun after changing TAROT_DECK; existing thumbs are overwritten.
// Exits 1 if any card failed; the rest are still written.
import { mkdir } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const WIDTH = 144;
const HEIGHT = 240;
const QUALITY = 80;
const OUT_DIR = path.resolve("public/cards/thumbs");

const source = await import("../src/lib/cards.ts").catch(() => null);
const deck = source?.TAROT_DECK ?? (await loadDeckByRegex());

await mkdir(OUT_DIR, { recursive: true });
let total = 0;
for (const card of deck) {
  const output = path.join(OUT_DIR, path.basename(new URL(card.imageUrl).pathname));
  try {
    const res = await fetch(card.imageUrl);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const info = await sharp(Buffer.from(await res.arrayBuffer()))
      .resize({ width: WIDTH, height: HEIGHT, fit: "cover" })
      .webp({ quality: QUALITY })
      .toFile(output);
    total += info.size;
    console.log(`${path.relative(".", output)}  ${(info.size / 1024).toFixed(1)} KB`);
  } catch (error) {
    console.error(`fail ${card.name}: ${error.message}`);
    process.exitCode = 1;
  }
}
console.log(`${deck.length} cards, ${(total / 1024).toFixed(0)} KB total`);

// Node cannot import the TypeScript module directly on every version; fall back to
// reading the image URLs straight out of the source file.
async function loadDeckByRegex() {
  const { readFile } = await import("node:fs/promises");
  const text = await readFile(path.resolve("src/lib/cards.ts"), "utf8");
  return [...text.matchAll(/name:\s*"([^"]+)"[^}]*?imageUrl:\s*"([^"]+)"/g)].map((m) => ({
    name: m[1],
    imageUrl: m[2],
  }));
}
