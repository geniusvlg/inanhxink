// Thay bằng lấy từ window nếu có, hoặc fallback:
const SERVER_URL_PROD = window.SERVER_URL_PROD || 'https://api.deargift.online';

// Biến cho phép custom màu sao băng
let selectedColor = '#00f0ff'; // Bạn có thể đổi màu này tuỳ ý
let gradientColor1 = '#00f0ff';
let gradientColor2 = '#ffffff';
let isGradientMode = false;
let currentMeteorSpeed = 4; // Giá trị mặc định, sẽ cập nhật theo dashboard
let isMeteorShowerActive = false; // Biến kiểm soát trạng thái bật/tắt mưa sao băng
let isMeteorFeatureEnabled = false; // Biến kiểm tra xem có config mưa sao băng trong URL không

// Export biến để truy cập từ bên ngoài
window.isMeteorShowerActive = isMeteorShowerActive;

const NUM_GROUPS = 15;
const GROUP_INTERVAL = 200; 
const meteors = [];
const groupDelays = [];
for (let g = 0; g < NUM_GROUPS; g++) {
    groupDelays[g] = g * GROUP_INTERVAL;
}

class Meteor {
    constructor(groupIndex) {
        this.groupIndex = groupIndex;
        this.groupDelay = groupDelays[groupIndex];
        // Thêm delay ngẫu nhiên cho từng sao băng trong tốp (0-900ms)
        this.individualDelay = Math.random() * 8000;
        
        // Thêm delay ngẫu nhiên cho đợt đầu tiên để tránh bay cùng lúc
        const initialRandomDelay = 0;
        
        this.lastStart = Date.now();
        this.active = false;
        
        // Phân bố sao băng theo vùng khác nhau trên màn hình
        const screenWidth = window.innerWidth;
        const regionWidth = screenWidth / NUM_GROUPS;
        const regionStart = this.groupIndex * regionWidth;
        const regionEnd = regionStart + regionWidth;
        this.x = regionStart + Math.random() * regionWidth; // Sao băng chỉ xuất hiện trong vùng của tốp
        
        this.y = -50;
        this.length = Math.random() * 80 + 60;
        this.speed = currentMeteorSpeed;
        
        // Điều chỉnh góc bay dựa trên kích thước màn hình
        const isMobile = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);
        const isPortrait = window.innerHeight > window.innerWidth;
        
        if (isMobile && isPortrait) {
            // Mobile màn hình dọc: góc thấp hơn (5-10 độ)
            this.angle = Math.PI / 36 + (Math.random() - 0.5) * 0.1; // 5-10 độ
        } else {
            // Desktop hoặc mobile ngang: góc bình thường (10-20 độ)
            this.angle = Math.PI / 12 + (Math.random() - 0.5) * 0.2; // 10-20 độ
        }
        
        this.opacity = 0.1;
        this.particles = [];
        this.color1 = gradientColor1;
        this.color2 = gradientColor2;
        
        // Lưu delay ban đầu để sử dụng khi reset
        this.initialRandomDelay = initialRandomDelay;
    }

    update() {
        if (!this.active) {
            // Kiểm tra cả group delay, individual delay và initial random delay
            const totalDelay = this.groupDelay + this.individualDelay + this.initialRandomDelay;
            if (Date.now() - this.lastStart > totalDelay) {
                this.active = true;
            } else {
                return; // chưa đến thời điểm bay
            }
        }
        this.x += Math.cos(this.angle) * this.speed;
        this.y += Math.sin(this.angle) * this.speed;
        this.opacity -= 0.002;
        this.particles.forEach(p => {
            p.x += p.vx;
            p.y += p.vy;
            p.opacity -= 0.02;
        });
        this.particles = this.particles.filter(p => p.opacity > 0);
        if (Math.random() < 0.7) {
            this.particles.push({
                x: this.x,
                y: this.y,
                vx: (Math.random() - 0.5) * 1.2,
                vy: (Math.random() + 0.5) * 1.5,
                size: Math.random() * 1.5 + 0.5,
                opacity: Math.random() * 0.5 + 0.5,
                color: this.color1
            });
        }
        if (this.y > window.innerHeight || this.opacity <= 0) {
            this.lastStart = Date.now();
            this.active = false;
            this.reset();
        }
    }

    reset() {
        // Phân bố sao băng theo vùng khác nhau trên màn hình khi reset
        const screenWidth = window.innerWidth;
        const regionWidth = screenWidth / NUM_GROUPS;
        const regionStart = this.groupIndex * regionWidth;
        this.x = regionStart + Math.random() * regionWidth; // Sao băng chỉ xuất hiện trong vùng của tốp
        
        this.y = -50;
        this.length = Math.random() * 80 + 60;
        this.speed = currentMeteorSpeed;
        
        // Điều chỉnh góc bay dựa trên kích thước màn hình (giống constructor)
        const isMobile = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);
        const isPortrait = window.innerHeight > window.innerWidth;
        
        if (isMobile && isPortrait) {
            this.angle = Math.PI / 5 + (Math.random() - 0.5) * 0.1; // 5-10 độ
        } else {
            this.angle = Math.PI / 10 + (Math.random() - 0.5) * 0.2; // 10-20 độ
        }
        
        this.opacity = 1;
        this.particles = [];
        this.color1 = gradientColor1;
        this.color2 = gradientColor2;
        // Giữ nguyên individualDelay và initialRandomDelay, chỉ reset thời gian bắt đầu
        this.lastStart = Date.now();
        this.active = false;
    }

    draw(ctx) {
        ctx.save();
        const tailX = this.x - Math.cos(this.angle) * this.length;
        const tailY = this.y - Math.sin(this.angle) * this.length;
        // Gradient đuôi theo 2 màu hoặc 1 màu
        const grad = ctx.createLinearGradient(this.x, this.y, tailX, tailY);
        if (isGradientMode) {
            grad.addColorStop(0, this.hexToRgba(this.color1, this.opacity));
            grad.addColorStop(1, this.hexToRgba(this.color2, 0));
        } else {
            grad.addColorStop(0, this.hexToRgba(this.color1, this.opacity));
            grad.addColorStop(1, this.hexToRgba(this.color1, 0));
        }
        ctx.strokeStyle = grad;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(this.x, this.y);
        ctx.lineTo(tailX, tailY);
        ctx.stroke();

        // Đầu meteor là chấm sáng màu
        ctx.beginPath();
        ctx.arc(this.x, this.y, 5, 0, Math.PI * 2);
        const headGrad = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, 8);
        if (isGradientMode) {
            headGrad.addColorStop(0, this.hexToRgba(this.color1, 1));
            headGrad.addColorStop(1, this.hexToRgba(this.color2, 0));
        } else {
            headGrad.addColorStop(0, this.hexToRgba(this.color1, 1));
            headGrad.addColorStop(1, this.hexToRgba(this.color1, 0));
        }
        ctx.fillStyle = headGrad;
        ctx.fill();

        // Particles nhỏ rơi ra, cùng màu meteor
        this.particles.forEach(p => {
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            ctx.fillStyle = this.hexToRgba(p.color, p.opacity);
            ctx.fill();
        });
        ctx.restore();
    }

    // Hàm chuyển mã hex sang rgba
    hexToRgba(hex, alpha) {
        let c = hex.replace('#', '');
        if (c.length === 3) {
            c = c[0]+c[0]+c[1]+c[1]+c[2]+c[2];
        }
        const num = parseInt(c, 16);
        const r = (num >> 16) & 255;
        const g = (num >> 8) & 255;
        const b = num & 255;
        return `rgba(${r},${g},${b},${alpha})`;
    }
}

// Khởi tạo meteors chia đều cho các group
function createMeteors(total) {
    meteors.length = 0;
    for (let i = 0; i < total; i++) {
        const groupIndex = i % NUM_GROUPS;
        meteors.push(new Meteor(groupIndex));
    }
}
createMeteors(200);  

function animate() {
    const canvas = document.getElementById('canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    // Chỉ vẽ mưa sao băng khi được bật
    if (isMeteorShowerActive) {
        ctx.fillStyle = 'rgba(0, 0, 50, 0.05)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        meteors.forEach(meteor => {
            meteor.update();
            meteor.draw(ctx);
        });
    }

    requestAnimationFrame(animate);
}

window.addEventListener('load', () => {
    animate();
    
    // Kiểm tra config mưa sao băng ngay lập tức cho desktop
    const isMobile = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);
    if (!isMobile) {
        window.checkMeteorConfig();
    }
    
    // Kiểm tra config mưa sao băng sau khi load (cho mobile)
    setTimeout(() => {
        window.checkMeteorConfig();
    }, isMobile ? 800 : 500); // Giảm từ 1.5s xuống 0.8s cho mobile
});

// Thêm event listener để kiểm tra config khi URL thay đổi
window.addEventListener('hashchange', () => {
    setTimeout(() => {
        window.checkMeteorConfig();
    }, 20); // Giảm thời gian chờ xuống 20ms
});

// Thêm event listener để cập nhật góc bay khi màn hình xoay
window.addEventListener('orientationchange', () => {
    setTimeout(() => {
        // Reset tất cả meteors để áp dụng góc bay mới
        meteors.forEach(meteor => {
            meteor.reset();
        });
    }, 100);
});

// Thêm event listener để cập nhật khi resize màn hình
window.addEventListener('resize', () => {
    setTimeout(() => {
        // Reset tất cả meteors để áp dụng góc bay mới
        meteors.forEach(meteor => {
            meteor.reset();
        });
    }, 100);
});

// Thêm kiểm tra sớm cho mobile khi DOM ready
document.addEventListener('DOMContentLoaded', () => {
    const isMobile = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);
    if (isMobile) {
        // Kiểm tra ngay khi DOM ready trên mobile
        setTimeout(() => {
            window.checkMeteorConfig();
        }, 100); // Giảm từ 200ms xuống 100ms
    }
});

// Thêm kiểm tra ngay khi script load
const isMobile = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);
if (isMobile) {
    // Kiểm tra ngay lập tức cho mobile
    setTimeout(() => {
        window.checkMeteorConfig();
    }, 50);
}

window.addEventListener('resize', () => {
    const canvas = document.getElementById('canvas');
    if (canvas) {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    }
});

// Hàm đổi màu sao băng, gọi hàm này khi muốn đổi màu
window.setMeteorColor = function(color) {
    isGradientMode = false;
    gradientColor1 = color;
    gradientColor2 = color;
    meteors.forEach(m => {
        m.color1 = color;
        m.color2 = color;
    });
};

window.setMeteorSpeed = function(speed) {
    currentMeteorSpeed = speed;
    meteors.forEach(m => m.speed = speed);
};

window.setMeteorDensity = function(density) {
    meteors.length = 0;
    createMeteors(density);
};

window.setMeteorGradient = function(c1, c2) {
    isGradientMode = true;
    gradientColor1 = c1;
    gradientColor2 = c2;
    meteors.forEach(m => { m.color1 = c1; m.color2 = c2; });
};

// Hàm toggle mưa sao băng
window.toggleMeteorShower = function() {
    const hash = window.location.hash;
    const isWebCha = !hash.startsWith('#config=') && !hash.startsWith('#id=');
    
    // Trên web cha thì không cần kiểm tra config
    if (!isWebCha && !isMeteorFeatureEnabled) {
        // Chỉ hiển thị thông báo lỗi nếu mưa sao băng chưa đang chạy
        if (!isMeteorShowerActive) {
        }
        return;
    }
    
    // Trên web con, nếu có tính năng mưa sao băng thì không cho phép tắt
    if (!isWebCha && isMeteorFeatureEnabled && isMeteorShowerActive) {
        showMeteorMessage('✨ Mưa sao băng đã được bật');
        return;
    }
    
    isMeteorShowerActive = !isMeteorShowerActive;
    // Cập nhật biến global
    window.isMeteorShowerActive = isMeteorShowerActive;
        
    // Hiển thị thông báo cho người dùng
    const message = isMeteorShowerActive ? '✨ Mưa sao băng đã được BẬT' : '🌙 Mưa sao băng đã được TẮT';
    showMeteorMessage(message);
    
    // Reset tất cả meteors khi bật lại
    if (isMeteorShowerActive) {
        meteors.forEach(meteor => {
            meteor.reset();
        });
    }
};

// Hàm kiểm tra và cập nhật config mưa sao băng từ URL
window.checkMeteorConfig = function() {
    const hash = window.location.hash;
    
    // Nếu là web cha (không có config), cho phép toggle tự do
    if (!hash.startsWith('#config=') && !hash.startsWith('#id=')) {
        isMeteorFeatureEnabled = true;
        return;
    }
    
    // Nếu là web con, kiểm tra config
    if (hash.startsWith('#config=')) {
        try {
            const base64Config = hash.replace('#config=', '');
            const configStr = decodeURIComponent(escape(atob(base64Config)));
            const config = JSON.parse(configStr);
            
            // Kiểm tra xem có config mưa sao băng không
            if (config.meteorEnabled === true) {
                isMeteorFeatureEnabled = true;
                // Tự động bật mưa sao băng trên web con ngay lập tức
                if (!isMeteorShowerActive) {
                    isMeteorShowerActive = true;
                    window.isMeteorShowerActive = true;
                }
                
                // Cập nhật các thông số mưa sao băng từ config (sau khi đã bật)
                if (config.meteorSpeed) {
                    currentMeteorSpeed = config.meteorSpeed;
                    meteors.forEach(m => m.speed = config.meteorSpeed);
                }
                if (config.meteorDensity) {
                    meteors.length = 0;
                    createMeteors(config.meteorDensity);
                }
                if (config.meteorColorMode === 'single' && config.meteorColor1) {
                    window.setMeteorColor(config.meteorColor1);
                } else if (config.meteorColorMode === 'gradient' && config.meteorColor1 && config.meteorColor2) {
                    window.setMeteorGradient(config.meteorColor1, config.meteorColor2);
                }
            } else {
                isMeteorFeatureEnabled = false;
            }
        } catch (e) {
            console.error('Lỗi khi parse config:', e);
            isMeteorFeatureEnabled = false;
        }
    } else if (hash.startsWith('#id=')) {
        // Xử lý cho trường hợp #id= (cần fetch từ server)
        const galaxyId = hash.replace('#id=', '');
        
        fetch(`${SERVER_URL_PROD}/api/galaxy-configs/${galaxyId}`)
            .then(res => {
                // Kiểm tra response status
                if (!res.ok) {
                    throw new Error(`HTTP error! status: ${res.status}`);
                }
                // Kiểm tra content-type
                const contentType = res.headers.get('content-type');
                if (!contentType || !contentType.includes('application/json')) {
                    throw new Error('Response is not JSON');
                }
                return res.json();
            })
            .then(data => {
                if (data.success && data.config && data.config.meteorEnabled === true) {
                    isMeteorFeatureEnabled = true;
                    // Tự động bật mưa sao băng trên web con ngay lập tức
                    if (!isMeteorShowerActive) {
                        isMeteorShowerActive = true;
                        window.isMeteorShowerActive = true;
                    }
                    
                    // Cập nhật các thông số mưa sao băng từ config (sau khi đã bật)
                    if (data.config.meteorSpeed) {
                        currentMeteorSpeed = data.config.meteorSpeed;
                        meteors.forEach(m => m.speed = data.config.meteorSpeed);
                    }
                    if (data.config.meteorDensity) {
                        meteors.length = 0;
                        createMeteors(data.config.meteorDensity);
                    }
                    if (data.config.meteorColorMode === 'single' && data.config.meteorColor1) {
                        window.setMeteorColor(data.config.meteorColor1);
                    } else if (data.config.meteorColorMode === 'gradient' && data.config.meteorColor1 && data.config.meteorColor2) {
                        window.setMeteorGradient(data.config.meteorColor1, data.config.meteorColor2);
                    }
                } else {
                    isMeteorFeatureEnabled = false;
                }
            })
            .catch(err => {
                console.error('Lỗi khi fetch config từ server:', err);
                isMeteorFeatureEnabled = false;
            });
    }
};

// Hàm hiển thị thông báo mưa sao băng
function showMeteorMessage(message) {
    // Tạo hoặc lấy element thông báo
    let messageEl = document.getElementById('meteor-message');
    if (!messageEl) {
        messageEl = document.createElement('div');
        messageEl.id = 'meteor-message';
        messageEl.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: rgba(0, 0, 0, 0.8);
            color: white;
            padding: 15px 25px;
            border-radius: 25px;
            font-size: 16px;
            font-weight: bold;
            z-index: 10000;
            pointer-events: none;
            opacity: 0;
            transition: opacity 0.3s ease;
        `;
        document.body.appendChild(messageEl);
    }
    
    messageEl.textContent = message;
    messageEl.style.opacity = '1';
    
    // Ẩn thông báo sau 2 giây
    setTimeout(() => {
        messageEl.style.opacity = '0';
    }, 2000);
}