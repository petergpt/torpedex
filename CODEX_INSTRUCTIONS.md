# Codex Instructions

Run this exact command now, in the repo root, in the foreground:

```bash
npm run codex:play
```

Then tell the user to open `http://127.0.0.1:3197`.

Keep that same process running until the user says to stop.

## Only If That Command Fails

- If `npm run codex:play` fails because packages are missing, run `npm install` once and retry `npm run codex:play`.
- If the current checkout does not contain `npm run codex:play`, switch to the latest Torpedex repo and then run it.

## Do Not Do Anything Before The Command

- Do not inspect unrelated folders.
- Do not run workspace inspection commands like `pwd` or `ls`.
- Do not run `git status`.
- Do not run `npm test`.
- Do not open the browser yourself.
- Do not write your own loop.
- Do not create a fallback.
- Do not create a second watcher.
- Do not background the main runner.
- Do not stop after startup or after the first move.

## What The Built-In Runner Already Does

- Starts or reuses the local server on `http://127.0.0.1:3197`
- Handles setup and `/api/live-view` monitoring
- Takes exactly one move per `pendingAgentTurnId`
- Prints compact callouts like `Codex -> B4` and `B4 miss`
- Stays alive for the full match
