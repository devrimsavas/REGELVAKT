# The Regelvakt web app as a container image.
#
# Three stages: install the dependencies, build the app, and run it from
# Next.js's standalone output, which holds only the server and the files
# it needs, without the rest of node_modules.

# ---- Dependencies ----
FROM node:24-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# ---- Build ----
FROM node:24-alpine AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1 \
    NEXT_OUTPUT=standalone
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# ---- Run ----
FROM node:24-alpine
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3001 \
    HOSTNAME=0.0.0.0

COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static

# The node image's own user, not root
USER node

EXPOSE 3001

# Healthy when the server answers. /health does not call the API, which
# has a health check of its own.
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --start-interval=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3001/health > /dev/null || exit 1

# The API's address is read when the server starts (API_URL)
CMD ["node", "server.js"]
