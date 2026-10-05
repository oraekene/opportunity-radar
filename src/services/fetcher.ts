import { XMLParser } from "fast-xml-parser";
import { FeedSource } from "../types";

export interface RawFeedItem {
  title: string;
  link: string;
  pubDate: string;
  description: string;
  sourceName: string;
}

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  textNodeName: "#text",
  trimValues: true,
  cdataPropName: "__cdata"
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
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function parseBreakoutListHtml(htmlText: string, sourceName: string): RawFeedItem[] {
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
        sourceName
      });
    }
  }
  return items;
}

export async function fetchFeedItems(source: FeedSource): Promise<RawFeedItem[]> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 12000); // 12-second timeout

  try {
    const res = await fetch(source.url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 OpportunityRadar/1.0",
        "Accept": "application/rss+xml, application/xml, text/xml, text/html, */*"
      }
    });

    if (!res.ok) {
      console.warn(`[Fetcher] Failed to fetch ${source.name} (${source.url}): HTTP ${res.status}`);
      return [];
    }

    const rawText = await res.text();

    if (source.type === "html" || source.url.includes("breakoutlist.com")) {
      return parseBreakoutListHtml(rawText, source.name);
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
            sourceName: source.name
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
            sourceName: source.name
          });
        }
      }
    }

    return items;
  } catch (err: any) {
    console.error(`[Fetcher] Error parsing ${source.name}: ${err?.message || err}`);
    return [];
  } finally {
    clearTimeout(timeoutId);
  }
}
