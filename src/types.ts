/** Whether you can actually apply, judged from the text, not from a keyword. */
export type Eligibility = "open" | "restricted" | "unknown";

/** How a source shapes its payload. HN Who-is-Hiring is not a job posting feed. */
export type ParseRule = "directPosting" | "hnComment";

/** Where an item should land downstream. "none" means do not send it. */
export type RouteTo = "application" | "cold_email" | "none";

export interface OpportunityItem {
  id: string;
  dedupeKey: string;
  title: string;
  link: string;
  pubDate: string;
  description: string;
  company: string;
  region: string;
  eligibilityCountry: string;
  eligibility: Eligibility;
  eligibilityEvidence: string;
  deadline: string;
  salaryBand: string;
  isOpportunity: boolean;
  routeTo: RouteTo;
  /** Requirements stated by the apply page. Every entry carries its evidence. */
  eligibilityRequirements?: import("./services/eligibility").Requirement[];
  /** Per-field verdict with a reason. Absent when the page was not read. */
  eligibilityChecks?: import("./services/eligibility").EligibilityCheck[];
  /** Fields set to enforce where the requirement fails. */
  eligibilityBlocking?: string[];
  /** Fields set to warn where the requirement fails. */
  eligibilityWarnings?: string[];
  categoryId: string;
  categoryName: string;
  categoryIcon: string;
  sourceName: string;
  matchedKeywords: string[];
  crawledAt: string;
}

export interface KeywordRules {
  include: RegExp[];
  exclude: RegExp[];
}

export interface FeedSource {
  id: string;
  name: string;
  url: string;
  type?: "rss" | "html" | "json";
  parseRule?: ParseRule;
  /** false when the feed carries news but no application to make. */
  carriesApplication?: boolean;
}

export interface CategoryDefinition {
  id: string;
  displayName: string;
  icon: string;
  routeTo: RouteTo;
  whatsappGroupChatId?: string;
  telegramTopicId?: number;
  sources: FeedSource[];
  keywords: KeywordRules;
}

export type NotificationChannel =
  | "auto_router"
  | "whatsapp_kapso"
  | "whatsapp_meta"
  | "whatsapp_twilio"
  | "whatsapp_greenapi"
  | "whatsapp_callmebot"
  | "telegram"
  | "discord";

export interface ProviderQuota {
  provider: NotificationChannel;
  displayName: string;
  monthlyLimit: number;
  currentCount: number;
  configured: boolean;
  active: boolean;
}

export interface CategoryKeywordsConfig {
  mode?: "simple" | "boolean";
  includeText?: string;
  excludeText?: string;
  booleanQuery?: string;
}

export interface UserSettings {
  messageMode: "individual" | "digest";
  maxTotalMessages: number;
  maxPerSource: number;
  maxAgeDays: number;
  enabledSources: Record<string, boolean>;
  categoryKeywords?: Record<string, CategoryKeywordsConfig>;
  notificationTarget: NotificationChannel;
  routerPriority: NotificationChannel[];

  // POST new items to a URL you control. This is the seam downstream polls.
  webhookUrl?: string;

  // Off by default: the radar shows everything, it only sends what you asked for.
  sendRestricted?: boolean;

  // Your own answers to the seven eligibility parameters. Empty means unknown.
  eligibilityProfile?: import("./services/eligibility").EligibilityProfile;

  // Kapso.ai (2,000 free/month)
  kapsoApiKey?: string;
  kapsoPhoneNumberId?: string;
  kapsoRecipientPhone?: string;
  kapsoMonthlyLimit?: number;

  // Meta Official WhatsApp Cloud API (1,000 free/month)
  metaPhoneNumberId?: string;
  metaAccessToken?: string;
  metaRecipientPhone?: string;
  metaMonthlyLimit?: number;

  // Twilio WhatsApp API
  twilioAccountSid?: string;
  twilioAuthToken?: string;
  twilioFromPhone?: string;
  twilioToPhone?: string;
  twilioMonthlyLimit?: number;

  // CallMeBot
  callmebotPhone?: string;
  callmebotApiKey?: string;

  // Green-API
  greenApiInstanceId?: string;
  greenApiToken?: string;
  greenApiMonthlyLimit?: number;

  // Telegram
  telegramBotToken?: string;
  telegramChatId?: string;
}

export interface Env {
  /** 30-day seen set. Short-lived dedupe memory. */
  RADAR_SEEN: KVNamespace;
  /** Daily history, dates index, user settings, provider quota counters. */
  RADAR_HISTORY: KVNamespace;
  /** What you actually acted on. The radar never writes here on its own. */
  RADAR_CONSUMED: KVNamespace;

  // Optional environment defaults
  NOTIFIER_TARGET?: string;

  // Kapso.ai
  KAPSO_API_KEY?: string;
  KAPSO_PHONE_NUMBER_ID?: string;
  KAPSO_RECIPIENT_PHONE?: string;

  // Meta Cloud API
  META_PHONE_NUMBER_ID?: string;
  META_ACCESS_TOKEN?: string;
  META_RECIPIENT_PHONE?: string;

  // Twilio
  TWILIO_ACCOUNT_SID?: string;
  TWILIO_AUTH_TOKEN?: string;
  TWILIO_FROM_PHONE?: string;
  TWILIO_TO_PHONE?: string;

  // CallMeBot
  CALLMEBOT_PHONE?: string;
  CALLMEBOT_APIKEY?: string;

  // Green-API
  GREENAPI_INSTANCE_ID?: string;
  GREENAPI_API_TOKEN?: string;

  // Telegram & Discord
  TELEGRAM_BOT_TOKEN?: string;
  TELEGRAM_CHAT_ID?: string;
  DISCORD_WEBHOOK_URL?: string;

  // Webhook push target (secret, set with wrangler secret put)
  RADAR_WEBHOOK_URL?: string;
}
