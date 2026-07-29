// image-gen.js — free image generation via Hugging Face's current
// "Inference Providers" router (the old api-inference.huggingface.co
// serverless endpoint is retired and no longer resolves). Requires a
// free HF access token with "Inference Providers" permission
// (create one at https://huggingface.co/settings/tokens/new?ownUserPermissions=inference.serverless.write&tokenType=fineGrained).

// Model candidates, tried in order. These are HF's own currently
// documented "recommended models" for the text-to-image task (see
// https://huggingface.co/docs/inference-providers/en/tasks/text-to-image)
// — i.e. models HF itself confirms are actively deployed on providers
// right now, rather than models we're guessing are still live.
const HF_MODEL_CANDIDATES = [
  "black-forest-labs/FLUX.1-Krea-dev",
  "Qwen/Qwen-Image",
  "ByteDance/Hyper-SD",
  "black-forest-labs/FLUX.1-schnell"
];

// Providers known (per HF's own docs) to serve text-to-image models.
// "hf-inference" is HF's own compute (successor to the old serverless
// API) and is often the most reliably available for popular models.
const HF_PROVIDER_CANDIDATES = ["hf-inference", "fal-ai", "together", "replicate", "nscale"];

function buildImagePrompt(postText, githubContext) {
  const khanName = githubContext?.khan?.name || "Khan programming language";
  return (
    `Minimalist professional tech illustration representing software development progress on ` +
    `"${khanName}", a custom programming language, and data science / machine learning work. ` +
    `Clean flat design, code symbols, abstract data charts, blue and dark navy color palette, ` +
    `no text, no words, no logos, LinkedIn banner style, high quality, wide aspect ratio`
  );
}

// Tries every (model, provider) combination in order until one works.
// Falls through on "not supported"/404-style errors (wrong pairing);
// surfaces immediately on auth/network errors since retrying won't help.
async function generateImage(postText, githubContext, hfToken) {
  if (!hfToken) {
    throw new Error("No Hugging Face token set. Open Settings and add a free HF access token.");
  }

  const prompt = buildImagePrompt(postText, githubContext);
  const errors = [];

  for (const model of HF_MODEL_CANDIDATES) {
    for (const provider of HF_PROVIDER_CANDIDATES) {
      try {
        return await tryProvider(provider, model, prompt, hfToken);
      } catch (err) {
        errors.push(`${model} via ${provider}: ${err.message}`);
        if (!/not supported|deprecated|no longer|410|404/i.test(err.message)) {
          throw new Error(`Hugging Face image error (${model} via ${provider}): ${err.message}`);
        }
      }
    }
  }

  throw new Error(
    `No combination of model/provider worked. Some of these models are "gated" and require ` +
    `accepting a license on Hugging Face's website first (visit the model page while logged ` +
    `into the same account as your token and click "Agree and access repository"): ` +
    `https://huggingface.co/black-forest-labs/FLUX.1-Krea-dev and ` +
    `https://huggingface.co/black-forest-labs/FLUX.1-schnell. ` +
    `Details: ${errors.join(" | ")}`
  );
}

async function tryProvider(provider, model, prompt, hfToken) {
  const url = `https://router.huggingface.co/${provider}/models/${model}`;
  const maxAttempts = 2;

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
      await new Promise(r => setTimeout(r, 2000));
      continue;
    }

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`${res.status} ${body.slice(0, 300)}`);
    }

    const blob = await res.blob();
    return { blob, promptUsed: prompt, sourceModel: model, provider };
  }

  throw new Error("model did not become ready in time (503 retries exhausted)");
}

if (typeof self !== "undefined") {
  self.ImageGenModule = { generateImage, buildImagePrompt };
}
