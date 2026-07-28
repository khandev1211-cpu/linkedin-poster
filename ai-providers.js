// ai-providers.js — pluggable LLM backends for writing the LinkedIn post text.
// Provider + key are chosen by the user in the popup Settings panel and
// persisted via chrome.storage.local under "aiConfig".

function buildPrompt(githubContext) {
  const { khan, dsRepos } = githubContext;

  const khanSummary = khan && !khan.error
    ? `Repo: ${khan.name}. Description: ${khan.description}. Primary language: ${khan.language}. ` +
      `Recent commits: ${(khan.recentCommits || []).map(c => "- " + c.message).join(" ") || "no recent commit data"}.`
    : "No Khan repo data available.";

  const dsSummary = dsRepos && !dsRepos.error && dsRepos.length
    ? dsRepos.map(r => `- ${r.name}: ${r.description || "no description"} (${r.language || "n/a"})`).join("\n")
    : "No data science repos found.";

  return `You are writing a LinkedIn post for a freelance software developer named Madeeha, based in Faisalabad, Pakistan, who builds AI-agent tooling, Chrome extensions, and automation systems.

Write ONE professional, engaging LinkedIn post (120-220 words) that covers exactly two things:
1. Progress on her custom programming language project "Khan" (details below).
2. A mention of her data science project work on GitHub (details below).

Khan project context:
${khanSummary}

Data science repos context:
${dsSummary}

Requirements:
- Professional tone, first-person ("I"), no excessive emojis (max 2-3), no hashtag spam (3-5 relevant hashtags at the end max).
- Do not invent specific numbers/stats not present in the context above.
- End with a short forward-looking line (what's next / invitation to follow along).
- Output ONLY the post text, nothing else (no preamble, no markdown headers).`;
}

async function callGroq(prompt, apiKey) {
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7,
      max_tokens: 500
    })
  });
  if (!res.ok) throw new Error(`Groq error: ${res.status} ${await res.text()}`);
  const data = await res.json();
  return data.choices?.[0]?.message?.content?.trim();
}

async function callCerebras(prompt, apiKey) {
  const res = await fetch("https://api.cerebras.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: "llama3.3-70b",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7,
      max_tokens: 500
    })
  });
  if (!res.ok) throw new Error(`Cerebras error: ${res.status} ${await res.text()}`);
  const data = await res.json();
  return data.choices?.[0]?.message?.content?.trim();
}

async function callMistral(prompt, apiKey) {
  const res = await fetch("https://api.mistral.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: "mistral-small-latest",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7,
      max_tokens: 500
    })
  });
  if (!res.ok) throw new Error(`Mistral error: ${res.status} ${await res.text()}`);
  const data = await res.json();
  return data.choices?.[0]?.message?.content?.trim();
}

async function generatePostText(githubContext, aiConfig) {
  const prompt = buildPrompt(githubContext);
  const { provider, apiKey } = aiConfig || {};

  if (!apiKey) {
    throw new Error("No API key set. Open Settings and add a Groq, Mistral, or Cerebras key.");
  }

  switch (provider) {
    case "groq":
      return callGroq(prompt, apiKey);
    case "cerebras":
      return callCerebras(prompt, apiKey);
    case "mistral":
      return callMistral(prompt, apiKey);
    default:
      return callGroq(prompt, apiKey);
  }
}

if (typeof self !== "undefined") {
  self.AiProvidersModule = { generatePostText, buildPrompt };
}
