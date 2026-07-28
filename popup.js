const settingsToggle = document.getElementById("settingsToggle");
const settingsPanel = document.getElementById("settingsPanel");
const providerSelect = document.getElementById("providerSelect");
const apiKeyInput = document.getElementById("apiKeyInput");
const hfTokenInput = document.getElementById("hfTokenInput");
const githubTokenInput = document.getElementById("githubTokenInput");
const saveSettingsBtn = document.getElementById("saveSettings");
const settingsStatus = document.getElementById("settingsStatus");

const generateBtn = document.getElementById("generateBtn");
const generateStatus = document.getElementById("generateStatus");
const previewArea = document.getElementById("previewArea");
const postTextArea = document.getElementById("postTextArea");
const imagePreview = document.getElementById("imagePreview");
const regenerateBtn = document.getElementById("regenerateBtn");
const postBtn = document.getElementById("postBtn");
const autoSubmitCheckbox = document.getElementById("autoSubmitCheckbox");
const postStatus = document.getElementById("postStatus");

let lastImageDataUrl = null;

function setStatus(el, text, kind) {
  el.textContent = text;
  el.className = "status" + (kind ? ` ${kind}` : "");
}

async function loadSettings() {
  const { aiConfig, hfToken, githubToken } = await chrome.storage.local.get(["aiConfig", "hfToken", "githubToken"]);
  if (aiConfig) {
    providerSelect.value = aiConfig.provider || "groq";
    apiKeyInput.value = aiConfig.apiKey || "";
  }
  if (hfToken) {
    hfTokenInput.value = hfToken;
  }
  if (githubToken) {
    githubTokenInput.value = githubToken;
  }
}

settingsToggle.addEventListener("click", () => {
  settingsPanel.classList.toggle("hidden");
});

saveSettingsBtn.addEventListener("click", async () => {
  const provider = providerSelect.value;
  const apiKey = apiKeyInput.value.trim();
  const hfToken = hfTokenInput.value.trim();
  const githubToken = githubTokenInput.value.trim();

  if (!apiKey) {
    setStatus(settingsStatus, "Please paste an API key for text generation.", "error");
    return;
  }
  if (!hfToken) {
    setStatus(settingsStatus, "Please paste a Hugging Face token for image generation.", "error");
    return;
  }

  await chrome.storage.local.set({ aiConfig: { provider, apiKey }, hfToken, githubToken });
  setStatus(settingsStatus, "Saved.", "success");
});

async function generatePost() {
  setStatus(generateStatus, "Fetching GitHub data, writing post, generating image…");
  previewArea.classList.add("hidden");
  generateBtn.disabled = true;
  regenerateBtn.disabled = true;

  try {
    const response = await chrome.runtime.sendMessage({ type: "GENERATE_POST" });
    if (!response.ok) throw new Error(response.error || "Unknown error");

    postTextArea.value = response.postText;
    imagePreview.src = response.imageDataUrl;
    lastImageDataUrl = response.imageDataUrl;

    previewArea.classList.remove("hidden");
    setStatus(generateStatus, "Ready. Review and edit before posting.", "success");
  } catch (err) {
    setStatus(generateStatus, `Failed: ${err.message}`, "error");
  } finally {
    generateBtn.disabled = false;
    regenerateBtn.disabled = false;
  }
}

generateBtn.addEventListener("click", generatePost);
regenerateBtn.addEventListener("click", generatePost);

postBtn.addEventListener("click", async () => {
  setStatus(postStatus, "Opening LinkedIn and filling the composer…");
  postBtn.disabled = true;

  try {
    const response = await chrome.runtime.sendMessage({
      type: "POST_TO_LINKEDIN",
      payload: {
        postText: postTextArea.value,
        imageDataUrl: lastImageDataUrl,
        autoSubmit: autoSubmitCheckbox.checked
      }
    });

    if (!response.ok) throw new Error(response.error || "Unknown error");

    if (response.posted) {
      setStatus(postStatus, "Posted to LinkedIn ✓", "success");
    } else {
      setStatus(postStatus, "Composer filled — review it on the LinkedIn tab, then click Post yourself.", "success");
    }
  } catch (err) {
    setStatus(postStatus, `Failed: ${err.message}. You may need to switch to the LinkedIn tab and retry.`, "error");
  } finally {
    postBtn.disabled = false;
  }
});

loadSettings();
