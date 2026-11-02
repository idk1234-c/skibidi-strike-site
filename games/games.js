/* TTVM Studios — the games list.
   ADD A GAME: add one entry to GAMES below. The page sorts them newest first by "added",
   so a new game shows up on top on its own.
   Tags you can use (each has its own colour): "NEW", "ALPHA / BETA TEST", "FULLY PUBLISHED", "RECENTLY UPDATED".
   art: "ss" is the drawn preview below; leave it out and the card gets a plain one.
   play: a link to the in-browser version adds a second "Play in browser" button inside the card. */
var GAMES = [
  {
    name: "Blockworld",
    slug: "blockworld",
    url: "blockworld/",
    tags: ["NEW", "ALPHA / BETA TEST", "RECENTLY UPDATED"],
    blurb: "Ttvm Studios' own block-building world game: infinite terrain, the Nether and the End, game modes, and mods like guns & cannons and Skibidi Toilets. Play the web test in your browser.",
    added: "2026-11-01",
    updated: "2026-11-02",
    art: "bw",
    cta: "Open",
    play: "blockworld/play/"
  },
  {
    name: "Skibidi Strike",
    slug: "skibidi-strike",
    url: "../",
    tags: ["ALPHA / BETA TEST", "RECENTLY UPDATED"],
    blurb: "90 waves of skibidis in a destroyed city, with the Astro UFO every fifth wave. Play free in your browser.",
    added: "2026-10-25",
    updated: "2026-10-31",
    art: "ss",
    cta: "Open"
  }
];

(function(){
  var TAGS = {
    "NEW": "t-new",
    "ALPHA / BETA TEST": "t-beta",
    "FULLY PUBLISHED": "t-pub",
    "RECENTLY UPDATED": "t-upd"
  };
  var MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  function esc(s){ return String(s == null ? "" : s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;"); }
  function day(d){
    var p = String(d || "").split("-");
    if(p.length !== 3) return esc(d);
    return MONTHS[+p[1] - 1] + " " + (+p[2]) + ", " + p[0];
  }
  function art(g){
    if(g.art === "bw") return '<div class="art art-bw" aria-hidden="true"><span class="bw-moon"></span><span class="bw-glow"></span><span class="bw-far">' + new Array(13).join("<i></i>") + '</span><span class="bw-hills">' + new Array(17).join("<i></i>") + '</span><b class="bw-logo">BLOCK <em>WORLD</em></b></div>';
    if(g.art === "ss") return '<div class="art art-ss" aria-hidden="true"><span class="ss-glow"></span><span class="ss-city"><i></i><i></i><i></i><i></i><i></i><i></i><i></i></span><span class="ss-smoke"></span><b class="ss-logo">SKIBIDI <em>STRIKE</em></b></div>';
    var ini = String(g.name || "?").split(/\s+/).map(function(w){ return w.charAt(0); }).join("").slice(0, 2).toUpperCase();
    return '<div class="art art-plain" aria-hidden="true"><b>' + esc(ini) + '</b></div>';
  }
  function card(g, i){
    var tags = (g.tags || []).map(function(t){
      return '<span class="tag ' + (TAGS[t] || "t-other") + '">' + esc(t) + '</span>';
    }).join("");
    var meta = "Added " + day(g.added);
    if(g.updated && g.updated !== g.added) meta += " &middot; Updated " + day(g.updated);
    var playBtn = g.play ? '<a class="go go-play" href="' + esc(g.play) + '"><span aria-hidden="true">&#9654;</span> Play in browser</a>' : '';
    return '<li><div class="game' + (g.play ? ' has-play' : '') + '" id="g-' + esc(g.slug) + '">' + art(g) +
      '<div class="gb"><div class="tags">' + tags + '</div>' +
      '<h2>' + esc(g.name) + '</h2>' +
      '<p class="blurb">' + esc(g.blurb) + '</p>' +
      '<div class="gfoot"><span class="meta">' + meta + '</span><span class="gos"><a class="go go-main" href="' + esc(g.url) + '">' + esc(g.cta || "Open") + ' ' + esc(g.name) + ' <span aria-hidden="true">&rarr;</span></a>' + playBtn + '</span></div>' +
      '</div></div></li>';
  }
  function render(){
    var host = document.getElementById("gameList");
    if(!host) return;
    var list = GAMES.map(function(g, i){ return {g: g, i: i}; });
    list.sort(function(a, b){ return a.g.added < b.g.added ? 1 : a.g.added > b.g.added ? -1 : a.i - b.i; });
    host.innerHTML = list.map(function(x, n){ return card(x.g, n); }).join("");
    var c = document.getElementById("gameCount");
    if(c) c.textContent = GAMES.length + (GAMES.length === 1 ? " game" : " games");
  }
  if(document.readyState === "loading") document.addEventListener("DOMContentLoaded", render);
  else render();
})();
