

const { createCanvas, loadImage } = require('canvas');
const fs = require('fs');
const path = require('path');
const QRCode = require('qrcode');

async function renderToImage(tyspText, printsDir) {
  // Very simple TySP renderer. Supports: [TEXT], [ALIGN], [FEED], [BARCODE], [QRCODE], [IMAGE path]
  const width = 576;
  const baseFont = 20;
  const lines = [];
  let align = 'LEFT';
  let fontSize = baseFont;
  let bold = false;

  const rawLines = String(tyspText).split(/\r?\n/);
  for (const raw of rawLines) {
    const l = raw.trim();
    if (!l) {
      lines.push({ type: 'TEXT', text: '', align, fontSize, bold });
      continue;
    }
    if (/^\[ALIGN\s+(LEFT|CENTER|RIGHT)\]/i.test(l)) {
      align = l.match(/^\[ALIGN\s+(LEFT|CENTER|RIGHT)\]/i)[1].toUpperCase();
      continue;
    }
    if (/^\[FEED\s+(\d+)\]/i.test(l)) {
      const n = parseInt(l.match(/^\[FEED\s+(\d+)/i)[1], 10);
      for (let i = 0; i < n; i++) lines.push({ type: 'TEXT', text: '', align, fontSize, bold });
      continue;
    }
    if (/^\[BOLD ON\]/i.test(l)) { bold = true; continue; }
    if (/^\[BOLD OFF\]/i.test(l)) { bold = false; continue; }
    if (/^\[FONT BIG\]/i.test(l)) { fontSize = baseFont + 8; continue; }
    if (/^\[FONT SMALL\]/i.test(l)) { fontSize = baseFont - 4; continue; }
    if (/^\[BARCODE\]/i.test(l)) { lines.push({ type: 'BARCODE', data: l.replace(/^\[BARCODE\]/i,'').trim() }); continue; }
    if (/^\[QRCODE\]/i.test(l)) { lines.push({ type: 'QRCODE', data: l.replace(/^\[QRCODE\]/i,'').trim() }); continue; }
    if (/^\[IMAGE\s+(.+)\]/i.test(l)) {
      const file = l.match(/^\[IMAGE\s+(.+)\]/i)[1].trim();
      lines.push({ type: 'IMAGE', path: file });
      continue;
    }
    if (/^\[TEXT\]/i.test(l)) {
      lines.push({ type: 'TEXT', text: l.replace(/^\[TEXT\]/i, '').trim(), align, fontSize, bold });
      continue;
    }
    // fallback plain text
    lines.push({ type: 'TEXT', text: l, align, fontSize, bold });
  }

  // calculate height
  let estimatedHeight = Math.max(400, lines.length * (fontSize + 8) + 80);
  const canvas = createCanvas(width, estimatedHeight);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, estimatedHeight);
  ctx.fillStyle = '#000000';

  let y = 30;
  for (const ln of lines) {
    if (ln.type === 'TEXT') {
      ctx.font = `${ln.bold ? 'bold ' : ''}${ln.fontSize}px Sans`;
      const text = ln.text || '';
      const metrics = ctx.measureText(text);
      let x = 10;
      if (ln.align === 'CENTER') x = (width - metrics.width) / 2;
      if (ln.align === 'RIGHT') x = width - metrics.width - 10;
      ctx.fillText(text, x, y);
      y += ln.fontSize + 8;
    } else if (ln.type === 'BARCODE') {
      // simple barcode placeholder (draw rectangle + text)
      ctx.fillStyle = '#000';
      ctx.fillRect(30, y, width - 60, 60);
      ctx.fillStyle = '#fff';
      ctx.font = '16px monospace';
      ctx.fillText(ln.data, 40, y + 40);
      y += 80;
      ctx.fillStyle = '#000';
    } else if (ln.type === 'QRCODE') {
      const qrCanvas = createCanvas(160, 160);
      await QRCode.toCanvas(qrCanvas, ln.data);
      ctx.drawImage(qrCanvas, (width - 160) / 2, y);
      y += 170;
    } else if (ln.type === 'IMAGE') {
      try {
        const imgPath = path.isAbsolute(ln.path) ? ln.path : path.join(process.cwd(), ln.path);
        if (fs.existsSync(imgPath)) {
          const img = await loadImage(imgPath);
          const targetW = Math.min(img.width, width - 40);
          const scale = targetW / img.width;
          ctx.drawImage(img, (width - targetW) / 2, y, img.width * scale, img.height * scale);
          y += img.height * scale + 10;
        } else {
          ctx.fillStyle = '#f00';
          ctx.fillText(`[image not found: ${ln.path}]`, 10, y);
          ctx.fillStyle = '#000';
          y += 20;
        }
      } catch (err) {
        ctx.fillStyle = '#f00';
        ctx.fillText(`[image error]`, 10, y);
        ctx.fillStyle = '#000';
        y += 20;
      }
    }
    // enlarge canvas if needed
    if (y + 200 > estimatedHeight) {
      estimatedHeight += 800;
      const copy = createCanvas(width, estimatedHeight);
      copy.getContext('2d').drawImage(canvas, 0, 0);
      // replace canvas reference
      canvas.width = estimatedHeight; // not ideal, but we will re-create buffer at the end
    }
  }

  if (!fs.existsSync(printsDir)) fs.mkdirSync(printsDir, { recursive: true });
  const filename = `tysp-${Date.now()}.png`;
  const outPath = path.join(printsDir, filename);
  fs.writeFileSync(outPath, canvas.toBuffer('image/png'));
  return filename;
}

module.exports = { renderToImage };