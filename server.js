const http = require("node:http");
const path = require("node:path");
const fs = require("node:fs/promises");
const { randomUUID } = require("node:crypto");

const {
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
} = require("./lib/game");

const PORT = Number(process.env.PORT || 3197);
const PUBLIC_DIR = path.join(__dirname, "public");
const STREAM_RETRY_MS = 1500;
const STREAM_HEARTBEAT_MS = 15000;
const UI_SESSION_COOKIE = "torpedex_ui";
const uiSessionToken = randomUUID();

const CONTENT_TYPES = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
};

let game = createGame();
const streamClients = new Set();

const server = http.createServer(async (req, res) => {
  try {
    const requestUrl = new URL(req.url, `http://${req.headers.host}`);

    if (requestUrl.pathname === "/api/state" && req.method === "GET") {
      if (!hasUiAccess(req)) {
        return sendJson(res, 403, {
          error: "Human UI state is not available from this client. Use /api/live-view for fair-play monitoring.",
        });
      }
      return sendJson(res, 200, serializeGameForHuman(game));
    }

    if (requestUrl.pathname === "/api/live-view" && req.method === "GET") {
      return sendJson(res, 200, serializeLiveView(game));
    }

    if (requestUrl.pathname === "/api/stream" && req.method === "GET") {
      if (!hasUiAccess(req)) {
        return sendJson(res, 403, {
          error: "Human UI stream is not available from this client. Use /api/live-view for fair-play monitoring.",
        });
      }
      return openStateStream(req, res);
    }

    if (requestUrl.pathname === "/api/setup/place" && req.method === "POST") {
      if (!hasUiAccess(req)) {
        return sendJson(res, 403, { error: "Human ship placement is only available from the browser UI." });
      }
      const body = await readJson(req);
      const state = placeHumanShip(
        game,
        body.shipKey,
        Number(body.row),
        Number(body.col),
        body.orientation,
      );
      broadcastState();
      return sendJson(res, 200, { state });
    }

    if (requestUrl.pathname === "/api/setup/randomize" && req.method === "POST") {
      const state = randomizeHumanFleet(game);
      broadcastState();
      return sendJson(res, 200, { state });
    }

    if (requestUrl.pathname === "/api/setup/clear" && req.method === "POST") {
      if (!hasUiAccess(req)) {
        return sendJson(res, 403, { error: "Human fleet controls are only available from the browser UI." });
      }
      const state = clearHumanFleet(game);
      broadcastState();
      return sendJson(res, 200, { state });
    }

    if (requestUrl.pathname === "/api/start" && req.method === "POST") {
      const state = startBattle(game);
      broadcastState();
      return sendJson(res, 200, { state });
    }

    if (requestUrl.pathname === "/api/fire" && req.method === "POST") {
      if (!hasUiAccess(req)) {
        return sendJson(res, 403, { error: "Human fire control is only available from the browser UI." });
      }
      const body = await readJson(req);
      const payload = takeHumanShot(game, Number(body.row), Number(body.col));
      broadcastState();
      return sendJson(res, 200, {
        outcome: serializeOutcome(payload.outcome, { revealShipInfo: false }),
        state: payload.state,
      });
    }

    if (requestUrl.pathname === "/api/agent-fire" && req.method === "POST") {
      const body = await readJson(req);
      const payload = takeAgentShot(game, Number(body.row), Number(body.col), body.turnToken);
      broadcastState();
      return sendJson(res, 200, {
        outcome: serializeOutcome(payload.outcome, { revealShipInfo: false }),
        live: payload.live,
      });
    }

    if (requestUrl.pathname === "/api/captain-note" && req.method === "POST") {
      const body = await readJson(req);
      const state = addCaptainNote(game, body.text, body.kind);
      broadcastState();
      return sendJson(res, 200, { state });
    }

    if (requestUrl.pathname === "/api/rematch" && req.method === "POST") {
      if (!hasUiAccess(req)) {
        return sendJson(res, 403, { error: "Rematch control is only available from the browser UI." });
      }
      const state = resetGame(game);
      broadcastState();
      return sendJson(res, 200, { state });
    }

    if (requestUrl.pathname === "/health" && req.method === "GET") {
      return sendJson(res, 200, {
        ok: true,
        gameId: game.id,
        phase: game.phase,
      });
    }

    if (req.method === "GET") {
      return serveStatic(requestUrl.pathname, res);
    }

    sendJson(res, 404, { error: "Not found." });
  } catch (error) {
    sendJson(res, 400, { error: error.message || "Request failed." });
  }
});

server.on("error", (error) => {
  if (error.code === "EADDRINUSE") {
    console.error(
      `Port ${PORT} is already in use. Reuse the running server or start this one with a different port, for example: PORT=3198 npm start`,
    );
    process.exit(1);
  }

  console.error(error);
  process.exit(1);
});

server.listen(PORT, () => {
  console.log(`Torpedex server running on http://127.0.0.1:${PORT}`);
});

setInterval(() => {
  for (const client of streamClients) {
    client.write(": ping\n\n");
  }
}, STREAM_HEARTBEAT_MS).unref();

async function serveStatic(requestPath, res) {
  const normalizedPath =
    requestPath === "/"
      ? "index.html"
      : path
          .normalize(requestPath)
          .replace(/^(\.\.(\/|\\|$))+/, "")
          .replace(/^[/\\]+/, "");
  const filePath = path.join(PUBLIC_DIR, normalizedPath);

  if (!filePath.startsWith(PUBLIC_DIR)) {
    return sendJson(res, 403, { error: "Forbidden." });
  }

  try {
    const file = await fs.readFile(filePath);
    const headers = {
      "Content-Type": CONTENT_TYPES[path.extname(filePath)] || "application/octet-stream",
      "Cache-Control": "no-store",
    };
    if (path.extname(filePath) === ".html") {
      headers["Set-Cookie"] = `${UI_SESSION_COOKIE}=${uiSessionToken}; Path=/; HttpOnly; SameSite=Strict`;
    }
    res.writeHead(200, headers);
    res.end(file);
  } catch (error) {
    if (error.code === "ENOENT") {
      return sendJson(res, 404, { error: "Not found." });
    }
    throw error;
  }
}

async function readJson(req) {
  const chunks = [];

  for await (const chunk of req) {
    chunks.push(chunk);
  }

  if (chunks.length === 0) {
    return {};
  }

  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf-8"));
  } catch (error) {
    throw new Error("Body must be valid JSON.");
  }
}

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  res.end(JSON.stringify(payload));
}

function openStateStream(req, res) {
  res.writeHead(200, {
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-store",
    Connection: "keep-alive",
  });
  res.write(`retry: ${STREAM_RETRY_MS}\n\n`);
  streamClients.add(res);
  sendStateEvent(res);

  req.on("close", () => {
    streamClients.delete(res);
    res.end();
  });
}

function broadcastState() {
  for (const client of streamClients) {
    sendStateEvent(client);
  }
}

function sendStateEvent(res) {
  res.write(`event: state\ndata: ${JSON.stringify({ state: serializeGameForHuman(game) })}\n\n`);
}

function hasUiAccess(req) {
  const cookies = parseCookies(req.headers.cookie || "");
  return cookies[UI_SESSION_COOKIE] === uiSessionToken;
}

function parseCookies(cookieHeader) {
  return cookieHeader
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean)
    .reduce((accumulator, pair) => {
      const separatorIndex = pair.indexOf("=");
      if (separatorIndex === -1) {
        return accumulator;
      }
      const key = pair.slice(0, separatorIndex).trim();
      const value = pair.slice(separatorIndex + 1).trim();
      accumulator[key] = value;
      return accumulator;
    }, {});
}

function serializeOutcome(outcome, options = {}) {
  const revealShipInfo = options.revealShipInfo === true;
  const genericSummary =
    outcome.result === "sunk" ? `${outcome.coord} sunk` : `${outcome.coord} ${outcome.result}`;
  return {
    row: outcome.row,
    col: outcome.col,
    coord: outcome.coord,
    result: outcome.result,
    shipKey: revealShipInfo ? outcome.shipKey : null,
    shipName: revealShipInfo ? outcome.shipName : null,
    summary: revealShipInfo ? outcome.summary : genericSummary,
  };
}
