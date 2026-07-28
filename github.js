// github.js — pulls the two content sources this extension is scoped to:
// 1) Khan lang repo (khandev1211-cpu/Khan) progress
// 2) Data-science-flavored repos on the same GitHub account

const GITHUB_USER = "khandev1211-cpu";
const KHAN_REPO = "Khan";

const DS_KEYWORDS = [
  "data-science", "machine-learning", "ml", "xgboost", "pandas",
  "numpy", "scikit", "tensorflow", "pytorch", "data", "model",
  "prediction", "analysis", "notebook", "jupyter"
];

async function ghFetch(path, token) {
  const headers = { "Accept": "application/vnd.github+json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  let res;
  try {
    res = await fetch(`https://api.github.com${path}`, { headers });
  } catch (networkErr) {
    throw new Error(
      `Network error reaching GitHub API (${path}): ${networkErr.message}. ` +
      `Check your internet connection and that this extension has permission for api.github.com.`
    );
  }

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`GitHub API ${path} failed: ${res.status} ${body.slice(0, 200)}`);
  }
  return res.json();
}

// Recent commits + README summary for the Khan repo
async function getKhanRepoContext(token) {
  const repo = await ghFetch(`/repos/${GITHUB_USER}/${KHAN_REPO}`, token);
  let commits = [];
  try {
    commits = await ghFetch(`/repos/${GITHUB_USER}/${KHAN_REPO}/commits?per_page=8`, token);
  } catch (e) {
    commits = [];
  }

  const recentCommits = commits.map(c => ({
    message: c.commit?.message?.split("\n")[0] || "",
    date: c.commit?.author?.date || ""
  }));

  return {
    name: repo.name,
    description: repo.description || "A custom programming language project, including the webi web framework written in C.",
    stars: repo.stargazers_count,
    language: repo.language,
    url: repo.html_url,
    updatedAt: repo.updated_at,
    recentCommits
  };
}

// Repos on the account that look data-science related
async function getDataScienceRepos(token) {
  const repos = await ghFetch(`/users/${GITHUB_USER}/repos?sort=updated&per_page=100`, token);

  const matches = repos.filter(r => {
    const haystack = `${r.name} ${r.description || ""} ${r.language || ""}`.toLowerCase();
    return DS_KEYWORDS.some(kw => haystack.includes(kw));
  });

  return matches.map(r => ({
    name: r.name,
    description: r.description || "",
    language: r.language,
    url: r.html_url,
    updatedAt: r.updated_at,
    stars: r.stargazers_count
  }));
}

async function getGithubContext(token) {
  const [khan, dsRepos] = await Promise.all([
    getKhanRepoContext(token).catch(err => ({ error: err.message })),
    getDataScienceRepos(token).catch(err => ({ error: err.message }))
  ]);
  return { khan, dsRepos };
}

// Exposed for background.js (service worker) via importScripts,
// and reused as plain functions in module context.
if (typeof self !== "undefined") {
  self.GithubModule = { getGithubContext };
}
