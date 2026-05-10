# 🐳 DevOps Guide — NexusBank Zero Trust Platform

> Docker, deployment, infrastructure, and operational guide for running NexusBank in development and production.

---

## Table of Contents

- [Architecture Overview](#architecture-overview)
- [Docker Compose Setup](#docker-compose-setup)
- [Service Details](#service-details)
- [Networking](#networking)
- [Nginx Reverse Proxy](#nginx-reverse-proxy)
- [Dockerfiles Breakdown](#dockerfiles-breakdown)
- [Environment Variables](#environment-variables)
- [Local Development (Without Docker)](#local-development-without-docker)
- [Production Deployment Checklist](#production-deployment-checklist)
- [Monitoring & Health Checks](#monitoring--health-checks)
- [Scaling Considerations](#scaling-considerations)
- [Troubleshooting](#troubleshooting)

---

## Architecture Overview

```
                    ┌─────────────────────┐
                    │    Client Browser    │
                    └──────────┬──────────┘
                               │ :80
                    ┌──────────▼──────────┐
                    │   Nginx Gateway     │
                    │   (nginx:alpine)    │
                    └──┬───┬───┬───┬───┬──┘
                       │   │   │   │   │
          ┌────────────┘   │   │   │   └────────────┐
          │                │   │   │                │
     ┌────▼───┐    ┌───────▼───▼───▼──────┐    ┌───▼────┐
     │Banking │    │     Auth Service     │    │Device  │
     │   UI   │    │     (node:22)        │    │Service │
     │(nginx) │    │                      │    │(node:22│
     │  :80   │    │  /api/auth/*         │    │  :5002 │
     └────────┘    │  /api/admin/*        │    └───┬────┘
                   │      :5000           │        │
     ┌────────┐    └──────────┬───────────┘        │
     │ Admin  │               │                    │
     │ Panel  │               │                    │
     │(nginx) │    ┌──────────▼───────────┐        │
     │  :80   │    │   Banking Service    │        │
     └────────┘    │     (node:22)        │        │
                   │      :5001           │        │
                   └──────────┬───────────┘        │
                              │                    │
                    ┌─────────▼────────────────────▼┐
                    │         MongoDB               │
                    │       (mongo:latest)           │
                    │          :27017                │
                    └──────────────────────────────┘
```

All containers run on a shared Docker bridge network called `zt_network`.

---

## Docker Compose Setup

### Quick Start

```bash
# Build and start everything
docker compose up --build

# Start in background (detached)
docker compose up --build -d

# View logs
docker compose logs -f

# View specific service logs
docker compose logs -f auth-service

# Stop everything
docker compose down

# Stop and remove volumes (⚠️ deletes all data)
docker compose down -v
```

### Full docker-compose.yml Breakdown

```yaml
services:
  # ──── Database ────────────────────────────────────────
  mongodb:
    image: mongo:latest
    container_name: mongodb
    ports:
      - "27017:27017"          # Exposed for local debugging
    volumes:
      - mongodb_data:/data/db  # Persistent data volume
    networks:
      - zt_network

  # ──── Reverse Proxy ───────────────────────────────────
  nginx:
    image: nginx:alpine
    container_name: nginx_gateway
    ports:
      - "80:80"                # The only externally exposed port
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf:ro
    depends_on:                # Wait for all services
      - auth-service
      - banking-service
      - device-service
      - admin-ui
      - banking-ui
    networks:
      - zt_network

  # ──── Auth Service ────────────────────────────────────
  auth-service:
    build:
      context: .               # Build from project root (needs monorepo files)
      dockerfile: services/auth/Dockerfile
    env_file: .env
    environment:               # Docker-specific overrides
      - MONGO_URI=mongodb://mongodb:27017/zero-trust-db
      - PORT=5000
      - DEVICE_SERVICE_URL=http://device-service:5002
      - CORS_ORIGINS=http://localhost
    depends_on:
      - mongodb
    deploy:
      replicas: 1              # Can scale horizontally
    networks:
      - zt_network

  # ──── Banking Service ─────────────────────────────────
  banking-service:
    build:
      context: .
      dockerfile: services/banking/Dockerfile
    env_file: .env
    environment:
      - MONGO_URI=mongodb://mongodb:27017/zero-trust-db
      - PORT=5001
      - AUTH_VERIFY_URL=http://auth-service:5000/api/auth/verify
      - CORS_ORIGINS=http://localhost
    depends_on:
      - mongodb
    networks:
      - zt_network

  # ──── Device Service ──────────────────────────────────
  device-service:
    build:
      context: .
      dockerfile: services/device-service/Dockerfile
    env_file: .env
    environment:
      - MONGO_URI=mongodb://mongodb:27017/zero-trust-db
      - PORT=5002
      - CORS_ORIGINS=http://localhost
      - EMAIL_USER=your-email@gmail.com
      - EMAIL_PASS=your-app-password
      - EMAIL_FROM=Zero Trust Security <your-email@gmail.com>
    depends_on:
      - mongodb
    networks:
      - zt_network

  # ──── Frontend UIs ────────────────────────────────────
  admin-ui:
    build:
      context: .
      dockerfile: ui/admin-panel/Dockerfile
    networks:
      - zt_network

  banking-ui:
    build:
      context: .
      dockerfile: ui/banking-ui/Dockerfile
    networks:
      - zt_network

volumes:
  mongodb_data:                # Named volume for MongoDB persistence

networks:
  zt_network:
    driver: bridge             # All services on same virtual network
```

---

## Service Details

| Service | Base Image | Internal Port | Build Context | Runtime |
|---------|-----------|---------------|---------------|---------|
| `auth-service` | `node:22-alpine` | 5000 | Monorepo root | `node index.js` |
| `banking-service` | `node:22-alpine` | 5001 | Monorepo root | `node index.js` |
| `device-service` | `node:22-alpine` | 5002 | Monorepo root | `npx tsx src/index.ts` |
| `admin-ui` | `node:22-alpine` → `nginx:alpine` | 80 | Multi-stage build | Static files via Nginx |
| `banking-ui` | `node:22-alpine` → `nginx:alpine` | 80 | Multi-stage build | Static files via Nginx |
| `mongodb` | `mongo:latest` | 27017 | Pre-built image | — |
| `nginx` | `nginx:alpine` | 80 | Pre-built image | Custom `nginx.conf` |

---

## Networking

### Internal Service Communication

All services communicate over the `zt_network` bridge network. Docker DNS resolves service names automatically:

| From | To | URL |
|------|----|-----|
| Banking Service | Auth Service | `http://auth-service:5000/api/auth/verify` |
| Auth Service | Device Service | `http://device-service:5002/api/devices/otp/request` |
| Nginx | Auth Service | `http://auth-service:5000` |
| Nginx | Banking Service | `http://banking-service:5001` |
| Nginx | Device Service | `http://device-service:5002` |
| Nginx | Admin UI | `http://admin-ui:80` |
| Nginx | Banking UI | `http://banking-ui:80` |

### Exposed Ports

Only **two ports** are exposed to the host:

| Port | Service | Purpose |
|------|---------|---------|
| `80` | Nginx | All client traffic (UI + API) |
| `27017` | MongoDB | Database access (dev only — remove in production) |

---

## Nginx Reverse Proxy

The Nginx configuration routes all traffic through a single entry point:

```nginx
# Route mapping:
/                → banking-ui (React SPA)
/admin/          → admin-ui (React SPA)
/api/auth/       → auth-service:5000
/api/admin/      → auth-service:5000
/api/banking/    → banking-service:5001
/api/devices/    → device-service:5002
```

Key configuration features:
- **Proxy headers** — `X-Real-IP`, `X-Forwarded-For` are set for proper client IP tracking
- **SPA fallback** — React Router errors fallback to `index.html` for client-side routing
- **No HTTPS** — TLS termination should be handled by an upstream load balancer in production

---

## Dockerfiles Breakdown

### Backend Services (Auth, Banking)

```dockerfile
FROM node:22-alpine
WORKDIR /app

# Enable pnpm package manager
RUN corepack enable && corepack prepare pnpm@latest --activate

# Copy monorepo files needed for workspace resolution
COPY package.json pnpm-workspace.yaml ./
COPY packages/ packages/              # Shared @repo/db package
COPY services/auth services/auth      # Service-specific code

# Install dependencies for this workspace and its dependencies
RUN pnpm install --filter @repo/auth...

WORKDIR /app/services/auth
EXPOSE 5000
CMD ["pnpm", "start"]
```

**Why copy monorepo files?** Each service depends on `@repo/db` (the shared database package). The `pnpm install --filter @repo/auth...` command installs only what the auth service needs, including shared workspace dependencies.

### Frontend UIs (Multi-Stage Build)

```dockerfile
# Stage 1: Build the React app
FROM node:22-alpine AS builder
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@latest --activate
COPY package.json pnpm-workspace.yaml ./
COPY ui/banking-ui ui/banking-ui
RUN pnpm install --filter banking-ui...
RUN pnpm --filter banking-ui build

# Stage 2: Serve with Nginx
FROM nginx:alpine
COPY --from=builder /app/ui/banking-ui/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

**Why multi-stage?** The build tools (Node.js, pnpm, Vite) are not needed at runtime. The final image is just `nginx:alpine` serving static files — tiny and secure.

### Device Service (TypeScript)

```dockerfile
FROM node:22-alpine
# ... same setup ...
CMD ["npx", "tsx", "src/index.ts"]
```

Uses `tsx` for TypeScript execution (no compilation step needed).

---

## Environment Variables

### Root `.env` (Shared)

```env
MONGO_URI=mongodb://localhost:27017/zero-trust-db

WEBAUTHN_RP_NAME=NexusBank
WEBAUTHN_RP_ID=localhost
WEBAUTHN_ORIGIN=http://localhost
```

### Auth Service

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `PORT` | ❌ | `5000` | Server port |
| `MONGO_URI` | ✅ | — | MongoDB connection string |
| `JWT_SECRET` | ✅ | `default_secret` | Secret for signing access tokens |
| `REFRESH_SECRET` | ✅ | `default_refresh_secret` | Secret for signing refresh tokens |
| `ENCRYPTION_KEY` | ✅ | Default key | AES-256 key for encrypting refresh tokens in DB |
| `SUPERADMIN_EMAIL` | ❌ | — | Auto-create superadmin on startup |
| `SUPERADMIN_PASSWORD` | ❌ | — | Superadmin password |
| `DEVICE_SERVICE_URL` | ❌ | `http://localhost:3005` | URL of the device service |
| `CORS_ORIGINS` | ❌ | `http://localhost` | Comma-separated allowed origins |
| `WEBAUTHN_RP_NAME` | ❌ | `NexusBank` | WebAuthn Relying Party name |
| `WEBAUTHN_RP_ID` | ❌ | `localhost` | WebAuthn RP ID (must match domain) |
| `WEBAUTHN_ORIGIN` | ❌ | `http://localhost` | WebAuthn expected origin |

### Banking Service

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `PORT` | ❌ | `5001` | Server port |
| `MONGO_URI` | ✅ | — | MongoDB connection string |
| `AUTH_VERIFY_URL` | ✅ | `http://localhost:5000/api/auth/verify` | Auth service verify endpoint |
| `CORS_ORIGINS` | ❌ | `http://localhost` | Allowed origins |

### Device Service

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `PORT` | ❌ | `5002` | Server port |
| `MONGO_URI` | ✅ | — | MongoDB connection string |
| `EMAIL_USER` | ✅ | — | Gmail address for sending OTP emails |
| `EMAIL_PASS` | ✅ | — | Gmail app password (not regular password) |
| `EMAIL_FROM` | ❌ | Auto-generated | "From" name in OTP emails |
| `CORS_ORIGINS` | ❌ | `http://localhost` | Allowed origins |

---

## Local Development (Without Docker)

### Prerequisites

- Node.js v22+
- pnpm (`npm install -g pnpm`)
- MongoDB running locally on `mongodb://localhost:27017`

### Steps

```bash
# 1. Clone and install
git clone <repo-url>
cd Zero-Trust-Architecture-Design-for-Enterprise-Network
pnpm install

# 2. Set up environment
cp .env.example .env
# Edit .env with your values

# 3. Start all services (parallel with hot-reload)
pnpm run dev
```

This starts all services and UIs concurrently:
- Auth Service → `nodemon` on port 5000
- Banking Service → `nodemon` on port 5001
- Device Service → `tsx watch` on port 5002
- Banking UI → `vite dev`
- Admin Panel → `vite dev`

### Monorepo Package Manager

This project uses **pnpm workspaces** defined in `pnpm-workspace.yaml`:

```yaml
packages:
  - apps/*
  - services/*
  - gateway/*
  - packages/*
  - ui/*
```

Shared packages use the `@repo/*` namespace:
- `@repo/db` — Database models and connection (used by all services)

---

## Production Deployment Checklist

### Security

- [ ] Change `JWT_SECRET` and `REFRESH_SECRET` to strong random values (32+ chars)
- [ ] Set `ENCRYPTION_KEY` to a strong random value
- [ ] Remove MongoDB port exposure (`27017`) from docker-compose
- [ ] Enable `secure: true` on cookies (`NODE_ENV=production`)
- [ ] Set `sameSite: "strict"` on cookies
- [ ] Configure HTTPS via TLS termination (load balancer or Nginx)
- [ ] Update `WEBAUTHN_RP_ID` and `WEBAUTHN_ORIGIN` to your production domain
- [ ] Update `CORS_ORIGINS` to your production URLs
- [ ] Use MongoDB Atlas or a secured MongoDB instance with authentication
- [ ] Remove default seed passwords

### Infrastructure

- [ ] Use Docker Swarm or Kubernetes for orchestration
- [ ] Add health check probes for each service
- [ ] Set memory and CPU limits on containers
- [ ] Configure log aggregation (ELK, Loki, etc.)
- [ ] Set up MongoDB backups
- [ ] Use a secrets manager (Vault, AWS Secrets Manager) instead of `.env`

### Performance

- [ ] Add Redis for session key caching and challenge store
- [ ] Enable Nginx caching for static assets
- [ ] Set up CDN for frontend assets
- [ ] Configure connection pooling for MongoDB
- [ ] Add rate limiting middleware

---

## Monitoring & Health Checks

### Health Check Endpoints

| Service | Endpoint | Expected Response |
|---------|----------|-------------------|
| Auth Service | `GET /health` | `{ "status": "ok", "service": "auth-service" }` |
| Banking Service | `GET /health` | `{ "status": "ok", "service": "banking-service" }` |

### Docker Health Check Example

Add to `docker-compose.yml`:

```yaml
auth-service:
  healthcheck:
    test: ["CMD", "wget", "--spider", "-q", "http://localhost:5000/health"]
    interval: 30s
    timeout: 10s
    retries: 3
    start_period: 10s
```

### Key Metrics to Monitor

| Metric | Where to Find | Alert Threshold |
|--------|--------------|-----------------|
| Failed auth attempts | `AuditLog` collection | > 50/minute |
| Blocked users | `User.isBlocked = true` | Any new blocks |
| Expired sessions | `SessionKey` collection | Normal behavior |
| OTP delivery failures | Device service logs | Any failures |
| Token mismatch events | Auth service logs | Any occurrence (possible attack) |
| Risk score spikes | `User.riskScore` | Score > 50 |

---

## Scaling Considerations

### What Can Scale Horizontally

| Service | Scalable? | Notes |
|---------|-----------|-------|
| Auth Service | ✅ | Stateless JWT verification. Challenge store needs Redis for multi-instance. |
| Banking Service | ✅ | Fully stateless — delegates auth to auth service |
| Device Service | ✅ | Stateless OTP generation |
| Nginx | ✅ | Add upstream load balancing |
| MongoDB | ✅ | Use replica set or Atlas |

### What Needs Attention When Scaling

1. **WebAuthn Challenge Store** — Currently uses in-memory `Map()`. Replace with Redis for multi-instance.
2. **Session Key Verification** — Currently DB-bound. Add Redis cache for the `SessionKey` lookup.
3. **Nginx Upstream** — Update `nginx.conf` for multiple backend instances.

---

## Troubleshooting

### Common Issues

**Container can't connect to MongoDB:**
```
Error: connect ECONNREFUSED 127.0.0.1:27017
```
→ Make sure `MONGO_URI` uses the Docker service name (`mongodb`) not `localhost`.

**WebAuthn fails with "origin mismatch":**
→ Ensure `WEBAUTHN_ORIGIN` matches exactly what the browser shows (including protocol and port).

**"Refresh token mismatch" after restart:**
→ The encrypted refresh token in the DB doesn't match because `ENCRYPTION_KEY` changed. Users need to re-login.

**OTP emails not sending:**
→ Gmail requires an "App Password" (not your regular password). Enable 2FA on Gmail, then generate an app password under Google Account → Security → App Passwords.

**Frontend shows blank page after Docker build:**
→ Check if `VITE_AUTH_URL` and `VITE_BANKING_URL` environment variables are set correctly in the UI Dockerfile or `.env` file.
