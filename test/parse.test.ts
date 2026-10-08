import { test } from "node:test";
import assert from "node:assert/strict";
import {
  applyHnCommentRule,
  dedupeKeyFor,
  extractCompany,
  extractDeadline,
  extractRegionVerdict,
  extractSalaryBand
} from "../src/services/parse.ts";

test("company comes from an explicit label before anything else", () => {
  assert.equal(
    extractCompany("Senior Engineer", "Company: Acme Labs\nWe build things.", "https://boards.greenhouse.io/acme/jobs/1"),
    "Acme Labs"
  );
});

test("company falls back to the apply link host", () => {
  assert.equal(extractCompany("Backend Engineer", "Great role.", "https://jobs.lever.co/rippling/123"), "Rippling");
  assert.equal(
    extractCompany("Backend Engineer", "Great role.", "https://apply.workable.com/mercury/"),
    "Mercury"
  );
});

test("a generic board host yields no company", () => {
  assert.equal(extractCompany("Backend Engineer", "Great role.", "https://weworkremotely.com/remote-jobs"), "");
});

test("region alone is never proof of eligibility", () => {
  const v = extractRegionVerdict("Ops Lead", "Location: South Africa. Great for locals.");
  assert.equal(v.region, "south africa");
  assert.equal(v.eligibility, "unknown");
});

test("an explicit restriction wins over remote language", () => {
  const v = extractRegionVerdict("Engineer", "We are a remote-first company. US only applicants.");
  assert.equal(v.eligibility, "restricted");
  assert.match(v.evidence, /us only/i);
});

test("worldwide and hybrid produce opposite verdicts", () => {
  assert.equal(extractRegionVerdict("Engineer", "Fully remote, hiring worldwide.").eligibility, "open");
  assert.equal(extractRegionVerdict("Engineer", "Hybrid, 3 days in office.").eligibility, "restricted");
});

test("deadline and salary are read out of prose", () => {
  assert.equal(extractDeadline("Applications close on 15 April 2026. Good luck."), "15 April 2026");
  assert.equal(extractDeadline("Apply by: March 3, 2026"), "March 3, 2026");
  assert.equal(extractSalaryBand("Compensation: $150,000 - $180,000 USD plus equity."), "$150,000 - $180,000");
  assert.equal(extractSalaryBand("We have 50,000 applicants so far."), "");
});

test("HN comment rule lifts company and role, drops the rest", () => {
  const p = applyHnCommentRule("Acme Labs | Senior Data Engineer | Remote (EU) | $120k-150k");
  assert.equal(p?.company, "Acme Labs");
  assert.equal(p?.title, "Acme Labs — Senior Data Engineer");
});

test("HN comment rule drops items without both company and role", () => {
  assert.equal(applyHnCommentRule("I am looking for a frontend developer, ping me"), null);
  assert.equal(applyHnCommentRule("Remote | Contract"), null);
});

test("one job on two boards collapses to one dedupe key", () => {
  assert.equal(
    dedupeKeyFor("Acme Labs", "Acme Labs — Senior Data Engineer"),
    dedupeKeyFor("acme   labs", "Senior Data Engineer at Acme Labs")
  );
  assert.notEqual(
    dedupeKeyFor("Acme Labs", "Senior Data Engineer"),
    dedupeKeyFor("Globex", "Senior Data Engineer")
  );
});