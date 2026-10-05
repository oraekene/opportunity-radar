export interface OpportunityItem {
  id: string;
  title: string;
  link: string;
  pubDate: string;
  description: string;
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
  type?: "rss" | "html";
}

export interface CategoryDefinition {
  id: string;
  displayName: string;
  icon: string;
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
  SEEN_OPPORTUNITIES: KVNamespace;

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
}
