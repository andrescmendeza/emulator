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
  const tysp = `
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

  await sendTysp(tysp);
  console.log('Sent TySP test');

  const esc = Buffer.from([0x1B,0x40,0x1B,0x61,0x01, ...Buffer.from('ESC/POS Test\n'), 0x1D,0x56,0x00]);
  await sendEscPos(esc);
  console.log('Sent ESC/POS test');
};