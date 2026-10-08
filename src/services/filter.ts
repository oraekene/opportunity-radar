import { CategoryDefinition, CategoryKeywordsConfig, FeedSource, OpportunityItem } from "../types";
import { RawFeedItem } from "./fetcher";
import { parseBooleanQuery, evaluateBooleanAST } from "./booleanQuery";
import { applyParseRule, dedupeKeyFor, extractCompany, extractDeadline, extractRegionVerdict, extractSalaryBand } from "./parse";

function hashString(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}

export function parseKeywordsToRegex(text?: string): RegExp[] {
  if (!text || !text.trim()) return [];
  const items = text.split(/[\n,]+/).map(s => s.trim()).filter(Boolean);
  const regexes: RegExp[] = [];

  for (const term of items) {
    try {
      if (term.startsWith("/") && term.lastIndexOf("/") > 0) {
        const lastSlash = term.lastIndexOf("/");
        const pattern = term.slice(1, lastSlash);
        const flags = term.slice(lastSlash + 1) || "i";
        regexes.push(new RegExp(pattern, flags));
      } else {
        const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        regexes.push(new RegExp(`\\b${escaped}\\b`, "i"));
      }
    } catch {
      regexes.push(new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"));
    }
  }

  return regexes;
}

/** Every matched item, with the fields lifted out of the free text. */
function buildItem(
  raw: RawFeedItem,
  category: CategoryDefinition,
  title: string,
  company: string,
  matchedKeywords: string[],
  carriesApplication: boolean
): OpportunityItem {
  const verdict = extractRegionVerdict(title, raw.description);
  return {
    id: `${category.id}:${hashString(raw.link)}`,
    dedupeKey: dedupeKeyFor(company, title),
    title,
    link: raw.link,
    pubDate: raw.pubDate,
    description: raw.description.length > 800 ? `${raw.description.slice(0, 797)}...` : raw.description,
    company,
    region: verdict.region,
    eligibility: verdict.eligibility,
    eligibilityEvidence: verdict.evidence,
    deadline: extractDeadline(raw.description),
    salaryBand: extractSalaryBand(raw.description, title),
    isOpportunity: carriesApplication,
    routeTo: category.routeTo,
    categoryId: category.id,
    categoryName: category.displayName,
    categoryIcon: category.icon,
    sourceName: raw.sourceName,
    matchedKeywords,
    crawledAt: new Date().toISOString()
  };
}

export function filterCategoryItems(
  rawItems: RawFeedItem[],
  category: CategoryDefinition,
  maxAgeDays: number = 3,
  customConfig?: CategoryKeywordsConfig,
  sourceById: Map<string, FeedSource> = new Map()
): OpportunityItem[] {
  const matchedList: OpportunityItem[] = [];
  const now = Date.now();
  const maxAgeMs = maxAgeDays * 24 * 60 * 60 * 1000;

  // Check if Boolean Mode is active and query is provided
  const isBooleanMode = customConfig?.mode === "boolean" && !!customConfig?.booleanQuery?.trim();
  const booleanAST = isBooleanMode ? parseBooleanQuery(customConfig!.booleanQuery!) : null;

  // Simple Mode fallback regex rules
  const customInclude = parseKeywordsToRegex(customConfig?.includeText);
  const customExclude = parseKeywordsToRegex(customConfig?.excludeText);

  const activeInclude = customInclude.length > 0 ? customInclude : category.keywords.include;
  const activeExclude = customExclude.length > 0 ? customExclude : category.keywords.exclude;

  for (const item of rawItems) {
    // 1. Check Date (skip if older than maxAgeDays)
    if (item.pubDate) {
      const parsedTime = Date.parse(item.pubDate);
      if (!isNaN(parsedTime) && now - parsedTime > maxAgeMs) {
        continue;
      }
    }

    const source = sourceById.get(item.sourceId);
    const parseRule = source?.parseRule ?? "directPosting";
    const carriesApplication = source?.carriesApplication ?? true;

    // 2. Per-source parse rule. A rule that cannot find company and role drops the item.
    const posting = applyParseRule(item, parseRule);
    if (!posting) {
      continue;
    }
    const title = posting.title;
    const description = `${item.description}`;

    // 3. Full Boolean AST Evaluation (if boolean query active)
    if (booleanAST) {
      const evalRes = evaluateBooleanAST(booleanAST, {
        title,
        description,
        sourceName: item.sourceName,
        link: item.link
      });

      if (!evalRes.matches) {
        continue;
      }

      const uniqueTerms = Array.from(new Set(evalRes.matchedTerms.map(t => t.trim())));
      const company = posting.company || extractCompany(title, description, item.link);

      matchedList.push(
        buildItem(item, category, title, company, uniqueTerms.length > 0 ? uniqueTerms : ["Boolean Match"], carriesApplication)
      );
      continue;
    }

    // 4. Simple Keyword Matcher Evaluation
    const textToMatch = `${title} ${description}`.toLowerCase();

    // Check Exclusions
    const isExcluded = activeExclude.some(regex => regex.test(textToMatch));
    if (isExcluded) {
      continue;
    }

    // Check Inclusions
    const matchedTerms: string[] = [];
    for (const regex of activeInclude) {
      const match = textToMatch.match(regex);
      if (match) {
        matchedTerms.push(match[0]);
      }
    }

    if (matchedTerms.length === 0) {
      continue;
    }

    const uniqueMatchedTerms = Array.from(new Set(matchedTerms.map(t => t.trim())));
    const company = posting.company || extractCompany(title, description, item.link);

    matchedList.push(buildItem(item, category, title, company, uniqueMatchedTerms, carriesApplication));
  }

  return matchedList;
}