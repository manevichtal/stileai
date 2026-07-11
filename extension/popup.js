"use strict";

const DEFAULTS = { endpoint: "https://stileai.vercel.app", key: "", enabled: true, failClosed: true };
const $ = (id) => document.getElementById(id);
const status = (msg, cls) => {
  const el = $("status");
  el.textContent = msg;
  el.className = cls || "muted";
};

async function load() {
  const cfg = { ...DEFAULTS, ...(await chrome.storage.sync.get(Object.keys(DEFAULTS))) };
  $("key").value = cfg.key;
  $("endpoint").value = cfg.endpoint;
  $("enabled").checked = cfg.enabled;
  $("failClosed").checked = cfg.failClosed;
  if (!cfg.key) status("Not linked yet — paste your key and Save.", "muted");
  else status(cfg.enabled ? "Protection is on." : "Protection is off.", cfg.enabled ? "ok" : "muted");
}

async function save() {
  const endpoint = ($("endpoint").value.trim() || DEFAULTS.endpoint).replace(/\/+$/, "");
  await chrome.storage.sync.set({
    key: $("key").value.trim(),
    endpoint,
    enabled: $("enabled").checked,
    failClosed: $("failClosed").checked,
  });
  status("Saved.", "ok");
}

async function test() {
  await save();
  const endpoint = ($("endpoint").value.trim() || DEFAULTS.endpoint).replace(/\/+$/, "");
  const key = $("key").value.trim();
  if (!key) return status("Enter your key first.", "err");
  status("Testing…", "muted");
  try {
    const r = await fetch(endpoint + "/api/inspect", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + key },
      body: JSON.stringify({ prompt: "hello", site: "connection-test" }),
    });
    if (r.status === 401) return status("Key not recognized by this workspace.", "err");
    const v = await r.json();
    if (v && v.effect) status("Connected ✓ — StileAI answered (" + v.effect + ").", "ok");
    else status("Reached the workspace but got an unexpected reply.", "err");
  } catch (_) {
    status("Couldn't reach the workspace URL. Check it and try again.", "err");
  }
}

$("save").addEventListener("click", save);
$("test").addEventListener("click", test);
document.addEventListener("DOMContentLoaded", load);
