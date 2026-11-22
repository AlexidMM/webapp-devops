# ---------- Etapa 1: deps (compila sqlite3) ----------
FROM node:20-alpine AS deps
WORKDIR /app
RUN apk add --no-cache python3 make g++ && npm install -g pnpm@12.4.2
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
ENV npm_config_build_from_source=true
RUN pnpm install --frozen-lockfile --prod

# ---------- Etapa 2: imagen final ----------
FROM node:20-alpine
WORKDIR /app

ENV NODE_ENV=production \
    PORT=3000 \
    DB_PATH=/app/data/data.sqlite

# OTEL apunta al OpenObserve que corre en el host EC2 vía host.docker.internal
# (en Linux hay que pasar --add-host=host.docker.internal:host-gateway al `docker run`)
ENV OTEL_EXPORTER_OTLP_ENDPOINT=http://host.docker.internal:5080/api/default
ENV OTEL_SERVICE_NAME=webapp-devops
ENV OTEL_RESOURCE_ATTRIBUTES=deployment.environment=production

COPY --from=deps /app/node_modules ./node_modules
COPY package.json app.js db.js logger.js server.js instrumentation.js ./
COPY public ./public
RUN mkdir -p /app/data

EXPOSE 3000 6061
CMD ["node", "--import", "./instrumentation.js", "server.js"]