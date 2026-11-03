/* TTVM Studios — anonymous visit counter (v1).
 * Counts visits so we can make the games better: a random guest number kept in this browser
 * (like "Guest-7F3A9C"), pages opened, where the visit came from (just the site name, like youtube),
 * device type, system, browser, screen size, touch, and play time. No names or emails from guests,
 * no IP addresses, nothing else about the device. Signed-in members show with their account name.
 */
(function(w, d){
"use strict";
if(w.ttvmVisit) return;
var API = "https://ttvm-stats.sites.tab.bot/v";
var SCRIPT = d.currentScript;
var ROOT = SCRIPT ? new URL("../", SCRIPT.src).pathname : "/";
var GAME = SCRIPT && SCRIPT.getAttribute("data-game");
var LS = null; try { LS = w.localStorage; LS.setItem("ttvm_t", "1"); LS.removeItem("ttvm_t"); } catch(e){ LS = null; }
var mem = {};
function lget(k){ try { return LS ? LS.getItem(k) : (mem[k] || null); } catch(e){ return mem[k] || null; } }
function lset(k, v){ try { if(LS){ if(v == null) LS.removeItem(k); else LS.setItem(k, v); } else mem[k] = v; } catch(e){ mem[k] = v; } }
function hex(n){
  var a = new Uint8Array(n), s = "";
  try { w.crypto.getRandomValues(a); } catch(e){ for(var i = 0; i < n; i++) a[i] = Math.floor(Math.random() * 256); }
  for(var j = 0; j < n; j++) s += ("0" + a[j].toString(16)).slice(-2);
  return s.toUpperCase();
}
function now(){ return Date.now(); }

// ---------- who (anonymous) ----------
var gid = lget("ttvm_guest");
if(!/^Guest-[0-9A-F]{4,8}$/.test(gid || "")){ gid = "Guest-" + hex(3); lset("ttvm_guest", gid); }
var vis = null; try { vis = JSON.parse(lget("ttvm_visit") || "null"); } catch(e){}
var fresh = !vis || !vis.id || now() - (vis.last || 0) > 30 * 60000;
if(fresh) vis = {id: "V" + hex(8), last: now()};
function touchVisit(){ vis.last = now(); lset("ttvm_visit", JSON.stringify(vis)); }
touchVisit();

// ---------- device (from the browser's own description, nothing more) ----------
var ua = navigator.userAgent || "", tp = navigator.maxTouchPoints || 0;
var touch = tp > 0 || "ontouchstart" in w;
var iPadDesk = /Macintosh/.test(ua) && tp > 1;
var device = /iPad/.test(ua) || iPadDesk || (/Android/.test(ua) && !/Mobile/.test(ua)) || /Tablet|Silk|Kindle/.test(ua) ? "tablet"
  : /iPhone|iPod|Android|Mobile|Windows Phone/.test(ua) ? "phone" : "desktop";
var os = /iPhone|iPod/.test(ua) ? "iOS" : (/iPad/.test(ua) || iPadDesk) ? "iPadOS" : /Android/.test(ua) ? "Android" : /CrOS/.test(ua) ? "ChromeOS"
  : /Windows/.test(ua) ? "Windows" : /Mac OS X|Macintosh/.test(ua) ? "macOS" : /Linux/.test(ua) ? "Linux" : "Other";
var browser = /BytedanceWebview|musical_ly|TikTok/i.test(ua) ? "TikTok app" : /Instagram/.test(ua) ? "Instagram app" : /FBAN|FBAV|FB_IAB/.test(ua) ? "Facebook app"
  : /Snapchat/.test(ua) ? "Snapchat app" : /Discord/.test(ua) ? "Discord app" : /YouTube|com\.google\.ios\.youtube/i.test(ua) ? "YouTube app"
  : /Edg(e|A|iOS)?\//.test(ua) ? "Edge" : /OPR\/|Opera/.test(ua) ? "Opera" : /SamsungBrowser/.test(ua) ? "Samsung Internet"
  : /CriOS/.test(ua) ? "Chrome" : /FxiOS|Firefox/.test(ua) ? "Firefox" : /Chrome|Chromium/.test(ua) ? "Chrome" : /Safari/.test(ua) ? "Safari" : "Other";

// ---------- where from (site name only) ----------
function refName(){
  var q = location.search, m = /[?&](?:utm_source|ref|src)=([^&#]+)/i.exec(q);
  if(m) return decodeURIComponent(m[1]).toLowerCase().replace(/[^a-z0-9._-]/g, "").slice(0, 30) || "link";
  var host = "";
  try { if(d.referrer) host = new URL(d.referrer).hostname.toLowerCase(); } catch(e){}
  if(host && host === location.hostname) return "";
  if(!host){ return /app$/.test(browser) ? browser.replace(" app", "").toLowerCase() + " (app)" : "direct"; }
  var map = [[/youtube\.|youtu\.be/, "youtube"], [/tiktok\./, "tiktok"], [/google\./, "google"], [/bing\./, "bing"], [/duckduckgo/, "duckduckgo"], [/discord/, "discord"],
    [/instagram\./, "instagram"], [/facebook\.|fb\.com|fb\.me/, "facebook"], [/reddit\./, "reddit"], [/(^|\.)x\.com$|twitter\.|t\.co$/, "x / twitter"],
    [/roblox\./, "roblox"], [/github\./, "github"], [/snapchat\./, "snapchat"], [/yahoo\./, "yahoo"]];
  for(var i = 0; i < map.length; i++) if(map[i][0].test(host)) return map[i][1];
  return host.replace(/^www\./, "").slice(0, 30);
}
function pageName(){
  var p = location.pathname;
  if(p.indexOf(ROOT) === 0) p = "/" + p.slice(ROOT.length);
  return p.replace(/index\.html$/, "").replace(/\.html$/, "").slice(0, 60) || "/";
}

// ---------- signed-in name (members only; guests stay anonymous) ----------
var acct = lget("ttvm_vacct"), staff = lget("ttvm_vstaff") === "1";

// ---------- sending ----------
var chain = null;
function body(o){ o.gid = gid; o.vid = vis.id; if(staff) o.staff = 1; return JSON.stringify(o); }
function post(o){
  var s = body(o);
  try {
    return fetch(API, {method: "POST", body: s, headers: {"Content-Type": "text/plain;charset=UTF-8"}, keepalive: true, mode: "cors", credentials: "omit"})
      .then(function(){}, function(){});
  } catch(e){ return Promise.resolve(); }
}
function send(o){ chain = (chain || Promise.resolve()).then(function(){ return post(o); }); return chain; }
function beacon(o){
  var s = body(o);
  try { if(navigator.sendBeacon && navigator.sendBeacon(API, new Blob([s], {type: "text/plain;charset=UTF-8"}))) return; } catch(e){}
  post(o);
}

var view = {k: "view", page: pageName()};
view.device = device; view.os = os; view.browser = browser; view.touch = touch ? 1 : 0;
if(fresh){
  view.ref = refName(); view.device = device; view.os = os; view.browser = browser; view.touch = touch ? 1 : 0;
  try { view.sw = Math.round(screen.width); view.sh = Math.round(screen.height); } catch(e){}
  try { view.lang = (navigator.language || "").slice(0, 12); } catch(e){}
}
if(acct) view.acct = acct;
send(view);

function watchAccount(){
  var T = w.TTVM; if(!T || !T.on) return;
  var sentFor = null;
  T.on(function(S){
    if(!S || !S.loaded) return;
    if(S.session){
      var name = String(S.session.name || "Member").slice(0, 40), st = (T.RANK && T.RANK[S.realRole] >= 2) || false;
      lset("ttvm_vacct", name); lset("ttvm_vstaff", st ? "1" : null); acct = name; staff = st;
      if(sentFor !== name){ sentFor = name; send({k: "acct", acct: name}); }
    } else { lset("ttvm_vacct", null); lset("ttvm_vstaff", null); acct = null; staff = false; }
  });
}
if(d.readyState === "loading") d.addEventListener("DOMContentLoaded", watchAccount); else setTimeout(watchAccount, 0);

// clicked Play (links to a game's play page)
d.addEventListener("click", function(e){
  var a = e.target && e.target.closest ? e.target.closest("a[href]") : null; if(!a) return;
  var u; try { u = new URL(a.getAttribute("href"), location.href); } catch(err){ return; }
  if(u.hostname !== location.hostname) return;
  var p = u.pathname;
  var g = /\/games\/blockworld\/play\/?(index\.html)?$/.test(p) ? "blockworld" : (p === ROOT + "play/" || p === ROOT + "play" || p === ROOT + "play/index.html") ? "skibidi" : null;
  if(g) send({k: "click", game: g});
}, true);

// ---------- game pages: started, loaded / failed, seconds played ----------
var play = null;
function startPlay(game){
  if(play || !game) return;
  play = {pid: "P" + hex(8), game: game, t0: now(), ok: false, failed: false, acc: 0, tick: null};
  send({k: "play", pid: play.pid, game: game, device: device});
}
function flush(useBeacon){
  if(!play || !play.acc) return;
  var add = Math.min(65, Math.round(play.acc)); play.acc = 0;
  var o = {k: useBeacon ? "leave" : "hb", pid: play.pid, add: add};
  if(useBeacon) beacon(o); else send(o);
}
function ok(){
  if(!play || play.ok || play.failed) return;
  play.ok = true;
  send({k: "ok", pid: play.pid, load_s: Math.round((now() - play.t0) / 100) / 10});
  var last = now();
  play.tick = setInterval(function(){
    var t = now(), dt = (t - last) / 1000; last = t;
    if(d.visibilityState === "visible" && dt > 0 && dt < 5) play.acc += dt;
    if(play.acc >= 30) flush(false);
  }, 1000);
}
function fail(why){
  if(!play || play.failed) return;
  if(play.ok){ flush(false); clearInterval(play.tick); }
  play.failed = true;
  send({k: "fail", pid: play.pid, why: String(why || "error").slice(0, 120)});
}
d.addEventListener("visibilitychange", function(){ if(d.visibilityState === "hidden"){ flush(true); touchVisit(); } });
w.addEventListener("pagehide", function(){ flush(true); if(!play) beacon({k: "leave"}); touchVisit(); });

w.ttvmVisit = {play: startPlay, ok: ok, fail: fail, guest: function(){ return gid; }};
if(GAME) startPlay(GAME);
})(window, document);
