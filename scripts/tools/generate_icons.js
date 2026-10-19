import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

async function generate() {
  const svgBuffer = fs.readFileSync(path.join(process.cwd(), 'public', 'icon.svg'));

  await sharp(svgBuffer)
    .resize(192, 192)
    .png()
    .toFile(path.join(process.cwd(), 'public', 'pwa-192x192.png'));

  await sharp(svgBuffer)
    .resize(512, 512)
    .png()
    .toFile(path.join(process.cwd(), 'public', 'pwa-512x512.png'));

  // Maskable icon with 10% safe zone padding
  await sharp(svgBuffer)
    .resize(410, 410)
    .extend({
      top: 51,
      bottom: 51,
      left: 51,
      right: 51,
      background: '#047857'
    })
    .png()
    .toFile(path.join(process.cwd(), 'public', 'pwa-maskable-512x512.png'));

  await sharp(svgBuffer)
    .resize(180, 180)
    .png()
    .toFile(path.join(process.cwd(), 'public', 'apple-touch-icon.png'));

  console.log('PWA icons successfully generated!');
}

generate().catch(err => {
  console.error(err);
  process.exit(1);
});
