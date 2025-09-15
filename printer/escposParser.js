const { createCanvas, loadImage } = require('canvas');
const QRCode = require('qrcode');
const fs = require('fs');
const path = require('path');

// Minimal ESC/POS stub: extract printable ASCII and render it.
// For a full implementation, integrate escpos-buffer or escpos libraries.

async function renderToImage(buffer, printsDir) {
  const width = 576;
  let y = 30;
  let lineHeight = 22;
  let fontSize = 18;
  let fontFamily = 'monospace';
  let bold = false;
  let underline = false;
  let doubleWidth = false;
  let doubleHeight = false;
  let align = 'left';
  let cut = false;
  let cashDrawer = false;
  let lines = [];
  let graphics = [];

  // Parse ESC/POS commands
  const bytes = Buffer.from(buffer);
  let i = 0;
  let currLine = '';
  function flushLine() {
    if (currLine.length > 0) {
      lines.push({
        text: currLine,
        bold, underline, doubleWidth, doubleHeight, align, fontSize
      });
      currLine = '';
    }
  }
  while (i < bytes.length) {
    const b = bytes[i];
    // ESC = 0x1B, GS = 0x1D, FS = 0x1C
  if (b === 0x1B) { // ESC
      const n = bytes[i+1];
      switch (n) {
        case 0x40: // ESC @ Initialize
          bold = underline = doubleWidth = doubleHeight = false;
          align = 'left';
          fontSize = 18;
          i += 2;
          break;
        case 0x45: // ESC E n (bold)
          bold = !!bytes[i+2];
          i += 3;
          break;
        case 0x2d: // ESC - n (underline)
          underline = !!bytes[i+2];
          i += 3;
          break;
        case 0x21: // ESC ! n (font size)
          const mode = bytes[i+2];
          doubleWidth = !!(mode & 0x20);
          doubleHeight = !!(mode & 0x10);
          fontSize = 18 * (doubleHeight ? 2 : 1);
          i += 3;
          break;
        case 0x61: // ESC a n (align)
          align = ['left','center','right'][bytes[i+2]] || 'left';
          i += 3;
          break;
        case 0x69: // ESC i (full cut)
        case 0x6d: // ESC m (partial cut)
        case 0x56: // ESC V (cut)
          cut = true;
          i += 2;
          break;
        case 0x70: // ESC p (cash drawer)
          cashDrawer = true;
          i += 4;
          break;
        default:
          i += 2;
      }
    } else if (b === 0x1D) { // GS
      const n = bytes[i+1];
      switch (n) {
        case 0x56: // GS V m (cut)
          cut = true;
          i += 3;
          break;
        case 0x6B: // GS k (barcode)
          // GS k m d1..dn NUL
          const barcodeType = bytes[i+2];
          let j = i+3;
          let data = [];
          while (j < bytes.length && bytes[j] !== 0) { data.push(bytes[j]); j++; }
          const barcodeData = Buffer.from(data).toString('ascii');
          graphics.push({ type: 'barcode', barcodeType, data: barcodeData });
          i = j+1;
          break;
        case 0x28: // GS ( k (QR code)
          // GS ( k pL pH cn fn ...
          // We'll look for fn=49 (store), then fn=81 (print)
          if (bytes[i+4] === 49) { // store
            let qrData = '';
            let qrLen = bytes[i+2] + (bytes[i+3]<<8) - 3;
            for (let q=0; q<qrLen; ++q) qrData += String.fromCharCode(bytes[i+8+q]);
            graphics.push({ type: 'qr', data: qrData });
          }
          i += 8 + (bytes[i+2] + (bytes[i+3]<<8) - 3);
          break;
        case 0x76: // GS v 0 (raster bit image)
          // GS v 0 m xL xH yL yH d1... (bit image)
          const m = bytes[i+2];
          const xL = bytes[i+3], xH = bytes[i+4];
          const yL = bytes[i+5], yH = bytes[i+6];
          const widthPx = xL + (xH << 8);
          const heightPx = yL + (yH << 8);
          const bytesPerRow = Math.ceil(widthPx / 8);
          const imgData = [];
          let imgPtr = i+7;
          for (let row=0; row<heightPx; ++row) {
            let rowBits = [];
            for (let col=0; col<bytesPerRow; ++col) {
              const byte = bytes[imgPtr++] || 0;
              for (let bit=7; bit>=0; --bit) {
                if (rowBits.length < widthPx) rowBits.push((byte >> bit) & 1);
              }
            }
            imgData.push(rowBits);
          }
          graphics.push({ type: 'bitmap', width: widthPx, height: heightPx, data: imgData });
          i = imgPtr;
          break;
        default:
          i += 2;
      }
    } else if (b === 0x0A || b === 0x0D) { // LF/CR
      flushLine();
      i++;
    } else if (b >= 0x20 && b <= 0x7E) { // printable ASCII
      currLine += String.fromCharCode(b);
      i++;
    } else {
      i++;
    }
  }
  flushLine();

  // Estimate height
  let estHeight = lines.length * lineHeight * 1.2 + 100;
  for (const g of graphics) {
    if (g.type === 'barcode') estHeight += 60;
    if (g.type === 'qr') estHeight += 120;
    if (g.type === 'bitmap') estHeight += g.height + 10;
  }
  const height = Math.max(300, estHeight);
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, width, height);

  y = 30;
  let gIdx = 0;
  for (const ln of lines) {
    ctx.save();
    ctx.font = `${ln.bold ? 'bold ' : ''}${ln.doubleHeight ? ln.fontSize*2 : ln.fontSize}px ${fontFamily}`;
    ctx.textBaseline = 'top';
    ctx.fillStyle = '#000';
    if (ln.align === 'center') {
      ctx.textAlign = 'center';
      ctx.fillText(ln.text, width/2, y);
    } else if (ln.align === 'right') {
      ctx.textAlign = 'right';
      ctx.fillText(ln.text, width-10, y);
    } else {
      ctx.textAlign = 'left';
      ctx.fillText(ln.text, 10, y);
    }
    if (ln.underline) {
      const metrics = ctx.measureText(ln.text);
      let tx = 10;
      if (ln.align === 'center') tx = width/2 - metrics.width/2;
      if (ln.align === 'right') tx = width-10 - metrics.width;
      ctx.fillRect(tx, y + ln.fontSize + 2, metrics.width, 2);
    }
    y += (ln.doubleHeight ? ln.fontSize*2 : ln.fontSize) + 8;
    ctx.restore();
    // After each line, check for graphics to render
    while (gIdx < graphics.length) {
      const g = graphics[gIdx];
      if (g.type === 'barcode') {
        // Simple barcode: draw as text with box
        ctx.save();
        ctx.font = '24px monospace';
        ctx.textAlign = 'center';
        ctx.fillStyle = '#000';
        ctx.fillText(g.data, width/2, y+30);
        ctx.strokeRect(width/2-100, y+10, 200, 40);
        ctx.restore();
        y += 60;
      } else if (g.type === 'qr') {
        // Use qrcode package to draw QR
        const qrCanvas = createCanvas(100, 100);
        await QRCode.toCanvas(qrCanvas, g.data, { margin: 1 });
        ctx.drawImage(qrCanvas, width/2-50, y);
        y += 110;
      } else if (g.type === 'bitmap') {
        // Draw raster bit image
        const img = ctx.createImageData(g.width, g.height);
        for (let yy=0; yy<g.height; ++yy) {
          for (let xx=0; xx<g.width; ++xx) {
            const idx = (yy*g.width+xx)*4;
            const v = g.data[yy][xx] ? 0 : 255;
            img.data[idx] = img.data[idx+1] = img.data[idx+2] = v;
            img.data[idx+3] = 255;
          }
        }
        ctx.putImageData(img, 10, y);
        y += g.height + 10;
      }
      gIdx++;
    }
  }

  // Draw cut/cash drawer indicators
  if (cut) {
    ctx.strokeStyle = '#f00';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, y+10);
    ctx.lineTo(width, y+10);
    ctx.stroke();
    ctx.font = 'bold 16px monospace';
    ctx.fillStyle = '#f00';
    ctx.fillText('PAPER CUT', width/2-50, y+18);
    y += 40;
  }
  if (cashDrawer) {
    ctx.font = 'bold 16px monospace';
    ctx.fillStyle = '#080';
    ctx.fillText('CASH DRAWER OPEN', width/2-80, y+10);
    y += 30;
  }

  if (!fs.existsSync(printsDir)) fs.mkdirSync(printsDir, { recursive: true });
  const filename = `escpos-${Date.now()}.png`;
  fs.writeFileSync(path.join(printsDir, filename), canvas.toBuffer('image/png'));
  return filename;
}

module.exports = { renderToImage };