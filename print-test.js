// SC/POS job to local emulator (English version)
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
  console.log('--- INICIO DE TEST DE IMPRESIÓN ---');
  // TYSP test with brackets
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
  console.log('Enviando TySP test (brackets)...');
  try {
    await sendTysp(tysp1);
    console.log('Sent TySP test (brackets)');
  } catch (err) {
    console.error('Error enviando TySP test (brackets):', err);
  }

  // TYSP test in ZPL style
  const tysp2 = `^XA^FO50,50^A0N,40,40^FDLatte - Medium^FS^FO50,100^BCN,100,Y,N,N^FD987654321^FS^XZ`;
  console.log('Enviando TySP test (ZPL style)...');
  try {
    await sendTysp(tysp2);
    console.log('Sent TySP test (ZPL style)');
  } catch (err) {
    console.error('Error enviando TySP test (ZPL style):', err);
  }

  // ESC/POS test
  const esc = Buffer.from([0x1B,0x40,0x1B,0x61,0x01, ...Buffer.from('ESC/POS Test\n'), 0x1D,0x56,0x00]);
  console.log('Enviando ESC/POS test...');
  try {
    await sendEscPos(esc);
    console.log('Sent ESC/POS test');
  } catch (err) {
    console.error('Error enviando ESC/POS test:', err);
  }

  // RAW ESC/POS test for coffee beverage label
  // Simulates: initialize, center, print name, size, customer, barcode, cut
  const cafeLabel = Buffer.concat([
    Buffer.from([0x1B,0x40]), // ESC @ (init)
    Buffer.from([0x1B,0x61,0x01]), // ESC a 1 (center)
    Buffer.from('Latte - Large\n'),
    Buffer.from('Customer: Ana\n'),
    Buffer.from('Date: 2025-09-15\n'),
    Buffer.from('Time: 10:30\n'),
    Buffer.from([0x1D,0x6B,0x04]), // GS k 4 (CODE39)
    Buffer.from('1234567890\0'),
    Buffer.from([0x0A]), // LF
    Buffer.from([0x1D,0x56,0x00]) // GS V 0 (cut)
  ]);
  console.log('Enviando RAW ESC/POS coffee label test...');
  try {
    await sendEscPos(cafeLabel);
    console.log('Sent RAW ESC/POS coffee label test');
  } catch (err) {
    console.error('Error enviando RAW ESC/POS coffee label test:', err);
  }

  // RAW ZPL test for coffee beverage label
  const zplLabel = Buffer.from(`^XA
^FO50,50^A0N,40,40^FDLatte - Large^FS
^FO50,100^A0N,30,30^FDCustomer: Ana^FS
^FO50,140^A0N,30,30^FDDate: 2025-09-15^FS
^FO50,180^A0N,30,30^FDTime: 10:30^FS
^FO50,220^BCN,100,Y,N,N^FD1234567890^FS
^XZ`);
  console.log('Enviando RAW ZPL coffee label test...');
  try {
    await sendEscPos(zplLabel);
    console.log('Sent RAW ZPL coffee label test');
  } catch (err) {
    console.error('Error enviando RAW ZPL coffee label test:', err);
  }
  console.log('--- FIN DE TEST DE IMPRESIÓN ---');
};