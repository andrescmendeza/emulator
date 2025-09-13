class PrinterInfo {
  constructor(name, port, protocol, queue) {
    this.name = name;
    this.port = port;
    this.protocol = protocol;
    this.queue = queue;
  }

  getInfo() {
    return {
      name: this.name,
      port: this.port,
      protocol: this.protocol,
      queueLength: this.queue.getQueue().length,
      lastJobs: this.queue.getHistory().slice(0, 5)
    };
  }
}

module.exports = PrinterInfo;