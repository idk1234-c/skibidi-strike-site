(function(){
"use strict";
var $ = function(id){ return document.getElementById(id); };
var T = window.TTVM, esc = T.esc;
var SUG_KEY = "23423945-20f5-4cfb-9d9f-6b6f73f0f3ea";
var JOBS = {
  edit: "Edit it for YouTube (cuts, speed-ups, captions, a hook)",
  count: "How many times does something appear",
  shots: "Screenshots of a character or detail",
  other: "Something else"
};
var ST = { "new": "New", working: "Working", done: "Done" };
var PAGE = document.body.getAttribute("data-page");
var openId = null;
try { openId = new URLSearchParams(location.search).get("id"); } catch(e) { openId = null; }
var DOC = null;

function allowed(){ return !!(T && T.allowed && T.allowed("owner")); }
function media(u){
  u = String(u || "");
  return /^https?:/i.test(u) ? u : "../data/" + u.replace(/^\.\//, "");
}
function ytEmbed(u){
  var m = String(u || "").match(/(?:youtu\.be\/|v=|shorts\/|embed\/)([A-Za-z0-9_-]{6,})/);
  return m ? m[1] : "";
}
function chip(cls, txt){ return '<i class="vt-chip ' + cls + '">' + esc(txt) + '</i>'; }
function stChip(r){ return chip("vt-st-" + esc(r.status), esc(ST[r.status] || r.status || "")); }
function savedMsg(res){
  if(!res) return "";
  if(res.saved === "live") return "Saved. Live on the site.";
  if(res.saved === "studio") return "Saved in the studio copy; the site catches up in a minute." + (res.error ? " (" + res.error + ")" : "");
  return "Couldn't publish: no GitHub key saved on this device." + (res.error ? " (" + res.error + ")" : "");
}
function reload(){ return T.data("videos", true).then(function(d){ DOC = d; render(); }); }

function render(){
  var root = $("vtRoot"); if(!root) return;
  if(!allowed()){ root.innerHTML = '<p class="pf-empty">Owner only.</p>'; return; }
  if(!DOC){ root.innerHTML = '<p class="pf-empty">Loading...</p>'; return; }
  if(openId){ detail(root); return; }
  gallery(root);
}

function gallery(root){
  var list = (DOC.videos || []).slice().sort(function(a, b){ return T.ms(b.date) - T.ms(a.date); });
  var html = '<section class="ac-card"><h2 class="ac-h2">New job</h2>' + formHtml() + '</section>';
  html += '<section class="ac-card"><h2 class="ac-h2">Your jobs</h2>';
  html += list.length ? '<div class="vt-grid">' + list.map(card).join("") + '</div>' : '<p class="pf-empty">Nothing queued. Drop a video above and Fo gets to work.</p>';
  html += '</section>';
  root.innerHTML = html;
  wireForm();
}

function card(r){
  var img = (r.results || []).filter(function(x){ return x.type === "image" && x.src; })[0];
  var yt = ytEmbed(r.video);
  var thumb = img ? '<img class="vt-thumb" loading="lazy" alt="" src="' + esc(media(img.src)) + '">' : (yt ? '<span class="vt-thumb vt-thumb-v">&#9654;</span>' : "");
  return '<a class="vt-card" href="tools.html?id=' + encodeURIComponent(r.id) + '">' + thumb +
    '<div class="vt-ct"><h3>' + esc(r.what || "(no title)") + '</h3>' +
    '<div class="vt-chips">' + stChip(r) + (r.job && JOBS[r.job] ? chip("vt-kind", JOBS[r.job]) : "") + '</div>' +
    '<p class="acct-small">' + esc(r.by || "") + ' &middot; ' + esc(T.when(r.date)) + '</p>' +
    '<p>' + esc((r.text || "").slice(0, 110)) + '</p></div></a>';
}

function detail(root){
  var r = (DOC.videos || []).filter(function(x){ return x.id === openId; })[0];
  if(!r){ openId = null; gallery(root); return; }
  var yt = ytEmbed(r.video);
  var html = '<p><a class="acct-small" href="tools.html" style="color:#9a9ba8">&larr; All jobs</a></p>';
  html += '<section class="ac-card"><div class="ac-row" style="justify-content:space-between;flex-wrap:wrap"><h1 class="ac-h1" style="margin:0;font-size:1.4rem">' + esc(r.what || "Job") + '</h1>' + stChip(r) + '</div>';
  html += '<p class="acct-small">Added by ' + esc(r.by || "") + (r.role ? " (" + esc(r.role) + ")" : "") + ' &middot; ' + esc(T.when(r.date)) + '</p>';
  html += '<p>' + chip("vt-kind", r.job && JOBS[r.job] ? JOBS[r.job] : (r.job || "")) + '</p>';
  if(r.text) html += '<p>' + esc(r.text) + '</p>';
  if(r.video) html += yt ? '<div class="vt-video"><iframe src="https://www.youtube.com/embed/' + esc(yt) + '" title="video" allowfullscreen loading="lazy"></iframe></div>' : '<p><a href="' + esc(r.video) + '" target="_blank" rel="noopener">Open the video &rarr;</a></p>';
  html += '</section>';
  if((r.notes || []).length) html += '<section class="ac-card"><h2 class="ac-h2">Progress</h2>' + r.notes.map(function(n){ return '<p class="vt-note">' + esc(n) + '</p>'; }).join("") + '</section>';
  var imgs = (r.results || []).filter(function(x){ return x.type === "image" && x.src; });
  var links = (r.results || []).filter(function(x){ return x.type === "link" && x.url; });
  if(imgs.length || links.length){
    html += '<section class="ac-card"><h2 class="ac-h2">Results</h2>';
    if(links.length) html += '<ul class="vt-links">' + links.map(function(x){ return '<li><a href="' + esc(x.url) + '" target="_blank" rel="noopener">' + esc(x.label || x.url) + '</a></li>'; }).join("") + '</ul>';
    if(imgs.length) html += '<div class="vt-grid vt-grid2" style="margin-top:10px">' + imgs.map(function(x){ return '<figure class="vt-res"><a href="' + esc(media(x.src)) + '" target="_blank" rel="noopener"><img loading="lazy" src="' + esc(media(x.src)) + '" alt="' + esc(x.label || "") + '"></a><figcaption class="acct-small">' + esc(x.label || "") + '</figcaption></figure>'; }).join("") + '</div>';
    html += '</section>';
  }
  html += '<section class="ac-card"><h2 class="ac-h2">Tools</h2><div class="ac-row" id="vtActs">' +
    '<button type="button" class="acct-btn sm" data-vt="working">Mark working</button>' +
    '<button type="button" class="acct-btn sm" data-vt="done">Mark done</button>' +
    '<button type="button" class="acct-btn ghost sm" data-vt="note">Add note</button>' +
    '<button type="button" class="acct-btn ghost sm" data-vt="link">Add result link</button>' +
    '<button type="button" class="acct-btn ghost sm" data-vt="img">Add image link</button>' +
    '<button type="button" class="acct-btn ghost sm" data-vt="del">Delete</button></div>' +
    '<p class="acct-small" id="vtMsg" role="status"></p></section>';
  root.innerHTML = html;
  wireActs(r);
}

function act(r, kind, cb){
  T.save("videos", function(d){
    var me = d.videos.filter(function(x){ return x.id === r.id; })[0];
    if(!me) throw new Error("Job not found");
    if(kind === "working" || kind === "done") me.status = kind;
    else if(kind === "note") me.notes = (me.notes || []).concat([T.when(T.iso()) + ": " + cb]);
    else if(kind === "link") me.results = (me.results || []).concat([{type:"link", url:cb.url, label:cb.label}]);
    else if(kind === "img") me.results = (me.results || []).concat([{type:"image", src:cb.src, label:cb.label}]);
    else if(kind === "del") d.videos = d.videos.filter(function(x){ return x.id !== r.id; });
  }, "Video job " + r.id + ": " + kind).then(function(res){
    var m = $("vtMsg"); if(m) m.textContent = savedMsg(res);
    DOC = res && res.doc ? res.doc : DOC;
    if(kind === "del"){ setTimeout(function(){ location.href = "tools.html"; }, 400); return; }
    setTimeout(function(){ if(res && res.doc) reload(); }, 300);
  }, function(e){ var m = $("vtMsg"); if(m) m.textContent = e.message; });
}

function wireActs(r){
  Array.prototype.forEach.call(document.querySelectorAll("[data-vt]"), function(b){
    b.onclick = function(){
      var k = b.getAttribute("data-vt");
      if(k === "working" || k === "done") return act(r, k);
      if(k === "note"){ var t = prompt("Note:"); if(t && t.trim()) act(r, "note", t.trim()); return; }
      if(k === "link"){ var l1 = prompt("Label (e.g. Edited video):"); var url = prompt("Link URL:"); if(url && url.trim()) act(r, "link", {url:url.trim(), label:l1 || ""}); return; }
      if(k === "img"){ var l2 = prompt("Label:"); var src = prompt("Image URL (or a data/vt-media file name):"); if(src && src.trim()) act(r, "img", {src:src.trim(), label:l2 || ""}); return; }
      if(k === "del"){ if(confirm("Delete this job?")) act(r, "del"); return; }
    };
  });
}

function formHtml(){
  return '<form id="vtForm" class="vt-form">' +
    '<label class="acct-small" for="vtWhat">What is it?</label><input id="vtWhat" maxlength="80" placeholder="e.g. Space Engineers survival" required>' +
    '<label class="acct-small" for="vtJob">The job</label><select id="vtJob">' +
    Object.keys(JOBS).map(function(k){ return '<option value="' + k + '">' + esc(JOBS[k]) + '</option>'; }).join("") + '</select>' +
    '<label class="acct-small" for="vtVideo">Video link (an unlisted YouTube upload works best for long videos)</label><input id="vtVideo" placeholder="https://...">' +
    '<label class="acct-small" for="vtFile">...or upload a small clip or picture (up to 6 MB)</label><input type="file" id="vtFile" accept="video/*,image/*">' +
    '<label class="acct-small" for="vtText">Details (optional)</label><textarea id="vtText" maxlength="600" placeholder="For counting: what to count and how to recognize it. For editing: the vibe, what to cut, music..."></textarea>' +
    '<div class="ac-row"><button class="acct-btn" type="submit">Queue it</button><span class="acct-small" id="vtFormMsg" role="status"></span></div></form>';
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
  var form = $("vtForm"); if(!form) return;
  form.onsubmit = function(e){
    e.preventDefault();
    var what = $("vtWhat").value.trim(); if(!what) return;
    var job = $("vtJob").value || "edit", video = $("vtVideo").value.trim(), text = $("vtText").value.trim();
    var file = $("vtFile").files[0];
    var msg = $("vtFormMsg");
    var entry = {id:"v" + Date.now().toString(36), by:T.me().name, role:T.effectiveRole(), date:T.iso(), what:what, job:job, video:video, text:text, status:"new", notes:[], results:[]};
    var clearF = function(){ $("vtWhat").value = ""; $("vtVideo").value = ""; $("vtText").value = ""; $("vtFile").value = ""; };
    var fin = function(t){
      msg.textContent = t; clearF();
      reload();
    };
    if(file){
      if(file.size > 6 * 1024 * 1024){ msg.textContent = "That file is over 6 MB. Upload it unlisted to YouTube and paste the link instead."; return; }
      msg.textContent = "Sending...";
      var fr = new FileReader();
      fr.onload = function(){
        var b64 = String(fr.result).split(",")[1];
        sendEmail({subject:"Video job from " + T.me().name + ": " + what, name:T.me().name, job:JOBS[job] || job, video:video, details:text, attachments:[{filename:file.name, content:b64, content_type:file.type}]},
          function(){ if(T.token()) T.save("videos", function(d){ d.videos.unshift(entry); }, "Video job from " + T.me().name).then(function(){ fin("Queued! The file went to Fo and the job is in the list."); }); else fin("Queued! The file went to Fo and it lands here when it's done."); },
          function(){ msg.textContent = "Didn't go through. Try again in a minute."; });
      };
      fr.readAsDataURL(file);
      return;
    }
    if(T.token()){
      T.save("videos", function(d){ d.videos.unshift(entry); }, "Video job from " + T.me().name)
        .then(function(res){ DOC = res && res.doc ? res.doc : DOC; msg.textContent = savedMsg(res); clearF(); render(); }, function(e2){ msg.textContent = e2.message; });
      return;
    }
    msg.textContent = "Sending...";
    sendEmail({subject:"Video job from " + T.me().name + ": " + what, name:T.me().name, job:JOBS[job] || job, video:video, details:text},
      function(){ fin("Queued! It lands here when it's done."); },
      function(){ msg.textContent = "Didn't go through. Try again in a minute."; });
  };
}

var started = false;
T.on(function(S){
  if(PAGE !== "tools") return;
  if(!started) started = true;
  if(!allowed()){ var root = $("vtRoot"); if(root) root.innerHTML = '<p class="pf-empty">Owner only.</p>'; return; }
  T.data("videos", true).then(function(d){ DOC = d; render(); }, function(){ var root = $("vtRoot"); if(root) root.innerHTML = '<p class="pf-empty">Could not load your jobs.</p>'; });
});
})();
