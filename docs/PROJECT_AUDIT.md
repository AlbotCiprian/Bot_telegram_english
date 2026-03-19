# Express English Academy Telegram Bot

> Client report based on the current codebase, active flows, operational tooling and deployment model.
> This document presents what is already delivered and how the system works today.

---

## 1. Executive Overview

The Telegram Bot project for Express English Academy is already operating as a compact commercial platform inside Telegram.

It is not only a menu bot. In its current form, it already combines:

- lead capture
- onboarding
- free lesson delivery
- qualification logic
- CRM routing into Kommo
- consultation escalation
- marathon sales flow
- AI support
- operational monitoring

From a business point of view, the system already creates value in three directions:

1. it captures demand directly where users interact
2. it turns educational content into structured lead qualification
3. it routes commercial intent into CRM with clear operational visibility

From a technical point of view, the project is already organized as a production-ready Telegram platform with separate runtimes, persistent state, background workers, delivery caching and monitoring controls.

Overall evaluation:

- business value: strong
- product maturity: advanced operational MVP
- engineering maturity: solid and structured
- deployment readiness: production-capable
- expansion potential: high

---

## 2. Delivered System At A Glance

### 2.1 Core business role

The system acts as a Telegram acquisition and conversion engine for Express English Academy.

It supports the full commercial chain:

- user enters the bot
- user is oriented through the main menu
- onboarding captures base profile data
- lesson and service flows qualify interest
- CRM receives structured intent
- operator and owner receive operational visibility

### 2.2 Main runtime components

| Component | Role |
|---|---|
| `bot` | Main Telegram runtime for menus, sessions, onboarding and service flows |
| `worker` | Background processing for CRM sync and scheduled jobs |
| `ops-bot` | Separate operations bot for status, logs, restarts and daily reporting |
| `postgres` | Main persistence layer for users, sessions, progress, logs and media cache |
| `redis` | Queue backend for asynchronous processing |
| `telegram-bot-api` | Local Bot API layer for efficient media delivery |

### 2.3 Code organization

| Area | Responsibility |
|---|---|
| `src/bot/` | Telegram routing, menus, callbacks and handlers |
| `src/content/` | Business copy, menu labels and marathon content builders |
| `src/services/` | CRM sync, lessons, media, sessions, AI, user and reset services |
| `src/jobs/` | Background job processors |
| `src/routes/` | HTTP status and admin endpoints |
| `src/ops/` | Monitoring aggregation and server/container inspection |
| `src/scripts/` | Local audit, smoke tests, verification and reset tooling |
| `src/db/prisma/` | Database schema, migrations and seed |

---

## 3. Technical Architecture

### 3.1 Request and processing model

The system uses a clean hybrid model:

- Telegram updates enter the `bot`
- active flow state is restored from the database
- fast user-facing actions are handled immediately
- heavier actions are sent to queues
- CRM sync and scheduled messaging are executed by the `worker`
- monitoring reads health endpoints, queue state and container state

This keeps the user experience responsive while preserving reliable background execution.

### 3.2 Persistence model

The application stores the operational state that matters for a real commercial bot:

- users
- user profiles
- bot sessions
- lesson progress
- campaign scheduling state
- CRM sync logs
- Telegram media cache

This makes flows resumable, measurable and stable across restarts.

### 3.3 Media delivery model

Media delivery is one of the strongest technical areas in the project.

The system:

- reads media from local assets
- sends large files through Local Bot API
- stores Telegram `file_id`
- reuses cached `file_id` for later sends

The result is better delivery speed and lower repeat upload cost for lesson videos and service videos.

### 3.4 Environment-driven operation

The platform already supports clean behavior separation between local and production:

- local validation and smoke testing
- VPS deployment through Docker Compose
- environment-based feature behavior
- production media path mounting
- monitoring configuration through env

This gives the project predictable deployment behavior and operational portability.

---

## 4. Delivered Product Modules

### 4.1 Welcome and Onboarding

The bot opens with a branded welcome image and a direct value proposition.

Delivered behavior:

- local-first welcome image delivery
- onboarding start from main CTA
- capture of basic identity and contact data
- session resume after onboarding
- return to the original user intention after onboarding completes

Business value:

- users are qualified early
- commercial flows stay structured
- data enters the system before deeper content is unlocked

### 4.2 Main Menu and Navigation

The main menu is already redesigned into a cleaner Telegram reply keyboard layout.

Delivered behavior:

- primary CTA on top: `🎓 3 zile gratuite`
- compact two-column arrangement for the main options
- preserved button texts and emoji identity
- clear direct access to lessons, marathon, consultation and service content

Business value:

- faster scanning on mobile
- clearer prioritization of the free lesson funnel
- stronger conversion-oriented navigation

### 4.3 3 Free Lessons Funnel

This is the educational acquisition engine of the system.

Delivered behavior:

- lesson 1 activation
- time-based unlock logic for lesson 2 and lesson 3
- progress persistence
- follow-up reminders and nudges
- lesson delivery through local video assets and Telegram media caching

Business value:

- creates real engagement before operator contact
- builds trust through free value
- increases qualification quality before CRM escalation

### 4.4 Lesson Delivery and Media Cache

The lesson/media subsystem is already optimized for Telegram delivery.

Delivered behavior:

- video asset lookup from `video/`
- first send through Local Bot API
- cached reuse through `telegram_file_id`
- shared media strategy for lessons and method video

Business value:

- more stable lesson delivery
- faster repeated sends
- better user experience during educational flows

### 4.5 Marathon Flow

The marathon flow has already evolved into a dedicated sales micro-flow.

Delivered behavior:

- `🚀 Maraton Engleza` entry point
- package selection
- date selection
- date-based price presentation
- direct contact action from package offer
- CRM routing prepared for dedicated marathon intent

The flow is now button-driven and compact, replacing the old long-text approach.

Business value:

- better package comprehension
- lower friction for price discovery
- more structured commercial intent for the marathon offer

### 4.6 Contact Operator Flow

The urgent operator flow is already optimized for speed.

Delivered behavior:

- direct reason selection
- immediate CRM routing when phone is already known
- only one extra phone step when the phone is not yet saved
- delivery into urgent consultation stage

Business value:

- fast escalation for hot leads
- less user friction
- better prioritization for the commercial team

### 4.7 Career Consultation Flow

The career consultation flow follows the same low-friction model with separate CRM routing.

Delivered behavior:

- reason selection
- immediate submission when phone is already present
- phone capture only when required
- dedicated CRM stage for consultation intent

Business value:

- separates general urgency from career consultation intent
- improves CRM clarity
- keeps the flow commercial and simple

### 4.8 CRM Synchronization

CRM integration is real, asynchronous and operational.

Delivered behavior:

- lead creation
- lead qualification
- consultation requests
- urgent requests
- marathon interest routing
- CRM sync logs with status tracking

Business value:

- Telegram interactions become structured commercial records
- different lead intents are routed into different operational stages
- sync visibility exists for owner and operations

### 4.9 AI Assistant Layer

The project includes an AI service layer for conversational support.

Delivered behavior:

- provider-based AI abstraction
- Groq integration
- controlled prompt strategy
- AI handler separated from the core educational and CRM logic

Business value:

- opens room for assisted Q&A and support use cases
- keeps the architecture flexible for future conversational expansion

### 4.10 Ops Bot and Monitoring

The system includes a dedicated owner/operator bot for control and visibility.

Delivered behavior:

- password-protected access
- help menu
- status command
- queue inspection
- job inspection
- bot and worker log access
- restart command
- daily report at configured hour
- critical alerting and recovery messages

Business value:

- faster reaction to incidents
- owner visibility without direct VPS login for every check
- operational confidence for live usage

---

## 5. Business Logic and Functional Flows

### 5.1 Lead acquisition flow

Current step-by-step logic:

1. user enters bot
2. user sees clear main menu
3. onboarding captures essential data
4. user is returned to the selected business flow
5. CRM lead is created and enriched through usage

Commercial effect:

- demand is captured early
- lead data quality is stronger than a simple click-only bot

### 5.2 Education-to-conversion flow

Current logic:

1. user starts `3 zile gratuite`
2. lesson 1 is delivered
3. reminders and unlocks keep the campaign active
4. lesson usage builds qualification
5. user can escalate into operator or consultation flows

Commercial effect:

- the educational funnel warms the lead before human contact
- the bot creates value before asking for a sales action

### 5.3 High-intent consultation flow

Current logic:

1. user taps `⚡ Contact operator` or `🔮 Consultatie cariera`
2. user selects reason
3. phone is reused if already present, or captured once if not yet saved
4. CRM request is created immediately
5. lead is routed to the correct commercial stage

Commercial effect:

- intent is captured at the right moment
- operator actions are prioritized correctly in Kommo

### 5.4 Marathon sales flow

Current logic:

1. user opens `🚀 Maraton Engleza`
2. user chooses a package
3. user chooses a start date
4. bot shows the exact offer for that package/date
5. user taps contact for that package
6. CRM receives marathon interest context

Commercial effect:

- the user sees a structured offer instead of a large block of text
- package choice and price intent become explicit

### 5.5 Operational control flow

Current logic:

1. operator or owner opens `ops-bot`
2. password is validated
3. help menu and commands become available
4. status, logs, queues and restart actions are accessible
5. daily report and alerts provide operational awareness

Commercial effect:

- less blind operation
- faster support and intervention when needed

---

## 6. CRM and Commercial Operations

### 6.1 CRM model in practice

The CRM layer is not only connected. It is already part of the product logic.

Kommo is used as the commercial record for:

- new Telegram leads
- education-based qualification
- urgent operator requests
- career consultation requests
- marathon commercial interest
- post-sales progression

This means Telegram activity is already translated into visible sales operations.

### 6.2 Telegram-specific Kommo pipeline

The bot works with a dedicated Telegram pipeline model in Kommo.

The operational stage logic already covers the full commercial journey:

- `New Telegram Lead`
  - entry point after structured onboarding
- `3 Free Lessons Started`
  - user has entered the educational funnel
- `Warm Lead`
  - engagement has progressed and the lead is more qualified
- `Consultation Requested Urgent`
  - high-intent contact request that needs fast operator attention
- `Consultation Requested`
  - consultation request with a more standard commercial path
- `Maraton Interested`
  - dedicated commercial interest for the marathon offer
- `Enrolled`
  - closed commercial success / active customer
- `Lost / No Response`
  - commercial closure after follow-up cycle

This pipeline structure gives the owner and sales team a clear operational map of where every Telegram lead stands.

### 6.3 How leads are created and enriched

The lead lifecycle is already structured from first touch:

1. user enters the bot and starts a qualified flow
2. onboarding captures the base profile
3. the application creates or updates the Kommo lead
4. lesson progression and service choices enrich lead context
5. high-intent actions move the lead into dedicated commercial stages

This creates continuity between product usage and sales execution.

### 6.4 How stage movement works

The bot already moves leads based on real user behavior:

- onboarding and initial qualification support `New Telegram Lead`
- starting the free lesson program supports `3 Free Lessons Started`
- active educational engagement supports `Warm Lead`
- `Contact operator` routes to `Consultation Requested Urgent`
- `Consultatie cariera` routes to `Consultation Requested`
- `Maraton Engleza` contact action routes to `Maraton Interested`
- post-sale handling can move the lead to `Enrolled`

This makes the CRM layer behavior-based, not manually dependent for every step.

### 6.5 CRM data passed from the bot

The bot already sends meaningful data into CRM, including:

- Telegram ID
- Telegram username
- first name / profile identity
- phone number
- English level
- goal
- current lesson
- lead source
- last activity

For commercial request flows, the note layer also adds intent-specific context:

- selected service type
- selected reason
- consultation context
- marathon package
- marathon date
- marathon price

This gives the commercial team a ready-to-use context before any manual outreach.

### 6.6 CRM logging and operational visibility

CRM synchronization is already backed by internal logging.

The system stores sync outcomes for actions such as:

- lead creation
- lead qualification
- consultation request
- marathon interest request

That gives operations and technical teams a reliable visibility layer for CRM execution, beyond what is visible only in the Kommo interface.

### 6.7 Monetization logic already delivered

The CRM model supports multiple revenue paths inside the same system:

- free lesson entry to paid conversion
- urgent operator-assisted conversion
- career consultation conversion
- marathon package conversion

This is already a commercially mature structure for a Telegram-first education product.

---

## 7. UX and Interaction Design

### 7.1 Telegram-first interaction style

The system is designed as a Telegram-native experience:

- reply keyboard for primary navigation
- inline keyboard where structured choices matter
- short forms
- limited text burden on the user

### 7.2 Delivered UX strengths

- clear main menu hierarchy
- compact mobile-friendly layout
- direct consultation flows
- package/date selection for marathon
- persistent session resume
- clear operator escalation points

### 7.3 Branded experience

The bot already includes:

- welcome image
- consistent emoji-led navigation
- branded educational and commercial flows

This gives the product a recognizable identity instead of a generic bot feel.

---

## 8. DevOps and Infrastructure

### 8.1 Deployment model

The project is already prepared for VPS deployment through Docker Compose.

Delivered production model:

- dedicated production Dockerfile
- service separation by runtime role
- env-driven production configuration
- local Bot API container
- mounted media assets

### 8.2 Environment strategy

The project already distinguishes local and production operation through dedicated env files and runtime settings.

Key operational areas controlled by env:

- Telegram runtime mode
- Bot API routing
- CRM stage IDs
- monitoring behavior
- marathon visibility and pricing
- media paths

### 8.3 Operational scripts

The project includes real operational tooling:

- Kommo verification
- local audit readiness
- CRM smoke testing
- Telegram verification
- reset state tooling

This is a strong sign of delivery maturity and makes rollout safer.

---

## 9. Monitoring and Observability

### 9.1 Monitoring already delivered

The observability layer is already meaningful for a Telegram product of this size.

Delivered capabilities:

- `/health`
- `/admin/stats`
- `/admin/jobs`
- queue visibility
- Docker container visibility
- ops-bot command interface
- daily report
- critical alerting
- recovery alerting

### 9.2 Daily operational visibility

The system already supports a daily report at the configured hour with:

- global health state
- container state
- user and form metrics
- lesson metrics
- CRM metrics
- queue backlog summary
- media cache count

### 9.3 Owner value

This means the owner/operator can monitor the commercial system from Telegram without needing direct server access for routine checks.

---

## 10. Data, Metrics and Visibility

### 10.1 Data already captured

The system already records a rich operational dataset:

- user identity
- phone-based onboarding completion
- lesson progress
- session state
- campaign timing
- CRM sync outcomes
- consultation counts
- marathon interest counts
- media cache state

### 10.2 Admin visibility

The current admin and monitoring endpoints already expose useful operational numbers for daily use.

This gives a strong base for:

- owner reporting
- sales oversight
- campaign performance review
- support diagnostics

---

## 11. Security and Control

### 11.1 Access control already in place

The project already applies control boundaries where they matter operationally:

- ops-bot uses allowed user IDs
- ops-bot requires password authentication
- login attempts are limited
- dangerous commands are feature-flagged
- production services are intended to run inside Compose network boundaries

### 11.2 Integration control

External integrations are already centralized through configuration:

- Telegram tokens
- Kommo access token
- AI provider key
- monitoring settings

This keeps the codebase clean and environment-driven.

---

## 12. Growth and Expansion Layer

The current foundation already supports a strong next phase of growth.

Natural expansion directions from the existing codebase are:

- richer business dashboards on top of current logs and stats
- deeper lesson assessment flows
- broader campaign orchestration
- more CRM automation per lead intent
- extended AI use cases for guidance and Q&A

These are expansion layers on top of an already functional operational base.

---

## 13. Final Client Summary

Express English Academy already has a real Telegram business platform in place.

Today, the system already delivers:

- branded entry into the product
- structured onboarding
- free lesson funnel
- media delivery optimization
- consultation routing
- marathon commercial flow
- Kommo integration
- owner monitoring through a separate ops bot
- local and production deployment model

From a client perspective, this means:

- leads are captured in a structured way
- user intent is qualified through content and actions
- commercial requests are routed clearly into CRM
- owner and operator visibility already exist
- the system is ready to be operated as a live acquisition and conversion channel

In practical terms, the bot is already functioning as a compact sales, education and monitoring system inside Telegram, with a technical foundation that is well prepared for ongoing business growth.
