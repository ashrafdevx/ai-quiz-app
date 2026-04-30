const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const svgPath = path.join(__dirname, 'assets/images/logo.svg');
const svgBuffer = fs.readFileSync(svgPath);

async function generate() {
  await sharp(svgBuffer).resize(1024, 1024).png().toFile(path.join(__dirname, 'assets/icon.png'));
  console.log('✓ icon.png');

  await sharp(svgBuffer).resize(1024, 1024).png().toFile(path.join(__dirname, 'assets/adaptive-icon.png'));
  console.log('✓ adaptive-icon.png');

  await sharp(svgBuffer).resize(1024, 1024).png().toFile(path.join(__dirname, 'assets/splash-icon.png'));
  console.log('✓ splash-icon.png');

  await sharp(svgBuffer).resize(48, 48).png().toFile(path.join(__dirname, 'assets/favicon.png'));
  console.log('✓ favicon.png');

  console.log('\nAll icons updated!');
}

generate().catch(console.error);
