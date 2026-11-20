const mysql = require('mysql2/promise');
require('dotenv').config();

const isCloudDB = process.env.DB_HOST && process.env.DB_HOST !== 'localhost';

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'futsalzone_db',
  ssl: isCloudDB ? { minVersion: 'TLSv1.2', rejectUnauthorized: true } : undefined,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

module.exports = pool;