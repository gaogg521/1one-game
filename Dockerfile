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
ENV DATABASE_URL=file:/app/data/prod.db

RUN mkdir -p data public/covers public/comic-panels public/game-bg \
  && npx prisma generate \
  && npm run build

ENV PORT=6666
EXPOSE 6666

CMD ["sh", "-c", "npx prisma migrate deploy && npm run start"]
