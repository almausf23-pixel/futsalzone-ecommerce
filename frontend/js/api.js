const API_BASE_URL = 'http://localhost:5000/api';
const UPLOADS_BASE_URL = 'http://localhost:5000/uploads';

const AuthStorage = {
  // Sesi Customer
  setCustomerSession(token, user) {
    localStorage.setItem('fz_customer_token', token);
    localStorage.setItem('fz_customer_user', JSON.stringify(user));
  },
  getCustomerToken() {
    return localStorage.getItem('fz_customer_token');
  },
  getCustomerUser() {
    const raw = localStorage.getItem('fz_customer_user');
    return raw ? JSON.parse(raw) : null;
  },
  clearCustomerSession() {
    localStorage.removeItem('fz_customer_token');
    localStorage.removeItem('fz_customer_user');
  },

  // Sesi Admin
  setAdminSession(token, user) {
    localStorage.setItem('fz_admin_token', token);
    localStorage.setItem('fz_admin_user', JSON.stringify(user));
  },
  getAdminToken() {
    return localStorage.getItem('fz_admin_token');
  },
  getAdminUser() {
    const raw = localStorage.getItem('fz_admin_user');
    return raw ? JSON.parse(raw) : null;
  },
  clearAdminSession() {
    localStorage.removeItem('fz_admin_token');
    localStorage.removeItem('fz_admin_user');
  }
};

function formatRupiah(angka) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0
  }).format(angka);
}

function resolveProductImage(image) {
  if (!image) {
    return 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=600&q=80';
  }
  if (image.startsWith('http://') || image.startsWith('https://')) {
    return image;
  }
  return `${UPLOADS_BASE_URL}/${image}`;
}

async function apiCancelOrder(orderId, reason) {
  const token = AuthStorage.getCustomerToken();
  const response = await fetch(`${API_BASE_URL}/orders/${orderId}/cancel`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({ reason })
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || 'Gagal membatalkan pesanan');
  return data;
}

async function apiUpdateAdminAccount(payload) {
  const token = AuthStorage.getAdminToken();
  const response = await fetch(`${API_BASE_URL}/auth/admin/profile`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify(payload)
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || 'Gagal memperbarui akun admin');
  return data;
}