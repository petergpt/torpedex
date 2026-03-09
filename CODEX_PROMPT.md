# Codex Starter Prompt

Copy this into Codex:

```text
Let's play Torpedex! This is a long-running monitoring task, not a one-shot setup task. Do not inspect the workspace or reuse an existing checkout. Run exactly this first: tmp="$(mktemp -d /tmp/torpedex-XXXXXX)" && git clone --depth 1 https://github.com/petergpt/torpedex.git "$tmp" && cd "$tmp" && ./play. After it starts, stay in monitoring mode. Treat `phase=setup` and `phase=playing` as active states. If `phase=playing` and `turn=human`, wait and keep monitoring; that is not completion. Only stop when `phase=finished` or I say stop.
```
