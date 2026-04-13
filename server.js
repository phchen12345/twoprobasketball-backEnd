require("dotenv").config();

const { createServer } = require("./src/server");
const { closePool, ensureDatabase } = require("./src/db");

const PORT = Number(process.env.PORT || 4000);
const HOST = process.env.HOST || "0.0.0.0";

async function startServer() {
  await ensureDatabase();

  const app = createServer();
  const server = app.listen(PORT, HOST, () => {
    console.log(`Basketball backend running at http://${HOST}:${PORT}`);
  });

  async function shutdown() {
    server.close(async () => {
      await closePool();
      process.exit(0);
    });
  }

  process.on("SIGINT", () => {
    void shutdown();
  });

  process.on("SIGTERM", () => {
    void shutdown();
  });
}

startServer().catch((error) => {
  console.error("Failed to initialize backend:", error);
  process.exit(1);
});
