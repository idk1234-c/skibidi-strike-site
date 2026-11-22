(function(){
"use strict";
var $ = function(id){ return document.getElementById(id); };
var T = window.TTVM, esc = T.esc;
var SUG_KEY = "23423945-20f5-4cfb-9d9f-6b6f73f0f3ea";
var ASKS = {
  shots: "Screenshots of details (makeup, tattoos, gear...)",
  count: "How many times does this character appear",
  abilities: "What are this character's abilities",
  who: "Who or what is this character",
  other: "Something else"
};
var ST = { "new": "New", progress: "In progress", done: "Done" };
var PAGE = document.body.getAttribute("data-page");
var openId = null;
try { openId = new URLSearchParams(location.search).get("id"); } catch(e) { openId = null; }
var DOC = null;

function allowed(){ return !!(T && T.allowed && T.allowed("mod")); }
function media(u){
  u = String(u || "");
  return /^https?:/i.test(u) ? u : "../data/" + u.replace(/^\.\//, "");
}
function ytEmbed(u){
  var m = String(u || "").match(/(?:youtu\.be\/|v=|shorts\/|embed\/)([A-Za-z0-9_-]{6,})/);
  return m ? m[1] : "";
}
function chip(cls, txt){ return '<i class="rq-chip ' + cls + '">' + esc(txt) + '</i>'; }
function stChip(r){ return chip("rq-st-" + esc(r.status), esc(ST[r.status] || r.status || "")); }
function savedMsg(res){
  if(!res) return "";
  if(res.saved === "live") return "Saved. Live on the site.";
  if(res.saved === "studio") return "Saved in the studio copy; the site catches up in a minute." + (res.error ? " (" + res.error + ")" : "");
  return "Couldn't publish: no GitHub key saved on this device." + (res.error ? " (" + res.error + ")" : "");
}
function reload(){ return T.data("requests", true).then(function(d){ DOC = d; render(); }); }

function render(){
  var root = $("rqRoot"); if(!root) return;
  if(!allowed()){ root.innerHTML = '<p class="pf-empty">Owner and moderators only.</p>'; return; }
  if(!DOC){ root.innerHTML = '<p class="pf-empty">Loading...</p>'; return; }
  if(openId){ detail(root); return; }
  gallery(root);
}

function gallery(root){
  var list = (DOC.requests || []).slice().sort(function(a, b){ return T.ms(b.date) - T.ms(a.date); });
  var html = '<section class="ac-card"><h2 class="ac-h2">New request</h2>' + formHtml() + '</section>';
  html += '<section class="ac-card"><h2 class="ac-h2">Past requests</h2>';
  html += list.length ? '<div class="rq-grid">' + list.map(card).join("") + '</div>' : '<p class="pf-empty">No requests yet. Add the first one above.</p>';
  html += '</section>';
  root.innerHTML = html;
  wireForm();
}

function card(r){
  var img = (r.results || []).filter(function(x){ return x.type === "image" && x.src; })[0];
  var yt = ytEmbed(r.video);
  var thumb = img ? '<img class="rq-thumb" loading="lazy" alt="" src="' + esc(media(img.src)) + '">' : (yt ? '<span class="rq-thumb rq-thumb-v">&#9654;</span>' : "");
  return '<a class="rq-card" href="requests.html?id=' + encodeURIComponent(r.id) + '">' + thumb +
    '<div class="rq-ct"><h3>' + esc(r.character || "(no character)") + '</h3>' +
    '<div class="rq-chips">' + stChip(r) + (r.ask && ASKS[r.ask] ? chip("rq-kind", ASKS[r.ask]) : "") + '</div>' +
    '<p class="acct-small">' + esc(r.by || "") + ' &middot; ' + esc(T.when(r.date)) + '</p>' +
    '<p>' + esc((r.text || "").slice(0, 110)) + '</p></div></a>';
}

function detail(root){
  var r = (DOC.requests || []).filter(function(x){ return x.id === openId; })[0];
  if(!r){ openId = null; gallery(root); return; }
  var yt = ytEmbed(r.video);
  var html = '<p><a class="acct-small" href="requests.html" style="color:#9a9ba8">&larr; All requests</a></p>';
  html += '<section class="ac-card"><div class="ac-row" style="justify-content:space-between;flex-wrap:wrap"><h1 class="ac-h1" style="margin:0;font-size:1.4rem">' + esc(r.character || "Request") + '</h1>' + stChip(r) + '</div>';
  html += '<p class="acct-small">Asked by ' + esc(r.by || "") + (r.role ? " (" + esc(r.role) + ")" : "") + ' &middot; ' + esc(T.when(r.date)) + '</p>';
  html += '<p>' + chip("rq-kind", r.ask && ASKS[r.ask] ? ASKS[r.ask] : (r.ask || "")) + '</p>';
  if(r.text) html += '<p>' + esc(r.text) + '</p>';
  if(r.video) html += yt ? '<div class="rq-video"><iframe src="https://www.youtube.com/embed/' + esc(yt) + '" title="video" allowfullscreen loading="lazy"></iframe></div>' : '<p><a href="' + esc(r.video) + '" target="_blank" rel="noopener">Open the video &rarr;</a></p>';
  html += '</section>';
  if((r.notes || []).length) html += '<section class="ac-card"><h2 class="ac-h2">Notes</h2>' + r.notes.map(function(n){ return '<p class="rq-note">' + esc(n) + '</p>'; }).join("") + '</section>';
  var imgs = (r.results || []).filter(function(x){ return x.type === "image" && x.src; });
  var links = (r.results || []).filter(function(x){ return x.type === "link" && x.url; });
  if(imgs.length || links.length){
    html += '<section class="ac-card"><h2 class="ac-h2">Results</h2>';
    if(imgs.length) html += '<div class="rq-grid rq-grid2">' + imgs.map(function(x){ return '<figure class="rq-res"><a href="' + esc(media(x.src)) + '" target="_blank" rel="noopener"><img loading="lazy" src="' + esc(media(x.src)) + '" alt="' + esc(x.label || "") + '"></a><figcaption class="acct-small">' + esc(x.label || "") + '</figcaption></figure>'; }).join("") + '</div>';
    if(links.length) html += '<ul class="rq-links">' + links.map(function(x){ return '<li><a href="' + esc(x.url) + '" target="_blank" rel="noopener">' + esc(x.label || x.url) + '</a></li>'; }).join("") + '</ul>';
    html += '</section>';
  }
  html += '<section class="ac-card"><h2 class="ac-h2">Studio tools</h2><div class="ac-row" id="rqActs">' +
    '<button type="button" class="acct-btn ghost sm" data-rq="progress">In progress</button>' +
    '<button type="button" class="acct-btn sm" data-rq="done">Mark done</button>' +
    '<button type="button" class="acct-btn ghost sm" data-rq="note">Add note</button>' +
    '<button type="button" class="acct-btn ghost sm" data-rq="img">Add image link</button>' +
    '<button type="button" class="acct-btn ghost sm" data-rq="link">Add link</button>' +
    '<button type="button" class="acct-btn ghost sm" data-rq="del">Delete</button></div>' +
    '<p class="acct-small" id="rqMsg" role="status"></p></section>';
  root.innerHTML = html;
  wireActs(r);
}

function act(r, kind, cb){
  T.save("requests", function(d){
    var me = d.requests.filter(function(x){ return x.id === r.id; })[0];
    if(!me) throw new Error("Request not found");
    if(kind === "progress" || kind === "done") me.status = kind;
    else if(kind === "note") me.notes = (me.notes || []).concat([T.when(T.iso()) + ": " + cb]);
    else if(kind === "img") me.results = (me.results || []).concat([{type:"image", src:cb.src, label:cb.label}]);
    else if(kind === "link") me.results = (me.results || []).concat([{type:"link", url:cb.url, label:cb.label}]);
    else if(kind === "del") d.requests = d.requests.filter(function(x){ return x.id !== r.id; });
  }, "Character request " + r.id + ": " + kind).then(function(res){
    var m = $("rqMsg"); if(m) m.textContent = savedMsg(res);
    DOC = res && res.doc ? res.doc : DOC;
    if(kind === "del"){ setTimeout(function(){ location.href = "requests.html"; }, 400); return; }
    setTimeout(function(){ if(res && res.doc) reload(); }, 300);
  }, function(e){ var m = $("rqMsg"); if(m) m.textContent = e.message; });
}

function wireActs(r){
  Array.prototype.forEach.call(document.querySelectorAll("[data-rq]"), function(b){
    b.onclick = function(){
      var k = b.getAttribute("data-rq");
      if(k === "progress" || k === "done") return act(r, k);
      if(k === "note"){ var t = prompt("Note:"); if(t && t.trim()) act(r, "note", t.trim()); return; }
      if(k === "img"){ var label = prompt("Label (e.g. Face close-up):"); var src = prompt("Image URL (or a data/req-media file name):"); if(src && src.trim()) act(r, "img", {src:src.trim(), label:label || ""}); return; }
      if(k === "link"){ var l2 = prompt("Label:"); var url = prompt("Link URL:"); if(url && url.trim()) act(r, "link", {url:url.trim(), label:l2 || ""}); return; }
      if(k === "del"){ if(confirm("Delete this request?")) act(r, "del"); return; }
    };
  });
}

function formHtml(){
  return '<form id="rqForm" class="rq-form">' +
    '<label class="acct-small" for="rqChar">Character</label><input id="rqChar" maxlength="80" placeholder="Who is it about?" required>' +
    '<label class="acct-small" for="rqAsk">What do you want to know?</label><select id="rqAsk">' +
    Object.keys(ASKS).map(function(k){ return '<option value="' + k + '">' + esc(ASKS[k]) + '</option>'; }).join("") + '</select>' +
    '<label class="acct-small" for="rqVideo">Video link (YouTube and friends)</label><input id="rqVideo" placeholder="https://...">' +
    '<label class="acct-small" for="rqFile">...or upload a small clip or picture (up to 6 MB)</label><input type="file" id="rqFile" accept="video/*,image/*">' +
    '<label class="acct-small" for="rqText">Details (optional)</label><textarea id="rqText" maxlength="600" placeholder="Anything extra: which moments, which details..."></textarea>' +
    '<div class="ac-row"><button class="acct-btn" type="submit">Send request</button><span class="acct-small" id="rqFormMsg" role="status"></span></div></form>';
}

function sendEmail(fields, cb, fail){
  fields.access_key = SUG_KEY;
  fields.from_name = "TTVM Studios site";
  fields.page = location.href;
  fetch("https://api.web3forms.com/submit", {method:"POST", headers:{"Content-Type":"application/json", "Accept":"application/json"}, body:JSON.stringify(fields)})
    .then(function(r){ return r.json(); }).then(function(dd){ (dd && dd.success) ? cb() : fail(); })
    .catch(fail);
}

function wireForm(){
  var form = $("rqForm"); if(!form) return;
  form.onsubmit = function(e){
    e.preventDefault();
    var character = $("rqChar").value.trim(); if(!character) return;
    var ask = $("rqAsk").value, video = $("rqVideo").value.trim(), text = $("rqText").value.trim();
    var file = $("rqFile").files[0];
    var msg = $("rqFormMsg");
    var entry = {id:"r" + Date.now().toString(36), by:T.me().name, role:T.effectiveRole(), date:T.iso(), character:character, ask:ask, video:video, text:text, status:"new", notes:[], results:[]};
    var fin = function(t){
      msg.textContent = t; $("rqChar").value = ""; $("rqVideo").value = ""; $("rqText").value = ""; $("rqFile").value = "";
      reload();
    };
    if(file){
      if(file.size > 6 * 1024 * 1024){ msg.textContent = "That file is over 6 MB. Paste a link instead, or send it to Fo in the chat."; return; }
      msg.textContent = "Sending...";
      var fr = new FileReader();
      fr.onload = function(){
        var b64 = String(fr.result).split(",")[1];
        sendEmail({subject:"Character request from " + T.me().name, name:T.me().name, character:character, ask:ASKS[ask] || ask, video:video, details:text, attachments:[{filename:file.name, content:b64, content_type:file.type}]},
          function(){ if(T.token()) T.save("requests", function(d){ d.requests.unshift(entry); }, "Request from " + T.me().name).then(function(){ fin("Sent! The file went to Fo and the request is in the list."); }); else fin("Sent! The file went to Fo and it shows up here once Fo posts it."); },
          function(){ msg.textContent = "Didn't go through. Try again in a minute."; });
      };
      fr.readAsDataURL(file);
      return;
    }
    if(T.token()){
      T.save("requests", function(d){ d.requests.unshift(entry); }, "Request from " + T.me().name)
        .then(function(res){ DOC = res && res.doc ? res.doc : DOC; msg.textContent = savedMsg(res); render(); }, function(e2){ msg.textContent = e2.message; });
      return;
    }
    msg.textContent = "Sending...";
    sendEmail({subject:"Character request from " + T.me().name, name:T.me().name, character:character, ask:ASKS[ask] || ask, video:video, details:text},
      function(){ fin("Sent! It shows up here once Fo posts it."); },
      function(){ msg.textContent = "Didn't go through. Try again in a minute."; });
  };
}

var started = false;
T.on(function(S){
  if(PAGE !== "requests") return;
  if(!started) started = true;
  if(!allowed()){ var root = $("rqRoot"); if(root) root.innerHTML = '<p class="pf-empty">Owner and moderators only.</p>'; return; }
  T.data("requests", true).then(function(d){ DOC = d; render(); }, function(){ var root = $("rqRoot"); if(root) root.innerHTML = '<p class="pf-empty">Could not load the requests.</p>'; });
});
})();
