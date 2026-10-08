import { test } from "node:test";
import assert from "node:assert/strict";
import { assessEligibility, extractRequirements } from "../src/services/eligibility.ts";
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

// The cases below come from the page-calibration sweep: 348 real pages fetched
// from the 112 links in the received-message record plus every live source.

test("a HN-style job header yields workMode, employmentType and timezone", () => {
  const reqs = extractRequirements(
    `Quantum Minds | Senior Software Engineer | Contract | REMOTE (US) | Full-Time Requirements: Strong C/C++ systems engineering. The client needs EST business hours overlap. You must have 5+ years experience.`
  );
  const by = Object.fromEntries(reqs.map(r => [r.field, r.value]));

  assert.equal(by.workMode?.toLowerCase(), "remote");
  // The first stated type wins: this header says "Contract" before "Full-Time".
  assert.equal(by.employmentType?.toLowerCase(), "contract");
  assert.equal(by.timezoneOverlap?.toUpperCase(), "EST");
  assert.equal(by.yearsExperience, "5 years of experience");
});

test("career stage is read, which is the most common gate of all", () => {
  const reqs = extractRequirements(
    `About the role: the Kuwait Program is designed for junior and mid-career policy-oriented scholars and faculty from Kuwait. Eligibility: applicants must be mid-career.`
  );
  assert.ok(reqs.some(r => r.field === "careerStage"));
});

test("funding type is read from fully funded and stipend wording", () => {
  const reqs = extractRequirements(
    `This is a Fully Funded opportunity. Eligibility: the stipend is paid monthly. Requirements: none.`
  );
  const funding = reqs.find(r => r.field === "fundingType");
  assert.ok(funding);
  assert.match(funding!.value, /fully funded|stipend/i);
});

test("a multi-country location slot records every country, not one", () => {
  const reqs = extractRequirements(
    `Job description. Location USA UK India Australia Ireland New Zealand Philippines. Employment Type: full-time.`
  );
  const country = reqs.find(r => r.field === "country");
  assert.ok(country, "expected a country gate");
  assert.match(country!.value, /india/);
  assert.match(country!.value, /australia/);
});

test("US in a dollar amount is not read as a country", () => {
  const reqs = extractRequirements(`Call for proposals. The award is eligible for a grant of up to US $50,000.`);
  const country = reqs.find(r => r.field === "country");
  assert.ok(!country || !/^us\b/.test(country.value), `"up to US" is money, got: ${country?.value}`);
});

test("an organisation-only grant is distinguishable from an individual one", () => {
  const orgs = extractRequirements(`This call is open to eligible organizations and registered charities. Eligibility criteria apply.`);
  assert.ok(orgs.some(r => r.field === "applicantType"));
});

test("a menu bar alone yields nothing", () => {
  const reqs = extractRequirements(
    `Home Conferences Training Scholarships Undergraduate Short Courses Online Courses Masters/Postgraduate Study in Africa Study in Asia Study in Australia Previous Article Next Article`
  );
  assert.equal(reqs.length, 0, `nav text produced ${JSON.stringify(reqs)}`);
});