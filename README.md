# Express English Academy Bot

Bot Telegram local-first pentru Express English Academy.

## Stack

- Node.js + TypeScript
- Fastify + Telegraf
- PostgreSQL + pgvector
- Redis + BullMQ
- Prisma
- Docker Compose
- Groq free tier sau DeepSeek/OpenRouter pentru raspunsul final AI

## Start rapid

1. Copiaza `.env.example` in `.env.local` si completeaza cheile.
2. Ruleaza `docker compose up -d postgres redis`.
3. Ruleaza `npm install`.
4. Ruleaza `npm run prisma:generate`.
5. Ruleaza `npm run prisma:migrate`.
5. Ruleaza `npm run prisma:seed`.
6. Ruleaza `npm run dev`.
7. Intr-un al doilea terminal ruleaza `npm run worker`.

## Scripturi

- `npm run dev`
- `npm run worker`
- `npm run start:ops-bot`
- `npm run prisma:migrate`
- `npm run prisma:seed`
- `npm run crawl`
- `npm run embed`
- `npm run telegram:logout-cloud`
- `npm run reset:bot-state`
- `npm run test:e2e-local`
- `npm run verify:ai`
- `npm run audit:local`
- `npm run smoke:crm`

## Documentatie

- [Testare locala](./docs/LOCAL_TESTING.md)
- [Setup step by step](./docs/SETUP_STEP_BY_STEP.md)
- [Deploy pe VPS](./docs/DEPLOY_VPS.md)

## Productie

Pentru VPS foloseste:

- `Dockerfile.prod`
- `docker-compose.prod.yml`
- `.env.vps.example` -> copie in `.env.vps`
- `Local Bot API Server` in acelasi compose pentru video mari
- `ops-bot` separat pentru monitoring, alerte si restart controlat
