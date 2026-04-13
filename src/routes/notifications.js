const express = require("express");

const { pool } = require("../db");
const { requireCsrf } = require("../middleware/requireCsrf");
const { requireAuth } = require("../middleware/requireAuth");

const notificationsRouter = express.Router();

notificationsRouter.use(requireAuth);

/**
 * 🥇 取得 lastReadAt
 */
notificationsRouter.get("/last-read", async (req, res, next) => {
  try {
    const result = await pool.query(
      `
      SELECT last_read_at
      FROM user_notification_settings
      WHERE user_id = $1
      `,
      [req.user.id],
    );

    res.json({
      lastReadAt: result.rows[0]?.last_read_at || null,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * 🥇 標記全部通知為已讀
 */
notificationsRouter.post("/read-all", async (req, res, next) => {
  try {
    await pool.query(
      `
      INSERT INTO user_notification_settings (user_id, last_read_at)
      VALUES ($1, NOW())
      ON CONFLICT (user_id)
      DO UPDATE SET last_read_at = NOW()
      `,
      [req.user.id],
    );

    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

/**
 * ⭐ 保留：通知訂閱（這段不用動）
 */
notificationsRouter.get("/subscriptions", async (req, res, next) => {
  try {
    const result = await pool.query(
      `
      SELECT id, type, target_type, target_id, enabled, created_at, updated_at
      FROM notification_subscriptions
      WHERE user_id = $1
      ORDER BY created_at DESC
      `,
      [req.user.id],
    );

    res.json({
      subscriptions: result.rows.map((row) => ({
        id: row.id,
        type: row.type,
        targetType: row.target_type,
        targetId: row.target_id,
        enabled: row.enabled,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      })),
    });
  } catch (error) {
    next(error);
  }
});

notificationsRouter.post(
  "/subscriptions",
  requireCsrf,
  async (req, res, next) => {
    try {
      const { type, targetType, targetId, enabled = true } = req.body || {};

      if (!type || !targetType || !targetId) {
        res.status(400).json({
          error: "Missing type, targetType, or targetId",
        });
        return;
      }

      const result = await pool.query(
        `
        INSERT INTO notification_subscriptions
          (user_id, type, target_type, target_id, enabled, updated_at)
        VALUES ($1, $2, $3, $4, $5, NOW())
        ON CONFLICT (user_id, type, target_type, target_id)
        DO UPDATE SET enabled = EXCLUDED.enabled, updated_at = NOW()
        RETURNING id, type, target_type, target_id, enabled, created_at, updated_at
        `,
        [req.user.id, type, targetType, targetId, Boolean(enabled)],
      );

      const row = result.rows[0];

      res.status(201).json({
        subscription: {
          id: row.id,
          type: row.type,
          targetType: row.target_type,
          targetId: row.target_id,
          enabled: row.enabled,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        },
      });
    } catch (error) {
      next(error);
    }
  },
);

notificationsRouter.delete(
  "/subscriptions/:id",
  requireCsrf,
  async (req, res, next) => {
    try {
      await pool.query(
        "DELETE FROM notification_subscriptions WHERE id = $1 AND user_id = $2",
        [req.params.id, req.user.id],
      );

      res.status(204).end();
    } catch (error) {
      next(error);
    }
  },
);

module.exports = {
  notificationsRouter,
};
