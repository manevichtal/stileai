# START HERE 👋 (read this first — it's for you, not for the AI)

This folder is everything Claude Code needs to build and deploy **Interlock** for
you. You do **not** need to write any code. You'll run Claude Code in VS Code and
it does the building; you just create a few free accounts and click "approve" when
it asks. Here's the whole process.

---

## What's in this folder

- `CLAUDE.md` — the full build instructions Claude Code will follow. (You don't
  need to read it, but you can.)
- `interlock-mcp/` — the finished, tested engine I already built. Claude Code
  reuses this; it won't rebuild it.
- `supabase/schema.sql` — the database setup Claude Code will apply.
- `dashboard/` — empty for now; Claude Code builds the website here.

## One reassurance about "the cloud"

Building in VS Code uses your computer as the **workshop** only. The finished
product deploys to the cloud (Vercel + Supabase + Render), so it lives online and
your computer is never the server. You can close your laptop and customers are
unaffected.

## Accounts you'll need (all free to start)

Create these when Claude Code asks (or ahead of time). Free tiers are fine for
building and testing:
1. **GitHub** — stores the code. (github.com)
2. **Supabase** — the database + admin logins. (supabase.com)
3. **Vercel** — hosts the dashboard website. (vercel.com)
4. **Render** — hosts the always-on checkpoint server. (render.com)

You'll log into each **once** in your browser when Claude Code reaches that step.
Claude Code can run the commands, but it can't (and shouldn't) log in for you —
that's your security line.

## Step by step

1. **Install VS Code**, then add **Claude Code** (use the "Claude Code in VS Code"
   button from our chat, or search "Claude Code" in VS Code's extensions).
2. **Put this folder somewhere easy** (e.g. your Desktop) and open it in VS Code
   (File → Open Folder → pick this folder).
3. **Open Claude Code** in VS Code and paste the prompt below.
4. **Follow along.** Claude Code will work in phases and will stop to ask you to
   create an account or click "approve" at the right moments. Just do what it
   asks and tell it when you're done.

## 👉 The exact prompt to paste into Claude Code

```
Read START_HERE.md and CLAUDE.md in this folder, then build and deploy the
Interlock product exactly as CLAUDE.md specifies. The finished MCP server is in
interlock-mcp/ — reuse it, don't rebuild it. Work in the phases listed in
CLAUDE.md section 9, one at a time. Before each phase, tell me in plain language
what you're about to do. STOP and give me clear instructions whenever you need me
to create an account or log in (Supabase, GitHub, Vercel, Render), and wait for me
to confirm before continuing. Start with Phase 0 now.
```

## What to expect

- Claude Code will first verify the engine works (Phase 0), then set up the
  database, build the dashboard, prove the connection works, build the admin
  screens, then deploy everything. It's normal for this to take several sessions.
- When it asks you to log into an account, a browser window opens — you click
  approve, then come back and tell Claude Code "done."
- By the end you'll have a live dashboard URL where you can log in, set rules, and
  watch the audit trail — the thing you can demo and sell.

## A money tip

The free tiers cover building and testing. Two things to watch once you go live:
- Set a **spending limit** in Claude Code's settings so AI usage can't surprise you.
- Render's free server sleeps after 15 minutes idle (fine for testing). Upgrade
  it to a small always-on paid tier before real customers rely on it.

## If you get stuck

Tell Claude Code exactly what happened or paste any error — it can read the error
and fix it. If a whole step is confusing, come back to me (regular Claude) and
describe where you are; I can translate and give you the next move.
