// Skibidi Strike — shared owner/dev core (loaded by index.html, dev.html and owner-chat.html)
//
// ROLES: there are no owner/dev codes any more (they used to start as 000000, so anyone could get in).
// SS.role() now comes ONLY from a verified Google sign-in checked against data/roles.json (js/acct.js).
// No saved flag, link or code gives anyone owner or dev. Edits made in owner/dev mode still only
// change what THAT browser shows until a coder makes them live.
// The chats stay private for real: owner-chat.html can only read them with Amos's own
// GitHub key, and the chat files live in the private repo, never on the public site.
(function(w){
"use strict";

var K = {
  role: "ss_role",            // old code-based role flag: no longer trusted, removed on load
  site: "ss_site"              // every customization from the dev page (JSON)
};

function ls(){ try { return w.localStorage; } catch(e){ return null; } }
function get(k){ var s = ls(); return s ? s.getItem(k) : null; }
function set(k, v){ var s = ls(); if(s) s.setItem(k, v); }
function del(k){ var s = ls(); if(s) s.removeItem(k); }
function esc(s){
  return String(s == null ? "" : s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;");
}

// old code-based sign-in flags: never trusted again, so clean them off this browser
(function(){ ["ss_role", "ss_ownercode", "ss_devcode", "ss_codes_v2"].forEach(del); })();

// ---------- roles ----------
// "owner" | "dev" | null, from the Google sign-in (TTVM.state). Guests and members are null.
function role(){
  var T = w.TTVM, S = T && T.state;
  if(!S || !S.loaded || !S.session || S.restricted || !T.allowed || !T.allowed("staff")) return null;
  if(S.role === "owner") return "owner";
  if(S.role === "mod" || S.role === "dev") return "dev";
  return null;
}
function checkCode(){ return false; }   // codes are gone
function signIn(){}                       // roles come from Google sign-in only
function signOut(){ if(w.TTVM) w.TTVM.signOut(); }

// ---------- customizations ----------
// Every editable piece of text on the home page. Defaults are read from the live HTML,
// so nothing here goes stale when the page's words change.
var SECTIONS = [
  {id:"roadmap", name:"Roadmap"}, {id:"characters", name:"Characters"}, {id:"videos", name:"Videos"},
  {id:"music", name:"Music"}, {id:"credits", name:"Credits", lock:true}, {id:"community", name:"Community"}
];
var FIELDS = [
  {g:"hero", k:"pageTitle",   l:"Browser tab title", sel:"title"},
  {g:"hero", k:"logoMain",    l:"Logo (white part)", sel:"nav .logo", mode:"lead"},
  {g:"hero", k:"logoAccent",  l:"Logo (colored part)", sel:"nav .logo span"},
  {g:"hero", k:"heroEyebrow", l:"Small line above the title", sel:".hero .eyebrow"},
  {g:"hero", k:"heroTitle",   l:"Big title (new line = line break)", sel:".hero h1", mode:"br", multi:true},
  {g:"hero", k:"heroTag",     l:"Tagline under the title", sel:".hero .tag", multi:true},
  {g:"hero", k:"heroNote",    l:"Yellow note under the buttons", sel:"#playNote", multi:true},
  {g:"hero", k:"heroCredits", l:"Credit line at the bottom of the hero", sel:".hero-credits", multi:true},

  {g:"buttons", k:"btnNavPlay",  l:"PLAY button (top bar)", sel:"#playBtn"},
  {g:"buttons", k:"btnHeroPlay", l:"PLAY button (big menu)", sel:"#heroPlay"},
  {g:"buttons", k:"btnMenu2",    l:"Big menu button 2", sel:".menu-btns .mbtn", idx:1},
  {g:"buttons", k:"btnMenu3",    l:"Big menu button 3", sel:".menu-btns .mbtn", idx:2},
  {g:"buttons", k:"btnMenu4",    l:"Big menu button 4", sel:".menu-btns .mbtn", idx:3},
  {g:"buttons", k:"btnSideplay", l:"PLAY in the phone menu", sel:".sidemenu .sm-play"},
  {g:"buttons", k:"btnSend",     l:"Suggestion form send button", sel:"#sugSend"},

  {g:"text", k:"chTile1Who", l:"Characters · card 1 tag", sel:"#characters .tile .who", idx:0},
  {g:"text", k:"chTile1",    l:"Characters · card 1 name", sel:"#characters .tile h4", idx:0},
  {g:"text", k:"chTile1P",   l:"Characters · card 1 text", sel:"#characters .tile p", idx:0, multi:true},
  {g:"text", k:"chTile2Who", l:"Characters · card 2 tag", sel:"#characters .tile .who", idx:1},
  {g:"text", k:"chTile2",    l:"Characters · card 2 name", sel:"#characters .tile h4", idx:1},
  {g:"text", k:"chTile2P",   l:"Characters · card 2 text", sel:"#characters .tile p", idx:1, multi:true},
  {g:"text", k:"chTile3Who", l:"Characters · card 3 tag", sel:"#characters .tile .who", idx:2},
  {g:"text", k:"chTile3",    l:"Characters · card 3 name", sel:"#characters .tile h4", idx:2},
  {g:"text", k:"chTile3P",   l:"Characters · card 3 text", sel:"#characters .tile p", idx:2, multi:true},
  {g:"text", k:"vdTile1",    l:"Videos · card 1 name", sel:"#videos .tile h4", idx:0},
  {g:"text", k:"vdTile1P",   l:"Videos · card 1 text", sel:"#videos .tile p", idx:0, multi:true},
  {g:"text", k:"vdTile2",    l:"Videos · card 2 name", sel:"#videos .tile h4", idx:1},
  {g:"text", k:"vdTile2P",   l:"Videos · card 2 text", sel:"#videos .tile p", idx:1, multi:true},
  {g:"text", k:"vdTile3",    l:"Videos · card 3 name", sel:"#videos .tile h4", idx:2},
  {g:"text", k:"vdTile3P",   l:"Videos · card 3 text", sel:"#videos .tile p", idx:2, multi:true},
  {g:"text", k:"musicNote",  l:"Music · note", sel:"#music > p.note", multi:true},
  {g:"text", k:"creditsNote",l:"Credits · fan-made note", sel:"#credits > p.note", multi:true},
  {g:"text", k:"gameBy",     l:"Credits · Game by", sel:"#credits .wall > div:first-child dd"},
  {g:"text", k:"commIntro",  l:"Community · intro", sel:"#community > p.note", idx:0, multi:true},
  {g:"text", k:"commNote",   l:"Community · note under the form", sel:"#community > p.note", idx:1, multi:true},
  {g:"text", k:"footerLine", l:"Footer line", sel:"footer > div:nth-of-type(2)", multi:true},
  {g:"text", k:"finePrint",  l:"Fine print (tiny grey line)", sel:"footer .fineprint", multi:true}
];
SECTIONS.forEach(function(s){
  FIELDS.push({g:"sections", k:"nav_" + s.id, l:s.name + " · menu label", sel:'nav .links a[href="#' + s.id + '"], .sidemenu a[href="#' + s.id + '"]', all:true});
  FIELDS.push({g:"sections", k:"h_" + s.id, l:s.name + " · page heading", sel:"#" + s.id + " > h2", mode:"html2text"});
});

var THEME_DEFAULTS = {accent:"#ff3324", accent2:"#ffd933", bg:"#09090b"};
var PLAY_DEFAULTS = {
  soon: false,
  title: "NOT DONE YET",
  msg: "Skibidi Strike is still being built. The playable build lands the day it's ready, so check the roadmap for the latest updates.",
  tag: false,
  url: "play/"
};
var BANNER_DEFAULTS = {on:false, text:"", style:"accent", link:""};
var LINK_DEFAULTS = {
  youtube: "https://www.youtube.com/@Ttvm_studios_Official",
  tiktok: "https://www.tiktok.com/@ttvm_studios_official",
  discord: ""
};

function loadSite(){
  var o = null;
  try { o = JSON.parse(get(K.site) || "null"); } catch(e){}
  if(!o || typeof o !== "object") o = {};
  o.text = o.text || {}; o.hidden = o.hidden || []; o.order = o.order || [];
  o.theme = o.theme || {}; o.banner = o.banner || {}; o.play = o.play || {}; o.links = o.links || {};
  return o;
}
function isEmpty(o){
  return !Object.keys(o.text).length && !o.hidden.length && !o.order.length && !Object.keys(o.theme).length &&
    !Object.keys(o.banner).length && !Object.keys(o.play).length && !Object.keys(o.links).length;
}
function saveSite(o){ if(isEmpty(o)) del(K.site); else set(K.site, JSON.stringify(o)); }
function play(){ var p = loadSite().play, out = {}; for(var k in PLAY_DEFAULTS) out[k] = (k in p) ? p[k] : PLAY_DEFAULTS[k]; return out; }
function banner(){ var b = loadSite().banner, out = {}; for(var k in BANNER_DEFAULTS) out[k] = (k in b) ? b[k] : BANNER_DEFAULTS[k]; return out; }
function links(){ var b = loadSite().links, out = {}; for(var k in LINK_DEFAULTS) out[k] = (k in b) ? b[k] : LINK_DEFAULTS[k]; return out; }
function safeUrl(u){ u = String(u || "").trim(); return /^https?:\/\//i.test(u) ? u : ""; }

// read / write one field on a document
function nodes(doc, f){
  var list = doc.querySelectorAll(f.sel);
  if(f.all) return Array.prototype.slice.call(list);
  var n = list[f.idx || 0];
  return n ? [n] : [];
}
function readField(doc, f){
  var n = nodes(doc, f)[0]; if(!n) return null;
  if(f.mode === "lead"){ var t = n.firstChild; return (t && t.nodeType === 3) ? t.nodeValue.trim() : ""; }
  if(f.mode === "br"){ return n.innerHTML.replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, "").replace(/&amp;/g,"&").replace(/&lt;/g,"<").replace(/&gt;/g,">").replace(/&middot;/g,"\u00b7").trim(); }
  return n.textContent.replace(/\s+/g, " ").trim();
}
function writeField(doc, f, v){
  nodes(doc, f).forEach(function(n){
    if(f.mode === "lead"){
      var t = n.firstChild;
      if(t && t.nodeType === 3) t.nodeValue = v + " "; else n.insertBefore(doc.createTextNode(v + " "), n.firstChild);
    } else if(f.mode === "br"){
      n.innerHTML = esc(v).replace(/\n/g, "<br>");
    } else {
      n.textContent = v;
    }
  });
}
function defaultsFrom(doc){ var d = {}; FIELDS.forEach(function(f){ var v = readField(doc, f); if(v !== null) d[f.k] = v; }); return d; }

// ---------- apply everything to the home page ----------
var captured = null;   // live defaults, read once before the first change
function applySite(doc){
  doc = doc || w.document;
  if(!doc.getElementById("play")) return;      // home page only
  var o = loadSite();
  if(!captured){
    captured = {text: defaultsFrom(doc), order: {}};
    ["nav .links", ".sidemenu"].forEach(function(sel){
      var box = doc.querySelector(sel); if(box) captured.order[sel] = Array.prototype.slice.call(box.children);
    });
    captured.sections = Array.prototype.slice.call(doc.querySelectorAll("section.page"));
  }
  // text
  FIELDS.forEach(function(f){
    if(!(f.k in captured.text)) return;
    var v = Object.prototype.hasOwnProperty.call(o.text, f.k) ? String(o.text[f.k]) : captured.text[f.k];
    if(readField(doc, f) !== v) writeField(doc, f, v);
  });
  // order (menus + sections)
  var order = o.order.length ? o.order.slice() : SECTIONS.map(function(s){ return s.id; });
  SECTIONS.forEach(function(s){ if(order.indexOf(s.id) < 0) order.push(s.id); });
  function rank(el){
    // links marked data-pin (Games -> the TTVM Studios games page) always stay at the top
    if(el.hasAttribute && el.hasAttribute("data-pin")) return -1;
    var h = (el.getAttribute && (el.getAttribute("href") || "")) || "", id = el.id || h.slice(1);
    var i = order.indexOf(id); return i < 0 ? 999 : i;
  }
  for(var sel in captured.order){
    var box = doc.querySelector(sel), kids = captured.order[sel].slice();
    kids.sort(function(a, b){ return rank(a) - rank(b) || captured.order[sel].indexOf(a) - captured.order[sel].indexOf(b); });
    kids.forEach(function(k){ box.appendChild(k); });
  }
  var foot = doc.querySelector("footer");
  if(foot){
    var secs = captured.sections.slice().sort(function(a, b){ return rank(a) - rank(b); });
    secs.forEach(function(s){ foot.parentNode.insertBefore(s, foot); });
  }
  // hidden sections
  SECTIONS.forEach(function(s){
    var off = !s.lock && o.hidden.indexOf(s.id) >= 0;
    var els = [doc.getElementById(s.id)].concat(Array.prototype.slice.call(doc.querySelectorAll('a[href="#' + s.id + '"]')));
    els.forEach(function(el){ if(el && !(el.closest && el.closest(".ss-keep"))) el.classList.toggle("ss-off", off); });
  });
  // theme
  var root = doc.documentElement;
  ["accent", "accent2", "bg"].forEach(function(k){
    var v = o.theme[k];
    if(v && /^#[0-9a-f]{3,8}$/i.test(v)) root.style.setProperty("--" + k, v); else root.style.removeProperty("--" + k);
  });
  // links
  var L = links();
  Array.prototype.forEach.call(doc.querySelectorAll('a[href*="youtube.com/"]'), function(a){ if(safeUrl(L.youtube)) a.href = L.youtube; });
  Array.prototype.forEach.call(doc.querySelectorAll('a[href*="tiktok.com/"]'), function(a){ if(safeUrl(L.tiktok)) a.href = L.tiktok; });
  var dUrl = safeUrl(L.discord), fd = doc.getElementById("ssDiscordFoot"), cd = doc.getElementById("ssDiscordComm");
  if(dUrl){
    var firstFoot = doc.querySelector("footer > div");
    if(!fd && firstFoot){ fd = doc.createElement("span"); fd.id = "ssDiscordFoot"; firstFoot.appendChild(fd); }
    if(fd) fd.innerHTML = ' &middot; <a href="' + esc(dUrl) + '" target="_blank" rel="noopener">Discord</a>';
    var comm = doc.getElementById("community");
    if(!cd && comm){ cd = doc.createElement("p"); cd.id = "ssDiscordComm"; cd.className = "ss-discord"; var h2 = comm.querySelector("h2"); comm.insertBefore(cd, h2 ? h2.nextSibling : comm.firstChild); }
    if(cd) cd.innerHTML = '<a class="btn primary" href="' + esc(dUrl) + '" target="_blank" rel="noopener">JOIN THE DISCORD</a>';
  } else { if(fd) fd.remove(); if(cd) cd.remove(); }
  // PLAY "soon" tag
  var P = play();
  ["heroPlay"].forEach(function(id){
    var b = doc.getElementById(id); if(!b) return;
    var tag = b.querySelector(".ss-soon");
    if(P.soon && P.tag){ if(!tag){ tag = doc.createElement("span"); tag.className = "ss-soon"; tag.textContent = "SOON"; b.appendChild(tag); } }
    else if(tag) tag.remove();
  });
  // announcement banner
  var B = banner(), bar = doc.getElementById("ssBanner");
  var dismissed = false; try { dismissed = w.sessionStorage.getItem("ss_banner_x") === String(B.text); } catch(e){}
  if(B.on && String(B.text).trim() && !dismissed){
    if(!bar){
      bar = doc.createElement("div"); bar.id = "ssBanner"; bar.setAttribute("role", "status");
      doc.body.insertBefore(bar, doc.body.firstChild);
    }
    bar.className = "ss-banner ss-banner-" + (/^(accent|gold|red|green)$/.test(B.style) ? B.style : "accent");
    var u = safeUrl(B.link);
    bar.innerHTML = (u ? '<a href="' + esc(u) + '" target="_blank" rel="noopener">' + esc(B.text) + ' &rarr;</a>' : '<span>' + esc(B.text) + '</span>') +
      '<button type="button" aria-label="Hide">&times;</button>';
    bar.querySelector("button").onclick = function(){ try { w.sessionStorage.setItem("ss_banner_x", String(B.text)); } catch(e){} applySite(doc); };
    doc.body.classList.add("ss-banner-on");
  } else {
    if(bar) bar.remove();
    doc.body.classList.remove("ss-banner-on");
  }
  badge(doc);
}

// small DEV / OWNER badge on the site, only on a signed-in browser
function badge(doc){
  doc = doc || w.document;
  var r = role(), b = doc.getElementById("ssBadge");
  if(!r || doc.body.classList.contains("dv-body") || /[?&]preview=1/.test(w.location.search)){ if(b) b.remove(); return; }
  if(!b){ b = doc.createElement("a"); b.id = "ssBadge"; b.href = "dev.html"; doc.body.appendChild(b); }
  b.className = "ss-badge ss-badge-" + r;
  b.textContent = r === "owner" ? "OWNER" : "DEV";
  b.title = (r === "owner" ? "Owner mode" : "Dev mode") + " is on. Tap to open the dev page.";
}

w.SS = {
  KEYS: K, SECTIONS: SECTIONS, FIELDS: FIELDS,
  THEME_DEFAULTS: THEME_DEFAULTS, PLAY_DEFAULTS: PLAY_DEFAULTS, BANNER_DEFAULTS: BANNER_DEFAULTS, LINK_DEFAULTS: LINK_DEFAULTS,
  role: role, checkCode: checkCode, signIn: signIn, signOut: signOut,
  loadSite: loadSite, saveSite: saveSite, play: play, banner: banner, links: links, safeUrl: safeUrl,
  readField: readField, defaultsFrom: defaultsFrom, applySite: applySite, badge: badge, esc: esc
};
})(window);
