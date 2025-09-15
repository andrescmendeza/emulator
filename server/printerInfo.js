// printerInfo.js - Manages printer states (power, status, config) for both printers

class PrinterInfo {
  constructor() {
    this.printers = {
      bixolon: {
        name: 'Bixolon SP300',
        protocol: 'TCP',
        port: 9100,
        status: 'online',
        power: true,
      },
      epson: {
        name: 'Epson L90',
        protocol: 'TCP',
        port: 9200,
        status: 'online',
        power: true,
      }
    };
    this.config = {
      labelWidth: 58,
      labelLength: 40,
      printMode: 'normal',
    };
  }

  getInfo() {
    // Return both printers' info
    return {
      bixolon: { ...this.printers.bixolon },
      epson: { ...this.printers.epson }
    };
  }

  setPower(printer, state) {
    if (this.printers[printer]) {
      this.printers[printer].power = !!state;
      this.printers[printer].status = state ? 'online' : 'offline';
    }
  }

  getPower(printer) {
    return this.printers[printer] ? this.printers[printer].power : false;
  }

  getConfig() {
    return { ...this.config };
  }

  setConfig(cfg) {
    this.config = { ...this.config, ...cfg };
  }
}

module.exports = PrinterInfo;
