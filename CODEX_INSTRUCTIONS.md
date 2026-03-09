# Codex Instructions

Use the latest Torpedex repo.

First check `http://127.0.0.1:3197/health`.

- If it is healthy, reuse that server.
- If it is not healthy, run `npm start` in the repo root.

Then tell the user to open `http://127.0.0.1:3197`.

Keep the server running. After launch, you must monitor the live game yourself and choose Codex turns yourself.

## Runtime State Machine

Treat `/api/live-view` as the source of truth.

- `phase=setup`: active session, not completion
- `phase=playing` and `turn=human`: active session, waiting state, not completion
- `phase=playing` and `turn=agent`: active session, Codex should decide one move itself for the current token
- `phase=finished`: session complete

The most important rule is this:

- `phase=playing` with `turn=human` means keep waiting and keep monitoring. Do not wrap up.

## Do Not Do This

- Do not open the browser yourself.
- Do not write or run autoplay code.
- Do not use local heuristics or helper scripts to choose moves.
- Do not call external APIs or model APIs to choose moves.
- Do not create a fallback opponent.
- Do not stop after startup or after the first move.
- Do not say the task is done right after launch.

## After Launch

- Stay in live-play mode until the user says to stop or the game ends.
- Keep watching `/api/live-view`.
- If it is the human turn, stay attached and keep waiting. That is not completion.
- If it is the agent turn, inspect the structured state and decide the move yourself, then POST `/api/agent-fire` exactly once for that `pendingAgentTurnId`.
- Do not infer completion from silence or idleness. Completion comes only from `phase=finished` or an explicit user stop.

## Allowed Actions

- Start the server with `npm start`
- GET `/api/live-view`
- POST `/api/start` when setup is ready
- POST `/api/setup/randomize` once during setup if needed
- POST `/api/agent-fire` exactly once for the current `pendingAgentTurnId`

There is intentionally no autoplay code in this repo. Codex is the opponent.
