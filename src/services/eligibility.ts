import type { OpportunityItem } from "../types";
import { extractDeadline, extractEligibilityCountry } from "./parse.ts";

/**
 * The seven parameters a reviewer states and a candidate has to satisfy.
 * Every field is toggleable: "enforce" blocks, "warn" notes it, "ignore" drops
 * it. Nothing is enforced unless you turn it on.
 */
export const ELIGIBILITY_FIELDS = [
  "country",
  "ageBand",
  "yearsExperience",
  "educationLevel",
  "fieldOfStudy",
  "requiredDocuments",
  "deadline"
] as const;

export type EligibilityField = (typeof ELIGIBILITY_FIELDS)[number];

export type EnforcementMode = "enforce" | "warn" | "ignore";

/** Every field defaults to warn. The radar notes a requirement, never blocks on it unasked. */
export const DEFAULT_ENFORCEMENT: Record<EligibilityField, EnforcementMode> = {
  country: "warn",
  ageBand: "warn",
  yearsExperience: "warn",
  educationLevel: "warn",
  fieldOfStudy: "warn",
  requiredDocuments: "warn",
  deadline: "warn"
};

export interface EligibilityProfile {
  /** Per-field toggle. Absent fields fall back to DEFAULT_ENFORCEMENT. */
  enforcement: Partial<Record<EligibilityField, EnforcementMode>>;
  /** Your own answers. Empty means unknown, never a guess. */
  country?: string;
  ageBand?: string;
  yearsExperience?: number;
  educationLevel?: string;
  fieldOfStudy?: string;
  documentsHeld?: string;
}

export interface Requirement {
  field: EligibilityField;
  /** What the page says, or "" when the page did not say. */
  value: string;
  /** The phrase that produced the value. Required: a verdict without a citation is not usable. */
  evidence: string;
}

export type CheckVerdict = "pass" | "fail" | "unknown";

export interface EligibilityCheck {
  field: EligibilityField;
  requirement: string;
  evidence: string;
  verdict: CheckVerdict;
  mode: EnforcementMode;
  /** Plain reason, always present so nothing fails silently. */
  reason: string;
}

export interface EligibilityAssessment {
  checks: EligibilityCheck[];
  /** Fields set to enforce where the requirement fails. */
  blocking: EligibilityField[];
  /** Fields set to warn where the requirement fails. Worth reading, not blocking. */
  warnings: EligibilityField[];
}

const AGE_RE = /\b(\d{1,2})\s*(?:-|–|to)\s*(\d{1,2})\s*(?:years?\s*old|yrs?)/i;
const AGE_SINGLE_RE = /\b(?:aged?|age)\s*(\d{1,2})\s*(?:and\s*older|or\s*younger|\+)?/i;
const UNDER_RE = /\bunder\s*(\d{2})\s*(?:years?\s*old|yrs?)?/i;
const YEARS_RE = /\b(?:minimum\s*of\s*)?(\d{1,2})\+?\s*(?:years?|yrs?)\s+(?:of\s+)?(?:professional\s+|relevant\s+|industry\s+|work\s+)?experience/i;
const MIN_AGE_RE = /\b(?:minimum|at least|not less than)\s*(?:age of\s*)?(\d{2})\s*(?:years?\s*old|yrs?)/i;

/** The cue phrase plus the date, so a deadline check still has a citation. */
const DEADLINE_EVIDENCE_RE = /\b(?:deadline|apply by|apply before|closing date|close date|last date|due date|applications? (?:close|closes|are due)|closes? on|submit(?:ted)? by)\s*(?:is|:|-)?\s*(?:on|by|at|until)?\s*[^.;|\n]{4,50}/i;

/** Education levels, most specific first. */
const EDU_RE = /\b(ph\.?d|doctorate|doctoral|master'?s?|m\.?sc|msc|mba|b\.?sc|bsc|bachelor'?s?|undergraduate|postgraduate|diploma|associate'?s? degree|secondary school|high school|primary school)\b/i;

/**
 * Requirements are only read from a real eligibility section.
 *
 * Reading the whole page does not work: navigation menus and related-article
 * lists contain "Undergraduate", "Study in Africa" and "years of experience",
 * and a bare country name in a social footer will happily block a fellowship
 * that has nothing to do with it. So find an anchor, take the text under it,
 * and keep it only when it actually states something.
 */
const ANCHOR_RE = /\b(eligibility|eligible|who can apply|who is eligible|who may apply|requirements?|criteria|minimum|how to apply|application (?:criteria|requirements)|admission)\b/gi;

/** Something a gate actually looks like, not a menu label. */
const REQUIREMENT_SIGNAL =
  /\b(\d{1,2}\s*[-–]\s*\d{1,2}\s*years?|years?\s+of\s+experience|degree|cgpa|gpa|documents?|citizen|national|residen\w*|at\s+least|undergraduate|postgraduate|master'?s?|ph\.?d|doctorate|bachelor'?s?|diploma)\b/i;

const SECTION_WINDOW_BEFORE = 400;
const SECTION_WINDOW_AFTER = 700;

function eligibilityContext(t: string): string {
  const re = new RegExp(ANCHOR_RE.source, "gi");
  const spans: string[] = [];
  let m: RegExpExecArray | null;

  while ((m = re.exec(t)) !== null) {
    const start = Math.max(0, m.index - SECTION_WINDOW_BEFORE);
    const window = t.slice(start, m.index + SECTION_WINDOW_AFTER);
    if (REQUIREMENT_SIGNAL.test(window)) spans.push(window);
    if (spans.length >= 6) break;
  }

  return spans.join(" \n ").slice(0, 3000);
}

/**
 * A country is only a gate when it sits in the grammatical slot a gate
 * preposition leaves open: "citizens of Nigeria", "residents of Ghana",
 * "must be based in Kenya", "open to applicants from India".
 */
const COUNTRY_GATE_PATTERNS: RegExp[] = [
  /\b(?:citizens?|nationals?|residents?|people|applicants?|candidates?)\s+(?:of|from|in)\s+([A-Za-z][A-Za-z .'-]{2,28})/i,
  /\b(?:must|should)\s+(?:be|reside|live|work|study)\s+(?:based|located)\s+in\s+([A-Za-z][A-Za-z .'-]{2,28})/i,
  /\b(?:open to|eligible for|eligible to|restricted to|only for|limited to)\s+([A-Za-z][A-Za-z .'-]{2,28})/i,
  /\b(?:citizenship|nationality|residency)\s+of\s+([A-Za-z][A-Za-z .'-]{2,28})/i,
  // "admission into an eligible Federal University in Nigeria"
  /\b(?:admission|admitted|matriculation)\s+(?:into|to)\s+(?:an?\s+|the\s+)?(?:eligible\s+|accredited\s+|recognised\s+|recognized\s+)?[A-Za-z ]{0,24}(?:university|college|polytechnic|institute)\s+(?:in|at)\s+([A-Za-z][A-Za-z .'-]{2,28})/i
];

function findCountryGate(t: string): { value: string; evidence: string } | null {
  for (const pattern of COUNTRY_GATE_PATTERNS) {
    const m = t.match(pattern);
    if (!m) continue;
    const slot = m[1];
    const country = extractEligibilityCountry("", slot);
    // The slot has to actually be a country, not "Nigeria and Ghana applicants".
    if (country && normalise(slot).split(" ").includes(country)) {
      return { value: country, evidence: m[0] };
    }
  }
  return null;
}

/**
 * Requirements stated in the page text. Every entry carries the phrase it came
 * from. A field the page does not mention is absent, not empty-and-passing.
 */
export function extractRequirements(text: string): Requirement[] {
  const out: Requirement[] = [];
  const full = (text || "").replace(/\s+/g, " ");
  if (!full) return out;
  const t = eligibilityContext(full);
  if (!t) return out;

  const push = (field: EligibilityField, value: string, evidence: string) => {
    const clean = value.replace(/\s+/g, " ").trim();
    const cite = evidence.replace(/\s+/g, " ").trim();
    if (clean && cite && !out.some(r => r.field === field)) out.push({ field, value: clean, evidence: cite.slice(0, 160) });
  };

  // Country gate
  const countryGate = findCountryGate(t);
  if (countryGate) push("country", countryGate.value, countryGate.evidence);

  // Age band: "18-25 years old", "aged 18+", "under 21", "minimum age of 18"
  let m = t.match(AGE_RE);
  if (m) push("ageBand", `${m[1]}-${m[2]} years old`, m[0]);

  if (!out.some(r => r.field === "ageBand")) {
    m = t.match(UNDER_RE);
    if (m) push("ageBand", `under ${m[1]} years old`, m[0]);
  }
  if (!out.some(r => r.field === "ageBand")) {
    m = t.match(MIN_AGE_RE);
    if (m) push("ageBand", `${m[1]} years old or older`, m[0]);
  }
  if (!out.some(r => r.field === "ageBand")) {
    m = t.match(AGE_SINGLE_RE);
    if (m) push("ageBand", `aged ${m[1]}`, m[0]);
  }

  // Years of experience: "minimum of 8 years of experience"
  m = t.match(YEARS_RE);
  if (m) push("yearsExperience", `${m[1]} years of experience`, m[0]);

  // Education level
  m = t.match(EDU_RE);
  if (m) push("educationLevel", m[1], m[0]);

  // "admission into an eligible Federal University" is an undergraduate gate
  if (!out.some(r => r.field === "educationLevel")) {
    m = t.match(/\b(?:secured|have|hold|gain)?\s*admission (?:into|to|from)\s+(?:an?\s+)?(?:eligible\s+|accredited\s+|recognised\s+|recognized\s+)?[A-Za-z ]{0,20}(university|college|polytechnic|school|institute)/i);
    if (m) push("educationLevel", `${m[1]} admission (undergraduate)`, m[0]);
  }

  // Field of study: "in the field of AI policy", "degree in public health".
  // Two words minimum, because a single trailing word is almost always the
  // fragment of a cut-off phrase ("degree in natural", "Study in the").
  m = t.match(/\b(?:field of study|study in|major in|degree in|graduating in)\s+([A-Za-z][A-Za-z&'-]*(?:\s+[A-Za-z&'-]+){1,4})/i);
  if (m) {
    const value = m[1].replace(/^(?:the|a|an|of|in)\s+/i, "").trim();
    if (value.split(/\s+/).length >= 2) push("fieldOfStudy", value, m[0]);
  }

  // Required documents. Group 1 is the list.
  m = t.match(/\b(?:required|must (?:be )?(?:submit|provide|attach|upload))[a-z ]{0,20}(?:documents?|materials?|items?)\s*(?:are|include|is|:)?\s*([^.;]{4,140})/i);
  if (m) push("requiredDocuments", m[1], m[0]);

  // Deadline is informational and usually sits outside the eligibility block, so
  // it is read from the whole page rather than from the section.
  const dl = extractDeadline(full);
  if (dl) push("deadline", dl, (full.match(DEADLINE_EVIDENCE_RE) || [dl])[0]);

  return out;
}

function normalise(s: string): string {
  return (s || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

/** Three-way compare. Absent profile data is unknown, never a pass. */
function compare(requirement: string, yours: string | undefined | number): CheckVerdict {
  const req = normalise(String(requirement));
  const mine = normalise(String(yours ?? ""));
  if (!req || !mine) return "unknown";
  return req.includes(mine) || mine.includes(req) ? "pass" : "fail";
}

/**
 * Compare stated requirements against your profile.
 *
 * A field the page never mentions is not checked. A field it mentions but you
 * have not answered is unknown. Unknown never blocks, so a half-filled profile
 * cannot silently hide opportunities.
 */
export function assessEligibility(
  requirements: Requirement[],
  profile: EligibilityProfile
): EligibilityAssessment {
  const checks: EligibilityCheck[] = [];
  const blocking: EligibilityField[] = [];
  const warnings: EligibilityField[] = [];

  for (const req of requirements) {
    const mode = profile.enforcement[req.field] ?? DEFAULT_ENFORCEMENT[req.field];
    if (mode === "ignore") continue;

    let verdict: CheckVerdict;
    let reason: string;

    switch (req.field) {
      case "country": {
        verdict = compare(req.value, profile.country);
        reason = verdict === "unknown"
          ? "No country set in your profile."
          : verdict === "pass"
            ? `Matches your country (${profile.country}).`
            : `Wants ${req.value}; your profile says ${profile.country}.`;
        break;
      }
      case "ageBand":
      case "yearsExperience":
      case "educationLevel":
      case "fieldOfStudy": {
        const yours = (profile as any)[req.field];
        verdict = compare(req.value, yours);
        reason = verdict === "unknown"
          ? `No ${req.field} set in your profile.`
          : verdict === "pass"
            ? `Matches your ${req.field} (${yours}).`
            : `Wants ${req.value}; your profile says ${yours}.`;
        break;
      }
      case "requiredDocuments": {
        verdict = compare(req.value, profile.documentsHeld);
        reason = verdict === "unknown"
          ? "No documents recorded in your profile."
          : verdict === "pass"
            ? `Your documents cover: ${req.value}.`
            : `Wants: ${req.value}.`;
        break;
      }
      case "deadline": {
        // A deadline is informational. The item already carries one.
        verdict = "pass";
        reason = `Deadline ${req.value}.`;
        break;
      }
      default:
        verdict = "unknown";
        reason = "Not checked.";
    }

    checks.push({ field: req.field, requirement: req.value, evidence: req.evidence, verdict, mode, reason });

    if (verdict === "fail") {
      if (mode === "enforce") blocking.push(req.field);
      else warnings.push(req.field);
    }
  }

  return { checks, blocking, warnings };
}

/** Attach an assessment to an item. The item keeps the checks either way. */
export function applyAssessment(item: OpportunityItem, requirements: Requirement[], profile: EligibilityProfile): EligibilityAssessment {
  const assessment = assessEligibility(requirements, profile);
  item.eligibilityRequirements = requirements;
  item.eligibilityChecks = assessment.checks;
  item.eligibilityBlocking = assessment.blocking;
  item.eligibilityWarnings = assessment.warnings;
  return assessment;
}