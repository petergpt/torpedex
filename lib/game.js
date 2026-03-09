const { randomUUID } = require("node:crypto");

const BOARD_SIZE = 10;
const SHIP_DEFS = [
  { key: "carrier", name: "Carrier", length: 5 },
  { key: "battleship", name: "Battleship", length: 4 },
  { key: "cruiser", name: "Cruiser", length: 3 },
  { key: "submarine", name: "Submarine", length: 3 },
  { key: "destroyer", name: "Destroyer", length: 2 },
];

function createGrid(fillValue = null) {
  return Array.from({ length: BOARD_SIZE }, () =>
    Array.from({ length: BOARD_SIZE }, () => fillValue),
  );
}

function createShip(definition) {
  return {
    ...definition,
    placed: false,
    sunk: false,
    hits: 0,
    orientation: "horizontal",
    cells: [],
  };
}

function createPlayer() {
  return {
    shipGrid: createGrid(null),
    shotsGrid: createGrid(null),
    ships: SHIP_DEFS.map(createShip),
  };
}

function createGame() {
  const game = {
    id: randomUUID(),
    phase: "setup",
    turn: "human",
    winner: null,
    moveCount: 0,
    agentTurnCounter: 0,
    lastEvent: {
      actor: null,
      kind: "setup",
      title: "Prepare your fleet",
      detail: "Place every ship, or randomize the board and launch when ready.",
      coord: null,
      shipName: null,
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    human: createPlayer(),
    agent: createPlayer(),
    moveLog: [],
    captainFeed: [],
  };

  randomizeFleet(game.human);
  updateSetupEvent(game);
  return game;
}

function placeHumanShip(game, shipKey, row, col, orientation) {
  ensurePhase(game, "setup");
  placeShip(game.human, shipKey, row, col, orientation);
  updateSetupEvent(game);
  return serializeGameForHuman(game);
}

function randomizeHumanFleet(game) {
  ensurePhase(game, "setup");
  randomizeFleet(game.human);
  updateSetupEvent(game);
  return serializeGameForHuman(game);
}

function clearHumanFleet(game) {
  ensurePhase(game, "setup");
  clearFleet(game.human);
  updateSetupEvent(game);
  return serializeGameForHuman(game);
}

function startBattle(game) {
  ensurePhase(game, "setup");
  if (!allShipsPlaced(game.human)) {
    throw new Error("Place every ship before starting the battle.");
  }

  clearFleet(game.agent);
  randomizeFleet(game.agent);
  game.phase = "playing";
  game.turn = "human";
  game.winner = null;
  game.moveCount = 0;
  game.agentTurnCounter = 0;
  game.moveLog = [];
  game.lastEvent = {
    actor: null,
    kind: "battle-start",
    title: "Battle stations",
    detail: "Your fleet is deployed. Fire the opening shot.",
    coord: null,
    shipName: null,
  };
  game.updatedAt = new Date().toISOString();

  return serializeGameForHuman(game);
}

function resetGame(game) {
  const nextGame = createGame();
  Object.assign(game, nextGame);
  return serializeGameForHuman(game);
}

function addCaptainNote(game, text, kind = "note") {
  const normalizedText = String(text || "")
    .replace(/\s+/g, " ")
    .trim();

  if (!normalizedText) {
    throw new Error("Captain note cannot be empty.");
  }

  if (normalizedText.length > 180) {
    throw new Error("Captain note must be 180 characters or fewer.");
  }

  const normalizedKind = ["note", "shot", "react", "status"].includes(kind) ? kind : "note";

  game.captainFeed.push({
    id: randomUUID(),
    author: "codex",
    kind: normalizedKind,
    text: normalizedText,
    createdAt: new Date().toISOString(),
  });

  if (game.captainFeed.length > 18) {
    game.captainFeed.splice(0, game.captainFeed.length - 18);
  }

  game.updatedAt = new Date().toISOString();
  return serializeGameForHuman(game);
}

function takeHumanShot(game, row, col) {
  ensureActiveTurn(game, "human");
  return finalizeShot(game, "human", fireShot(game.agent, row, col));
}

function takeAgentShot(game, row, col, turnToken) {
  ensureActiveTurn(game, "agent");
  if (turnToken !== undefined && turnToken !== null && Number(turnToken) !== game.agentTurnCounter) {
    throw new Error("Stale Codex turn token.");
  }
  return finalizeShot(game, "agent", fireShot(game.human, row, col));
}

function finalizeShot(game, actor, outcome) {
  game.moveCount += 1;
  const defendingPlayer = actor === "human" ? game.agent : game.human;
  const victory = defendingPlayer.ships.every((ship) => ship.sunk);

  const event = buildEvent(actor, outcome, victory);
  game.lastEvent = event;
  game.moveLog.unshift({
    id: randomUUID(),
    actor,
    row: outcome.row,
    col: outcome.col,
    coord: coordToLabel(outcome.row, outcome.col),
    result: outcome.result,
    shipName: outcome.shipName,
    turnNumber: game.moveCount,
    title: event.title,
    detail: event.detail,
    createdAt: new Date().toISOString(),
  });

  if (victory) {
    game.phase = "finished";
    game.turn = null;
    game.winner = actor;
  } else {
    game.turn = actor === "human" ? "agent" : "human";
    if (game.turn === "agent") {
      game.agentTurnCounter += 1;
    }
  }

  game.updatedAt = new Date().toISOString();
  return {
    outcome,
    state: serializeGameForHuman(game),
    live: serializeLiveView(game),
  };
}

function fireShot(player, row, col) {
  if (!inBounds(row, col)) {
    throw new Error("Shot is out of bounds.");
  }
  if (player.shotsGrid[row][col] !== null) {
    throw new Error("That coordinate has already been targeted.");
  }

  const shipKey = player.shipGrid[row][col];
  if (!shipKey) {
    player.shotsGrid[row][col] = "miss";
    return {
      row,
      col,
      coord: coordToLabel(row, col),
      result: "miss",
      shipKey: null,
      shipName: null,
      summary: `${coordToLabel(row, col)} miss`,
    };
  }

  player.shotsGrid[row][col] = "hit";
  const ship = player.ships.find((candidate) => candidate.key === shipKey);
  ship.hits += 1;
  ship.sunk = ship.hits >= ship.length;

  return {
    row,
    col,
    coord: coordToLabel(row, col),
    result: ship.sunk ? "sunk" : "hit",
    shipKey,
    shipName: ship.name,
    summary: `${coordToLabel(row, col)} ${
      ship.sunk ? `sunk ${ship.name}` : `hit ${ship.name}`
    }`,
  };
}

function placeShip(player, shipKey, row, col, orientation) {
  const ship = getShip(player, shipKey);
  const nextOrientation = orientation === "vertical" ? "vertical" : "horizontal";
  const nextCells = buildCells(row, col, ship.length, nextOrientation);

  validatePlacement(player, ship.key, nextCells);

  ship.cells = nextCells;
  ship.orientation = nextOrientation;
  ship.placed = true;
  ship.hits = 0;
  ship.sunk = false;
  rebuildShipGrid(player);
}

function randomizeFleet(player) {
  clearFleet(player);

  for (const ship of player.ships) {
    let placed = false;
    let attempts = 0;

    while (!placed && attempts < 1000) {
      attempts += 1;
      const orientation = Math.random() < 0.5 ? "horizontal" : "vertical";
      const maxRow = orientation === "vertical" ? BOARD_SIZE - ship.length : BOARD_SIZE - 1;
      const maxCol = orientation === "horizontal" ? BOARD_SIZE - ship.length : BOARD_SIZE - 1;
      const row = randomInt(0, maxRow);
      const col = randomInt(0, maxCol);
      const cells = buildCells(row, col, ship.length, orientation);

      try {
        validatePlacement(player, ship.key, cells);
        ship.cells = cells;
        ship.orientation = orientation;
        ship.placed = true;
        placed = true;
      } catch (error) {
        // Keep searching until a legal position is found.
      }
    }

    if (!placed) {
      throw new Error(`Could not place ${ship.name}.`);
    }
  }

  rebuildShipGrid(player);
}

function clearFleet(player) {
  player.shipGrid = createGrid(null);
  player.shotsGrid = createGrid(null);
  for (const ship of player.ships) {
    ship.placed = false;
    ship.sunk = false;
    ship.hits = 0;
    ship.orientation = "horizontal";
    ship.cells = [];
  }
}

function validatePlacement(player, shipKey, cells) {
  for (const cell of cells) {
    if (!inBounds(cell.row, cell.col)) {
      throw new Error("That ship would leave the board.");
    }
  }

  const occupied = new Set();
  for (const ship of player.ships) {
    if (!ship.placed || ship.key === shipKey) {
      continue;
    }
    for (const cell of ship.cells) {
      occupied.add(keyFor(cell.row, cell.col));
    }
  }

  for (const cell of cells) {
    if (occupied.has(keyFor(cell.row, cell.col))) {
      throw new Error("That ship overlaps another ship.");
    }
  }
}

function buildCells(row, col, length, orientation) {
  return Array.from({ length }, (_, index) => ({
    row: row + (orientation === "vertical" ? index : 0),
    col: col + (orientation === "horizontal" ? index : 0),
  }));
}

function rebuildShipGrid(player) {
  player.shipGrid = createGrid(null);
  for (const ship of player.ships) {
    if (!ship.placed) {
      continue;
    }
    for (const cell of ship.cells) {
      player.shipGrid[cell.row][cell.col] = ship.key;
    }
  }
}

function serializeGameForHuman(game) {
  return {
    id: game.id,
    boardSize: BOARD_SIZE,
    phase: game.phase,
    turn: game.turn,
    winner: game.winner,
    moveCount: game.moveCount,
    updatedAt: game.updatedAt,
    status: {
      humanShipsRemaining: countRemainingShips(game.human),
      agentShipsRemaining: countRemainingShips(game.agent),
      allShipsPlaced: allShipsPlaced(game.human),
      canStart: game.phase === "setup" && allShipsPlaced(game.human),
      canShoot: game.phase === "playing" && game.turn === "human",
    },
    event: serializeHumanEvent(game.lastEvent),
    captainFeed: serializeCaptainFeed(game.captainFeed),
    setup: {
      ships: serializeShipRoster(game.human.ships),
    },
    humanBoard: {
      ships: serializeShipPlacement(game.human.ships),
      shots: serializeShotsAgainstBoard(game.human),
    },
    targetBoard: {
      shots: serializeShotsAgainstBoard(game.agent, { revealShipInfo: false }),
      sunkShips: game.agent.ships.filter((ship) => ship.sunk).map((ship) => ship.key),
    },
  };
}

function serializeLiveView(game) {
  const lastHumanMove = game.moveLog.find((entry) => entry.actor === "human") || null;
  const lastAgentMove = game.moveLog.find((entry) => entry.actor === "agent") || null;
  return {
    gameId: game.id,
    boardSize: BOARD_SIZE,
    phase: game.phase,
    turn: game.turn,
    winner: game.winner,
    status: {
      allShipsPlaced: allShipsPlaced(game.human),
      canStart: game.phase === "setup" && allShipsPlaced(game.human),
    },
    pendingAgentTurnId: game.phase === "playing" && game.turn === "agent" ? game.agentTurnCounter : null,
    moveCount: game.moveCount,
    humanShipsRemaining: countRemainingShips(game.human),
    agentShipsRemaining: countRemainingShips(game.agent),
    lastEvent: game.lastEvent,
    lastHumanMove,
    lastAgentMove,
    lastMove: game.moveLog[0] || null,
    captainFeed: serializeCaptainFeed(game.captainFeed),
    codexShots: serializeShotsAgainstBoard(game.human),
    humanShots: serializeShotsAgainstBoard(game.agent),
  };
}

function serializeCaptainFeed(captainFeed) {
  return captainFeed.map((entry) => ({
    id: entry.id,
    author: entry.author,
    kind: entry.kind,
    text: entry.text,
    createdAt: entry.createdAt,
  }));
}

function serializeShipRoster(ships) {
  return ships.map((ship) => ({
    key: ship.key,
    name: ship.name,
    length: ship.length,
    placed: ship.placed,
    sunk: ship.sunk,
    hits: ship.hits,
    orientation: ship.orientation,
  }));
}

function serializeShipPlacement(ships) {
  return ships
    .filter((ship) => ship.placed)
    .map((ship) => ({
      key: ship.key,
      name: ship.name,
      length: ship.length,
      orientation: ship.orientation,
      sunk: ship.sunk,
      hits: ship.hits,
      cells: ship.cells.map((cell, index) => ({
        row: cell.row,
        col: cell.col,
        segment:
          ship.length === 1
            ? "solo"
            : index === 0
              ? "start"
              : index === ship.cells.length - 1
                ? "end"
                : "middle",
      })),
    }));
}

function serializeShotsAgainstBoard(player, options = {}) {
  const revealShipInfo = options.revealShipInfo !== false;
  return player.shotsGrid.flatMap((row, rowIndex) =>
    row.flatMap((shot, colIndex) => {
      if (!shot) {
        return [];
      }
      const shipKey = player.shipGrid[rowIndex][colIndex];
      const ship = shipKey ? player.ships.find((candidate) => candidate.key === shipKey) : null;
      return [
        {
          row: rowIndex,
          col: colIndex,
          result: shot,
          shipKey: revealShipInfo ? shipKey : null,
          shipName: revealShipInfo && ship ? ship.name : null,
          sunk: Boolean(ship && ship.sunk),
        },
      ];
    }),
  );
}

function serializeHumanEvent(event) {
  if (!event) {
    return null;
  }

  if (event.kind === "setup" || event.kind === "ready" || event.kind === "battle-start") {
    return {
      ...event,
      shipName: null,
    };
  }

  if (event.kind === "miss") {
    return {
      actor: event.actor,
      kind: event.kind,
      title: event.actor === "human" ? "Miss" : "Incoming miss",
      detail: event.actor === "human" ? "Shot missed." : "Codex missed.",
      coord: event.coord,
      shipName: null,
    };
  }

  if (event.kind === "hit") {
    return {
      actor: event.actor,
      kind: event.kind,
      title: event.actor === "human" ? "Hit" : "Incoming hit",
      detail: event.actor === "human" ? "Direct hit." : "Codex scored a hit.",
      coord: event.coord,
      shipName: null,
    };
  }

  if (event.kind === "sunk") {
    return {
      actor: event.actor,
      kind: event.kind,
      title: event.actor === "human" ? "Sunk" : "Ship lost",
      detail:
        event.actor === "human"
          ? "Enemy ship destroyed."
          : "Codex sank one of your ships.",
      coord: event.coord,
      shipName: null,
    };
  }

  if (event.kind === "win") {
    return {
      actor: event.actor,
      kind: event.kind,
      title: event.actor === "human" ? "Victory" : "Defeat",
      detail:
        event.actor === "human"
          ? "Enemy fleet destroyed."
          : "Codex destroyed your fleet.",
      coord: event.coord,
      shipName: null,
    };
  }

  return {
    ...event,
    shipName: null,
  };
}

function buildEvent(actor, outcome, victory) {
  const actorName = actor === "human" ? "You" : "Codex";

  if (victory) {
    return {
      actor,
      kind: "win",
      title: actor === "human" ? "Fleetline victory" : "Codex wins the duel",
      detail:
        actor === "human"
          ? `Final strike at ${coordToLabel(outcome.row, outcome.col)}. The enemy fleet is gone.`
          : `Codex finished your fleet with a strike at ${coordToLabel(outcome.row, outcome.col)}.`,
      coord: coordToLabel(outcome.row, outcome.col),
      shipName: outcome.shipName,
    };
  }

  if (outcome.result === "miss") {
    return {
      actor,
      kind: "miss",
      title: `${actorName} missed`,
      detail: `${coordToLabel(outcome.row, outcome.col)} was open water.`,
      coord: coordToLabel(outcome.row, outcome.col),
      shipName: null,
    };
  }

  if (outcome.result === "sunk") {
    return {
      actor,
      kind: "sunk",
      title: `${actorName} sank the ${outcome.shipName}`,
      detail: `${coordToLabel(outcome.row, outcome.col)} finished the ${outcome.shipName}.`,
      coord: coordToLabel(outcome.row, outcome.col),
      shipName: outcome.shipName,
    };
  }

  return {
    actor,
    kind: "hit",
    title: `${actorName} scored a hit`,
    detail: `${coordToLabel(outcome.row, outcome.col)} connected with the ${outcome.shipName}.`,
    coord: coordToLabel(outcome.row, outcome.col),
    shipName: outcome.shipName,
  };
}

function updateSetupEvent(game) {
  const remaining = game.human.ships.filter((ship) => !ship.placed);
  if (remaining.length === 0) {
    game.lastEvent = {
      actor: null,
      kind: "ready",
      title: "Fleet ready",
      detail: "Your ships are deployed. Launch when you are ready.",
      coord: null,
      shipName: null,
    };
  } else {
    game.lastEvent = {
      actor: null,
      kind: "setup",
      title: "Prepare your fleet",
      detail: `${remaining.length} ship${remaining.length === 1 ? "" : "s"} left to deploy.`,
      coord: null,
      shipName: null,
    };
  }
  game.updatedAt = new Date().toISOString();
}

function countRemainingShips(player) {
  return player.ships.filter((ship) => !ship.sunk).length;
}

function allShipsPlaced(player) {
  return player.ships.every((ship) => ship.placed);
}

function ensurePhase(game, phase) {
  if (game.phase !== phase) {
    throw new Error(`Action is only allowed during ${phase}.`);
  }
}

function ensureActiveTurn(game, actor) {
  if (game.phase !== "playing") {
    throw new Error("The battle is not active.");
  }
  if (game.turn !== actor) {
    throw new Error(`It is not ${actor}'s turn.`);
  }
}

function getShip(player, shipKey) {
  const ship = player.ships.find((candidate) => candidate.key === shipKey);
  if (!ship) {
    throw new Error("Unknown ship.");
  }
  return ship;
}

function coordToLabel(row, col) {
  return `${String.fromCharCode(65 + row)}${col + 1}`;
}

function keyFor(row, col) {
  return `${row}:${col}`;
}

function inBounds(row, col) {
  return row >= 0 && row < BOARD_SIZE && col >= 0 && col < BOARD_SIZE;
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

module.exports = {
  BOARD_SIZE,
  SHIP_DEFS,
  addCaptainNote,
  coordToLabel,
  clearHumanFleet,
  createGame,
  placeHumanShip,
  randomizeHumanFleet,
  resetGame,
  serializeGameForHuman,
  serializeLiveView,
  startBattle,
  takeAgentShot,
  takeHumanShot,
};
