
const fs = require('fs');
const path = require('path');
const { createCanvas, loadImage } = require('canvas');

// Bixolon SP300 printer constants
const DPI = 203;
const PRINT_WIDTH_MM = 80;
const PRINT_WIDTH_PX = Math.round((PRINT_WIDTH_MM / 25.4) * DPI); // 80mm at 203dpi ≈ 640px

// Converts an image buffer to monochrome bitmap, scaled and centered
async function saveImageBuffer(buffer, printsDir, ext = 'png') {
  if (!fs.existsSync(printsDir)) fs.mkdirSync(printsDir, { recursive: true });
  // Load image from buffer
  const img = await loadImage(buffer);
  // Calculate scale to fit print width
  const scale = PRINT_WIDTH_PX / img.width;
  const targetW = PRINT_WIDTH_PX;
  const targetH = Math.round(img.height * scale);
  // Create canvas with print width and adjusted height
  const canvas = createCanvas(targetW, targetH);
  const ctx = canvas.getContext('2d');
  // White background
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, targetW, targetH);
  // Draw scaled and vertically centered image
  ctx.drawImage(img, 0, 0, targetW, targetH);
  // Convert to monochrome (simple threshold)
  const imageData = ctx.getImageData(0, 0, targetW, targetH);
  for (let i = 0; i < imageData.data.length; i += 4) {
    // RGB average
    const avg = (imageData.data[i] + imageData.data[i+1] + imageData.data[i+2]) / 3;
    const mono = avg < 180 ? 0 : 255; // Adjustable threshold
    imageData.data[i] = imageData.data[i+1] = imageData.data[i+2] = mono;
    imageData.data[i+3] = 255;
  }
  ctx.putImageData(imageData, 0, 0);
  // Save as PNG
  const filename = `img-${Date.now()}.png`;
  fs.writeFileSync(path.join(printsDir, filename), canvas.toBuffer('image/png'));
  return filename;
}

// For files on disk (not buffer)
async function handleImageFile(filePath, printsDir) {
  const buffer = fs.readFileSync(filePath);
  return await saveImageBuffer(buffer, printsDir, path.extname(filePath).replace('.', ''));
}

module.exports = { saveImageBuffer, handleImageFile };