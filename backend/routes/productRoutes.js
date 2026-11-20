const express = require('express');
const router = express.Router();
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const db = require('../config/db');
const { verifyToken, isAdmin } = require('../middleware/authMiddleware');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }
});

const uploadToCloudinary = (fileBuffer) => {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder: 'futsalzone_products' },
      (error, result) => {
        if (error) reject(error);
        else resolve(result);
      }
    );
    stream.end(fileBuffer);
  });
};

// GET Semua Produk
router.get('/', async (req, res) => {
  const { brand, search } = req.query;
  try {
    let query = 'SELECT * FROM products WHERE 1=1';
    const params = [];

    if (brand && brand !== 'Semua') {
      query += ' AND brand = ?';
      params.push(brand);
    }
    if (search) {
      query += ' AND name LIKE ?';
      params.push(`%${search}%`);
    }

    query += ' ORDER BY id DESC';
    const [rows] = await db.query(query, params);
    res.json(rows);
  } catch (error) {
    console.error('Get Products Error:', error);
    res.status(500).json({ message: 'Gagal mengambil data produk.' });
  }
});

// POST Tambah Produk Baru (Admin)
router.post('/', verifyToken, isAdmin, upload.single('imageFile'), async (req, res) => {
  const { name, brand, price, stock, description, imageUrl } = req.body;

  if (!name || !brand || !price || stock === undefined) {
    return res.status(400).json({ message: 'Nama, brand, harga, dan stok wajib diisi.' });
  }

  try {
    let imagePath = imageUrl || '';
    if (req.file) {
      const uploadResult = await uploadToCloudinary(req.file.buffer);
      imagePath = uploadResult.secure_url;
    }

    const [result] = await db.query(
      'INSERT INTO products (name, brand, price, stock, image, description) VALUES (?, ?, ?, ?, ?, ?)',
      [name, brand, Number(price), Number(stock), imagePath, description || '']
    );

    res.status(201).json({
      message: 'Produk berhasil ditambahkan.',
      productId: result.insertId
    });
  } catch (error) {
    console.error('Add Product Error:', error);
    res.status(500).json({ message: 'Gagal menambahkan produk.' });
  }
});

// PUT Edit Produk & Stok (Admin)
router.put('/:id', verifyToken, isAdmin, upload.single('imageFile'), async (req, res) => {
  const { id } = req.params;
  const { name, brand, price, stock, description, imageUrl } = req.body;

  try {
    const [existing] = await db.query('SELECT * FROM products WHERE id = ?', [id]);
    if (existing.length === 0) {
      return res.status(404).json({ message: 'Produk tidak ditemukan.' });
    }

    const current = existing[0];
    let finalImage = imageUrl !== undefined && imageUrl !== '' ? imageUrl : current.image;

    if (req.file) {
      const uploadResult = await uploadToCloudinary(req.file.buffer);
      finalImage = uploadResult.secure_url;
    }

    await db.query(
      'UPDATE products SET name = ?, brand = ?, price = ?, stock = ?, image = ?, description = ? WHERE id = ?',
      [
        name || current.name,
        brand || current.brand,
        price !== undefined ? Number(price) : current.price,
        stock !== undefined ? Number(stock) : current.stock,
        finalImage,
        description !== undefined ? description : current.description,
        id
      ]
    );

    res.json({ message: 'Produk berhasil diperbarui.' });
  } catch (error) {
    console.error('Update Product Error:', error);
    res.status(500).json({ message: 'Gagal memperbarui produk.' });
  }
});

// DELETE Hapus Produk (Admin)
router.delete('/:id', verifyToken, isAdmin, async (req, res) => {
  const { id } = req.params;
  try {
    await db.query('DELETE FROM products WHERE id = ?', [id]);
    res.json({ message: 'Produk berhasil dihapus.' });
  } catch (error) {
    console.error('Delete Product Error:', error);
    res.status(500).json({ message: 'Gagal menghapus produk.' });
  }
});

module.exports = router;