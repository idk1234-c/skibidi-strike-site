// Skibidi Strike site
// DEV CODE: change this to update the studio code (the dev panel can also set a new one)
var DEV_CODE = "0000";

var DEFAULT_ROADMAP = [
  {d:"OCT 25", t:"The repo goes live", b:"The first commit: the core wave shooter, 90 waves, wave rewards, the lobby."},
  {d:"OCT 26", t:"Alliance Titan joins the fight", b:"His scripts, his model, his card in the character select."},
  {d:"OCT 30", t:"The arsenal is staged", b:"35+ weapon models land in the vault, ready to be wired into gameplay."},
  {d:"OCT 30", t:"Dev mode", b:"A hidden test menu: points, characters, god mode, jump to any wave."},
  {d:"OCT 31", t:"The cast gets real", b:"Cameraman, Alliance Titan and the Astro UFO rebuilt from code with genuinely swinging legs and arms."},
  {d:"OCT 31", t:"The city falls", b:"A destroyed-city battle map: ruined buildings, fires, smoke and dusty haze."},
  {d:"OCT 31", t:"Balance pass", b:"Wave 1 is exactly five skibidis, and every toilet now comes in its own size."}
];

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

// ---- dev gate ----
function devCode(){ return localStorage.getItem("ss_devcode") || DEV_CODE; }
var modal = document.getElementById("devModal");
function openDev(){ modal.classList.add("open"); document.getElementById("devGate").style.display="block"; document.getElementById("devPanel").style.display="none"; document.getElementById("devErr").textContent=""; var c=document.getElementById("devCode"); c.value=""; setTimeout(function(){c.focus();},50); }
function closeDev(){ modal.classList.remove("open"); }
function tryEnter(){
  var v = document.getElementById("devCode").value.trim();
  if(v === devCode()){
    document.getElementById("devGate").style.display="none";
    document.getElementById("devPanel").style.display="block";
    document.getElementById("devRoadmap").value = roadmapToText();
  } else {
    document.getElementById("devErr").textContent = "Wrong code.";
  }
}
document.addEventListener("DOMContentLoaded", function(){
  renderRoadmap();
  var bl = document.getElementById("buildLine");
  if(bl) bl.textContent = "BUILD " + SS_BUILD;
  var links = document.querySelectorAll("nav .links a");
  for(var i=0;i<links.length;i++){
    links[i].addEventListener("click", function(ev){
      var id = (this.getAttribute("href") || "").slice(1);
      if(id && document.getElementById(id) && document.getElementById(id).classList.contains("page")){ ev.preventDefault(); showPage(id); }
    });
  }
  var logo = document.querySelector("nav .logo");
  if(logo) logo.addEventListener("click", function(){ showPage(null); });
  var pb = document.getElementById("playBtn");
  if(pb) pb.addEventListener("click", function(ev){ ev.preventDefault(); showPage(null); });
  var hp = document.getElementById("heroPlay");
  if(hp) hp.addEventListener("click", function(ev){ ev.preventDefault(); });
  var sf = document.getElementById("sugForm");
  if(sf) sf.addEventListener("submit", sugSend);
  bgmSetup();
  var dot=document.getElementById("devDot");
  if(dot) dot.addEventListener("click", openDev);
  var c=document.getElementById("devClose"); if(c) c.addEventListener("click", closeDev);
  var e=document.getElementById("devEnter"); if(e) e.addEventListener("click", tryEnter);
  var input=document.getElementById("devCode");
  if(input) input.addEventListener("keydown", function(ev){ if(ev.key==="Enter") tryEnter(); });
  modal.addEventListener("click", function(ev){ if(ev.target===modal) closeDev(); });
  var ap=document.getElementById("devApply");
  if(ap) ap.addEventListener("click", function(){
    var items = textToRoadmap(document.getElementById("devRoadmap").value);
    localStorage.setItem("ss_roadmap", JSON.stringify(items));
    renderRoadmap();
    document.getElementById("devErr").textContent="";
    document.getElementById("devRoadmap").value = roadmapToText();
  });
  var rs=document.getElementById("devReset");
  if(rs) rs.addEventListener("click", function(){
    localStorage.removeItem("ss_roadmap");
    document.getElementById("devRoadmap").value = roadmapToText();
    renderRoadmap();
  });
  var cb=document.getElementById("devCodeBtn");
  if(cb) cb.addEventListener("click", function(){
    var f=document.getElementById("devNewCode");
    f.style.display = f.style.display==="none" ? "block" : "none";
    if(f.style.display==="block") f.focus();
  });
  var nc=document.getElementById("devNewCode");
  if(nc) nc.addEventListener("keydown", function(ev){
    if(ev.key==="Enter" && nc.value.trim()){
      localStorage.setItem("ss_devcode", nc.value.trim());
      nc.value=""; nc.blur();
      document.getElementById("devErr").textContent="Code updated in this browser.";
    }
  });
  var ex=document.getElementById("devExit");
  if(ex) ex.addEventListener("click", closeDev);
  document.addEventListener("keydown", function(ev){
    if(ev.key==="Escape") closeDev();
  });
});

// ---- build version ----
var SS_BUILD = "v1.7 \u00b7 OCT 31 2026";

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
    nav[k].classList.toggle("on", !!id && href === "#" + id);
  }
  if(found) window.scrollTo(0,0);
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
      subject: "Skibidi Strike suggestion" + (handle ? " from " + handle : ""),
      from_name: "Skibidi Strike site",
      name: handle || "anonymous",
      idea: idea,
      link: link,
      page: window.location.href
    })
  }).then(function(r){ return r.json(); }).then(function(d){
    if(d && d.success){
      msg.textContent = "Sent. The studio has it - thanks!";
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
