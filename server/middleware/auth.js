/**
 * Local dev auth middleware stub.
 * In local dev the Firebase Admin SDK is not initialized,
 * so we trust a simple x-uid / x-display-name header for testing,
 * or skip auth entirely when not provided.
 */
function requireAuth(req, res, next) {
  const uid = req.headers["x-uid"];
  if (!uid) {
    return res.status(401).json({ error: "Missing auth (local dev: pass x-uid header)" });
  }
  req.user = {
    uid,
    email: req.headers["x-email"] || `${uid}@local.dev`,
    displayName: req.headers["x-display-name"] || uid,
  };
  next();
}

function optionalAuth(req, res, next) {
  const uid = req.headers["x-uid"];
  if (uid) {
    req.user = {
      uid,
      email: req.headers["x-email"] || `${uid}@local.dev`,
      displayName: req.headers["x-display-name"] || uid,
    };
  } else {
    req.user = null;
  }
  next();
}

module.exports = { requireAuth, optionalAuth };
