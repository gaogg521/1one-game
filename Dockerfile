# 运行：docker compose up --build
FROM node:22-bookworm-slim AS runner

WORKDIR /app

RUN apt-get update \
  && apt-get install -y openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm ci

COPY . .

ENV NODE_ENV=production
ENV DATABASE_URL=file:/app/data/app.sqlite

RUN mkdir -p data \
  && npx prisma generate \
  && npm run build

ENV PORT=8888
EXPOSE 8888

CMD ["sh", "-c", "npx prisma migrate deploy && npm run start"]
