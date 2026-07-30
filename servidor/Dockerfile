FROM node:22-slim AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

FROM node:22-slim AS runner
WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates fonts-liberation libasound2 libatk-bridge2.0-0 \
    libatk1.0-0 libcups2 libdrm2 libgbm1 libnss3 libu2f-udev \
    libxcomposite1 libxdamage1 libxrandr2 libxshmfence1 \
    libxkbcommon0 libxfixes3 libxrender1 libxext6 \
    libxi6 libxtst6 libxcb1 libx11-xcb1 \
    libcairo2 libpango-1.0-0 libpangocairo-1.0-0 \
    libgdk-pixbuf2.0-0 libgtk-3-0 \
    xdg-utils && \
    rm -rf /var/lib/apt/lists/*

# Copiar node_modules (incluye puppeteer desde whatsapp-web.js)
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package*.json ./

# Usar puppeteer para instalar Chrome (versión correcta para este puppeteer)
ENV PUPPETEER_CACHE_DIR=/app/.puppeteer_cache
RUN node -e "const {execSync}=require('child_process'); execSync('npx --yes puppeteer browsers install chrome', {stdio:'inherit'})"

# Crear symlink
RUN CHROME_BIN=$(find /app/.puppeteer_cache -name "chrome" -type f 2>/dev/null | head -1) && \
    echo "Chrome instalado en: $CHROME_BIN" && \
    ln -sf "$CHROME_BIN" /usr/bin/google-chrome

ENV CHROME_PATH=google-chrome
ENV HOME=/app

RUN addgroup --system app && adduser --system --ingroup app app
RUN mkdir -p /app/.local/share/applications /app/.wwebjs_auth /app/.cache && \
    chown -R app:app /app/.local /app/.wwebjs_auth /app/.cache

# Ejecutar como root para evitar problemas de permisos con Chrome/crashpad
# (el bot solo escucha en puerto interno, no expuesto al exterior)
#USER app
EXPOSE 4002
CMD ["node", "dist/api/index.js"]
