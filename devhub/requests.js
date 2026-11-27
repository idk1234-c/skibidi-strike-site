(function(){
"use strict";
var $ = function(id){ return document.getElementById(id); };
var T = window.TTVM, esc = T.esc;
var SUG_KEY = "23423945-20f5-4cfb-9d9f-6b6f73f0f3ea";   // same inbox the site's other forms already reach Fo on
var KINDS = { idea:"Feature idea", bug:"Bug fix", change:"Change", feedback:"Feedback" };
var PAGE = document.body.getAttribute("data-page");
var DOC = null;

function allowed(){ return !!(T && T.allowed && T.allowed("staff")); }
function chip(cls, txt){ return '<i class="rq-chip ' + cls + '">' + esc(txt) + '</i>'; }
function savedMsg(res){
  if(!res) return "Sent. It lands with Fo.";
  if(res.saved === "live") return "Saved. It lands with Fo.";
  if(res.saved === "studio") return "Saved in the studio copy; the site catches up in a minute." + (res.error ? " (" + res.error + ")" : "");
  return "Sent. It lands with Fo." + (res.error ? " (" + res.error + ")" : "");
}
function reload(){ return T.data("devdesk", true).then(function(d){ DOC = d; render(); }, function(){ DOC = {submissions:[]}; render(); }); }

function render(){
  var root = $("rqRoot"); if(!root) return;
  if(!allowed()){ root.innerHTML = '<p class="pf-empty">Owner, mods and devs only.</p>'; return; }
  if(!DOC){ root.innerHTML = '<p class="pf-empty">Loading...</p>'; return; }
  gallery(root);
}

function gallery(root){
  var list = (DOC.submissions || []).slice().sort(function(a,b){ return T.ms(b.date) - T.ms(a.date); });
  var html = '<section class="ac-card"><h2 class="ac-h2">New submission</h2>' + formHtml() + '</section>';
  html += '<section class="ac-card"><h2 class="ac-h2">Past submissions</h2>';
  html += list.length ? '<div class="dd-list">' + list.map(item).join("") + '</div>' : '<p class="pf-empty">Nothing submitted yet.</p>';
  html += '</section>';
  root.innerHTML = html;
  wireForm();
}

function item(r){
  return '<div class="dd-item"><div class="rq-chips">' + chip("rq-kind", KINDS[r.kind] || r.kind || "") + '</div>' +
    '<p class="acct-small">' + esc(r.by || "") + ' &middot; ' + esc(T.when(r.date)) + '</p>' +
    '<p>' + esc((r.text || "").slice(0, 140)) + '</p></div>';
}

function formHtml(){
  return '<form id="ddForm" class="rq-form">' +
    '<label class="acct-small" for="ddKind">What is it?</label><select id="ddKind">' +
    Object.keys(KINDS).map(function(k){ return '<option value="' + k + '">' + esc(KINDS[k]) + '</option>'; }).join("") + '</select>' +
    '<label class="acct-small" for="ddText">Details</label><textarea id="ddText" maxlength="1200" placeholder="What should change, what broke, or the idea itself..." required></textarea>' +
    '<label class="acct-small" for="ddFile">Picture or short clip (optional, up to 6 MB)</label><input type="file" id="ddFile" accept="video/*,image/*">' +
    '<div class="ac-row"><button class="acct-btn" type="submit">Send to Fo</button><span class="acct-small" id="ddMsg" role="status"></span></div></form>';
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
  var form = $("ddForm"); if(!form) return;
  form.onsubmit = function(e){
    e.preventDefault();
    var kind = $("ddKind").value || "feedback", text = $("ddText").value.trim(), file = $("ddFile").files[0];
    var msg = $("ddMsg");
    if(!text){ msg.textContent = "Write a line of details first."; return; }
    var entry = {id:"dd" + Date.now().toString(36), by:T.me().name, role:T.effectiveRole(), date:T.iso(), kind:kind, text:text, file:file ? {name:file.name, type:file.type, size:file.size} : null};
    var label = KINDS[kind] || kind;
    var save = function(cb){
      if(T.token()){
        T.save("devdesk", function(d){ if(!d.submissions) d.submissions = []; d.submissions.unshift(entry); }, "Dev desk: " + label + " from " + T.me().name)
          .then(function(res){ DOC = res && res.doc ? res.doc : DOC; cb(res); }, function(e2){ msg.textContent = e2.message; });
      } else cb(null);
    };
    var fin = function(t){ msg.textContent = t; $("ddText").value = ""; $("ddFile").value = ""; reload(); };
    if(file){
      if(file.size > 6 * 1024 * 1024){ msg.textContent = "That file is over 6 MB. Paste a link instead, or send it to Fo in the chat."; return; }
      msg.textContent = "Sending...";
      var fr = new FileReader();
      fr.onload = function(){
        var b64 = String(fr.result).split(",")[1];
        sendEmail({subject:"Dev desk: " + label + " from " + T.me().name, name:T.me().name, kind:label, details:text, attachments:[{filename:file.name, content:b64, content_type:file.type}]},
          function(){ save(function(){ fin("Sent. It lands with Fo."); }); },
          function(){ msg.textContent = "Didn't go through. Try again in a minute."; });
      };
      fr.readAsDataURL(file);
      return;
    }
    msg.textContent = "Sending...";
    if(T.token()){
      save(function(res){ fin(savedMsg(res)); });
      return;
    }
    sendEmail({subject:"Dev desk: " + label + " from " + T.me().name, name:T.me().name, kind:label, details:text},
      function(){ fin("Sent. It lands with Fo."); },
      function(){ msg.textContent = "Didn't go through. Try again in a minute."; });
  };
}

var started = false;
T.on(function(S){
  if(PAGE !== "requests") return;
  if(!started) started = true;
  if(!allowed()){ var root = $("rqRoot"); if(root) root.innerHTML = '<p class="pf-empty">Owner, mods and devs only.</p>'; return; }
  reload();
});
})();
