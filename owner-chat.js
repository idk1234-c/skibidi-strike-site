// Skibidi Strike — studio chats (owner only)
// The chats live in the PRIVATE repo (chat/*.json). This page has no secrets in it:
// it only works with the owner's own GitHub key, saved in this browser.
(function(){
"use strict";

var REPO = "idk1234-c/skibidi-strike";
var BRANCH = "main";
var API = "https://api.github.com/repos/" + REPO + "/contents/";
var TOKEN_KEY = "ss_chat_token";
var ME = "Amos";
var POLL_OPEN_MS = 15000;   // open thread
var POLL_ALL_MS = 60000;    // the other threads (unread dots)

var PEOPLE = {
  "Amos":         {ini:"A",  cls:"p-amos"},
  "Titan TV Man": {ini:"TT", cls:"p-titan"},
  "UTC Studios": {ini:"UTC", cls:"p-utc"}
};
var THREADS = [
  {key:"coders",     file:"chat/coders.json",     title:"Titan TV Man \u2194 UTC Studios", short:"Coders",
   who:["Titan TV Man","UTC Studios"],
   note:"This is Titan TV Man and UTC Studios' own chat. You can read all of it, and you can post here too."},
  {key:"amos-titan", file:"chat/amos-titan.json", title:"Amos \u2194 Titan TV Man",        short:"Titan TV Man", who:["Titan TV Man"]},
  {key:"amos-utc",  file:"chat/amos-utc.json",  title:"Amos \u2194 UTC Studios",        short:"UTC Studios", who:["UTC Studios"]},
  {key:"group",      file:"chat/group.json",      title:"Group chat",                       short:"Group",        who:["Titan TV Man","UTC Studios","Amos"]}
];

var state = {
  token: null,
  open: null,          // thread key
  data: {},            // key -> {sha, doc, etag, loadedAt, missing}
  pending: {},         // key -> [msg] (sending)
  timers: [],
  sending: false
};

// ---------- helpers ----------
function $(id){ return document.getElementById(id); }
function esc(s){
  return String(s == null ? "" : s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;");
}
// escape first, then turn http(s) links into safe anchors
function linkify(text){
  var out = "", re = /\bhttps?:\/\/[^\s<>"']+/gi, last = 0, m;
  var s = String(text == null ? "" : text);
  while((m = re.exec(s))){
    var url = m[0], trail = "";
    while(/[.,!?;:)\]}]$/.test(url)){ trail = url.slice(-1) + trail; url = url.slice(0,-1); }
    out += esc(s.slice(last, m.index));
    out += '<a href="' + esc(url) + '" target="_blank" rel="noopener noreferrer nofollow">' + esc(url) + '</a>' + esc(trail);
    last = m.index + m[0].length;
  }
  out += esc(s.slice(last));
  return out.replace(/\n/g, "<br>");
}
function b64ToUtf8(b64){
  var bin = atob(String(b64).replace(/\s/g,""));
  var bytes = new Uint8Array(bin.length);
  for(var i=0;i<bin.length;i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder("utf-8").decode(bytes);
}
function utf8ToB64(str){
  var bytes = new TextEncoder().encode(str), bin = "", CH = 0x8000;
  for(var i=0;i<bytes.length;i+=CH) bin += String.fromCharCode.apply(null, bytes.subarray(i, i+CH));
  return btoa(bin);
}
function person(name){ return PEOPLE[name] || {ini:(String(name||"?").trim().charAt(0)||"?").toUpperCase(), cls:"p-other"}; }
function avatar(name, small){
  var p = person(name);
  return '<span class="oc-av ' + p.cls + (small ? ' sm' : '') + '" title="' + esc(name) + '">' + esc(p.ini) + '</span>';
}
function threadAvatar(t){
  if(t.who.length === 1) return avatar(t.who[0]);
  var h = '<span class="oc-avstack n' + t.who.length + '">';
  t.who.forEach(function(w){ h += avatar(w, true); });
  return h + '</span>';
}
function threadByKey(k){ for(var i=0;i<THREADS.length;i++) if(THREADS[i].key===k) return THREADS[i]; return null; }
function newId(){ return Date.now() + "-" + Math.random().toString(36).slice(2,8); }
function fmtTime(iso){
  var d = new Date(iso); if(isNaN(d)) return "";
  return d.toLocaleTimeString([], {hour:"numeric", minute:"2-digit"});
}
function fmtDay(iso){
  var d = new Date(iso); if(isNaN(d)) return "";
  var today = new Date(), y = new Date(); y.setDate(today.getDate()-1);
  if(d.toDateString() === today.toDateString()) return "Today";
  if(d.toDateString() === y.toDateString()) return "Yesterday";
  return d.toLocaleDateString([], {weekday:"short", month:"short", day:"numeric", year: d.getFullYear()===today.getFullYear() ? undefined : "numeric"});
}
function fmtShort(iso){
  var d = new Date(iso); if(isNaN(d)) return "";
  return (d.toDateString() === new Date().toDateString()) ? fmtTime(iso) : d.toLocaleDateString([], {month:"short", day:"numeric"});
}
function ago(ms){
  var s = Math.max(0, Math.round((Date.now() - ms)/1000));
  if(s < 5) return "just now";
  if(s < 60) return s + "s ago";
  var m = Math.round(s/60); if(m < 60) return m + "m ago";
  return Math.round(m/60) + "h ago";
}
function seenKey(k){ return "ss_chat_seen_" + k; }
function messagesOf(k){
  var d = state.data[k];
  var list = (d && d.doc && Array.isArray(d.doc.messages)) ? d.doc.messages.slice() : [];
  return list.filter(function(m){ return m && typeof m === "object"; });
}
function lastMsg(k){ var l = messagesOf(k); return l.length ? l[l.length-1] : null; }

// ---------- GitHub ----------
function ghErr(status, body){
  var e = new Error(body && body.message ? body.message : ("HTTP " + status));
  e.status = status; return e;
}
function gh(path, opts){
  opts = opts || {};
  var headers = {
    "Accept": "application/vnd.github+json",
    "Authorization": "Bearer " + state.token,
    "X-GitHub-Api-Version": "2022-11-28"
  };
  if(opts.etag) headers["If-None-Match"] = opts.etag;
  if(opts.body) headers["Content-Type"] = "application/json";
  return fetch(path, {method: opts.method || "GET", headers: headers, body: opts.body ? JSON.stringify(opts.body) : undefined, cache: "no-store"})
    .then(function(r){
      if(r.status === 304) return {notModified:true};
      return r.text().then(function(txt){
        var j = null; try { j = txt ? JSON.parse(txt) : null; } catch(e){}
        if(!r.ok) throw ghErr(r.status, j);
        return {json: j, etag: r.headers.get("ETag")};
      });
    });
}
function parseDoc(text, t){
  var doc;
  try { doc = JSON.parse(text); } catch(e){ var er = new Error("chat file is not valid JSON"); er.badJson = true; throw er; }
  if(!doc || typeof doc !== "object") doc = {};
  if(!Array.isArray(doc.messages)) doc.messages = [];
  if(!doc.thread) doc.thread = t.key;
  if(!doc.title) doc.title = t.title;
  return doc;
}
// returns {sha, doc} ; missing file -> {sha:null, doc:empty, missing:true}
function readThread(t, useEtag){
  var d = state.data[t.key];
  return gh(API + t.file + "?ref=" + BRANCH, {etag: useEtag && d && d.etag})
    .then(function(res){
      if(res.notModified) return {notModified:true};
      var j = res.json;
      var p = (j.encoding === "base64" && j.content) ? Promise.resolve(b64ToUtf8(j.content))
            : gh(j.git_url).then(function(b){ return b64ToUtf8(b.json.content); }); // big files (>1 MB)
      return p.then(function(text){ return {sha: j.sha, doc: parseDoc(text, t), etag: res.etag}; });
    }, function(err){
      if(err.status === 404) return {sha:null, doc:{thread:t.key, title:t.title, messages:[]}, missing:true};
      throw err;
    });
}
function refresh(t, quiet){
  return readThread(t, true).then(function(r){
    var d = state.data[t.key] || (state.data[t.key] = {});
    d.loadedAt = Date.now(); d.error = null;
    if(!r.notModified){ d.sha = r.sha; d.doc = r.doc; d.etag = r.etag || null; d.missing = !!r.missing; }
    if(state.open === t.key){ renderThread(); markSeen(t.key); }
    renderSide();
  }).catch(function(err){
    var d = state.data[t.key] || (state.data[t.key] = {});
    d.error = err;
    if(err.status === 401){ logout("That key stopped working (expired or deleted). Paste a new one."); return; }
    if(!quiet || state.open === t.key) renderStatus();
  });
}
function sendMessage(t, text, voice){
  var msg = {id: newId(), from: ME, text: text, time: new Date().toISOString()};
  if(voice) msg.voice = true;  // dictated with the mic: coders, read it generously
  (state.pending[t.key] = state.pending[t.key] || []).push(msg);
  renderThread(); scrollBottom(true);
  var attempt = 0;
  function tryOnce(){
    attempt++;
    return readThread(t, false).then(function(r){
      var doc = r.doc;
      if(!doc.messages.some(function(m){ return m && m.id === msg.id; })) doc.messages.push(msg.voice ? {id: msg.id, from: msg.from, text: msg.text, time: msg.time, voice: true} : {id: msg.id, from: msg.from, text: msg.text, time: msg.time});
      var body = {
        message: "chat(" + t.key + "): message from " + ME,
        content: utf8ToB64(JSON.stringify(doc, null, 2) + "\n"),
        branch: BRANCH
      };
      if(r.sha) body.sha = r.sha;
      return gh(API + t.file, {method:"PUT", body: body}).then(function(res){
        var d = state.data[t.key] || (state.data[t.key] = {});
        d.sha = res.json && res.json.content ? res.json.content.sha : null;
        d.doc = doc; d.etag = null; d.missing = false; d.loadedAt = Date.now(); d.error = null;
      });
    }).catch(function(err){
      if((err.status === 409 || err.status === 422) && attempt < 4) return tryOnce(); // someone else wrote first: refetch + retry (3 retries)
      throw err;
    });
  }
  return tryOnce().then(function(){
    removePending(t.key, msg.id);
    markSeen(t.key);
    renderThread(); renderSide(); scrollBottom(true);
    return true;
  }, function(err){
    msg.failed = true; msg.error = friendly(err);
    renderThread();
    if(err.status === 401) logout("That key stopped working. Paste a new one.");
    return false;
  });
}
function removePending(k, id){
  state.pending[k] = (state.pending[k] || []).filter(function(m){ return m.id !== id; });
}
function friendly(err){
  if(!err) return "Something went wrong.";
  if(err.badJson) return "This chat file got broken (not valid JSON). Ask Titan TV Man to fix it.";
  if(err.status === 401) return "The key doesn't work (wrong, expired or deleted).";
  if(err.status === 403) return "The key can read but not write, or GitHub is rate-limiting. Check the key has Contents: Read and write.";
  if(err.status === 404) return "The key can't see the skibidi-strike repo. Make sure you picked it under \"Only select repositories\".";
  if(err.status === 409 || err.status === 422) return "Someone else posted at the same moment. Tap retry.";
  if(err instanceof TypeError) return "No connection. Check your internet.";
  return err.message || "Something went wrong.";
}

// ---------- rendering ----------
function unread(k){
  var l = lastMsg(k);
  if(!l || l.from === ME) return false;
  return localStorage.getItem(seenKey(k)) !== String(l.id);
}
function markSeen(k){ var l = lastMsg(k); if(l) localStorage.setItem(seenKey(k), String(l.id)); }
function renderSide(){
  var side = $("ocSide"), h = "";
  THREADS.forEach(function(t){
    var l = lastMsg(t.key), on = state.open === t.key;
    var prev = l ? ((l.from === ME ? "You: " : (t.who.length > 1 ? String(l.from || "?").split(" ")[0] + ": " : "")) + String(l.text || "")) : "No messages yet";
    h += '<button type="button" class="oc-tab' + (on ? ' on' : '') + (unread(t.key) && !on ? ' unread' : '') + '" data-k="' + t.key + '" aria-current="' + (on ? 'true' : 'false') + '">'
      + threadAvatar(t)
      + '<span class="oc-tab-txt"><span class="oc-tab-top"><b class="oc-full">' + esc(t.title) + '</b><b class="oc-short">' + esc(t.short) + '</b>'
      + (l ? '<time>' + esc(fmtShort(l.time)) + '</time>' : '') + '</span>'
      + '<span class="oc-prev">' + esc(prev).slice(0, 140) + '</span></span>'
      + '<i class="oc-dot" aria-hidden="true"></i></button>';
  });
  side.innerHTML = h;
}
function renderStatus(){
  var t = threadByKey(state.open), d = state.data[state.open], el = $("ocStatus");
  if(!t){ el.textContent = ""; return; }
  var s = t.who.filter(function(w){ return w !== ME; }).join(", ") + (t.key === "group" ? " + you" : "");
  if(d && d.error) { el.innerHTML = '<span class="bad">' + esc(friendly(d.error)) + '</span>'; return; }
  el.textContent = s + " \u00b7 " + (d && d.loadedAt ? "updated " + ago(d.loadedAt) : "loading\u2026");
}
function bubble(m, prev, next, t){
  var mine = m.from === ME;
  var startGroup = !prev || prev.from !== m.from || (new Date(m.time) - new Date(prev.time) > 5*60000);
  var endGroup = !next || next.from !== m.from || (new Date(next.time) - new Date(m.time) > 5*60000);
  var h = '<div class="oc-row ' + (mine ? 'me' : 'them') + (startGroup ? ' start' : '') + (endGroup ? ' end' : '') + '">';
  if(!mine) h += endGroup ? avatar(m.from, true) : '<span class="oc-av-sp"></span>';
  h += '<div class="oc-col">';
  if(startGroup && !mine) h += '<div class="oc-meta"><b class="' + person(m.from).cls + '">' + esc(m.from) + '</b> <time>' + esc(fmtTime(m.time)) + '</time></div>';
  if(startGroup && mine) h += '<div class="oc-meta"><time>' + esc(fmtTime(m.time)) + '</time></div>';
  h += '<div class="oc-bub' + (m.failed ? ' failed' : '') + (m.sending ? ' sending' : '') + '">' + linkify(m.text) + '</div>';
  if(m.voice === true) h += '<div class="oc-sub oc-vtag">\ud83c\udfa4 voice note</div>';
  if(m.sending && !m.failed) h += '<div class="oc-sub">Sending\u2026</div>';
  if(m.failed) h += '<div class="oc-sub bad">Not sent. ' + esc(m.error || "") + ' <button type="button" class="oc-retry" data-id="' + esc(m.id) + '">Retry</button></div>';
  h += '</div></div>';
  return h;
}
function renderThread(){
  var t = threadByKey(state.open); if(!t) return;
  var box = $("ocMsgs");
  var nearBottom = box.scrollHeight - box.scrollTop - box.clientHeight < 80;
  $("ocTitle").textContent = t.title;
  $("ocHeadAv").innerHTML = threadAvatar(t);
  var note = $("ocNote");
  if(t.note){ note.textContent = t.note; note.hidden = false; } else note.hidden = true;
  var d = state.data[t.key];
  var list = messagesOf(t.key);
  // file order = the order messages were appended (clocks can differ, so no sorting by time)
  var have = {}; list.forEach(function(m){ have[m.id] = 1; });
  (state.pending[t.key] || []).forEach(function(p){ if(!have[p.id]) list.push({id:p.id, from:p.from, text:p.text, time:p.time, voice:p.voice, sending:true, failed:p.failed, error:p.error}); });
  var h = "", lastDay = "";
  if(!d || (!d.loadedAt && !d.error)) h = '<div class="oc-empty">Loading\u2026</div>';
  else if(!list.length) h = '<div class="oc-empty">' + (d.missing ? "This chat hasn't been started yet. Say something and it'll be created." : "No messages yet.") + '</div>';
  for(var i=0;i<list.length;i++){
    var day = fmtDay(list[i].time);
    if(day && day !== lastDay){ h += '<div class="oc-day"><span>' + esc(day) + '</span></div>'; lastDay = day; }
    h += bubble(list[i], list[i-1], list[i+1], t);
  }
  box.innerHTML = h;
  renderStatus();
  if(nearBottom) scrollBottom();
}
function scrollBottom(force){ var b = $("ocMsgs"); b.scrollTop = b.scrollHeight; }

function openThread(k, fromUser){
  var t = threadByKey(k) || THREADS[0];
  state.open = t.key;
  try { history.replaceState(null, "", "#" + t.key); } catch(e){}
  renderSide(); renderThread(); scrollBottom(true);
  refresh(t).then(function(){ scrollBottom(true); });
  if(fromUser){
    var on = document.querySelector('.oc-tab.on'), side = $("ocSide");
    if(on && side.scrollWidth > side.clientWidth) side.scrollLeft = on.offsetLeft - (side.clientWidth - on.offsetWidth)/2;
  }
}


// ---------- voice to text (mic) ----------
// Uses the browser's own speech recognition (Chrome, Edge, Safari on iPhone 14.5+).
// The text is cleaned up (SSVoice.clean: capitals, periods, no "um", Amos's mishear fixes from
// the dev page) and put in the box so Amos can check it. It is NEVER sent automatically.
var V = {rec: null, on: false, base: "", finals: "", interim: "", raw: "", cleaned: "", wantStop: false};
function SR(){ return window.SpeechRecognition || window.webkitSpeechRecognition || null; }
function voiceBar(msg, undo){
  var bar = $("ocVoiceBar"); bar.hidden = false;
  bar.classList.toggle("live", V.on);
  $("ocVoiceTxt").textContent = msg;
  $("ocVoiceUndo").hidden = !undo;
}
function hideVoiceBar(){ $("ocVoiceBar").hidden = true; $("ocVoiceBar").classList.remove("live"); }
function growBox(){ var ta = $("ocText"); ta.style.height = "auto"; ta.style.height = Math.min(ta.scrollHeight, 140) + "px"; }
function joinText(a, b){ a = a.replace(/\s+$/, ""); return a ? (b ? a + " " + b : a) : b; }
function voiceFinish(){
  var heard = (V.finals + " " + V.interim).replace(/\s+/g, " ").trim();
  V.interim = "";
  if(!heard){ voiceBar("Didn't catch anything. Tap the mic and try again.", false); return; }
  var dict = window.SSVoice ? SSVoice.loadDict() : "";
  V.raw = heard;
  V.cleaned = window.SSVoice ? SSVoice.clean(heard, dict) : heard;
  var ta = $("ocText"), u = $("ocVoiceUndo");
  u.textContent = "Show what it heard"; u.removeAttribute("data-showing");
  ta.value = joinText(V.base, V.cleaned); growBox();
  $("ocVoiceNote").checked = true;
  voiceBar("Cleaned up. Check it, then tap Send.", V.raw !== V.cleaned);
  ta.focus();
}
function voiceStop(silent){
  if(!V.on) return;
  V.wantStop = true;
  try { V.rec.stop(); } catch(e){}
  if(silent){ V.on = false; setMicUI(); }
}
function setMicUI(){ var m = $("ocMic"); m.classList.toggle("on", V.on); m.setAttribute("aria-pressed", V.on ? "true" : "false"); m.setAttribute("aria-label", V.on ? "Stop listening" : "Talk to type"); }
function voiceStart(){
  var C = SR();
  if(!C){ voiceBar("Voice typing doesn't work in this browser. Try Safari on your iPhone or Chrome on a computer.", false); return; }
  var r = new C();
  r.lang = "en-US"; r.continuous = true; r.interimResults = true; r.maxAlternatives = 1;
  V.rec = r; V.on = true; V.wantStop = false; V.finals = ""; V.interim = ""; V.base = $("ocText").value;
  r.onresult = function(ev){
    var interim = "";
    for(var i = ev.resultIndex; i < ev.results.length; i++){
      var tx = ev.results[i][0].transcript;
      if(ev.results[i].isFinal) V.finals += " " + tx; else interim += tx;
    }
    V.interim = interim;
    var live = (V.finals + " " + V.interim).replace(/\s+/g, " ").trim();
    voiceBar(live || "Listening\u2026", false);
  };
  r.onerror = function(ev){
    var e = ev && ev.error;
    V.on = false; setMicUI();
    if(e === "not-allowed" || e === "service-not-allowed") voiceBar("The mic is blocked. Allow the microphone for this site (iPhone: Settings > Safari > Microphone), then try again.", false);
    else if(e === "no-speech") voiceBar("Didn't hear anything. Tap the mic and talk.", false);
    else if(e === "network") voiceBar("Voice typing needs the internet. Check your connection.", false);
    else if(e !== "aborted") voiceBar("Voice typing stopped (" + String(e || "unknown") + "). Tap the mic to try again.", false);
  };
  r.onend = function(){
    var was = V.on;
    V.on = false; setMicUI();
    if(was || V.wantStop) voiceFinish();
  };
  try { r.start(); } catch(e){ V.on = false; voiceBar("Couldn't start the mic. Try again.", false); }
  setMicUI();
  if(V.on) voiceBar("Listening\u2026 tap the mic again when you're done.", false);
}

// ---------- owner mode only ----------
function isOwner(){ return !window.SS || SS.role() === "owner"; }

// ---------- login ----------
function showLogin(msg){
  $("ocApp").hidden = true; $("ocLogin").hidden = false;
  $("ocLoginErr").textContent = msg || "";
  var tok = $("ocToken"); tok.value = "";
  setTimeout(function(){ tok.focus(); }, 50);
}
function stopTimers(){ state.timers.forEach(clearInterval); state.timers = []; }
function logout(msg){
  stopTimers();
  localStorage.removeItem(TOKEN_KEY);
  state.token = null; state.data = {}; state.pending = {};
  $("ocMsgs").innerHTML = ""; $("ocSide").innerHTML = "";
  showLogin(msg);
}
function startApp(){
  $("ocLogin").hidden = true; $("ocApp").hidden = false;
  var hash = (location.hash || "").slice(1);
  openThread(threadByKey(hash) ? hash : THREADS[0].key);
  THREADS.forEach(function(t){ if(t.key !== state.open) refresh(t, true); });
  stopTimers();
  state.timers.push(setInterval(function(){
    if(document.hidden) return;
    var t = threadByKey(state.open); if(t) refresh(t, true);
  }, POLL_OPEN_MS));
  state.timers.push(setInterval(function(){
    if(document.hidden) return;
    THREADS.forEach(function(t){ if(t.key !== state.open) refresh(t, true); });
  }, POLL_ALL_MS));
  state.timers.push(setInterval(renderStatus, 1000));
}
function tryLogin(tok){
  tok = String(tok || "").trim();
  if(!tok){ $("ocLoginErr").textContent = "Paste your key first."; return; }
  if(/\s/.test(tok)){ $("ocLoginErr").textContent = "That doesn't look like a GitHub key (it has spaces in it)."; return; }
  state.token = tok;
  var btn = $("ocLoginBtn"); btn.disabled = true; btn.textContent = "Checking\u2026";
  gh("https://api.github.com/repos/" + REPO).then(function(){
    localStorage.setItem(TOKEN_KEY, tok);
    startApp();
  }, function(err){
    state.token = null;
    $("ocLoginErr").textContent = friendly(err);
  }).then(function(){ btn.disabled = false; btn.textContent = "Open chats"; });
}

// ---------- events ----------
document.addEventListener("DOMContentLoaded", function(){
  $("ocLoginForm").addEventListener("submit", function(ev){ ev.preventDefault(); tryLogin($("ocToken").value); });
  $("ocLogout").addEventListener("click", function(){
    if(confirm("Log out and forget the key on this device?")) logout("Logged out. The key was removed from this browser.");
  });
  $("ocRefresh").addEventListener("click", function(){ var t = threadByKey(state.open); if(t) refresh(t); });
  $("ocSide").addEventListener("click", function(ev){
    var b = ev.target.closest ? ev.target.closest(".oc-tab") : null;
    if(b) openThread(b.getAttribute("data-k"), true);
  });
  var ta = $("ocText");
  function grow(){ ta.style.height = "auto"; ta.style.height = Math.min(ta.scrollHeight, 140) + "px"; }
  ta.addEventListener("input", grow);
  ta.addEventListener("keydown", function(ev){
    if(ev.key === "Enter" && !ev.shiftKey && !ev.isComposing && window.matchMedia("(hover:hover)").matches){
      ev.preventDefault(); $("ocCompose").requestSubmit ? $("ocCompose").requestSubmit() : $("ocSend").click();
    }
  });
  $("ocCompose").addEventListener("submit", function(ev){
    ev.preventDefault();
    var text = ta.value.replace(/\s+$/,"");
    if(!text.trim()) return;
    var t = threadByKey(state.open); if(!t) return;
    var voice = $("ocVoiceNote").checked;
    voiceStop(true);
    ta.value = ""; grow(); ta.focus();
    $("ocVoiceNote").checked = false; hideVoiceBar();
    sendMessage(t, text, voice);
  });
  $("ocMsgs").addEventListener("click", function(ev){
    var b = ev.target.closest ? ev.target.closest(".oc-retry") : null;
    if(!b) return;
    var t = threadByKey(state.open), id = b.getAttribute("data-id");
    var p = (state.pending[t.key] || []).filter(function(m){ return m.id === id; })[0];
    if(!p) return;
    removePending(t.key, id);
    sendMessage(t, p.text, p.voice);
  });
  window.addEventListener("hashchange", function(){
    var k = (location.hash || "").slice(1);
    if(state.token && threadByKey(k) && k !== state.open) openThread(k);
  });
  document.addEventListener("visibilitychange", function(){
    if(!document.hidden && state.token){ var t = threadByKey(state.open); if(t) refresh(t, true); }
  });

  $("ocMic").addEventListener("click", function(){ if(V.on) voiceStop(false); else voiceStart(); });
  $("ocVoiceUndo").addEventListener("click", function(){
    var ta = $("ocText");
    if(this.getAttribute("data-showing") === "raw"){ ta.value = joinText(V.base, V.cleaned); this.textContent = "Show what it heard"; this.removeAttribute("data-showing"); }
    else { ta.value = joinText(V.base, V.raw); this.textContent = "Use the cleaned-up version"; this.setAttribute("data-showing", "raw"); }
    growBox();
  });
  if(!SR()) $("ocMic").classList.add("nosupport");

  // chats are OWNER MODE only (dev mode can't open them)
  if(!isOwner()){ $("ocNotOwner").hidden = false; $("ocLogin").hidden = true; $("ocApp").hidden = true; return; }
  state.token = localStorage.getItem(TOKEN_KEY);
  if(state.token) startApp(); else showLogin("");
});
})();
