# Aplikacja Next.js + Prisma (PostgreSQL)
FROM node:20-alpine
WORKDIR /app
ENV PORT=3000
# OpenSSL i libc6-compat – wymagane przez silnik Prisma w Alpine
RUN apk add --no-cache openssl libc6-compat curl
# NODE_ENV=production dopiero po buildzie – do buildu potrzebne są devDependencies (tailwindcss)
COPY package*.json ./
COPY prisma ./prisma/
RUN npm ci && npx prisma generate
COPY . .
RUN npm run build
ENV NODE_ENV=production

EXPOSE 3000
# DATABASE_URL ustaw w Coolify (Environment). Przy starcie: migracja + seed + serwer
CMD ["sh", "-c", "npm run start:prod"]
