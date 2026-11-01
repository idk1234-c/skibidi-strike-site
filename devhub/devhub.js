/* Dev section: the hub, the community board and the Owner / Moderator / Dev panels
 * Hub, panels and experiments are locked (acct.js lock card) unless signed in with Google as staff from data/roles.json. */
(function(){
"use strict";
var T = window.TTVM, esc = T.esc, $ = function(id){ return document.getElementById(id); };
var PAGE = document.body.getAttribute("data-page");
var SUG_KEY = "23423945-20f5-4cfb-9d9f-6b6f73f0f3ea";   // same inbox as the site's suggestion form
var HOUR = 3600e3, DAY = 24 * HOUR;

function savedMsg(res, what){
  if(res.saved === "live"){ T.toast(what + ". Live on the site in about a minute."); return; }
  if(res.saved === "studio"){ T.toast(what + ". Saved to the studio repo; it reaches the live site once Titan syncs it."); return; }
  T.modal('<div class="pn-copy"><h2 class="ac-h2">Almost done</h2><p>' + (res.error ? esc(res.error) + ". " : "") +
    'Saving needs your GitHub key on this device (the same one the Chats page uses). For now, copy this and send it to Titan, and it goes live:</p>' +
    '<textarea readonly id="pnJson">' + esc(res.json || "") + '</textarea><div class="ac-row" style="margin-top:10px"><button class="acct-btn" type="button" id="pnCopy">Copy</button>' +
    '<a class="acct-btn ghost" href="../owner-chat.html">Add my GitHub key</a></div></div>');
  var b = $("pnCopy"); if(b) b.onclick = function(){ var t = $("pnJson"); t.select(); try { navigator.clipboard.writeText(t.value); } catch(e){ document.execCommand("copy"); } b.textContent = "Copied \u2713"; };
}

// =============================== hub ===============================
function hub(S){
  if(!T.allowed("staff")) return;   // guests and members only ever see the lock card
  var r = T.effectiveRole(), R = S.restricted;
  var panelName = r === "owner" ? "Owner panel" : r === "mod" ? "Moderator panel" : r === "dev" ? "Dev panel" : "Studio panels";
  $("dhPanelName").textContent = panelName;
  $("dhPanelText").textContent = r === "owner" ? "Everyone who signs in, warnings, bans, roles and site activity." :
    r === "mod" ? "Warn, pause, kick and ban members and devs." : r === "dev" ? "Help and the tools devs can use." : "For the studio team: owner, moderators and devs.";
  // Owner mode only. In Dev mode the hub looks exactly like a dev's (switch back from your account menu).
  $("dhMode").innerHTML = r === "owner" && T.canSwitchMode() ? 'You\'re in <b>Owner mode</b>. <button type="button" class="acct-btn ghost sm" id="dhSwap">Switch to Dev mode</button> <span class="acct-small">see the site exactly like a dev does</span>' : "";
  var sw = $("dhSwap"); if(sw) sw.onclick = function(){ T.setMode("dev"); };
  announceEditor(S);
}
// ---------- update banner (data/announce.json): owners, moderators and devs can set it here ----------
// A list of items, each with its own tag ("BIG UPDATE", "NEW GAME", "IN PROGRESS", ...). They scroll one after another.
var AN_TAGS = ["BIG UPDATE", "UPDATE", "NEW GAME", "IN PROGRESS", "COMING SOON", "EVENT"];
function anItems(doc){
  if(doc && Array.isArray(doc.items) && doc.items.length) return doc.items.map(function(x){ return {tag:String(x.tag || "UPDATE").toUpperCase(), text:String(x.text || ""), active:x.active !== false}; });
  var t = doc && String(doc.text || "").trim(); if(!t) return [];
  var m = /^([A-Z][A-Z0-9 ]{1,22}):\s*(.+)$/.exec(t);
  return [{tag:m ? m[1].trim() : "UPDATE", text:m ? m[2] : t, active:true}];
}
function anSig(items){ return items.filter(function(x){ return x.active !== false; }).map(function(x){ return x.tag + "|" + x.text; }).join("\n"); }
function announceEditor(S){
  var box = $("dhAnnounce");
  if(!box || !T.allowed("staff") || box.getAttribute("data-on")) return;
  box.setAttribute("data-on", "1");
  T.data("announce", true).then(function(doc){
    var items = anItems(doc);
    if(!items.length) items = [{tag:"BIG UPDATE", text:"", active:true}];
    box.hidden = false;
    box.innerHTML = '<h2 class="ac-h2">Update banner</h2><p class="acct-small" style="margin-bottom:10px">The scrolling strip across the top of every page: big updates, new games and games in progress. Each line gets its own tag and they scroll one after another. People can close it; when any line changes it shows again for everyone.</p>' +
      '<form id="anForm" autocomplete="off"><div class="an-list" id="anList"></div>' +
      '<div class="ac-row" style="margin-top:8px"><button class="acct-btn ghost sm" type="button" id="anAdd">+ Add a line</button></div>' +
      '<label class="acct-small" style="display:flex;gap:8px;align-items:center;margin-top:10px"><input type="checkbox" id="anOn"' + (doc.active ? " checked" : "") + '> Show the banner</label>' +
      '<div class="ac-row" style="margin-top:10px"><button class="acct-btn" type="submit">Save banner</button><button class="acct-btn ghost sm" type="button" id="anPrev">Preview here</button><span class="acct-small" id="anMsg" role="status"></span></div></form>';
    function opts(cur){
      var list = AN_TAGS.indexOf(cur) < 0 && cur ? AN_TAGS.concat([cur]) : AN_TAGS;
      return list.map(function(t){ return '<option value="' + esc(t) + '"' + (t === cur ? " selected" : "") + '>' + esc(t) + '</option>'; }).join("");
    }
    function read(){
      return Array.prototype.map.call($("anList").querySelectorAll(".an-row"), function(row){
        return {tag:row.querySelector(".an-tag").value, text:row.querySelector(".an-txt").value.trim().slice(0, 160), active:true};
      });
    }
    function draw(){
      $("anList").innerHTML = items.map(function(x, i){
        return '<div class="an-row" data-i="' + i + '"><select class="ac-in an-tag" aria-label="Tag for line ' + (i + 1) + '">' + opts(x.tag) + '</select>' +
          '<input class="ac-in an-txt" type="text" maxlength="160" value="' + esc(x.text) + '" placeholder="' + (i ? "Skibidi Strike \u2014 Beta" : "Google sign-in is live") + '" aria-label="Text for line ' + (i + 1) + '">' +
          '<span class="an-btns"><button type="button" class="acct-btn ghost sm" data-up="' + i + '" aria-label="Move line ' + (i + 1) + ' up"' + (i ? "" : " disabled") + '>&uarr;</button>' +
          '<button type="button" class="acct-btn ghost sm" data-del="' + i + '" aria-label="Remove line ' + (i + 1) + '">&times;</button></span></div>';
      }).join("") || '<p class="acct-small">No lines yet. Add one below.</p>';
    }
    draw();
    $("anList").onclick = function(e){
      var b = e.target.closest("button"); if(!b) return;
      items = read();
      if(b.hasAttribute("data-del")){ items.splice(+b.getAttribute("data-del"), 1); }
      else if(b.hasAttribute("data-up")){ var k = +b.getAttribute("data-up"); if(k > 0){ var t = items[k]; items[k] = items[k - 1]; items[k - 1] = t; } }
      draw();
    };
    $("anAdd").onclick = function(){ items = read(); if(items.length >= 8){ $("anMsg").textContent = "8 lines max"; return; } items.push({tag:"NEW GAME", text:"", active:true}); draw(); var all = $("anList").querySelectorAll(".an-txt"); if(all.length) all[all.length - 1].focus(); };
    $("anPrev").onclick = function(){
      var list = read().filter(function(x){ return x.text; });
      if(window.TTVM_TICKER) window.TTVM_TICKER.show({id:"preview", items:list.length ? list : anItems(doc), active:true}, true);
      window.scrollTo({top:0, behavior:"smooth"});
    };
    $("anForm").onsubmit = function(e){
      e.preventDefault();
      var list = read().filter(function(x){ return x.text; }), on = $("anOn").checked;
      if(on && !list.length){ $("anMsg").textContent = "Add at least one line first"; return; }
      T.save("announce", function(d2){
        if(anSig(anItems(d2)) !== anSig(list) || (on && !d2.active)) d2.id = "u" + Date.now().toString(36);   // anything changed: it shows again for people who closed it
        d2.items = list; d2.active = on;
        d2.text = list.map(function(x){ return x.tag + ": " + x.text; }).join("  \u00b7  ");   // older pages still read the single line
      }, "Update banner: " + (on ? list.map(function(x){ return x.tag; }).join(", ") : "off")).then(function(res){
        savedMsg(res, on ? "Banner saved" : "Banner turned off");
        $("anMsg").textContent = res.saved === "live" ? "Saved. Live for everyone in about a minute." : res.saved === "studio" ? "Saved to the studio copy." : "Not saved yet (needs your GitHub key on this device).";
        items = list.length ? list : items;
        if(window.TTVM_TICKER) window.TTVM_TICKER.show(res.doc, true);
      }, function(err){ $("anMsg").textContent = err.message; });
    };
  });
}

// =============================== community ===============================
function community(S){
  T.data("community", true).then(function(doc){
    var canDel = T.RANK[T.effectiveRole()] >= 3 && !S.restricted;
    var posts = doc.posts.slice().sort(function(a, b){ return T.ms(b.date) - T.ms(a.date); });
    $("cmList").innerHTML = posts.length ? posts.map(function(p){
      return '<article class="cm-post">' + T.avatar({h:"p" + p.name, name:p.name}) + '<div style="flex:1;min-width:0"><div class="who"><b>' + esc(p.name) + '</b>' + (p.role && p.role !== "user" ? T.roleTag(p.role, true) : "") +
        '<time>' + esc(T.when(p.date)) + '</time>' + (canDel ? '<button type="button" class="cm-del" data-del="' + esc(p.id) + '">Remove</button>' : "") + '</div><p>' + esc(p.text) + '</p></div></article>';
    }).join("") : '<p class="pf-empty">No posts yet.</p>';
    Array.prototype.forEach.call(document.querySelectorAll("[data-del]"), function(b){
      b.onclick = function(){
        var id = b.getAttribute("data-del");
        if(!confirm("Remove this post?")) return;
        T.save("community", function(d){ d.posts = d.posts.filter(function(x){ return x.id !== id; }); }, "Remove community post").then(function(res){ savedMsg(res, "Post removed"); community(T.state); });
      };
    });
  });
  var box = $("cmCompose");
  if(S.restricted){ box.innerHTML = T.blockHtml("post on the community board"); return; }
  if(!S.session){ box.innerHTML = '<p>Sign in with Google to post on the board.</p><div class="ac-row" style="margin-top:10px"><a class="acct-btn" href="../signin/?next=' + encodeURIComponent(location.pathname) + '">Sign in</a></div>'; return; }
  box.innerHTML = '<form class="cm-form" id="cmForm"><label class="acct-small" for="cmText">Posting as <b style="color:#fff">' + esc(T.me().name) + '</b></label>' +
    '<textarea id="cmText" maxlength="500" placeholder="Share an idea, a clip link, a bug..." required style="margin-top:6px"></textarea>' +
    '<div class="ac-row" style="margin-top:10px"><button class="acct-btn" type="submit">Post</button><span class="acct-small" id="cmMsg" role="status">The studio checks new posts before they show up. Be nice: 3 warnings is a ban.</span></div></form>';
  $("cmForm").onsubmit = function(e){
    e.preventDefault();
    var text = $("cmText").value.trim(); if(!text) return;
    var me = T.me(), msg = $("cmMsg");
    if(T.allowed("staff") && T.token()){
      T.save("community", function(d){ d.posts.unshift({id:"p" + Date.now().toString(36), name:me.name, role:T.effectiveRole(), date:T.iso(), text:text.slice(0, 500)}); }, "Community post from " + me.name)
        .then(function(res){ savedMsg(res, "Posted"); $("cmText").value = ""; community(T.state); });
      return;
    }
    msg.textContent = "Sending...";
    fetch("https://api.web3forms.com/submit", {method:"POST", headers:{"Content-Type":"application/json", "Accept":"application/json"},
      body:JSON.stringify({access_key:SUG_KEY, subject:"Community post from " + me.name, from_name:"TTVM Studios site", name:me.name, account:(S.session.hint || ""), post:text, page:location.href})})
      .then(function(r){ return r.json(); }).then(function(dd){
        msg.textContent = dd && dd.success ? "Sent! It shows up here once the studio checks it." : "Didn't go through. Try again in a minute.";
        if(dd && dd.success) $("cmText").value = "";
      }).catch(function(){ msg.textContent = "Didn't go through. Try again in a minute."; });
  };
}

// =============================== panels ===============================
var P = {files:null, tab:"all", extra:{}, open:null};
var FILES = ["roles", "moderation", "profiles", "activity", "notices", "team"];
function loadFiles(fresh){ return Promise.all(FILES.map(function(n){ return T.data(n, fresh); })).then(function(f){ P.files = f; return f; }); }
function people(){
  var roles = P.files[0], mod = P.files[1], profs = P.files[2], act = P.files[3], seen = T.localSeen(), map = {};
  function add(h, name, hint){ if(!h) return null; var p = map[h] || (map[h] = {h:h}); if(name && !p.name) p.name = name; if(hint && !p.hint) p.hint = hint; return p; }
  ["owners", "mods", "devs"].forEach(function(k){ roles[k].forEach(function(x){ add(x.h, x.name, x.hint); }); });
  Object.keys(mod.people).forEach(function(h){ add(h, mod.people[h].name, mod.people[h].hint); });
  Object.keys(profs.people).forEach(function(h){ add(h, profs.people[h].name); });
  Object.keys(act.people).forEach(function(h){ add(h, act.people[h].name); });
  Object.keys(seen).forEach(function(h){ add(h, seen[h].name); });
  Object.keys(P.extra).forEach(function(h){ add(h, P.extra[h].name, P.extra[h].hint); });
  return Object.keys(map).map(function(h){
    var p = map[h], m = mod.people[h] || {}, a = act.people[h] || (seen[h] ? seen[h] : {}) || {};
    p.role = T.roleOf(h, roles); p.mod = m; p.act = a; p.prof = profs.people[h] || {};
    p.name = (p.prof.name || p.name || "Unknown");
    // owners are protected: nothing in data/moderation.json ever applies to them
    p.prot = T.isProtected(h, roles);
    p.R = p.prot ? null : T.restriction(m, h); p.warns = p.prot ? [] : T.activeWarnings(m, h);
    p.notices = p.prot ? T.activeNotices(P.files[4], h) : [];
    p.last = a.last || null;
    return p;
  }).sort(function(a, b){ return (T.RANK[b.role] - T.RANK[a.role]) || (T.ms(b.last) - T.ms(a.last)); });
}
function statusOf(p){
  if(p.prot) return p.notices && p.notices.length ? ["warn", "Copyright notice"] : ["ok", "Protected owner"];
  if(p.R) return p.R.kind === "cut" ? ["bad", "Cut off"] : p.R.kind === "pause" ? ["pause", "Paused"] : ["bad", p.R.until ? "Banned" : "Banned"];
  if(p.warns.length) return ["warn", p.warns.length + "/3 warnings"];
  return ["ok", "Good"];
}
function spark(days){
  days = days || {}; var out = "", max = 1, vals = [];
  for(var i = 6; i >= 0; i--){ var k = new Date(Date.now() - i * DAY).toISOString().slice(0, 10); vals.push(days[k] || 0); }
  vals.forEach(function(v){ if(v > max) max = v; });
  vals.forEach(function(v){ out += '<i class="' + (v ? "" : "z") + '" style="height:' + Math.max(2, Math.round(v / max * 22)) + 'px"></i>'; });
  return '<span class="pn-spark" title="Activity, last 7 days">' + out + '</span>';
}
function canAct(actor, p){ return T.RANK[actor] >= 3 && p.role !== "owner" && !p.prot && !T.isProtected(p.h) && T.RANK[actor] > T.RANK[p.role] && p.h !== T.state.h; }

function panel(S){
  // Only a signed-in owner / moderator / dev (data/roles.json) gets past here. Everyone else only ever
  // sees the lock card from acct.js, and no people, warnings or activity data is fetched for them.
  if(!T.allowed("staff") || !$("pnRoot")) return;
  loadFiles(false).then(function(){ if(T.allowed("staff")){ draw(S); openFromUrl(); } });
}
function roleList(){
  return '<li><i class="acct-role r-owner">OWNER</i><span>Everything. Can switch between Owner mode and Dev mode.</span></li>' +
    '<li><i class="acct-role r-mod">MOD</i><span>Moderator devs: everything devs have, plus warn, kick, pause and ban devs and members.</span></li>' +
    '<li><i class="acct-role r-dev">DEV</i><span>Help with the site and games; limited customizing.</span></li>' +
    '<li><i class="acct-role r-user">MEMBER</i><span>Signed in with Google. Own profile, can post.</span></li>' +
    '<li><i class="acct-role r-guest">GUEST</i><span>Not signed in. Can look around and play.</span></li>';
}
function draw(S){
  if(!T.allowed("staff")) return;
  var r = T.effectiveRole(), root = $("pnRoot"), list = people();
  var title = r === "owner" ? "Owner" : r === "mod" ? "Moderator" : "Dev";
  var h = '<div class="pn-top"><h1 class="ac-h1">' + title + ' <span>panel</span></h1><span class="pn-badge ' + r + '">' + title.toUpperCase() + '</span>' +
    (r === "owner" && T.canSwitchMode() ? '<button type="button" class="acct-btn ghost sm" id="pnSwap" style="margin-left:auto">Switch to Dev mode</button>' : "") + '</div>';
  if(r === "dev"){
    root.innerHTML = h + devPanel(S);
    wireSwap(S); return;
  }
  var today = new Date().toISOString().slice(0, 10);
  var activeToday = list.filter(function(p){ return p.act && p.act.days && p.act.days[today]; }).length;
  var staff = list.filter(function(p){ return T.RANK[p.role] >= 3; }).length;
  var restricted = list.filter(function(p){ return p.R; }).length;
  var warned = list.filter(function(p){ return p.warns.length && !p.R; }).length;
  h += '<div class="pn-stats"><div class="pn-stat"><b>' + list.length + '</b><span>People</span></div><div class="pn-stat"><b>' + activeToday + '</b><span>Active today</span></div>' +
    '<div class="pn-stat"><b>' + warned + '</b><span>Warned</span></div><div class="pn-stat"><b>' + restricted + '</b><span>Banned / paused</span></div></div>';
  var tabs = [["all", "Everyone"], ["staff", "Mods & owners"], ["devs", "Devs"], ["warned", "Warned"], ["restricted", "Banned / paused"]];
  if(r === "owner") tabs.push(["log", "Recent actions"]);
  h += '<div class="pn-tabs" role="tablist">' + tabs.map(function(t){ return '<button type="button" data-tab="' + t[0] + '" class="' + (P.tab === t[0] ? "on" : "") + '">' + t[1] + '</button>'; }).join("") + '</div>';
  if(P.tab === "log"){
    var log = (P.files[1].log || []).slice(0, 60);
    h += '<div class="ac-card">' + (log.length ? '<ul class="pf-list">' + log.map(function(l){ return '<li><b style="color:#fff;font-weight:600">' + esc(l.by) + '</b> ' + esc(l.what) + ' <span>' + esc(T.when(l.date)) + '</span></li>'; }).join("") + '</ul>' : '<p class="pf-empty">No actions yet.</p>') + '</div>';
  } else {
    var shown = list.filter(function(p){
      return P.tab === "all" || (P.tab === "staff" && T.RANK[p.role] >= 3) || (P.tab === "devs" && p.role === "dev") || (P.tab === "warned" && p.warns.length) || (P.tab === "restricted" && p.R);
    });
    if(P.tab === "all" || P.tab === "staff"){
      var tm = T.teamHtml((P.files[5] || {}).team);
      if(tm) h += '<div class="ac-card pn-team"><h2 class="ac-h2">Studio team</h2>' + tm + '<p class="pf-note">Shown in the Team section on the site. These are display entries: they don\'t sign in here and don\'t change anyone\'s permissions.</p></div>';
    }
    h += '<ul class="pn-list">' + (shown.length ? shown.map(function(p){
      var st = statusOf(p);
      return '<li><button type="button" class="pn-row" data-h="' + esc(p.h) + '">' + T.avatar({h:p.h, name:p.name, picture:p.prof.picture || (p.h === T.state.h ? T.me().picture : "")}) +
        '<span class="pn-who"><b>' + esc(p.name) + ' ' + (p.role !== "user" ? T.roleTag(p.role, true) : "") + '</b><span>Last seen ' + esc(T.when(p.last)) + (p.hint ? " \u00b7 " + esc(p.hint) : "") + '</span></span>' +
        spark(p.act.days) + '<span class="pn-st ' + st[0] + '">' + esc(st[1]) + '</span></button></li>';
    }).join("") : '<li style="padding:16px" class="pf-empty">Nobody here.</li>') + '</ul>';
    h += '<div class="ac-card" style="margin-top:14px"><h2 class="ac-h2">Add someone</h2><p class="acct-small" style="margin-bottom:10px">Type their Google email to warn, ban or give them a role. Only a fingerprint of the email is saved, never the email itself.</p>' +
      '<form class="ac-row" id="pnAdd"><input class="ac-in" style="flex:2;min-width:200px" id="pnAddEmail" type="email" placeholder="their.email@gmail.com" required><input class="ac-in" style="flex:1;min-width:140px" id="pnAddName" type="text" maxlength="32" placeholder="Name to show"><button class="acct-btn" type="submit">Add</button></form></div>';
    h += '<p class="pf-note" style="margin-top:14px">' + (T.token() ? "Saving is on: changes save to the site's files." : 'Changes need your GitHub key on this device to save (the same key as Chats). Without it you get a copy to send to Titan.') +
      ' Activity shows for staff and for anyone who signed in on this device.</p>';
  }
  root.innerHTML = h;
  wireSwap(S);
  Array.prototype.forEach.call(root.querySelectorAll("[data-tab]"), function(b){ b.onclick = function(){ P.tab = b.getAttribute("data-tab"); draw(T.state); }; });
  Array.prototype.forEach.call(root.querySelectorAll("[data-h]"), function(b){ b.onclick = function(){ openDrawer(b.getAttribute("data-h")); }; });
  var add = $("pnAdd");
  if(add) add.onsubmit = function(e){
    e.preventDefault();
    var em = $("pnAddEmail").value.trim(), nm = $("pnAddName").value.trim();
    T.emailHash(em).then(function(h){ P.extra[h] = {name:nm || em.split("@")[0], hint:T.maskEmail(em)}; draw(T.state); openDrawer(h); });
  };
}
function wireSwap(S){ var s = $("pnSwap"); if(s) s.onclick = function(){ T.setMode("dev"); }; }
function devPanel(S){
  return '<div class="ac-card"><h2 class="ac-h2">Dev help</h2><div class="pn-help">' +
    '<p><b>What devs can do.</b> Help build the games and the site, use the page editor and try experimental features. Moderating people is for moderators and the owner.</p>' +
    '<p><b>Page editor.</b> Change words, buttons, colours and the announcement bar on the home page. Edits show on your device; send them to Titan to make them live for everyone.</p>' +
    '<p><b>Experiments.</b> Turn on preview features before they launch, for Skibidi Strike and the site.</p>' +
    '<p><b>Need something bigger?</b> Ask the owner or a moderator. Roles and bans can only be changed by them.</p></div>' +
    '<div class="ac-row" style="margin-top:6px"><a class="acct-btn" href="../dev.html">Open the page editor</a><a class="acct-btn ghost" href="experiments.html">Experiments</a><a class="acct-btn ghost" href="community.html">Community board</a></div></div>';
}
function openFromUrl(){ var m = /[?&]u=([a-z0-9-]+)/.exec(location.search); if(m) openDrawer(m[1]); }

// ---------- one person ----------
function openDrawer(h){
  if(!T.allowed("staff")) return;
  var S = T.state, list = people(), p = list.filter(function(x){ return x.h === h; })[0];
  if(!p){ p = {h:h, name:"Unknown", role:"user", mod:{}, act:{}, prof:{}, warns:[], R:null}; }
  P.open = h;
  var dr = $("pnDrawer"), act = canAct(T.effectiveRole(), p), owner = T.effectiveRole() === "owner";
  var st = statusOf(p);
  var x = '<div class="pn-sheet" role="dialog" aria-modal="true" aria-label="' + esc(p.name) + '"><div class="ac-row" style="justify-content:space-between"><a class="acct-btn ghost sm" href="../profile/?u=' + encodeURIComponent(h) + '">Open site profile</a><button type="button" class="acct-btn ghost sm" id="pnClose">Close</button></div>' +
    '<div class="ac-row" style="margin-top:16px;flex-wrap:nowrap">' + T.avatar({h:h, name:p.name, picture:p.prof.picture || (h === T.state.h ? T.me().picture : "")}, "lg") + '<div style="min-width:0"><b style="font:700 1.3rem var(--ac-ui);letter-spacing:.06em;text-transform:uppercase;color:#fff">' + esc(p.name) + '</b> ' + T.roleTag(p.role) +
    '<div class="acct-small">' + esc(p.hint || "") + (p.hint ? " \u00b7 " : "") + 'last seen ' + esc(T.when(p.last)) + '</div></div></div>' +
    '<div class="ac-row" style="margin-top:12px"><span class="pn-st ' + st[0] + '">' + esc(st[1]) + '</span>' + spark(p.act.days) + '<span class="acct-small">last 7 days</span></div>';
  if(p.R) x += '<div class="pn-confirm" style="border-color:rgba(255,90,74,.5);background:rgba(255,51,36,.06)"><b>' + (p.R.kind === "cut" ? "Cut off from the site" : p.R.kind === "pause" ? "Paused " + esc(T.until(p.R.until)) : "Banned " + esc(T.until(p.R.until))) + '</b>' +
    (p.R.reason ? '<div class="acct-small">Reason: ' + esc(p.R.reason) + ' \u00b7 by ' + esc(p.R.by || "?") + '</div>' : "") + (p.R.pendingOwner ? '<div class="acct-small" style="color:#ffd933">Waiting for the owner to pick how long.</div>' : "") + '</div>';
  if(p.prot){
    x += '<div class="pn-sec pn-prot"><h4>Protected owner account</h4><p>Owner accounts can\'t be warned, paused, kicked, restricted or banned. Nothing in the moderation file ever applies to them.</p></div>';
    x += copySec(p, owner);
  } else {
  // warnings
  x += '<div class="pn-sec"><h4>Warnings (' + p.warns.length + ' of 3)</h4>' + (p.warns.length ? '<ul class="acct-wlist">' + p.warns.map(T.warnItem).join("") + '</ul>' : '<p class="pf-empty">None.</p>');
  }
  if(act && !p.prot) x += '<form id="pnWarn" style="margin-top:10px"><input class="ac-in" id="pnWarnWhy" maxlength="200" placeholder="Reason (they will see this)" required><div class="ac-row" style="margin-top:8px"><button class="acct-btn" type="submit">Give warning</button>' + (owner && p.warns.length ? '<button class="acct-btn ghost sm" type="button" id="pnClearW">Clear warnings</button>' : "") + '</div><div id="pnWarnDur"></div></form>';
  if(!p.prot) x += '</div>';
  if(act){
    x += '<div class="pn-sec"><h4>Moderation</h4><input class="ac-in" id="pnWhy" maxlength="200" placeholder="Reason (shown to them)"><div class="acct-small" style="margin:10px 0 2px">How long</div>' + durPicker("pnDur") +
      '<div class="pn-acts" style="margin-top:10px"><button type="button" class="acct-btn ghost sm" data-act="kick">Kick (sign out)</button><button type="button" class="acct-btn ghost sm" data-act="pause">Pause activity</button>' +
      '<button type="button" class="acct-btn sm" data-act="temp">Temp ban</button><button type="button" class="acct-btn sm" data-act="perm" style="background:#5a0f0a">Cut off for good</button>' +
      (p.R && (owner || p.R.kind !== "cut") ? '<button type="button" class="acct-btn gold sm" data-act="lift">Lift ' + (p.R.kind === "pause" ? "pause" : "ban") + '</button>' : "") + '</div>' +
      '<p class="pf-note">Pause = can look around but can\'t play, chat, post or edit. Kick = signs them out once.</p></div>';
  } else if(p.role === "owner" || p.prot){
    // (the protected-owner note above already says it)
  } else if(!owner){
    x += '<div class="pn-sec"><p class="pf-empty">Moderators can act on members and devs only.</p></div>';
  }
  if(owner && p.h !== S.h && !T.isLockedOwner(p.h)){
    x += '<div class="pn-sec"><h4>Role</h4><div class="pn-acts">' +
      (p.role !== "user" ? '<button type="button" class="acct-btn ghost sm" data-role="user">Make member</button>' : "") +
      (p.role !== "dev" ? '<button type="button" class="acct-btn ghost sm" data-role="dev">' + (p.role === "mod" ? "Demote to dev" : "Make dev") + '</button>' : "") +
      (p.role !== "mod" ? '<button type="button" class="acct-btn gold sm" data-role="mod">Promote to moderator</button>' : "") +
      (p.role !== "owner" ? '<button type="button" class="acct-btn gold sm" data-role="owner">Promote to owner</button>' : "") + '</div><div id="pnRoleConfirm"></div></div>';
  }
  dr.innerHTML = x; dr.hidden = false;
  document.body.style.overflow = "hidden";
  $("pnClose").onclick = closeDrawer;
  dr.onclick = function(e){ if(e.target === dr) closeDrawer(); };
  wireDur("pnDur");
  var wf = $("pnWarn");
  if(wf) wf.onsubmit = function(e){ e.preventDefault(); warn(p, $("pnWarnWhy").value.trim()); };
  var cw = $("pnClearW"); if(cw) cw.onclick = function(){ commit(p, "cleared warnings for", function(m){ (m.warnings || []).forEach(function(w){ w.cleared = true; }); }); };
  Array.prototype.forEach.call(dr.querySelectorAll("[data-act]"), function(b){ b.onclick = function(){ modAct(p, b.getAttribute("data-act")); }; });
  Array.prototype.forEach.call(dr.querySelectorAll("[data-role]"), function(b){ b.onclick = function(){ roleAct(p, b.getAttribute("data-role")); }; });
  wireCopy(p);
}
// ---------- copyright notices: owner-only, on owner accounts, a warning card (never a ban) ----------
function copySec(p, canEdit){
  var ns = p.notices || [];
  var x = '<div class="pn-sec"><h4>Copyright notices (' + ns.length + ')</h4>';
  x += ns.length ? '<ul class="pn-cr">' + ns.map(function(n){
    return '<li><b>' + esc(n.title || "Untitled") + '</b><span class="acct-small">' + esc(n.details || "") + '</span><span class="acct-small">Posted ' + esc(T.when(n.date)) + ' by ' + esc(n.by || "the owner") + '</span>' +
      (canEdit ? '<button type="button" class="acct-btn ghost sm" data-crclear="' + esc(n.id) + '">Clear notice</button>' : "") + '</li>';
  }).join("") + '</ul>' : '<p class="pf-empty">None.</p>';
  if(canEdit){
    x += '<form id="pnCr" class="pn-crform"><p class="acct-small">Only for a real copyright claim with proof that could cost money. It shows a big warning card on this profile. It never bans or restricts the account.</p>' +
      '<input class="ac-in" id="pnCrTitle" maxlength="80" placeholder="Title (e.g. the video or song it\'s about)" required>' +
      '<textarea class="ac-in" id="pnCrDetails" maxlength="400" rows="3" placeholder="Details: who claimed it, what it\'s about, what happens next" style="margin-top:8px"></textarea>' +
      '<label class="acct-small" style="display:flex;gap:8px;align-items:center;margin-top:8px"><input type="checkbox" id="pnCrProof"> There is a real claim with proof</label>' +
      '<div class="ac-row" style="margin-top:8px"><button class="acct-btn gold sm" type="submit" id="pnCrGo" disabled>Add copyright notice</button></div></form>';
  } else {
    x += '<p class="pf-note">Only an owner can add or clear these.</p>';
  }
  return x + '</div>';
}
function wireCopy(p){
  var S = T.state, f = $("pnCr");
  function ok(){ return T.effectiveRole() === "owner" && p.prot; }
  if(f){
    $("pnCrProof").onchange = function(){ $("pnCrGo").disabled = !this.checked; };
    f.onsubmit = function(e){
      e.preventDefault();
      var title = $("pnCrTitle").value.trim(), details = $("pnCrDetails").value.trim();
      if(!ok() || !title || !$("pnCrProof").checked) return;
      commit(p, "added a copyright notice for", function(doc){
        var e2 = doc.people[p.h] || (doc.people[p.h] = {name:p.name, notices:[]});
        e2.notices = e2.notices || [];
        e2.notices.push({id:"c" + Date.now().toString(36), type:"copyright", title:title.slice(0, 80), details:details.slice(0, 400), by:me(), date:T.iso()});
      }, "notices");
    };
  }
  Array.prototype.forEach.call(document.querySelectorAll("[data-crclear]"), function(b){
    b.onclick = function(){
      if(!ok() || !confirm("Clear this copyright notice?")) return;
      var id = b.getAttribute("data-crclear");
      commit(p, "cleared a copyright notice for", function(doc){
        var e2 = doc.people[p.h]; if(!e2) return;
        (e2.notices || []).forEach(function(n){ if(n.id === id){ n.cleared = true; n.clearedBy = me(); n.clearedAt = T.iso(); } });
      }, "notices");
    };
  });
}
function closeDrawer(){ var dr = $("pnDrawer"); dr.hidden = true; dr.innerHTML = ""; document.body.style.overflow = ""; P.open = null; }
function durPicker(id){
  var opts = [[HOUR, "1 hour"], [6 * HOUR, "6 hours"], [DAY, "1 day"], [7 * DAY, "1 week"], [30 * DAY, "1 month"], ["c", "Custom"]];
  return '<div class="pn-dur" id="' + id + '">' + opts.map(function(o, i){ return '<button type="button" data-ms="' + o[0] + '" aria-pressed="' + (i === 2 ? "true" : "false") + '">' + o[1] + '</button>'; }).join("") + '</div>' +
    '<div class="pn-custom" id="' + id + 'C" hidden><input class="ac-in" type="number" min="1" max="999" value="3" id="' + id + 'N"><select id="' + id + 'U"><option value="' + HOUR + '">hours</option><option value="' + DAY + '" selected>days</option><option value="' + 7 * DAY + '">weeks</option></select></div>';
}
function wireDur(id){
  var box = $(id); if(!box) return;
  Array.prototype.forEach.call(box.querySelectorAll("button"), function(b){ b.onclick = function(){
    Array.prototype.forEach.call(box.querySelectorAll("button"), function(x){ x.setAttribute("aria-pressed", String(x === b)); });
    $(id + "C").hidden = b.getAttribute("data-ms") !== "c";
  }; });
}
function durOf(id){
  var on = document.querySelector("#" + id + " [aria-pressed=true]"); if(!on) return DAY;
  var v = on.getAttribute("data-ms"); if(v !== "c") return +v;
  return Math.max(1, +$(id + "N").value || 1) * (+$(id + "U").value);
}
function durText(ms){ var d = ms / DAY; return d >= 1 ? (Math.round(d * 10) / 10) + (d === 1 ? " day" : " days") : Math.round(ms / HOUR) + " hours"; }
function me(){ return T.me().name; }
function commit(p, what, change, file){
  file = file || "moderation";
  // owners can never be warned, paused, kicked or banned; notices are owner-only
  if(file === "moderation" && (p.prot || T.isProtected(p.h))){ T.toast("Owner accounts can't be warned or banned"); return Promise.resolve(); }
  if(file === "notices" && T.effectiveRole() !== "owner"){ T.toast("Only an owner can do that"); return Promise.resolve(); }
  var by = me(), msg = by + " " + what + " " + p.name;
  return T.save(file, function(doc){
    if(file === "moderation"){
      var m = doc.people[p.h] || (doc.people[p.h] = {});
      m.name = m.name || p.name; if(p.hint) m.hint = m.hint || p.hint;
      m.warnings = m.warnings || [];
      change(m, doc);
      doc.log = [{date:T.iso(), by:by, what:what + " " + p.name}].concat(doc.log || []).slice(0, 200);
    } else change(doc);
  }, msg).then(function(res){
    savedMsg(res, cap(what) + " " + p.name);
    if(res.saved !== "none"){ var idx = FILES.indexOf(file); if(idx >= 0) P.files[idx] = res.doc; }
    var h = p.h; draw(T.state); openDrawer(h);
  });
}
function cap(s){ return s.charAt(0).toUpperCase() + s.slice(1); }
function warn(p, reason){
  if(!reason){ T.toast("Add a reason first"); return; }
  var S = T.state, owner = T.effectiveRole() === "owner";
  var willBan = p.warns.length + 1 >= 3 && !p.R, bans = p.mod.bans || 0;
  var box = $("pnWarnDur");
  if(willBan && bans >= 1 && owner && !box.getAttribute("data-ready")){
    box.setAttribute("data-ready", "1");
    box.innerHTML = '<div class="pn-confirm"><b>That\'s their 3rd warning, and they\'ve been banned before.</b><p class="acct-small">This ban is timed. Pick how long:</p>' + durPicker("pnWDur") + '<button class="acct-btn sm" type="submit" style="margin-top:8px">Warn + ban</button></div>';
    wireDur("pnWDur"); return;
  }
  var dur = box && box.getAttribute("data-ready") ? durOf("pnWDur") : 0;
  commit(p, willBan ? "warned and banned" : "warned", function(m){
    m.warnings.push({id:"w" + Date.now().toString(36), reason:reason, by:me(), date:T.iso()});
    if(!willBan) return;
    var n = (m.bans || 0) + 1; m.bans = n;
    if(n === 1) m.ban = {type:"warnban", until:null, reason:"3 warnings. Banned until the owner lifts it.", by:me(), date:T.iso()};
    else if(dur) m.ban = {type:"temp", until:T.iso(Date.now() + dur), reason:"3 warnings (ban #" + n + ", " + durText(dur) + ")", by:me(), date:T.iso()};
    else m.ban = {type:"warnban", until:null, pendingOwner:true, reason:"3 warnings (ban #" + n + "). The owner picks how long.", by:me(), date:T.iso()};
  });
}
function modAct(p, a){
  var why = ($("pnWhy").value || "").trim(), dur = durOf("pnDur"), by = me(), now = T.iso();
  if(a === "kick") return commit(p, "kicked", function(m){ m.kickAt = now; });
  if(a === "pause") return commit(p, "paused (" + durText(dur) + ")", function(m){ m.paused = {until:T.iso(Date.now() + dur), reason:why || "Paused by a moderator", by:by, date:now}; });
  if(a === "temp") return commit(p, "banned (" + durText(dur) + ")", function(m){ m.ban = {type:"temp", until:T.iso(Date.now() + dur), reason:why || "Temporary ban", by:by, date:now}; m.bans = (m.bans || 0) + 1; });
  if(a === "perm"){
    if(!confirm("Cut " + p.name + " off from the site for good? Only the owner can undo this.")) return;
    return commit(p, "cut off", function(m){ m.ban = {type:"perm", until:null, reason:why || "Cut off from the site", by:by, date:now}; m.bans = (m.bans || 0) + 1; });
  }
  if(a === "lift") return commit(p, "lifted the ban/pause for", function(m){
    var fromWarns = m.ban && /warning/i.test(m.ban.reason || "");
    m.ban = null; m.paused = null;
    if(fromWarns) (m.warnings || []).forEach(function(w){ w.cleared = true; });
  });
}
function roleAct(p, role){
  if(role === "mod" || role === "owner"){
    var box = $("pnRoleConfirm");
    box.innerHTML = '<div class="pn-confirm"><b>Promote ' + esc(p.name) + ' to ' + (role === "owner" ? "owner" : "moderator") + '?</b>' +
      '<p class="acct-small">' + (role === "owner" ? "Owners can do everything, including changing roles." : "Moderators can warn, kick, pause and ban members and devs.") + '</p>' +
      '<label><input type="checkbox" id="pnVer"> I verified this with Titan and UTC first.</label>' +
      '<div class="ac-row"><button type="button" class="acct-btn gold sm" id="pnRoleGo" disabled>Promote</button><button type="button" class="acct-btn ghost sm" id="pnRoleNo">Cancel</button></div></div>';
    $("pnVer").onchange = function(){ $("pnRoleGo").disabled = !this.checked; };
    $("pnRoleNo").onclick = function(){ box.innerHTML = ""; };
    $("pnRoleGo").onclick = function(){ setRole(p, role); };
    box.scrollIntoView({block:"nearest"});
    return;
  }
  setRole(p, role);
}
function setRole(p, role){
  if(T.isLockedOwner(p.h) && role !== "owner"){ T.toast("This owner account always stays owner"); return; }
  var label = {user:"made a member", dev:p.role === "mod" ? "demoted to dev" : "made a dev", mod:"promoted to moderator", owner:"promoted to owner"}[role];
  commit(p, label + ":", function(doc){
    ["owners", "mods", "devs"].forEach(function(k){ doc[k] = doc[k].filter(function(x){ return x.h !== p.h; }); });
    var k = {owner:"owners", mod:"mods", dev:"devs"}[role];
    if(k) doc[k].push({h:p.h, name:p.name, hint:p.hint || ""});
    if(!doc.owners.length) throw new Error("There has to be at least one owner.");
  }, "roles");
}

// =============================== start ===============================
var started = false;
T.on(function(S){
  if(PAGE === "hub") hub(S);
  if(PAGE === "community") community(S);
  if(PAGE === "panel"){ if(!started || !P.open) panel(S); }
  started = true;
});
document.addEventListener("keydown", function(e){ if(e.key === "Escape" && P.open) closeDrawer(); });
})();
