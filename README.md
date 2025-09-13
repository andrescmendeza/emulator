# Bixolon Emulator

This project emulates a **Bixolon SP300 printer** with support for:

- **TYSP (ZPL-like)** commands
- **ESC/POS** commands
- **Image printing** (drop images in `/to_print/` folder inside the container)

It exposes:
- **TCP Server** on port `9100`
- **Web Dashboard** on port `8080`

---

## 🚀 How to Build and Run

```bash
# Build Docker image
docker build -t bixolon-emulator .

# Run container
docker run --name bixolon-emulator -e RUN_PRINT_TEST=true -p 9100:9100 -p 8080:8080 bixolon-emulator
```

Then visit:  
👉 [http://localhost:8080](http://localhost:8080)

---

## 🖨️ How to Test Printing

### 1. Send TYSP Command
```bash
echo "^XA^FO50,50^A0N,40,40^FDLatte - Medium^FS^FO50,100^BCN,100,Y,N,N^FD987654321^FS^XZ" | nc localhost 9100
```

### 2. Send ESC/POS Command
```bash
echo "Latte - Medium\nPrice: $2.99\n[Barcode: 987654321]" | nc localhost 9100
```

### 3. Drop an Image
Copy any PNG/JPG file into the `to_print/` folder inside the container:

```bash
docker cp my_label.png bixolon-emulator:/app/to_print/
```

The emulator will detect the file and add it as a print job.

---

## 📊 Dashboard

The dashboard shows:
- Printer info (name, port, status, protocol)
- Current jobs in queue
- Print history (real-time updates)
- Live job trace

---

## 📂 Example Files

- `to_print/coffee_label.tysp` → Example TYSP job  
- `to_print/coffee_label_escpos.txt` → Example ESC/POS job  
- Drop a `.png` file into `to_print/` to simulate an image print  

---

## ⚡ Auto Test on Startup

On container start, `print-test.js` runs automatically and sends a sample TYSP job to the emulator.

