# Express English Academy Telegram Bot

> Deep audit report based on the current codebase, scripts, Compose stack and project documentation.
> This document is written as an audit, not as a build guide.

---

## 1. Executive Summary

This system is a production-oriented Telegram sales and delivery platform for Express English Academy, not a simple content bot.

At its current state, the product already covers the full commercial loop for Telegram:

- lead capture
- onboarding
- free lesson delivery
- qualification
- CRM routing
- operator escalation
- marathon interest collection
- operational monitoring

From an engineering perspective, the project is in the **late MVP / early production** stage:

- core business flows are implemented
- CRM integration is real and functional
- operational monitoring exists
- local and VPS deployment patterns exist
- the system has test scripts and smoke checks

From a product perspective, the system already creates business value in three ways:

1. it captures and structures demand directly in Telegram
2. it nurtures leads through a free 3-lesson campaign
3. it routes commercial intent into Kommo with different priorities

Final evaluation:

- **Business value:** high
- **Engineering maturity:** medium
- **Operational maturity:** medium
- **Scalability readiness:** medium
- **Main constraint:** configuration discipline and analytics depth, not missing core functionality

The product is functional and commercially useful today. The biggest gains now will come from reducing friction, tightening analytics, and hardening operational controls around CRM stages, monitoring, and configuration consistency.

---

## 2. System Architecture

### 2.1 Runtime topology

The production topology is composed of six active components:

| Component | Role |
|---|---|
| `bot` | Main Telegram bot runtime, menu handling, flows, HTTP status endpoints |
| `worker` | Background execution for campaigns and CRM queue processing |
| `ops-bot` | Separate Telegram operations bot for health, logs, restart and alerts |
| `postgres` | Primary system-of-record for users, sessions, progress, logs and media cache |
| `redis` | Queue backend for BullMQ |
| `telegram-bot-api` | Local Bot API runtime used for large media delivery |

### 2.2 Code structure

The codebase is split cleanly by responsibility:

| Folder | Responsibility |
|---|---|
| `src/bot/` | Telegram router, menu, handlers |
| `src/content/` | Static copy and Marathon content/config builders |
| `src/services/` | CRM, media, lessons, sessions, queue, users, AI |
| `src/jobs/` | Worker processors |
| `src/routes/` | `/health`, `/admin/stats`, `/admin/jobs`, webhook placeholder |
| `src/ops/` | Monitoring aggregation and Docker inspection |
| `src/scripts/` | Audit, verify, reset and smoke tooling |
| `src/db/prisma/` | Schema, seed and migrations |

### 2.3 Interaction model

The architecture is event-driven at the business layer:

- Telegram updates are processed synchronously by `bot`
- stateful flows are stored in `BotSession`
- background actions are deferred to BullMQ
- CRM synchronization is executed by `worker`
- monitoring reads both HTTP status and queue/database state

### 2.4 Architectural strengths

- clear separation between user-facing runtime and worker runtime
- clean operational split with a dedicated `ops-bot`
- local-first media strategy with `telegram_file_id` caching
- real persistence for flows and delivery state
- environment-based behavior for local vs production

### 2.5 Architectural weaknesses

- configuration remains heavily env-driven and manual
- no secret manager or external configuration service
- admin HTTP routes are not application-authenticated
- webhook mode is stubbed; polling mode is the only real runtime mode
- asset management is manual and depends on file discipline in `video/`

---

## 3. Technical Modules Analysis

### 3.1 Core Telegram Router

**Purpose**

`src/bot/bot.ts` is the central runtime coordinator.

**How it works**

- creates the Telegraf bot
- loads user context on each update
- routes commands, callback actions, text input and contact messages
- resumes unfinished sessions from database state
- dispatches into specialized handlers

**Strengths**

- session-aware routing is solid
- menu actions are centralized
- unfinished flows are resumed rather than discarded
- user context caching in `ctx.state` avoids duplicate user reads inside one update

**Weaknesses**

- the file is becoming the orchestration hub for many flows and will grow further
- routing logic is still string-driven, so future expansion will increase maintenance cost

**Scalability**

- acceptable for current product scope
- should be refactored toward stronger action registries if product lines expand further

### 3.2 Onboarding / Lead Capture Module

**Purpose**

Captures minimum viable contact information before opening core flows.

**How it works**

- lives mostly in `src/bot/handlers/leadHandler.ts`
- collects:
  - first name
  - phone
  - consent
- marks onboarding as completed
- triggers lead creation and free lesson campaign handoff

**Strengths**

- short flow
- strong business gating
- preserves first requested service so the bot can return the user to the original intent

**Weaknesses**

- onboarding is mandatory for most useful actions, which improves capture but adds friction
- consent is effectively binary and tied to progress; not ideal if legal/compliance scope grows

**Scalability**

- good enough for a single-offer business
- will need versioned form schema if lead data requirements evolve

### 3.3 Free Lessons Campaign Module

**Purpose**

Implements the 3-day free lesson funnel.

**How it works**

- lesson unlock state is stored per user
- lesson 1 is activated immediately
- lesson 2 and 3 unlock on timed schedule
- worker sends unlocks and nudges
- lesson progress is tracked in `LessonProgress`

**Strengths**

- real persistence, not in-memory timers
- clean separation between activation and delivery
- unlock/nudge logic is explicit and inspectable

**Weaknesses**

- the business timeline is fixed in code/env, not campaign-configurable per cohort
- lesson quiz support is still partial: lesson 1 has real quiz, lessons 2 and 3 are placeholders

**Scalability**

- works well for one compact campaign
- not yet a generalized campaign engine for multiple complex funnels

### 3.4 Lesson Delivery + Media Cache Module

**Purpose**

Deliver video lessons and service videos efficiently in Telegram.

**How it works**

- resolves files from local `video/`
- uploads via Local Bot API
- persists Telegram `file_id` in `TelegramMediaAsset`
- reuses `file_id` on later sends

**Strengths**

- this is one of the strongest parts of the system
- solves a real Telegram media pain point
- avoids repeated heavy uploads

**Weaknesses**

- relies on manual file presence and naming discipline
- no transcoding or validation pipeline for assets
- no checksum-based operator tooling for missing/wrong media

**Scalability**

- strong for current use case
- would benefit from an asset manifest and validation tool if content volume increases

### 3.5 Consultation Flow Module

**Purpose**

Handle fast commercial conversion for operator contact and career consultation.

**How it works**

- implemented in `consultationHandler.ts`
- if phone exists:
  - user selects reason
  - CRM request is created immediately
- if phone is missing:
  - bot asks only for phone
  - then completes request

**Strengths**

- intentionally low-friction
- clean split between urgent and non-urgent intent
- schedules CRM work asynchronously

**Weaknesses**

- note structure is informative but still text-based, not normalized for reporting
- no SLA timer or auto-reassignment mechanism exists at app level

**Scalability**

- solid for current sales motion
- should eventually produce more structured CRM metadata for analytics

### 3.6 Marathon Flow Module

**Purpose**

Turn Marathon interest into a compact, conversion-oriented selection flow.

**How it works**

- implemented in `marathonHandler.ts` and `marathonContent.ts`
- flow is:
  - package selection
  - date selection
  - exact offer screen
  - contact
- phone is requested only if missing
- CRM action is `request_marathon_interest`

**Strengths**

- much better than a long static information dump
- package/date/price logic is configurable via env
- flow is compact and button-driven

**Weaknesses**

- stage routing is operationally incomplete until `KOMMO_STAGE_MARATON_ID` is configured
- old and new marathon env keys coexist, creating configuration drift risk
- the static long marathon body still exists in `staticContent.ts`, even though the live flow is now separate

**Scalability**

- good for a few cohorts and packages
- should eventually move from env strings to a structured offer model if commercial complexity grows

### 3.7 CRM Sync Module

**Purpose**

Translate bot intent into Kommo lead creation and stage movement.

**How it works**

- `crmService.ts` owns lead creation, qualification and consultation updates
- worker consumes CRM jobs from queue
- all actions are logged in `crm_sync_logs`

**Strengths**

- asynchronous CRM sync protects UX from CRM latency
- success/failure is auditable
- stage mapping is explicit

**Weaknesses**

- depends heavily on exact stage IDs and env correctness
- fallback behavior can hide incomplete business setup
- note payloads are free text, not analytics-first

**Scalability**

- good for the current number of stages and flows
- would benefit from a stage registry + validation script at deploy time

### 3.8 AI Assistant Module

**Purpose**

Answer informational questions about courses and offers based on internal knowledge.

**How it works**

- `aiService.ts` retrieves relevant documents from vector search
- enriches context with curated static pages for pricing and school overview
- calls Groq/OpenRouter/DeepSeek depending on config
- falls back to safe answers if context is weak or AI is unavailable

**Strengths**

- restrained prompt policy reduces hallucination risk
- fallback path exists
- sources are shown to the user

**Weaknesses**

- AI is not yet integrated into the commercial funnel as a conversion surface
- quality depends on crawl/embed freshness
- pricing knowledge partly comes from static pages, not a single source of truth

**Scalability**

- technically extendable
- commercially underused today

### 3.9 Monitoring / Ops Module

**Purpose**

Provide operational visibility without logging into the server for every check.

**How it works**

- separate Telegram bot in `src/opsBot.ts`
- authenticates by allowed user ID + password
- reads health endpoints, job stats, queue stats and Docker container state
- sends daily report and incident/recovery alerts

**Strengths**

- strong operational idea for a small system
- daily report is valuable for owner visibility
- restart action covers the most common intervention case

**Weaknesses**

- auth state is in-memory only
- no audit trail for ops commands
- no persistent incident history or escalation policy

**Scalability**

- strong for a founder-led operation
- limited for multi-operator or compliance-sensitive ops

---

## 4. Business Logic & Functional Flows

### 4.1 Lead Capture Flow

**Actual logic**

1. user enters bot
2. selects service
3. onboarding is triggered if lead is incomplete
4. name, phone and consent are collected
5. lead is created in CRM
6. bot returns user to original requested flow

**Assessment**

- conversion quality is high because intent is preserved
- friction is medium because information access is gated behind contact capture

**Commercial impact**

- good for lead ownership
- weaker for users who want to inspect before committing a phone number

### 4.2 Qualification Flow

**Actual logic**

1. user enters `Vreau la curs`
2. bot collects:
   - level
   - goal
   - available time
   - desire to be contacted
3. CRM lead is qualified and moved/noted

**Assessment**

- qualification is useful and commercially meaningful
- it creates better downstream context for sales

**Friction**

- acceptable
- could still be shortened for high-intent users

### 4.3 Conversion Flow: Contact Operator

**Actual logic**

1. user opens operator flow
2. selects reason
3. if phone missing, sends phone
4. lead is moved into `Consultation Requested Urgent`

**Assessment**

- very strong conversion pattern
- low friction
- high operational clarity

**Commercial quality**

- high
- this is one of the most monetization-ready parts of the system

### 4.4 Conversion Flow: Career Consultation

**Actual logic**

1. user opens career consultation
2. selects reason
3. if needed, sends phone
4. lead is moved into `Consultation Requested`

**Assessment**

- clean parallel flow to operator contact
- good split between urgent and consultative intent

**Commercial quality**

- high
- proper separation of urgency helps prioritization

### 4.5 Nurture Flow: 3 Free Lessons

**Actual logic**

- progressive unlock
- reminder logic
- eventual CTA back into paid offer

**Assessment**

- strategically correct
- combines value delivery with sales intent

**Main gap**

- campaign analytics are still shallow compared to the importance of this funnel

### 4.6 Marathon Flow

**Actual logic**

- package -> date -> contact
- no forced long text
- lead intent is specific and commercially structured

**Assessment**

- good redesign
- stronger than previous single-message informational approach

**Main gap**

- stage setup in Kommo must be finished for the flow to be fully production-consistent

---

## 5. UX / Interaction Audit

### 5.1 What works well

- main menu is compact and readable
- free lessons CTA is correctly prioritized
- major actions are button-driven
- marathon flow is now substantially cleaner than a static wall of text
- consultation flows are low-friction

### 5.2 Confusion points

- the system mixes reply keyboard and inline keyboard patterns frequently
- onboarding still blocks access to a large part of informational value
- AI flow is isolated and not surfaced as a strong assistant option in the main business journey
- user can move between multiple flows, which is handled technically, but the experience still feels operational rather than polished in some branches

### 5.3 Unnecessary steps or weak UX spots

- mandatory lead capture before service detail access can reduce discovery depth
- some confirmations are functional but not persuasive
- there is no strong progress framing around course qualification

### 5.4 UX conclusion

The Telegram UX is already functional and business-valid, but it is still optimized more for operational correctness than for maximum conversational smoothness.

---

## 6. CRM & Monetization Logic

### 6.1 Lead creation

Leads are created through `createLeadInKommo()` using:

- Telegram identity
- name
- phone/email if present
- selected source
- lesson state
- basic profile fields

This is a solid baseline.

### 6.2 Stage usage

Current code actively uses:

- `New Telegram Lead`
- `Warm Lead`
- `Consultation Requested Urgent`
- `Consultation Requested`
- `Maraton Interested` when configured

This is commercially coherent.

### 6.3 What is strong

- lead creation is real, not nominal
- stage movement reflects actual user intent
- CRM logs provide a recovery path for debugging

### 6.4 Missed automation opportunities

- no automatic SLA metric from stage entry to operator response
- no business dashboard built on top of `crm_sync_logs`
- no automatic “stale urgent lead” detection inside CRM-facing logic
- no structured tags for marathon package/date beyond note text

### 6.5 Monetization evaluation

The bot already monetizes through:

- course interest
- urgent operator contact
- career consultation
- marathon interest

This is a strong commercial base. The next revenue gains will come from analytics and operator workflow quality, not from inventing new buttons.

---

## 7. DevOps & Infrastructure

### 7.1 Current operating model

The project uses:

- local Docker Compose for development
- separate production Compose for VPS
- `Dockerfile.prod` for production image builds
- manual `.env.vps` provisioning
- manual media file management

### 7.2 Strengths

- environment split is clear
- production ports are bound to `127.0.0.1` where relevant
- Local Bot API is properly co-located with the app stack
- operational scripts exist for reset, verify, audit and smoke

### 7.3 Risks

- deployment is still manual and operator-dependent
- there is no CI/CD gate or deployment pipeline
- secret handling is file-based only
- asset deployment is manual and can drift from code deploy
- Docker image copies `video/` while production also mounts host `./video`, which creates redundant artifact strategy

### 7.4 Reliability assessment

Reliability is acceptable for a founder-operated VPS deployment. It is not yet hardened to “hands-off production” standards.

---

## 8. Monitoring & Observability

### 8.1 What exists

- `/health`
- `/admin/stats`
- `/admin/jobs`
- `ops-bot`
- queue status
- Docker container inspection
- log tail access
- daily report
- incident and recovery alerts

### 8.2 What is good

- monitoring is not just logs; it includes business counters and queue state
- the separate ops bot is a real operational advantage for a small team

### 8.3 What is missing

- no long-term metrics storage
- no historical incident timeline
- no alert severity levels beyond simple incident/recovery
- no correlation between business KPI drop and technical symptoms

### 8.4 Monitoring conclusion

For the current scale, observability is above average. For scaling, it needs persistence and operational history.

---

## 9. Data & Analytics

### 9.1 What is collected

The system already stores valuable business and operational data:

- user identity and contact info
- onboarding completion
- lesson unlock and open state
- quiz state
- campaign state
- CRM sync outcomes
- user events
- queue execution state
- media cache

### 9.2 What is not tracked well enough

- funnel drop-off between each onboarding step
- conversion by entry point
- operator response time
- time to CRM contact after urgent request
- win/loss attribution back to bot flow
- package/date popularity for marathon

### 9.3 Data conclusion

The system captures enough raw data to become analytically strong, but it does not yet convert that data into business intelligence.

---

## 10. Security

### 10.1 Positive controls

- ops bot is restricted by allowed user IDs and password
- production service exposure is mostly loopback-bound
- dangerous ops reset is env-gated

### 10.2 Risks

- secrets are stored in plain env files
- no rotation workflow is built into the product
- admin routes are not application-authenticated
- ops auth state is memory-only
- no command audit log for operations bot

### 10.3 Security conclusion

Security is reasonable for a controlled VPS and single-owner operating model, but not for a larger or compliance-sensitive environment.

---

## 11. Risks & Weak Points

### 11.1 Technical risks

- env precedence in `config.ts` is non-standard: `.env` overrides `.env.local` if both exist
- marathon CRM stage is still operationally incomplete until fully configured
- manual asset handling remains a deployment risk
- limited automated test depth for full Telegram conversation flows

### 11.2 Business risks

- lead capture gating may reduce top-of-funnel exploration
- marathon stage mismatch can silently dilute reporting quality
- lesson 2 and 3 quiz depth is not yet at the same maturity as lesson 1

### 11.3 UX risks

- mixed keyboard paradigms can feel inconsistent
- some flows optimize data capture more than user confidence
- informational discovery still depends too much on entering structured flows

---

## 12. Strategic Recommendations

### Short-term

- finalize `KOMMO_STAGE_MARATON_ID` and verify it through `verify:kommo`
- add protection to `/admin/*` endpoints beyond loopback binding
- normalize configuration strategy and document env precedence clearly
- add a small analytics view for:
  - onboarding completion rate
  - free lesson progression
  - urgent vs consultation requests
  - marathon request count by package/date

### Mid-term

- convert CRM note-heavy payloads into more structured analytics-friendly fields or tags
- add end-to-end scripted tests for Telegram flows, not just invariants and smoke checks
- add media asset validation script before deploy
- consolidate marathon config to one canonical env format and remove legacy duplication

### Long-term

- introduce CI/CD with deployment gates
- move secrets to a safer management model
- add persistent observability beyond Telegram alerts
- turn the bot into a generalized campaign platform rather than a single-funnel implementation

---

## 13. Final Owner Summary

What works:

- the bot captures leads correctly
- the 3-lesson funnel is real and automated
- urgent and consultative requests are separated properly
- the marathon flow is now commercially much stronger
- the team has real monitoring, not blind production

What must be improved:

- marathon CRM stage must be finalized in Kommo
- analytics must become a first-class layer
- configuration and deployment discipline should be tightened
- lesson 2 and 3 assessment depth should match lesson 1 quality

Where money is gained:

- immediate lead capture
- low-friction operator handoff
- structured consultation routing
- clearer marathon conversion path

Where money is still lost:

- users who leave before completing gated onboarding
- lack of precise funnel analytics
- missing business-level follow-up metrics after CRM handoff

Final owner verdict:

This is already a valuable sales system, not an experiment. The next stage is not “build more core bot features”. The next stage is to improve clarity, analytics, and operational rigor so the existing flows convert better and are easier to manage at scale.
