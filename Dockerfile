FROM node:24-bookworm-slim AS base
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
COPY apps/api/package.json ./apps/api/
COPY apps/web/package.json ./apps/web/
COPY packages/contracts/package.json ./packages/contracts/
RUN npm ci --no-audit --no-fund
COPY . .
RUN npm run build:contracts

FROM base AS api
RUN npm run build -w @gear-drop/api
ENV NODE_ENV=production HOST=0.0.0.0
CMD ["sh", "-c", "npm run db:migrate && npm run db:seed && exec node apps/api/dist/main.js"]

FROM base AS web
RUN npm run build -w @gear-drop/web
ENV NODE_ENV=production
CMD ["npm", "run", "start", "-w", "@gear-drop/web", "--", "--hostname", "0.0.0.0"]
