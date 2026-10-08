import { test } from "node:test";
import assert from "node:assert/strict";
import { selectSendable } from "../src/services/routing.ts";
import type { OpportunityItem, UserSettings } from "../src/types.ts";

const settings = { sendRestricted: false } as UserSettings;

function item(over: Partial<OpportunityItem>): OpportunityItem {
  return {
    id: "x:1",
    dedupeKey: "co::role",
    title: "Role",
    link: "https://example.com",
    pubDate: "",
    description: "",
    company: "Co",
    region: "",
    eligibility: "open",
    eligibilityEvidence: "",
    deadline: "",
    salaryBand: "",
    isOpportunity: true,
    routeTo: "application",
    categoryId: "grants_fellowships",
    categoryName: "Grants",
    categoryIcon: "x",
    sourceName: "S",
    matchedKeywords: [],
    crawledAt: "",
    ...over
  };
}

test("an unrouted category never leaves the radar", () => {
  assert.equal(selectSendable([item({ routeTo: "none" })], settings).length, 0);
});

test("a news item never leaves the radar", () => {
  assert.equal(selectSendable([item({ isOpportunity: false })], settings).length, 0);
});

test("a restricted item waits for consent", () => {
  const restricted = [item({ eligibility: "restricted" })];
  assert.equal(selectSendable(restricted, settings).length, 0);
  assert.equal(selectSendable(restricted, { sendRestricted: true } as UserSettings).length, 1);
});

test("an unknown verdict is still worth sending", () => {
  assert.equal(selectSendable([item({ eligibility: "unknown" })], settings).length, 1);
});