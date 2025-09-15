// SC/POS job to local emulator
const net = require('net');

const HOST = '127.0.0.1';
const PORT = 9100;

function sendTysp(text) {
  return new Promise((resolve, reject) => {
    const s = new net.Socket();
    s.connect(PORT, HOST, () => {
      s.write(text, () => {
        s.end();
        resolve();
      });
    });
    s.on('error', reject);
  });
}

function sendEscPos(buffer) {
  return new Promise((resolve, reject) => {
    const s = new net.Socket();
    s.connect(PORT, HOST, () => {
      s.write(buffer, () => { s.end(); resolve(); });
    });
    s.on('error', reject);
  });
}

module.exports = async function runTest() {
  // Prueba TYSP con corchetes
  const tysp1 = `
[ALIGN CENTER]
[BOLD ON]
[TEXT] :coffee: TEST ORDER
[BOLD OFF]
[TEXT] Date: ${new Date().toLocaleString()}
[TEXT] Beverage: Cappuccino
[TEXT] Size: Large
[TEXT] Price: $5.50
[FEED 2]
[BARCODE] 123456789012
`;
  await sendTysp(tysp1);
  console.log('Sent TySP test (corchetes)');

  // Prueba TYSP tipo ZPL
  const tysp2 = `^XA^FO50,50^A0N,40,40^FDLatte - Medium^FS^FO50,100^BCN,100,Y,N,N^FD987654321^FS^XZ`;
  await sendTysp(tysp2);
  console.log('Sent TySP test (ZPL)');

  // Prueba ESC/POS
  const esc = Buffer.from([0x1B,0x40,0x1B,0x61,0x01, ...Buffer.from('ESC/POS Test\n'), 0x1D,0x56,0x00]);
  await sendEscPos(esc);
  console.log('Sent ESC/POS test');
};