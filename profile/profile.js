/* profile page: your own profile (edit banner / name / bio), the Guest profile, or someone else's (?u=) */
(function(){
"use strict";
var T = window.TTVM, $ = function(id){ return document.getElementById(id); }, esc = T.esc;
var target = (/[?&]u=([a-z0-9-]+)/.exec(location.search) || [])[1] || null;
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
  var own = !target || target === S.h || !S.session;   // guests only ever get their own Guest card
  var h = own ? S.h : target;
  var R = own ? S.restricted : T.restriction(mod.people[h], h);   // owners: always null
  var guest = own && (!S.session || !!R);
  var more = $("pfMore"), acts = $("pfActions");
  document.body.classList.toggle("is-own", own);

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
  var known = own || p.name || (mod.people[h] && mod.people[h].name) || (act.people[h] && act.people[h].name);
  if(!known){
    $("pfName").textContent = "Profile not found"; $("pfMeta").textContent = ""; $("pfBio").textContent = "This person hasn't shared a profile on the site yet."; acts.innerHTML = '<a class="acct-btn ghost" href="../">Back to the site</a>'; return;
  }
  var name = p.name || (mod.people[h] || {}).name || (act.people[h] || {}).name;
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
  if(!own) a += '<a class="acct-btn ghost" href="../profile/">My profile</a>';
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
var files = null;
var BLANK = [{owners:[], mods:[], devs:[]}, {people:{}}, {people:{}}, {people:{}}, {people:{}}];
T.on(function(S){
  // guests: just the basic Guest card, no people / moderation / activity files are fetched
  if(!S.session){ render(S, BLANK); return; }
  if(files){ render(S, files); return; }
  Promise.all([T.data("roles"), T.data("moderation"), T.data("profiles"), T.data("activity"), T.data("notices")]).then(function(f){ files = f; render(T.state, f); });
});
})();
