/* profile page: your own profile (edit banner / name / bio), the Guest profile, or someone else's (?u=) */
(function(){
"use strict";
var T = window.TTVM, $ = function(id){ return document.getElementById(id); }, esc = T.esc;
var target = (/[?&]u=([a-z0-9-]+)/.exec(location.search) || [])[1] || null;
if(target === "owner") target = T.ownerH || null;   // profile/?u=owner = the owner's public profile
// the owner's profile is public: anyone (signed in or not) can open it
var ownerTarget = !!(target && T.isLockedOwner(target));
var SW = T.BANNERS;

function stat(R){
  return '<section class="ac-card pf-status" id="status">' + T.blockHtml() + '</section>';
}
function warnCard(S){
  // owner protection is always on (it comes from the account); in Dev mode the card just reads like a dev's
  if(S.prot && T.effectiveRole() === "owner") return '<section class="ac-card" id="warnings"><h2 class="ac-h2">Warnings</h2><p class="pf-empty">Owner account: it can\'t be warned, paused or banned.</p></section>';
  var ws = S.warnings;
  return '<section class="ac-card" id="warnings"><h2 class="ac-h2">Warnings <span class="acct-small">(' + ws.length + ' of 3)</span></h2>' +
    (ws.length ? '<ul class="acct-wlist">' + ws.map(T.warnItem).join("") + '</ul><p class="pf-note">Tap a warning to see why you got it. 3 warnings means a ban.</p>' : '<p class="pf-empty">No warnings. Keep it up.</p>') + '</section>';
}
function render(S, files){
  var roles = files[0], mod = files[1], profs = files[2], act = files[3], notes = files[4] || {people:{}};
  var own = !target || target === S.h || (!S.session && !ownerTarget);   // guests get their own Guest card (or the owner's public profile)
  var h = own ? S.h : target;
  var R = own ? S.restricted : T.restriction(mod.people[h], h);   // owners: always null
  var guest = own && (!S.session || !!R);
  var more = $("pfMore"), acts = $("pfActions");
  document.body.classList.toggle("is-own", own);
  if(guest || !T.isLockedOwner(h)) ownerLook(null);

  if(guest){
    $("pfBanner").setAttribute("style", "background:#000");
    $("pfAv").innerHTML = T.avatar(null, "xl");
    $("pfName").innerHTML = "Guest" + (R ? ' <i class="acct-role r-restricted">RESTRICTED</i>' : "");
    $("pfMeta").textContent = R ? "Restricted account" : "Not signed in";
    $("pfBio").textContent = R ? "Your account is restricted right now, so you're browsing as a restricted Guest." : "This is the basic Guest profile. Sign in with Google to get your own banner, name and bio.";
    acts.innerHTML = R ? "" : '<a class="acct-btn" href="../signin/?next=' + encodeURIComponent(location.pathname + "#edit") + '">Sign in with Google</a><a class="acct-btn ghost" href="../signin/">Customize</a>';
    more.innerHTML = R ? stat(R) + warnCard(S) : "";
    return;
  }
  var p = T.profileOf(h, profs), role = T.roleOf(h, roles);
  // your own profile: Google name + photo by default, your custom ones only if you set them
  if(own){ var mm = T.me(); role = T.effectiveRole(); p.name = mm.name; p.picture = mm.picture; }
  var ownerName = T.isLockedOwner(h) ? ((roles.owners || []).filter(function(x){ return x && x.h === h; })[0] || {name:"Amos"}).name : "";
  var known = own || p.name || ownerName || (mod.people[h] && mod.people[h].name) || (act.people[h] && act.people[h].name);
  if(!known){
    $("pfName").textContent = "Profile not found"; $("pfMeta").textContent = ""; $("pfBio").textContent = "This person hasn't shared a profile on the site yet."; acts.innerHTML = '<a class="acct-btn ghost" href="../">Back to the site</a>'; return;
  }
  var name = p.name || (mod.people[h] || {}).name || (act.people[h] || {}).name || ownerName;
  $("pfBanner").setAttribute("style", T.bannerStyle(p));
  $("pfAv").innerHTML = T.avatar({h:h, name:name, picture:p.picture || ""}, "xl");
  $("pfName").innerHTML = esc(name) + " " + (role !== "user" ? T.roleTag(role) : "");
  var last = (act.people[h] || {}).last || (own ? new Date().toISOString() : null);
  $("pfMeta").textContent = own ? (T.ROLE_NAME[role] + " \u00b7 signed in with Google" + (T.me().customName || T.me().customPicture ? "" : " \u00b7 name + photo from Google")) : (T.ROLE_NAME[role] + (last ? " \u00b7 last seen " + T.when(last) : ""));
  $("pfBio").textContent = p.bio || (own ? "No bio yet. Tap Customize to add one." : "");
  if(p.link) $("pfBio").insertAdjacentHTML("beforeend", (p.bio ? "\n" : "") + '<a href="' + esc(p.link) + '" target="_blank" rel="noopener" style="color:#ff6b5e">' + esc(p.link.replace(/^https?:\/\//, "")) + '</a>');
  var a = "";
  if(own) a += '<button type="button" class="acct-btn" id="pfEditBtn">Customize</button>' + (T.allowed("staff") ? '<a class="acct-btn ghost" href="../devhub/">Dev</a>' : '');
  if(!own && T.allowed("staff") && T.RANK[T.effectiveRole()] >= 3) a += '<a class="acct-btn gold" href="../devhub/panel.html?u=' + encodeURIComponent(h) + '">Open in ' + (T.effectiveRole() === "owner" ? "owner" : "moderator") + ' panel</a>';
  if(!own) a += S.session ? '<a class="acct-btn ghost" href="../profile/">My profile</a>' : '<a class="acct-btn ghost" href="../">Back to the site</a>';
  acts.innerHTML = a;
  var m = "", prot = T.isProtected(h, roles);
  // owner accounts: a copyright notice (owner-only, never a ban) shows as a big warning card
  if(prot) m += T.activeNotices(notes, h).map(T.copyrightHtml).join("");
  if(own){
    m += '<section class="ac-card" id="edit" hidden>' + form(p, name) + '</section>';
    m += '<div class="pf-grid">' + warnCard(S) +
      '<section class="ac-card"><h2 class="ac-h2">Account</h2><ul class="pf-list">' +
      '<li>Role <span>' + T.ROLE_NAME[T.effectiveRole()] + '</span></li>' +
      '<li>Google account <span>' + esc(S.session.hint || T.maskEmail(S.session.email)) + '</span></li>' +
      '<li>Status <span style="color:#5fd47a">' + (prot && T.effectiveRole() === "owner" ? "Protected owner account" : "Good standing") + '</span></li></ul>' +
      '<p style="margin-top:12px"><button type="button" class="acct-btn ghost sm" id="pfOut">' + "Sign out" + '</button></p></section></div>';
  }
  more.innerHTML = m;
  if(T.isLockedOwner(h)) ownerLook({own:own, name:name, bio:p.bio, picture:p.picture});
  if(own){
    $("pfEditBtn").onclick = function(){ var e = $("edit"); e.hidden = !e.hidden; if(!e.hidden) e.scrollIntoView({behavior:"smooth", block:"start"}); };
    $("pfOut").onclick = T.signOut;
    wire(p, name);
    if(location.hash === "#edit"){ $("edit").hidden = false; setTimeout(function(){ $("edit").scrollIntoView({block:"start"}); }, 50); }
    if(location.hash === "#warnings"){ setTimeout(function(){ $("warnings").scrollIntoView({block:"start"}); }, 50); }
  }
}
function form(p, name){
  var b = p.banner || "#000000";
  return '<h2 class="ac-h2">Customize your profile</h2><form class="pf-form" id="pfForm" autocomplete="off">' +
    '<label>Profile photo</label><div class="pf-file" style="align-items:center"><span id="fAvPrev">' + T.avatar({h:T.state.h, name:name, picture:T.me().picture}, "lg") + '</span>' +
    '<label class="acct-btn ghost sm" for="fAv" style="margin:0">Upload a photo</label><input type="file" id="fAv" accept="image/*">' +
    '<span class="acct-small" id="fAvNote">' + (T.me().customPicture ? "Custom photo" : "From your Google account") + '</span></div>' +
    '<label for="fName">Display name</label><input type="text" id="fName" maxlength="32" value="' + esc(name) + '" placeholder="' + esc(T.me().googleName) + '">' +
    '<label for="fBio">Bio</label><textarea id="fBio" maxlength="300" placeholder="Who you main, best wave, what you\'re building...">' + esc(p.bio || "") + '</textarea>' +
    '<label>Banner</label><div class="pf-sw" id="fSw">' + SW.map(function(c){ return '<button type="button" data-c="' + c + '" style="background:' + c + '" aria-label="Banner colour ' + c + '" aria-pressed="' + (!p.bannerImage && b.toLowerCase() === c ? "true" : "false") + '"></button>'; }).join("") +
    '<input type="color" id="fColor" value="' + esc(/^#[0-9a-f]{6}$/i.test(b) ? b : "#000000") + '" aria-label="Pick any colour"></div>' +
    '<div class="pf-file"><label class="acct-btn ghost sm" for="fImg" style="margin:0">Upload a picture</label><input type="file" id="fImg" accept="image/*"><button type="button" class="acct-btn ghost sm" id="fNoImg"' + (p.bannerImage ? "" : " hidden") + '>Remove picture</button><span class="acct-small" id="fImgNote"></span></div>' +
    '<label for="fLink">Link (YouTube, TikTok...)</label><input type="url" id="fLink" maxlength="200" placeholder="https://" value="' + esc(p.link || "") + '">' +
    '<div class="pf-save"><button class="acct-btn" type="submit">Save</button><button class="acct-btn ghost" type="button" id="fReset">Use my Google name + photo</button><span class="acct-small" id="fMsg" role="status"></span></div>' +
    '<p class="pf-note">Your name and photo come from your Google account automatically, so there\'s nothing you have to set up. Change them here only if you want something different. Saved on this device.</p></form>';
}
function wire(p, name){
  var lp0 = T.localProfile(T.state.h);
  var draft = {banner:p.banner || "#000000", bannerImage:p.bannerImage || "", avatar:lp0.avatar || ""};
  function avPrev(){
    var g = T.state.session;
    $("fAvPrev").innerHTML = T.avatar({h:T.state.h, name:$("fName").value.trim() || g.name, picture:draft.avatar || g.picture || ""}, "lg");
    $("fAvNote").textContent = draft.avatar ? "Custom photo (tap Save)" : "From your Google account";
  }
  $("fAv").onchange = function(){
    var f = this.files && this.files[0]; if(!f) return;
    $("fAvNote").textContent = "Loading...";
    var img = new Image(), url = URL.createObjectURL(f);
    img.onload = function(){
      var S2 = 256, c = document.createElement("canvas"); c.width = S2; c.height = S2;
      var s = Math.max(S2 / img.width, S2 / img.height), w = img.width * s, h = img.height * s;
      c.getContext("2d").drawImage(img, (S2 - w) / 2, (S2 - h) / 2, w, h);
      draft.avatar = c.toDataURL("image/jpeg", 0.85); URL.revokeObjectURL(url); avPrev();
    };
    img.onerror = function(){ $("fAvNote").textContent = "That file didn't open as a picture."; };
    img.src = url;
  };
  function preview(){ $("pfBanner").setAttribute("style", T.bannerStyle(draft)); }
  Array.prototype.forEach.call(document.querySelectorAll("#fSw button"), function(b){
    b.onclick = function(){ draft.banner = b.getAttribute("data-c"); draft.bannerImage = ""; $("fNoImg").hidden = true; mark(); preview(); };
  });
  function mark(){ Array.prototype.forEach.call(document.querySelectorAll("#fSw button"), function(b){ b.setAttribute("aria-pressed", String(!draft.bannerImage && b.getAttribute("data-c") === draft.banner)); }); }
  $("fColor").oninput = function(){ draft.banner = this.value; draft.bannerImage = ""; mark(); preview(); };
  $("fNoImg").onclick = function(){ draft.bannerImage = ""; this.hidden = true; preview(); };
  $("fImg").onchange = function(){
    var f = this.files && this.files[0]; if(!f) return;
    $("fImgNote").textContent = "Loading...";
    var img = new Image(), url = URL.createObjectURL(f);
    img.onload = function(){
      var W = 1200, H = 360, c = document.createElement("canvas"); c.width = W; c.height = H;
      var s = Math.max(W / img.width, H / img.height), w = img.width * s, h = img.height * s;
      c.getContext("2d").drawImage(img, (W - w) / 2, (H - h) / 2, w, h);
      draft.bannerImage = c.toDataURL("image/jpeg", 0.8); URL.revokeObjectURL(url);
      $("fImgNote").textContent = ""; $("fNoImg").hidden = false; mark(); preview();
    };
    img.onerror = function(){ $("fImgNote").textContent = "That file didn't open as a picture."; };
    img.src = url;
  };
  // back to the Google name + photo (saved straight away, keeps your bio / banner / link)
  $("fReset").onclick = function(){
    $("fName").value = T.state.session.name; draft.avatar = ""; avPrev();
    var cur = T.localProfile(T.state.h), out = {};
    for(var k in cur) if(k !== "name" && k !== "avatar") out[k] = cur[k];
    try { T.saveLocalProfile(out); } catch(err){}
    $("fMsg").textContent = "Using your Google name + photo \u2713";
    T.toast("Back to your Google name + photo");
  };
  $("pfForm").onsubmit = function(e){
    e.preventDefault();
    var link = $("fLink").value.trim();
    if(link && !/^https:\/\/[^\s]+$/i.test(link)){ $("fMsg").textContent = "Links need to start with https://"; return; }
    // a name equal to the Google one (or blank) isn't saved, so it keeps following your Google account
    var nm = $("fName").value.trim().slice(0, 32); if(nm === T.state.session.name) nm = "";
    var out = {name:nm, avatar:draft.avatar, bio:$("fBio").value.trim().slice(0, 300), banner:draft.banner, bannerImage:draft.bannerImage, link:link};
    try { T.saveLocalProfile(out); } catch(err){ $("fMsg").textContent = "Couldn't save. The picture may be too big."; return; }
    $("fMsg").textContent = "Saved \u2713";
    T.toast("Profile saved");
  };
}
// ---------- the owner's profile: banner picture, "Founder & Creator" title, gold frame, social links ----------
// Everything here comes from ONE file: data/owner-profile.json (banner picture path, title, links...).
// It's only ever applied to the owner's own account (the locked owner fingerprints in js/acct.js).
var OP = null;
function ownerCfg(){ if(!OP) OP = T.data("owner-profile", true); return OP; }
var CROWN = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 18h18l-1.6-9.5-4.6 3.6L12 5l-2.8 7.1-4.6-3.6z"/></svg>';
var SOC = {
  youtube:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22.5 6.4a2.8 2.8 0 0 0-1.9-2C18.9 4 12 4 12 4s-6.9 0-8.6.5a2.8 2.8 0 0 0-1.9 2A29 29 0 0 0 1 12a29 29 0 0 0 .5 5.6 2.8 2.8 0 0 0 1.9 1.9c1.7.5 8.6.5 8.6.5s6.9 0 8.6-.5a2.8 2.8 0 0 0 1.9-1.9A29 29 0 0 0 23 12a29 29 0 0 0-.5-5.6z"/><path d="M9.8 15.3 15.5 12 9.8 8.7z" fill="currentColor"/></svg>',
  tiktok:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 3v11.5a3.5 3.5 0 1 1-3.5-3.5"/><path d="M14 3c.4 2.7 2.4 4.6 5 4.8"/></svg>',
  instagram:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><path d="M17.5 6.5h.01"/></svg>',
  discord:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8.5 5.5A15 15 0 0 0 5 6.6C3 9.6 2.4 12.6 2.7 15.6a14 14 0 0 0 4.3 2.2l1-1.7M15.5 5.5a15 15 0 0 1 3.5 1.1c2 3 2.6 6 2.3 9a14 14 0 0 1-4.3 2.2l-1-1.7"/><path d="M7.5 16.2c2.9 1.4 6.1 1.4 9 0M8.6 7c2.2-.6 4.6-.6 6.8 0"/><circle cx="9.2" cy="12.3" r="1.2" fill="currentColor"/><circle cx="14.8" cy="12.3" r="1.2" fill="currentColor"/></svg>',
  x:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4l11.5 16H20L8.5 4z"/><path d="M19.5 4l-6.3 7.1M10.8 12.9 4.5 20"/></svg>',
  twitch:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 2H3v16h5v4l4-4h5l4-4V2z"/><path d="M11 11V7M16 11V7"/></svg>',
  roblox:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M6.2 2.8 21.2 6.8 17.8 21.2 2.8 17.2z"/><path d="M10.4 9.4l4.2 1.1-1 4.1-4.2-1.1z" fill="currentColor"/></svg>',
  github:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 19c-4.3 1.4-4.3-2.5-6-3m12 5v-3.5c0-1 .1-1.4-.5-2 2.8-.3 5.5-1.4 5.5-6a4.6 4.6 0 0 0-1.3-3.2 4.2 4.2 0 0 0-.1-3.2s-1.1-.3-3.5 1.3a12.3 12.3 0 0 0-6.2 0C6.5 2.8 5.4 3.1 5.4 3.1a4.2 4.2 0 0 0-.1 3.2A4.6 4.6 0 0 0 4 9.5c0 4.6 2.7 5.7 5.5 6-.6.6-.6 1.2-.5 2V21"/></svg>',
  website:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.8 1.7"/><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7"/></svg>'
};
function safeUrl(u){ u = String(u || "").trim(); return /^https:\/\/[^\s"'<>]+$/i.test(u) ? u : ""; }
function safePath(u){ u = String(u || "").trim(); return /^(https:\/\/|[a-z0-9_\-\/]+\.)[^\s"'<>()]*$/i.test(u) && !/\.\./.test(u) ? u : ""; }
// ---------- the owner's episodes: banner video, sound / full screen / playlist ----------
// A video path can be a normal .mp4 / .webm, or a small .json list of parts (big files are stored in
// pieces, like the /play build) that get joined back together here into one video.
var ICO = {
  mute:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5 6 9H2v6h4l5 4z"/><path d="M22 9l-6 6M16 9l6 6"/></svg>',
  sound:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5 6 9H2v6h4l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7M19 5a10 10 0 0 1 0 14"/></svg>',
  full:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3H3v5M16 3h5v5M8 21H3v-5M16 21h5v-5"/></svg>',
  list:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h12M3 12h12M3 18h8"/><path d="M17 15v6l5-3z" fill="currentColor"/></svg>',
  play:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7z" fill="currentColor"/></svg>'
};
function url(path, ver){
  var u = /^https:/i.test(path) ? path : T.ROOT + path;
  return ver ? u + (u.indexOf("?") < 0 ? "?" : "&") + "v=" + encodeURIComponent(ver) : u;
}
function playlist(c){
  return (Array.isArray(c.playlist) ? c.playlist : []).map(function(e){
    return {title:String(e && e.title || "Episode"), video:safePath(e && e.video), poster:safePath(e && e.poster), length:String(e && e.length || ""), note:String(e && e.note || "")};
  }).filter(function(e){ return e.video; });
}
var srcCache = {};
function videoSrc(path, ver){
  if(!/\.json(\?|#|$)/i.test(path)) return Promise.resolve(url(path, ver));
  if(srcCache[path]) return srcCache[path];
  var base = url(path, ver), dir = base.replace(/[^\/?#]*([?#].*)?$/, "");
  srcCache[path] = fetch(base).then(function(r){ if(!r.ok) throw new Error("parts"); return r.json(); }).then(function(m){
    return Promise.all((m.parts || []).map(function(n){ return fetch(dir + n + (ver ? "?v=" + encodeURIComponent(ver) : "")).then(function(r){ if(!r.ok) throw new Error("part"); return r.arrayBuffer(); }); }))
      .then(function(bufs){ return URL.createObjectURL(new Blob(bufs, {type:m.type || "video/mp4"})); });
  });
  srcCache[path].catch(function(){ delete srcCache[path]; });
  return srcCache[path];
}
function bannerVideo(ban, path, c, feat){
  var still = !!(window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches);
  var v = document.createElement("video");
  v.className = "pf-bvid"; v.muted = true; v.defaultMuted = true; v.loop = true; v.playsInline = true;
  v.setAttribute("muted", ""); v.setAttribute("playsinline", ""); v.setAttribute("webkit-playsinline", ""); v.setAttribute("preload", "auto");
  var poster = safePath(c.bannerPoster) || (feat && feat.poster) || "";
  if(poster) v.poster = url(poster, c.bannerVersion);
  ban.insertBefore(v, ban.firstChild);
  var label = String(c.bannerTitle || (feat && feat.title) || "");
  if(label) ban.insertAdjacentHTML("beforeend", '<span class="pf-blabel">' + ICO.play + esc(label) + '</span>');
  var many = playlist(c).length;
  ban.insertAdjacentHTML("beforeend", '<div class="pf-bbar" role="group" aria-label="Episode controls">' +
    '<button type="button" class="pf-bbtn" data-b="sound" aria-pressed="false" aria-label="Sound on">' + ICO.mute + '<span>Sound</span></button>' +
    '<button type="button" class="pf-bbtn" data-b="full" aria-label="Full screen">' + ICO.full + '<span>Full screen</span></button>' +
    (many ? '<button type="button" class="pf-bbtn" data-b="list" aria-label="Full playlist">' + ICO.list + '<span>Playlist</span></button>' : "") + '</div>');
  var bar = ban.querySelector(".pf-bbar"), sb = bar.querySelector('[data-b="sound"]');
  function soundUi(){ var on = !v.muted; sb.innerHTML = (on ? ICO.sound : ICO.mute) + '<span>' + (on ? "Sound on" : "Sound") + '</span>'; sb.setAttribute("aria-pressed", String(on)); sb.setAttribute("aria-label", on ? "Mute" : "Sound on"); sb.classList.toggle("on", on); }
  function go(){ var pr = v.play(); if(pr && pr.catch) pr.catch(function(){}); }
  sb.onclick = function(){ v.muted = !v.muted; if(!v.muted && v.volume === 0) v.volume = 1; go(); soundUi(); };
  bar.querySelector('[data-b="full"]').onclick = function(){
    var wasMuted = v.muted;
    v.muted = false; v.currentTime = 0; v.controls = true; v.loop = false; go(); soundUi();
    function back(){ v.controls = false; v.loop = true; v.muted = wasMuted; soundUi(); go(); }
    if(v.requestFullscreen){
      v.requestFullscreen().then(function(){
        var off = function(){ if(!document.fullscreenElement){ document.removeEventListener("fullscreenchange", off); back(); } };
        document.addEventListener("fullscreenchange", off);
      }).catch(function(){ if(v.webkitEnterFullscreen) try { v.webkitEnterFullscreen(); } catch(e){} });
    } else if(v.webkitEnterFullscreen){   // iPhone (Safari / Chrome): the video's own full screen player
      v.addEventListener("webkitendfullscreen", function h(){ v.removeEventListener("webkitendfullscreen", h); back(); });
      try { v.webkitEnterFullscreen(); } catch(e){}
    } else if(v.webkitRequestFullscreen) v.webkitRequestFullscreen();
  };
  var lb = bar.querySelector('[data-b="list"]'); if(lb) lb.onclick = function(){ v.muted = true; soundUi(); v.pause(); openPlaylist(c, function(){ if(!still) go(); }); };
  v.addEventListener("ended", function(){ if(!document.fullscreenElement){ v.loop = true; v.controls = false; go(); } });
  videoSrc(path, c.bannerVersion).then(function(src){
    if(!v.isConnected) return;
    v.src = src;
    if(!still) go();
  }).catch(function(){ v.remove(); bar.remove(); });   // video missing: the animated placeholder stays
}
function openPlaylist(c, onClose){
  var list = playlist(c); if(!list.length) return;
  var o = document.createElement("div"); o.className = "acct-overlay acct-modal pf-plov";
  o.innerHTML = '<div class="acct-ovbox pf-plbox" role="dialog" aria-modal="true" aria-label="Full playlist"><button type="button" class="acct-x" aria-label="Close">&times;</button>' +
    '<h2 class="ac-h2">' + esc(String(c.playlistTitle || "Full playlist")) + '</h2>' +
    '<div class="pf-plplayer"><video controls playsinline webkit-playsinline preload="metadata"></video><b class="pf-plnow"></b></div>' +
    '<ol class="pf-pl">' + list.map(function(e, i){
      return '<li><button type="button" data-i="' + i + '"><span class="pf-plth"' + (e.poster ? ' style="background-image:url(\'' + esc(url(e.poster, c.bannerVersion)) + '\')"' : "") + '>' + ICO.play + '</span>' +
        '<span class="pf-pltx"><b>' + esc(e.title) + '</b>' + (e.length || e.note ? '<small>' + esc([e.length, e.note].filter(Boolean).join(" \u00b7 ")) + '</small>' : "") + '</span></button></li>';
    }).join("") + '</ol></div>';
  document.body.appendChild(o);
  var pv = o.querySelector("video"), now = o.querySelector(".pf-plnow");
  function close(){ try { pv.pause(); } catch(e){} o.remove(); document.removeEventListener("keydown", esck); if(onClose) onClose(); }
  function esck(e){ if(e.key === "Escape") close(); }
  document.addEventListener("keydown", esck);
  o.addEventListener("click", function(e){ if(e.target === o || (e.target.closest && e.target.closest(".acct-x"))) close(); });
  function pick(i){
    var e = list[i]; if(!e) return;
    Array.prototype.forEach.call(o.querySelectorAll(".pf-pl button"), function(b){ b.classList.toggle("on", +b.getAttribute("data-i") === i); });
    now.textContent = e.title;
    if(e.poster) pv.poster = url(e.poster, c.bannerVersion);
    videoSrc(e.video, c.bannerVersion).then(function(src){ pv.src = src; var pr = pv.play(); if(pr && pr.catch) pr.catch(function(){}); })
      .catch(function(){ now.textContent = e.title + " \u00b7 couldn't load. Try again later."; });
  }
  Array.prototype.forEach.call(o.querySelectorAll(".pf-pl button"), function(b){ b.onclick = function(){ pick(+b.getAttribute("data-i")); }; });
  pv.addEventListener("ended", function(){ var cur = o.querySelector(".pf-pl button.on"), i = cur ? +cur.getAttribute("data-i") : -1; if(list[i + 1]) pick(i + 1); });
  pick(+c.featured || 0);
}
var lookN = 0;
function ownerLook(o){
  var n = ++lookN, b = document.body;
  b.classList.toggle("pf-owner", !!o);
  ["pfOTitle", "pfSocial"].forEach(function(id){ var e = $(id); if(e && !o){ e.hidden = true; e.innerHTML = ""; } });
  if(!o){
    var bn = $("pfBanner");
    if(bn){ bn.classList.remove("pf-banim"); bn.removeAttribute("data-key"); bn.removeAttribute("data-img"); Array.prototype.forEach.call(bn.querySelectorAll(".pf-bvid,.pf-shine,.pf-bbar,.pf-blabel"), function(e){ e.remove(); }); }
    return;
  }
  ownerCfg().then(function(c){
    if(n !== lookN) return;   // the page re-drew meanwhile
    c = c || {};
    // banner: his own episode (a muted looping video), an animated .gif / .webp, or a still picture.
    // No file = the animated placeholder (slow moving gradient in the site's colours).
    var ban = $("pfBanner"), list = playlist(c), feat = list[+c.featured || 0] || null;
    var img = safePath(c.banner) || (feat ? feat.video : ""), vid = !!img && /\.(mp4|webm|json)(\?|#|$)/i.test(img);
    var key = img + "|" + (c.bannerVersion || "");
    ban.classList.add("pf-banim");
    if(ban.getAttribute("data-key") !== key){
      ban.setAttribute("data-key", key);
      Array.prototype.forEach.call(ban.querySelectorAll(".pf-bvid,.pf-bbar,.pf-blabel"), function(e){ e.remove(); });
      if(img && !vid) ban.setAttribute("data-img", url(img, c.bannerVersion)); else ban.removeAttribute("data-img");
      if(vid) bannerVideo(ban, img, c, feat);
    }
    ban.setAttribute("style", ban.getAttribute("data-img") ? "background-image:url(\"" + ban.getAttribute("data-img") + "\")" : "");
    if(!ban.querySelector(".pf-shine")) ban.insertAdjacentHTML("beforeend", '<span class="pf-shine" aria-hidden="true"></span>');
    var av = $("pfAv");
    // visitors see the photo set in the file (if any); the owner sees his own photo on his own profile
    var pic = (!o.own && safePath(c.avatar)) ? (/^https:/i.test(c.avatar) ? c.avatar : T.ROOT + c.avatar) : (o.picture || "");
    if(pic !== (o.picture || "")) av.innerHTML = T.avatar({h:T.ownerH, name:o.name, picture:pic}, "xl");
    if(!av.querySelector(".pf-crownb")) av.insertAdjacentHTML("beforeend", '<i class="pf-crownb" title="Owner">' + CROWN + '</i>');
    var t = $("pfOTitle");
    if(t){
      var title = String(c.title || "Founder & Creator"), studio = String(c.studio || ""), line = String(c.tagline || "");
      t.innerHTML = '<span class="pf-obadge">' + CROWN + '<b>' + esc(title) + '</b>' + (studio ? '<span>\u00b7 ' + esc(studio) + '</span>' : "") + '</span>' +
        (line ? '<span class="pf-oline">' + esc(line) + '</span>' : "");
      t.hidden = false;
    }
    if(!o.bio && c.bio){ var bio = $("pfBio"); if(bio && (!bio.textContent.trim() || /^No bio yet/.test(bio.textContent))) bio.textContent = String(c.bio); }
    var so = $("pfSocial");
    if(so){
      var links = (Array.isArray(c.links) ? c.links : []).map(function(l){ return {type:String(l && l.type || "website").toLowerCase(), label:String(l && l.label || ""), url:safeUrl(l && l.url)}; })
        .filter(function(l){ return l.url; });   // links with no address yet stay hidden
      so.innerHTML = links.map(function(l){
        var ico = SOC[l.type] || SOC.website, lab = l.label || (l.type.charAt(0).toUpperCase() + l.type.slice(1));
        return '<a class="pf-soc s-' + esc(l.type) + '" href="' + esc(l.url) + '" target="_blank" rel="noopener me" title="' + esc(lab) + '" aria-label="' + esc(lab) + '">' + ico + '<span>' + esc(lab) + '</span></a>';
      }).join("");
      so.hidden = !links.length;
    }
  });
}
var files = null;
var BLANK = [{owners:[], mods:[], devs:[]}, {people:{}}, {people:{}}, {people:{}}, {people:{}}];
T.on(function(S){
  // guests: just the basic Guest card, no people / moderation / activity files are fetched
  if(!S.session && !ownerTarget){ render(S, BLANK); return; }
  if(!S.session){ Promise.all([T.data("roles"), T.data("moderation"), T.data("profiles"), T.data("activity")]).then(function(f){ if(!T.state.session) render(T.state, f.concat([{people:{}}])); }); return; }
  if(files){ render(S, files); return; }
  Promise.all([T.data("roles"), T.data("moderation"), T.data("profiles"), T.data("activity"), T.data("notices")]).then(function(f){ files = f; render(T.state, f); });
});
})();
