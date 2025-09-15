const path = require('path');
const fs = require('fs');
const { createCanvas, loadImage } = require('canvas');
const BWIPJS = require('bwip-js');

const PrintQueue = require('./printer/printQueue');
const PrinterInfo = require('./printer/printerInfo');
const tcpServer = require('./server/tcpServer');
const fsWatcher = require('./server/fsWatcher');
const webServer = require('./server/webServer');

const PrintBuffer = require('./server/printBuffer');
const PrinterMemory = require('./server/printerMemory');

const printTest = require('./print-test');

const PRINTS_DIR = path.join(__dirname, 'prints');
const TO_PRINT_DIR = path.join(__dirname, 'to_print');

if (!fs.existsSync(PRINTS_DIR)) fs.mkdirSync(PRINTS_DIR, { recursive: true });
if (!fs.existsSync(TO_PRINT_DIR)) fs.mkdirSync(TO_PRINT_DIR, { recursive: true });

const queue = new PrintQueue(PRINTS_DIR);
const printBuffer = new PrintBuffer(20); // buffer size configurable
const printerMemory = new PrinterMemory(40, 20); // graphics/fonts memory configurable
const printerInfo = new PrinterInfo('Bixolon SP300 Emulator', 9100, 'TCP', queue);

// Render ticket for Bixolon SP300 commands
async function renderTicket(commands) {
  const CANVAS_WIDTH = 384;
  const CANVAS_HEIGHT = 600;
  const canvas = createCanvas(CANVAS_WIDTH, CANVAS_HEIGHT);
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  ctx.fillStyle = '#000000';

  for (const cmd of commands) {
    // TEXT x,y,"font",rotation,horzScale,vertScale,"text"
    const matchText = cmd.match(/^TEXT\s+(\d+),(\d+),".*?",(\d+),(\d+),(\d+),"(.*)"$/i);
    if (matchText) {
      const x = parseInt(matchText[1]);
      const y = parseInt(matchText[2]);
      const horzScale = parseInt(matchText[5]);
      const vertScale = parseInt(matchText[6]);
      const text = matchText[7];
      ctx.font = `${12 * vertScale}px Arial`;
      ctx.fillText(text, x, y);
      continue;
    }

    // BARCODE x,y,"128",height,humanReadable,rotation,horzScale,vertScale,"data"
    const matchBarcode = cmd.match(/^BARCODE\s+(\d+),(\d+),"(128|EAN13|EAN8)",(\d+),(\d+),(\d+),(\d+),(\d+),"(.*)"$/i);
    if (matchBarcode) {
      const x = parseInt(matchBarcode[1]);
      const y = parseInt(matchBarcode[2]);
      const data = matchBarcode[9];
      try {
        const png = await BWIPJS.toBuffer({
          bcid: 'code128',
          text: data,
          scale: 2,
          height: parseInt(matchBarcode[4]),
          includetext: true
        });
        const img = await loadImage(png);
        ctx.drawImage(img, x, y);
      } catch (err) {
        console.error('Error generating barcode:', err);
      }
      continue;
    }
  }

  // save image
  const outPath = path.join(TO_PRINT_DIR, 'latest_ticket.png');
  const out = fs.createWriteStream(outPath);
  const stream = canvas.createPNGStream();
  stream.pipe(out);
  out.on('finish', () => console.log('Ticket rendered in:', outPath));
}

// Start services
tcpServer.start(9100, queue, printerInfo, renderTicket);
fsWatcher.start(TO_PRINT_DIR, queue);
webServer.start(8080, queue, printerInfo);

const runTest = process.env.RUN_PRINT_TEST === 'true' || process.env.RUN_PRINT_TEST === '1';
if (runTest) {
  console.log(':warning: RUN_PRINT_TEST is true — running print-test at startup');
  printTest().catch(err => console.error('print-test error:', err));
}

// Pass printBuffer and printerMemory to servers as needed (future integration)

console.log(':white_check_mark: Emulator started');
console.log(' - TCP port: 9100');
console.log(' - Web panel: http://localhost:8080');
console.log(` - Drop images into: ${TO_PRINT_DIR}`);
