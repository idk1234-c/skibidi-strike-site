// Skibidi Strike — dev page (owner + dev mode)
// Everything here saves in THIS browser (localStorage) and shows on this browser's copy of the site.
// "Export changes" turns it into a note a coder (UTC Studios) can apply to make it live for everyone.
// Who can open it: ONLY a Google-signed-in owner / moderator / dev from data/roles.json (see js/acct.js).
// There are no codes any more. Everyone else sees the lock card instead of this page.
(function(){
"use strict";

function $(id){ return document.getElementById(id); }
var esc = SS.esc;
var DEFAULTS = null;            // live text of the home page (read from index.html)
var role = null;
var LS = window.localStorage;

var GROUPS = [
  {g:"hero",     title:"Site title & hero",   desc:"The big first screen: logo, title, tagline and notes."},
  {g:"buttons",  title:"Button labels",       desc:"What the buttons say."},
  {g:"text",     title:"Page text",           desc:"Character cards, video cards, notes, footer and fine print."}
];
var PRESETS = [
  {n:"Default",   accent:"#ff3324", accent2:"#ffd933", bg:"#09090b"},
  {n:"Toilet gold", accent:"#ffb800", accent2:"#ffffff", bg:"#0b0904"},
  {n:"Red alert", accent:"#ff3b30", accent2:"#ffd23f", bg:"#0d0707"},
  {n:"Toxic",     accent:"#39ff7a", accent2:"#d4ff3f", bg:"#060d08"},
  {n:"Purple",    accent:"#a66bff", accent2:"#ff6bd6", bg:"#09070f"}
];

// ---------- small helpers ----------
var toastT;
function toast(msg){ var t = $("dvToast"); t.textContent = msg; t.classList.add("on"); clearTimeout(toastT); toastT = setTimeout(function(){ t.classList.remove("on"); }, 1800); }
var prevT;
function refreshPreview(){
  clearTimeout(prevT);
  prevT = setTimeout(function(){
    var f = $("dvFrame");
    try { if(f && f.contentWindow && f.contentWindow.ssRefresh) f.contentWindow.ssRefresh(); } catch(e){}
  }, 150);
}
function changed(msg){ refreshPreview(); markEdited(); if(msg) toast(msg); }
function getJSON(k){ try { var v = LS.getItem(k); return v ? JSON.parse(v) : null; } catch(e){ return null; } }
function fieldDefault(k){ return DEFAULTS && (k in DEFAULTS) ? DEFAULTS[k] : ""; }
function fieldsOf(g){ return SS.FIELDS.filter(function(f){ return f.g === g; }); }
function edits(){ return SS.loadSite(); }
function card(id, title, desc, body, opts){
  opts = opts || {};
  return '<details class="dv-card' + (opts.owner ? ' owner-only' : '') + '" id="card-' + id + '"' + (opts.open ? ' open' : '') + '>' +
    '<summary><span class="dv-card-t">' + esc(title) + (opts.owner ? ' <i class="dv-tag-owner">OWNER</i>' : '') + '</span><i class="dv-dot" data-dot="' + id + '" hidden></i><span class="dv-chev" aria-hidden="true"></span></summary>' +
    '<div class="dv-card-b">' + (desc ? '<p class="dv-desc">' + esc(desc) + '</p>' : '') + body + '</div></details>';
}
function toggle(id, label, on, hint){
  return '<label class="dv-toggle"><input type="checkbox" id="' + id + '"' + (on ? ' checked' : '') + '><span class="dv-sw" aria-hidden="true"></span><span><b>' + esc(label) + '</b>' + (hint ? '<small>' + esc(hint) + '</small>' : '') + '</span></label>';
}
function inputRow(id, label, value, opts){
  opts = opts || {};
  var tag = opts.multi ? '<textarea id="' + id + '" rows="' + (opts.rows || 2) + '"' : '<input type="' + (opts.type || "text") + '" id="' + id + '"';
  var attrs = (opts.ph != null ? ' placeholder="' + esc(opts.ph) + '"' : '') + (opts.data ? ' data-k="' + esc(opts.data) + '"' : '') + ' spellcheck="' + (opts.spell ? 'true' : 'false') + '"';
  var el = opts.multi ? tag + attrs + '>' + esc(value) + '</textarea>' : tag + attrs + ' value="' + esc(value) + '">';
  return '<label class="dv-field"><span>' + esc(label) + (opts.data ? ' <i class="dv-edited" data-ed="' + esc(opts.data) + '" hidden>edited</i>' : '') + '</span>' + el + '</label>';
}

// ---------- text fields ----------
function textGroupBody(g){
  var o = edits(), h = "";
  fieldsOf(g).forEach(function(f){
    var has = Object.prototype.hasOwnProperty.call(o.text, f.k);
    h += inputRow("tf_" + f.k, f.l, has ? o.text[f.k] : fieldDefault(f.k), {multi: f.multi, data: f.k, ph: fieldDefault(f.k) || "(live text)", spell: true});
  });
  return h + '<div class="dv-row"><button type="button" class="dv-ghost" data-reset-group="' + g + '">Reset this section</button></div>';
}
function onTextInput(el){
  var k = el.getAttribute("data-k"), o = edits(), v = el.value;
  if(v === fieldDefault(k) || (!DEFAULTS && v === "")) delete o.text[k]; else o.text[k] = v;
  SS.saveSite(o); changed();
}

// ---------- sections ----------
function sectionOrder(){
  var o = edits(), order = o.order.length ? o.order.slice() : SS.SECTIONS.map(function(s){ return s.id; });
  SS.SECTIONS.forEach(function(s){ if(order.indexOf(s.id) < 0) order.push(s.id); });
  return order.filter(function(id){ return SS.SECTIONS.some(function(s){ return s.id === id; }); });
}
function sectionsBody(){
  var o = edits(), order = sectionOrder(), h = '<ol class="dv-secs">';
  order.forEach(function(id, i){
    var s = SS.SECTIONS.filter(function(x){ return x.id === id; })[0];
    var off = o.hidden.indexOf(id) >= 0;
    h += '<li class="' + (off ? 'off' : '') + '"><span class="dv-sec-n">' + esc(s.name) + (s.lock ? '<small>always on (has the Owner button)</small>' : '') + '</span>' +
      '<button type="button" class="dv-icon" data-move="' + id + '" data-dir="-1" aria-label="Move ' + esc(s.name) + ' up"' + (i === 0 ? ' disabled' : '') + '>&uarr;</button>' +
      '<button type="button" class="dv-icon" data-move="' + id + '" data-dir="1" aria-label="Move ' + esc(s.name) + ' down"' + (i === order.length - 1 ? ' disabled' : '') + '>&darr;</button>' +
      (s.lock ? '<span class="dv-icon dv-icon-spacer"></span>' : '<button type="button" class="dv-pill' + (off ? '' : ' on') + '" data-show="' + id + '">' + (off ? 'Hidden' : 'Shown') + '</button>') + '</li>';
  });
  h += '</ol><p class="dv-small">Order changes the menu order. Hidden sections disappear from the menus too.</p>';
  h += '<h4 class="dv-sub">Menu labels &amp; headings</h4>';
  fieldsOf("sections").forEach(function(f){
    var has = Object.prototype.hasOwnProperty.call(o.text, f.k);
    h += inputRow("tf_" + f.k, f.l, has ? o.text[f.k] : fieldDefault(f.k), {data: f.k, ph: fieldDefault(f.k)});
  });
  return '<div id="secBox">' + h + '</div><div class="dv-row"><button type="button" class="dv-ghost" id="secReset">Reset this section</button></div>';
}
function rerenderSections(){ var b = $("card-sections").querySelector(".dv-card-b"); b.innerHTML = '<p class="dv-desc">Show, hide or reorder the pages of the site.</p>' + sectionsBody(); markEdited(); }

// ---------- play / banner / theme / links ----------
function playBody(){
  var P = SS.play();
  return toggle("plSoon", "PLAY says it's not done yet", P.soon, "Tapping PLAY shows a \"coming soon\" popup") +
    inputRow("plTitle", "Popup title", P.title, {ph: SS.PLAY_DEFAULTS.title}) +
    inputRow("plMsg", "Popup message", P.msg, {multi: true, rows: 3, ph: SS.PLAY_DEFAULTS.msg, spell: true}) +
    toggle("plTag", "Show a SOON tag on the PLAY buttons", P.tag) +
    inputRow("plUrl", "Game link (used when \"not done yet\" is OFF)", P.url, {type: "text", ph: "play/ (the game page) or https://..."}) +
    '<div class="dv-row"><button type="button" class="dv-btn" id="plTest">Try PLAY in the preview</button><button type="button" class="dv-ghost" data-reset="play">Reset</button></div>';
}
function bannerBody(){
  var B = SS.banner();
  var styles = [["accent","Blue"],["gold","Gold"],["red","Red"],["green","Green"]];
  var h = toggle("bnOn", "Show the banner", B.on, "A strip across the top of the site") +
    inputRow("bnText", "Banner text", B.text, {ph: "e.g. Update 1.2 drops Friday!", spell: true}) +
    '<div class="dv-field"><span>Color</span><div class="dv-chips" id="bnStyles">';
  styles.forEach(function(s){ h += '<button type="button" class="dv-chip bn-' + s[0] + (B.style === s[0] ? ' on' : '') + '" data-style="' + s[0] + '">' + s[1] + '</button>'; });
  return h + '</div></div>' + inputRow("bnLink", "Link when tapped (optional)", B.link, {type: "url", ph: "https://..."}) +
    '<div class="dv-row"><button type="button" class="dv-ghost" data-reset="banner">Reset</button></div>';
}
function themeBody(){
  var t = edits().theme, h = '<div class="dv-chips" id="thPresets">';
  PRESETS.forEach(function(p, i){
    h += '<button type="button" class="dv-chip dv-preset" data-preset="' + i + '"><i style="background:' + p.accent + '"></i><i style="background:' + p.accent2 + '"></i>' + esc(p.n) + '</button>';
  });
  h += '</div><div class="dv-colors">';
  [["accent","Main color"],["accent2","Highlight color"],["bg","Background"]].forEach(function(c){
    h += '<label class="dv-color"><input type="color" id="th_' + c[0] + '" value="' + esc(t[c[0]] || SS.THEME_DEFAULTS[c[0]]) + '"><span>' + c[1] + '</span></label>';
  });
  return h + '</div><div class="dv-row"><button type="button" class="dv-ghost" data-reset="theme">Reset</button></div>';
}
function linksBody(){
  var L = SS.links();
  return inputRow("lkYoutube", "YouTube", L.youtube, {type: "url", ph: SS.LINK_DEFAULTS.youtube}) +
    inputRow("lkTiktok", "TikTok", L.tiktok, {type: "url", ph: SS.LINK_DEFAULTS.tiktok}) +
    inputRow("lkDiscord", "Discord invite (shows a Discord link + button when filled in)", L.discord, {type: "url", ph: "https://discord.gg/..."}) +
    '<p class="dv-small">Links must start with https://</p><div class="dv-row"><button type="button" class="dv-ghost" data-reset="links">Reset</button></div>';
}

// ---------- roadmap / credits ----------
function listToText(list, withDate){ return (list || []).map(function(r){ return (withDate ? (r.d || "") + " | " : "") + (r.t || "") + " | " + (r.b || ""); }).join("\n"); }
function textToList(txt, withDate){
  var out = [];
  String(txt).split("\n").forEach(function(line){
    if(!line.trim()) return;
    var p = line.split("|").map(function(x){ return x.trim(); });
    if(withDate){ if(p.length >= 3) out.push({d:p[0], t:p[1], b:p.slice(2).join(" | ")}); }
    else if(p.length >= 2) out.push({t:p[0], b:p.slice(1).join(" | ")});
    else if(p[0]) out.push({t:p[0], b:""});
  });
  return out;
}
function roadmapBody(){
  return '<label class="dv-field"><span>Shipped <small>(date | title | description)</small></span><textarea id="rmShip" rows="7" class="mono" spellcheck="false">' + esc(listToText(getRoadmap(), true)) + '</textarea></label>' +
    '<label class="dv-field"><span>In progress <small>(title | description)</small></span><textarea id="rmProg" rows="5" class="mono" spellcheck="false">' + esc(listToText(getProgress(), false)) + '</textarea></label>' +
    '<label class="dv-field"><span>Coming next <small>(title | description)</small></span><textarea id="rmNext" rows="5" class="mono" spellcheck="false">' + esc(listToText(getNext(), false)) + '</textarea></label>' +
    '<p class="dv-small">One entry per line.</p><div class="dv-row"><button type="button" class="dv-btn" id="rmApply">Apply</button><button type="button" class="dv-ghost" id="rmReset">Reset to live</button></div>';
}
function creditsBody(){
  return '<label class="dv-field"><span>One person per line <small>(name | what they did)</small></span><textarea id="crText" rows="5" class="mono" spellcheck="false">' + esc(creditsToText()) + '</textarea></label>' +
    '<div class="dv-row"><button type="button" class="dv-btn" id="crApply">Apply credits</button><button type="button" class="dv-ghost" id="crReset">Reset to live</button></div>';
}

// ---------- owner tools ----------
function ownerBody(){
  var hasKey = !!LS.getItem("ss_chat_token");
  return '<div class="dv-row"><a class="dv-btn" id="devChats" href="owner-chat.html">Open chats</a></div>' +
    '<p class="dv-small">Chat key: ' + (hasKey ? '<b class="ok">saved on this device</b> <button type="button" class="dv-link" id="ownForgetKey">forget it</button>' : 'not saved yet (the chats page asks for it)') + '</p>' +
    '<h4 class="dv-sub">Voice-to-text fixes</h4>' +
    '<p class="dv-small">The mic in the chats cleans up what it hears: capital letters, periods, removes "um" and repeated words, and fixes these mishears. One per line: <b>what it hears =&gt; what you meant</b></p>' +
    '<textarea id="vcDict" rows="9" class="mono" spellcheck="false">' + esc(SSVoice.loadDict()) + '</textarea>' +
    '<div class="dv-row"><button type="button" class="dv-btn" id="vcSave">Save fixes</button><button type="button" class="dv-ghost" id="vcReset">Reset</button></div>' +
    inputRow("vcTry", "Try it: type something messy", "um so i want the dave mode to like like show the chat", {multi: true, rows: 2}) +
    '<div class="dv-try" id="vcOut"></div>';
}

// ---------- export ----------
function exportText(){
  var o = edits(), lines = [], when = new Date().toLocaleString();
  function q(s){ return '"' + String(s).replace(/\n/g, " / ") + '"'; }
  Object.keys(o.text).forEach(function(k){
    var f = SS.FIELDS.filter(function(x){ return x.k === k; })[0]; if(!f) return;
    lines.push("- " + f.l + ": " + q(o.text[k]) + (DEFAULTS && k in DEFAULTS ? "  (was " + q(DEFAULTS[k]) + ")" : ""));
  });
  if(o.order.length) lines.push("- Section order: " + sectionOrder().join(", "));
  if(o.hidden.length) lines.push("- Hidden sections: " + o.hidden.join(", "));
  if(Object.keys(o.theme).length) lines.push("- Colors: " + Object.keys(o.theme).map(function(k){ return k + " " + o.theme[k]; }).join(", "));
  if(Object.keys(o.play).length){ var P = SS.play(); lines.push("- PLAY button: " + (P.soon ? "shows \"not done yet\" popup, title " + q(P.title) + ", message " + q(P.msg) : "goes to " + (P.url || "play/ (the game page)")) + (P.tag ? ", SOON tag on" : "")); }
  if(Object.keys(o.banner).length){ var B = SS.banner(); lines.push("- Banner: " + (B.on ? "ON, " + q(B.text) + " (" + B.style + (B.link ? ", links to " + B.link : "") + ")" : "off")); }
  if(Object.keys(o.links).length){ var L = SS.links(); lines.push("- Links: YouTube " + L.youtube + ", TikTok " + L.tiktok + (L.discord ? ", Discord " + L.discord : "")); }
  var rm = getJSON("ss_roadmap"), pg = getJSON("ss_progress"), nx = getJSON("ss_next"), cr = getJSON("ss_credits");
  if(rm) lines.push("- Roadmap (shipped) changed: " + rm.length + " entries (full list in the JSON)");
  if(pg) lines.push("- Roadmap (in progress) changed: " + pg.length + " entries");
  if(nx) lines.push("- Roadmap (coming next) changed: " + nx.length + " entries");
  if(cr) lines.push("- Credits: " + cr.map(function(c){ return c.n + " (" + c.r + ")"; }).join(", "));
  if(!lines.length) return "";
  var data = {version: 1, from: role === "owner" ? "Amos (owner mode)" : "dev mode", made: new Date().toISOString(), site: o};
  if(rm) data.roadmap = rm; if(pg) data.inProgress = pg; if(nx) data.comingNext = nx; if(cr) data.credits = cr;
  return "Skibidi Strike site changes from " + data.from + " (" + when + ")\n" +
    "Please make these live for everyone on the site:\n\n" + lines.join("\n") +
    "\n\nFor the coder: this JSON is exactly what the dev page saved (localStorage ss_site, ss_roadmap, ss_progress, ss_next, ss_credits).\n" +
    JSON.stringify(data, null, 2);
}
function exportBody(){
  return '<p class="dv-desc">Everything above only shows on <b>this</b> device. To make it live for everyone: tap <b>Copy changes</b>, then paste it to UTC Studios (in the chats or wherever you talk to him) and say "make these live".</p>' +
    '<textarea id="exText" rows="8" class="mono" readonly></textarea>' +
    '<div class="dv-row"><button type="button" class="dv-btn" id="exCopy">Copy changes</button><button type="button" class="dv-ghost danger" id="exClear">Undo ALL my changes</button></div>';
}
function refreshExport(){ var t = $("exText"); if(t){ var v = exportText(); t.value = v || "No changes yet. Edit something above and it shows up here."; } }

// ---------- mode card ----------
function modeCard(){
  var owner = role === "owner";
  return '<div class="dv-hero ' + (owner ? 'is-owner' : 'is-dev') + '">' +
    '<div class="dv-hero-t"><h1>DEV MODE</h1><span class="dv-badge big ' + role + '">' + (owner ? 'OWNER' : 'DEV') + '</span></div>' +
    '<p class="dv-desc">' + (owner ? 'You\'re in <b>Owner mode</b>: every tool, plus the chats and owner tools.' : 'You\'re in <b>Dev mode</b>: you can customize the whole site. Chats and owner tools are owner-only.') + ' Changes show on this device right away.</p>' +
    '<div class="dv-modes"><div class="dv-mode' + (!owner ? ' on' : '') + '"><b>DEV</b><span>Customize the site</span></div><div class="dv-mode' + (owner ? ' on' : '') + '"><b>OWNER</b><span>Everything + chats</span></div></div>' +
    (owner ? '<div class="dv-row"><button type="button" class="dv-ghost" id="toDev">Switch to Dev mode</button></div>'
           : (window.TTVM && TTVM.state.realRole === "owner" ? '<div class="dv-row"><button type="button" class="dv-btn" id="toOwner">Switch to Owner mode</button></div>' : '')) +
    '<div class="dv-row"><a class="dv-ghost" href="index.html">View site</a><button type="button" class="dv-ghost" id="signOut">Sign out</button></div>' +
    '</div>';
}

function render(){
  role = SS.role();
  var b = $("dvBadge");
  if(!role || !$("dvApp")) return;   // locked: acct.js shows the lock card instead
  $("dvApp").hidden = false;
  b.hidden = false; b.className = "dv-badge " + role; b.textContent = role === "owner" ? "OWNER" : "DEV";
  document.body.classList.toggle("is-owner", role === "owner");
  var h = modeCard();
  h += card("play", "PLAY button", "Make PLAY say the game isn't done yet.", playBody(), {open: true});
  h += card("banner", "Announcement banner", "A strip across the top of the site.", bannerBody());
  GROUPS.forEach(function(G){ h += card(G.g, G.title, G.desc, textGroupBody(G.g)); });
  h += card("sections", "Sections", "Show, hide or reorder the pages of the site.", sectionsBody());
  h += card("theme", "Colors", "Pick a look or set your own colors.", themeBody());
  h += card("links", "Links", "", linksBody());
  h += card("roadmap", "Roadmap", "", roadmapBody());
  h += card("credits", "Credits", "People who helped make this happen.", creditsBody());
  if(role === "owner") h += card("owner", "Owner tools", "Only you can see these.", ownerBody(), {owner: true});
  h += card("export", "Export changes", "", exportBody(), {open: true});
  $("dvMain").innerHTML = h;
  if(role === "owner") tryVoice();
  refreshExport(); markEdited();
}

// edited dots on each card
function markEdited(){
  var o = edits(), dirty = {};
  Object.keys(o.text).forEach(function(k){ var f = SS.FIELDS.filter(function(x){ return x.k === k; })[0]; if(f) dirty[f.g] = 1; });
  if(o.order.length || o.hidden.length) dirty.sections = 1;
  ["play", "banner", "theme", "links"].forEach(function(k){ if(Object.keys(o[k]).length) dirty[k] = 1; });
  if(LS.getItem("ss_roadmap") || LS.getItem("ss_progress") || LS.getItem("ss_next")) dirty.roadmap = 1;
  if(LS.getItem("ss_credits")) dirty.credits = 1;
  if(LS.getItem(SSVoice.DICT_KEY) != null) dirty.owner = 1;
  Array.prototype.forEach.call(document.querySelectorAll("[data-dot]"), function(d){ d.hidden = !dirty[d.getAttribute("data-dot")]; });
  Array.prototype.forEach.call(document.querySelectorAll("[data-ed]"), function(d){ d.hidden = !Object.prototype.hasOwnProperty.call(o.text, d.getAttribute("data-ed")); });
  refreshExport();
}

function tryVoice(){ var i = $("vcTry"), o = $("vcOut"); if(i && o) o.textContent = SSVoice.clean(i.value, $("vcDict").value) || " "; }

function setObj(part, key, val, isDefault){
  var o = edits();
  if(isDefault) delete o[part][key]; else o[part][key] = val;
  SS.saveSite(o); changed();
}
function resetPart(part){
  var o = edits();
  if(part === "sections"){ o.order = []; o.hidden = []; fieldsOf("sections").forEach(function(f){ delete o.text[f.k]; }); }
  else o[part] = {};
  SS.saveSite(o); render(); refreshPreview(); toast("Reset");
  var c = $("card-" + part); if(c) c.open = true;
}

function copy(text){
  if(navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(text);
  return new Promise(function(res, rej){
    var t = document.createElement("textarea"); t.value = text; t.setAttribute("readonly", ""); t.style.position = "fixed"; t.style.opacity = "0";
    document.body.appendChild(t); t.select(); t.setSelectionRange(0, text.length);
    try { document.execCommand("copy") ? res() : rej(); } catch(e){ rej(e); }
    t.remove();
  });
}

// ---------- preview ----------
function loadFrame(){ var f = $("dvFrame"); if(!f.getAttribute("src")) f.setAttribute("src", "index.html?preview=1"); }
function wide(){ return window.matchMedia("(min-width:1100px)").matches; }

// ---------- events ----------
function start(){

  var main = $("dvMain");
  main.addEventListener("input", function(ev){
    var t = ev.target, id = t.id;
    if(t.hasAttribute("data-k")) return onTextInput(t);
    if(id === "plTitle") return setObj("play", "title", t.value, t.value === SS.PLAY_DEFAULTS.title);
    if(id === "plMsg") return setObj("play", "msg", t.value, t.value === SS.PLAY_DEFAULTS.msg);
    if(id === "plUrl") return setObj("play", "url", t.value.trim(), !t.value.trim());
    if(id === "bnText") return setObj("banner", "text", t.value, !t.value);
    if(id === "bnLink") return setObj("banner", "link", t.value.trim(), !t.value.trim());
    if(id === "lkYoutube") return setObj("links", "youtube", t.value.trim(), t.value.trim() === SS.LINK_DEFAULTS.youtube || !t.value.trim());
    if(id === "lkTiktok") return setObj("links", "tiktok", t.value.trim(), t.value.trim() === SS.LINK_DEFAULTS.tiktok || !t.value.trim());
    if(id === "lkDiscord") return setObj("links", "discord", t.value.trim(), !t.value.trim());
    if(id && id.indexOf("th_") === 0){ var k = id.slice(3); return setObj("theme", k, t.value, t.value.toLowerCase() === SS.THEME_DEFAULTS[k]); }
    if(id === "vcTry" || id === "vcDict") return tryVoice();
  });
  main.addEventListener("change", function(ev){
    var t = ev.target, id = t.id;
    if(id === "plSoon") return setObj("play", "soon", t.checked, t.checked === SS.PLAY_DEFAULTS.soon);
    if(id === "plTag") return setObj("play", "tag", t.checked, !t.checked);
    if(id === "bnOn") return setObj("banner", "on", t.checked, !t.checked);
  });
  main.addEventListener("submit", function(ev){
    var f = ev.target; ev.preventDefault();
  });
  main.addEventListener("click", function(ev){
    var t = ev.target.closest("button, a"); if(!t) return;
    var id = t.id;
    if(t.hasAttribute("data-reset-group")){
      var g = t.getAttribute("data-reset-group"), o = edits();
      fieldsOf(g).forEach(function(f){ delete o.text[f.k]; }); SS.saveSite(o);
      fieldsOf(g).forEach(function(f){ var el = $("tf_" + f.k); if(el) el.value = fieldDefault(f.k); });
      changed("Reset"); return;
    }
    if(t.hasAttribute("data-reset")) return resetPart(t.getAttribute("data-reset"));
    if(id === "secReset") return resetPart("sections");
    if(t.hasAttribute("data-move")){
      var order = sectionOrder(), sid = t.getAttribute("data-move"), i = order.indexOf(sid), j = i + Number(t.getAttribute("data-dir"));
      if(j < 0 || j >= order.length) return;
      order.splice(i, 1); order.splice(j, 0, sid);
      var o2 = edits(), def = SS.SECTIONS.map(function(s){ return s.id; }).join();
      o2.order = order.join() === def ? [] : order; SS.saveSite(o2); rerenderSections(); refreshPreview(); return;
    }
    if(t.hasAttribute("data-show")){
      var o3 = edits(), s = t.getAttribute("data-show"), at = o3.hidden.indexOf(s);
      if(at >= 0) o3.hidden.splice(at, 1); else o3.hidden.push(s);
      SS.saveSite(o3); rerenderSections(); refreshPreview(); return;
    }
    if(t.hasAttribute("data-style")){
      setObj("banner", "style", t.getAttribute("data-style"), t.getAttribute("data-style") === SS.BANNER_DEFAULTS.style);
      Array.prototype.forEach.call(document.querySelectorAll("#bnStyles .dv-chip"), function(c){ c.classList.toggle("on", c === t); });
      return;
    }
    if(t.hasAttribute("data-preset")){
      var p = PRESETS[Number(t.getAttribute("data-preset"))], o4 = edits();
      o4.theme = {}; if(p.n !== "Default"){ o4.theme = {accent: p.accent, accent2: p.accent2, bg: p.bg}; }
      SS.saveSite(o4);
      ["accent", "accent2", "bg"].forEach(function(k){ $("th_" + k).value = p[k]; });
      changed(p.n + " colors"); return;
    }
    if(id === "plTest"){
      openPreview();
      setTimeout(function(){ try { var w = $("dvFrame").contentWindow; w.ssRefresh(); w.playNote(); } catch(e){} }, 700);
      return;
    }
    if(id === "rmApply"){
      LS.setItem("ss_roadmap", JSON.stringify(textToList($("rmShip").value, true)));
      LS.setItem("ss_progress", JSON.stringify(textToList($("rmProg").value, false)));
      LS.setItem("ss_next", JSON.stringify(textToList($("rmNext").value, false)));
      $("rmShip").value = listToText(getRoadmap(), true); $("rmProg").value = listToText(getProgress(), false); $("rmNext").value = listToText(getNext(), false);
      changed("Roadmap applied"); return;
    }
    if(id === "rmReset"){
      ["ss_roadmap", "ss_progress", "ss_next"].forEach(function(k){ LS.removeItem(k); });
      $("rmShip").value = listToText(getRoadmap(), true); $("rmProg").value = listToText(getProgress(), false); $("rmNext").value = listToText(getNext(), false);
      changed("Roadmap reset"); return;
    }
    if(id === "crApply"){ LS.setItem("ss_credits", JSON.stringify(textToCredits($("crText").value))); $("crText").value = creditsToText(); changed("Credits applied"); return; }
    if(id === "crReset"){ LS.removeItem("ss_credits"); $("crText").value = creditsToText(); changed("Credits reset"); return; }
    if(id === "vcSave"){ SSVoice.saveDict($("vcDict").value); changed("Voice fixes saved"); return; }
    if(id === "vcReset"){ SSVoice.saveDict(null); $("vcDict").value = SSVoice.DEFAULT_DICT; tryVoice(); changed("Voice fixes reset"); return; }
    if(id === "ownForgetKey"){ if(confirm("Forget the chat key on this device?")){ LS.removeItem("ss_chat_token"); render(); } return; }
    if(id === "exCopy"){
      var txt = exportText();
      if(!txt){ toast("No changes to copy yet"); return; }
      copy(txt).then(function(){ toast("Copied! Paste it to UTC Studios"); }, function(){ $("exText").select(); toast("Select all + copy"); });
      return;
    }
    if(id === "exClear"){
      if(!confirm("Undo ALL your site changes on this device? (Your chat key stays.)")) return;
      ["ss_site", "ss_roadmap", "ss_progress", "ss_next", "ss_credits"].forEach(function(k){ LS.removeItem(k); });
      render(); refreshPreview(); toast("All changes undone"); return;
    }
    if(id === "toDev"){ TTVM.setMode("dev"); toast("Dev mode on"); window.scrollTo(0, 0); return; }
    if(id === "toOwner"){ TTVM.setMode("owner"); toast("Owner mode on"); window.scrollTo(0, 0); return; }
    if(id === "signOut"){ TTVM.signOut(); window.location.href = "index.html"; return; }
  });

  function openPreview(){ loadFrame(); $("dvPreview").classList.add("open"); document.body.classList.add("dv-noscroll"); }
  window.__dvOpenPreview = openPreview;
  $("dvPreviewOpen").addEventListener("click", openPreview);
  $("dvPreviewClose").addEventListener("click", function(){ $("dvPreview").classList.remove("open"); document.body.classList.remove("dv-noscroll"); });
  $("dvFrame").addEventListener("load", refreshPreview);

  // live defaults straight from the home page, so the editors always start from the real text
  render();
  if(SS.role() && wide()) loadFrame();
  fetch("index.html", {cache: "no-store"}).then(function(r){ return r.text(); }).then(function(html){
    DEFAULTS = SS.defaultsFrom(new DOMParser().parseFromString(html, "text/html"));
    if(SS.role()){
      var open = Array.prototype.map.call(document.querySelectorAll(".dv-card[open]"), function(d){ return d.id; });
      render();
      open.forEach(function(id){ var d = $(id); if(d) d.open = true; });
    }
  }).catch(function(){});
}

// start only once acct.js has checked the Google sign-in against data/roles.json
var started = false;
function boot(){
  if(!window.TTVM) return;
  TTVM.on(function(){
    if(!TTVM.allowed("staff")) return;
    if(!started){ started = true; start(); }
    else { render(); refreshPreview(); }
  });
}
if(document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();
})();
