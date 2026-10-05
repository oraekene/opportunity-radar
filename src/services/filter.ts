import { CategoryDefinition, CategoryKeywordsConfig, OpportunityItem } from "../types";
import { RawFeedItem } from "./fetcher";
import { parseBooleanQuery, evaluateBooleanAST } from "./booleanQuery";

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

export function filterCategoryItems(
  rawItems: RawFeedItem[],
  category: CategoryDefinition,
  maxAgeDays: number = 3,
  customConfig?: CategoryKeywordsConfig
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

    // 2. Full Boolean AST Evaluation (if boolean query active)
    if (booleanAST) {
      const evalRes = evaluateBooleanAST(booleanAST, {
        title: item.title,
        description: item.description,
        sourceName: item.sourceName,
        link: item.link
      });

      if (!evalRes.matches) {
        continue;
      }

      const uniqueTerms = Array.from(new Set(evalRes.matchedTerms.map(t => t.trim())));

      matchedList.push({
        id: `${category.id}:${hashString(item.link)}`,
        title: item.title,
        link: item.link,
        pubDate: item.pubDate,
        description: item.description.length > 800 ? `${item.description.slice(0, 797)}...` : item.description,
        categoryId: category.id,
        categoryName: category.displayName,
        categoryIcon: category.icon,
        sourceName: item.sourceName,
        matchedKeywords: uniqueTerms.length > 0 ? uniqueTerms : ["Boolean Match"],
        crawledAt: new Date().toISOString()
      });
      continue;
    }

    // 3. Simple Keyword Matcher Evaluation
    const textToMatch = `${item.title} ${item.description}`.toLowerCase();

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

    matchedList.push({
      id: `${category.id}:${hashString(item.link)}`,
      title: item.title,
      link: item.link,
      pubDate: item.pubDate,
      description: item.description.length > 800 ? `${item.description.slice(0, 797)}...` : item.description,
      categoryId: category.id,
      categoryName: category.displayName,
      categoryIcon: category.icon,
      sourceName: item.sourceName,
      matchedKeywords: uniqueMatchedTerms,
      crawledAt: new Date().toISOString()
    });
  }

  return matchedList;
}
