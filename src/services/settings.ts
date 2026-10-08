import { CATEGORIES } from "../config/categories";
import { Env, UserSettings, NotificationChannel } from "../types";

const SETTINGS_KEY = "config:user_settings";

export function getDefaultSettings(env: Env): UserSettings {
  const defaultEnabledSources: Record<string, boolean> = {};
  CATEGORIES.forEach(cat => {
    cat.sources.forEach(src => {
      defaultEnabledSources[src.id] = true;
    });
  });

  return {
    messageMode: "individual",
    maxTotalMessages: 10,
    maxPerSource: 3,
    maxAgeDays: 3,
    enabledSources: defaultEnabledSources,
    notificationTarget: (env.NOTIFIER_TARGET as NotificationChannel) || "auto_router",
    routerPriority: [
      "whatsapp_kapso",
      "whatsapp_meta",
      "whatsapp_twilio",
      "whatsapp_greenapi",
      "telegram"
    ],

    webhookUrl: env.RADAR_WEBHOOK_URL || "",
    sendRestricted: false,

    // Kapso.ai (2,000 free/month)
    kapsoApiKey: env.KAPSO_API_KEY || "",
    kapsoPhoneNumberId: env.KAPSO_PHONE_NUMBER_ID || "",
    kapsoRecipientPhone: env.KAPSO_RECIPIENT_PHONE || "",
    kapsoMonthlyLimit: 2000,

    // Meta Cloud API (1,000 free/month)
    metaPhoneNumberId: env.META_PHONE_NUMBER_ID || "",
    metaAccessToken: env.META_ACCESS_TOKEN || "",
    metaRecipientPhone: env.META_RECIPIENT_PHONE || "",
    metaMonthlyLimit: 1000,

    // Twilio
    twilioAccountSid: env.TWILIO_ACCOUNT_SID || "",
    twilioAuthToken: env.TWILIO_AUTH_TOKEN || "",
    twilioFromPhone: env.TWILIO_FROM_PHONE || "whatsapp:+14155238886",
    twilioToPhone: env.TWILIO_TO_PHONE || "",
    twilioMonthlyLimit: 1000,

    // CallMeBot
    callmebotPhone: env.CALLMEBOT_PHONE || "",
    callmebotApiKey: env.CALLMEBOT_APIKEY || "",

    // Green-API
    greenApiInstanceId: env.GREENAPI_INSTANCE_ID || "",
    greenApiToken: env.GREENAPI_API_TOKEN || "",
    greenApiMonthlyLimit: 100,

    // Telegram
    telegramBotToken: env.TELEGRAM_BOT_TOKEN || "",
    telegramChatId: env.TELEGRAM_CHAT_ID || ""
  };
}

export async function getSettings(env: Env): Promise<UserSettings> {
  const defaults = getDefaultSettings(env);
  if (!env.RADAR_HISTORY) {
    return defaults;
  }

  try {
    const raw = await env.RADAR_HISTORY.get(SETTINGS_KEY);
    if (!raw) return defaults;
    const parsed = JSON.parse(raw);
    return {
      ...defaults,
      ...parsed,
      enabledSources: {
        ...defaults.enabledSources,
        ...(parsed.enabledSources || {})
      },
      categoryKeywords: parsed.categoryKeywords || defaults.categoryKeywords || {},
      routerPriority: parsed.routerPriority || defaults.routerPriority
    };
  } catch (err) {
    console.error("[Settings] Failed to read settings from KV:", err);
    return defaults;
  }
}

export async function saveSettings(env: Env, newSettings: Partial<UserSettings>): Promise<UserSettings> {
  const current = await getSettings(env);
  const merged: UserSettings = {
    ...current,
    ...newSettings,
    enabledSources: {
      ...current.enabledSources,
      ...(newSettings.enabledSources || {})
    },
    categoryKeywords: newSettings.categoryKeywords || current.categoryKeywords || {},
    routerPriority: newSettings.routerPriority || current.routerPriority
  };

  if (env.RADAR_HISTORY) {
    await env.RADAR_HISTORY.put(SETTINGS_KEY, JSON.stringify(merged));
  }

  return merged;
}
