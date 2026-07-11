"use client";

import { useEffect, useState } from "react";

// Public connect page. An invited user opens this via the one-time link their admin
// sent them. It redeems the token for the seat's key and hands it to the StileAI
// browser extension (a content script on this page listens for the postMessage).
// If the extension isn't installed yet, the user can copy the key in manually.
type State =
  | { kind: "loading" }
  | { kind: "ok"; key: string; label: string | null }
  | { kind: "error"; message: string };

export default function ConnectPage() {
  const [state, setState] = useState<State>({ kind: "loading" });
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get("token") ?? "";
    if (!token) {
      setState({ kind: "error", message: "This link is missing its token. Ask your admin to re-send it." });
      return;
    }
    (async () => {
      try {
        const r = await fetch("/api/extension/redeem", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        });
        const data = await r.json();
        if (!r.ok) {
          setState({ kind: "error", message: data.error ?? "Could not connect this browser." });
          return;
        }
        // Hand the key to the extension (its content script on this page relays it to
        // the background worker). Harmless if the extension isn't installed.
        window.postMessage(
          { __stileaiConnect: true, key: data.key, endpoint: window.location.origin },
          window.location.origin,
        );
        setState({ kind: "ok", key: data.key, label: data.label ?? null });
      } catch {
        setState({ kind: "error", message: "Could not reach StileAI. Check your connection and try again." });
      }
    })();
  }, []);

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#f7f8fa",
        fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif",
        padding: 24,
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 440,
          background: "#fff",
          border: "1px solid #eceef1",
          borderRadius: 16,
          padding: 28,
          boxShadow: "0 12px 40px rgba(0,0,0,.06)",
        }}
      >
        <div style={{ fontSize: 22, marginBottom: 6 }}>🛡️ StileAI</div>

        {state.kind === "loading" && <p style={{ color: "#5b6472" }}>Connecting this browser…</p>}

        {state.kind === "ok" && (
          <>
            <h1 style={{ fontSize: 18, margin: "6px 0 8px", color: "#0f7a3d" }}>Browser connected ✓</h1>
            <p style={{ color: "#5b6472", fontSize: 14, lineHeight: 1.5 }}>
              {state.label ? <b>{state.label}</b> : "This browser"} is now protected by your company&apos;s AI
              policy. You can close this tab and use ChatGPT, Claude, or Gemini as normal.
            </p>
            <details style={{ marginTop: 16 }}>
              <summary style={{ cursor: "pointer", color: "#6b7686", fontSize: 12 }}>
                Extension didn&apos;t pick it up? Paste this key in manually.
              </summary>
              <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                <code
                  style={{
                    flex: 1,
                    fontSize: 12,
                    background: "#f2f4f7",
                    border: "1px solid #e2e6ea",
                    borderRadius: 8,
                    padding: "8px 10px",
                    wordBreak: "break-all",
                  }}
                >
                  {state.key}
                </code>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(state.key);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 1500);
                  }}
                  style={{
                    border: "1px solid #d6dae1",
                    background: "#fff",
                    borderRadius: 8,
                    padding: "8px 12px",
                    fontSize: 12,
                    cursor: "pointer",
                  }}
                >
                  {copied ? "Copied" : "Copy"}
                </button>
              </div>
              <p style={{ color: "#9aa3af", fontSize: 11, marginTop: 8 }}>
                Open the StileAI extension → paste under &ldquo;Your StileAI key&rdquo; → Save.
              </p>
            </details>
          </>
        )}

        {state.kind === "error" && (
          <>
            <h1 style={{ fontSize: 18, margin: "6px 0 8px", color: "#b02a37" }}>Couldn&apos;t connect</h1>
            <p style={{ color: "#5b6472", fontSize: 14, lineHeight: 1.5 }}>{state.message}</p>
          </>
        )}
      </div>
    </div>
  );
}
