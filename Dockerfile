# Dockerfile - build from Emulator/ folder
FROM node:20-bullseye

WORKDIR /app

# copy package first to leverage cache
COPY package.json package-lock.json* ./

RUN apt-get update && apt-get install -y \
    build-essential libcairo2-dev libpango1.0-dev libgif-dev libjpeg-dev python3 && \
    rm -rf /var/lib/apt/lists/*

RUN npm install --production

COPY . .

EXPOSE 9100 8080

# Optional: run print-test automatically if you set RUN_PRINT_TEST env var to "true"
CMD ["node", "main.js"]