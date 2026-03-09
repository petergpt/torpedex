# Codex Instructions

## Do This

1. Use the latest Torpedex repo.
2. Run `npm run codex:play` in the foreground.
3. Tell the user to open `http://127.0.0.1:3197`.
4. Leave that one process running until the user says to stop.

## Do Not Do This

- Do not inspect unrelated folders.
- Do not run workspace inspection commands like `pwd` or `ls` unless something is actually failing.
- Do not run `git status`.
- Do not run `npm test`.
- Do not run `npm install` unless `npm run codex:play` fails because packages are missing.
- Do not open the browser yourself.
- Do not write your own Node loop.
- Do not create a fallback loop.
- Do not create a second watcher.
- Do not stop after the first move.

## Notes

- `npm run codex:play` already handles server startup, `/api/live-view` monitoring, setup, and turn-taking.
- If the current checkout does not contain `npm run codex:play`, use the latest repo and then run it.
- If `npm run codex:play` fails because packages are missing, run `npm install` and try again.
- The built-in runner prints compact callouts like `Codex -> B4` and `B4 miss`.
