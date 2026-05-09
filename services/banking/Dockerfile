FROM node:22-alpine

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@latest --activate

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/ packages/
COPY services/banking services/banking

RUN pnpm install --filter @repo/banking...

WORKDIR /app/services/banking

EXPOSE 5001

CMD ["pnpm", "start"]
