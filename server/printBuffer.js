// printBuffer.js
// Emulates a print buffer for the printer emulator

class PrintBuffer {
  constructor(maxSize = 10) {
    this.maxSize = maxSize; // Max jobs in buffer
    this.queue = [];
  }

  addJob(job) {
    if (this.queue.length >= this.maxSize) {
      return false; // Buffer full
    }
    this.queue.push(job);
    return true;
  }

  getNextJob() {
    return this.queue.shift();
  }

  isFull() {
    return this.queue.length >= this.maxSize;
  }

  isEmpty() {
    return this.queue.length === 0;
  }

  size() {
    return this.queue.length;
  }

  clear() {
    this.queue = [];
  }
}

module.exports = PrintBuffer;
