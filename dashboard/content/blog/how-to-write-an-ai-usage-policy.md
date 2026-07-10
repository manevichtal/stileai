---
title: "How to Write an AI Usage Policy for Your Company (With Examples)"
description: "A practical guide to writing an AI usage policy that people actually follow, with a sample allow/approve/block table by data category."
date: "2026-06-17"
author: "StileAI"
keywords: ["AI usage policy", "AI acceptable use policy", "AI policy template", "AI governance"]
tags: ["AI security", "Data protection"]
---

A good AI usage policy answers one question clearly: what can employees put into an AI tool, and what can't they? Most companies either skip this entirely or write something so vague — "use AI responsibly" — that it gives no one anything to actually follow. The result is the same either way: employees use AI tools the way they already do, and the policy exists only on paper.

A policy that works has two properties a lot of first drafts miss. It has to be specific enough to apply to a real situation in the moment someone's using AI, not just in a training session six months earlier. And it has to be enforceable — backed by something other than trust — or it quietly becomes optional the first time someone's in a hurry.

## Start with data categories, not tools

The instinct is often to write a policy tool by tool — "here's the ChatGPT policy, here's the Copilot policy." That's the wrong axis. Employees will use whatever tool is fastest for the task, and new tools show up faster than policies can be rewritten. The durable approach is to define policy around categories of data, then apply the same rules regardless of which AI tool someone reaches for.

A reasonable starting set of categories:

- **Secrets and credentials** — API keys, passwords, tokens, private keys
- **Personally identifiable information (PII)** — names paired with contact details, government IDs, financial account numbers
- **Protected health information (PHI)** — anything covered by healthcare privacy obligations
- **Source code** — especially proprietary or security-relevant code
- **Financial records** — unpublished figures, forecasts, internal financial models
- **Legal and contractual documents** — NDAs, client contracts, litigation materials

## Decide allow, require-approval, or block — per category

For each category, decide what should happen when someone tries to send it to an AI tool. Three outcomes cover almost every real case:

- **Allow** — the data is fine to send; general business writing, public information, non-sensitive internal notes
- **Require approval** — the data might be legitimate to send in context, but a person should sign off first; this is where most edge cases belong
- **Block** — the data should never go to an external AI tool, full stop

A sample policy table, adaptable to most companies:

| Data category | Default action | Notes |
|---|---|---|
| Secrets / API keys / passwords | Block | No legitimate reason to paste these into an AI prompt |
| Customer PII | Require approval | Allowed for de-identified analysis; blocked for raw records |
| PHI | Block | Regulatory exposure is too high for informal use |
| Proprietary source code | Require approval | Fine for isolated snippets; risky for full modules or security-relevant code |
| Financial records (unpublished) | Require approval | Case-by-case, depending on sensitivity and recipient tool |
| Legal / contract documents | Block | Route through legal-approved tools instead |
| Public or general business content | Allow | Marketing copy, published docs, generic drafting |

Adjust the categories and defaults to your company's actual risk tolerance and regulatory obligations — this is a starting point, not a universal answer.

## Make it enforceable, not just written

This is where most AI usage policies fail. A document that says "don't paste customer data into ChatGPT" relies entirely on every employee remembering that rule, recognizing customer data when they see it, and choosing to comply under whatever deadline pressure they're facing that day. Some will. Enough won't that the policy doesn't actually protect anything.

An enforceable policy has the categories and defaults from the table above encoded into something that runs automatically — checking requests to AI tools against the policy before they go through, rather than relying on employees to self-police. That doesn't mean removing judgment entirely; the "require approval" category exists precisely so a human can weigh in on genuine edge cases instead of the policy being pure allow-or-deny.

## Keep it short and keep it current

The policy document itself should be short enough that people actually read it — a page, not twenty. Put the reasoning and the category table where employees can find it, but don't rely on people re-reading it regularly. Review it quarterly, especially as new AI tools get adopted and new categories of risk show up (a new client contract type, a new class of internal data, a new integration that sends data to an AI API automatically).

## Where StileAI fits

Writing the policy is the easy part — enforcing it is where most companies get stuck. StileAI lets you encode exactly this kind of category-based policy (allow / require-approval / block) and applies it automatically to every request your employees and integrations send to ChatGPT, Claude, Gemini, or Copilot, before it reaches the model. Every decision is logged, so the policy on paper matches what's actually happening in practice.

[See how StileAI works](/)
