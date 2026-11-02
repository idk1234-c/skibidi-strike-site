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
var K = {session:"ttvm_session", mode:"ttvm_mode", seen:"ttvm_seen", warnSeen:"ttvm_warn_seen", local:"ttvm_profile_", restrict:"ttvm_restricted"};

var RANK = {guest:0, user:1, dev:2, mod:3, owner:4};
var ROLE_NAME = {guest:"Guest", user:"Member", dev:"Dev", mod:"Moderator", owner:"Owner"};
// The owner's own two Google accounts (email fingerprints, the same ones as in data/roles.json).
// These are ALWAYS owner and can never be warned, paused, kicked, restricted or banned, whatever
// data/roles.json or data/moderation.json say, even if someone edits those files by hand.
// The one owner-only extra is a "Copyright notice" (data/notices.json): a warning card, never a restriction.
var OWNER_LOCK = ["84b8ba22b22d0eb7c6c62beabf9088f975efc8543a2a4c171f274afc3a478d11", "ed5ea1fa489217fd448743f8187fc26dbe53dd1717f3550a99dcbea26b3f5da7"];
var lastRoles = null;
function isLockedOwner(h){ return !!h && OWNER_LOCK.indexOf(h) >= 0; }
// any owner (locked or in data/roles.json) is protected from moderation
function isProtected(h, roles){
  if(!h) return false;
  if(isLockedOwner(h)) return true;
  roles = roles || lastRoles;
  return !!(roles && Array.isArray(roles.owners) && roles.owners.some(function(x){ return x && x.h === h; }));
}
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

// ---------- no preview / test-role mode ----------
// Roles come ONLY from a verified Google sign-in checked against data/roles.json.
// No link (?demo=...), saved flag or console trick gives anyone a role. Clean up old preview flags.
(function(){ try { w.sessionStorage.removeItem("ttvm_demo"); w.sessionStorage.removeItem("ttvm_demo_db"); } catch(e){} })();

// ---------- data files ----------
var cache = {};
function blank(name){
  if(name === "roles") return {owners:[], mods:[], devs:[]};
  if(name === "community") return {posts:[]};
  if(name === "announce") return {id:"", text:"", active:false};
  if(name === "team") return {team:[]};
  return {people:{}};
}
function norm(name, o){
  o = (o && typeof o === "object") ? o : blank(name);
  if(name === "roles"){ ["owners","mods","devs"].forEach(function(k){ if(!Array.isArray(o[k])) o[k] = []; }); }
  else if(name === "community"){ if(!Array.isArray(o.posts)) o.posts = []; }
  else if(name === "announce"){
    o.id = String(o.id || ""); o.text = String(o.text || ""); o.active = o.active === true;
    // a list of items, each with its own tag ("BIG UPDATE", "NEW GAME", "IN PROGRESS", ...). The old single "text" still works.
    o.items = (Array.isArray(o.items) ? o.items : []).filter(function(x){ return x && String(x.text || "").trim(); })
      .map(function(x){ return {tag:String(x.tag || "UPDATE").toUpperCase().slice(0, 24), text:String(x.text).trim().slice(0, 200), active:x.active !== false}; });
  }
  else if(name === "team"){ if(!Array.isArray(o.team)) o.team = []; }
  else if(!o.people || typeof o.people !== "object") o.people = {};
  return o;
}
function data(name, fresh){
  if(cache[name] && !fresh) return cache[name];
  var p = fetch(ROOT + "data/" + name + ".json?t=" + now(), {cache:"no-store"})
    .then(function(r){ return r.ok ? r.json() : blank(name); })
    .catch(function(){ return blank(name); })
    .then(function(o){ o = norm(name, o); if(name === "roles") lastRoles = o; return o; });
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
// change(doc) edits the doc in place. Resolves {doc, saved:"live"|"studio"|"none", json, error}
function save(name, change, message){
  message = (message || ("Update " + name)) + " (site panel)";
  if(!S.session || RANK[effectiveRole()] < 2) return Promise.reject(new Error("Sign in as studio staff first"));
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
var S = {ready:READY, session:null, h:null, realRole:"guest", role:"guest", mode:"owner", restricted:null, warnings:[], person:null, loaded:false};
var subs = [];
function emit(){ staffFlags(); applyLock(); subs.forEach(function(f){ try { f(S); } catch(e){ console.error(e); } }); render(); }

// ---------- who may open the studio tools ----------
// "staff" = owner, moderator or dev; "mod" = owner or moderator; "owner" = owner. Always needs a verified Google sign-in that is in data/roles.json.
// ---------- the ONE role check: the effective (view) role ----------
// realRole = what the verified Google sign-in + data/roles.json say. It never changes here.
// The owner can switch the view to Dev mode: then the whole site treats them EXACTLY like a dev
// (every owner card, link, page and tool hidden or locked, Dev badge). It's a view-only downgrade:
// it can never raise anyone (a dev can't switch to owner), and owner protection from warnings and bans
// stays on whatever the view (that comes from the account, not the view).
function devView(){ return !!S.session && S.realRole === "owner" && S.mode === "dev"; }
function effectiveRole(){
  if(!S.session) return "guest";
  return devView() ? "dev" : S.realRole;
}
function canSwitchMode(){ return !!S.session && S.realRole === "owner" && !S.restricted; }
function allowed(level){
  if(!S.loaded || !S.session || S.restricted) return false;
  var r = effectiveRole();
  return level === "owner" ? r === "owner" : level === "mod" ? RANK[r] >= 3 : RANK[r] >= 2;
}
function staffFlags(){
  var de = d.documentElement; if(!de || !de.classList) return;
  de.classList.toggle("acct-staff", allowed("staff"));
  de.classList.toggle("acct-owner", allowed("owner"));
  de.classList.toggle("acct-mod", allowed("mod"));
}
function lockHtml(level){
  var who = level === "owner" ? "Owner only" : level === "mod" ? "Owner/Moderator only" : "Owner/Dev only";
  return '<div class="ac-card acct-locked" data-acct-locked><div class="acct-lockico" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4.5" y="10.5" width="15" height="10" rx="2"/><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3"/></svg></div>' +
    '<h1 class="ac-h1">' + who + '</h1><p class="ac-lead">' + who + ' \u2014 sign in with an approved Google account.</p>' +
    (READY ? '<p><a class="acct-btn" href="' + link("signin/?next=" + encodeURIComponent(location.pathname)) + '">Sign in with Google</a></p>' : '<p class="acct-small">Google sign-in isn\'t switched on yet, so the studio tools are locked for everyone.</p>') +
    '<p class="ac-row" style="margin-top:16px"><a class="acct-btn ghost" href="' + link("") + '">Home</a><a class="acct-btn ghost" href="' + link("games/") + '">Games</a><a class="acct-btn ghost" href="' + link("devhub/community.html") + '">Community board</a></p></div>';
}
// pages marked <body data-acct-lock="staff|owner"> show ONLY the lock card until a signed-in staff member opens them
var lockState = null;
function applyLock(){
  var level = d.body && d.body.getAttribute("data-acct-lock"); if(!level) return;
  var ok = allowed(level);
  if(lockState === "locked" && ok){ reloading = true; location.reload(); return; }
  if(lockState === "open" && !ok){ reloading = true; location.reload(); return; }
  if(lockState) return;
  if(!ok){
    var area = d.querySelector("[data-acct-lockarea]") || d.querySelector("main");
    Array.prototype.forEach.call(d.querySelectorAll("[data-acct-lockhide]"), function(el){ el.remove(); });
    if(area) area.innerHTML = lockHtml(level);
    d.body.classList.add("acct-is-locked");
    lockState = "locked";
  } else lockState = "open";
  d.body.classList.add("acct-decided");
}

// A saved sign-in is only trusted if it carries the Google-signed ID token for THIS site.
// The email fingerprint is worked out again from the signed token on every page load, so editing
// the saved session (for example pasting the owner's fingerprint from roles.json) gets you nothing.
var certsP = null;
function googleKeys(){
  if(!certsP) certsP = fetch("https://www.googleapis.com/oauth2/v3/certs", {cache:"no-store"})
    .then(function(r){ if(!r.ok) throw new Error("keys"); return r.json(); })
    .catch(function(e){ certsP = null; throw e; });
  return certsP;
}
function b64u(s){ s = String(s).replace(/-/g, "+").replace(/_/g, "/"); while(s.length % 4) s += "="; var b = atob(s), u = new Uint8Array(b.length); for(var i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return u; }
// resolves the token's payload only when Google's signature, this site's client id and Google as issuer all check out; otherwise null
function verifyIdToken(tok){
  try {
    var parts = String(tok || "").split("."); if(parts.length !== 3) return Promise.resolve(null);
    var hd = JSON.parse(new TextDecoder().decode(b64u(parts[0]))), p = decodeJwt(tok);
    if(!hd || hd.alg !== "RS256" || !hd.kid || !p) return Promise.resolve(null);
    if(p.aud !== CLIENT_ID || (p.iss !== "accounts.google.com" && p.iss !== "https://accounts.google.com") || !p.email || p.email_verified === false) return Promise.resolve(null);
    if(!(w.crypto && w.crypto.subtle && w.TextEncoder)) return Promise.resolve(null);
    return googleKeys().then(function(j){
      var jwk = (j.keys || []).filter(function(k){ return k.kid === hd.kid; })[0];
      if(!jwk) return null;
      return w.crypto.subtle.importKey("jwk", {kty:"RSA", n:jwk.n, e:jwk.e, alg:"RS256", ext:true}, {name:"RSASSA-PKCS1-v1_5", hash:"SHA-256"}, false, ["verify"])
        .then(function(key){ return w.crypto.subtle.verify("RSASSA-PKCS1-v1_5", key, b64u(parts[2]), new TextEncoder().encode(parts[0] + "." + parts[1])); })
        .then(function(ok){ return ok ? p : null; });
    }).catch(function(){ return null; });
  } catch(e){ return Promise.resolve(null); }
}
function loadSession(){
  if(!READY) return Promise.resolve(null);
  var s = get(K.session);
  if(!s || !s.cred){ if(s) put(K.session, null); return Promise.resolve(null); }
  return verifyIdToken(s.cred).then(function(p){
    if(!p || !p.iat || now() - p.iat * 1000 > 30 * 864e5){ put(K.session, null); return null; }
    return emailHash(p.email).then(function(h){
      return {h:h, sub:p.sub, name:p.name || p.given_name || "Player", email:p.email, hint:maskEmail(p.email), picture:p.picture || "", at:p.iat * 1000, cred:s.cred};
    });
  });
}
function roleOf(h, roles){
  if(!h) return "guest";
  if(isLockedOwner(h)) return "owner";
  function has(list){ return list.some(function(x){ return x && x.h === h; }); }
  if(has(roles.owners)) return "owner";
  if(has(roles.mods)) return "mod";
  if(has(roles.devs)) return "dev";
  return "user";
}
// pass h whenever you have it: owners never have warnings or restrictions, whatever the file says
function activeWarnings(p, h){ if(h && isProtected(h)) return []; return ((p && p.warnings) || []).filter(function(x){ return !x.cleared; }); }
function restriction(p, h){
  if(!p || (h && isProtected(h))) return null;
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
    // guests: nothing to look up, so the roles / moderation files aren't even fetched
    var need = sess ? Promise.all([data("roles"), data("moderation")]) : Promise.resolve([blank("roles"), blank("moderation")]);
    return need.then(function(r){
      var roles = r[0], mod = r[1];
      lastRoles = roles;
      // owners are never moderated: their moderation entry (if anyone wrote one) is ignored completely
      S.prot = isProtected(S.h, roles);
      S.person = (S.h && !S.prot) ? (mod.people[S.h] || null) : null;
      // a kick signs the person out once
      if(sess && S.person && S.person.kickAt && ms(S.person.kickAt) > (sess.at || 0)){
        put(K.session, null); S.session = null; S.h = null; S.person = null;
        toast("A moderator signed you out. You can sign in again.");
      }
      S.realRole = roleOf(S.h, roles);
      S.mode = (S.realRole === "owner" && get(K.mode) === "dev") ? "dev" : "owner";
      S.role = effectiveRole();
      S.restricted = (S.h && !S.prot) ? restriction(S.person, S.h) : null;
      if(S.restricted) put(K.restrict, {h:S.h, kind:S.restricted.kind, until:S.restricted.until, reason:S.restricted.reason}); else if(S.h) put(K.restrict, null);
      S.warnings = S.prot ? [] : activeWarnings(S.person, S.h);
      S.loaded = true;
      seen();
      emit();
      warnToast();
      return S;
    });
  });
}
function seen(){
  if(!S.h) return;
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
  var cred = resp && resp.credential;
  verifyIdToken(cred).then(function(p){
    if(!p){ toast("Sign-in didn't work. Try again."); return; }
    put(K.session, {cred:cred, at:now()});
    cache = {};
    closeMenus();
    return refresh().then(function(){
      if(!S.session){ toast("Sign-in didn't work. Try again."); return; }
      toast("Signed in as " + S.session.name);
      if(d.body.hasAttribute("data-acct-signin")){ var back = /[?&]next=([^&]+)/.exec(location.search); var to = back ? decodeURIComponent(back[1]) : ""; if(!/^\/[^\/]/.test(to)) to = link("profile/"); setTimeout(function(){ location.href = to; }, 600); }
    });
  });
}
function renderGoogleButton(el, opts){
  if(!el) return;
  if(!READY){ el.innerHTML = '<button type="button" class="acct-gbtn" disabled><span class="g">G</span>Google sign-in coming soon</button>'; return; }
  gis().then(function(id){ el.innerHTML = ""; id.renderButton(el, {theme:"filled_black", size:"large", shape:"pill", text:"signin_with", width:(opts && opts.width) || 240}); })
    .catch(function(){ el.innerHTML = '<p class="acct-small">Google sign-in couldn\'t load. Check your connection and reload.</p>'; });
}
function signOut(){
  put(K.session, null);
  try { w.google && w.google.accounts.id.disableAutoSelect(); } catch(e){}
  toast("Signed out");
  refresh();
}
// Owner <-> Dev view. Only a verified owner can switch; switching never raises anyone's role.
var MODE_MSG = {dev:"Dev mode on \u00b7 you're seeing the site as a dev", owner:"Owner mode on \u00b7 all owner tools are back"};
var TOAST_NEXT = "ttvm_toast_next", reloading = false;
function setMode(m){
  m = m === "dev" ? "dev" : "owner";
  if(!canSwitchMode()) return Promise.resolve(S);
  if(m === S.mode){ toast(MODE_MSG[m]); return Promise.resolve(S); }
  put(K.mode, m === "dev" ? "dev" : null);
  put(TOAST_NEXT, MODE_MSG[m], "s");      // shown once, even if the page reloads to lock/unlock itself
  return refresh().then(function(r){ flushToast(); return r; });
}
function flushToast(){ if(reloading) return; var t = get(TOAST_NEXT, "s"); if(t){ put(TOAST_NEXT, null, "s"); toast(t); } }

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
  // name + photo come from the Google account automatically (like YouTube / TikTok);
  // a custom name or photo saved on the profile page only overrides them when one is set.
  return {h:S.h, name:lp.name || S.session.name, picture:lp.avatar || S.session.picture || "", banner:lp.banner || "#000000", role:S.role,
    googleName:S.session.name, googlePicture:S.session.picture || "", customName:!!lp.name, customPicture:!!lp.avatar};
}
function avatar(p, cls){
  cls = "acct-av" + (cls ? " " + cls : "");
  if(!p || !p.h) return '<span class="' + cls + ' is-guest" aria-hidden="true"><svg viewBox="0 0 32 32"><circle cx="16" cy="12.5" r="6"/><path d="M4.5 29c1.6-6.2 6.2-9.4 11.5-9.4S25.9 22.8 27.5 29z"/></svg></span>';
  // if the photo can't load, the span falls back to the initials (see imgFallback below)
  if(p.picture) return '<span class="' + cls + '" style="--h:' + hue(p.h) + '" data-ini="' + esc(initials(p.name)) + '"><img src="' + esc(p.picture) + '" alt="" referrerpolicy="no-referrer" loading="lazy"></span>';
  return '<span class="' + cls + '" style="--h:' + hue(p.h) + '" aria-hidden="true">' + esc(initials(p.name)) + '</span>';
}
// a Google photo that fails to load (offline, blocked, expired link) shows the initials instead of a broken image
d.addEventListener("error", function(e){
  var t = e.target; if(!t || t.tagName !== "IMG") return;
  var s = t.parentNode; if(!s || !s.classList || !s.classList.contains("acct-av") || !s.hasAttribute("data-ini")) return;
  s.textContent = s.getAttribute("data-ini"); s.setAttribute("aria-hidden", "true");
}, true);

// ---------- the chip (top-left on every page) ----------
function link(path){ return ROOT + path; }
function roleTag(r, small){ return r === "guest" || r === "user" ? "" : '<i class="acct-role r-' + r + (small ? " sm" : "") + '">' + (r === "mod" ? "MOD" : r.toUpperCase()) + '</i>'; }
function subline(){
  if(S.restricted) return "Restricted";
  if(!S.session) return "Not signed in";
  return ROLE_NAME[effectiveRole()];
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
  var m = me(), r = effectiveRole(), R = S.restricted, guest = !S.session || !!R;
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
  // studio links (Dev hub, panels, experiments, mode switch) only for signed-in staff from data/roles.json
  if(RANK[r] >= 2 && !R && S.session) h += '<a role="menuitem" href="' + link("devhub/") + '">Dev <small>' + (r === "owner" ? "chats \u00b7 " : "") + 'community \u00b7 credits</small></a>';
  if(RANK[r] >= 2 && !R && S.session) h += '<a role="menuitem" href="' + link("devhub/panel.html") + '">' + (r === "owner" ? "Owner panel" : r === "mod" ? "Moderator panel" : "Dev panel") + '</a>';
  if(RANK[r] >= 2 && !R && S.session){
    var xs = expState().on;
    h += '<div class="acct-mode acct-xp"><span>Test mode</span><button type="button" data-xp class="' + (xs ? "on" : "") + '" aria-pressed="' + (!!xs) + '">' + (xs ? "On" : "Off") + '</button><a href="' + link("devhub/experiments.html") + '">Experiments</a></div>';
  }
  // the only owner-only thing a Dev-mode owner still sees: the switch back (in their own account menu)
  if(canSwitchMode()){
    h += '<div class="acct-mode" role="group" aria-label="Mode"><span>Mode</span><button type="button" data-mode="owner" class="' + (S.mode === "owner" ? "on" : "") + '">Owner</button><button type="button" data-mode="dev" class="' + (S.mode === "dev" ? "on" : "") + '">Dev</button></div>';
  }
  if(!S.session) h += '<a role="menuitem" class="acct-signin" href="' + link("signin/") + '">Sign in with Google</a>';
  else h += '<button type="button" role="menuitem" class="acct-out" data-signout>' + "Sign out" + '</button>';
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
    Array.prototype.forEach.call(mm.querySelectorAll("[data-mode]"), function(x){ x.addEventListener("click", function(){ closeMenus(); setMode(x.getAttribute("data-mode")); }); });
    var xb = mm.querySelector("[data-xp]"); if(xb) xb.addEventListener("click", function(){ var v = !expState().on; expSet({on:v}); toast(v ? "Experimental mode on" : "Experimental mode off"); });
    var so = mm.querySelector("[data-signout]"); if(so) so.addEventListener("click", signOut);
  });
  d.documentElement.classList.toggle("ttvm-restricted", !!S.restricted);
  d.documentElement.setAttribute("data-ttvm-role", S.restricted ? "restricted" : S.role);
  notice();
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
  var quick = (!READY || !get(K.session)) && !get(K.restrict);
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
function expAllowed(){ return allowed("staff"); }
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
      b.querySelector("ol").innerHTML = (m.tracks || []).length ? m.tracks.map(function(t){ return '<li><a href="' + esc(t.url) + '" target="_blank" rel="noopener">' + esc(t.name) + '</a><span>' + esc(t.by) + ' \u00b7 ' + esc(t.game) + '</span></li>'; }).join("") : '<li><span>No tracks yet.</span></li>';
    }).catch(function(){});
    return b;
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


// ---------- the studio team (data/team.json, display only: no sign-in, no permissions) ----------
var TM_ICON = {
  owner:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 18h18l-1.6-9.5-4.6 3.6L12 5l-2.8 7.1-4.6-3.6z"/></svg>',
  mod:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.5l8 3v6.2c0 4.7-3.3 8.4-8 9.8-4.7-1.4-8-5.1-8-9.8V5.5z"/><path d="M8.6 12.2l2.4 2.4 4.6-4.8" fill="none" stroke="#111" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>'
};
function teamHtml(list){
  list = (list || []).filter(function(m){ return m && m.name; });
  if(!list.length) return "";
  return '<ul class="tm-list">' + list.map(function(m){
    var r = m.role === "owner" ? "owner" : "mod", label = m.label || (r === "owner" ? "Owner" : "Moderator");
    // the owner's card opens his public profile (the special owner profile page)
    var go = r === "owner" ? '<a class="tm-link" href="' + link("profile/?u=owner") + '" aria-label="View ' + esc(m.name) + '\'s profile"></a>' : "";
    return '<li class="tm-card r-' + r + (go ? " has-link" : "") + '">' + go + '<span class="tm-av" style="--h:' + hue(m.name) + '" aria-hidden="true">' + esc(m.initials || initials(m.name)) + '<i class="tm-ico">' + TM_ICON[r] + '</i></span>' +
      '<span class="tm-txt"><b class="tm-name">' + esc(m.name) + '</b><span class="tm-row"><i class="tm-badge r-' + r + '">' + esc(label) + '</i>' +
      (m.studio ? '<span class="tm-sub">' + esc(m.studio) + '</span>' : "") + '</span></span></li>';
  }).join("") + '</ul>';
}
function fillTeam(){
  var els = d.querySelectorAll("[data-ttvm-team]");
  if(!els.length) return;
  data("team").then(function(doc){
    var html = teamHtml(doc.team) || '<p class="pf-empty">Team list coming soon.</p>';
    Array.prototype.forEach.call(els, function(el){ el.innerHTML = html; });
  });
}

// ---------- copyright notices (data/notices.json): owner-only, a warning card, never a restriction ----------
function activeNotices(doc, h){
  var p = doc && doc.people && h ? doc.people[h] : null;
  return ((p && p.notices) || []).filter(function(n){ return n && !n.cleared && n.type === "copyright"; });
}
function copyrightHtml(n){
  return '<section class="cr-card" role="alert" aria-label="Copyright notice"><div class="cr-tape" aria-hidden="true"></div>' +
    '<div class="cr-body"><span class="cr-ico" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M12 2.8L22.5 21H1.5z"/><path d="M12 9v5.2M12 17.2v.1" fill="none" stroke="#111" stroke-width="2.4" stroke-linecap="round"/></svg></span>' +
    '<div class="cr-txt"><h2 class="cr-h">Copyright notice: ' + esc(n.title || "Untitled") + '</h2>' +
    (n.details ? '<p class="cr-d">' + esc(n.details) + '</p>' : "") +
    '<p class="cr-meta">Posted ' + esc(when(n.date)) + ' \u00b7 A notice only. It doesn\'t restrict this account.</p></div></div></section>';
}

// ---------- start ----------
w.TTVM = {
  ROOT:ROOT, READY:READY, RANK:RANK, ROLE_NAME:ROLE_NAME, BANNERS:BANNERS, state:S,
  on:function(f){ subs.push(f); if(S.loaded) f(S); },
  data:data, save:save, token:token, refresh:refresh,
  signOut:signOut, setMode:setMode, renderGoogleButton:renderGoogleButton,
  effectiveRole:effectiveRole, devView:devView, canSwitchMode:canSwitchMode,
  emailHash:emailHash, maskEmail:maskEmail, roleOf:roleOf, restriction:restriction, activeWarnings:activeWarnings,
  profileOf:profileOf, localProfile:localProfile, saveLocalProfile:function(p){ if(S.h){ put(K.local + S.h, p); emit(); } },
  me:me, avatar:avatar, bannerStyle:bannerStyle, subline:subline, roleTag:roleTag, esc:esc, when:when, until:until, ms:ms, iso:iso, hue:hue,
  allowed:allowed, locked:function(){ return lockState !== "open"; }, lockHtml:lockHtml,
  blockHtml:blockHtml, warnItem:warnItem, toast:toast, modal:modal, gate:gateFn, link:link,
  localSeen:function(){ return get(K.seen) || {}; },
  exp:{state:expState, set:expSet, on:expOn, allowed:expAllowed, list:experiments},
  isProtected:isProtected, isLockedOwner:isLockedOwner, ownerH:OWNER_LOCK[0], teamHtml:teamHtml, fillTeam:fillTeam,
  activeNotices:activeNotices, copyrightHtml:copyrightHtml, initials:initials
};
function boot(){ render(); interceptPlay(); refresh().then(flushToast, flushToast); fillTeam(); }
if(d.readyState === "loading") d.addEventListener("DOMContentLoaded", boot); else boot();
})(window, document);
