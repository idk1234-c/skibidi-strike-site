/* Blockworld page config.
   The game's name lives HERE and only here. Rename the game by changing NAME below:
   every element with data-game-name (on this page and the home page card) and the page title update.
   (The folder/URL "blockworld/" is separate; renaming that means moving the folder.) */
var GAME = {
  NAME: "Blockworld",
  STUDIO: "Ttvm Studios"
};
(function(){
  function apply(){
    var els = document.querySelectorAll("[data-game-name]");
    for (var i = 0; i < els.length; i++) els[i].textContent = GAME.NAME;
    if (document.body && document.body.hasAttribute("data-game-title")) {
      document.title = GAME.NAME + " \u2014 " + GAME.STUDIO;
    }
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", apply);
  else apply();
})();
