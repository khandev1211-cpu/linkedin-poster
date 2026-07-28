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
3. **Image**: paste a free Hugging Face access token
   - Create one at huggingface.co/settings/tokens — "read" scope is enough,
     no payment info required
4. Click "Save Settings"
5. Click "Generate Post" — wait a few seconds (first image call may take
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
- **GitHub anonymous rate limit**: 60 requests/hour per IP, unauthenticated.
  Fine for occasional manual use; if you hit it, wait an hour or add a
  GitHub personal access token to `github.js` (`Authorization: token ...`
  header) for a much higher limit.
- **Hugging Face cold starts**: if the image model hasn't been used
  recently, the first call can return a 503 while it loads. The extension
  retries up to 4 times with a short wait automatically — if it still
  fails, just click Regenerate a few seconds later.
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
