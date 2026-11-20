const jwt = require('jsonwebtoken');

const verifyToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ message: 'Akses ditolak. Silakan login terlebih dahulu.' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'futsalzone_secret_key_production_2026');
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(403).json({ message: 'Sesi tidak valid atau telah kedaluwarsa.' });
  }
};

const isAdmin = (req, res, next) => {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Akses terlarang. Khusus Administrator.' });
  }
  next();
};

const isCustomer = (req, res, next) => {
  if (!req.user || req.user.role !== 'customer') {
    return res.status(403).json({ message: 'Akses khusus akun Customer.' });
  }
  next();
};

module.exports = { verifyToken, isAdmin, isCustomer };