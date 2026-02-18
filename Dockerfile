# Aplikacja Next.js + Prisma (PostgreSQL)
FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000

COPY package*.json ./
COPY prisma ./prisma/
RUN npm ci && npx prisma generate
COPY . .
RUN npm run build

EXPOSE 3000
# DATABASE_URL ustaw w Coolify (Environment). Przy starcie: migracja + seed + serwer
CMD ["sh", "-c", "npm run start:prod"]
