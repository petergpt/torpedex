const refs = {
  appShell: document.getElementById("app-shell"),
  phaseChip: document.getElementById("phase-chip"),
  phaseChipText: document.getElementById("phase-chip-text"),
  turnChip: document.getElementById("turn-chip"),
  turnChipText: document.getElementById("turn-chip-text"),
  humanCount: document.getElementById("human-count"),
  agentCount: document.getElementById("agent-count"),
  battlefieldStatus: document.getElementById("battlefield-status"),
  ownBoard: document.getElementById("own-board"),
  targetBoard: document.getElementById("target-board"),
  ownFrame: document.getElementById("own-frame"),
  targetFrame: document.getElementById("target-frame"),
  humanFleetStrip: document.getElementById("human-fleet-strip"),
  agentFleetStrip: document.getElementById("agent-fleet-strip"),
  setupDock: document.getElementById("setup-dock"),
  shipPicker: document.getElementById("ship-picker"),
  rotateButton: document.getElementById("rotate-button"),
  randomizeButton: document.getElementById("randomize-button"),
  clearButton: document.getElementById("clear-button"),
  startButton: document.getElementById("start-button"),
  resetButton: document.getElementById("reset-button"),
  feedbackOverlay: document.getElementById("feedback-overlay"),
  feedbackIcon: document.getElementById("feedback-icon"),
  feedbackText: document.getElementById("feedback-text"),
  captainPanel: document.getElementById("captain-panel"),
  captainToggle: document.getElementById("captain-toggle"),
  captainConsoleState: document.getElementById("captain-console-state"),
  captainFeed: document.getElementById("captain-feed"),
  srStatus: document.getElementById("sr-status"),
};

const letters = Array.from({ length: 10 }, (_, index) =>
  String.fromCharCode(65 + index),
);

const POLL_INTERVAL_MS = 5000;
const STREAM_RETRY_MS = 1500;

const uiState = {
  game: null,
  selectedShipKey: null,
  orientation: "horizontal",
  hoverCell: null,
  pendingAction: false,
  inlineError: "",
  pollController: null,
  stream: null,
  streamRetryTimer: null,
  overlayTimer: null,
  overlayFollowUpTimer: null,
  overlayNonce: 0,
  captainPanelOpen: loadCaptainPanelOpen(),
};

refs.rotateButton.addEventListener("click", () => {
  uiState.orientation =
    uiState.orientation === "horizontal" ? "vertical" : "horizontal";
  render();
});

refs.randomizeButton.addEventListener("click", () => {
  runAction("/api/setup/randomize");
});

refs.clearButton.addEventListener("click", () => {
  runAction("/api/setup/clear");
});

refs.startButton.addEventListener("click", () => {
  runAction("/api/start");
});

refs.resetButton.addEventListener("click", () => {
  runAction("/api/rematch");
});

refs.captainToggle.addEventListener("click", () => {
  uiState.captainPanelOpen = !uiState.captainPanelOpen;
  persistCaptainPanelOpen(uiState.captainPanelOpen);
  render();
});

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") {
    refreshState({ force: true });
  }
});

window.addEventListener("resize", scheduleFit);

connectStream();
refreshState({ force: true });
window.setInterval(() => refreshState(), POLL_INTERVAL_MS);

async function refreshState(options = {}) {
  if (uiState.pendingAction && !options.force) {
    return;
  }

  if (uiState.pollController) {
    uiState.pollController.abort();
  }

  const controller = new AbortController();
  uiState.pollController = controller;

  try {
    const response = await fetch("/api/state", {
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });
    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.error || "Could not load the game.");
    }
    applyGameState(payload, "poll");
  } catch (error) {
    if (error.name === "AbortError") {
      return;
    }
    uiState.inlineError = error.message;
    renderDisconnected();
  } finally {
    if (uiState.pollController === controller) {
      uiState.pollController = null;
    }
  }
}

async function runAction(pathname, body = {}) {
  uiState.pendingAction = true;
  uiState.inlineError = "";

  if (uiState.pollController) {
    uiState.pollController.abort();
  }

  render();

  try {
    const response = await fetch(pathname, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.error || "Action failed.");
    }
    applyGameState(payload.state || payload, "action");
    return payload;
  } catch (error) {
    uiState.inlineError = error.message;
    showFeedback({ text: "Blocked", tone: "error", icon: "!" });
    render();
    return null;
  } finally {
    uiState.pendingAction = false;
    render();
  }
}

function connectStream() {
  if (uiState.stream) {
    uiState.stream.close();
  }

  const stream = new EventSource("/api/stream");
  uiState.stream = stream;

  stream.addEventListener("state", (event) => {
    try {
      const payload = JSON.parse(event.data);
      applyGameState(payload.state || payload, "stream");
    } catch (error) {
      // Ignore malformed events and wait for the next state update.
    }
  });

  stream.onerror = () => {
    stream.close();
    if (uiState.stream === stream) {
      uiState.stream = null;
    }
    if (!uiState.streamRetryTimer) {
      uiState.streamRetryTimer = window.setTimeout(() => {
        uiState.streamRetryTimer = null;
        connectStream();
      }, STREAM_RETRY_MS);
    }
  };
}

function applyGameState(nextGame, source) {
  if (!nextGame || !shouldAcceptState(nextGame)) {
    return;
  }

  const previousGame = uiState.game;
  uiState.game = nextGame;
  uiState.inlineError = "";
  syncSelection();
  maybeShowFeedback(previousGame, nextGame, source);
  render();
}

function shouldAcceptState(nextGame) {
  if (!uiState.game) {
    return true;
  }

  if (uiState.game.id !== nextGame.id) {
    return true;
  }

  if (uiState.game.updatedAt === nextGame.updatedAt) {
    return false;
  }

  const currentStamp = Date.parse(uiState.game.updatedAt || 0);
  const nextStamp = Date.parse(nextGame.updatedAt || 0);
  return Number.isNaN(currentStamp) || Number.isNaN(nextStamp) || nextStamp >= currentStamp;
}

function maybeShowFeedback(previousGame, nextGame, source) {
  refs.srStatus.textContent = buildScreenReaderStatus(nextGame);
  cancelFollowUpFeedback();

  if (!previousGame) {
    return;
  }

  if (previousGame.id !== nextGame.id) {
    showFeedback({ text: "New Match", tone: "ready", icon: "+" });
    return;
  }

  if (
    previousGame.phase === "setup" &&
    nextGame.phase === "setup" &&
    !previousGame.status.allShipsPlaced &&
    nextGame.status.allShipsPlaced
  ) {
    showFeedback({ text: "Ready", tone: "ready", icon: "+" });
    return;
  }

  if (previousGame.phase !== nextGame.phase && nextGame.phase === "finished") {
    showFeedback(
      nextGame.winner === "human"
        ? { text: "Victory", tone: "victory", icon: "*" }
        : { text: "Defeat", tone: "danger", icon: "X" },
    );
    return;
  }

  const eventChanged =
    previousGame.moveCount !== nextGame.moveCount ||
    previousGame.event?.title !== nextGame.event?.title ||
    previousGame.event?.coord !== nextGame.event?.coord;

  if (eventChanged && nextGame.phase !== "setup") {
    showFeedback(feedbackFromEvent(nextGame));
    const followUp = buildTurnChangeFeedback(previousGame, nextGame);
    if (followUp) {
      queueFollowUpFeedback(followUp, 1200, source === "poll");
    }
    return;
  }

  const turnChange = buildTurnChangeFeedback(previousGame, nextGame);
  if (turnChange) {
    showFeedback(turnChange, { quiet: source === "poll", duration: 1650 });
  }
}

function feedbackFromEvent(game) {
  const event = game.event;
  if (!event) {
    return { text: "Battle", tone: "ready", icon: "+" };
  }

  if (event.kind === "win") {
    return game.winner === "human"
      ? { text: "Victory", tone: "victory", icon: "*" }
      : { text: "Defeat", tone: "danger", icon: "X" };
  }

  if (event.actor === "human") {
    if (event.kind === "sunk") {
      return { text: "Sunk", tone: "sunk", icon: "X" };
    }
    if (event.kind === "hit") {
      return { text: "Hit", tone: "hit", icon: "!" };
    }
    if (event.kind === "miss") {
      return { text: "Miss", tone: "miss", icon: "O" };
    }
  }

  if (event.actor === "agent") {
    if (event.kind === "sunk") {
      return { text: "Ship Lost", tone: "danger", icon: "X" };
    }
    if (event.kind === "hit") {
      return { text: "Fleet Hit", tone: "danger", icon: "!" };
    }
    return { text: "Your Turn", tone: "human", icon: "+" };
  }

  if (game.turn === "human") {
    return { text: "Your Turn", tone: "human", icon: "+" };
  }

  return { text: "Codex Turn", tone: "agent", icon: "~" };
}

function showFeedback(message, options = {}) {
  if (!message || !message.text) {
    return;
  }

  if (options.quiet) {
    return;
  }

  window.clearTimeout(uiState.overlayTimer);
  uiState.overlayNonce += 1;
  refs.feedbackOverlay.dataset.tone = message.tone || "ready";
  refs.feedbackOverlay.dataset.nonce = String(uiState.overlayNonce);
  refs.feedbackIcon.textContent = message.icon || "";
  refs.feedbackText.textContent = message.text;
  refs.feedbackOverlay.classList.add("visible");

  const duration = options.duration ?? 1100;
  uiState.overlayTimer = window.setTimeout(() => {
    refs.feedbackOverlay.classList.remove("visible");
  }, duration);
}

function buildTurnChangeFeedback(previousGame, nextGame) {
  if (previousGame.turn === nextGame.turn || nextGame.phase !== "playing") {
    return null;
  }

  return nextGame.turn === "human"
    ? { text: "Your Turn", tone: "human", icon: "+" }
    : { text: "Codex Turn", tone: "agent", icon: "~" };
}

function cancelFollowUpFeedback() {
  if (!uiState.overlayFollowUpTimer) {
    return;
  }
  window.clearTimeout(uiState.overlayFollowUpTimer);
  uiState.overlayFollowUpTimer = null;
}

function queueFollowUpFeedback(message, delay, quiet) {
  if (quiet) {
    return;
  }

  cancelFollowUpFeedback();
  uiState.overlayFollowUpTimer = window.setTimeout(() => {
    uiState.overlayFollowUpTimer = null;
    showFeedback(message, { duration: 1650 });
  }, delay);
}

function render() {
  if (!uiState.game) {
    renderDisconnected();
    return;
  }

  document.body.className = `phase-${uiState.game.phase} turn-${uiState.game.turn || "none"}${
    uiState.pendingAction ? " is-busy" : ""
  }`;

  const phaseTone =
    uiState.game.phase === "finished"
      ? "result"
      : uiState.game.phase === "playing"
        ? "battle"
        : "setup";
  refs.phaseChip.dataset.tone = phaseTone;
  refs.phaseChipText.textContent =
    uiState.game.phase === "finished"
      ? "Result"
      : uiState.game.phase === "playing"
        ? "Battle"
        : "Setup";

  refs.turnChip.dataset.tone =
    uiState.game.phase === "finished" ? "result" : uiState.game.turn === "agent" ? "agent" : "human";
  refs.turnChipText.textContent = describeTurnChip(uiState.game);
  refs.humanCount.textContent = String(uiState.game.status.humanShipsRemaining);
  refs.agentCount.textContent = String(uiState.game.status.agentShipsRemaining);

  refs.battlefieldStatus.textContent = describeBattlefieldStatus(uiState.game);
  refs.ownFrame.dataset.active = String(isOwnBoardActive(uiState.game));
  refs.targetFrame.dataset.active = String(isTargetBoardActive(uiState.game));

  refs.setupDock.hidden = uiState.game.phase !== "setup";
  refs.rotateButton.disabled = uiState.game.phase !== "setup" || uiState.pendingAction;
  refs.randomizeButton.disabled = uiState.game.phase !== "setup" || uiState.pendingAction;
  refs.clearButton.disabled = uiState.game.phase !== "setup" || uiState.pendingAction;
  refs.startButton.disabled =
    uiState.game.phase !== "setup" || !uiState.game.status.canStart || uiState.pendingAction;
  refs.startButton.classList.toggle(
    "ready",
    uiState.game.phase === "setup" && uiState.game.status.canStart && !uiState.pendingAction,
  );
  refs.turnChip.classList.toggle(
    "thinking",
    uiState.game.phase === "playing" && uiState.game.turn === "agent",
  );
  refs.battlefieldStatus.classList.toggle(
    "thinking",
    uiState.game.phase === "playing" && uiState.game.turn === "agent",
  );
  refs.captainPanel.classList.toggle("collapsed", !uiState.captainPanelOpen);
  refs.captainToggle.setAttribute("aria-expanded", String(uiState.captainPanelOpen));

  renderBoards();
  renderShipPicker();
  renderFleetStrip(refs.humanFleetStrip, uiState.game.setup.ships, "human");
  renderFleetStrip(refs.agentFleetStrip, buildAgentFleetStatus(), "agent");
  renderCaptainFeed();
  scheduleFit();
}

function renderDisconnected() {
  document.body.className = "offline";
  refs.phaseChip.dataset.tone = "error";
  refs.turnChip.dataset.tone = "error";
  refs.phaseChipText.textContent = "Offline";
  refs.turnChipText.textContent = "Reconnect";
  refs.humanCount.textContent = "-";
  refs.agentCount.textContent = "-";
  refs.battlefieldStatus.textContent = "Offline";
  refs.setupDock.hidden = false;
  refs.shipPicker.innerHTML = "";
  refs.captainPanel.classList.toggle("collapsed", !uiState.captainPanelOpen);
  refs.captainToggle.setAttribute("aria-expanded", String(uiState.captainPanelOpen));
  refs.captainConsoleState.textContent = "OFFLINE";
  refs.captainFeed.innerHTML = "";
  scheduleFit();
}

function renderBoards() {
  const ownView = buildOwnBoardView();
  const targetView = buildTargetBoardView();

  renderBoard({
    container: refs.ownBoard,
    cells: ownView.cells,
    overlays: ownView.overlays,
    mode: uiState.game.phase === "setup" ? "setup" : "static",
  });

  renderBoard({
    container: refs.targetBoard,
    cells: targetView.cells,
    overlays: [],
    mode: uiState.game.phase === "playing" ? "target" : "static",
  });
}

function renderBoard({ container, cells, overlays, mode }) {
  container.innerHTML = "";
  container.appendChild(buildAxisCell("", true));
  for (let col = 0; col < 10; col += 1) {
    container.appendChild(buildAxisCell(String(col + 1), false));
  }

  for (let row = 0; row < 10; row += 1) {
    container.appendChild(buildAxisCell(letters[row], false));

    for (let col = 0; col < 10; col += 1) {
      const cell = cells[row][col];
      const element = document.createElement("button");
      element.type = "button";
      element.className = buildCellClassName(cell, mode);
      element.disabled = Boolean(cell.spent);
      element.dataset.row = String(row);
      element.dataset.col = String(col);
      element.setAttribute("aria-label", cell.label);
      if (cell.locked) {
        element.setAttribute("aria-disabled", "true");
      }
      container.appendChild(element);
    }
  }

  for (const overlay of overlays) {
    container.appendChild(buildShipOverlay(overlay));
  }

  attachBoardHandlers(container, mode);
}

function buildOwnBoardView() {
  const shipMap = createShipMap(uiState.game.humanBoard.ships);
  const shotMap = createShotMap(uiState.game.humanBoard.shots);
  const preview = buildPreviewShip();
  const lastActionKey = getLastActionKey("agent");
  const rows = [];

  for (let row = 0; row < 10; row += 1) {
    const columns = [];
    for (let col = 0; col < 10; col += 1) {
      const key = cellKey(row, col);
      const shot = shotMap.get(key);
      const classes = [];

      if (shipMap.has(key)) {
        classes.push("occupied");
      }
      if (preview.map.has(key)) {
        classes.push(preview.valid ? "preview-valid" : "preview-invalid");
      }
      if (shot) {
        classes.push(shot.sunk ? "sunk" : shot.result);
      }
      if (lastActionKey === key) {
        classes.push("last-action");
      }

      columns.push({
        classes,
        spent: Boolean(shot),
        locked: uiState.pendingAction,
        label: `Your board ${letters[row]}${col + 1}`,
      });
    }
    rows.push(columns);
  }

  const overlays = buildShipOverlays(uiState.game.humanBoard.ships);
  if (preview.overlay) {
    overlays.push(preview.overlay);
  }

  return { cells: rows, overlays };
}

function buildTargetBoardView() {
  const shotMap = createShotMap(uiState.game.targetBoard.shots);
  const lastActionKey = getLastActionKey("human");
  const rows = [];

  for (let row = 0; row < 10; row += 1) {
    const columns = [];
    for (let col = 0; col < 10; col += 1) {
      const key = cellKey(row, col);
      const shot = shotMap.get(key);
      const classes = [];

      if (shot) {
        classes.push(shot.sunk ? "sunk" : shot.result);
      }
      if (lastActionKey === key) {
        classes.push("last-action");
      }
      if (!shot && !uiState.game.status.canShoot) {
        classes.push("locked");
      }

      columns.push({
        classes,
        spent: Boolean(shot),
        locked: !uiState.game.status.canShoot || uiState.pendingAction,
        label: `Target board ${letters[row]}${col + 1}`,
      });
    }
    rows.push(columns);
  }

  return { cells: rows };
}

function buildPreviewShip() {
  const ship = currentSelectedShip();
  if (
    uiState.game.phase !== "setup" ||
    !ship ||
    !uiState.hoverCell ||
    uiState.pendingAction
  ) {
    return {
      valid: false,
      map: new Map(),
      overlay: null,
    };
  }

  const cells = Array.from({ length: ship.length }, (_, index) => ({
    row: uiState.hoverCell.row + (uiState.orientation === "vertical" ? index : 0),
    col: uiState.hoverCell.col + (uiState.orientation === "horizontal" ? index : 0),
  }));

  const valid = cells.every((cell) => {
    if (cell.row < 0 || cell.row >= 10 || cell.col < 0 || cell.col >= 10) {
      return false;
    }
    return !isOccupiedByOtherShip(ship.key, cell.row, cell.col);
  });

  return {
    valid,
    map: new Map(cells.map((cell) => [cellKey(cell.row, cell.col), cell])),
    overlay: {
      key: ship.key,
      row: cells[0].row,
      col: cells[0].col,
      length: ship.length,
      orientation: uiState.orientation,
      stateClass: valid ? "is-preview" : "is-preview is-invalid",
    },
  };
}

function buildShipOverlays(ships) {
  return ships.map((ship) => ({
    key: ship.key,
    row: ship.cells[0].row,
    col: ship.cells[0].col,
    length: ship.length,
    orientation: ship.orientation,
    stateClass: ship.sunk ? "is-sunk" : ship.hits > 0 ? "is-damaged" : "",
  }));
}

function buildShipOverlay(overlay) {
  const element = document.createElement("div");
  element.className = `ship-overlay ship-${overlay.key} ${overlay.orientation} ${overlay.stateClass}`.trim();
  element.style.setProperty("--ship-row", String(overlay.row));
  element.style.setProperty("--ship-col", String(overlay.col));
  element.style.setProperty("--ship-length", String(overlay.length));
  element.appendChild(buildShipRender("overlay"));
  return element;
}

function renderShipPicker() {
  refs.shipPicker.innerHTML = "";

  if (uiState.game.phase !== "setup") {
    return;
  }

  for (const ship of uiState.game.setup.ships) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `ship-picker-card${
      ship.key === uiState.selectedShipKey ? " selected" : ""
    }${ship.placed ? " placed" : ""}`;
    button.setAttribute("aria-label", ship.name);
    button.title = ship.name;
    button.addEventListener("click", () => {
      uiState.selectedShipKey = ship.key;
      if (ship.orientation) {
        uiState.orientation = ship.orientation;
      }
      render();
    });

    const silhouette = buildShipMiniature(ship, "picker");
    const status = document.createElement("div");
    status.className = "ship-picker-status";
    for (let index = 0; index < ship.length; index += 1) {
      const pip = document.createElement("span");
      pip.className = "ship-picker-pip";
      if (ship.placed || index < ship.hits) {
        pip.classList.add("active");
      }
      if (ship.sunk) {
        pip.classList.add("destroyed");
      }
      status.appendChild(pip);
    }

    button.append(silhouette, status);
    refs.shipPicker.appendChild(button);
  }
}

function renderFleetStrip(container, ships, side) {
  container.innerHTML = "";
  for (const ship of ships) {
    const card = document.createElement("article");
    card.className = `fleet-strip-card ${side} ${
      ship.sunk ? "sunk" : ship.hits > 0 ? "damaged" : ship.placed ? "ready" : "standby"
    }`;
    card.setAttribute("aria-label", side === "human" ? ship.name : "Enemy ship");
    card.title = side === "human" ? ship.name : ship.sunk ? "Sunk enemy ship" : "Enemy ship";

    const silhouette = buildShipMiniature(ship, "strip");
    const health = document.createElement("div");
    health.className = `fleet-strip-health ${side}`;

    const steps = side === "agent" ? 1 : ship.length;
    for (let index = 0; index < steps; index += 1) {
      const pip = document.createElement("span");
      pip.className = "fleet-strip-pip";
      if (side === "agent") {
        if (ship.sunk) {
          pip.classList.add("destroyed");
        } else {
          pip.classList.add("ghost");
        }
      } else {
        if (ship.sunk) {
          pip.classList.add("destroyed");
        } else if (index < ship.hits) {
          pip.classList.add("damaged");
        } else {
          pip.classList.add("active");
        }
      }
      health.appendChild(pip);
    }

    card.append(silhouette, health);
    container.appendChild(card);
  }
}

function buildShipMiniature(ship, mode) {
  const element = document.createElement("div");
  const stateClass = ship.sunk ? "is-sunk" : ship.hits > 0 ? "is-damaged" : "";
  element.className = `ship-miniature ${mode} ship-${ship.key} ${stateClass}`.trim();
  element.style.setProperty("--ship-length", String(ship.length));
  element.appendChild(buildShipRender("miniature"));
  return element;
}

function buildShipRender(prefix) {
  const render = document.createElement("span");
  render.className = `ship-${prefix}-render ship-render`;

  const body = document.createElement("span");
  body.className = `ship-${prefix}-body ship-body`;
  const detailA = document.createElement("span");
  detailA.className = `ship-${prefix}-detail ship-detail ship-detail-a`;
  const detailB = document.createElement("span");
  detailB.className = `ship-${prefix}-detail ship-detail ship-detail-b`;
  const detailC = document.createElement("span");
  detailC.className = `ship-${prefix}-detail ship-detail ship-detail-c`;

  render.append(body, detailA, detailB, detailC);
  return render;
}

function attachBoardHandlers(container, mode) {
  container.onclick = null;
  container.onmousemove = null;
  container.onmouseleave = null;

  if (mode === "setup") {
    container.onmousemove = (event) => {
      const cell = event.target.closest(".board-cell");
      if (!cell) {
        return;
      }
      const row = Number(cell.dataset.row);
      const col = Number(cell.dataset.col);
      if (uiState.hoverCell?.row === row && uiState.hoverCell?.col === col) {
        return;
      }
      uiState.hoverCell = { row, col };
      render();
    };

    container.onmouseleave = () => {
      if (!uiState.hoverCell) {
        return;
      }
      uiState.hoverCell = null;
      render();
    };

    container.onclick = (event) => {
      const cell = event.target.closest(".board-cell");
      if (!cell) {
        return;
      }
      handleOwnBoardClick(Number(cell.dataset.row), Number(cell.dataset.col));
    };
  }

  if (mode === "target") {
    container.onclick = (event) => {
      const cell = event.target.closest(".board-cell");
      if (!cell) {
        return;
      }
      handleTargetBoardClick(Number(cell.dataset.row), Number(cell.dataset.col));
    };
  }
}

async function handleOwnBoardClick(row, col) {
  const ship = currentSelectedShip();
  if (!ship || uiState.game.phase !== "setup" || uiState.pendingAction) {
    return;
  }

  const payload = await runAction("/api/setup/place", {
    shipKey: ship.key,
    row,
    col,
    orientation: uiState.orientation,
  });

  if (!payload || !uiState.game || uiState.game.phase !== "setup") {
    return;
  }

  uiState.hoverCell = null;
  const nextShip = uiState.game.setup.ships.find((candidate) => !candidate.placed);
  if (nextShip) {
    uiState.selectedShipKey = nextShip.key;
  }
  render();
}

async function handleTargetBoardClick(row, col) {
  if (!uiState.game || uiState.game.phase !== "playing" || uiState.pendingAction) {
    return;
  }

  const key = cellKey(row, col);
  if (createShotMap(uiState.game.targetBoard.shots).has(key)) {
    return;
  }

  if (uiState.game.turn !== "human") {
    await refreshState({ force: true });
    if (
      !uiState.game ||
      uiState.game.phase !== "playing" ||
      uiState.game.turn !== "human" ||
      createShotMap(uiState.game.targetBoard.shots).has(key)
    ) {
      return;
    }
  }

  await runAction("/api/fire", { row, col });
}

function buildAgentFleetStatus() {
  const sunkSet = new Set(uiState.game.targetBoard.sunkShips);
  return uiState.game.setup.ships.map((ship) => ({
    ...ship,
    hits: sunkSet.has(ship.key) ? ship.length : 0,
    sunk: sunkSet.has(ship.key),
    placed: true,
  }));
}

function buildAxisCell(text, corner) {
  const element = document.createElement("div");
  element.className = `axis-cell${corner ? " corner" : ""}`;
  element.textContent = text;
  return element;
}

function buildCellClassName(cell, mode) {
  const classes = ["board-cell"];
  if (mode === "setup" || mode === "target") {
    classes.push("interactive");
  }
  classes.push(...cell.classes);
  return classes.join(" ");
}

function createShipMap(ships) {
  const map = new Map();
  for (const ship of ships) {
    for (const cell of ship.cells) {
      map.set(cellKey(cell.row, cell.col), ship.key);
    }
  }
  return map;
}

function createShotMap(shots) {
  return new Map(shots.map((shot) => [cellKey(shot.row, shot.col), shot]));
}

function currentSelectedShip() {
  return uiState.game?.setup?.ships.find((ship) => ship.key === uiState.selectedShipKey) || null;
}

function syncSelection() {
  if (!uiState.game?.setup?.ships?.length) {
    return;
  }

  const current = currentSelectedShip();
  if (current) {
    return;
  }

  const firstUnplaced = uiState.game.setup.ships.find((ship) => !ship.placed);
  uiState.selectedShipKey = (firstUnplaced || uiState.game.setup.ships[0]).key;
  uiState.orientation = firstUnplaced?.orientation || "horizontal";
}

function describeTurnChip(game) {
  if (game.phase === "setup") {
    return game.status.allShipsPlaced ? "Ready" : "Deploy";
  }
  if (game.phase === "finished") {
    return game.winner === "human" ? "Won" : "Lost";
  }
  return game.turn === "human" ? "Your Turn" : "Codex";
}

function describeBattlefieldStatus(game) {
  if (game.phase === "setup") {
    return game.status.canStart ? "Start Battle" : "Place your fleet";
  }
  if (game.phase === "finished") {
    return game.winner === "human" ? "Victory" : "Defeat";
  }
  return game.turn === "human" ? "Your Turn" : "Codex Thinking";
}

function isOwnBoardActive(game) {
  return game.phase === "setup" || (game.phase === "playing" && game.turn === "agent");
}

function isTargetBoardActive(game) {
  return game.phase === "playing" && game.turn === "human";
}

function buildScreenReaderStatus(game) {
  if (uiState.inlineError) {
    return uiState.inlineError;
  }
  if (game.phase === "setup") {
    return game.status.allShipsPlaced ? "Fleet ready. Start battle available." : game.event.detail;
  }
  return game.event?.detail || "";
}

function renderCaptainFeed() {
  refs.captainConsoleState.textContent = describeCaptainConsoleState(uiState.game);
  refs.captainFeed.innerHTML = "";

  const feed = uiState.game.captainFeed || [];
  if (feed.length === 0) {
    const empty = document.createElement("p");
    empty.className = "captain-feed-empty";
    empty.textContent = "> channel open";
    refs.captainFeed.appendChild(empty);
    return;
  }

  for (const entry of feed) {
    refs.captainFeed.appendChild(buildCaptainFeedEntry(entry));
  }
}

function buildCaptainFeedEntry(entry) {
  const article = document.createElement("article");
  article.className = `captain-feed-entry kind-${entry.kind}`;

  const meta = document.createElement("div");
  meta.className = "captain-feed-meta";

  const stamp = document.createElement("span");
  stamp.className = "captain-feed-time";
  stamp.textContent = formatCaptainTime(entry.createdAt);

  const tag = document.createElement("span");
  tag.className = "captain-feed-tag";
  tag.textContent = captainKindLabel(entry.kind);

  meta.append(stamp, tag);

  const text = document.createElement("p");
  text.className = "captain-feed-text";
  text.textContent = entry.text;

  article.append(meta, text);
  return article;
}

function describeCaptainConsoleState(game) {
  if (!game) {
    return "OFFLINE";
  }
  if (game.phase === "setup") {
    return game.status.canStart ? "READY" : "SETUP";
  }
  if (game.phase === "finished") {
    return game.winner === "human" ? "DEFEAT" : "VICTORY";
  }
  return game.turn === "agent" ? "CODEX LIVE" : "STANDBY";
}

function formatCaptainTime(createdAt) {
  const date = new Date(createdAt);
  if (Number.isNaN(date.getTime())) {
    return "--:--:--";
  }
  return new Intl.DateTimeFormat([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(date);
}

function captainKindLabel(kind) {
  switch (kind) {
    case "shot":
      return "SHOT";
    case "react":
      return "REACT";
    case "status":
      return "STATUS";
    default:
      return "NOTE";
  }
}

function getLastActionKey(actor) {
  if (uiState.game.event?.actor !== actor || !uiState.game.event.coord) {
    return null;
  }
  const parsed = parseCoord(uiState.game.event.coord);
  return parsed ? cellKey(parsed.row, parsed.col) : null;
}

function parseCoord(coord) {
  const match = /^([A-Z])(\d+)$/.exec(coord || "");
  if (!match) {
    return null;
  }
  return {
    row: match[1].charCodeAt(0) - 65,
    col: Number(match[2]) - 1,
  };
}

function isOccupiedByOtherShip(shipKey, row, col) {
  return uiState.game.humanBoard.ships.some(
    (ship) =>
      ship.key !== shipKey &&
      ship.cells.some((cell) => cell.row === row && cell.col === col),
  );
}

function cellKey(row, col) {
  return `${row}:${col}`;
}

function loadCaptainPanelOpen() {
  try {
    const saved = window.localStorage.getItem("torpedex-captain-panel-open");
    if (saved === "true") {
      return true;
    }
    if (saved === "false") {
      return false;
    }
  } catch (error) {
    // Ignore storage failures and use viewport-based default.
  }

  return window.innerWidth >= 1600;
}

function persistCaptainPanelOpen(value) {
  try {
    window.localStorage.setItem("torpedex-captain-panel-open", String(value));
  } catch (error) {
    // Ignore storage failures.
  }
}

function scheduleFit() {
  window.requestAnimationFrame(fitToViewport);
}

function fitToViewport() {
  if (!refs.appShell) {
    return;
  }

  refs.appShell.style.setProperty("--fit-scale", "1");
  refs.appShell.style.setProperty("--fit-offset-y", "0px");

  const naturalWidth = refs.appShell.offsetWidth;
  const naturalHeight = refs.appShell.offsetHeight;
  if (!naturalWidth || !naturalHeight) {
    return;
  }

  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const scale = Math.min(
    viewportWidth / naturalWidth,
    viewportHeight / naturalHeight,
    1,
  );

  const scaledHeight = naturalHeight * scale;
  const offsetY = Math.max((viewportHeight - scaledHeight) / 2, 0);

  refs.appShell.style.setProperty("--fit-scale", String(scale));
  refs.appShell.style.setProperty("--fit-offset-y", `${offsetY}px`);
}
