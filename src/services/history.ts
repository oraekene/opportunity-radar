import { Env, OpportunityItem } from "../types";

const DATES_INDEX_KEY = "history:dates_index";

function getTodayString(): string {
  const d = new Date();
  return d.toISOString().split("T")[0]; // YYYY-MM-DD
}

/** RADAR_HISTORY holds the day rows. Merge on dedupeKey so re-runs replace, not duplicate. */
export async function saveDailyOpportunities(env: Env, items: OpportunityItem[]): Promise<void> {
  if (!env.RADAR_HISTORY || items.length === 0) return;

  const today = getTodayString();
  const dayKey = `history:day:${today}`;

  try {
    let existingItems: OpportunityItem[] = [];
    const raw = await env.RADAR_HISTORY.get(dayKey);
    if (raw) {
      try {
        existingItems = JSON.parse(raw);
      } catch {}
    }

    const map = new Map<string, OpportunityItem>();
    existingItems.forEach(item => map.set(item.dedupeKey || item.id, item));
    items.forEach(item => map.set(item.dedupeKey || item.id, item));

    await env.RADAR_HISTORY.put(dayKey, JSON.stringify(Array.from(map.values())), {
      expirationTtl: 60 * 24 * 60 * 60
    });

    let dates: string[] = [];
    const rawIndex = await env.RADAR_HISTORY.get(DATES_INDEX_KEY);
    if (rawIndex) {
      try {
        dates = JSON.parse(rawIndex);
      } catch {}
    }

    if (!dates.includes(today)) {
      dates.unshift(today);
      if (dates.length > 30) dates = dates.slice(0, 30); // keep last 30 days
      await env.RADAR_HISTORY.put(DATES_INDEX_KEY, JSON.stringify(dates));
    }
  } catch (err: any) {
    console.error(`[History] Error saving daily opportunities: ${err?.message || err}`);
  }
}

export async function getOpportunitiesForDay(env: Env, dateStr?: string): Promise<OpportunityItem[]> {
  if (!env.RADAR_HISTORY) return [];

  const targetDate = dateStr || getTodayString();

  try {
    const raw = await env.RADAR_HISTORY.get(`history:day:${targetDate}`);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch (err: any) {
    console.error(`[History] Error getting opportunities for ${targetDate}: ${err?.message || err}`);
    return [];
  }
}

export async function getAvailableDates(env: Env): Promise<string[]> {
  if (!env.RADAR_HISTORY) return [getTodayString()];

  try {
    const raw = await env.RADAR_HISTORY.get(DATES_INDEX_KEY);
    if (!raw) return [getTodayString()];
    const dates: string[] = JSON.parse(raw);
    return dates.length > 0 ? dates : [getTodayString()];
  } catch {
    return [getTodayString()];
  }
}