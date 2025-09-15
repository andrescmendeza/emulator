const fs = require('fs');
const path = require('path');
const ImageHandler = require('../printer/imageHandler');

function isImageFile(name) {
  return /\.(png|jpe?g|bmp|gif)$/i.test(name);
}

function start(watchDir, queue) {
  if (!fs.existsSync(watchDir)) fs.mkdirSync(watchDir, { recursive: true });
  // Initial scan
  fs.readdirSync(watchDir).forEach(fname => {
    const full = path.join(watchDir, fname);
    if (fs.statSync(full).isFile() && isImageFile(fname)) {
      const buffer = fs.readFileSync(full);
      queue.addJob({ type: 'image', data: buffer, meta: { source: 'fswatch', ext: path.extname(fname).replace('.', '') }});
      fs.unlinkSync(full);
    }
  });

  fs.watch(watchDir, (eventType, filename) => {
    if (!filename) return;
    const full = path.join(watchDir, filename);
    setTimeout(() => {
      if (!fs.existsSync(full)) return;
      if (!isImageFile(filename)) return;
      try {
        const buffer = fs.readFileSync(full);
        queue.addJob({ type: 'image', data: buffer, meta: { source: 'fswatch', ext: path.extname(filename).replace('.', '') }});
        fs.unlinkSync(full);
  console.log('FSWatcher queued', filename);
      } catch (err) {
  console.error('FSWatcher error', err);
      }
    }, 200);
  });

  console.log(`FS Watcher started on ${watchDir}`);
}

module.exports = { start };