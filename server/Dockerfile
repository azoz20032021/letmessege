# ─── Build stage ────────────────────────────────────────────────────────────
FROM node:20-alpine AS deps

WORKDIR /app

# Copy manifests first so the dependency layer is cached across code changes.
COPY package*.json ./
RUN npm ci --omit=dev --ignore-scripts

# ─── Runtime stage ──────────────────────────────────────────────────────────
FROM node:20-alpine AS runtime

# dumb-init gives PID 1 proper signal handling, so SIGTERM reaches Node.
RUN apk add --no-cache dumb-init

ENV NODE_ENV=production \
    PORT=5000

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY --chown=node:node package*.json ./
COPY --chown=node:node src ./src
COPY --chown=node:node scripts ./scripts

# Local-disk upload fallback needs a writable directory.
RUN mkdir -p /app/uploads && chown -R node:node /app/uploads

USER node
EXPOSE 5000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||5000)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "src/server.js"]
