# Kommo Setup Checklist

## 1. Private integration

In `Settings -> Integrations -> Private integrations -> Create integration`:

- `Redirect URL`: leave empty
- `Access revoked notification web hook`: leave empty
- `Allow access: All`: enabled
- `Duplicate control`: disabled
- `Multiple sources`: disabled
- `Integration name`: `Allengual Telegram Bot`
- `Description`: `Private integration for the Allengual Telegram bot.`
- `Upload`: optional

After `Save`:

- open `Keys and scopes`
- generate a new `long-lived token`
- copy the token to `.env.local` as `KOMMO_TOKEN`

Do not put these in `.env.local`:

- integration secret key
- integration id

## 2. Pipeline

Create a sales pipeline named:

- `Telegram Bot Leads`

Pastram acelasi pipeline si adaugam doar un stage nou pentru urgenta, nu pipeline separat.

Add these stages:

- `New Telegram Lead`
- `3 Free Lessons Started`
- `Warm Lead`
- `Consultation Requested`
- `Consultation Requested Urgent`
- `Enrolled`
- `Lost / No Response`

Routing recomandat in bot:

- `⚡ Contact operator` -> `Consultation Requested Urgent`
- `🔮 Consultatie cariera` -> `Consultation Requested`
- `🚀 Maraton Engleza -> 💬 Cere PRET` -> `Consultation Requested Urgent`

## 3. Custom fields

Create lead fields:

- `Current Lesson` as numeric
- `Source` as text
- `Last Activity` as text
- `Telegram ID` as text
- `Telegram Username` as text
- `English Level` as text
- `Goal` as text

Optional:

- if you prefer, these four profile fields can also exist on `Contacts`
- the current bot now works with them on `Lead`, which matches the Kommo setup already created

## 4. .env.local

```env
KOMMO_SUBDOMAIN=allengualmd
KOMMO_TOKEN=
KOMMO_PIPELINE_ID=
KOMMO_STAGE_NEW_ID=
KOMMO_STAGE_WARM_ID=
KOMMO_STAGE_CONSULT_ID=
KOMMO_STAGE_URGENT_ID=
KOMMO_CUSTOM_FIELD_TELEGRAM_ID=
KOMMO_CUSTOM_FIELD_TELEGRAM_USERNAME=
KOMMO_CUSTOM_FIELD_ENGLISH_LEVEL=
KOMMO_CUSTOM_FIELD_GOAL=
KOMMO_CUSTOM_FIELD_CURRENT_LESSON=
KOMMO_CUSTOM_FIELD_SOURCE=
KOMMO_CUSTOM_FIELD_LAST_ACTIVITY=
```

## 5. Verification

Run:

```powershell
npm run verify:kommo
```

Copy the printed IDs into `.env.local`.
