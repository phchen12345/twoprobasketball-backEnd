function requireAdmin(req, res, next) {
  if (req.user?.role !== "admin") {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  next();
}

module.exports = {
  requireAdmin,
};
