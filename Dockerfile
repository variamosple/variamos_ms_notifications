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

CMD ["node", "dist/main.js"]
