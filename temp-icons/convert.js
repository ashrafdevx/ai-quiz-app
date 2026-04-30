const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const logoSvgPath  = path.join(__dirname, '../frontend/assets/images/logo.svg');
const splashSvgPath = path.join(__dirname, '../frontend/assets/images/splash.svg');
const outDir = path.join(__dirname, '../frontend/assets');

const logoBuffer  = fs.readFileSync(logoSvgPath);
const splashBuffer = fs.readFileSync(splashSvgPath);

async function generate() {
  await sharp(logoBuffer).resize(1024, 1024).png().toFile(path.join(outDir, 'icon.png'));
  console.log('✓ icon.png');

  await sharp(logoBuffer).resize(1024, 1024).png().toFile(path.join(outDir, 'adaptive-icon.png'));
  console.log('✓ adaptive-icon.png');

  await sharp(splashBuffer).resize(1024, 1024).png().toFile(path.join(outDir, 'splash-icon.png'));
  console.log('✓ splash-icon.png  (from splash.svg)');

  await sharp(logoBuffer).resize(48, 48).png().toFile(path.join(outDir, 'favicon.png'));
  console.log('✓ favicon.png');

  console.log('\nDone! All icons updated.');
}

generate().catch(console.error);
