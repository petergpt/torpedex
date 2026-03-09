# Codex Instructions

Default path from outside the repo:

```bash
tmp="$(mktemp -d /tmp/torpedex-XXXXXX)" && git clone --depth 1 https://github.com/petergpt/torpedex.git "$tmp" && cd "$tmp" && ./play
```

If you are already inside a fresh Torpedex checkout, run this exact command now, in the repo root, in the foreground:

```bash
./play
```

Then tell the user to open `http://127.0.0.1:3197`.

Keep that same process running until the user says to stop.

## Do Not Do Anything Before The Command

- Do not look for an existing Torpedex checkout.
- Do not inspect unrelated folders.
- Do not run workspace inspection commands like `pwd` or `ls`.
- Do not run `git status`.
- Do not run `git remote -v`.
- Do not run `git pull`.
- Do not run `git fetch`.
- Do not run `npm test`.
- Do not run `npm install`.
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
