const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../config/db');
const { verifyToken, isAdmin } = require('../middleware/authMiddleware');

const JWT_SECRET = process.env.JWT_SECRET || 'futsalzone_secret_key_production_2026';

// 1. REGISTER KHUSUS CUSTOMER
router.post('/register', async (req, res) => {
  const { name, email, password } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ message: 'Nama, email, dan password wajib diisi.' });
  }
  if (password.length < 6) {
    return res.status(400).json({ message: 'Password minimal 6 karakter.' });
  }

  try {
    const [existing] = await db.query('SELECT id FROM users WHERE email = ?', [email.trim()]);
    if (existing.length > 0) {
      return res.status(400).json({ message: 'Email sudah terdaftar. Gunakan email lain.' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const [result] = await db.query(
      'INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)',
      [name.trim(), email.trim(), hashedPassword, 'customer']
    );

    res.status(201).json({
      message: 'Registrasi berhasil! Silakan masuk dengan akun Anda.',
      userId: result.insertId
    });
  } catch (error) {
    console.error('Register Error:', error);
    res.status(500).json({ message: 'Terjadi kesalahan server saat mendaftar.' });
  }
});

// 2. LOGIN KHUSUS CUSTOMER
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: 'Email dan password wajib diisi.' });
  }

  try {
    const [users] = await db.query('SELECT * FROM users WHERE email = ?', [email.trim()]);
    if (users.length === 0) {
      return res.status(401).json({ message: 'Email atau password salah.' });
    }

    const user = users[0];

    if (user.role !== 'customer') {
      return res.status(403).json({
        message: 'Akun Administrator tidak dapat masuk melalui halaman member. Gunakan Portal Admin.'
      });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Email atau password salah.' });
    }

    const token = jwt.sign(
      { id: user.id, name: user.name, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: '1d' }
    );

    res.json({
      message: 'Login customer berhasil.',
      token,
      user: { id: user.id, name: user.name, email: user.email, role: user.role }
    });
  } catch (error) {
    console.error('Customer Login Error:', error);
    res.status(500).json({ message: 'Terjadi kesalahan server saat login.' });
  }
});

// 3. LOGIN KHUSUS ADMINISTRATOR
router.post('/admin/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: 'Email dan password admin wajib diisi.' });
  }

  try {
    const [users] = await db.query('SELECT * FROM users WHERE email = ?', [email.trim()]);
    if (users.length === 0) {
      return res.status(401).json({ message: 'Kredensial admin tidak valid.' });
    }

    const user = users[0];

    if (user.role !== 'admin') {
      return res.status(403).json({
        message: 'Akses ditolak. Akun Anda bukan akun Administrator.'
      });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Kredensial admin tidak valid.' });
    }

    const token = jwt.sign(
      { id: user.id, name: user.name, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: '12h' }
    );

    res.json({
      message: 'Login Administrator berhasil.',
      token,
      user: { id: user.id, name: user.name, email: user.email, role: user.role }
    });
  } catch (error) {
    console.error('Admin Login Error:', error);
    res.status(500).json({ message: 'Terjadi kesalahan server saat login admin.' });
  }
});

// 4. KELOLA AKUN ADMIN (EDIT IDENTITAS, EMAIL & GANTI PASSWORD)
router.put('/admin/profile', verifyToken, isAdmin, async (req, res) => {
  const { name, email, currentPassword, newPassword } = req.body;
  const adminId = req.user.id;

  if (!name || !email || !currentPassword) {
    return res.status(400).json({
      message: 'Nama admin, email, dan kata sandi saat ini wajib diisi untuk verifikasi.'
    });
  }

  try {
    const [rows] = await db.query('SELECT * FROM users WHERE id = ? AND role = ?', [adminId, 'admin']);
    if (rows.length === 0) {
      return res.status(404).json({ message: 'Akun administrator tidak ditemukan.' });
    }

    const admin = rows[0];
    const isPasswordValid = await bcrypt.compare(currentPassword, admin.password);
    if (!isPasswordValid) {
      return res.status(401).json({ message: 'Kata sandi saat ini tidak sesuai.' });
    }

    const [emailCheck] = await db.query(
      'SELECT id FROM users WHERE email = ? AND id != ?',
      [email.trim(), adminId]
    );
    if (emailCheck.length > 0) {
      return res.status(400).json({ message: 'Email tersebut sudah digunakan oleh akun lain.' });
    }

    let updatedPasswordHash = admin.password;
    if (newPassword && newPassword.trim() !== '') {
      if (newPassword.trim().length < 6) {
        return res.status(400).json({ message: 'Kata sandi baru minimal 6 karakter.' });
      }
      const salt = await bcrypt.genSalt(10);
      updatedPasswordHash = await bcrypt.hash(newPassword.trim(), salt);
    }

    await db.query(
      'UPDATE users SET name = ?, email = ?, password = ? WHERE id = ?',
      [name.trim(), email.trim(), updatedPasswordHash, adminId]
    );

    const updatedUser = {
      id: admin.id,
      name: name.trim(),
      email: email.trim(),
      role: 'admin'
    };

    const newToken = jwt.sign(updatedUser, JWT_SECRET, { expiresIn: '12h' });

    res.json({
      message: 'Identitas dan kredensial akun admin berhasil diperbarui.',
      token: newToken,
      user: updatedUser
    });
  } catch (error) {
    console.error('Update Admin Profile Error:', error);
    res.status(500).json({ message: 'Gagal memperbarui akun admin.' });
  }
});

// 5. DAFTAR PELANGGAN (KHUSUS ADMIN)
router.get('/admin/customers', verifyToken, isAdmin, async (req, res) => {
  try {
    const [customers] = await db.query(
      `SELECT u.id, u.name, u.email, u.created_at, COUNT(o.id) AS total_orders
       FROM users u
       LEFT JOIN orders o ON u.id = o.user_id
       WHERE u.role = 'customer'
       GROUP BY u.id
       ORDER BY u.created_at DESC`
    );
    res.json(customers);
  } catch (error) {
    console.error('Get Customers Error:', error);
    res.status(500).json({ message: 'Gagal mengambil data pelanggan.' });
  }
});

// 6. CEK SESI AKTIF
router.get('/me', verifyToken, (req, res) => {
  res.json({ user: req.user });
});

module.exports = router;