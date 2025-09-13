const { createCanvas, loadImage } = require("canvas");
const BWIPJS = require("bwip-js");

async function renderTicket(commands, width = 576, height = 800) {
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = "#FFFFFF";
  ctx.fillRect(0, 0, width, height);

  // Borde de ticket
  ctx.strokeStyle = "#000000";
  ctx.lineWidth = 2;
  ctx.strokeRect(2, 2, width - 4, height - 4);

  for (const cmd of commands) {
    // ---- TEXT ----
    const matchText = cmd.match(
      /^TEXT\s+(\d+),(\d+),"(.*?)",(\d+),(\d+),(\d+),"(.*)"$/i
    );
    if (matchText) {
      const x = parseInt(matchText[1]);
      const y = parseInt(matchText[2]);
      const fontId = matchText[3];
      const rotation = parseInt(matchText[4]) || 0;
      const horzScale = parseInt(matchText[5]) || 1;
      const vertScale = parseInt(matchText[6]) || 1;
      const text = matchText[7];

      let fontFamily = "Arial";
      if (fontId === "1") fontFamily = "Courier New";
      if (fontId === "2") fontFamily = "Arial Black";

      ctx.save();
      ctx.translate(x, y);
      ctx.rotate((rotation * Math.PI) / 180);
      ctx.font = `${12 * vertScale}px ${fontFamily}`;
      ctx.fillStyle = "#000000";
      ctx.fillText(text, 0, 0);
      ctx.restore();
      continue;
    }

    // ---- BARCODE ----
    const matchBarcode = cmd.match(
      /^BARCODE\s+(\d+),(\d+),"(.*?)",(\d+),(\d+),(\d+),(\d+),(\d+),"(.*)"$/i
    );
    if (matchBarcode) {
      const x = parseInt(matchBarcode[1]);
      const y = parseInt(matchBarcode[2]);
      const symbology = matchBarcode[3].toLowerCase();
      const height = parseInt(matchBarcode[4]) || 80;
      const humanReadable = parseInt(matchBarcode[5]) === 1;
      const data = matchBarcode[9];
      try {
        const png = await BWIPJS.toBuffer({
          bcid:
            symbology === "ean13"
              ? "ean13"
              : symbology === "ean8"
              ? "ean8"
              : symbology === "code39"
              ? "code39"
              : "code128",
          text: data,
          scale: 2,
          height,
          includetext: humanReadable,
        });
        const img = await loadImage(png);
        ctx.drawImage(img, x, y);
      } catch (err) {
        console.error("Error generating barcode:", err);
      }
      continue;
    }

    // ---- QRCODE ----
    const matchQR = cmd.match(/^QRCODE\s+(\d+),(\d+),(\d+),"(.*)"$/i);
    if (matchQR) {
      const x = parseInt(matchQR[1]);
      const y = parseInt(matchQR[2]);
      const scale = parseInt(matchQR[3]) || 4;
      const data = matchQR[4];
      try {
        const png = await BWIPJS.toBuffer({
          bcid: "qrcode",
          text: data,
          scale,
        });
        const img = await loadImage(png);
        ctx.drawImage(img, x, y);
      } catch (err) {
        console.error("Error generating QR:", err);
      }
      continue;
    }

    // ---- LINE ----
    const matchLine = cmd.match(/^LINE\s+(\d+),(\d+),(\d+),(\d+)$/i);
    if (matchLine) {
      const x1 = parseInt(matchLine[1]);
      const y1 = parseInt(matchLine[2]);
      const x2 = parseInt(matchLine[3]);
      const y2 = parseInt(matchLine[4]);
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.strokeStyle = "#000000";
      ctx.lineWidth = 2;
      ctx.stroke();
      continue;
    }

    // ---- BOX ----
    const matchBox = cmd.match(/^BOX\s+(\d+),(\d+),(\d+),(\d+)(,FILL)?$/i);
    if (matchBox) {
      const x = parseInt(matchBox[1]);
      const y = parseInt(matchBox[2]);
      const w = parseInt(matchBox[3]);
      const h = parseInt(matchBox[4]);
      const fill = !!matchBox[5];
      if (fill) {
        ctx.fillStyle = ctx.createPattern(createDitherCanvas(), "repeat");
        ctx.fillRect(x, y, w, h);
      }
      ctx.strokeStyle = "#000000";
      ctx.lineWidth = 2;
      ctx.strokeRect(x, y, w, h);
      continue;
    }

    // ---- IMAGE ----
    const matchImg = cmd.match(/^IMAGE\s+(\d+),(\d+),"(.*)"$/i);
    if (matchImg) {
      const x = parseInt(matchImg[1]);
      const y = parseInt(matchImg[2]);
      const path = matchImg[3];
      try {
        const img = await loadImage(path);
        const tmpCanvas = createCanvas(img.width, img.height);
        const tmpCtx = tmpCanvas.getContext("2d");
        tmpCtx.drawImage(img, 0, 0);
        const imageData = tmpCtx.getImageData(0, 0, img.width, img.height);
        for (let i = 0; i < imageData.data.length; i += 4) {
          const avg =
            (imageData.data[i] +
              imageData.data[i + 1] +
              imageData.data[i + 2]) /
            3;
          const color = avg > 128 ? 255 : 0;
          imageData.data[i] = color;
          imageData.data[i + 1] = color;
          imageData.data[i + 2] = color;
        }
        tmpCtx.putImageData(imageData, 0, 0);
        ctx.drawImage(tmpCanvas, x, y);
      } catch (err) {
        console.error("Error loading image:", err);
      }
      continue;
    }
  }

  return canvas.toBuffer("image/png");
}

function createDitherCanvas() {
  const c = createCanvas(4, 4);
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, 2, 2);
  ctx.fillRect(2, 2, 2, 2);
  return c;
}

module.exports = { renderTicket };
