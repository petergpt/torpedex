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

If you want the smoothest first-run experience, copy this entire prompt into Codex:

```text
Set up and run Torpedex for me from scratch, then stay attached as the live Codex opponent.

Repository:
- GitHub URL: https://github.com/petergpt/torpedex
- Preferred local folder name: torpedex

Setup tasks:
1. If the repo is not already present in the current workspace, clone https://github.com/petergpt/torpedex into a local folder named torpedex and switch into it.
2. Read README.md and AGENTS.md so you follow the intended launch and live-play flow.
3. Run npm install.
4. Run npm test once to confirm the repo is healthy.
5. Get the app running locally.

Runtime rules:
- Prefer port 3197.
- Before starting a new server, check http://127.0.0.1:3197/health.
- If 3197 is already serving a healthy Torpedex game, reuse that server instead of starting a second one.
- If no healthy server is running, start the app from the repo with npm start and keep that server process alive for the whole session.
- Once the app is reachable, tell me exactly which local URL to open.

Live play rules:
- Use /api/live-view as the only canonical game state.
- If gameId changes, discard old memory and continue from the new game.
- If phase is setup and status.canStart is true, POST /api/start immediately.
- If phase is setup and status.canStart is false, POST /api/setup/randomize once, re-read /api/live-view, and POST /api/start as soon as it becomes ready.
- If phase is playing and turn is agent and pendingAgentTurnId is not null, make exactly one legal move for that token.
- If it is not the agent turn, wait and keep polling /api/live-view every 1-2 seconds.
- After every POST, immediately re-read /api/live-view.
- Do not wrap up after one move. Stay attached to the live session until the game ends or I explicitly tell you to stop.

Speech style:
- Before a shot: Codex -> B4
- After a shot: B4 miss / B4 hit / B4 sunk
- Keep commentary short and mechanical unless I ask for strategy.

Important:
- Follow the repo AGENTS.md for the full live-play protocol once you are inside the repo.
- Do not rely on browser prose when structured API state is available.
- Keep one long-lived server process and one monitoring loop only.
```

The same prompt also lives in [CODEX_PROMPT.md](./CODEX_PROMPT.md).

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
- [AGENTS.md](./AGENTS.md): the full live-play protocol Codex follows in this repo
- [server.js](./server.js): local web server
- [lib/game.js](./lib/game.js): game rules and state serialization

## For Tinkerers

If you want to verify the repo before playing:

```bash
npm test
```

The app itself is intentionally simple: one Node server, one browser UI, one structured live state endpoint, and one persistent Codex session.
