import { CATEGORIES } from "./config/categories";
import { fetchFeedItems, RawFeedItem } from "./services/fetcher";
import { filterCategoryItems } from "./services/filter";
import { filterUnseenItems, markItemsAsSeen } from "./services/deduplicator";
import { dispatchOpportunities } from "./services/notifier";
import { getSettings, saveSettings } from "./services/settings";
import { saveDailyOpportunities, getOpportunitiesForDay, getAvailableDates } from "./services/history";
import { getAllProviderQuotas } from "./services/usage";
import { renderDashboardHtml } from "./ui/dashboard";
import { Env, OpportunityItem } from "./types";

/**
 * Core Orchestrator: Runs the scan across all categories respecting UserSettings
 */
async function runOpportunityRadar(env: Env, dryRun: boolean = false, dashboardUrl?: string) {
  const settings = await getSettings(env);
  console.log(`[Radar] Starting scan (dryRun: ${dryRun}, mode: ${settings.messageMode}, maxTotal: ${settings.maxTotalMessages})...`);

  const allMatchedItems: OpportunityItem[] = [];
  const allUnseenItems: OpportunityItem[] = [];
  const categorySummaries: {
    category: string;
    totalFetched: number;
    matchedCount: number;
    unseenCount: number;
  }[] = [];

  for (const category of CATEGORIES) {
    // 1. Filter out sources disabled by the user in the Control Plane
    const activeSources = category.sources.filter(src => settings.enabledSources[src.id] !== false);
    if (activeSources.length === 0) {
      console.log(`[Radar] All sources for ${category.displayName} disabled. Skipping.`);
      continue;
    }

    // 2. Fetch active feeds
    const feedPromises = activeSources.map(src => fetchFeedItems(src));
    const feedResults = await Promise.allSettled(feedPromises);

    const allRawItems: RawFeedItem[] = [];
    feedResults.forEach(res => {
      if (res.status === "fulfilled") {
        allRawItems.push(...res.value);
      }
    });

    // 3. Filter by keyword query rules & user maxAgeDays
    const customConfig = settings.categoryKeywords?.[category.id];
    const matched = filterCategoryItems(allRawItems, category, settings.maxAgeDays, customConfig);
    allMatchedItems.push(...matched);

    // 4. Deduplicate against Cloudflare KV
    const unseen = await filterUnseenItems(matched, env);
    allUnseenItems.push(...unseen);

    categorySummaries.push({
      category: category.displayName,
      totalFetched: allRawItems.length,
      matchedCount: matched.length,
      unseenCount: unseen.length
    });
  }

  // 5. Always persist all matched opportunities to the Daily History Table in KV
  await saveDailyOpportunities(env, allMatchedItems);

  // 6. Dispatch notifications according to user settings (Individual vs Digest)
  let dispatchResult = { dispatchedCount: 0, errors: [] as string[] };
  if (!dryRun && allUnseenItems.length > 0) {
    dispatchResult = await dispatchOpportunities(allUnseenItems, settings, env, dashboardUrl);
    // Mark dispatched items as seen
    await markItemsAsSeen(allUnseenItems, env);
  }

  return {
    summary: categorySummaries,
    totalMatched: allMatchedItems.length,
    totalUnseen: allUnseenItems.length,
    dispatched: dispatchResult,
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
      const html = renderDashboardHtml(settings, availableDates);
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
    if (url.pathname === "/api/opportunities") {
      const date = url.searchParams.get("date") || undefined;
      const items = await getOpportunitiesForDay(env, date);
      return new Response(JSON.stringify(items, null, 2), {
        headers: { "Content-Type": "application/json" }
      });
    }

    // 4. Provider Quota & Usage API (GET /api/usage)
    if (url.pathname === "/api/usage") {
      const settings = await getSettings(env);
      const quotas = await getAllProviderQuotas(env, settings);
      return new Response(JSON.stringify(quotas, null, 2), {
        headers: { "Content-Type": "application/json" }
      });
    }

    // 4. Trigger Manual Crawl (/run or /api/run)
    if (url.pathname === "/run" || url.pathname === "/api/run") {
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

    // 5. Test WhatsApp Ping (/test-alert)
    if (url.pathname === "/test-alert") {
      const settings = await getSettings(env);
      const dummyCategory = CATEGORIES[0];
      const dummyItem: OpportunityItem = {
        id: "test:ping",
        title: "Test Alert: Global AI Policy & Governance Fellowship 2027",
        link: "https://opportunitydesk.org",
        pubDate: new Date().toUTCString(),
        description: "This is a test notification confirming your Opportunity Radar Cloudflare Worker is connected and able to reach your WhatsApp via CallMeBot.",
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
