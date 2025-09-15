const path = require('path');
const fs = require('fs');
const { createCanvas, loadImage } = require('canvas');
const BWIPJS = require('bwip-js');

const PrintQueue = require('./printer/printQueue');
const PrinterInfo = require('./printer/printerInfo');
const tcpServer = require('./server/tcpServer');
const tcpServerL90 = require('./server/tcpServerL90');
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

// --- Epson L90 TCP Service ---
const queueL90 = new PrintQueue(PRINTS_DIR);
const printerInfoL90 = new PrinterInfo('Epson L90 Emulator', 9200, 'TCP', queueL90);

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
  out.on('finish', () => console.log('Ticket rendered at:', outPath));
}


// Start services
tcpServer.start(9100, queue, printerInfo, renderTicket);
tcpServerL90.start(9200, queueL90, printerInfoL90, renderTicket); // L90 on port 9200
fsWatcher.start(TO_PRINT_DIR, queue);
webServer.start(8080, queue, printerInfo);

const runTest = process.env.RUN_PRINT_TEST === 'true' || process.env.RUN_PRINT_TEST === '1';
if (runTest) {
  console.log(':warning: RUN_PRINT_TEST is true — running print-test at startup');
  printTest()
    .then(async () => {
  // Automatic test with emulator_test.raw for both emulators
      const net = require('net');
      const rawPath = path.join(__dirname, 'emulator_test.raw');
      if (fs.existsSync(rawPath)) {
        const buffer = fs.readFileSync(rawPath);
        // Enviar a Bixolon SP300 (9100)
        await new Promise((resolve, reject) => {
          const s = new net.Socket();
          s.connect(9100, '127.0.0.1', () => {
            s.write(buffer, () => { s.end(); resolve(); });
          });
          s.on('error', reject);
        });
  console.log('Automatic test: emulator_test.raw sent to Bixolon SP300 emulator (9100).');

        // Enviar a Epson L90 (9200)
        await new Promise((resolve, reject) => {
          const s = new net.Socket();
          s.connect(9200, '127.0.0.1', () => {
            s.write(buffer, () => { s.end(); resolve(); });
          });
          s.on('error', reject);
        });
  console.log('Automatic test: emulator_test.raw sent to Epson L90 emulator (9200).');
      } else {
  console.warn('emulator_test.raw not found for automatic test.');
      }
    })
    .catch(err => console.error('print-test error:', err));
}

// Pass printBuffer and printerMemory to servers as needed (future integration)


console.log(':white_check_mark: Emulator started');
console.log(' - Bixolon SP300 TCP port: 9100');
console.log(' - Epson L90 TCP port: 9200');
console.log(' - Web panel: http://localhost:8080');
console.log(` - Drop images into: ${TO_PRINT_DIR}`);
