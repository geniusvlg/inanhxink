import * as THREE from 'three';

export class FlowerRingSystem {
    constructor(scene) {
        this.scene = scene;
        this.rotationSpeed = 0.002;
        this.flowers = [];
        this.isFlying = false;
        this.isPaused = false;
        this.pauseTime = null;
        this.flowerTextures = [];
        this.currentTextures = [];
        this.canvasPool = [];

        // === MATERIAL CACHE SYSTEM ===
        this.materialCache = new Map(); // Cache materials theo texture
        this.activeMaterials = new Set(); // Theo dõi materials đang sử dụng
        this.maxMaterialCacheSize = 20; // Giới hạn cache size

        // Các thông số có thể điều chỉnh
        this.flyingConfig = {
            duration: 360000,
            scaleMultiplier: 6,
            floatSpeed: 0.00002,
            swaySpeed: 0.00015,
            swayAmount: 0.1,
            rotationSpeed: 0.001,
            batchSize: 32,
            batchDelay: 1000,
            totalBatches: 25
        };

        // Cache cho sin/cos để tối ưu performance
        this.sinCache = new Map();
        this.cosCache = new Map();
        this.cacheSize = 1000;

        // === DEVICE OPTIMIZATION ===
        this.deviceTier = this.detectDeviceTier();
        this.optimizeForDevice();

        this.createFlowerRing();
        
        // === MEMORY PRESSURE HANDLING ===
        this.setupMemoryPressureHandling();
    }

    // === DEVICE DETECTION & OPTIMIZATION ===
    
    /**
     * Phát hiện device tier để tối ưu hóa
     * @returns {string} 'low', 'medium', 'high'
     */
    detectDeviceTier() {
        try {
            // Kiểm tra iOS Safari
            const isIOSSafari = /iPad|iPhone|iPod/.test(navigator.userAgent) && 
                               /Safari/.test(navigator.userAgent) && 
                               !/Chrome/.test(navigator.userAgent);
            
            // Kiểm tra memory
            const memory = navigator.deviceMemory || 4;
            const cores = navigator.hardwareConcurrency || 4;
            
            // Kiểm tra WebGL support
            let maxTextureSize = 2048;
            try {
                const canvas = document.createElement('canvas');
                const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
                if (gl) {
                    maxTextureSize = gl.getParameter(gl.MAX_TEXTURE_SIZE) || 2048;
                }
            } catch (webglError) {
                console.warn('⚠️ WebGL detection failed:', webglError);
            }
            
            if (isIOSSafari || memory < 2 || cores < 4 || maxTextureSize < 2048) {
                return 'low';
            } else if (memory < 4 || cores < 6) {
                return 'medium';
            } else {
                return 'high';
            }
        } catch (error) {
            console.warn('⚠️ Device detection failed, using medium tier:', error);
            return 'medium'; // Fallback to medium tier
        }
    }
    
    /**
     * Tối ưu hóa dựa trên device capability
     */
    optimizeForDevice() {
        try {            
            switch (this.deviceTier) {
                case 'low':
                    // iOS cũ, Android cũ, thiết bị yếu
                    this.maxMaterialCacheSize = 10;
                    this.cacheSize = 500;
                    if (this.flyingConfig) {
                        this.flyingConfig.batchSize = 16;
                        this.flyingConfig.totalBatches = 15;
                    }
                    break;
                    
                case 'medium':
                    // iOS mới, Android trung bình
                    this.maxMaterialCacheSize = 15;
                    this.cacheSize = 750;
                    if (this.flyingConfig) {
                        this.flyingConfig.batchSize = 24;
                        this.flyingConfig.totalBatches = 20;
                    }
                    break;
                    
                case 'high':
                    // Desktop, flagship mobile
                    this.maxMaterialCacheSize = 20;
                    this.cacheSize = 1000;
                    if (this.flyingConfig) {
                        this.flyingConfig.batchSize = 32;
                        this.flyingConfig.totalBatches = 25;
                    }
                    break;
            }
            
        } catch (error) {
            console.warn('⚠️ Error optimizing for device:', error);
        }
    }

    // === MATERIAL CACHE MANAGEMENT ===
    
    /**
     * Lấy material từ cache hoặc tạo mới
     * @param {THREE.Texture} texture - Texture cần material
     * @returns {THREE.SpriteMaterial} Material instance
     */
    getMaterialFromCache(texture) {
        // Kiểm tra texture có hợp lệ không
        if (!texture || typeof texture !== 'object') {
            console.warn('⚠️ Invalid texture provided to getMaterialFromCache:', texture);
            // Tạo fallback texture nếu texture không hợp lệ
            texture = this.createFallbackTexture();
        }
        
        // Kiểm tra texture.uuid có tồn tại không
        let textureId = 'default';
        try {
            if (texture.uuid) {
                textureId = texture.uuid;
            } else if (texture.id) {
                textureId = texture.id.toString();
            } else if (texture.name) {
                textureId = texture.name;
            } else {
                // Tạo ID duy nhất nếu không có gì
                textureId = 'texture_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
            }
        } catch (error) {
            console.warn('⚠️ Error getting texture ID, using fallback:', error);
            textureId = 'fallback_' + Date.now();
        }
        
        if (this.materialCache.has(textureId)) {
            return this.materialCache.get(textureId);
        }
        
        // Tạo material mới với error handling
        let material;
        try {
            material = new THREE.SpriteMaterial({
                map: texture,
                color: 0xffffff,
                transparent: true,
                opacity: 1,
                depthTest: true,
                depthWrite: true,
                sizeAttenuation: true,
                alphaTest: 0.1
            });
        } catch (error) {
            console.error('❌ Error creating SpriteMaterial:', error);
            // Fallback material đơn giản
            material = new THREE.SpriteMaterial({
                color: 0xff69b4,
                transparent: true,
                opacity: 1
            });
        }
        
        // Thêm vào cache
        try {
            this.materialCache.set(textureId, material);
            this.activeMaterials.add(material);
            
            // Cleanup cache nếu quá lớn
            this.cleanupMaterialCache();
        } catch (error) {
            console.warn('⚠️ Error updating material cache:', error);
        }
        
        return material;
    }
    
    /**
     * Cleanup material cache khi vượt quá giới hạn
     */
    cleanupMaterialCache() {
        if (this.materialCache.size <= this.maxMaterialCacheSize) {
            return;
        }
        
        // Tìm materials không còn sử dụng
        const unusedMaterials = [];
        for (const [textureId, material] of this.materialCache) {
            if (!this.activeMaterials.has(material)) {
                unusedMaterials.push(textureId);
            }
        }
        
        // Xóa materials không sử dụng
        unusedMaterials.forEach(textureId => {
            const material = this.materialCache.get(textureId);
            if (material) {
                material.dispose();
                this.activeMaterials.delete(material);
                this.materialCache.delete(textureId);
            }
        });
        
        // Nếu vẫn quá lớn, xóa materials cũ nhất
        if (this.materialCache.size > this.maxMaterialCacheSize) {
            const entries = Array.from(this.materialCache.entries());
            const toRemove = entries.slice(0, this.materialCache.size - this.maxMaterialCacheSize);
            
            toRemove.forEach(([textureId, material]) => {
                material.dispose();
                this.activeMaterials.delete(material);
                this.materialCache.delete(textureId);
            });
        }
    }
    
    /**
     * Cập nhật material cho tất cả flowers với texture mới
     * @param {THREE.Texture} newTexture - Texture mới
     */
    updateAllFlowerMaterials(newTexture) {
        const newMaterial = this.getMaterialFromCache(newTexture);
        
        this.flowers.forEach(sprite => {
            // Lưu material cũ để cleanup
            const oldMaterial = sprite.material;
            
            // Gán material mới
            sprite.material = newMaterial;
            
            // Đánh dấu material cũ không còn sử dụng
            if (oldMaterial && oldMaterial !== newMaterial) {
                this.activeMaterials.delete(oldMaterial);
            }
        });
        
        // Cleanup materials không sử dụng
        this.cleanupMaterialCache();
    }
    
    /**
     * Random texture cho flowers với material cache
     */
    randomizeFlowerTexturesWithCache() {
        if (!this.flowerTextures || this.flowerTextures.length === 0) return;
        
        // Tạo map để theo dõi materials đang sử dụng
        const usedMaterials = new Set();
        
        this.flowers.forEach(sprite => {
            const randomTexture = this.flowerTextures[Math.floor(Math.random() * this.flowerTextures.length)];
            const material = this.getMaterialFromCache(randomTexture);
            
            // Lưu material cũ để cleanup
            const oldMaterial = sprite.material;
            if (oldMaterial && oldMaterial !== material) {
                this.activeMaterials.delete(oldMaterial);
            }
            
            // Gán material mới
            sprite.material = material;
            usedMaterials.add(material);
        });
        
        // Cập nhật active materials
        this.activeMaterials = usedMaterials;
        
        // Cleanup materials không sử dụng
        this.cleanupMaterialCache();
    }

    // Tối ưu sin/cos với cache
    getCachedSin(value) {
        const key = Math.round(value * 1000) / 1000;
        if (!this.sinCache.has(key)) {
            if (this.sinCache.size >= this.cacheSize) {
                const firstKey = this.sinCache.keys().next().value;
                this.sinCache.delete(firstKey);
            }
            this.sinCache.set(key, Math.sin(value));
        }
        return this.sinCache.get(key);
    }

    getCachedCos(value) {
        const key = Math.round(value * 1000) / 1000;
        if (!this.cosCache.has(key)) {
            if (this.cosCache.size >= this.cacheSize) {
                const firstKey = this.cosCache.keys().next().value;
                this.cosCache.delete(firstKey);
            }
            this.cosCache.set(key, Math.cos(value));
        }
        return this.cosCache.get(key);
    }

    // Lấy canvas từ pool hoặc tạo mới
    getCanvasFromPool() {
        if (this.canvasPool.length > 0) {
            return this.canvasPool.pop();
        }
        return document.createElement('canvas');
    }

    // Trả canvas về pool
    returnCanvasToPool(canvas) {
        if (this.canvasPool.length < 10) {
            this.canvasPool.push(canvas);
        }
    }

    // Dispose texture cũ với material cache cleanup
    disposeTextures() {
        this.currentTextures.forEach(texture => {
            if (texture && texture.dispose) {
                texture.dispose();
            }
        });
        this.currentTextures = [];
        
        // Cleanup materials không sử dụng
        this.cleanupMaterialCache();
    }

    createFlowerRing() {
        this.flowerRing = new THREE.Group();
        this.scene.add(this.flowerRing);

        const textureLoader = new THREE.TextureLoader();
        textureLoader.setCrossOrigin('anonymous');
        
        textureLoader.load(
            'assets/images/b1.png', 
            (texture) => {
                this.processAndCreateFlowers(texture);
            },
            undefined,
            (error) => {
                console.error('Lỗi load texture:', error);
                this.createFallbackTexture();
            }
        );
    }

    createFallbackTexture() {
        try {
            const canvas = this.getCanvasFromPool();
            const ctx = canvas.getContext('2d');
            
            if (!ctx) {
                console.error('❌ Cannot get 2D context from canvas');
                // Fallback cứng nếu không thể tạo canvas
                return this.createHardcodedFallbackTexture();
            }
            
            canvas.width = 80;
            canvas.height = 80;
            
            ctx.fillStyle = '#ff69b4';
            ctx.beginPath();
            ctx.arc(40, 40, 30, 0, Math.PI * 2);
            ctx.fill();
            
            const texture = new THREE.CanvasTexture(canvas);
            texture.colorSpace = THREE.SRGBColorSpace;
            texture.minFilter = THREE.NearestFilter;
            texture.magFilter = THREE.NearestFilter;
            
            // Đảm bảo texture có uuid
            if (!texture.uuid) {
                texture.uuid = 'fallback_' + Date.now();
            }
            
            this.processAndCreateFlowers(texture);
        } catch (error) {
            console.error('❌ Error in createFallbackTexture:', error);
            // Fallback cứng nếu canvas fail
            this.createHardcodedFallbackTexture();
        }
    }
    
    createHardcodedFallbackTexture() {
        try {
            // Tạo texture đơn giản nhất có thể
            const material = new THREE.SpriteMaterial({
                color: 0xff69b4,
                transparent: true,
                opacity: 1
            });
            
            // Tạo sprite đơn giản
            const sprite = new THREE.Sprite(material);
            sprite.scale.set(10, 10, 1);
            
            // Tạo group đơn giản
            if (!this.flowerRing) {
                this.flowerRing = new THREE.Group();
                this.scene.add(this.flowerRing);
            }
            
            // Thêm sprite vào scene
            this.flowerRing.add(sprite);
            this.flowers.push(sprite);
            
            console.log('✅ Created hardcoded fallback texture');
        } catch (error) {
            console.error('❌ Critical error in createHardcodedFallbackTexture:', error);
        }
    }

    processAndCreateFlowers(texture) {
        try {
            // Kiểm tra texture có hợp lệ không
            if (!texture || !texture.image) {
                console.warn('⚠️ Invalid texture or missing image:', texture);
                this.createFallbackTexture();
                return;
            }
            
            const canvas = this.getCanvasFromPool();
            const ctx = canvas.getContext('2d');
            
            if (!ctx) {
                console.error('❌ Cannot get 2D context from canvas');
                this.createFallbackTexture();
                return;
            }
            
            // Kiểm tra kích thước image
            const imageWidth = texture.image.width || 80;
            const imageHeight = texture.image.height || 80;
            
            canvas.width = imageWidth;
            canvas.height = imageHeight;
            
            try {
                ctx.drawImage(texture.image, 0, 0);
            } catch (drawError) {
                console.warn('⚠️ Error drawing image to canvas:', drawError);
                // Fallback: vẽ hình tròn đơn giản
                ctx.fillStyle = '#ff69b4';
                ctx.beginPath();
                ctx.arc(imageWidth/2, imageHeight/2, Math.min(imageWidth, imageHeight)/3, 0, Math.PI * 2);
                ctx.fill();
            }
            
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const data = imageData.data;
            
            const radius = Math.min(canvas.width, canvas.height) * 0.1;
            for (let y = 0; y < canvas.height; y++) {
                for (let x = 0; x < canvas.width; x++) {
                    const i = (y * canvas.width + x) * 4;
                    
                    const distX = Math.min(x, canvas.width - x);
                    const distY = Math.min(y, canvas.height - y);
                    const dist = Math.sqrt(distX * distX + distY * distY);
                    
                    if (dist < radius) {
                        const alpha = Math.min(1, dist / radius);
                        data[i + 3] = Math.floor(255 * alpha);
                    } else {
                        data[i + 3] = 255;
                    }
                }
            }
            
            ctx.putImageData(imageData, 0, 0);
            
            const processedTexture = new THREE.CanvasTexture(canvas);
            processedTexture.colorSpace = THREE.SRGBColorSpace;
            processedTexture.minFilter = THREE.NearestFilter;
            processedTexture.magFilter = THREE.NearestFilter;
            
            // Đảm bảo texture có uuid
            if (!processedTexture.uuid) {
                processedTexture.uuid = 'processed_' + Date.now();
            }
            
            // Cleanup texture cũ nếu có thể
            try {
                if (texture && texture.dispose && typeof texture.dispose === 'function') {
                    texture.dispose();
                }
            } catch (disposeError) {
                console.warn('⚠️ Error disposing old texture:', disposeError);
            }
            
            this.createFlowers(processedTexture);
            
        } catch (error) {
            console.error('❌ Lỗi xử lý texture:', error);
            this.createFallbackTexture();
        }
    }

    createFlowers(processedTexture) {
        try {
            // === SỬ DỤNG MATERIAL CACHE ===
            const flowerMaterial = this.getMaterialFromCache(processedTexture);
            
            if (!flowerMaterial) {
                console.error('❌ Cannot create flower material');
                return;
            }

            // Keep the ring recognizable without covering the whole viewport.
            // The old 400/800 counts duplicated each customer photo dozens of times.
            const flowerCounts = { low: 72, medium: 120, high: 180 };
            const numFlowers = flowerCounts[this.deviceTier] || flowerCounts.medium;
            
            const innerRadius = 130;
            const outerRadius = 530;
            const heightRange = 8;
            
            for (let i = 0; i < numFlowers; i++) {
                try {
                    // === KHÔNG CLONE MATERIAL NỮA ===
                    const sprite = new THREE.Sprite(flowerMaterial);
                    
                    const angle = Math.random() * Math.PI * 2;
                    const radius = innerRadius + Math.random() * (outerRadius - innerRadius);
                    const height = (Math.random() - 0.5) * heightRange * 2;

                    sprite.position.set(
                        Math.cos(angle) * radius,
                        height,
                        Math.sin(angle) * radius
                    );
                    
                    const size = 10 + Math.random() * 3;
                    sprite.scale.set(size, size, 1);
                    sprite.lookAt(0, height, 0);
                    
                    sprite.userData = {
                        originalPosition: sprite.position.clone(),
                        originalScale: sprite.scale.clone(),
                        targetPosition: new THREE.Vector3(),
                        startTime: 0,
                        delay: Math.random() * 2,
                        isFlying: false,
                        batchIndex: Math.floor(i / this.flyingConfig.batchSize)
                    };
                    
                    this.flowers.push(sprite);
                    if (this.flowerRing) {
                        this.flowerRing.add(sprite);
                    }
                } catch (spriteError) {
                    console.warn('⚠️ Error creating sprite:', spriteError);
                    // Bỏ qua sprite lỗi, tiếp tục với sprite tiếp theo
                    continue;
                }
            }

            // Lưu texture hiện tại
            if (processedTexture) {
                this.currentTextures.push(processedTexture);
            }
            
            console.log(`✅ Created ${this.flowers.length} flowers successfully`);
            
        } catch (error) {
            console.error('❌ Critical error in createFlowers:', error);
            // Fallback: tạo ít nhất 1 flower
            this.createMinimalFlowers();
        }
    }
    
    createMinimalFlowers() {
        try {
            const material = new THREE.SpriteMaterial({
                color: 0xff69b4,
                transparent: true,
                opacity: 1
            });
            
            const sprite = new THREE.Sprite(material);
            sprite.position.set(0, 0, 200);
            sprite.scale.set(20, 20, 1);
            
            if (this.flowerRing) {
                this.flowerRing.add(sprite);
                this.flowers.push(sprite);
            }
            
            console.log('✅ Created minimal fallback flower');
        } catch (error) {
            console.error('❌ Failed to create minimal flowers:', error);
        }
    }

    triggerFlyingEffect() {
        if (this.isFlying) return;
        
        this.isFlying = true;
        this.isPaused = false; // Luôn resume khi bắt đầu bay
        const currentTime = Date.now();
        let batchIndex = 0;
        
        // Chia các bông hoa thành các nhóm
        const batches = [];
        for (let i = 0; i < this.flowers.length; i += this.flyingConfig.batchSize) {
            batches.push(this.flowers.slice(i, i + this.flyingConfig.batchSize));
        }
        
        // Thiết lập thông tin bay cho từng bông hoa
        this.flowers.forEach((flower, index) => {
            flower.userData.startTime = currentTime;
            flower.userData.isFlying = false;
            
            // Tạo vị trí đích theo lớp từ thấp đến cao
            const layerCount = 6; // Tăng số lớp để phân bố đều hơn
            const layerIndex = index % layerCount; // Chia đều vào các lớp
            
            // Tính toán vị trí Y theo lớp - từ thấp đến cao
            const baseHeight = 100; // Độ cao cơ bản (cao hơn một chút)
            const layerHeight = 200; // Khoảng cách giữa các lớp
            const targetY = baseHeight + (layerIndex * layerHeight);
            
            // Tạo vị trí ngẫu nhiên trong không gian với Y được kiểm soát
            const randomX = (Math.random() - 0.5) * 3000;
            const randomZ = (Math.random() - 0.5) * 3000;
            
            flower.userData.targetPosition.set(randomX, targetY, randomZ);
            
            // Lưu thông tin ban đầu
            flower.userData.originalPosition = flower.position.clone();
            flower.userData.originalScale = flower.scale.clone();
            flower.userData.targetScale = flower.scale.clone().multiplyScalar(this.flyingConfig.scaleMultiplier);
            
            // Thêm thông tin cho hiệu ứng bong bóng
            flower.userData.floatOffset = Math.random() * Math.PI * 2;
            flower.userData.swayOffset = Math.random() * Math.PI * 2;
            
            // Lưu thông tin lớp để có thể thay đổi sau
            flower.userData.layerIndex = layerIndex;
        });

        // Tạo hiệu ứng bay theo đợt
        const startBatch = () => {
            if (batchIndex < batches.length) {
                const currentBatch = batches[batchIndex];
                currentBatch.forEach(flower => {
                    flower.userData.isFlying = true;
                });
                batchIndex++;
                setTimeout(startBatch, this.flyingConfig.batchDelay);
            }
        };

        startBatch();
        
        // Sau khi hết duration, thay đổi vị trí đích để tạo hiệu ứng mới
        setTimeout(() => {
            this.redistributeFlowers();
        }, this.flyingConfig.duration); // Chạy ngay khi hết duration
    }
    
    /**
     * Phân bố lại các bông hoa thành các lớp mới
     */
    redistributeFlowers() {
        if (!this.isFlying) return;
        
        console.log('🔄 Phân bố lại vị trí đích cho các bông hoa...');
        
        // Giới hạn số lần redistribute để tránh memory leak
        if (!this.redistributeCount) this.redistributeCount = 0;
        this.redistributeCount++;
        
        // Dừng sau 1 lần để tránh vòng lặp vô tận
        if (this.redistributeCount >= 1) {
            console.log('🛑 Đã đạt giới hạn redistribute (1 lần), dừng để bảo vệ memory');
            return;
        }
        
        this.flowers.forEach((flower, index) => {
            // Tạo lớp mới ngẫu nhiên
            const newLayerIndex = Math.floor(Math.random() * 6);
            
            // Tính toán vị trí Y mới - từ thấp đến cao
            const baseHeight = 100; // Độ cao cơ bản (cao hơn một chút)
            const layerHeight = 200; // Khoảng cách giữa các lớp
            const newTargetY = baseHeight + (newLayerIndex * layerHeight);
            
            // Cập nhật vị trí đích mới
            const newTargetX = (Math.random() - 0.5) * 3000;
            const newTargetZ = (Math.random() - 0.5) * 3000;
            
            flower.userData.targetPosition.set(newTargetX, newTargetY, newTargetZ);
            flower.userData.layerIndex = newLayerIndex;
            
            // Cập nhật thời gian để animation mượt mà
            flower.userData.startTime = Date.now();
        });
        
        // Tự động lặp lại sau mỗi duration (có giới hạn để tránh memory leak)
        if (this.isFlying && !this.isPaused) {
            setTimeout(() => {
                this.redistributeFlowers();
            }, this.flyingConfig.duration);
        }
    }

    // Thêm hàm toggle pause/resume hiệu ứng bay
    toggleFlyingPause() {
        if (this.isFlying) {
            if (!this.isPaused) {
                // Đang chạy, chuyển sang pause
                this.isPaused = true;
                this.pauseTime = Date.now();
            } else {
                // Đang pause, resume lại
                this.isPaused = false;
                if (this.pauseTime) {
                    const pausedDuration = Date.now() - this.pauseTime;
                    // Cộng thêm pausedDuration vào startTime của từng bông hoa
                    this.flowers.forEach(flower => {
                        flower.userData.startTime += pausedDuration;
                    });
                    this.pauseTime = null;
                }
            }
        }
    }

    resetFlyingEffect() {
        this.isFlying = false;
        this.redistributeCount = 0; // Reset counter khi reset
        this.flowers.forEach(flower => {
            flower.userData.isFlying = false;
            flower.position.copy(flower.userData.originalPosition);
            flower.scale.copy(flower.userData.originalScale);
            flower.rotation.set(0, 0, 0);
        });
    }

    animate() {
        if (this.flowerRing) {
            if (!this.isFlying) {
                this.flowerRing.rotation.y += this.rotationSpeed;
            } else {
                if (this.isPaused) {
                    // Nếu đang pause thì không update vị trí/scale nữa
                    return;
                }
                const currentTime = Date.now();
                
                this.flowers.forEach(flower => {
                    if (!flower.userData.isFlying) {
                        if (currentTime - flower.userData.startTime > flower.userData.delay * 1000) {
                            flower.userData.isFlying = true;
                        }
                    } else {
                        // Tính toán thời gian bay
                        const progress = Math.min(1, (currentTime - flower.userData.startTime - flower.userData.delay * 1000) / this.flyingConfig.duration);
                        
                        // Easing function mượt mà hơn cho chuyển động bong bóng
                        const easeProgress = 1 - Math.pow(1 - progress, 2); // Bậc 2 để mượt hơn
                        
                        // Tính toán vị trí mới với hiệu ứng bong bóng
                        const floatY = Math.sin(currentTime * this.flyingConfig.floatSpeed + flower.userData.floatOffset) * this.flyingConfig.swayAmount;
                        const swayX = Math.sin(currentTime * this.flyingConfig.swaySpeed + flower.userData.swayOffset) * this.flyingConfig.swayAmount;
                        const swayZ = Math.cos(currentTime * this.flyingConfig.swaySpeed + flower.userData.swayOffset) * this.flyingConfig.swayAmount;
                        
                        // Cập nhật vị trí với chuyển động mượt mà
                        const targetPos = flower.userData.targetPosition.clone();
                        targetPos.y += floatY;
                        targetPos.x += swayX;
                        targetPos.z += swayZ;
                        
                        // Sử dụng lerp với hệ số nhỏ hơn để mượt hơn
                        flower.position.lerpVectors(
                            flower.userData.originalPosition,
                            targetPos,
                            easeProgress * 0.5 // Giảm tốc độ chuyển động
                        );
                        
                        // Cập nhật kích thước mượt mà
                        if (flower.userData.originalScale && flower.userData.targetScale) {
                            flower.scale.lerpVectors(
                                flower.userData.originalScale,
                                flower.userData.targetScale,
                                easeProgress * 0.5 // Giảm tốc độ phóng to
                            );
                        }
                        
                        // Thêm chuyển động xoay nhẹ nhàng hơn
                        flower.rotation.x += Math.sin(currentTime * this.flyingConfig.rotationSpeed) * 0.0005;
                        flower.rotation.y += Math.cos(currentTime * this.flyingConfig.rotationSpeed) * 0.0005;
                        flower.rotation.z += Math.sin(currentTime * this.flyingConfig.rotationSpeed * 0.5) * 0.0005;
                    }
                });
            }
        }
    }

    updateRotationSpeed(speed) {
        this.rotationSpeed = speed;
    }

    updateTextureByDataURL(dataURL) {
        const loader = new THREE.TextureLoader();
        loader.load(
            dataURL, 
            (texture) => {
                this.processAndUpdateTexture(texture);
            },
            undefined,
            (error) => {
                console.error('Lỗi load texture từ dataURL:', error);
            }
        );
    }

    // Hàm xử lý orientation cho image element
    drawImageWithOrientation(ctx, img, orientation, width, height) {
        switch (orientation) {
            case 2: // horizontal flip
                ctx.translate(width, 0);
                ctx.scale(-1, 1);
                break;
            case 3: // 180°
                ctx.translate(width, height);
                ctx.rotate(Math.PI);
                break;
            case 4: // vertical flip
                ctx.translate(0, height);
                ctx.scale(1, -1);
                break;
            case 5: // vertical flip + 90 rotate right
                ctx.rotate(0.5 * Math.PI);
                ctx.scale(1, -1);
                break;
            case 6: // 90° rotate right
                ctx.rotate(0.5 * Math.PI);
                ctx.translate(0, -height);
                break;
            case 7: // horizontal flip + 90 rotate right
                ctx.rotate(0.5 * Math.PI);
                ctx.translate(width, -height);
                ctx.scale(-1, 1);
                break;
            case 8: // 90° rotate left
                ctx.rotate(-0.5 * Math.PI);
                ctx.translate(-width, 0);
                break;
            default:
                // 1: no transform
                break;
        }
        ctx.drawImage(img, 0, 0, width, height);
    }

    processAndUpdateTexture(texture) {
        try {
            const canvas = this.getCanvasFromPool();
            const ctx = canvas.getContext('2d');
            canvas.width = texture.image.width;
            canvas.height = texture.image.height;
            const img = texture.image;
            
            // Đọc orientation từ EXIF
            let orientation = 1;
            if (img instanceof HTMLImageElement && img.src.startsWith('data:')) {
                EXIF.getData(img, function() {
                    orientation = EXIF.getTag(this, 'Orientation') || 1;
                });
            }
            
            // Xử lý orientation
            ctx.save();
            this.drawImageWithOrientation(ctx, img, orientation, canvas.width, canvas.height);
            ctx.restore();
            
            // Xử lý bo tròn góc
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const data = imageData.data;
            const radius = Math.min(canvas.width, canvas.height) * 0.1;
            for (let y = 0; y < canvas.height; y++) {
                for (let x = 0; x < canvas.width; x++) {
                    const i = (y * canvas.width + x) * 4;
                    const distX = Math.min(x, canvas.width - x);
                    const distY = Math.min(y, canvas.height - y);
                    const dist = Math.sqrt(distX * distX + distY * distY);
                    if (dist < radius) {
                        const alpha = Math.min(1, dist / radius);
                        data[i + 3] = Math.floor(255 * alpha);
                    } else {
                        data[i + 3] = 255;
                    }
                }
            }
            ctx.putImageData(imageData, 0, 0);
            
            const processedTexture = new THREE.CanvasTexture(canvas);
            processedTexture.colorSpace = THREE.SRGBColorSpace;
            processedTexture.minFilter = THREE.NearestFilter;
            processedTexture.magFilter = THREE.NearestFilter;
            
            // === SỬ DỤNG MATERIAL CACHE ===
            this.disposeTextures();
            this.updateAllFlowerMaterials(processedTexture);
            this.currentTextures.push(processedTexture);
            
            if (texture.dispose) {
                texture.dispose();
            }
        } catch (error) {
            console.error('Lỗi xử lý texture:', error);
        }
    }

    /**
     * Preload các texture từ URL, chỉ load 1 lần duy nhất
     * @param {string[]} urls - Mảng URL ảnh
     * @returns {Promise<void>}
     */
    preloadTextures(urls) {
        if (!urls || urls.length === 0) {
            console.warn('⚠️ No URLs provided for preloadTextures');
            return Promise.resolve();
        }
        
        console.log(`🔄 Preloading ${urls.length} textures...`);
        console.log('🔗 Danh sách URLs nhận vào preloadTextures:');
        urls.forEach((url, index) => {
            console.log(`  [${index + 1}] ${url}`);
        });
        
        try {
            this.disposeTextures();
            const loader = new THREE.TextureLoader();
            loader.setCrossOrigin('anonymous');
            
            const loadPromises = urls.map((url, index) => {
                return new Promise((resolve) => {
                    // Timeout cho mỗi texture load
                    const timeout = setTimeout(() => {
                        console.warn(`⚠️ Texture load timeout for URL ${index}:`, url);
                        resolve(this.createFallbackTexture());
                    }, 10000); // 10 giây timeout
                    
                    loader.load(
                        url,
                        (texture) => {
                            clearTimeout(timeout);
                            try {
                                // Kiểm tra texture có hợp lệ không
                                if (!texture || !texture.image) {
                                    console.warn('⚠️ Invalid texture loaded:', texture);
                                    resolve(this.createFallbackTexture());
                                    return;
                                }
                                
                                // Xử lý canvas, EXIF, bo tròn góc như cũ
                                const canvas = this.getCanvasFromPool();
                                const ctx = canvas.getContext('2d');
                                
                                if (!ctx) {
                                    console.error('❌ Cannot get 2D context from canvas');
                                    resolve(this.createFallbackTexture());
                                    return;
                                }
                                
                                const img = texture.image;
                                const sourceWidth = img.width || 80;
                                const sourceHeight = img.height || 80;
                                const maxDimensions = { low: 256, medium: 384, high: 512 };
                                const maxDimension = maxDimensions[this.deviceTier] || maxDimensions.medium;
                                const scale = Math.min(1, maxDimension / Math.max(sourceWidth, sourceHeight));
                                canvas.width = Math.max(1, Math.round(sourceWidth * scale));
                                canvas.height = Math.max(1, Math.round(sourceHeight * scale));

                                let orientation = 1;

                                try {
                                    if (img instanceof HTMLImageElement && img.src.startsWith('data:')) {
                                        if (typeof EXIF !== 'undefined' && EXIF.getData) {
                                            EXIF.getData(img, function() {
                                                orientation = EXIF.getTag(this, 'Orientation') || 1;
                                            });
                                        }
                                    }
                                } catch (exifError) {
                                    console.warn('⚠️ EXIF processing error:', exifError);
                                }
                                
                                // Clip before drawing instead of scanning every source pixel.
                                // This keeps cold loads fast even when uploads are multi-megapixel.
                                const radius = Math.min(canvas.width, canvas.height) * 0.08;
                                ctx.save();
                                ctx.beginPath();
                                ctx.moveTo(radius, 0);
                                ctx.lineTo(canvas.width - radius, 0);
                                ctx.quadraticCurveTo(canvas.width, 0, canvas.width, radius);
                                ctx.lineTo(canvas.width, canvas.height - radius);
                                ctx.quadraticCurveTo(canvas.width, canvas.height, canvas.width - radius, canvas.height);
                                ctx.lineTo(radius, canvas.height);
                                ctx.quadraticCurveTo(0, canvas.height, 0, canvas.height - radius);
                                ctx.lineTo(0, radius);
                                ctx.quadraticCurveTo(0, 0, radius, 0);
                                ctx.closePath();
                                ctx.clip();
                                try {
                                    this.drawImageWithOrientation(ctx, img, orientation, canvas.width, canvas.height);
                                } catch (drawError) {
                                    console.warn('⚠️ Error drawing image with orientation:', drawError);
                                    ctx.fillStyle = '#ff69b4';
                                    ctx.fillRect(0, 0, canvas.width, canvas.height);
                                }
                                ctx.restore();
                                const processedTexture = new THREE.CanvasTexture(canvas);
                                processedTexture.colorSpace = THREE.SRGBColorSpace;
                                processedTexture.minFilter = THREE.NearestFilter;
                                processedTexture.magFilter = THREE.NearestFilter;
                                
                                // Đảm bảo texture có uuid
                                if (!processedTexture.uuid) {
                                    processedTexture.uuid = 'preloaded_' + Date.now() + '_' + index;
                                }
                                
                                // Cleanup texture cũ nếu có thể
                                try {
                                    if (texture && texture.dispose && typeof texture.dispose === 'function') {
                                        texture.dispose();
                                    }
                                } catch (disposeError) {
                                    console.warn('⚠️ Error disposing old texture:', disposeError);
                                }
                                
                                resolve(processedTexture);
                                
                            } catch (error) {
                                console.error('❌ Lỗi xử lý texture:', error, url);
                                resolve(this.createFallbackTexture());
                            }
                        },
                        undefined,
                        (error) => {
                            clearTimeout(timeout);
                            console.error('❌ Lỗi load texture:', error, url);
                            resolve(this.createFallbackTexture());
                        }
                    );
                });
            });
            
            return Promise.all(loadPromises).then(textures => {
                // Lọc bỏ textures null/undefined
                const validTextures = textures.filter(t => t !== null && t !== undefined);
                
                // Nếu tất cả đều lỗi, tạo ít nhất 1 fallback
                if (validTextures.length === 0) {
                    console.warn('⚠️ All textures failed to load, creating fallback');
                    validTextures.push(this.createFallbackTexture());
                }
                
                this.flowerTextures = validTextures;
                this.currentTextures = [...validTextures];
                
                console.log(`✅ Successfully preloaded ${validTextures.length} textures`);
                
                // === SỬ DỤNG MATERIAL CACHE ===
                this.randomizeFlowerTexturesWithCache();
            });
            
        } catch (error) {
            console.error('❌ Critical error in preloadTextures:', error);
            // Fallback cứng
            this.flowerTextures = [this.createFallbackTexture()];
            this.currentTextures = [...this.flowerTextures];
            this.randomizeFlowerTexturesWithCache();
            return Promise.resolve();
        }
    }

    /**
     * Random lại texture cho các bông hoa từ mảng đã preload
     * @deprecated Sử dụng randomizeFlowerTexturesWithCache() thay thế
     */
    randomizeFlowerTextures() {
        // === CHUYỂN SANG SỬ DỤNG MATERIAL CACHE ===
        this.randomizeFlowerTexturesWithCache();
    }

    // === MEMORY OPTIMIZATION METHODS ===
    
    /**
     * Giảm số lượng particles dựa trên device capability
     * @param {number} factor - Hệ số giảm (0.1 - 1.0)
     */
    reduceParticleCount(factor = 0.5) {
        if (factor <= 0 || factor >= 1) return;
        
        const targetCount = Math.floor(this.flowers.length * factor);
        const flowersToRemove = this.flowers.length - targetCount;
        
        // Xóa flowers thừa từ cuối mảng
        for (let i = 0; i < flowersToRemove; i++) {
            const flower = this.flowers.pop();
            if (flower && this.flowerRing) {
                this.flowerRing.remove(flower);
            }
        }
        
    }
    
    /**
     * Tối ưu hóa texture quality dựa trên device
     * @param {string} quality - 'low', 'medium', 'high'
     */
    optimizeTextureQuality(quality = 'medium') {
        const qualitySettings = {
            low: {
                minFilter: THREE.NearestFilter,
                magFilter: THREE.NearestFilter,
                generateMipmaps: false
            },
            medium: {
                minFilter: THREE.LinearFilter,
                magFilter: THREE.LinearFilter,
                generateMipmaps: false
            },
            high: {
                minFilter: THREE.LinearMipmapLinearFilter,
                magFilter: THREE.LinearFilter,
                generateMipmaps: true
            }
        };
        
        const settings = qualitySettings[quality] || qualitySettings.medium;
        
        // Cập nhật tất cả textures hiện tại
        this.currentTextures.forEach(texture => {
            texture.minFilter = settings.minFilter;
            texture.magFilter = settings.magFilter;
            texture.generateMipmaps = settings.generateMipmaps;
            texture.needsUpdate = true;
        });
        
    }
    
    /**
     * Cleanup memory khi gặp memory pressure
     */
    handleMemoryPressure() {
        try {
            
            // Giảm particle count
            this.reduceParticleCount(0.7);
            
            // Clear texture cache
            this.disposeTextures();
            
            // Clear sin/cos cache
            this.sinCache.clear();
            this.cosCache.clear();
            
            // Force garbage collection nếu có thể
            if (window.gc) {
                window.gc();
            }
            
        } catch (error) {
            console.warn('⚠️ Error during memory cleanup:', error);
        }
    }
    
    /**
     * Thiết lập memory pressure handling
     */
    setupMemoryPressureHandling() {
        try {
            // iOS memory warning
            if ('onmemorywarning' in window) {
                window.addEventListener('memorywarning', () => {
                    console.log('⚠️ iOS memory warning received');
                    this.handleMemoryPressure();
                });
            }
            
            // Page visibility change
            document.addEventListener('visibilitychange', () => {
                if (document.hidden) {
                    // Page ẩn - cleanup memory
                    this.cleanupMaterialCache();
                    this.sinCache.clear();
                    this.cosCache.clear();
                }
            });
            
            // Window focus/blur
            window.addEventListener('blur', () => {
                // Window mất focus - cleanup memory
                this.cleanupMaterialCache();
            });
            
            // iOS Safari specific optimizations
            const isIOSSafari = /iPad|iPhone|iPod/.test(navigator.userAgent) && 
                               /Safari/.test(navigator.userAgent) && 
                               !/Chrome/.test(navigator.userAgent);
            
            if (isIOSSafari) {
                // Cleanup memory thường xuyên hơn trên iOS Safari
                setInterval(() => {
                    this.cleanupMaterialCache();
                }, 15000); // Cleanup mỗi 15 giây trên iOS
                
                // Thêm event listener cho iOS specific events
                window.addEventListener('pagehide', () => {
                    console.log('⚠️ iOS pagehide event - aggressive cleanup');
                    this.handleMemoryPressure();
                });
                
                // Thêm event listener cho beforeunload
                window.addEventListener('beforeunload', () => {
                    console.log('⚠️ Before unload - final cleanup');
                    this.disposeAll();
                });
            }
            
            // Periodic memory cleanup cho iOS
            if (this.deviceTier === 'low') {
                setInterval(() => {
                    this.cleanupMaterialCache();
                }, 30000); // Cleanup mỗi 30 giây
            }
        } catch (error) {
            console.warn('⚠️ Error setting up memory pressure handling:', error);
        }
    }
    
    /**
     * Dispose tất cả resources khi cần thiết
     */
    disposeAll() {
        try {
            // Dispose tất cả textures
            this.disposeTextures();
            
            // Dispose tất cả materials
            this.materialCache.forEach(material => {
                if (material && material.dispose) {
                    material.dispose();
                }
            });
            this.materialCache.clear();
            this.activeMaterials.clear();
            
            // Clear caches
            this.sinCache.clear();
            this.cosCache.clear();
            
            // Dispose flowers
            this.flowers.forEach(flower => {
                if (flower && flower.material) {
                    if (flower.material.dispose) {
                        flower.material.dispose();
                    }
                }
            });
            
            // Clear arrays
            this.flowers = [];
            this.flowerTextures = [];
            this.currentTextures = [];
            
            console.log('✅ All resources disposed successfully');
        } catch (error) {
            console.error('❌ Error during disposeAll:', error);
        }
    }

    updateTexturesByDataURLs(dataURLs, showOverlay = true) {
        this.disposeTextures();
        const loader = new THREE.TextureLoader();
        const loadPromises = dataURLs.map(url => {
            return new Promise((resolve) => {
                loader.load(
                    url,
                    (texture) => {
                        try {
                            // Xử lý canvas, EXIF, bo tròn góc như cũ
                            const canvas = this.getCanvasFromPool();
                            const ctx = canvas.getContext('2d');
                            canvas.width = texture.image.width;
                            canvas.height = texture.image.height;
                            const img = texture.image;
                            let orientation = 1;
                            if (img instanceof HTMLImageElement && img.src.startsWith('data:')) {
                                EXIF.getData(img, function() {
                                    orientation = EXIF.getTag(this, 'Orientation') || 1;
                                });
                            }
                            ctx.save();
                            this.drawImageWithOrientation(ctx, img, orientation, canvas.width, canvas.height);
                            ctx.restore();
                            // ... bo tròn góc ...
                            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                            const data = imageData.data;
                            const radius = Math.min(canvas.width, canvas.height) * 0.1;
                            for (let y = 0; y < canvas.height; y++) {
                                for (let x = 0; x < canvas.width; x++) {
                                    const idx = (y * canvas.width + x) * 4;
                                    const distX = Math.min(x, canvas.width - x);
                                    const distY = Math.min(y, canvas.height - y);
                                    const dist = Math.sqrt(distX * distX + distY * distY);
                                    if (dist < radius) {
                                        const alpha = Math.min(1, dist / radius);
                                        data[idx + 3] = Math.floor(255 * alpha);
                                    } else {
                                        data[idx + 3] = 255;
                                    }
                                }
                            }
                            ctx.putImageData(imageData, 0, 0);
                            const processedTexture = new THREE.CanvasTexture(canvas);
                            processedTexture.colorSpace = THREE.SRGBColorSpace;
                            processedTexture.minFilter = THREE.NearestFilter;
                            processedTexture.magFilter = THREE.NearestFilter;
                            if (texture.dispose) texture.dispose();
                            resolve(processedTexture);
                        } catch (error) {
                            console.error('Lỗi xử lý texture:', error, url);
                            // fallback nếu lỗi xử lý
                            resolve(this.createFallbackTexture());
                        }
                    },
                    undefined,
                    (error) => {
                        console.error('Lỗi load texture:', error, url);
                        // fallback nếu lỗi load
                        resolve(this.createFallbackTexture());
                    }
                );
            });
        });

        Promise.all(loadPromises).then(textures => {
            // Nếu tất cả đều lỗi, tạo ít nhất 1 fallback
            if (textures.length === 0) {
                textures = [this.createFallbackTexture()];
            }
            this.flowerTextures = textures;
            this.currentTextures = [...textures];
            
            // === SỬ DỤNG MATERIAL CACHE ===
            this.randomizeFlowerTexturesWithCache();
        });
    }

    // Cleanup method để dispose tất cả resources
    dispose() {
        // Dispose textures
        this.disposeTextures();
        
        // === DISPOSE MATERIAL CACHE ===
        for (const [textureId, material] of this.materialCache) {
            if (material && material.dispose) {
                material.dispose();
            }
        }
        this.materialCache.clear();
        this.activeMaterials.clear();
        
        // Clear arrays
        this.flowers = [];
        this.flowerTextures = [];
        this.currentTextures = [];
        
        // Clear caches
        this.sinCache.clear();
        this.cosCache.clear();
        
        // Remove from scene
        if (this.flowerRing && this.scene) {
            this.scene.remove(this.flowerRing);
        }
    }
} 