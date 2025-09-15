// printerMemory.js
// Emulates printer memory for graphics and fonts

class PrinterMemory {
  constructor(maxGraphics = 20, maxFonts = 10) {
    this.maxGraphics = maxGraphics;
    this.maxFonts = maxFonts;
    this.graphics = {};
    this.fonts = {};
  }

  addGraphic(name, data) {
    if (Object.keys(this.graphics).length >= this.maxGraphics) {
      return false; // Memory full
    }
    this.graphics[name] = data;
    return true;
  }

  getGraphic(name) {
    return this.graphics[name];
  }

  removeGraphic(name) {
    delete this.graphics[name];
  }

  addFont(name, data) {
    if (Object.keys(this.fonts).length >= this.maxFonts) {
      return false; // Memory full
    }
    this.fonts[name] = data;
    return true;
  }

  getFont(name) {
    return this.fonts[name];
  }

  removeFont(name) {
    delete this.fonts[name];
  }

  clear() {
    this.graphics = {};
    this.fonts = {};
  }
}

module.exports = PrinterMemory;
