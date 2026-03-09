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

### 1. Start the app

```bash
npm install && npm start
```

Then open [http://127.0.0.1:3197](http://127.0.0.1:3197).

### 2. Open this repo in Codex

Open the repo in Codex so it can read the local files and run the game server if needed.

### 3. Paste the starter prompt

Open [CODEX_PROMPT.md](./CODEX_PROMPT.md), copy the prompt, and paste it into Codex.

That prompt tells Codex to:

- check whether the server is already running
- start the game if setup is ready
- watch `/api/live-view` as the canonical state surface
- make exactly one move per turn token
- stay attached to the live session until the game ends or you say stop

## What Playing Feels Like

- The board usually opens ready to start.
- You click shots in the browser.
- Codex answers on its own turn.
- The session keeps going across multiple turns without you having to re-prompt it.

## Files You Care About

- [CODEX_PROMPT.md](./CODEX_PROMPT.md): the copy-paste starter prompt
- [AGENTS.md](./AGENTS.md): the full live-play protocol Codex follows in this repo
- [server.js](./server.js): local web server
- [lib/game.js](./lib/game.js): game rules and state serialization

## For Tinkerers

If you want to verify the repo before playing:

```bash
npm test
```

The app itself is intentionally simple: one Node server, one browser UI, one structured live state endpoint, and one persistent Codex session.
