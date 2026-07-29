// image-gen.js — free image generation via Hugging Face's current
// "Inference Providers" router (the old api-inference.huggingface.co
// serverless endpoint is retired and no longer resolves). Requires a
// free HF access token with "Inference Providers" permission
// (create one at https://huggingface.co/settings/tokens/new?ownUserPermissions=inference.serverless.write&tokenType=fineGrained).

const HF_MODEL = "black-forest-labs/FLUX.1-schnell";
// Providers known (per HF's own docs) to serve this model. Tried in order;
// if one responds "model not supported by provider" we fall through to
// the next, since HF's provider catalog shifts over time.
const HF_PROVIDER_CANDIDATES = ["fal-ai", "together", "replicate", "nscale"];

function buildImagePrompt(postText, githubContext) {
  const khanName = githubContext?.khan?.name || "Khan programming language";
  return (
    `Minimalist professional tech illustration representing software development progress on ` +
    `"${khanName}", a custom programming language, and data science / machine learning work. ` +
    `Clean flat design, code symbols, abstract data charts, blue and dark navy color palette, ` +
    `no text, no words, no logos, LinkedIn banner style, high quality, wide aspect ratio`
  );
}

// The router can take a few seconds to route/cold-start a provider —
// retry a handful of times on 503 per HF's own guidance. If a provider
// doesn't actually serve this model (400 "not supported"), fall through
// to the next candidate rather than failing outright.
async function generateImage(postText, githubContext, hfToken) {
  if (!hfToken) {
    throw new Error("No Hugging Face token set. Open Settings and add a free HF access token.");
  }

  const prompt = buildImagePrompt(postText, githubContext);
  const errors = [];

  for (const provider of HF_PROVIDER_CANDIDATES) {
    try {
      return await tryProvider(provider, prompt, hfToken);
    } catch (err) {
      errors.push(`${provider}: ${err.message}`);
      // Only fall through on "not supported by this provider" style errors;
      // anything else (auth, network) is worth surfacing immediately.
      if (!/not supported|404/i.test(err.message)) {
        throw new Error(`Hugging Face image error via ${provider}: ${err.message}`);
      }
    }
  }

  throw new Error(`No configured provider could serve ${HF_MODEL}. Tried: ${errors.join(" | ")}`);
}

async function tryProvider(provider, prompt, hfToken) {
  const url = `https://router.huggingface.co/${provider}/models/${HF_MODEL}`;
  const maxAttempts = 4;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    let res;
    try {
      res = await fetch(url, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${hfToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ inputs: prompt })
      });
    } catch (networkErr) {
      throw new Error(
        `Network error reaching Hugging Face (${url}): ${networkErr.message}. ` +
        `Check your internet connection and that this extension has permission for router.huggingface.co.`
      );
    }

    if (res.status === 503 && attempt < maxAttempts) {
      await new Promise(r => setTimeout(r, 4000));
      continue;
    }

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`${res.status} ${body.slice(0, 300)}`);
    }

    const blob = await res.blob();
    return { blob, promptUsed: prompt, sourceModel: HF_MODEL, provider };
  }

  throw new Error("model did not become ready in time (503 retries exhausted)");
}

if (typeof self !== "undefined") {
  self.ImageGenModule = { generateImage, buildImagePrompt };
}
