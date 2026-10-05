import { CATEGORIES } from "../config/categories";
import { UserSettings } from "../types";

export function renderDashboardHtml(settings: UserSettings, availableDates: string[]): string {
  const categoriesJson = JSON.stringify(CATEGORIES);
  const settingsJson = JSON.stringify(settings);
  const datesJson = JSON.stringify(availableDates);

  return `<!DOCTYPE html>
<html lang="en" class="h-full bg-slate-900 text-slate-100">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Opportunity Radar — Control Plane & Daily Table</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    ::-webkit-scrollbar { width: 6px; height: 6px; }
    ::-webkit-scrollbar-thumb { background: #334155; border-radius: 4px; }
    ::-webkit-scrollbar-track { background: #0f172a; }
  </style>
</head>
<body class="h-full flex flex-col font-sans antialiased">

  <!-- Header -->
  <header class="border-b border-slate-800 bg-slate-950/80 backdrop-blur sticky top-0 z-40 px-6 py-4 flex flex-wrap items-center justify-between gap-4">
    <div class="flex items-center gap-3">
      <div class="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 to-orange-600 flex items-center justify-center text-xl shadow-lg shadow-orange-500/20">
        📡
      </div>
      <div>
        <h1 class="text-xl font-bold tracking-tight text-white flex items-center gap-2">
          Opportunity Radar
          <span class="text-xs px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 font-medium">Control Plane</span>
        </h1>
        <p class="text-xs text-slate-400">Autonomous Cloudflare Crawler • Full Boolean Query Engine • Multi-Gateway WhatsApp Router</p>
      </div>
    </div>

    <!-- Quick Action Buttons -->
    <div class="flex items-center gap-3">
      <button id="btn-test-ping" class="px-3.5 py-1.5 rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 transition flex items-center gap-1.5">
        <span>📲</span> Test Alert Ping
      </button>
      <button id="btn-dry-run" class="px-3.5 py-1.5 rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 transition flex items-center gap-1.5">
        <span>🔍</span> Preview Matches
      </button>
      <button id="btn-run-live" class="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-xs font-semibold text-white shadow-md shadow-emerald-600/20 transition flex items-center gap-1.5">
        <span>🚀</span> Run Crawl & Send
      </button>
    </div>
  </header>

  <!-- Navigation Tabs -->
  <div class="border-b border-slate-800 bg-slate-900/60 px-6 flex gap-6 text-sm">
    <button id="tab-table-btn" class="py-3 px-1 border-b-2 border-orange-500 text-orange-400 font-medium flex items-center gap-2">
      <span>📊</span> Daily Opportunities Table
    </button>
    <button id="tab-settings-btn" class="py-3 px-1 border-b-2 border-transparent text-slate-400 hover:text-slate-200 font-medium flex items-center gap-2">
      <span>⚙️</span> Control Plane & Boolean Engine
    </button>
  </div>

  <!-- Main Container -->
  <main class="flex-1 overflow-auto p-6 max-w-7xl w-full mx-auto">

    <!-- TAB 1: DAILY TABLE -->
    <section id="tab-table" class="space-y-4">
      <!-- Filters bar -->
      <div class="bg-slate-950/60 p-4 rounded-xl border border-slate-800 flex flex-wrap gap-4 items-center justify-between">
        <div class="flex flex-wrap items-center gap-3 flex-1 min-w-[280px]">
          <!-- Search -->
          <div class="relative flex-1 min-w-[240px]">
            <span class="absolute left-3 top-2.5 text-slate-500 text-xs">🔍</span>
            <input type="text" id="search-input" placeholder="Search keywords or boolean query: (AI OR grant) AND Africa -scam..." 
              class="w-full bg-slate-900 border border-slate-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-orange-500 font-mono">
          </div>
          <!-- Date Filter -->
          <select id="date-select" class="bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-orange-500">
          </select>
          <!-- Category Filter -->
          <select id="category-filter" class="bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-orange-500">
            <option value="">All Categories</option>
          </select>
        </div>

        <div class="text-xs text-slate-400">
          Showing <span id="table-count" class="font-bold text-orange-400">0</span> opportunities
        </div>
      </div>

      <!-- Opportunities Table Card -->
      <div class="bg-slate-950/60 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
        <div class="overflow-x-auto">
          <table class="w-full text-left text-xs">
            <thead class="bg-slate-900/90 text-slate-400 border-b border-slate-800 font-semibold uppercase tracking-wider">
              <tr>
                <th class="py-3 px-4 w-40">Category</th>
                <th class="py-3 px-4">Title & Details</th>
                <th class="py-3 px-4 w-48">Source & Date</th>
                <th class="py-3 px-4 w-32 text-right">Action</th>
              </tr>
            </thead>
            <tbody id="table-body" class="divide-y divide-slate-800/60 text-slate-300">
              <tr>
                <td colspan="4" class="text-center py-12 text-slate-500">Loading opportunities...</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </section>

    <!-- TAB 2: CONTROL PLANE SETTINGS & QUOTA ROUTER -->
    <section id="tab-settings" class="hidden space-y-6">

      <!-- Real-Time Monthly Quota & Router Balancer Card -->
      <div class="bg-slate-950/60 p-6 rounded-xl border border-slate-800 space-y-4">
        <div class="flex items-center justify-between">
          <div>
            <h2 class="text-base font-semibold text-white flex items-center gap-2">
              <span>⚡</span> Monthly Provider Quota Monitor & Auto-Balancer
            </h2>
            <p class="text-xs text-slate-400">Real-time usage counters in Cloudflare KV. Automatically balances and hops between providers when limits expire.</p>
          </div>
          <button id="btn-refresh-quotas" type="button" class="px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-700 text-xs text-slate-300 transition flex items-center gap-1.5">
            <span>🔄</span> Refresh Quotas
          </button>
        </div>

        <div id="quota-cards-grid" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-2">
          <div class="bg-slate-900/80 border border-slate-800 p-3.5 rounded-lg text-xs text-slate-400">Loading quota statistics...</div>
        </div>
      </div>

      <form id="settings-form" class="space-y-6">

        <!-- Notification Provider Selector Card -->
        <div class="bg-slate-950/60 p-6 rounded-xl border border-slate-800 space-y-4">
          <h2 class="text-base font-semibold text-white flex items-center gap-2">
            <span>📡</span> Notification Delivery Target
          </h2>
          <p class="text-xs text-slate-400">Select <strong>Auto-Router</strong> to cycle between providers as quotas fill, or pick a direct destination.</p>

          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pt-2">
            <!-- Auto-Router -->
            <label class="border-2 border-orange-500/80 bg-orange-950/20 p-3 rounded-lg cursor-pointer hover:border-orange-400 flex flex-col gap-1.5 text-xs transition">
              <div class="flex items-center gap-2">
                <input type="radio" name="notificationTarget" value="auto_router" class="text-orange-500 focus:ring-orange-500">
                <span class="font-bold text-white text-sm">🔄 Auto-Router</span>
              </div>
              <span class="text-orange-300 text-[11px] font-medium">Kapso (2k) → Meta (1k) → Twilio (1k) → Telegram (∞)</span>
              <span class="text-slate-400 text-[10px]">Cascades to next provider if monthly limit is exhausted or on failure.</span>
            </label>

            <!-- Kapso.ai Gateway -->
            <label class="border border-slate-800 bg-slate-900/70 p-3 rounded-lg cursor-pointer hover:border-orange-500/50 flex flex-col gap-1.5 text-xs transition">
              <div class="flex items-center gap-2">
                <input type="radio" name="notificationTarget" value="whatsapp_kapso" class="text-orange-500 focus:ring-orange-500">
                <span class="font-bold text-white">Kapso.ai Gateway</span>
              </div>
              <span class="text-emerald-400 text-[11px] font-medium">WhatsApp Cloud • 2,000 free/mo</span>
              <span class="text-slate-400 text-[10px]">Direct REST API with pre-verified number & sandbox support.</span>
            </label>

            <!-- Meta Official Cloud API -->
            <label class="border border-slate-800 bg-slate-900/70 p-3 rounded-lg cursor-pointer hover:border-orange-500/50 flex flex-col gap-1.5 text-xs transition">
              <div class="flex items-center gap-2">
                <input type="radio" name="notificationTarget" value="whatsapp_meta" class="text-orange-500 focus:ring-orange-500">
                <span class="font-bold text-white">Meta Cloud API</span>
              </div>
              <span class="text-emerald-400 text-[11px] font-medium">Meta Official • 1,000 free/mo</span>
              <span class="text-slate-400 text-[10px]">Graph API v21.0 endpoint.</span>
            </label>

            <!-- Twilio Sandbox -->
            <label class="border border-slate-800 bg-slate-900/70 p-3 rounded-lg cursor-pointer hover:border-orange-500/50 flex flex-col gap-1.5 text-xs transition">
              <div class="flex items-center gap-2">
                <input type="radio" name="notificationTarget" value="whatsapp_twilio" class="text-orange-500 focus:ring-orange-500">
                <span class="font-bold text-white">Twilio Sandbox</span>
              </div>
              <span class="text-blue-400 text-[11px] font-medium">Twilio Trial • 1,000 free messages</span>
              <span class="text-slate-400 text-[10px]">Standard Twilio API sandbox.</span>
            </label>

            <!-- Telegram Bot -->
            <label class="border border-slate-800 bg-slate-900/70 p-3 rounded-lg cursor-pointer hover:border-orange-500/50 flex flex-col gap-1.5 text-xs transition">
              <div class="flex items-center gap-2">
                <input type="radio" name="notificationTarget" value="telegram" class="text-orange-500 focus:ring-orange-500">
                <span class="font-bold text-white">Telegram Bot</span>
              </div>
              <span class="text-sky-400 text-[11px] font-medium">100% Free • Unlimited • Topics</span>
              <span class="text-slate-400 text-[10px]">Zero cost backup channel with forum topics.</span>
            </label>

            <!-- CallMeBot (Legacy) -->
            <label class="border border-slate-800 bg-slate-900/70 p-3 rounded-lg cursor-pointer hover:border-orange-500/50 flex flex-col gap-1.5 text-xs transition">
              <div class="flex items-center gap-2">
                <input type="radio" name="notificationTarget" value="whatsapp_callmebot" class="text-orange-500 focus:ring-orange-500">
                <span class="font-bold text-white">CallMeBot (Legacy)</span>
              </div>
              <span class="text-amber-400 text-[11px] font-medium">Community Gateway</span>
              <span class="text-slate-400 text-[10px]">Direct personal WhatsApp ping.</span>
            </label>
          </div>

          <!-- Credentials Container -->
          <div class="pt-4 border-t border-slate-800 space-y-4">
            <div id="router-info-banner" class="bg-orange-950/30 border border-orange-500/30 rounded-lg p-3 text-xs text-orange-200 flex items-start gap-2">
              <span class="text-base">ℹ️</span>
              <div>
                <strong>Auto-Router Active:</strong> Cascades: <span class="underline">Kapso.ai (2,000/mo)</span> → <span class="underline">Meta Cloud API (1,000/mo)</span> → <span class="underline">Twilio (1,000/mo)</span> → <span class="underline">Telegram (Unlimited)</span>. Unconfigured services are skipped seamlessly.
              </div>
            </div>

            <!-- Kapso -->
            <div id="fields-kapso" class="bg-slate-900/60 p-4 rounded-lg border border-slate-800 space-y-3">
              <h3 class="text-xs font-semibold text-emerald-400 flex items-center gap-1.5">
                <span>🟢</span> Kapso.ai Gateway Settings (2,000 Free/Mo)
              </h3>
              <div class="grid grid-cols-1 md:grid-cols-4 gap-3">
                <div>
                  <label class="block text-[11px] font-medium text-slate-300 mb-1">Kapso API Key</label>
                  <input type="password" id="kapsoApiKey" placeholder="kps_live_..." class="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-orange-500">
                </div>
                <div>
                  <label class="block text-[11px] font-medium text-slate-300 mb-1">Phone Number ID</label>
                  <input type="text" id="kapsoPhoneNumberId" placeholder="597907523413541" class="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-orange-500">
                </div>
                <div>
                  <label class="block text-[11px] font-medium text-slate-300 mb-1">Recipient Phone</label>
                  <input type="text" id="kapsoRecipientPhone" placeholder="2348149386184" class="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-orange-500">
                </div>
                <div>
                  <label class="block text-[11px] font-medium text-slate-300 mb-1">Monthly Quota Cap</label>
                  <input type="number" id="kapsoMonthlyLimit" placeholder="2000" class="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-orange-500">
                </div>
              </div>
            </div>

            <!-- Meta -->
            <div id="fields-meta" class="bg-slate-900/60 p-4 rounded-lg border border-slate-800 space-y-3">
              <h3 class="text-xs font-semibold text-emerald-400 flex items-center gap-1.5">
                <span>🔵</span> Meta Official WhatsApp Cloud API (1,000 Free/Mo)
              </h3>
              <div class="grid grid-cols-1 md:grid-cols-4 gap-3">
                <div>
                  <label class="block text-[11px] font-medium text-slate-300 mb-1">Phone Number ID</label>
                  <input type="text" id="metaPhoneNumberId" placeholder="104829104829102" class="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-orange-500">
                </div>
                <div>
                  <label class="block text-[11px] font-medium text-slate-300 mb-1">Access Token</label>
                  <input type="password" id="metaAccessToken" placeholder="EAAB..." class="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-orange-500">
                </div>
                <div>
                  <label class="block text-[11px] font-medium text-slate-300 mb-1">Recipient Phone</label>
                  <input type="text" id="metaRecipientPhone" placeholder="2348012345678" class="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-orange-500">
                </div>
                <div>
                  <label class="block text-[11px] font-medium text-slate-300 mb-1">Monthly Quota Cap</label>
                  <input type="number" id="metaMonthlyLimit" placeholder="1000" class="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-orange-500">
                </div>
              </div>
            </div>

            <!-- Twilio -->
            <div id="fields-twilio" class="bg-slate-900/60 p-4 rounded-lg border border-slate-800 space-y-3">
              <h3 class="text-xs font-semibold text-blue-400 flex items-center gap-1.5">
                <span>🔴</span> Twilio WhatsApp Sandbox (1,000 Free Messages)
              </h3>
              <div class="grid grid-cols-1 md:grid-cols-4 gap-3">
                <div>
                  <label class="block text-[11px] font-medium text-slate-300 mb-1">Account SID</label>
                  <input type="text" id="twilioAccountSid" placeholder="AC..." class="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-orange-500">
                </div>
                <div>
                  <label class="block text-[11px] font-medium text-slate-300 mb-1">Auth Token</label>
                  <input type="password" id="twilioAuthToken" placeholder="Auth token" class="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-orange-500">
                </div>
                <div>
                  <label class="block text-[11px] font-medium text-slate-300 mb-1">Recipient WhatsApp</label>
                  <input type="text" id="twilioToPhone" placeholder="+2348012345678" class="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-orange-500">
                </div>
                <div>
                  <label class="block text-[11px] font-medium text-slate-300 mb-1">Monthly Quota Cap</label>
                  <input type="number" id="twilioMonthlyLimit" placeholder="1000" class="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-orange-500">
                </div>
              </div>
            </div>

            <!-- Telegram -->
            <div id="fields-telegram" class="bg-slate-900/60 p-4 rounded-lg border border-slate-800 space-y-3">
              <h3 class="text-xs font-semibold text-sky-400 flex items-center gap-1.5">
                <span>✈️</span> Telegram Bot API (100% Free • Unlimited Backup)
              </h3>
              <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label class="block text-[11px] font-medium text-slate-300 mb-1">Telegram Bot Token</label>
                  <input type="password" id="telegramBotToken" placeholder="123456:ABC-DEF..." class="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-orange-500">
                </div>
                <div>
                  <label class="block text-[11px] font-medium text-slate-300 mb-1">Telegram Chat ID / Channel</label>
                  <input type="text" id="telegramChatId" placeholder="123456789 or -100..." class="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-orange-500">
                </div>
              </div>
            </div>

            <!-- CallMeBot -->
            <div id="fields-callmebot" class="bg-slate-900/60 p-4 rounded-lg border border-slate-800 space-y-3">
              <h3 class="text-xs font-semibold text-amber-400 flex items-center gap-1.5">
                <span>📱</span> CallMeBot Settings
              </h3>
              <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label class="block text-[11px] font-medium text-slate-300 mb-1">Phone Number (with Country Code)</label>
                  <input type="text" id="callmebotPhone" placeholder="+2348012345678" class="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-orange-500">
                </div>
                <div>
                  <label class="block text-[11px] font-medium text-slate-300 mb-1">CallMeBot API Key</label>
                  <input type="text" id="callmebotApiKey" placeholder="API Key" class="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-orange-500">
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Message Mode & Limits Card -->
        <div class="bg-slate-950/60 p-6 rounded-xl border border-slate-800 space-y-5">
          <h2 class="text-base font-semibold text-white flex items-center gap-2">
            <span>💬</span> Message Format & Dispatch Limits
          </h2>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <!-- Mode Radio -->
            <div class="space-y-2">
              <label class="block text-xs font-medium text-slate-300">Message Style</label>
              <div class="grid grid-cols-2 gap-3">
                <label class="border border-slate-800 bg-slate-900/70 p-3 rounded-lg cursor-pointer hover:border-orange-500/50 flex flex-col gap-1 text-xs">
                  <div class="flex items-center gap-2">
                    <input type="radio" name="messageMode" value="individual" class="text-orange-500 focus:ring-orange-500">
                    <span class="font-bold text-white">Individual Messages</span>
                  </div>
                  <span class="text-slate-400 text-[11px]">Separate message per opportunity with full details & apply link.</span>
                </label>
                <label class="border border-slate-800 bg-slate-900/70 p-3 rounded-lg cursor-pointer hover:border-orange-500/50 flex flex-col gap-1 text-xs">
                  <div class="flex items-center gap-2">
                    <input type="radio" name="messageMode" value="digest" class="text-orange-500 focus:ring-orange-500">
                    <span class="font-bold text-white">Category Digest</span>
                  </div>
                  <span class="text-slate-400 text-[11px]">Combined summary message per category.</span>
                </label>
              </div>
            </div>

            <!-- Limits -->
            <div class="grid grid-cols-2 gap-4">
              <div>
                <label class="block text-xs font-medium text-slate-300 mb-1">Max Total Messages / Run</label>
                <input type="number" id="maxTotalMessages" min="1" max="50" class="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-orange-500">
              </div>
              <div>
                <label class="block text-xs font-medium text-slate-300 mb-1">Max per Source Platform</label>
                <input type="number" id="maxPerSource" min="1" max="10" class="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-orange-500">
              </div>
            </div>
          </div>

          <!-- Freshness Lookback -->
          <div class="w-full md:w-1/3">
            <label class="block text-xs font-medium text-slate-300 mb-1">Freshness Window (Days)</label>
            <input type="number" id="maxAgeDays" min="1" max="14" class="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-orange-500">
          </div>
        </div>

        <!-- Source Platforms Selection Card -->
        <div class="bg-slate-950/60 p-6 rounded-xl border border-slate-800 space-y-4">
          <div class="flex items-center justify-between">
            <h2 class="text-base font-semibold text-white flex items-center gap-2">
              <span>🌐</span> Enabled Source Platforms
            </h2>
            <div class="flex gap-2">
              <button type="button" id="btn-select-all" class="text-xs text-orange-400 hover:underline">Select All</button>
              <span class="text-slate-600">•</span>
              <button type="button" id="btn-deselect-all" class="text-xs text-slate-400 hover:underline">Deselect All</button>
            </div>
          </div>
          <div id="sources-checkboxes-grid" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pt-2">
          </div>
        </div>

        <!-- Advanced Keyword Query & Filter Engine Card -->
        <div class="bg-slate-950/60 p-6 rounded-xl border border-slate-800 space-y-5">
          <div class="flex items-center justify-between">
            <div>
              <h2 class="text-base font-semibold text-white flex items-center gap-2">
                <span>🎯</span> Advanced Keyword Query & Filter Engine
              </h2>
              <p class="text-xs text-slate-400">Filter each category using either <strong>Simple Keyword Lists</strong> or <strong>Full Boolean Query Expressions</strong> with Twitter-style operators.</p>
            </div>
            <button type="button" id="btn-reset-keywords" class="text-xs text-orange-400 hover:underline">Reset All to Defaults</button>
          </div>

          <!-- Dropdown Tutorial Panel: Twitter Search Operators Guide -->
          <details class="group bg-slate-900/90 border border-slate-800 rounded-xl overflow-hidden transition shadow-sm">
            <summary class="px-4 py-3 bg-slate-900 hover:bg-slate-850 cursor-pointer flex items-center justify-between text-xs font-semibold text-orange-400 select-none">
              <span class="flex items-center gap-2">
                <span>📖</span> Twitter-Style Search Operators Guide & Tutorials (Click to expand cheatsheet)
              </span>
              <span class="text-slate-500 group-open:rotate-180 transition-transform text-[11px]">▼</span>
            </summary>
            <div class="p-4 border-t border-slate-800 bg-slate-950/60 space-y-3.5">
              <p class="text-[11px] text-slate-300">
                You can use all of these Twitter-style operators inside <strong>Boolean Query Mode</strong> or in the <strong>Daily Table Search Bar</strong>:
              </p>

              <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
                
                <!-- Operator 1: Exact Phrase -->
                <div class="bg-slate-900 border border-slate-800 p-3 rounded-lg space-y-1.5">
                  <div class="flex items-center justify-between">
                    <span class="font-mono text-orange-400 font-bold bg-orange-500/10 px-1.5 py-0.5 rounded border border-orange-500/20">"exact phrase"</span>
                    <span class="text-[10px] text-slate-500">Phrase</span>
                  </div>
                  <p class="text-[11px] text-slate-300">Matches the exact sequence of words together in order.</p>
                  <div class="text-[10px] font-mono text-slate-400 bg-slate-950 p-1.5 rounded border border-slate-800/80">
                    "AI policy", "fully funded", "seed round"
                  </div>
                </div>

                <!-- Operator 2: OR -->
                <div class="bg-slate-900 border border-slate-800 p-3 rounded-lg space-y-1.5">
                  <div class="flex items-center justify-between">
                    <span class="font-mono text-orange-400 font-bold bg-orange-500/10 px-1.5 py-0.5 rounded border border-orange-500/20">OR / ||</span>
                    <span class="text-[10px] text-slate-500">Union</span>
                  </div>
                  <p class="text-[11px] text-slate-300">Matches opportunities containing either term on either side.</p>
                  <div class="text-[10px] font-mono text-slate-400 bg-slate-950 p-1.5 rounded border border-slate-800/80">
                    grant OR fellowship OR award
                  </div>
                </div>

                <!-- Operator 3: AND -->
                <div class="bg-slate-900 border border-slate-800 p-3 rounded-lg space-y-1.5">
                  <div class="flex items-center justify-between">
                    <span class="font-mono text-orange-400 font-bold bg-orange-500/10 px-1.5 py-0.5 rounded border border-orange-500/20">AND / space</span>
                    <span class="text-[10px] text-slate-500">Intersection</span>
                  </div>
                  <p class="text-[11px] text-slate-300">Requires both conditions to be present in the opportunity.</p>
                  <div class="text-[10px] font-mono text-slate-400 bg-slate-950 p-1.5 rounded border border-slate-800/80">
                    fellowship AND policy (or: fellowship policy)
                  </div>
                </div>

                <!-- Operator 4: Negation -->
                <div class="bg-slate-900 border border-slate-800 p-3 rounded-lg space-y-1.5">
                  <div class="flex items-center justify-between">
                    <span class="font-mono text-rose-400 font-bold bg-rose-500/10 px-1.5 py-0.5 rounded border border-rose-500/20">-term / NOT</span>
                    <span class="text-[10px] text-slate-500">Exclusion</span>
                  </div>
                  <p class="text-[11px] text-slate-300">Discards any opportunity matching the word or quoted phrase.</p>
                  <div class="text-[10px] font-mono text-slate-400 bg-slate-950 p-1.5 rounded border border-slate-800/80">
                    -"high school" -undergraduate NOT scam
                  </div>
                </div>

                <!-- Operator 5: Grouping -->
                <div class="bg-slate-900 border border-slate-800 p-3 rounded-lg space-y-1.5">
                  <div class="flex items-center justify-between">
                    <span class="font-mono text-sky-400 font-bold bg-sky-500/10 px-1.5 py-0.5 rounded border border-sky-500/20">( ... )</span>
                    <span class="text-[10px] text-slate-500">Precedence</span>
                  </div>
                  <p class="text-[11px] text-slate-300">Groups clauses together to control evaluation logic.</p>
                  <div class="text-[10px] font-mono text-slate-400 bg-slate-950 p-1.5 rounded border border-slate-800/80">
                    (AI OR ML) AND (policy OR ethics)
                  </div>
                </div>

                <!-- Operator 6: Title Scope -->
                <div class="bg-slate-900 border border-slate-800 p-3 rounded-lg space-y-1.5">
                  <div class="flex items-center justify-between">
                    <span class="font-mono text-emerald-400 font-bold bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">title:"..."</span>
                    <span class="text-[10px] text-slate-500">Headline</span>
                  </div>
                  <p class="text-[11px] text-slate-300">Restricts matches strictly to the headline / opportunity title.</p>
                  <div class="text-[10px] font-mono text-slate-400 bg-slate-950 p-1.5 rounded border border-slate-800/80">
                    title:"pitch competition", title:fellowship
                  </div>
                </div>

                <!-- Operator 7: Body Scope -->
                <div class="bg-slate-900 border border-slate-800 p-3 rounded-lg space-y-1.5">
                  <div class="flex items-center justify-between">
                    <span class="font-mono text-emerald-400 font-bold bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">body:"..."</span>
                    <span class="text-[10px] text-slate-500">Description</span>
                  </div>
                  <p class="text-[11px] text-slate-300">Restricts matches to description & requirement details.</p>
                  <div class="text-[10px] font-mono text-slate-400 bg-slate-950 p-1.5 rounded border border-slate-800/80">
                    body:"living stipend", body:"non-equity"
                  </div>
                </div>

                <!-- Operator 8: Source / Platform -->
                <div class="bg-slate-900 border border-slate-800 p-3 rounded-lg space-y-1.5">
                  <div class="flex items-center justify-between">
                    <span class="font-mono text-amber-400 font-bold bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20">from: / source:</span>
                    <span class="text-[10px] text-slate-500">Platform</span>
                  </div>
                  <p class="text-[11px] text-slate-300">Filters items originated from a specific feed or platform name.</p>
                  <div class="text-[10px] font-mono text-slate-400 bg-slate-950 p-1.5 rounded border border-slate-800/80">
                    from:"Disrupt Africa", source:"Techstars"
                  </div>
                </div>

                <!-- Operator 9: URL -->
                <div class="bg-slate-900 border border-slate-800 p-3 rounded-lg space-y-1.5">
                  <div class="flex items-center justify-between">
                    <span class="font-mono text-blue-400 font-bold bg-blue-500/10 px-1.5 py-0.5 rounded border border-blue-500/20">url:"..."</span>
                    <span class="text-[10px] text-slate-500">Destination</span>
                  </div>
                  <p class="text-[11px] text-slate-300">Matches domain name or link path in the apply URL.</p>
                  <div class="text-[10px] font-mono text-slate-400 bg-slate-950 p-1.5 rounded border border-slate-800/80">
                    url:opportunitiesforafricans.com, url:github.com
                  </div>
                </div>

                <!-- Operator 10: has:links -->
                <div class="bg-slate-900 border border-slate-800 p-3 rounded-lg space-y-1.5">
                  <div class="flex items-center justify-between">
                    <span class="font-mono text-purple-400 font-bold bg-purple-500/10 px-1.5 py-0.5 rounded border border-purple-500/20">has:links</span>
                    <span class="text-[10px] text-slate-500">Link Filter</span>
                  </div>
                  <p class="text-[11px] text-slate-300">Requires the opportunity to contain a valid external apply link.</p>
                  <div class="text-[10px] font-mono text-slate-400 bg-slate-950 p-1.5 rounded border border-slate-800/80">
                    fellowship has:links
                  </div>
                </div>

                <!-- Operator 11: Wildcard -->
                <div class="bg-slate-900 border border-slate-800 p-3 rounded-lg space-y-1.5">
                  <div class="flex items-center justify-between">
                    <span class="font-mono text-orange-400 font-bold bg-orange-500/10 px-1.5 py-0.5 rounded border border-orange-500/20">prefix*</span>
                    <span class="text-[10px] text-slate-500">Wildcard</span>
                  </div>
                  <p class="text-[11px] text-slate-300">Matches any word starting with the prefix stem.</p>
                  <div class="text-[10px] font-mono text-slate-400 bg-slate-950 p-1.5 rounded border border-slate-800/80">
                    technol* (technology, technical), comput*
                  </div>
                </div>

              </div>
            </div>
          </details>

          <!-- Category Editors Accordion -->
          <div id="keywords-accordion" class="space-y-4 pt-1">
          </div>
        </div>

        <!-- Save Button -->
        <div class="flex justify-end pt-2">
          <button type="submit" id="btn-save-settings" class="px-6 py-2.5 rounded-lg bg-orange-600 hover:bg-orange-500 font-semibold text-xs text-white shadow-lg shadow-orange-600/20 transition flex items-center gap-2">
            <span>💾</span> Save Control Plane Settings
          </button>
        </div>
      </form>
    </section>

    <!-- Execution Log Modal / Panel -->
    <div id="log-panel" class="hidden fixed bottom-6 right-6 max-w-lg w-full bg-slate-950 border border-slate-800 rounded-xl shadow-2xl p-4 z-50 space-y-3">
      <div class="flex items-center justify-between border-b border-slate-800 pb-2">
        <h3 class="text-xs font-bold text-white flex items-center gap-1.5">
          <span class="animate-pulse text-emerald-400">●</span> Action Output & Logs
        </h3>
        <button id="btn-close-log" class="text-slate-400 hover:text-white text-xs">✕</button>
      </div>
      <div id="log-content" class="text-[11px] font-mono text-slate-300 max-h-60 overflow-y-auto space-y-1 bg-slate-900 p-2.5 rounded border border-slate-800/80">
      </div>
    </div>

  </main>

  <script>
    const INITIAL_CATEGORIES = ${categoriesJson};
    let CURRENT_SETTINGS = ${settingsJson};
    let AVAILABLE_DATES = ${datesJson};
    let ALL_OPPORTUNITIES = [];

    // Tabs
    const tabTableBtn = document.getElementById("tab-table-btn");
    const tabSettingsBtn = document.getElementById("tab-settings-btn");
    const tabTable = document.getElementById("tab-table");
    const tabSettings = document.getElementById("tab-settings");

    tabTableBtn.addEventListener("click", () => {
      tabTable.classList.remove("hidden");
      tabSettings.classList.add("hidden");
      tabTableBtn.className = "py-3 px-1 border-b-2 border-orange-500 text-orange-400 font-medium flex items-center gap-2";
      tabSettingsBtn.className = "py-3 px-1 border-b-2 border-transparent text-slate-400 hover:text-slate-200 font-medium flex items-center gap-2";
    });

    tabSettingsBtn.addEventListener("click", () => {
      tabSettings.classList.remove("hidden");
      tabTable.classList.add("hidden");
      tabSettingsBtn.className = "py-3 px-1 border-b-2 border-orange-500 text-orange-400 font-medium flex items-center gap-2";
      tabTableBtn.className = "py-3 px-1 border-b-2 border-transparent text-slate-400 hover:text-slate-200 font-medium flex items-center gap-2";
      loadQuotaStats();
    });

    // Provider Selector Toggle
    function updateProviderVisibility() {
      const selected = document.querySelector('input[name="notificationTarget"]:checked')?.value || "auto_router";
      const isAuto = (selected === "auto_router");

      document.getElementById("router-info-banner").classList.toggle("hidden", !isAuto);

      if (isAuto) {
        document.getElementById("fields-kapso").classList.remove("hidden");
        document.getElementById("fields-meta").classList.remove("hidden");
        document.getElementById("fields-twilio").classList.remove("hidden");
        document.getElementById("fields-telegram").classList.remove("hidden");
        document.getElementById("fields-callmebot").classList.remove("hidden");
      } else {
        document.getElementById("fields-kapso").classList.toggle("hidden", selected !== "whatsapp_kapso");
        document.getElementById("fields-meta").classList.toggle("hidden", selected !== "whatsapp_meta");
        document.getElementById("fields-twilio").classList.toggle("hidden", selected !== "whatsapp_twilio");
        document.getElementById("fields-telegram").classList.toggle("hidden", selected !== "telegram");
        document.getElementById("fields-callmebot").classList.toggle("hidden", selected !== "whatsapp_callmebot");
      }
    }

    document.querySelectorAll('input[name="notificationTarget"]').forEach(r => {
      r.addEventListener("change", updateProviderVisibility);
    });

    // Load and Render Quota Statistics
    async function loadQuotaStats() {
      const container = document.getElementById("quota-cards-grid");
      try {
        const res = await fetch("/api/usage");
        if (!res.ok) throw new Error("Failed to load quotas");
        const quotas = await res.json();
        
        let html = "";
        quotas.forEach(q => {
          const isUnlimited = q.monthlyLimit >= 999999;
          const pct = isUnlimited ? 0 : Math.min(100, Math.round((q.currentCount / q.monthlyLimit) * 100));
          const colorClass = pct > 90 ? "bg-rose-500" : pct > 75 ? "bg-amber-500" : "bg-emerald-500";
          const statusBadge = !q.configured 
            ? '<span class="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-500 border border-slate-700">Not Configured</span>'
            : q.active 
              ? '<span class="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-medium">Ready</span>'
              : '<span class="text-[10px] px-1.5 py-0.5 rounded bg-rose-500/10 text-rose-400 border border-rose-500/20 font-medium">Quota Hit</span>';

          html += \`
            <div class="bg-slate-900 border border-slate-800 p-3.5 rounded-lg space-y-2">
              <div class="flex items-center justify-between">
                <span class="font-medium text-xs text-white">\${q.displayName}</span>
                \${statusBadge}
              </div>
              <div class="flex items-baseline justify-between text-xs">
                <span class="text-slate-400 text-[11px]">\${q.currentCount} \${isUnlimited ? "messages sent" : "/ " + q.monthlyLimit.toLocaleString() + " msgs"}</span>
                <span class="font-mono text-[10px] text-slate-300">\${isUnlimited ? "Unlimited" : (100 - pct) + "% left"}</span>
              </div>
              <div class="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                <div class="\${colorClass} h-1.5 rounded-full transition-all duration-500" style="width: \${isUnlimited ? (q.currentCount > 0 ? '100%' : '0%') : pct + '%'}"></div>
              </div>
            </div>
          \`;
        });
        container.innerHTML = html;
      } catch (err) {
        container.innerHTML = \`<div class="col-span-full text-xs text-rose-400">Failed to load quotas: \${err.message}</div>\`;
      }
    }

    document.getElementById("btn-refresh-quotas").addEventListener("click", loadQuotaStats);

    // Default Keywords Dictionary
    const DEFAULT_CATEGORY_KEYWORDS = {
      grants_fellowships: {
        include: "grant, fellowship, funding, award, stipend, subsidy, ai, artificial intelligence, technology, policy, governance, safety, africa, nigeria, global, developing countries, emerging, social impact, climate, research, innovation, civic",
        exclude: "high school only, undergraduate only, kids competition",
        boolean: '(fellowship OR grant OR funding OR award) AND (AI OR "artificial intelligence" OR policy OR governance OR safety OR climate OR research OR Africa OR global) -("high school" OR undergraduate)'
      },
      scholarships: {
        include: "scholarship, masters, master's, phd, postgraduate, doctoral, fully funded, tuition waiver, living allowance, stipend, erasmus, chevening, fulbright, rhodes, daad, commonwealth, africa, international students, nigeria",
        exclude: "primary school, kindergarten, secondary school",
        boolean: '(scholarship OR masters OR PhD OR postgraduate) AND ("fully funded" OR stipend OR "tuition waiver" OR Erasmus OR Chevening OR Fulbright OR Africa) -("primary school" OR secondary)'
      },
      competitions_hackathons: {
        include: "hackathon, competition, pitch, challenge, contest, prize, demo day, ai, build, builder, innovate, coder, developer, founder, cash prize, grant prize",
        exclude: "children, essay contest for primary",
        boolean: '(hackathon OR competition OR pitch OR challenge OR "demo day") AND (AI OR builder OR coder OR developer OR founder OR "cash prize") -children'
      },
      angel_startup_funding: {
        include: "angel, pre-seed, seed, funding, accelerator, incubator, venture capital, vc, call for applications, applications open, cohort, pitch to investors, startup, founders, equity, capital, fund, investment, africa, fintech, ai, climate tech, saas, healthtech",
        exclude: "crypto scam, airdrop pump, meme coin",
        boolean: '("pre-seed" OR seed OR funding OR accelerator OR "venture capital" OR VC OR "pitch to investors") AND (startup OR founders OR Africa OR fintech OR AI OR SaaS) -(crypto OR meme OR airdrop)'
      },
      freelance_gigs: {
        include: "contract, contractor, freelance, consultant, gig, part-time, hourly, ai, python, fullstack, frontend, backend, developer, prompt engineer, writer, technical writer, researcher, content, marketing",
        exclude: "unpaid internship, commission only",
        boolean: '(contract OR contractor OR freelance OR consultant OR gig) AND (AI OR Python OR developer OR engineer OR writer OR researcher) -"unpaid internship"'
      },
      remote_jobs: {
        include: "remote, anywhere, worldwide, global, emea, product manager, product management, pm, project manager, ai engineer, machine learning, llm, software engineer, developer, credit, risk, fintech, banking, underwriting, operations, policy, compliance, governance, ethics",
        exclude: "us only, must reside in us, hybrid, on-site, office only",
        boolean: '(remote OR anywhere OR worldwide OR global) AND ("product manager" OR PM OR "AI engineer" OR "software engineer" OR credit OR fintech OR policy) -("US only" OR hybrid OR on-site)'
      }
    };

    function renderKeywordsEditor() {
      const container = document.getElementById("keywords-accordion");
      if (!container) return;
      let html = "";

      INITIAL_CATEGORIES.forEach(cat => {
        const saved = CURRENT_SETTINGS.categoryKeywords?.[cat.id] || {};
        const def = DEFAULT_CATEGORY_KEYWORDS[cat.id] || { include: "", exclude: "", boolean: "" };
        const mode = saved.mode || "simple";
        const incVal = saved.includeText !== undefined ? saved.includeText : def.include;
        const excVal = saved.excludeText !== undefined ? saved.excludeText : def.exclude;
        const boolVal = saved.booleanQuery !== undefined ? saved.booleanQuery : def.boolean;

        html += \`
          <div class="bg-slate-900/70 border border-slate-800 rounded-xl p-4 space-y-3.5">
            <div class="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/80 pb-2.5">
              <span class="font-semibold text-xs text-white flex items-center gap-1.5">
                <span>\${cat.icon}</span>
                <span>\${cat.displayName}</span>
              </span>

              <!-- Mode Switcher -->
              <div class="flex items-center gap-2">
                <div class="bg-slate-950 p-0.5 rounded-lg border border-slate-800 flex text-[11px]">
                  <button type="button" class="px-2.5 py-1 rounded-md transition font-medium \${mode === "simple" ? "bg-orange-600 text-white shadow" : "text-slate-400 hover:text-white"}"
                    onclick="switchKeywordMode('\${cat.id}', 'simple')">
                    Simple List
                  </button>
                  <button type="button" class="px-2.5 py-1 rounded-md transition font-medium \${mode === "boolean" ? "bg-orange-600 text-white shadow" : "text-slate-400 hover:text-white"}"
                    onclick="switchKeywordMode('\${cat.id}', 'boolean')">
                    ⚡ Boolean Query
                  </button>
                </div>
                <button type="button" class="text-[10px] text-slate-400 hover:text-orange-400 transition ml-1" onclick="restoreCategoryDefaults('\${cat.id}')">
                  Restore Defaults
                </button>
              </div>
            </div>

            <!-- Mode 1: Simple Mode -->
            <div id="mode-simple-\${cat.id}" class="\${mode === "simple" ? "" : "hidden"} grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label class="block text-[11px] font-medium text-emerald-400 mb-1">
                  ✓ Inclusion Terms (Must match at least one)
                </label>
                <textarea id="kw-inc-\${cat.id}" rows="3" 
                  placeholder="e.g. grant, fellowship, policy..."
                  class="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-slate-200 focus:outline-none focus:border-orange-500 font-mono">\${incVal}</textarea>
                <span class="text-[10px] text-slate-500">Comma-separated keywords or regexes</span>
              </div>
              <div>
                <label class="block text-[11px] font-medium text-rose-400 mb-1">
                  ✗ Exclusion Terms (Discard if matched)
                </label>
                <textarea id="kw-exc-\${cat.id}" rows="3" 
                  placeholder="e.g. undergraduate only, us only..."
                  class="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-slate-200 focus:outline-none focus:border-orange-500 font-mono">\${excVal}</textarea>
                <span class="text-[10px] text-slate-500">Items matching any exclusion are ignored</span>
              </div>
            </div>

            <!-- Mode 2: Boolean Query Mode -->
            <div id="mode-boolean-\${cat.id}" class="\${mode === "boolean" ? "" : "hidden"} space-y-2">
              <div class="flex items-center justify-between">
                <label class="block text-[11px] font-medium text-orange-400">
                  ⚡ Full Boolean Expression (Twitter Search Syntax)
                </label>
                <span class="text-[10px] text-slate-500">Supports AND, OR, NOT, (...), "exact phrase", from:, title:</span>
              </div>
              <textarea id="kw-bool-\${cat.id}" rows="3" 
                placeholder="e.g. (fellowship OR grant) AND (AI OR policy OR Africa) -(\\"high school\\" OR undergraduate)"
                class="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-200 focus:outline-none focus:border-orange-500 font-mono">\${boolVal}</textarea>
            </div>
            <input type="hidden" id="kw-mode-\${cat.id}" value="\${mode}">
          </div>
        \`;
      });

      container.innerHTML = html;
    }

    window.switchKeywordMode = function(catId, targetMode) {
      document.getElementById("mode-simple-" + catId)?.classList.toggle("hidden", targetMode !== "simple");
      document.getElementById("mode-boolean-" + catId)?.classList.toggle("hidden", targetMode !== "boolean");
      const modeHidden = document.getElementById("kw-mode-" + catId);
      if (modeHidden) modeHidden.value = targetMode;
      renderKeywordsEditor();
    };

    window.restoreCategoryDefaults = function(catId) {
      const def = DEFAULT_CATEGORY_KEYWORDS[catId];
      if (def) {
        const incEl = document.getElementById("kw-inc-" + catId);
        const excEl = document.getElementById("kw-exc-" + catId);
        const boolEl = document.getElementById("kw-bool-" + catId);
        if (incEl) incEl.value = def.include;
        if (excEl) excEl.value = def.exclude;
        if (boolEl) boolEl.value = def.boolean;
      }
    };

    document.getElementById("btn-reset-keywords")?.addEventListener("click", () => {
      INITIAL_CATEGORIES.forEach(cat => {
        restoreCategoryDefaults(cat.id);
      });
    });

    // Populate Settings Form
    function populateSettingsForm() {
      // Provider
      const targetRadios = document.getElementsByName("notificationTarget");
      targetRadios.forEach(r => {
        r.checked = (r.value === (CURRENT_SETTINGS.notificationTarget || "auto_router"));
      });
      updateProviderVisibility();

      // Style
      const modeRadios = document.getElementsByName("messageMode");
      modeRadios.forEach(r => {
        r.checked = (r.value === CURRENT_SETTINGS.messageMode);
      });

      // Inputs
      document.getElementById("maxTotalMessages").value = CURRENT_SETTINGS.maxTotalMessages || 10;
      document.getElementById("maxPerSource").value = CURRENT_SETTINGS.maxPerSource || 3;
      document.getElementById("maxAgeDays").value = CURRENT_SETTINGS.maxAgeDays || 3;

      // Kapso
      document.getElementById("kapsoApiKey").value = CURRENT_SETTINGS.kapsoApiKey || "";
      document.getElementById("kapsoPhoneNumberId").value = CURRENT_SETTINGS.kapsoPhoneNumberId || "";
      document.getElementById("kapsoRecipientPhone").value = CURRENT_SETTINGS.kapsoRecipientPhone || "";
      document.getElementById("kapsoMonthlyLimit").value = CURRENT_SETTINGS.kapsoMonthlyLimit || 2000;

      // Meta
      document.getElementById("metaPhoneNumberId").value = CURRENT_SETTINGS.metaPhoneNumberId || "";
      document.getElementById("metaAccessToken").value = CURRENT_SETTINGS.metaAccessToken || "";
      document.getElementById("metaRecipientPhone").value = CURRENT_SETTINGS.metaRecipientPhone || "";
      document.getElementById("metaMonthlyLimit").value = CURRENT_SETTINGS.metaMonthlyLimit || 1000;

      // Twilio
      document.getElementById("twilioAccountSid").value = CURRENT_SETTINGS.twilioAccountSid || "";
      document.getElementById("twilioAuthToken").value = CURRENT_SETTINGS.twilioAuthToken || "";
      document.getElementById("twilioToPhone").value = CURRENT_SETTINGS.twilioToPhone || "";
      document.getElementById("twilioMonthlyLimit").value = CURRENT_SETTINGS.twilioMonthlyLimit || 1000;

      // Telegram
      document.getElementById("telegramBotToken").value = CURRENT_SETTINGS.telegramBotToken || "";
      document.getElementById("telegramChatId").value = CURRENT_SETTINGS.telegramChatId || "";

      // CallMeBot
      document.getElementById("callmebotPhone").value = CURRENT_SETTINGS.callmebotPhone || "";
      document.getElementById("callmebotApiKey").value = CURRENT_SETTINGS.callmebotApiKey || "";

      // Sources checkboxes
      const container = document.getElementById("sources-checkboxes-grid");
      let html = "";
      INITIAL_CATEGORIES.forEach(cat => {
        cat.sources.forEach(src => {
          const isChecked = CURRENT_SETTINGS.enabledSources[src.id] !== false;
          html += \`
            <label class="border border-slate-800 bg-slate-900/60 hover:bg-slate-900 p-2.5 rounded-lg flex items-center gap-2.5 cursor-pointer text-xs">
              <input type="checkbox" name="src_\${src.id}" data-source-id="\${src.id}" \${isChecked ? "checked" : ""} 
                class="rounded bg-slate-800 border-slate-700 text-orange-500 focus:ring-orange-500">
              <div class="flex-1 min-w-0">
                <div class="font-medium text-slate-200 truncate">\${src.name}</div>
                <div class="text-[10px] text-slate-500">\${cat.displayName}</div>
              </div>
            </label>
          \`;
        });
      });
      container.innerHTML = html;

      renderKeywordsEditor();
    }

    // Select/Deselect All Sources
    document.getElementById("btn-select-all").addEventListener("click", () => {
      document.querySelectorAll("[data-source-id]").forEach(cb => cb.checked = true);
    });
    document.getElementById("btn-deselect-all").addEventListener("click", () => {
      document.querySelectorAll("[data-source-id]").forEach(cb => cb.checked = false);
    });

    // Save Settings
    document.getElementById("settings-form").addEventListener("submit", async (e) => {
      e.preventDefault();
      const target = document.querySelector('input[name="notificationTarget"]:checked')?.value || "auto_router";
      const mode = document.querySelector('input[name="messageMode"]:checked')?.value || "individual";

      const enabledSources = {};
      document.querySelectorAll("[data-source-id]").forEach(cb => {
        enabledSources[cb.dataset.sourceId] = cb.checked;
      });

      const updated = {
        notificationTarget: target,
        messageMode: mode,
        maxTotalMessages: parseInt(document.getElementById("maxTotalMessages").value) || 10,
        maxPerSource: parseInt(document.getElementById("maxPerSource").value) || 3,
        maxAgeDays: parseInt(document.getElementById("maxAgeDays").value) || 3,

        kapsoApiKey: document.getElementById("kapsoApiKey").value.trim(),
        kapsoPhoneNumberId: document.getElementById("kapsoPhoneNumberId").value.trim(),
        kapsoRecipientPhone: document.getElementById("kapsoRecipientPhone").value.trim(),
        kapsoMonthlyLimit: parseInt(document.getElementById("kapsoMonthlyLimit").value) || 2000,

        metaPhoneNumberId: document.getElementById("metaPhoneNumberId").value.trim(),
        metaAccessToken: document.getElementById("metaAccessToken").value.trim(),
        metaRecipientPhone: document.getElementById("metaRecipientPhone").value.trim(),
        metaMonthlyLimit: parseInt(document.getElementById("metaMonthlyLimit").value) || 1000,

        twilioAccountSid: document.getElementById("twilioAccountSid").value.trim(),
        twilioAuthToken: document.getElementById("twilioAuthToken").value.trim(),
        twilioToPhone: document.getElementById("twilioToPhone").value.trim(),
        twilioMonthlyLimit: parseInt(document.getElementById("twilioMonthlyLimit").value) || 1000,

        telegramBotToken: document.getElementById("telegramBotToken").value.trim(),
        telegramChatId: document.getElementById("telegramChatId").value.trim(),

        callmebotPhone: document.getElementById("callmebotPhone").value.trim(),
        callmebotApiKey: document.getElementById("callmebotApiKey").value.trim(),

        enabledSources,
        categoryKeywords: (() => {
          const kw = {};
          INITIAL_CATEGORIES.forEach(cat => {
            const m = document.getElementById("kw-mode-" + cat.id)?.value || "simple";
            const inc = document.getElementById("kw-inc-" + cat.id)?.value.trim() || "";
            const exc = document.getElementById("kw-exc-" + cat.id)?.value.trim() || "";
            const bool = document.getElementById("kw-bool-" + cat.id)?.value.trim() || "";
            kw[cat.id] = { mode: m, includeText: inc, excludeText: exc, booleanQuery: bool };
          });
          return kw;
        })()
      };

      const btn = document.getElementById("btn-save-settings");
      btn.innerText = "Saving...";
      try {
        const res = await fetch("/api/settings", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updated)
        });
        if (res.ok) {
          CURRENT_SETTINGS = await res.json();
          btn.innerText = "✓ Settings Saved to KV!";
          loadQuotaStats();
          setTimeout(() => { btn.innerHTML = "<span>💾</span> Save Control Plane Settings"; }, 2000);
        } else {
          alert("Failed to save settings");
          btn.innerHTML = "<span>💾</span> Save Control Plane Settings";
        }
      } catch (err) {
        alert("Error saving settings: " + err.message);
        btn.innerHTML = "<span>💾</span> Save Control Plane Settings";
      }
    });

    // Client-side Boolean Evaluator for Daily Table Search Bar
    function matchTermSimple(targetText, term, isExact, isWildcard) {
      if (!term || !targetText) return false;
      const clean = term.trim().toLowerCase();
      const txt = targetText.toLowerCase();
      if (!clean) return false;
      if (isWildcard) return txt.includes(clean);
      if (isExact) return txt.includes(clean);
      return txt.includes(clean);
    }

    function evaluateClientQuery(queryStr, item) {
      if (!queryStr || !queryStr.trim()) return true;
      const q = queryStr.trim();

      // Check if query looks like boolean (contains OR, AND, NOT, -, (, ), or quotes)
      const hasBool = /\\b(OR|AND|NOT)\\b|[\\(\\)\\"\\'-]/.test(q);
      if (!hasBool) {
        const terms = q.toLowerCase().split(/\\s+/);
        const hay = (item.title + " " + item.description + " " + item.sourceName + " " + item.matchedKeywords.join(" ")).toLowerCase();
        return terms.every(t => hay.includes(t));
      }

      // Check negative exclusions like -scam, -"high school"
      const negMatches = q.match(/(?:-|\bNOT\s+)(?:"([^"]+)"|([^\s\(\)]+))/gi) || [];
      const hay = (item.title + " " + item.description + " " + item.sourceName).toLowerCase();
      for (const neg of negMatches) {
        const clean = neg.replace(/^-(?:"|')?|^NOT\s+(?:"|')?|["']$/gi, "").trim().toLowerCase();
        if (clean && hay.includes(clean)) return false;
      }

      // Remove negative terms from the positive query string
      let posQuery = q;
      negMatches.forEach(n => { posQuery = posQuery.replace(n, ""); });
      posQuery = posQuery.trim();
      if (!posQuery) return true;

      // Handle OR branches: e.g. (A OR B)
      const orParts = posQuery.split(/\\s+OR\\s+|\\s+\\|\\|\\s+/i);
      if (orParts.length > 1) {
        return orParts.some(part => evaluateClientQuery(part.replace(/[\\(\\)]/g, ""), item));
      }

      // Handle AND branches: e.g. A AND B or A B
      const andParts = posQuery.split(/\\s+AND\\s+|\\s+&&\\s+/i);
      return andParts.every(part => {
        const cleanPart = part.replace(/[\\(\\)\\"\\']/g, "").trim().toLowerCase();
        if (!cleanPart) return true;
        if (cleanPart.startsWith("title:")) {
          return (item.title || "").toLowerCase().includes(cleanPart.slice(6));
        }
        if (cleanPart.startsWith("from:") || cleanPart.startsWith("source:")) {
          const val = cleanPart.replace(/^(from|source):/, "");
          return (item.sourceName || "").toLowerCase().includes(val);
        }
        if (cleanPart.startsWith("url:")) {
          return (item.link || "").toLowerCase().includes(cleanPart.slice(4));
        }
        if (cleanPart === "has:links" || cleanPart === "has:link") {
          return !!item.link && item.link.startsWith("http");
        }
        return hay.includes(cleanPart);
      });
    }

    // Table Logic
    const dateSelect = document.getElementById("date-select");
    const categoryFilter = document.getElementById("category-filter");
    const searchInput = document.getElementById("search-input");
    const tableBody = document.getElementById("table-body");
    const tableCount = document.getElementById("table-count");

    function initFilters() {
      dateSelect.innerHTML = AVAILABLE_DATES.map(d => \`<option value="\${d}">\${d}</option>\`).join("");
      categoryFilter.innerHTML = '<option value="">All Categories</option>' + 
        INITIAL_CATEGORIES.map(c => \`<option value="\${c.id}">\${c.icon} \${c.displayName}</option>\`).join("");
    }

    async function loadOpportunities(date) {
      tableBody.innerHTML = '<tr><td colspan="4" class="text-center py-12 text-slate-500">Loading opportunities...</td></tr>';
      try {
        const res = await fetch(\`/api/opportunities?date=\${encodeURIComponent(date || "")}\`);
        if (res.ok) {
          ALL_OPPORTUNITIES = await res.json();
          renderTable();
        } else {
          tableBody.innerHTML = '<tr><td colspan="4" class="text-center py-12 text-slate-500">No opportunities found for this date.</td></tr>';
        }
      } catch (err) {
        tableBody.innerHTML = \`<tr><td colspan="4" class="text-center py-12 text-rose-500">Error: \${err.message}</td></tr>\`;
      }
    }

    function renderTable() {
      const q = searchInput.value.trim();
      const cat = categoryFilter.value;

      const filtered = ALL_OPPORTUNITIES.filter(item => {
        if (cat && item.categoryId !== cat) return false;
        return evaluateClientQuery(q, item);
      });

      tableCount.innerText = filtered.length;
      if (filtered.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="4" class="text-center py-12 text-slate-500">No matching opportunities found.</td></tr>';
        return;
      }

      tableBody.innerHTML = filtered.map(item => {
        const kwBadges = item.matchedKeywords.map(k => 
          \`<span class="px-1.5 py-0.5 rounded bg-orange-500/10 text-orange-400 border border-orange-500/20 text-[10px] font-mono">\${k}</span>\`
        ).join(" ");

        return \`
          <tr class="hover:bg-slate-900/60 transition group">
            <td class="py-3 px-4 align-top">
              <span class="inline-flex items-center gap-1.5 font-medium text-slate-200">
                <span>\${item.categoryIcon}</span>
                <span>\${item.categoryName}</span>
              </span>
            </td>
            <td class="py-3 px-4 align-top space-y-1.5">
              <a href="\${item.link}" target="_blank" class="font-semibold text-slate-100 hover:text-orange-400 transition text-sm">
                \${item.title}
              </a>
              <div class="text-[11px] text-slate-400 line-clamp-2 group-hover:line-clamp-none transition">
                \${item.description}
              </div>
              <div class="pt-1 flex flex-wrap gap-1">\${kwBadges}</div>
            </td>
            <td class="py-3 px-4 align-top text-slate-400 space-y-1">
              <div class="font-medium text-slate-300">\${item.sourceName}</div>
              <div class="text-[10px] text-slate-500">\${item.pubDate || "Recently added"}</div>
            </td>
            <td class="py-3 px-4 align-top text-right">
              <a href="\${item.link}" target="_blank" 
                class="inline-block px-3 py-1.5 rounded-lg bg-orange-600 hover:bg-orange-500 text-white font-medium text-[11px] transition shadow">
                Apply ↗
              </a>
            </td>
          </tr>
        \`;
      }).join("");
    }

    searchInput.addEventListener("input", renderTable);
    categoryFilter.addEventListener("change", renderTable);
    dateSelect.addEventListener("change", () => loadOpportunities(dateSelect.value));

    // Execution Logs Panel
    const logPanel = document.getElementById("log-panel");
    const logContent = document.getElementById("log-content");
    document.getElementById("btn-close-log").addEventListener("click", () => logPanel.classList.add("hidden"));

    // Test Ping Button
    document.getElementById("btn-test-ping").addEventListener("click", async () => {
      logPanel.classList.remove("hidden");
      logContent.innerHTML = \`<div class="text-amber-400">📲 Dispatching test alert to \${CURRENT_SETTINGS.notificationTarget}...</div>\`;
      try {
        const res = await fetch("/test-alert");
        const data = await res.json();
        logContent.innerHTML = \`<div class="text-emerald-400">✓ Test response received:</div><pre class="text-[10px]">\${JSON.stringify(data, null, 2)}</pre>\`;
        loadQuotaStats();
      } catch (err) {
        logContent.innerHTML = \`<div class="text-rose-400">Error: \${err.message}</div>\`;
      }
    });

    // Crawl Runner
    async function triggerCrawl(dryRun) {
      logPanel.classList.remove("hidden");
      logContent.innerHTML = \`<div class="text-amber-400">⚡ Starting crawler (dryRun: \${dryRun})...</div>\`;
      try {
        const res = await fetch(\`/run?\${dryRun ? "dryRun=true" : ""}\`);
        const data = await res.json();
        let logHtml = \`<div class="text-emerald-400">✓ Crawl cycle completed!</div>\`;
        data.summary.forEach(s => {
          logHtml += \`<div>• \${s.category}: fetched \${s.fetched}, matched \${s.matched}, unseen \${s.unseen}</div>\`;
        });
        if (!dryRun) {
          logHtml += \`<div class="text-orange-400 font-bold mt-1">Dispatched \${data.dispatched?.dispatchedCount || 0} messages!</div>\`;
          if (data.dispatched?.providerUsed) {
            logHtml += \`<div class="text-emerald-300">Provider used: \${data.dispatched.providerUsed}</div>\`;
          }
          if (data.dispatched?.errors?.length > 0) {
            logHtml += \`<div class="text-rose-400">Errors: \${data.dispatched.errors.join(", ")}</div>\`;
          }
        }
        logContent.innerHTML = logHtml;
        loadOpportunities(dateSelect.value);
        loadQuotaStats();
      } catch (err) {
        logContent.innerHTML += \`<div class="text-rose-400">Error: \${err.message}</div>\`;
      }
    }

    document.getElementById("btn-dry-run").addEventListener("click", () => triggerCrawl(true));
    document.getElementById("btn-run-live").addEventListener("click", () => triggerCrawl(false));

    initFilters();
    populateSettingsForm();
    loadOpportunities(dateSelect.value);
    loadQuotaStats();
  </script>
</body>
</html>`;
}
