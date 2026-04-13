const express = require("express");
const jwt = require("jsonwebtoken");
const { OAuth2Client } = require("google-auth-library");

const { pool } = require("../db");
const { requireAuth } = require("../middleware/requireAuth");

const authRouter = express.Router();
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

function publicUser(row) {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    avatarUrl: row.avatar_url,
    role: row.role,
  };
}

function signAccessToken(user) {
  if (!process.env.JWT_SECRET) {
    throw new Error("Missing JWT_SECRET environment variable.");
  }

  return jwt.sign(
    {
      sub: user.id,
      email: user.email,
      role: user.role,
    },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || "7d" },
  );
}

async function upsertGoogleUser(profile) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const userResult = await client.query(`
      INSERT INTO users (email, name, avatar_url, updated_at)
      VALUES ($1, $2, $3, NOW())
      ON CONFLICT (email)
      DO UPDATE SET
        name = EXCLUDED.name,
        avatar_url = EXCLUDED.avatar_url,
        updated_at = NOW()
      RETURNING id, email, name, avatar_url, role
    `, [profile.email, profile.name, profile.picture]);

    const user = userResult.rows[0];

    await client.query(`
      INSERT INTO user_identities (user_id, provider, provider_user_id)
      VALUES ($1, 'google', $2)
      ON CONFLICT (provider, provider_user_id) DO NOTHING
    `, [user.id, profile.sub]);

    await client.query("COMMIT");
    return user;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

authRouter.post("/google", async (req, res, next) => {
  try {
    const { idToken } = req.body || {};

    if (!idToken) {
      res.status(400).json({ error: "Missing idToken" });
      return;
    }

    const ticket = await googleClient.verifyIdToken({
      idToken,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();

    if (!payload?.email || !payload.sub) {
      res.status(401).json({ error: "Invalid Google token" });
      return;
    }

    const user = await upsertGoogleUser({
      sub: payload.sub,
      email: payload.email,
      name: payload.name || null,
      picture: payload.picture || null,
    });

    res.json({
      accessToken: signAccessToken(user),
      user: publicUser(user),
    });
  } catch (error) {
    next(error);
  }
});

authRouter.get("/me", requireAuth, async (req, res, next) => {
  try {
    const result = await pool.query(
      "SELECT id, email, name, avatar_url, role FROM users WHERE id = $1",
      [req.user.id],
    );
    const user = result.rows[0];

    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    res.json({ user: publicUser(user) });
  } catch (error) {
    next(error);
  }
});

module.exports = {
  authRouter,
};
