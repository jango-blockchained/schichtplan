# Dockerfile for Schichtplan Frontend
FROM node:20-alpine as builder

WORKDIR /app

# Install Bun
RUN npm install -g bun

# Copy package files
COPY package.json bun.lockb ./

# Install dependencies
RUN bun install --frozen-lockfile

# Copy source code
COPY src/frontend/src ./src
COPY src/frontend/public ./public
COPY src/frontend/tsconfig.json ./
COPY src/frontend/vite.config.ts ./
COPY src/frontend/index.html ./
COPY bunfig.toml ./

# Build for production
RUN bun run build

# Runtime stage
FROM node:20-alpine

WORKDIR /app

RUN npm install -g bun

# Copy built assets from builder
COPY --from=builder /app/dist ./dist

# Copy source for serving (needed for preview/dev mode)
COPY --from=builder /app/src ./src
COPY --from=builder /app/public ./public
COPY src/frontend/package.json .
COPY src/frontend/vite.config.ts ./
COPY src/frontend/index.html ./
COPY src/frontend/tsconfig.json ./
COPY bunfig.toml ./

# Install serve or use Bun's preview
RUN bun add -g serve

# Expose port
EXPOSE 5173

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://localhost:5173/ || exit 1

# Start server
CMD ["bun", "run", "preview"]
