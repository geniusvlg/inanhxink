// js/payment.js - Logic xử lý thanh toán
import { SERVER_URL_PROD } from './config.js';

// Constants
const SOCKET_CONFIG = {
  TIMEOUT: 20000,
  RECONNECTION_ATTEMPTS: 5,
  RECONNECTION_DELAY: 1000,
  PAYMENT_TIMEOUT: 300000
};

/**
 * Socket Manager Class - Quản lý WebSocket connection
 */
class SocketManager {
  constructor() {
    this.socket = null;
    this.currentOrder = null;
    this.eventHandlers = new Map();
    this.isConnected = false;
  }

  /**
   * Khởi tạo WebSocket connection
   */
  init() {
    try {
      this.socket = io(`${SERVER_URL_PROD}`, {
        transports: ['websocket', 'polling'],
        timeout: SOCKET_CONFIG.TIMEOUT,
        reconnection: true,
        reconnectionDelay: SOCKET_CONFIG.RECONNECTION_DELAY,
        reconnectionAttempts: SOCKET_CONFIG.RECONNECTION_ATTEMPTS
      });

      this._setupEventListeners();
      return this.socket;
    } catch (error) {
      console.error('Lỗi khởi tạo WebSocket:', error);
      return null;
    }
  }

  /**
   * Thiết lập event listeners
   */
  _setupEventListeners() {
    if (!this.socket) return;

    this.socket.on('connect', () => {
      console.log('🔌 WebSocket connected:', this.socket.id);
      this.isConnected = true;
      this._handleReconnection();
    });

    this.socket.on('disconnect', () => {
      console.log('🔌 WebSocket disconnected');
      this.isConnected = false;
    });

    this.socket.on('connect_error', (error) => {
      console.error('🔌 WebSocket connection error:', error);
      this.isConnected = false;
    });
  }

  /**
   * Xử lý kết nối lại khi reconnect
   */
  _handleReconnection() {
    const currentOrderCode = localStorage.getItem('current_order_code');
    const isPaymentInProgress = localStorage.getItem('payment_in_progress') === 'true';

    if (currentOrderCode && isPaymentInProgress) {
      this.joinOrder(currentOrderCode);
    }
  }

  /**
   * Join vào room theo dõi order
   */
  joinOrder(orderCode) {
    if (!this.socket || !this.isConnected) {
      console.error('❌ Socket chưa kết nối');
      return false;
    }

    // Leave room cũ nếu có
    if (this.currentOrder && this.currentOrder !== orderCode) {
      this.leaveOrder(this.currentOrder);
    }

    this.socket.emit('join-order', orderCode);
    this.currentOrder = orderCode;
    return true;
  }

  /**
   * Leave khỏi room
   */
  leaveOrder(orderCode) {
    if (!this.socket || !this.isConnected) return;

    this.socket.emit('leave-order', orderCode);
    if (this.currentOrder === orderCode) {
      this.currentOrder = null;
    }
  }

  /**
   * Đăng ký event handler với cleanup
   */
  on(event, handler) {
    if (!this.socket) return;

    // Lưu handler để có thể remove sau
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, []);
    }
    this.eventHandlers.get(event).push(handler);

    this.socket.on(event, handler);
  }

  /**
   * Remove event handler
   */
  off(event, handler) {
    if (!this.socket) return;

    this.socket.off(event, handler);

    if (this.eventHandlers.has(event)) {
      const handlers = this.eventHandlers.get(event);
      const index = handlers.indexOf(handler);
      if (index > -1) {
        handlers.splice(index, 1);
      }
    }
  }

  /**
   * Cleanup tất cả event handlers
   */
  cleanup() {
    if (!this.socket) return;

    // Remove tất cả event handlers
    for (const [event, handlers] of this.eventHandlers) {
      handlers.forEach(handler => {
        this.socket.off(event, handler);
      });
    }
    this.eventHandlers.clear();

    // Leave current order
    if (this.currentOrder) {
      this.leaveOrder(this.currentOrder);
    }

    this.socket.disconnect();
    this.socket = null;
    this.currentOrder = null;
    this.isConnected = false;
  }

  /**
   * Kiểm tra trạng thái kết nối
   */
  isSocketConnected() {
    return this.socket && this.isConnected;
  }
}

// Tạo instance global
const socketManager = new SocketManager();

/**
 * Khởi tạo WebSocket connection
 */
export function initWebSocket() {
  const socket = socketManager.init();

  // Lưu reference cho backward compatibility
  window.socket = socketManager.socket;

  return socket;
}

/**
 * Hàm xử lý thanh toán
 * @param {number} finalPrice - Giá tiền cần thanh toán
 * @param {Function} showToast - Hàm hiển thị thông báo
 * @param {HTMLElement} loading - Element loading (nếu có)
 * @param {string} orderCode - Mã đơn hàng (nếu có)
 * @returns {Promise<boolean>} - Trả về true nếu thanh toán thành công, false nếu thất bại
 */

export async function processPayment(finalPrice, showToast, loading = null, orderCode = null, paymentMethod = 'PAYOS') {
  // --- BẮT ĐẦU: Thanh toán trước ---
  try {
    const paymentMethodText = paymentMethod === 'PAYPAL' ? 'PAYPAL' : 'PAYOS';
    showToast(`Đang chuyển đến trang thanh toán ${paymentMethodText}...`, 'info');

    // Chuẩn bị dữ liệu thanh toán
    const paymentData = {
      amount: finalPrice,
      description: "LovePlanet",
      orderCode: Number(orderCode),
      uid: localStorage.getItem('user_uid'),
      customerEmail: localStorage.getItem('customerEmail'),
      paymentMethod: paymentMethod, // Thêm phương thức thanh toán
    };

    const res = await fetch(`${SERVER_URL_PROD}/api/payment/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(paymentData)
    });

    const resultData = await res.json();

    // Xử lý khác nhau cho PAYOS và PAYPAL
    if (paymentMethod === 'PAYPAL') {
      // PayPal điều hướng trực tiếp
      let checkoutUrl = '';

      // Kiểm tra trường hợp có đơn hàng chưa thanh toán (code: "00")
      if (resultData.code === "00" && resultData.data?.checkoutUrl) {
        // Trường hợp có đơn hàng chưa thanh toán
        checkoutUrl = resultData.data.checkoutUrl;
      } else {
        // PayPal trả về: resultData.data.checkoutUrl
        checkoutUrl = resultData.data?.checkoutUrl || '';
      }

      if (checkoutUrl) {
        // Hiển thị thông báo phù hợp
        if (resultData.code === "00") {
          showToast('Đang chuyển đến trang thanh toán PayPal...', 'info');
        }

        // Cleanup state trước khi điều hướng
        cleanupPaymentState(paymentData.orderCode, false);

        // Điều hướng trực tiếp đến PayPal
        window.location.href = checkoutUrl;
        return true;
      } else {
        console.error('❌ Không nhận được checkoutUrl từ server');
        showToast('Lỗi tạo thanh toán! Vui lòng thử lại.', 'error');
        return false;
      }
    } else {
      // PAYOS cần checkoutUrl và WebSocket
      let checkoutUrl = '';

      // Kiểm tra trường hợp có đơn hàng chưa thanh toán (code: "00")
      if (resultData.code === "00" && resultData.data?.checkoutUrl) {
        // Trường hợp có đơn hàng chưa thanh toán
        checkoutUrl = resultData.data.checkoutUrl;

        // QUAN TRỌNG: Cập nhật orderCode cũ cho đơn hàng tương tự
        if (resultData.data.isExistingOrder && resultData.data.orderCode) {
          const oldOrderCode = resultData.data.orderCode;

          // Cập nhật localStorage với orderCode cũ
          localStorage.setItem('current_order_code', oldOrderCode);

          // Leave room orderCode mới (nếu có)
          if (socketManager.socket && paymentData.orderCode) {
            socketManager.leaveOrder(paymentData.orderCode);
          }

          // Join room với orderCode cũ
          if (socketManager.socket) {
            socketManager.joinOrder(oldOrderCode);
          }

        }
      } else {
        // PAYOS trả về: resultData.data.checkoutUrl
        checkoutUrl = resultData.data?.checkoutUrl || '';
      }

      if (checkoutUrl) {
        // Hiển thị thông báo phù hợp
        if (resultData.code === "00") {
          showToast('Đang chuyển đến trang thanh toán...', 'info');
        }

        // Đóng dashboard trước khi hiển thị iframe thanh toán
        const dashboard = document.querySelector('.dashboard');
        if (dashboard) dashboard.style.display = 'none';

        // Hiển thị modal thanh toán
        const paymentModal = document.getElementById('paymentModal');
        const paymentIframe = document.getElementById('paymentIframe');

        if (paymentModal && paymentIframe) {
          paymentIframe.src = checkoutUrl;
          paymentModal.style.display = 'block';

          // Set flag đang trong quá trình thanh toán
          localStorage.setItem('payment_in_progress', 'true');
          localStorage.setItem('current_order_code', paymentData.orderCode);

          // Lắng nghe WebSocket cho PAYOS
          await new Promise((resolve, reject) => {
            let iframeLoaded = false;
            let wsMessageReceived = false;

            // Hàm kiểm tra và xử lý kết quả
            const checkAndProcessResult = () => {
              if (iframeLoaded && wsMessageReceived) {
              }
            };

            // Set iframe events cho PAYOS
            paymentIframe.onload = () => {
              iframeLoaded = true;
              checkAndProcessResult();
            };

            paymentIframe.onerror = () => {
              console.log('❌ Iframe error - có thể do lỗi mạng hoặc trang lỗi');
            };

            paymentIframe.onbeforeunload = () => {
              console.log('🔄 Iframe beforeunload - người dùng có thể đã đóng hoặc refresh');
            };

            // Lắng nghe WebSocket event cho PAYOS
            if (socketManager.isSocketConnected()) {
              socketManager.joinOrder(paymentData.orderCode);

              const paymentStatusHandler = (data) => {
                if (data.orderCode === paymentData.orderCode) {
                  wsMessageReceived = true;

                  if (data.status === 'PAID') {
                    cleanupPaymentState(paymentData.orderCode, false);
                    showToast('Thanh toán thành công! Đang chuyển hướng...');

                    // Đóng iframe ngay lập tức
                    const paymentModal = document.getElementById('paymentModal');
                    if (paymentModal) {
                      paymentModal.style.display = 'none';
                    }
                    if (loading) loading.style.display = 'block';

                    // Trigger popup sau khi đóng iframe
                    setTimeout(() => {
                      window.dispatchEvent(new CustomEvent('payment_success', {
                        detail: { orderCode: paymentData.orderCode }
                      }));
                    }, 1000); // Delay 1s để iframe đóng hoàn toàn

                    socketManager.off('payment_status_update', paymentStatusHandler);
                    resolve();
                  } else if (data.status === 'CANCELLED') {
                    cleanupPaymentState(paymentData.orderCode, false);
                    showToast('Thanh toán đã bị hủy', 'warning');
                    socketManager.off('payment_status_update', paymentStatusHandler);
                    reject(new Error('Thanh toán bị hủy'));
                  } else if (data.status === 'failed') {
                    cleanupPaymentState(paymentData.orderCode, true);
                    socketManager.off('payment_status_update', paymentStatusHandler);
                    reject(new Error(data.message || 'Thanh toán thất bại!'));
                  }
                }
              };

              socketManager.on('payment_status_update', paymentStatusHandler);
            } else {
              console.error('❌ WebSocket chưa được khởi tạo!');
              reject(new Error('WebSocket connection error!'));
            }

            // Fallback: Timeout sau 5 phút
            setTimeout(() => {
              if (!wsMessageReceived) {
                cleanupPaymentState(paymentData.orderCode, false);
                showToast('Timeout - Không thể xác định trạng thái thanh toán!', 'warning');
                reject(new Error('Timeout - Không thể xác định trạng thái thanh toán!'));
              }
            }, SOCKET_CONFIG.PAYMENT_TIMEOUT); // 5 phút
          });

          return true;
        } else {
          console.error('Không tìm thấy modal thanh toán!');
          showToast('Lỗi hiển thị trang thanh toán!', 'error');
          return false;
        }
      } else {
        console.error('❌ Không nhận được checkoutUrl từ server');
        showToast('Lỗi tạo thanh toán! Vui lòng thử lại.', 'error');
        return false;
      }
    }
  } catch (err) {
    console.error('Lỗi khi gọi API thanh toán:', err);
    showToast('Thanh toán thất bại hoặc bị hủy!', 'error');
    return false;
  }
}

/**
 * Hàm tạo modal thanh toán nếu chưa có
 */
export function createPaymentModal() {
  // Kiểm tra xem modal đã tồn tại chưa
  if (document.getElementById('paymentModal')) {
    return;
  }

  const modalHTML = `
    <div id="paymentModal" style="display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.8); z-index: 10000;">
      <div style="position: relative; width: 100%; height: 100%; display: flex; align-items: center; justify-content: center;">
        <div style="background: white; border-radius: 10px; width: 95vw; max-width: 800px; height: 85vh; max-height: 600px; position: relative;">
          <button onclick="document.getElementById('paymentModal').style.display='none'" 
                  style="position: absolute; top: 10px; right: 10px; background: #ff6b6b; color: white; border: none; border-radius: 50%; width: 30px; height: 30px; cursor: pointer; z-index: 10001;">
            ×
          </button>
          <iframe id="paymentIframe" 
                  style="width: 100%; height: 100%; border: none; border-radius: 10px;" 
                  frameborder="0">
          </iframe>
        </div>
      </div>
    </div>
  `;

  document.body.insertAdjacentHTML('beforeend', modalHTML);
}

/**
 * Hàm clean up trạng thái thanh toán
 * @param {string} orderCode - Mã đơn hàng
 * @param {boolean} closeIframe - Có đóng iframe không
 */
export function cleanupPaymentState(orderCode, closeIframe = false) {
  // Clear flag thanh toán
  localStorage.removeItem('payment_in_progress');

  // Clear orderCode nếu có
  if (orderCode) {
    localStorage.removeItem('current_order_code');
  }

  // Leave room nếu có socket
  if (socketManager.isSocketConnected() && orderCode) {
    socketManager.leaveOrder(orderCode);
  }

  // Đóng iframe nếu cần
  if (closeIframe) {
    const paymentModal = document.getElementById('paymentModal');
    if (paymentModal) {
      paymentModal.style.display = 'none';
    }
  }
}

/**
 * Hàm cleanup toàn bộ WebSocket connection
 * Sử dụng khi logout hoặc đóng ứng dụng
 */
export function cleanupWebSocket() {
  socketManager.cleanup();
}

/**
 * Hàm hiển thị toast message (có thể tùy chỉnh)
 * @param {string} message - Nội dung thông báo
 * @param {string} type - Loại thông báo (success, error, info, warning)
 * @param {number} durationMs - Thời gian hiển thị (ms), mặc định 3000ms
 */
export function showToast(message, type = 'info', durationMs = 3000) {
  // Tạo toast element nếu chưa có
  let toastContainer = document.getElementById('toast-container');
  if (!toastContainer) {
    toastContainer = document.createElement('div');
    toastContainer.id = 'toast-container';
    toastContainer.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      z-index: 9999999999;
      display: flex;
      flex-direction: column;
      gap: 10px;
    `;
    document.body.appendChild(toastContainer);
  }

  // Tạo toast message
  const toast = document.createElement('div');
  toast.style.cssText = `
    background: ${type === 'success' ? '#4caf50' : type === 'error' ? '#f44336' : type === 'warning' ? '#ff9800' : '#2196f3'};
    color: white;
    padding: 12px 20px;
    border-radius: 5px;
    box-shadow: 0 2px 10px rgba(0,0,0,0.2);
    font-family: Arial, sans-serif;
    font-size: clamp(12px, 3.5vw, 14px);
    max-width: 80vw;
    word-wrap: break-word;
    animation: slideIn 0.3s ease;
  `;
  toast.textContent = message;

  // Thêm CSS animation
  if (!document.getElementById('toast-styles')) {
    const style = document.createElement('style');
    style.id = 'toast-styles';
    style.textContent = `
      @keyframes slideIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
      }
      @keyframes slideOut {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(100%); opacity: 0; }
      }
    `;
    document.head.appendChild(style);
  }

  toastContainer.appendChild(toast);

  // Tự động xóa sau durationMs
  setTimeout(() => {
    toast.style.animation = 'slideOut 0.3s ease';
    setTimeout(() => {
      if (toast.parentNode) {
        toast.parentNode.removeChild(toast);
      }
    }, 300);
  }, durationMs);
} 