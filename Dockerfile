FROM node:20-alpine

WORKDIR /app

RUN apk add --no-cache python3 make g++

RUN npm install -g pnpm

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml* ./

ENV npm_config_build_from_source=true
RUN pnpm install --frozen-lockfile

COPY . .

EXPOSE 80 6061
CMD ["node", "server.js"]