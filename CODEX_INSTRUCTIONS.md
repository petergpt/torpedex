# Codex Instructions

Use this file after you have cloned or opened the Torpedex repo.

## Goal

Set up the game locally, tell the user which URL to open, and then stay attached as the live Codex opponent until the game ends or the user explicitly tells you to stop.

## One True Path

- Use the built-in runner: `npm run codex:play`
- Do not write your own Node loop.
- Do not create a fallback loop.
- Do not use browser automation to play turns.
- Do not run startup checks unless `npm run codex:play` fails.

## Fast Path

- Bias toward action, not exploration.
- Use the obvious repo if it is already open. Otherwise clone the latest repo directly and continue.
- If an existing checkout does not already have `npm run codex:play`, update it to the latest version or clone a fresh copy and use that instead.
- Do not waste time scanning unrelated folders, listing multiple workspaces, or narrating every small check.
- Skip `git status`, `npm test`, `npm install`, browser sanity checks, and other preflight work unless `npm run codex:play` fails.
- Do not open the browser yourself unless the user explicitly asks. The user will use the browser. You only need to tell them which URL to open.
- As soon as `npm run codex:play` is running, stop doing setup work.

## Setup

1. Read this file.
2. Read [AGENTS.md](./AGENTS.md) for the repo-specific live-play protocol.

## Launch

- First try: `npm run codex:play`
- That command will reuse a healthy server on `http://127.0.0.1:3197` or start one if needed.
- Tell the user to open `http://127.0.0.1:3197`.
- Keep `npm run codex:play` alive for the whole session.
- Only run `npm install` if `npm run codex:play` fails because packages are missing.
- Only run `npm test` if the user explicitly asks for verification or if the normal launch path is failing and you need deeper diagnosis.
- If the repo is stale and does not contain `npm run codex:play`, get the latest repo and then run it.

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
