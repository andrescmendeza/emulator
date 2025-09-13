# Dockerfile - build from Emulator/ folder
FROM node:20-bullseye

WORKDIR /app

# Copy package files first to leverage Docker cache
COPY package.json package-lock.json* ./

# Install system dependencies required for canvas
RUN apt-get update && apt-get install -y \
    build-essential libcairo2-dev libpango1.0-dev libgif-dev libjpeg-dev python3 && \
    rm -rf /var/lib/apt/lists/*

# Install all Node.js dependencies in one step, including canvas and bwip-js
RUN npm install --production canvas bwip-js

# Copy the rest of the source code
COPY . .

# Expose emulator ports
EXPOSE 9100 8080

# Start the emulator
CMD ["node", "main.js"]
