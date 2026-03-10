const test = require("node:test");
const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const net = require("node:net");
const path = require("node:path");

test("human UI endpoints require the browser session cookie while live-view stays public", async (t) => {
  const port = await reservePort();
  const server = spawn(process.execPath, ["server.js"], {
    cwd: path.join(__dirname, ".."),
    env: {
      ...process.env,
      PORT: String(port),
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  t.after(() => {
    if (!server.killed) {
      server.kill("SIGTERM");
    }
  });

  await waitForServer(server, port);

  let response = await fetch(`http://127.0.0.1:${port}/api/live-view`);
  assert.equal(response.status, 200);

  response = await fetch(`http://127.0.0.1:${port}/api/state`);
  assert.equal(response.status, 403);

  response = await fetch(`http://127.0.0.1:${port}/api/fire`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ row: 0, col: 0 }),
  });
  assert.equal(response.status, 403);

  const rootResponse = await fetch(`http://127.0.0.1:${port}/`);
  const setCookie = rootResponse.headers.get("set-cookie");

  assert.ok(setCookie);

  response = await fetch(`http://127.0.0.1:${port}/api/state`, {
    headers: {
      Cookie: setCookie.split(";")[0],
    },
  });
  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.equal(Array.isArray(payload.humanBoard.ships), true);
});

async function reservePort() {
  return new Promise((resolve, reject) => {
    const socket = net.createServer();
    socket.listen(0, "127.0.0.1", () => {
      const address = socket.address();
      socket.close((closeError) => {
        if (closeError) {
          reject(closeError);
          return;
        }
        resolve(address.port);
      });
    });
    socket.on("error", reject);
  });
}

async function waitForServer(server, port) {
  let stderr = "";

  server.stderr.on("data", (chunk) => {
    stderr += chunk.toString("utf8");
  });

  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error(`Timed out waiting for server start.\n${stderr}`));
    }, 10000);

    server.on("exit", (code) => {
      clearTimeout(timeout);
      reject(new Error(`Server exited early with code ${code}.\n${stderr}`));
    });

    server.stdout.on("data", (chunk) => {
      const text = chunk.toString("utf8");
      if (text.includes(`http://127.0.0.1:${port}`)) {
        clearTimeout(timeout);
        resolve();
      }
    });
  });
}
