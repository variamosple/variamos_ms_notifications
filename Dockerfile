# Build stage: the development dependencies compile the code, then leave
FROM node:26-alpine AS build

WORKDIR /service
# Dependencies first: a change of the source code reuses this layer
COPY package.json package-lock.json ./
# No lifecycle script of the dependencies runs during the build
RUN npm ci --ignore-scripts

COPY tsconfig.json tsconfig.build.json nest-cli.json ./
COPY src ./src
RUN npm run build && npm prune --omit=dev

# Run stage: the compiled code and the production dependencies only (EV-102)
FROM node:26-alpine

WORKDIR /service
# package.json declares the ES modules of dist
COPY --from=build /service/package.json ./package.json
COPY --from=build /service/node_modules ./node_modules
COPY --from=build /service/dist ./dist

# The service reads and writes no file: it runs as the image's node user
# rather than root (SonarCloud S6471)
USER node

EXPOSE 3005

# Health of the container, seen by Docker and by "docker compose up --wait"
# (SPC-2026-11-18-001, lot A2). /health also checks the database
HEALTHCHECK --interval=10s --timeout=5s --start-period=30s --retries=3 \
  CMD ["sh", "-c", "wget -q -O /dev/null http://127.0.0.1:${PORT:-3000}/health"]


CMD ["node", "dist/main.js"]
