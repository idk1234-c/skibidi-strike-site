// Skibidi Strike site
// Owner / dev mode: only for a Google-signed-in owner / moderator / dev from data/roles.json
// (js/acct.js). There are no codes any more. Dev-page customizations live in ss-core.js.
// The owner email was taken out of this public file on Amos's request (it would get spammed).

var DEFAULT_ROADMAP = [
  {d:"OCT 25", t:"The repo goes live", b:"The first commit: the core wave shooter, 90 waves, wave rewards, the lobby."},
  {d:"OCT 26", t:"Alliance Titan joins the fight", b:"His scripts, his model, his card in the character select."},
  {d:"OCT 30", t:"The arsenal is staged", b:"35+ weapon models land in the vault, ready to be wired into gameplay."},
  {d:"OCT 30", t:"Dev mode", b:"A hidden test menu: points, characters, god mode, jump to any wave."},
  {d:"OCT 31", t:"The characters get real", b:"Cameraman, Alliance Titan and the Astro UFO rebuilt from code with genuinely swinging legs and arms."},
  {d:"OCT 31", t:"Main menu redesign", b:"Bigger rounded buttons, a new title-screen backdrop with the city and a skibidi watching over it, and a WEBSITE button linking the game to this site."},
  {d:"OCT 31", t:"The city falls", b:"A destroyed-city battle map: ruined buildings, fires, smoke and dusty haze."},
  {d:"OCT 31", t:"Balance pass", b:"Wave 1 is exactly five skibidis, and every toilet now comes in its own size."},
  {d:"OCT 31", t:"Play it in your browser", b:"The first web build is live. Hit PLAY on this site and you're in the city, no download."}
];

var IN_PROGRESS = [
  {t:"Rigged models & real animations", b:"Real skeletons with Idle/Walk/Run/Punch clips for Alliance Titan, Cameraman and the Astro UFO, built in Blender by Titan TV Man."},
  {t:"Enemy upgrade ladder", b:"Skibidis that start with guns and climb through armor, jetpacks, rockets and lasers as the waves go on."}
];
var COMING_NEXT = [
  {t:"Multiplayer", b:"The next big one: take on the skibidis with friends."},
  {t:"Save system", b:"Your bank, best wave and characters persist, with a reset-progress option and a no-save test mode."},
  {t:"Mobile version", b:"The game running on phones, after the PC build is solid."},
  {t:"Titan shop", b:"The Titan section plus a modular upgrade shop built on the 35 weapon models."},
  {t:"Astro secret", b:"The secret orb and the unlock behind it."},
  {t:"Studio accounts & notifications", b:"The big one: real accounts so the studio gets notification flags, and visitors can talk to the studio privately."}
];

var DEFAULT_CREDITS = [
  {n:"Titan TV Man", r:"code"},
  {n:"UTCM Studios", r:"website + code"}
];
function getCredits(){
  try{
    var raw = localStorage.getItem("ss_credits");
    if(raw) return JSON.parse(raw);
  }catch(e){}
  return DEFAULT_CREDITS;
}
function renderCredits(){
  var host = document.getElementById("creditsPeople");
  if(!host) return;
  var list = getCredits(), html = "";
  for(var i=0;i<list.length;i++){
    html += esc(list[i].n) + " &middot; " + esc(list[i].r);
    if(i < list.length-1) html += "<br>";
  }
  host.innerHTML = html;
}
function creditsToText(){
  return getCredits().map(function(c){ return c.n + " | " + c.r; }).join("\n");
}
function textToCredits(txt){
  var out=[];
  txt.split("\n").forEach(function(line){
    if(!line.trim()) return;
    var p = line.split("|");
    if(p.length>=2) out.push({n:p[0].trim(), r:p.slice(1).join("|").trim()});
  });
  return out.length ? out : DEFAULT_CREDITS;
}

function getRoadmap(){
  try{
    var raw = localStorage.getItem("ss_roadmap");
    if(raw) return JSON.parse(raw);
  }catch(e){}
  return DEFAULT_ROADMAP;
}
function renderRoadmap(){
  var host = document.getElementById("roadmapList");
  if(!host) return;
  var items = getRoadmap(), html = "";
  for(var i=0;i<items.length;i++){
    var it = items[i];
    html += "<details><summary><span class='d'>"+esc(it.d)+"</span> "+esc(it.t)+"</summary><p>"+esc(it.b)+"</p></details>";
  }
  host.innerHTML = html;
}
// In progress / Coming next can be edited on the dev page (saved in this browser only)
function getList(key, fallback){
  try{
    var raw = localStorage.getItem(key);
    if(raw) return JSON.parse(raw);
  }catch(e){}
  return fallback;
}
function getProgress(){ return getList("ss_progress", IN_PROGRESS); }
function getNext(){ return getList("ss_next", COMING_NEXT); }
function renderGroup(hostId, items){
  var host = document.getElementById(hostId);
  if(!host) return;
  var html = "";
  for(var i=0;i<items.length;i++){
    var it = items[i];
    html += "<details><summary><span class='d'>"+esc(it.d||"")+"</span> "+esc(it.t)+"</summary><p>"+esc(it.b)+"</p><a class='mini' data-preset='Idea for "+esc(it.t)+": ' href='#community'>suggest something for this</a></details>";
  }
  host.innerHTML = html;
}
// the game lives at play/ (the Unity web build); a dev-page link can point somewhere else
function playUrl(u){
  u = String(u || "").trim();
  if(/^https?:\/\//i.test(u)) return u;
  if(u && !/^[a-z][a-z0-9+.-]*:/i.test(u) && !/^\/\//.test(u)) return u; // relative path like play/
  return "play/";
}
function playNote(){
  var P = window.SS ? SS.play() : {soon:true, title:"NOT DONE YET", msg:""};
  if(!P.soon){ window.location.href = playUrl(P.url); return; }
  var box = document.getElementById("playSoon");
  if(P.soon && box){
    document.getElementById("psTitle").textContent = P.title || "NOT DONE YET";
    document.getElementById("psMsg").textContent = P.msg || "";
    box.classList.add("open");
    var ok = document.getElementById("psOk"); if(ok) setTimeout(function(){ ok.focus(); }, 50);
    return;
  }
  var n=document.getElementById("playNote");
  if(n){ n.textContent="Still in the works. The playable web build lands the day it exists - the ROADMAP has the latest updates."; n.classList.add("hot"); }
  showPage("roadmap");
}
function closePlaySoon(){ var b=document.getElementById("playSoon"); if(b) b.classList.remove("open"); }
function updateOwnerState(){
  var role = window.SS ? SS.role() : null;
  var s=document.getElementById("ownerState");
  if(s){ s.textContent = role==="owner" ? "Owner signed in" : (role==="dev" ? "Dev signed in" : ""); }
  // Chats are OWNER ONLY (dev mode never sees them)
  var oc=document.getElementById("ownerChats");
  if(oc) oc.hidden = role!=="owner";
  // owner only: tap a coder's name in the credits to open your chat with them
  var dds=document.querySelectorAll("dd[data-chat]");
  for(var i=0;i<dds.length;i++){
    var dd=dds[i], name=dd.getAttribute("data-name") || dd.textContent;
    dd.setAttribute("data-name", name);
    if(role==="owner") dd.innerHTML = '<a href="owner-chat.html#' + dd.getAttribute("data-chat") + '">' + esc(name) + '</a>';
    else dd.textContent = name;
  }
  if(window.SS) SS.badge();
}
function esc(s){
  return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}
function roadmapToText(){
  return getRoadmap().map(function(r){return r.d+" | "+r.t+" | "+r.b;}).join("\n");
}
function textToRoadmap(txt){
  var out=[];
  txt.split("\n").forEach(function(line){
    if(!line.trim()) return;
    var p = line.split("|");
    if(p.length>=3) out.push({d:p[0].trim(),t:p[1].trim(),b:p.slice(2).join("|").trim()});
  });
  return out;
}

// ---- owner / dev tools ----
// The button only shows for signed-in staff (acct.js). Nobody else can get in: no codes.
function openDev(){
  if(window.SS && SS.role()){ window.location.href = "dev.html"; return; }
  if(window.TTVM) TTVM.toast("Owner/Dev only \u2014 sign in with an approved Google account.");
}
function closeDev(){}
// the dev page's live preview calls this after every change
window.ssRefresh = function(){
  renderCredits();
  renderRoadmap();
  renderGroup("progressList", getProgress());
  renderGroup("nextList", getNext());
  if(window.SS) SS.applySite();
  updateOwnerState();
};
document.addEventListener("DOMContentLoaded", function(){
  if(!document.getElementById("play")) return; // only the home page (dev.html loads this file for the default lists)
  renderCredits();
  renderRoadmap();
  renderGroup("progressList", getProgress());
  renderGroup("nextList", getNext());
  if(window.SS) SS.applySite();
  var bl = document.getElementById("buildLine");
  if(bl) bl.textContent = "BUILD " + SS_BUILD;
  var links = document.querySelectorAll("nav .links a");
  for(var i=0;i<links.length;i++){
    links[i].addEventListener("click", function(ev){
      var href = this.getAttribute("href") || "";
      if(href.charAt(0) !== "#") return; // real page (like games/): just go there
      var id = href.slice(1);
      if(id && document.getElementById(id)){ ev.preventDefault(); showPage(id); }
    });
  }
  var logo = document.querySelector("nav .logo");
  if(logo) logo.addEventListener("click", function(){ showPage(null); });
  var pb = document.getElementById("playBtn");
  if(pb) pb.addEventListener("click", function(ev){ ev.preventDefault(); playNote(); });
  var hp = document.getElementById("heroPlay");
  if(hp) hp.addEventListener("click", function(ev){ ev.preventDefault(); playNote(); });
  var mbtns = document.querySelectorAll(".mbtn");
  for(var m=0;m<mbtns.length;m++){
    (function(b){
      b.addEventListener("click", function(ev){
        var id=(b.getAttribute("href")||"").slice(1);
        if(b.id==="heroPlay"){ ev.preventDefault(); playNote(); return; }
        if(id && document.getElementById(id) && document.getElementById(id).classList.contains("page")){ ev.preventDefault(); showPage(id); }
      });
    })(mbtns[m]);
  }
  var ob=document.getElementById("ownerBtn");
  if(ob) ob.addEventListener("click", function(){ openDev(); });
  updateOwnerState();
  var sf = document.getElementById("sugForm");
  if(sf) sf.addEventListener("submit", sugSend);
  var to=document.getElementById("talkOwner");
  if(to) to.addEventListener("click", function(){
    var n=document.getElementById("talkNote");
    if(n) n.style.display = (n.style.display==="none") ? "block" : "none";
  });
  document.addEventListener("click", function(ev){
    var a = ev.target;
    while(a && a !== document.body && !(a.tagName === "A")) a = a.parentNode;
    if(!a || a.tagName !== "A") return;
    var preset = a.getAttribute("data-preset");
    if(preset){
      ev.preventDefault();
      var f = document.getElementById("sugIdea");
      if(f){ f.value = preset; }
      var t = document.getElementById("sugType");
      if(t) t.value = "suggestion";
      showPage("community");
      if(f) setTimeout(function(){ f.focus(); }, 60);
      return;
    }
    if(a.classList.contains("goSug")){
      ev.preventDefault();
      showPage("community");
      var f2 = document.getElementById("sugIdea");
      if(f2) setTimeout(function(){ f2.focus(); }, 60);
    }
  });
  var cl = document.getElementById("claimLink");
  if(cl) cl.addEventListener("click", function(ev){
    ev.preventDefault();
    var t = document.getElementById("sugType");
    if(t) t.value = "model credit claim";
    showPage("community");
    var f = document.getElementById("sugIdea");
    if(f) setTimeout(function(){ f.focus(); }, 60);
  });
  bgmSetup();
  renderMusic();
  var bu=document.getElementById("burger"), sm=document.getElementById("sideMenu"), bk=document.getElementById("sideBack");
  function sideClose(){ if(sm) sm.classList.remove("open"); if(bk) bk.classList.remove("open"); }
  if(bu) bu.addEventListener("click", function(ev){ ev.stopPropagation(); sm.classList.add("open"); bk.classList.add("open"); });
  if(bk) bk.addEventListener("click", sideClose);
  if(sm) sm.querySelectorAll("a").forEach(function(a){
    a.addEventListener("click", function(ev){
      var href = a.getAttribute("href") || "";
      if(href.charAt(0) !== "#" && !a.classList.contains("sm-play")){ sideClose(); return; } // real page: let it open
      ev.preventDefault(); sideClose();
      var id = href.slice(1);
      if(a.classList.contains("sm-play")){ playNote(); return; }
      if(id === "play") showPage(null); else showPage(id);
    });
  });
  var dot=document.getElementById("devDot");
  if(dot) dot.addEventListener("click", openDev);
  // owner / dev links follow the Google sign-in once acct.js has checked it
  if(window.TTVM) TTVM.on(function(){ updateOwnerState(); });
  var ps=document.getElementById("playSoon");
  if(ps) ps.addEventListener("click", function(ev){ if(ev.target===ps) closePlaySoon(); });
  var pk=document.getElementById("psOk"); if(pk) pk.addEventListener("click", closePlaySoon);
  var pr=document.getElementById("psRoad"); if(pr) pr.addEventListener("click", function(){ closePlaySoon(); showPage("roadmap"); });
  document.addEventListener("keydown", function(ev){
    if(ev.key==="Escape"){ closeDev(); closePlaySoon(); }
  });
});

// ---- build version ----
var SS_BUILD = "v1.18 \u00b7 OCT 31 2026";

// ---- page-view navigation ----
function showPage(id){
  var secs = document.querySelectorAll("section.page");
  var found = false;
  for(var i=0;i<secs.length;i++){
    var on = !!id && secs[i].id === id;
    secs[i].classList.toggle("on", on);
    if(on) found = true;
  }
  document.body.classList.toggle("paged", found);
  document.body.classList.toggle("home", !found);
  var nav = document.querySelectorAll("nav .links a");
  for(var k=0;k<nav.length;k++){
    var href = nav[k].getAttribute("href") || "";
    nav[k].classList.toggle("on", found && href === "#" + id);
  }
  if(found) window.scrollTo(0,0);
  else if(id){
    // home-page sections (like Games in progress): go home, then scroll to it
    var tgt = document.getElementById(id);
    if(tgt) setTimeout(function(){ tgt.scrollIntoView({behavior:"smooth", block:"start"}); }, 40);
  }
}

// ---- suggestion form ----
var SUG_KEY = "23423945-20f5-4cfb-9d9f-6b6f73f0f3ea";
function sugSend(ev){
  ev.preventDefault();
  var msg = document.getElementById("sugMsg");
  var idea = (document.getElementById("sugIdea").value || "").trim();
  if(!idea){ msg.textContent = "Type your idea first."; return; }
  var handle = (document.getElementById("sugName").value || "").trim();
  var link = (document.getElementById("sugLink").value || "").trim();
  var bot = document.querySelector("#sugForm input[name=botcheck]");
  if(bot && bot.checked){ return; }
  var btn = document.getElementById("sugSend");
  btn.disabled = true; msg.textContent = "Sending...";
  fetch("https://api.web3forms.com/submit", {
    method: "POST",
    headers: {"Content-Type":"application/json","Accept":"application/json"},
    body: JSON.stringify({
      access_key: SUG_KEY,
      subject: (document.getElementById("sugType").value === "model credit claim" ? "Model credit claim" : "Skibidi Strike suggestion") + (handle ? " from " + handle : ""),
      from_name: "Skibidi Strike site",
      name: handle || "anonymous",
      idea: idea,
      link: link,
      page: window.location.href
    })
  }).then(function(r){ return r.json(); }).then(function(d){
    if(d && d.success){
      msg.textContent = "Sent. The studio has it - thanks!";
      document.getElementById("sugType").value = "suggestion";
      document.getElementById("sugIdea").value = "";
      document.getElementById("sugName").value = "";
      document.getElementById("sugLink").value = "";
    } else {
      msg.textContent = "Didn't go through. Try again in a minute.";
    }
    btn.disabled = false;
  }).catch(function(){
    msg.textContent = "Didn't go through. Try again in a minute.";
    btn.disabled = false;
  });
}

// ---- music tab (soundtrack list from data/music.json; no song files hosted here) ----
function renderMusic(){
  var host = document.getElementById("trackList");
  if(!host) return;
  function esc(v){ return String(v == null ? "" : v).replace(/[&<>"']/g, function(c){ return {"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c]; }); }
  fetch("data/music.json?v=3", {cache:"no-cache"}).then(function(r){ return r.json(); }).then(function(d){
    var list = (d && d.tracks) || [], game = (d && d.game) || "Skibidi Strike", html = "";
    if(!list.length){ host.innerHTML = '<p class="note">No tracks listed yet.</p>'; return; }
    for(var i=0;i<list.length;i++){
      var t = list[i], n = t.n || (i+1);
      var lic = t.license ? (t.licenseUrl ? '<a href="' + esc(t.licenseUrl) + '" target="_blank" rel="noopener">' + esc(t.license) + '</a>' : esc(t.license)) : 'not listed';
      html += '<div class="tile track">'
        + '<span class="track-no">' + (n < 10 ? "0" + n : n) + '</span>'
        + '<h4>' + esc(t.title) + '</h4>'
        + '<p class="track-artist">' + esc(t.artist || "Artist unknown") + '</p>'
        + '<dl class="track-meta">'
        + '<div><dt>License</dt><dd>' + lic + '</dd></div>'
        + '<div><dt>Used in</dt><dd>' + esc(t.usedIn || game) + '</dd></div>'
        + '</dl>'
        + (t.credit ? '<p class="track-note track-credit">' + esc(t.credit) + '</p>' : '')
        + (t.note ? '<p class="track-note">' + esc(t.note) + '</p>' : '')
        + '<div class="track-btns">'
        + (t.audio && t.audio.parts && t.audio.parts.length ? '<button type="button" class="track-listen track-play" data-i="' + i + '">&#9654; Play</button>' : '')
        + (t.listen ? '<a class="track-listen" href="' + esc(t.listen) + '" target="_blank" rel="noopener">Source' + (t.listenLabel ? ' <span>&middot; ' + esc(t.listenLabel) + '</span>' : '') + '</a>' : '')
        + '</div>'
        + '<audio class="track-audio" controls preload="none" hidden></audio>'
        + '</div>';
    }
    host.innerHTML = html;
    var btns = host.querySelectorAll(".track-play");
    for(var b=0;b<btns.length;b++) btns[b].addEventListener("click", function(){ musicPlay(this, list[+this.getAttribute("data-i")]); });
  }).catch(function(){
    host.innerHTML = '<p class="note">The track list didn\'t load. Refresh to try again.</p>';
  });
}
// joins a track's audio parts into one file in the browser, then plays it (one track at a time)
function musicPlay(btn, t){
  var tile = btn.closest(".track"), au = tile && tile.querySelector(".track-audio");
  if(!au || !t || !t.audio) return;
  var all = document.querySelectorAll("#trackList .track-audio");
  for(var k=0;k<all.length;k++){ if(all[k] !== au && !all[k].paused) all[k].pause(); }
  if(au.src){ au.hidden = false; var p0 = au.play(); if(p0 && p0.catch) p0.catch(function(){}); return; }
  if(btn.disabled) return;
  btn.disabled = true; btn.textContent = "Loading...";
  var base = t.audio.base || "";
  Promise.all(t.audio.parts.map(function(p){
    return fetch(base + p).then(function(r){ if(!r.ok) throw new Error(r.status); return r.arrayBuffer(); });
  })).then(function(bufs){
    au.src = URL.createObjectURL(new Blob(bufs, {type: t.audio.type || "audio/mpeg"}));
    au.hidden = false; btn.hidden = true;
    au.addEventListener("play", function(){
      var others = document.querySelectorAll("#trackList .track-audio");
      for(var k=0;k<others.length;k++){ if(others[k] !== au && !others[k].paused) others[k].pause(); }
    });
    var p = au.play(); if(p && p.catch) p.catch(function(){});
  }).catch(function(){
    btn.disabled = false; btn.innerHTML = "&#9654; Play";
    var m = tile.querySelector(".track-err");
    if(!m){ m = document.createElement("p"); m.className = "track-note track-err"; tile.appendChild(m); }
    m.textContent = "Couldn't load this track. Try again in a moment.";
  });
}

// ---- background music ----
function bgmSetup(){
  var bgm = document.getElementById("bgm");
  var btn = document.getElementById("bgmBtn");
  if(!bgm || !btn) return;
  bgm.volume = 0.45;
  function tryPlay(){ var p = bgm.play(); if(p && p.catch) p.catch(function(){}); }
  tryPlay();
  var kick = function(){
    if(bgm.paused) tryPlay();
    document.removeEventListener("click", kick);
    document.removeEventListener("keydown", kick);
    document.removeEventListener("touchstart", kick);
  };
  document.addEventListener("click", kick);
  document.addEventListener("keydown", kick);
  document.addEventListener("touchstart", kick);
  btn.addEventListener("click", function(ev){
    ev.stopPropagation();
    if(bgm.paused){ tryPlay(); btn.classList.remove("off"); }
    else { bgm.pause(); btn.classList.add("off"); }
  });
}
