FROM node:24-alpine

WORKDIR /service

COPY package.json package-lock.json tsconfig.json nest-cli.json ./
COPY src ./src

RUN npm ci
RUN npm run build
RUN npm prune --omit=dev

EXPOSE 3005

CMD ["node", "dist/main.js"]
