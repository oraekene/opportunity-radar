import { OpportunityItem } from "../types";
import { RawFeedItem } from "./fetcher";

/**
 * Supported AST Node Types
 */
export type ASTNode =
  | { type: "AND"; left: ASTNode; right: ASTNode }
  | { type: "OR"; left: ASTNode; right: ASTNode }
  | { type: "NOT"; child: ASTNode }
  | {
      type: "TERM";
      scope: "all" | "title" | "body" | "source" | "url";
      value: string;
      isExact: boolean;
      isWildcard: boolean;
    }
  | { type: "HAS_LINK" }
  | { type: "HAS_MEDIA" };

/**
 * Token Types
 */
type TokenType =
  | "LPAREN"
  | "RPAREN"
  | "AND"
  | "OR"
  | "NOT"
  | "HAS_LINK"
  | "HAS_MEDIA"
  | "SCOPE_TERM" // e.g. title:ai, from:techstars, url:github.com
  | "TERM";

interface Token {
  type: TokenType;
  value: string;
  scope?: "all" | "title" | "body" | "source" | "url";
  isExact?: boolean;
  isWildcard?: boolean;
}

/**
 * Tokenize a Twitter-style advanced boolean query string
 */
export function tokenizeQuery(query: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  const q = query.trim();

  while (i < q.length) {
    const ch = q[i];

    // Skip whitespace
    if (/\s/.test(ch)) {
      i++;
      continue;
    }

    // Parentheses
    if (ch === "(") {
      tokens.push({ type: "LPAREN", value: "(" });
      i++;
      continue;
    }
    if (ch === ")") {
      tokens.push({ type: "RPAREN", value: ")" });
      i++;
      continue;
    }

    // Negation prefix '-' (e.g. -scam, -"high school", -is:reply)
    if (ch === "-") {
      tokens.push({ type: "NOT", value: "NOT" });
      i++;
      continue;
    }

    // Quoted exact phrase: "exact phrase"
    if (ch === '"' || ch === "'") {
      const quoteChar = ch;
      i++;
      let phrase = "";
      while (i < q.length && q[i] !== quoteChar) {
        phrase += q[i];
        i++;
      }
      if (i < q.length && q[i] === quoteChar) {
        i++; // consume closing quote
      }
      tokens.push({
        type: "TERM",
        value: phrase.trim(),
        scope: "all",
        isExact: true,
        isWildcard: false
      });
      continue;
    }

    // Read word/identifier up to whitespace or paren (unless inside quotes)
    let word = "";
    while (i < q.length) {
      const c = q[i];
      if (c === "(" || c === ")") break;
      if (/\s/.test(c)) break;

      if (c === '"' || c === "'") {
        const quoteChar = c;
        word += c;
        i++;
        while (i < q.length && q[i] !== quoteChar) {
          word += q[i];
          i++;
        }
        if (i < q.length && q[i] === quoteChar) {
          word += q[i];
          i++;
        }
      } else {
        word += c;
        i++;
      }
    }

    const upper = word.toUpperCase();

    // Logical Operators
    if (upper === "OR" || word === "||" || word === "|") {
      tokens.push({ type: "OR", value: "OR" });
      continue;
    }
    if (upper === "AND" || word === "&&") {
      tokens.push({ type: "AND", value: "AND" });
      continue;
    }
    if (upper === "NOT" || word === "!") {
      tokens.push({ type: "NOT", value: "NOT" });
      continue;
    }

    // Twitter Operator: has:links or has:link
    if (word.toLowerCase() === "has:links" || word.toLowerCase() === "has:link") {
      tokens.push({ type: "HAS_LINK", value: word });
      continue;
    }

    // Twitter Operator: -has:links
    if (word.toLowerCase() === "-has:links" || word.toLowerCase() === "-has:link") {
      tokens.push({ type: "NOT", value: "NOT" });
      tokens.push({ type: "HAS_LINK", value: "has:links" });
      continue;
    }

    // Scoped directive: title:..., body:..., from:..., source:..., url:...
    const scopeMatch = word.match(/^(title|body|from|source|url):(.+)$/i);
    if (scopeMatch) {
      const rawScope = scopeMatch[1].toLowerCase();
      let rawVal = scopeMatch[2];
      const scope = rawScope === "from" ? "source" : (rawScope as "title" | "body" | "source" | "url");

      // Handle quotes if inside value e.g. title:"ai policy"
      let isExact = false;
      if (rawVal.startsWith('"') || rawVal.startsWith("'")) {
        isExact = true;
        rawVal = rawVal.replace(/^['"]|['"]$/g, "");
      }
      const isWildcard = rawVal.endsWith("*");
      if (isWildcard) rawVal = rawVal.slice(0, -1);

      tokens.push({
        type: "SCOPE_TERM",
        value: rawVal,
        scope,
        isExact,
        isWildcard
      });
      continue;
    }

    // Wildcard term e.g. technol*
    const isWildcard = word.endsWith("*");
    const cleanWord = isWildcard ? word.slice(0, -1) : word;

    tokens.push({
      type: "TERM",
      value: cleanWord,
      scope: "all",
      isExact: false,
      isWildcard
    });
  }

  return tokens;
}

/**
 * Recursive Descent Parser for Boolean AST
 * Grammar:
 *   Expression    := OrExpr
 *   OrExpr        := AndExpr ( 'OR' AndExpr )*
 *   AndExpr       := NotExpr ( ('AND' | implicit) NotExpr )*
 *   NotExpr       := 'NOT' NotExpr | Primary
 *   Primary       := '(' Expression ')' | Term | ScopedTerm | HasLink
 */
export class BooleanQueryParser {
  private tokens: Token[];
  private pos: number = 0;

  constructor(tokens: Token[]) {
    this.tokens = tokens;
  }

  private peek(): Token | undefined {
    return this.tokens[this.pos];
  }

  private consume(): Token {
    return this.tokens[this.pos++];
  }

  public parse(): ASTNode | null {
    if (this.tokens.length === 0) return null;
    const node = this.parseOr();
    return node;
  }

  private parseOr(): ASTNode {
    let left = this.parseAnd();

    while (this.peek()?.type === "OR") {
      this.consume(); // consume OR
      const right = this.parseAnd();
      left = { type: "OR", left, right };
    }

    return left;
  }

  private parseAnd(): ASTNode {
    let left = this.parseNot();

    while (this.pos < this.tokens.length) {
      const next = this.peek();
      if (!next || next.type === "OR" || next.type === "RPAREN") {
        break;
      }

      if (next.type === "AND") {
        this.consume(); // consume AND
      }

      const right = this.parseNot();
      left = { type: "AND", left, right };
    }

    return left;
  }

  private parseNot(): ASTNode {
    if (this.peek()?.type === "NOT") {
      this.consume(); // consume NOT
      const child = this.parseNot();
      return { type: "NOT", child };
    }
    return this.parsePrimary();
  }

  private parsePrimary(): ASTNode {
    const token = this.peek();

    if (!token) {
      return { type: "TERM", scope: "all", value: "", isExact: false, isWildcard: false };
    }

    if (token.type === "LPAREN") {
      this.consume(); // consume '('
      const expr = this.parseOr();
      if (this.peek()?.type === "RPAREN") {
        this.consume(); // consume ')'
      }
      return expr;
    }

    if (token.type === "HAS_LINK") {
      this.consume();
      return { type: "HAS_LINK" };
    }

    if (token.type === "SCOPE_TERM") {
      this.consume();
      return {
        type: "TERM",
        scope: token.scope || "all",
        value: token.value,
        isExact: !!token.isExact,
        isWildcard: !!token.isWildcard
      };
    }

    // Default: TERM
    this.consume();
    return {
      type: "TERM",
      scope: "all",
      value: token.value,
      isExact: !!token.isExact,
      isWildcard: !!token.isWildcard
    };
  }
}

/**
 * Parse a raw boolean query string into an AST
 */
export function parseBooleanQuery(query: string): ASTNode | null {
  if (!query || !query.trim()) return null;
  try {
    const tokens = tokenizeQuery(query);
    const parser = new BooleanQueryParser(tokens);
    return parser.parse();
  } catch (err) {
    console.warn(`[BooleanQuery] Failed to parse query "${query}":`, err);
    return null;
  }
}

/**
 * Helper to match a term against a target string with word boundaries
 */
function matchTermInText(
  targetText: string,
  term: string,
  isExact: boolean,
  isWildcard: boolean
): { matched: boolean; matchValue?: string } {
  if (!term || !targetText) return { matched: false };
  const cleanTerm = term.trim();
  if (!cleanTerm) return { matched: false };

  try {
    if (isWildcard) {
      const escaped = cleanTerm.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const rx = new RegExp(`\\b${escaped}\\w*\\b`, "i");
      const m = targetText.match(rx);
      return { matched: !!m, matchValue: m ? m[0] : undefined };
    }

    if (isExact) {
      const escaped = cleanTerm.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const rx = new RegExp(`\\b${escaped}\\b`, "i");
      const m = targetText.match(rx);
      return { matched: !!m, matchValue: m ? m[0] : undefined };
    }

    // General word match
    const escaped = cleanTerm.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const rx = new RegExp(`\\b${escaped}\\b`, "i");
    const m = targetText.match(rx);
    return { matched: !!m, matchValue: m ? m[0] : undefined };
  } catch {
    const idx = targetText.toLowerCase().indexOf(cleanTerm.toLowerCase());
    return { matched: idx >= 0, matchValue: cleanTerm };
  }
}

export interface MatchContext {
  title: string;
  description: string;
  sourceName: string;
  link: string;
}

/**
 * Evaluate an ASTNode against opportunity item context
 */
export function evaluateBooleanAST(
  node: ASTNode | null,
  context: MatchContext
): { matches: boolean; matchedTerms: string[] } {
  if (!node) return { matches: true, matchedTerms: [] };

  switch (node.type) {
    case "AND": {
      const left = evaluateBooleanAST(node.left, context);
      if (!left.matches) return { matches: false, matchedTerms: [] };
      const right = evaluateBooleanAST(node.right, context);
      if (!right.matches) return { matches: false, matchedTerms: [] };
      return {
        matches: true,
        matchedTerms: Array.from(new Set([...left.matchedTerms, ...right.matchedTerms]))
      };
    }

    case "OR": {
      const left = evaluateBooleanAST(node.left, context);
      const right = evaluateBooleanAST(node.right, context);
      if (left.matches || right.matches) {
        return {
          matches: true,
          matchedTerms: Array.from(new Set([...left.matchedTerms, ...right.matchedTerms]))
        };
      }
      return { matches: false, matchedTerms: [] };
    }

    case "NOT": {
      const res = evaluateBooleanAST(node.child, context);
      return { matches: !res.matches, matchedTerms: [] };
    }

    case "HAS_LINK": {
      const has = !!context.link && context.link.startsWith("http");
      return { matches: has, matchedTerms: has ? ["has:links"] : [] };
    }

    case "HAS_MEDIA": {
      return { matches: true, matchedTerms: [] };
    }

    case "TERM": {
      let targetText = "";
      switch (node.scope) {
        case "title":
          targetText = context.title;
          break;
        case "body":
          targetText = context.description;
          break;
        case "source":
          targetText = context.sourceName;
          break;
        case "url":
          targetText = context.link;
          break;
        case "all":
        default:
          targetText = `${context.title} ${context.description} ${context.sourceName}`;
          break;
      }

      const res = matchTermInText(targetText, node.value, node.isExact, node.isWildcard);
      if (res.matched) {
        return {
          matches: true,
          matchedTerms: [res.matchValue || node.value]
        };
      }
      return { matches: false, matchedTerms: [] };
    }
  }
}
