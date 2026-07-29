# GitHub → LinkedIn Poster

Chrome extension. Click "Generate Post" → it pulls your GitHub activity
(Khan lang repo + data-science-tagged repos), writes a professional
LinkedIn post about it, generates a matching image (free, no API key,
via Pollinations.ai), and fills LinkedIn's post composer for you to
review before posting.

## Load it in Chrome

1. Go to `chrome://extensions`
2. Turn on "Developer mode" (top right)
3. Click "Load unpacked"
4. Select this folder
5. Pin the extension icon for easy access

## First use

1. Click the extension icon → gear icon (⚙) to open Settings
2. **Post text**: pick a provider (Groq recommended) and paste its API key
   - Groq: console.groq.com → API Keys
   - Mistral: console.mistral.ai → API Keys
   - Cerebras: cloud.cerebras.ai → API Keys
3. **Image**: paste a free Hugging Face access token with **"Inference
   Providers"** permission
   - Create one directly at:
     https://huggingface.co/settings/tokens/new?ownUserPermissions=inference.serverless.write&tokenType=fineGrained
   - (A plain default token without this permission will fail with a 401/403)
   - No payment info required — HF's router has a free tier
4. **GitHub (optional but recommended)**: paste a Personal Access Token
   - GitHub → Settings → Developer settings → Personal access tokens
   - No special scopes needed for public repo data (a plain fine-grained
     token with no permissions, or a classic token with no scopes checked,
     both work for public data)
   - Without this, GitHub allows only 60 requests/hour per IP address,
     shared across anything else on your network — easy to hit by accident,
     and the extension will show "Failed to fetch" / rate limit errors.
     With a token: 5,000 requests/hour.
5. Click "Save Settings"
6. Click "Generate Post" — wait a few seconds (first image call may take
   10-30s if the model needs to "wake up" on Hugging Face's side; the
   extension retries automatically)
5. Review/edit the text and image in the preview
6. Click "Open on LinkedIn & Fill" — it opens/switches to a LinkedIn tab
   and fills the composer automatically
7. By default the final "Post" click is **manual** — you review it on
   LinkedIn and click Post yourself. Check "Auto-click final Post button"
   in the popup if you want it fully hands-off.

## How it decides what to write about

- **Khan repo**: pulls the repo description, language, and last ~8 commit
  messages from `github.com/khandev1211-cpu/Khan`
- **Data science repos**: scans all your public repos for names/descriptions
  matching data-science-ish keywords (data, ml, model, pandas, xgboost, etc.)

Both feed into a single AI prompt that writes one post covering both.

## Known risks / things that can break

- **LinkedIn DOM changes**: `content-script.js` uses several fallback
  selectors (aria-label + text-content matching) instead of one brittle
  CSS class, since LinkedIn's class names are obfuscated and change often.
  If LinkedIn redesigns the composer, the selectors in `content-script.js`
  (`findStartPostButton`, `findComposerEditor`, `findAddMediaButton`,
  `findPostButton`) are the first place to check and update.
- **GitHub rate limit**: 60 requests/hour unauthenticated, 5,000/hour with
  a Personal Access Token pasted into Settings (recommended — see setup
  above). Hitting the unauthenticated limit can surface as a generic
  "Failed to fetch" in the popup rather than a clear rate-limit message.
- **Hugging Face architecture**: HF retired their old
  `api-inference.huggingface.co` serverless endpoint. Image generation now
  goes through `router.huggingface.co`, which routes to a partner provider
  (this extension uses "together" + `black-forest-labs/FLUX.1-schnell`).
  Your token needs the "Inference Providers" permission specifically —
  see the link in setup step 3 above.
- **Hugging Face cold starts**: the router can occasionally return a 503
  while a provider spins up. The extension retries up to 4 times
  automatically — if it still fails, click Regenerate a few seconds later.
- **Pollinations text API is no longer usable free**: they added a Pollen
  credit/billing system (402 errors on the free tier), which is why this
  extension uses Groq/Mistral/Cerebras for text instead.
- **You must be logged into LinkedIn** in the browser when you click
  "Open on LinkedIn & Fill" — there is no headless/background posting;
  you decided against needing Chrome to be closed, so this is expected
  behavior, not a bug.

## Files

| File | Role |
|---|---|
| `manifest.json` | MV3 config, permissions, host permissions |
| `popup.html/css/js` | UI: settings, generate, preview, post |
| `background.js` | Service worker: orchestrates GitHub → AI → image, opens LinkedIn tab |
| `content-script.js` | Runs on linkedin.com: fills composer, attaches image, posts |
| `github.js` | Fetches Khan repo + data science repos from GitHub API |
| `ai-providers.js` | Builds the prompt, calls Groq/Cerebras/Mistral/Pollinations |
| `image-gen.js` | Builds an image prompt and fetches it from Pollinations |
