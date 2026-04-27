// Quản lý voucher, tip và cập nhật giá cho thanh toán
import { SERVER_URL_PROD } from './config.js';

let selectedVoucher = null;
let vouchers = [];
let finalPrice = 0;

export function updateTotalPrice(getDynamicPrice) {
  const totalPriceDiv = document.getElementById('totalPrice');
  const tipInput = document.getElementById('tipAmount');
  const tip = tipInput ? parseInt(tipInput.value, 10) || 0 : 0;
  let price = typeof getDynamicPrice === 'function' ? getDynamicPrice() : 0;
  
  // Cộng tip vào giá trước khi áp dụng voucher
  let totalBeforeVoucher = price + tip;
  
  if (selectedVoucher) {
    // Áp dụng voucher chỉ cho phần giá gốc (không bao gồm tip)
    const discountAmount = Math.round(price * selectedVoucher.discountValue / 100);
    finalPrice = totalBeforeVoucher - discountAmount;
    
  } else {
    finalPrice = totalBeforeVoucher;
  }
  
  // Kiểm tra phương thức thanh toán được chọn
  const paypalRadio = document.querySelector('input[name="paymentMethod"][value="PAYPAL"]');
  const isPayPalSelected = paypalRadio ? paypalRadio.checked : false;
  
  // Cập nhật đơn vị tip input
  if (tipInput) {
    if (isPayPalSelected) {
      tipInput.placeholder = 'Nhập tip (USD)';
      tipInput.step = '1';
      tipInput.min = '0';
      tipInput.max = '100';
    } else {
      tipInput.placeholder = 'Nhập tip (VNĐ)';
      tipInput.step = '1000';
      tipInput.min = '0';
      tipInput.max = '1000000';
    }
  }
  
  if (totalPriceDiv) {
    // Nếu tổng tiền là 0, luôn hiển thị theo kiểu PAYOS (VNĐ)
    if (finalPrice === 0) {
      totalPriceDiv.innerHTML = `
        <div style="margin-bottom: 8px;">
          <span style="color:#e53935;">0 VNĐ</span>
        </div>
      `;
    } else if (isPayPalSelected) {
      // Hiển thị giá USD khi chọn PayPal và có giá
      const tipUSD = tip; // Tip trực tiếp bằng USD
      const paypalPrice = 5 + tipUSD;
      
      totalPriceDiv.innerHTML = `
        <div style="margin-bottom: 8px;">
          <span style="color:#4ecdc4;font-size:16px;font-weight:bold;">$${paypalPrice} USD</span>
          ${tipUSD > 0 ? ` <span style="font-size:14px;color:#888;">(tip $${tipUSD} USD)</span>` : ''}
        </div>
      `;
    } else {
      // Hiển thị giá VND khi chọn PAYOS hoặc chưa chọn
      if (selectedVoucher) {
        const discountText = `(giảm ${selectedVoucher.discountValue}% = -${Math.round(price * selectedVoucher.discountValue / 100).toLocaleString()}đ)`;
        totalPriceDiv.innerHTML = `
          <div style="margin-bottom: 8px;">
            <span style="color:#e53935;">${finalPrice.toLocaleString()} VNĐ</span> 
            <span style="font-size:14px;color:#888;">${discountText}${tip > 0 ? `, tip ${tip.toLocaleString()} VNĐ` : ''}</span>
          </div>
        `;
      } else {
        totalPriceDiv.innerHTML = `
          <div style="margin-bottom: 8px;">
            <span style="color:#e53935;">${finalPrice.toLocaleString()} VNĐ</span>${tip > 0 ? ` <span style="font-size:14px;color:#888;">(tip ${tip.toLocaleString()} VNĐ)</span>` : ''}
          </div>
        `;
      }
    }
  }

  // Ẩn/hiện phương thức thanh toán dựa trên tổng tiền
  const paymentMethodSection = document.getElementById('paymentMethodSection');
  if (paymentMethodSection) {
    if (finalPrice > 0) {
      paymentMethodSection.style.display = 'block';
    } else {
      paymentMethodSection.style.display = 'none';
    }
  }
}

export async function loadUserVouchers(getDynamicPrice) {
  const voucherList = document.getElementById('voucherList');
  const voucherResult = document.getElementById('voucherResult');
  if (!voucherList) return;
  voucherList.innerHTML = 'Đang tải voucher...';
  if (voucherResult) voucherResult.style.display = 'none';
  selectedVoucher = null;
  vouchers = [];
  updateTotalPrice(getDynamicPrice);
  
  const uid = localStorage.getItem('user_uid');
  
  if(!uid){
    voucherList.innerHTML = '<span style="color:#e53935;">Bạn cần đăng nhập để xem voucher!</span>';
    return;
  }
  try {
    const res = await fetch(`${SERVER_URL_PROD}/api/vouchers/saved/${uid}`);
    const data = await res.json();
   if (!data.success) {
      voucherList.innerHTML = `<span style="color:#e53935;">${data.message}</span>`;
      return;
    }
    if (!data.data.length) {
      voucherList.innerHTML = '<span style="color:#888;">Bạn không có voucher nào cả!</span>';
      return;
    }
    vouchers = data.data; 
    // vouchers =fakeVouchers;
    voucherList.innerHTML = vouchers.map((v, idx) => `
      <div class=\"voucher-item\" data-idx=\"${idx}\">\n        <input class= \"checkbox\" type=\"checkbox\" name=\"voucher\" id=\"voucher_${idx}\">\n        <label for=\"voucher_${idx}\">\n          <b>${v.code}</b> - Giảm: ${v.discountValue}% | HSD: ${new Date(v.expiredAt).toLocaleDateString()}\n        </label>\n      </div>\n    `).join('');
    selectedVoucher = null; // Không chọn mặc định
    updateTotalPrice(getDynamicPrice);
  } catch (err) {
    voucherList.innerHTML = '<span style=\"color:#e53935;\">Không thể tải voucher!</span>';
  }
}

export function setupVoucherListeners(getDynamicPrice) {
  // getDynamicPrice là hàm callback trả về tổng tiền động
  const voucherList = document.getElementById('voucherList');
  if (voucherList) {
    voucherList.addEventListener('change', (e) => {
      if (e.target.name === 'voucher') {
        const checkboxes = voucherList.querySelectorAll('input[name=\"voucher\"]');
        const idx = Array.from(checkboxes).findIndex(cb => cb === e.target);
        if (e.target.checked) {
          checkboxes.forEach((cb, i) => cb.checked = i === idx);
          selectedVoucher = vouchers[idx];

        } else {
          selectedVoucher = null;
        }
        updateTotalPrice(getDynamicPrice);
      }
    });
  }
  // Lắng nghe tip
  const tipInput = document.getElementById('tipAmount');
  if (tipInput) {
    tipInput.addEventListener('input', () => {
      // Validation tip
      let tipValue = parseInt(tipInput.value, 10) || 0;
      if (tipValue < 0) {
        tipValue = 0;
        tipInput.value = 0;
      }
      if (tipValue > 1000000) { // Giới hạn 1 triệu
        tipValue = 1000000;
        tipInput.value = 1000000;
      }
      // Cập nhật giá ngay lập tức khi thay đổi tip
      updateTotalPrice(getDynamicPrice);
    });
  }
}

export function getSelectedVoucherCode() {
  return selectedVoucher ? selectedVoucher.code : null;
}

export function getSelectedVoucherInfo() {
  return selectedVoucher ? {
    code: selectedVoucher.code,
    discountValue: selectedVoucher.discountValue,
    expiredAt: selectedVoucher.expiredAt
  } : null;
}

export function getFinalPrice() {
  return finalPrice;
} 