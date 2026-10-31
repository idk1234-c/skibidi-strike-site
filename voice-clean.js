// Skibidi Strike — smarter voice-to-text cleanup (owner chats)
// Works in the browser (window.SSVoice) and in node (module.exports) so it can be unit-tested.
(function(root, factory){
  var api = factory();
  if(typeof module === "object" && module.exports) module.exports = api;
  else root.SSVoice = api;
})(typeof self !== "undefined" ? self : this, function(){
"use strict";

var DICT_KEY = "ss_voice_dict";

// Amos's common mishears. One rule per line: what it heard => what he meant
var DEFAULT_DICT = [
  "Dave mode => dev mode",
  "death mode => dev mode",
  "deaf mode => dev mode",
  "def mode => dev mode",
  "dead mode => dev mode",
  "Dave panel => dev panel",
  "death panel => dev panel",
  "Dave page => dev page",
  "death page => dev page",
  "UTCM Studios => UTC Studios",
  "UTCM Studio => UTC Studios",
  "UTC M Studios => UTC Studios",
  "UTC M => UTC Studios",
  "UTCM => UTC Studios",
  "Titan TV man => Titan TV Man",
  "Titan TV men => Titan TV Man",
  "titan TV => Titan TV",
  "skibbidy => Skibidi",
  "skibidy => Skibidi",
  "skibbidi => Skibidi",
  "skippity => Skibidi",
  "Skibidi strike => Skibidi Strike",
  "skibidi => Skibidi",
  "T TVM => Ttvm",
  "T T V M => Ttvm",
  "TTVM => Ttvm"
].join("\n");

function escRe(s){ return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }

// "a => b" lines -> [{from, to, re}] longest first, so "UTC M Studios" wins over "UTC M"
function parseDict(text){
  var out = [];
  String(text == null ? "" : text).split(/\r?\n/).forEach(function(line){
    var m = line.match(/^\s*(.+?)\s*(?:=>|->|→|=)\s*(.*?)\s*$/);
    if(!m || !m[1] || line.trim().charAt(0) === "#") return;
    var from = m[1].replace(/\s+/g, " ");
    var pat = escRe(from).replace(/ /g, "[\\s,-]+");
    out.push({from: from, to: m[2], re: new RegExp("(^|[^A-Za-z0-9'])(" + pat + ")(?=$|[^A-Za-z0-9'])", "gi")});
  });
  out.sort(function(a, b){ return b.from.length - a.from.length; });
  return out;
}
function applyDict(text, rules){
  var s = text;
  rules.forEach(function(r){ s = s.replace(r.re, function(_, pre){ return pre + r.to; }); });
  return s;
}

var FILLER = /(^|[\s,])(?:u+m+|u+h+m*|e+r+m+|h+m+|a+h+|mm+)(?=[\s,.!?]|$)[,]?/gi;
var QUESTION_START = /^(what|whats|what's|how|why|where|when|who|which|can|could|would|will|should|is|are|am|do|does|did|was|were|have|has|isn't|aren't|don't|doesn't|didn't|won't|wouldn't|couldn't|shouldn't)\b/i;

function capFirst(s){ return s.replace(/^(\s*["'(]*)([a-z])/, function(_, a, b){ return a + b.toUpperCase(); }); }

function endPunct(sentence){
  var t = sentence.replace(/\s+$/, "");
  if(!t) return t;
  if(/[.!?…:;)\]"'”’]$/.test(t) && !/["'”’]$/.test(t)) return t;
  if(/[.!?]["'”’]$/.test(t)) return t;
  return t + (QUESTION_START.test(t.replace(/^["'(\s]+/, "")) ? "?" : ".");
}

// the main cleanup pass
function clean(raw, dictText){
  var s = String(raw == null ? "" : raw);
  if(!s.trim()) return "";
  var rules = parseDict(dictText == null ? DEFAULT_DICT : dictText);
  // spoken punctuation
  s = s.replace(/\s*\b(new paragraph)\b\s*/gi, "\n\n").replace(/\s*\b(new line|next line)\b\s*/gi, "\n")
       .replace(/\s*\bquestion mark\b/gi, "?").replace(/\s*\bexclamation (?:mark|point)\b/gi, "!");
  var paras = s.split(/\n/);
  paras = paras.map(function(p){
    p = p.replace(/[ \t]+/g, " ").trim();
    if(!p) return "";
    // filler words
    for(var i=0;i<3;i++) p = p.replace(FILLER, "$1");
    p = p.replace(/\b(you know|i mean),?\s+(?=\1\b)/gi, "");
    // stutters / repeated words: "like like" -> "like", "the the" -> "the"
    p = p.replace(/\b([A-Za-z']+)(?:[\s,]+\1\b)+/gi, "$1");
    // repeated two-word phrases: "I want I want" -> "I want"
    p = p.replace(/\b([A-Za-z']+ [A-Za-z']+)(?:[\s,]+\1\b)+/gi, "$1");
    // dictionary fixes
    p = applyDict(p, rules);
    // tidy spaces + commas
    p = p.replace(/\s+([,.!?;:])/g, "$1").replace(/,{2,}/g, ",").replace(/^[,\s]+/, "").replace(/[,\s]+$/, "")
         .replace(/([.!?])\s*,/g, "$1").replace(/ {2,}/g, " ").trim();
    // the word "i"
    p = p.replace(/(^|[^A-Za-z'])i(?=$|[^A-Za-z'])/g, "$1I").replace(/(^|[^A-Za-z'])i'(m|d|ll|ve)\b/gi, function(_, a, b){ return a + "I'" + b.toLowerCase(); });
    if(!p) return "";
    // capitalize + punctuate every sentence
    var parts = p.match(/[^.!?]+[.!?]+["'”’)]*|[^.!?]+$/g) || [p];
    return parts.map(function(x){ return endPunct(capFirst(x.trim())); }).filter(Boolean).join(" ");
  });
  return paras.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

function loadDict(storage){
  try { var v = (storage || (typeof localStorage !== "undefined" ? localStorage : null)).getItem(DICT_KEY); if(v != null) return v; } catch(e){}
  return DEFAULT_DICT;
}
function saveDict(text, storage){
  var st = storage || (typeof localStorage !== "undefined" ? localStorage : null); if(!st) return;
  if(text == null || String(text).trim() === DEFAULT_DICT.trim()) st.removeItem(DICT_KEY); else st.setItem(DICT_KEY, String(text));
}

return {DICT_KEY: DICT_KEY, DEFAULT_DICT: DEFAULT_DICT, parseDict: parseDict, clean: clean, loadDict: loadDict, saveDict: saveDict};
});
