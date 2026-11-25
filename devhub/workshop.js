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
var STV = { "new": "New", working: "Working", done: "Done" };
var STP = { working: "Working", queued: "Queued", paused: "On hold", done: "Done" };
var PAGE = document.body.getAttribute("data-page");
var openId = null, openKind = "video";
try {
  var q = new URLSearchParams(location.search);
  openId = q.get("id");
  openKind = q.get("kind") || "video";
} catch(e) { openId = null; }
var VDOC = null, PDOC = null;

function allowed(){ return !!(T && T.allowed && T.allowed("mod")); }
function media(u){
  u = String(u || "");
  return /^https?:/i.test(u) ? u : "../data/" + u.replace(/^\.\//, "");
}
function ytEmbed(u){
  var m = String(u || "").match(/(?:youtu\.be\/|v=|shorts\/|embed\/)([A-Za-z0-9_-]{6,})/);
  return m ? m[1] : "";
}
function chip(cls, txt){ return '<i class="ws-chip ' + cls + '">' + esc(txt) + "</i>"; }
function stChipV(r){ return chip("ws-st-" + esc(r.status), esc(STV[r.status] || r.status || "")); }
function stChipP(p){ return chip("ws-st-" + esc(p.status), esc(STP[p.status] || p.status || "")); }
function savedMsg(res){
  if(!res) return "";
  if(res.saved === "live") return "Saved. Live on the site.";
  if(res.saved === "studio") return "Saved in the studio copy; the site catches up in a minute." + (res.error ? " (" + res.error + ")" : "");
  return "Couldn't publish: no GitHub key saved on this device." + (res.error ? " (" + res.error + ")" : "");
}
function render(){
  var root = $("wsRoot"); if(!root) return;
  if(!allowed()){ root.innerHTML = '<p class="pf-empty">Owner and moderators only.</p>'; return; }
  if(!VDOC || !PDOC){ root.innerHTML = '<p class="pf-empty">Loading...</p>'; return; }
  if(openId){ detail(root); return; }
  gallery(root);
}
function vCard(r){
  return '<a class="ws-card" href="workshop.html?id=' + encodeURIComponent(r.id) + '&kind=video"><h3>' + esc(r.what || "(no title)") + '</h3>' +
    '<div class="ws-chips">' + stChipV(r) + (r.job && JOBS[r.job] ? chip("ws-kind", JOBS[r.job]) : "") + '</div>' +
    '<p class="acct-small">' + esc(r.by || "") + ' &middot; ' + esc(T.when(r.date)) + '</p>' +
    (r.text ? '<p class="ws-what">' + esc(String(r.text).slice(0, 90)) + '</p>' : "") + '</a>';
}
function pCard(p){
  return '<a class="ws-card" href="workshop.html?id=' + encodeURIComponent(p.id) + '&kind=project"><h3>' + esc(p.title || "(no title)") + '</h3>' +
    '<div class="ws-chips">' + stChipP(p) + '</div>' +
    '<p class="ws-eta">Time estimate: <b>' + esc(p.eta || "TBD") + '</b></p>' +
    (p.what ? '<p class="ws-what">' + esc(String(p.what).slice(0, 90)) + '</p>' : "") + '</a>';
}
function gallery(root){
  var vids = (VDOC.videos || []).slice().sort(function(a, b){ return T.ms(b.date) - T.ms(a.date); });
  var vCur = vids.filter(function(r){ return r.status !== "done"; });
  var vDone = vids.filter(function(r){ return r.status === "done"; });
  var ps = (PDOC.projects || []);
  var pCur = ps.filter(function(p){ return p.status !== "done"; });
  var pDone = ps.filter(function(p){ return p.status === "done"; });
  var order = { working: 0, "new": 0, paused: 1, queued: 2 };
  pCur.sort(function(a, b){
    var oa = order[a.status] === undefined ? 9 : order[a.status];
    var ob = order[b.status] === undefined ? 9 : order[b.status];
    return oa - ob;
  });
  var h = '<div class="ws-top">';
  h += '<section class="ac-card"><h2 class="ac-h2">New job</h2><p class="pf-note">Drop in a video, pick the job and it runs without you having to ask in the chat: editing for YouTube (cuts, speed-ups, captions, a hook), counting how many times something appears, screenshots of a character or detail. The finished work lands back on this page, ready for your upload.</p>' + formHtml() + '</section>';
  h += '<aside class="ac-card"><h2 class="ac-h2">Done jobs</h2>';
  h += (vDone.length || pDone.length) ? '<div class="ws-mini">' + vDone.map(vCard).join("") + pDone.map(pCard).join("") + '</div>' : '<p class="pf-empty">Nothing finished yet.</p>';
  h += '</aside></div>';
  h += '<section class="ac-card ws-current"><h2 class="ac-h2">Current jobs (in the making)</h2>';
  h += (vCur.length || pCur.length) ? '<div class="ws-cards">' + vCur.map(vCard).join("") + pCur.map(pCard).join("") + '</div>' : '<p class="pf-empty">Nothing in the making right now.</p>';
  h += '</section>';
  root.innerHTML = h;
  wireForm();
}
function detail(root){
  if(openKind === "project") return detailP(root);
  var r = (VDOC.videos || []).filter(function(x){ return x.id === openId; })[0];
  if(!r){ openId = null; gallery(root); return; }
  var yt = ytEmbed(r.video);
  var html = '<p><a class="acct-small" href="workshop.html" style="color:#9a9ba8">&larr; Back to the workshop</a></p>';
  html += '<section class="ac-card"><div class="ac-row" style="justify-content:space-between;flex-wrap:wrap"><h1 class="ac-h1" style="margin:0;font-size:1.4rem">' + esc(r.what || "Job") + '</h1>' + stChipV(r) + '</div>';
  html += '<p class="acct-small">Added by ' + esc(r.by || "") + (r.role ? " (" + esc(r.role) + ")" : "") + ' &middot; ' + esc(T.when(r.date)) + '</p>';
  html += '<p>' + chip("ws-kind", r.job && JOBS[r.job] ? JOBS[r.job] : (r.job || "")) + '</p>';
  if(r.text) html += '<p>' + esc(r.text) + '</p>';
  if(r.video) html += yt ? '<div class="ws-video"><iframe src="https://www.youtube.com/embed/' + esc(yt) + '" title="video" allowfullscreen loading="lazy"></iframe></div>' : '<p><a href="' + esc(r.video) + '" target="_blank" rel="noopener">Open the video &rarr;</a></p>';
  html += '</section>';
  if((r.notes || []).length) html += '<section class="ac-card"><h2 class="ac-h2">Progress</h2>' + r.notes.map(function(n){ return '<p class="ws-note">' + esc(n) + '</p>'; }).join("") + '</section>';
  var imgs = (r.results || []).filter(function(x){ return x.type === "image" && x.src; });
  var links = (r.results || []).filter(function(x){ return x.type === "link" && x.url; });
  if(imgs.length || links.length){
    html += '<section class="ac-card"><h2 class="ac-h2">Results</h2>';
    if(links.length) html += '<ul class="ws-links">' + links.map(function(x){ return '<li><a href="' + esc(x.url) + '" target="_blank" rel="noopener">' + esc(x.label || x.url) + '</a></li>'; }).join("") + '</ul>';
    if(imgs.length) html += '<div class="ws-cards" style="margin-top:10px">' + imgs.map(function(x){ return '<figure><a href="' + esc(media(x.src)) + '" target="_blank" rel="noopener"><img loading="lazy" src="' + esc(media(x.src)) + '" alt="' + esc(x.label || "") + '" style="max-width:100%;border-radius:10px"></a><figcaption class="acct-small">' + esc(x.label || "") + '</figcaption></figure>'; }).join("") + '</div>';
    html += '</section>';
  }
  html += '<section class="ac-card"><h2 class="ac-h2">Options</h2><div class="ac-row" id="wsActs">' +
    '<button type="button" class="acct-btn sm" data-ws="working">Mark working</button>' +
    '<button type="button" class="acct-btn sm" data-ws="done">Mark done</button>' +
    '<button type="button" class="acct-btn ghost sm" data-ws="note">Add note</button>' +
    '<button type="button" class="acct-btn ghost sm" data-ws="link">Add result link</button>' +
    '<button type="button" class="acct-btn ghost sm" data-ws="img">Add image link</button>' +
    '<button type="button" class="acct-btn ghost sm" data-ws="del">Delete</button></div>' +
    '<p class="acct-small" id="wsMsg" role="status"></p></section>';
  root.innerHTML = html;
  wireActs(r);
}
function detailP(root){
  var p = (PDOC.projects || []).filter(function(x){ return x.id === openId; })[0];
  if(!p){ openId = null; gallery(root); return; }
  var html = '<p><a class="acct-small" href="workshop.html" style="color:#9a9ba8">&larr; Back to the workshop</a></p>';
  html += '<section class="ac-card"><div class="ac-row" style="justify-content:space-between;flex-wrap:wrap"><h1 class="ac-h1" style="margin:0;font-size:1.4rem">' + esc(p.title || "Job") + '</h1>' + stChipP(p) + '</div>';
  html += '<p class="ws-eta">Time estimate: <b>' + esc(p.eta || "TBD") + '</b></p>';
  if(p.what) html += '<p>' + esc(p.what) + '</p>';
  if(p.updated) html += '<p class="acct-small">Updated ' + esc(p.updated) + '</p>';
  html += '</section>';
  if((p.notes || []).length) html += '<section class="ac-card"><h2 class="ac-h2">History</h2>' + p.notes.map(function(n){ return '<p class="ws-note">' + esc(n) + '</p>'; }).join("") + '</section>';
  root.innerHTML = html;
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
    var m = $("wsMsg"); if(m) m.textContent = savedMsg(res);
    if(kind === "del"){ setTimeout(function(){ location.href = "workshop.html"; }, 400); return; }
    T.data("videos", true).then(function(d){ VDOC = d; render(); });
  }, function(e){ var m = $("wsMsg"); if(m) m.textContent = e.message; });
}
function wireActs(r){
  Array.prototype.forEach.call(document.querySelectorAll("[data-ws]"), function(b){
    b.onclick = function(){
      var k = b.getAttribute("data-ws");
      if(k === "working" || k === "done") return act(r, k);
      if(k === "note"){ var t = prompt("Note:"); if(t && t.trim()) act(r, "note", t.trim()); return; }
      if(k === "link"){ var l1 = prompt("Label (e.g. Edited video):"); var url = prompt("Link URL:"); if(url && url.trim()) act(r, "link", {url:url.trim(), label:l1 || ""}); return; }
      if(k === "img"){ var l2 = prompt("Label:"); var src = prompt("Image URL (or a data/ws-media file name):"); if(src && src.trim()) act(r, "img", {src:src.trim(), label:l2 || ""}); return; }
      if(k === "del"){ if(confirm("Delete this job?")) act(r, "del"); return; }
    };
  });
}
function formHtml(){
  return '<form id="wsForm" class="ws-form">' +
    '<label class="acct-small" for="wsWhat">What is it?</label><input id="wsWhat" maxlength="80" placeholder="e.g. Space Engineers survival" required>' +
    '<label class="acct-small" for="wsJob">The job</label><select id="wsJob">' +
    Object.keys(JOBS).map(function(k){ return '<option value="' + k + '">' + esc(JOBS[k]) + '</option>'; }).join("") + '</select>' +
    '<label class="acct-small" for="wsVideo">Video link (an unlisted YouTube upload works best for long videos)</label><input id="wsVideo" placeholder="https://...">' +
    '<label class="acct-small" for="wsFile">...or upload a small clip or picture (up to 6 MB)</label><input type="file" id="wsFile" accept="video/*,image/*">' +
    '<label class="acct-small" for="wsText">Details (optional)</label><textarea id="wsText" maxlength="600" placeholder="For counting: what to count and how to recognize it. For editing: the vibe, what to cut, music..."></textarea>' +
    '<div class="ac-row"><button class="acct-btn" type="submit">Queue it</button><span class="acct-small" id="wsFormMsg" role="status"></span></div></form>';
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
  var form = $("wsForm"); if(!form) return;
  form.onsubmit = function(e){
    e.preventDefault();
    var what = $("wsWhat").value.trim(); if(!what) return;
    var job = $("wsJob").value || "edit", video = $("wsVideo").value.trim(), text = $("wsText").value.trim();
    var file = $("wsFile").files[0];
    var msg = $("wsFormMsg");
    var entry = {id:"v" + Date.now().toString(36), by:T.me().name, role:T.effectiveRole(), date:T.iso(), what:what, job:job, video:video, text:text, status:"new", notes:[], results:[]};
    var clearF = function(){ $("wsWhat").value = ""; $("wsVideo").value = ""; $("wsText").value = ""; $("wsFile").value = ""; };
    var fin = function(t){
      msg.textContent = t; clearF();
      T.data("videos", true).then(function(d){ VDOC = d; render(); });
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
        .then(function(res){ VDOC = res && res.doc ? res.doc : VDOC; msg.textContent = savedMsg(res); clearF(); render(); }, function(e2){ msg.textContent = e2.message; });
      return;
    }
    msg.textContent = "Sending...";
    sendEmail({subject:"Video job from " + T.me().name + ": " + what, name:T.me().name, job:JOBS[job] || job, video:video, details:text},
      function(){ fin("Queued! It lands here when it's done."); },
      function(){ msg.textContent = "Didn't go through. Try again in a minute."; });
  };
}
T.on(function(S){
  if(PAGE !== "workshop") return;
  if(!allowed()){ var root = $("wsRoot"); if(root) root.innerHTML = '<p class="pf-empty">Owner and moderators only.</p>'; return; }
  var pv = T.data("videos", true).then(function(d){ VDOC = d; }, function(){ VDOC = {videos:[]}; });
  var pp = fetch("../data/projects.json?v=" + Date.now()).then(function(r){ return r.json(); }).then(function(d){ PDOC = d; }, function(){ PDOC = {projects:[]}; });
  Promise.all([pv, pp]).then(render, render);
});
})();
