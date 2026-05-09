FROM node:22-alpine

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@latest --activate

COPY package.json pnpm-workspace.yaml ./
COPY packages/ packages/
COPY services/device-service services/device-service

RUN pnpm install --filter device-service...

WORKDIR /app/services/device-service

EXPOSE 5002

CMD ["npx", "tsx", "src/index.ts"]
