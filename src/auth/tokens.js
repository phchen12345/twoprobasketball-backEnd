const crypto = require("crypto");
const jwt = require("jsonwebtoken");

const ACCESS_TOKEN_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "15m";
const REFRESH_TOKEN_COOKIE = "basketball_refresh_token";
const CSRF_TOKEN_COOKIE = "basketball_csrf_token";
const REFRESH_TOKEN_DAYS = Number(process.env.REFRESH_TOKEN_DAYS || 30);
const IS_PRODUCTION = process.env.NODE_ENV === "production";

function requireJwtSecret() {
  if (!process.env.JWT_SECRET) {
    throw new Error("Missing JWT_SECRET environment variable.");
  }

  return process.env.JWT_SECRET;
}

function signAccessToken(user) {
  return jwt.sign(
    {
      sub: user.id,
      email: user.email,
      role: user.role,
    },
    requireJwtSecret(),
    { expiresIn: ACCESS_TOKEN_EXPIRES_IN },
  );
}

function generateOpaqueToken() {
  return crypto.randomBytes(48).toString("base64url");
}

function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function refreshTokenExpiry() {
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + REFRESH_TOKEN_DAYS);
  return expiresAt;
}

function cookieOptions({ httpOnly }) {
  return {
    httpOnly,
    secure: IS_PRODUCTION,
    sameSite: IS_PRODUCTION ? "none" : "lax",
    path: "/",
    maxAge: REFRESH_TOKEN_DAYS * 24 * 60 * 60 * 1000,
  };
}

function setAuthCookies(res, refreshToken, csrfToken) {
  res.cookie(REFRESH_TOKEN_COOKIE, refreshToken, cookieOptions({ httpOnly: true }));
  res.cookie(CSRF_TOKEN_COOKIE, csrfToken, cookieOptions({ httpOnly: false }));
}

function clearAuthCookies(res) {
  const baseOptions = {
    secure: IS_PRODUCTION,
    sameSite: IS_PRODUCTION ? "none" : "lax",
    path: "/",
  };

  res.clearCookie(REFRESH_TOKEN_COOKIE, { ...baseOptions, httpOnly: true });
  res.clearCookie(CSRF_TOKEN_COOKIE, { ...baseOptions, httpOnly: false });
}

function readRefreshToken(req) {
  return req.cookies?.[REFRESH_TOKEN_COOKIE] || null;
}

function readCsrfCookie(req) {
  return req.cookies?.[CSRF_TOKEN_COOKIE] || null;
}

module.exports = {
  CSRF_TOKEN_COOKIE,
  REFRESH_TOKEN_COOKIE,
  clearAuthCookies,
  generateOpaqueToken,
  hashToken,
  readCsrfCookie,
  readRefreshToken,
  refreshTokenExpiry,
  setAuthCookies,
  signAccessToken,
};
