# Owner chats: how to log in (one time, about 3 minutes)

The Chats page only opens with your own GitHub key. The key stays on your phone/computer only. Nobody else can see the chats, even if they find the page.

## 1. Make the key (on github.com)

You can do this on your phone in the browser (Safari/Chrome). The GitHub app can't do it.

1. Go to **github.com** and log in.
2. Tap your **profile picture** (top right) → **Settings**.
3. Scroll all the way down → **Developer settings** (last thing on the left/bottom).
4. **Personal access tokens** → **Fine-grained tokens** → **Generate new token**.
   - Shortcut link: https://github.com/settings/personal-access-tokens/new
5. Fill it in:
   - **Token name:** `skibidi chats`
   - **Expiration:** pick **1 year** (or "No expiration" if it lets you).
   - **Repository access:** tap **Only select repositories** → pick **skibidi-strike**.
     (Just that one. Not the site one.)
   - **Permissions** → **Repository permissions** → find **Contents** → set it to **Read and write**.
     (It also turns on "Metadata: Read-only" by itself. That's normal. Leave everything else alone.)
6. Tap **Generate token** at the bottom (and confirm).
7. **Copy** the long code that starts with `github_pat_`. GitHub only shows it once.

## 2. Open the chats

1. Go to the site → Credits → **Owner / dev mode** → type your studio code.
2. Tap **Chats** (it shows up next to "Owner signed in", and in the dev panel).
   You can also tap **Titan TV Man** or **UTC Studios** in the credits to jump straight to your chat with them.
3. Paste the `github_pat_...` code in the box → **Open chats**. Done. It remembers you on that device.

On another device (like your PC)? Paste the same code there too, or make a second key.

## Good to know

- **Never share the key** or paste it anywhere else. Not in Discord, not in a text, not to us.
- **Log out** (top right of the Chats page) removes the key from that device.
- Lost your phone or think someone saw the key? github.com → Settings → Developer settings → Fine-grained tokens → tap it → **Delete**. Then make a new one.
- Key expired? The page will say so. Just make a new one the same way.
- Your messages save in the private repo's `chat` folder. Titan TV Man and UTC Studios answer there, so replies can take a little bit, not instant like texting.
