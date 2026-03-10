# Codex Instructions

Startup contract for live play:

1. Do not inspect, search for, or use any existing local repo or checkout.
2. Do not run commands against any existing local Torpedex clone.
3. Do not read README or other repo files for startup. This file is sufficient.
4. Use a fresh clone of the latest repo.
5. Start the server with `npm start`.
6. Then monitor only `/api/live-view` yourself and play as Codex.

Fresh clone command:

```bash
tmp="$(mktemp -d /tmp/torpedex-XXXXXX)" && git clone --depth 1 https://github.com/petergpt/torpedex.git "$tmp" && cd "$tmp"
```

Run:

```bash
npm start
```

Then tell the user to open `http://127.0.0.1:3197`.

Keep the server running. After launch, you must monitor the live game yourself and choose Codex turns yourself.
Also keep the Captain Feed populated with short real notes via `/api/captain-note`.

## Runtime State Machine

Treat `/api/live-view` as the only fair-play state surface.

- `/api/live-view` is the source of truth for Codex.
- `/api/state` and `/api/stream` are human UI surfaces and off-limits during live play because they can expose hidden board information.
- If you touch a hidden-board surface, say so immediately and stop using that run for fair play.

- `phase=setup`: active session, not completion
- `phase=playing` and `turn=human`: active session, waiting state, not completion
- `phase=playing` and `turn=agent`: active session, Codex should decide one move itself for the current token
- `phase=finished`: session complete

The most important rule is this:

- `phase=playing` with `turn=human` means keep waiting and keep monitoring. Do not wrap up.

## Do Not Do This

- Do not run `ls`, `find`, or similar filesystem discovery commands.
- Do not run `git status`, `git remote -v`, `git fetch`, or `git pull`.
- Do not run any command against an existing local Torpedex checkout.
- Do not do a startup health-check detour instead of starting the server.
- Do not run `npm install` or `npm test`.
- Do not open the browser yourself.
- Do not GET `/api/state`.
- Do not connect to `/api/stream`.
- Do not write or run autoplay code.
- Do not use local heuristics or helper scripts to choose moves.
- Do not call external APIs or model APIs to choose moves.
- Do not create a fallback opponent.
- Do not stop after startup or after the first move.
- Do not say the task is done right after launch.

## After Launch

- Stay in live-play mode until the user says to stop or the game ends.
- Keep watching `/api/live-view`.
- Immediately post one opening Captain Feed note with `/api/captain-note`, for example `On station. Waiting for your opening shot.` with kind `status`.
- If it is the human turn, stay attached and keep waiting. That is not completion.
- When the turn changes back to the human, post a short truthful Captain Feed status note if the feed would otherwise go quiet.
- If it is the agent turn, inspect the structured state and decide the move yourself, then POST `/api/agent-fire` exactly once for that `pendingAgentTurnId`.
- Before or after each Codex shot, post one short truthful Captain Feed note about the move or result.
- Do not infer completion from silence or idleness. Completion comes only from `phase=finished` or an explicit user stop.
- Do not spam the feed on every poll. Add notes on launch, turn changes, and Codex actions.

## Allowed Actions

- Start the server with `npm start`
- GET `/api/live-view`
- POST `/api/start` when setup is ready
- POST `/api/setup/randomize` once during setup if needed
- POST `/api/captain-note` with short real notes
- POST `/api/agent-fire` exactly once for the current `pendingAgentTurnId`

There is intentionally no autoplay code in this repo. Codex is the opponent.
