// Ponytail self-check: render the dashboard, then prove the emitted page is
// well-formed and that the inline script parses. Escaping mistakes in a nested
// template literal are silent, so this is the only thing that catches them.
import { renderDashboardHtml } from "../src/ui/dashboard";
import { writeFileSync } from "node:fs";

const settings = {
  notificationTarget: "auto_router",
  messageMode: "individual",
  maxTotalMessages: 10,
  maxPerSource: 3,
  maxAgeDays: 3,
  enabledSources: {},
  categoryKeywords: {}
} as never;

const html = renderDashboardHtml(settings, ["2026-10-11"], ["od_grants:0"]);
const out = process.argv[2] || "dist/dashboard.html";
writeFileSync(out, html);

const fail: string[] = [];
const need = (label: string, re: RegExp) => { if (!re.test(html)) fail.push(label); };

// Structure
need("doctype", /^<!DOCTYPE html>/);
need("no tailwind cdn", /^(?!.*cdn\.tailwindcss)/s);
need("single script block", /<script>([\s\S]*)<\/script>/);
// A stray closing script tag anywhere in the script text ends it early and the
// whole panel silently never boots. Count them.
{
  const opens = (html.match(/<script/g) || []).length;
  const closes = (html.match(/<\/script>/g) || []).length;
  if (opens !== 1) fail.push(`expected 1 <script>, found ${opens}`);
  if (closes !== 1) fail.push(`expected 1 </script>, found ${closes} - the script block is cut short`);
}
need("sprite present", /<symbol id="i-radar"/);

// Every icon referenced must exist in the sprite. A missing one renders blank.
const defined = new Set([...html.matchAll(/<symbol id="(i-[\w-]+)"/g)].map((m) => m[1]));
const used = new Set([...html.matchAll(/<use href="#(i-[\w-]+)"/g)].map((m) => m[1]));
for (const id of used) if (!defined.has(id)) fail.push(`icon used but not defined: ${id}`);
for (const id of defined) if (!used.has(id)) fail.push(`icon defined but never used: ${id}`);

// Every id referenced by the script must exist in the markup, and vice versa for
// the controls the old page exposed. The Worker depends on these staying put.
const script = html.match(/<script>([\s\S]*)<\/script>/)![1];
const looked = new Set([...script.matchAll(/\$\("([\w-]+)"\)/g)].map((m) => m[1]));
const present = new Set([...html.matchAll(/\bid="([\w-]+)"/g)].map((m) => m[1]));
const dynamic = new Set(["mode-simple-", "mode-boolean-", "kw-mode-", "kw-inc-", "kw-exc-", "kw-bool-"]);
for (const id of looked) {
  if (present.has(id)) continue;
  if ([...dynamic].some((p) => id.startsWith(p))) continue;
  fail.push(`script reads #${id} which is not in the markup`);
}
const REQUIRED = [
  "settings-form", "btn-save-settings", "table-body", "table-count", "search-input",
  "date-select", "category-filter", "quota-cards-grid", "btn-refresh-quotas",
  "btn-test-ping", "btn-dry-run", "btn-run-live", "btn-close-log", "log-content",
  "sources-checkboxes-grid", "btn-select-all", "btn-deselect-all",
  "btn-reset-keywords", "keywords-accordion",
  "eligibility-profile-body", "eligibility-advanced-body",
  "router-info-banner", "router-chain",
  "fields-kapso", "fields-meta", "fields-twilio", "fields-telegram", "fields-callmebot",
  "kapsoApiKey", "kapsoPhoneNumberId", "kapsoRecipientPhone", "kapsoMonthlyLimit",
  "metaPhoneNumberId", "metaAccessToken", "metaRecipientPhone", "metaMonthlyLimit",
  "twilioAccountSid", "twilioAuthToken", "twilioToPhone", "twilioMonthlyLimit",
  "telegramBotToken", "telegramChatId", "callmebotPhone", "callmebotApiKey",
  "maxTotalMessages", "maxPerSource", "maxAgeDays",
  "tab-table", "tab-settings", "tab-table-btn", "tab-settings-btn"
];
for (const id of REQUIRED) if (!present.has(id)) fail.push(`contract broken, missing #${id}`);

// Design rules the redesign is supposed to guarantee, asserted so they cannot
// regress silently.
if (/text-\[10px\]|text-\[11px\]|font-size:9px|font-size:10px/.test(html)) fail.push("sub-12px type is back");
if (/cdn\.tailwindcss/.test(html)) fail.push("tailwind cdn reintroduced");
if (!/focus-visible\{outline:2px solid var\(--accent\)/.test(html)) fail.push("no visible focus ring");
if (!/color-scheme:dark/.test(html)) fail.push("native controls will not render dark");
// `i.i` is a <i> element selector. The icons are <svg class="i">, so that rule
// silently never matched and every icon rendered at its natural size.
if (/(^|[;}\s])i\.i\b/.test(html)) fail.push("icon rule uses a type selector, so it matches nothing");
if (!/\.i\{width:16px/.test(html)) fail.push("icons have no base size rule");

// The escaping guard: a crawler-supplied closing tag must not survive.
if (!/const esc = \(s\)/.test(script)) fail.push("untrusted text is not escaped");
if (!/const safeUrl = \(u\)/.test(script)) fail.apply(fail, ["apply link is not scheme-checked"]);

// Every regex that crosses the template-literal boundary. A single backslash in
// the .ts source is eaten by the outer template and the pattern silently
// degrades to a literal, so pin the emitted text.
const regexes: [string, string][] = [
  ["rfc2822 date", String.raw`/^\w{3},\s*(.+?)\s+\d{1,2}:\d{2}/`],
  ["url scheme", String.raw`/^https?:\/\//i`],
  ["boolean detection", String.raw`/\b(OR|AND|NOT)\b`],
  ["negation", String.raw`(?:-|\bNOT\s+)`],
  ["or split", String.raw`/\s+OR\s+|\s+\|\|\s+/i`],
  ["and split", String.raw`/\s+AND\s+|\s+&&\s+/i`]
];
for (const [name, re] of regexes) if (!script.includes(re)) fail.push(`regex lost a backslash: ${name} (${re})`);

writeFileSync(out.replace(/\.html$/, ".js"), script);

// A preview with the API stubbed, so the design can be looked at rather than
// only asserted. Not shipped; this file is what you screenshot.
const STUB = `<script>
window.addEventListener("error", function (e) {
  var d = document.createElement("pre");
  d.style.cssText = "position:fixed;top:0;left:0;right:0;z-index:999;background:#b00;color:#fff;padding:10px 14px;font:12px/1.5 monospace;white-space:pre-wrap";
  d.textContent = "RUNTIME ERROR: " + e.message + "  (line " + e.lineno + ")";
  document.body.appendChild(d);
});
const SAMPLE = [
  {dedupeKey:"a1",title:"WomanKind Creative Grant 2027",company:"WomanKind",description:"Applications for the WomanKind Creative Grant 2026 are now open. The grant provides early-stage women's health companies with the strategic branding and design support they need to build trust, communicate their vision, and grow.",categoryName:"Grants & Fellowships",categoryId:"grants_fellowships",sourceName:"Opportunity Desk - Grants",pubDate:"Sat, 10 Oct 2026 01:13:48 +0000",link:"https://opportunitydesk.org/x",matchedKeywords:["grant","policy","africa"],eligibility:"open",deadline:"2026-11-01"},
  {dedupeKey:"a2",title:"Amazon Research Awards - Fall 2026",description:"Proposals are invited for the Amazon Research Awards. ARA funds a variety of research areas relevant to Amazon, such as applied machine learning, automated reasoning, computer vision, fairness in artificial intelligence.",categoryName:"Grants & Fellowships",categoryId:"grants_fellowships",sourceName:"Opportunity Desk - Grants",pubDate:"Thu, 08 Oct 2026 13:30:30 +0000",link:"https://example.org/ara",matchedKeywords:["artificial intelligence","research"],eligibility:"restricted",eligibilityEvidence:"requires US work authorisation",eligibilityBlocking:["workAuth"],eligibilityWarnings:["cgpa"],region:"EMEA",eligibilityCountry:"Nigeria",isOpportunity:false},
  {dedupeKey:"a3",title:"Harvard LEAD Fellowship for Promoting Women in Global Health 2027-2028 (Funded)",description:"Applications are open for the Harvard LEAD Fellowship for Promoting Women in Global Health. A one-year fellowship designed to advance leadership skills among individuals from low- and middle-income countries.",categoryName:"Fellowships",categoryId:"grants_fellowships",sourceName:"Opportunity Desk - Fellowships",pubDate:"Fri, 09 Oct 2026 20:17:43 +0000",link:"https://example.org/lead",matchedKeywords:["fellowship","global"],eligibility:"open",deadline:"2026-11-15",salaryBand:"USD 45,000"},
  {dedupeKey:"a4",title:"Fully Funded Masters in AI Policy, Chevening Scholarship 2027",description:"The Chevening Scholarship supports the next generation of global leaders who are committed to improving their home countries. Fields of application this year include artificial intelligence policy, governance, and safety.",categoryName:"Scholarships",categoryId:"scholarships",sourceName:"Opportunities for Africans",pubDate:"Thu, 09 Oct 2026 08:02:11 +0000",link:"https://example.org/chev",matchedKeywords:["scholarship","fully funded","ai"],eligibility:"open",deadline:"2026-11-04"},
  {dedupeKey:"a5",title:"AI Safety Researcher - Remote, Anywhere in the World",description:"We are hiring an AI safety researcher to work on evaluation and interpretability. Fully remote, open to candidates in EMEA and Africa. Experience with policy and governance is a plus but not required.",categoryName:"Remote Jobs",categoryId:"remote_jobs",sourceName:"We Work Remotely",pubDate:"Mon, 06 Oct 2026 11:40:02 +0000",link:"https://example.org/job",matchedKeywords:["remote","ai engineer","policy"],eligibility:"open",deadline:"2026-10-14",salaryBand:"USD 120k - 165k",routeTo:"cold_email"},
  {dedupeKey:"a6",title:"Global AI Safety Fellowship (PhD track)",description:"A three-year doctoral fellowship on frontier model governance. Applications from low- and middle-income countries are strongly encouraged. Includes a living stipend and full tuition coverage.",categoryName:"Scholarships",categoryId:"scholarships",sourceName:"FundsforNGOs",pubDate:"Sun, 05 Oct 2026 16:55:20 +0000",link:"https://example.org/gsf",matchedKeywords:["phd","fellowship","ai"],eligibility:"unknown",deadline:"2026-12-20",eligibilityWarnings:["ageCap"]}
];
const USAGE = [
  {provider:"whatsapp_kapso",displayName:"Kapso.ai Gateway",monthlyLimit:2000,currentCount:156,configured:true,active:true},
  {provider:"whatsapp_meta",displayName:"Meta Cloud API",monthlyLimit:1000,currentCount:0,configured:false,active:false},
  {provider:"whatsapp_twilio",displayName:"Twilio Sandbox",monthlyLimit:1000,currentCount:0,configured:false,active:false},
  {provider:"telegram",displayName:"Telegram Bot",monthlyLimit:999999,currentCount:41,configured:true,active:true}
];
window.fetch = (u) => { const s=String(u);
  if (s.startsWith("/api/usage")) return Promise.resolve({ok:true,json:()=>Promise.resolve(USAGE)});
  if (s.startsWith("/api/opportunities")) return Promise.resolve({ok:true,json:()=>Promise.resolve(SAMPLE)});
  return Promise.resolve({ok:true,json:()=>Promise.resolve({})}); };
// #settings and #row jump the harness to the views worth eyeballing.
addEventListener("load", function () {
  if (location.hash === "#settings") document.getElementById("tab-settings-btn").click();
  if (location.hash === "#cap") {
    document.getElementById("tab-settings-btn").click();
    setTimeout(function () { document.getElementById("quota-cards-grid").scrollIntoView(); }, 60);
  }
  if (location.hash === "#src") {
    document.getElementById("tab-settings-btn").click();
    setTimeout(function () { document.getElementById("sources-checkboxes-grid").scrollIntoView(); }, 60);
  }
  if (location.hash === "#row") {
    var tr = document.querySelector("tbody tr[data-key]");
    if (tr) tr.dispatchEvent(new MouseEvent("click", {bubbles:true}));
  }
});
<\/script>`;
writeFileSync(out.replace(/\.html$/, "") + "-demo.html", html.replace("</head>", STUB + "</head>"));

if (fail.length) {
  console.error("FAIL\n  " + fail.join("\n  "));
  process.exit(1);
}
console.log(`ok  ${html.length} bytes -> ${out}   ${defined.size} icons, ${looked.size} ids bound`);
