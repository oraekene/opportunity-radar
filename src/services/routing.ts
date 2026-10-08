import type { OpportunityItem, UserSettings } from "../types";

/**
 * What is allowed to leave the radar. Both the webhook and the message
 * dispatcher call this, so the two paths can never disagree about what counts
 * as new and sendable.
 *
 * Four rules: a category with no route never sends, a source that carries no
 * application never sends, a restricted verdict waits for explicit consent, and
 * a field you set to "enforce" blocks when the page fails it. Every other
 * eligibility failure is a warning, because you choose what enforces.
 */
export function selectSendable(items: OpportunityItem[], settings: UserSettings): OpportunityItem[] {
  return items.filter(
    i =>
      i.routeTo !== "none" &&
      i.isOpportunity &&
      (settings.sendRestricted || i.eligibility !== "restricted") &&
      (i.eligibilityBlocking || []).length === 0
  );
}