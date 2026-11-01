/* TTVM Studios update banner: the scrolling "new update" strip across the very top of every page.
 * The text lives in data/announce.json  {"id":"...","text":"...","active":true}  so one commit changes it
 * (owners, moderators and devs can also set it from the Dev hub). Closing it (x) hides that update id on this
 * device; a new update (new id) shows again. Reduced-motion users get a still strip. */
(function(w, d){
"use strict";
if(w.TTVM_TICKER) return;
var SCRIPT = d.currentScript;
var ROOT = SCRIPT ? new URL("../", SCRIPT.src).href : (location.origin + "/skibidi-strike-site/");
var KEY = "ttvm_ticker_closed", SPEED = 64;   // px per second
var reduce = w.matchMedia ? w.matchMedia("(prefers-reduced-motion: reduce)") : {matches:false};
var el = null, cur = null, shifted = [], padAdd = 0, ro = null;

var CSS = [
".ttk{--ttk-h:32px;position:relative;z-index:60;display:flex;align-items:stretch;height:var(--ttk-h);min-height:var(--ttk-h);flex:0 0 auto;box-sizing:border-box;width:100%;overflow:hidden;",
"background:linear-gradient(180deg,#1b0d0b,#0d0b0b);border-bottom:1px solid rgba(255,51,36,.55);box-shadow:0 1px 0 #000,0 4px 18px rgba(255,51,36,.12);",
"font:600 13px/1 'Oswald','Bebas Neue','Arial Narrow',Impact,sans-serif;letter-spacing:.12em;text-transform:uppercase;color:#f1ece6;",
"padding-left:env(safe-area-inset-left);padding-right:env(safe-area-inset-right)}",
".ttk.is-fixed{position:fixed;top:0;left:0;right:0}",
".ttk *{box-sizing:border-box}",
".ttk-tag{position:relative;flex:none;display:flex;align-items:center;gap:7px;padding:0 16px 0 12px;background:#ff3324;color:#fff;font-weight:700;letter-spacing:.18em;",
"clip-path:polygon(0 0,100% 0,calc(100% - 10px) 100%,0 100%);text-shadow:0 1px 0 rgba(0,0,0,.35)}",
".ttk-tag:after{content:'';position:absolute;right:-1px;top:0;bottom:0;width:10px;background:repeating-linear-gradient(-45deg,#ffd933 0 4px,#111 4px 8px);clip-path:polygon(100% 0,100% 100%,0 100%);opacity:.9}",
".ttk-dot{width:7px;height:7px;border-radius:50%;background:#fff;box-shadow:0 0 0 0 rgba(255,255,255,.7);animation:ttkPulse 1.6s ease-out infinite}",
".ttk-run{position:relative;flex:1 1 auto;min-width:0;overflow:hidden;display:flex;align-items:center;",
"-webkit-mask-image:linear-gradient(90deg,transparent,#000 18px,#000 calc(100% - 18px),transparent);mask-image:linear-gradient(90deg,transparent,#000 18px,#000 calc(100% - 18px),transparent)}",
".ttk-track{display:flex;flex:none;white-space:nowrap;will-change:transform;animation:ttkScroll var(--ttk-dur,30s) linear infinite}",
".ttk:hover .ttk-track,.ttk:focus-within .ttk-track{animation-play-state:paused}",
".ttk-item{flex:none;display:inline-flex;align-items:center;padding:0 0 0 22px}",
".ttk-sep{display:inline-block;margin-left:22px;color:#ff3324;letter-spacing:-.05em;font-style:normal;opacity:.9}",
".ttk-x{flex:none;display:grid;place-items:center;width:40px;min-height:100%;padding:0;margin:0;border:0;border-left:1px solid rgba(255,255,255,.08);background:transparent;color:#bdb6ae;font:400 20px/1 Arial,sans-serif;cursor:pointer}",
".ttk-x:hover{color:#fff;background:rgba(255,51,36,.18)}",
".ttk-x:focus-visible{outline:2px solid #ffd933;outline-offset:-3px}",
".ttk.is-static{height:auto}",
".ttk.is-static .ttk-run{-webkit-mask-image:none;mask-image:none;padding:7px 0}",
".ttk.is-static .ttk-track{animation:none;white-space:normal;flex:1 1 auto;min-width:0}",
".ttk.is-static .ttk-item{flex:1 1 auto;min-width:0;white-space:normal;line-height:1.35;padding:0 12px}",
".ttk.is-static .ttk-sep{display:none}",
"html.has-ticker .oc-app{top:var(--ttk-offset,0px)}",
"@keyframes ttkScroll{from{transform:translate3d(0,0,0)}to{transform:translate3d(-50%,0,0)}}",
"@keyframes ttkPulse{0%{box-shadow:0 0 0 0 rgba(255,255,255,.75)}80%,100%{box-shadow:0 0 0 7px rgba(255,255,255,0)}}",
"@media(max-width:640px){.ttk{--ttk-h:30px;font-size:12px;letter-spacing:.1em}.ttk-tag{padding:0 13px 0 10px;letter-spacing:.14em}.ttk-x{width:36px}}",
"@media(prefers-reduced-motion:reduce){.ttk-track{animation:none}.ttk-dot{animation:none}}"
].join("");

function closed(){ try { return JSON.parse(localStorage.getItem(KEY) || "[]"); } catch(e){ return []; } }
function close(id){ try { var a = closed(); if(a.indexOf(id) < 0) a.push(id); localStorage.setItem(KEY, JSON.stringify(a.slice(-30))); } catch(e){} }
function esc(s){ return String(s == null ? "" : s).replace(/[&<>"']/g, function(c){ return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]; }); }
function css(){ if(d.getElementById("ttkCss")) return; var s = d.createElement("style"); s.id = "ttkCss"; s.textContent = CSS; (d.head || d.documentElement).appendChild(s); }

// pages whose top bar is position:fixed at the very top (home nav, chats) get the strip fixed too and the bar moved under it
function fixedTops(){
  var out = [];
  Array.prototype.forEach.call(d.body.children, function(c){
    if(c === el || c.tagName === "SCRIPT" || c.tagName === "STYLE") return;
    var cs = getComputedStyle(c);
    if(cs.position === "fixed" && parseFloat(cs.top) === 0 && cs.display !== "none" && c.getBoundingClientRect().height > 0) out.push(c);
  });
  return out;
}
function unshift(){
  shifted.forEach(function(c){ c.style.top = c.getAttribute("data-ttk-top") || ""; c.removeAttribute("data-ttk-top"); });
  shifted = [];
  if(padAdd){ d.body.style.paddingTop = d.body.getAttribute("data-ttk-pad") || ""; d.body.removeAttribute("data-ttk-pad"); padAdd = 0; }
}
function layout(){
  if(!el) return;
  var h = el.offsetHeight;
  d.documentElement.style.setProperty("--ttk-offset", h + "px");
  var fx = el.classList.contains("is-fixed") ? shifted.slice() : fixedTops();
  if(fx.length){
    el.classList.add("is-fixed");
    fx.forEach(function(c){ if(shifted.indexOf(c) < 0){ c.setAttribute("data-ttk-top", c.style.top || ""); shifted.push(c); } c.style.top = h + "px"; });
    var base = parseFloat(d.body.getAttribute("data-ttk-base"));
    if(isNaN(base)){ base = parseFloat(getComputedStyle(d.body).paddingTop) || 0; d.body.setAttribute("data-ttk-base", base); d.body.setAttribute("data-ttk-pad", d.body.style.paddingTop || ""); }
    // only push the page down when it scrolls normally (the chats page is one fixed full-screen app)
    var app = fx.some(function(c){ var r = c.getBoundingClientRect(); return r.height >= w.innerHeight - h - 2 && r.left <= 1 && r.right >= w.innerWidth - 1; });
    if(!app){ d.body.style.paddingTop = (base + h) + "px"; padAdd = h; }
  }
}
function fill(text){
  var run = el.querySelector(".ttk-run"), track = el.querySelector(".ttk-track");
  var item = '<span class="ttk-item">' + esc(text) + '<i class="ttk-sep" aria-hidden="true">///</i></span>';
  if(reduce.matches){ el.classList.add("is-static"); track.innerHTML = '<span class="ttk-item">' + esc(text) + '</span>'; return; }
  el.classList.remove("is-static");
  track.innerHTML = item;
  var one = track.firstChild.getBoundingClientRect().width || 300, need = Math.max(1, Math.ceil((run.clientWidth || w.innerWidth) / one));
  var copy = ""; for(var i = 0; i < need; i++) copy += item;
  // two identical halves, the track slides by exactly one half, so the loop is seamless
  track.innerHTML = '<span class="ttk-half" style="display:flex">' + copy + '</span><span class="ttk-half" style="display:flex" aria-hidden="true">' + copy + '</span>';
  track.style.setProperty("--ttk-dur", Math.max(12, (one * need) / SPEED).toFixed(1) + "s");
}
function remove(){ if(ro){ ro.disconnect(); ro = null; } unshift(); if(el){ el.remove(); el = null; } d.documentElement.style.removeProperty("--ttk-offset"); d.documentElement.classList.remove("has-ticker"); }
function show(doc, force){
  if(!d.body){ d.addEventListener("DOMContentLoaded", function(){ show(doc, force); }); return; }
  var text = doc && String(doc.text || "").trim(), id = doc && String(doc.id || text);
  if(!doc || !doc.active || !text || (!force && closed().indexOf(id) >= 0)){ remove(); return; }
  css();
  cur = {id:id, text:text};
  if(!el){
    el = d.createElement("div");
    el.className = "ttk"; el.id = "ttvmTicker";
    el.setAttribute("role", "region"); el.setAttribute("aria-label", "Site update");
    el.innerHTML = '<span class="ttk-tag"><i class="ttk-dot" aria-hidden="true"></i>NEW</span><div class="ttk-run"><div class="ttk-track"></div></div><button type="button" class="ttk-x" aria-label="Close this update">&times;</button>';
    d.body.insertBefore(el, d.body.firstChild);
    el.querySelector(".ttk-x").onclick = function(){ if(cur) close(cur.id); remove(); };
    d.documentElement.classList.add("has-ticker");
    var t = null;
    w.addEventListener("resize", function(){ clearTimeout(t); t = setTimeout(function(){ if(el && cur){ fill(cur.text); layout(); } }, 150); });
    if(reduce.addEventListener) reduce.addEventListener("change", function(){ if(el && cur){ fill(cur.text); layout(); } });
    if(w.ResizeObserver){ ro = new ResizeObserver(function(){ layout(); }); ro.observe(el); }
  }
  fill(text);
  layout();
}
function load(){
  return fetch(ROOT + "data/announce.json?t=" + Math.floor(Date.now() / 60000), {cache:"no-store"})
    .then(function(r){ return r.ok ? r.json() : null; })
    .then(function(doc){ show(doc, false); return doc; })
    .catch(function(){ return null; });
}
w.TTVM_TICKER = {show:show, hide:remove, refresh:load};
if(d.readyState === "loading") d.addEventListener("DOMContentLoaded", load); else load();
})(window, document);
