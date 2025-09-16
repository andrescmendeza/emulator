const net = require('net');
const PrintBuffer = require('./printBuffer');
const PrinterMemory = require('./printerMemory');

// Create shared instances (in real app, pass from main.js)
const printBuffer = new PrintBuffer(20);
const printerMemory = new PrinterMemory(40, 20);

function looksLikeTysp(text) {
  // Detect real Bixolon SP300 commands
  return /^(TEXT|BARCODE|QRCODE|PRINT)/mi.test(text);
}

function start(port, queue, printerInfo, renderTicket) {
  const server = net.createServer(socket => {
    const remote = socket.remoteAddress + ':' + socket.remotePort;
  console.log(`TCP client connected: ${remote}`);
    let chunks = [];

    socket.on('data', (chunk) => {
      chunks.push(chunk);
      // Don't decide until 'end' to allow binary streams
    });

      // --- Bixolon-like error simulation ---
      let printerStatus = {
        paperOut: false,
        coverOpen: false,
        noInk: false,
      };

    function getBixolonStatusBytes() {
      // Example: 4 bytes, see Bixolon docs for real mapping
      // Bit 0: Paper out, Bit 1: Cover open, Bit 2: No ink
      let b1 = 0x00;
      if (printerStatus.paperOut) b1 |= 0x01;
      if (printerStatus.coverOpen) b1 |= 0x02;
      if (printerStatus.noInk) b1 |= 0x04;
      return Buffer.from([b1, 0x00, 0x00, 0x00]);
    }

    // --- Detect print language ---
    function detectPrintLanguage(buffer) {
      // ESC/POS: look for ESC @ (0x1B 0x40) or other ESC/POS commands
      if (buffer.includes(0x1B) && buffer.includes(0x40)) return 'escpos';
      // ZPL: look for ^XA ... ^XZ
      const str = buffer.toString('utf8');
      if (str.includes('^XA') && str.includes('^XZ')) return 'zpl';
      return 'unknown';
    }

    socket.on('end', async () => {
      const buffer = Buffer.concat(chunks);
  const cmd = buffer.toString('utf8').trim();

  // --- Advanced proprietary commands ---
  // ~DG: Download graphic (simulated)
  // --- ESC/POS status commands ---
  // DLE EOT n (0x10 0x04 n): Real printers respond with status bytes
      if (buffer.length === 3 && buffer[0] === 0x10 && buffer[1] === 0x04) {
        // n: 1=printer, 2=offline, 3=error, 4=paper
        let statusByte = 0x00;
        if (printerStatus.paperOut) statusByte |= 0x20; // Bit 5: paper end
        if (printerStatus.coverOpen) statusByte |= 0x04; // Bit 2: cover open
        // You can expand with more bits as needed
        socket.write(Buffer.from([statusByte]));
        socket.end();
        return;
      }
      // DLE ENQ (0x10 0x05): Real printers respond with status
      if (buffer.length === 2 && buffer[0] === 0x10 && buffer[1] === 0x05) {
        // Example: respond with 0x12 (printer ready)
        socket.write(Buffer.from([0x12]));
        socket.end();
        return;
      }
  // --- Error state toggling for testing ---
  if (cmd === '~ERR_PAPER_OUT') { printerStatus.paperOut = true; socket.write('ACK: PAPER OUT'); socket.end(); return; }
  if (cmd === '~ERR_PAPER_OK') { printerStatus.paperOut = false; socket.write('ACK: PAPER OK'); socket.end(); return; }
  if (cmd === '~ERR_COVER_OPEN') { printerStatus.coverOpen = true; socket.write('ACK: COVER OPEN'); socket.end(); return; }
  if (cmd === '~ERR_COVER_OK') { printerStatus.coverOpen = false; socket.write('ACK: COVER OK'); socket.end(); return; }
  if (cmd === '~ERR_NO_INK') { printerStatus.noInk = true; socket.write('ACK: NO INK'); socket.end(); return; }
  if (cmd === '~ERR_INK_OK') { printerStatus.noInk = false; socket.write('ACK: INK OK'); socket.end(); return; }
      // --- Bixolon status command simulation ---
      if (cmd === '~S' || cmd === '~STATUS') {
        // Return status bytes (simulate Bixolon response)
        socket.write(getBixolonStatusBytes());
        socket.end();
        return;
      }
      // --- Advanced proprietary commands ---
      if (buffer.toString('utf8').trim() === '~HS') {
        // ZPL ~HS: Host Status Return
        let status = 'PRINTER STATUS: READY\n';
        status += printBuffer.isFull() ? 'BUFFER: FULL\n' : 'BUFFER: OK\n';
        status += `BUFFER JOBS: ${printBuffer.size()}\n`;
        status += `GRAPHICS: ${Object.keys(printerMemory.graphics).length}/40\n`;
        status += `FONTS: ${Object.keys(printerMemory.fonts).length}/20\n`;
        socket.write(status);
        socket.end();
        return;
      }
      // --- Proprietary support: ~HSZ (Host Status Zebra extended) ---
      if (buffer.toString('utf8').trim() === '~HSZ') {
        // Reject unsupported languages
        let status = 'PRINTER STATUS: READY\n';
        status += printBuffer.isFull() ? 'BUFFER: FULL\n' : 'BUFFER: OK\n';
        status += `BUFFER JOBS: ${printBuffer.size()}\n`;
        status += `GRAPHICS: ${Object.keys(printerMemory.graphics).length}/40\n`;
        status += `FONTS: ${Object.keys(printerMemory.fonts).length}/20\n`;
        status += 'EXTENDED: OK\n';
        status += 'SENSORS: MARK=OK GAP=OK\n';
        status += 'DARKNESS: 10\n';
        socket.write(status);
        socket.end();
        return;
      }
      // --- Proprietary support: ~SD (Set Darkness) ---
      if (buffer.toString('utf8').trim().startsWith('~SD')) {
        // ~SDn: Set darkness level (n=0-30)
        const val = parseInt(buffer.toString('utf8').trim().replace('~SD',''), 10);
        // Save value in simulated memory (optional)
        printerInfo.darkness = isNaN(val) ? 10 : val;
        socket.write(`ACK: DARKNESS SET TO ${printerInfo.darkness}`);
        socket.end();
        return;
      }
  // --- Printer config via TCP ---
      if (cmd === '~GETCFG') {
        socket.write(JSON.stringify(printerInfo.getConfig()));
        socket.end();
        return;
      }
      if (cmd.startsWith('~SETCFG:')) {
        // Format: ~SETCFG:labelWidth=600,labelLength=900,printMode=TEAR_OFF
        const kvs = cmd.replace('~SETCFG:', '').split(',');
        const opts = {};
        kvs.forEach(kv => {
          const [k, v] = kv.split('=');
          if (k && v) {
            if (k === 'labelWidth' || k === 'labelLength') opts[k] = parseInt(v, 10);
            else opts[k] = v;
          }
        });
        printerInfo.setConfig(opts);
        socket.write('ACK: CONFIG UPDATED');
        socket.end();
        return;
      }
      // IMG protocol (simple): starts with 'IMG\n'
      if (buffer.slice(0,4).toString() === 'IMG\n') {
        if (printBuffer.isFull()) {
          socket.write('NAK: BUFFER FULL');
          socket.end();
          return;
        }
        const imageBuffer = buffer.slice(4);
        printBuffer.addJob({ type: 'image', data: imageBuffer, meta: { source: remote, ext: 'png' } });
        socket.write('ACK');
        socket.end();
        return;
      }

      // --- RAW buffer processing with language detection and limits ---
      const MAX_RAW_SIZE = 8 * 1024; // 8 KB typical for Bixolon SP300
      if (buffer.length > MAX_RAW_SIZE) {
        socket.write('NAK: RAW BUFFER TOO LARGE');
        // Optional: log event for rejection due to size
        if (typeof queue?.addTrace === 'function') queue.addTrace(`REJECTED: RAW too large (${buffer.length} bytes)`);
        socket.end();
        return;
      }

      const lang = detectPrintLanguage(buffer);
      if (lang === 'escpos') {
        if (printBuffer.isFull()) {
          socket.write('NAK: BUFFER FULL');
          socket.end();
          return;
        }
        printBuffer.addJob({ type: 'escpos', data: buffer, meta: { source: remote } });
        socket.write('ACK: ESC/POS');
        socket.end();
        return;
      } else if (lang === 'zpl') {
        if (printBuffer.isFull()) {
          socket.write('NAK: BUFFER FULL');
          socket.end();
          return;
        }
        printBuffer.addJob({ type: 'zpl', data: buffer.toString('utf8'), meta: { source: remote } });
        socket.write('ACK: ZPL');
        socket.end();
        return;
      } else {
        // Reject unsupported languages
        socket.write('NAK: UNSUPPORTED LANGUAGE');
        if (typeof queue?.addTrace === 'function') queue.addTrace('REJECTED: RAW unsupported language');
        socket.end();
        return;
      }
    });

    socket.on('error', (err) => {
      console.error('TCP socket error:', err.message);
    });
  });

  server.listen(port, () => console.log(`TCP server listening on port ${port}`));
}

module.exports = { start };
