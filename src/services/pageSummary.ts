import type { Env, OpportunityItem } from "../types";
import { extractDeadline, extractEligibilityCountry, extractSalaryBand } from "./parse";

/**
 * One fetch per link, cached. A summary is not a source of truth, so the page
 * is read once and the result reused.
 */
const PAGE_TTL_SECONDS = 7 * 24 * 60 * 60;

/**
 * Ponytail: 10 page fetches per run, because a Worker gets 50 subrequests and
 * the feeds already spend ~32. Raise it only on the paid subrequest tier.
 */
export const MAX_PAGE_FETCHES_PER_RUN = 10;

export interface PageSummary {
  fetchedAt: string;
  ok: boolean;
  error?: string;
  /** Plain text of the page, capped, for the extractors and for you to read. */
  text: string;
  eligibilityCountry: string;
  deadline: string;
  salaryBand: string;
}

const cacheKey = (link: string) => `page:${hashLink(link)}`;

function hashLink(link: string): string {
  let hash = 0;
  for (let i = 0; i < link.length; i++) {
    hash = (hash << 5) - hash + link.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}

function htmlToText(html: string): string {
  return html
    // Drop the chrome. Navigation and footers are where false requirements live.
    .replace(/<(script|style|nav|header|footer|aside)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<[^>]*>?/gm, " ")
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(parseInt(dec, 10)))
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

async function fetchOnce(link: string): Promise<PageSummary> {
  const base = { fetchedAt: new Date().toISOString() };
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    let html: string;
    try {
      const res = await fetch(link, {
        signal: controller.signal,
        redirect: "follow",
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 OpportunityRadar/1.0",
          "Accept": "text/html,application/xhtml+xml,*/*"
        }
      });
      if (!res.ok) {
        return { ...base, ok: false, error: `HTTP ${res.status}`, text: "", eligibilityCountry: "", deadline: "", salaryBand: "" };
      }
      const ctype = res.headers.get("content-type") || "";
      if (ctype && !/html|text\/plain/i.test(ctype)) {
        return { ...base, ok: false, error: `Not HTML (${ctype})`, text: "", eligibilityCountry: "", deadline: "", salaryBand: "" };
      }
      html = await res.text();
    } finally {
      clearTimeout(timeoutId);
    }

    const text = htmlToText(html).slice(0, 20000);
    return {
      ...base,
      ok: true,
      text,
      eligibilityCountry: extractEligibilityCountry("", text),
      deadline: extractDeadline(text),
      salaryBand: extractSalaryBand(text)
    };
  } catch (err: any) {
    const msg = err?.message || String(err);
    return { ...base, ok: false, error: msg, text: "", eligibilityCountry: "", deadline: "", salaryBand: "" };
  }
}

/** Cached page read. Never throws; a failure is recorded on the summary. */
export async function getPageSummary(env: Env, link: string): Promise<PageSummary> {
  if (!env.RADAR_HISTORY || !link || !link.startsWith("http")) {
    return {
      fetchedAt: new Date().toISOString(),
      ok: false,
      error: "No link or no KV",
      text: "",
      eligibilityCountry: "",
      deadline: "",
      salaryBand: ""
    };
  }

  const key = cacheKey(link);
  try {
    const cached = await env.RADAR_HISTORY.get(key);
    if (cached) return JSON.parse(cached) as PageSummary;
  } catch {
    // Cache read failed. Fetch anyway rather than skip the page.
  }

  const summary = await fetchOnce(link);
  // Do not cache a failure: the next run should try again.
  if (summary.ok) {
    try {
      await env.RADAR_HISTORY.put(key, JSON.stringify(summary), { expirationTtl: PAGE_TTL_SECONDS });
    } catch (err: any) {
      console.error(`[PageSummary] Cache write failed for ${link}: ${err?.message || err}`);
    }
  }
  return summary;
}

/**
 * Read the apply page for the first `budget` items that do not already have a
 * cached summary. Returns the summaries keyed by dedupeKey.
 */
export async function enrichWithPages(
  env: Env,
  items: OpportunityItem[],
  budget: number = MAX_PAGE_FETCHES_PER_RUN
): Promise<Map<string, PageSummary>> {
  const out = new Map<string, PageSummary>();
  let fetched = 0;

  for (const item of items) {
    if (fetched >= budget) break;
    const key = cacheKey(item.link);
    try {
      const cached = await env.RADAR_HISTORY?.get(key);
      if (cached) {
        out.set(item.dedupeKey, JSON.parse(cached) as PageSummary);
        continue;
      }
    } catch {
      // Fall through to a live fetch.
    }

    const summary = await fetchOnce(item.link);
    if (summary.ok) {
      fetched++;
      out.set(item.dedupeKey, summary);
      try {
        await env.RADAR_HISTORY?.put(key, JSON.stringify(summary), { expirationTtl: PAGE_TTL_SECONDS });
      } catch {
        // Non-fatal. The summary is still returned for this run.
      }
    }
  }

  return out;
}