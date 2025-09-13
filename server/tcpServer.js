const net = require('net');

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
    });

    socket.on('end', async () => {
      const buffer = Buffer.concat(chunks);

      // detect image protocol
      if (buffer.slice(0,4).toString() === 'IMG\n') {
        const imageBuffer = buffer.slice(4);
        queue.addJob({ type: 'image', data: imageBuffer, meta: { source: remote, ext: 'png' } });
        socket.write('OK');
        socket.end();
        return;
      }

      const asText = buffer.toString('utf8');

      if (looksLikeTysp(asText)) {
        queue.addJob({ type: 'tysp', data: asText, meta: { source: remote } });
        socket.write('OK');
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

      // detect ESC/POS control bytes
      const hasEsc = buffer.includes(Buffer.from([0x1B])) || buffer.includes(Buffer.from([0x1D]));
      if (hasEsc) {
        queue.addJob({ type: 'escpos', data: buffer, meta: { source: remote } });
        socket.write('OK');
        socket.end();
        return;
      }

      // fallback
      queue.addJob({ type: 'tysp', data: asText, meta: { source: remote } });
      socket.write('OK');
      socket.end();
    });

    socket.on('error', (err) => {
      console.error('TCP socket error:', err.message);
    });
  });

  server.listen(port, () => console.log(`TCP server listening on port ${port}`));
}

module.exports = { start };
