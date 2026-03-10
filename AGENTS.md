# Battleship Live Play Protocol

Use this protocol for any live Codex-vs-human Battleship session in this repo.

## No Autoplay Code

- There must not be any autoplay script, helper bot, heuristic engine, or API-driven opponent in this repo.
- Codex itself is the opponent during live play.
- Codex should monitor `/api/live-view`, reason from the structured state, and choose the move itself.
- `/api/live-view` is the only fair-play state surface for Codex. `/api/state`, `/api/stream`, browser automation, and any other human UI surface are off-limits because they can expose hidden board data.
- `phase=playing` with `turn=human` is an active waiting state, not a terminal state.
- The assignment ends only at a terminal state or when the user says to stop.

## Fast Start Bias

- Bias toward action, not exploration.
- Do not spend time scanning unrelated folders or enumerating the user's workspace before taking the obvious repo path.
- For startup, do not run `ls`, `find`, `git status`, `git remote -v`, `git fetch`, `git pull`, `npm install`, or `npm test` unless the user explicitly asks or the live path has already failed.
- Do not inspect or use existing local Torpedex repos during startup.
- If the user is not already inside this repo, always prefer a fresh clone over searching the filesystem for existing Torpedex folders.
- Do not run `git status`, `npm test`, `npm install`, browser sanity checks, or similar preflight steps unless the user explicitly asked for them or the normal launch path fails.
- Do not start helper bots, fallback loops, browser-driven turn systems, or local move-selection code.
- Once the server is up, switch immediately to `/api/live-view` monitoring and live play.

## Runtime Bootstrap

- For a fresh startup path, launch the server from the repo with `npm start`.
- If `npm start` fails because port `3197` is already in use, handle that as an explicit port conflict rather than proactively searching for another local repo or server.
- Keep exactly one long-lived server process during live play.
- After launching, open `/api/live-view` immediately and treat that state as canonical.

## Canonical State

- During live play, keep `/api/live-view` open as the canonical state source and re-read it continuously while the game is active.
- Treat `gameId` as the game identity. If `gameId` changes, discard all prior local memory and restart from the new state.
- The minimum fields to trust each turn are:
  - `phase`
  - `turn`
  - `status.canStart`
  - `status.allShipsPlaced`
  - `pendingAgentTurnId`
  - `moveCount`
  - `lastEvent`
  - `lastHumanMove`
  - `lastAgentMove`
  - `codexShots`
- Do not infer state from browser text, console text, or free-form move log prose when the structured fields are present.
- `/api/live-view` now carries both battle state and setup readiness. `/api/state` and `/api/stream` are reserved for the human UI and should not be used by Codex during live play.

## Turn Resolution

- Turn ownership is determined only from structured state.
- If `phase === "setup"` and `status.canStart === true`, POST `/api/start` immediately.
- If `phase === "setup"` and `status.canStart === false`, POST `/api/setup/randomize` once unless the user explicitly asked for manual placement, then re-read `/api/live-view` and POST `/api/start` as soon as `canStart === true`.
- In live-play mode, do not treat a successful restart or a successful shot as the end of the task. The task remains active until the game ends or the user explicitly says to stop.
- If `phase === "finished"`, nobody acts.
- If `phase === "playing"` and `turn === "agent"` and `pendingAgentTurnId` is not `null`, Codex acts exactly once for that token.
- If `phase === "playing"` and it is not the agent turn, wait and poll again. Do not queue a speculative move.
- Fire requests should include `pendingAgentTurnId` as a turn token. If the request fails or the token is stale, immediately re-read live state and do not trust local assumptions.

## Session Continuity

- A live game is not a normal request-response task. Once the user says to start live play, stay attached to the session and keep monitoring without "wrapping up" after each move.
- Do not send a final closeout message while the game is still active. Use short commentary updates for move calls, results, and notable state changes, then continue monitoring.
- After each Codex move, immediately return to watching structured state for the next human action.
- If the server restarts, reconnect to the fresh `gameId`, confirm the new state, and continue instead of treating the restart as completion.
- A `gameId` change during live play is a continuation event, not completion. Do not summarize the old game, ask whether to continue, or yield a final message. Re-branch on the new state and keep the same monitoring loop alive.
- If the user asks for design or protocol changes during live play, make the change, restart if required, then resume monitoring on the new game rather than ending the session.
- The live session ends only when one of these is true:
  - `phase === "finished"`
  - the user explicitly says to stop
  - the user explicitly redirects to a different non-live task
- Operational loop:
  - while live session active, GET `/api/live-view` every 1-2s
  - if `phase === "setup"`, branch to the setup rules above
  - if `phase === "playing"` and `turn !== "agent"`, wait and repeat
  - if `phase === "playing"` and `turn === "agent"` and `pendingAgentTurnId !== null`, make exactly one move for that token
  - after any POST, immediately GET `/api/live-view` again
- A successful move, a successful restart, or a short commentary line is never a reason to exit the loop.

## Decision Quality

- Play to resolve information, not to flail. Every shot should either:
  - extend a validated line of hits
  - test a high-value adjacent cell to determine orientation after a single hit
  - or advance a coherent search pattern when no target is active
- Once multiple hits establish a line, lock to that line. Do not wander sideways or mix in unrelated exploratory shots until that target is resolved or proven impossible at one end.
- Prefer finishing damaged ships over starting fresh hunts unless the current target has no legal continuation.
- Keep local target state compact and explicit:
  - `mode`: search or target
  - `anchor hits`: connected unresolved hit cells
  - `orientation`: unknown, horizontal, or vertical
  - `frontier`: the only legal extension cells for the current target
- Recompute that state from the current structured `codexShots` snapshot after every move instead of relying on vague memory.
- Build unresolved hit clusters from `codexShots` where `result === "hit"` and `sunk === false`. Prefer the cluster with the most connected hits. If tied, prefer the cluster containing `lastAgentMove` when applicable. Otherwise use a fixed lexicographic frontier order so choices stay deterministic.
- Do not make "hopeful" shots that break your own inferred constraints. If your current model says only two cells can complete the target, choose between those two.
- If a move feels arbitrary, it is probably wrong. Prefer the move you can justify from state in one sentence.

## Move Selection

- Use `codexShots` as the only durable memory of previous Codex shots.
- Never reconstruct shot history from human-facing prose in `moveLog`.
- Never inspect or rely on hidden board state.
- On a new game, reset any hunt/target memory and recompute from `codexShots`.
- When no target is active, use a stable search pattern that maximizes coverage and avoids redundant low-value neighbors.
- Use parity search as the baseline hunt mode: prefer cells where `(row + col) % 2` matches the active parity until that search space is exhausted, then fill gaps in center-out order.
- When a target is active, choose the highest-confidence continuation before considering any new search cell.

## Verbalization

- Keep live speech short and mechanical.
- Preferred pre-shot callout: `Codex -> B4`
- Preferred result callout:
  - miss: `B4 miss`
  - hit: `B4 hit`
  - sunk: `B4 sunk`
- Do not narrate strategy unless the user asks.
- If the game ends, say one final line: `Game over. Codex won.` or `Game over. You won.`
- If the UI captain feed is enabled, keep it populated. Post an opening status note, then add short truthful notes on turn changes and Codex actions. Do not invent fake “thinking” text.
- Feed notes can be playful, sharp, or a little cocky, but they still need to be true to the move you are actually making.
- Prefer short captain-style reactions over dry system prose. Good: `Center's dead water. Swinging east.` Bad: `Searching alternate coordinates.`

## Implementation Notes

- Prefer structured fields like `coord`, `summary`, `lastEvent`, `lastHumanMove`, and `lastAgentMove` over rebuilding strings in the client.
- Keep `pendingAgentTurnId` monotonic and reject stale tokens server-side.
- One legal move per turn token. No retries on the same turn without a fresh state read.
- Prefer the push stream when available instead of polling only. The browser now consumes `/api/stream`; Codex can still use `/api/live-view` as the canonical turn source.
- During live play, keep one server session only. Avoid helper bots or extra player processes.
- During live play, keep monitoring continuously active. Do not stop polling just because you already spoke or because the last action succeeded.
- During setup, do not spend live turns shuffling ships around unless the user is actively editing the fleet. The default board is already randomized and playable.
- Use compact terminal actions:
  - read `/api/live-view`
  - if setup is ready, call `/api/start`
  - post `/api/captain-note` with a short real summary or reaction at launch, turn changes, and Codex actions
  - decide one legal shot yourself from the structured state
  - post `/api/agent-fire`
  - speak only the coordinate and coarse result
- Batch supporting commands in parallel when possible, but never queue speculative shots before the current `pendingAgentTurnId` is confirmed.
