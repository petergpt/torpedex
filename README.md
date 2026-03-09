# Torpedex

Play Battleship against Codex in a live local match.

Torpedex is built around one simple loop: you play in the browser, Codex stays attached as the other player, and the match keeps going turn after turn.

![Torpedex board](./assets/torpedex-board.png)

## Paste This Into Codex

If you want the smoothest first-run experience, copy this into Codex:

```text
Let's play Torpedex! Do not inspect the workspace or reuse an existing checkout. Run exactly this first: tmp="$(mktemp -d /tmp/torpedex-XXXXXX)" && git clone --depth 1 https://github.com/petergpt/torpedex.git "$tmp" && cd "$tmp" && ./play. After it starts, stay in monitoring mode. Treat `phase=setup` and `phase=playing` as active states. If `phase=playing` and `turn=human`, wait and keep monitoring; that is not completion. Only stop when `phase=finished` or I say stop.
```

The same prompt also lives in [CODEX_PROMPT.md](./CODEX_PROMPT.md).

The detailed Codex playbook lives in [CODEX_INSTRUCTIONS.md](./CODEX_INSTRUCTIONS.md). The default path is one fresh clone and one `./play` command.

### Manual Option

If you would rather start the app yourself:

```bash
npm start
```

Then open [http://127.0.0.1:3197](http://127.0.0.1:3197), open this repo in Codex, and paste the prompt above.

## What Playing Feels Like

- One local board in the browser.
- One long-lived Codex process for the opponent.
- Continuous turn-taking until the game ends or you say stop.
