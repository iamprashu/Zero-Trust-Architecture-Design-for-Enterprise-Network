FROM node:22-alpine AS builder

WORKDIR /app
RUN corepack enable && corepack prepare pnpm@latest --activate

COPY package.json pnpm-workspace.yaml ./
COPY ui/admin-panel ui/admin-panel

RUN pnpm install --filter admin-ui...
RUN pnpm --filter admin-ui build

FROM nginx:alpine
COPY --from=builder /app/ui/admin-panel/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
