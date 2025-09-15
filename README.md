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
nc localhost 9100 <<'EOF'
TEXT 50,20,"0",0,2,2,"Starbucks Coffee"
TEXT 50,70,"0",0,1,1,"Latte - Medium"
TEXT 50,110,"0",0,1,1,"Order: #12345"
TEXT 50,150,"0",0,1,1,"Cashier: Alice"

LINE 40,180,400,180,2
BOX 40,190,400,300,2

TEXT 60,210,"0",0,1,1,"Extra Shot"
TEXT 60,240,"0",0,1,1,"Soy Milk"
TEXT 60,270,"0",0,1,1,"Sugar-free Syrup"

BARCODE 50,320,"128",80,1,0,2,2,"12345"

QRCODE 250,320,"M",6,6,"https://starbucks.com/order/12345"

LINE 40,420,400,420,2

TEXT 50,440,"0",0,1,1,"Date: 2025-09-13 11:30"
TEXT 50,470,"0",0,1,1,"Thank you for your visit!"
PRINT
EOF


```

### 2. Send ESC/POS Command
```bash
echo "Latte - Medium\nPrice: $2.99\n[Barcode: 987654321]" | nc localhost 9100


printf "\x1B\x40\x1B\x61\x01Latte - Medium\n\n\x1D\x6B\x04987654321\x00\n\n\n" | nc localhost 9100

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

## 🕹️ Print Queue Controls (Web & TCP)

You can control the print queue in real time via REST API or TCP commands:

### Web API (REST)
- Pause queue: `POST /api/queue/pause`
- Resume queue: `POST /api/queue/resume`
- Cancel all jobs: `POST /api/queue/cancel`
- Reprint last job: `POST /api/queue/reprint`
- Set print delay: `POST /api/queue/delay` with JSON `{ "ms": 1000 }`

Example (pause queue):
```bash
curl -X POST http://localhost:8080/api/queue/pause
```

### TCP Commands
Send these as plain text to port 9100:
- `~PAUSE` — Pause the print queue
- `~RESUME` — Resume the print queue
- `~CANCEL` — Cancel all jobs
- `~REPRINT` — Reprint the last job
- `~DELAY=1000` — Set print delay to 1000ms per job

Example (pause queue):
```bash
echo "~PAUSE" | nc localhost 9100
```

You will receive `ACK` or `NAK` responses for each command.

---

## 📂 Example Files

- `to_print/coffee_label.tysp` → Example TYSP job  
- `to_print/coffee_label_escpos.txt` → Example ESC/POS job  
- Drop a `.png` file into `to_print/` to simulate an image print  

---

## ⚡ Auto Test on Startup

On container start, `print-test.js` runs automatically and sends a sample TYSP job to the emulator.

