const http = require("http");
const { Pool } = require("pg");

const PORT = Number(process.env.PORT || 4000);
const HOST = process.env.HOST || "0.0.0.0";
const DATABASE_URL = process.env.DATABASE_URL;
const DEFAULT_STATE = { totalVisits: 0, updatedAt: null };

if (!DATABASE_URL) {
  console.error("Missing DATABASE_URL environment variable.");
  process.exit(1);
}

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: process.env.PGSSLMODE === "disable" ? false : { rejectUnauthorized: false },
});

async function ensureCounterRow() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS visitor_counts (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      total_visits BIGINT NOT NULL DEFAULT 0,
      updated_at TIMESTAMPTZ
    )
  `);

  await pool.query(`
    INSERT INTO visitor_counts (id, total_visits, updated_at)
    VALUES (1, 0, NULL)
    ON CONFLICT (id) DO NOTHING
  `);
}

async function readState() {
  const result = await pool.query(
    "SELECT total_visits, updated_at FROM visitor_counts WHERE id = 1",
  );
  const row = result.rows[0];

  if (!row) {
    return DEFAULT_STATE;
  }

  return {
    totalVisits: Number(row.total_visits || 0),
    updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : null,
  };
}

async function incrementState() {
  const result = await pool.query(`
    UPDATE visitor_counts
    SET total_visits = total_visits + 1,
        updated_at = NOW()
    WHERE id = 1
    RETURNING total_visits, updated_at
  `);
  const row = result.rows[0];

  return {
    totalVisits: Number(row.total_visits || 0),
    updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : null,
  };
}

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  });
  res.end(JSON.stringify(payload));
}

function sendHeadOk(res) {
  res.writeHead(200, {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS,HEAD",
    "Access-Control-Allow-Headers": "Content-Type",
  });
  res.end();
}

function notFound(res) {
  sendJson(res, 404, { error: "Not Found" });
}

async function handleRequest(req, res) {
  const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);

  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET,POST,OPTIONS,HEAD",
      "Access-Control-Allow-Headers": "Content-Type",
    });
    res.end();
    return;
  }

  if ((req.method === "GET" || req.method === "HEAD") && url.pathname === "/") {
    if (req.method === "HEAD") {
      sendHeadOk(res);
      return;
    }

    sendJson(res, 200, { ok: true, service: "visitor-backend" });
    return;
  }

  if ((req.method === "GET" || req.method === "HEAD") && url.pathname === "/health") {
    if (req.method === "HEAD") {
      sendHeadOk(res);
      return;
    }

    sendJson(res, 200, { ok: true });
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/visitors") {
    const state = await readState();
    sendJson(res, 200, state);
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/visitors/increment") {
    const state = await incrementState();
    sendJson(res, 200, state);
    return;
  }

  notFound(res);
}

const server = http.createServer(async (req, res) => {
  try {
    await handleRequest(req, res);
  } catch (error) {
    console.error("Server error:", error);
    sendJson(res, 500, { error: "Internal Server Error" });
  }
});

async function startServer() {
  await ensureCounterRow();

  server.listen(PORT, HOST, () => {
    console.log(`Visitor backend running at http://${HOST}:${PORT}`);
  });
}

async function shutdown() {
  await pool.end();
  process.exit(0);
}

process.on("SIGINT", () => {
  void shutdown();
});

process.on("SIGTERM", () => {
  void shutdown();
});

startServer().catch((error) => {
  console.error("Failed to initialize database:", error);
  process.exit(1);
});
