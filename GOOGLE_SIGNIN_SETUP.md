# Turn on "Sign in with Google" (one time, about 5 minutes)

This makes the top-left of the site show each person's Google picture and name, and lets them edit their profile. It's free and needs no extra service: just a Google "Client ID".

You can do this on your phone (Chrome or Safari), but a computer is easier.

## 1. Make a Google Cloud project

1. Go to **console.cloud.google.com** and sign in with your Google account (the one you want as owner).
2. If it asks, agree to the terms.
3. At the top, tap the **project picker** (it may say "Select a project") → **New project**.
4. Name it `TTVM Studios` → **Create**. Wait a few seconds, then make sure it's selected at the top.

## 2. Set up the sign-in screen

1. Open the menu (☰) → **APIs & Services** → **OAuth consent screen**.
   (It may be called **Google Auth Platform** → **Branding**. Same thing.)
2. Tap **Get started** (or **Configure consent screen**).
3. **App name:** `TTVM Studios`. **User support email:** your email.
4. **Audience / User type:** pick **External**.
5. **Contact email:** your email. Agree and tap **Create** / **Save**.
6. If there's an **Audience** page with a **Publish app** button, tap it so anyone can sign in (not just test users).

## 3. Make the Client ID

1. Menu (☰) → **APIs & Services** → **Credentials** (or **Google Auth Platform** → **Clients**).
2. **Create credentials** → **OAuth client ID** (or **Create client**).
3. **Application type:** **Web application**. **Name:** `TTVM site`.
4. Under **Authorized JavaScript origins** tap **Add URI** and type exactly:
   `https://idk1234-c.github.io`
   (no slash at the end, nothing after it)
5. Leave "Authorized redirect URIs" empty. Tap **Create**.
6. Copy the **Client ID**. It looks like `1234567890-abc123.apps.googleusercontent.com`.
   (Ignore the "client secret". The site doesn't use it. Don't send it to anyone.)

## 4. Send it to Titan

Text the Client ID to Titan (it's not a password, it's fine to share). Titan pastes it into `js/auth-config.js`, switches `AUTH_READY` to `true`, and pushes. That's it.

## After it's on

- **You're already set as owner** (both of your Google accounts). Sign in from the top-left → you'll see **Owner** under your name.
- **Owner panel:** top-left → **Owner panel**. To save warnings, bans and roles from there, the panel uses the same GitHub key as the Chats page (paste it once on the Chats page on that device). No key? The panel gives you a "copy and send to Titan" box instead.
- **Owner mode / Dev mode:** switch in the top-left menu.
- **Promoting someone to moderator or owner** asks you to confirm you checked with Titan and UTC first.

## Good to know (honest version)

- The site is a static site, so the role and ban checks run in each visitor's browser. That stops normal people, but someone who knows coding could get around it **on their own screen**. They can never change anyone's role, warnings or bans, because those are saved in the repo and only people with GitHub access can change them.
- Normal visitors' profile edits save on their own device for now.
- "Last seen" in the panel shows staff (people with a GitHub key) and anyone who signed in on the same device. Seeing every visitor's activity would need a server.
