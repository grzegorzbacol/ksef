#!/bin/bash
# Wgranie aplikacji na serwer. Uruchom w SWOIM terminalu (tam gdzie SSH działa).
# Opcje: export DEPLOY_USER=cursor  export DEPLOY_PORT=2222
set -e
HOST="51.38.132.184"
PORT="${DEPLOY_PORT:-22}"
USER="${DEPLOY_USER:-curosr}"
REMOTE_DIR="ksef-invoice-manager"

echo "Tworzenie katalogu na serwerze..."
ssh -o StrictHostKeyChecking=accept-new -p "$PORT" "$USER@$HOST" "mkdir -p $REMOTE_DIR"

echo "Wysyłanie plików (bez node_modules, .next, .env, *.db)..."
rsync -avz --progress \
  -e "ssh -p $PORT" \
  --exclude node_modules \
  --exclude .next \
  --exclude .env \
  --exclude "*.db" \
  --exclude .git \
  ./ "$USER@$HOST:$REMOTE_DIR/"

echo "Instalacja i build na serwerze..."
ssh -p "$PORT" "$USER@$HOST" "cd $REMOTE_DIR && ([ -f .env ] || echo 'DATABASE_URL=\"file:./prod.db\"' > .env) && npm install && npx prisma generate && npx prisma db push && npx prisma db seed && npm run build"

echo "Gotowe. Aby uruchomić aplikację na serwerze:"
echo "  ssh -p $PORT $USER@$HOST"
echo "  cd $REMOTE_DIR && npm run start"
echo "Lub użyj pm2: pm2 start npm --name ksef -- run start"
