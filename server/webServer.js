// server/webServer.js
const express = require('express');
const path = require('path');
const http = require('http');
const { WebSocketServer } = require('ws');
const multer = require('multer');
const fs = require('fs');

function start(port, queue, printerInfo) {
  const app = express();
  const server = http.createServer(app);

  // Static files
  app.use('/prints', express.static(path.join(__dirname, '../prints')));
  app.use('/to_print', express.static(path.join(__dirname, '../to_print')));
  app.use('/static', express.static(path.join(__dirname, '../'))); // serve dashboard.html and assets
  // Servir archivos estáticos raíz (incluye prints-list.html)
  app.use(express.static(path.join(__dirname, '../')));

  // JSON endpoints
  app.get('/api/queue', (req, res) => res.json(queue.getQueue()));
  app.get('/api/history', (req, res) => res.json(queue.getHistory()));
    app.get('/api/printer', (req, res) => res.json(printerInfo.getInfo()));
    app.post('/api/printer/power', express.json(), (req, res) => {
      const { printer, state } = req.body;
      printerInfo.setPower(printer, state);
      res.json({ ok: true, power: printerInfo.getPower(printer) });
    });
  app.get('/api/trace', (req, res) => res.json(queue.getTrace()));

  // --- Printer config endpoints ---
  app.get('/api/printer/config', (req, res) => res.json(printerInfo.getConfig()));
  app.post('/api/printer/config', express.json(), (req, res) => {
    printerInfo.setConfig(req.body);
    res.json({ ok: true, config: printerInfo.getConfig() });
  });

  // Upload endpoint (multipart) -> saves to to_print and will be picked by watcher
  const uploadDir = path.join(__dirname, '../to_print');
  if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

  const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`)
  });
  const upload = multer({ storage });
  app.post('/api/upload', upload.single('image'), (req, res) => {
    res.json({ ok: true, file: req.file.filename });
  });

  // Serve dashboard main
  app.get('/', (req, res) => res.sendFile(path.join(__dirname, '../dashboard.html')));

  // WebSocket
  const wss = new WebSocketServer({ server });

  function broadcast(obj) {
    const data = JSON.stringify(obj);
    wss.clients.forEach(c => { if (c.readyState === 1) c.send(data); });
  }

  // Periodic broadcast of status + queue + history + trace
  setInterval(() => {
      // Always send both printers, even if undefined
      const info = printerInfo.getInfo() || {};
      broadcast({
        type: 'status',
        printers: {
          bixolon: info.bixolon || { name: 'Bixolon', protocol: 'TCP', port: 9100, power: false, queueLength: 0, lastJobs: [] },
          epson: info.epson || { name: 'Epson', protocol: 'TCP', port: 9200, power: false, queueLength: 0, lastJobs: [] }
        },
        queue: queue.getQueue(),
        history: queue.getHistory(),
        trace: queue.getTrace().slice(0, 100)
      });
  }, 800);

  // --- Print queue controls ---
  app.post('/api/queue/pause', (req, res) => { queue.pause(); res.json({ ok: true, status: 'paused' }); });
  app.post('/api/queue/resume', (req, res) => { queue.resume(); res.json({ ok: true, status: 'resumed' }); });
  app.post('/api/queue/cancel', (req, res) => { queue.cancelAll(); res.json({ ok: true, status: 'cancelled' }); });
  app.post('/api/queue/reprint', (req, res) => { queue.reprintLast(); res.json({ ok: true, status: 'reprinted' }); });
  app.post('/api/queue/delay', express.json(), (req, res) => {
    const ms = parseInt(req.body.ms, 10);
    if (!isNaN(ms) && ms >= 0) {
      queue.setPrintDelay(ms);
      res.json({ ok: true, delay: ms });
    } else {
      res.status(400).json({ ok: false, error: 'Invalid delay' });
    }
  });

  // --- Logs/trace endpoint ---
  app.get('/api/logs', (req, res) => {
    // Optionally support ?format=txt for plain text
    const format = req.query.format;
    const trace = queue.getTrace().slice().reverse(); // oldest first
    if (format === 'txt') {
      res.setHeader('Content-Type', 'text/plain');
      res.send(trace.map(e => `[${e.ts.toISOString ? e.ts.toISOString() : e.ts}] ${e.entry}`).join('\n'));
    } else {
      res.json(trace);
    }
  });

  // --- TCP command relay for error simulation ---
  app.post('/api/tcp-cmd', express.json(), async (req, res) => {
    const { cmd } = req.body;
    if (!cmd) return res.status(400).json({ ok: false, error: 'Missing cmd' });
    const net = require('net');
    const client = new net.Socket();
    let response = '';
    client.connect(9100, '127.0.0.1', () => {
      client.write(cmd + '\n');
    });
    client.on('data', data => { response += data.toString(); });
    client.on('end', () => { res.json({ ok: true, response }); });
    client.on('error', err => { res.status(500).json({ ok: false, error: err.message }); });
  });

  server.listen(port, () => console.log(`Web server listening on http://localhost:${port}`));
}

module.exports = { start };