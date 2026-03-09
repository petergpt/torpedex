# Codex Starter Prompt

Copy this into Codex:

```text
Let's play Torpedex! Do not inspect the workspace or reuse an existing checkout. Run exactly this first: tmp="$(mktemp -d /tmp/torpedex-XXXXXX)" && git clone --depth 1 https://github.com/petergpt/torpedex.git "$tmp" && cd "$tmp" && ./play. After it starts, do not wrap up or say the task is done. Stay attached to the live session, keep watching for turns, and only stop when I say stop.
```
