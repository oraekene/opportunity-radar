import { XMLParser } from "fast-xml-parser";
import { FeedSource } from "../types";

export interface RawFeedItem {
  title: string;
  link: string;
  pubDate: string;
  description: string;
  sourceName: string;
  sourceId: string;
}

/** A fetch outcome. An empty item list with an error is a dead source, not an empty feed. */
export interface FetchResult {
  items: RawFeedItem[];
  error?: string;
}

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  textNodeName: "#text",
  trimValues: true,
  cdataPropName: "__cdata",
  // Some feeds trip the entity expansion limit and fail the whole parse.
  // Named entities are decoded in cleanHtml instead.
  processEntities: false
});

function extractText(val: any): string {
  if (!val) return "";
  if (typeof val === "string") return val;
  if (typeof val === "object") {
    if (val.__cdata) return String(val.__cdata);
    if (val["#text"]) return String(val["#text"]);
  }
  return String(val);
}

function cleanHtml(raw: string): string {
  return raw
    .replace(/<[^>]*>?/gm, " ") // Strip HTML tags
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

function parseBreakoutListHtml(htmlText: string, sourceName: string, sourceId: string): RawFeedItem[] {
  const items: RawFeedItem[] = [];
  const rowRegex = /<tr\s+class="row">([\s\S]*?)<\/tr>/gi;
  let match;
  while ((match = rowRegex.exec(htmlText)) !== null) {
    const rowHtml = match[1];

    // Extract company link and name
    const coMatch = rowHtml.match(/<td\s+class="co">[\s\S]*?<a\s+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i);
    if (!coMatch) continue;

    const link = coMatch[1].trim();
    const companyName = cleanHtml(coMatch[2]);

    // Extract description (what it does)
    const whatMatch = rowHtml.match(/<td\s+class="what">([\s\S]*?)<\/td>/i);
    const what = whatMatch ? cleanHtml(whatMatch[1]) : "";

    // Extract founders
    const fnMatch = rowHtml.match(/<td\s+class="fn">([\s\S]*?)<\/td>/i);
    const founders = fnMatch ? cleanHtml(fnMatch[1]) : "";

    // Extract location
    const locMatch = rowHtml.match(/<td\s+class="loc">([\s\S]*?)<\/td>/i);
    const loc = locMatch ? cleanHtml(locMatch[1]) : "";

    const descParts = [what];
    if (founders) descParts.push(`Founders: ${founders}`);
    if (loc) descParts.push(`Location: ${loc}`);
    const description = descParts.filter(Boolean).join(" • ");

    if (companyName && link) {
      items.push({
        title: `${companyName} — Breakout Startup`,
        link,
        pubDate: new Date().toUTCString(),
        description: description || "High-growth breakout startup selected by top venture investors.",
        sourceName,
        sourceId
      });
    }
  }
  return items;
}

async function fetchSomewhereJobs(source: FeedSource, controllerSignal?: AbortSignal): Promise<FetchResult> {
  try {
    const input = encodeURIComponent(JSON.stringify({ "0": { json: { query: "", industries: [], isSourcingUnit: null, countries: [] } } }));
    const url = `https://salarycalculator.somewheretypingtest.com/api/trpc/jobs.getJobs?batch=1&input=${input}`;
    const res = await fetch(url, {
      signal: controllerSignal,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 OpportunityRadar/1.0",
        "Accept": "application/json"
      }
    });
    if (!res.ok) return { items: [], error: `HTTP ${res.status}` };
    const data = await res.json() as any;
    const jobs = data?.[0]?.result?.data?.json?.jobs || [];
    if (jobs.length === 0) return { items: [], error: "Empty job list" };

    return {
      items: jobs.map((j: any) => {
        const company = cleanHtml(j.company_name || j.companyName || j.company?.name || "");
        const title = j.name
          ? `${company ? `${company} — ` : ""}${cleanHtml(j.name)}${j.country ? ` (${j.country})` : ""}`
          : "Remote Opportunity";
        const link = j.slug ? `https://recruitcrm.io/apply/${j.slug}` : "https://somewhere.com/jobs";
        // The slug is the role, not the company, so seed the description with the company.
        const desc = [company ? `Company: ${company}` : "", cleanHtml(j.job_description_text || "")]
          .filter(Boolean)
          .join(" ");
        return {
          title,
          link,
          pubDate: new Date().toUTCString(),
          description: desc.substring(0, 1000) || "Remote opportunity on Somewhere.com",
          sourceName: source.name,
          sourceId: source.id
        };
      })
    };
  } catch (err: any) {
    const msg = err?.message || String(err);
    console.error(`[Fetcher] Failed to fetch Somewhere jobs:`, msg);
    return { items: [], error: msg };
  }
}

export async function fetchFeedItems(source: FeedSource): Promise<FetchResult> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 12000); // 12-second timeout

  try {
    if (source.type === "json" || source.url.includes("somewhere.com") || source.url.includes("somewheretypingtest.com")) {
      return await fetchSomewhereJobs(source, controller.signal);
    }

    const res = await fetch(source.url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 OpportunityRadar/1.0",
        "Accept": "application/rss+xml, application/xml, text/xml, text/html, */*"
      }
    });

    if (!res.ok) {
      console.warn(`[Fetcher] Failed to fetch ${source.name} (${source.url}): HTTP ${res.status}`);
      return { items: [], error: `HTTP ${res.status}` };
    }

    const rawText = await res.text();

    if (source.type === "html" || source.url.includes("breakoutlist.com")) {
      const items = parseBreakoutListHtml(rawText, source.name, source.id);
      // A table-scraped source that yields nothing is broken, not quiet.
      return items.length > 0
        ? { items }
        : { items, error: "HTML parse produced 0 rows" };
    }

    const parsed = parser.parse(rawText);

    const items: RawFeedItem[] = [];

    // RSS 2.0 (<rss><channel><item>...)
    const rssItems = parsed?.rss?.channel?.item;
    if (rssItems) {
      const arr = Array.isArray(rssItems) ? rssItems : [rssItems];
      for (const item of arr) {
        const title = cleanHtml(extractText(item.title));
        const rawLink = extractText(item.link || item.guid);
        const link = typeof rawLink === "string" ? rawLink.trim() : "";
        const pubDate = extractText(item.pubDate || item["dc:date"] || "");
        const description = cleanHtml(extractText(item.description || item["content:encoded"] || ""));

        if (title && link) {
          items.push({
            title,
            link,
            pubDate,
            description,
            sourceName: source.name,
            sourceId: source.id
          });
        }
      }
    }

    // Atom feed (<feed><entry>...)
    const atomEntries = parsed?.feed?.entry;
    if (atomEntries) {
      const arr = Array.isArray(atomEntries) ? atomEntries : [atomEntries];
      for (const entry of arr) {
        const title = cleanHtml(extractText(entry.title));
        let link = "";
        if (entry.link) {
          if (typeof entry.link === "string") {
            link = entry.link;
          } else if (Array.isArray(entry.link)) {
            const alt = entry.link.find((l: any) => l["@_rel"] === "alternate" || !l["@_rel"]);
            link = alt ? alt["@_href"] : entry.link[0]["@_href"];
          } else if (entry.link["@_href"]) {
            link = entry.link["@_href"];
          }
        }
        const pubDate = extractText(entry.published || entry.updated || "");
        const description = cleanHtml(extractText(entry.summary || entry.content || ""));

        if (title && link) {
          items.push({
            title,
            link,
            pubDate,
            description,
            sourceName: source.name,
            sourceId: source.id
          });
        }
      }
    }

// A valid feed with no entries is quiet, not broken. Only real failures carry an error.
return { items };
  } catch (err: any) {
    const msg = err?.message || String(err);
    console.error(`[Fetcher] Error parsing ${source.name}: ${msg}`);
    return { items: [], error: msg };
  } finally {
    clearTimeout(timeoutId);
  }
}
