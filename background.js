importScripts("github.js", "ai-providers.js", "image-gen.js");

// Central message router. The popup calls chrome.runtime.sendMessage
// with { type: "..." } and we do the heavy lifting here in the
// service worker so the popup stays lightweight.

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "GENERATE_POST") {
    handleGeneratePost().then(sendResponse).catch(err => {
      sendResponse({ ok: false, error: err.message || String(err) });
    });
    return true; // keep the message channel open for async response
  }

  if (msg.type === "POST_TO_LINKEDIN") {
    handlePostToLinkedIn(msg.payload).then(sendResponse).catch(err => {
      sendResponse({ ok: false, error: err.message || String(err) });
    });
    return true;
  }
});

async function handleGeneratePost() {
  const { aiConfig, hfToken, githubToken } = await chrome.storage.local.get(["aiConfig", "hfToken", "githubToken"]);

  // Step 1: pull GitHub context (Khan repo + data science repos)
  const githubContext = await self.GithubModule.getGithubContext(githubToken);

  // Step 2: generate the post text
  const postText = await self.AiProvidersModule.generatePostText(githubContext, aiConfig);
  if (!postText) throw new Error("AI provider returned empty text");

  // Step 3: generate the accompanying image
  const { blob } = await self.ImageGenModule.generateImage(postText, githubContext, hfToken);

  // Convert blob to a data URL so it can cross the message boundary to the popup
  const imageDataUrl = await blobToDataUrl(blob);

  return {
    ok: true,
    postText,
    imageDataUrl,
    githubContext
  };
}

async function handlePostToLinkedIn(payload) {
  // Find or open a LinkedIn feed tab, then delegate the actual DOM
  // automation to content-script.js running there.
  const tabs = await chrome.tabs.query({ url: "https://www.linkedin.com/*" });
  let tab = tabs[0];

  if (!tab) {
    tab = await chrome.tabs.create({ url: "https://www.linkedin.com/feed/", active: true });
    await waitForTabComplete(tab.id);
    // Give the content script a moment to attach after navigation
    await new Promise(r => setTimeout(r, 2000));
  } else {
    await chrome.tabs.update(tab.id, { active: true });
  }

  const response = await chrome.tabs.sendMessage(tab.id, {
    type: "DO_LINKEDIN_POST",
    payload
  });

  return response;
}

function waitForTabComplete(tabId) {
  return new Promise(resolve => {
    function listener(id, info) {
      if (id === tabId && info.status === "complete") {
        chrome.tabs.onUpdated.removeListener(listener);
        resolve();
      }
    }
    chrome.tabs.onUpdated.addListener(listener);
  });
}

async function blobToDataUrl(blob) {
  const buffer = await blob.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunkSize = 8192;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  const base64 = btoa(binary);
  const mime = blob.type || "image/jpeg";
  return `data:${mime};base64,${base64}`;
}
