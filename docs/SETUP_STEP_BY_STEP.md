# Setup Step by Step

## 0. Important

- Nu mai folosi cheia DeepSeek pe care ai lipit-o in chat. Consider-o compromisa.
- Revoc-o din platforma DeepSeek daca vrei sa pastrezi acel provider.
- Nu pune secrete in Git.
- Pentru varianta gratuita recomandata aici, foloseste `Groq` si lasa `DeepSeek` gol.

## 1. Completeaza `.env.local`

Campurile proiectului sunt definite in [src/utils/config.ts](c:/Users/user/Desktop/Projects/Bot_telegram_Victoria/src/utils/config.ts).

Minimul pentru pornire locala cu provider AI gratuit:

```env
NODE_ENV=development
APP_PORT=3000
APP_HOST=0.0.0.0
TELEGRAM_BOT_TOKEN=
AI_PROVIDER=groq
AI_API_KEY=
AI_MODEL=
GROQ_API_KEY=
GROQ_MODEL=llama-3.1-8b-instant
OPENROUTER_API_KEY=
OPENROUTER_MODEL=openrouter/auto
DEEPSEEK_API_KEY=
DEEPSEEK_MODEL=deepseek-chat
DATABASE_URL=postgresql://postgres:postgres@localhost:55432/botdb?schema=public
REDIS_URL=redis://localhost:6379
KOMMO_SUBDOMAIN=allengualmd
KOMMO_TOKEN=
KOMMO_PIPELINE_ID=
KOMMO_STAGE_NEW_ID=
KOMMO_STAGE_WARM_ID=
KOMMO_STAGE_CONSULT_ID=
KOMMO_CUSTOM_FIELD_TELEGRAM_ID=
KOMMO_CUSTOM_FIELD_TELEGRAM_USERNAME=
KOMMO_CUSTOM_FIELD_ENGLISH_LEVEL=
KOMMO_CUSTOM_FIELD_GOAL=
KOMMO_CUSTOM_FIELD_CURRENT_LESSON=
KOMMO_CUSTOM_FIELD_SOURCE=
KOMMO_CUSTOM_FIELD_LAST_ACTIVITY=
LESSON_DELAY_MODE=dev
WEBSITE_SOURCE_URL=https://www.expres.allengual.md/
EMBEDDING_DIMENSION=384
LOG_LEVEL=info
```

## 2. AI gratuit recomandat: Groq

Surse oficiale:

- https://console.groq.com/docs/overview
- https://console.groq.com/docs/models
- https://console.groq.com/docs/rate-limits

De ce e potrivit aici:

- are free plan oficial pentru dezvoltare
- endpoint-ul este compatibil cu stilul OpenAI
- schimbarea in bot este mica si deja este implementata in cod

Pasii:

1. Intra in Groq Console.
2. Creeaza un API key nou.
3. Pune in `.env.local`:

```env
AI_PROVIDER=groq
GROQ_API_KEY=cheia_ta_noua
GROQ_MODEL=llama-3.1-8b-instant
```

4. Ruleaza:

```powershell
npm run verify:ai
```

Rezultat asteptat:

- `AI provider OK`
- `provider=groq`

## 3. Alternative daca nu vrei Groq

### 3.1. DeepSeek

Surse oficiale:

- https://api-docs.deepseek.com/
- https://api-docs.deepseek.com/api/create-chat-completion/

Pune:

```env
AI_PROVIDER=deepseek
DEEPSEEK_API_KEY=
DEEPSEEK_MODEL=deepseek-chat
```

### 3.2. OpenRouter

Surse oficiale:

- https://openrouter.ai/docs/quickstart
- https://openrouter.ai/docs/features/models

Pune:

```env
AI_PROVIDER=openrouter
OPENROUTER_API_KEY=
OPENROUTER_MODEL=openrouter/auto
```

Observatie:

- OpenRouter are si modele gratuite, dar disponibilitatea poate varia.
- Pentru botul tau local-first, Groq este varianta mai stabila.

## 4. Telegram Bot Token

Surse oficiale:

- https://core.telegram.org/bots
- https://core.telegram.org/bots/tutorial
- https://core.telegram.org/bots/api

Pasii:

1. In Telegram, deschide `@BotFather`.
2. Ruleaza `/newbot`.
3. Pune numele botului.
4. Pune username-ul botului, de exemplu `allengual_english_bot`.
5. Copiaza tokenul primit.
6. Pune-l in `TELEGRAM_BOT_TOKEN`.
7. Ruleaza:

```powershell
npm run verify:telegram
```

Rezultat asteptat:

- `Telegram OK`
- username-ul botului
- daca vezi `webhook_url=...`, sterge webhook-ul fiindca proiectul local merge in polling mode

## 5. Kommo Private Integration

Surse oficiale:

- https://developers.kommo.com/docs/private-integration
- https://developers.kommo.com/docs/long-lived-token
- https://developers.kommo.com/reference/complex-leads
- https://developers.kommo.com/reference/custom-field-by-entity
- https://developers.kommo.com/reference/account-parameters

Ce foloseste codul:

- `Bearer` token pe `https://allengualmd.kommo.com/api/v4`
- creare lead prin `/leads/complex`
- update lead prin `/leads`
- note prin `/leads/notes`

Vezi [src/services/crmService.ts](c:/Users/user/Desktop/Projects/Bot_telegram_Victoria/src/services/crmService.ts).

### 5.1. Cum completezi ecranul din screenshot

In fereastra `Create integration`:

- `Redirect URL`: lasa gol
- `Access revoked notification web hook`: lasa gol
- `Integration with custom code`: lasa activ daca asta este optiunea implicita
- `Duplicate control`: debifat
- `Multiple sources`: debifat
- `Language`: poti lasa rusa sau schimba in engleza
- `Integration name`: `Allengual Telegram Bot`
- `Description`: `Private integration for the local-first Telegram bot that creates and updates leads in Kommo.`
- `Upload 400x272`: optional, poti pune logo-ul scolii

### 5.2. Dupa Save

1. Deschide tab-ul `Keys and scopes`.
2. Apasa `Generate long-lived token`.
3. Alege expirarea.
4. Copiaza tokenul imediat. Kommo nu il mai arata complet din nou.
5. Pune-l in `KOMMO_TOKEN`.

### 5.3. Ce pipeline sa creezi in Kommo

Creeaza pipeline-ul:

- `Telegram Bot Leads`

Stages:

- `New Telegram Lead`
- `3 Free Lessons Started`
- `Warm Lead`
- `Consultation Requested`
- `Enrolled`
- `Lost / No Response`

### 5.4. Ce custom fields sa creezi

Pe `Contacts`:

- `Telegram ID`
- `Telegram Username`
- `English Level`
- `Goal`

Pe `Leads`:

- `Current Lesson`
- `Source`
- `Last Activity`

Nu trebuie sa creezi `PHONE` si `EMAIL`; acestea exista deja si codul le foloseste prin `field_code`.

### 5.5. Cum afli ID-urile pentru `.env.local`

Dupa ce ai creat pipeline-ul si custom fields:

```powershell
npm run verify:kommo
```

Scriptul iti afiseaza:

- `KOMMO_PIPELINE_ID`
- `KOMMO_STAGE_NEW_ID`
- `KOMMO_STAGE_WARM_ID`
- `KOMMO_STAGE_CONSULT_ID`
- campurile custom pentru contacts si leads

## 6. OpenClaw

Surse oficiale:

- https://docs.openclaw.ai/gateway/authentication
- https://docs.openclaw.ai/channels/telegram

Pentru proiectul asta, OpenClaw nu este necesar acum.

OpenClaw este mai degraba gateway/orchestration layer, nu providerul gratuit recomandat pentru MVP.

Codul curent foloseste provider AI configurabil, vezi [src/services/aiService.ts](c:/Users/user/Desktop/Projects/Bot_telegram_Victoria/src/services/aiService.ts) si [src/services/aiProvider.ts](c:/Users/user/Desktop/Projects/Bot_telegram_Victoria/src/services/aiProvider.ts).

## 7. Pornirea proiectului

```powershell
docker compose up -d postgres redis
npm install
npm run prisma:generate
npm run prisma:migrate
npm run prisma:seed
npm run dev
```

In alt terminal:

```powershell
npm run worker
```

Verificari:

```powershell
Invoke-WebRequest -UseBasicParsing http://localhost:3000/health
Invoke-WebRequest -UseBasicParsing http://localhost:3000/admin/stats
Invoke-WebRequest -UseBasicParsing http://localhost:3000/admin/jobs
```

## 8. Ordinea corecta de lucru

1. Pune `AI_PROVIDER=groq` si cheia Groq, apoi ruleaza `npm run verify:ai`.
2. Creeaza botul in BotFather si ruleaza `npm run verify:telegram`.
3. Creeaza integrarea privata in Kommo.
4. Genereaza long-lived token.
5. Creeaza pipeline-ul si custom fields.
6. Ruleaza `npm run verify:kommo`.
7. Completeaza `.env.local` cu ID-urile gasite.
8. Porneste botul si testeaza `/start`.
