# ── Build stage ──────────────────────────────────────────────
FROM node:22-alpine AS build

RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# Install dependencies first (layer cache)
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# Copy source and compile
COPY tsconfig.json ./
COPY src/ ./src/
RUN pnpm exec tsc


# ── Production stage ─────────────────────────────────────────
FROM node:22-alpine

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@latest --activate

# Production deps only
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --prod

# Compiled JS from build stage
COPY --from=build /app/dist/ ./dist/

# Predefined skills (.md files) — loaded at runtime by skills/index.js
COPY src/skills/predefined/ ./dist/skills/predefined/

# Run as root so the process can access /var/run/docker.sock.
# The socket is owned by root:docker (GID varies per host), and adding
# the container user to the right group at build time is unreliable.
# testcontainers needs socket access to create sibling containers.
ENV NODE_ENV=production
ENV DOCKER_HOST=unix:///var/run/docker.sock

CMD ["node", "dist/index.js"]
