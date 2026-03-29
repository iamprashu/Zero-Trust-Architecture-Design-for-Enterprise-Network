# Zero Trust Architecture Design for Enterprise Network

## Overview

**Zero Trust Architecture Design for Enterprise Network** is a production-level microservices platform built using a **Zero Trust security model**, where no service, user, or system is trusted by default — every request must be authenticated, authorized, and verified.

This project demonstrates a **secure enterprise architecture** using:

- Microservices
- API Gateway
- Zero Trust principles
- Service-to-service authentication
- Role Based Access Control (RBAC)
- Centralized logging
- Distributed architecture
- Monorepo setup with pnpm
- Prisma ORM with PostgreSQL (NeonDB)

This project is designed as a **system design + security architecture project**, not just a backend application.

---

## Architecture Overview

```
Client (Admin / Super Admin)
            ↓
         API Gateway
            ↓
   -----------------------
   | Auth Service        |
   | User Service        |
   | Mail Service        |
   | Payment Service     |
   -----------------------
            ↓
        Prisma ORM
            ↓
        PostgreSQL (NeonDB)
            ↓
           Redis
            ↓
      Message Queue
```

### Zero Trust Principles Implemented

- Authentication at API Gateway
- Authorization using RBAC
- Service-to-service authentication
- Encrypted communication
- Audit logging
- Rate limiting
- No direct service exposure
- Centralized logging
- Token validation on every request

---

## Monorepo Structure

```
Zero-Trust-Architecture-Design-for-Enterprise-Network/
│
├── apps/
│   ├── admin/
│   └── super-admin/
│
├── gateway/
│   └── api-gateway/
│
├── services/
│   ├── auth-service/
│   ├── user-service/
│   ├── mail-service/
│   └── payment-service/
│
├── packages/
│   ├── db/          # Prisma + Database
│   ├── types/       # Shared Types
│   ├── logger/      # Logging system
│   ├── utils/       # Shared utilities
│   └── config/      # Shared configs
│
├── docker/
├── nginx/
├── pnpm-workspace.yaml
├── tsconfig.base.json
└── README.md
```

---

## Tech Stack

### Backend

- Node.js
- TypeScript
- Express / Fastify
- Prisma ORM
- PostgreSQL (NeonDB)
- Redis
- RabbitMQ / Kafka

### Frontend

- Next.js
- React
- TailwindCSS

### DevOps

- Docker
- Nginx
- GitHub Actions
- Kubernetes (Future)
- Turborepo
- pnpm Workspaces

### Security (Zero Trust)

- JWT Authentication
- Role Based Access Control (RBAC)
- Service-to-Service Authentication
- API Gateway Authorization
- Rate Limiting
- Audit Logs
- mTLS (Planned)
- Network Segmentation

---

## Services

| Service         | Description                  |
| --------------- | ---------------------------- |
| API Gateway     | Entry point for all requests |
| Auth Service    | Authentication & JWT         |
| User Service    | User management              |
| Mail Service    | Email notifications          |
| Payment Service | Payment handling             |
| DB Package      | Prisma client                |
| Logger Package  | Central logging              |
| Types Package   | Shared types                 |

---

## Getting Started

### Install Dependencies

From root:

```
pnpm install
```

### Run Database

```
cd packages/db
pnpm prisma generate
pnpm prisma db push
```

### Run Auth Service

```
cd services/auth-service
pnpm dev
```

### Run API Gateway

```
cd gateway/api-gateway
pnpm dev
```

---

## Development Commands

| Command         | Description                         |
| --------------- | ----------------------------------- |
| pnpm install    | Install all workspace dependencies  |
| pnpm dev        | Run all services (with turbo later) |
| pnpm build      | Build all packages                  |
| prisma generate | Generate Prisma client              |
| prisma db push  | Push schema to DB                   |
| prisma studio   | Open DB GUI                         |

---

## Future Improvements

- Service Mesh (Istio / Linkerd)
- mTLS between services
- Kubernetes deployment
- Distributed tracing
- Observability (Prometheus + Grafana)
- Centralized logging (ELK stack)
- Circuit breaker pattern
- API rate limiting
- OAuth / SSO
- Zero Trust Network Policies

---

## Learning Goals of This Project

This project demonstrates knowledge of:

- Microservices Architecture
- Zero Trust Security Model
- API Gateway Architecture
- Distributed Systems
- Monorepo Architecture
- DevOps & Containerization
- Database Design
- Authentication & Authorization
- System Design
- Enterprise Backend Architecture

---

## Author

**Zero Trust Architecture Design for Enterprise Network**
Enterprise Security Architecture Project
