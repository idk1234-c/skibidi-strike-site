# Skibidi Strike — website

This folder holds the full source of the official site: https://idk1234-c.github.io/skibidi-strike-site/

- `index.html` — the page: hero + PLAY, roadmap, what's next, cast, videos, music policy, credits, community, and the hidden studio spot (code-gated)
- `style.css` — the dark theme
- `script.js` — roadmap data + rendering, dev spot, music track list

Edit here. The live site builds from the public repo `idk1234-c/skibidi-strike-site`; changes in this folder get mirrored there.

Owner / dev area (added Oct 31, 2026 by Titan TV Man):
- `ss-core.js` — owner vs dev sign-in, the two codes, and applies every dev-page customization to the home page (localStorage `ss_site`). Loaded before script.js.
- `dev.html` + `dev.js` + `dev.css` — the DEV MODE page (customize text, buttons, sections, colors, PLAY "not done yet", banner, links, roadmap, credits, codes, export). Owner mode also gets the Chats + voice-to-text fixes.
- `voice-clean.js` — cleans up dictated text for the mic in the chats (also runs in node for tests).
- `owner-chat.html` / `owner-chat.js` / `owner-chat.css` — owner-only chats (need Amos's GitHub key). The `chat/` folder itself stays in the private repo only.
- Codes are checked in the browser only (not real security); nothing private depends on them.

Play page (added Oct 31, 2026 by Titan TV Man):
- `play/index.html` — the PLAY page: loads the Unity web build of the game with a themed loading bar, fullscreen button and back link. Every PLAY button on the home page goes here (`play/`).
- `play/Build/` (WebBuild.data, .wasm, .framework.js, .loader.js, about 58 MB) is **NOT in this folder**. It is pushed straight to the public repo `skibidi-strike-site` because the files are too big for the normal mirror. **When mirroring `/website`, never delete or overwrite `play/Build/` on the public repo.** A new web build replaces those four files there directly (from `WebBuild/Build/` in this repo).
