const path = require('path');
const fs = require('fs');
const TyspParser = require('./tyspParser');
const EscposParser = require('./escposParser');
const ImageHandler = require('./imageHandler');

class PrintQueue {
  constructor(printsDir) {
    this.printsDir = printsDir;
    this.queue = [];
    this.history = []; // newest first
    this.processing = false;
    this.trace = []; // live trace of incoming raw payloads (max size limited)
    this.traceMax = 500;
    this.paused = false;
    this.cancelRequested = false;
    this.printDelayMs = 500; // Simulated print delay per job (ms)
  }

  addTrace(entry) {
    this.trace.push({ ts: new Date(), entry });
    if (this.trace.length > this.traceMax) this.trace.shift();
  }

  getTrace() {
    return this.trace.slice().reverse();
  }

  addJob(job) {
    // job: { type: 'tysp'|'escpos'|'image', data: string|Buffer, meta: {} }
    job.createdAt = new Date();
    this.queue.push(job);
    this.addTrace(`ENQUEUED ${job.type} (${job.meta && job.meta.source ? job.meta.source : 'tcp'})`);
    this._processNext();
  }

  getQueue() {
    // return copy with lightweight fields
    return this.queue.map((j, idx) => ({
      id: idx + 1,
      type: j.type,
      meta: j.meta || {},
      createdAt: j.createdAt
    }));
  }

  getHistory() {
    return this.history.slice(0, 200);
  }

  pause() {
    this.paused = true;
    this.addTrace('QUEUE PAUSED');
  }

  resume() {
    this.paused = false;
    this.addTrace('QUEUE RESUMED');
    this._processNext();
  }

  cancelAll() {
    this.cancelRequested = true;
    this.queue = [];
    this.addTrace('ALL JOBS CANCELLED');
  }

  reprintLast() {
    if (this.history.length > 0) {
      const last = this.history[0];
      this.addJob({ ...last, createdAt: new Date() });
      this.addTrace('REPRINT LAST JOB');
    }
  }

  setPrintDelay(ms) {
    this.printDelayMs = ms;
    this.addTrace(`PRINT DELAY SET TO ${ms}ms`);
  }

  async _processNext() {
    if (this.processing) return;
    if (this.queue.length === 0) return;

    this.processing = true;

    while (this.queue.length > 0) {
      if (this.paused) {
        this.processing = false;
        this.addTrace('QUEUE PAUSED (processing stopped)');
        return;
      }
      if (this.cancelRequested) {
        this.cancelRequested = false;
        this.queue = [];
        this.processing = false;
        this.addTrace('CANCEL REQUESTED (processing stopped)');
        return;
      }
      const job = this.queue.shift();
      try {
        let filename = null;
        if (job.type === 'tysp') {
          this.addTrace('PROCESSING TYSP job');
          filename = await TyspParser.renderToImage(job.data, this.printsDir);
        } else if (job.type === 'escpos') {
          this.addTrace('PROCESSING ESC/POS job');
          filename = await EscposParser.renderToImage(job.data, this.printsDir);
        } else if (job.type === 'image') {
          this.addTrace('PROCESSING IMAGE job');
          filename = await ImageHandler.saveImageBuffer(job.data, this.printsDir, job.meta && job.meta.ext);
        } else {
          // unknown: save raw
          const f = `raw-${Date.now()}.bin`;
          fs.writeFileSync(path.join(this.printsDir, f), job.data);
          filename = f;
          this.addTrace('PROCESSING RAW job (saved as bin)');
        }

        const record = {
          id: `job-${Date.now()}`,
          file: filename,
          type: job.type,
          meta: job.meta || {},
          processedAt: new Date(),
          raw: (typeof job.data === 'string') ? job.data : (Buffer.isBuffer(job.data) ? job.data.toString('base64') : '')
        };
        this.history.unshift(record);
        // keep history bounded
        if (this.history.length > 500) this.history.pop();

        this.addTrace(`COMPLETED ${job.type} -> ${filename}`);
      } catch (err) {
        this.addTrace(`ERROR processing job: ${err.message}`);
  console.error('Error processing print job:', err);
      }
      // Simulate print speed delay
      if (this.printDelayMs > 0) {
        await new Promise(res => setTimeout(res, this.printDelayMs));
      }
    }

    this.processing = false;
  }
}

module.exports = PrintQueue;