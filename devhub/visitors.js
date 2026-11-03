/* Dev hub: Visitors (owner only). Numbers come from the site's visit counter, which only
 * answers a signed-in owner (checked on the counter's server with the Google sign-in). */
(function(){
"use strict";
var API = "https://ttvm-stats.sites.tab.bot/stats";
var T = window.TTVM, esc = T.esc, $ = function(id){ return document.getElementById(id); };
var range = "7d", staff = false, lastCred = null, busy = false;
var GAME = {skibidi: "Skibidi Strike", blockworld: "Blockworld"};
var DEV_ICON = {phone: "\ud83d\udcf1", tablet: "\ud83d\udcf2", desktop: "\ud83d\udcbb"};
var COL = {phone: "#ff3324", tablet: "#ffd933", desktop: "#6fb3ff"};

function pct(a, b){ return b ? Math.round(100 * a / b) + "%" : "0%"; }
function dur(s){
  s = Math.round(s || 0); if(s < 60) return s + "s";
  var m = Math.floor(s / 60), r = s % 60; if(m < 60) return m + "m" + (r ? " " + r + "s" : "");
  var h = Math.floor(m / 60); return h + "h " + (m % 60) + "m";
}
function list(rows, key, emptyTxt){
  if(!rows || !rows.length) return '<p class="vs-note">' + (emptyTxt || "Nothing yet.") + '</p>';
  return '<ul class="vs-list">' + rows.map(function(r){ return '<li><span>' + esc(r[key]) + '</span><span>' + r.n + '</span></li>'; }).join("") + '</ul>';
}

function load(){
  var S = T.state; if(!S.session || !T.allowed("owner") || busy) return;
  busy = true; lastCred = S.session.cred;
  var tz = -new Date().getTimezoneOffset();
  fetch(API + "?range=" + range + "&tz=" + tz + (staff ? "&staff=1" : ""), {headers: {"Authorization": "Bearer " + S.session.cred}, cache: "no-store"})
    .then(function(r){ return r.json().then(function(j){ j._status = r.status; return j; }); })
    .then(function(j){
      busy = false;
      if(!j.ok){ needSignIn(j.error); return; }
      render(j);
    })
    .catch(function(){ busy = false; $("vsBody").innerHTML = '<div class="ac-card"><p>Couldn\'t reach the visit counter. Check your connection and tap &#x21bb;.</p></div>'; });
}
function needSignIn(err){
  var msg = err === "owner" ? "This Google account isn't an owner." : "Google needs you to sign in again before it shows the numbers (sign-ins get refreshed every few weeks).";
  $("vsBody").innerHTML = '<div class="ac-card"><p>' + esc(msg) + '</p><div id="vsG" style="margin-top:10px"></div></div>';
  if(err !== "owner") T.renderGoogleButton($("vsG"), {width: 260});
}

function render(j){
  var t = j.totals || {}, visits = t.visits || 0;
  var h = '<div class="vs-tiles">' +
    '<div class="vs-tile"><b>' + (t.uniq || 0) + '</b><span>visitors (people)</span></div>' +
    '<div class="vs-tile"><b>' + visits + '</b><span>visits</span></div>' +
    '<div class="vs-tile"><b>' + (t.views || 0) + '</b><span>pages opened</span></div>' +
    '<div class="vs-tile"><b>' + dur((t.avg_ms || 0) / 1000) + '</b><span>average visit</span></div></div>';

  // devices
  var ph = t.phone || 0, tb = t.tablet || 0, dk = t.desktop || 0;
  h += '<div class="vs-grid"><section class="ac-card"><h2 class="ac-h2">Devices</h2>' +
    '<div class="vs-dev">' + (visits ? '<i style="width:' + pct(ph, visits) + ';background:' + COL.phone + '"></i><i style="width:' + pct(tb, visits) + ';background:' + COL.tablet + '"></i><i style="width:' + pct(dk, visits) + ';background:' + COL.desktop + '"></i>' : "") + '</div>' +
    '<div class="vs-leg"><span><em style="background:' + COL.phone + '"></em>Phone ' + pct(ph, visits) + ' (' + ph + ')</span><span><em style="background:' + COL.tablet + '"></em>Tablet ' + pct(tb, visits) + ' (' + tb + ')</span><span><em style="background:' + COL.desktop + '"></em>Computer ' + pct(dk, visits) + ' (' + dk + ')</span></div>' +
    '<p class="vs-note">Touch screen: ' + pct(t.touch || 0, visits) + ' of visits</p>';
  var days = (j.days || []).slice().reverse();
  if(days.length > 1){
    var mx = Math.max.apply(null, days.map(function(x){ return x.visits; })) || 1;
    h += '<p class="vs-note" style="margin-top:14px">Visits per day (last 2 weeks)</p><div class="vs-days">' + days.map(function(x){ return '<div title="' + esc(x.day + ": " + x.visits + " visits, " + x.uniq + " people") + '" style="height:' + Math.max(3, Math.round(100 * x.visits / mx)) + '%"></div>'; }).join("") + '</div>';
  }
  h += '</section>';

  // games
  var games = {};
  (j.games || []).forEach(function(r){
    var g = games[r.game] || (games[r.game] = {rows: [], n: 0, ok: 0, fail: 0, stuck: 0, secs: 0, players: 0});
    g.rows.push(r); g.n += r.n; g.ok += r.ok || 0; g.fail += r.fail || 0; g.stuck += r.stuck || 0; g.secs += r.secs || 0;
  });
  h += '<section class="ac-card"><h2 class="ac-h2">Games</h2>';
  var any = false;
  ["skibidi", "blockworld"].forEach(function(k){
    var g = games[k], clicks = (j.clicks || {})[k] || 0;
    if(!g && !clicks) return; any = true;
    g = g || {rows: [], n: 0, ok: 0, fail: 0, stuck: 0, secs: 0};
    h += '<h3 style="margin:10px 0 4px;font:600 17px var(--ac-ui)">' + GAME[k] + '</h3>' +
      '<p class="vs-note" style="margin:0 0 6px">' + clicks + ' Play taps &middot; ' + g.n + ' game starts &middot; ' + g.ok + ' loaded &middot; <span class="vs-bad">' + g.fail + ' failed</span> &middot; <span class="vs-mid">' + g.stuck + ' left while loading</span><br>Average play: <b style="color:#fff">' + dur(g.ok ? g.secs / g.ok : 0) + '</b> &middot; total ' + dur(g.secs) + '</p>';
    h += '<table class="vs-t"><tr><th>Device</th><th class="n">Starts</th><th class="n">Loaded</th><th class="n">Failed</th><th class="n">Left loading</th><th class="n">Avg play</th></tr>' +
      g.rows.sort(function(a, b){ return b.n - a.n; }).map(function(r){
        return '<tr><td>' + DEV_ICON[r.device] + ' ' + esc(r.device) + '</td><td class="n">' + r.n + '</td><td class="n">' + (r.ok || 0) + (r.load_s ? ' <span class="vs-note">(' + Math.round(r.load_s) + 's)</span>' : "") + '</td><td class="n">' + (r.fail || 0) + '</td><td class="n">' + (r.stuck || 0) + '</td><td class="n">' + dur(r.ok ? r.secs / r.ok : 0) + '</td></tr>';
      }).join("") + '</table>';
  });
  if(!any) h += '<p class="vs-note">Nobody has started a game in this time yet.</p>';
  h += '<p class="vs-note">"Left while loading" = the game was still downloading when they closed it. "(14s)" = average load time.</p></section>';

  // fails, refs, countries, browsers
  h += '<section class="ac-card"><h2 class="ac-h2">Game failures + crashes</h2>' +
    ((j.fails || []).length ? '<ul class="vs-list">' + j.fails.map(function(r){ return '<li><span>' + DEV_ICON[r.device] + ' ' + esc(r.why) + '</span><span>' + r.n + '</span></li>'; }).join("") + '</ul>' : '<p class="vs-note">No failed game loads. \ud83c\udf89</p>') + '</section>';
  h += '<section class="ac-card"><h2 class="ac-h2">Where they came from</h2>' + list(j.refs, "ref") + '</section>';
  h += '<section class="ac-card"><h2 class="ac-h2">Browser / system</h2>' + list(j.browsers, "b") + '<p class="vs-note">"TikTok app" / "YouTube app" = opened inside that app\'s own browser.</p></section>';
  h += '<section class="ac-card"><h2 class="ac-h2">Countries</h2>' + list(j.countries, "country") + '</section></div>';

  // recent visitors
  var byVid = {};
  (j.plays || []).forEach(function(p){ (byVid[p.vid] = byVid[p.vid] || []).push(p); });
  h += '<section class="ac-card" style="margin-top:12px"><h2 class="ac-h2">Recent visitors</h2>';
  if(!(j.recent || []).length) h += '<p class="vs-note">No visits in this time yet.</p>';
  else h += '<ul class="vs-rec">' + j.recent.map(function(v){
    var pages = []; try { pages = JSON.parse(v.pages || "[]"); } catch(e){}
    var plays = (byVid[v.vid] || []).map(function(p){
      var st = p.status === "ok" ? '<span class="vs-ok">played ' + dur(p.secs) + '</span>' + (p.load_s ? ' <span class="vs-note">(loaded in ' + Math.round(p.load_s) + 's)</span>' : "")
        : p.status === "fail" && /^crash/.test(p.why || "") ? '<span class="vs-bad">crashed' + (p.secs ? ' after ' + dur(p.secs) : "") + '</span> <span class="vs-note">' + esc(p.why || "") + '</span>'
        : p.status === "fail" ? '<span class="vs-bad">failed to load</span> <span class="vs-note">' + esc(p.why || "") + '</span>' : '<span class="vs-mid">left while loading</span>';
      return '<div class="pl">\ud83c\udfae ' + esc(GAME[p.game] || p.game) + ': ' + st + '</div>';
    }).join("");
    var who = v.acct ? esc(v.acct) + ' <span class="vs-note">(' + esc(v.gid) + ')</span>' : esc(v.gid);
    return '<li><div class="who">' + (DEV_ICON[v.device] || "") + ' ' + who + (v.staff ? '<span class="vs-staff">STUDIO</span>' : "") + '</div>' +
      '<div class="meta">' + esc(T.when(v.ts)) + ' &middot; stayed ' + dur((v.last - v.ts) / 1000) + ' &middot; ' + esc([v.device, v.os, v.browser].filter(Boolean).join(" \u00b7 ")) + (v.sw ? ' &middot; ' + v.sw + "\u00d7" + v.sh : "") + (v.country ? ' &middot; ' + esc(v.country) : "") + ' &middot; from ' + esc(v.ref || "direct") + '</div>' +
      '<div class="pg">' + pages.map(esc).join(" \u2192 ") + '</div>' + plays + '</li>';
  }).join("") + '</ul>';
  h += '<p class="vs-note">Guests are a random number kept in their browser (no names, emails or IP addresses). The same person on another device or browser counts as a new visitor.</p></section>';
  $("vsBody").innerHTML = h;
}

Array.prototype.forEach.call(document.querySelectorAll(".vs-pill[data-r]"), function(b){
  b.onclick = function(){ range = b.getAttribute("data-r"); Array.prototype.forEach.call(document.querySelectorAll(".vs-pill[data-r]"), function(x){ x.classList.toggle("on", x === b); }); load(); };
});
$("vsReload").onclick = load;
$("vsStaff").onchange = function(){ staff = this.checked; load(); };
T.on(function(S){ if(S.loaded && S.session && S.session.cred !== lastCred) load(); });
})();
