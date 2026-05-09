FROM node:22-alpine AS builder

WORKDIR /app
RUN corepack enable && corepack prepare pnpm@latest --activate

COPY package.json pnpm-workspace.yaml ./
COPY ui/banking-ui ui/banking-ui

RUN pnpm install --filter banking-ui...
RUN pnpm --filter banking-ui build

FROM nginx:alpine
COPY --from=builder /app/ui/banking-ui/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
