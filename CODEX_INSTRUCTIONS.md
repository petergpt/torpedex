# Codex Instructions

Use this file after you have cloned or opened the Torpedex repo.

## Goal

Set up the game locally, tell the user which URL to open, and then stay attached as the live Codex opponent until the game ends or the user explicitly tells you to stop.

## Fast Path

- Bias toward action, not exploration.
- Use the obvious existing repo if it is already open or already present where the user pointed you. Otherwise clone directly and continue.
- Do not waste time scanning unrelated folders, listing multiple workspaces, or narrating every small check.
- Skip `git status`, `npm test`, browser sanity checks, and other preflight work unless the user explicitly asked for them or the normal launch path fails.
- As soon as the server is reachable, switch immediately to `/api/live-view` monitoring and live play.

## Setup

1. Read [README.md](./README.md) for the user-facing overview.
2. Read [AGENTS.md](./AGENTS.md) for the repo-specific live-play protocol.
3. Run `npm install`.

## Launch

- Prefer port `3197`.
- Before starting a new server, check `http://127.0.0.1:3197/health`.
- If `3197` is already serving a healthy Torpedex game, reuse that server instead of starting a second one.
- If no healthy server is running, start the app from the repo with `npm start`.
- Keep one long-lived server process only.
- Once the app is reachable, tell the user to open `http://127.0.0.1:3197`, then immediately switch to live monitoring.

## Live Play

- Use `/api/live-view` as the only canonical game state.
- If `gameId` changes, discard old memory and continue from the new game.
- If `phase === "setup"` and `status.canStart === true`, `POST /api/start` immediately.
- If `phase === "setup"` and `status.canStart === false`, `POST /api/setup/randomize` once, re-read `/api/live-view`, and `POST /api/start` as soon as it becomes ready.
- If `phase === "playing"` and `turn === "agent"` and `pendingAgentTurnId !== null`, make exactly one legal move for that token.
- If it is not the agent turn, wait and keep polling `/api/live-view` every 1-2 seconds.
- After every `POST`, immediately re-read `/api/live-view`.
- Keep one monitoring loop only.
- Do not wrap up after one move. Stay attached until the game ends or the user says to stop.

## Speech Style

- Before a shot: `Codex -> B4`
- After a shot: `B4 miss` or `B4 hit` or `B4 sunk`
- Keep commentary short and mechanical unless the user asks for strategy.

## Important

- Follow [AGENTS.md](./AGENTS.md) for the detailed battle protocol once you are inside the repo.
- Do not rely on browser prose when structured API state is available.
