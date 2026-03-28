/**
 * Generates all PWA icon sizes from public/icon-512x512.png
 * Output: public/icons/
 *
 * Usage: node scripts/generate-pwa-icons.mjs
 */

import sharp from "sharp";
import { mkdir } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const src = join(root, "public", "icon-512x512.png");
const outDir = join(root, "public", "icons");

await mkdir(outDir, { recursive: true });

// Standard PWA sizes
const sizes = [72, 96, 128, 144, 152, 192, 384, 512];

// Apple touch icon sizes
const appleSizes = [120, 152, 167, 180];

// Favicon sizes
const faviconSizes = [16, 32, 48];

const tasks = [
  // Standard icons (any purpose)
  ...sizes.map((size) => ({
    size,
    file: `icon-${size}x${size}.png`,
    maskable: false,
  })),

  // Maskable icons (with safe-zone padding ~10%)
  { size: 192, file: "icon-192x192-maskable.png", maskable: true },
  { size: 512, file: "icon-512x512-maskable.png", maskable: true },

  // Apple touch icon (used by <link rel="apple-touch-icon">)
  { size: 180, file: "apple-touch-icon.png", maskable: false },

  // Extra Apple sizes
  ...appleSizes
    .filter((s) => s !== 180)
    .map((size) => ({
      size,
      file: `apple-touch-icon-${size}x${size}.png`,
      maskable: false,
    })),

  // Favicons
  ...faviconSizes.map((size) => ({
    size,
    file: `favicon-${size}x${size}.png`,
    maskable: false,
  })),
];

let done = 0;

await Promise.all(
  tasks.map(async ({ size, file, maskable }) => {
    const pipeline = sharp(src);

    if (maskable) {
      // Add ~10% padding so the icon stays within the safe zone
      const pad = Math.round(size * 0.1);
      const inner = size - pad * 2;
      pipeline
        .resize(inner, inner, { fit: "contain", background: { r: 8, g: 19, b: 29, alpha: 1 } })
        .extend({
          top: pad,
          bottom: pad,
          left: pad,
          right: pad,
          background: { r: 8, g: 19, b: 29, alpha: 1 },
        });
    } else {
      pipeline.resize(size, size, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } });
    }

    await pipeline
      .png({ compressionLevel: 9, adaptiveFiltering: true })
      .toFile(join(outDir, file));

    done++;
    process.stdout.write(`\r[${done}/${tasks.length}] ${file}`.padEnd(60));
  })
);

console.log(`\n✓ Generated ${tasks.length} icons in public/icons/`);
