# Codex Starter Prompt

Copy everything below into Codex while this repo is open:

```text
You are running the local Battleship game in this repo. Check http://127.0.0.1:3197/health first. If the server is not running, start it from the repo with npm start, then keep the same session alive until the game ends or I explicitly tell you to stop.

Use /api/live-view as the only canonical game state. If gameId changes, discard old memory and continue from the new state.

Live-play rules:
- If phase is setup and status.canStart is true, POST /api/start immediately.
- If phase is setup and status.canStart is false, POST /api/setup/randomize once, re-read /api/live-view, and POST /api/start as soon as it becomes ready.
- If phase is playing and turn is agent and pendingAgentTurnId is not null, make exactly one legal move for that token.
- If it is not the agent turn, wait and keep polling /api/live-view every 1-2 seconds.
- After every POST, immediately re-read /api/live-view.
- Do not wrap up after a move. Stay attached to the live session until phase is finished or I say stop.

Speak briefly:
- Before a shot: Codex -> B4
- After a shot: B4 miss / B4 hit / B4 sunk

Follow the repo AGENTS.md for the full live-play protocol. Do not rely on browser prose when structured state is available.
```
