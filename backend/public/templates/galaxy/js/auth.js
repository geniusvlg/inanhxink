// auth.js

import { SERVER_URL_PROD } from './config.js';

// Khởi tạo Firebase
const firebaseConfig = {
  apiKey: "AIzaSyDN3YxOpqxqfBQgHOvtFk6JJvztlV3vTH8",
  authDomain: "deargift-e6488.firebaseapp.com",
  projectId: "deargift-e6488",
  storageBucket: "deargift-e6488.appspot.com",
  messagingSenderId: "391379008795",
  appId: "1:391379008795:web:4b1c98f17f824690e2e7be",
  measurementId: "G-VGBLRMQM9L"
};
if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

// DOM elements
const googleLoginBtn = document.getElementById('googleLoginBtn');
const logoutBtn = document.getElementById('logoutBtn');
const userLogoContainer = document.getElementById('userLogoContainer');
const userLogo = document.getElementById('userLogo');
const userDropdown = document.getElementById('userDropdown');
const userAvatar = document.getElementById('userAvatar');
const userName = document.getElementById('userName');
const userEmail = document.getElementById('userEmail');

// Google Login
if (googleLoginBtn) {
  googleLoginBtn.addEventListener('click', async () => {
    const originalText = googleLoginBtn.innerHTML;
    googleLoginBtn.innerHTML = '<div class="loading"></div> Đang đăng nhập...';
    googleLoginBtn.disabled = true;

    try {
      const provider = new firebase.auth.GoogleAuthProvider();
      provider.addScope('email');
      const result = await firebase.auth().signInWithPopup(provider);
      const idToken = await result.user.getIdToken();

      // Gửi idToken lên backend nếu cần
      await fetch(`${SERVER_URL_PROD}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken })
      });
      // Có thể xử lý thêm nếu backend trả về thông tin
    } catch (error) {
      alert('❌ Đăng nhập thất bại: ' + error.message);
    } finally {
      googleLoginBtn.innerHTML = originalText;
      googleLoginBtn.disabled = false;
    }
  });
}

// Logout
if (logoutBtn) {
  logoutBtn.addEventListener('click', async () => {
    try {
      await firebase.auth().signOut();
    } catch (error) {
      alert('❌ Đăng xuất thất bại: ' + error.message);
    }
  });
}

// Toggle dropdown khi click vào logo
if (userLogo) {
  userLogo.addEventListener('click', () => {
    if (userDropdown) {
      const isVisible = userDropdown.style.display === 'block';
      userDropdown.style.display = isVisible ? 'none' : 'block';
    }
  });
}

// Đóng dropdown khi click bên ngoài
document.addEventListener('click', (event) => {
  if (userDropdown && userDropdown.style.display === 'block') {
    const isClickInside = userLogoContainer.contains(event.target) || userDropdown.contains(event.target);
    if (!isClickInside) {
      userDropdown.style.display = 'none';
    }
  }
});

// Event listener để load voucher khi sphere.js sẵn sàng
document.addEventListener('sphere_ready', () => {
  // Kiểm tra xem user đã đăng nhập chưa
  const user = firebase.auth().currentUser;
  if (user && typeof loadUserVouchers === 'function' && typeof window.getDynamicPrice === 'function') {
    loadUserVouchers(window.getDynamicPrice);
  }
});

// Auth State Listener
firebase.auth().onAuthStateChanged(user => {
  if (user) {
    // Đăng nhập thành công
    localStorage.setItem('user_uid', user.uid);
    localStorage.setItem('customerEmail', user.email);
    if (googleLoginBtn) googleLoginBtn.style.display = 'none';
    if (userLogoContainer) userLogoContainer.style.display = 'block';
    if (userLogo) userLogo.src = user.photoURL || 'https://via.placeholder.com/40x40/667eea/ffffff?text=👤';
    if (userAvatar) userAvatar.src = user.photoURL || 'https://via.placeholder.com/40x40/667eea/ffffff?text=👤';
    if (userName) userName.textContent = user.displayName || '';
    if (userEmail) userEmail.textContent = user.email || '';
    // Gọi loadUserVouchers nếu có
    if (typeof loadUserVouchers === 'function') {
      // Đợi một chút để đảm bảo DOM và các function đã sẵn sàng
      setTimeout(() => {
        // Kiểm tra xem có hàm getDynamicPrice không (từ sphere.js)
        if (typeof window.getDynamicPrice === 'function') {
          loadUserVouchers(window.getDynamicPrice);
        } else {
          // Fallback: tạo hàm đơn giản trả về 0
          loadUserVouchers(() => 0);
        }
      }, 500); // Đợi 500ms để đảm bảo sphere.js đã load xong
    }
  } else {
    // Đăng xuất
    localStorage.removeItem('user_uid');
    localStorage.removeItem('customerEmail');
    if (googleLoginBtn) googleLoginBtn.style.display = 'flex';
    if (userLogoContainer) userLogoContainer.style.display = 'none';
    if (userDropdown) userDropdown.style.display = 'none';
    if (userLogo) userLogo.src = '';
    if (userAvatar) userAvatar.src = '';
    if (userName) userName.textContent = '';
    if (userEmail) userEmail.textContent = '';
    
    // Xóa danh sách voucher nếu muốn
  }
});
