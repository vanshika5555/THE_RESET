const jwt = require('jsonwebtoken');
const User = require('../models/User');

/**
 * Checks the "Authorization: Bearer <token>" header.
 *
 * A token is only accepted while its version matches the user's current
 * tokenVersion — changing or resetting the password raises that number,
 * which signs the account out on every other device at once.
 */
const protect = async (req, res, next) => {
  const header = req.headers.authorization || '';
  if (!header.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Please sign in to continue.' });
  }

  try {
    const token = header.slice(7);
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    // Short-lived tickets (e.g. half-way through 2-step sign-in) are not sessions.
    if (decoded.purpose) return res.status(401).json({ message: 'Not authorized, please sign in again' });
    const user = await User.findById(decoded.id).select('-password');

    if (!user) {
      return res.status(401).json({ message: 'Account not found. Please sign in again.' });
    }
    if ((decoded.v || 0) !== (user.tokenVersion || 0)) {
      return res.status(401).json({ message: 'Your session has ended. Please sign in again.' });
    }

    req.user = user;
    return next();
  } catch (err) {
    return res.status(401).json({ message: 'Your session has expired. Please sign in again.' });
  }
};

// The owner: everything, including money settings, customers and the team.
const adminOnly = (req, res, next) => {
  if (req.user && req.user.role === 'admin') return next();
  return res.status(403).json({ message: 'Only the shop owner can do this.' });
};

// Anyone on the team (owner or staff): orders, returns, products, reviews.
const TEAM = ['admin', 'staff'];
const isTeam = (user) => !!user && TEAM.includes(user.role);
const teamOnly = (req, res, next) => {
  if (isTeam(req.user)) return next();
  return res.status(403).json({ message: 'Team access only' });
};

module.exports = { protect, adminOnly, teamOnly, isTeam };
