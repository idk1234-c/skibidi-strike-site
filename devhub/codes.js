/* Dev hub: REDEEM CODES (Nov 3, Titan TV Man)
 * Make codes that unlock a character / Titan (or everything) in Skibidi Strike, for devs, moderators,
 * family testers or a special-time deal. The game's REDEEM CODE box checks them.
 *
 * Where things are saved (with the GitHub key this device already uses for the Chats page):
 *  - codes/codes.json in the PUBLIC site repo  -> what the game downloads. Fingerprints (hashes) only,
 *    never the codes themselves.
 *  - website/codes/codes.json in the studio repo -> the same file, so the site mirror stays in sync.
 *  - codes/codes_private.json in the studio repo (private, NOT inside website/) -> the real codes, so the
 *    owner can look one up again later.
 * The fingerprint is SHA-256 of SALT + the code in capitals with only letters and numbers.
 * SALT must match CodeRedeemer.Salt in the game (Assets/Scripts/Unlocks/CodeRedeemer.cs).
 */
(function(){
"use strict";
var T = window.TTVM, esc = T.esc, $ = function(id){ return document.getElementById(id); };
var SALT = "SKIBIDI-STRIKE|REDEEM|v1|";
var API = "https://api.github.com/repos/";
var FILES = {
  priv:   {repo:"idk1234-c/skibidi-strike",      path:"codes/codes_private.json"},
  mirror: {repo:"idk1234-c/skibidi-strike",      path:"website/codes/codes.json"},
  pub:    {repo:"idk1234-c/skibidi-strike-site", path:"codes/codes.json"}
};
var ALPH = "ABCDFGHJKMNPQRSTVWXYZ23456789";   // no 0/O, 1/I/L, E, U: easy to read out loud

// what a code can unlock: the game's own ids (Characters.cs, TitanRoster.cs). "Other..." takes any id.
var UNLOCKS = [
  ["ALL", "EVERYTHING (all characters + all Titans)"],
  ["LaserMech", "LASER MECH"], ["GMan5", "G-MAN 5.0"],
  ["astro", "ASTRO UFO"], ["titan", "ALLIANCE TITAN"], ["speakerman", "SPEAKERMAN"], ["tvman", "TV MAN"],
  ["rocketcam", "ROCKET CAMERAMAN"], ["camerastrider", "CAMERA STRIDER"], ["speakerstrider", "SPEAKER STRIDER"],
  ["tvstrider", "TV STRIDER"], ["camheli", "CAMERA HELI"],
  ["titan_cameraman", "TITAN CAMERAMAN (all versions)"], ["titan_speakerman", "TITAN SPEAKERMAN (all versions)"],
  ["titan_tvman", "TITAN TV MAN (all versions)"], ["alliance_brute", "BRUTE"],
  ["titan_clockman", "TITAN CLOCKMAN"], ["titan_drillman", "TITAN DRILLMAN"], ["video_taper", "VIDEO TAPPER"],
  ["prototype_brute", "PROTOTYPE BRUTE"], ["titan_cameraman_upgraded", "UPGRADED TITAN CAMERAMAN"],
  ["pumpkin_titan_cameraman", "PUMPKIN TITAN CAMERAMAN"], ["frost_titan_speakerman", "FROST TITAN SPEAKERMAN"],
  ["ttvm_lego_titan_1", "LEGO TITAN 1"], ["ttvm_lego_titan_2", "LEGO TITAN 2"]
];
function label(id){ for(var i = 0; i < UNLOCKS.length; i++) if(UNLOCKS[i][0].toLowerCase() === String(id).toLowerCase()) return UNLOCKS[i][1].replace(/ \(.*\)$/, ""); return String(id); }

function normalize(c){ return String(c || "").toUpperCase().replace(/[^A-Z0-9]/g, ""); }
function hex(buf){ return Array.prototype.map.call(new Uint8Array(buf), function(b){ return ("0" + b.toString(16)).slice(-2); }).join(""); }
function hashCode(c){ return crypto.subtle.digest("SHA-256", new TextEncoder().encode(SALT + normalize(c))).then(hex); }
function randomCode(){
  var a = new Uint32Array(12); crypto.getRandomValues(a);
  var s = "SKIB";
  for(var i = 0; i < 12; i++){ if(i % 4 === 0) s += "-"; s += ALPH[a[i] % ALPH.length]; }
  return s;
}
function mask(c){ c = String(c || ""); return c.length <= 8 ? c.replace(/[A-Z0-9]/g, "\u2022") : c.slice(0, 5) + c.slice(5, -4).replace(/[A-Z0-9]/g, "\u2022") + c.slice(-4); }

// ---------- GitHub (the same key the Chats page uses) ----------
function b64(text){ return btoa(unescape(encodeURIComponent(text))); }
function unb64(b){ return decodeURIComponent(escape(atob(String(b).replace(/\s/g, "")))); }
function gh(url, opts){
  opts = opts || {};
  var hd = {"Accept":"application/vnd.github+json", "Authorization":"Bearer " + T.token(), "X-GitHub-Api-Version":"2022-11-28"};
  if(opts.body) hd["Content-Type"] = "application/json";
  return fetch(url, {method:opts.method || "GET", headers:hd, body:opts.body ? JSON.stringify(opts.body) : undefined, cache:"no-store"})
    .then(function(r){ return r.json().catch(function(){ return {}; }).then(function(j){ if(!r.ok){ var e = new Error(j.message || ("HTTP " + r.status)); e.status = r.status; throw e; } return j; }); });
}
function blank(){ return {version:1, codes:[]}; }
function clean(doc){ doc = doc && typeof doc === "object" ? doc : blank(); if(!Array.isArray(doc.codes)) doc.codes = []; doc.version = 1; return doc; }
function read(f){
  return gh(API + f.repo + "/contents/" + f.path + "?ref=main&t=" + Date.now())
    .then(function(j){ return {sha:j.sha, doc:clean(JSON.parse(unb64(j.content)))}; }, function(e){ if(e.status === 404) return {sha:null, doc:blank()}; throw e; });
}
// read, change, write; tries again if someone else saved at the same moment
function rmw(f, change, message){
  var tries = 0;
  function once(){
    tries++;
    return read(f).then(function(r){
      change(r.doc);
      var body = {message:message, content:b64(JSON.stringify(r.doc, null, 2) + "\n"), branch:"main"};
      if(r.sha) body.sha = r.sha;
      return gh(API + f.repo + "/contents/" + f.path, {method:"PUT", body:body}).then(function(){ return r.doc; });
    }).catch(function(e){ if((e.status === 409 || e.status === 422) && tries < 4) return once(); throw e; });
  }
  return once();
}
function pubEntry(x){ var o = {hash:x.hash, unlocks:x.unlocks.slice()}; if(x.expires) o.expires = x.expires; return o; }   // public: no code, no note
function saveAll(addEntry, removeHash, message){
  function edit(isPriv){
    return function(doc){
      if(removeHash) doc.codes = doc.codes.filter(function(c){ return c && c.hash !== removeHash; });
      if(addEntry){ doc.codes = doc.codes.filter(function(c){ return c && c.hash !== addEntry.hash; }); doc.codes.push(isPriv ? addEntry : pubEntry(addEntry)); }
    };
  }
  // private list first (so a code is never live without the owner having it), then the two public copies
  return rmw(FILES.priv, edit(true), message)
    .then(function(){ return rmw(FILES.mirror, edit(false), message); })
    .then(function(){ return rmw(FILES.pub, edit(false), message); });
}

// ---------- page ----------
var list = [];        // private list (with codes) when the key works
var picked = ["ALL"];
var started = false;

function start(S){
  if(started || !T.allowed("mod")) return;
  started = true;
  var root = $("cdRoot");
  var hasKey = !!T.token();
  var opts = UNLOCKS.map(function(u){ return '<option value="' + esc(u[0]) + '">' + esc(u[1]) + '</option>'; }).join("") + '<option value="__other">Other id\u2026</option>';
  root.innerHTML =
    '<h1 class="ac-h1">Redeem codes</h1>' +
    '<p class="ac-lead">Make a code that unlocks a character or Titan in Skibidi Strike, then give it to a dev, a moderator, family, or use it for a special deal. Players type it in <b>REDEEM CODE</b> (main menu or Settings). Each code works once per device.</p>' +
    (hasKey ? "" : '<p class="pf-note" style="margin-bottom:16px">Saving codes needs your GitHub key on this device (the same one the Chats page uses). <a href="../owner-chat.html">Add my GitHub key</a></p>') +
    '<section class="ac-card"><h2 class="ac-h2">New code</h2><form id="cdForm" autocomplete="off">' +
      '<label class="acct-small" for="cdPick">What it unlocks</label>' +
      '<div class="ac-row" style="margin:6px 0 4px"><select class="ac-in" id="cdPick" style="flex:1;min-width:220px">' + opts + '</select>' +
      '<input class="ac-in" id="cdOther" placeholder="game id, e.g. LaserMech" style="flex:1;min-width:180px" hidden>' +
      '<button class="acct-btn ghost sm" type="button" id="cdAdd">+ Add</button></div>' +
      '<div class="ac-row" id="cdChips" style="margin:6px 0 14px"></div>' +
      '<div class="ac-row" style="align-items:flex-end">' +
        '<label style="flex:1;min-width:200px"><span class="acct-small">Code (leave empty for a random one)</span><input class="ac-in" id="cdCode" maxlength="24" placeholder="SKIB-XXXX-XXXX-XXXX" style="text-transform:uppercase;margin-top:4px"></label>' +
        '<label style="flex:0 0 190px"><span class="acct-small">Expires (optional)</span><input class="ac-in" type="date" id="cdExp" style="margin-top:4px"></label>' +
      '</div>' +
      '<label style="display:block;margin-top:10px"><span class="acct-small">Note: who it\'s for (only you see this)</span><input class="ac-in" id="cdNote" maxlength="80" placeholder="e.g. Grandma testing, Mod team, Winter deal" style="margin-top:4px"></label>' +
      '<div class="ac-row" style="margin-top:14px"><button class="acct-btn" type="submit" id="cdMake"' + (hasKey ? "" : " disabled") + '>Make code</button><span class="acct-small" id="cdMsg" role="status"></span></div>' +
    '</form></section>' +
    '<section class="ac-card" id="cdNew" hidden></section>' +
    '<section class="ac-card"><h2 class="ac-h2">Your codes</h2><div id="cdList"><p class="pf-empty">Loading\u2026</p></div></section>';

  $("cdPick").onchange = function(){ $("cdOther").hidden = this.value !== "__other"; };
  $("cdAdd").onclick = function(){
    var v = $("cdPick").value === "__other" ? $("cdOther").value.trim().replace(/[^A-Za-z0-9_\-]/g, "") : $("cdPick").value;
    if(!v) return;
    if(v === "ALL") picked = ["ALL"];
    else { picked = picked.filter(function(x){ return x !== "ALL" && x.toLowerCase() !== v.toLowerCase(); }); picked.push(v); }
    chips();
  };
  $("cdForm").onsubmit = function(e){ e.preventDefault(); make(); };
  chips();
  load();
}

function chips(){
  $("cdChips").innerHTML = picked.length ? picked.map(function(id, i){
    return '<span class="acct-btn ghost sm" style="cursor:default">' + esc(label(id)) + ' <a href="#" data-i="' + i + '" aria-label="Remove" style="margin-left:6px;color:inherit;text-decoration:none">\u00d7</a></span>';
  }).join("") : '<span class="acct-small">Pick something above and press + Add</span>';
  Array.prototype.forEach.call($("cdChips").querySelectorAll("a[data-i]"), function(a){
    a.onclick = function(ev){ ev.preventDefault(); picked.splice(+a.getAttribute("data-i"), 1); chips(); };
  });
}

function load(){
  var box = $("cdList");
  if(!T.token()){
    // no key: show the public list (no codes in it, just what each one unlocks)
    fetch(T.ROOT + "codes/codes.json?t=" + Date.now(), {cache:"no-store"}).then(function(r){ return r.ok ? r.json() : blank(); }).catch(blank)
      .then(function(doc){ list = clean(doc).codes; draw(false); });
    return;
  }
  read(FILES.priv).then(function(r){ list = r.doc.codes; draw(true); }, function(e){
    box.innerHTML = '<p class="pf-empty">Couldn\'t load your codes: ' + esc(e.status === 401 ? "your GitHub key didn't work (expired?)" : e.message) + '</p>';
  });
}

function expired(x){ return x.expires && new Date(x.expires + "T23:59:59") < new Date(); }

function draw(withCodes){
  var box = $("cdList");
  if(!list.length){ box.innerHTML = '<p class="pf-empty">No codes yet.</p>'; return; }
  var rows = list.slice().reverse().map(function(x){
    var un = (x.unlocks || []).map(label).join(", ");
    return '<li style="display:flex;gap:12px;align-items:center;justify-content:space-between;flex-wrap:wrap;padding:10px 0;border-top:1px solid var(--ac-line)">' +
      '<div style="min-width:0;flex:1"><div style="font-weight:600">' + esc(x.note || (withCodes ? "(no note)" : "Code")) + (expired(x) ? ' <i class="acct-role r-guest">EXPIRED</i>' : "") + '</div>' +
      '<div class="acct-small">Unlocks: ' + esc(un) + (x.expires ? " \u00b7 until " + esc(x.expires) : " \u00b7 never expires") + (x.created ? " \u00b7 made " + esc(String(x.created).slice(0, 10)) : "") + '</div>' +
      (withCodes && x.code ? '<div style="font:600 15px ui-monospace,Menlo,Consolas,monospace;letter-spacing:.06em;margin-top:4px" data-code="' + esc(x.code) + '">' + esc(mask(x.code)) + '</div>' : "") + '</div>' +
      '<div class="ac-row">' + (withCodes && x.code ? '<button class="acct-btn ghost sm" type="button" data-show="' + esc(x.hash) + '">Show</button>' : "") +
      (withCodes ? '<button class="acct-btn ghost sm" type="button" data-del="' + esc(x.hash) + '">Delete</button>' : "") + '</div></li>';
  }).join("");
  box.innerHTML = '<ul style="list-style:none;margin:0;padding:0">' + rows + '</ul>' +
    (withCodes ? "" : '<p class="pf-note" style="margin-top:10px">Add your GitHub key to see the codes themselves and delete them.</p>');
  Array.prototype.forEach.call(box.querySelectorAll("[data-show]"), function(b){
    b.onclick = function(){
      var el = b.closest("li").querySelector("[data-code]"); if(!el) return;
      var shown = b.textContent === "Hide";
      el.textContent = shown ? mask(el.getAttribute("data-code")) : el.getAttribute("data-code");
      b.textContent = shown ? "Show" : "Hide";
    };
  });
  Array.prototype.forEach.call(box.querySelectorAll("[data-del]"), function(b){
    b.onclick = function(){
      var h = b.getAttribute("data-del");
      var x = list.filter(function(c){ return c.hash === h; })[0];
      if(!confirm("Delete the code for \"" + ((x && x.note) || "no note") + "\"? It stops working in the game within a few minutes (on devices that already redeemed it, the unlock stays).")) return;
      b.disabled = true; b.textContent = "Deleting\u2026";
      saveAll(null, h, "Delete a redeem code").then(function(){ T.toast("Code deleted. The game stops accepting it in a few minutes."); load(); },
        function(e){ b.disabled = false; b.textContent = "Delete"; T.toast("Couldn't delete: " + e.message); });
    };
  });
}

function make(){
  var msg = $("cdMsg"), btn = $("cdMake");
  if(!picked.length){ msg.textContent = "Pick what it unlocks first."; return; }
  var typed = $("cdCode").value.trim().toUpperCase();
  if(typed && normalize(typed).length < 6){ msg.textContent = "Make the code at least 6 letters/numbers (longer is safer)."; return; }
  var code = typed || randomCode();
  var exp = $("cdExp").value || "";
  var note = $("cdNote").value.trim().slice(0, 80);
  btn.disabled = true; msg.textContent = "Saving\u2026";
  hashCode(code).then(function(h){
    if(list.some(function(c){ return c.hash === h; })) throw new Error("That code already exists. Pick another one.");
    var who = (T.me && T.me() && T.me().name) || "";
    var entry = {code:code, hash:h, unlocks:picked.slice(), expires:exp, note:note, created:new Date().toISOString(), by:who};
    if(!entry.expires) delete entry.expires;
    return saveAll(entry, null, "New redeem code" + (note ? " (" + note.replace(/[^\w \-]/g, "").slice(0, 40) + ")" : "")).then(function(){ return entry; });
  }).then(function(entry){
    btn.disabled = false; msg.textContent = "";
    $("cdCode").value = ""; $("cdNote").value = ""; $("cdExp").value = "";
    var nb = $("cdNew"); nb.hidden = false;
    nb.innerHTML = '<h2 class="ac-h2">Your new code</h2>' +
      '<div style="font:700 30px ui-monospace,Menlo,Consolas,monospace;letter-spacing:.08em;margin:6px 0 10px;word-break:break-all" id="cdBig">' + esc(entry.code) + '</div>' +
      '<p class="acct-small">Unlocks ' + esc(entry.unlocks.map(label).join(", ")) + (entry.expires ? ", until " + esc(entry.expires) : "") + '. It works in the game in about a minute (once the site updates). Each device can use it once.</p>' +
      '<div class="ac-row" style="margin-top:10px"><button class="acct-btn" type="button" id="cdCopy">Copy code</button></div>';
    $("cdCopy").onclick = function(){ try { navigator.clipboard.writeText(entry.code); } catch(e){} this.textContent = "Copied \u2713"; };
    nb.scrollIntoView({behavior:"smooth", block:"center"});
    load();
  }, function(e){
    btn.disabled = false;
    msg.textContent = e.status === 401 ? "Your GitHub key didn't work (expired?)." : ("Couldn't save: " + e.message);
  });
}

T.on(start);
})();
