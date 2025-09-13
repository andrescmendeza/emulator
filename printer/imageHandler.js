const fs = require('fs');
const path = require('path');

function saveImageBuffer(buffer, printsDir, ext = 'png') {
  if (!fs.existsSync(printsDir)) fs.mkdirSync(printsDir, { recursive: true });
  const filename = `img-${Date.now()}.${ext.replace('.', '')}`;
  fs.writeFileSync(path.join(printsDir, filename), buffer);
  return filename;
}

async function handleImageFile(filePath, printsDir) {
  if (!fs.existsSync(printsDir)) fs.mkdirSync(printsDir, { recursive: true });
  const ext = path.extname(filePath) || '.png';
  const filename = `img-${Date.now()}${ext}`;
  fs.copyFileSync(filePath, path.join(printsDir, filename));
  return filename;
}

module.exports = { saveImageBuffer, handleImageFile };