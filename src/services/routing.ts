import type { OpportunityItem, UserSettings } from "../types";

/**
 * What is allowed to leave the radar. Both the webhook and the message
 * dispatcher call this, so the two paths can never disagree about what counts
 * as new and sendable.
 *
 * Three rules, in order: a category with no route never sends, a source that
 * carries no application never sends, and a restricted verdict waits for
 * explicit consent. An unknown verdict is still worth sending.
 */
export function selectSendable(items: OpportunityItem[], settings: UserSettings): OpportunityItem[] {
  return items.filter(
    i => i.routeTo !== "none" && i.isOpportunity && (settings.sendRestricted || i.eligibility !== "restricted")
  );
}