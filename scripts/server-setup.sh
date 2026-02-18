#!/bin/bash
# Uruchom TO na serwerze (np. po ręcznym wgraniu plików): cd ksef-invoice-manager && bash -c "$(cat scripts/server-setup.sh)"
set -e
cd "$(dirname "$0")/.."
echo "Katalog: $(pwd)"

[ -f .env ] || echo 'DATABASE_URL="file:./prod.db"' > .env
echo "Instalacja zależności..."
npm install
echo "Prisma generate..."
npx prisma generate
echo "Tworzenie bazy danych (Prisma db push)..."
npx prisma db push
echo "Seed (użytkownik grzegorzbacol)..."
npx prisma db seed
echo "Build..."
npm run build
echo "Gotowe. Uruchom: npm run start"
echo "Lub w tle: pm2 start npm --name ksef -- run start"
