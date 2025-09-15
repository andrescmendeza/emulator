



const { createCanvas, loadImage } = require('canvas');
const fs = require('fs');
const path = require('path');
const QRCode = require('qrcode');

// Font definitions and styles
// You can map ZPL font codes to canvas font families/styles here
const FONTS = {
  A: { size: 20, spacing: 0, family: 'Arial' },
  B: { size: 16, spacing: 0, family: 'Courier New' },
  BIG: { size: 28, spacing: 2, family: 'Arial Black' },
  SMALL: { size: 12, spacing: 0, family: 'Verdana' }
};

async function renderToImage(tyspText, printsDir) {
  const width = 576;
  let font = FONTS.A;
  let bold = false;
  let underline = false;
  let align = 'LEFT';
  let curX = 0, curY = 0;
  let labelOpen = false;
  let fieldData = '';
  let fieldType = null;
  let fieldParams = {};
  const drawQueue = [];
  const errors = [];

  // Preprocess: remove \r and split by ^
  const tokens = String(tyspText).replace(/\r/g, '').split('^').filter(Boolean);
  for (let t of tokens) {
    t = t.trim();
    if (!t) continue;
    // Graphics: ^GB (box), ^GD (diagonal line), ^GC (circle)
    if (/^GB.*/.test(t)) {
      const m = t.match(/^GB(\d+),(\d+),(\d+),([BW]),?(\d+)?/);
      if (m) {
        const [_, w, h, thick, color, radius] = m;
        drawQueue.push({ type: 'BOX', x: curX, y: curY, w: parseInt(w), h: parseInt(h), t: parseInt(thick), color, r: parseInt(radius || '0') });
      } else {
        errors.push('Error: Malformed GB: ' + t);
      }
      continue;
    } else if (/^GD.*/.test(t)) {
      const m = t.match(/^GD(\d+),(\d+),(\d+),([BW])/);
      if (m) {
        const [_, w, h, thick, color] = m;
        drawQueue.push({ type: 'LINE', x: curX, y: curY, w: parseInt(w), h: parseInt(h), t: parseInt(thick), color });
      } else {
        errors.push('Error: Malformed GD: ' + t);
      }
      continue;
    } else if (/^GC.*/.test(t)) {
      const m = t.match(/^GC(\d+),(\d+),([BW])/);
      if (m) {
        const [_, d, thick, color] = m;
        drawQueue.push({ type: 'CIRCLE', x: curX, y: curY, r: parseInt(d) / 2, t: parseInt(thick), color });
      } else {
        errors.push('Error: Malformed GC: ' + t);
      }
      continue;
    }
  const width = 576;
  let font = FONTS.A;
  let bold = false;
  let underline = false;
  let align = 'LEFT';
  let curX = 0, curY = 0;
  let labelOpen = false;
  let fieldData = '';
  let fieldType = null;
  let fieldParams = {};
  const drawQueue = [];
  const errors = [];

  // Preprocess: remove \r and split by ^
  const tokens = String(tyspText).replace(/\r/g, '').split('^').filter(Boolean);
  for (let t of tokens) {
    t = t.trim();
    if (!t) continue;
  // Label start/end
  if (t.startsWith('XA')) { labelOpen = true; continue; }
  if (t.startsWith('XZ')) { labelOpen = false; continue; }
  if (!labelOpen) continue;

      // Positioning
      if (/^FO\d+,\d+/.test(t)) {
        const m = t.match(/^FO(\d+),(\d+)/);
        if (m) {
          curX = parseInt(m[1], 10);
          curY = parseInt(m[2], 10);
        } else {
          errors.push('Error: Malformed FO: ' + t);
          console.warn('TYSP: Malformed FO:', t);
        }
  return;
      }
      // Font, size, rotation, and family (A, A0N, A1N, etc.)
      if (/^A(\d)?[NRIB]?,?\d*,?\d*/.test(t)) {
        // ^A@,h,w or ^A0N,h,w
        const m = t.match(/^A(\d)?([NRIB]),?(\d*)?,?(\d*)?/);
        if (m) {
          let famCode = m[1] ? m[1].toUpperCase() : 'A';
          let size = parseInt(m[3] || '20', 10);
          let rot = m[2] || 'N';
          let baseFont = FONTS[famCode] || FONTS.A;
          font = { ...baseFont, size: isNaN(size) ? baseFont.size : size, rotation: rot };
        } else {
          errors.push('Error: Malformed A: ' + t);
          console.warn('TYSP: Malformed A:', t);
        }
  return;
      }
  // Advanced barcodes
  if (/^B3.*/.test(t)) { // Code 39
    // Example: ^B3N,Y,N,N
    // Not implemented: warn only
    errors.push('Warning: ^B3 (Code 39) not implemented: ' + t);
    continue;
  }
  if (/^B7.*/.test(t)) { // PDF417
    // Example: ^B7N,N,10,2,20,N
    drawQueue.push({ type: 'PDF417', x: curX, y: curY, params: { raw: t } });
    continue;
  }
  if (/^BY.*/.test(t)) {
    // Barcode field default (width, ratio, height)
    // Example: ^BY3,2,100
    // Not implemented: warn only
    errors.push('Warning: ^BY not implemented: ' + t);
    continue;
  }
  if (/^BQ.*/.test(t)) {
    // QR Code: ^BQN,2,10
    // Next field data is the QR content
    fieldType = 'QRCODE';
    fieldParams = { x: curX, y: curY, raw: t };
    continue;
  }
  if (/^BX.*/.test(t)) {
    // Datamatrix: ^BXN,5,200
    // Next field data is the Datamatrix content
    fieldType = 'DATAMATRIX';
    fieldParams = { x: curX, y: curY, raw: t };
    continue;
  }
  if (/^BC.*/.test(t)) {
    // Code128: ^BCN,Y,N,N
    // Next field data is the barcode content
    fieldType = 'CODE128';
    fieldParams = { x: curX, y: curY, raw: t };
    continue;
  }
  // Field data (text for barcode/QR)
  if (fieldType && /^FD.*/.test(t)) {
    const data = t.replace(/^FD/, '');
    if (fieldType === 'QRCODE') {
      drawQueue.push({ type: 'QRCODE', data, ...fieldParams });
    } else if (fieldType === 'DATAMATRIX') {
      drawQueue.push({ type: 'DATAMATRIX', data, ...fieldParams });
    } else if (fieldType === 'CODE128') {
      drawQueue.push({ type: 'CODE128', data, ...fieldParams });
    }
    fieldType = null;
    fieldParams = {};
    continue;
  }
  // End field (^FS)
  if (/^FS$/.test(t)) {
    fieldType = null;
    fieldParams = {};
    continue;
  }
    }
    // Inversion
    if (/^FR/.test(t)) {
      // Not implemented: warning only
      errors.push('Warning: FR not implemented: ' + t);
      console.warn('TYSP: FR not implemented:', t);
      continue;
    }
    // Graphic bitmap (^GFA)
    if (/^GFA.*/.test(t)) {
      // ^GFA,p1,p2,p3,p4,data
      // p1: total bytes of graphic data (after decompression)
      // p2: bytes per row
      // p3: number of rows
      // p4: total bytes of data (compressed or not)
      // data: ASCII hex or compressed
      const m = t.match(/^GFA,([^,]+),([^,]+),([^,]+),([^,]+),(.+)/);
      if (!m) {
        errors.push('Error: Malformed GFA: ' + t);
        console.warn('TYSP: Malformed GFA:', t);
  return;
      }
      const [_, p1, p2, p3, p4, data] = m;
      const bytesPerRow = parseInt(p2, 10);
      const rows = parseInt(p3, 10);
      // ZPL ^GFA data is usually ASCII hex (2 chars per byte)
      // Remove any whitespace
      let hex = data.replace(/\s+/g, '');
      // If compressed (starts with :), decompress (not implemented here)
      if (hex.startsWith(':')) {
        errors.push('Warning: ^GFA compression not supported yet.');
        console.warn('TYSP: ^GFA compression not supported:', t);
        continue;
      }
      // Convert hex to binary
      let bin = [];
      for (let i = 0; i < hex.length; i += 2) {
        bin.push(parseInt(hex.substr(i, 2), 16));
      }
      // Draw bitmap on canvas at curX, curY
      drawQueue.push({
        type: 'GFA',
        x: curX,
        y: curY,
        bytesPerRow,
        rows,
        data: bin
      });
  return;
    }
    // Other commands
    errors.push('Unrecognized command: ^' + t);
    console.warn('TYSP: Unrecognized command:', t);
  }

  // Fallback: legacy parser (brackets)
  if (drawQueue.length === 0) {
    // ...existing code...
    const rawLines = String(tyspText).split(/\n/);
    for (const l of rawLines) {
      const line = l.trim();
      if (!line) continue;
      if (/^\[ALIGN\s+(LEFT|CENTER|RIGHT)\]/i.test(line)) {
        align = line.match(/^\[ALIGN\s+(LEFT|CENTER|RIGHT)\]/i)[1].toUpperCase();
        continue;
      }
      if (/^\[FEED\s+(\d+)\]/i.test(line)) {
        const n = parseInt(line.match(/^\[FEED\s+(\d+)/i)[1], 10);
        for (let i = 0; i < n; i++) drawQueue.push({ type: 'TEXT', text: '', align, font, bold, underline });
        continue;
      }
      if (/^\[BOLD ON\]/i.test(line)) { bold = true; continue; }
      if (/^\[BOLD OFF\]/i.test(line)) { bold = false; continue; }
      if (/^\[UNDERLINE ON\]/i.test(line)) { underline = true; continue; }
      if (/^\[UNDERLINE OFF\]/i.test(line)) { underline = false; continue; }
      if (/^\[FONT (A|B|BIG|SMALL)\]/i.test(line)) { font = FONTS[line.match(/^\[FONT (A|B|BIG|SMALL)\]/i)[1].toUpperCase()]; continue; }
      if (/^\[BARCODE\]/i.test(line)) { drawQueue.push({ type: 'BARCODE', data: line.replace(/^\[BARCODE\]/i,'').trim() }); continue; }
      if (/^\[QRCODE\]/i.test(line)) { drawQueue.push({ type: 'QRCODE', data: line.replace(/^\[QRCODE\]/i,'').trim() }); continue; }
      if (/^\[IMAGE\s+(.+)\]/i.test(line)) {
        const file = line.match(/^\[IMAGE\s+(.+)\]/i)[1].trim();
        drawQueue.push({ type: 'IMAGE', path: file });
        continue;
      }
      if (/^\[TEXT\]/i.test(line)) {
        drawQueue.push({ type: 'TEXT', text: line.replace(/^\[TEXT\]/i, '').trim(), align, font, bold, underline });
        continue;
      }
  // fallback plain text
      drawQueue.push({ type: 'TEXT', text: line, align, font, bold, underline });
    }

  // --- Rendering ---
  let estimatedHeight = Math.max(400, drawQueue.length * (font.size + 10) + 120 + errors.length * 24);
  const canvas = createCanvas(width, estimatedHeight);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, width, estimatedHeight);
  ctx.fillStyle = '#000';

  let yPos = 30;
  for (const ln of drawQueue) {
    if (ln.type === 'BOX') {
      ctx.lineWidth = ln.t || 2;
      ctx.strokeStyle = ln.color === 'B' ? '#000' : '#fff';
      if (ln.r && ln.r > 0) {
        // Rounded rectangle
        ctx.beginPath();
        ctx.moveTo(ln.x + ln.r, ln.y);
        ctx.lineTo(ln.x + ln.w - ln.r, ln.y);
        ctx.quadraticCurveTo(ln.x + ln.w, ln.y, ln.x + ln.w, ln.y + ln.r);
        ctx.lineTo(ln.x + ln.w, ln.y + ln.h - ln.r);
        ctx.quadraticCurveTo(ln.x + ln.w, ln.y + ln.h, ln.x + ln.w - ln.r, ln.y + ln.h);
        ctx.lineTo(ln.x + ln.r, ln.y + ln.h);
        ctx.quadraticCurveTo(ln.x, ln.y + ln.h, ln.x, ln.y + ln.h - ln.r);
        ctx.lineTo(ln.x, ln.y + ln.r);
        ctx.quadraticCurveTo(ln.x, ln.y, ln.x + ln.r, ln.y);
        ctx.closePath();
        ctx.stroke();
      } else {
        ctx.strokeRect(ln.x, ln.y, ln.w, ln.h);
      }
      yPos = Math.max(yPos, ln.y + ln.h + 10);
    } else if (ln.type === 'LINE') {
      ctx.lineWidth = ln.t || 2;
      ctx.strokeStyle = ln.color === 'B' ? '#000' : '#fff';
      ctx.beginPath();
      ctx.moveTo(ln.x, ln.y);
      ctx.lineTo(ln.x + ln.w, ln.y + ln.h);
      ctx.stroke();
      yPos = Math.max(yPos, ln.y + ln.h + 10);
    } else if (ln.type === 'CIRCLE') {
      ctx.lineWidth = ln.t || 2;
      ctx.strokeStyle = ln.color === 'B' ? '#000' : '#fff';
      ctx.beginPath();
      ctx.arc(ln.x, ln.y, ln.r, 0, 2 * Math.PI);
      ctx.stroke();
      yPos = Math.max(yPos, ln.y + ln.r + 10);
    }
    // (GFA rendering block moved below)
    // (removed misplaced GFA block)
    if (ln.type === 'TEXT') {
      ctx.save();
      ctx.font = `${ln.bold ? 'bold ' : ''}${ln.font.size}px ${ln.font.family}`;
      const text = ln.text || '';
      let drawX = typeof ln.x === 'number' ? ln.x : 10;
      let drawY = typeof ln.y === 'number' ? ln.y : yPos;
      // Handle rotation (N=0, R=90, I=180, B=270)
      let rot = (ln.font && ln.font.rotation) || 'N';
      let angle = 0;
      if (rot === 'R') angle = Math.PI / 2;
      else if (rot === 'I') angle = Math.PI;
      else if (rot === 'B') angle = 3 * Math.PI / 2;
      if (angle !== 0) {
        ctx.translate(drawX, drawY);
        ctx.rotate(angle);
        ctx.fillText(text, 0, 0);
        if (ln.underline && text) {
          const metrics = ctx.measureText(text);
          const underlineY = 2;
          ctx.beginPath();
          ctx.moveTo(0, underlineY);
          ctx.lineTo(metrics.width, underlineY);
          ctx.lineWidth = 2;
          ctx.strokeStyle = '#000';
          ctx.stroke();
        }
        ctx.rotate(-angle);
        ctx.translate(-drawX, -drawY);
      } else {
        ctx.fillText(text, drawX, drawY);
        if (ln.underline && text) {
          const metrics = ctx.measureText(text);
          const underlineY = drawY + 2;
          ctx.beginPath();
          ctx.moveTo(drawX, underlineY);
          ctx.lineTo(drawX + metrics.width, underlineY);
          ctx.lineWidth = 2;
          ctx.strokeStyle = '#000';
          ctx.stroke();
        }
      }
      ctx.restore();
      yPos = Math.max(yPos, drawY + ln.font.size + 10);
    } else if (ln.type === 'BARCODE') {
      let drawX = typeof ln.x === 'number' ? ln.x : 30;
      let drawY = typeof ln.y === 'number' ? ln.y : yPos;
      let barHeight = (ln.params && ln.params.height) || 60;
      let barWidth = ln.width || 2;
      // Simple bar rendering
      ctx.fillStyle = '#000';
      ctx.fillRect(drawX, drawY, (width - 2 * drawX) * barWidth / 2, barHeight);
      ctx.fillStyle = '#fff';
      ctx.font = '16px monospace';
      ctx.fillText(ln.data, drawX + 10, drawY + barHeight / 2 + 8);
      ctx.fillStyle = '#000';
      yPos = Math.max(yPos, drawY + barHeight + 10);
    } else if (ln.type === 'BARCODE39') {
      let drawX = typeof ln.x === 'number' ? ln.x : 30;
      let drawY = typeof ln.y === 'number' ? ln.y : yPos;
      let barHeight = (ln.params && ln.params.height) || 60;
      let barWidth = ln.width || 2;
      // Simple Code39 rendering (box and text only)
      ctx.strokeStyle = '#000';
      ctx.lineWidth = barWidth;
      ctx.strokeRect(drawX, drawY, (width - 2 * drawX), barHeight);
      ctx.fillStyle = '#fff';
      ctx.font = '16px monospace';
      ctx.fillText(ln.data, drawX + 10, drawY + barHeight / 2 + 8);
      ctx.fillStyle = '#000';
      yPos = Math.max(yPos, drawY + barHeight + 10);
    } else if (ln.type === 'LINE') {
      ctx.lineWidth = ln.t || 2;
      ctx.strokeStyle = ln.color === 'B' ? '#000' : '#fff';
      ctx.beginPath();
      ctx.moveTo(ln.x, ln.y);
      ctx.lineTo(ln.x + ln.w, ln.y + ln.h);
      ctx.stroke();
      yPos = Math.max(yPos, ln.y + ln.h + 10);
      ctx.lineWidth = ln.t || 2;
      ctx.strokeStyle = ln.color === 'B' ? '#000' : '#fff';
      ctx.strokeRect(ln.x, ln.y, ln.w, ln.h);
      yPos = Math.max(yPos, ln.y + ln.h + 10);
    } else if (ln.type === 'CIRCLE') {
      ctx.lineWidth = ln.t || 2;
      ctx.strokeStyle = ln.color === 'B' ? '#000' : '#fff';
      ctx.beginPath();
      ctx.arc(ln.x, ln.y, ln.r, 0, 2 * Math.PI);
      ctx.stroke();
      yPos = Math.max(yPos, ln.y + ln.r + 10);
    } else if (ln.type === 'QRCODE') {
      // ZPL ^BQ QR Code rendering
      const qrCanvas = createCanvas(160, 160);
      await QRCode.toCanvas(qrCanvas, ln.data);
      ctx.drawImage(qrCanvas, ln.x || (width - 160) / 2, ln.y || yPos);
      yPos = Math.max(yPos, (ln.y || yPos) + 170);
    } else if (ln.type === 'DATAMATRIX') {
      // Datamatrix placeholder: render as QR for now
      const qrCanvas = createCanvas(120, 120);
      await QRCode.toCanvas(qrCanvas, ln.data); // TODO: use real Datamatrix lib
      ctx.drawImage(qrCanvas, ln.x || (width - 120) / 2, ln.y || yPos);
      ctx.font = '12px monospace';
      ctx.fillStyle = '#f00';
      ctx.fillText('[Datamatrix placeholder]', ln.x || 10, (ln.y || yPos) + 130);
      ctx.fillStyle = '#000';
      yPos = Math.max(yPos, (ln.y || yPos) + 140);
    } else if (ln.type === 'CODE128') {
      // Code128 placeholder: render as box with text
      let drawX = typeof ln.x === 'number' ? ln.x : 30;
      let drawY = typeof ln.y === 'number' ? ln.y : yPos;
      let barHeight = 60;
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 2;
      ctx.strokeRect(drawX, drawY, width - 2 * drawX, barHeight);
      ctx.font = '16px monospace';
      ctx.fillStyle = '#f00';
      ctx.fillText('[Code128 placeholder]', drawX + 10, drawY + barHeight / 2 + 8);
      ctx.fillStyle = '#000';
      yPos = Math.max(yPos, drawY + barHeight + 10);
    } else if (ln.type === 'PDF417') {
      // PDF417 placeholder: render as box with text
      let drawX = typeof ln.x === 'number' ? ln.x : 30;
      let drawY = typeof ln.y === 'number' ? ln.y : yPos;
      let barHeight = 60;
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 2;
      ctx.strokeRect(drawX, drawY, width - 2 * drawX, barHeight);
      ctx.font = '16px monospace';
      ctx.fillStyle = '#f00';
      ctx.fillText('[PDF417 placeholder]', drawX + 10, drawY + barHeight / 2 + 8);
      ctx.fillStyle = '#000';
      yPos = Math.max(yPos, drawY + barHeight + 10);
    } else if (ln.type === 'IMAGE') {
      try {
        const imgPath = path.isAbsolute(ln.path) ? ln.path : path.join(process.cwd(), ln.path);
        if (fs.existsSync(imgPath)) {
          const img = await loadImage(imgPath);
          const targetW = Math.min(img.width, width - 40);
          const scale = targetW / img.width;
          ctx.drawImage(img, (width - targetW) / 2, yPos, img.width * scale, img.height * scale);
          yPos += img.height * scale + 10;
        } else {
          ctx.fillStyle = '#f00';
          ctx.fillText(`[image not found: ${ln.path}]`, 10, yPos);
          ctx.fillStyle = '#000';
          yPos += 20;
        }
      } catch (err) {
        ctx.fillStyle = '#f00';
        ctx.fillText(`[image error]`, 10, yPos);
        ctx.fillStyle = '#000';
        yPos += 20;
      }
    } else if (ln.type === 'GFA') {
      // Render ZPL bitmap (monochrome)
      const { x, y, bytesPerRow, rows, data } = ln;
      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < bytesPerRow; col++) {
          const byte = data[row * bytesPerRow + col];
          for (let bit = 0; bit < 8; bit++) {
            const pixelOn = (byte >> (7 - bit)) & 1;
            if (pixelOn) {
              ctx.fillRect(x + col * 8 + bit, y + row, 1, 1);
            }
          }
        }
      }
      yPos = Math.max(yPos, y + rows + 10);
    }
    if (yPos + 200 > estimatedHeight) {
      estimatedHeight += 800;
      const copy = createCanvas(width, estimatedHeight);
      copy.getContext('2d').drawImage(canvas, 0, 0);
      canvas.width = estimatedHeight;
    }
  }

  // Show errors on the image
  if (errors.length > 0) {
    ctx.fillStyle = '#f00';
    ctx.font = 'bold 18px monospace';
    let errY = yPos + 20;
    for (const err of errors) {
      ctx.fillText(err, 10, errY);
      errY += 24;
    }
    ctx.fillStyle = '#000';
  }

  if (!fs.existsSync(printsDir)) fs.mkdirSync(printsDir, { recursive: true });
  const filename = `tysp-${Date.now()}.png`;
  const outPath = path.join(printsDir, filename);

  fs.writeFileSync(outPath, canvas.toBuffer('image/png'));
  return filename;
}

}
module.exports = { renderToImage };