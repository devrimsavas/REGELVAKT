# The Regelvakt API as a container image.
#
# Two stages: the first installs every dependency, compiles the TypeScript
# and generates the API docs; the second holds only what runs: the compiled
# code, the docs and the production dependencies. No compiler, tests or
# source code in the image that is deployed.

# ---- Build ----
FROM node:24-alpine AS build
WORKDIR /app

# Dependencies first: this layer is reused as long as the lock file is the
# same, so a code change does not install everything again
COPY package.json package-lock.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src ./src
RUN npm run build && npm run swagger

# ---- Run ----
FROM node:24-alpine
WORKDIR /app
ENV NODE_ENV=production

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=build /app/dist ./dist
COPY --from=build /app/swagger_output.json ./

# The node image's own user, not root
USER node

EXPOSE 3000

# Healthy when the API answers and reaches its database: checked every 5
# seconds while it starts (migrations), then every 30. The image has no
# curl, so Node itself makes the request.
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --start-interval=5s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:' + (process.env.PORT || 3000) + '/api/health').then((r) => process.exit(r.ok ? 0 : 1), () => process.exit(1))"

# node itself, not npm, so the stop signal reaches the app and it shuts
# down cleanly (the reminder and knowledge jobs finish their work first)
CMD ["node", "dist/server.js"]
