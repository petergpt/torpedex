# Codex Starter Prompt

Copy this into Codex:

```text
Let's play Torpedex! Do not inspect, search for, or use any existing local repos or checkouts. Always start from a fresh temp clone with `tmp="$(mktemp -d /tmp/torpedex-XXXXXX)" && git clone --depth 1 https://github.com/petergpt/torpedex.git "$tmp" && cd "$tmp"`. Then read only `CODEX_INSTRUCTIONS.md` and follow it exactly. Start the server with `npm start`, tell me to open http://127.0.0.1:3197, and monitor `/api/live-view` yourself until `phase=finished` or I say stop. Do not run commands against any existing local Torpedex repo. Do not run `ls`, `find`, `git status`, `git fetch`, `git pull`, `npm install`, `npm test`, browser tools, autoplay code, helper scripts, local heuristics, or external API opponents.
```
