(function(){
"use strict";
var $ = function(id){ return document.getElementById(id); };
var T = window.TTVM || {};
var esc = T.esc || (function(){
  var M = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
  return function(s){ return String(s == null ? "" : s).replace(/[&<>"']/g, function(c){ return M[c]; }); };
})();
var ST = { working: "Working", queued: "Queued", paused: "On hold", done: "Done" };
function allowed(){ return !!(T && T.allowed && T.allowed("mod")); }
function chip(cls, txt){ return '<i class="pr-chip ' + cls + '">' + esc(txt) + "</i>"; }
function stChip(s){ return chip("pr-st-" + esc(s), esc(ST[s] || s || "")); }
function fmtDate(iso){
  if(!iso) return "";
  try {
    var d = new Date(iso);
    if(isNaN(d.getTime())) return iso;
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" }) + ", " +
           d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  } catch(e) { return iso; }
}
function card(p){
  var h = '<div class="pr-card">';
  h += '<div class="pr-top"><h3>' + esc(p.title) + '</h3>' + stChip(p.status) + '</div>';
  h += '<p class="pr-eta">Time estimate: <b>' + esc(p.eta || "TBD") + '</b></p>';
  if(p.what) h += '<p class="pr-what">' + esc(p.what) + '</p>';
  var notes = p.notes || [];
  if(notes.length){
    h += '<ul class="pr-notes">';
    for(var i = 0; i < notes.length; i++) h += '<li>' + esc(notes[i]) + '</li>';
    h += '</ul>';
  }
  if(p.updated) h += '<p class="pr-updated">Updated ' + esc(fmtDate(p.updated)) + '</p>';
  return h + '</div>';
}
function render(d){
  var root = $("pr-list");
  var list = (d && d.projects) ? d.projects : [];
  if(!list.length){ root.innerHTML = '<p class="pf-empty">Nothing in flight right now.</p>'; return; }
  var order = { working: 0, paused: 1, queued: 2, done: 3 };
  list.sort(function(a, b){
    var oa = order[a.status] === undefined ? 9 : order[a.status];
    var ob = order[b.status] === undefined ? 9 : order[b.status];
    return oa - ob;
  });
  var h = "";
  for(var i = 0; i < list.length; i++) h += card(list[i]);
  root.innerHTML = h;
}
function init(){
  var root = $("pr-list");
  if(!root) return;
  if(!allowed()){ root.innerHTML = '<p class="pf-empty">Owner and moderators only.</p>'; return; }
  fetch("../data/projects.json?v=" + Date.now()).then(function(r){ return r.json(); }).then(render)
    .catch(function(){ root.innerHTML = '<p class="pf-empty">Couldn\'t load the project list. Try again in a minute.</p>'; });
}
if(document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();
