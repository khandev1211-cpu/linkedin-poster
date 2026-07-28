// content-script.js — runs on linkedin.com/feed.
// Automates: open "Start a post" composer -> type text -> attach image -> click Post.
//
// LinkedIn's DOM/class names change frequently and are obfuscated, so every
// step uses multiple fallback selectors plus text-based heuristics rather
// than a single brittle CSS path.

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "DO_LINKEDIN_POST") {
    doLinkedInPost(msg.payload)
      .then(result => sendResponse({ ok: true, ...result }))
      .catch(err => sendResponse({ ok: false, error: err.message || String(err) }));
    return true;
  }
});

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function waitFor(fn, { timeout = 15000, interval = 300, label = "condition" } = {}) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const result = fn();
    if (result) return result;
    await sleep(interval);
  }
  throw new Error(`Timed out waiting for: ${label}`);
}

function findStartPostButton() {
  // LinkedIn's "Start a post" trigger. Try aria-label first, then text content.
  const candidates = Array.from(document.querySelectorAll("button, div[role='button']"));
  return candidates.find(el => {
    const label = (el.getAttribute("aria-label") || "").toLowerCase();
    const text = (el.textContent || "").toLowerCase();
    return label.includes("start a post") || text.includes("start a post");
  });
}

function findComposerEditor() {
  // The rich-text editable area of the post modal.
  return document.querySelector(
    "div.ql-editor[contenteditable='true'], div[role='textbox'][contenteditable='true']"
  );
}

function findAddMediaButton() {
  const candidates = Array.from(document.querySelectorAll("button"));
  return candidates.find(el => {
    const label = (el.getAttribute("aria-label") || "").toLowerCase();
    return label.includes("add a photo") || label.includes("add media");
  });
}

function findFileInput() {
  return document.querySelector("input[type='file']");
}

function findNextOrDoneButton() {
  const candidates = Array.from(document.querySelectorAll("button"));
  return candidates.find(el => {
    const text = (el.textContent || "").trim().toLowerCase();
    return text === "next" || text === "done";
  });
}

function findPostButton() {
  const candidates = Array.from(document.querySelectorAll("button"));
  return candidates.find(el => {
    const text = (el.textContent || "").trim().toLowerCase();
    const label = (el.getAttribute("aria-label") || "").toLowerCase();
    return (text === "post" || label === "post") && !el.disabled;
  });
}

function dataUrlToFile(dataUrl, filename) {
  const [header, base64] = dataUrl.split(",");
  const mimeMatch = header.match(/data:(.*);base64/);
  const mime = mimeMatch ? mimeMatch[1] : "image/jpeg";
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new File([bytes], filename, { type: mime });
}

function setNativeFilesOnInput(input, files) {
  const dt = new DataTransfer();
  files.forEach(f => dt.items.add(f));
  input.files = dt.files;
  input.dispatchEvent(new Event("change", { bubbles: true }));
}

async function doLinkedInPost({ postText, imageDataUrl, autoSubmit }) {
  if (!postText) throw new Error("No post text provided");

  // Step 1: open the post composer
  let startBtn = findStartPostButton();
  if (!startBtn) {
    startBtn = await waitFor(findStartPostButton, { label: "'Start a post' button" });
  }
  startBtn.click();

  // Step 2: wait for the editor to appear and type the text
  const editor = await waitFor(findComposerEditor, { label: "post composer editor" });
  editor.focus();
  document.execCommand("insertText", false, postText);
  editor.dispatchEvent(new Event("input", { bubbles: true }));
  await sleep(500);

  // Step 3: attach the generated image, if provided
  if (imageDataUrl) {
    const mediaBtn = findAddMediaButton();
    if (mediaBtn) {
      mediaBtn.click();
      const fileInput = await waitFor(findFileInput, { label: "media file input" });
      const file = dataUrlToFile(imageDataUrl, "post-image.jpg");
      setNativeFilesOnInput(fileInput, [file]);
      await sleep(1500);

      const nextBtn = await waitFor(findNextOrDoneButton, {
        timeout: 8000,
        label: "'Next/Done' button after image upload"
      }).catch(() => null);
      if (nextBtn) {
        nextBtn.click();
        await sleep(800);
      }
    } else {
      console.warn("[LinkedIn Poster] Add media button not found — posting text only.");
    }
  }

  // Step 4: submit, or hand control back to the user for a manual final check
  if (autoSubmit) {
    const postBtn = await waitFor(findPostButton, { label: "final 'Post' button" });
    postBtn.click();
    await sleep(1000);
    return { posted: true };
  }

  return { posted: false, readyForManualReview: true };
}
