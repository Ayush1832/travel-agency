FROM node:22-alpine AS builder
WORKDIR /app
# Copy root workspace manifests (lockfile lives at root)
COPY package.json package-lock.json ./
COPY server/package.json ./server/
RUN npm ci --workspace=server
COPY server/ ./server/
RUN npm run build --workspace=server

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
COPY server/package.json ./server/
RUN npm ci --workspace=server --omit=dev
COPY --from=builder /app/server/dist ./server/dist
WORKDIR /app/server
EXPOSE 3000
CMD ["node", "dist/main"]
