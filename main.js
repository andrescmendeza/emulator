const path = require('path');
const fs = require('fs');

const PrintQueue = require('./printer/printQueue');
const PrinterInfo = require('./printer/printerInfo');
const tcpServer = require('./server/tcpServer');
const fsWatcher = require('./server/fsWatcher');
const webServer = require('./server/webServer');

const printTest = require('./print-test');

const PRINTS_DIR = path.join(__dirname, 'prints');
const TO_PRINT_DIR = path.join(__dirname, 'to_print');

// ensure folders
if (!fs.existsSync(PRINTS_DIR)) fs.mkdirSync(PRINTS_DIR, { recursive: true });
if (!fs.existsSync(TO_PRINT_DIR)) fs.mkdirSync(TO_PRINT_DIR, { recursive: true });

// instantiate queue and info
const queue = new PrintQueue(PRINTS_DIR);
const printerInfo = new PrinterInfo('Bixolon SP300 Emulator', 9100, 'TCP', queue);

// start services
tcpServer.start(9100, queue, printerInfo);
fsWatcher.start(TO_PRINT_DIR, queue);
webServer.start(8080, queue, printerInfo);

// optionally run print-test at startup if env variable is set
const runTest = process.env.RUN_PRINT_TEST === 'true' || process.env.RUN_PRINT_TEST === '1';
if (runTest) {
  console.log(':warning: RUN_PRINT_TEST is true — running print-test at startup');
  // run print test but do not block startup
  printTest().catch(err => console.error('print-test error:', err));
}

console.log(':white_check_mark: Emulator started');
console.log(' - TCP port: 9100');
console.log(' - Web panel: http://localhost:8080');
console.log(` - Drop images into: ${TO_PRINT_DIR}`);