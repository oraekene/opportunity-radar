import { Env, NotificationChannel, ProviderQuota, UserSettings } from "../types";

export function getCurrentMonthString(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; // e.g. 2026-10
}

function getUsageKey(provider: string, month: string): string {
  return `usage:${provider}:${month}`;
}

export async function getProviderUsage(env: Env, provider: string): Promise<number> {
  if (!env.SEEN_OPPORTUNITIES) return 0;
  const month = getCurrentMonthString();
  const key = getUsageKey(provider, month);
  try {
    const raw = await env.SEEN_OPPORTUNITIES.get(key);
    return raw ? parseInt(raw, 10) || 0 : 0;
  } catch {
    return 0;
  }
}

export async function incrementProviderUsage(env: Env, provider: string): Promise<number> {
  if (!env.SEEN_OPPORTUNITIES) return 1;
  const month = getCurrentMonthString();
  const key = getUsageKey(provider, month);
  try {
    const current = await getProviderUsage(env, provider);
    const updated = current + 1;
    // Set 60-day expiration so old monthly stats automatically clean up
    await env.SEEN_OPPORTUNITIES.put(key, String(updated), {
      expirationTtl: 60 * 24 * 60 * 60
    });
    return updated;
  } catch (err) {
    console.error(`[Usage] Failed to increment usage for ${provider}:`, err);
    return 1;
  }
}

export async function getAllProviderQuotas(env: Env, settings: UserSettings): Promise<ProviderQuota[]> {
  const providers: {
    id: NotificationChannel;
    name: string;
    limit: number;
    isConfigured: boolean;
  }[] = [
    {
      id: "whatsapp_kapso",
      name: "Kapso.ai Gateway",
      limit: settings.kapsoMonthlyLimit || 2000,
      isConfigured: !!(settings.kapsoApiKey && settings.kapsoPhoneNumberId && settings.kapsoRecipientPhone)
    },
    {
      id: "whatsapp_meta",
      name: "Meta Official Cloud API",
      limit: settings.metaMonthlyLimit || 1000,
      isConfigured: !!(settings.metaPhoneNumberId && settings.metaAccessToken && settings.metaRecipientPhone)
    },
    {
      id: "whatsapp_twilio",
      name: "Twilio Sandbox",
      limit: settings.twilioMonthlyLimit || 1000,
      isConfigured: !!(settings.twilioAccountSid && settings.twilioAuthToken && settings.twilioToPhone)
    },
    {
      id: "whatsapp_greenapi",
      name: "Green-API",
      limit: settings.greenApiMonthlyLimit || 100,
      isConfigured: !!(settings.greenApiInstanceId && settings.greenApiToken)
    },
    {
      id: "whatsapp_callmebot",
      name: "CallMeBot",
      limit: 500,
      isConfigured: !!(settings.callmebotPhone && settings.callmebotApiKey)
    },
    {
      id: "telegram",
      name: "Telegram Bot",
      limit: 999999, // Unlimited
      isConfigured: !!(settings.telegramBotToken && settings.telegramChatId)
    }
  ];

  const quotas: ProviderQuota[] = [];
  for (const p of providers) {
    const count = await getProviderUsage(env, p.id);
    quotas.push({
      provider: p.id,
      displayName: p.name,
      monthlyLimit: p.limit,
      currentCount: count,
      configured: p.isConfigured,
      active: p.isConfigured && count < p.limit
    });
  }

  return quotas;
}
