# Opportunity Radar 📡

An automated, multi-source opportunities, grants, scholarships, competitions, freelance gigs, and jobs crawler hosted on **Cloudflare Workers**.

It crawls opportunities across 6 distinct categories, runs dedicated **Keyword Query engines** with inclusion and exclusion filters, deduplicates using **Cloudflare KV**, and dispatches formatted alerts directly to **WhatsApp** (or Telegram / Discord).

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
4. Set `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID` in `wrangler.jsonc`.

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

---

## 🚢 Deploy to Cloudflare

1. **Create the KV Namespace for Deduplication**:
   ```bash
   npx wrangler kv namespace create SEEN_OPPORTUNITIES
   ```
   Copy the generated `id` into `wrangler.jsonc` under `kv_namespaces`.

2. **Deploy**:
   ```bash
   npx wrangler deploy
   ```

The Cron Trigger will now run automatically at **7:00 AM, 2:00 PM, and 8:00 PM UTC** every single day!
