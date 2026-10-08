import type { OpportunityItem } from "../types";
import { extractAllCountries, extractDeadline, US_LOCATION_RE } from "./parse.ts";

/**
 * The parameters a reviewer states and a candidate has to satisfy.
 * Every field is toggleable: "enforce" blocks, "warn" notes it, "ignore" drops
 * it. Nothing is enforced unless you turn it on.
 *
 * The list grew from 7 to 18 on 2026-10-08 after 20 full apply pages were read
 * (grants, fellowships, scholarships, jobs). Those pages carried gates the
 * original seven had no name for: a women-only rule, an on-site or work
 * authorisation rule, a "currently enrolled" student-status rule, an
 * early-career definition, a CGPA floor, an IELTS floor, a weekly-hours
 * commitment, a companies-only rule and a membership prerequisite.
 */
export const ELIGIBILITY_FIELDS = [
  "country",
  "nationality",
  "residencyOrWorkAuth",
  "ageBand",
  "gender",
  "educationLevel",
  "enrolmentStatus",
  "careerStage",
  "yearsExperience",
  "academicGrade",
  "fieldOfStudy",
  "standardisedTest",
  "language",
  "workHours",
  "applicantType",
  "organisationStatus",
  "requiredDocuments",
  "employmentType",
  "workMode",
  "timezoneOverlap",
  "visaSponsorship",
  "fundingType",
  "salaryDisclosed",
  "skillsRequired",
  "capacity",
  "proposalRequirement",
  "deadline"
] as const;

/**
 * The four shown directly in Settings; the rest sit under Advanced Settings.
 * They are the four that most often stated an un-overridable bar, and they
 * split into the four distinct ways geography and standing get gated: an
 * eligible-country list, an on-site or work-authorisation rule, an age band or
 * cap, and a required level of education. Display order only, no weighting.
 */
export const TOP_ELIGIBILITY_FIELDS = [
  "country",
  "residencyOrWorkAuth",
  "ageBand",
  "educationLevel"
] as const satisfies readonly EligibilityField[];

export type EligibilityField = (typeof ELIGIBILITY_FIELDS)[number];

/** Everything not in TOP_ELIGIBILITY_FIELDS. This is what the accordion holds. */
export const ADVANCED_ELIGIBILITY_FIELDS = ELIGIBILITY_FIELDS.filter(
  f => !(TOP_ELIGIBILITY_FIELDS as readonly string[]).includes(f)
) as readonly EligibilityField[];

export type EnforcementMode = "enforce" | "warn" | "ignore";

/** Every field defaults to warn. The radar notes a requirement, never blocks on it unasked. */
export const DEFAULT_ENFORCEMENT: Record<EligibilityField, EnforcementMode> = {
  country: "warn",
  nationality: "warn",
  residencyOrWorkAuth: "warn",
  ageBand: "warn",
  gender: "warn",
  educationLevel: "warn",
  enrolmentStatus: "warn",
  careerStage: "warn",
  yearsExperience: "warn",
  academicGrade: "warn",
  fieldOfStudy: "warn",
  standardisedTest: "warn",
  language: "warn",
  workHours: "warn",
  applicantType: "warn",
  organisationStatus: "warn",
  requiredDocuments: "warn",
  employmentType: "warn",
  workMode: "warn",
  timezoneOverlap: "warn",
  visaSponsorship: "warn",
  fundingType: "warn",
  salaryDisclosed: "warn",
  skillsRequired: "warn",
  capacity: "warn",
  proposalRequirement: "warn",
  deadline: "warn"
};

export interface EligibilityProfile {
  /** Per-field toggle. Absent fields fall back to DEFAULT_ENFORCEMENT. */
  enforcement: Partial<Record<EligibilityField, EnforcementMode>>;
  /** Your own answers. Empty means unknown, never a guess. */
  country?: string;
  nationality?: string;
  residencyOrWorkAuth?: string;
  ageBand?: string;
  gender?: string;
  educationLevel?: string;
  enrolmentStatus?: string;
  careerStage?: string;
  yearsExperience?: number;
  academicGrade?: string;
  fieldOfStudy?: string;
  employmentType?: string;
  workMode?: string;
  timezoneOverlap?: string;
  standardisedTest?: string;
  language?: string;
  workHours?: string;
  applicantType?: string;
  organisationStatus?: string;
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
/** "aged 35 or below as at the deadline" and "30 or younger in the year of application". */
const AGE_CAP_RE = /\baged?\s*(\d{1,2})\s*years?\s*or\s*(?:younger|less|below|under)\b|\b(\d{1,2})\s*years?\s*old\s+or\s*younger\b/i;
const AGE_YEAR_RE = /\bbe\s*(\d{1,2})\s*years?\s*old\s+or\s*younger\s+in\s+the\s+year\b/i;
/** A women-only or men-only track. */
const GENDER_RE = /\b(?:women|female|men|male|girls|boys)[- ]only\b|\bonly\s+(?:women|females|men|males)\b|\b(?:open|for)\s+to\s+women\b|\bfemale\s+(?:researcher|applicants?|students?|candidates?|fellows?)\b|\bwomen\s+aged\b/i;
/** "US work authorization required." states the gate without ever saying "only". */
const WORK_AUTH_RE = /\b(?:us|u\.s\.|united states)\s+work\s+authori[sz]ation\s+(?:is\s+)?required\b|\bwork\s+authori[sz]ation\s+required\b|\bmust\s+be\s+(?:a\s+)?(?:u\.s\.|us)\s+citizen\b|\brequire[sd]?\s+(?:a\s+)?security\s+clearance\b/i;
const ON_SITE_RE = /\bon-?site\b|\bin-?person\b/i;
/**
 * "early career", "graduate degree no earlier than 2021", and the very common
 * "junior and mid-career" / "senior scholars" phrasing the calibration sweep
 * found on 86 of 348 real pages.
 */
const CAREER_STAGE_RE = /\bearly[- ]career\b|\brecent\s+graduat|\bgraduate\s+degree\s+no\s+earlier\s+than\s+\d{4}|\bno\s+earlier\s+than\s+\d{4}\b|\byoung\s+professional|\bfresh\s+graduate|\bjunior\b|\bmid[- ]?career\b|\bsenior\s+(?:scholars?|researchers?|fellows?|professionals?|people)\b|\bfaculty\b|\bpostdoc/i;
/** "currently enrolled in an accredited tertiary institution". */
const ENROLMENT_RE = /\bcurrently\s+enrolled\b|\bmust\s+be\s+enrolled\b|\benrolled\s+in\s+(?:an?\s+)?(?:accredited|eligible|recogni[sz]ed)\b|\b(?:must|should)\s+be\s+(?:currently\s+)?(?:pursuing|studying)\b|\bin\s+candidature\b/i;
/** Both sides take trailing zeros: "3.70/4.00" must not truncate to "3.7". */
const GRADE_RE = /\b(?:minimum\s+)?(?:CGPA|GPA)\s*(?:of\s*)?(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)/i;
const TEST_RE = /(?:IELTS|TOEFL)[^.;]{0,30}?(\d+(?:\.\d+)?)|CEFR\s*([ABC][12])/i;
/** A topic whitelist: thrust areas, tracks, themes, species. */
const TOPIC_RE = /(?:thrust\s+areas?|disciplines?|fields?\s+of\s+study|special\s+tracks?|theme|focus(?:es)?\s+on|must\s+pursue\s+research\s+within)\s*:?\s*([^.;]{4,120})/i;
const LANGUAGE_REQ_RE = /(?:application|applications|essay|submissions?)\s+shall\s+be\s+made\s+in\s+([A-Z][a-z]+)|\blanguage\s*:?\s*([A-Z][a-z]+)|\bsubmitted\s+in\s+([A-Z][a-z]+)/i;
/** A commitment gate: hours, availability, working time. */
// Full-time and part-time are an employment TYPE, not an hours commitment.
// They are captured by employmentType, so they must not also land here.
const HOURS_RE = /\b\d{1,2}\s*(?:-\s*\d{1,2}\s*)?h(?:rs?)?\.?\s*\/\s*week\b|\b\d{1,2}\s*(?:-\s*\d{1,2}\s*)?hours?\s+(?:per|a)\s+week\b|\bmust\s+be\s+available\b|\bfull\s+availability\b|\b\d{1,2}\s*(?:-\s*\d{1,2}\s*)?days?\s+(?:per|a)\s+week\b/i;
/** Who may apply at all: companies only, universities only, nonprofits. */
const APPLICANT_TYPE_RE = /(?:designed\s+for|open\s+to|reserved\s+for|for)\s+(?:eligible\s+)?(?:companies|corporates?|non-?profits?|universit(?:y|ies)|organi[sz]ations?|NGOs?|SMEs?|start-?ups?|individuals?|candidates?)\b|(?:companies|corporates?|non-?profits?|universit(?:y|ies)|organi[sz]ations?|NGOs?)\s+only\b|\bfor\s+(?:people|professionals?|graduates?|students?|researchers?)\s+(?:working|employed)\b/i;
/** A prerequisite the applicant already has: membership, registration, affiliation. */
const ORG_STATUS_RE = /\bparticipants?\s+of\s+the\s+[A-Z][A-Za-z\s]{2,40}|\bmust\s+be\s+(?:a\s+)?(?:registered|member)\b|\brequired\s+to\s+(?:join|be\s+a\s+member)|\b(?:currently\s+)?(?:engaged|affiliated|employed)\s+(?:with|at)\s+(?:a|an|the)\b|\b(?:affiliated|employed)\s+with\s+(?:a|an)\b|\b(?:at|with)\s+a\s+(?:university|college|polytechnic|institute|organi[sz]ation|research\s+cent(?:re|er)|non-?profit|company)\b|\bwilling\s+to\s+join\b/i;
const NATIONALITY_RE = /\bnationals?\s+of\s+([A-Z][A-Za-z\s,]{2,60})/i;
/** "8+ years in ML / Data Science" states the gate with no word "experience" near it. */
const YEARS_IN_RE = /\b(\d{1,2})\+?\s*(?:-\s*\d{1,2}\s*)?years?\s+(?:of\s+)?(?:professional\s+|relevant\s+|industry\s+|work\s+)?(?:in|with|across)\s+[A-Z]/i;

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
const ANCHOR_RE = /\b(eligibility|eligible|who can apply|who is eligible|who may apply|who we.re looking for|qualifications?|requirements?|criteria|minimum|at least|must have|you have|the role|about the role|role description|job description|how to apply|application (?:criteria|requirements)|admission|skills? (?:and|&) experience)\b/gi;

/** Something a gate actually looks like, not a menu label. */
const REQUIREMENT_SIGNAL =
  /\b(\d{1,2}\s*[-–]\s*\d{1,2}\s*years?|years?\s+of\s+experience|degree|cgpa|gpa|documents?|citizen|national|residen\w*|at\s+least|undergraduate|postgraduate|master'?s?|ph\.?d|doctorate|bachelor'?s?|diploma|women|female|enrolled|early[- ]career|ielts|toefl|companies|only|membership|work\s+authori[sz]ation|aged?\s*\d{1,2}|\d{1,2}\+?\s*years|english|french|spanish|hours?|\d{1,2}\s*h(?:rs?)?\s*\/\s*week|availability|junior|mid[- ]?career|faculty|postdoc|remote|hybrid|on-?site|full[ -]?time|part[ -]?time|contract|fully\s+funded|stipend|visa|relocation|proficiency|\d{1,4}\s+(?:places|seats|awards)|eligible|registered|organi[sz]ations?)\b/i;

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

/** A country in the slot a label leaves open: "Location: South Africa". */
const COUNTRY_LABEL_RE = /\b(?:location|locations|based in|located in|living in|residents? of|citizens? of|nationals? of|target sourcing locations?)\s*[:\-]?\s*([^.;]{2,60})/i;

/** Read from the whole page: a "Location:" line usually sits outside the gate block. */
function findCountryGate(full: string): { value: string; evidence: string } | null {
  for (const m of full.matchAll(new RegExp(COUNTRY_LABEL_RE.source, "gi"))) {
    // Record every country in the slot. Picking one out of "US, Canada, Europe"
    // reads as a restriction the page never states.
    const countries = extractAllCountries(m[1], true);
    if (US_LOCATION_RE.test(m[1]) && !countries.includes("usa")) countries.unshift("usa");
    if (countries.length) return { value: countries.join(", "), evidence: m[0].slice(0, 160) };
  }
  for (const pattern of COUNTRY_GATE_PATTERNS) {
    const m = full.match(pattern);
    if (!m) continue;
    const slot = m[1];
    const countries = extractAllCountries(slot, true);
    if (US_LOCATION_RE.test(slot) && !countries.includes("usa")) countries.unshift("usa");
    if (countries.length) return { value: countries.join(", "), evidence: m[0] };
  }
  return null;
}

/** Job-post gates that the calibration sweep found on real pages. */
const EMPLOYMENT_RE = /\b(full[ -]?time|part[ -]?time|contract(?:or)?|permanent|fixed[ -]?term|internship|freelance|volunteer|self[ -]employed|independent contractor)\b/i;
const WORKMODE_RE = /\b(fully remote|100% remote|remote-?first|remote|hybrid|on-?site|onsite|in-?office|in office)\b/i;
const TIMEZONE_RE = /\b((?:GMT|UTC)\s?[+-]?\d{1,2}\s?(?:to|–|-)\s?(?:GMT|UTC)?\s?[+-]?\d{1,2}|(?:GMT|UTC)\s?[+-]?\d{1,2}|EST|EDT|PST|PDT|CST|CDT|MST|AEST|AEDT|BST|CET|WET)\b(?:\s*(?:time zone|timezone|overlap|business hours))?/i;
const VISA_RE = /\b(visa sponsorship|visa[s]? (?:provided|available|supported)|work permit|relocation (?:support|assistance|package)|will sponsor)\b/i;
const FUNDING_RE = /\b(fully funded|full funding|partially funded|partial funding|travel (?:grant|support)|stipend(?: of)?|tuition (?:waiver|fee[s]? covered)|fees? covered|covers? (?:all )?(?:tuition|fees)|scholarship covers)\b/i;
const SALARY_HIDDEN_RE = /\b(salary|compensation|pay|stipend)\s*(?:is|:|-)?\s*(market related|not disclosed|undisclosed|unpaid|on a case by case basis|negotiable|competitive)\b/i;
const SKILLS_RE = /\b(?:requirements?|qualifications?|skills?)(?:\s*(?:are|include|required|needed))?\s*[:\-]\s*([^.;]{8,180})/i;
const CAPACITY_RE = /\b(\d{1,4}\s+(?:places|seats|slots|awards|grants?|scholarships|participants|selected|candidates)\b|limited to \d{1,4}|first come,? first served)/i;
const PROPOSAL_RE = /\b(submit (?:a )?(?:full )?(?:proposal|project proposal|business plan|concept note|technical proposal|expression of interest|application package)|proposals? must be (?:submitted|submitted by)|(?:proposal|business plan|concept note) of no more than \d+ pages)\b/i;

/**
 * Requirements stated in the page text. Every entry carries the phrase it came
 * from. A field the page does not mention is absent, not empty-and-passing.
 */
export function extractRequirements(text: string): Requirement[] {
  const out: Requirement[] = [];
  const full = (text || "").replace(/\s+/g, " ");
  if (!full) return out;
  const t = eligibilityContext(full);
  // No eligibility section is not a reason to return nothing: a country label and
  // a deadline usually live outside it.

  const push = (field: EligibilityField, value: string, evidence: string) => {
    const clean = value.replace(/\s+/g, " ").trim();
    const cite = evidence.replace(/\s+/g, " ").trim();
    if (clean && cite && !out.some(r => r.field === field)) out.push({ field, value: clean.slice(0, 120), evidence: cite.slice(0, 160) });
  };

  let m: RegExpMatchArray | null;

  // Job-post gates from the calibration sweep. The first stated value wins.
  m = t.match(EMPLOYMENT_RE);
  if (m) push("employmentType", m[1], m[0]);

  m = t.match(WORKMODE_RE);
  if (m) push("workMode", m[1], m[0]);

  m = t.match(TIMEZONE_RE);
  if (m) push("timezoneOverlap", m[1], m[0]);

  m = t.match(VISA_RE);
  if (m) push("visaSponsorship", m[0], m[0]);

  m = t.match(FUNDING_RE);
  if (m) push("fundingType", m[1], m[0]);

  m = t.match(SALARY_HIDDEN_RE);
  if (m) push("salaryDisclosed", "salary not disclosed", m[0]);

  m = t.match(SKILLS_RE);
  if (m) push("skillsRequired", m[1], m[0]);

  m = t.match(CAPACITY_RE);
  if (m) push("capacity", m[1], m[0]);

  m = t.match(PROPOSAL_RE);
  if (m) push("proposalRequirement", m[0], m[0]);

  // Country gate. Read from the whole page, not the section.
  const countryGate = findCountryGate(full);
  if (countryGate) push("country", countryGate.value, countryGate.evidence);

  // Nationality. Separate from country because "nationals of ITU member states" is a
  // passport gate and "residents of Ghana" is a residence gate, and they fail differently.
  m = t.match(NATIONALITY_RE);
  if (m) push("nationality", m[1].trim(), m[0]);

  // On-site or work authorisation.
  if (ON_SITE_RE.test(t)) {
    push("residencyOrWorkAuth", "on-site", t.match(ON_SITE_RE)![0]);
  } else if (WORK_AUTH_RE.test(t)) {
    push("residencyOrWorkAuth", "work authorisation required", t.match(WORK_AUTH_RE)![0]);
  }

  // Age band: "18-25 years old", "aged 18+", "under 21", "minimum age of 18"
  let m2 = t.match(AGE_RE);
  if (m2) push("ageBand", `${m2[1]}-${m2[2]} years old`, m2[0]);

  if (!out.some(r => r.field === "ageBand")) {
    m2 = t.match(UNDER_RE);
    if (m2) push("ageBand", `under ${m2[1]} years old`, m2[0]);
  }
  if (!out.some(r => r.field === "ageBand")) {
    m2 = t.match(MIN_AGE_RE);
    if (m2) push("ageBand", `${m2[1]} years old or older`, m2[0]);
  }
  // An upper cap. Without this, "aged 35 years or below" fell through every pattern above
  // and the page reported no age gate at all.
  if (!out.some(r => r.field === "ageBand")) {
    m2 = t.match(AGE_CAP_RE);
    if (m2) push("ageBand", `${m2[1] ?? m2[2]} years old or younger`, m2[0]);
  }
  if (!out.some(r => r.field === "ageBand")) {
    m2 = t.match(AGE_YEAR_RE);
    if (m2) push("ageBand", `${m2[1]} years old or younger in the year of application`, m2[0]);
  }
  if (!out.some(r => r.field === "ageBand")) {
    m2 = t.match(AGE_SINGLE_RE);
    if (m2) push("ageBand", `aged ${m2[1]}`, m2[0]);
  }

  // Gender
  m = t.match(GENDER_RE);
  if (m) push("gender", m[0].trim(), m[0]);

  // Student status at the time of submission
  m = t.match(ENROLMENT_RE);
  if (m) push("enrolmentStatus", m[0].trim(), m[0]);

  // Career stage
  m = t.match(CAREER_STAGE_RE);
  if (m) push("careerStage", m[0].trim(), m[0]);

  // Years of experience: "minimum of 8 years of experience", "8+ years in ML"
  m = t.match(YEARS_RE) || t.match(YEARS_IN_RE);
  if (m) push("yearsExperience", m[1] ? `${m[1]} years of experience` : m[0], m[0]);

  // Education level
  m = t.match(EDU_RE);
  if (m) push("educationLevel", m[1], m[0]);

  // "admission into an eligible Federal University" is an undergraduate gate
  if (!out.some(r => r.field === "educationLevel")) {
    m = t.match(/\b(?:secured|have|hold|gain)?\s*admission (?:into|to|from)\s+(?:an?\s+)?(?:eligible\s+|accredited\s+|recognised\s+|recognized\s+)?[A-Za-z ]{0,20}(university|college|polytechnic|school|institute)/i);
    if (m) push("educationLevel", `${m[1]} admission (undergraduate)`, m[0]);
  }

  // CGPA floor, kept apart from the topic. Both used to land on fieldOfStudy.
  m = t.match(GRADE_RE);
  if (m) push("academicGrade", `minimum CGPA ${m[1]}/${m[2]}`, m[0]);

  // Field of study: "in the field of AI policy", "degree in public health".
  // Two words minimum, because a single trailing word is almost always the
  // fragment of a cut-off phrase ("degree in natural", "Study in the").
  m = t.match(/\b(?:field of study|study in|major in|degree in|graduating in)\s+([A-Za-z][A-Za-z&'-]*(?:\s+[A-Za-z&'-]+){1,4})/i);
  if (m) {
    const value = m[1].replace(/^(?:the|a|an|of|in)\s+/i, "").trim();
    if (value.split(/\s+/).length >= 2) push("fieldOfStudy", value, m[0]);
  }

  // A named topic whitelist: thrust areas, special tracks, themes.
  if (!out.some(r => r.field === "fieldOfStudy")) {
    m = t.match(TOPIC_RE);
    if (m) push("fieldOfStudy", m[1].replace(/\s+/g, " ").trim().slice(0, 80), m[0]);
  }

  // Standardised test floor
  m = t.match(TEST_RE);
  if (m) push("standardisedTest", `${m[0].split(/\s+/)[0]} ${m[1] ?? m[2]}`, m[0]);

  // Submission language
  m = t.match(LANGUAGE_REQ_RE);
  if (m) push("language", (m[1] ?? m[2] ?? m[3]).trim(), m[0]);

  // Hours or availability commitment
  m = t.match(HOURS_RE);
  if (m) push("workHours", m[0].trim(), m[0]);

  // Who may apply at all
  m = t.match(APPLICANT_TYPE_RE);
  if (m) push("applicantType", m[0].trim(), m[0]);

  // Registration or membership prerequisite
  m = t.match(ORG_STATUS_RE);
  if (m) push("organisationStatus", m[0].replace(/\s+/g, " ").trim().slice(0, 60), m[0]);

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
      case "nationality":
      case "residencyOrWorkAuth":
      case "gender":
      case "educationLevel":
      case "enrolmentStatus":
      case "careerStage":
      case "yearsExperience":
      case "academicGrade":
      case "fieldOfStudy":
      case "standardisedTest":
      case "language":
      case "workHours":
      case "applicantType":
      case "organisationStatus":
      case "employmentType":
      case "workMode":
      case "timezoneOverlap": {
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