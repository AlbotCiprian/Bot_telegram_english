# Deploy pe VPS

Acest proiect se poate urca acum pe VPS in mod sigur folosind `polling mode` + `Docker Compose`.

Important:
- nu atinge alt bot existent in `/home`
- foloseste un director separat
- acest deploy nu are nevoie de Nginx sau webhook pentru prima lansare

## Director recomandat

```bash
/home/allengual-telegram-bot
```

## 1. Conectare si verificare baza serverului

```bash
ssh root@194.180.191.36
pwd
uname -a
docker --version
docker compose version
```

Daca Docker lipseste:

```bash
apt update
apt install -y ca-certificates curl gnupg git
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
chmod a+r /etc/apt/keyrings/docker.gpg
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo \"$VERSION_CODENAME\") stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null
apt update
apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
systemctl enable docker
systemctl start docker
```

## 2. Creezi director separat

```bash
mkdir -p /home/allengual-telegram-bot
cd /home/allengual-telegram-bot
```

## 3. Clone repo fara sa atingi alt bot

```bash
git clone https://github.com/AlbotCiprian/Bot_telegram_english.git .
git status
```

## 4. Creezi fisierul de productie

```bash
cp .env.vps.example .env.vps
nano .env.vps
```

Completezi:
- `TELEGRAM_BOT_TOKEN`
- `GROQ_API_KEY`
- toate valorile `KOMMO_*`

Verifica neaparat:
- `DATABASE_URL=postgresql://postgres:postgres@postgres:5432/botdb?schema=public`
- `REDIS_URL=redis://redis:6379`
- `LESSON_DELAY_MODE=prod`
- `NODE_ENV=production`

## 5. Build productie

```bash
docker compose -f docker-compose.prod.yml build
```

## 6. Aplici migratiile

```bash
docker compose -f docker-compose.prod.yml run --rm bot npm run prisma:migrate
```

## 7. Seed initial

```bash
docker compose -f docker-compose.prod.yml run --rm bot npm run prisma:seed
```

## 8. Crawl si embed

```bash
docker compose -f docker-compose.prod.yml run --rm bot npm run crawl
docker compose -f docker-compose.prod.yml run --rm bot npm run embed
```

## 9. Pornire

```bash
docker compose -f docker-compose.prod.yml up -d
```

## 10. Verificare

```bash
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml logs --tail=100 bot
docker compose -f docker-compose.prod.yml logs --tail=100 worker
curl http://127.0.0.1:3000/health
```

Trebuie sa vezi:
- `Bot Telegram pornit in polling mode.`
- `Worker-ul local a pornit.`
- `/health` cu `status=ok`

## 11. Update ulterior

```bash
cd /home/allengual-telegram-bot
git pull
docker compose -f docker-compose.prod.yml build
docker compose -f docker-compose.prod.yml run --rm bot npm run prisma:migrate
docker compose -f docker-compose.prod.yml run --rm bot npm run prisma:seed
docker compose -f docker-compose.prod.yml run --rm bot npm run crawl
docker compose -f docker-compose.prod.yml run --rm bot npm run embed
docker compose -f docker-compose.prod.yml up -d
```

## 12. Comenzi utile

Oprire:

```bash
docker compose -f docker-compose.prod.yml down
```

Restart:

```bash
docker compose -f docker-compose.prod.yml restart bot worker
```

Status containere:

```bash
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
```

Backup rapid Postgres:

```bash
docker exec allengual-postgres-prod pg_dump -U postgres botdb > /home/allengual-telegram-bot/botdb-backup.sql
```

## Observatii

- acest deploy foloseste `polling mode`, nu webhook
- pentru primul deploy pe VPS, polling este mai simplu si mai robust
- daca vrei dupa aceea webhook + Nginx + SSL, facem etapa 2 separat
