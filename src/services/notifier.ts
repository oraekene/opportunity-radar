import { OpportunityItem, CategoryDefinition, Env, UserSettings, NotificationChannel } from "../types";
import { getProviderUsage, incrementProviderUsage } from "./usage";

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Format a single opportunity into a rich individual message
 */
export function formatIndividualMessage(item: OpportunityItem, dashboardUrl?: string): string {
  let msg = `${item.categoryIcon} *[${item.categoryName.toUpperCase()}]*\n`;
  msg += `*${item.title}*\n\n`;
  msg += `🏢 *Source:* ${item.sourceName}\n`;
  if (item.pubDate) {
    msg += `📅 *Date:* ${item.pubDate}\n`;
  }
  if (item.matchedKeywords.length > 0) {
    msg += `🎯 *Keywords:* ${item.matchedKeywords.join(", ")}\n`;
  }
  msg += `\n📝 *Details & Requirements:*\n`;
  const cleanDesc = item.description.length > 800 
    ? `${item.description.slice(0, 797)}...` 
    : item.description;
  msg += `${cleanDesc}\n\n`;
  msg += `🔗 *Apply Link:* ${item.link}\n`;

  if (dashboardUrl) {
    msg += `\n📊 _View All in Daily Table: ${dashboardUrl}_`;
  }

  return msg.trim();
}

/**
 * Format multiple opportunities into a category digest
 */
export function formatDigestMessage(
  category: CategoryDefinition,
  items: OpportunityItem[],
  dashboardUrl?: string
): string {
  let message = `${category.icon} *[${category.displayName.toUpperCase()}]* — ${items.length} New Update${items.length > 1 ? "s" : ""}\n`;
  message += `━━━━━━━━━━━━━━━━━━━━━\n\n`;

  items.slice(0, 5).forEach((item, index) => {
    message += `${index + 1}️⃣ *${item.title}*\n`;
    message += `• Source: ${item.sourceName}\n`;
    if (item.matchedKeywords.length > 0) {
      message += `• Keywords: ${item.matchedKeywords.join(", ")}\n`;
    }
    message += `• Link: ${item.link}\n\n`;
  });

  if (items.length > 5) {
    message += `_...and ${items.length - 5} more opportunities found._\n\n`;
  }

  if (dashboardUrl) {
    message += `📊 _Full Table: ${dashboardUrl}_`;
  }

  return message.trim();
}

/**
 * 1. Kapso.ai WhatsApp Gateway (2,000 Free Messages/Month)
 */
async function sendViaKapso(
  text: string,
  settings: UserSettings,
  env: Env
): Promise<{ ok: boolean; error?: string }> {
  const apiKey = settings.kapsoApiKey || env.KAPSO_API_KEY;
  const phoneId = settings.kapsoPhoneNumberId || env.KAPSO_PHONE_NUMBER_ID;
  const toPhone = (settings.kapsoRecipientPhone || env.KAPSO_RECIPIENT_PHONE || "").replace(/[^0-9]/g, "");

  if (!apiKey || !phoneId || !toPhone) {
    return { ok: false, error: "Kapso credentials missing (API Key, Phone ID, or Recipient Phone)." };
  }

  const url = `https://api.kapso.ai/meta/whatsapp/v24.0/${phoneId}/messages`;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "X-API-Key": apiKey,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: toPhone,
        type: "text",
        text: { body: text }
      })
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error(`[Kapso] Error HTTP ${res.status}:`, errText);
      return { ok: false, error: `Kapso error (${res.status}): ${errText}` };
    }
    return { ok: true };
  } catch (err: any) {
    return { ok: false, error: err?.message || String(err) };
  }
}

/**
 * 2. Meta Official WhatsApp Cloud API (1,000 Free Messages/Month)
 */
async function sendViaMetaCloudApi(
  text: string,
  settings: UserSettings,
  env: Env
): Promise<{ ok: boolean; error?: string }> {
  const phoneId = settings.metaPhoneNumberId || env.META_PHONE_NUMBER_ID;
  const token = settings.metaAccessToken || env.META_ACCESS_TOKEN;
  const toPhone = (settings.metaRecipientPhone || env.META_RECIPIENT_PHONE || "").replace(/[^0-9]/g, "");

  if (!phoneId || !token || !toPhone) {
    return { ok: false, error: "Meta Cloud API credentials missing (Phone ID, Token, or Recipient Phone)." };
  }

  const url = `https://graph.facebook.com/v21.0/${phoneId}/messages`;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: toPhone,
        type: "text",
        text: {
          preview_url: true,
          body: text
        }
      })
    });

    if (!res.ok) {
      const errText = await res.text();
      return { ok: false, error: `Meta Cloud API (${res.status}): ${errText}` };
    }
    return { ok: true };
  } catch (err: any) {
    return { ok: false, error: err?.message || String(err) };
  }
}

/**
 * 3. Twilio WhatsApp API
 */
async function sendViaTwilio(
  text: string,
  settings: UserSettings,
  env: Env
): Promise<{ ok: boolean; error?: string }> {
  const accountSid = settings.twilioAccountSid || env.TWILIO_ACCOUNT_SID;
  const authToken = settings.twilioAuthToken || env.TWILIO_AUTH_TOKEN;
  const fromPhone = settings.twilioFromPhone || env.TWILIO_FROM_PHONE || "whatsapp:+14155238886";
  const toPhone = settings.twilioToPhone || env.TWILIO_TO_PHONE;

  if (!accountSid || !authToken || !toPhone) {
    return { ok: false, error: "Twilio credentials missing." };
  }

  const cleanTo = toPhone.startsWith("whatsapp:") ? toPhone : `whatsapp:${toPhone}`;
  const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;

  const bodyData = new URLSearchParams();
  bodyData.append("From", fromPhone);
  bodyData.append("To", cleanTo);
  bodyData.append("Body", text);

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Authorization": "Basic " + btoa(`${accountSid}:${authToken}`),
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: bodyData.toString()
    });

    if (!res.ok) {
      const errText = await res.text();
      return { ok: false, error: `Twilio error: ${errText}` };
    }
    return { ok: true };
  } catch (err: any) {
    return { ok: false, error: err?.message || String(err) };
  }
}

/**
 * 4. Green-API WhatsApp
 */
async function sendViaGreenApi(
  text: string,
  settings: UserSettings,
  env: Env,
  chatIdOverride?: string
): Promise<{ ok: boolean; error?: string }> {
  const instanceId = settings.greenApiInstanceId || env.GREENAPI_INSTANCE_ID;
  const token = settings.greenApiToken || env.GREENAPI_API_TOKEN;
  const phone = (settings.callmebotPhone || env.CALLMEBOT_PHONE || "").replace(/[^0-9]/g, "");
  const chatId = chatIdOverride || `${phone}@c.us`;

  if (!instanceId || !token || !chatId) {
    return { ok: false, error: "Green-API credentials missing." };
  }

  const url = `https://api.green-api.com/waInstance${instanceId}/sendMessage/${token}`;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chatId, message: text })
    });
    return { ok: res.ok };
  } catch (err: any) {
    return { ok: false, error: err?.message || String(err) };
  }
}

/**
 * 5. CallMeBot WhatsApp
 */
async function sendViaCallMeBot(
  text: string,
  settings: UserSettings,
  env: Env
): Promise<{ ok: boolean; error?: string }> {
  const phone = settings.callmebotPhone || env.CALLMEBOT_PHONE;
  const apiKey = settings.callmebotApiKey || env.CALLMEBOT_APIKEY;

  if (!phone || !apiKey) {
    return { ok: false, error: "CallMeBot phone or API key missing." };
  }

  const cleanPhone = phone.replace(/[^0-9+]/g, "");
  const encodedText = encodeURIComponent(text);
  const url = `https://api.callmebot.com/whatsapp.php?phone=${cleanPhone}&text=${encodedText}&apikey=${apiKey}`;

  try {
    const res = await fetch(url, { method: "GET" });
    return { ok: res.ok };
  } catch (err: any) {
    return { ok: false, error: err?.message || String(err) };
  }
}

/**
 * 6. Telegram Bot API
 */
async function sendViaTelegram(
  text: string,
  settings: UserSettings,
  env: Env,
  topicId?: number
): Promise<{ ok: boolean; error?: string }> {
  const token = settings.telegramBotToken || env.TELEGRAM_BOT_TOKEN;
  const chatId = settings.telegramChatId || env.TELEGRAM_CHAT_ID;

  if (!token || !chatId) {
    return { ok: false, error: "Telegram credentials missing." };
  }

  const url = `https://api.telegram.org/bot${token}/sendMessage`;
  const payload: any = {
    chat_id: chatId,
    text: text,
    parse_mode: "Markdown"
  };
  if (topicId) payload.message_thread_id = topicId;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    return { ok: res.ok };
  } catch (err: any) {
    return { ok: false, error: err?.message || String(err) };
  }
}

/**
 * Execute dispatch on a specific target
 */
async function executeProviderSend(
  provider: NotificationChannel,
  text: string,
  settings: UserSettings,
  env: Env,
  topicId?: number
): Promise<{ ok: boolean; error?: string }> {
  switch (provider) {
    case "whatsapp_kapso":
      return await sendViaKapso(text, settings, env);
    case "whatsapp_meta":
      return await sendViaMetaCloudApi(text, settings, env);
    case "whatsapp_twilio":
      return await sendViaTwilio(text, settings, env);
    case "whatsapp_greenapi":
      return await sendViaGreenApi(text, settings, env);
    case "whatsapp_callmebot":
      return await sendViaCallMeBot(text, settings, env);
    case "telegram":
      return await sendViaTelegram(text, settings, env, topicId);
    default:
      return { ok: false, error: `Unknown provider: ${provider}` };
  }
}

/**
 * Get monthly limit for a given provider
 */
function getProviderLimit(provider: NotificationChannel, settings: UserSettings): number {
  switch (provider) {
    case "whatsapp_kapso":
      return settings.kapsoMonthlyLimit || 2000;
    case "whatsapp_meta":
      return settings.metaMonthlyLimit || 1000;
    case "whatsapp_twilio":
      return settings.twilioMonthlyLimit || 1000;
    case "whatsapp_greenapi":
      return settings.greenApiMonthlyLimit || 100;
    case "whatsapp_callmebot":
      return 500;
    case "telegram":
      return 999999;
    default:
      return 1000;
  }
}

/**
 * Master Router: Dispatches single message, handling failover and monthly limit cycling
 */
async function dispatchWithRouting(
  text: string,
  settings: UserSettings,
  env: Env,
  topicId?: number
): Promise<{ ok: boolean; providerUsed?: string; error?: string }> {
  // If specific target chosen and not auto_router
  if (settings.notificationTarget !== "auto_router") {
    const res = await executeProviderSend(settings.notificationTarget, text, settings, env, topicId);
    if (res.ok) {
      await incrementProviderUsage(env, settings.notificationTarget);
      return { ok: true, providerUsed: settings.notificationTarget };
    }
    return { ok: false, error: res.error };
  }

  // AUTO-ROUTER: Loop through priority order and cycle when limits hit or error occurs
  const priority = settings.routerPriority || [
    "whatsapp_kapso",
    "whatsapp_meta",
    "whatsapp_twilio",
    "whatsapp_greenapi",
    "telegram"
  ];

  const failureLog: string[] = [];

  for (const candidate of priority) {
    // 1. Check monthly quota in KV
    const usage = await getProviderUsage(env, candidate);
    const limit = getProviderLimit(candidate, settings);

    if (usage >= limit) {
      console.log(`[Auto-Router] ${candidate} reached monthly limit (${usage}/${limit}). Cycling to next...`);
      failureLog.push(`${candidate}: Quota exceeded (${usage}/${limit})`);
      continue;
    }

    // 2. Try sending
    const res = await executeProviderSend(candidate, text, settings, env, topicId);
    if (res.ok) {
      await incrementProviderUsage(env, candidate);
      console.log(`[Auto-Router] Successfully sent via ${candidate} (Month usage: ${usage + 1}/${limit})`);
      return { ok: true, providerUsed: candidate };
    } else {
      console.warn(`[Auto-Router] ${candidate} failed: ${res.error}. Cascading to next provider...`);
      failureLog.push(`${candidate}: ${res.error}`);
    }
  }

  return {
    ok: false,
    error: `All providers exhausted: ${failureLog.join(" | ")}`
  };
}

/**
 * Master Opportunity Dispatcher
 */
export async function dispatchOpportunities(
  items: OpportunityItem[],
  settings: UserSettings,
  env: Env,
  dashboardUrl?: string
): Promise<{ dispatchedCount: number; providerUsed?: string; errors: string[] }> {
  if (items.length === 0) {
    return { dispatchedCount: 0, errors: [] };
  }

  // 1. Enforce per-source limit
  const sourceCountMap = new Map<string, number>();
  const filteredItems: OpportunityItem[] = [];

  for (const item of items) {
    const currentFromSource = sourceCountMap.get(item.sourceName) || 0;
    if (currentFromSource < settings.maxPerSource) {
      filteredItems.push(item);
      sourceCountMap.set(item.sourceName, currentFromSource + 1);
    }
  }

  // 2. Enforce total messages limit
  const itemsToSend = filteredItems.slice(0, settings.maxTotalMessages);
  console.log(`[Notifier] Selected ${itemsToSend.length} items to dispatch (Target: ${settings.notificationTarget}, Mode: ${settings.messageMode})`);

  let dispatchedCount = 0;
  const errors: string[] = [];
  let lastProviderUsed: string | undefined;

  if (settings.messageMode === "individual") {
    // Send each opportunity as an individual message
    for (let i = 0; i < itemsToSend.length; i++) {
      const item = itemsToSend[i];
      const link = (i === itemsToSend.length - 1) ? dashboardUrl : undefined;
      const text = formatIndividualMessage(item, link);

      const res = await dispatchWithRouting(text, settings, env);
      if (res.ok) {
        dispatchedCount++;
        lastProviderUsed = res.providerUsed;
      } else {
        errors.push(res.error || `Failed to dispatch: ${item.title}`);
      }

      // Pacing delay between dispatches (1.2 seconds)
      if (i < itemsToSend.length - 1) {
        await sleep(1200);
      }
    }
  } else {
    // Send as category digests
    const categoryMap = new Map<string, OpportunityItem[]>();
    for (const item of itemsToSend) {
      const list = categoryMap.get(item.categoryId) || [];
      list.push(item);
      categoryMap.set(item.categoryId, list);
    }

    const categoriesList = Array.from(categoryMap.entries());
    for (let i = 0; i < categoriesList.length; i++) {
      const [catId, catItems] = categoriesList[i];
      const dummyCat: CategoryDefinition = {
        id: catId,
        displayName: catItems[0].categoryName,
        icon: catItems[0].categoryIcon,
        sources: [],
        keywords: { include: [], exclude: [] }
      };

      const link = (i === categoriesList.length - 1) ? dashboardUrl : undefined;
      const text = formatDigestMessage(dummyCat, catItems, link);

      const res = await dispatchWithRouting(text, settings, env, catItems[0].categoryId === "grants_fellowships" ? 1 : undefined);
      if (res.ok) {
        dispatchedCount++;
        lastProviderUsed = res.providerUsed;
      } else {
        errors.push(res.error || `Failed digest for: ${dummyCat.displayName}`);
      }

      if (i < categoriesList.length - 1) {
        await sleep(1200);
      }
    }
  }

  return { dispatchedCount, providerUsed: lastProviderUsed, errors };
}
