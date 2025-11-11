# Build stage
FROM node:22-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

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

# Copy package files
COPY package*.json ./

# Install only production dependencies
RUN npm ci --omit=dev

# Copy built dist folder from build stage
COPY --from=builder /app/dist ./dist

# Create and use non-root user (node user has UID 1000 in Alpine)
USER node

# Expose port 8080 for health endpoints
EXPOSE 8080

# Run the application
CMD ["node", "dist/index.js"]

