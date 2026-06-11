# Build stage
FROM node:22-alpine AS builder

WORKDIR /app

# Install build dependencies for native modules
RUN apk add --no-cache python3 make g++

# Copy package files and prepare script (prepare runs during npm ci)
COPY package*.json ./
COPY scripts/prepare-husky.cjs scripts/prepare-husky.cjs

# Install all dependencies (including dev dependencies for TypeScript build)
RUN npm ci

# Copy source code
COPY src/ ./src/
COPY tsconfig.json ./

# Build TypeScript
RUN npm run build

# Production stage
FROM node:22-alpine AS production

WORKDIR /app

# Install build dependencies for native modules
RUN apk add --no-cache python3 make g++

# Copy package files and prepare script so any npm lifecycle (e.g. npm link) can run
# prepare safely: it no-ops when husky is not installed (production / --omit=dev).
COPY package*.json ./
COPY scripts/prepare-husky.cjs scripts/prepare-husky.cjs

# Omit devDependencies (husky lives there). If package.json has a `prepare` script that
# invokes `husky`, it would fail with "husky: not found" unless we skip lifecycle scripts.
# better-sqlite3 needs a native build — rebuild it after install.
RUN npm ci --omit=dev --ignore-scripts && npm rebuild better-sqlite3

# Copy built dist folder from build stage (includes bundled checklist YAML)
COPY --from=builder /app/dist ./dist

# Link the binary globally (creates /usr/local/bin/kube9-operator).
# --ignore-scripts avoids re-running lifecycle hooks that assume devDependencies (husky).
RUN npm link --ignore-scripts

# Remove build dependencies to reduce image size
RUN apk del python3 make g++

# Create data directory with correct permissions
RUN mkdir -p /data && chown node:node /data

# Create and use non-root user (node user has UID 1000 in Alpine)
USER node

# Expose port 8080 for health endpoints
EXPOSE 8080

# Run the application
CMD ["node", "dist/index.js"]

