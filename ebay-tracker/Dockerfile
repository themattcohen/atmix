FROM node:20-alpine AS base
# Required for better-sqlite3 native compilation
RUN apk add --no-cache python3 make g++
WORKDIR /app

FROM base AS deps
COPY package*.json ./
RUN npm ci

FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3005

# better-sqlite3 native bindings need libstdc++ at runtime
RUN apk add --no-cache libstdc++

COPY --from=builder /app/.next ./.next
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
COPY --from=builder /app/src/lib/db/migrations ./src/lib/db/migrations

RUN mkdir -p /data
ENV DATABASE_PATH=/data/watchlist.db

EXPOSE 3005
CMD ["node", "dist/server.js"]
