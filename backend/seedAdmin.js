require('dotenv').config();
const bcrypt = require('bcryptjs');
const db = require('./config/db');

async function createAdmin() {
  const adminName = 'Administrator FUTSALZONE';
  const adminEmail = 'admin@futsalzone.id';
  const adminPasswordPlain = 'AdminFutsal#2026';

  try {
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(adminPasswordPlain, salt);

    const [existing] = await db.query('SELECT id FROM users WHERE email = ?', [adminEmail]);

    if (existing.length > 0) {
      await db.query(
        'UPDATE users SET name = ?, password = ?, role = ? WHERE email = ?',
        [adminName, hashedPassword, 'admin', adminEmail]
      );
      console.log('Akun Admin berhasil diperbarui:');
    } else {
      await db.query(
        'INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)',
        [adminName, adminEmail, hashedPassword, 'admin']
      );
      console.log('Akun Admin baru berhasil dibuat:');
    }

    console.log(`Email    : ${adminEmail}`);
    console.log(`Password : ${adminPasswordPlain}`);
    process.exit(0);
  } catch (error) {
    console.error('Gagal membuat akun admin:', error);
    process.exit(1);
  }
}

createAdmin();