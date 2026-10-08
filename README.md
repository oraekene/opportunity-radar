# Opportunity Radar 📡

An automated, multi-source opportunities, grants, scholarships, competitions, freelance gigs, and jobs crawler hosted on **Cloudflare Workers**.

It crawls opportunities across 6 distinct categories, runs dedicated **Keyword Query engines** with inclusion and exclusion filters, deduplicates using **Cloudflare KV**, and dispatches formatted alerts to **WhatsApp** (or Telegram / Discord) and to a **webhook** you control.

---

## 🎯 Eligibility parameters

A feed summary is not the application. The real gates live on the page, so the
radar reads the apply link and writes down what it finds.

Seven parameters, each toggleable:

| Field | Example of what a page says |
| :--- | :--- |
| `country` | "admission into an eligible Federal University in Nigeria" |
| `ageBand` | "Applicants must be 18-25 years old" |
| `yearsExperience` | "minimum of 8 years of experience" |
| `educationLevel` | "undergraduate students", "PhD" |
| `fieldOfStudy` | "degree in public health" |
| `requiredDocuments` | "Required documents are a passport, a transcript and a reference letter" |
| `deadline` | "Deadline: 15 April 2026" |

Every requirement carries the phrase it came from. Nothing is invented: if a
page has no eligibility section, no requirement is recorded.

Set your own answers and the enforcement of each field in the Control Plane
under **Your Eligibility Profile**. Three modes per field:

* `warn` (the default for all seven) notes a mismatch and never blocks
* `enforce` blocks the item from messages and from the webhook
* `ignore` does not check that field at all

A blank answer means unknown, and unknown never blocks. That is deliberate: a
half-filled profile cannot hide opportunities from you.

Extraction is scoped to a real eligibility section and requires the country to
sit in the grammatical slot a gate preposition leaves open, so navigation
menus and social footers cannot manufacture a requirement that blocks you.

The radar reads at most **10 pages per run**, because a Worker gets 50
subrequests and the feeds already spend about 32. Each page is cached for 7
days. Raise `MAX_PAGE_FETCHES_PER_RUN` in `src/services/pageSummary.ts` only
on the paid subrequest tier.

---

## 📵 Delivery failures are never content

WhatsApp can answer HTTP 200 and still refuse the message. Meta error 131047
means the 24-hour customer service window closed, and free-form text keeps
failing until the recipient messages the number again.

The radar treats that as a failed delivery, not a success:

* the response body is read even on HTTP 200, so a refusal is never counted as
  sent and never burns quota
* a refusal never becomes part of the message body; provider text stays in the
  run log
* the channel is blocked for 24 hours instead of being retried, and the reason
  appears in the run log as `dispatched.blocked`

To resume on a sandbox number, either send "hello" on WhatsApp to reopen the
window, or move to an approved template message for re-engagement.

---

## 🔍 What each item carries

The radar lifts these out of the feed text instead of leaving them in prose:

| Field | Where it comes from |
| :--- | :--- |
| `company` | A `Company:` label, the title, or the apply link host |
| `eligibilityCountry` | A country named in the body, before the title |
| `region` | The longest region phrase in the text |
| `eligibility` | `open`, `restricted`, or `unknown`, plus `eligibilityEvidence`, the phrase that decided it |
| `deadline` | Prose such as "applications close on 15 April 2026" |
| `salaryBand` | A currency range such as `$150,000 - $180,000` |
| `isOpportunity` | Declared by the source. News sources set it false |
| `routeTo` | `application`, `cold_email`, or `none` |
| `eligibilityRequirements` | The seven parameters read off the page, each with its evidence |
| `eligibilityChecks` | Per-field verdict and reason |
| `dedupeKey` | Normalised company plus title, so one job on two boards is one row |

A region on its own is never treated as eligibility. A "South Africa" role reads
as `unknown`, not promising. `restricted` items are shown but not sent unless you
set `sendRestricted` to true.

Per source you can set `parseRule: "hnComment"` (Hacker News Who-is-Hiring
comments, where company and role are lifted out of the pipe-delimited body and
anything missing either is dropped) and `carriesApplication: false`.

---

## 🧭 Per-category routing

`routeTo` in `src/config/categories.ts` decides where a category lands:

* `grants_fellowships`, `scholarships`, `competitions_hackathons` → `application`
* `remote_jobs`, `freelance_gigs` → `cold_email`
* `angel_startup_funding` → `none`. Funding news stays in the Daily Table and is
  never dispatched.

---

## 🔑 Secrets

No credential name is committed. `wrangler.jsonc` holds only `NOTIFIER_TARGET`.
Set every key, token, phone, and URL with `wrangler secret put`:

```bash
npx wrangler secret put KAPSO_API_KEY
npx wrangler secret put KAPSO_PHONE_NUMBER_ID
npx wrangler secret put KAPSO_RECIPIENT_PHONE
npx wrangler secret put META_PHONE_NUMBER_ID
npx wrangler secret put META_ACCESS_TOKEN
npx wrangler secret put META_RECIPIENT_PHONE
npx wrangler secret put TWILIO_ACCOUNT_SID
npx wrangler secret put TWILIO_AUTH_TOKEN
npx wrangler secret put TWILIO_FROM_PHONE
npx wrangler secret put TWILIO_TO_PHONE
npx wrangler secret put CALLMEBOT_PHONE
npx wrangler secret put CALLMEBOT_APIKEY
npx wrangler secret put GREENAPI_INSTANCE_ID
npx wrangler secret put GREENAPI_API_TOKEN
npx wrangler secret put TELEGRAM_BOT_TOKEN
npx wrangler secret put TELEGRAM_CHAT_ID
npx wrangler secret put DISCORD_WEBHOOK_URL
npx wrangler secret put RADAR_WEBHOOK_URL
```

Settings saved from the Control Plane live in KV and still win over these
defaults.

---

## 🔌 Webhook push

Set `RADAR_WEBHOOK_URL` (or `webhookUrl` in settings). Each live crawl POSTs one
batch to that URL:

```json
{
  "type": "opportunity.batch",
  "sentAt": "2026-10-07T21:00:00.000Z",
  "items": [ { "id": "...", "dedupeKey": "acme labs::senior data engineer", "routeTo": "cold_email", "eligibility": "open", "company": "Acme Labs", "deadline": "15 April 2026", "salaryBand": "$150,000 - $180,000", "link": "https://..." } ],
  "routes": { "application": ["..."], "cold_email": ["acme labs::senior data engineer"] }
}
```

`routes` lists the dedupe keys per pipeline, so a downstream poller can fan out
without re-reading the whole batch.

---

## 🗂 KV namespaces

| Binding | Holds | TTL |
| :--- | :--- | :--- |
| `RADAR_SEEN` | Seen set, keyed by both `id` and `dedupeKey` | 30 days |
| `RADAR_HISTORY` | Daily rows, dates index, settings, provider quota counters | 60 days |
| `RADAR_CONSUMED` | What you acted on. Only `POST /api/consumed` writes here | 90 days |

Marking something consumed is a separate act from receiving it, because the
radar cannot tell "messaged to you" from "drafted and sent":

```bash
curl -X POST https://<worker>/api/consumed \
  -H 'Content-Type: application/json' \
  -d '{"dedupeKey":"acme labs::senior data engineer","company":"Acme Labs","note":"applied"}'
```

---

## 📂 Categories & Sources Included

| Category | Icon | Sources | Keyword Focus |
| :--- | :---: | :--- | :--- |
| **Grants & Fellowships** | 💰 | Opportunity Desk (Grants & Fellowships), Opportunities for Africans, FundsforNGOs | AI, Tech, Policy, Governance, Africa, Nigeria, Global, Climate, Impact |
| **Scholarships** | 🎓 | Opportunity Desk Scholarships, AfterSchoolAfrica | Fully funded, Master's, PhD, Erasmus, Chevening, Fulbright, Africa |
| **Competitions & Hackathons** | ⚡ | Opportunity Desk Competitions & Pitch Calls | Hackathons, Builders, Innovation, Pitches, Cash Prizes, Demo Day |
| **Angel & Startup Funding** | 🚀 | Disrupt Africa Funding, VC Cafe, EU-Startups, Techstars News | Pre-seed, Seed, Accelerators, Grants, Cohorts, Africa, Fintech, AI |
| **Freelance & Gigs** | 🛠️ | We Work Remotely Contract, ProBlogger, Remotive | Contract, Gigs, Hourly, AI Engineer, Prompt Engineer, Writer, Consultant |
| **Remote Tech & Product Jobs** | 🌍 | WWR Programming & Product, RemoteOK, Jobspresso | Remote Anywhere, Product Manager, AI/ML Engineer, Credit/Risk, Policy |

---

## 📲 Notification Channels Setup

### Option 1: WhatsApp (Personal Chat via CallMeBot) — *Recommended & 100% Free*
1. Add `+34 644 44 49 46` (CallMeBot) to your WhatsApp contacts.
2. Send this exact message to it on WhatsApp:
   ```text
   I allow callmebot to send me messages
   ```
3. It will reply with your personal `APIKEY`.
4. Put your phone and API key in `.dev.vars` (for local) or Cloudflare secrets:
   ```bash
   npx wrangler secret put CALLMEBOT_PHONE
   npx wrangler secret put CALLMEBOT_APIKEY
   ```

### Option 2: WhatsApp Groups (via Green-API Free Tier)
If you want each category to land in a separate WhatsApp Group:
1. Create an account at [Green-API](https://green-api.com) (free developer instance).
2. Scan the QR code to connect your WhatsApp instance.
3. In `src/config/categories.ts`, add the `whatsappGroupChatId` (e.g. `12036302...@g.us`) to each category.
4. Set `NOTIFIER_TARGET = "whatsapp_greenapi"` and configure `GREENAPI_INSTANCE_ID` and `GREENAPI_API_TOKEN`.

### Option 3: Telegram Supergroup with Topics (Individual Channels in 1 Group)
In Telegram, you can enable **Topics** (Forums) in any group for free:
1. Create a Telegram Group and enable **Topics** in Group Settings.
2. Create topics for: `#Grants`, `#Startup-Funding`, `#Hackathons`, `#Freelance`, `#Remote-Jobs`.
3. Add a bot from `@BotFather` as an admin.
4. Set `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID` with `wrangler secret put`.

---

## 🚀 Local Development & Testing

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Start local development server**:
   ```bash
   npx wrangler dev
   ```

3. **Test endpoints**:
   * Health Check: `http://localhost:8787/`
   * Run Live Crawl (Dry run): `http://localhost:8787/run?dryRun=true`
   * Run Live Crawl & Dispatch: `http://localhost:8787/run`
   * Send Test Alert: `http://localhost:8787/test-alert`

4. **Typecheck and test**:
   ```bash
   npm run typecheck
   npm test
   ```

---

## 🚢 Deploy to Cloudflare

1. **Create the KV namespaces** (skip if they already exist):
   ```bash
   npx wrangler kv namespace create RADAR_SEEN
   npx wrangler kv namespace create RADAR_HISTORY
   npx wrangler kv namespace create RADAR_CONSUMED
   ```
   Copy each generated `id` into `wrangler.jsonc` under `kv_namespaces`.

2. **Set the secrets** (see [Secrets](#-secrets) above).

3. **Deploy**:
   ```bash
   npx wrangler deploy
   ```

The Cron Trigger runs every 8 hours: 00:00, 08:00 and 16:00 UTC.

---

## 📡 Visibility

`/run` reports `sourcesFailed`, a list of every source that errored or returned
nothing. A source that silently stops is now visible in the Control Plane run
log instead of disappearing into `Promise.allSettled`. KV dedupe read failures
are counted as `kvErrors`, and restricted or unrouted items are counted as
`dispatched.suppressed`.

`/api/opportunities` is rate limited to 60 requests per minute per IP, and
`/run` to 5 per 5 minutes, so an unauthenticated crawler cannot drive the
feeds.
