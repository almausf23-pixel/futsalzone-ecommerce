const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { verifyToken, isAdmin, isCustomer } = require('../middleware/authMiddleware');

// 1. CHECKOUT PESANAN (Customer + Potong Stok Otomatis)
router.post('/', verifyToken, isCustomer, async (req, res) => {
  const { customer_name, phone, shipping_address, courier, payment_method, items } = req.body;

  if (!customer_name || !phone || !shipping_address || !items || items.length === 0) {
    return res.status(400).json({ message: 'Data pengiriman dan item keranjang wajib lengkap.' });
  }

  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    let totalAmount = 0;
    const validatedItems = [];

    for (const item of items) {
      const [rows] = await connection.query('SELECT * FROM products WHERE id = ? FOR UPDATE', [item.id]);
      if (rows.length === 0) {
        throw new Error(`Produk dengan ID ${item.id} tidak ditemukan.`);
      }

      const product = rows[0];
      if (product.stock < item.quantity) {
        throw new Error(`Stok ${product.name} tidak mencukupi (tersisa ${product.stock}).`);
      }

      totalAmount += Number(product.price) * Number(item.quantity);
      validatedItems.push({
        product_id: product.id,
        product_name: product.name,
        color: item.color || 'Merah',
        size: item.size || 'EU 40',
        quantity: Number(item.quantity),
        price: Number(product.price)
      });

      await connection.query('UPDATE products SET stock = stock - ? WHERE id = ?', [
        Number(item.quantity),
        product.id
      ]);
    }

    const invoiceNumber = 'INV-FZ-' + Date.now().toString().slice(-8);

    const [orderResult] = await connection.query(
      `INSERT INTO orders
       (invoice_number, user_id, customer_name, phone, shipping_address, courier, payment_method, total_amount, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        invoiceNumber,
        req.user.id,
        customer_name,
        phone,
        shipping_address,
        courier || 'JNE Reguler',
        payment_method || 'QRIS / GoPay / OVO / DANA',
        totalAmount,
        'Proses Pembayaran'
      ]
    );

    const orderId = orderResult.insertId;

    for (const vItem of validatedItems) {
      await connection.query(
        `INSERT INTO order_items (order_id, product_id, product_name, color, size, quantity, price)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [orderId, vItem.product_id, vItem.product_name, vItem.color, vItem.size, vItem.quantity, vItem.price]
      );
    }

    await connection.commit();
    res.status(201).json({
      message: `Pesanan ${invoiceNumber} berhasil dibuat! Stok produk telah dikurangi otomatis.`,
      orderId,
      invoiceNumber
    });
  } catch (error) {
    await connection.rollback();
    console.error('Checkout Error:', error);
    res.status(400).json({ message: error.message || 'Gagal memproses pesanan.' });
  } finally {
    connection.release();
  }
});

// 2. RIWAYAT PESANAN CUSTOMER
router.get('/my-orders', verifyToken, isCustomer, async (req, res) => {
  try {
    const [orders] = await db.query(
      'SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC',
      [req.user.id]
    );

    for (const order of orders) {
      const [items] = await db.query('SELECT * FROM order_items WHERE order_id = ?', [order.id]);
      order.items = items;
    }

    res.json(orders);
  } catch (error) {
    console.error('My Orders Error:', error);
    res.status(500).json({ message: 'Gagal mengambil riwayat pesanan.' });
  }
});

// 3. BATALKAN PESANAN OLEH CUSTOMER + KEMBALIKAN STOK OTOMATIS
router.put('/:id/cancel', verifyToken, isCustomer, async (req, res) => {
  const orderId = req.params.id;
  const { reason } = req.body;
  const userId = req.user.id;

  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    const [orders] = await connection.query(
      'SELECT * FROM orders WHERE id = ? AND user_id = ? FOR UPDATE',
      [orderId, userId]
    );

    if (orders.length === 0) {
      await connection.rollback();
      return res.status(404).json({ message: 'Pesanan tidak ditemukan atau bukan milik akun Anda.' });
    }

    const order = orders[0];
    const blockedStatuses = ['Dikirim', 'Dikirim Kurir', 'Selesai', 'Dibatalkan'];

    if (blockedStatuses.includes(order.status)) {
      await connection.rollback();
      return res.status(400).json({
        message: `Pesanan dengan status "${order.status}" tidak dapat dibatalkan.`
      });
    }

    const [items] = await connection.query(
      'SELECT product_id, quantity FROM order_items WHERE order_id = ?',
      [orderId]
    );

    for (const item of items) {
      await connection.query(
        'UPDATE products SET stock = stock + ? WHERE id = ?',
        [item.quantity, item.product_id]
      );
    }

    const cancelNote = reason && reason.trim() !== '' ? reason.trim() : 'Dibatalkan oleh pembeli';
    await connection.query(
      'UPDATE orders SET status = ?, cancel_reason = ? WHERE id = ?',
      ['Dibatalkan', cancelNote, orderId]
    );

    await connection.commit();
    res.json({
      message: 'Pesanan berhasil dibatalkan dan stok produk telah dikembalikan.',
      orderId,
      status: 'Dibatalkan'
    });
  } catch (error) {
    await connection.rollback();
    console.error('Cancel Order Error:', error);
    res.status(500).json({ message: 'Terjadi kesalahan server saat membatalkan pesanan.' });
  } finally {
    connection.release();
  }
});

// 4. SEMUA PESANAN UNTUK ADMIN DASHBOARD
router.get('/admin/all', verifyToken, isAdmin, async (req, res) => {
  try {
    const [orders] = await db.query('SELECT * FROM orders ORDER BY created_at DESC');

    for (const order of orders) {
      const [items] = await db.query('SELECT * FROM order_items WHERE order_id = ?', [order.id]);
      order.items = items;
    }

    res.json(orders);
  } catch (error) {
    console.error('Admin Orders Error:', error);
    res.status(500).json({ message: 'Gagal mengambil daftar pesanan.' });
  }
});

// 5. UPDATE STATUS PESANAN (Admin)
router.put('/admin/:id/status', verifyToken, isAdmin, async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  const allowedStatus = ['Proses Pembayaran', 'Diproses Toko', 'Dikirim Kurir', 'Selesai', 'Dibatalkan'];
  if (!allowedStatus.includes(status)) {
    return res.status(400).json({ message: 'Status pesanan tidak valid.' });
  }

  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    const [orders] = await connection.query('SELECT * FROM orders WHERE id = ?', [id]);
    if (orders.length === 0) {
      throw new Error('Pesanan tidak ditemukan.');
    }

    const oldStatus = orders[0].status;

    if (status === 'Dibatalkan' && oldStatus !== 'Dibatalkan') {
      const [items] = await connection.query('SELECT * FROM order_items WHERE order_id = ?', [id]);
      for (const item of items) {
        await connection.query('UPDATE products SET stock = stock + ? WHERE id = ?', [
          item.quantity,
          item.product_id
        ]);
      }
      await connection.query(
        'UPDATE orders SET status = ?, cancel_reason = ? WHERE id = ?',
        [status, 'Dibatalkan oleh Admin', id]
      );
    } else {
      await connection.query('UPDATE orders SET status = ? WHERE id = ?', [status, id]);
    }

    await connection.commit();
    res.json({ message: `Status pesanan ${orders[0].invoice_number} diubah menjadi ${status}.` });
  } catch (error) {
    await connection.rollback();
    console.error('Update Order Status Error:', error);
    res.status(500).json({ message: error.message || 'Gagal memperbarui status pesanan.' });
  } finally {
    connection.release();
  }
});

module.exports = router;