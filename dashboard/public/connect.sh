#!/bin/sh
# StileAI connect — route the AI agents you run from your terminal through StileAI.
#
#   Install:    curl -fsSL https://stileai.com/connect.sh | sh -s -- <YOUR_STILEAI_KEY>
#   Uninstall:  curl -fsSL https://stileai.com/connect.sh | sh -s -- --uninstall
#
# It sets the standard OpenAI/Anthropic "base URL" variables in your shell so any
# tool that uses those SDKs (Claude Code, aider, Codex, LangChain/CrewAI agents,
# your own scripts) sends its requests to StileAI first. Your existing provider
# keys are used as-is and flow straight through — this script never asks for or
# stores them. Everything it does is in one clearly-marked block you can remove.
set -e

HOST="https://stileai.com"
MARK_START="# >>> StileAI >>>"
MARK_END="# <<< StileAI <<<"

detect_profile() {
  # Prefer the profile for the user's login shell; fall back sensibly.
  case "${SHELL:-}" in
    *zsh) echo "$HOME/.zshrc" ;;
    *bash)
      if [ -f "$HOME/.bashrc" ]; then echo "$HOME/.bashrc"; else echo "$HOME/.bash_profile"; fi ;;
    *) [ -f "$HOME/.zshrc" ] && echo "$HOME/.zshrc" || echo "$HOME/.profile" ;;
  esac
}

PROFILE="$(detect_profile)"

remove_block() {
  f="$1"
  [ -f "$f" ] || return 0
  tmp="$(mktemp)"
  awk -v s="$MARK_START" -v e="$MARK_END" '
    $0==s {skip=1} skip==0 {print} $0==e {skip=0}
  ' "$f" > "$tmp"
  cp "$f" "$f.stileai.bak"
  mv "$tmp" "$f"
}

if [ "$1" = "--uninstall" ]; then
  remove_block "$PROFILE"
  printf "\n\342\234\223 StileAI disconnected (%s). Open a new terminal to finish.\n\n" "$PROFILE"
  exit 0
fi

KEY="$1"
if [ -z "$KEY" ]; then
  printf "Missing your StileAI key.\n"
  printf "Usage: curl -fsSL %s/connect.sh | sh -s -- <YOUR_STILEAI_KEY>\n" "$HOST"
  printf "Find your key in the StileAI dashboard under \"API keys\".\n"
  exit 1
fi

OPENAI_BASE="$HOST/api/proxy/$KEY/v1"
ANTHROPIC_BASE="$HOST/api/proxy/$KEY"

# Idempotent: clear any previous StileAI block, then write a fresh one.
remove_block "$PROFILE"
{
  printf "%s\n" "$MARK_START"
  printf "export OPENAI_BASE_URL=\"%s\"\n" "$OPENAI_BASE"
  printf "export OPENAI_API_BASE=\"%s\"\n" "$OPENAI_BASE"
  printf "export ANTHROPIC_BASE_URL=\"%s\"\n" "$ANTHROPIC_BASE"
  printf "%s\n" "$MARK_END"
} >> "$PROFILE"

printf "\n\342\234\223 StileAI is now protecting the AI agents you run from your terminal.\n"
printf "   Set up in: %s\n\n" "$PROFILE"
printf "   Next: open a NEW terminal window (or run:  source %s ).\n" "$PROFILE"
printf "   Covers Claude Code and any OpenAI- or Anthropic-SDK tool.\n"
printf "   Apps you open from the dock (like Cursor) need one setting in their UI: %s/guide\n" "$HOST"
printf "   To undo:  curl -fsSL %s/connect.sh | sh -s -- --uninstall\n\n" "$HOST"
