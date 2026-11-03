// Skibidi Strike — studio chats (owner only)
// The chats live in the PRIVATE repo (chat/*.json). This page has no secrets in it:
// it only works with the owner's own GitHub key, saved in this browser.
// v3 (Titan TV Man): sections (AI chats / Devs & Mods / Requests) from chat/index.json,
// pinned chats, and "send later" (a message with a future "sendAt" stays hidden until then).
// v6: Reply (replyTo: <message id>, shown as a quoted box) and Edit (editedAt, "(edited)"),
// plus owner soft delete (deleted: true). Hold a message on a phone, or hover it on a computer.
// ALL storage goes through one adapter object, GitHubChatStore below (the UI never calls GitHub),
// so it can be swapped for another backend (e.g. Firebase) by setting window.ChatStore before this file loads.
(function(){
"use strict";
var Store;  // the storage adapter (see ChatStore below); the UI only talks to it

var TOKEN_KEY = "ss_chat_token";
var ME = "Amos";
var POLL_OPEN_MS = 15000;   // open thread
var POLL_ALL_MS = 60000;    // the other threads (unread dots) + the chat list

var PEOPLE = {
  "Amos":         {ini:"A",  cls:"p-amos"},
  "Titan TV Man": {ini:"TT", cls:"p-titan"},
  "UTC Studios": {ini:"UTC", cls:"p-utc"}
};
var SECTIONS = [
  {id:"ai",       title:"AI chats",    short:"AI",       empty:"No AI chats."},
  {id:"team",     title:"Devs & Mods", short:"Devs & Mods", empty:"No dev/mod chats yet"},
  {id:"requests", title:"Requests",    short:"Requests", empty:"No requests yet",
   hint:"People who ask to talk to you will show up here."}
];
// the 4 original chats (always there, even before chat/index.json exists)
var BASE_THREADS = [
  {key:"coders",     file:"chat/coders.json",     title:"Titan TV Man \u2194 UTC Studios", short:"Coders",
   who:["Titan TV Man","UTC Studios"],
   note:"This is Titan TV Man and UTC Studios' own chat. You can read all of it, and you can post here too."},
  {key:"amos-titan", file:"chat/amos-titan.json", title:"Amos \u2194 Titan TV Man",        short:"Titan TV Man", who:["Titan TV Man"]},
  {key:"amos-utc",  file:"chat/amos-utc.json",  title:"Amos \u2194 UTC Studios",        short:"UTC Studios", who:["UTC Studios"]},
  {key:"group",      file:"chat/group.json",      title:"Group chat",                       short:"Group",        who:["Titan TV Man","UTC Studios","Amos"]}
];

var state = {
  token: null,
  open: null,          // thread key
  sec: null,           // section shown on phones
  threads: [],         // the chat list (from the store)
  list: null,          // raw list entries from the store
  listError: null,
  data: {},            // key -> {doc:{messages}, loadedAt, missing, error}
  pending: {},         // key -> [msg] (sending)
  cancelling: {},      // id -> true
  timers: [],
  schedAt: null,       // Date chosen with the clock button (send later)
  style: null,         // {font, color} picked with Text style
  photo: null,         // {b64, url} picked with Photo (shrunk to <=1280px JPEG)
  readTry: {},         // key -> last time we saved "Amos has read this"
  newOpen: false,      // "+ New chat" form open
  creating: false,
  ctx: null,           // composer mode: {mode:"reply"|"edit", key, id, draft}
  overlay: {},         // msg id -> {text, editedAt} or {deleted} while an edit/delete is saving
  sheet: null,         // msg id the Hold menu is open for
  hl: null,            // {id, until} message briefly highlighted after tapping a quote
  sig: ""
};

// ---------- helpers ----------
function $(id){ return document.getElementById(id); }
function esc(s){
  return String(s == null ? "" : s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;");
}
// escape first, then turn http(s) links into safe anchors
function linkify(text){
  var out = "", re = /\bhttps?:\/\/[^\s<>"']+/gi, last = 0, m;
  var s = String(text == null ? "" : text);
  while((m = re.exec(s))){
    var url = m[0], trail = "";
    while(/[.,!?;:)\]}]$/.test(url)){ trail = url.slice(-1) + trail; url = url.slice(0,-1); }
    out += esc(s.slice(last, m.index));
    out += '<a href="' + esc(url) + '" target="_blank" rel="noopener noreferrer nofollow">' + esc(url) + '</a>' + esc(trail);
    last = m.index + m[0].length;
  }
  out += esc(s.slice(last));
  return out.replace(/\n/g, "<br>");
}
function b64ToUtf8(b64){
  var bin = atob(String(b64).replace(/\s/g,""));
  var bytes = new Uint8Array(bin.length);
  for(var i=0;i<bin.length;i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder("utf-8").decode(bytes);
}
function utf8ToB64(str){
  var bytes = new TextEncoder().encode(str), bin = "", CH = 0x8000;
  for(var i=0;i<bytes.length;i+=CH) bin += String.fromCharCode.apply(null, bytes.subarray(i, i+CH));
  return btoa(bin);
}
function person(name){ return PEOPLE[name] || {ini:(String(name||"?").trim().charAt(0)||"?").toUpperCase(), cls:"p-other"}; }
function avatar(name, small){
  var p = person(name);
  return '<span class="oc-av ' + p.cls + (small ? ' sm' : '') + '" title="' + esc(name) + '">' + esc(p.ini) + '</span>';
}
function threadAvatar(t){
  if(!t.who.length) return avatar(t.title);
  if(t.who.length === 1) return avatar(t.who[0]);
  var h = '<span class="oc-avstack n' + t.who.length + '">';
  t.who.forEach(function(w){ h += avatar(w, true); });
  return h + '</span>';
}
function threadByKey(k){ for(var i=0;i<state.threads.length;i++) if(state.threads[i].key===k) return state.threads[i]; return null; }
function sectionById(id){ for(var i=0;i<SECTIONS.length;i++) if(SECTIONS[i].id===id) return SECTIONS[i]; return SECTIONS[0]; }
function keyOf(file){ return String(file).replace(/^chat\//,"").replace(/\.json$/,""); }
function newId(){ return Date.now() + "-" + Math.random().toString(36).slice(2,8); }
function fmtTime(iso){
  var d = new Date(iso); if(isNaN(d)) return "";
  return d.toLocaleTimeString([], {hour:"numeric", minute:"2-digit"});
}
function fmtDay(iso){
  var d = new Date(iso); if(isNaN(d)) return "";
  var today = new Date(), y = new Date(); y.setDate(today.getDate()-1);
  if(d.toDateString() === today.toDateString()) return "Today";
  if(d.toDateString() === y.toDateString()) return "Yesterday";
  return d.toLocaleDateString([], {weekday:"short", month:"short", day:"numeric", year: d.getFullYear()===today.getFullYear() ? undefined : "numeric"});
}
function fmtShort(iso){
  var d = new Date(iso); if(isNaN(d)) return "";
  return (d.toDateString() === new Date().toDateString()) ? fmtTime(iso) : d.toLocaleDateString([], {month:"short", day:"numeric"});
}
function ago(ms){
  var s = Math.max(0, Math.round((Date.now() - ms)/1000));
  if(s < 5) return "just now";
  if(s < 60) return s + "s ago";
  var m = Math.round(s/60); if(m < 60) return m + "m ago";
  return Math.round(m/60) + "h ago";
}
function fmtWhen(d){
  d = new Date(d); if(isNaN(d)) return "";
  var day = fmtDay(d.toISOString());
  return (day === "Today" || day === "Yesterday" ? day : d.toLocaleDateString([], {weekday:"short", month:"short", day:"numeric"})) + " " + fmtTime(d.toISOString());
}
function seenKey(k){ return "ss_chat_seen_" + k; }

// ---------- send later ----------
// A message with "sendAt" (ISO) in the future is SCHEDULED: hidden from everyone,
// shown only to the sender (greyed) with a Cancel button. Once sendAt passes it shows
// up as a normal message at that time. (Static site: scheduling = visibility by time.)
function tOf(iso){ var n = Date.parse(iso); return isNaN(n) ? null : n; }
function isScheduled(m, now){ var n = m && m.sendAt ? tOf(m.sendAt) : null; return n !== null && n > (now || Date.now()); }
function shownTime(m){ return (m && m.sendAt && tOf(m.sendAt) !== null) ? m.sendAt : (m ? (m.time || m.ts || "") : ""); }
function messagesOf(k){
  var d = state.data[k];
  var list = (d && d.doc && Array.isArray(d.doc.messages)) ? d.doc.messages.slice() : [];
  return list.filter(function(m){ return m && typeof m === "object"; });
}
// what everyone sees: file order, with delivered "send later" messages slotted in at their sendAt
function visibleOf(k){
  var now = Date.now(), out = [], due = [];
  messagesOf(k).forEach(function(m){
    if(m.sendAt && tOf(m.sendAt) !== null){ if(tOf(m.sendAt) <= now) due.push(m); }
    else out.push(m);
  });
  due.forEach(function(m){
    var at = tOf(m.sendAt), i = out.length;
    while(i > 0 && (tOf(shownTime(out[i-1])) || 0) > at) i--;
    out.splice(i, 0, m);
  });
  return out;
}
function scheduledOf(k){
  var now = Date.now();
  return messagesOf(k).filter(function(m){ return m.from === ME && isScheduled(m, now); })
    .sort(function(a,b){ return tOf(a.sendAt) - tOf(b.sendAt); });
}
function lastMsg(k){ var l = visibleOf(k); return l.length ? l[l.length-1] : null; }
// ---------- reply / edit helpers ----------
// a message's key: its id, or (for hand-written messages with no id) one made from who + when
function hashStr(s){ var h = 5381; for(var i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0; return (h >>> 0).toString(36); }
function mkey(m){
  if(!m) return "";
  if((typeof m.id === "string" && m.id) || typeof m.id === "number") return String(m.id);
  var when = m.time || m.ts || "";
  return "k-" + hashStr(String(m.from || "") + "|" + String(when) + "|" + (when ? "" : String(m.text || "").slice(0, 80)));
}
function findMsg(k, id){
  if(!id) return null;
  var l = messagesOf(k);
  for(var i = 0; i < l.length; i++) if(mkey(l[i]) === id) return withOverlay(l[i]);
  var p = state.pending[k] || [];
  for(var j = 0; j < p.length; j++) if(p[j].id === id) return p[j];
  return null;
}
function withOverlay(m){
  var o = m && state.overlay[mkey(m)]; if(!o) return m;
  var c = shallow(m);
  if(o.deleted){ c.deleted = true; c.text = ""; delete c.image; delete c.style; delete c.voice; }
  else { c.text = o.text; c.editedAt = o.editedAt; }
  c.saving = true;
  return c;
}
function whoName(from){ return from === ME ? "You" : String(from || "?"); }
function snippetOf(m, n){
  if(!m) return "";
  if(m.deleted) return "message deleted";
  var s = String(m.text || "").replace(/\s+/g, " ").trim();
  if(!s) return m.image ? "\ud83d\udcf7 Photo" : "";
  return s.length > n ? s.slice(0, n).replace(/\s+$/, "") + "\u2026" : s;
}
function isLive(m){ return !!m && !m.sending && !m.failed && !m.saving && !m.deleted; }
function canReply(m){ return isLive(m) && !m.scheduled && !isScheduled(m); }
function canEdit(m){ return isLive(m) && m.from === ME; }
function canDelete(m){ return isLive(m) && !m.scheduled && !isScheduled(m); }  // owner page: any message (still-scheduled ones use Cancel)
function schedSig(){
  var now = Date.now(), n = 0;
  state.threads.forEach(function(t){ messagesOf(t.key).forEach(function(m){ if(m.sendAt && isScheduled(m, now)) n++; }); });
  return String(n);
}


// =====================================================================================
// ChatStore — the storage adapter. Swap this object to move the chats off GitHub.
// Contract (every method returns a Promise):
//   setToken(tok)                      remember the owner's key (sync)
//   checkAccess()                      resolves if the key works, rejects with err.status
//   listThreads(fresh)                 -> {changed, threads:[{id, title, section, pinned}]}
//                                         (changed:false = same as last time)
//   readThread(id, fresh)              -> {changed, missing, title, messages:[...]}
//   send(id, msg)                      append msg {id, from, text, time, voice?, sendAt?}
//   cancelScheduled(id, msgId, from)   remove the sender's own still-scheduled message
//                                         -> {removed:bool, tooLate:bool}
//   edit(id, msgId, from, text)        change the text of the sender's own message (sets editedAt) -> {found}
//   remove(id, msgId, by)              soft delete (deleted:true, text "") -> {found}
//   (a message may carry replyTo: <id of the message it answers>)
//   setPinned(id, pinned)              -> threads (same shape as listThreads)
//   createThread(section, title)       -> {id, threads}
//   listRequests()                     -> [{id, from, text, time, url}] (people asking to talk to the owner)
//   uploadImage(base64Jpeg)            -> ref (string, e.g. "media/<id>.jpg"); the message stores {image: ref}
//   imageUrl(ref)                      -> a URL an <img> can show (may be a blob: URL)
//   markRead(id, reader, iso)          -> threads (records "reader has seen this chat up to iso"; no-op if not newer)
//   threads also carry reads: {readerName: iso} (used for "Seen" under your last message)
// Errors carry .status (401 bad key, 403 no write, 404 not found, 409/422 conflict) or .badJson.
// =====================================================================================
function GitHubChatStore(){
  var REPO = "idk1234-c/skibidi-strike";
  var BRANCH = "main";
  var API = "https://api.github.com/repos/" + REPO + "/contents/";
  var INDEX_FILE = "chat/index.json";
  var ID_RE = /^[a-z0-9][a-z0-9-]{0,60}$/;
  var IMG_RE = /^media\/[a-z0-9-]{1,40}\.jpg$/;
  var token = null;
  var cache = {};   // file -> {sha, etag}
  var imgCache = {}; // ref -> url
  var listDoc = null;

  function fileOf(id){ return "chat/" + id + ".json"; }
  function idOf(file){ var m = /^chat\/([a-z0-9][a-z0-9-]{0,60})\.json$/.exec(String(file)); return m && m[1] !== "index" ? m[1] : null; }
  function ghErr(status, body){
    var e = new Error(body && body.message ? body.message : ("HTTP " + status));
    e.status = status; return e;
  }
  function gh(path, opts){
    opts = opts || {};
    var headers = {
      "Accept": "application/vnd.github+json",
      "Authorization": "Bearer " + token,
      "X-GitHub-Api-Version": "2022-11-28"
    };
    if(opts.etag) headers["If-None-Match"] = opts.etag;
    if(opts.body) headers["Content-Type"] = "application/json";
    return fetch(path, {method: opts.method || "GET", headers: headers, body: opts.body ? JSON.stringify(opts.body) : undefined, cache: "no-store"})
      .then(function(r){
        if(r.status === 304) return {notModified:true};
        return r.text().then(function(txt){
          var j = null; try { j = txt ? JSON.parse(txt) : null; } catch(e){}
          if(!r.ok) throw ghErr(r.status, j);
          return {json: j, etag: r.headers.get("ETag")};
        });
      });
  }
  function parseJSON(text){
    try { return JSON.parse(text); } catch(e){ var er = new Error("chat file is not valid JSON"); er.badJson = true; throw er; }
  }
  // -> {sha, text} ; 404 -> {missing:true} ; 304 -> {notModified:true} (only when useEtag)
  function readFile(file, useEtag){
    var c = cache[file] || (cache[file] = {});
    return gh(API + file + "?ref=" + BRANCH, {etag: useEtag ? c.etag : null})
      .then(function(res){
        if(res.notModified) return {notModified:true};
        var j = res.json;
        var p = (j.encoding === "base64" && j.content) ? Promise.resolve(b64ToUtf8(j.content))
              : gh(j.git_url).then(function(b){ return b64ToUtf8(b.json.content); }); // big files (>1 MB)
        return p.then(function(text){ c.sha = j.sha; c.etag = res.etag || null; return {sha: j.sha, text: text}; });
      }, function(err){
        if(err.status === 404){ c.sha = null; c.etag = null; return {missing:true, sha:null}; }
        throw err;
      });
  }
  function writeFile(file, sha, obj, message){
    var body = {message: message, content: utf8ToB64(JSON.stringify(obj, null, 2) + "\n"), branch: BRANCH};
    if(sha) body.sha = sha;
    return gh(API + file, {method:"PUT", body: body}).then(function(res){
      var c = cache[file] || (cache[file] = {});
      c.sha = res.json && res.json.content ? res.json.content.sha : null; c.etag = null;
      return c.sha;
    });
  }
  // read -> change -> write; if someone else wrote first (409/422) refetch and retry (3 retries)
  function rmw(file, fromRead, change, message){
    var attempt = 0;
    function once(){
      attempt++;
      return readFile(file, false).then(function(r){
        var doc = fromRead(r);
        if(change(doc) === false) return {doc: doc, unchanged: true};
        return writeFile(file, r.sha, doc, message).then(function(){ return {doc: doc}; });
      }).catch(function(err){
        if((err.status === 409 || err.status === 422) && attempt < 4) return once();
        throw err;
      });
    }
    return once();
  }
  function threadDoc(r, id){
    var doc = r.missing ? {} : parseJSON(r.text);
    if(!doc || typeof doc !== "object") doc = {};
    if(!Array.isArray(doc.messages)) doc.messages = [];
    if(!doc.thread) doc.thread = id;
    return doc;
  }
  // chat/index.json: { "threads": [ {file, title, section: "ai"|"team"|"requests", pinned} ] }
  function defaultIndex(){
    return {threads: BASE_THREADS.map(function(t){ return {file:t.file, title:t.title, section:"ai", pinned:false}; })};
  }
  function normIndex(doc){
    if(!doc || typeof doc !== "object") doc = {};
    if(!Array.isArray(doc.threads)) doc.threads = [];
    var seen = {};
    doc.threads = doc.threads.filter(function(e){
      if(!e || typeof e !== "object" || !idOf(e.file) || seen[e.file]) return false;
      seen[e.file] = 1; return true;
    });
    BASE_THREADS.forEach(function(t){ if(!seen[t.file]) doc.threads.push({file:t.file, title:t.title, section:"ai", pinned:false}); });
    if(doc.reads !== undefined && (!doc.reads || typeof doc.reads !== "object" || Array.isArray(doc.reads))) doc.reads = {};
    return doc;
  }
  function readsOf(doc, file){
    var r = doc.reads && doc.reads[file], out = {};
    if(r && typeof r === "object") for(var k in r) if(Object.prototype.hasOwnProperty.call(r, k) && typeof r[k] === "string" && !isNaN(Date.parse(r[k]))) out[k] = r[k];
    return out;
  }
  function indexFromRead(r){ return normIndex(r.missing ? defaultIndex() : parseJSON(r.text)); }
  function threadsOf(doc){
    return doc.threads.map(function(e){
      return {id: idOf(e.file), title: String(e.title || idOf(e.file)).slice(0, 80),
              section: (e.section === "team" || e.section === "requests") ? e.section : "ai", pinned: e.pinned === true,
              reads: readsOf(doc, e.file)};
    });
  }
  function saveIndex(change, message){
    return rmw(INDEX_FILE, indexFromRead, change, message).then(function(res){ listDoc = res.doc; return threadsOf(listDoc); });
  }
  function slugify(s){
    return String(s).toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40).replace(/-+$/,"") || "chat";
  }

  return {
    name: "github",
    setToken: function(tok){ token = tok; cache = {}; listDoc = null; },
    checkAccess: function(){ return gh("https://api.github.com/repos/" + REPO); },
    listThreads: function(fresh){
      return readFile(INDEX_FILE, !fresh && !!listDoc).then(function(r){
        if(r.notModified && listDoc) return {changed:false, threads: threadsOf(listDoc)};
        listDoc = indexFromRead(r);
        return {changed:true, threads: threadsOf(listDoc)};
      });
    },
    readThread: function(id, fresh){
      if(!ID_RE.test(id)) return Promise.reject(new Error("bad chat id"));
      return readFile(fileOf(id), !fresh).then(function(r){
        if(r.notModified) return {changed:false};
        var doc = threadDoc(r, id);
        return {changed:true, missing: !!r.missing, title: doc.title, messages: doc.messages};
      });
    },
    send: function(id, msg){
      return rmw(fileOf(id), function(r){ return threadDoc(r, id); }, function(doc){
        if(doc.messages.some(function(m){ return m && m.id === msg.id; })) return false;
        doc.messages.push(msg);
      }, "chat(" + id + "): " + (msg.sendAt ? "scheduled message" : "message") + " from " + msg.from);
    },
    cancelScheduled: function(id, msgId, from){
      var out = {removed:false, tooLate:false};
      return rmw(fileOf(id), function(r){ return threadDoc(r, id); }, function(doc){
        var keep = [];
        doc.messages.forEach(function(m){
          if(m && m.id === msgId && m.from === from && m.sendAt){
            if(Date.parse(m.sendAt) <= Date.now()){ out.tooLate = true; keep.push(m); }
            else out.removed = true;
          } else keep.push(m);
        });
        if(!out.removed) return false;
        doc.messages = keep;
      }, "chat(" + id + "): cancel a scheduled message from " + from).then(function(){ return out; });
    },
    // the sender changes the text of their own message (adds editedAt). Only that one message is touched;
    // rmw re-reads the newest file first and retries if someone else saved at the same moment.
    edit: function(id, msgId, from, text){
      var out = {found:false};
      return rmw(fileOf(id), function(r){ return threadDoc(r, id); }, function(doc){
        var m = null;
        doc.messages.forEach(function(x){ if(x && typeof x === "object" && mkey(x) === msgId) m = x; });
        out.found = !!(m && m.from === from && !m.deleted);
        if(!out.found || m.text === text) return false;
        m.text = text; m.editedAt = new Date().toISOString();
      }, "chat(" + id + "): " + from + " edited a message").then(function(){ return out; });
    },
    // owner soft delete: the message stays (so replies to it still make sense) but its text/photo are cleared
    remove: function(id, msgId, by){
      var out = {found:false};
      return rmw(fileOf(id), function(r){ return threadDoc(r, id); }, function(doc){
        var m = null;
        doc.messages.forEach(function(x){ if(x && typeof x === "object" && mkey(x) === msgId) m = x; });
        out.found = !!m;
        if(!m || m.deleted) return false;
        if(m.id === undefined || m.id === null || m.id === "") m.id = msgId;   // keep replies to it pointing at it
        m.deleted = true; m.deletedAt = new Date().toISOString(); m.deletedBy = by; m.text = "";
        delete m.image; delete m.style; delete m.voice;
      }, "chat(" + id + "): message deleted by " + by).then(function(){ return out; });
    },
    setPinned: function(id, pinned){
      return saveIndex(function(doc){
        var hit = null;
        doc.threads.forEach(function(e){ if(idOf(e.file) === id) hit = e; });
        if(!hit) return false;
        if(hit.pinned === pinned) return false;
        hit.pinned = pinned;
      }, "chat(index): " + (pinned ? "pin " : "unpin ") + id);
    },
    createThread: function(section, title){
      var base = (section === "team" ? "team-" : section === "requests" ? "req-" : "") + slugify(title), n = 1;
      var taken = {};
      (listDoc ? listDoc.threads : []).forEach(function(e){ taken[e.file] = 1; });
      function nextFile(){ var f; do { f = fileOf(base + (n > 1 ? "-" + n : "")); n++; } while(taken[f]); return f; }
      function tryCreate(left){
        var file = nextFile(), id = idOf(file);
        return writeFile(file, null, {thread: id, title: title, messages: []},
                         "chat(" + id + "): new " + (section === "team" ? "Devs & Mods" : section) + " chat \"" + title + "\" (from the owner page)")
          .then(function(){ return file; }, function(err){
            if((err.status === 422 || err.status === 409) && left > 0){ taken[file] = 1; return tryCreate(left - 1); } // already exists
            throw err;
          });
      }
      return tryCreate(5).then(function(file){
        return saveIndex(function(doc){
          if(doc.threads.some(function(e){ return e.file === file; })) return false;
          doc.threads.push({file: file, title: title, section: section, pinned: false});
        }, "chat(index): add " + idOf(file)).then(function(threads){ return {id: idOf(file), threads: threads}; });
      });
    },
    // The public site's "Talk to the owner" button has no backend yet (it waits for the
    // Google sign-in build), so there is nothing to list. A future store fills this in.
    listRequests: function(){ return Promise.resolve([]); },
    uploadImage: function(b64){
      var ref = "media/" + Date.now() + "-" + Math.random().toString(36).slice(2,8) + ".jpg";
      var body = {message: "chat(media): photo from the owner page", content: b64, branch: BRANCH};
      return gh(API + "chat/" + ref, {method:"PUT", body: body}).then(function(){ imgCache[ref] = "data:image/jpeg;base64," + b64; return ref; });
    },
    imageUrl: function(ref){
      if(!IMG_RE.test(String(ref))) return Promise.reject(new Error("bad image"));
      if(imgCache[ref]) return Promise.resolve(imgCache[ref]);
      return gh(API + "chat/" + ref + "?ref=" + BRANCH).then(function(res){
        var j = res.json;
        var p = (j.encoding === "base64" && j.content) ? Promise.resolve(j.content) : gh(j.git_url).then(function(b){ return b.json.content; });
        return p.then(function(b64){
          var bin = atob(String(b64).replace(/\s/g,"")), bytes = new Uint8Array(bin.length);
          for(var i=0;i<bin.length;i++) bytes[i] = bin.charCodeAt(i);
          return (imgCache[ref] = URL.createObjectURL(new Blob([bytes], {type:"image/jpeg"})));
        });
      });
    },
    markRead: function(id, reader, iso){
      var file = fileOf(id);
      return saveIndex(function(doc){
        if(!doc.reads || typeof doc.reads !== "object") doc.reads = {};
        var r = doc.reads[file];
        if(!r || typeof r !== "object" || Array.isArray(r)) r = doc.reads[file] = {};
        if(r[reader] && Date.parse(r[reader]) >= Date.parse(iso)) return false;
        r[reader] = iso;
      }, "chat(index): " + reader + " read " + id);
    }
  };
}
Store = window.ChatStore || GitHubChatStore();

// ---------- chat list ----------
function buildThreads(){
  var list = [];
  (state.list || BASE_THREADS.map(function(t){ return {id:t.key, title:t.title, section:"ai", pinned:false}; })).forEach(function(e, i){
    var base = null;
    BASE_THREADS.forEach(function(b){ if(b.key === e.id) base = b; });
    var title = String(e.title || e.id);
    var t = base ? {key:base.key, title:base.title, short:base.short, who:base.who, note:base.note}
                 : {key:e.id, title:title, short:title.length > 14 ? title.slice(0,13) + "\u2026" : title, who:[]};
    t.section = e.section; t.pinned = !!e.pinned; t.order = i; t.reads = e.reads || {};
    list.push(t);
  });
  // pinned first inside each section, otherwise the list order
  list.sort(function(a,b){ return (b.pinned - a.pinned) || (a.order - b.order); });
  state.threads = list;
}
function threadsIn(sec){ return state.threads.filter(function(t){ return t.section === sec; }); }
function setList(threads){ state.list = threads; state.listError = null; buildThreads(); }
function refreshList(quiet){
  return Store.listThreads(false).then(function(r){
    if(r.changed) setList(r.threads);
    state.listError = null;
    if(state.open && !threadByKey(state.open)) openThread(state.threads[0].key);
    else if(r.changed){ renderSide(); renderThread(); }
    state.threads.forEach(function(t){ if(!state.data[t.key]) refresh(t, true); });
  }).catch(function(err){
    state.listError = err;
    if(err.status === 401){ logout("That key stopped working (expired or deleted). Paste a new one."); return; }
    if(!quiet) flash(friendly(err), true);
  });
}
function togglePin(t){
  var want = !t.pinned;
  // show it right away, undo if saving fails
  (state.list || []).forEach(function(e){ if(e.id === t.key) e.pinned = want; });
  buildThreads(); renderSide(); renderHead();
  return Store.setPinned(t.key, want).then(function(threads){ setList(threads); renderSide(); renderHead(); flash(want ? "Pinned" : "Unpinned"); },
    function(err){
      (state.list || []).forEach(function(e){ if(e.id === t.key) e.pinned = !want; });
      buildThreads(); renderSide(); renderHead();
      flash("Couldn't " + (want ? "pin" : "unpin") + ". " + friendly(err), true);
    });
}

// ---------- reading + sending ----------
function refresh(t, quiet){
  return Store.readThread(t.key, false).then(function(r){
    var d = state.data[t.key] || (state.data[t.key] = {});
    d.loadedAt = Date.now(); d.error = null;
    if(r.changed){ d.doc = {messages: r.messages}; d.missing = !!r.missing; }
    if(state.open === t.key){ renderThread(); markSeen(t.key); markReadRemote(t); }
    renderSide();
  }).catch(function(err){
    var d = state.data[t.key] || (state.data[t.key] = {});
    d.error = err;
    if(err.status === 401){ logout("That key stopped working (expired or deleted). Paste a new one."); return; }
    if(!quiet || state.open === t.key) renderStatus();
  });
}
function afterWrite(t){
  // re-read so the screen shows exactly what's saved (incl. anyone who posted at the same time)
  return Store.readThread(t.key, true).then(function(r){
    var d = state.data[t.key] || (state.data[t.key] = {});
    d.doc = {messages: r.messages}; d.missing = !!r.missing; d.loadedAt = Date.now(); d.error = null;
  }, function(){});
}
// o: {voice, sendAt, style, photo:{b64, url}, image (already uploaded ref)}
function sendMessage(t, text, o){
  o = o || {};
  var msg = {id: newId(), from: ME, text: text, time: new Date().toISOString()};
  if(o.voice) msg.voice = true;  // dictated with the mic: coders, read it generously
  if(o.sendAt) msg.sendAt = o.sendAt;
  var st = cleanStyle(o.style); if(st) msg.style = st;
  if(o.image) msg.image = o.image;
  if(o.replyTo) msg.replyTo = o.replyTo;
  var p = {id: msg.id, from: msg.from, text: msg.text, time: msg.time, voice: msg.voice, sendAt: msg.sendAt, style: msg.style,
           image: msg.image, replyTo: msg.replyTo, photo: o.photo || null, localImage: o.photo ? o.photo.url : null};
  (state.pending[t.key] = state.pending[t.key] || []).push(p);
  renderThread(); scrollBottom(true);
  var up = (o.photo && !msg.image) ? Store.uploadImage(o.photo.b64).then(function(ref){ msg.image = p.image = ref; imgUrls[ref] = o.photo.url; p.photo = null; })
                                   : Promise.resolve();
  return up.then(function(){ return Store.send(t.key, msg); }).then(function(){
    return afterWrite(t);
  }).then(function(){
    removePending(t.key, msg.id);
    markSeen(t.key);
    renderThread(); renderSide(); scrollBottom(true);
    if(o.sendAt) flash("Scheduled for " + fmtWhen(o.sendAt));
    return true;
  }, function(err){
    p.failed = true; p.error = friendly(err);
    renderThread();
    if(err.status === 401) logout("That key stopped working. Paste a new one.");
    return false;
  });
}
function cancelScheduled(t, id){
  state.cancelling[id] = true; renderThread();
  return Store.cancelScheduled(t.key, id, ME).then(function(r){
    return afterWrite(t).then(function(){
      delete state.cancelling[id];
      renderThread(); renderSide();
      flash(r.tooLate ? "Too late, that one already went out." : "Scheduled message canceled", r.tooLate);
    });
  }, function(err){
    delete state.cancelling[id]; renderThread();
    flash("Couldn't cancel. " + friendly(err), true);
  });
}
function editMessage(t, id, text){
  var o = findMsg(t.key, id); if(!o) return;
  if(o.text === text) return;
  state.overlay[id] = {text: text, editedAt: new Date().toISOString()};
  renderThread();
  return Store.edit(t.key, id, ME, text).then(function(r){
    return afterWrite(t).then(function(){
      delete state.overlay[id];
      renderThread(); renderSide();
      flash(r.found ? "Edited" : "Couldn't find that message anymore.", !r.found);
    });
  }, function(err){
    delete state.overlay[id]; renderThread();
    if(err.status === 401){ logout("That key stopped working. Paste a new one."); return; }
    flash("Couldn't save the edit. " + friendly(err), true);
    startEdit(id); $("ocText").value = text; growBox();   // nothing typed gets lost
  });
}
function deleteMessage(t, id){
  state.overlay[id] = {deleted: true};
  if(state.ctx && state.ctx.id === id) setCtx(null);
  renderThread();
  return Store.remove(t.key, id, ME).then(function(r){
    return afterWrite(t).then(function(){
      delete state.overlay[id];
      renderThread(); renderSide();
      flash(r.found ? "Deleted" : "Couldn't find that message anymore.", !r.found);
    });
  }, function(err){
    delete state.overlay[id]; renderThread();
    if(err.status === 401){ logout("That key stopped working. Paste a new one."); return; }
    flash("Couldn't delete. " + friendly(err), true);
  });
}
function removePending(k, id){
  state.pending[k] = (state.pending[k] || []).filter(function(m){ return m.id !== id; });
}
function friendly(err){
  if(!err) return "Something went wrong.";
  if(err.badJson) return "This chat file got broken (not valid JSON). Ask Titan TV Man to fix it.";
  if(err.status === 401) return "The key doesn't work (wrong, expired or deleted).";
  if(err.status === 403) return "The key can read but not write, or GitHub is rate-limiting. Check the key has Contents: Read and write.";
  if(err.status === 404) return "The key can't see the skibidi-strike repo. Make sure you picked it under \"Only select repositories\".";
  if(err.status === 409 || err.status === 422) return "Someone else saved at the same moment. Try again.";
  if(err instanceof TypeError) return "No connection. Check your internet.";
  return err.message || "Something went wrong.";
}
var flashT;
function flash(msg, bad, ms){
  var el = $("ocFlash"); if(!el) return;
  el.textContent = msg; el.className = "oc-flash on" + (bad ? " bad" : "");
  clearTimeout(flashT); flashT = setTimeout(function(){ el.className = "oc-flash"; }, ms || (bad ? 5000 : 2200));
}

// ---------- text style, photos, seen ----------
var FONTS = {bold:"Bold", mono:"Mono", comic:"Comic"};
var COLORS = {cyan:"#00c8ff", yellow:"#ffd23f", pink:"#ff6bd6", green:"#39ff7a", orange:"#ff8a3d", purple:"#b98bff"};
function styleClass(st){
  if(!st || typeof st !== "object") return "";
  var c = "";
  if(FONTS.hasOwnProperty(st.font)) c += " oc-f-" + st.font;
  if(COLORS.hasOwnProperty(st.color)) c += " oc-c-" + st.color;
  return c;
}
function cleanStyle(st){
  if(!st) return null;
  var o = {};
  if(FONTS.hasOwnProperty(st.font)) o.font = st.font;
  if(COLORS.hasOwnProperty(st.color)) o.color = st.color;
  return (o.font || o.color) ? o : null;
}
var IMG_REF = /^media\/[a-z0-9-]{1,40}\.jpg$/;
var imgUrls = {};  // ref -> url already loaded
function imageHtml(m){
  if(m.localImage) return '<button type="button" class="oc-img" data-src="' + esc(m.localImage) + '"><img alt="Photo" src="' + esc(m.localImage) + '"></button>';
  if(!IMG_REF.test(String(m.image || ""))) return "";
  var u = imgUrls[m.image];
  return '<button type="button" class="oc-img" data-ref="' + esc(m.image) + '"' + (u ? ' data-src="' + esc(u) + '"' : '') + '>'
    + (u ? '<img alt="Photo" src="' + esc(u) + '">' : '<span class="oc-img-load">Loading photo\u2026</span>') + '</button>';
}
function hydrateImages(){
  Array.prototype.forEach.call($("ocMsgs").querySelectorAll(".oc-img[data-ref]:not([data-src])"), function(b){
    var ref = b.getAttribute("data-ref");
    Store.imageUrl(ref).then(function(u){
      imgUrls[ref] = u;
      var box = $("ocMsgs"), near = box.scrollHeight - box.scrollTop - box.clientHeight < 120;
      b.setAttribute("data-src", u);
      b.innerHTML = '<img alt="Photo" src="' + esc(u) + '">';
      var img = b.firstChild; img.onload = function(){ if(near) scrollBottom(); };
    }, function(){ b.innerHTML = '<span class="oc-img-load">Photo didn\u2019t load</span>'; });
  });
}
function openLightbox(src){ var lb = $("ocLightbox"); $("ocLightboxImg").src = src; lb.hidden = false; }
function closeLightbox(){ $("ocLightbox").hidden = true; $("ocLightboxImg").removeAttribute("src"); }
// "Seen": readers' last-seen times live with the chat list (reads: {name: iso})
function receiptFor(t, m){
  var at = tOf(shownTime(m)), seen = [], latest = 0;
  Object.keys(t.reads || {}).forEach(function(name){
    if(name === ME) return;
    var r = tOf(t.reads[name]);
    if(r !== null && at !== null && r >= at){ seen.push(name); if(r > latest) latest = r; }
  });
  if(!seen.length) return "Delivered";
  var who = (t.who.length === 1) ? "" : " by " + seen.map(function(n){ return String(n).split(" ")[0]; }).join(", ");
  return "Seen" + who + " " + fmtWhen(new Date(latest));
}
// record that the owner has read this chat (only when there's something new, so no commit spam)
function markReadRemote(t){
  if(document.hidden) return;
  var vis = visibleOf(t.key), newest = null;
  for(var i = vis.length - 1; i >= 0; i--){ if(vis[i].from !== ME){ newest = vis[i]; break; } }
  if(!newest) return;
  var mine = tOf((t.reads || {})[ME]), at = tOf(shownTime(newest));
  if(at === null || (mine !== null && mine >= at)) return;
  if(state.readTry[t.key] && Date.now() - state.readTry[t.key] < 60000) return;
  state.readTry[t.key] = Date.now();
  Store.markRead(t.key, ME, new Date(Math.max(Date.now(), at)).toISOString()).then(function(threads){
    setList(threads); renderSide(); renderThread();
  }, function(){ /* not important; try again next time */ });
}

// ---------- rendering ----------
var PIN_SVG = '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path fill="currentColor" d="M15.6 2.6a1 1 0 0 0-1.6 1.1l.5 1-4.3 4.3-2.9-.6a1 1 0 0 0-.9.3l-1.2 1.2a1 1 0 0 0 0 1.4l3.2 3.2-4.6 4.6a1 1 0 1 0 1.4 1.4l4.6-4.6 3.2 3.2a1 1 0 0 0 1.4 0l1.2-1.2a1 1 0 0 0 .3-.9l-.6-2.9 4.3-4.3 1 .5a1 1 0 0 0 1.1-1.6l-5.1-5.1Z"/></svg>';
function unread(k){
  var l = lastMsg(k);
  if(!l || l.from === ME) return false;
  return localStorage.getItem(seenKey(k)) !== String(l.id);
}
function markSeen(k){ var l = lastMsg(k); if(l) localStorage.setItem(seenKey(k), String(l.id)); }
function tabHtml(t){
  var l = lastMsg(t.key), on = state.open === t.key, sch = scheduledOf(t.key).length;
  var prev = l ? ((l.from === ME ? "You: " : (t.who.length !== 1 ? String(l.from || "?").split(" ")[0] + ": " : "")) + (l.deleted ? "message deleted" : String(l.text || "")))
               : (sch ? "" : "No messages yet");
  if(sch) prev = "\u23f0 " + sch + " scheduled" + (prev ? " \u00b7 " + prev : "");
  return '<button type="button" class="oc-tab' + (on ? ' on' : '') + (unread(t.key) && !on ? ' unread' : '') + (t.pinned ? ' pinned' : '') + '" data-k="' + esc(t.key) + '" aria-current="' + (on ? 'true' : 'false') + '">'
    + threadAvatar(t)
    + '<span class="oc-tab-txt"><span class="oc-tab-top">' + (t.pinned ? '<i class="oc-pinmark" title="Pinned">' + PIN_SVG + '</i>' : '')
    + '<b class="oc-full">' + esc(t.title) + '</b><b class="oc-short">' + esc(t.short) + '</b>'
    + (l ? '<time>' + esc(fmtShort(shownTime(l))) + '</time>' : '') + '</span>'
    + '<span class="oc-prev">' + esc(prev.slice(0, 140)) + '</span></span>'
    + '<i class="oc-dot" aria-hidden="true"></i></button>';
}
function renderSide(){
  var side = $("ocSide"); if(!side) return;
  var keepScroll = {};
  Array.prototype.forEach.call(side.querySelectorAll(".oc-sec-list"), function(el){ keepScroll[el.getAttribute("data-sec")] = el.scrollLeft; });
  var focusNew = document.activeElement && document.activeElement.id === "ocNewTitle";
  var newVal = focusNew ? document.activeElement.value : ($("ocNewTitle") ? $("ocNewTitle").value : "");
  var cur = state.sec || (threadByKey(state.open) || {}).section || "ai";
  // phones: one row of section tabs, then that section's chats
  var h = '<div class="oc-segs" role="tablist" aria-label="Chat sections">';
  SECTIONS.forEach(function(s){
    var n = s.id === "requests" ? (state.requests || []).length : threadsIn(s.id).length;
    var dot = threadsIn(s.id).some(function(t){ return t.key !== state.open && unread(t.key); });
    h += '<button type="button" role="tab" class="oc-seg' + (cur === s.id ? ' on' : '') + (dot ? ' unread' : '') + '" data-sec="' + s.id + '" aria-selected="' + (cur === s.id) + '">'
      + esc(s.short) + (n ? ' <span class="oc-count">' + n + '</span>' : '') + '<i class="oc-dot" aria-hidden="true"></i></button>';
  });
  h += '</div>';
  SECTIONS.forEach(function(s){
    var list = threadsIn(s.id);
    h += '<section class="oc-sec' + (cur === s.id ? ' cur' : '') + '" data-sec="' + s.id + '" aria-label="' + esc(s.title) + '">'
      + '<h3 class="oc-sec-h">' + esc(s.title) + '</h3>'
      + '<div class="oc-sec-list" data-sec="' + s.id + '">';
    list.forEach(function(t){ h += tabHtml(t); });
    if(s.id === "requests") (state.requests || []).forEach(function(r){
      h += '<a class="oc-tab oc-req" href="' + esc(r.url || "#") + '" target="_blank" rel="noopener noreferrer">' + avatar(r.from)
        + '<span class="oc-tab-txt"><span class="oc-tab-top"><b class="oc-full">' + esc(r.from) + '</b><b class="oc-short">' + esc(r.from) + '</b><time>' + esc(fmtShort(r.time)) + '</time></span>'
        + '<span class="oc-prev">' + esc(String(r.text || "").slice(0, 140)) + '</span></span></a>';
    });
    var count = s.id === "requests" ? list.length + (state.requests || []).length : list.length;
    if(!count) h += '<div class="oc-sec-empty"><b>' + esc(s.empty) + '</b>' + (s.hint ? '<span>' + esc(s.hint) + '</span>' : '') + '</div>';
    if(s.id === "team" && !state.newOpen) h += '<button type="button" class="oc-new" id="ocNewBtn">+ New chat</button>';
    h += '</div>';
    if(s.id === "team" && state.newOpen){
      h += '<form class="oc-newform" id="ocNewForm" autocomplete="off">'
        + '<input id="ocNewTitle" maxlength="60" placeholder="Chat name (like Mods or Bug testers)" aria-label="New chat name" value="' + esc(newVal) + '">'
        + '<div class="oc-newrow"><button type="button" class="oc-ghost" id="ocNewCancel">Cancel</button>'
        + '<button type="submit" class="oc-btn oc-btn-sm" id="ocNewCreate"' + (state.creating ? ' disabled' : '') + '>' + (state.creating ? 'Creating\u2026' : 'Create') + '</button></div>'
        + '</form>';
    }
    h += '</section>';
  });
  side.innerHTML = h;
  Array.prototype.forEach.call(side.querySelectorAll(".oc-sec-list"), function(el){ var v = keepScroll[el.getAttribute("data-sec")]; if(v) el.scrollLeft = v; });
  if(focusNew && $("ocNewTitle")){ var i = $("ocNewTitle"); i.focus(); i.setSelectionRange(i.value.length, i.value.length); }
}
function renderHead(){
  var t = threadByKey(state.open); if(!t) return;
  $("ocTitle").textContent = t.title;
  $("ocHeadAv").innerHTML = threadAvatar(t);
  var pin = $("ocPin");
  pin.classList.toggle("on", t.pinned);
  pin.setAttribute("aria-pressed", t.pinned ? "true" : "false");
  pin.setAttribute("aria-label", t.pinned ? "Unpin this chat" : "Pin this chat");
  pin.title = t.pinned ? "Unpin" : "Pin to the top";
}
function setStatusError(err){ $("ocStatus").innerHTML = '<span class="bad">' + esc(friendly(err)) + '</span>'; }
function renderStatus(){
  var t = threadByKey(state.open), d = state.data[state.open], el = $("ocStatus");
  if(!t){ el.textContent = ""; return; }
  var s = t.who.length ? t.who.filter(function(w){ return w !== ME; }).join(", ") + (t.key === "group" ? " + you" : "")
                       : sectionById(t.section).title;
  if(d && d.error) { setStatusError(d.error); return; }
  el.textContent = s + " \u00b7 " + (d && d.loadedAt ? "updated " + ago(d.loadedAt) : "loading\u2026");
}
var REPLY_SVG = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="M10 8V4.5L3 11l7 6.5V14c4.4 0 7.6 1.3 10 4.8-.9-5-3.9-9.6-10-10.8Z"/></svg>';
var EDIT_SVG = '<svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true"><path fill="currentColor" d="M4 17.3V20h2.7l8-8-2.7-2.7-8 8Zm12.7-7.9a.9.9 0 0 0 0-1.3l-1.8-1.8a.9.9 0 0 0-1.3 0L12.3 7.6 15 10.3l1.7-.9Z"/></svg>';
var MORE_SVG = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="M6 10.2a1.8 1.8 0 1 0 0 3.6 1.8 1.8 0 0 0 0-3.6Zm6 0a1.8 1.8 0 1 0 0 3.6 1.8 1.8 0 0 0 0-3.6Zm6 0a1.8 1.8 0 1 0 0 3.6 1.8 1.8 0 0 0 0-3.6Z"/></svg>';
// the little quoted box above a reply (tap it to jump to the original)
function quoteHtml(t, m){
  if(!m.replyTo) return "";
  var o = findMsg(t.key, m.replyTo);
  if(o && o.from !== ME && isScheduled(o)) o = null;
  return '<button type="button" class="oc-quote' + (o ? '' : ' gone') + '" data-goto="' + esc(m.replyTo) + '" aria-label="Go to the message this replies to">'
    + (o ? '<b class="' + person(o.from).cls + '">' + esc(whoName(o.from)) + '</b>' : '')
    + '<span>' + esc(o ? (snippetOf(o, 90) || "\u2026") : "Original message not found") + '</span></button>';
}
function actsHtml(m){
  if(!isLive(m)) return "";
  var h = '<div class="oc-acts" aria-label="Message actions">';
  if(canReply(m)) h += '<button type="button" data-act="reply" aria-label="Reply" title="Reply">' + REPLY_SVG + '</button>';
  if(canEdit(m)) h += '<button type="button" data-act="edit" aria-label="Edit" title="Edit">' + EDIT_SVG + '</button>';
  h += '<button type="button" data-act="more" aria-label="More" title="More">' + MORE_SVG + '</button>';
  return h + '</div>';
}
function bubble(m, prev, next, t){
  var mine = m.from === ME, sched = !!m.scheduled;
  var mt = shownTime(m), pt = prev ? shownTime(prev) : null, nt = next ? shownTime(next) : null;
  var startGroup = sched || !prev || prev.from !== m.from || (new Date(mt) - new Date(pt) > 5*60000) || !!m.replyTo;
  var endGroup = sched || !next || next.from !== m.from || (new Date(nt) - new Date(mt) > 5*60000) || !!(next && next.replyTo);
  var key = mkey(m), hl = state.hl && state.hl.id === key && state.hl.until > Date.now();
  var h = '<div class="oc-row ' + (mine ? 'me' : 'them') + (startGroup ? ' start' : '') + (endGroup ? ' end' : '') + (sched ? ' sched' : '') + (hl ? ' oc-hl' : '') + (isLive(m) ? ' live' : '') + '" data-id="' + esc(key) + '">';
  if(!mine) h += endGroup ? avatar(m.from, true) : '<span class="oc-av-sp"></span>';
  if(mine) h += actsHtml(m);
  h += '<div class="oc-col">';
  if(startGroup && !mine) h += '<div class="oc-meta"><b class="' + person(m.from).cls + '">' + esc(m.from) + '</b> <time>' + esc(fmtTime(mt)) + '</time></div>';
  if(startGroup && mine && !sched) h += '<div class="oc-meta"><time>' + esc(fmtTime(mt)) + '</time></div>';
  h += quoteHtml(t, m);
  if(m.deleted){
    h += '<div class="oc-bub oc-deleted">\ud83d\udeab message deleted</div>';
  } else {
    var img = imageHtml(m);
    if(img) h += '<div class="oc-imgwrap' + (m.sending ? ' sending' : '') + '">' + img + '</div>';
    if(String(m.text || "").trim() || !img) h += '<div class="oc-bub' + styleClass(m.style) + (m.failed ? ' failed' : '') + (m.sending || m.saving ? ' sending' : '') + '">' + linkify(m.text)
      + (m.editedAt ? ' <span class="oc-edited">(edited)</span>' : '') + '</div>';
    else if(m.editedAt) h += '<div class="oc-sub oc-edited">(edited)</div>';
    if(m.voice === true) h += '<div class="oc-sub oc-vtag">\ud83c\udfa4 voice note</div>';
  }
  if(m.saving) h += '<div class="oc-sub">Saving\u2026</div>';
  if(sched && !m.sending && !m.failed){
    h += '<div class="oc-sub oc-schedtag">\u23f0 Scheduled for ' + esc(fmtWhen(m.sendAt)) + ' \u00b7 only you can see it'
      + (state.cancelling[m.id] ? ' \u00b7 canceling\u2026' : ' <button type="button" class="oc-cancel" data-id="' + esc(m.id) + '">Cancel</button>') + '</div>';
  }
  if(m.sending && !m.failed) h += '<div class="oc-sub">' + (m.sendAt ? 'Scheduling\u2026' : 'Sending\u2026') + '</div>';
  if(m.receipt) h += '<div class="oc-sub oc-receipt">' + esc(m.receipt) + '</div>';
  if(m.failed) h += '<div class="oc-sub bad">Not sent. ' + esc(m.error || "") + ' <button type="button" class="oc-retry" data-id="' + esc(m.id) + '">Retry</button></div>';
  h += '</div>';
  if(!mine) h += actsHtml(m);
  h += '</div>';
  return h;
}
function renderThread(){
  var t = threadByKey(state.open); if(!t) return;
  var box = $("ocMsgs");
  var nearBottom = box.scrollHeight - box.scrollTop - box.clientHeight < 80;
  renderHead();
  var note = $("ocNote");
  if(t.note){ note.textContent = t.note; note.hidden = false; } else note.hidden = true;
  var d = state.data[t.key], now = Date.now();
  // file order = the order messages were appended (clocks can differ, so no sorting by time)
  var list = visibleOf(t.key).map(withOverlay);
  var sched = scheduledOf(t.key).map(function(m){ var c = shallow(withOverlay(m)); c.scheduled = true; return c; });
  var have = {}; messagesOf(t.key).forEach(function(m){ have[m.id] = 1; });
  (state.pending[t.key] || []).forEach(function(p){
    if(have[p.id]) return;
    var c = {id:p.id, from:p.from, text:p.text, time:p.time, voice:p.voice, sendAt:p.sendAt, style:p.style, image:p.image, replyTo:p.replyTo, localImage:p.localImage, sending:true, failed:p.failed, error:p.error};
    if(p.sendAt && isScheduled(p, now)){ c.scheduled = true; sched.push(c); } else list.push(c);
  });
  for(var j = list.length - 1; j >= 0; j--){
    if(list[j].from === ME && !list[j].sending){
      if(j === list.length - 1 || list.slice(j+1).every(function(x){ return x.from === ME; })) { list[j] = shallow(list[j]); list[j].receipt = receiptFor(t, list[j]); }
      break;
    }
  }
  var h = "", lastDay = "";
  if(!d || (!d.loadedAt && !d.error)) h = '<div class="oc-empty">Loading\u2026</div>';
  else if(!list.length && !sched.length) h = '<div class="oc-empty">' + (d.missing ? "This chat hasn't been started yet. Say something and it'll be created." : "No messages yet.") + '</div>';
  for(var i=0;i<list.length;i++){
    var day = fmtDay(shownTime(list[i]));
    if(day && day !== lastDay){ h += '<div class="oc-day"><span>' + esc(day) + '</span></div>'; lastDay = day; }
    h += bubble(list[i], list[i-1], list[i+1], t);
  }
  if(sched.length){
    h += '<div class="oc-day oc-day-sched"><span>\u23f0 Scheduled \u00b7 ' + sched.length + '</span></div>';
    sched.forEach(function(m){ h += bubble(m, null, null, t); });
  }
  box.innerHTML = h;
  hydrateImages();
  renderStatus();
  if(nearBottom) scrollBottom();
}
function shallow(m){ var c = {}; for(var k in m) c[k] = m[k]; return c; }
function scrollBottom(force){ var b = $("ocMsgs"); b.scrollTop = b.scrollHeight; }

function openThread(k, fromUser){
  var t = threadByKey(k) || state.threads[0];
  if(state.ctx && state.ctx.key !== t.key) setCtx(null);
  closeSheet();
  state.open = t.key; state.sec = t.section;
  try { history.replaceState(null, "", "#" + t.key); } catch(e){}
  renderSide(); renderThread(); scrollBottom(true);
  refresh(t).then(function(){
    scrollBottom(true);
    try {   // one-time tip so the new Reply / Edit is easy to find
      if(!localStorage.getItem("ss_chat_tip_reply") && messagesOf(t.key).length){
        localStorage.setItem("ss_chat_tip_reply", "1");
        flash(matchMedia("(hover:none)").matches ? "New: hold a message to reply or edit it (or swipe it right to reply)" : "New: point at a message to reply \u21a9 or edit \u270e it", false, 6000);
      }
    } catch(e){}
  });
  if(fromUser){
    var on = document.querySelector('.oc-sec.cur .oc-tab.on'), row = on && on.parentNode;
    if(row && row.scrollWidth > row.clientWidth) row.scrollLeft = on.offsetLeft - row.offsetLeft - (row.clientWidth - on.offsetWidth)/2;
  }
}


// ---------- reply / edit (composer bar, Hold menu, swipe) ----------
function setCtx(c){
  var prev = state.ctx, ta = $("ocText");
  if(prev && prev.mode === "edit" && !(c && c.mode === "edit")) ta.value = prev.draft || "";  // back to what you were typing
  state.ctx = c || null;
  var bar = $("ocCtxBar"), th = $("ocThread");
  th.classList.toggle("oc-editing", !!(c && c.mode === "edit"));
  if(!c){ bar.hidden = true; $("ocSend").textContent = "Send"; $("ocSend").setAttribute("aria-label", "Send"); growBox(); return; }
  var m = findMsg(c.key, c.id);
  bar.className = "oc-ctxbar " + (c.mode === "edit" ? "edit" : "reply");
  $("ocCtxIc").innerHTML = c.mode === "edit" ? EDIT_SVG : REPLY_SVG;
  $("ocCtxTitle").innerHTML = c.mode === "edit" ? "Editing message"
    : 'Replying to <b class="' + person(m && m.from).cls + '">' + esc(m && m.from === ME ? "yourself" : whoName(m && m.from)) + '</b>';
  $("ocCtxSnip").textContent = snippetOf(m, 60);
  bar.hidden = false;
  $("ocSend").textContent = c.mode === "edit" ? "Save" : "Send";
  $("ocSend").setAttribute("aria-label", c.mode === "edit" ? "Save edit" : "Send reply");
  growBox();
}
function startReply(id){
  var t = threadByKey(state.open); if(!t) return;
  var m = findMsg(t.key, id); if(!canReply(m)) return;
  if(state.ctx && state.ctx.mode === "edit") setCtx(null);
  setCtx({mode:"reply", key:t.key, id:id});
  focusText();
}
function startEdit(id){
  var t = threadByKey(state.open); if(!t) return;
  var m = findMsg(t.key, id); if(!canEdit(m)) return;
  var draft = (state.ctx && state.ctx.mode === "edit") ? state.ctx.draft : $("ocText").value;
  closePops(); voiceStop(true);
  setCtx({mode:"edit", key:t.key, id:id, draft:draft});
  $("ocText").value = String(m.text || "");
  growBox(); focusText();
}
function focusText(){
  var ta = $("ocText");
  try { ta.focus({preventScroll:true}); } catch(e){ ta.focus(); }
  var n = ta.value.length; try { ta.setSelectionRange(n, n); } catch(e){}
}
function jumpTo(id){
  var row = $("ocMsgs").querySelector('.oc-row[data-id="' + (window.CSS && CSS.escape ? CSS.escape(id) : id) + '"]');
  if(!row){ flash("That message isn't in this chat anymore.", true); return; }
  state.hl = {id: id, until: Date.now() + 1800};
  row.scrollIntoView({block: "center", behavior: "smooth"});
  row.classList.remove("oc-hl"); void row.offsetWidth; row.classList.add("oc-hl");
  setTimeout(function(){ if(state.hl && state.hl.id === id && state.hl.until <= Date.now() + 50){ state.hl = null; var r = $("ocMsgs").querySelector('.oc-row.oc-hl'); if(r) r.classList.remove("oc-hl"); } }, 1850);
}
function openSheet(id, fromHold){
  var t = threadByKey(state.open); if(!t) return;
  var m = findMsg(t.key, id); if(!isLive(m)) return;
  state.sheet = id; state.sheetAt = fromHold ? Date.now() : 0;
  $("ocSheetWho").innerHTML = '<b class="' + person(m.from).cls + '">' + esc(whoName(m.from)) + '</b>';
  $("ocSheetPrev").textContent = snippetOf(m, 120);
  var sh = $("ocSheet");
  sh.querySelector('[data-act="reply"]').hidden = !canReply(m);
  sh.querySelector('[data-act="edit"]').hidden = !canEdit(m);
  sh.querySelector('[data-act="copy"]').hidden = !String(m.text || "").trim();
  sh.querySelector('[data-act="delete"]').hidden = !canDelete(m);
  sh.hidden = false;
  var first = sh.querySelector('.oc-sheet-box button:not([hidden])'); if(first) try { first.focus({preventScroll:true}); } catch(e){}
}
function closeSheet(){ var sh = $("ocSheet"); if(sh) sh.hidden = true; state.sheet = null; }
function copyText(s){
  function fallback(){
    var x = document.createElement("textarea"); x.value = s; x.setAttribute("readonly", ""); x.style.position = "fixed"; x.style.opacity = "0";
    document.body.appendChild(x); x.select(); var ok = false; try { ok = document.execCommand("copy"); } catch(e){}
    document.body.removeChild(x); flash(ok ? "Copied" : "Couldn't copy", !ok);
  }
  if(navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(s).then(function(){ flash("Copied"); }, fallback);
  else fallback();
}
function sheetAct(act, id){
  var t = threadByKey(state.open); closeSheet(); if(!t || !id) return;
  var m = findMsg(t.key, id);
  if(act === "reply") startReply(id);
  else if(act === "edit") startEdit(id);
  else if(act === "copy" && m) copyText(String(m.text || ""));
  else if(act === "delete" && canDelete(m)){
    if(confirm(m.from === ME ? "Delete this message? Everyone will see \u201cmessage deleted\u201d." : "Delete " + m.from + "'s message for everyone?")) deleteMessage(t, id);
  }
}
// hold (phones) = menu, swipe right = reply. Desktop: the small buttons next to a message, or right-click.
function wireGestures(box){
  var G = null, eatClick = 0, HOLD_MS = 450, SWIPE_AT = 56;
  function rowOf(el){ return el && el.closest ? el.closest(".oc-row.live[data-id]") : null; }
  function reset(g){
    if(!g) return; clearTimeout(g.timer);
    if(g.swiping && g.row){ g.row.classList.remove("oc-drag", "oc-swipe-ready"); g.row.style.transform = ""; }
  }
  box.addEventListener("pointerdown", function(ev){
    if(ev.pointerType === "mouse") return;
    var row = rowOf(ev.target);
    if(!row || ev.target.closest(".oc-acts, .oc-quote, .oc-cancel, .oc-retry")) return;
    reset(G);
    var g = G = {id: row.getAttribute("data-id"), row: row, x: ev.clientX, y: ev.clientY, pid: ev.pointerId, dx: 0, swiping: false};
    g.timer = setTimeout(function(){
      if(G !== g || g.swiping) return;
      G = null; eatClick = Date.now();
      if(navigator.vibrate) try { navigator.vibrate(12); } catch(e){}
      openSheet(g.id, true);
    }, HOLD_MS);
  });
  box.addEventListener("pointermove", function(ev){
    var g = G; if(!g || ev.pointerId !== g.pid) return;
    var dx = ev.clientX - g.x, dy = ev.clientY - g.y;
    if(!g.swiping){
      if(Math.abs(dx) < 9 && Math.abs(dy) < 9) return;
      clearTimeout(g.timer);
      var m = findMsg(state.open, g.id);
      if(dx > 9 && Math.abs(dy) < dx * 0.7 && canReply(m)){ g.swiping = true; g.row.classList.add("oc-drag"); }
      else { G = null; return; }
    }
    g.dx = Math.max(0, Math.min(dx, 96));
    g.row.style.transform = "translateX(" + Math.round(g.dx * 0.75) + "px)";
    g.row.classList.toggle("oc-swipe-ready", g.dx >= SWIPE_AT);
  });
  function end(ev, cancel){
    var g = G; if(!g || (ev && ev.pointerId !== g.pid)) return;
    G = null; reset(g);
    if(g.swiping){ eatClick = Date.now(); if(!cancel && g.dx >= SWIPE_AT){ if(navigator.vibrate) try { navigator.vibrate(8); } catch(e){} startReply(g.id); } }
  }
  box.addEventListener("pointerup", function(ev){ end(ev, false); });
  box.addEventListener("pointercancel", function(ev){ end(ev, true); });
  box.addEventListener("scroll", function(){ if(G && !G.swiping){ reset(G); G = null; } }, {passive: true});
  // the click right after a hold/swipe shouldn't also open a photo or a link
  box.addEventListener("click", function(ev){ if(Date.now() - eatClick < 700){ ev.preventDefault(); ev.stopPropagation(); } }, true);
  box.addEventListener("contextmenu", function(ev){
    var row = rowOf(ev.target); if(!row) return;
    if(ev.target.closest("a") && !matchMedia("(hover:none)").matches) return;  // right-click a link on a computer = normal menu
    ev.preventDefault();
    if(G){ reset(G); G = null; }
    if(state.sheet !== row.getAttribute("data-id")){ eatClick = Date.now(); openSheet(row.getAttribute("data-id"), matchMedia("(hover:none)").matches); }
  });
  box.addEventListener("click", function(ev){
    var q = ev.target.closest ? ev.target.closest(".oc-quote[data-goto]") : null;
    if(q){ jumpTo(q.getAttribute("data-goto")); return; }
    var a = ev.target.closest ? ev.target.closest(".oc-acts [data-act]") : null;
    if(!a) return;
    var row = a.closest(".oc-row[data-id]"), id = row && row.getAttribute("data-id"), act = a.getAttribute("data-act");
    if(act === "more") openSheet(id); else sheetAct(act, id);
  });
}

// ---------- send later (clock button) ----------
function pad(n){ return (n < 10 ? "0" : "") + n; }
function toLocalInput(d){ return d.getFullYear() + "-" + pad(d.getMonth()+1) + "-" + pad(d.getDate()) + "T" + pad(d.getHours()) + ":" + pad(d.getMinutes()); }
function quickTimes(){
  var now = new Date(), out = [];
  var h1 = new Date(now.getTime() + 60*60000); h1.setSeconds(0,0);
  out.push({label:"In 1 hour", d:h1});
  var tonight = new Date(now); tonight.setHours(20,0,0,0);
  if(tonight - now > 30*60000) out.push({label:"Tonight 8 PM", d:tonight});
  var tm = new Date(now); tm.setDate(tm.getDate()+1); tm.setHours(9,0,0,0);
  out.push({label:"Tomorrow 9 AM", d:tm});
  return out;
}
// ---------- composer pop-ups: + menu, Send ▾ menu, text style, send later ----------
var POPS = ["ocPlusMenu", "ocSendMenu", "ocStylePop", "ocSchedPop"];
var POP_BTN = {ocPlusMenu:"ocPlus", ocSendMenu:"ocSendMore", ocStylePop:"ocPlus", ocSchedPop:"ocSendMore"};
function closePops(except){
  POPS.forEach(function(id){
    if(id === except) return;
    $(id).hidden = true;
    var b = $(POP_BTN[id]); if(b && POP_BTN[except] !== POP_BTN[id]) b.setAttribute("aria-expanded", "false");
  });
}
function openPop(id){ closePops(id); $(id).hidden = false; $(POP_BTN[id]).setAttribute("aria-expanded", "true"); }
function togglePop(id){ if($(id).hidden) openPop(id); else closePops(); }
function closeSched(){ closePops(); }
function setStyle(st){
  state.style = cleanStyle(st);
  var ta = $("ocText");
  ta.className = styleClass(state.style).trim();
  var chip = $("ocStyleChip");
  chip.hidden = !state.style;
  if(state.style) $("ocStyleTxt").textContent = [state.style.font ? FONTS[state.style.font] : "", state.style.color ? state.style.color.charAt(0).toUpperCase() + state.style.color.slice(1) : ""].filter(Boolean).join(" \u00b7 ");
  renderStylePop();
}
function renderStylePop(){
  var st = state.style || {}, h = '<div class="oc-pop-h">Font</div><div class="oc-chips">';
  h += '<button type="button" class="oc-chip' + (!st.font ? ' on' : '') + '" data-font="">Default</button>';
  Object.keys(FONTS).forEach(function(f){ h += '<button type="button" class="oc-chip oc-f-' + f + (st.font === f ? ' on' : '') + '" data-font="' + f + '">' + FONTS[f] + '</button>'; });
  h += '</div><div class="oc-pop-h">Color</div><div class="oc-swatches">';
  h += '<button type="button" class="oc-sw oc-sw-none' + (!st.color ? ' on' : '') + '" data-color="" aria-label="Default color"></button>';
  Object.keys(COLORS).forEach(function(c){ h += '<button type="button" class="oc-sw' + (st.color === c ? ' on' : '') + '" data-color="' + c + '" style="background:' + COLORS[c] + '" aria-label="' + c + '"></button>'; });
  h += '</div><div class="oc-pop-foot"><button type="button" class="oc-link" data-reset="1">Reset</button><button type="button" class="oc-btn oc-btn-sm" data-done="1">Done</button></div>';
  $("ocStyleBody").innerHTML = h;
}
// photo: shrink to <= 1280px, JPEG, aim for ~200 KB
function shrinkImage(file){
  return new Promise(function(resolve, reject){
    var url = URL.createObjectURL(file), img = new Image();
    img.onload = function(){
      var max = 1280, w = img.naturalWidth, h = img.naturalHeight, s = Math.min(1, max / Math.max(w, h));
      var c = document.createElement("canvas"); c.width = Math.max(1, Math.round(w*s)); c.height = Math.max(1, Math.round(h*s));
      var g = c.getContext("2d"); g.fillStyle = "#000"; g.fillRect(0, 0, c.width, c.height); g.drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      var q = 0.82, data = c.toDataURL("image/jpeg", q);
      while(data.length * 0.75 > 210000 && q > 0.4){ q -= 0.08; data = c.toDataURL("image/jpeg", q); }
      if(data.length * 0.75 > 210000){ // still big: scale down more
        var c2 = document.createElement("canvas"); c2.width = Math.round(c.width*0.7); c2.height = Math.round(c.height*0.7);
        c2.getContext("2d").drawImage(c, 0, 0, c2.width, c2.height); data = c2.toDataURL("image/jpeg", 0.7);
      }
      resolve({url: data, b64: data.split(",")[1]});
    };
    img.onerror = function(){ URL.revokeObjectURL(url); reject(new Error("That file isn't a photo this browser can open.")); };
    img.src = url;
  });
}
function setPhoto(ph){
  state.photo = ph;
  $("ocPhotoChip").hidden = !ph;
  if(ph) $("ocPhotoThumb").src = ph.url; else $("ocPhotoThumb").removeAttribute("src");
}
function openSched(){
  var pop = $("ocSchedPop"), inp = $("ocSchedInput");
  var min = new Date(Date.now() + 2*60000);
  inp.min = toLocalInput(min);
  inp.value = toLocalInput(state.schedAt || new Date(Date.now() + 60*60000));
  $("ocSchedErr").textContent = "";
  var q = "";
  quickTimes().forEach(function(x, i){ q += '<button type="button" class="oc-chip" data-i="' + i + '">' + esc(x.label) + '</button>'; });
  $("ocSchedQuick").innerHTML = q;
  openPop("ocSchedPop");
}
function setSched(d){
  state.schedAt = d;
  var on = !!d;
  $("ocSchedChip").hidden = !on;
  if(on) $("ocSchedTxt").textContent = "Sends " + fmtWhen(d);
  $("ocSendMore").classList.toggle("on", on);
  $("ocSend").textContent = on ? "Schedule" : "Send";
  $("ocSend").setAttribute("aria-label", on ? "Schedule message" : "Send");
  $("ocText").placeholder = on ? "Message to send later" : "Message";
}
function pickSched(d){
  if(!d || isNaN(d)){ $("ocSchedErr").textContent = "Pick a date and time."; return false; }
  if(d.getTime() < Date.now() + 60000){ $("ocSchedErr").textContent = "Pick a time at least a minute from now."; return false; }
  setSched(d); closeSched(); $("ocText").focus(); return true;
}
// ---------- voice to text (mic) ----------
// Uses the browser's own speech recognition (Chrome, Edge, Safari on iPhone 14.5+).
// The text is cleaned up (SSVoice.clean: capitals, periods, no "um", Amos's mishear fixes from
// the dev page) and put in the box so Amos can check it. It is NEVER sent automatically.
var V = {rec: null, on: false, base: "", finals: "", interim: "", raw: "", cleaned: "", wantStop: false};
function SR(){ return window.SpeechRecognition || window.webkitSpeechRecognition || null; }
function voiceBar(msg, undo){
  var bar = $("ocVoiceBar"); bar.hidden = false;
  bar.classList.toggle("live", V.on);
  $("ocVoiceTxt").textContent = msg;
  $("ocVoiceUndo").hidden = !undo;
}
function hideVoiceBar(){ $("ocVoiceBar").hidden = true; $("ocVoiceBar").classList.remove("live"); }
function growBox(){ var ta = $("ocText"); ta.style.height = "auto"; ta.style.height = Math.min(ta.scrollHeight, 140) + "px"; }
function joinText(a, b){ a = a.replace(/\s+$/, ""); return a ? (b ? a + " " + b : a) : b; }
function voiceFinish(){
  var heard = (V.finals + " " + V.interim).replace(/\s+/g, " ").trim();
  V.interim = "";
  if(!heard){ voiceBar("Didn't catch anything. Tap the mic and try again.", false); return; }
  var dict = window.SSVoice ? SSVoice.loadDict() : "";
  V.raw = heard;
  V.cleaned = window.SSVoice ? SSVoice.clean(heard, dict) : heard;
  var ta = $("ocText"), u = $("ocVoiceUndo");
  u.textContent = "Show what it heard"; u.removeAttribute("data-showing");
  ta.value = joinText(V.base, V.cleaned); growBox();
  $("ocVoiceNote").checked = true;
  voiceBar("Cleaned up. Check it, then tap Send.", V.raw !== V.cleaned);
  ta.focus();
}
function voiceStop(silent){
  if(!V.on) return;
  V.wantStop = true;
  try { V.rec.stop(); } catch(e){}
  if(silent){ V.on = false; setMicUI(); }
}
function setMicUI(){ var m = $("ocMic"); m.classList.toggle("on", V.on); m.setAttribute("aria-pressed", V.on ? "true" : "false"); m.setAttribute("aria-label", V.on ? "Stop listening" : "Talk to type"); }
function voiceStart(){
  var C = SR();
  if(!C){ voiceBar("Voice typing doesn't work in this browser. Try Safari on your iPhone or Chrome on a computer.", false); return; }
  var r = new C();
  r.lang = "en-US"; r.continuous = true; r.interimResults = true; r.maxAlternatives = 1;
  V.rec = r; V.on = true; V.wantStop = false; V.finals = ""; V.interim = ""; V.base = $("ocText").value;
  r.onresult = function(ev){
    var interim = "";
    for(var i = ev.resultIndex; i < ev.results.length; i++){
      var tx = ev.results[i][0].transcript;
      if(ev.results[i].isFinal) V.finals += " " + tx; else interim += tx;
    }
    V.interim = interim;
    var live = (V.finals + " " + V.interim).replace(/\s+/g, " ").trim();
    voiceBar(live || "Listening\u2026", false);
  };
  r.onerror = function(ev){
    var e = ev && ev.error;
    V.on = false; setMicUI();
    if(e === "not-allowed" || e === "service-not-allowed") voiceBar("The mic is blocked. Allow the microphone for this site (iPhone: Settings > Safari > Microphone), then try again.", false);
    else if(e === "no-speech") voiceBar("Didn't hear anything. Tap the mic and talk.", false);
    else if(e === "network") voiceBar("Voice typing needs the internet. Check your connection.", false);
    else if(e !== "aborted") voiceBar("Voice typing stopped (" + String(e || "unknown") + "). Tap the mic to try again.", false);
  };
  r.onend = function(){
    var was = V.on;
    V.on = false; setMicUI();
    if(was || V.wantStop) voiceFinish();
  };
  try { r.start(); } catch(e){ V.on = false; voiceBar("Couldn't start the mic. Try again.", false); }
  setMicUI();
  if(V.on) voiceBar("Listening\u2026 tap the mic again when you're done.", false);
}

// ---------- owner only ----------
// The real lock is the GitHub key: the chats live in the PRIVATE repo, so nothing loads without
// Amos's own key (checked against GitHub before anything is shown). The page isn't linked for guests.
// Dev mode (the owner viewing the site as a dev, switched in the account menu): the chats are locked exactly like
// they are for any dev. Switching back to Owner mode opens them again (this page reloads when the mode changes).
function devView(){
  try {
    var sess = JSON.parse(localStorage.getItem("ttvm_session") || "null"), mode = JSON.parse(localStorage.getItem("ttvm_mode") || "null");
    return !!(sess && sess.cred && mode === "dev");
  } catch(e){ return false; }
}
function isOwner(){ return !devView(); }
window.addEventListener("storage", function(e){ if(e.key === "ttvm_mode" || e.key === "ttvm_session") location.reload(); });

// ---------- login ----------
function showLogin(msg){
  $("ocApp").hidden = true; $("ocLogin").hidden = false;
  $("ocLoginErr").textContent = msg || "";
  var tok = $("ocToken"); tok.value = "";
  setTimeout(function(){ tok.focus(); }, 50);
}
function stopTimers(){ state.timers.forEach(clearInterval); state.timers = []; }
function logout(msg){
  stopTimers();
  localStorage.removeItem(TOKEN_KEY);
  state.token = null; state.data = {}; state.pending = {}; state.list = null; buildThreads();
  setCtx(null); closeSheet(); state.overlay = {};
  Store.setToken(null);
  $("ocMsgs").innerHTML = ""; $("ocSide").innerHTML = "";
  showLogin(msg);
}
function tick(){
  renderStatus();
  // a scheduled message just became due (or a new one appeared): redraw
  var sig = schedSig();
  if(sig !== state.sig){ state.sig = sig; renderThread(); renderSide(); }
}
function startApp(){
  $("ocLogin").hidden = true; $("ocApp").hidden = false;
  Store.setToken(state.token);
  buildThreads();
  var hash = (location.hash || "").slice(1);
  openThread(threadByKey(hash) ? hash : state.threads[0].key);
  refreshList(true).then(function(){
    if(hash && hash !== state.open && threadByKey(hash)) openThread(hash);
  });
  Store.listRequests().then(function(r){ state.requests = r || []; renderSide(); }, function(){});
  state.threads.forEach(function(t){ if(t.key !== state.open) refresh(t, true); });
  stopTimers();
  state.timers.push(setInterval(function(){
    if(document.hidden) return;
    var t = threadByKey(state.open); if(t) refresh(t, true);
  }, POLL_OPEN_MS));
  state.timers.push(setInterval(function(){
    if(document.hidden) return;
    refreshList(true);
    state.threads.forEach(function(t){ if(t.key !== state.open) refresh(t, true); });
  }, POLL_ALL_MS));
  state.timers.push(setInterval(tick, 1000));
}
function tryLogin(tok){
  tok = String(tok || "").trim();
  if(!tok){ $("ocLoginErr").textContent = "Paste your key first."; return; }
  if(/\s/.test(tok)){ $("ocLoginErr").textContent = "That doesn't look like a GitHub key (it has spaces in it)."; return; }
  state.token = tok; Store.setToken(tok);
  var btn = $("ocLoginBtn"); btn.disabled = true; btn.textContent = "Checking\u2026";
  Store.checkAccess().then(function(){
    localStorage.setItem(TOKEN_KEY, tok);
    startApp();
  }, function(err){
    state.token = null; Store.setToken(null);
    $("ocLoginErr").textContent = friendly(err);
  }).then(function(){ btn.disabled = false; btn.textContent = "Open chats"; });
}

// ---------- events ----------
document.addEventListener("DOMContentLoaded", function(){
  $("ocLoginForm").addEventListener("submit", function(ev){ ev.preventDefault(); tryLogin($("ocToken").value); });
  $("ocLogout").addEventListener("click", function(){
    if(confirm("Log out and forget the key on this device?")) logout("Logged out. The key was removed from this browser.");
  });
  $("ocRefresh").addEventListener("click", function(){ var t = threadByKey(state.open); if(t) refresh(t); refreshList(true); });
  $("ocPin").addEventListener("click", function(){ var t = threadByKey(state.open); if(t) togglePin(t); });
  $("ocSide").addEventListener("click", function(ev){
    var tg = ev.target;
    var seg = tg.closest ? tg.closest(".oc-seg") : null;
    if(seg){ state.sec = seg.getAttribute("data-sec"); renderSide(); return; }
    if(tg.closest && tg.closest("#ocNewBtn")){ state.newOpen = true; renderSide(); $("ocNewTitle").focus(); return; }
    if(tg.closest && tg.closest("#ocNewCancel")){ state.newOpen = false; $("ocNewTitle").value = ""; renderSide(); return; }
    var b = tg.closest ? tg.closest("button.oc-tab") : null;
    if(b) openThread(b.getAttribute("data-k"), true);
  });
  $("ocSide").addEventListener("submit", function(ev){
    if(ev.target.id !== "ocNewForm") return;
    ev.preventDefault();
    if(state.creating) return;
    var title = $("ocNewTitle").value.replace(/\s+/g, " ").trim().slice(0, 60);
    if(!title){ $("ocNewTitle").focus(); flash("Give the chat a name first.", true); return; }
    state.creating = true; renderSide();
    Store.createThread("team", title).then(function(r){
      state.creating = false; state.newOpen = false;
      if($("ocNewTitle")) $("ocNewTitle").value = "";
      setList(r.threads);
      state.data[r.id] = {doc:{messages:[]}, loadedAt: Date.now(), missing: false};
      openThread(r.id, true);
      flash("Created \u201c" + title + "\u201d");
    }, function(err){
      state.creating = false; renderSide();
      flash("Couldn't create the chat. " + friendly(err), true);
    });
  });
  var ta = $("ocText");
  function grow(){ ta.style.height = "auto"; ta.style.height = Math.min(ta.scrollHeight, 140) + "px"; }
  ta.addEventListener("input", grow);
  ta.addEventListener("keydown", function(ev){
    if(ev.key === "Enter" && !ev.shiftKey && !ev.isComposing && window.matchMedia("(hover:hover)").matches){
      ev.preventDefault(); $("ocCompose").requestSubmit ? $("ocCompose").requestSubmit() : $("ocSend").click();
    }
  });
  $("ocCompose").addEventListener("submit", function(ev){
    ev.preventDefault();
    var text = ta.value.replace(/\s+$/,"");
    var t = threadByKey(state.open); if(!t) return;
    if(state.ctx && state.ctx.mode === "edit"){
      var ec = state.ctx, orig = findMsg(t.key, ec.id);
      if(!text.trim() && !(orig && orig.image)){ flash("A message can't be empty. To remove it, hold it and tap Delete.", true); return; }
      if(!text.trim()) text = "";
      setCtx(null);   // puts back whatever you were typing before
      growBox();
      if(orig && orig.text !== text) editMessage(t, ec.id, text);
      return;
    }
    if(!text.trim() && !state.photo) return;
    if(!text.trim()) text = "";
    var sendAt = null;
    if(state.schedAt){
      if(state.schedAt.getTime() < Date.now() + 30000){ openSched(); $("ocSchedErr").textContent = "That time already passed. Pick a new one."; return; }
      sendAt = state.schedAt.toISOString();
    }
    var voice = $("ocVoiceNote").checked;
    voiceStop(true);
    ta.value = ""; grow(); ta.focus();
    $("ocVoiceNote").checked = false; hideVoiceBar();
    var photo = state.photo;
    var replyTo = (state.ctx && state.ctx.mode === "reply" && state.ctx.key === t.key) ? state.ctx.id : null;
    setSched(null); closePops(); setPhoto(null); setCtx(null);
    sendMessage(t, text, {voice: voice, sendAt: sendAt, style: state.style, photo: photo, replyTo: replyTo});
  });
  // + menu (voice, photo, text style, schedule) and Send ▾ (send now / schedule send)
  $("ocPlus").addEventListener("click", function(ev){ ev.stopPropagation(); togglePop("ocPlusMenu"); });
  $("ocSendMore").addEventListener("click", function(ev){ ev.stopPropagation(); togglePop("ocSendMenu"); });
  $("ocPlusMenu").addEventListener("click", function(ev){
    var b = ev.target.closest ? ev.target.closest("[data-act]") : null; if(!b) return;
    var act = b.getAttribute("data-act");
    closePops();
    if(act === "voice"){ if(V.on) voiceStop(false); else voiceStart(); }
    else if(act === "photo") $("ocPhotoIn").click();
    else if(act === "style"){ renderStylePop(); openPop("ocStylePop"); }
    else if(act === "sched") openSched();
  });
  $("ocSendMenu").addEventListener("click", function(ev){
    var b = ev.target.closest ? ev.target.closest("[data-act]") : null; if(!b) return;
    var act = b.getAttribute("data-act");
    closePops();
    if(act === "now"){ setSched(null); $("ocCompose").requestSubmit ? $("ocCompose").requestSubmit() : $("ocSend").click(); }
    else openSched();
  });
  $("ocStylePop").addEventListener("click", function(ev){
    var b = ev.target.closest ? ev.target.closest("button") : null; if(!b) return;
    var st = {font: (state.style || {}).font, color: (state.style || {}).color};
    if(b.hasAttribute("data-font")) st.font = b.getAttribute("data-font") || null;
    else if(b.hasAttribute("data-color")) st.color = b.getAttribute("data-color") || null;
    else if(b.hasAttribute("data-reset")) st = null;
    else if(b.hasAttribute("data-done") || b.id === "ocStyleClose"){ closePops(); $("ocText").focus(); return; }
    setStyle(st);
  });
  $("ocStyleClear").addEventListener("click", function(){ setStyle(null); });
  $("ocPhotoIn").addEventListener("change", function(){
    var f = this.files && this.files[0]; this.value = "";
    if(!f) return;
    shrinkImage(f).then(function(ph){ setPhoto(ph); $("ocText").focus(); }, function(err){ flash(err.message, true); });
  });
  $("ocPhotoClear").addEventListener("click", function(){ setPhoto(null); });
  document.addEventListener("click", function(ev){
    if(!document.documentElement.contains(ev.target)) return;  // the clicked thing was just redrawn
    if(ev.target.closest && ev.target.closest(".oc-pop, #ocPlus, #ocSendMore")) return;
    closePops();
  });
  $("ocMsgs").addEventListener("click", function(ev){
    var im = ev.target.closest ? ev.target.closest(".oc-img[data-src]") : null;
    if(im) openLightbox(im.getAttribute("data-src"));
  });
  $("ocLightbox").addEventListener("click", closeLightbox);
  $("ocSchedClose").addEventListener("click", closeSched);
  $("ocSchedSet").addEventListener("click", function(){ var v = $("ocSchedInput").value; pickSched(v ? new Date(v) : null); });
  $("ocSchedQuick").addEventListener("click", function(ev){
    var b = ev.target.closest ? ev.target.closest(".oc-chip") : null; if(!b) return;
    var x = quickTimes()[+b.getAttribute("data-i")]; if(x) pickSched(x.d);
  });
  $("ocSchedClear").addEventListener("click", function(){ setSched(null); });
  document.addEventListener("keydown", function(ev){
    if(ev.key !== "Escape") return;
    if(!$("ocSheet").hidden){ closeSheet(); return; }
    if(!$("ocLightbox").hidden){ closeLightbox(); return; }
    var popOpen = Array.prototype.some.call(document.querySelectorAll(".oc-pop"), function(p){ return !p.hidden; });
    if(popOpen){ closePops(); return; }
    if(state.ctx){ setCtx(null); return; }
  });
  wireGestures($("ocMsgs"));
  $("ocCtxClose").addEventListener("click", function(){ setCtx(null); focusText(); });
  $("ocCtxBar").addEventListener("click", function(ev){
    if(ev.target.closest && ev.target.closest("#ocCtxClose")) return;
    if(state.ctx) jumpTo(state.ctx.id);
  });
  $("ocSheet").addEventListener("click", function(ev){
    if(Date.now() - (state.sheetAt || 0) < 450) return;   // the finger lifting after a hold isn't a tap on the menu
    var b = ev.target.closest ? ev.target.closest("[data-act]") : null;
    if(!b){ if(ev.target === this) closeSheet(); return; }
    var act = b.getAttribute("data-act");
    if(act === "close") closeSheet(); else sheetAct(act, state.sheet);
  });

  $("ocMsgs").addEventListener("click", function(ev){
    var t = threadByKey(state.open); if(!t) return;
    var c = ev.target.closest ? ev.target.closest(".oc-cancel") : null;
    if(c){
      if(confirm("Cancel this scheduled message? It won't be sent.")) cancelScheduled(t, c.getAttribute("data-id"));
      return;
    }
    var b = ev.target.closest ? ev.target.closest(".oc-retry") : null;
    if(!b) return;
    var id = b.getAttribute("data-id");
    var p = (state.pending[t.key] || []).filter(function(m){ return m.id === id; })[0];
    if(!p) return;
    removePending(t.key, id);
    var at = p.sendAt && isScheduled(p) ? p.sendAt : null;
    sendMessage(t, p.text, {voice: p.voice, sendAt: at, style: p.style, image: p.image, photo: p.photo, replyTo: p.replyTo});
  });
  window.addEventListener("hashchange", function(){
    var k = (location.hash || "").slice(1);
    if(state.token && threadByKey(k) && k !== state.open) openThread(k);
  });
  document.addEventListener("visibilitychange", function(){
    if(!document.hidden && state.token){ var t = threadByKey(state.open); if(t) refresh(t, true); }
  });

  $("ocMic").addEventListener("click", function(){ if(V.on) voiceStop(false); else voiceStart(); });
  $("ocVoiceUndo").addEventListener("click", function(){
    var ta = $("ocText");
    if(this.getAttribute("data-showing") === "raw"){ ta.value = joinText(V.base, V.cleaned); this.textContent = "Show what it heard"; this.removeAttribute("data-showing"); }
    else { ta.value = joinText(V.base, V.raw); this.textContent = "Use the cleaned-up version"; this.setAttribute("data-showing", "raw"); }
    growBox();
  });
  if(!SR()) $("ocMic").classList.add("nosupport");

  // chats are owner only: the key screen below is the gate
  if(!isOwner()){ $("ocNotOwner").hidden = false; $("ocLogin").hidden = true; $("ocApp").hidden = true; return; }
  buildThreads();
  state.token = localStorage.getItem(TOKEN_KEY);
  if(state.token) startApp(); else showLogin("");
});
})();
