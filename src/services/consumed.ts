import { Env, OpportunityItem } from "../types";

const CONSUMED_INDEX_KEY = "consumed:index";
const NINETY_DAYS_SECONDS = 90 * 24 * 60 * 60;

export interface ConsumedRecord {
  dedupeKey: string;
  title: string;
  company: string;
  categoryId: string;
  note?: string;
  consumedAt: string;
}

/** The radar never writes this itself. Only your own action does. */
export async function markConsumed(
  env: Env,
  item: Pick<OpportunityItem, "dedupeKey" | "title" | "company" | "categoryId">,
  note?: string
): Promise<ConsumedRecord | null> {
  if (!env.RADAR_CONSUMED || !item.dedupeKey) return null;

  const record: ConsumedRecord = {
    dedupeKey: item.dedupeKey,
    title: item.title,
    company: item.company,
    categoryId: item.categoryId,
    note,
    consumedAt: new Date().toISOString()
  };

  try {
    await env.RADAR_CONSUMED.put(`consumed:${item.dedupeKey}`, JSON.stringify(record), {
      expirationTtl: NINETY_DAYS_SECONDS
    });

    const raw = await env.RADAR_CONSUMED.get(CONSUMED_INDEX_KEY);
    let keys: string[] = [];
    if (raw) {
      try {
        keys = JSON.parse(raw);
      } catch {}
    }
    if (!keys.includes(item.dedupeKey)) {
      keys.unshift(item.dedupeKey);
      await env.RADAR_CONSUMED.put(CONSUMED_INDEX_KEY, JSON.stringify(keys.slice(0, 500)));
    }
    return record;
  } catch (err: any) {
    console.error(`[Consumed] Failed to mark ${item.dedupeKey} consumed: ${err?.message || err}`);
    return null;
  }
}

export async function getConsumed(env: Env): Promise<ConsumedRecord[]> {
  if (!env.RADAR_CONSUMED) return [];

  try {
    const raw = await env.RADAR_CONSUMED.get(CONSUMED_INDEX_KEY);
    if (!raw) return [];
    const keys: string[] = JSON.parse(raw);
    const records = await Promise.all(
      keys.map(k => env.RADAR_CONSUMED!.get(`consumed:${k}`))
    );
    return records.filter(Boolean).map(r => JSON.parse(r!));
  } catch (err: any) {
    console.error(`[Consumed] Failed to read consumed index: ${err?.message || err}`);
    return [];
  }
}

/** Just the keys, so the dashboard can badge rows without a second round trip. */
export async function getConsumedKeys(env: Env): Promise<string[]> {
  if (!env.RADAR_CONSUMED) return [];
  try {
    const raw = await env.RADAR_CONSUMED.get(CONSUMED_INDEX_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}