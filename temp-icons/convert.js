const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const svgPath = path.join(__dirname, '../frontend/assets/images/logo.svg');
const outDir  = path.join(__dirname, '../frontend/assets');

const svgBuffer = fs.readFileSync(svgPath);

async function generate() {
  await sharp(svgBuffer).resize(1024, 1024).png().toFile(path.join(outDir, 'icon.png'));
  console.log('✓ icon.png');

  await sharp(svgBuffer).resize(1024, 1024).png().toFile(path.join(outDir, 'adaptive-icon.png'));
  console.log('✓ adaptive-icon.png');

  await sharp(svgBuffer).resize(1024, 1024).png().toFile(path.join(outDir, 'splash-icon.png'));
  console.log('✓ splash-icon.png');

  await sharp(svgBuffer).resize(48, 48).png().toFile(path.join(outDir, 'favicon.png'));
  console.log('✓ favicon.png');

  console.log('\nDone! All icons updated.');
}

generate().catch(console.error);
