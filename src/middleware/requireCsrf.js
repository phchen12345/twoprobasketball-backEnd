const { readCsrfCookie } = require("../auth/tokens");

function requireCsrf(req, res, next) {
  const csrfCookie = readCsrfCookie(req);
  const csrfHeader = req.headers["x-csrf-token"];

  if (!csrfCookie || !csrfHeader || csrfCookie !== csrfHeader) {
    res.status(403).json({ error: "Invalid CSRF token" });
    return;
  }

  next();
}

module.exports = {
  requireCsrf,
};
