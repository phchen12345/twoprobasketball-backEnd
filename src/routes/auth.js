const express = require("express");
const { OAuth2Client } = require("google-auth-library");

const { pool } = require("../db");
const {
  clearAuthCookies,
  generateOpaqueToken,
  hashToken,
  readRefreshToken,
  refreshTokenExpiry,
  setAuthCookies,
  signAccessToken,
} = require("../auth/tokens");
const { requireCsrf } = require("../middleware/requireCsrf");
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

async function createRefreshSession(userId) {
  const refreshToken = generateOpaqueToken();
  const csrfToken = generateOpaqueToken();
  const tokenHash = hashToken(refreshToken);
  const expiresAt = refreshTokenExpiry();

  await pool.query(`
    INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
    VALUES ($1, $2, $3)
  `, [userId, tokenHash, expiresAt]);

  return {
    csrfToken,
    refreshToken,
  };
}

async function rotateRefreshSession(refreshToken) {
  const tokenHash = hashToken(refreshToken);
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const result = await client.query(`
      SELECT
        refresh_tokens.id AS token_id,
        users.id,
        users.email,
        users.name,
        users.avatar_url,
        users.role
      FROM refresh_tokens
      JOIN users ON users.id = refresh_tokens.user_id
      WHERE refresh_tokens.token_hash = $1
        AND refresh_tokens.revoked_at IS NULL
        AND refresh_tokens.expires_at > NOW()
      FOR UPDATE
    `, [tokenHash]);
    const user = result.rows[0];

    if (!user) {
      await client.query("ROLLBACK");
      return null;
    }

    await client.query(
      "UPDATE refresh_tokens SET revoked_at = NOW() WHERE id = $1",
      [user.token_id],
    );

    const nextRefreshToken = generateOpaqueToken();
    const csrfToken = generateOpaqueToken();

    await client.query(`
      INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
      VALUES ($1, $2, $3)
    `, [user.id, hashToken(nextRefreshToken), refreshTokenExpiry()]);

    await client.query("COMMIT");

    return {
      csrfToken,
      refreshToken: nextRefreshToken,
      user,
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function revokeRefreshSession(refreshToken) {
  await pool.query(
    "UPDATE refresh_tokens SET revoked_at = NOW() WHERE token_hash = $1 AND revoked_at IS NULL",
    [hashToken(refreshToken)],
  );
}

authRouter.post("/google", async (req, res, next) => {
  try {
    const { idToken } = req.body || {};

    if (!idToken) {
      res.status(400).json({ error: "Missing idToken" });
      return;
    }

    let ticket;

    try {
      ticket = await googleClient.verifyIdToken({
        idToken,
        audience: process.env.GOOGLE_CLIENT_ID,
      });
    } catch (error) {
      console.warn("Google token verification failed:", error.message);
      res.status(401).json({ error: "Invalid Google token" });
      return;
    }

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

    const session = await createRefreshSession(user.id);
    setAuthCookies(res, session.refreshToken, session.csrfToken);

    res.json({
      accessToken: signAccessToken(user),
      csrfToken: session.csrfToken,
      user: publicUser(user),
    });
  } catch (error) {
    next(error);
  }
});

authRouter.post("/refresh", requireCsrf, async (req, res, next) => {
  try {
    const refreshToken = readRefreshToken(req);

    if (!refreshToken) {
      res.status(401).json({ error: "Missing refresh token" });
      return;
    }

    const session = await rotateRefreshSession(refreshToken);

    if (!session) {
      clearAuthCookies(res);
      res.status(401).json({ error: "Invalid refresh token" });
      return;
    }

    setAuthCookies(res, session.refreshToken, session.csrfToken);

    res.json({
      accessToken: signAccessToken(session.user),
      csrfToken: session.csrfToken,
      user: publicUser(session.user),
    });
  } catch (error) {
    next(error);
  }
});

authRouter.post("/logout", requireCsrf, async (req, res, next) => {
  try {
    const refreshToken = readRefreshToken(req);

    if (refreshToken) {
      await revokeRefreshSession(refreshToken);
    }

    clearAuthCookies(res);
    res.status(204).end();
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
