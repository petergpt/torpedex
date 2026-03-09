#!/usr/bin/env node

const { spawn } = require("node:child_process");
const path = require("node:path");

const SHIPS = [
  { key: "carrier", length: 5 },
  { key: "battleship", length: 4 },
  { key: "cruiser", length: 3 },
  { key: "submarine", length: 3 },
  { key: "destroyer", length: 2 },
];

const BASE_URL = new URL(process.env.TORPEDEX_BASE_URL || "http://127.0.0.1:3197");
const SERVER_PORT = Number(BASE_URL.port || 3197);
const POLL_INTERVAL_MS = 1000;
const HEALTH_RETRY_MS = 250;
const HEARTBEAT_INTERVAL_MS = 5000;

let managedServer = null;
let currentGameId = null;
let randomizedSetup = false;
let lastHandledToken = null;
let finishedAnnouncedFor = null;
let lastHeartbeatAt = 0;
let startupFailure = null;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function getJson(pathname) {
  const response = await fetch(new URL(pathname, BASE_URL), {
    headers: {
      Accept: "application/json",
      "Cache-Control": "no-store",
    },
  });

  const payload = await response.json();
  if (!response.ok) {
    throw new Error(`GET ${pathname} -> ${response.status}`);
  }
  return payload;
}

async function postJson(pathname, body = {}) {
  const response = await fetch(new URL(pathname, BASE_URL), {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const payload = await response.json();
  if (!response.ok) {
    throw new Error(`POST ${pathname} -> ${response.status}: ${payload.error || "Request failed."}`);
  }
  return payload;
}

async function hasHealthyServer() {
  try {
    const health = await getJson("/health");
    return Boolean(health && health.ok);
  } catch (error) {
    return false;
  }
}

async function ensureServer() {
  if (await hasHealthyServer()) {
    console.log("Reusing existing Torpedex server.");
    console.log(`Open ${BASE_URL.href.replace(/\/$/, "")}`);
    return;
  }

  startupFailure = null;
  console.log("Starting Torpedex server...");
  managedServer = spawn(process.execPath, [path.join(__dirname, "..", "server.js")], {
    cwd: path.join(__dirname, ".."),
    env: { ...process.env, PORT: String(SERVER_PORT) },
    stdio: ["ignore", "pipe", "pipe"],
  });

  managedServer.stdout.on("data", (chunk) => process.stdout.write(chunk));
  managedServer.stderr.on("data", (chunk) => process.stderr.write(chunk));
  managedServer.on("exit", (code, signal) => {
    startupFailure = { code, signal };
    managedServer = null;
    if (signal !== "SIGINT") {
      console.error(`Torpedex server exited${code !== null ? ` with code ${code}` : ""}.`);
    }
  });

  for (;;) {
    if (await hasHealthyServer()) {
      startupFailure = null;
      console.log(`Open ${BASE_URL.href.replace(/\/$/, "")}`);
      return;
    }
    if (startupFailure) {
      throw new Error("Torpedex server failed to start.");
    }
    await sleep(HEALTH_RETRY_MS);
  }
}

async function ensureHealthyRuntime() {
  if (await hasHealthyServer()) {
    return;
  }

  console.log("Reconnecting Torpedex server...");
  await ensureServer();
}

function keyFor(row, col) {
  return `${row},${col}`;
}

function labelFor(row, col) {
  return `${String.fromCharCode(65 + row)}${col + 1}`;
}

function logWaitingState(live) {
  const parts = [`phase=${live.phase}`];
  if (live.turn) {
    parts.push(`turn=${live.turn}`);
  }
  console.log(`Active wait. ${parts.join(" ")}. Monitoring continues.`);
}

function buildShotMap(codexShots) {
  return new Map(codexShots.map((shot) => [keyFor(shot.row, shot.col), shot]));
}

function unresolvedHitClusters(codexShots) {
  const unresolved = codexShots.filter((shot) => shot.result === "hit" && !shot.sunk);
  const byKey = new Map(unresolved.map((shot) => [keyFor(shot.row, shot.col), shot]));
  const visited = new Set();
  const clusters = [];

  for (const shot of unresolved) {
    const startKey = keyFor(shot.row, shot.col);
    if (visited.has(startKey)) {
      continue;
    }

    const stack = [shot];
    const cluster = [];
    visited.add(startKey);

    while (stack.length > 0) {
      const cell = stack.pop();
      cluster.push(cell);

      const neighbors = [
        [cell.row - 1, cell.col],
        [cell.row + 1, cell.col],
        [cell.row, cell.col - 1],
        [cell.row, cell.col + 1],
      ];

      for (const [row, col] of neighbors) {
        const neighborKey = keyFor(row, col);
        if (visited.has(neighborKey) || !byKey.has(neighborKey)) {
          continue;
        }
        visited.add(neighborKey);
        stack.push(byKey.get(neighborKey));
      }
    }

    cluster.sort((a, b) => a.row - b.row || a.col - b.col);
    clusters.push(cluster);
  }

  return clusters.sort((a, b) => {
    if (b.length !== a.length) {
      return b.length - a.length;
    }
    return a[0].row - b[0].row || a[0].col - b[0].col;
  });
}

function chooseFrontier(cluster, shotMap) {
  const frontier = [];
  const seen = new Set();
  const sameRow = cluster.every((cell) => cell.row === cluster[0].row);
  const sameCol = cluster.every((cell) => cell.col === cluster[0].col);

  if (cluster.length > 1 && sameRow) {
    const row = cluster[0].row;
    const cols = cluster.map((cell) => cell.col).sort((a, b) => a - b);
    frontier.push([row, cols[0] - 1], [row, cols[cols.length - 1] + 1]);
  } else if (cluster.length > 1 && sameCol) {
    const col = cluster[0].col;
    const rows = cluster.map((cell) => cell.row).sort((a, b) => a - b);
    frontier.push([rows[0] - 1, col], [rows[rows.length - 1] + 1, col]);
  } else {
    for (const cell of cluster) {
      frontier.push(
        [cell.row - 1, cell.col],
        [cell.row, cell.col - 1],
        [cell.row, cell.col + 1],
        [cell.row + 1, cell.col],
      );
    }
  }

  return frontier
    .filter(([row, col]) => row >= 0 && row < 10 && col >= 0 && col < 10)
    .filter(([row, col]) => !shotMap.has(keyFor(row, col)))
    .filter(([row, col]) => {
      const key = keyFor(row, col);
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    })
    .sort((a, b) => a[0] - b[0] || a[1] - b[1]);
}

function remainingShipLengths(codexShots) {
  const sunkShipKeys = new Set(
    codexShots.filter((shot) => shot.sunk && shot.shipKey).map((shot) => shot.shipKey),
  );

  return SHIPS.filter((ship) => !sunkShipKeys.has(ship.key)).map((ship) => ship.length);
}

function countPlacementsThroughCell(row, col, lengths, shotMap) {
  let total = 0;

  for (const length of lengths) {
    for (let startCol = col - length + 1; startCol <= col; startCol += 1) {
      const endCol = startCol + length - 1;
      if (startCol < 0 || endCol >= 10) {
        continue;
      }

      let blocked = false;
      for (let currentCol = startCol; currentCol <= endCol; currentCol += 1) {
        if (shotMap.has(keyFor(row, currentCol))) {
          blocked = true;
          break;
        }
      }

      if (!blocked) {
        total += 1;
      }
    }

    for (let startRow = row - length + 1; startRow <= row; startRow += 1) {
      const endRow = startRow + length - 1;
      if (startRow < 0 || endRow >= 10) {
        continue;
      }

      let blocked = false;
      for (let currentRow = startRow; currentRow <= endRow; currentRow += 1) {
        if (shotMap.has(keyFor(currentRow, col))) {
          blocked = true;
          break;
        }
      }

      if (!blocked) {
        total += 1;
      }
    }
  }

  return total;
}

function chooseSearchCell(codexShots) {
  const shotMap = buildShotMap(codexShots);
  const lengths = remainingShipLengths(codexShots);
  const candidates = [];

  for (let row = 0; row < 10; row += 1) {
    for (let col = 0; col < 10; col += 1) {
      if (shotMap.has(keyFor(row, col))) {
        continue;
      }

      candidates.push({
        row,
        col,
        parityMatch: (row + col) % 2 === 0,
        fitScore: countPlacementsThroughCell(row, col, lengths, shotMap),
        centerDistance: Math.abs(row - 4.5) + Math.abs(col - 4.5),
      });
    }
  }

  const parityCandidates = candidates.filter((candidate) => candidate.parityMatch);
  const pool = parityCandidates.length > 0 ? parityCandidates : candidates;
  pool.sort((a, b) => {
    if (b.fitScore !== a.fitScore) {
      return b.fitScore - a.fitScore;
    }
    if (a.centerDistance !== b.centerDistance) {
      return a.centerDistance - b.centerDistance;
    }
    return a.row - b.row || a.col - b.col;
  });

  return pool[0];
}

function chooseMove(live) {
  const shotMap = buildShotMap(live.codexShots);
  const clusters = unresolvedHitClusters(live.codexShots);

  if (clusters.length > 0) {
    const last = live.lastAgentMove;
    clusters.sort((a, b) => {
      if (b.length !== a.length) {
        return b.length - a.length;
      }

      const aHasLast =
        last && a.some((cell) => cell.row === last.row && cell.col === last.col);
      const bHasLast =
        last && b.some((cell) => cell.row === last.row && cell.col === last.col);

      if (aHasLast !== bHasLast) {
        return aHasLast ? -1 : 1;
      }

      return a[0].row - b[0].row || a[0].col - b[0].col;
    });

    for (const cluster of clusters) {
      const frontier = chooseFrontier(cluster, shotMap);
      if (frontier.length > 0) {
        return { row: frontier[0][0], col: frontier[0][1] };
      }
    }
  }

  return chooseSearchCell(live.codexShots);
}

function resetGameMemory(gameId) {
  currentGameId = gameId;
  randomizedSetup = false;
  lastHandledToken = null;
  finishedAnnouncedFor = null;
}

async function pollOnce() {
  const live = await getJson("/api/live-view");

  if (live.gameId !== currentGameId) {
    resetGameMemory(live.gameId);
  }

  if (live.phase === "setup") {
    if (live.status.canStart) {
      await postJson("/api/start");
      console.log("Battle started.");
      return;
    }

    if (!randomizedSetup) {
      randomizedSetup = true;
      await postJson("/api/setup/randomize");
      console.log("Fleet randomized.");
      const nextLive = await getJson("/api/live-view");
      if (nextLive.status.canStart) {
        await postJson("/api/start");
        console.log("Battle started.");
      }
    }
    return;
  }

  if (live.phase === "finished") {
    if (finishedAnnouncedFor !== live.gameId) {
      finishedAnnouncedFor = live.gameId;
      console.log(live.winner === "agent" ? "Game over. Codex won." : "Game over. You won.");
    }
    return;
  }

  if (live.turn !== "agent" || live.pendingAgentTurnId == null) {
    const now = Date.now();
    if (now - lastHeartbeatAt >= HEARTBEAT_INTERVAL_MS) {
      lastHeartbeatAt = now;
      logWaitingState(live);
    }
    return;
  }

  const turnToken = Number(live.pendingAgentTurnId);
  if (turnToken === lastHandledToken) {
    return;
  }

  const move = chooseMove(live);
  const coord = labelFor(move.row, move.col);
  console.log(`Codex -> ${coord}`);
  const payload = await postJson("/api/agent-fire", {
    row: move.row,
    col: move.col,
    turnToken,
  });
  lastHandledToken = turnToken;
  console.log(`${coord} ${payload.outcome.result}`);
}

let stopping = false;

function stop() {
  if (stopping) {
    return;
  }
  stopping = true;

  if (managedServer) {
    managedServer.kill("SIGINT");
  }
  process.exit(0);
}

process.on("SIGINT", stop);
process.on("SIGTERM", stop);

(async () => {
  await ensureServer();
  console.log("Live runner attached.");

  while (true) {
    try {
      await ensureHealthyRuntime();
      await pollOnce();
    } catch (error) {
      console.error(error.message);
    }

    await sleep(POLL_INTERVAL_MS);
  }
})().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
