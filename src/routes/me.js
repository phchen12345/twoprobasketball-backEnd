const express = require("express");

const { pool } = require("../db");
const { requireAuth } = require("../middleware/requireAuth");

const meRouter = express.Router();

meRouter.use(requireAuth);

function serializeFavoriteTeam(row) {
  return {
    id: row.id,
    league: row.league,
    teamId: row.team_id,
    teamName: row.team_name,
    teamLogo: row.team_logo,
    createdAt: row.created_at,
  };
}

meRouter.get("/favorite-teams", async (req, res, next) => {
  try {
    const result = await pool.query(`
      SELECT id, league, team_id, team_name, team_logo, created_at
      FROM favorite_teams
      WHERE user_id = $1
      ORDER BY league ASC, team_name ASC
    `, [req.user.id]);

    res.json({
      favoriteTeams: result.rows.map(serializeFavoriteTeam),
    });
  } catch (error) {
    next(error);
  }
});

meRouter.post("/favorite-teams", async (req, res, next) => {
  try {
    const { league, teamId, teamName, teamLogo = null } = req.body || {};

    if (!league || !teamId || !teamName) {
      res.status(400).json({ error: "Missing league, teamId, or teamName" });
      return;
    }

    const result = await pool.query(`
      INSERT INTO favorite_teams (user_id, league, team_id, team_name, team_logo)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (user_id, league, team_id)
      DO UPDATE SET team_name = EXCLUDED.team_name, team_logo = EXCLUDED.team_logo
      RETURNING id, league, team_id, team_name, team_logo, created_at
    `, [req.user.id, league, teamId, teamName, teamLogo]);

    res.status(201).json({
      favoriteTeam: serializeFavoriteTeam(result.rows[0]),
    });
  } catch (error) {
    next(error);
  }
});

meRouter.delete("/favorite-teams/:id", async (req, res, next) => {
  try {
    await pool.query(
      "DELETE FROM favorite_teams WHERE id = $1 AND user_id = $2",
      [req.params.id, req.user.id],
    );

    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

module.exports = {
  meRouter,
};
