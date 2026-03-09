# Codex Starter Prompt

Copy everything below into Codex. This version is written for a first-time user, not just someone who already has the repo open.

```text
Set up and run Torpedex for me from scratch, then stay attached as the live Codex opponent.

Repository:
- GitHub URL: https://github.com/petergpt/torpedex
- Preferred local folder name: torpedex

Setup tasks:
1. If the Torpedex repo is not already present in the current workspace, clone https://github.com/petergpt/torpedex into a local folder named torpedex and switch into it.
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
- Follow the repo AGENTS.md for the full live-play protocol.
- Do not rely on browser prose when structured API state is available.
- Keep one long-lived server process and one monitoring loop only.
```
