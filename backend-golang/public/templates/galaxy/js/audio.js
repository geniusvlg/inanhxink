import * as THREE from 'three';

export class AudioManager {
    constructor() {
        this.audio = document.getElementById('bg-audio');
        this.defaultAudioUrl = 'assets/musics/hukhong.mp3';
        this.currentAudioUrl = null;
        this.isPlaying = false;
        this.isAudioLoaded = false;
        
        // === LAZY LOADING AUDIO SYSTEM ===
        this.audioCache = new Map(); // Cache audio elements theo URL
        this.audioQueue = []; // Queue các audio cần preload
        this.maxCacheSize = 3; // Chỉ cache tối đa 3 audio
        this.preloadCount = 1; // Preload 1 bài tiếp theo
        
        // === DEVICE OPTIMIZATION ===
        this.deviceTier = this.detectDeviceTier();
        this.optimizeForDevice();
        
        // === AUDIO LIST ===
        this.audioList = [
            'assets/musics/1000anhmat.mp3',
            'assets/musics/anhnangcuaanh.mp3',
            'assets/musics/cochacyeuladay.mp3',
            'assets/musics/codoidieu.mp3',
            'assets/musics/denbenanh.mp3',
            'assets/musics/dunglamtraitimanhdau.mp3',
            'assets/musics/eyenoselip.mp3',
            'assets/musics/givemeyourforever.mp3',
            'assets/musics/happy-birthday.mp3',
            'assets/musics/hukhong.mp3',
            'assets/musics/lambantraianhe.mp3',
            'assets/musics/moonlit_dream.mp3',
            'assets/musics/motdoi.mp3',
            'assets/musics/perfect.mp3',
            'assets/musics/phepmau.mp3',
            'assets/musics/suynghitronganh.mp3',
            'assets/musics/tungngayyeuem.mp3',
            'assets/musics/yeuemhonmoingay.mp3',
            'assets/musics/yeuemratnhieu.mp3'
        ];
        
        this.currentAudioIndex = 9; // Index của hukhong.mp3 (default)
        
        this.setAudioUrl(this.defaultAudioUrl);
        this.setupAudioEvents();
        
        // === SMART PRELOADING ===
        this.preloadNextAudios();
    }

    // === DEVICE DETECTION & OPTIMIZATION ===
    
    /**
     * Phát hiện device tier để tối ưu hóa audio
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
            
            // Kiểm tra audio support
            const audioContext = window.AudioContext || window.webkitAudioContext;
            const hasAudioContext = !!audioContext;
            
            if (isIOSSafari || memory < 2 || cores < 4 || !hasAudioContext) {
                return 'low';
            } else if (memory < 4 || cores < 6) {
                return 'medium';
            } else {
                return 'high';
            }
        } catch (error) {
            console.warn('⚠️ Device detection failed, using medium tier:', error);
            return 'medium';
        }
    }
    
    /**
     * Tối ưu hóa dựa trên device capability
     */
    optimizeForDevice() {
        
        switch (this.deviceTier) {
            case 'low':
                // iOS cũ, Android cũ, thiết bị yếu
                this.maxCacheSize = 1; // Chỉ cache 1 audio
                this.preloadCount = 0; // Không preload
                break;
                
            case 'medium':
                // iOS mới, Android trung bình
                this.maxCacheSize = 2; // Cache 2 audio
                this.preloadCount = 1; // Preload 1 bài
                break;
                
            case 'high':
                // Desktop, flagship mobile
                this.maxCacheSize = 3; // Cache 3 audio
                this.preloadCount = 2; // Preload 2 bài
                break;
        }
        
    }

    // === LAZY LOADING AUDIO SYSTEM ===
    
    /**
     * Lấy audio từ cache hoặc load mới
     * @param {string} url - URL của audio
     * @returns {Promise<HTMLAudioElement>} Audio element
     */
    async getAudioFromCache(url) {
        // Kiểm tra cache trước
        if (this.audioCache.has(url)) {
            return this.audioCache.get(url);
        }
        
        // Load audio mới
        const audio = await this.loadAudio(url);
        
        // Thêm vào cache
        this.audioCache.set(url, audio);
        // this.activeAudios.add(url); // This line was removed as per the new_code, as activeAudios is not defined.
        
        // Cleanup cache nếu quá lớn
        this.cleanupAudioCache();
        
        return audio;
    }
    
    /**
     * Load audio từ URL
     * @param {string} url - URL của audio
     * @returns {Promise<HTMLAudioElement>} Audio element
     */
    loadAudio(url) {
        return new Promise((resolve, reject) => {
            const audio = new Audio();
            
            // Tối ưu hóa audio cho mobile
            audio.preload = 'metadata'; // Chỉ load metadata, không load toàn bộ file
            audio.crossOrigin = 'anonymous';
            
            // Event listeners
            audio.addEventListener('canplaythrough', () => {
                resolve(audio);
            }, { once: true });
            
            audio.addEventListener('error', (error) => {
                console.error(`🎵 Audio load error: ${url}`, error);
                reject(error);
            }, { once: true });
            
            // Bắt đầu load
            audio.src = url;
            audio.load();
        });
    }
    
    /**
     * Cleanup audio cache khi vượt quá giới hạn
     */
    cleanupAudioCache() {
        if (this.audioCache.size <= this.maxCacheSize) {
            return;
        }
                
        // Tìm audio không còn sử dụng
        const unusedAudios = [];
        for (const [url, audio] of this.audioCache) {
            if (url !== this.currentAudioUrl) {
                unusedAudios.push(url);
            }
        }
        
        // Xóa audio không sử dụng
        unusedAudios.forEach(url => {
            const audio = this.audioCache.get(url);
            if (audio) {
                // Dispose audio
                audio.pause();
                audio.src = '';
                audio.load();
                this.audioCache.delete(url);
            }
        });
        
        // Nếu vẫn quá lớn, xóa audio cũ nhất
        if (this.audioCache.size > this.maxCacheSize) {
            const entries = Array.from(this.audioCache.entries());
            const toRemove = entries.slice(0, this.audioCache.size - this.maxCacheSize);
            
            toRemove.forEach(([url, audio]) => {
                audio.pause();
                audio.src = '';
                audio.load();
                this.audioCache.delete(url);
            });
        }
    }
    
    /**
     * Preload audio tiếp theo
     */
    async preloadNextAudios() {
        if (this.preloadCount <= 0) return;
        
        try {
            const nextIndices = [];
            for (let i = 1; i <= this.preloadCount; i++) {
                const nextIndex = (this.currentAudioIndex + i) % this.audioList.length;
                nextIndices.push(nextIndex);
            }
            
            // Preload các audio tiếp theo
            for (const index of nextIndices) {
                const url = this.audioList[index];
                if (!this.audioCache.has(url)) {
                    await this.getAudioFromCache(url);
                }
            }
        } catch (error) {
            console.warn('⚠️ Preload failed:', error);
        }
    }
    
    /**
     * Chuyển bài nhạc
     * @param {string} direction - 'next', 'prev', hoặc index number
     */
    async changeAudio(direction) {
        try {
            let newIndex;
            
            if (direction === 'next') {
                newIndex = (this.currentAudioIndex + 1) % this.audioList.length;
            } else if (direction === 'prev') {
                newIndex = (this.currentAudioIndex - 1 + this.audioList.length) % this.audioList.length;
            } else if (typeof direction === 'number') {
                newIndex = direction % this.audioList.length;
            } else {
                return;
            }
            
            const newUrl = this.audioList[newIndex];
            
            // Cập nhật index
            this.currentAudioIndex = newIndex;
            
            // Chuyển audio
            await this.setAudioUrl(newUrl);
            
            // Preload audio tiếp theo
            this.preloadNextAudios();
            
        } catch (error) {
            console.error('🎵 Error changing audio:', error);
        }
    }

    setAudioUrl(url) {
        if (url && url !== this.currentAudioUrl) {
            // Lấy audio từ cache hoặc load mới
            this.getAudioFromCache(url).then(audio => {
                // Cập nhật audio element chính
                this.audio.src = url;
                this.currentAudioUrl = url;
                this.audio.load();
                this.isPlaying = false;
                this.isAudioLoaded = false;

            }).catch(error => {
                console.error('🎵 Error setting audio URL:', error);
                // Fallback to default
                this.audio.src = this.defaultAudioUrl;
                this.currentAudioUrl = this.defaultAudioUrl;
            });
        }
    }

    setupAudioEvents() {
        // Xử lý sự kiện khi audio được load
        this.audio.addEventListener('canplaythrough', () => {
            this.isAudioLoaded = true;
            // Phát event để thông báo audio đã sẵn sàng
            document.dispatchEvent(new CustomEvent('audioLoaded'));
        });

        // Xử lý sự kiện khi audio bắt đầu phát
        this.audio.addEventListener('play', () => {
            this.isPlaying = true;
        });

        // Xử lý sự kiện khi audio tạm dừng
        this.audio.addEventListener('pause', () => {
            this.isPlaying = false;
        });

        // Lỗi
        this.audio.addEventListener('error', (e) => {
            console.error('🎵 Audio error:', e);
            this.isAudioLoaded = false;
        });

        // Sự kiện khi audio có thể phát
        this.audio.addEventListener('canplay', () => {
            this.isAudioLoaded = true;
        });
    }

    async playOnly() {
        try {
            // Chỉ phát nhạc nếu đang tạm dừng
            if (this.audio.paused) {
                // Đảm bảo audio context được resume (cần thiết cho mobile)
                if (this.audio.readyState >= 2) { // HAVE_CURRENT_DATA
                    await this.audio.play();
                    this.isPlaying = true;
                } else {
                    // Đợi audio load xong
                    this.audio.addEventListener('canplay', async () => {
                        await this.audio.play();
                        this.isPlaying = true;
                    }, { once: true });
                }
            } else {
                console.log('🎵 Audio is already playing, no action needed');
            }
        } catch (error) {
            console.error('🎵 Error playing audio:', error);
        }
    }
    
    // === PUBLIC METHODS ===
    
    /**
     * Lấy thông tin audio hiện tại
     */
    getCurrentAudioInfo() {
        return {
            url: this.currentAudioUrl,
            index: this.currentAudioIndex,
            name: this.audioList[this.currentAudioIndex]?.split('/').pop()?.replace('.mp3', ''),
            isPlaying: this.isPlaying,
            isLoaded: this.isAudioLoaded
        };
    }
    
    /**
     * Lấy danh sách tất cả audio
     */
    getAudioList() {
        return this.audioList.map((url, index) => ({
            url,
            index,
            name: url.split('/').pop()?.replace('.mp3', ''),
            isCurrent: index === this.currentAudioIndex,
            isCached: this.audioCache.has(url)
        }));
    }
    
    /**
     * Cleanup tất cả resources
     */
    dispose() {
        try {
            // Dispose tất cả cached audio
            for (const [url, audio] of this.audioCache) {
                audio.pause();
                audio.src = '';
                audio.load();
            }
            this.audioCache.clear();
            
            // Dispose audio chính
            if (this.audio) {
                this.audio.pause();
                this.audio.src = '';
                this.audio.load();
            }
            
        } catch (error) {
            console.warn('⚠️ Error disposing AudioManager:', error);
        }
    }
} 