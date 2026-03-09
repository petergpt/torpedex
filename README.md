# Torpedex

Play Battleship against Codex in a live local match.

Torpedex is built around one simple loop: you play in the browser, Codex stays attached as the other player, and the match keeps going turn after turn.

![Torpedex board](./assets/torpedex-board.png)

## Paste This Into Codex

If you want the smoothest first-run experience, copy this into Codex:

```text
Let's play Torpedex! Use the latest https://github.com/petergpt/torpedex, read CODEX_INSTRUCTIONS.md, then follow it exactly. Start by running npm run codex:play in the foreground and keep it running until I say stop.
```

The same prompt also lives in [CODEX_PROMPT.md](./CODEX_PROMPT.md).

The detailed Codex playbook lives in [CODEX_INSTRUCTIONS.md](./CODEX_INSTRUCTIONS.md). The default path does not need browser automation or a custom loop.

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
