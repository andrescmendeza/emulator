<<<<<<< HEAD
=======
// server/tcpServer.js
>>>>>>> 1283468 (Version 3: Dashboard improvements (drag-and-drop upload, advanced log viewer, status alerts, panel simulation, queue controls, config UI, error simulation, history filters, image download, command preview))
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
    console.log(`:satellite_antenna: TCP client connected: ${remote}`);
    let chunks = [];

    socket.on('data', (chunk) => {
      chunks.push(chunk);
<<<<<<< HEAD
    });

    socket.on('end', async () => {
      const buffer = Buffer.concat(chunks);

      // detect image protocol
=======
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

    socket.on('end', () => {
      const buffer = Buffer.concat(chunks);
      // --- Error state toggling for testing ---
      const cmd = buffer.toString('utf8').trim();
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
      // Status command simulation
      if (buffer.toString('utf8').trim() === '~HS') {
        // ZPL ~HS: Host Status Return
        // Simulate: PRINTER STATUS, BUFFER STATUS, MEMORY STATUS
        let status = 'PRINTER STATUS: READY\n';
        status += printBuffer.isFull() ? 'BUFFER: FULL\n' : 'BUFFER: OK\n';
        status += `BUFFER JOBS: ${printBuffer.size()}\n`;
        status += `GRAPHICS: ${Object.keys(printerMemory.graphics).length}/40\n`;
        status += `FONTS: ${Object.keys(printerMemory.fonts).length}/20\n`;
        socket.write(status);
        socket.end();
        return;
      }
      // IMG protocol (simple): starts with 'IMG\n'
>>>>>>> 1283468 (Version 3: Dashboard improvements (drag-and-drop upload, advanced log viewer, status alerts, panel simulation, queue controls, config UI, error simulation, history filters, image download, command preview))
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
      const asText = buffer.toString('utf8');

      if (looksLikeTysp(asText)) {
        if (printBuffer.isFull()) {
          socket.write('NAK: BUFFER FULL');
          socket.end();
          return;
        }
        printBuffer.addJob({ type: 'tysp', data: asText, meta: { source: remote } });
        socket.write('ACK');
        socket.end();

        // split commands and call renderTicket on PRINT
        const commands = asText.split('\n').map(c => c.trim()).filter(c => c);
        if (commands.includes('PRINT') && typeof renderTicket === 'function') {
          try {
            await renderTicket(commands);
          } catch(err) {
            console.error('Error rendering ticket:', err);
          }
        }
        return;
      }
      // Detect ESC/POS control bytes
      const hasEsc = buffer.includes(Buffer.from([0x1B])) || buffer.includes(Buffer.from([0x1D]));
      if (hasEsc) {
        if (printBuffer.isFull()) {
          socket.write('NAK: BUFFER FULL');
          socket.end();
          return;
        }
        printBuffer.addJob({ type: 'escpos', data: buffer, meta: { source: remote } });
        socket.write('ACK');
        socket.end();
        return;
      }
<<<<<<< HEAD

      // fallback
      queue.addJob({ type: 'tysp', data: asText, meta: { source: remote } });
      socket.write('OK');
=======
      // Fallback: treat as text/tysp
      if (printBuffer.isFull()) {
        socket.write('NAK: BUFFER FULL');
        socket.end();
        return;
      }
      printBuffer.addJob({ type: 'tysp', data: asText, meta: { source: remote } });
      socket.write('ACK');
>>>>>>> 1283468 (Version 3: Dashboard improvements (drag-and-drop upload, advanced log viewer, status alerts, panel simulation, queue controls, config UI, error simulation, history filters, image download, command preview))
      socket.end();
    });

    socket.on('error', (err) => {
      console.error('TCP socket error:', err.message);
    });
  });

  server.listen(port, () => console.log(`TCP server listening on port ${port}`));
}

<<<<<<< HEAD
module.exports = { start };
=======
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
      // --- End of TCP command handler ---
    });

module.exports = { start };
>>>>>>> 1283468 (Version 3: Dashboard improvements (drag-and-drop upload, advanced log viewer, status alerts, panel simulation, queue controls, config UI, error simulation, history filters, image download, command preview))
