---
title: "Secrets, PII, and Source Code: What Your Team Should Never Send to AI"
description: "PII in AI prompts is a growing risk. A category-by-category guide to what should never go into ChatGPT or Copilot, with safer alternatives."
date: "2026-07-01"
author: "StileAI"
keywords: ["PII in AI", "source code ChatGPT", "AI security best practices", "secrets in prompts"]
tags: ["AI security", "Data protection"]
---

PII in AI prompts has quietly become one of the most common ways sensitive data leaves a company, precisely because it doesn't feel like an exfiltration event. Nobody thinks of pasting a customer's contact record into a chatbot as "sending data outside the company" — it feels like using a tool, not sharing information. But from a security standpoint, that's exactly what it is: text, containing sensitive data, sent to a third party.

The following categories cover most of the real risk. None of this is about avoiding AI — it's about knowing which specific things shouldn't go into a prompt, and what to do instead.

## Credentials and secrets

API keys, passwords, tokens, and private keys sometimes end up in prompts almost by accident — a developer pastes an entire config file or error log to get help debugging, and the credentials are just part of what got copied. There's essentially never a legitimate reason an AI model needs your actual production API key to help you write code or troubleshoot an issue.

**Safer alternative:** replace real credentials with placeholder values (`YOUR_API_KEY`, `<redacted>`) before pasting logs or config into an AI tool. Most debugging help doesn't require the real secret — it requires the shape of the problem.

## Customer PII

Names, addresses, phone numbers, government ID numbers, and financial account details are the core of what most companies would call "customer data," and it's routinely pasted into AI tools to draft a personalized email, summarize a support ticket, or clean up a spreadsheet. The risk isn't just the immediate exposure — it's that once that data has been sent to a third-party AI provider, the company generally has limited ability to know how it was retained or used, depending on the tool and its settings.

**Safer alternative:** de-identify before you paste. Replace real names and identifiers with placeholders ("Customer A," "555-0100") when the task only needs the structure of the data, not the actual identity behind it. If the task genuinely requires real customer data, use a company-sanctioned tool with an appropriate data processing agreement in place — not a personal ChatGPT account.

## Protected health information (PHI)

Anything covered by healthcare privacy regulation — patient records, diagnoses, treatment details — carries real regulatory exposure well beyond typical PII, and most consumer AI tools offer no assurances suitable for this category. This one is close to a hard no for informal AI use, regardless of how convenient it would be to get a quick summary.

**Safer alternative:** use only tools your compliance team has specifically vetted and contracted for this purpose. If that tool doesn't exist yet at your company, that's the conversation to have before PHI goes anywhere near a general-purpose AI assistant.

## Proprietary source code

Pasting a function into an AI tool to get help debugging is one of the most common developer workflows — and one of the easiest to overdo. A single function is usually low risk. An entire proprietary module, a security-relevant authentication flow, or a file that reveals your system architecture is a different situation, especially at companies where the codebase itself is a competitive asset.

**Safer alternative:** share the smallest snippet that reproduces the problem, strip identifying comments and internal service names, and avoid pasting anything from security-critical code paths (auth, payments, access control) into general-purpose tools.

## Financial records

Unpublished figures, forecasts, and internal financial models are frequently pasted into AI tools for a quick analysis or a chart — useful, but risky if the figures are material and not yet public. This is one of the clearer cases where the value of AI assistance has to be weighed against insider-information and disclosure risk.

**Safer alternative:** use anonymized or rounded figures for exploratory analysis, and route anything involving real unpublished financials through tools your finance and legal teams have approved.

## Legal and contractual documents

NDAs, client contracts, and litigation materials often get summarized or redlined by an AI assistant with no idea the document is confidential — and no obligation to keep it that way. Client contracts in particular often contain explicit confidentiality clauses that a well-meaning AI-assisted summary could technically violate.

**Safer alternative:** route legal documents through counsel-approved tools, or ask the AI to work from a description of the relevant clauses rather than the document itself.

## The common thread

Across every category, the pattern is the same: employees aren't being careless, they're solving a real problem with the fastest tool available, and the sensitivity of what they're pasting isn't always obvious in the moment. Relying on every employee to independently recognize each of these categories, every time, under normal work pressure, isn't a realistic control.

## Where StileAI fits

StileAI checks every AI request against exactly these categories — secrets, PII, PHI, source code, financial records, legal documents — before it reaches the model, blocking or holding sensitive requests for approval rather than relying on individual judgment in the moment. Safe requests go through unaffected.

[Get started](/login?mode=signup)
