# ---------- Etapa 1: dependencias (compila sqlite3) ----------
FROM node:20-alpine AS deps
WORKDIR /app
RUN apk add --no-cache python3 make g++ && npm install -g pnpm
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml* ./
ENV npm_config_build_from_source=true
RUN pnpm install --frozen-lockfile --prod

# ---------- Etapa 2: imagen final ----------
FROM node:20-alpine
WORKDIR /app

ENV NODE_ENV=production \
    PORT=3000 \
    DB_PATH=/app/data/data.sqlite

COPY --from=deps /app/node_modules ./node_modules
COPY package.json app.js db.js logger.js server.js instrumentation.js ./
COPY public ./public
RUN mkdir -p /app/data

EXPOSE 3000 6061
CMD ["node", "--import", "./instrumentation.js", "server.js"]