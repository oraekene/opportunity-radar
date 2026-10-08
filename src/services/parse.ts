import type { Eligibility, ParseRule } from "../types";

/**
 * Every field the radar used to leave inside free-text description.
 * Extraction is deliberately regex-based and heuristic: it reads what is
 * already in the feed, it never fetches anything new.
 */

/** Hosts that host a board rather than a company. */
const GENERIC_HOSTS = new Set([
  "greenhouse.io", "lever.co", "workable.com", "ashbyhq.com", "linkedin.com",
  "indeed.com", "remoteok.com", "hnrss.org", "ycombinator.com", "somewhere.com",
  "somewheretypingtest.com", "recruitcrm.io", "weworkremotely.com", "jobspresso.co",
  "opportunitydesk.org", "problogger.com", "remotive.com", "substack.com",
  "workatastartup.com", "wellfound.com", "otta.com", "join.com", "smartrecruiters.com",
  "dice.com", "ziprecruiter.com", "glassdoor.com", "angel.co", "crunchbase.com",
  "breakoutlist.com", "techstars.com", "vccafe.com", "disruptafrica.com", "afterschoolafrica.com",
  "lennysnewsletter.com", "nextplayso.substack.com", "foundersysk.com", "ramp.com"
]);

/** ATS host substrings: path segment is the company, not the host label. */
const ATS_HOST = /(^|\.)(greenhouse|lever|workable|ashbyhq|smartrecruiters|workatastartup|join|recruitee|jobvite|breezy|recruitcrm)\./i;

/** Words that occupy a company or role slot but name nobody. */
const STOPWORDS = new Set([
  "remote", "hybrid", "onsite", "on-site", "on site", "new", "hiring", "apply",
  "job", "jobs", "role", "grant", "grants", "fellowship", "scholarship",
  "company", "we", "our", "the", "this", "that", "comment", "top", "ask",
  "show", "tell", "freelance", "freelancer", "fulltime", "full-time", "parttime",
  "part-time", "contract", "contractor", "wanted", "seeking", "offering",
  "available", "hire", "for", "and", "a", "an", "is", "are", "of", "to", "in",
  "opportunity", "opportunities", "position", "vacancy", "career", "careers",
  "urgent", "intern", "internship", "student", "students", "everyone", "anyone"
]);

/** Region vocabulary. Presence is never proof of eligibility on its own. */
const REGION_TOKENS = [
  "worldwide", "globally", "united states", "united kingdom", "south africa",
  "latin america", "southeast asia", "south east asia", "north america",
  "new zealand", "south america", "central europe", "middle east",
  "worldwide", "emea", "latam", "apac", "africa", "europe", "asia", "america",
  "india", "nigeria", "ghana", "kenya", "canada", "australia", "ireland",
  "germany", "france", "spain", "italy", "poland", "portugal", "netherlands",
  "sweden", "norway", "denmark", "finland", "brazil", "mexico", "japan",
  "singapore", "indonesia", "philippines", "vietnam", "thailand", "pakistan",
  "bangladesh", "egypt", "morocco", "ghana", "rwanda", "uganda", "tanzania",
  "us only", "usa only", "remote"
];

/** Phrases that state an open, location-free scope. */
const OPEN_RE = [
  /\b(?:worldwide|globally|anywhere in the world|any location|anywhere)\b/i,
  /\bno location restriction\b/i,
  /\bopen to (?:applicants|candidates|people|everyone) (?:from|across|worldwide|in)\b/i,
  /\b(?:fully|100%)? ?remote(?:[- ]first| only)?\b/i,
  /\bremote[- ]friendly\b/i,
  /\bfully distributed\b/i
];

/** Phrases that state you cannot apply. */
const RESTRICTED_RE = [
  /\b(?:us|u\.s\.|usa|united states)[- ]only\b/i,
  /\b(?:only|limited) (?:to|for) (?:us|usa|europe|eu|uk) (?:residents|citizens|applicants|people)\b/i,
  /\bmust (?:be|reside|live|work|located) (?:in|based in) the (?:us|usa|uk|eu|canada|australia|united states|kingdom)\b/i,
  /\b(?:based|located) in (?:the )?(?:us|usa|uk|eu|canada|australia|united states|kingdom)\b/i,
  /\bnot eligible (?:for|outside|unless)\b/i,
  /\bwork authorization (?:is )?required\b/i,
  /\b(?:must have|requires?) (?:the )?right to work\b/i,
  /\bsecurity clearance required\b/i,
  /\b(?:hybrid|on[- ]?site|onsite|in[- ]office|in office)\b/i
];

const DEADLINE_RE = /\b(?:deadline|apply by|apply before|closing date|close date|last date|due date|submission deadline|applications? (?:close|closes|are due|are open until|must be (?:in|received|submitted|postmarked) by|end)|closes? (?:on|by)?|closing (?:on|by)?|submit(?:ted)? by|due by|expires? (?:on)?)\s*(?:is|:|-)?\s*(?:on|by|at|until)?\s*([^.;|\n]{4,50})/i;

const MONTHS = /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\b|\b\d{1,2}[/-]\d{1,2}|\b\d{4}-\d{2}-\d{2}|\b(?:today|tomorrow|week|month)\b/i;

const CURRENCY = "(?:US\\$|USD|EUR|GBP|CAD|AUD|NGN|ZAR|KES|\\$|€|£|₦)";
const MONEY_RE = new RegExp(
  `${CURRENCY}\\s?\\d[\\d.,]*\\s?[kKmMbB]?(?:\\s*(?:-|–|—|to|up to)\\s*(?:${CURRENCY}\\s?)?\\d[\\d.,]*\\s?[kKmMbB]?)?`,
  "g"
);

function isStopword(candidate: string): boolean {
  return STOPWORDS.has(candidate.trim().toLowerCase());
}

/** Drop anything that is not name-ish, without losing internal spacing. */
function sanitize(raw: string): string {
  return (raw || "")
    // A bare URL in a name slot means the poster gave no company name.
    .replace(/^\s*(?:https?:\/\/|www\.)\s*/i, "")
    .replace(/[^\w&.'\- ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function titleCase(raw: string): string {
  // A URL in a name slot is not a name. Drop it, unless nothing else is left.
  const withoutUrls = sanitize((raw || "").replace(/https?:\/\/\S+|www\.\S+/gi, " "));
  const base = withoutUrls || sanitize(raw);
  return base
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map(w => (w.length <= 3 && /^[a-z]+$/.test(w) ? w : w[0].toUpperCase() + w.slice(1)))
    .join(" ");
}

/** Company name from an ATS or vanity URL. Empty when the host says nothing. */
export function companyFromLink(link: string): string {
  let u: URL;
  try {
    u = new URL(link);
  } catch {
    return "";
  }
  const host = u.hostname.toLowerCase().replace(/^www\./, "");
  const parts = u.pathname.split("/").filter(Boolean).map(safeDecode);

  if (ATS_HOST.test(host)) {
    // An ATS puts the company first: /acme/jobs/1, /rippling/123, /mercury/.
    const seg = /^apply$/i.test(parts[0] || "") ? parts[1] : parts[0];
    if (!seg || isStopword(seg)) return "";
    return titleCase(seg);
  }

  if (GENERIC_HOSTS.has(host)) {
    // An editorial board only names a company after a path marker.
    const idx = parts.findIndex(p => /^(apply|jobs?|careers?|openings?|positions?)$/i.test(p));
    const seg = idx >= 0 ? parts[idx + 1] : "";
    if (!seg || isStopword(seg)) return "";
    return titleCase(seg);
  }

  // A vanity host names the company. Keep its own casing.
  const label = host.split(".")[0];
  if (label.length < 3 || isStopword(label)) return "";
  return sanitize(label);
}

function safeDecode(seg: string): string {
  try {
    return decodeURIComponent(seg);
  } catch {
    return seg;
  }
}

/** Company name, best evidence first: an explicit label, then the title, then the apply link. */
export function extractCompany(title: string, description: string, link: string): string {
  const desc = description || "";

  const labelled = desc.match(/\b(?:company|company name|employer|organisation|organization|startup)\s*[:\-]\s*([A-Za-z0-9][\w&.'\- ]{1,40})/i);
  if (labelled && !isStopword(labelled[1].trim())) return titleCase(labelled[1]);

  const atTitle = title.match(/\b(?:at|@)\s+([A-Za-z][\w&.'\-]*(?:[ ][A-Z][\w&.'\-]*){0,2})\s*$/);
  if (atTitle && !isStopword(atTitle[1].trim())) return titleCase(atTitle[1]);

  const prefixed = title.match(/^([A-Z][\w&.'\-]{1,20}(?:[ ][A-Z][\w&.'\-]{1,20})?)\s+(?:—|–|-|\||:|is hiring)\s+\S/);
  if (prefixed && !isStopword(prefixed[1].trim())) return titleCase(prefixed[1]);

  const colonTitle = title.match(/^([A-Z][\w&.'\- ]{2,40}):\s+\S/);
  if (colonTitle && !isStopword(colonTitle[1].trim())) return titleCase(colonTitle[1]);

  return companyFromLink(link);
}

/** Countries only. Broad regions like "emea" are regions, not countries. */
const COUNTRY_TOKENS = [
  "united states", "united kingdom", "south africa", "nigeria", "ghana", "kenya",
  "canada", "australia", "new zealand", "ireland", "germany", "france", "spain",
  "italy", "poland", "portugal", "netherlands", "sweden", "norway", "denmark",
  "finland", "brazil", "mexico", "argentina", "colombia", "chile", "peru",
  "japan", "south korea", "singapore", "indonesia", "philippines", "vietnam",
  "thailand", "malaysia", "pakistan", "bangladesh", "sri lanka", "nepal",
  "egypt", "morocco", "tunisia", "rwanda", "uganda", "tanzania", "ethiopia",
  "zambia", "zimbabwe", "botswana", "namibia", "senegal", "nigeria", "cameroon",
  "ivory coast", "ghana", "turkey", "greece", "cyprus", "malta", "israel",
  "united arab emirates", "saudi arabia", "qatar", "kuwait"
];

/**
 * The country an item names, read from the body before the title.
 *
 * The body is where a cold-email pre-filter needs to look: a GTM Product
 * Manager listing put "South Africa" in the description, not the title.
 * Returns "" rather than guessing from a broad region.
 */
export function extractEligibilityCountry(title: string, description: string): string {
  const scan = (text: string): string => {
    const lower = (text || "").toLowerCase();
    let best = "";
    for (const country of COUNTRY_TOKENS) {
      const re = new RegExp(`(?:^|[^a-z])${country}(?:$|[^a-z])`, "i");
      if (re.test(lower) && country.length > best.length) best = country;
    }
    return best;
  };

  return scan(description) || scan(title);
}

/** First region phrase found, longest match wins so "south africa" beats "africa". */
function findRegion(text: string): string {
  const lower = (text || "").toLowerCase();
  let best = "";
  for (const token of REGION_TOKENS) {
    const re = new RegExp(`(?:^|[^a-z])${token.replace(/[-]/g, "\\-")}(?:$|[^a-z])`, "i");
    if (re.test(lower) && token.length > best.length) best = token;
  }
  return best;
}

export interface RegionVerdict {
  region: string;
  eligibility: Eligibility;
  evidence: string;
}

/**
 * A real eligibility verdict with the phrase that produced it.
 * Absence of evidence is "unknown", never "open".
 */
export function extractRegionVerdict(title: string, description: string): RegionVerdict {
  const text = `${title || ""} ${description || ""}`;

  for (const re of RESTRICTED_RE) {
    const m = text.match(re);
    if (m) return { region: findRegion(text), eligibility: "restricted", evidence: m[0].trim() };
  }
  for (const re of OPEN_RE) {
    const m = text.match(re);
    if (m) return { region: findRegion(text), eligibility: "open", evidence: m[0].trim() };
  }
  return { region: findRegion(text), eligibility: "unknown", evidence: "" };
}

/** Deadline in prose, or "" when the text has no date after the cue phrase. */
export function extractDeadline(description: string): string {
  const m = (description || "").match(DEADLINE_RE);
  if (!m) return "";
  // The capture runs to the next sentence, so cut it at the next cue word.
  const value = (m[1] || "")
    .replace(/\s+/g, " ")
    .trim()
    .split(/\s+(?:Apply|Applications|Visit|See|Contact|Email|Details|More|Register|Click)\b/i)[0]
    .replace(/\s+(?:by|on|at|until|is)?\s*$/i, "")
    .replace(/[.;,]+$/, "")
    .trim();
  if (!value || !MONTHS.test(value)) return "";
  return value;
}

/** Salary range in prose. Requires a currency token so counts never match. */
export function extractSalaryBand(description: string, title?: string): string {
  const text = `${title || ""} ${description || ""}`;
  const m = text.match(MONEY_RE);
  return m ? m[0].replace(/\s+/g, " ").trim() : "";
}

export interface ParsedPosting {
  title: string;
  company: string;
  role: string;
}

/**
 * Hacker News "Ask HN: Who is hiring?" items arrive as "New comment by
 * handle in ..." and the payload is a pipe-delimited line. Lift company and
 * role out of it, drop the comment when either is missing.
 */
export function applyHnCommentRule(description: string): ParsedPosting | null {
  const parts = (description || "")
    .split("|")
    .map(p => p.replace(/\s+/g, " ").trim())
    .filter(Boolean);

  if (parts.length < 2) return null;

  const company = titleCase(parts[0]);
  const role = titleCase(parts[1]);
  if (!company || !role || isStopword(company) || isStopword(role)) return null;
  if (company.length < 2 || role.length < 3) return null;

  return { title: `${company} — ${role}`, company, role };
}

/**
 * Per-source parse rule. Returns null when the rule says this item is not
 * an opportunity, so the caller drops it before it reaches KV.
 */
export function applyParseRule(raw: { title: string; description: string }, rule: ParseRule = "directPosting"): ParsedPosting | null {
  if (rule === "hnComment") return applyHnCommentRule(raw.description);
  return { title: raw.title, company: "", role: "" };
}

/** Normalised company plus title, so one job from two boards is one row. */
export function dedupeKeyFor(company: string, title: string): string {
  const norm = (s: string) => (s || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  const c = norm(company);
  let t = norm(title);
  // Strip the company from either end so "Acme Labs — Senior Engineer" and
  // "Senior Engineer at Acme Labs" share one key.
  if (c && t.startsWith(c)) t = t.slice(c.length).trim();
  if (c && t.endsWith(`at ${c}`)) t = t.slice(0, -(`at ${c}`).length).trim();
  return `${c}::${t}`;
}