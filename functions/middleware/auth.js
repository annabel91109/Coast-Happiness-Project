const { getAuth } = require("firebase-admin/auth");

/**
 * Express middleware that verifies Firebase ID tokens.
 * Sets req.user = { uid, email, displayName } on success.
 * Use `requireAuth` for protected endpoints, `optionalAuth` for optional.
 */
function requireAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing or invalid Authorization header" });
  }
  const token = header.split("Bearer ")[1];
  getAuth()
    .verifyIdToken(token)
    .then((decoded) => {
      req.user = {
        uid: decoded.uid,
        email: decoded.email || null,
        displayName: decoded.name || decoded.email || "Anonymous",
      };
      next();
    })
    .catch(() => {
      res.status(401).json({ error: "Invalid or expired token" });
    });
}

function optionalAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    req.user = null;
    return next();
  }
  const token = header.split("Bearer ")[1];
  getAuth()
    .verifyIdToken(token)
    .then((decoded) => {
      req.user = {
        uid: decoded.uid,
        email: decoded.email || null,
        displayName: decoded.name || decoded.email || "Anonymous",
      };
      next();
    })
    .catch(() => {
      req.user = null;
      next();
    });
}

module.exports = { requireAuth, optionalAuth };
