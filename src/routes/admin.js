const express = require("express");

const { requireAdmin } = require("../middleware/requireAdmin");
const { requireAuth } = require("../middleware/requireAuth");

const adminRouter = express.Router();

adminRouter.use(requireAuth);
adminRouter.use(requireAdmin);

adminRouter.get("/me", (req, res) => {
  res.json({
    ok: true,
    user: req.user,
  });
});

module.exports = {
  adminRouter,
};
