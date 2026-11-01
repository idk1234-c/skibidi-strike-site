// Blockworld page: music list + credits from credits.js
(function(){
  var C = window.BW_CREDITS || [];
  function esc(s){ return String(s == null ? "" : s).replace(/[&<>"']/g, function(c){ return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]; }); }
  function lic(l){ return /CC0/i.test(l) ? '<span class="lic cc0">CC0</span>' : '<span class="lic by">' + esc(l.replace(/\s*\(.*\)/, "")) + '</span>'; }
  var tr = document.getElementById("bwTracks");
  if(tr) tr.innerHTML = C.filter(function(x){ return x.s === "Music"; }).map(function(x){
    return '<li><a href="' + esc(x.u) + '" target="_blank" rel="noopener">' + esc(x.n) + '</a><span>' + esc(x.b) + '</span>' + lic(x.l) + '</li>';
  }).join("");
  var cr = document.getElementById("bwCredits");
  if(cr){
    var groups = [];
    C.forEach(function(x){ if(groups.indexOf(x.s) < 0) groups.push(x.s); });
    cr.innerHTML = groups.map(function(g){
      var xs = C.filter(function(x){ return x.s === g; });
      return '<details class="bw-cred"><summary>' + esc(g) + ' <em>' + xs.length + '</em></summary><ul>' + xs.map(function(x){
        return '<li><a href="' + esc(x.u) + '" target="_blank" rel="noopener">&ldquo;' + esc(x.n) + '&rdquo;</a> by ' + esc(x.b) + ' ' + lic(x.l) + '</li>';
      }).join("") + '</ul></details>';
    }).join("");
  }
})();
