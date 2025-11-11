# Dockerfile for Schichtplan Frontend
FROM node:20-alpine as builder

WORKDIR /app

# Install Bun
RUN npm install -g bun

# Copy package files
COPY package.json bun.lockb bunfig.toml ./

# Install dependencies
RUN bun install --frozen-lockfile

# Copy source code
COPY src ./src
COPY public ./public
COPY tsconfig.json ./
COPY vite.config.ts ./
COPY index.html ./

# Build for production
RUN bun run build

# Runtime stage
FROM node:20-alpine

WORKDIR /app

RUN npm install -g bun

# Copy built assets from builder
COPY --from=builder /app/dist ./dist

# Copy necessary files for serving
COPY --from=builder /app/package.json ./
COPY --from=builder /app/vite.config.ts ./
COPY --from=builder /app/index.html ./
COPY --from=builder /app/bunfig.toml ./

# Install serve or use Bun's preview
RUN bun add -g serve

# Expose port
EXPOSE 5173

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://localhost:5173/ || exit 1

# Start server
CMD ["bun", "run", "preview"]
