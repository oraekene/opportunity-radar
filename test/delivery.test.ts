import { test } from "node:test";
import assert from "node:assert/strict";
import { detectDeliveryFailure } from "../src/services/delivery.ts";

test("an HTTP 200 that carries a Meta error object is a failure, not a delivery", () => {
  const body = JSON.stringify({
    error: {
      message: "Message failed to send because more than 24 hours have passed since the customer last replied to this number.",
      type: "OAuthException",
      code: 131047
    }
  });
  const f = detectDeliveryFailure("whatsapp_kapso", 200, body);
  assert.ok(f, "expected a failure even on HTTP 200");
  assert.equal(f!.needsTemplate, true);
  assert.match(f!.reason, /131047|24-hour/i);
});

test("the closed re-engagement window is flagged as needing a template", () => {
  const f = detectDeliveryFailure("whatsapp_kapso", 200, "Message failed: 24-hour window expired");
  assert.ok(f);
  assert.equal(f!.needsTemplate, true);
});

test("a refusal wording without a status code still fails", () => {
  assert.ok(detectDeliveryFailure("whatsapp_kapso", 200, "Meta reported a delivery error."));
  assert.ok(detectDeliveryFailure("whatsapp_meta", 400, "bad request"));
});

test("a normal success body is not a failure", () => {
  const ok = JSON.stringify({ messages: [{ id: "wamid.ABC" }] });
  assert.equal(detectDeliveryFailure("whatsapp_kapso", 200, ok), null);
  assert.equal(detectDeliveryFailure("whatsapp_kapso", 200, ""), null);
});

test("an ordinary API error is not confused with the closed window", () => {
  const f = detectDeliveryFailure("whatsapp_kapso", 401, JSON.stringify({ error: { message: "Invalid OAuth token" } }));
  assert.ok(f);
  assert.equal(f!.needsTemplate, false);
});