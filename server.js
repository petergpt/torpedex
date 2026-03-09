const http = require("node:http");
const path = require("node:path");
const fs = require("node:fs/promises");

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
      return sendJson(res, 200, serializeGameForHuman(game));
    }

    if (requestUrl.pathname === "/api/live-view" && req.method === "GET") {
      return sendJson(res, 200, serializeLiveView(game));
    }

    if (requestUrl.pathname === "/api/stream" && req.method === "GET") {
      return openStateStream(req, res);
    }

    if (requestUrl.pathname === "/api/setup/place" && req.method === "POST") {
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
      const body = await readJson(req);
      const payload = takeHumanShot(game, Number(body.row), Number(body.col));
      broadcastState();
      return sendJson(res, 200, {
        outcome: payload.outcome,
        state: payload.state,
      });
    }

    if (requestUrl.pathname === "/api/agent-fire" && req.method === "POST") {
      const body = await readJson(req);
      const payload = takeAgentShot(game, Number(body.row), Number(body.col), body.turnToken);
      broadcastState();
      return sendJson(res, 200, {
        outcome: payload.outcome,
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
    res.writeHead(200, {
      "Content-Type": CONTENT_TYPES[path.extname(filePath)] || "application/octet-stream",
      "Cache-Control": "no-store",
    });
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
