// tcpServerL90.js - TCP server for Epson L90 emulation
const net = require('net');

function start(port, queue, printerInfo, renderTicket) {
  const server = net.createServer(socket => {
    let data = Buffer.alloc(0);
    socket.on('data', chunk => {
      data = Buffer.concat([data, chunk]);
    });
    socket.on('end', async () => {
      const cmd = data.toString('utf8').trim();
  // --- Advanced proprietary commands (simulation) ---
  if (cmd.startsWith('~DG')) { socket.write('ACK: GRAPHIC DOWNLOADED (simulated)'); socket.end(); return; }
  if (cmd.startsWith('~EG')) { socket.write('ACK: GRAPHIC DELETED (simulated)'); socket.end(); return; }
  if (cmd.startsWith('~FM')) { socket.write('ACK: FONT DOWNLOADED (simulated)'); socket.end(); return; }
  if (cmd.startsWith('~EF')) { socket.write('ACK: FONT DELETED (simulated)'); socket.end(); return; }
  if (cmd.startsWith('~GM')) { socket.write('MEMORY: 1024KB FREE, 128KB USED (simulated)'); socket.end(); return; }
  if (cmd.startsWith('~CC')) { socket.write('ACK: COUNTRY CODE SET (simulated)'); socket.end(); return; }
  if (cmd.startsWith('~CT')) { socket.write('ACK: PAPER TYPE SET (simulated)'); socket.end(); return; }
  if (cmd.startsWith('~TA')) { socket.write('ACK: LABEL ALIGNMENT SET (simulated)'); socket.end(); return; }
  if (cmd.startsWith('~PR')) { socket.write('ACK: PRINT SPEED SET (simulated)'); socket.end(); return; }
  if (cmd.startsWith('~JD')) { socket.write('HEAD: OK\nTEMP: 32C\nVOLTAGE: 24V (simulated)'); socket.end(); return; }
  if (cmd.startsWith('~JE')) { socket.write('ERRORS: NONE (simulated)'); socket.end(); return; }
  if (cmd.startsWith('~WC')) { socket.write('LABEL COUNT: 12345 (simulated)'); socket.end(); return; }
  if (cmd.startsWith('~MP')) { socket.write('ACK: POWER SAVE MODE SET (simulated)'); socket.end(); return; }
      // --- Detect ZPL vs ESC/POS ---
      const isZPL = data.toString('utf8').includes('^XA') && data.toString('utf8').includes('^XZ');
      if (isZPL) {
        queue.addJob({ type: 'zpl', data: data.toString('utf8'), meta: { source: 'tcp-l90' } });
        if (renderTicket) await renderTicket([data.toString('utf8')]);
      } else {
        queue.addJob({ type: 'escpos', data, meta: { source: 'tcp-l90' } });
        if (renderTicket) await renderTicket([data.toString('utf8')]);
      }
    });
    socket.on('error', err => {
      console.error('L90 TCP socket error:', err);
    });
  });
  server.listen(port, () => {
    console.log(`Epson L90 TCP server listening on port ${port}`);
  });
}

module.exports = { start };
