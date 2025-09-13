const { createCanvas } = require('canvas');
const fs = require('fs');
const path = require('path');

// Minimal ESC/POS stub: extract printable ascii and render it.
// For a full implementation integrate escpos-buffer or escpos libraries.

async function renderToImage(buffer, printsDir) {
  const width = 576;
  const lineHeight = 22;
  const text = buffer.toString('latin1').replace(/[^\x20-\x7E\r\n]/g, '');
  const lines = text.split(/\r?\n/).slice(0, 300);
  const height = Math.max(300, lines.length * lineHeight + 60);
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = '#000';
  ctx.font = '18px monospace';

  let y = 30;
  for (const ln of lines) {
    ctx.fillText(ln, 10, y);
    y += lineHeight;
  }

  if (!fs.existsSync(printsDir)) fs.mkdirSync(printsDir, { recursive: true });
  const filename = `escpos-${Date.now()}.png`;
  fs.writeFileSync(path.join(printsDir, filename), canvas.toBuffer('image/png'));
  return filename;
}

module.exports = { renderToImage };