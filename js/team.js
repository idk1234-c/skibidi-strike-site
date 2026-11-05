// AI Tester access: a tiny hidden dot in the footer opens a code box.
// Only a SHA-256 hash of the code is stored here, never the code itself.
// The right code opens the read-only team chat page (its address is worked out from the code).
(function(){
  var HASH = "7f0b2adbda9108ac5d0dadd577952fc8d4757c928481bb4dcab9f6829b337f32";
  function hex(buf){ var a=new Uint8Array(buf), s=""; for(var i=0;i<a.length;i++){ s+=("0"+a[i].toString(16)).slice(-2); } return s; }
  function sha(t){ return crypto.subtle.digest("SHA-256", new TextEncoder().encode(t)).then(hex); }
  function css(){
    var s=document.createElement("style");
    s.textContent=".ait-dot{display:inline-block;width:9px;height:9px;border-radius:50%;background:#2a333d;border:0;padding:0;margin:10px auto 0;cursor:pointer;opacity:.55;vertical-align:middle}"+
      ".ait-dot:hover{opacity:1}"+
      ".ait-wrap{position:fixed;inset:0;background:rgba(0,0,0,.7);display:none;align-items:center;justify-content:center;z-index:9999}"+
      ".ait-wrap.on{display:flex}"+
      ".ait-box{background:#11161c;color:#e6edf3;border:1px solid #30363d;border-radius:12px;padding:20px;width:min(92vw,340px);text-align:center;font-family:inherit}"+
      ".ait-box h3{margin:0 0 6px}.ait-box p{font-size:.85rem;color:#8b949e;margin:0 0 12px}"+
      ".ait-box input{width:100%;box-sizing:border-box;padding:10px;font-size:1.1rem;letter-spacing:.2em;text-align:center;text-transform:uppercase;border-radius:8px;border:1px solid #30363d;background:#0d1117;color:#fff}"+
      ".ait-box .row{display:flex;gap:8px;margin-top:12px}.ait-box button{flex:1;padding:10px;border-radius:8px;border:0;cursor:pointer;font-weight:700}"+
      ".ait-go{background:#2f81f7;color:#fff}.ait-x{background:#30363d;color:#fff}.ait-err{color:#ff7b72;font-size:.85rem;min-height:1.2em;margin-top:8px}";
    document.head.appendChild(s);
  }
  function build(){
    var foot=document.getElementById("buildLine"); if(!foot) return;
    css();
    var dot=document.createElement("button"); dot.type="button"; dot.className="ait-dot"; dot.id="aitDot";
    dot.setAttribute("aria-label","AI Tester access"); dot.title="";
    var holder=document.createElement("div"); holder.style.textAlign="center"; holder.appendChild(dot);
    foot.parentNode.insertBefore(holder, foot.nextSibling);
    var wrap=document.createElement("div"); wrap.className="ait-wrap"; wrap.id="aitWrap";
    wrap.innerHTML='<div class="ait-box" role="dialog" aria-modal="true" aria-labelledby="aitT">'+
      '<h3 id="aitT">AI Tester access</h3><p>Enter your AI Tester code to read the team chats (read-only).</p>'+
      '<input id="aitCode" maxlength="6" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="CODE">'+
      '<div class="ait-err" id="aitErr"></div>'+
      '<div class="row"><button class="ait-x" id="aitX" type="button">Close</button><button class="ait-go" id="aitGo" type="button">Open</button></div></div>';
    document.body.appendChild(wrap);
    var inp=wrap.querySelector("#aitCode"), err=wrap.querySelector("#aitErr");
    function open(){ wrap.classList.add("on"); err.textContent=""; inp.value=""; setTimeout(function(){inp.focus();},50); }
    function close(){ wrap.classList.remove("on"); }
    function go(){
      var c=(inp.value||"").trim().toUpperCase();
      if(c.length!==6){ err.textContent="The code is 6 characters."; return; }
      if(!window.crypto||!crypto.subtle){ err.textContent="This browser can't check codes."; return; }
      sha(c).then(function(h){
        if(h!==HASH){ err.textContent="Wrong code."; return; }
        return sha("ss-ai-tester-v1:"+c).then(function(p){ location.href="team/"+p.slice(0,16)+"/"; });
      });
    }
    dot.addEventListener("click", open);
    wrap.querySelector("#aitX").addEventListener("click", close);
    wrap.querySelector("#aitGo").addEventListener("click", go);
    wrap.addEventListener("click", function(e){ if(e.target===wrap) close(); });
    inp.addEventListener("keydown", function(e){ if(e.key==="Enter") go(); if(e.key==="Escape") close(); });
  }
  if(document.readyState==="loading") document.addEventListener("DOMContentLoaded", build); else build();
})();
