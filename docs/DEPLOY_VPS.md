# Deploy pe VPS

Acest proiect ruleaza in productie cu:
- `polling mode`
- `Local Bot API Server`
- `Docker Compose`

Important:
- nu atinge alt bot existent pe server
- foloseste director separat
- video-urile finale nu se comit in git; se copiaza separat in folderul `video/`

## Director recomandat

```bash
/allengual-telegram-bot
```

## 1. Configurezi `.env.vps`

```bash
cd /allengual-telegram-bot
cp .env.vps.example .env.vps
nano .env.vps
```

Completezi neaparat:
- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_LOCAL_API_ID`
- `TELEGRAM_LOCAL_API_HASH`
- `GROQ_API_KEY`
- toate valorile `KOMMO_*`

Verifica neaparat:

```env
TELEGRAM_API_ROOT=http://telegram-bot-api:8081
TELEGRAM_USE_LOCAL_API=true
DATABASE_URL=postgresql://postgres:postgres@postgres:5432/botdb?schema=public
REDIS_URL=redis://redis:6379
LESSON_DELAY_MODE=prod
NODE_ENV=production
```

## 2. Migrare de la cloud Bot API la Local Bot API Server

Opresti botul curent inainte de switch.

Pe masina unde ai tokenul configurat:

```bash
npm run telegram:logout-cloud
```

Scriptul:
- sterge webhook-ul daca exista
- face `logOut` din cloud Bot API

## 3. Copiezi video-urile finale pe server

In folderul proiectului, botul cauta:

```text
video/lesson-1.mp4
video/lesson-2.mp4
video/lesson-3.mp4
video/method.mp4
video/academy.mp4
video/webinar-fear.mp4
```

## 4. Build + migrate + seed

Foloseste mereu `--env-file .env.vps` la productie:

```bash
cd /allengual-telegram-bot
docker compose --env-file .env.vps -f docker-compose.prod.yml down
docker compose --env-file .env.vps -f docker-compose.prod.yml build --no-cache
docker compose --env-file .env.vps -f docker-compose.prod.yml run --rm bot npm run prisma:migrate
docker compose --env-file .env.vps -f docker-compose.prod.yml run --rm bot npm run prisma:seed
docker compose --env-file .env.vps -f docker-compose.prod.yml run --rm bot npm run crawl
docker compose --env-file .env.vps -f docker-compose.prod.yml run --rm bot npm run embed
```

## 5. Pornire

```bash
docker compose --env-file .env.vps -f docker-compose.prod.yml up -d
```

## 6. Verificare

```bash
docker compose --env-file .env.vps -f docker-compose.prod.yml ps
docker compose --env-file .env.vps -f docker-compose.prod.yml logs --tail=100 telegram-bot-api
docker compose --env-file .env.vps -f docker-compose.prod.yml logs --tail=100 bot
docker compose --env-file .env.vps -f docker-compose.prod.yml logs --tail=100 worker
curl http://127.0.0.1:3000/health
curl http://127.0.0.1:8082
```

Trebuie sa vezi:
- `telegram-bot-api`, `bot`, `worker`, `postgres`, `redis` in `Up`
- `/health` cu `status=ok`
- in logul botului:
  - `Bot Telegram pornit in polling mode.`
  - `apiRoot: http://telegram-bot-api:8081`

## 7. Update ulterior

```bash
cd /allengual-telegram-bot
git pull origin main
docker compose --env-file .env.vps -f docker-compose.prod.yml down
docker compose --env-file .env.vps -f docker-compose.prod.yml build --no-cache
docker compose --env-file .env.vps -f docker-compose.prod.yml run --rm bot npm run prisma:migrate
docker compose --env-file .env.vps -f docker-compose.prod.yml run --rm bot npm run prisma:seed
docker compose --env-file .env.vps -f docker-compose.prod.yml run --rm bot npm run crawl
docker compose --env-file .env.vps -f docker-compose.prod.yml run --rm bot npm run embed
docker compose --env-file .env.vps -f docker-compose.prod.yml up -d
```

## Observatii

- `Local Bot API Server` permite upload-ul de fisiere video mai mari decat limita standard cloud
- botul trimite video-urile direct din folderul `video/`
- daca inlocuiesti fisierele video, trebuie rebuild la imagini, fiindca `Dockerfile.prod` foloseste `COPY video ./video`
