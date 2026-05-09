FROM node:22-alpine

WORKDIR /app

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# Copy the monorepo files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/ packages/
COPY services/auth services/auth

# Install dependencies for the specific workspace and its shared packages
RUN pnpm install --filter @repo/auth...

WORKDIR /app/services/auth

EXPOSE 5000

# Use the start script
CMD ["pnpm", "start"]
