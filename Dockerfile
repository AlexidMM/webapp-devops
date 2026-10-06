FROM node:20
WORKDIR /app

RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*

RUN npm install -g pnpm

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

ENV npm_config_build_from_source=true
RUN pnpm install --frozen-lockfile

COPY . .
EXPOSE 80 6061
CMD ["node", "server.js"]