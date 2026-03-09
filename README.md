# Torpedex

Play Battleship against Codex in a live local match.

Torpedex is a small local game built around one simple loop: you play in the browser, Codex plays the other side, and the Codex session stays attached for the whole match instead of stopping after a single move.

![Torpedex board](./assets/torpedex-board.png)

## Why This Exists

Most AI game demos are one-shot. Torpedex is built for continuous play:

- You open one local board.
- You paste one prompt into Codex.
- Codex keeps monitoring the live state and responds turn after turn until the game ends.

## Get Playing

Requires Node.js 20 or newer.

### Paste This Into Codex

If you want the smoothest first-run experience, copy this into Codex:

Let's play Torpedex! Clone or open https://github.com/petergpt/torpedex, read `CODEX_INSTRUCTIONS.md`, launch it at http://127.0.0.1:3197 if available, tell me exactly which local URL to open, and stay in the captain's chair as the live opponent until I say stop.

The same prompt also lives in [CODEX_PROMPT.md](./CODEX_PROMPT.md).

The detailed Codex playbook lives in [CODEX_INSTRUCTIONS.md](./CODEX_INSTRUCTIONS.md).

### Manual Option

If you would rather start the app yourself:

```bash
npm install && npm start
```

Then open [http://127.0.0.1:3197](http://127.0.0.1:3197), open this repo in Codex, and paste the prompt above.

## What Playing Feels Like

- The board usually opens ready to start.
- You click shots in the browser.
- Codex answers on its own turn.
- The session keeps going across multiple turns without you having to re-prompt it.

## Files You Care About

- [CODEX_PROMPT.md](./CODEX_PROMPT.md): the copy-paste starter prompt
- [CODEX_INSTRUCTIONS.md](./CODEX_INSTRUCTIONS.md): the detailed Codex setup and live-play instructions
- [AGENTS.md](./AGENTS.md): the full live-play protocol Codex follows in this repo
- [server.js](./server.js): local web server
- [lib/game.js](./lib/game.js): game rules and state serialization

## For Tinkerers

If you want to verify the repo before playing:

```bash
npm test
```

The app itself is intentionally simple: one Node server, one browser UI, one structured live state endpoint, and one persistent Codex session.
