/* TTVM Studios accounts — the profile chip, Google sign-in, roles, warnings and bans.
 *
 * Loaded on every page (after js/auth-config.js). Everything is a static site on GitHub Pages:
 *  - Sign-in is "Sign in with Google" (no extra service). The session lives in this browser.
 *  - Roles, warnings and bans live in data/roles.json and data/moderation.json in the repo.
 *    Only people who can push to the repo (with a GitHub key) can change them.
 *  - A banned / paused account becomes a restricted Guest: it can read the updates and roadmap,
 *    but can't play, chat, post or edit its profile.
 * Honest limit: the checks run in the visitor's browser, so a person who knows how can get around
 * them on their own screen. What they can never do is change roles, warnings or bans for anyone.
 */
(function(w, d){
"use strict";

var SCRIPT = d.currentScript;
var ROOT = SCRIPT ? new URL("../", SCRIPT.src).href : (location.origin + "/");
var CLIENT_ID = String(w.GOOGLE_CLIENT_ID || "");
var READY = w.AUTH_READY === true && /\.apps\.googleusercontent\.com$/.test(CLIENT_ID) && !/PASTE/.test(CLIENT_ID);
var REPO_PRIVATE = {repo:"idk1234-c/skibidi-strike", dir:"website/data/"};
var REPO_PUBLIC  = {repo:"idk1234-c/skibidi-strike-site", dir:"data/"};
var TOKEN_KEY = "ss_chat_token";           // same GitHub key the chats page uses
var K = {session:"ttvm_session", mode:"ttvm_mode", seen:"ttvm_seen", warnSeen:"ttvm_warn_seen", local:"ttvm_profile_", demo:"ttvm_demo", demoDb:"ttvm_demo_db", restrict:"ttvm_restricted"};

var RANK = {guest:0, user:1, dev:2, mod:3, owner:4};
var ROLE_NAME = {guest:"Guest", user:"Member", dev:"Dev", mod:"Moderator", owner:"Owner"};
var BANNERS = ["#000000","#1b1b22","#3a0d0b","#ff3324","#ffd933","#0f2a44","#123d1c","#2c1440","#4d596b"];

// ---------- small helpers ----------
function store(t){ try { return t === "s" ? w.sessionStorage : w.localStorage; } catch(e){ return null; } }
function get(k, t){ var s = store(t); try { return s ? JSON.parse(s.getItem(k)) : null; } catch(e){ return null; } }
function put(k, v, t){ var s = store(t); if(!s) return; try { if(v == null) s.removeItem(k); else s.setItem(k, JSON.stringify(v)); } catch(e){} }
function esc(s){ return String(s == null ? "" : s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;"); }
function ms(x){ if(!x) return 0; var t = typeof x === "number" ? x : Date.parse(x); return isNaN(t) ? 0 : t; }
function now(){ return Date.now(); }
function iso(t){ return new Date(t == null ? now() : t).toISOString(); }
function initials(n){ n = String(n || "?").trim(); var p = n.split(/\s+/); return ((p[0] || "?")[0] + (p.length > 1 ? p[p.length-1][0] : "")).toUpperCase(); }
function hue(s){ var h = 0; s = String(s || ""); for(var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 360; return h; }
function when(t){
  t = ms(t); if(!t) return "never";
  var dlt = now() - t, m = Math.round(dlt / 60000);
  if(dlt < 0){ return "on " + new Date(t).toLocaleString([], {month:"short", day:"numeric", hour:"numeric", minute:"2-digit"}); }
  if(m < 2) return "just now"; if(m < 60) return m + " min ago";
  var h = Math.round(m / 60); if(h < 24) return h + (h === 1 ? " hour ago" : " hours ago");
  var dd = Math.round(h / 24); if(dd < 8) return dd + (dd === 1 ? " day ago" : " days ago");
  return new Date(t).toLocaleDateString([], {month:"short", day:"numeric", year: dd > 300 ? "numeric" : undefined});
}
function until(t){
  if(!t) return "until the owner lifts it";
  return "until " + new Date(ms(t)).toLocaleString([], {weekday:"short", month:"short", day:"numeric", hour:"numeric", minute:"2-digit"});
}
function maskEmail(e){ e = String(e || ""); var a = e.split("@"); if(a.length !== 2) return ""; var u = a[0]; return (u.slice(0, 2) + "\u2022\u2022\u2022" + (u.length > 4 ? u.slice(-1) : "")) + "@" + a[1]; }
function sha(text){
  if(!(w.crypto && w.crypto.subtle && w.TextEncoder)) return Promise.reject(new Error("no crypto"));
  return w.crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)).then(function(buf){
    return Array.prototype.map.call(new Uint8Array(buf), function(b){ return ("0" + b.toString(16)).slice(-2); }).join("");
  });
}
function emailHash(email){ return sha("ttvm|" + String(email || "").trim().toLowerCase()); }

// ---------- preview mode (?demo=owner|mod|dev|user|restricted) — only while sign-in is off ----------
var DEMO = null;
(function(){
  if(READY){ put(K.demo, null, "s"); return; }
  var m = /[?&]demo=([a-z]+)/.exec(location.search);
  if(m){ if(m[1] === "off") { put(K.demo, null, "s"); put(K.demoDb, null, "s"); } else if(m[1] in RANK || m[1] === "restricted") put(K.demo, m[1], "s"); }
  DEMO = get(K.demo, "s");
  if(DEMO === "guest") DEMO = null;
})();
var DEMO_PEOPLE = {
  owner:{h:"demo-amos", name:"Amos", email:"owner@example.com"},
  mod:{h:"demo-utc", name:"UTC Studios", email:"utc@example.com"},
  dev:{h:"demo-titan", name:"Titan TV Man", email:"titan@example.com"},
  user:{h:"demo-cam", name:"CameraFan22", email:"cam@example.com"},
  restricted:{h:"demo-rex", name:"RexToilet", email:"rex@example.com"}
};
function demoDb(){
  var db = get(K.demoDb, "s"); if(db) return db;
  var t = now(), H = 3600e3, D = 24 * H, day = function(n){ return new Date(t - n * D).toISOString().slice(0, 10); };
  function days(arr){ var o = {}; arr.forEach(function(c, i){ if(c) o[day(i)] = c; }); return o; }
  db = {
    roles:{owners:[{h:"demo-amos", name:"Amos", hint:"am\u2022\u2022\u2022@gmail.com"}], mods:[{h:"demo-utc", name:"UTC Studios", hint:"ut\u2022\u2022\u2022@gmail.com"}], devs:[{h:"demo-titan", name:"Titan TV Man", hint:"ti\u2022\u2022\u2022@gmail.com"}, {h:"demo-block", name:"BlockBuilder", hint:"bl\u2022\u2022\u2022@gmail.com"}]},
    moderation:{people:{
      "demo-cam":{name:"CameraFan22", hint:"ca\u2022\u2022\u2022@gmail.com", warnings:[{id:"w1", reason:"Spamming the community board with the same post 8 times", by:"UTC Studios", date:iso(t - 2 * D)}]},
      "demo-rex":{name:"RexToilet", hint:"re\u2022\u2022\u2022@gmail.com", bans:1, warnings:[
        {id:"w2", reason:"Rude to another player in the community board", by:"Amos", date:iso(t - 6 * D)},
        {id:"w3", reason:"Posted someone's private info", by:"UTC Studios", date:iso(t - 3 * D)},
        {id:"w4", reason:"Hate speech in a post", by:"Amos", date:iso(t - 20 * H)}],
        ban:{type:"temp", until:iso(t + 22 * H), reason:"3 warnings", by:"Amos", date:iso(t - 20 * H)}},
      "demo-gus":{name:"GusPlays", hint:"gu\u2022\u2022\u2022@gmail.com", paused:{until:iso(t + 5 * H), reason:"Cool-off after an argument", by:"UTC Studios", date:iso(t - H)}}
    }},
    profiles:{people:{
      "demo-amos":{name:"Amos", bio:"Owner of TTVM Studios. Making Skibidi Strike and Blockworld.", banner:"#3a0d0b", link:"https://www.youtube.com/@Ttvm_studios_Official"},
      "demo-utc":{name:"UTC Studios", bio:"Moderator dev. Building levels and keeping the board clean.", banner:"#0f2a44"},
      "demo-titan":{name:"Titan TV Man", bio:"Dev. Code, website and the change log.", banner:"#1b1b22"},
      "demo-cam":{name:"CameraFan22", bio:"Cameraman main. Wave 61 best.", banner:"#123d1c"}
    }},
    activity:{people:{
      "demo-amos":{name:"Amos", last:iso(t - 4 * 60e3), days:days([9, 14, 6, 11, 0, 8, 12])},
      "demo-utc":{name:"UTC Studios", last:iso(t - 35 * 60e3), days:days([5, 7, 9, 0, 3, 6, 4])},
      "demo-titan":{name:"Titan TV Man", last:iso(t - 3 * H), days:days([4, 2, 6, 5, 3, 0, 2])},
      "demo-block":{name:"BlockBuilder", last:iso(t - 2 * D), days:days([0, 0, 3, 1, 0, 2, 0])},
      "demo-cam":{name:"CameraFan22", last:iso(t - 26 * 60e3), days:days([3, 4, 2, 6, 1, 0, 2])},
      "demo-rex":{name:"RexToilet", last:iso(t - D), days:days([0, 2, 0, 1, 4, 0, 0])},
      "demo-gus":{name:"GusPlays", last:iso(t - 70 * 60e3), days:days([1, 0, 2, 1, 0, 0, 1])}
    }},
    community:{posts:[
      {id:"d3", name:"CameraFan22", role:"user", date:iso(t - 40 * 60e3), text:"Made it to wave 61 with Cameraman, the Astro UFO on 60 is no joke"},
      {id:"d2", name:"UTC Studios", role:"mod", date:iso(t - 5 * H), text:"Blockworld test build tonight. Post any pink textures or FPS drops here."},
      {id:"d1", name:"Amos", role:"owner", date:iso(t - D), text:"Welcome to the community board! Keep it friendly. 3 warnings is a ban."}
    ]}
  };
  put(K.demoDb, db, "s");
  return db;
}

// ---------- data files ----------
var cache = {};
function blank(name){
  if(name === "roles") return {owners:[], mods:[], devs:[]};
  if(name === "community") return {posts:[]};
  return {people:{}};
}
function norm(name, o){
  o = (o && typeof o === "object") ? o : blank(name);
  if(name === "roles"){ ["owners","mods","devs"].forEach(function(k){ if(!Array.isArray(o[k])) o[k] = []; }); }
  else if(name === "community"){ if(!Array.isArray(o.posts)) o.posts = []; }
  else if(!o.people || typeof o.people !== "object") o.people = {};
  return o;
}
function data(name, fresh){
  if(DEMO) return Promise.resolve(norm(name, JSON.parse(JSON.stringify(demoDb()[name] || blank(name)))));
  if(cache[name] && !fresh) return cache[name];
  var p = fetch(ROOT + "data/" + name + ".json?t=" + now(), {cache:"no-store"})
    .then(function(r){ return r.ok ? r.json() : blank(name); })
    .catch(function(){ return blank(name); })
    .then(function(o){ return norm(name, o); });
  cache[name] = p;
  return p;
}

// ---------- writing data (GitHub key, the same one the chats page uses) ----------
function token(){ var s = store(); return s ? s.getItem(TOKEN_KEY) : null; }
function b64(text){ return btoa(unescape(encodeURIComponent(text))); }
function unb64(b){ return decodeURIComponent(escape(atob(String(b).replace(/\s/g, "")))); }
function gh(url, opts){
  opts = opts || {};
  var hd = {"Accept":"application/vnd.github+json", "Authorization":"Bearer " + token(), "X-GitHub-Api-Version":"2022-11-28"};
  if(opts.body) hd["Content-Type"] = "application/json";
  return fetch(url, {method:opts.method || "GET", headers:hd, body:opts.body ? JSON.stringify(opts.body) : undefined, cache:"no-store"})
    .then(function(r){ return r.json().catch(function(){ return {}; }).then(function(j){ if(!r.ok){ var e = new Error(j.message || ("HTTP " + r.status)); e.status = r.status; throw e; } return j; }); });
}
function rmw(target, name, change, message){
  var url = "https://api.github.com/repos/" + target.repo + "/contents/" + target.dir + name + ".json";
  var tries = 0;
  function once(){
    tries++;
    return gh(url + "?ref=main").then(function(j){ return {sha:j.sha, doc:JSON.parse(unb64(j.content))}; }, function(e){ if(e.status === 404) return {sha:null, doc:null}; throw e; })
      .then(function(r){
        var doc = norm(name, r.doc); change(doc);
        var body = {message:message, content:b64(JSON.stringify(doc, null, 2) + "\n"), branch:"main"};
        if(r.sha) body.sha = r.sha;
        return gh(url, {method:"PUT", body:body}).then(function(){ return doc; });
      })
      .catch(function(e){ if((e.status === 409 || e.status === 422) && tries < 4) return once(); throw e; });
  }
  return once();
}
// change(doc) edits the doc in place. Resolves {doc, saved:"live"|"studio"|"demo"|"none", json, error}
function save(name, change, message){
  message = (message || ("Update " + name)) + " (site panel)";
  if(DEMO){
    var db = demoDb(); db[name] = norm(name, db[name]); change(db[name]); put(K.demoDb, db, "s");
    return Promise.resolve({doc:db[name], saved:"demo"});
  }
  if(!token()){
    return data(name, true).then(function(doc){ doc = JSON.parse(JSON.stringify(doc)); change(doc); return {doc:doc, saved:"none", json:JSON.stringify(doc, null, 2)}; });
  }
  return rmw(REPO_PRIVATE, name, change, message).then(function(doc){
    return rmw(REPO_PUBLIC, name, change, message).then(function(){ cache[name] = Promise.resolve(doc); return {doc:doc, saved:"live"}; },
      function(e){ return {doc:doc, saved:"studio", error:e.message}; });
  }, function(e){
    return data(name, true).then(function(doc){ doc = JSON.parse(JSON.stringify(doc)); change(doc); return {doc:doc, saved:"none", json:JSON.stringify(doc, null, 2), error:e.status === 401 ? "Your GitHub key didn't work (expired?)" : e.message}; });
  });
}

// ---------- session ----------
function decodeJwt(t){
  try { var p = t.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"); while(p.length % 4) p += "="; return JSON.parse(decodeURIComponent(escape(atob(p)))); } catch(e){ return null; }
}
var S = {ready:READY, demo:DEMO, session:null, h:null, realRole:"guest", role:"guest", mode:"owner", restricted:null, warnings:[], person:null, loaded:false};
var subs = [];
function emit(){ subs.forEach(function(f){ try { f(S); } catch(e){ console.error(e); } }); render(); }

function loadSession(){
  if(DEMO){
    var p = DEMO_PEOPLE[DEMO];
    return Promise.resolve({h:p.h, name:p.name, email:p.email, picture:"", at:now() - 3600e3, demo:true});
  }
  if(!READY) return Promise.resolve(null);
  var s = get(K.session);
  if(!s || !s.h || (s.at && now() - s.at > 30 * 864e5)) { put(K.session, null); return Promise.resolve(null); }
  return Promise.resolve(s);
}
function roleOf(h, roles){
  if(!h) return "guest";
  function has(list){ return list.some(function(x){ return x && x.h === h; }); }
  if(has(roles.owners)) return "owner";
  if(has(roles.mods)) return "mod";
  if(has(roles.devs)) return "dev";
  return "user";
}
function activeWarnings(p){ return ((p && p.warnings) || []).filter(function(x){ return !x.cleared; }); }
function restriction(p){
  if(!p) return null;
  var t = now(), b = p.ban, pa = p.paused;
  if(b && (b.type === "perm" || b.type === "warnban" || (b.type === "temp" && ms(b.until) > t)))
    return {kind:b.type === "perm" ? "cut" : "ban", until:b.type === "temp" ? b.until : null, reason:b.reason || "", by:b.by || "", date:b.date, pendingOwner:!!b.pendingOwner};
  if(pa && (!pa.until || ms(pa.until) > t))
    return {kind:"pause", until:pa.until || null, reason:pa.reason || "", by:pa.by || "", date:pa.date};
  return null;
}
function refresh(){
  return loadSession().then(function(sess){
    S.session = sess; S.h = sess ? sess.h : null;
    return Promise.all([data("roles"), data("moderation")]).then(function(r){
      var roles = r[0], mod = r[1];
      S.person = S.h ? (mod.people[S.h] || null) : null;
      // a kick signs the person out once
      if(sess && !sess.demo && S.person && S.person.kickAt && ms(S.person.kickAt) > (sess.at || 0)){
        put(K.session, null); S.session = null; S.h = null; S.person = null;
        toast("A moderator signed you out. You can sign in again.");
      }
      S.realRole = roleOf(S.h, roles);
      if(DEMO === "restricted") S.realRole = "user";
      S.mode = (get(K.mode) === "dev") ? "dev" : "owner";
      S.role = (S.realRole === "owner" && S.mode === "dev") ? "dev" : S.realRole;
      S.restricted = S.h ? restriction(S.person) : null;
      if(S.restricted) put(K.restrict, {h:S.h, kind:S.restricted.kind, until:S.restricted.until, reason:S.restricted.reason}); else if(S.h) put(K.restrict, null);
      S.warnings = activeWarnings(S.person);
      S.loaded = true;
      syncOldOwnerMode();
      seen();
      emit();
      warnToast();
      return S;
    });
  });
}
// signed-in Google owner also opens the old code-based owner tools (chats) on this browser
function syncOldOwnerMode(){
  if(!READY || !S.h) return;
  var s = store(); if(!s) return;
  if(S.realRole === "owner") s.setItem("ss_role", S.mode === "dev" ? "dev" : "owner");
  else if((S.realRole === "mod" || S.realRole === "dev") && s.getItem("ss_role") === "owner") s.setItem("ss_role", "dev");
}
function seen(){
  if(!S.h || S.demo) return;
  var all = get(K.seen) || {}, day = new Date().toISOString().slice(0, 10), me = all[S.h] || {days:{}};
  me.name = S.session.name; me.last = iso(); me.days = me.days || {}; me.days[day] = (me.days[day] || 0) + (me._d === day ? 0 : 1); me._d = day;
  all[S.h] = me; put(K.seen, all);
  // staff with a GitHub key on this device: record last seen once a day in data/activity.json
  if(token() && RANK[S.realRole] >= 2 && me._synced !== day){
    me._synced = day; put(K.seen, all);
    save("activity", function(doc){
      var p = doc.people[S.h] || (doc.people[S.h] = {days:{}});
      p.name = S.session.name; p.last = iso(); p.days = p.days || {}; p.days[day] = (p.days[day] || 0) + 1;
      Object.keys(p.days).sort().slice(0, -30).forEach(function(k){ delete p.days[k]; });
    }, "Activity: " + S.session.name).catch(function(){});
  }
}

// ---------- Google sign-in ----------
var gisP = null;
function gis(){
  if(!READY) return Promise.reject(new Error("off"));
  if(gisP) return gisP;
  gisP = new Promise(function(res, rej){
    var s = d.createElement("script"); s.src = "https://accounts.google.com/gsi/client"; s.async = true;
    s.onload = function(){
      try {
        w.google.accounts.id.initialize({client_id:CLIENT_ID, callback:onCredential, auto_select:false, cancel_on_tap_outside:true, ux_mode:"popup"});
        res(w.google.accounts.id);
      } catch(e){ rej(e); }
    };
    s.onerror = function(){ rej(new Error("Google sign-in didn't load")); };
    d.head.appendChild(s);
  });
  return gisP;
}
function onCredential(resp){
  var p = decodeJwt(resp && resp.credential);
  if(!p || !p.email || p.aud !== CLIENT_ID){ toast("Sign-in didn't work. Try again."); return; }
  emailHash(p.email).then(function(h){
    put(K.session, {h:h, sub:p.sub, name:p.name || p.given_name || "Player", email:p.email, hint:maskEmail(p.email), picture:p.picture || "", at:now()});
    cache = {};
    closeMenus();
    return refresh();
  }).then(function(){
    toast("Signed in as " + S.session.name);
    if(d.body.hasAttribute("data-acct-signin")){ var back = /[?&]next=([^&]+)/.exec(location.search); setTimeout(function(){ location.href = back ? decodeURIComponent(back[1]) : link("profile/#edit"); }, 600); }
  });
}
function renderGoogleButton(el, opts){
  if(!el) return;
  if(!READY){ el.innerHTML = '<button type="button" class="acct-gbtn" disabled><span class="g">G</span>Google sign-in coming soon</button>'; return; }
  gis().then(function(id){ el.innerHTML = ""; id.renderButton(el, {theme:"filled_black", size:"large", shape:"pill", text:"signin_with", width:(opts && opts.width) || 240}); })
    .catch(function(){ el.innerHTML = '<p class="acct-small">Google sign-in couldn\'t load. Check your connection and reload.</p>'; });
}
function signOut(){
  if(DEMO){ put(K.demo, null, "s"); DEMO = null; S.demo = null; location.href = location.pathname; return; }
  put(K.session, null);
  try { w.google && w.google.accounts.id.disableAutoSelect(); } catch(e){}
  var s = store(); if(s && s.getItem("ss_role") && READY) s.removeItem("ss_role");
  toast("Signed out");
  refresh();
}
function setMode(m){ put(K.mode, m === "dev" ? "dev" : null); refresh(); }

// ---------- profiles ----------
function localProfile(h){ return get(K.local + h) || {}; }
function profileOf(h, shared){
  var base = (shared && shared.people && shared.people[h]) || {};
  var mine = (S.h === h) ? localProfile(h) : {};
  var o = {}; [base, mine].forEach(function(src){ for(var k in src) if(src[k] !== "" && src[k] != null) o[k] = src[k]; });
  return o;
}
function me(){
  if(!S.session) return {h:null, name:"Guest", picture:"", banner:"#000000", role:"guest"};
  var lp = localProfile(S.h);
  return {h:S.h, name:lp.name || S.session.name, picture:S.session.picture || "", banner:lp.banner || "#000000", role:S.role};
}
function avatar(p, cls){
  cls = "acct-av" + (cls ? " " + cls : "");
  if(!p || !p.h) return '<span class="' + cls + ' is-guest" aria-hidden="true"><svg viewBox="0 0 32 32"><circle cx="16" cy="12.5" r="6"/><path d="M4.5 29c1.6-6.2 6.2-9.4 11.5-9.4S25.9 22.8 27.5 29z"/></svg></span>';
  if(p.picture) return '<span class="' + cls + '"><img src="' + esc(p.picture) + '" alt="" referrerpolicy="no-referrer" loading="lazy"></span>';
  return '<span class="' + cls + '" style="--h:' + hue(p.h) + '" aria-hidden="true">' + esc(initials(p.name)) + '</span>';
}

// ---------- the chip (top-left on every page) ----------
function link(path){ return ROOT + path; }
function roleTag(r, small){ return r === "guest" || r === "user" ? "" : '<i class="acct-role r-' + r + (small ? " sm" : "") + '">' + (r === "mod" ? "MOD" : r.toUpperCase()) + '</i>'; }
function subline(){
  var R = S.restricted, rr = S.realRole;
  if(R) return "Restricted";
  if(!S.session) return "Not signed in";
  return ROLE_NAME[S.role] + (rr === "owner" && S.mode === "dev" ? " (dev mode)" : "") + (S.demo ? " \u00b7 preview" : "");
}
function chipHtml(){
  var m = me(), restricted = !!S.restricted;
  var name = (!S.session || restricted) ? "Guest" : m.name;
  var dot = (S.warnings.length && S.session) ? '<b class="acct-dot" title="' + S.warnings.length + ' warning' + (S.warnings.length > 1 ? "s" : "") + '">' + S.warnings.length + '</b>' : "";
  var cls = restricted ? " is-restricted" : (S.session ? " r-" + S.role : " is-guest");
  return '<button type="button" class="acct-chip' + cls + '" aria-haspopup="true" aria-expanded="false" title="' + esc(name) + '">' +
    '<span class="acct-avw">' + (restricted ? avatar(null) : avatar(m)) + dot + '</span>' +
    '<span class="acct-txt"><span class="acct-name">' + esc(name) + '</span><span class="acct-sub">' + esc(subline()) + '</span></span>' +
    '<svg class="acct-caret" viewBox="0 0 12 12" aria-hidden="true"><path d="M2.5 4.5 6 8l3.5-3.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg></button>';
}
function bannerStyle(p){
  var b = p && p.banner, img = p && p.bannerImage;
  if(img) return 'background-image:url(' + esc(img) + ')';
  return 'background:' + (/^#[0-9a-f]{3,8}$/i.test(b || "") ? b : "#000");
}
function menuHtml(){
  var m = me(), r = S.role, rr = S.realRole, R = S.restricted, guest = !S.session || !!R;
  var lp = S.h ? localProfile(S.h) : {};
  var h = '<div class="acct-menu" role="menu" hidden>';
  h += '<div class="acct-card"><div class="acct-cban" style="' + (guest ? "background:#000" : bannerStyle({banner:lp.banner || "#000", bannerImage:lp.bannerImage})) + '"></div>' +
    '<div class="acct-cbody">' + (guest ? avatar(null, "lg") : avatar(m, "lg")) +
    '<div class="acct-cname"><b>' + esc(guest ? "Guest" : m.name) + '</b>' + (guest ? "" : roleTag(r, true)) + '<span>' + esc(subline()) + '</span></div></div>' +
    '<div class="acct-cbtns"><a class="acct-btn sm" href="' + link(S.session && !R ? "profile/" : "profile/") + '">View profile</a>' +
    '<a class="acct-btn sm ghost" href="' + link(guest ? (R ? "profile/#status" : "signin/") : "profile/#edit") + '">' + (R ? "Why?" : "Customize") + '</a></div></div>';
  if(R) h += '<a class="acct-warnline" href="' + link("profile/#status") + '">' + (R.kind === "pause" ? "Paused " : R.kind === "cut" ? "Cut off from the site" : "Banned ") + esc(R.kind === "cut" ? "" : until(R.until)) + ' \u2192</a>';
  else if(S.warnings.length && S.session) h += '<a class="acct-warnline" href="' + link("profile/#warnings") + '">' + S.warnings.length + ' of 3 warnings \u00b7 tap to see why \u2192</a>';
  h += '<a role="menuitem" href="' + link("games/") + '">TTVM Studios Games</a>';
  h += '<a role="menuitem" href="' + link("devhub/") + '">Dev <small>chats \u00b7 community \u00b7 credits</small></a>';
  if(RANK[r] >= 2 && !R) h += '<a role="menuitem" href="' + link("devhub/panel.html") + '">' + (r === "owner" ? "Owner panel" : r === "mod" ? "Moderator panel" : "Dev panel") + '</a>';
  if(RANK[rr] >= 2 && !R){
    var xs = expState().on;
    h += '<div class="acct-mode acct-xp"><span>Test mode</span><button type="button" data-xp class="' + (xs ? "on" : "") + '" aria-pressed="' + (!!xs) + '">' + (xs ? "On" : "Off") + '</button><a href="' + link("devhub/experiments.html") + '">Experiments</a></div>';
  }
  if(rr === "owner" && !R){
    h += '<div class="acct-mode" role="group" aria-label="Mode"><span>Mode</span><button type="button" data-mode="owner" class="' + (S.mode === "owner" ? "on" : "") + '">Owner</button><button type="button" data-mode="dev" class="' + (S.mode === "dev" ? "on" : "") + '">Dev</button></div>';
  }
  if(!S.session) h += '<a role="menuitem" class="acct-signin" href="' + link("signin/") + '">Sign in with Google</a>';
  else h += '<button type="button" role="menuitem" class="acct-out" data-signout>' + (S.demo ? "Exit preview" : "Sign out") + '</button>';
  h += '</div>';
  return h;
}
var slots = [];
function closeMenus(){ slots.forEach(function(el){ var mm = el.querySelector(".acct-menu"), b = el.querySelector(".acct-chip"); if(mm) mm.hidden = true; if(b) b.setAttribute("aria-expanded", "false"); }); }
function render(){
  slots = Array.prototype.slice.call(d.querySelectorAll("[data-acct]"));
  slots.forEach(function(el){
    el.innerHTML = chipHtml() + menuHtml();
    var b = el.querySelector(".acct-chip"), mm = el.querySelector(".acct-menu");
    b.addEventListener("click", function(ev){
      ev.stopPropagation();
      var open = mm.hidden; closeMenus(); mm.hidden = !open; b.setAttribute("aria-expanded", String(open));
    });
    mm.addEventListener("click", function(ev){ ev.stopPropagation(); });
    Array.prototype.forEach.call(mm.querySelectorAll("[data-mode]"), function(x){ x.addEventListener("click", function(){ setMode(x.getAttribute("data-mode")); toast(x.getAttribute("data-mode") === "dev" ? "Dev mode on" : "Owner mode on"); }); });
    var xb = mm.querySelector("[data-xp]"); if(xb) xb.addEventListener("click", function(){ var v = !expState().on; expSet({on:v}); toast(v ? "Experimental mode on" : "Experimental mode off"); });
    var so = mm.querySelector("[data-signout]"); if(so) so.addEventListener("click", signOut);
  });
  d.documentElement.classList.toggle("ttvm-restricted", !!S.restricted);
  d.documentElement.setAttribute("data-ttvm-role", S.restricted ? "restricted" : S.role);
  notice();
  previewPill();
  applyExperiments();
}
d.addEventListener("click", closeMenus);
d.addEventListener("keydown", function(e){ if(e.key === "Escape") closeMenus(); });

// ---------- restricted guests ----------
function blockHtml(what){
  var R = S.restricted; if(!R) return "";
  var head = R.kind === "cut" ? "Your account is cut off" : R.kind === "pause" ? "Your account is paused" : "Your account is banned";
  var ws = S.warnings.length ? '<ul class="acct-wlist">' + S.warnings.map(warnItem).join("") + '</ul>' : "";
  return '<div class="acct-block" role="alert"><h2>' + head + '</h2>' +
    '<p class="acct-until">' + (R.kind === "cut" ? "No end date. Only the owner can lift it." : esc(until(R.until))) + (R.pendingOwner ? " (the owner picks how long)" : "") + '</p>' +
    (R.reason ? '<p><b>Reason:</b> ' + esc(R.reason) + '</p>' : "") +
    '<p class="acct-small">Until then you\'re a restricted Guest: you can read the updates, roadmap and games list, but you can\'t ' + esc(what || "play, chat, post or edit your profile") + '.</p>' + ws +
    '<div class="acct-brow"><a class="acct-btn" href="' + link("") + '#roadmap">See the updates</a><a class="acct-btn ghost" href="' + link("games/") + '">Games list</a></div></div>';
}
function warnItem(x){
  return '<li><details><summary><span class="acct-wico">!</span><span>Warning \u00b7 ' + esc(when(x.date)) + '</span></summary><p>' + esc(x.reason || "No reason given") + '</p><p class="acct-small">From ' + esc(x.by || "the studio") + ' \u00b7 ' + esc(new Date(ms(x.date)).toLocaleString()) + '</p></details></li>';
}
var gate = {resolve:null, p:null};
// play pages call TTVM.gate(): resolves right away for guests / clean accounts, never for restricted ones
function gateFn(){
  if(gate.p) return gate.p;
  var quick = !DEMO && (!READY || !get(K.session)) && !get(K.restrict);
  gate.p = quick ? Promise.resolve(true) : new Promise(function(res){
    var done = false;
    function check(){ if(done) return; if(!S.loaded) return; done = true; if(S.restricted){ showGateBlock(); } else res(true); }
    subs.push(check); check();
    setTimeout(function(){ if(!done && !S.loaded){ done = true; res(true); } }, 5000);
  });
  return gate.p;
}
function showGateBlock(){
  var o = d.getElementById("acctGate");
  if(!o){ o = d.createElement("div"); o.id = "acctGate"; o.className = "acct-overlay"; d.body.appendChild(o); }
  o.innerHTML = '<div class="acct-ovbox">' + blockHtml("play the game") + '</div>';
}
function interceptPlay(){
  d.addEventListener("click", function(ev){
    if(!S.restricted) return;
    var a = ev.target.closest ? ev.target.closest("a[href]") : null; if(!a) return;
    var href = a.getAttribute("href") || "";
    if(!/(^|\/)play\/?(index\.html)?$/.test(href) && !a.hasAttribute("data-play") && !/devhub\/(?!$|index\.html)/.test(a.href) && !/owner-chat\.html/.test(href)) return;
    ev.preventDefault(); ev.stopPropagation();
    modal(blockHtml());
  }, true);
}
function modal(html){
  var o = d.createElement("div"); o.className = "acct-overlay acct-modal";
  o.innerHTML = '<div class="acct-ovbox">' + html + '<button type="button" class="acct-x" aria-label="Close">&times;</button></div>';
  o.addEventListener("click", function(e){ if(e.target === o || (e.target.classList && e.target.classList.contains("acct-x"))) o.remove(); });
  d.body.appendChild(o);
}
function notice(){
  var n = d.getElementById("acctNotice");
  var R = S.restricted, show = R && !d.body.hasAttribute("data-acct-nonotice");
  if(!show){ if(n) n.remove(); return; }
  if(!n){ n = d.createElement("a"); n.id = "acctNotice"; n.className = "acct-notice"; d.body.appendChild(n); }
  n.href = link("profile/#status");
  n.textContent = (R.kind === "pause" ? "Account paused " + until(R.until) : R.kind === "cut" ? "Account cut off" : "Account banned " + until(R.until)) + " \u00b7 tap for why";
}
function warnToast(){
  if(!S.session || !S.warnings.length) return;
  var key = K.warnSeen + S.h, seenN = get(key) || 0;
  if(S.warnings.length > seenN){
    toast("You got a warning. Tap to see why.", link("profile/#warnings"));
    put(key, S.warnings.length);
  }
}
function previewPill(){
  var p = d.getElementById("acctPreview");
  if(!S.demo){ if(p) p.remove(); return; }
  if(!p){ p = d.createElement("a"); p.id = "acctPreview"; p.className = "acct-preview"; d.body.appendChild(p); }
  p.href = location.pathname + "?demo=off";
  p.innerHTML = "Preview: signed in as " + esc(DEMO === "restricted" ? "a banned account" : ROLE_NAME[DEMO]) + " <b>exit</b>";
}
var toastT = null;
function toast(msg, href){
  var t = d.getElementById("acctToast");
  if(!t){ t = d.createElement(href ? "a" : "div"); t.id = "acctToast"; t.className = "acct-toast"; t.setAttribute("role", "status"); d.body.appendChild(t); }
  t.textContent = msg; if(href) t.href = href;
  t.classList.add("on"); clearTimeout(toastT); toastT = setTimeout(function(){ t.classList.remove("on"); setTimeout(function(){ t.remove(); }, 400); }, 4200);
}


// ---------- Test / Experimental mode (owner, moderators and devs) ----------
var EXPK = "ttvm_exp", expApplied = {}, expList = null;
function expState(){ var s = get(EXPK) || {}; s.off = s.off || {}; return s; }
function expAllowed(){ return S.loaded && RANK[S.realRole] >= 2 && !S.restricted; }
function expOn(id){ var s = expState(); return expAllowed() && !!s.on && !s.off[id]; }
function expSet(patch){ var s = expState(); if("on" in patch) s.on = !!patch.on; if(patch.id) { if(patch.value) delete s.off[patch.id]; else s.off[patch.id] = 1; } put(EXPK, s); emit(); }
function experiments(){
  if(!expList) expList = fetch(ROOT + "data/experiments.json?t=" + now(), {cache:"no-store"}).then(function(r){ return r.ok ? r.json() : {experiments:[]}; }).catch(function(){ return {experiments:[]}; })
    .then(function(o){ return (o && o.experiments) || []; });
  return expList;
}
var FEAT = {
  "touch-controls":{on:function(){
    var cv = d.getElementById("unity-canvas"); if(!cv) return null;
    var box = d.createElement("div"); box.className = "xp-touch";
    box.innerHTML = '<div class="xp-stick" aria-label="Move"><i></i></div><div class="xp-btns"><button type="button" data-k="Space" data-key=" ">JUMP</button><button type="button" data-k="KeyR" data-key="r">RELOAD</button><button type="button" data-shoot class="xp-fire">FIRE</button></div><span class="xp-tag">Experimental controls</span>';
    cv.parentNode.appendChild(box);
    function key(type, code, k){ var e = new KeyboardEvent(type, {code:code, key:k, bubbles:true}); cv.dispatchEvent(e); d.dispatchEvent(e); }
    Array.prototype.forEach.call(box.querySelectorAll("[data-k]"), function(b){
      b.addEventListener("pointerdown", function(e){ e.preventDefault(); key("keydown", b.getAttribute("data-k"), b.getAttribute("data-key")); });
      b.addEventListener("pointerup", function(){ key("keyup", b.getAttribute("data-k"), b.getAttribute("data-key")); });
    });
    var fire = box.querySelector("[data-shoot]");
    fire.addEventListener("pointerdown", function(e){ e.preventDefault(); cv.dispatchEvent(new MouseEvent("mousedown", {bubbles:true, button:0})); });
    fire.addEventListener("pointerup", function(){ cv.dispatchEvent(new MouseEvent("mouseup", {bubbles:true, button:0})); });
    var st = box.querySelector(".xp-stick"), knob = st.firstChild, held = {};
    function setDir(dx, dy){
      var want = {KeyW:dy < -0.35, KeyS:dy > 0.35, KeyA:dx < -0.35, KeyD:dx > 0.35}, keys = {KeyW:"w", KeyS:"s", KeyA:"a", KeyD:"d"};
      Object.keys(want).forEach(function(c){ if(want[c] && !held[c]){ held[c] = 1; key("keydown", c, keys[c]); } else if(!want[c] && held[c]){ delete held[c]; key("keyup", c, keys[c]); } });
      knob.style.transform = "translate(" + (dx * 28) + "px," + (dy * 28) + "px)";
    }
    st.addEventListener("pointerdown", function(e){ st.setPointerCapture(e.pointerId); move(e); });
    st.addEventListener("pointermove", function(e){ if(e.buttons || e.pointerType === "touch") move(e); });
    st.addEventListener("pointerup", function(){ setDir(0, 0); });
    function move(e){ var r = st.getBoundingClientRect(), x = (e.clientX - r.left - r.width / 2) / (r.width / 2), y = (e.clientY - r.top - r.height / 2) / (r.height / 2), m = Math.max(1, Math.hypot(x, y)); setDir(x / m, y / m); }
    return box;
  }},
  "music-tab":{on:function(){
    var b = d.createElement("div"); b.className = "xp-music";
    b.innerHTML = '<button type="button" class="xp-mbtn" aria-expanded="false">&#9835; Music</button><div class="xp-mpanel" hidden><b>Soundtrack</b><ol></ol><p class="acct-small">Preview of the Music tab. Tracks open on their creator\'s page.</p></div>';
    d.body.appendChild(b);
    var btn = b.querySelector("button"), pn = b.querySelector(".xp-mpanel");
    btn.onclick = function(){ pn.hidden = !pn.hidden; btn.setAttribute("aria-expanded", String(!pn.hidden)); };
    fetch(ROOT + "data/music.json").then(function(r){ return r.json(); }).then(function(m){
      b.querySelector("ol").innerHTML = (m.tracks || []).map(function(t){ return '<li><a href="' + esc(t.url) + '" target="_blank" rel="noopener">' + esc(t.name) + '</a><span>' + esc(t.by) + ' \u00b7 ' + esc(t.game) + '</span></li>'; }).join("");
    }).catch(function(){});
    return b;
  }},
  "far-lod":{on:function(){
    var host = d.getElementById("progress"); if(!host || !d.body.hasAttribute("data-game-title")) return null;
    var sec = d.createElement("section"); sec.className = "panel xp-lod"; sec.id = "xpLod";
    sec.innerHTML = '<h2>Far terrain (LOD) <span class="xp-pill">EXPERIMENTAL</span></h2><p>Like the Distant Horizons mod: chunks near you are full detail, far ones are drawn as cheap low-detail blocks, so you see way further for almost no FPS. Drag the sliders.</p>' +
      '<div class="xp-lodrow"><canvas width="320" height="320" aria-label="Top-down view of loaded chunks"></canvas><div class="xp-lodctl">' +
      '<label>Full-detail distance <b data-o="a">8</b> chunks<input type="range" min="2" max="32" value="8" data-i="a"></label>' +
      '<label>Far LOD distance <b data-o="b">48</b> chunks<input type="range" min="0" max="128" value="48" data-i="b"></label>' +
      '<ul><li>Full-detail chunks: <b data-o="fa"></b></li><li>LOD chunks: <b data-o="fb"></b></li><li>Drawing cost vs. all full detail: <b data-o="fc"></b></li></ul></div></div>';
    host.parentNode.insertBefore(sec, host.nextSibling);
    var cv = sec.querySelector("canvas"), g = cv.getContext("2d");
    function q(s){ return sec.querySelector(s); }
    function draw(){
      var a = +q('[data-i=a]').value, bb = Math.max(a, +q('[data-i=b]').value), R = bb + 1, cell = cv.width / (2 * R + 1);
      q('[data-o=a]').textContent = a; q('[data-o=b]').textContent = bb;
      g.fillStyle = "#121212"; g.fillRect(0, 0, cv.width, cv.height);
      var full = 0, lod = 0;
      for(var x = -R; x <= R; x++) for(var z = -R; z <= R; z++){
        var dd = Math.hypot(x, z), c = null;
        if(dd <= a){ c = "#6aa83e"; full++; } else if(dd <= bb){ c = (dd <= (a + bb) / 2) ? "#3f6b27" : "#2c4a1c"; lod++; }
        if(c){ g.fillStyle = c; g.fillRect((x + R) * cell, (z + R) * cell, Math.max(1, cell - (cell > 4 ? 1 : 0)), Math.max(1, cell - (cell > 4 ? 1 : 0))); }
      }
      g.fillStyle = "#ffd84a"; g.fillRect(R * cell, R * cell, Math.max(2, cell), Math.max(2, cell));
      var allFull = full + lod, cost = full + lod * 0.06;
      q('[data-o=fa]').textContent = full.toLocaleString(); q('[data-o=fb]').textContent = lod.toLocaleString();
      q('[data-o=fc]').textContent = allFull ? Math.max(1, Math.round(cost / allFull * 100)) + "%" : "100%";
    }
    Array.prototype.forEach.call(sec.querySelectorAll("input"), function(i){ i.oninput = draw; });
    draw();
    return sec;
  }},
  "bw-daynight":{on:function(){
    if(!d.body.hasAttribute("data-game-title")) return null;
    d.body.classList.add("xp-daynight");
    return {remove:function(){ d.body.classList.remove("xp-daynight"); }};
  }}
};
function applyExperiments(){
  var on = expAllowed() && expState().on;
  d.documentElement.classList.toggle("ttvm-exp", !!on);
  var bar = d.getElementById("xpBar");
  if(on && !bar){ bar = d.createElement("a"); bar.id = "xpBar"; bar.className = "xp-bar"; bar.href = link("devhub/experiments.html"); bar.innerHTML = "EXPERIMENTAL <span>mode on</span>"; d.body.appendChild(bar); }
  if(!on && bar) bar.remove();
  Object.keys(FEAT).forEach(function(id){
    var want = expOn(id);
    if(want && !expApplied[id]){ try { expApplied[id] = FEAT[id].on() || null; } catch(e){ console.error(e); } if(!expApplied[id]) expApplied[id] = false; }
    else if(!want && expApplied[id]){ try { expApplied[id].remove(); } catch(e){} delete expApplied[id]; }
    else if(!want && expApplied[id] === false) delete expApplied[id];
  });
}

// ---------- start ----------
w.TTVM = {
  ROOT:ROOT, READY:READY, RANK:RANK, ROLE_NAME:ROLE_NAME, BANNERS:BANNERS, state:S,
  on:function(f){ subs.push(f); if(S.loaded) f(S); },
  data:data, save:save, token:token, refresh:refresh,
  signOut:signOut, setMode:setMode, renderGoogleButton:renderGoogleButton,
  emailHash:emailHash, maskEmail:maskEmail, roleOf:roleOf, restriction:restriction, activeWarnings:activeWarnings,
  profileOf:profileOf, localProfile:localProfile, saveLocalProfile:function(p){ if(S.h){ put(K.local + S.h, p); emit(); } },
  me:me, avatar:avatar, bannerStyle:bannerStyle, subline:subline, roleTag:roleTag, esc:esc, when:when, until:until, ms:ms, iso:iso, hue:hue,
  blockHtml:blockHtml, warnItem:warnItem, toast:toast, modal:modal, gate:gateFn, link:link,
  localSeen:function(){ return get(K.seen) || {}; },
  exp:{state:expState, set:expSet, on:expOn, allowed:expAllowed, list:experiments}
};
function boot(){ render(); interceptPlay(); refresh(); }
if(d.readyState === "loading") d.addEventListener("DOMContentLoaded", boot); else boot();
})(window, document);
