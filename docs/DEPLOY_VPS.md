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

## 0. Clonezi repo-ul pe VPS

Pentru un deploy complet de la zero:

```bash
cd /opt
git clone <PRIVATE_GIT_REMOTE> /allengual-telegram-bot
cd /allengual-telegram-bot
```

Inainte sa completezi `.env.vps`, verifica in Kommo ca folosesti acelasi pipeline:

- pipeline: `Telegram Bot Leads`
- stage activ nou: `Consultation Requested Urgent`

Routarea finala este:

- `Contact operator` -> `Consultation Requested Urgent`
- `Consultatie cariera` -> `Consultation Requested`
- `Maraton Engleza -> Cere PRET` -> `Consultation Requested Urgent`

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
- `WELCOME_IMAGE_PATH`
- `MONITOR_BOT_TOKEN`
- `MONITOR_ALLOWED_USER_IDS`
- `MONITOR_ALERT_CHAT_ID`
- `MONITOR_ACCESS_PASSWORD`

Verifica neaparat:

```env
TELEGRAM_API_ROOT=http://telegram-bot-api:8081
TELEGRAM_USE_LOCAL_API=true
DATABASE_URL=postgresql://postgres:postgres@postgres:5432/botdb?schema=public
REDIS_URL=redis://redis:6379
LESSON_DELAY_MODE=prod
NODE_ENV=production
WELCOME_IMAGE_PATH=/app/video/Image_welcome.JPG
```

Pentru CRM si monitoring:

```env
KOMMO_STAGE_URGENT_ID=
MONITOR_ACCESS_PASSWORD=
MONITOR_MAX_LOGIN_ATTEMPTS=3
MONITOR_TARGET_BASE_URL=http://bot:3000
MONITOR_POLL_INTERVAL_SEC=60
MONITOR_DAILY_REPORT_HOUR=9
MONITOR_TIMEZONE=Europe/Chisinau
MONITOR_ENABLE_DANGEROUS_COMMANDS=false
DOCKER_SOCKET_PATH=/var/run/docker.sock
MONITOR_EXPRESS_BOT_CONTAINER=allengual-bot-prod
MONITOR_EXPRESS_WORKER_CONTAINER=allengual-worker-prod
MONITOR_EXPRESS_DB_CONTAINER=allengual-postgres-prod
MONITOR_EXPRESS_REDIS_CONTAINER=allengual-redis-prod
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
video/Image_welcome.JPG
video/lesson-1.mp4
video/lesson-2.mp4
video/lesson-3.mp4
video/method.mp4
video/academy.mp4
video/webinar-fear.mp4
```

Asigura-te ca folderul exista:

```bash
mkdir -p /allengual-telegram-bot/video
```

## 4. Build + migrate + seed

Foloseste mereu `--env-file .env.vps` la productie:

```bash
cd /allengual-telegram-bot
docker compose --env-file .env.vps -f docker-compose.prod.yml down
docker compose --env-file .env.vps -f docker-compose.prod.yml build --no-cache
docker compose --env-file .env.vps -f docker-compose.prod.yml run --rm bot npm run prisma:migrate
docker compose --env-file .env.vps -f docker-compose.prod.yml run --rm bot npm run prisma:seed
```

Optional, doar daca ai schimbat sursele AI sau continutul indexat de website:

```bash
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
docker compose --env-file .env.vps -f docker-compose.prod.yml logs --tail=100 ops-bot
curl http://127.0.0.1:3000/health
curl http://127.0.0.1:8082
```

Trebuie sa vezi:
- `telegram-bot-api`, `bot`, `worker`, `ops-bot`, `postgres`, `redis` in `Up`
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
docker compose --env-file .env.vps -f docker-compose.prod.yml up -d
```

Ruleaza `crawl` si `embed` doar daca ai modificat sursele AI sau continutul website indexat:

```bash
docker compose --env-file .env.vps -f docker-compose.prod.yml run --rm bot npm run crawl
docker compose --env-file .env.vps -f docker-compose.prod.yml run --rm bot npm run embed
```

## 8. Restart rapid si restart complet

Restart rapid doar pentru runtime-ul Express:

```text
/restart_express
```

Comanda se ruleaza din `ops-bot` si restarteaza containerele `bot` si `worker`.

Restart complet pentru tot proiectul:

```bash
cd /allengual-telegram-bot
docker compose --env-file .env.vps -f docker-compose.prod.yml restart
```

Nu folosi `down -v` in update-urile normale.

## 9. Verificare dupa deploy

```bash
cd /allengual-telegram-bot
docker compose --env-file .env.vps -f docker-compose.prod.yml ps
docker compose --env-file .env.vps -f docker-compose.prod.yml logs --tail=100 bot
docker compose --env-file .env.vps -f docker-compose.prod.yml logs --tail=100 worker
docker compose --env-file .env.vps -f docker-compose.prod.yml logs --tail=100 ops-bot
curl http://127.0.0.1:3000/health
docker stats --no-stream
docker system df
```

In `ops-bot` verifica si:

```text
/status
/health
/queues
```

## 10. Curatare sigura Docker

Imaginile Docker vechi ocupa spatiu pe disk, nu RAM. Pentru RAM verifica `docker stats --no-stream`.

Verificare imagini dangling:

```bash
docker image ls --filter dangling=true
```

Curatare sigura doar pentru imagini dangling:

```bash
docker image prune -f
```

Evita pe acest VPS:

- `docker system prune -a`
- `docker volume prune`

## 11. Curatare cache media Telegram

```bash
cd /allengual-telegram-bot
docker compose --env-file .env.vps -f docker-compose.prod.yml run --rm bot npm run media:invalidate-cache
```

## 12. Reset total bot, useri si cozi

```bash
cd /allengual-telegram-bot
docker compose --env-file .env.vps -f docker-compose.prod.yml run --rm bot npm run reset:bot-state
docker compose --env-file .env.vps -f docker-compose.prod.yml up -d
```

Acest reset sterge:

- utilizatori
- profiluri
- sesiuni
- progres lectii
- rezultate quiz
- joburi programate
- event logs
- cache media Telegram
- coziile BullMQ

## Observatii

- `Local Bot API Server` permite upload-ul de fisiere video mai mari decat limita standard cloud
- botul trimite video-urile direct din folderul `video/`
- in productie, `bot` si `worker` monteaza direct `./video:/app/video:ro`, deci fisierele pot fi inlocuite pe host fara commit in git
- `Contact operator` merge in `Consultation Requested Urgent`
- `Consultatie cariera` merge in `Consultation Requested`
- `ops-bot` poate fi restrictionat simultan prin `MONITOR_ALLOWED_USER_IDS` si parola din `MONITOR_ACCESS_PASSWORD`
- `WELCOME_IMAGE_PATH` trebuie sa pointeze spre imaginea locala montata in `/app/video/Image_welcome.JPG`
