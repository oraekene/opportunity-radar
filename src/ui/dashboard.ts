import { CATEGORIES } from "../config/categories";
import { UserSettings } from "../types";
import { ELIGIBILITY_FIELDS, TOP_ELIGIBILITY_FIELDS, ADVANCED_ELIGIBILITY_FIELDS } from "../services/eligibility";

export function renderDashboardHtml(settings: UserSettings, availableDates: string[], consumedKeys: string[] = []): string {
  const categoriesJson = JSON.stringify(CATEGORIES);
  const settingsJson = JSON.stringify(settings);
  const datesJson = JSON.stringify(availableDates);
  const consumedJson = JSON.stringify(consumedKeys);
  // documentsHeld is an answer, not a requirement, so it joins the advanced editor.
  const eligibilityFieldsJson = JSON.stringify([...ELIGIBILITY_FIELDS, "documentsHeld"]);
  // The four shown directly; everything else, plus the documentsHeld answer field, sits
  // under Advanced Settings.
  const topEligibilityFieldsJson = JSON.stringify([...TOP_ELIGIBILITY_FIELDS]);
  const advancedEligibilityFieldsJson = JSON.stringify([...ADVANCED_ELIGIBILITY_FIELDS, "documentsHeld"]);

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Opportunity Radar</title>
<style>
/* ==========================================================================
   TOKENS
   One accent, three semantic states, four text levels, three grays of surface.
   Nothing else gets a color. A category is not a status.
   ========================================================================== */
:root{
  color-scheme:dark;

  --bg:#0a0c10;
  --s1:#10141a;   /* panel */
  --s2:#161b23;   /* nested control, table head */
  --s3:#1e242e;   /* hover, active track */

  --line:#212734;
  --line2:#2b3341;

  --fg:#e8ecf2;
  --fg2:#a3adbd;
  --fg3:#7d8798;
  --fg4:#4d5665;   /* disabled and decorative only; never body text */

  --accent:#f0803c;
  --accent-hi:#ff9450;
  --accent-fg:#120a05;
  --accent-soft:rgba(240,128,60,.12);
  --accent-line:rgba(240,128,60,.34);

  --good:#3fb950;
  --warn:#d29922;
  --bad:#f85149;
  --info:#58a6ff;
  --good-soft:rgba(63,185,80,.12);
  --warn-soft:rgba(210,153,34,.12);
  --bad-soft:rgba(248,81,73,.12);
  --info-soft:rgba(88,166,255,.12);

  --t2:11px;  /* uppercase tracked labels, nothing else */
  --t3:12px;  /* metadata */
  --t4:13px;  /* body */
  --t5:15px;  /* row title */
  --t6:19px;  /* panel title */
  --t7:24px;  /* wordmark */

  --r:6px;
  --r2:10px;
  --r3:14px;

  --ease:cubic-bezier(.2,.8,.2,1);
  --lift:inset 0 1px 0 rgba(255,255,255,.035);
  --pop:0 24px 64px -16px rgba(0,0,0,.75);
  --ring:0 0 0 3px var(--accent-soft);
}

*,*::before,*::after{box-sizing:border-box}
html,body{height:100%}
body{
  margin:0;
  background:var(--bg);
  color:var(--fg);
  font:400 var(--t4)/1.5 ui-sans-serif,system-ui,-apple-system,"Segoe UI",Inter,Roboto,sans-serif;
  -webkit-font-smoothing:antialiased;
  text-rendering:optimizeLegibility;
}
::selection{background:rgba(240,128,60,.28)}
:focus-visible{outline:2px solid var(--accent);outline-offset:2px;border-radius:3px}
:focus:not(:focus-visible){outline:none}
.mono{font-family:ui-monospace,SFMono-Regular,"SF Mono",Menlo,Consolas,monospace;font-size:var(--t3)}
.i{width:16px;height:16px;flex:none;stroke:currentColor;fill:none;stroke-width:1.5;stroke-linecap:round;stroke-linejoin:round}
.i--s{width:13px;height:13px}
.i--l{width:20px;height:20px;stroke-width:1.35}

::-webkit-scrollbar{width:10px;height:10px}
::-webkit-scrollbar-thumb{background:var(--line2);border-radius:99px;border:3px solid var(--bg)}
::-webkit-scrollbar-thumb:hover{background:#39424f}
::-webkit-scrollbar-track{background:transparent}
*{scrollbar-width:thin;scrollbar-color:var(--line2) transparent}

/* ==========================================================================
   APP SHELL
   ========================================================================== */
.app{display:flex;flex-direction:column;height:100%}

.hdr{
  display:flex;align-items:center;gap:16px;
  padding:0 24px;height:60px;flex:none;
  border-bottom:1px solid var(--line);
  background:color-mix(in srgb,var(--bg) 86%,transparent);
  backdrop-filter:blur(12px) saturate(140%);
  position:sticky;top:0;z-index:30;
}
.brand{display:flex;align-items:center;gap:11px;min-width:0}
.mark{
  width:32px;height:32px;flex:none;border-radius:9px;
  display:grid;place-items:center;
  background:linear-gradient(145deg,#fbbf24,#f0803c 55%,#ea580c);
  color:#1a0f05;box-shadow:0 2px 10px rgba(240,128,60,.3),var(--lift);
}
.brand__name{font-size:var(--t7);font-weight:640;letter-spacing:-.025em;line-height:1.05}
.brand__meta{
  font-size:var(--t3);color:var(--fg3);line-height:1.3;margin-top:2px;
  white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:46ch;
}
.hdr__sp{flex:1}
.hdr__acts{display:flex;align-items:center;gap:8px;flex:none}

.main{flex:1;min-height:0;overflow-y:auto;scrollbar-gutter:stable}
.wrap{max-width:1360px;margin:0 auto;padding:28px 24px 96px}
.view[hidden]{display:none}

/* ==========================================================================
   CONTROLS
   ========================================================================== */
.btn{
  display:inline-flex;align-items:center;gap:7px;
  height:34px;padding:0 13px;
  font:500 var(--t3)/1 inherit;color:var(--fg2);
  background:var(--s2);border:1px solid var(--line2);border-radius:var(--r);
  cursor:pointer;white-space:nowrap;
  transition:background .14s var(--ease),color .14s var(--ease),border-color .14s var(--ease),transform .08s var(--ease);
}
.btn:hover{background:var(--s3);color:var(--fg);border-color:#39424f}
.btn:active{transform:translateY(.5px)}
.btn[disabled]{opacity:.45;pointer-events:none}
.btn--pri{background:var(--accent);border-color:var(--accent);color:var(--accent-fg);font-weight:600}
.btn--pri:hover{background:var(--accent-hi);border-color:var(--accent-hi);color:var(--accent-fg)}
.btn--ghost{background:transparent;border-color:transparent}
.btn--ghost:hover{background:var(--s2);border-color:var(--line)}
.btn--sm{height:28px;padding:0 10px;font-size:var(--t2)}
.btn--link{
  height:auto;padding:0;background:none;border:0;color:var(--accent);
  font-size:var(--t3);text-decoration:underline;text-underline-offset:3px;
  text-decoration-color:var(--accent-line);
}
.btn--link:hover{background:none;color:var(--accent-hi)}

.seg{display:inline-flex;padding:3px;gap:2px;background:var(--s2);border:1px solid var(--line);border-radius:8px}
.seg button{
  height:26px;padding:0 12px;border:0;border-radius:5px;background:none;
  font:500 var(--t3)/1 inherit;color:var(--fg3);cursor:pointer;
  display:inline-flex;align-items:center;gap:6px;
  transition:background .14s var(--ease),color .14s var(--ease);
}
.seg button:hover{color:var(--fg2)}
.seg button[aria-pressed=true]{background:var(--s3);color:var(--fg);box-shadow:var(--lift)}

/* A radio or checkbox styled as a card. :has() wires the selected state, so
   the look can never drift from the value again. */
.opt{
  display:flex;flex-direction:column;gap:5px;
  padding:12px 13px;border:1px solid var(--line);border-radius:var(--r);
  background:var(--s2);cursor:pointer;
  transition:border-color .14s var(--ease),background .14s var(--ease);
}
.opt:hover{border-color:var(--line2);background:var(--s3)}
.opt input{margin:0;accent-color:var(--accent);width:14px;height:14px;flex:none}
.opt__hd{display:flex;align-items:center;gap:9px}
.opt__t{font-size:var(--t4);font-weight:560;letter-spacing:-.005em;color:var(--fg)}
.opt__d{font-size:var(--t3);line-height:1.42;color:var(--fg3)}
.opt:has(input:checked){border-color:var(--accent-line);background:var(--accent-soft)}
.opt:has(input:checked) .opt__t{color:var(--fg)}
.opt:has(input:focus-visible){box-shadow:var(--ring)}
.opt--lg{grid-column:span 2}

.lbl{
  display:block;font-size:var(--t2);font-weight:600;letter-spacing:.075em;
  text-transform:uppercase;color:var(--fg3);margin-bottom:7px;
}
.field{min-width:0}
.inp,.sel,.ta{
  width:100%;height:34px;padding:0 11px;
  background:var(--s2);border:1px solid var(--line);border-radius:var(--r);
  color:var(--fg);font:inherit;font-size:var(--t3);
  transition:border-color .14s var(--ease),background .14s var(--ease);
}
.ta{height:auto;padding:10px 11px;line-height:1.6;resize:vertical;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:var(--t3)}
.inp::placeholder,.ta::placeholder{color:var(--fg4)}
.inp:hover,.sel:hover,.ta:hover{border-color:var(--line2)}
.inp:focus,.sel:focus,.ta:focus{outline:none;border-color:var(--accent);box-shadow:var(--ring);background:var(--bg)}
.sel{
  appearance:none;padding-right:30px;cursor:pointer;
  background-image:linear-gradient(45deg,transparent 50%,var(--fg3) 50%),linear-gradient(135deg,var(--fg3) 50%,transparent 50%);
  background-position:calc(100% - 15px) 15px,calc(100% - 10px) 15px;
  background-size:5px 5px,5px 5px;background-repeat:no-repeat;
}
.sel--mono{font-family:ui-monospace,Menlo,Consolas,monospace}
.sel--bad{color:var(--bad)}
.sel--warn{color:var(--warn)}
.sel--idle{color:var(--fg4)}

/* ==========================================================================
   PANELS
   ========================================================================== */
.panel{background:var(--s1);border:1px solid var(--line);border-radius:var(--r2);box-shadow:var(--lift)}
.panel + .panel{margin-top:20px}
.panel__hd{display:flex;align-items:flex-start;gap:14px;padding:20px 22px 0}
.panel__ix{
  font:600 var(--t2)/1 ui-monospace,Menlo,Consolas,monospace;color:var(--fg4);
  letter-spacing:.06em;padding-top:4px;flex:none;
}
.panel__ti{font-size:var(--t6);font-weight:600;letter-spacing:-.02em;line-height:1.2}
.panel__sub{font-size:var(--t3);color:var(--fg3);margin-top:5px;line-height:1.5;max-width:78ch}
.panel__hd > .hdr__sp{flex:1}
.panel__bd{padding:18px 22px 22px}
.rule{height:1px;background:var(--line);margin:18px 0}
.strike{text-decoration:line-through;text-decoration-color:var(--fg4)}

/* ==========================================================================
   CAPACITY
   ========================================================================== */
.qgrid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}
.q{
  padding:13px 14px;background:var(--s2);border:1px solid var(--line);border-radius:var(--r);
  display:flex;flex-direction:column;gap:9px;
}
.q__hd{display:flex;align-items:center;gap:8px}
.q__n{font-size:var(--t3);font-weight:560;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.q__v{font-size:var(--t3);color:var(--fg3);font-variant-numeric:tabular-nums}
.q__track{height:3px;border-radius:99px;background:var(--s3);overflow:hidden}
.q__fill{height:100%;border-radius:99px;transition:width .5s var(--ease)}
.dot{width:6px;height:6px;border-radius:99px;flex:none;background:var(--fg4)}
.dot--good{background:var(--good)} .dot--warn{background:var(--warn)} .dot--bad{background:var(--bad)}

.chain{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.node{
  display:inline-flex;align-items:center;gap:8px;
  height:32px;padding:0 12px;border-radius:var(--r);
  border:1px solid var(--line);background:var(--s2);
  font-size:var(--t3);color:var(--fg3);
}
.node__cap{color:var(--fg4);font-variant-numeric:tabular-nums}
.node--on{border-color:var(--accent-line);background:var(--accent-soft);color:var(--fg)}
.node--out{opacity:.5}
.arrow{color:var(--fg4);flex:none}

/* ==========================================================================
   CHIPS
   One shape, three tones. If it needs a seventh color it is not a chip.
   ========================================================================== */
.chip{
  display:inline-flex;align-items:center;gap:5px;
  height:21px;padding:0 7px;border-radius:5px;
  font-size:var(--t2);font-weight:500;letter-spacing:.01em;
  background:var(--s3);color:var(--fg2);border:1px solid transparent;
  white-space:nowrap;max-width:100%;
}
.chip > span{overflow:hidden;text-overflow:ellipsis}
.chip--cat{background:transparent;border-color:var(--line2);color:var(--fg3);font-weight:600;letter-spacing:.075em;text-transform:uppercase}
.chip--good{background:var(--good-soft);color:var(--good)}
.chip--warn{background:var(--warn-soft);color:var(--warn)}
.chip--bad{background:var(--bad-soft);color:var(--bad)}
.chip--info{background:var(--info-soft);color:var(--info)}
.chip--code{font-family:ui-monospace,Menlo,Consolas,monospace}
.chips{display:flex;flex-wrap:wrap;gap:6px}

/* ==========================================================================
   TABLE
   ========================================================================== */
.filters{display:flex;align-items:center;gap:10px;padding:12px;margin-bottom:16px;flex-wrap:wrap}
.filters .search{flex:1;min-width:260px}
.search{position:relative;display:flex;align-items:center}
.search .i{position:absolute;left:11px;color:var(--fg4);pointer-events:none}
.search .inp{padding-left:34px;font-family:ui-monospace,Menlo,Consolas,monospace}
.count{font-size:var(--t3);color:var(--fg3);white-space:nowrap;font-variant-numeric:tabular-nums}
.count b{color:var(--fg);font-weight:600}

.tbl{border:1px solid var(--line);border-radius:var(--r2);overflow:hidden;background:var(--s1);box-shadow:var(--lift)}
.tbl table{width:100%;table-layout:fixed;border-collapse:collapse}
.tbl th{
  text-align:left;padding:11px 16px;background:var(--s2);
  border-bottom:1px solid var(--line);
  font-size:var(--t2);font-weight:600;letter-spacing:.075em;text-transform:uppercase;color:var(--fg3);
}
.tbl th.num{text-align:right}
.tbl td{padding:16px;border-bottom:1px solid var(--line);vertical-align:top}
.tbl tr:last-child td{border-bottom:0}
.tbl tbody tr{transition:background .12s var(--ease);cursor:pointer}
.tbl tbody tr:hover{background:var(--s2)}
.tbl tbody tr:focus-visible{outline:2px solid var(--accent);outline-offset:-2px}
.tbl tbody tr[data-done="1"]{opacity:.44}
.tbl tbody tr[data-done="1"]:hover{opacity:.8}

.ti{display:flex;flex-direction:column;gap:9px}
.ti__t{
  font-size:var(--t5);font-weight:580;letter-spacing:-.014em;line-height:1.32;color:var(--fg);
  display:inline-flex;align-items:baseline;gap:7px;
}
.ti__t:hover{color:var(--accent)}
.ti__t .i{width:14px;height:14px;flex:none;align-self:center;color:var(--fg4);transition:color .14s var(--ease)}
tr:hover .ti__t .i{color:var(--accent)}
.ti__d{
  font-size:var(--t4);color:var(--fg2);line-height:1.5;
  display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;
}
tr:hover .ti__d{-webkit-line-clamp:unset}
.ti__m{display:flex;flex-wrap:wrap;gap:6px;align-items:center}
.ti__m[hidden]{display:none}

.src{font-size:var(--t3);color:var(--fg2);line-height:1.45;overflow-wrap:anywhere}
.src + .src{margin-top:4px}
.dl{font-size:var(--t3);color:var(--fg2);font-variant-numeric:tabular-nums;line-height:1.45}
.dl--near{color:var(--warn)}
.dl--past{color:var(--bad)}
.dl--none{color:var(--fg4)}
/* A value, not a label, so it keeps its own casing. */
.dl__sub{color:var(--fg4);display:block;font-size:var(--t2);letter-spacing:.04em;margin-top:2px}

.acts{display:flex;flex-direction:column;align-items:stretch;gap:7px}
.acts .btn,.apply{width:100%;justify-content:center}
.apply{
  display:inline-flex;align-items:center;justify-content:center;gap:6px;
  height:32px;padding:0 12px;border-radius:var(--r);
  background:var(--s3);border:1px solid var(--line2);color:var(--fg);
  font-size:var(--t3);font-weight:560;text-decoration:none;
  transition:background .14s var(--ease),border-color .14s var(--ease);
}
.apply:hover{background:var(--accent);border-color:var(--accent);color:var(--accent-fg)}
.apply .i{width:13px;height:13px}
.apply--done{background:var(--good-soft);border-color:rgba(63,185,80,.34);color:var(--good)}

.empty{padding:56px 24px;text-align:center;color:var(--fg3)}
.empty .i{width:28px;height:28px;color:var(--fg4);margin-bottom:10px;stroke-width:1.2}
.empty b{display:block;color:var(--fg2);font-size:var(--t4);font-weight:560;margin-bottom:4px}

/* ==========================================================================
   DRAWER
   One drawer serves row detail and run logs, so it can never cover the
   Apply column the way a floating box did.
   ========================================================================== */
.scrim{
  position:fixed;inset:0;z-index:40;background:rgba(4,6,9,.6);
  backdrop-filter:blur(2px);opacity:0;pointer-events:none;transition:opacity .18s var(--ease);
}
.scrim[data-on="1"]{opacity:1;pointer-events:auto}
.drawer{
  position:fixed;top:0;right:0;bottom:0;z-index:41;width:min(520px,100vw);
  display:flex;flex-direction:column;
  background:var(--s1);border-left:1px solid var(--line2);box-shadow:var(--pop);
  transform:translateX(101%);transition:transform .22s var(--ease);
}
.drawer[data-on="1"]{transform:none}
.drawer__hd{
  display:flex;align-items:center;gap:12px;padding:16px 18px;
  border-bottom:1px solid var(--line);flex:none;
}
.drawer__t{font-size:var(--t5);font-weight:600;letter-spacing:-.015em;flex:1;min-width:0}
.drawer__bd{flex:1;min-height:0;overflow-y:auto;padding:18px}
.drawer__bd pre{margin:0;font:400 var(--t3)/1.6 ui-monospace,Menlo,Consolas,monospace;white-space:pre-wrap;overflow-wrap:anywhere}

.dl-grid{display:grid;grid-template-columns:auto 1fr;gap:9px 16px;align-items:baseline}
.dl-grid dt{font-size:var(--t2);font-weight:600;letter-spacing:.075em;text-transform:uppercase;color:var(--fg3)}
.dl-grid dd{margin:0;font-size:var(--t3);color:var(--fg2);overflow-wrap:anywhere}

.chk{display:flex;flex-direction:column;gap:0}
.chk__it{display:flex;gap:11px;padding:11px 0;border-bottom:1px solid var(--line);font-size:var(--t3);line-height:1.55}
.chk__it:last-child{border-bottom:0}
.chk__m{flex:none;margin-top:1px}
.chk__f{font-family:ui-monospace,Menlo,Consolas,monospace;color:var(--fg)}
.chk__r{color:var(--fg2)}
.chk__e{color:var(--fg4);font-style:italic}
.chk--good .chk__m{color:var(--good)}
.chk--warn .chk__m{color:var(--warn)}
.chk--bad .chk__m{color:var(--bad)}
.chk--idle .chk__m{color:var(--fg4)}

.log{display:flex;flex-direction:column;gap:9px;font-size:var(--t3);line-height:1.55}
.log__l{display:flex;gap:9px}
.log__l::before{content:"";width:5px;height:5px;border-radius:99px;background:var(--fg4);flex:none;margin-top:7px}
.log__l--ok::before{background:var(--good)}
.log__l--warn::before{background:var(--warn)}
.log__l--bad::before{background:var(--bad)}
.log__l--hl::before{background:var(--accent)}
.log__t{color:var(--fg2);font-weight:560}
.log__d{color:var(--fg4);padding-left:14px;font-size:var(--t2);font-family:ui-monospace,Menlo,Consolas,monospace;overflow-wrap:anywhere}

/* ==========================================================================
   SOURCES
   ========================================================================== */
.grp{border:1px solid var(--line);border-radius:var(--r);background:var(--s2);overflow:hidden}
.grp + .grp{margin-top:8px}
.grp__hd{display:flex;align-items:center;gap:11px;padding:11px 13px}
.grp__n{font-size:var(--t4);font-weight:560;flex:1;min-width:0}
.grp__c{font-size:var(--t2);color:var(--fg3);font-variant-numeric:tabular-nums}
/* Separators come from the grid gap showing the rule colour through, not from
   borders on each cell. Borders double up against the group edge and leave a
   stray line when a group does not fill its last row. */
.grp__list{border-top:1px solid var(--line);display:grid;grid-template-columns:repeat(3,1fr);gap:1px;background:var(--line)}
.src-i{
  display:flex;align-items:center;gap:9px;padding:9px 13px;background:var(--s2);
  font-size:var(--t3);color:var(--fg2);cursor:pointer;min-width:0;
  transition:background .12s var(--ease);
}
.src-i:hover{background:var(--s3)}
.src-i input{margin:0;accent-color:var(--accent);width:14px;height:14px;flex:none}
.src-i span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}

/* ==========================================================================
   ACCORDIONS
   name= makes them mutually exclusive natively. No JS to keep them in sync.
   ========================================================================== */
.acc{border:1px solid var(--line);border-radius:var(--r);background:var(--s2);overflow:hidden}
.acc + .acc{margin-top:8px}
.acc[open]{background:var(--s2)}
.acc > summary{
  display:flex;align-items:center;gap:11px;padding:12px 14px;cursor:pointer;list-style:none;
}
.acc > summary::-webkit-details-marker{display:none}
.acc > summary::after{
  content:"";margin-left:auto;flex:none;width:8px;height:8px;
  border-right:1.5px solid var(--fg4);border-bottom:1.5px solid var(--fg4);
  transform:rotate(45deg) translate(-2px,-2px);transition:transform .18s var(--ease);
}
.acc[open] > summary::after{transform:rotate(-135deg) translate(-2px,-2px)}
.acc > summary:hover{background:var(--s3)}
.acc__t{font-size:var(--t4);font-weight:560}
.acc__s{font-size:var(--t3);color:var(--fg3)}
.acc__bd{padding:16px;border-top:1px solid var(--line);background:var(--bg)}
.acc .acc{margin-top:10px;background:var(--s2)}

.ops{display:grid;grid-template-columns:repeat(3,1fr);gap:9px}
.op{padding:12px;border:1px solid var(--line);border-radius:var(--r);background:var(--s2)}
.op__hd{display:flex;align-items:center;justify-content:space-between;gap:9px;margin-bottom:7px}
.op__c{
  font-family:ui-monospace,Menlo,Consolas,monospace;font-size:var(--t3);font-weight:600;
  padding:2px 6px;border-radius:4px;background:var(--accent-soft);color:var(--accent);
  border:1px solid var(--accent-line);
}
.op__k{font-size:var(--t2);letter-spacing:.075em;text-transform:uppercase;color:var(--fg4)}
.op__d{font-size:var(--t3);color:var(--fg2);line-height:1.5}
.op__e{
  margin-top:9px;padding:7px 9px;border-radius:5px;background:var(--bg);border:1px solid var(--line);
  font-family:ui-monospace,Menlo,Consolas,monospace;font-size:var(--t2);color:var(--fg3);
  overflow-wrap:anywhere;
}

.etab{width:100%;border-collapse:collapse}
.etab th{
  text-align:left;padding:0 10px 9px;font-size:var(--t2);font-weight:600;
  letter-spacing:.075em;text-transform:uppercase;color:var(--fg3);border-bottom:1px solid var(--line);
}
.etab td{padding:7px 10px;border-bottom:1px solid var(--line);vertical-align:middle}
.etab tr:last-child td{border-bottom:0}
.etab .f{font-family:ui-monospace,Menlo,Consolas,monospace;font-size:var(--t3);color:var(--fg2);white-space:nowrap}
.etab .inp{height:30px}
.etab .sel{height:30px;width:auto;min-width:104px}
.note{font-size:var(--t3);color:var(--fg3);line-height:1.6;margin-bottom:14px;max-width:82ch}
.note b{color:var(--fg2);font-weight:560}

/* ==========================================================================
   SAVE BAR
   ========================================================================== */
.save{
  position:sticky;bottom:0;z-index:20;margin-top:20px;
  display:flex;align-items:center;gap:14px;
  padding:13px 16px;border:1px solid var(--line2);border-radius:var(--r2);
  background:color-mix(in srgb,var(--s1) 92%,transparent);
  backdrop-filter:blur(12px);box-shadow:var(--pop);
}
.save__s{font-size:var(--t3);color:var(--fg3);flex:1}
.save[data-dirty="1"] .save__s{color:var(--warn)}

@media (max-width:1080px){
  .qgrid,.ops{grid-template-columns:repeat(2,1fr)}
  .grp__list{grid-template-columns:repeat(2,1fr)}
  .brand__meta{display:none}
}
@media (max-width:720px){
  .wrap{padding:20px 14px 88px}
  .qgrid,.ops,.grp__list{grid-template-columns:1fr}
  .tbl thead{display:none}
  .tbl table,.tbl tbody,.tbl tr,.tbl td{display:block;width:auto}
  .tbl tr{border-bottom:1px solid var(--line);padding:14px}
  .tbl td{padding:0;border:0}
  .tbl td + td{margin-top:11px}
  .acts{flex-direction:row;align-items:center}
  .acts .btn{width:auto}
  .opt--lg{grid-column:span 1}
}
@media (prefers-reduced-motion:reduce){*{transition:none!important;animation:none!important}}
</style>
</head>
<body>

<svg style="display:none" aria-hidden="true">
<defs>
<symbol id="i-radar" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4.5"/><path d="M12 12 19 6.5"/></symbol>
<symbol id="i-play" viewBox="0 0 24 24"><path d="M7 4.8 19 12 7 19.2z"/></symbol>
<symbol id="i-search" viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="m16.3 16.3 4.2 4.2"/></symbol>
<symbol id="i-refresh" viewBox="0 0 24 24"><path d="M20.5 12a8.5 8.5 0 0 1-14.6 5.9"/><path d="M3.5 12a8.5 8.5 0 0 1 14.6-5.9"/><path d="M18 2.5v4h-4M6 21.5v-4h4"/></symbol>
<symbol id="i-bell" viewBox="0 0 24 24"><path d="M18 8.5a6 6 0 0 0-12 0c0 6.5-2.5 8.5-2.5 8.5h17S18 15 18 8.5"/><path d="M13.7 20a2 2 0 0 1-3.4 0"/></symbol>
<symbol id="i-eye" viewBox="0 0 24 24"><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12"/><circle cx="12" cy="12" r="3"/></symbol>
<symbol id="i-close" viewBox="0 0 24 24"><path d="m6 6 12 12M18 6 6 18"/></symbol>
<symbol id="i-ext" viewBox="0 0 24 24"><path d="M14 4h6v6"/><path d="M20 4 10.5 13.5"/><path d="M18 14.5V19a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h4.5"/></symbol>
<symbol id="i-check" viewBox="0 0 24 24"><path d="m4.5 12.5 5 5 10-11"/></symbol>
<symbol id="i-warn" viewBox="0 0 24 24"><path d="M12 3.5 21.5 20h-19z"/><path d="M12 9.5v4.5"/><path d="M12 17.3v.2"/></symbol>
<symbol id="i-lock" viewBox="0 0 24 24"><rect x="4.5" y="10.5" width="15" height="10" rx="2"/><path d="M8 10.5V7a4 4 0 0 1 8 0v3.5"/></symbol>
<symbol id="i-book" viewBox="0 0 24 24"><path d="M4.5 4.5A2.5 2.5 0 0 1 7 2h13v17H7a2.5 2.5 0 0 0-2.5 2.5z"/><path d="M4.5 17.5H20"/></symbol>
<symbol id="i-sliders" viewBox="0 0 24 24"><path d="M3 7h8M15 7h6M3 17h4M11 17h10"/><circle cx="13" cy="7" r="2"/><circle cx="9" cy="17" r="2"/></symbol>
<symbol id="i-save" viewBox="0 0 24 24"><path d="M4.5 4.5h11l4 4V19.5h-15z"/><path d="M8 4.5v5h7v-5"/><path d="M8 19.5v-5.5h8v5.5"/></symbol>
<symbol id="i-arrow" viewBox="0 0 24 24"><path d="M4.5 12h15"/><path d="m13.5 6 6 6-6 6"/></symbol>
<symbol id="i-check-c" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="m8 12.3 2.7 2.7L16.2 9"/></symbol>
<symbol id="i-x-c" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="m9.2 9.2 5.6 5.6M14.8 9.2l-5.6 5.6"/></symbol>
<symbol id="i-help-c" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M9.6 9.6a2.5 2.5 0 0 1 4.9.7c0 1.7-2.5 2-2.5 3.7"/><path d="M12 17.4v.2"/></symbol>
<symbol id="i-inbox" viewBox="0 0 24 24"><path d="M3.5 13.5h4l1.6 3h5.8l1.6-3h4"/><path d="M6.4 4h11.2l3.4 9.5V20H3V13.5z"/></symbol>
<symbol id="i-flag" viewBox="0 0 24 24"><path d="M5 21V4"/><path d="M5 4.8h11l-1.8 3.4 1.8 3.4H5"/></symbol>
</defs>
</svg>

<div class="app">

  <header class="hdr">
    <div class="brand">
      <div class="mark"><svg class="i i--l"><use href="#i-radar"/></svg></div>
      <div style="min-width:0">
        <div class="brand__name">Opportunity Radar</div>
        <div class="brand__meta">Crawler &middot; boolean engine &middot; WhatsApp router</div>
      </div>
    </div>

    <div class="seg" role="tablist" aria-label="View">
      <button id="tab-table-btn" role="tab" aria-selected="true" aria-controls="tab-table">
        <svg class="i i--s"><use href="#i-inbox"/></svg>Daily table
      </button>
      <button id="tab-settings-btn" role="tab" aria-selected="false" aria-controls="tab-settings">
        <svg class="i i--s"><use href="#i-sliders"/></svg>Control plane
      </button>
    </div>

    <div class="hdr__sp"></div>

    <div class="hdr__acts">
      <button id="btn-dry-run" class="btn" title="Dry run. Crawls and matches, sends nothing.">
        <svg class="i i--s"><use href="#i-eye"/></svg>Preview
      </button>
      <button id="btn-run-live" class="btn btn--pri">
        <svg class="i i--s"><use href="#i-play"/></svg>Run crawl &amp; send
      </button>
    </div>
  </header>

  <main class="main" id="main">

    <!-- ===================================================================
         VIEW 1 &mdash; DAILY TABLE
         =================================================================== -->
    <section id="tab-table" class="view wrap" role="tabpanel" aria-labelledby="tab-table-btn">
      <div class="filters">
        <div class="search">
          <svg class="i i--s"><use href="#i-search"/></svg>
          <input type="search" id="search-input" class="inp" autocomplete="off" spellcheck="false"
            aria-label="Search opportunities by keyword or boolean query"
            placeholder='(AI OR grant) AND Africa -scam  ·  title:  ·  from:  ·  url:'>
        </div>
        <select id="date-select" class="sel" style="width:150px" aria-label="Crawl date"></select>
        <select id="category-filter" class="sel" style="width:200px" aria-label="Category"></select>
        <div class="count">Showing <b id="table-count">0</b> opportunities</div>
      </div>

      <div class="tbl">
        <table>
          <colgroup>
            <col>
            <col style="width:184px">
            <col style="width:112px">
            <col style="width:136px">
          </colgroup>
          <thead>
            <tr>
              <th scope="col">Opportunity</th>
              <th scope="col">Source</th>
              <th scope="col">Deadline</th>
              <th scope="col" class="num">Action</th>
            </tr>
          </thead>
          <tbody id="table-body">
            <tr><td colspan="4"><div class="empty"><b>Loading opportunities</b>Reading this crawl date from KV.</div></td></tr>
          </tbody>
        </table>
      </div>
    </section>

    <!-- ===================================================================
         VIEW 2 &mdash; CONTROL PLANE
         =================================================================== -->
    <section id="tab-settings" class="view wrap" role="tabpanel" aria-labelledby="tab-settings-btn" hidden>

      <!-- 01 &middot; ACTIONS -->
      <div class="panel">
        <div class="panel__hd">
          <div class="panel__ix">01</div>
          <div style="min-width:0">
            <h2 class="panel__ti">Actions</h2>
            <p class="panel__sub">Diagnostics live here, next to the settings they test. The one button that sends real messages stays in the header.</p>
          </div>
        </div>
        <div class="panel__bd">
          <div style="display:flex;gap:8px;flex-wrap:wrap">
            <button id="btn-test-ping" class="btn">
              <svg class="i i--s"><use href="#i-bell"/></svg>Send test alert
            </button>
            <button id="btn-dry-run-2" class="btn">
              <svg class="i i--s"><use href="#i-eye"/></svg>Preview matches
            </button>
            <button id="btn-refresh-quotas" class="btn">
              <svg class="i i--s"><use href="#i-refresh"/></svg>Refresh quotas
            </button>
          </div>
        </div>
      </div>

      <!-- 02 &middot; DELIVERY -->
      <div class="panel">
        <div class="panel__hd">
          <div class="panel__ix">02</div>
          <div style="min-width:0">
            <h2 class="panel__ti">Delivery target</h2>
            <p class="panel__sub">Pick one gateway, or let the router cascade. Unconfigured services are skipped without failing the run.</p>
          </div>
        </div>
        <div class="panel__bd">
          <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:9px" id="targets-grid">
            <label class="opt">
              <span class="opt__hd"><input type="radio" name="notificationTarget" value="auto_router"><span class="opt__t">Auto-router</span></span>
              <span class="opt__d">Walks the chain below and stops at the first gateway with quota left.</span>
            </label>
            <label class="opt">
              <span class="opt__hd"><input type="radio" name="notificationTarget" value="whatsapp_kapso"><span class="opt__t">Kapso.ai</span></span>
              <span class="opt__d">WhatsApp Cloud. 2,000 free per month.</span>
            </label>
            <label class="opt">
              <span class="opt__hd"><input type="radio" name="notificationTarget" value="whatsapp_meta"><span class="opt__t">Meta Cloud API</span></span>
              <span class="opt__d">Official Graph endpoint. 1,000 free per month.</span>
            </label>
            <label class="opt">
              <span class="opt__hd"><input type="radio" name="notificationTarget" value="whatsapp_twilio"><span class="opt__t">Twilio sandbox</span></span>
              <span class="opt__d">Trial sandbox. 1,000 free messages.</span>
            </label>
            <label class="opt">
              <span class="opt__hd"><input type="radio" name="notificationTarget" value="telegram"><span class="opt__t">Telegram bot</span></span>
              <span class="opt__d">Free and unlimited. Supports forum topics.</span>
            </label>
            <label class="opt">
              <span class="opt__hd"><input type="radio" name="notificationTarget" value="whatsapp_callmebot"><span class="opt__t">CallMeBot</span></span>
              <span class="opt__d">Legacy community gateway. Direct personal ping.</span>
            </label>
          </div>

          <div id="router-info-banner" hidden style="margin-top:16px">
            <div class="lbl">Cascade order</div>
            <div class="chain" id="router-chain"></div>
          </div>

          <div class="rule"></div>

          <div style="display:flex;flex-direction:column;gap:10px">
            <div id="fields-kapso" class="acc" hidden>
              <summary><span class="acc__t">Kapso.ai gateway</span><span class="acc__s">2,000 free per month</span></summary>
              <div class="acc__bd" style="display:grid;grid-template-columns:repeat(4,1fr);gap:11px">
                <div class="field"><label class="lbl" for="kapsoApiKey">API key</label><input type="password" id="kapsoApiKey" class="inp" placeholder="kps_live_..." autocomplete="off"></div>
                <div class="field"><label class="lbl" for="kapsoPhoneNumberId">Phone number ID</label><input type="text" id="kapsoPhoneNumberId" class="inp" autocomplete="off"></div>
                <div class="field"><label class="lbl" for="kapsoRecipientPhone">Recipient phone</label><input type="text" id="kapsoRecipientPhone" class="inp" inputmode="numeric" autocomplete="off"></div>
                <div class="field"><label class="lbl" for="kapsoMonthlyLimit">Monthly cap</label><input type="number" id="kapsoMonthlyLimit" class="inp" min="0"></div>
              </div>
            </div>

            <div id="fields-meta" class="acc" hidden>
              <summary><span class="acc__t">Meta Cloud API</span><span class="acc__s">1,000 free per month</span></summary>
              <div class="acc__bd" style="display:grid;grid-template-columns:repeat(4,1fr);gap:11px">
                <div class="field"><label class="lbl" for="metaPhoneNumberId">Phone number ID</label><input type="text" id="metaPhoneNumberId" class="inp" autocomplete="off"></div>
                <div class="field"><label class="lbl" for="metaAccessToken">Access token</label><input type="password" id="metaAccessToken" class="inp" placeholder="EAAB..." autocomplete="off"></div>
                <div class="field"><label class="lbl" for="metaRecipientPhone">Recipient phone</label><input type="text" id="metaRecipientPhone" class="inp" inputmode="numeric" autocomplete="off"></div>
                <div class="field"><label class="lbl" for="metaMonthlyLimit">Monthly cap</label><input type="number" id="metaMonthlyLimit" class="inp" min="0"></div>
              </div>
            </div>

            <div id="fields-twilio" class="acc" hidden>
              <summary><span class="acc__t">Twilio sandbox</span><span class="acc__s">1,000 free messages</span></summary>
              <div class="acc__bd" style="display:grid;grid-template-columns:repeat(4,1fr);gap:11px">
                <div class="field"><label class="lbl" for="twilioAccountSid">Account SID</label><input type="text" id="twilioAccountSid" class="inp" autocomplete="off"></div>
                <div class="field"><label class="lbl" for="twilioAuthToken">Auth token</label><input type="password" id="twilioAuthToken" class="inp" autocomplete="off"></div>
                <div class="field"><label class="lbl" for="twilioToPhone">Recipient WhatsApp</label><input type="text" id="twilioToPhone" class="inp" autocomplete="off"></div>
                <div class="field"><label class="lbl" for="twilioMonthlyLimit">Monthly cap</label><input type="number" id="twilioMonthlyLimit" class="inp" min="0"></div>
              </div>
            </div>

            <div id="fields-telegram" class="acc" hidden>
              <summary><span class="acc__t">Telegram bot</span><span class="acc__s">Free and unlimited</span></summary>
              <div class="acc__bd" style="display:grid;grid-template-columns:repeat(2,1fr);gap:11px">
                <div class="field"><label class="lbl" for="telegramBotToken">Bot token</label><input type="password" id="telegramBotToken" class="inp" placeholder="123456:ABC-DEF..." autocomplete="off"></div>
                <div class="field"><label class="lbl" for="telegramChatId">Chat ID or channel</label><input type="text" id="telegramChatId" class="inp" autocomplete="off"></div>
              </div>
            </div>

            <div id="fields-callmebot" class="acc" hidden>
              <summary><span class="acc__t">CallMeBot</span><span class="acc__s">Legacy gateway</span></summary>
              <div class="acc__bd" style="display:grid;grid-template-columns:repeat(2,1fr);gap:11px">
                <div class="field"><label class="lbl" for="callmebotPhone">Phone with country code</label><input type="text" id="callmebotPhone" class="inp" autocomplete="off"></div>
                <div class="field"><label class="lbl" for="callmebotApiKey">API key</label><input type="text" id="callmebotApiKey" class="inp" autocomplete="off"></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 03 &middot; CAPACITY -->
      <div class="panel">
        <div class="panel__hd">
          <div class="panel__ix">03</div>
          <div style="min-width:0">
            <h2 class="panel__ti">Monthly capacity</h2>
            <p class="panel__sub">Counters live in Cloudflare KV and update on every dispatch.</p>
          </div>
        </div>
        <div class="panel__bd">
          <div class="qgrid" id="quota-cards-grid">
            <div class="q"><div class="q__hd"><span class="dot"></span><span class="q__n">Loading capacity</span></div></div>
          </div>
        </div>
      </div>

      <!-- 04 &middot; LIMITS -->
      <div class="panel">
        <div class="panel__hd">
          <div class="panel__ix">04</div>
          <div style="min-width:0">
            <h2 class="panel__ti">Message format and dispatch limits</h2>
            <p class="panel__sub">How each match is delivered, and how much one run may send.</p>
          </div>
        </div>
        <div class="panel__bd">
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:22px">
            <div class="field">
              <span class="lbl">Message style</span>
              <div style="display:grid;grid-template-columns:1fr 1fr;gap:9px">
                <label class="opt">
                  <span class="opt__hd"><input type="radio" name="messageMode" value="individual"><span class="opt__t">Individual</span></span>
                  <span class="opt__d">One message per opportunity, with full details and the apply link.</span>
                </label>
                <label class="opt">
                  <span class="opt__hd"><input type="radio" name="messageMode" value="digest"><span class="opt__t">Category digest</span></span>
                  <span class="opt__d">One combined summary per category per run.</span>
                </label>
              </div>
            </div>
            <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:11px;align-content:start">
              <div class="field"><label class="lbl" for="maxTotalMessages">Max per run</label><input type="number" id="maxTotalMessages" class="inp" min="1" max="50"></div>
              <div class="field"><label class="lbl" for="maxPerSource">Max per source</label><input type="number" id="maxPerSource" class="inp" min="1" max="10"></div>
              <div class="field"><label class="lbl" for="maxAgeDays">Freshness window (days)</label><input type="number" id="maxAgeDays" class="inp" min="1" max="14"></div>
            </div>
          </div>
        </div>
      </div>

      <!-- 05 &middot; SOURCES -->
      <div class="panel">
        <div class="panel__hd">
          <div class="panel__ix">05</div>
          <div style="min-width:0">
            <h2 class="panel__ti">Source platforms</h2>
            <p class="panel__sub">Every feed the crawler reads. Grouped by category so you can drop one category without hunting.</p>
          </div>
          <div class="hdr__sp"></div>
          <div style="display:flex;gap:7px;align-items:center;flex:none">
            <span class="count" id="src-count"></span>
            <button type="button" id="btn-select-all" class="btn btn--sm">All</button>
            <button type="button" id="btn-deselect-all" class="btn btn--sm">None</button>
          </div>
        </div>
        <div class="panel__bd">
          <div id="sources-checkboxes-grid"></div>
        </div>
      </div>

      <!-- 06 &middot; FILTER ENGINE -->
      <div class="panel">
        <div class="panel__hd">
          <div class="panel__ix">06</div>
          <div style="min-width:0">
            <h2 class="panel__ti">Query and filter engine</h2>
            <p class="panel__sub">Per category, filter with a plain keyword list or a full boolean expression. The same syntax works in the table search bar.</p>
          </div>
          <div class="hdr__sp"></div>
          <button type="button" id="btn-reset-keywords" class="btn btn--sm" style="flex:none">Reset to defaults</button>
        </div>
        <div class="panel__bd">

          <details class="acc">
            <summary>
              <svg class="i i--s" style="color:var(--fg3)"><use href="#i-book"/></svg>
              <span class="acc__t">Operator reference</span>
              <span class="acc__s">11 operators</span>
            </summary>
            <div class="acc__bd">
              <div class="ops">
                <div class="op"><div class="op__hd"><code class="op__c">"exact phrase"</code><span class="op__k">Phrase</span></div>
                  <p class="op__d">Matches those words together, in that order.</p>
                  <div class="op__e">"fully funded" "AI policy"</div></div>
                <div class="op"><div class="op__hd"><code class="op__c">OR &nbsp;||</code><span class="op__k">Union</span></div>
                  <p class="op__d">Matches either side.</p>
                  <div class="op__e">grant OR fellowship OR award</div></div>
                <div class="op"><div class="op__hd"><code class="op__c">AND &nbsp;space</code><span class="op__k">Both</span></div>
                  <p class="op__d">Requires every term to be present.</p>
                  <div class="op__e">fellowship AND policy</div></div>
                <div class="op"><div class="op__hd"><code class="op__c">-term &nbsp;NOT</code><span class="op__k">Exclude</span></div>
                  <p class="op__d">Discards anything matching the term.</p>
                  <div class="op__e">-"high school" NOT scam</div></div>
                <div class="op"><div class="op__hd"><code class="op__c">( ... )</code><span class="op__k">Group</span></div>
                  <p class="op__d">Groups clauses to control evaluation order.</p>
                  <div class="op__e">(AI OR ML) AND (policy OR ethics)</div></div>
                <div class="op"><div class="op__hd"><code class="op__c">title:"..."</code><span class="op__k">Headline</span></div>
                  <p class="op__d">Restricts the match to the title only.</p>
                  <div class="op__e">title:"pitch competition"</div></div>
                <div class="op"><div class="op__hd"><code class="op__c">body:"..."</code><span class="op__k">Body</span></div>
                  <p class="op__d">Restricts the match to the description.</p>
                  <div class="op__e">body:"living stipend"</div></div>
                <div class="op"><div class="op__hd"><code class="op__c">from: &nbsp;source:</code><span class="op__k">Platform</span></div>
                  <p class="op__d">Keeps only one feed's items.</p>
                  <div class="op__e">from:"Disrupt Africa"</div></div>
                <div class="op"><div class="op__hd"><code class="op__c">url:"..."</code><span class="op__k">Link</span></div>
                  <p class="op__d">Matches the domain or path of the apply URL.</p>
                  <div class="op__e">url:github.com</div></div>
                <div class="op"><div class="op__hd"><code class="op__c">has:links</code><span class="op__k">Required</span></div>
                  <p class="op__d">Keeps only items that carry an apply link.</p>
                  <div class="op__e">fellowship has:links</div></div>
                <div class="op"><div class="op__hd"><code class="op__c">prefix*</code><span class="op__k">Wildcard</span></div>
                  <p class="op__d">Matches any word starting with the stem.</p>
                  <div class="op__e">technol* comput*</div></div>
              </div>
            </div>
          </details>

          <div class="rule"></div>

          <details class="acc" open>
            <summary>
              <svg class="i i--s" style="color:var(--fg3)"><use href="#i-flag"/></svg>
              <span class="acc__t">Eligibility profile</span>
              <span class="acc__s">${ELIGIBILITY_FIELDS.length} parameters, none enforced by default</span>
            </summary>
            <div class="acc__bd">
              <p class="note">The radar reads each apply page and writes down what it finds. You decide what happens next.
                <b>Warn</b> notes a mismatch. <b>Enforce</b> blocks the item. <b>Ignore</b> skips the check entirely.
                A blank answer means unknown, and unknown never blocks.</p>
              <table class="etab">
                <thead><tr><th scope="col" style="width:34%">Parameter</th><th scope="col">Your answer</th><th scope="col" style="width:132px">Enforcement</th></tr></thead>
                <tbody id="eligibility-profile-body"></tbody>
              </table>

              <details class="acc" style="margin-top:12px">
                <summary>
                  <svg class="i i--s" style="color:var(--fg4)"><use href="#i-sliders"/></svg>
                  <span class="acc__s" style="font-weight:500">Advanced parameters</span>
                  <span class="acc__s">${ADVANCED_ELIGIBILITY_FIELDS.length} more</span>
                </summary>
                <div class="acc__bd">
                  <p class="note">Gates that decide an application as hard as the four above, but that apply to fewer calls. They extract, they show, and they enforce on the same terms.</p>
                  <table class="etab">
                    <thead><tr><th scope="col" style="width:34%">Parameter</th><th scope="col">Your answer</th><th scope="col" style="width:132px">Enforcement</th></tr></thead>
                    <tbody id="eligibility-advanced-body"></tbody>
                  </table>
                </div>
              </details>
            </div>
          </details>

          <div class="rule"></div>

          <div id="keywords-accordion"></div>
        </div>
      </div>

      <form id="settings-form" class="save" data-dirty="0">
        <div class="save__s" id="save-status">No unsaved changes</div>
        <button type="submit" id="btn-save-settings" class="btn btn--pri">
          <svg class="i i--s"><use href="#i-save"/></svg>
          <span id="save-label">Save settings</span>
        </button>
      </form>
    </section>

  </main>
</div>

<div class="scrim" id="scrim" data-on="0"></div>
<aside class="drawer" id="drawer" data-on="0" role="dialog" aria-modal="true" aria-labelledby="drawer-title">
  <div class="drawer__hd">
    <div class="drawer__t" id="drawer-title">Detail</div>
    <button class="btn btn--ghost btn--sm" id="btn-close-log" aria-label="Close panel">
      <svg class="i i--s"><use href="#i-close"/></svg>
    </button>
  </div>
  <div class="drawer__bd" id="log-content"></div>
</aside>

<script>
const INITIAL_CATEGORIES = ${categoriesJson};
let CURRENT_SETTINGS = ${settingsJson};
let AVAILABLE_DATES = ${datesJson};
let CONSUMED_KEYS = new Set(${consumedJson});
let ALL_OPPORTUNITIES = [];
let QUOTAS = [];

const ELIGIBILITY_FIELDS = ${eligibilityFieldsJson};
const TOP_ELIGIBILITY_FIELDS = ${topEligibilityFieldsJson};
const ADVANCED_ELIGIBILITY_FIELDS = ${advancedEligibilityFieldsJson};
const ELIGIBILITY_MODES = ["enforce", "warn", "ignore"];

// Crawled pages are untrusted text. Escape before they reach innerHTML, or one
// closing script tag in a job title ends this whole block.
const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const safeUrl = (u) => { const s = String(u || ""); return /^https?:\\/\\//i.test(s) ? esc(s) : "#"; };

const $ = (id) => document.getElementById(id);
const days = (n) => n == null ? 0 : Math.round((new Date(n) - Date.now()) / 86400000);

/* ---------------------------------------------------------------- drawer */
let lastFocus = null;
function openDrawer(title, html) {
  lastFocus = document.activeElement;
  $("drawer-title").textContent = title;
  $("log-content").innerHTML = html;
  $("drawer").dataset.on = "1";
  $("scrim").dataset.on = "1";
  $("btn-close-log").focus();
}
function closeDrawer() {
  $("drawer").dataset.on = "0";
  $("scrim").dataset.on = "0";
  if (lastFocus && lastFocus.focus) lastFocus.focus();
}
$("btn-close-log").addEventListener("click", closeDrawer);
$("scrim").addEventListener("click", closeDrawer);
document.addEventListener("keydown", (e) => {
  if (e.key !== "Escape") return;
  if ($("drawer").dataset.on === "1") return closeDrawer();
  document.querySelectorAll("details.acc[open]").forEach((d) => { d.open = false; });
});

/* ------------------------------------------------------------------- tabs */
const tabTable = $("tab-table"), tabSettings = $("tab-settings");
const tabTableBtn = $("tab-table-btn"), tabSettingsBtn = $("tab-settings-btn");
function showTab(which) {
  const isTable = which === "table";
  tabTable.hidden = !isTable; tabSettings.hidden = isTable;
  tabTableBtn.setAttribute("aria-selected", String(isTable));
  tabSettingsBtn.setAttribute("aria-selected", String(!isTable));
  if (!isTable) loadQuotaStats();
}
tabTableBtn.addEventListener("click", () => showTab("table"));
tabSettingsBtn.addEventListener("click", () => showTab("settings"));

/* --------------------------------------------------------- dirty tracking
   The form is only the save bar, so its fields sit outside it. Listen on the
   document and keep anything that is not in the Control Plane out of it. */
const form = $("settings-form");
function markDirty() {
  if (form.dataset.dirty === "1") return;
  form.dataset.dirty = "1";
  $("save-status").textContent = "Unsaved changes";
}
["input", "change"].forEach((evt) =>
  document.addEventListener(evt, (e) => { if (tabSettings.contains(e.target)) markDirty(); }));

/* ------------------------------------------------- provider visibility */
function updateProviderVisibility() {
  const selected = (document.querySelector('input[name="notificationTarget"]:checked') || {}).value || "auto_router";
  const isAuto = selected === "auto_router";
  $("router-info-banner").hidden = !isAuto;
  const PANELS = { whatsapp_kapso: "fields-kapso", whatsapp_meta: "fields-meta", whatsapp_twilio: "fields-twilio", telegram: "fields-telegram", whatsapp_callmebot: "fields-callmebot" };
  Object.keys(PANELS).forEach((k) => { $(PANELS[k]).hidden = isAuto ? false : selected !== k; });
}
document.querySelectorAll('input[name="notificationTarget"]').forEach((r) => r.addEventListener("change", updateProviderVisibility));

/* ------------------------------------------------------------- capacity */
const CHAIN = ["whatsapp_kapso", "whatsapp_meta", "whatsapp_twilio", "telegram"];

function renderChain() {
  const box = $("router-chain");
  if (!QUOTAS.length) { box.innerHTML = '<span class="count">Reading counters</span>'; return; }
  // active is already "configured and under the cap" server-side.
  const first = CHAIN.map((k) => QUOTAS.find((q) => q.provider === k)).find((q) => q && q.active);
  box.innerHTML = CHAIN.map((k, i) => {
    const q = QUOTAS.find((x) => x.provider === k);
    const unlimited = q && q.monthlyLimit >= 999999;
    const on = q && first && q.provider === first.provider;
    const cap = q ? (unlimited ? "\\u221e" : q.monthlyLimit.toLocaleString()) : "\\u2014";
    const dot = on ? "dot--good" : "";
    return (i ? '<svg class="i i--s arrow"><use href="#i-arrow"/></svg>' : "") +
      '<span class="node ' + (on ? "node--on" : q && q.active ? "" : "node--out") + '">' +
      '<span class="dot ' + dot + '"></span>' + esc(q ? q.displayName : k) +
      '<span class="node__cap">' + cap + "</span></span>";
  }).join("");
}

async function loadQuotaStats() {
  const grid = $("quota-cards-grid");
  try {
    const res = await fetch("/api/usage");
    if (!res.ok) throw new Error("HTTP " + res.status);
    QUOTAS = await res.json();
    grid.innerHTML = QUOTAS.map((q) => {
      const unlimited = q.monthlyLimit >= 999999;
      const pct = unlimited ? 0 : Math.min(100, Math.round((q.currentCount / q.monthlyLimit) * 100));
      // An unlimited channel has no meter, so its bar stays neutral. A full
      // saturated bar sitting next to the word Ready reads as exhausted.
      const bar = unlimited ? "fg4" : pct > 90 ? "bad" : pct > 75 ? "warn" : "good";
      const fill = unlimited ? (q.currentCount > 0 ? 100 : 0) : pct;
      // The status word carries its own colour. Tying it to the bar is what
      // made "Not configured" render green.
      const state = !q.configured ? ["", "Not configured", "fg4"]
        : q.active ? ["dot--good", "Ready", "good"]
        : ["dot--bad", "Quota hit", "bad"];
      return '<div class="q"><div class="q__hd"><span class="dot ' + state[0] + '"></span>' +
        '<span class="q__n" title="' + esc(q.displayName) + '">' + esc(q.displayName) + '</span></div>' +
        '<div class="q__hd" style="gap:6px"><span class="q__v">' + q.currentCount.toLocaleString() +
        ' <span style="color:var(--fg4)">' + (unlimited ? "sent" : "/ " + q.monthlyLimit.toLocaleString()) + '</span></span>' +
        '<span class="q__v" style="flex:1"></span>' +
        '<span class="q__v" style="color:var(--' + state[2] + ')">' + esc(state[1]) + '</span></div>' +
        '<div class="q__track"><div class="q__fill" style="width:' + fill + '%;background:var(--' + bar + ')"></div></div></div>';
    }).join("");
    renderChain();
  } catch (err) {
    grid.innerHTML = '<div class="q" style="grid-column:1/-1"><span class="q__v">Could not read counters: ' + esc(err.message) + '</span></div>';
  }
}
$("btn-refresh-quotas").addEventListener("click", loadQuotaStats);

/* ------------------------------------------------------ eligibility rows */
function eligibilityRow(f) {
  const p = CURRENT_SETTINGS.eligibilityProfile || { enforcement: {} };
  const mode = (p.enforcement && p.enforcement[f]) || "warn";
  const value = f === "documentsHeld" ? (p.documentsHeld || "") : (p[f] !== undefined && p[f] !== null ? p[f] : "");
  const cls = mode === "enforce" ? "sel--bad" : mode === "ignore" ? "sel--idle" : "sel--warn";
  return '<tr>' +
    '<td class="f">' + esc(f) + '</td>' +
    '<td><input type="' + (f === "yearsExperience" ? "number" : "text") + '" data-ep-value="' + esc(f) +
      '" value="' + esc(value) + '" placeholder="unset" aria-label="Your answer for ' + esc(f) +
      '" class="inp" autocomplete="off"></td>' +
    '<td><select data-ep-mode="' + esc(f) + '" aria-label="Enforcement for ' + esc(f) +
      '" class="sel ' + cls + '">' + ELIGIBILITY_MODES.map((m) =>
        '<option value="' + m + '"' + (m === mode ? " selected" : "") + ">" + m[0].toUpperCase() + m.slice(1) + "</option>").join("") +
      "</select></td></tr>";
}
function populateEligibilityProfile() {
  const body = $("eligibility-profile-body"), adv = $("eligibility-advanced-body");
  if (body) body.innerHTML = TOP_ELIGIBILITY_FIELDS.map(eligibilityRow).join("");
  if (adv) adv.innerHTML = ADVANCED_ELIGIBILITY_FIELDS.map(eligibilityRow).join("");
}
function readEligibilityProfile() {
  const profile = { enforcement: {} };
  document.querySelectorAll("[data-ep-mode]").forEach((el) => { profile.enforcement[el.dataset.epMode] = el.value; });
  document.querySelectorAll("[data-ep-value]").forEach((el) => {
    const key = el.dataset.epValue, raw = el.value.trim();
    if (key === "yearsExperience") profile.yearsExperience = raw === "" ? undefined : Number(raw);
    else profile[key] = raw;
  });
  return profile;
}

/* -------------------------------------------------- keyword category editor */
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

function keywordState(cat) {
  const saved = CURRENT_SETTINGS.categoryKeywords?.[cat.id] || {};
  const def = DEFAULT_CATEGORY_KEYWORDS[cat.id] || { include: "", exclude: "", boolean: "" };
  return {
    mode: saved.mode || "simple",
    include: saved.includeText !== undefined ? saved.includeText : def.include,
    exclude: saved.excludeText !== undefined ? saved.excludeText : def.exclude,
    boolean: saved.booleanQuery !== undefined ? saved.booleanQuery : def.boolean
  };
}

function renderKeywordsEditor() {
  const box = $("keywords-accordion");
  if (!box) return;
  box.innerHTML = INITIAL_CATEGORIES.map((cat, i) => {
    const s = keywordState(cat);
    const simple = s.mode === "simple";
    // name= makes these mutually exclusive natively, so no JS keeps them in sync.
    return '<details class="acc" name="kwcat"' + (i === 0 ? " open" : "") + '>' +
      "<summary>" +
        '<span class="acc__t">' + esc(cat.displayName) + "</span>" +
        '<span class="seg" role="group" aria-label="Filter mode for ' + esc(cat.displayName) + '">' +
          '<button type="button" data-kwmode="' + esc(cat.id) + '" data-to="simple" aria-pressed="' + simple + '">Simple</button>' +
          '<button type="button" data-kwmode="' + esc(cat.id) + '" data-to="boolean" aria-pressed="' + !simple + '">Boolean</button>' +
        "</span>" +
      "</summary>" +
      '<div class="acc__bd">' +
        '<div id="mode-simple-' + esc(cat.id) + '"' + (simple ? "" : " hidden") + ' style="display:grid;grid-template-columns:1fr 1fr;gap:14px">' +
          '<div class="field"><label class="lbl" for="kw-inc-' + esc(cat.id) + '">Include &mdash; match at least one</label>' +
            '<textarea id="kw-inc-' + esc(cat.id) + '" rows="4" class="ta" spellcheck="false">' + esc(s.include) + "</textarea></div>" +
          '<div class="field"><label class="lbl" for="kw-exc-' + esc(cat.id) + '">Exclude &mdash; drop on match</label>' +
            '<textarea id="kw-exc-' + esc(cat.id) + '" rows="4" class="ta" spellcheck="false">' + esc(s.exclude) + "</textarea></div>" +
        "</div>" +
        '<div id="mode-boolean-' + esc(cat.id) + '"' + (simple ? " hidden" : "") + ' class="field">' +
          '<label class="lbl" for="kw-bool-' + esc(cat.id) + '">Boolean expression</label>' +
          '<textarea id="kw-bool-' + esc(cat.id) + '" rows="3" class="ta" spellcheck="false" placeholder="(fellowship OR grant) AND (AI OR policy) -(&quot;high school&quot;)">' + esc(s.boolean) + "</textarea>" +
        "</div>" +
        '<input type="hidden" id="kw-mode-' + esc(cat.id) + '" value="' + esc(s.mode) + '">' +
        '<div style="display:flex;justify-content:flex-end;margin-top:12px">' +
          '<button type="button" class="btn btn--sm" onclick="restoreCategoryDefaults(\\'' + esc(cat.id) + '\\')">Restore defaults</button>' +
        "</div>" +
        "</div></details>";
  }).join("");
}

window.restoreCategoryDefaults = function (catId) {
  const def = DEFAULT_CATEGORY_KEYWORDS[catId];
  if (!def) return;
  [["kw-inc-", def.include], ["kw-exc-", def.exclude], ["kw-bool-", def.boolean]].forEach(([p, v]) => {
    const el = $(p + catId); if (el) el.value = v;
  });
  markDirty();
};

$("keywords-accordion").addEventListener("click", (e) => {
  const b = e.target.closest("[data-kwmode]");
  if (!b) return;
  e.preventDefault();
  const catId = b.dataset.kwmode, to = b.dataset.to;
  $("mode-simple-" + catId).hidden = to !== "simple";
  $("mode-boolean-" + catId).hidden = to !== "boolean";
  $("kw-mode-" + catId).value = to;
  b.closest(".seg").querySelectorAll("button").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
  markDirty();
});

$("btn-reset-keywords").addEventListener("click", () => INITIAL_CATEGORIES.forEach((c) => restoreCategoryDefaults(c.id)));

/* ---------------------------------------------------------------- sources */
function renderSources() {
  const box = $("sources-checkboxes-grid");
  box.innerHTML = INITIAL_CATEGORIES.map((cat) => {
    const on = cat.sources.filter((s) => CURRENT_SETTINGS.enabledSources?.[s.id] !== false).length;
    return '<div class="grp"><div class="grp__hd">' +
      '<span class="grp__n">' + esc(cat.displayName) + "</span>" +
      '<span class="grp__c" data-gc="' + esc(cat.id) + '">' + on + " / " + cat.sources.length + "</span>" +
      '<button type="button" class="btn btn--sm" data-gtog="' + esc(cat.id) + '" data-full="' + (on === cat.sources.length) + '">' +
        (on === cat.sources.length ? "None" : "All") + "</button></div>" +
      '<div class="grp__list">' + cat.sources.map((s) => {
        const checked = CURRENT_SETTINGS.enabledSources?.[s.id] !== false;
        return '<label class="src-i"><input type="checkbox" name="src_' + esc(s.id) + '" data-source-id="' + esc(s.id) +
          '" data-cat="' + esc(cat.id) + '"' + (checked ? " checked" : "") + ">" +
          '<span title="' + esc(s.name) + '">' + esc(s.name) + "</span></label>";
      }).join("") + "</div></div>";
  }).join("");
  syncSourceCount();
}
function syncSourceCount() {
  const all = document.querySelectorAll("[data-source-id]");
  const n = [...all].filter((c) => c.checked).length;
  $("src-count").innerHTML = "<b>" + n + "</b> of " + all.length + " enabled";
  document.querySelectorAll("[data-gc]").forEach((el) => {
    const id = el.dataset.gc;
    const grp = [...document.querySelectorAll('[data-cat="' + CSS.escape(id) + '"]')];
    el.textContent = grp.filter((c) => c.checked).length + " / " + grp.length;
  });
  document.querySelectorAll("[data-gtog]").forEach((b) => {
    const grp = [...document.querySelectorAll('[data-cat="' + CSS.escape(b.dataset.gtog) + '"]')];
    const full = grp.every((c) => c.checked);
    b.textContent = full ? "None" : "All";
    b.dataset.full = String(full);
  });
}
$("sources-checkboxes-grid").addEventListener("change", (e) => { if (e.target.dataset.sourceId) syncSourceCount(); });
$("sources-checkboxes-grid").addEventListener("click", (e) => {
  const b = e.target.closest("[data-gtog]");
  if (!b) return;
  const to = b.dataset.full !== "true";
  document.querySelectorAll('[data-cat="' + CSS.escape(b.dataset.gtog) + '"]').forEach((c) => { c.checked = to; });
  syncSourceCount();
});
$("btn-select-all").addEventListener("click", () => { document.querySelectorAll("[data-source-id]").forEach((c) => { c.checked = true; }); syncSourceCount(); });
$("btn-deselect-all").addEventListener("click", () => { document.querySelectorAll("[data-source-id]").forEach((c) => { c.checked = false; }); syncSourceCount(); });

/* ------------------------------------------------------------- populate */
function populateSettingsForm() {
  const cur = CURRENT_SETTINGS.notificationTarget || "auto_router";
  document.getElementsByName("notificationTarget").forEach((r) => { r.checked = r.value === cur; });
  updateProviderVisibility();

  document.getElementsByName("messageMode").forEach((r) => { r.checked = r.value === CURRENT_SETTINGS.messageMode; });

  const set = (id, v) => { $(id).value = v == null ? "" : v; };
  set("maxTotalMessages", CURRENT_SETTINGS.maxTotalMessages || 10);
  set("maxPerSource", CURRENT_SETTINGS.maxPerSource || 3);
  set("maxAgeDays", CURRENT_SETTINGS.maxAgeDays || 3);
  ["kapsoApiKey", "kapsoPhoneNumberId", "kapsoRecipientPhone", "kapsoMonthlyLimit",
   "metaPhoneNumberId", "metaAccessToken", "metaRecipientPhone", "metaMonthlyLimit",
   "twilioAccountSid", "twilioAuthToken", "twilioToPhone", "twilioMonthlyLimit",
   "telegramBotToken", "telegramChatId",
   "callmebotPhone", "callmebotApiKey"].forEach((k) => set(k, CURRENT_SETTINGS[k]));

  renderSources();
  renderKeywordsEditor();
}

/* ----------------------------------------------------------------- save */
form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const btn = $("btn-save-settings"), label = $("save-label"), status = $("save-status");
  const enabledSources = {};
  document.querySelectorAll("[data-source-id]").forEach((cb) => { enabledSources[cb.dataset.sourceId] = cb.checked; });
  const num = (id, d) => parseInt($(id).value, 10) || d;
  const str = (id) => $(id).value.trim();

  const categoryKeywords = {};
  INITIAL_CATEGORIES.forEach((cat) => {
    categoryKeywords[cat.id] = {
      mode: $("kw-mode-" + cat.id)?.value || "simple",
      includeText: $("kw-inc-" + cat.id)?.value.trim() || "",
      excludeText: $("kw-exc-" + cat.id)?.value.trim() || "",
      booleanQuery: $("kw-bool-" + cat.id)?.value.trim() || ""
    };
  });

  const updated = Object.assign(
    {
      notificationTarget: (document.querySelector('input[name="notificationTarget"]:checked') || {}).value || "auto_router",
      messageMode: (document.querySelector('input[name="messageMode"]:checked') || {}).value || "individual",
      maxTotalMessages: num("maxTotalMessages", 10),
      maxPerSource: num("maxPerSource", 3),
      maxAgeDays: num("maxAgeDays", 3),
      kapsoApiKey: str("kapsoApiKey"), kapsoPhoneNumberId: str("kapsoPhoneNumberId"),
      kapsoRecipientPhone: str("kapsoRecipientPhone"), kapsoMonthlyLimit: num("kapsoMonthlyLimit", 2000),
      metaPhoneNumberId: str("metaPhoneNumberId"), metaAccessToken: str("metaAccessToken"),
      metaRecipientPhone: str("metaRecipientPhone"), metaMonthlyLimit: num("metaMonthlyLimit", 1000),
      twilioAccountSid: str("twilioAccountSid"), twilioAuthToken: str("twilioAuthToken"),
      twilioToPhone: str("twilioToPhone"), twilioMonthlyLimit: num("twilioMonthlyLimit", 1000),
      telegramBotToken: str("telegramBotToken"), telegramChatId: str("telegramChatId"),
      callmebotPhone: str("callmebotPhone"), callmebotApiKey: str("callmebotApiKey"),
      enabledSources,
      categoryKeywords
    },
    { eligibilityProfile: readEligibilityProfile() }
  );

  btn.disabled = true;
  label.textContent = "Saving\\u2026";
  try {
    const res = await fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updated)
    });
    if (!res.ok) throw new Error("HTTP " + res.status);
    CURRENT_SETTINGS = await res.json();
    form.dataset.dirty = "0";
    label.textContent = "Saved";
    status.textContent = "All changes written to KV";
    loadQuotaStats();
  } catch (err) {
    label.textContent = "Save failed";
    status.textContent = "Could not save: " + err.message;
  } finally {
    setTimeout(() => { btn.disabled = false; label.textContent = "Save settings"; }, 1600);
  }
});

/* ---------------------------------------------------- client-side query */
function evaluateClientQuery(queryStr, item) {
  if (!queryStr || !queryStr.trim()) return true;
  const q = queryStr.trim();
  const hay = [item.title, item.description, item.sourceName, (item.matchedKeywords || []).join(" ")]
    .join(" ").toLowerCase();
  const body = [item.title, item.description, item.sourceName].join(" ").toLowerCase();

  const hasBool = /\\b(OR|AND|NOT)\\b|["'()-]/.test(q);
  if (!hasBool) return q.toLowerCase().split(/\\s+/).every((t) => t && hay.includes(t));

  const negs = q.match(/(?:-|\\bNOT\\s+)(?:"([^"]+)"|([^\\s()]+))/gi) || [];
  for (const n of negs) {
    const clean = n.replace(/^-(?:"|')?|^NOT\\s+(?:"|')?|["']$/gi, "").trim().toLowerCase();
    if (clean && body.includes(clean)) return false;
  }
  let pos = q;
  negs.forEach((n) => { pos = pos.replace(n, ""); });
  pos = pos.trim();
  if (!pos) return true;

  const orParts = pos.split(/\\s+OR\\s+|\\s+\\|\\|\\s+/i);
  if (orParts.length > 1) return orParts.some((p) => evaluateClientQuery(p.replace(/[()]/g, ""), item));

  return pos.split(/\\s+AND\\s+|\\s+&&\\s+/i).every((part) => {
    const t = part.replace(/[()"'\\s]/g, "").trim().toLowerCase();
    if (!t) return true;
    if (t.startsWith("title:")) return (item.title || "").toLowerCase().includes(t.slice(6));
    if (t.startsWith("from:") || t.startsWith("source:")) return (item.sourceName || "").toLowerCase().includes(t.replace(/^(from|source):/, ""));
    if (t.startsWith("url:")) return (item.link || "").toLowerCase().includes(t.slice(4));
    if (t === "has:links" || t === "has:link") return /^https?:/i.test(item.link || "");
    return hay.includes(t);
  });
}

/* ----------------------------------------------------------------- table */
const dateSelect = $("date-select"), categoryFilter = $("category-filter");
const searchInput = $("search-input"), tableBody = $("table-body"), tableCount = $("table-count");

function initFilters() {
  dateSelect.innerHTML = AVAILABLE_DATES.map((d) => '<option value="' + esc(d) + '">' + esc(d) + "</option>").join("");
  categoryFilter.innerHTML = '<option value="">All categories</option>' +
    INITIAL_CATEGORIES.map((c) => '<option value="' + esc(c.id) + '">' + esc(c.displayName) + "</option>").join("");
}

async function loadOpportunities(date) {
  tableBody.innerHTML = '<tr><td colspan="4"><div class="empty"><b>Loading</b>Reading this crawl date from KV.</div></td></tr>';
  try {
    const res = await fetch("/api/opportunities?date=" + encodeURIComponent(date || ""));
    ALL_OPPORTUNITIES = res.ok ? await res.json() : [];
    renderTable();
  } catch (err) {
    ALL_OPPORTUNITIES = [];
    tableCount.textContent = "0";
    tableBody.innerHTML = '<tr><td colspan="4"><div class="empty"><b>Could not load opportunities</b>' + esc(err.message) + "</div></td></tr>";
  }
}

function emptyState(title, sub) {
  tableCount.textContent = "0";
  tableBody.innerHTML = '<tr><td colspan="4"><div class="empty">' +
    '<svg class="i i--l"><use href="#i-inbox"/></svg><b>' + esc(title) + "</b>" + esc(sub) + "</div></td></tr>";
}

function deadlineCell(item) {
  if (!item.deadline) return '<div class="dl dl--none">&mdash;</div>';
  const d = days(item.deadline);
  const cls = d < 0 ? "dl--past" : d <= 7 ? "dl--near" : "";
  const rel = d < 0 ? Math.abs(d) + "d past" : d === 0 ? "today" : d + "d left";
  return '<div class="dl ' + cls + '">' + esc(item.deadline) + '<span class="dl__sub">' + rel + "</span></div>";
}

function checksBlock(item) {
  const list = item.eligibilityChecks || [];
  if (!list.length) return "";
  return list.map((c) => {
    const tone = c.verdict === "fail" ? (c.mode === "enforce" ? "bad" : "warn") : c.verdict === "pass" ? "good" : "idle";
    const mark = c.verdict === "pass" ? '<use href="#i-check-c"/>' : c.verdict === "fail" ? '<use href="#i-x-c"/>' : '<use href="#i-help-c"/>';
    return '<div class="chk__it chk--' + tone + '"><span class="chk__m"><svg class="i i--s">' + mark + "</svg></span>" +
      '<span><span class="chk__f">' + esc(c.field) + "</span> wants <span class='chk__r'>" + esc(c.requirement) + "</span> \\u2014 " + esc(c.reason) +
      (c.evidence ? ' <span class="chk__e">&ldquo;' + esc(c.evidence) + "&rdquo;</span>" : "") + "</span></div>";
  }).join("");
}

function detailHtml(item) {
  const meta = [];
  const put = (k, v) => { if (v) meta.push("<dt>" + esc(k) + "</dt><dd>" + esc(v) + "</dd>"); };
  put("Source", item.sourceName);
  put("Published", item.pubDate || "Recently added");
  put("Company", item.company);
  put("Region", item.region);
  put("Eligibility country", item.eligibilityCountry);
  put("Salary band", item.salaryBand);
  put("Deadline", item.deadline);
  put("Route", item.routeTo === "cold_email" ? "cold email" : item.routeTo === "none" ? "none" : item.routeTo);
  put("Apply URL", item.link);
  if (item.isOpportunity === false) meta.push("<dt>Note</dt><dd>Listed as news. No application path was found.</dd>");

  const kws = item.matchedKeywords || [];
  const kw = kws.length
    ? '<div class="chips">' + kws.slice(0, 14).map((k) => '<span class="chip chip--code">' + esc(k) + "</span>").join("") + "</div>"
    : '<div class="count">No keyword recorded for this item.</div>';

  const checks = checksBlock(item);

  return (meta.length ? '<dl class="dl-grid">' + meta.join("") + "</dl>" : "") +
    '<div class="rule"></div>' +
    '<div class="lbl">Matched keywords</div>' + kw +
    '<div class="rule"></div>' +
    '<div class="lbl">Requirements read from the apply page</div>' +
    (checks ? '<div class="chk">' + checks + "</div>" : '<div class="count">No eligibility detail was extracted.</div>');
}

// Detail HTML lives outside the table. A fifth hidden cell breaks
// table-layout:fixed, and a data attribute would need the same HTML escaped
// twice through two different parsers.
let DETAIL = {};

function openRow(tr) {
  openDrawer(tr.dataset.t || "Detail", DETAIL[tr.dataset.key] || '<div class="count">No detail recorded.</div>');
}

function renderTable() {
  const q = searchInput.value.trim();
  const cat = categoryFilter.value;
  const rows = ALL_OPPORTUNITIES.filter((i) => (!cat || i.categoryId === cat) && evaluateClientQuery(q, i));

  tableCount.textContent = String(rows.length);
  if (!rows.length) {
    emptyState("Nothing matches", q ? "No opportunity in this date satisfies that query." : "No opportunity was found for this date.");
    return;
  }

  const detail = {};
  tableBody.innerHTML = rows.map((item) => {
    const key = item.dedupeKey || "";
    const done = CONSUMED_KEYS.has(key);
    const elig = item.eligibility || "unknown";
    const tone = elig === "open" ? "good" : elig === "restricted" ? "bad" : "";
    const blocking = (item.eligibilityBlocking || []).length;
    const warnings = (item.eligibilityWarnings || []).length;
    const kw = (item.matchedKeywords || []).slice(0, 3);
    const extra = (item.matchedKeywords || []).length - kw.length;

    const chips =
      '<span class="chip chip--cat">' + esc(item.categoryName) + "</span>" +
      (elig !== "unknown" ? '<span class="chip' + (tone ? " chip--" + tone : "") + '"' +
        // esc() turns any quote in the evidence into &quot;, so this stays attribute-safe.
        (item.eligibilityEvidence ? ' title="' + esc(elig + ": " + item.eligibilityEvidence) + '"' : "") +
        ">" + esc(elig) + "</span>" : "") +
      (blocking ? '<span class="chip chip--bad"><svg class="i i--s"><use href="#i-lock"/></svg>' + blocking + " blocked</span>" : "") +
      (warnings ? '<span class="chip chip--warn"><svg class="i i--s"><use href="#i-warn"/></svg>' + warnings + " mismatch" + (warnings > 1 ? "es" : "") + "</span>" : "") +
      (item.salaryBand ? '<span class="chip">' + esc(item.salaryBand) + "</span>" : "") +
      (item.isOpportunity === false ? '<span class="chip">News, no application</span>' : "") +
      kw.map((k) => '<span class="chip chip--code">' + esc(k) + "</span>").join("") +
      (extra > 0 ? '<span class="chip">+' + extra + " more</span>" : "");

    // Feeds hand back RFC-2822 stamps. Showing one in full orphans the timezone
    // onto its own line, so keep the date and put the rest in the tooltip.
    const pub = String(item.pubDate || "").trim();
    const parsed = pub.match(/^\\w{3},\\s*(.+?)\\s+\\d{1,2}:\\d{2}/);
    const pubShort = parsed ? parsed[1] : pub;
    const src = '<div class="src">' + esc(item.sourceName) + "</div>" +
      (item.company || item.region || item.eligibilityCountry
        ? '<div class="src" style="color:var(--fg4)">' +
          [item.company, item.region, item.eligibilityCountry].filter(Boolean).map(esc).join(" \\u00b7 ") + "</div>"
        : "") +
      (pubShort
        ? '<div class="src" style="color:var(--fg4);white-space:nowrap;overflow:hidden;text-overflow:ellipsis"' +
          (pub !== pubShort ? ' title="' + esc(pub) + '"' : "") + ">" + esc(pubShort) + "</div>"
        : "");

    detail[key] = detailHtml(item);

    return '<tr tabindex="0" data-key="' + esc(key) + '" data-done="' + (done ? 1 : 0) + '"' +
      ' data-t="' + esc(item.title) + '">' +
      '<td><div class="ti">' +
        '<span class="ti__t">' +
          '<svg class="i i--s"><use href="#i-ext"/></svg>' + esc(item.company ? item.company + " \\u2014 " + item.title : item.title) +
        "</span>" +
        '<div class="ti__d">' + esc(item.description) + "</div>" +
        '<div class="ti__m">' + chips + "</div>" +
      "</div></td>" +
      '<td><div class="src">' + src + "</div></td>" +
      "<td>" + deadlineCell(item) + "</td>" +
      '<td><div class="acts">' +
        '<a class="apply' + (done ? " apply--done" : "") + '" href="' + safeUrl(item.link) + '" target="_blank" rel="noopener noreferrer">' +
          (done ? '<svg class="i i--s"><use href="#i-check"/></svg>Acted' : "Apply") +
          (done ? "" : '<svg class="i i--s"><use href="#i-ext"/></svg>') +
        "</a>" +
        (done ? "" : '<button type="button" class="btn btn--sm" data-mark="' + esc(key) + '">Mark acted</button>') +
      "</div></td>" +
    "</tr>";
  }).join("");
  DETAIL = detail;
}

tableBody.addEventListener("click", (e) => {
  const mark = e.target.closest("[data-mark]");
  if (mark) { e.stopPropagation(); return markActed(mark); }
  if (e.target.closest(".acts")) return;
  const tr = e.target.closest("tr[data-key]");
  if (tr) openRow(tr);
});
tableBody.addEventListener("keydown", (e) => {
  if (e.key !== "Enter" && e.key !== " ") return;
  const tr = e.target.closest("tr[data-key]");
  if (!tr) return;
  e.preventDefault();
  openRow(tr);
});

async function markActed(btn) {
  const key = btn.dataset.mark || "";
  btn.disabled = true;
  try {
    const res = await fetch("/api/consumed", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dedupeKey: key, title: "", company: "", categoryId: "" })
    });
    if (!res.ok) throw new Error("HTTP " + res.status);
    CONSUMED_KEYS.add(key);
    renderTable();
  } catch (err) {
    btn.disabled = false;
    btn.textContent = "Failed";
  }
}

searchInput.addEventListener("input", renderTable);
categoryFilter.addEventListener("change", renderTable);
dateSelect.addEventListener("change", () => loadOpportunities(dateSelect.value));

/* --------------------------------------------------------------- actions */
const logLine = (kind, text, detail) =>
  '<div class="log__l log__l--' + kind + '"><div><span class="log__t">' + esc(text) + "</span>" +
  (detail ? '<div class="log__d">' + esc(detail) + "</div>" : "") + "</div></div>";

function openLog(title) {
  openDrawer(title, '<div class="log">' + logLine("warn", "Working\\u2026") + "</div>");
}

$("btn-test-ping").addEventListener("click", async () => {
  openLog("Test alert");
  $("log-content").innerHTML = '<div class="log">' +
    logLine("warn", "Dispatching a test alert to " + (CURRENT_SETTINGS.notificationTarget || "auto_router") + "\\u2026") + "</div>";
  try {
    const res = await fetch("/test-alert");
    const data = await res.json();
    $("log-content").innerHTML = '<div class="log">' + logLine("ok", "Test response received") + "</div>" +
      '<pre style="margin-top:12px;color:var(--fg2)">' + esc(JSON.stringify(data, null, 2)) + "</pre>";
    loadQuotaStats();
  } catch (err) {
    $("log-content").innerHTML = '<div class="log">' + logLine("bad", "Test failed", err.message) + "</div>";
  }
});

async function triggerCrawl(dryRun) {
  openLog(dryRun ? "Preview matches" : "Crawl run");
  $("log-content").innerHTML = '<div class="log">' + logLine("warn", dryRun ? "Crawling without sending\\u2026" : "Crawling and sending\\u2026") + "</div>";
  try {
    const res = await fetch("/run" + (dryRun ? "?dryRun=true" : ""));
    const data = await res.json();
    const out = [];
    (data.summary || []).forEach((s) => out.push(logLine(
      s.sourcesFailed ? "warn" : "ok",
      s.category + ": fetched " + s.totalFetched + ", matched " + s.matchedCount + ", new " + s.unseenCount,
      s.sourcesFailed ? s.sourcesFailed + " source failed" : "")));
    (data.sourcesFailed || []).forEach((f) => out.push(logLine("bad", f.sourceName, f.reason)));
    if (data.kvErrors > 0) out.push(logLine("warn", data.kvErrors + " KV dedupe read error(s). Items were not dropped."));
    if (typeof data.pagesRead === "number") out.push(logLine("", "Read " + data.pagesRead + " apply page(s) for eligibility detail."));
    if (data.blockedByProfile > 0) out.push(logLine("bad", data.blockedByProfile + " item(s) blocked by an enforced eligibility parameter"));
    if (!dryRun) {
      out.push(logLine("hl", "Dispatched " + ((data.dispatched && data.dispatched.dispatchedCount) || 0) + " message(s)"));
      if (data.dispatched && data.dispatched.suppressed > 0) out.push(logLine("", data.dispatched.suppressed + " suppressed (no route, or restricted)"));
      if (data.dispatched && data.dispatched.providerUsed) out.push(logLine("ok", "Provider used: " + data.dispatched.providerUsed));
      ((data.dispatched && data.dispatched.blocked) || []).forEach((b) => out.push(logLine("bad", b.provider + " blocked until " + b.blockedUntil, b.reason)));
      ((data.dispatched && data.dispatched.errors) || []).forEach((e) => out.push(logLine("bad", "Dispatch error", e)));
      if (data.webhook) out.push(logLine(data.webhook.ok ? "ok" : data.webhook.skipped ? "" : "bad",
        "Webhook: " + (data.webhook.ok ? "pushed" : data.webhook.skipped ? "not configured" : data.webhook.error)));
    }
    $("log-content").innerHTML = '<div class="log">' + (out.length ? out.join("") : logLine("", "Crawl finished with no per-category summary.")) + "</div>";
    loadOpportunities(dateSelect.value);
    loadQuotaStats();
  } catch (err) {
    $("log-content").innerHTML = '<div class="log">' + logLine("bad", "Run failed", err.message) + "</div>";
  }
}

$("btn-dry-run").addEventListener("click", () => triggerCrawl(true));
$("btn-dry-run-2").addEventListener("click", () => triggerCrawl(true));
$("btn-run-live").addEventListener("click", () => triggerCrawl(false));

/* ------------------------------------------------------------------ boot */
initFilters();
populateSettingsForm();
populateEligibilityProfile();
loadOpportunities(dateSelect.value);
loadQuotaStats();
</script>
</body>
</html>`;
}
