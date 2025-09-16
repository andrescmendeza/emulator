const { createCanvas, loadImage } = require('canvas');
const QRCode = require('qrcode');
const BWIPJS = require('bwip-js');
const PDF417 = require('pdf417-generator');
const fs = require('fs');
const path = require('path');

async function renderToImage(bytes, printsDir, width = 384, fontFamily = 'monospace') {
  let i = 0, y = 0;
  let bold = false, underline = false, doubleWidth = false, doubleHeight = false, align = 'left', fontSize = 18, inverted = false;
  let cut = false, cutType = 'full', cashDrawer = false;
  let currLine = '', lines = [], graphics = [], lineHeight = 22;
  function flushLine() {
    if (currLine.length) {
      lines.push({ text: currLine, bold, underline, doubleWidth, doubleHeight, align, fontSize, inverted });
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
        case 0x7b: // ESC { n (inverted)
          inverted = !!bytes[i+2];
          i += 3;
          break;
        case 0x61: // ESC a n (align)
          align = ['left','center','right'][bytes[i+2]] || 'left';
          i += 3;
          break;
        case 0x69: // ESC i (full cut)
          cut = true;
          cutType = 'full';
          i += 2;
          break;
        case 0x6d: // ESC m (partial cut)
          cut = true;
          cutType = 'partial';
          i += 2;
          break;
        case 0x56: // ESC V (cut)
          cut = true;
          if (bytes[i+2] === 0) cutType = 'full';
          else if (bytes[i+2] === 1) cutType = 'partial';
          else cutType = 'program';
          i += 3;
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
          const barcodeType = bytes[i+2];
          let j = i+3;
          let data = [];
          while (j < bytes.length && bytes[j] !== 0) { data.push(bytes[j]); j++; }
          const barcodeData = Buffer.from(data).toString('ascii');
          if (barcodeType === 67) { graphics.push({ type: 'pdf417', data: barcodeData }); }
          else if (barcodeType === 71) { graphics.push({ type: 'datamatrix', data: barcodeData }); }
          else { graphics.push({ type: 'barcode', barcodeType, data: barcodeData }); }
          i = j+1;
          break;
        case 0x28: // GS ( k (QR code)
          if (bytes[i+4] === 49) {
            let qrData = '';
            let qrLen = bytes[i+2] + (bytes[i+3]<<8) - 3;
            for (let q=0; q<qrLen; ++q) qrData += String.fromCharCode(bytes[i+8+q]);
            graphics.push({ type: 'qr', data: qrData });
          }
          i += 8 + (bytes[i+2] + (bytes[i+3]<<8) - 3);
          break;
        case 0x76: // GS v 0 (raster bit image)
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
    } else if (b === 0x0A || b === 0x0D) { flushLine(); i++; }
    else if (b >= 0x20 && b <= 0x7E) { currLine += String.fromCharCode(b); i++; }
    else { i++; }
  }
  flushLine();

  let estHeight = lines.length * lineHeight * 1.2 + 100;
  for (const g of graphics) {
    if (g.type === 'barcode') estHeight += 60;
    if (g.type === 'qr') estHeight += 120;
    if (g.type === 'pdf417') estHeight += 120;
    if (g.type === 'datamatrix') estHeight += 120;
    if (g.type === 'bitmap') estHeight += g.height + 10;
  }
  const height = Math.max(300, estHeight);
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, width, height);

  y = 30;
  let gIdx = 0;
  for (let l = 0; l < lines.length; l++) {
    const ln = lines[l];
    ctx.save();
    ctx.font = `${ln.bold ? 'bold ' : ''}${ln.doubleHeight ? ln.fontSize*2 : ln.fontSize}px ${ln.fontFamily || fontFamily}`;
    ctx.textBaseline = 'top';
    ctx.fillStyle = '#000';
    if (ln.inverted) {
      const metrics = ctx.measureText(ln.text);
      let tx = 10;
      if (ln.align === 'center') tx = width/2 - metrics.width/2;
      if (ln.align === 'right') tx = width-10 - metrics.width;
      ctx.fillStyle = '#000';
      ctx.fillRect(tx, y, metrics.width, ln.fontSize+6);
      ctx.fillStyle = '#fff';
    } else {
      ctx.fillStyle = '#000';
    }
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
    while (gIdx < graphics.length) {
      const g = graphics[gIdx];
      if (g.type === 'barcode') {
        ctx.save();
        ctx.font = '24px monospace';
        ctx.textAlign = 'center';
        ctx.fillStyle = '#000';
        ctx.fillText(g.data, width/2, y+30);
        ctx.strokeRect(width/2-100, y+10, 200, 40);
        ctx.restore();
        y += 60;
      } else if (g.type === 'qr') {
        const qrCanvas = createCanvas(100, 100);
        await QRCode.toCanvas(qrCanvas, g.data, { margin: 1 });
        ctx.drawImage(qrCanvas, width/2-50, y);
        y += 110;
      } else if (g.type === 'pdf417') {
        const pdf417 = PDF417(g.data);
        const rows = pdf417.rows;
        const cols = pdf417.cols;
        const cellSize = 2;
        const pdfCanvas = createCanvas(cols*cellSize, rows*cellSize);
        const pdfCtx = pdfCanvas.getContext('2d');
        pdfCtx.fillStyle = '#fff';
        pdfCtx.fillRect(0,0,cols*cellSize,rows*cellSize);
        pdfCtx.fillStyle = '#000';
        for (let r=0; r<rows; r++) {
          for (let c=0; c<cols; c++) {
            if (pdf417.barcodeMatrix[r][c]) {
              pdfCtx.fillRect(c*cellSize, r*cellSize, cellSize, cellSize);
            }
          }
        }
        ctx.drawImage(pdfCanvas, width/2-cols, y);
        y += rows*cellSize + 10;
      } else if (g.type === 'datamatrix') {
        try {
          const png = await BWIPJS.toBuffer({
            bcid: 'datamatrix',
            text: g.data,
            scale: 2,
            includetext: false
          });
          const img = await loadImage(png);
          ctx.drawImage(img, width/2-50, y);
          y += 110;
        } catch (err) {
          ctx.font = '12px monospace';
          ctx.fillStyle = '#f00';
          ctx.fillText('DataMatrix error', width/2-50, y);
          y += 20;
        }
      } else if (g.type === 'bitmap') {
        const img = ctx.createImageData(g.width, g.height);
        for (let yy=0; yy<g.height; ++yy) {
          for (let xx=0; xx<g.width; ++xx) {
            const idx = (yy*g.width+xx)*4;
            let v = g.data[yy][xx] ? 0 : 255;
            if (yy > 0 && xx > 0 && yy < g.height-1 && xx < g.width-1) {
              let sum = 0;
              let count = 0;
              for (let dy=-1; dy<=1; dy++) {
                for (let dx=-1; dx<=1; dx++) {
                  sum += g.data[yy+dy][xx+dx] ? 0 : 255;
                  count++;
                }
              }
              v = Math.round(sum/count);
            }
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

  if (cut) {
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 3;
    ctx.beginPath();
    if (cutType === 'partial') {
      const dash = 10, gap = 10;
      let x = 0;
      while (x < width) {
        ctx.moveTo(x, y+10);
        ctx.lineTo(Math.min(x+dash, width), y+10);
        x += dash + gap;
      }
      ctx.setLineDash([dash, gap]);
    } else {
      ctx.setLineDash([]);
      ctx.moveTo(0, y+10);
      ctx.lineTo(width, y+10);
    }
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.font = 'bold 16px monospace';
    ctx.fillStyle = '#000';
    if (cutType === 'partial') {
      ctx.fillText('PARTIAL CUT', width/2-60, y+18);
    } else if (cutType === 'full') {
      ctx.fillText('FULL CUT', width/2-50, y+18);
    } else {
      ctx.fillText('CUT', width/2-20, y+18);
    }
    y += 40;
  }
  if (cashDrawer) {
    ctx.font = 'bold 16px monospace';
    ctx.fillStyle = '#080';
    ctx.fillText('CASH DRAWER OPEN', width/2-80, y+10);
    y += 30;
  }

  try {
    if (!fs.existsSync(printsDir)) fs.mkdirSync(printsDir, { recursive: true });
    const filename = `escpos-${Date.now()}.png`;
    const outPath = path.join(printsDir, filename);
    fs.writeFileSync(outPath, canvas.toBuffer('image/png'));
    console.log(`[escposParser] Image written: ${outPath}`);
    return filename;
  } catch (err) {
    console.error('[escposParser] Error writing image:', err);
    throw err;
  }
}
module.exports = { renderToImage };