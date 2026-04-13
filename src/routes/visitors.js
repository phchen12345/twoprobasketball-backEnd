const express = require("express");
const { pool } = require("../db");

const visitorsRouter = express.Router();

async function readState() {
  const result = await pool.query(
    "SELECT total_visits, updated_at FROM visitor_counts WHERE id = 1",
  );
  const row = result.rows[0];

  return {
    totalVisits: Number(row?.total_visits || 0),
    updatedAt: row?.updated_at ? new Date(row.updated_at).toISOString() : null,
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
    totalVisits: Number(row?.total_visits || 0),
    updatedAt: row?.updated_at ? new Date(row.updated_at).toISOString() : null,
  };
}

visitorsRouter.get("/", async (_req, res, next) => {
  try {
    res.json(await readState());
  } catch (error) {
    next(error);
  }
});

visitorsRouter.post("/increment", async (_req, res, next) => {
  try {
    res.json(await incrementState());
  } catch (error) {
    next(error);
  }
});

module.exports = {
  visitorsRouter,
};
