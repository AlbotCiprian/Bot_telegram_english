# Testare locala pe module

## Modul 1 - Foundation

1. Copiaza `.env.example` in `.env.local`.
2. Porneste serviciile locale cu `docker compose --env-file .env.local up -d postgres redis telegram-bot-api`.
3. Instaleaza dependintele cu `npm install`.
4. Ruleaza `npm run prisma:generate`.
5. Ruleaza `npm run prisma:migrate`.
6. Ruleaza `npm run prisma:seed`.
6. Ruleaza `docker compose --env-file .env.local up -d bot worker ops-bot`.
7. Verifica `http://localhost:3000/health`.
8. Ruleaza `npm run audit:local`.

Rezultat asteptat: raspuns JSON cu `status: "ok"`.

## Modul 2 - Meniu si branding

1. Deschide botul in Telegram.
2. Ruleaza `/start`.
3. Verifica mesajul de welcome si toate butoanele principale.
4. Apasa `Website` si confirma linkul corect.

## Modul 3 - Lead capture

1. Apasa `Engleza Express - 3 zile gratuite`.
2. Completeaza formularul.
3. Verifica in baza de date `users`, `user_profiles` si `bot_sessions`.

## Modul 4 - Lecitii si remindere

1. Dupa formular trebuie sa primesti imediat lectia 1.
2. In `LESSON_DELAY_MODE=dev`, asteapta 2 minute pentru lectia 2 si 4 minute pentru lectia 3.
3. Verifica `GET /admin/jobs`.

## Modul 5 - Kommo

1. Configureaza `KOMMO_*` in `.env.local`.
2. Completeaza din nou formularul cu un user nou.
3. Verifica tabelul `crm_sync_logs`.
4. Confirma lead-ul in Kommo.
5. Optional, ruleaza `npm run smoke:crm` pentru un smoke test real de create/update/stage in Kommo.

## Modul 6 - Crawl

1. Ruleaza `npm run crawl`.
2. Verifica tabela `documents` pentru intrari `kind=page`.

## Modul 7 - AI

1. Ruleaza `npm run embed`.
2. In Telegram apasa `Pune o intrebare`.
3. Pune o intrebare despre cursuri, program sau metoda.

## Modul 8 - Vreau la curs

1. Apasa `Vreau la curs`.
2. Completeaza flow-ul scurt.
3. Verifica actualizarea lead-ului in Kommo si oprirea joburilor de nurture.

## Modul 9 - Analytics

1. Deschide `GET /admin/stats`.
2. Verifica numarul de useri, lead-uri, lectii si sync-uri CRM.

## Modul 10 - Checklist final local

1. Ruleaza `npm run test:e2e-local`.
2. Verifica din nou `GET /health`, `GET /admin/stats` si `GET /admin/jobs`.
