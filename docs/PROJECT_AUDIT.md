# Express English Academy Bot Audit

> Document principal pentru audit, handoff si export PDF.
> Structura este impartita in doua module mari:
> 1. modul tehnic / development / operations
> 2. modul owner / business / functionalitati

## Snapshot

**Produs:** Express English Academy Telegram Bot  
**Canal principal:** Telegram  
**CRM:** Kommo  
**Runtime:** local-first, Docker based, cu medii separate pentru local si VPS production  
**Componente majore:** `bot`, `worker`, `ops-bot`, `postgres`, `redis`, `telegram-bot-api`

---

## Modul 1. Technical / Dev / Ops

### 1.1 Scop tehnic

Proiectul este un bot Telegram construit pentru:

- onboarding rapid al lead-urilor
- livrare automata a seriei gratuite de 3 lectii
- integrare operationala cu Kommo CRM
- livrare video nativa prin Local Bot API Server
- monitoring separat printr-un `ops-bot`
- administrare usoara pe VPS prin Docker Compose

### 1.2 Stack tehnic

| Zona | Tehnologie |
|---|---|
| Runtime backend | Node.js + TypeScript |
| HTTP/API intern | Fastify |
| Telegram bot | Telegraf |
| ORM / DB access | Prisma |
| Database | PostgreSQL + `pgvector` |
| Queue / background jobs | Redis + BullMQ |
| AI / knowledge answers | Groq, optional OpenRouter / DeepSeek |
| Containerizare | Docker Compose |
| Monitoring operare | `ops-bot` dedicat |
| Video delivery mare | `telegram-bot-api` local in acelasi compose |

### 1.3 Arhitectura runtime

#### `bot`

Responsabilitati:

- porneste botul Telegram in polling mode
- ruleaza meniurile si flow-urile conversationale
- gestioneaza onboarding, servicii, maraton, consultatii
- expune endpointurile HTTP:
  - `/health`
  - `/admin/stats`
  - `/admin/jobs`

#### `worker`

Responsabilitati:

- proceseaza queue-ul de campanii
- proceseaza queue-ul CRM
- executa:
  - unlock automat lectii
  - remindere
  - sync CRM

#### `ops-bot`

Responsabilitati:

- monitoring operational separat de botul principal
- autentificare cu parola
- comenzi de status / health / queues / jobs / logs / restart
- daily report la ora configurata
- alerte automate la incidente

#### `postgres`

Contine:

- users
- profiles
- sessions
- campaign state
- lesson progress
- scheduled jobs tracking
- CRM sync logs
- media cache (`telegram_file_id`)
- event logs
- document chunks / embeddings

#### `redis`

Contine:

- queue-uri BullMQ
- starea de executie pentru joburi

#### `telegram-bot-api`

Rol:

- permite upload si redare pentru fisiere video mari
- elimina limitarile practice ale cloud Bot API pentru anumite fisiere locale
- este critic pentru livrarea lectiilor video in productie

### 1.4 Structura de cod

| Zona | Rol |
|---|---|
| `src/bot/` | meniu, router, handlers Telegram |
| `src/content/` | continut static si configurat din env |
| `src/services/` | servicii CRM, media, lectii, sesiuni, queue, user |
| `src/jobs/` | procesatori de joburi worker |
| `src/routes/` | health, stats, jobs |
| `src/ops/` | logic de monitoring si Docker status |
| `src/scripts/` | audit, smoke tests, verify scripts, reset |
| `src/db/prisma/` | schema, seed, migrari |

### 1.5 Model de date principal

| Model | Rol |
|---|---|
| `User` | identitatea Telegram si starea principala a leadului |
| `UserProfile` | date business/comerciale si preferinte |
| `BotSession` | flow conversational in lucru |
| `Campaign` | campanii precum seria gratuita |
| `Lesson` | lectiile seed-uite |
| `UserCampaign` | progres pe campanie |
| `LessonProgress` | video, quiz, open state |
| `ScheduledJob` | tracking operational al joburilor |
| `CrmSyncLog` | istoric requesturi CRM |
| `TelegramMediaAsset` | cache local `file_id` Telegram |
| `Document` | chunks + embedding pentru AI |
| `UserEvent` | audit intern de interactiuni |

### 1.6 Flow-uri tehnice principale

#### A. Onboarding lead

1. user intra pe `/start`
2. daca nu este onboarded, se cere:
   - nume
   - telefon
   - accept
3. se salveaza in DB
4. se creeaza lead in Kommo
5. se deschide flow-ul cerut initial

#### B. Seria gratuita de 3 lectii

1. activarea seteaza:
   - `lesson1Unlocked=true`
   - unlock time pentru lectia 2 si 3
2. worker-ul trimite unlock-uri la 24h si 48h
3. se trimit remindere daca userul nu revine
4. la final, flow-ul comercial este deschis din buton

#### C. Livrare video

1. botul cauta fisierul local in `video/`
2. la prima livrare incearca upload prin Local Bot API
3. salveaza `telegram_file_id`
4. la urmatoarele livrari refoloseste `file_id`
5. daca fisierul lipseste sau upload-ul esueaza, trimite fallback clar

#### D. Consultatii CRM

Sunt doua fluxuri principale:

- `Contact operator` -> prioritate `urgent_contact`
- `Consultatie cariera` -> prioritate `consultation`

Fluxul actual este optimizat:

- daca telefonul exista, userul selecteaza motivul si cererea merge direct in CRM
- daca telefonul lipseste, se cere doar telefonul si apoi cererea merge direct

#### E. Maraton Engleza

Flow nou, compact:

1. user apasa `🚀 Maraton Engleza`
2. alege pachetul
3. vede datele disponibile pentru acel pachet
4. alege data
5. vede oferta exacta si apasa contact
6. cererea ajunge in CRM pe stage dedicat atunci cand `KOMMO_STAGE_MARATON_ID` este configurat

#### F. Monitoring

`ops-bot` poate:

- autentifica doar userii permisi
- cere parola
- bloca dupa 3 incercari
- oferi status operational
- trimite daily report
- semnala incidente si recovery

### 1.7 Integrarea cu Kommo

Pipeline folosit:

- `Telegram Bot Leads`

Stage-uri automatizate de cod:

- `New Telegram Lead`
- `Warm Lead`
- `Consultation Requested Urgent`
- `Consultation Requested`
- `Maraton Interested` (cand exista si este setat in env)

Detalii importante:

- lead nou se creeaza la onboarding complet nou
- daca exista deja lead/link Kommo, sistemul actualizeaza lead-ul existent
- fiecare operatie este logata in `crm_sync_logs`

### 1.8 Integrarea AI

Proiectul include infrastructura pentru raspuns AI:

- crawler website
- embedding pipeline
- document store in Postgres (`pgvector`)

Scripturi:

- `npm run crawl`
- `npm run embed`

Observatie:

- AI-ul este infrastructura secundara fata de flow-ul comercial principal
- poate fi extins ulterior pentru FAQ sau suport contextual

### 1.9 Monitoring si administrare

Endpointuri HTTP:

- `/health`
- `/admin/stats`
- `/admin/jobs`

Comenzi `ops-bot`:

- `/status`
- `/health`
- `/queues`
- `/jobs`
- `/logs_bot`
- `/logs_worker`
- `/restart_express`
- `/daily_now`
- `/reset_state CONFIRM` daca mediul permite comenzi destructive

Metrici urmarite:

- users
- formsCompleted
- lessonsSent
- crmSuccess
- crmFailed
- urgentRequests
- consultRequests
- marathonRequests
- mediaCache
- queue backlog

### 1.10 Environment si configurare

#### Local

Fisiere / componente:

- `.env.local`
- `docker-compose.yml`
- `npm run dev`
- `npm run worker`
- `npm run ops-bot`

#### Production / VPS

Fisiere / componente:

- `.env.vps`
- `docker-compose.prod.yml`
- `Dockerfile.prod`

Setari cheie production:

- `NODE_ENV=production`
- `LESSON_DELAY_MODE=prod`
- `TELEGRAM_USE_LOCAL_API=true`
- `TELEGRAM_API_ROOT=http://telegram-bot-api:8081`
- `WELCOME_IMAGE_PATH=/app/video/Image_welcome.JPG`

### 1.11 Calitate, audit si testare

Scripturi importante:

- `npm run build`
- `npm run test:e2e-local`
- `npm run audit:local`
- `npm run smoke:crm`
- `npm run verify:telegram`
- `npm run verify:kommo`
- `npm run reset:bot-state`

Ce valideaza ele:

- compilare TypeScript
- invarianti locali
- configurare assets si env
- health endpoints
- integrare CRM pentru create/qualify/consult flows
- mapping stage-uri Kommo

### 1.12 Puncte deja implementate

- main menu compact, 2 coloane
- onboarding complet
- seria gratuita cu unlock si remindere
- livrare video prin Local Bot API
- cache `telegram_file_id`
- CRM urgent / consultation
- maraton pe flow scurt cu pachet + data
- welcome image din fisier local
- monitoring bot cu daily report si alerte
- deploy VPS prin compose separat

### 1.13 Limitari / observatii curente

- `KOMMO_STAGE_MARATON_ID` trebuie setat dupa ce stage-ul `Maraton Interested` apare si in API-ul Kommo
- quiz complet pentru lectiile 2 si 3 nu este finalizat; lectia 1 are quiz real
- succesul maratonului in CRM depinde de configurarea finala a stage-ului dedicat

---

## Modul 2. Owner / Business / Operational View

### 2.1 Scop business

Botul este construit ca sistem de:

- captare lead-uri din Telegram
- calificare rapida
- livrare de valoare prin lectii gratuite
- conversie catre cursuri, consultatii si maraton
- vizibilitate operationala printr-un bot separat de monitoring

### 2.2 Ce vede utilizatorul in meniu

Meniul principal actual:

- `🎓 3 zile gratuite`
- `🚀 Maraton Engleza`
- `📚 Lectiile tale`
- `🗣 Webinar: fara frica`
- `🎬 Metoda noastra`
- `💼 Programe si preturi`
- `⚡ Contact operator`
- `🔮 Consultatie cariera`

### 2.3 Flow principal pentru utilizator nou

1. user intra in bot
2. vede cardul de welcome
3. alege un serviciu
4. daca nu este onboarded, trece prin onboarding scurt
5. dupa onboarding, botul il readuce exact in flow-ul ales

Avantaj business:

- nu se pierde intentia initiala
- onboardingul nu este lung
- lead-ul intra imediat in sistemul comercial

### 2.4 Seria gratuita de 3 lectii

Ce face:

- ofera valoare imediata
- introduce userul in experienta reala
- creste sansele de conversie prin progres

Comportament:

- lectia 1 este disponibila imediat
- lectia 2 se deblocheaza dupa 24h
- lectia 3 se deblocheaza dupa 48h
- daca userul nu revine, primeste remindere

Rol business:

- lead magnet
- calificare soft
- educare si crestere a increderii

### 2.5 Maraton Engleza

Flow nou, mai comercial si mai clar:

1. user intra pe `🚀 Maraton Engleza`
2. alege un pachet:
   - Basic
   - Silver
   - Gold
   - Premium
   - VIP
3. vede doar detaliile pachetului ales
4. vede datele disponibile
5. alege data si vede pretul exact
6. apasa contact si cererea merge in CRM

Avantaj business:

- nu mai este nevoie de mesaj lung si obositor
- userul compara rapid pachet + data + pret
- conversia se face prin butoane, nu prin instructiuni manuale

### 2.6 Contact operator

Flow actual:

- daca userul are telefonul salvat:
  - alege motivul
  - leadul merge direct in CRM
- daca telefonul lipseste:
  - trimite telefonul
  - apoi leadul merge direct in CRM

Rezultat CRM:

- stage `Consultation Requested Urgent`

Rol business:

- contact rapid
- prioritizare pe leadurile calde
- mai putina frictiune conversationala

### 2.7 Consultatie cariera

Flow actual:

- identic ca structura cu `Contact operator`
- motivul se selecteaza rapid
- fara camp liber inutil

Rezultat CRM:

- stage `Consultation Requested`

Rol business:

- flux comercial separat
- intentie mai clara
- tratament diferit fata de contactul urgent

### 2.8 Webinar, metoda, programe

Aceste zone sunt de:

- incredere
- educare
- pozitionare
- pregatire pentru conversie

Rolul lor:

- `Webinar: fara frica` - scoate blocajul emotional
- `Metoda noastra` - explica felul de lucru
- `Programe si preturi` - ancoreaza oferta comerciala

### 2.9 CRM si pipeline business

Pipeline folosit:

- `Telegram Bot Leads`

Utilizare recomandata:

- `New Telegram Lead` - lead nou intrat
- `Warm Lead` - lead calificat
- `Consultation Requested Urgent` - contact operator urgent
- `Consultation Requested` - consultatie cariera
- `Maraton Interested` - interes pe maraton
- `Enrolled` - manual/comercial, dupa vanzare
- `Lost / No Response` - manual/comercial, dupa follow-up

### 2.10 Monitoring pentru owner / operare

Exista un bot separat de status care ofera:

- daily report la ora 09:00
- status rapid al sistemului
- containere pornite / oprite
- metrice de activitate
- alerte in caz de incident
- posibilitate de restart controlat

Rol business:

- reduce riscul de a afla prea tarziu ca botul a cazut
- ofera control fara login direct in server pentru fiecare verificare

### 2.11 Ce este deja implementat

- welcome image
- onboarding scurt
- meniu principal reorganizat
- seria gratuita cu unlock-uri
- CRM sync
- flow operator urgent
- flow consultatie cariera
- maraton cu selectie de pachet si data
- monitoring bot
- deploy pe VPS prin compose

### 2.12 Ce ar fi bine sa urmeze

Prioritati business recomandate:

1. finalizarea stage-ului `Maraton Interested` in Kommo
2. quiz final pentru lectiile 2 si 3
3. rafinarea textelor comerciale pe confirmari si remindere
4. dashboard business simplu pentru conversii din CRM logs

### 2.13 Rezumat pentru owner

Pe scurt, proiectul nu mai este doar un bot de meniu. In forma actuala, el functioneaza ca un mini-sistem comercial Telegram:

- capteaza leaduri
- livreaza continut gratuit
- califica interesul
- directioneaza intentia catre CRM
- monitorizeaza operational functionarea

Acest lucru inseamna ca botul poate fi folosit atat pentru marketing si vanzare, cat si pentru control operational zilnic.
