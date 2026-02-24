import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

export class Heart {
    constructor(scene) {
        this.scene = scene;
        this.model = null;
        this.mixer = null;
        this.clock = new THREE.Clock();
        this.loadModel();
    }

    loadModel() {
        const loader = new GLTFLoader();
        loader.load(
            'assets/images/heart_in_love.glb',
            (gltf) => {
                this.model = gltf.scene;
                
                // Reset transform của model
                this.model.position.set(0, 0, 0);
                this.model.rotation.set(0, 0, 0);
                this.model.updateMatrix();

                // Tạo một group để chứa model
                this.modelGroup = new THREE.Group();
                this.modelGroup.add(this.model);
                
                // Điều chỉnh kích thước của model
                this.model.scale.set(1.2, 1.2, 1.2); // Tăng kích thước lên để dễ nhìn thấy
                
                // Đặt vị trí của group
                this.modelGroup.position.set(0, 115, 0);
                
                // Thêm group vào scene thay vì thêm model trực tiếp
                this.scene.add(this.modelGroup);
                
                // Lưu reference vào window để có thể truy cập từ sphere.js
                window.heart3D = this.modelGroup;
                
                // Áp dụng trạng thái ban đầu (mặc định ẩn trái tim)
                if (window.centralSphere && window.centralSphere.applyCentralHeartState) {
                    window.centralSphere.applyCentralHeartState(false);
                }
                
                // Thêm animation nếu có
                if (gltf.animations && gltf.animations.length) {
                    this.mixer = new THREE.AnimationMixer(this.model);
                    
                    // Play tất cả các animation có trong model
                    gltf.animations.forEach((clip, index) => {
                        const action = this.mixer.clipAction(clip);
                        action.setLoop(THREE.LoopRepeat);
                        action.clampWhenFinished = false;
                        action.play();
                    });
                } else {
                    console.log('No animations found in the model');
                }
                
                // Thêm ánh sáng để làm nổi bật model
                const heartLight = new THREE.PointLight(0xffffff, 2, 1000);
                heartLight.position.set(0, 200, 100);
                this.scene.add(heartLight);

                // Thêm ánh sáng phụ trợ
                const helperLight = new THREE.DirectionalLight(0xffffff, 1);
                helperLight.position.set(0, 200, -100);
                this.scene.add(helperLight);

                // Bỏ BoxHelper để không hiển thị khung đỏ
                
                // Model đã được thêm vào group ở trên
                console.log('heart loaded successfully');
                
                // Phát sự kiện heart3D sẵn sàng
                try { document.dispatchEvent(new CustomEvent('heart3d_ready')); } catch (e) {}
            },
            (xhr) => {
            },
            (error) => {
                console.error('Error loading model:', error);
                console.error('Error details:', error.message);
            }
        );
    }

    animate() {
        if (this.mixer) {
            const delta = this.clock.getDelta();
            this.mixer.update(delta);
        }
        
        if (this.model) {
            // Chỉ thêm chuyển động lên xuống nhẹ nếu không có animation
            if (!this.mixer || !this.mixer.existingAction) {
                const time = Date.now() * 0.001;
                this.model.position.y = 70 + Math.sin(time) * 2; // Giảm biên độ xuống 2
            }
        }
    }
} 