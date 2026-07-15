FROM node:22-slim AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

FROM node:22-slim AS runner
WORKDIR /app
RUN addgroup --system app && adduser --system --ingroup app app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package*.json ./
RUN npm install --omit=dev
USER app
EXPOSE 4002
