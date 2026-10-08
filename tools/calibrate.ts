import { readFileSync, writeFileSync } from "node:fs";
import { fetchFeedItems } from "../src/services/fetcher.ts";
import { CATEGORIES } from "../src/config/categories.ts";
import { extractRequirements } from "../src/services/eligibility.ts";

/**
 * Calibration sweep. Not a unit test: it fetches every apply page the radar can
 * see and reports what the extractor found, so the field list and the
 * precision claims can be checked against real pages instead of remembered.
 *
 *   npm run calibrate            # message-record links + every live source
 *   npm run calibrate -- 40      # first 40 pages only
 *
 * Findings this has produced so far, all now covered by test/eligibility.test.ts:
 *   - workHours was recording "full-time" and "part-time", an employment type.
 *   - careerStage missed "junior", "mid-career", "senior scholars", "faculty".
 *   - applicantType missed "open to eligible organizations".
 *   - a multi-country slot was narrowed to one country.
 *   - "up to US $50,000" was read as a country.
 */

function htmlToText(html: string): string {
  return html
    .replace(/<(script|style|nav|header|footer|aside)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<[^>]*>?/gm, " ")
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

const limit = Number(process.argv[2]) || 0;

async function main() {
  const targets: string[] = [];
  const seen = new Set<string>();
  const add = (u: string) => {
    if (u && !seen.has(u)) { seen.add(u); targets.push(u); }
  };

  // The links from the received-message record, when it is present.
  try {
    const raw = readFileSync(
      "shape of what the whatsapp messages actually look like_with links to the full application pages.txt",
      "utf8"
    );
    for (const u of raw.match(/https?:\/\/[^\s)\]<>"']+/g) || []) add(u.replace(/[.,;]$/, ""));
  } catch {
    console.log("(no message-record file in the repo root, live sources only)");
  }

  // Then everything the live sources offer, so all categories are covered.
  for (const cat of CATEGORIES) {
    const settled = await Promise.allSettled(cat.sources.map(s => fetchFeedItems(s)));
    settled.forEach(r => { if (r.status === "fulfilled") r.value.items.forEach(it => add(it.link)); });
  }

  const list = limit > 0 ? targets.slice(0, limit) : targets;
  let ok = 0;
  let withReqs = 0;
  const hits = new Map<string, number>();
  const out: string[] = [];

  for (const url of list) {
    let text = "";
    try {
      const ctl = new AbortController();
      const timer = setTimeout(() => ctl.abort(), 12000);
      const res = await fetch(url, {
        signal: ctl.signal,
        redirect: "follow",
        headers: { "User-Agent": "Mozilla/5.0 OpportunityRadar/1.0", Accept: "text/html,text/plain,*/*" }
      });
      clearTimeout(timer);
      if (!res.ok) continue;
      text = htmlToText(await res.text()).slice(0, 40000);
      ok++;
    } catch {
      continue;
    }

    const reqs = extractRequirements(text);
    if (reqs.length) {
      withReqs++;
      out.push(`\n##### ${url}`);
      for (const r of reqs) {
        hits.set(r.field, (hits.get(r.field) || 0) + 1);
        out.push(`  - ${r.field} = "${r.value}"  <<< "${r.evidence.slice(0, 110)}"`);
      }
    }
  }

  writeFileSync(".calibration.txt", out.join("\n"));
  console.log(`pages ok=${ok}  with requirements: ${withReqs}/${ok}`);
  console.log("field coverage:");
  [...hits.entries()].sort((a, b) => b[1] - a[1]).forEach(([f, n]) => console.log(`  ${String(n).padStart(4)}  ${f}`));
  console.log("\nper-page detail written to .calibration.txt");
}

main();