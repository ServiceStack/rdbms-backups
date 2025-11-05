FROM oven/bun:1 AS frontend-builder

WORKDIR /app/frontend

# Copy frontend package files
COPY frontend/package.json frontend/bun.lockb* ./

# Install frontend dependencies
RUN bun install

# Copy frontend source
COPY frontend/ ./

# Build frontend
RUN bun run build

FROM oven/bun:1

# Install PostgreSQL and MySQL client tools
RUN apt-get update && apt-get install -y \
    postgresql-client \
    mysql-client \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files
COPY package.json bun.lockb* ./

# Install dependencies
RUN bun install --production

# Copy source code
COPY src/ ./src/
COPY tsconfig.json ./
COPY config.example.json ./

# Copy built frontend from builder
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist

# Create directories
RUN mkdir -p /backups /data

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD bun run -e "fetch('http://localhost:3000/api/health').then(r => r.ok ? process.exit(0) : process.exit(1)).catch(() => process.exit(1))"

# Run the application
CMD ["bun", "run", "src/index.ts"]
