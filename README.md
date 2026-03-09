# Torpedex

Play Battleship against Codex in a live local match.

Torpedex is built around one simple loop: you play in the browser, Codex stays attached as the other player, and the match keeps going turn after turn.

![Torpedex board](./assets/torpedex-board.png)

## Paste This Into Codex

If you want the smoothest first-run experience, copy this into Codex:

```text
Let's play Torpedex! Clone or open the latest https://github.com/petergpt/torpedex, read CODEX_INSTRUCTIONS.md, use the server already running on http://127.0.0.1:3197 if it is healthy or otherwise start it with npm start, tell me to open http://127.0.0.1:3197, then monitor /api/live-view yourself and play as Codex until phase=finished or I say stop. Do not write or run autoplay code, helper scripts, local heuristics, or external API opponents.
```

The same prompt also lives in [CODEX_PROMPT.md](./CODEX_PROMPT.md).

The detailed Codex playbook lives in [CODEX_INSTRUCTIONS.md](./CODEX_INSTRUCTIONS.md). There is intentionally no autoplay script in this repo.

### Manual Option

If you would rather start the app yourself:

```bash
npm start
```

Then open [http://127.0.0.1:3197](http://127.0.0.1:3197), open this repo in Codex, and paste the prompt above.

## What Playing Feels Like

- One local board in the browser.
- One long-lived Codex process for the opponent.
- Continuous turn-taking until the game ends or you say stop.
