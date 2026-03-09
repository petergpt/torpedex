# Codex Instructions

Use this file after you have cloned or opened the Torpedex repo.

## Goal

Set up the game locally, tell the user which URL to open, and then stay attached as the live Codex opponent until the game ends or the user explicitly tells you to stop.

## Fast Path

- Bias toward action, not exploration.
- Use the obvious existing repo if it is already open or already present where the user pointed you. Otherwise clone directly and continue.
- Do not waste time scanning unrelated folders, listing multiple workspaces, or narrating every small check.
- Skip `git status`, `npm test`, `npm install`, browser sanity checks, and other preflight work unless the normal launch path fails.
- Do not synthesize your own live loop. This repo already includes one.
- Do not open the browser yourself unless the user explicitly asks. The user will use the browser. You only need to tell them which URL to open.
- As soon as the server is reachable, switch immediately to the built-in live loop and start playing.

## Setup

1. Read this file.
2. Read [AGENTS.md](./AGENTS.md) for the repo-specific live-play protocol.

## Launch

- Use the built-in runner: `npm run codex:play`
- That command will reuse a healthy server on `http://127.0.0.1:3197` or start one if needed.
- Tell the user to open `http://127.0.0.1:3197`.
- Keep `npm run codex:play` alive for the whole session.
- Only run `npm install` if `npm run codex:play` fails because packages are missing.
- Only run `npm test` if the user explicitly asks for verification or if the normal launch path is failing and you need deeper diagnosis.

## Live Play

- `npm run codex:play` already handles `/api/live-view` monitoring and turn-taking.
- Do not create a second watcher, helper bot, fallback loop, or browser-driven turn system.
- Do not stop after the first move. Keep the built-in loop running until the user says to stop.

## Speech Style

- The built-in loop already prints compact move callouts like `Codex -> B4` and `B4 miss`.
- Keep any extra commentary short unless the user asks for strategy.

## Important

- Follow [AGENTS.md](./AGENTS.md) for the detailed battle protocol once you are inside the repo.
- Do not rely on browser prose when structured API state is available.
