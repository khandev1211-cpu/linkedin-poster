// image-gen.js — free, no-API-key image generation via Pollinations.ai
// Chosen because it needs zero signup/key, is reliable, and works well
// for simple professional/tech-themed illustrative images.

function buildImagePrompt(postText, githubContext) {
  const khanName = githubContext?.khan?.name || "Khan programming language";
  return (
    `Minimalist professional tech illustration representing software development progress on ` +
    `"${khanName}", a custom programming language, and data science / machine learning work. ` +
    `Clean flat design, code symbols, abstract data charts, blue and dark navy color palette, ` +
    `no text, no words, no logos, LinkedIn banner style, high quality, 16:9`
  );
}

async function generateImage(postText, githubContext) {
  const prompt = buildImagePrompt(postText, githubContext);
  const seed = Math.floor(Math.random() * 1_000_000);
  const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}` +
    `?width=1200&height=675&seed=${seed}&nologo=true&referrer=github-linkedin-poster`;

  // Fetch as blob so the popup/content-script can attach it as a File.
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Image generation failed: ${res.status}`);
  const blob = await res.blob();
  return { blob, promptUsed: prompt, sourceUrl: url };
}

if (typeof self !== "undefined") {
  self.ImageGenModule = { generateImage, buildImagePrompt };
}
