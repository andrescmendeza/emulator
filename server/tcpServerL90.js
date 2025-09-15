// tcpServerL90.js - TCP server for Epson L90 emulation
const net = require('net');

function start(port, queue, printerInfo, renderTicket) {
  const server = net.createServer(socket => {
    let data = Buffer.alloc(0);
    socket.on('data', chunk => {
      data = Buffer.concat([data, chunk]);
    });
    socket.on('end', async () => {
  // NOTE: Uses the same ESC/POS parser and renderer as the Bixolon SP300.
  // If you need to support L90-specific differences, add them here.
  queue.addJob({ type: 'escpos', data, meta: { source: 'tcp-l90' } });
  // Optionally, call renderTicket for preview
  if (renderTicket) await renderTicket([data.toString('utf8')]);
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
