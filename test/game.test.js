const test = require("node:test");
const assert = require("node:assert/strict");

const {
  BOARD_SIZE,
  addCaptainNote,
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
} = require("../lib/game");

test("new match begins in setup with a randomized human fleet ready to adjust", () => {
  const game = createGame();
  const view = serializeGameForHuman(game);
  const liveView = serializeLiveView(game);

  assert.equal(view.phase, "setup");
  assert.equal(view.status.allShipsPlaced, true);
  assert.equal(view.status.canStart, true);
  assert.equal(view.humanBoard.ships.length, 5);
  assert.equal(view.setup.ships.every((ship) => ship.placed === true), true);
  assert.equal(liveView.status.allShipsPlaced, true);
  assert.equal(liveView.status.canStart, true);
});

test("human ships can be placed, cleared, and randomized during setup", () => {
  const game = createGame();
  clearHumanFleet(game);
  placeHumanShip(game, "destroyer", 0, 0, "horizontal");
  let view = serializeGameForHuman(game);

  assert.equal(view.humanBoard.ships.length, 1);
  assert.equal(view.humanBoard.ships[0].cells.length, 2);

  clearHumanFleet(game);
  view = serializeGameForHuman(game);
  assert.equal(view.humanBoard.ships.length, 0);

  randomizeHumanFleet(game);
  view = serializeGameForHuman(game);
  assert.equal(view.status.allShipsPlaced, true);
  assert.equal(view.humanBoard.ships.length, 5);
});

test("battle cannot start until every ship is deployed", () => {
  const game = createGame();
  clearHumanFleet(game);
  assert.throws(() => startBattle(game), /Place every ship/);

  randomizeHumanFleet(game);
  const view = startBattle(game);
  assert.equal(view.phase, "playing");
  assert.equal(view.turn, "human");
  assert.equal(view.status.canShoot, true);
});

test("human shots transition the game to Codex with a new agent turn token", () => {
  const game = createGame();
  randomizeHumanFleet(game);
  startBattle(game);

  const payload = takeHumanShot(game, 0, 0);

  assert.equal(payload.state.phase === "playing" || payload.state.phase === "finished", true);
  if (payload.state.phase === "playing") {
    assert.equal(payload.state.turn, "agent");
    assert.equal(payload.live.pendingAgentTurnId, 1);
  }
});

test("stale Codex tokens are rejected and the live view only exposes Codex shot history", () => {
  const game = createGame();
  randomizeHumanFleet(game);
  startBattle(game);
  const afterHumanShot = takeHumanShot(game, 0, 0);

  if (afterHumanShot.state.phase === "finished") {
    return;
  }

  assert.throws(() => takeAgentShot(game, 0, 0, 999), /Stale Codex turn token/);

  takeAgentShot(game, 0, 0, afterHumanShot.live.pendingAgentTurnId);
  const liveView = serializeLiveView(game);

  assert.equal(liveView.turn, "human");
  assert.equal(liveView.pendingAgentTurnId, null);
  assert.equal(liveView.codexShots.length, 1);
  assert.equal(liveView.humanShots.length, 1);
});

test("human-facing target shots and hit events do not expose enemy ship identity", () => {
  const game = createGame();
  randomizeHumanFleet(game);
  startBattle(game);

  const targetShip = game.agent.ships.find((ship) => ship.cells.length > 0);
  const cell = targetShip.cells[0];
  const payload = takeHumanShot(game, cell.row, cell.col);
  const shot = payload.state.targetBoard.shots[0];

  assert.equal(shot.shipKey, null);
  assert.equal(shot.shipName, null);
  assert.equal(payload.state.event.title, "Hit");
  assert.equal(payload.state.event.detail, "Direct hit.");
});

test("human-facing sunk events stay generic while fleet status still updates", () => {
  const game = createGame();
  randomizeHumanFleet(game);
  startBattle(game);

  const targetShip = game.agent.ships.find((ship) => ship.length === 2) || game.agent.ships[0];
  let payload = null;

  for (const cell of targetShip.cells) {
    payload = takeHumanShot(game, cell.row, cell.col);
    if (game.phase === "playing") {
      game.turn = "human";
    }
  }

  assert.equal(payload.state.event.title, "Sunk");
  assert.equal(payload.state.event.detail, "Enemy ship destroyed.");
  assert.equal(payload.state.targetBoard.sunkShips.includes(targetShip.key), true);
});

test("resetGame returns the match to a clean setup state", () => {
  const game = createGame();
  randomizeHumanFleet(game);
  startBattle(game);
  takeHumanShot(game, BOARD_SIZE - 1, BOARD_SIZE - 1);

  const view = resetGame(game);

  assert.equal(view.phase, "setup");
  assert.equal(view.turn, "human");
  assert.equal(view.moveCount, 0);
  assert.equal(view.humanBoard.ships.length, 5);
  assert.equal(view.status.canStart, true);
});

test("captain notes serialize to both views and clear on reset", () => {
  const game = createGame();

  addCaptainNote(game, "Waiting for your opening shot.", "status");
  addCaptainNote(game, "I am sweeping the center lanes first.", "note");

  let humanView = serializeGameForHuman(game);
  let liveView = serializeLiveView(game);

  assert.equal(humanView.captainFeed.length, 2);
  assert.equal(humanView.captainFeed[0].kind, "status");
  assert.equal(liveView.captainFeed[1].text, "I am sweeping the center lanes first.");

  humanView = resetGame(game);
  assert.equal(humanView.captainFeed.length, 0);
});

test("live view exposes setup readiness so the captain can stay on one state surface", () => {
  const game = createGame();
  clearHumanFleet(game);

  let liveView = serializeLiveView(game);
  assert.equal(liveView.phase, "setup");
  assert.equal(liveView.status.allShipsPlaced, false);
  assert.equal(liveView.status.canStart, false);

  randomizeHumanFleet(game);
  liveView = serializeLiveView(game);
  assert.equal(liveView.status.allShipsPlaced, true);
  assert.equal(liveView.status.canStart, true);
});
