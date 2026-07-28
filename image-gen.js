// image-gen.js — free image generation via Hugging Face's Serverless
// Inference API. Free tier, but requires a free HF access token
// (create one at https://huggingface.co/settings/tokens, "read" scope
// is enough). Uses a Stable Diffusion model for text-to-image.

const HF_MODEL = "stabilityai/stable-diffusion-xl-base-1.0";

function buildImagePrompt(postText, githubContext) {
  const khanName = githubContext?.khan?.name || "Khan programming language";
  return (
    `Minimalist professional tech illustration representing software development progress on ` +
    `"${khanName}", a custom programming language, and data science / machine learning work. ` +
    `Clean flat design, code symbols, abstract data charts, blue and dark navy color palette, ` +
    `no text, no words, no logos, LinkedIn banner style, high quality, wide aspect ratio`
  );
}

// Hugging Face serverless models can "cold start" and return 503 while
// loading — retry a few times with a short wait, per HF's own guidance.
async function generateImage(postText, githubContext, hfToken) {
  if (!hfToken) {
    throw new Error("No Hugging Face token set. Open Settings and add a free HF access token.");
  }

  const prompt = buildImagePrompt(postText, githubContext);
  const maxAttempts = 4;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const res = await fetch(`https://api-inference.huggingface.co/models/${HF_MODEL}`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${hfToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ inputs: prompt })
    });

    if (res.status === 503 && attempt < maxAttempts) {
      // Model is loading (cold start) — wait and retry.
      await new Promise(r => setTimeout(r, 4000));
      continue;
    }

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`Hugging Face image error: ${res.status} ${body.slice(0, 200)}`);
    }

    const blob = await res.blob();
    return { blob, promptUsed: prompt, sourceModel: HF_MODEL };
  }

  throw new Error("Hugging Face model did not become ready in time. Try again in a moment.");
}

if (typeof self !== "undefined") {
  self.ImageGenModule = { generateImage, buildImagePrompt };
}
