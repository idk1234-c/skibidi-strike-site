// TTVM Studios — Dev: 3D models. Owners + moderators (data-acct-lock="mod" on the page).
// The list lives in models.json next to this file; see README.md to add one.
(function(){
  var T = window.TTVM, MV_SRC = "https://ajax.googleapis.com/ajax/libs/model-viewer/4.4.0/model-viewer.min.js";
  var LOOKS = {
    dark:   {exposure:1.05, shadow:1,   soft:0.9, env:"neutral"},
    light:  {exposure:1.0,  shadow:0.8, soft:1,   env:"neutral"},
    studio: {exposure:1.25, shadow:1.2, soft:0.6, env:"legacy"}
  };
  var list = [], cur = null, mv = null, started = false, mvReady = null;
  var spin = true, look = "dark";
  try { look = localStorage.getItem("md_look") || "dark"; if(!LOOKS[look]) look = "dark"; spin = localStorage.getItem("md_spin") !== "0"; } catch(e){}
  function $(id){ return document.getElementById(id); }
  function esc(s){ return String(s == null ? "" : s).replace(/[&<>"']/g, function(c){ return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]; }); }
  function niceDate(s){
    if(!s) return ""; var d = new Date(s + "T12:00:00");
    return isNaN(d) ? s : d.toLocaleDateString(undefined, {month:"short", day:"numeric", year:"numeric"});
  }
  function loadMV(){
    if(mvReady) return mvReady;
    mvReady = new Promise(function(res, rej){
      if(window.customElements && customElements.get("model-viewer")) return res();
      var s = document.createElement("script"); s.type = "module"; s.src = MV_SRC;
      s.onload = function(){ customElements.whenDefined("model-viewer").then(res); };
      s.onerror = function(){ mvReady = null; rej(new Error("viewer")); };
      document.head.appendChild(s);
    });
    return mvReady;
  }

  function renderGrid(){
    var g = $("mdGrid");
    if(!list.length){ g.innerHTML = '<p class="md-empty">No models yet.</p>'; return; }
    g.innerHTML = list.map(function(m, i){
      return '<button class="md-card" type="button" data-i="' + i + '">' +
        '<span class="md-thumb">' + (m.thumb ? '<img src="' + esc(m.thumb) + '" alt="" loading="lazy">' : '') + '<span class="md-3d">3D</span></span>' +
        '<span class="md-info"><h3>' + esc(m.name) + '</h3>' + (m.notes ? '<p>' + esc(m.notes) + '</p>' : '') +
        '<small>' + esc([m.by || "Titan TV Man", niceDate(m.date)].filter(Boolean).join(" \u00b7 ")) + '</small></span></button>';
    }).join("");
    Array.prototype.forEach.call(g.querySelectorAll(".md-card"), function(b){
      b.onclick = function(){ open(list[+b.getAttribute("data-i")], true); };
    });
  }

  function setLook(k){
    look = k; try { localStorage.setItem("md_look", k); } catch(e){}
    $("mdView").setAttribute("data-look", k);
    Array.prototype.forEach.call(document.querySelectorAll(".md-seg button"), function(b){ b.classList.toggle("on", b.getAttribute("data-look") === k); });
    if(mv){ var L = LOOKS[k]; mv.exposure = L.exposure; mv.shadowIntensity = L.shadow; mv.shadowSoftness = L.soft; mv.environmentImage = L.env; }
  }
  function setSpin(on){
    spin = on; try { localStorage.setItem("md_spin", on ? "1" : "0"); } catch(e){}
    var b = $("mdSpin"); b.classList.toggle("on", on); b.setAttribute("aria-pressed", on ? "true" : "false");
    if(mv) mv.autoRotate = on;
  }
  function resetView(){
    if(!mv) return;
    mv.cameraOrbit = "auto auto auto"; mv.cameraTarget = "auto auto auto"; mv.fieldOfView = "auto";
    if(mv.resetTurntableRotation) mv.resetTurntableRotation(0);
    if(mv.jumpCameraToGoal) mv.jumpCameraToGoal();
  }

  function open(m, push){
    if(!m) return;
    cur = m;
    var v = $("mdView");
    $("mdName").textContent = m.name;
    $("mdBy").textContent = (m.by || "Titan TV Man") + " \u00b7 TTVM Studios";
    $("mdDl").href = m.glb; $("mdDl").setAttribute("download", (m.glb || "").split("/").pop());
    $("mdErr").hidden = true; $("mdAnim").hidden = true;
    v.hidden = false; document.documentElement.classList.add("md-open");
    setLook(look); setSpin(spin);
    if(push){ try { history.pushState({md:m.id}, "", "#" + encodeURIComponent(m.id)); } catch(e){} }
    document.title = m.name + " \u2014 Models \u2014 TTVM Studios";
    var stage = $("mdStage");
    stage.innerHTML = '<div class="md-load" id="mdLoad">Loading ' + esc(m.name) + '<i><b id="mdBar"></b></i></div>';
    loadMV().then(function(){
      if(cur !== m) return;
      mv = document.createElement("model-viewer");
      mv.setAttribute("src", m.glb);
      mv.setAttribute("alt", m.name + " 3D model");
      mv.setAttribute("camera-controls", "");
      mv.setAttribute("touch-action", "none");
      mv.setAttribute("interaction-prompt", "auto");
      mv.setAttribute("rotation-per-second", "24deg");
      mv.setAttribute("auto-rotate-delay", "1200");
      mv.setAttribute("min-camera-orbit", "auto auto 5%");
      mv.setAttribute("max-camera-orbit", "auto auto 400%");
      mv.setAttribute("tone-mapping", "neutral");
      if(m.orbit) mv.setAttribute("camera-orbit", m.orbit);
      if(spin) mv.setAttribute("auto-rotate", "");
      // AR: Android (Scene Viewer / WebXR) and iPhone/iPad Quick Look. A .usdz in models.json is used on iPhone if given.
      mv.setAttribute("ar", ""); mv.setAttribute("ar-modes", "webxr scene-viewer quick-look");
      if(m.usdz) mv.setAttribute("ios-src", m.usdz);
      var L = LOOKS[look];
      mv.setAttribute("exposure", L.exposure); mv.setAttribute("shadow-intensity", L.shadow);
      mv.setAttribute("shadow-softness", L.soft); mv.setAttribute("environment-image", L.env);
      mv.innerHTML = '<div slot="progress-bar"></div><button slot="ar-button" class="md-ar" type="button">' + AR_ICON + 'See it in your room</button>';
      mv.addEventListener("progress", function(e){
        var p = e.detail.totalProgress || 0, bar = $("mdBar"), ld = $("mdLoad");
        if(bar) bar.style.width = Math.round(p * 100) + "%";
        if(ld && p >= 1) ld.classList.add("done");
      });
      mv.addEventListener("load", function(){
        var ld = $("mdLoad"); if(ld) ld.classList.add("done");
        var a = mv.availableAnimations || [];
        if(a.length){
          var sel = $("mdAnimSel");
          sel.innerHTML = a.map(function(n){ return '<option>' + esc(n) + '</option>'; }).join("");
          $("mdAnim").hidden = false; playing(false);
        }
      });
      mv.addEventListener("error", function(){
        var ld = $("mdLoad"); if(ld) ld.classList.add("done");
        var e = $("mdErr"); e.textContent = "This model didn't load. Check the file in models/files and try again."; e.hidden = false;
      });
      stage.appendChild(mv);
    }).catch(function(){
      var ld = $("mdLoad"); if(ld) ld.classList.add("done");
      var e = $("mdErr"); e.textContent = "The 3D viewer couldn't load. Check your connection and try again."; e.hidden = false;
    });
    setTimeout(function(){ $("mdClose").focus(); }, 50);
  }
  function playing(on){
    var b = $("mdPlay"); b.classList.toggle("on", on); b.setAttribute("aria-label", on ? "Pause animation" : "Play animation");
    b.innerHTML = on ? '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 4h4v16H6zM14 4h4v16h-4z"/></svg>' : '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 4.5v15l13-7.5z"/></svg>';
  }
  function close(fromPop){
    if($("mdView").hidden) return;
    if(isFull()) exitFull();
    $("mdView").hidden = true; document.documentElement.classList.remove("md-open");
    $("mdStage").innerHTML = ""; mv = null; cur = null;
    document.title = "Models \u2014 TTVM Studios";
    if(!fromPop){ if(history.state && history.state.md) history.back(); else { try { history.replaceState(null, "", location.pathname); } catch(e){} } }
  }
  function isFull(){ return !!(document.fullscreenElement || document.webkitFullscreenElement); }
  function exitFull(){ (document.exitFullscreen || document.webkitExitFullscreen || function(){}).call(document); }
  function goFull(){
    var v = $("mdView");
    if(isFull()) return exitFull();
    var f = v.requestFullscreen || v.webkitRequestFullscreen; if(f) f.call(v);
  }

  var AR_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2l9 5v10l-9 5-9-5V7z"/><path d="M12 22V12M21 7l-9 5-9-5"/></svg>';
  function wire(){
    $("mdClose").onclick = function(){ close(false); };
    $("mdSpin").onclick = function(){ setSpin(!spin); };
    $("mdReset").onclick = resetView;
    Array.prototype.forEach.call(document.querySelectorAll(".md-seg button"), function(b){ b.onclick = function(){ setLook(b.getAttribute("data-look")); }; });
    if(document.fullscreenEnabled || document.webkitFullscreenEnabled){ $("mdFull").hidden = false; $("mdFull").onclick = goFull; }
    $("mdPlay").onclick = function(){
      if(!mv) return;
      if(mv.paused){ mv.animationName = $("mdAnimSel").value; mv.play(); playing(true); } else { mv.pause(); playing(false); }
    };
    $("mdAnimSel").onchange = function(){ if(!mv) return; mv.animationName = this.value; mv.currentTime = 0; mv.play(); playing(true); };
    document.addEventListener("keydown", function(e){ if(e.key === "Escape" && !$("mdView").hidden && !isFull()) close(false); });
    window.addEventListener("popstate", function(){
      var id = decodeURIComponent(location.hash.slice(1));
      var m = id && list.filter(function(x){ return x.id === id; })[0];
      if(m) open(m, false); else close(true);
    });
  }

  function start(){
    if(started) return; started = true;
    wire();
    loadMV().catch(function(){});   // warm the viewer up while the list loads
    fetch("models.json?t=" + Date.now(), {cache:"no-store"}).then(function(r){ if(!r.ok) throw 0; return r.json(); }).then(function(d){
      list = (d.models || d || []).slice().sort(function(a, b){ return String(b.date || "").localeCompare(String(a.date || "")); });
      list.forEach(function(m){
        ["glb", "thumb", "usdz"].forEach(function(k){ if(m[k] && !/^(https?:)?\//.test(m[k])) m[k] = new URL(m[k], location.href.split("#")[0]).href; });
      });
      renderGrid();
      var id = decodeURIComponent(location.hash.slice(1));
      var m = id && list.filter(function(x){ return x.id === id; })[0];
      if(m){ try { history.replaceState(null, "", location.pathname); history.pushState({md:m.id}, "", "#" + encodeURIComponent(m.id)); } catch(e){} open(m, false); }
    }).catch(function(){ $("mdGrid").innerHTML = '<p class="md-empty">Couldn\'t load the model list. Refresh to try again.</p>'; });
  }

  if(T && T.on) T.on(function(){ if(T.allowed("mod") && $("mdGrid") && document.contains($("mdGrid"))) start(); });
})();
