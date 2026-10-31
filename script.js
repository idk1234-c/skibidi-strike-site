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
