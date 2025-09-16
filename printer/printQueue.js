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
    console.log(`[PrintQueue] Job enqueued: type=${job.type}, meta=${JSON.stringify(job.meta)}, createdAt=${job.createdAt}`);
    this.addTrace(`ENQUEUED ${job.type} (${job.meta && job.meta.source ? job.meta.source : 'tcp'})`);
    this._processNext();
  }

  getQueue() {
    // return copy with lightweight fields
    const q = this.queue.map((j, idx) => ({
      id: idx + 1,
      type: j.type,
      meta: j.meta || {},
      createdAt: j.createdAt
    }));
    console.log(`[PrintQueue] Current pending queue: ${q.length} jobs`);
    return q;
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
    if (this.processing) {
      console.log('[PrintQueue] Already processing, skipping _processNext call.');
      return;
    }
    if (this.queue.length === 0) {
      console.log('[PrintQueue] No jobs to process.');
      return;
    }

    this.processing = true;
    console.log('[PrintQueue] Starting job processing loop.');

    while (this.queue.length > 0) {
      if (this.paused) {
        this.processing = false;
        this.addTrace('QUEUE PAUSED (processing stopped)');
        console.log('[PrintQueue] Queue paused. Stopping processing.');
        return;
      }
      if (this.cancelRequested) {
        this.cancelRequested = false;
        this.queue = [];
        this.processing = false;
        this.addTrace('CANCEL REQUESTED (processing stopped)');
        console.log('[PrintQueue] Cancel requested. Queue cleared.');
        return;
      }
      const job = this.queue.shift();
      try {
        let filename = null;
        console.log(`[PrintQueue] Processing job: type=${job.type}, meta=${JSON.stringify(job.meta)}, createdAt=${job.createdAt}`);
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
        if (filename) {
          console.log(`[PrintQueue] Image or file generated: ${filename}`);
        } else {
          console.warn('[PrintQueue] No filename returned for job:', job.type);
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
        console.log(`[PrintQueue] Job completed: type=${job.type}, file=${filename}`);
      } catch (err) {
        this.addTrace(`ERROR processing job: ${err.message}`);
        console.error('[PrintQueue] Error processing print job:', err);
      }
      // Simulate print speed delay
      if (this.printDelayMs > 0) {
        await new Promise(res => setTimeout(res, this.printDelayMs));
      }
    }

    this.processing = false;
    console.log('[PrintQueue] Finished processing all jobs.');
  }
}

module.exports = PrintQueue;