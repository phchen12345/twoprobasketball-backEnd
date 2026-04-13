const jwt = require("jsonwebtoken");

function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;

  if (!token) {
    res.status(401).json({ error: "Missing access token" });
    return;
  }

  try {
    if (!process.env.JWT_SECRET) {
      throw new Error("Missing JWT_SECRET environment variable.");
    }

    const payload = jwt.verify(token, process.env.JWT_SECRET);

    req.user = {
      id: payload.sub,
      email: payload.email,
      role: payload.role,
    };

    next();
  } catch {
    res.status(401).json({ error: "Invalid access token" });
  }
}

module.exports = {
  requireAuth,
};
