FROM node:22

# Installation des dépendances pour Chrome/Chromium ARM
RUN apt-get update && apt-get install -y \
    wget \
    gnupg \
    ca-certificates \
    procps \
    libxss1 \
    libnss3 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcups2 \
    libdrm2 \
    libgtk-3-0 \
    libgtk-4-1 \
    libxcomposite1 \
    libxdamage1 \
    libxrandr2 \
    libgbm1 \
    libxkbcommon0 \
    libasound2 \
    fonts-liberation \
    libappindicator3-1 \
    xdg-utils \
    chromium \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package*.json ./

# Installer les dépendances sans forcer l'architecture
# et configurer Puppeteer pour utiliser Chromium système
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
RUN npm install
COPY . .

CMD ["npm", "run", "start"]