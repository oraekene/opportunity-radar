import { test } from "node:test";
import assert from "node:assert/strict";
import {
  assessEligibility,
  extractRequirements,
  ELIGIBILITY_FIELDS,
  TOP_ELIGIBILITY_FIELDS,
  ADVANCED_ELIGIBILITY_FIELDS,
  DEFAULT_ENFORCEMENT
} from "../src/services/eligibility.ts";
import { extractEligibilityCountry } from "../src/services/parse.ts";

const CAREAWAVE = `Carewave Scholarship 2027. Applicants must be 18-25 years old. Applicants must have a minimum CGPA of 4.5/5.0. Applicants must have secured admission into an eligible Federal University in Nigeria. Required documents are a passport, a transcript and a reference letter. Deadline: 15 April 2026.`;

test("country is read from the body, not the title", () => {
  assert.equal(
    extractEligibilityCountry("GTM Product Manager", "Location: South Africa. Remote across EMEA."),
    "south africa"
  );
  assert.equal(extractEligibilityCountry("Senior Engineer", "Fully remote, worldwide."), "");
});

test("the three Carewave gates are all extracted, each with its evidence", () => {
  const reqs = extractRequirements(CAREAWAVE);
  const byField = Object.fromEntries(reqs.map(r => [r.field, r]));

  assert.equal(byField.ageBand?.value, "18-25 years old");
  assert.match(byField.ageBand!.evidence, /18-25 years old/i);
  assert.ok(byField.educationLevel, "expected an education level");
  assert.ok(byField.requiredDocuments, "expected a document list");
  assert.ok(byField.deadline, "expected a deadline");
});

test("a field the page never mentions is absent, not passing", () => {
  const reqs = extractRequirements("We are looking for a backend engineer. Fully remote.");
  assert.equal(reqs.length, 0);
});

test("every requirement carries a citation", () => {
  for (const r of extractRequirements(CAREAWAVE)) {
    assert.ok(r.evidence.length > 0, `${r.field} has no evidence`);
  }
});

test("a failed check on a warn field never blocks", () => {
  const reqs = extractRequirements(CAREAWAVE);
  const profile = { enforcement: {}, country: "ghana" };

  const warn = assessEligibility(reqs, profile);
  assert.equal(warn.blocking.length, 0, "warn must not block");
  assert.ok(warn.warnings.length > 0, "a mismatch on a warn field should warn");
});

test("a failed check on an enforced field blocks", () => {
  const reqs = extractRequirements(CAREAWAVE);
  const profile = { enforcement: { country: "enforce" as const }, country: "ghana" };

  const enforced = assessEligibility(reqs, profile);
  assert.ok(enforced.blocking.includes("country"));
});

test("an ignored field is not checked at all", () => {
  const reqs = extractRequirements(CAREAWAVE);
  const profile = { enforcement: { country: "ignore" as const }, country: "ghana" };

  const ignored = assessEligibility(reqs, profile);
  assert.equal(ignored.checks.some(c => c.field === "country"), false);
  assert.equal(ignored.blocking.length, 0);
});

test("an unanswered profile field is unknown, never a pass and never a block", () => {
  const reqs = extractRequirements(CAREAWAVE);
  const enforced = assessEligibility(reqs, { enforcement: { country: "enforce" as const } });

  assert.equal(enforced.blocking.length, 0, "an unanswered field must not block");
  const check = enforced.checks.find(c => c.field === "country");
  assert.equal(check?.verdict, "unknown");
});

test("years of experience is read when the page states a minimum", () => {
  const reqs = extractRequirements("Minimum of 8 years of experience in the profession. Ten places available.");
  assert.equal(reqs.find(r => r.field === "yearsExperience")?.value, "8 years of experience");
});
// ---------------------------------------------------------------------------
// Criteria added 2026-10-08, from 20 apply pages read in full. Each case below
// uses the wording the page actually used.
// ---------------------------------------------------------------------------

test("a women-only rule is read as its own gate, not as prose", () => {
  const reqs = extractRequirements(
    "Eligibility: The main applicant (PI) should be a female researcher at a university. Open to women researchers only."
  );
  const gender = reqs.find(r => r.field === "gender");
  assert.ok(gender, "expected a gender requirement");
  assert.match(gender!.value, /femal|women/i);
});

test("a gender rule never blocks on its own, because the radar does not know you", () => {
  const reqs = extractRequirements("Eligibility: open to women only.");
  const assessed = assessEligibility(reqs, { enforcement: { gender: "enforce" as const } });
  assert.equal(assessed.blocking.length, 0, "an unanswered gender must not block");
  assert.equal(assessed.checks.find(c => c.field === "gender")?.verdict, "unknown");
});

test("an upper age cap is read as a cap, not skipped", () => {
  const reqs = extractRequirements(
    "Who is eligible: Aged 35 years or below as at the essay submission deadline."
  );
  const age = reqs.find(r => r.field === "ageBand");
  assert.ok(age, "expected an age band");
  assert.match(age!.value, /35/);
  assert.match(age!.value, /younger|below/i);
});

test("an age cap tied to the application year is still read", () => {
  const reqs = extractRequirements("Eligibility: Be 30 years old or younger in the year of application.");
  const age = reqs.find(r => r.field === "ageBand");
  assert.ok(age);
  assert.match(age!.value, /30/);
});

test("a CGPA floor keeps both decimals and does not land on the topic field", () => {
  const reqs = extractRequirements(
    "Requirements: Hold a Bachelor's Degree with a minimum CGPA of 3.70/4.00 or equivalent."
  );
  const grade = reqs.find(r => r.field === "academicGrade");
  assert.ok(grade, "expected an academic grade");
  assert.equal(grade!.value, "minimum CGPA 3.70/4.00");
});

test("an IELTS floor is read", () => {
  const reqs = extractRequirements("Requirements: IELTS Academic: 6.5 or above.");
  const test = reqs.find(r => r.field === "standardisedTest");
  assert.ok(test, "expected a test score");
  assert.match(test!.value, /IELTS/);
  assert.match(test!.value, /6\.5/);
});

test("a student-status rule is its own criterion, separate from education level", () => {
  const reqs = extractRequirements(
    "Who can apply: Enrolled in an accredited tertiary institution in an African Union Member State at the time of submission."
  );
  assert.ok(reqs.find(r => r.field === "enrolmentStatus"), "expected an enrolment rule");
});

test("an early-career definition is read as career stage, not as years of experience", () => {
  const reqs = extractRequirements(
    "Eligibility: Open exclusively to early career professionals, defined as those awarded a graduate degree no earlier than 2021."
  );
  const stage = reqs.find(r => r.field === "careerStage");
  assert.ok(stage, "expected a career stage rule");
  assert.match(stage!.value, /early[- ]?career/i);
});

test("a companies-only rule is read as the applicant type", () => {
  const reqs = extractRequirements(
    "Who is eligible: The Accelerator is designed for companies. Companies only."
  );
  assert.ok(reqs.find(r => r.field === "applicantType"), "expected an applicant type rule");
});

test("a membership prerequisite is read as registration, not as a document", () => {
  const reqs = extractRequirements(
    "Requirements: companies are required to be participants of the UN Global Compact or willing to join."
  );
  const org = reqs.find(r => r.field === "organisationStatus");
  assert.ok(org, "expected an organisation status rule");
  assert.match(org!.value, /Global Compact/i);
});

test("US work authorisation is read as a gate rather than left unknown", () => {
  const reqs = extractRequirements("Requirements: US work authorization required. Remote (US).");
  const auth = reqs.find(r => r.field === "residencyOrWorkAuth");
  assert.ok(auth, "expected a residency or work auth rule");
  assert.match(auth!.value, /authorisation|authorization/i);
});

test("years stated as '8+ years in ML' are read without the word experience", () => {
  const reqs = extractRequirements("Requirements: 8+ years in ML / Data Science / Research Engineering.");
  const yrs = reqs.find(r => r.field === "yearsExperience");
  assert.ok(yrs, "expected a years requirement");
  assert.match(yrs!.value, /8/);
});

test("a submission-language rule is read without the word fluent", () => {
  const reqs = extractRequirements("Who can apply: All application shall be made in English.");
  assert.match(reqs.find(r => r.field === "language")?.value ?? "", /English/);
});

test("a weekly hours commitment is read", () => {
  const reqs = extractRequirements("Requirements: 32-40h/week, must be available for the full programme.");
  const hrs = reqs.find(r => r.field === "workHours");
  assert.ok(hrs, "expected a hours requirement");
  assert.match(hrs!.value, /40/);
});

test("the four settings-visible parameters and the advanced set partition every field exactly once", () => {
  const combined = [...TOP_ELIGIBILITY_FIELDS, ...ADVANCED_ELIGIBILITY_FIELDS];
  assert.equal(new Set(combined).size, ELIGIBILITY_FIELDS.length, "no field may appear twice or vanish");
  assert.deepEqual([...combined].sort(), [...ELIGIBILITY_FIELDS].sort());
  assert.equal(TOP_ELIGIBILITY_FIELDS.length, 4, "settings shows four directly");
  for (const f of TOP_ELIGIBILITY_FIELDS) {
    assert.ok(DEFAULT_ENFORCEMENT[f], "a visible field needs a default mode");
  }
});
