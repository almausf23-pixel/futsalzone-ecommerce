CREATE DATABASE IF NOT EXISTS futsalzone_db;
USE futsalzone_db;

-- 1. Tabel Pengguna (Customer & Admin)
CREATE TABLE users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(100) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    phone VARCHAR(20),
    role ENUM('customer', 'admin') DEFAULT 'customer',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Tabel Produk Sepatu Futsal
CREATE TABLE products (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    brand VARCHAR(50) NOT NULL,
    category VARCHAR(50) NOT NULL,
    price DECIMAL(12, 2) NOT NULL,
    discount_price DECIMAL(12, 2) DEFAULT NULL,
    stock INT NOT NULL DEFAULT 0,
    sizes JSON NOT NULL,
    colors JSON NOT NULL,
    image_url TEXT NOT NULL,
    rating DECIMAL(2, 1) DEFAULT 5.0,
    is_featured BOOLEAN DEFAULT FALSE,
    is_new BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. Tabel Pesanan (Orders)
CREATE TABLE orders (
    id VARCHAR(30) PRIMARY KEY,
    user_id INT NOT NULL,
    customer_name VARCHAR(100) NOT NULL,
    customer_phone VARCHAR(20) NOT NULL,
    shipping_address TEXT NOT NULL,
    payment_method VARCHAR(50) NOT NULL,
    total_amount DECIMAL(12, 2) NOT NULL,
    status ENUM('Proses Pembayaran', 'Diproses Toko', 'Dikirim Kurir', 'Selesai', 'Dibatalkan') DEFAULT 'Proses Pembayaran',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 4. Tabel Detail Item Pesanan
CREATE TABLE order_items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    order_id VARCHAR(30) NOT NULL,
    product_id INT NOT NULL,
    product_name VARCHAR(150) NOT NULL,
    selected_size VARCHAR(10) NOT NULL,
    selected_color VARCHAR(30) NOT NULL,
    quantity INT NOT NULL,
    price DECIMAL(12, 2) NOT NULL,
    image_url TEXT NOT NULL,
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id)
);

-- 5. Tabel Notifikasi Pemilik Store
CREATE TABLE owner_notifications (
    id INT AUTO_INCREMENT PRIMARY KEY,
    order_id VARCHAR(30) NOT NULL,
    title VARCHAR(150) NOT NULL,
    message TEXT NOT NULL,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Data Awal Produk Sepatu Futsal
INSERT INTO products (name, brand, category, price, discount_price, stock, sizes, colors, image_url, rating, is_featured, is_new) VALUES
('Adidas Top Sala Competition', 'Adidas', 'Sepatu Futsal Indoor', 1300000, 1099000, 14, '["39","40","41","42","43"]', '["Merah","Hitam","Putih"]', 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=600&q=80', 4.9, TRUE, FALSE),
('Nike Lunar Gato II IC', 'Nike', 'Sepatu Futsal Profesional', 1499000, 1299000, 10, '["40","41","42","43","44"]', '["Putih","Hitam","Merah"]', 'https://images.unsplash.com/photo-1600185365483-26d7a4cc7519?w=600&q=80', 4.9, TRUE, TRUE),
('Specs Accelerator Lightspeed Reborn IN', 'Specs', 'Sepatu Futsal Pria', 649800, 549000, 22, '["38","39","40","41","42","43"]', '["Merah","Putih","Hitam"]', 'https://images.unsplash.com/photo-1608231387042-66d1773070a5?w=600&q=80', 4.8, TRUE, TRUE),
('Ortuseight Jogosala Rampage', 'Ortuseight', 'Sepatu Futsal Pria', 499000, 429000, 18, '["38","39","40","41","42"]', '["Hitam","Merah"]', 'https://images.unsplash.com/photo-1595950653106-6c9ebd614d3a?w=600&q=80', 4.7, FALSE, TRUE),
('Puma Ultra Court IT', 'Puma', 'Sepatu Futsal Wanita', 1199000, 950000, 8, '["36","37","38","39","40"]', '["Putih","Merah"]', 'https://images.unsplash.com/photo-1551107696-a4b0c5a0d9a2?w=600&q=80', 4.8, TRUE, FALSE);