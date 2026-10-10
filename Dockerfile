FROM node:22-bookworm-slim AS build
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
ENV DATABASE_URL=file:/app/prisma/build.db
RUN npx prisma generate && npx prisma migrate deploy
RUN NEXTAUTH_SECRET=build-only-placeholder NEXTAUTH_URL=http://localhost:3000 npm run build

FROM node:22-bookworm-slim AS runtime
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl sqlite3 && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production
ENV DATABASE_URL=file:/data/masjid.db
ENV UPLOAD_DIR=/data/uploads
ENV PORT=3000
COPY --from=build /app /app
RUN mkdir -p /data/uploads && chown -R node:node /data /app
USER node
EXPOSE 3000
CMD ["sh", "-c", "npx prisma migrate deploy && npm run start -- --hostname 0.0.0.0 --port ${PORT:-3000}"]
