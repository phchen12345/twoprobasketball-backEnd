const cors = require("cors");
const cookieParser = require("cookie-parser");
const express = require("express");

const { authRouter } = require("./routes/auth");
const { notificationsRouter } = require("./routes/notifications");
const { visitorsRouter } = require("./routes/visitors");

function createServer() {
  const app = express();

  app.use(cors({
    origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(",") : "*",
    credentials: true,
  }));
  app.use(cookieParser());
  app.use(express.json({ limit: "1mb" }));

  app.get("/", (_req, res) => {
    res.json({ ok: true, service: "basketball-backend" });
  });

  app.get("/health", (_req, res) => {
    res.json({ ok: true });
  });

  app.use("/api/visitors", visitorsRouter);
  app.use("/api/auth", authRouter);
  app.use("/api/notifications", notificationsRouter);

  app.use((_req, res) => {
    res.status(404).json({ error: "Not Found" });
  });

  app.use((error, _req, res, _next) => {
    console.error("Server error:", error);
    res.status(500).json({ error: "Internal Server Error" });
  });

  return app;
}

module.exports = {
  createServer,
};
