
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

  // static
  app.use('/prints', express.static(path.join(__dirname, '../prints')));
  app.use('/static', express.static(path.join(__dirname, '../'))); // serve dashboard.html and assets

  // JSON endpoints
  app.get('/api/queue', (req, res) => res.json(queue.getQueue()));
  app.get('/api/history', (req, res) => res.json(queue.getHistory()));
  app.get('/api/printer', (req, res) => res.json(printerInfo.getInfo()));
  app.get('/api/trace', (req, res) => res.json(queue.getTrace()));

  // upload endpoint (multipart) -> saves to to_print and will be picked by watcher
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

  // serve dashboard main
  app.get('/', (req, res) => res.sendFile(path.join(__dirname, '../dashboard.html')));

  // WebSocket
  const wss = new WebSocketServer({ server });

  function broadcast(obj) {
    const data = JSON.stringify(obj);
    wss.clients.forEach(c => { if (c.readyState === 1) c.send(data); });
  }

  // periodic broadcast of status + queue + history + trace
  setInterval(() => {
    broadcast({
      type: 'status',
      printer: printerInfo.getInfo(),
      queue: queue.getQueue(),
      history: queue.getHistory().slice(0, 30),
      trace: queue.getTrace().slice(0, 100)
    });
  }, 800);

  server.listen(port, () => console.log(`Web server listening on http://localhost:${port}`));
}

module.exports = { start };