import { CATEGORIES } from "./config/categories";
import { fetchFeedItems, FetchResult, RawFeedItem } from "./services/fetcher";
import { filterCategoryItems } from "./services/filter";
import { collapseByDedupeKey, filterUnseenItems, markItemsAsSeen } from "./services/deduplicator";
import { dispatchOpportunities, pushWebhook } from "./services/notifier";
import { selectSendable } from "./services/routing";
import { getSettings, saveSettings } from "./services/settings";
import { saveDailyOpportunities, getOpportunitiesForDay, getAvailableDates } from "./services/history";
import { getAllProviderQuotas } from "./services/usage";
import { getConsumed, getConsumedKeys, markConsumed } from "./services/consumed";
import { checkRateLimit, clientIdFrom } from "./services/ratelimit";
import { renderDashboardHtml } from "./ui/dashboard";
import { Env, FeedSource, OpportunityItem } from "./types";

interface SourceFailure {
  sourceId: string;
  sourceName: string;
  reason: string;
}

/**
 * Core Orchestrator: Runs the scan across all categories respecting UserSettings
 */
async function runOpportunityRadar(env: Env, dryRun: boolean = false, dashboardUrl?: string) {
  const settings = await getSettings(env);
  console.log(`[Radar] Starting scan (dryRun: ${dryRun}, mode: ${settings.messageMode}, maxTotal: ${settings.maxTotalMessages})...`);

  const allMatchedItems: OpportunityItem[] = [];
  const allUnseenItems: OpportunityItem[] = [];
  const sourcesFailed: SourceFailure[] = [];
  let kvErrors = 0;
  const categorySummaries: {
    category: string;
    totalFetched: number;
    matchedCount: number;
    unseenCount: number;
    sourcesFailed: number;
  }[] = [];

  for (const category of CATEGORIES) {
    // 1. Filter out sources disabled by the user in the Control Plane
    const activeSources = category.sources.filter(src => settings.enabledSources[src.id] !== false);
    if (activeSources.length === 0) {
      console.log(`[Radar] All sources for ${category.displayName} disabled. Skipping.`);
      continue;
    }

    // 2. Fetch active feeds. A rejected promise is a dead source, so name it.
    const settled = await Promise.allSettled(activeSources.map(src => fetchFeedItems(src)));

    const allRawItems: RawFeedItem[] = [];
    const sourceById = new Map<string, FeedSource>();
    let failedHere = 0;

    settled.forEach((res, i) => {
      const src = activeSources[i];
      sourceById.set(src.id, src);
      if (res.status === "rejected") {
        failedHere++;
        const reason = (res.reason as any)?.message || String(res.reason);
        sourcesFailed.push({ sourceId: src.id, sourceName: src.name, reason });
        console.error(`[Radar] Source failed: ${src.name} (${src.url}): ${reason}`);
        return;
      }
      const result: FetchResult = res.value;
      if (result.error) {
        failedHere++;
        sourcesFailed.push({ sourceId: src.id, sourceName: src.name, reason: result.error });
        console.error(`[Radar] Source degraded: ${src.name}: ${result.error}`);
      }
      allRawItems.push(...result.items);
    });

    // 3. Filter by keyword query rules & user maxAgeDays
    const customConfig = settings.categoryKeywords?.[category.id];
    const matched = filterCategoryItems(allRawItems, category, settings.maxAgeDays, customConfig, sourceById);
    allMatchedItems.push(...matched);

    // 4. Deduplicate against Cloudflare KV
    const { unseen, kvErrors: kvErrs } = await filterUnseenItems(matched, env);
    kvErrors += kvErrs;
    allUnseenItems.push(...unseen);

    categorySummaries.push({
      category: category.displayName,
      totalFetched: allRawItems.length,
      matchedCount: matched.length,
      unseenCount: unseen.length,
      sourcesFailed: failedHere
    });
  }

  // 5. One job seen on two boards is one row in the table.
  const matchedCollapsed = collapseByDedupeKey(allMatchedItems);
  const unseenCollapsed = collapseByDedupeKey(allUnseenItems);
  if (matchedCollapsed.length !== allMatchedItems.length) {
    console.log(`[Radar] Collapsed ${allMatchedItems.length - matchedCollapsed.length} cross-source duplicates`);
  }

  // 6. Always persist all matched opportunities to the Daily History Table in KV
  await saveDailyOpportunities(env, matchedCollapsed);

  // 7. Dispatch notifications according to user settings (Individual vs Digest)
  let dispatchResult = { dispatchedCount: 0, errors: [] as string[], suppressed: 0 };
  let webhookResult: { ok: boolean; skipped?: boolean; error?: string } | undefined;

  if (!dryRun && unseenCollapsed.length > 0) {
    // Same gate as the message dispatcher, so the webhook and WhatsApp agree.
    const sendable = selectSendable(unseenCollapsed, settings);
    webhookResult = await pushWebhook(sendable, settings, env, dashboardUrl);
    if (!webhookResult.ok && !webhookResult.skipped) {
      dispatchResult.errors.push(webhookResult.error || "Webhook push failed");
    }

    dispatchResult = await dispatchOpportunities(unseenCollapsed, settings, env, dashboardUrl);
    await markItemsAsSeen(unseenCollapsed, env);
  }

  if (sourcesFailed.length > 0) {
    console.warn(`[Radar] ${sourcesFailed.length} source(s) failed or degraded this run`);
  }

  return {
    summary: categorySummaries,
    sourcesFailed,
    sourcesFailedCount: sourcesFailed.length,
    kvErrors,
    totalMatched: matchedCollapsed.length,
    totalUnseen: unseenCollapsed.length,
    dispatched: dispatchResult,
    webhook: webhookResult,
    settingsUsed: {
      mode: settings.messageMode,
      maxTotal: settings.maxTotalMessages,
      maxPerSource: settings.maxPerSource
    }
  };
}

export default {
  /**
   * Cron Trigger Handler: Runs automatically at scheduled hours
   */
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    console.log(`[Cron] Trigger fired at: ${new Date(event.scheduledTime).toISOString()}`);
    ctx.waitUntil(runOpportunityRadar(env, false));
  },

  /**
   * HTTP Handler: Control Plane UI, API endpoints, manual crawler execution
   */
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const origin = url.origin;

    // 1. Web UI Dashboard & Control Plane (HTML)
    if (url.pathname === "/" || url.pathname === "/dashboard" || url.pathname === "/control-plane") {
      const settings = await getSettings(env);
      const availableDates = await getAvailableDates(env);
      const consumed = await getConsumedKeys(env);
      const html = renderDashboardHtml(settings, availableDates, consumed);
      return new Response(html, {
        headers: { "Content-Type": "text/html; charset=utf-8" }
      });
    }

    // 2. Settings API (GET / POST)
    if (url.pathname === "/api/settings") {
      if (request.method === "POST") {
        try {
          const body = await request.json() as any;
          const updated = await saveSettings(env, body);
          return new Response(JSON.stringify(updated, null, 2), {
            headers: { "Content-Type": "application/json" }
          });
        } catch (err: any) {
          return new Response(JSON.stringify({ error: err.message }), { status: 400 });
        }
      } else {
        const settings = await getSettings(env);
        return new Response(JSON.stringify(settings, null, 2), {
          headers: { "Content-Type": "application/json" }
        });
      }
    }

    // 3. Opportunities API for the Daily Table (GET /api/opportunities?date=YYYY-MM-DD)
    // Rate limited: public data, but an unauthenticated crawler is an invitation.
    if (url.pathname === "/api/opportunities") {
      const limit = await checkRateLimit(env, clientIdFrom(request), 60, 60);
      if (!limit.ok) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Try again shortly." }), {
          status: 429,
          headers: {
            "Content-Type": "application/json",
            "Retry-After": String(limit.retryAfter),
            "X-RateLimit-Limit": String(limit.limit),
            "X-RateLimit-Remaining": "0"
          }
        });
      }
      const date = url.searchParams.get("date") || undefined;
      const items = await getOpportunitiesForDay(env, date);
      return new Response(JSON.stringify(items, null, 2), {
        headers: {
          "Content-Type": "application/json",
          "X-RateLimit-Limit": String(limit.limit),
          "X-RateLimit-Remaining": String(limit.remaining)
        }
      });
    }

    // 4. Consumed: what you actually acted on. The radar only writes this when you say so.
    if (url.pathname === "/api/consumed") {
      if (request.method === "POST") {
        try {
          const body = await request.json() as { dedupeKey?: string; title?: string; company?: string; categoryId?: string; note?: string };
          if (!body.dedupeKey) {
            return new Response(JSON.stringify({ error: "dedupeKey is required" }), { status: 400 });
          }
          const record = await markConsumed(
            env,
            {
              dedupeKey: body.dedupeKey,
              title: body.title || "",
              company: body.company || "",
              categoryId: body.categoryId || ""
            },
            body.note
          );
          if (!record) {
            return new Response(JSON.stringify({ error: "RADAR_CONSUMED not bound" }), { status: 503 });
          }
          return new Response(JSON.stringify(record, null, 2), {
            headers: { "Content-Type": "application/json" }
          });
        } catch (err: any) {
          return new Response(JSON.stringify({ error: err.message }), { status: 400 });
        }
      }
      const consumed = await getConsumed(env);
      return new Response(JSON.stringify(consumed, null, 2), {
        headers: { "Content-Type": "application/json" }
      });
    }

    // 5. Provider Quota & Usage API (GET /api/usage)
    if (url.pathname === "/api/usage") {
      const settings = await getSettings(env);
      const quotas = await getAllProviderQuotas(env, settings);
      return new Response(JSON.stringify(quotas, null, 2), {
        headers: { "Content-Type": "application/json" }
      });
    }

    // 6. Trigger Manual Crawl (/run or /api/run)
    if (url.pathname === "/run" || url.pathname === "/api/run") {
      const limit = await checkRateLimit(env, clientIdFrom(request), 5, 300);
      if (!limit.ok) {
        return new Response(JSON.stringify({ error: "Crawl rate limit exceeded. Try again shortly." }), {
          status: 429,
          headers: { "Content-Type": "application/json", "Retry-After": String(limit.retryAfter) }
        });
      }
      const isDryRun = url.searchParams.get("dryRun") === "true";
      const results = await runOpportunityRadar(env, isDryRun, `${origin}/dashboard`);
      return new Response(JSON.stringify({
        status: "complete",
        dryRun: isDryRun,
        timestamp: new Date().toISOString(),
        ...results
      }, null, 2), {
        headers: { "Content-Type": "application/json" }
      });
    }

    // 7. Test WhatsApp Ping (/test-alert)
    if (url.pathname === "/test-alert") {
      const settings = await getSettings(env);
      const dummyCategory = CATEGORIES[0];
      const dummyItem: OpportunityItem = {
        id: "test:ping",
        dedupeKey: "::test alert global ai policy governance fellowship 2027",
        title: "Test Alert: Global AI Policy & Governance Fellowship 2027",
        link: "https://opportunitydesk.org",
        pubDate: new Date().toUTCString(),
        description: "This is a test notification confirming your Opportunity Radar Cloudflare Worker is connected and able to reach your WhatsApp via CallMeBot.",
        company: "Opportunity Desk",
        region: "worldwide",
        eligibility: "open",
        eligibilityEvidence: "worldwide",
        deadline: "",
        salaryBand: "",
        isOpportunity: true,
        routeTo: "application",
        categoryId: dummyCategory.id,
        categoryName: dummyCategory.displayName,
        categoryIcon: dummyCategory.icon,
        sourceName: "Opportunity Desk",
        matchedKeywords: ["Test", "AI Policy", "Fellowship"],
        crawledAt: new Date().toISOString()
      };

      const dispatchResult = await dispatchOpportunities([dummyItem], settings, env, `${origin}/dashboard`);
      return new Response(JSON.stringify({ result: dispatchResult }, null, 2), {
        headers: { "Content-Type": "application/json" }
      });
    }

    return new Response("Not Found", { status: 404 });
  }
};