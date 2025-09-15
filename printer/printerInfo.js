// Printer information class
class PrinterInfo {
  constructor(name, port, protocol, queue) {
    this.name = name;
    this.port = port;
    this.protocol = protocol;
    this.queue = queue;
    // --- Configurable printer settings ---
    this.labelWidth = 576; // default in dots
    this.labelLength = 800; // default in dots
    this.printMode = 'NORMAL'; // e.g., NORMAL, TEAR_OFF, etc.
    // Add more as needed
  }

  setConfig(opts) {
    if (opts.labelWidth) this.labelWidth = opts.labelWidth;
    if (opts.labelLength) this.labelLength = opts.labelLength;
    if (opts.printMode) this.printMode = opts.printMode;
    // Add more as needed
  }

  getConfig() {
    return {
      labelWidth: this.labelWidth,
      labelLength: this.labelLength,
      printMode: this.printMode
    };
  }

  getInfo() {
    return {
      name: this.name,
      port: this.port,
      protocol: this.protocol,
      queueLength: this.queue.getQueue().length,
      lastJobs: this.queue.getHistory().slice(0, 5),
      config: this.getConfig()
    };
  }
}

module.exports = PrinterInfo;