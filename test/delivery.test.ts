import { test } from "node:test";
import assert from "node:assert/strict";
import { detectDeliveryFailure, getWindowState, recordInboundMessage } from "../src/services/delivery.ts";

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

test("the window state opens only after an inbound message", async () => {
  const store = new Map<string, string>();
  const env: any = {
    RADAR_HISTORY: {
      get: async (k: string) => store.get(k) ?? null,
      put: async (k: string, v: string) => void store.set(k, v),
      delete: async (k: string) => void store.delete(k)
    }
  };

  const before = await getWindowState(env, "whatsapp_kapso");
  assert.equal(before.open, false, "no inbound means no window");
  assert.equal(before.hoursLeft, 0);

  const after = await recordInboundMessage(env, "whatsapp_kapso");
  assert.equal(after.open, true);
  assert.ok(after.hoursLeft > 23 && after.hoursLeft <= 24);

  // A day later it is shut again.
  const stale = await recordInboundMessage(env, "whatsapp_kapso", new Date(Date.now() - 25 * 3600 * 1000).toISOString());
  assert.equal(stale.open, false, "25 hours after an inbound the window is closed");
});