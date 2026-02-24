import * as THREE from 'three';

export class ParticleSystem {
    constructor(scene) {
        this.scene = scene;
        this.circleTexture = this.createCircleTexture();
        this.diskRotationSpeed = 0.001;
        this.innerDiskRotationSpeed = 0.001;
        this.textureRotationSpeed = 0.00001;
        this.clock = new THREE.Clock();
        this.createBackgroundParticles();
        this.createInnerDiskParticles();
        this.createDiskParticles();
        this.createOutermostDiskParticles();
    }

    createCircleTexture() {
        const canvas = document.createElement('canvas');
        canvas.width = 28;
        canvas.height = 28;
        const context = canvas.getContext('2d');
        context.beginPath();
        context.arc(14, 14, 14, 0, Math.PI * 2);
        context.fillStyle = 'white';
        context.fill();
        const texture = new THREE.CanvasTexture(canvas);
        return texture;
    }

    createBackgroundParticles() {
        const particlesGeometry = new THREE.BufferGeometry();
        const particleCount = 4000;
        const posArray = new Float32Array(particleCount * 3);
        const colorsArray = new Float32Array(particleCount * 3);
        
        for (let i = 0; i < particleCount * 3; i += 3) {
            posArray[i] = (Math.random() - 0.5) * 3000;
            posArray[i + 1] = (Math.random() - 0.5) * 3000;
            posArray[i + 2] = (Math.random() - 0.5) * 3000;
            
            const color = new THREE.Color(
                Math.random() * 0.5 + 0.5,
                Math.random() * 0.3 + 0.7,
                Math.random() * 0.5 + 0.5
            );
            colorsArray[i] = color.r;
            colorsArray[i + 1] = color.g;
            colorsArray[i + 2] = color.b;
        }
        
        particlesGeometry.setAttribute('position', new THREE.BufferAttribute(posArray, 3));
        particlesGeometry.setAttribute('color', new THREE.BufferAttribute(colorsArray, 3));
        
        const particleMaterial = new THREE.PointsMaterial({
            size: 6,
            vertexColors: true,
            transparent: true,
            opacity: 0.8,
            map: this.circleTexture,
            blending: THREE.NormalBlending
        });
        
        this.backgroundParticles = new THREE.Points(particlesGeometry, particleMaterial);
        this.scene.add(this.backgroundParticles);
    }

    createInnerDiskParticles() {
        const innerDiskParticleCount = 6000;
        const innerMaxRadius = 110;
        const innerDiskHeightRange = 4;
        const innerDiskGeometry = new THREE.BufferGeometry();
        const innerDiskPosArray = new Float32Array(innerDiskParticleCount * 3);
        const innerDiskColorsArray = new Float32Array(innerDiskParticleCount * 3);
        for (let i = 0; i < innerDiskParticleCount * 3; i += 3) {
            const radius = Math.sqrt(Math.random()) * innerMaxRadius;
            const angle = Math.random() * Math.PI * 2;
            const height = (Math.random() - 0.5) * innerDiskHeightRange * 2;
            innerDiskPosArray[i] = Math.cos(angle) * radius;
            innerDiskPosArray[i + 1] = height;
            innerDiskPosArray[i + 2] = Math.sin(angle) * radius;
            const color = new THREE.Color(1.0, 0.8, 0.9);
            innerDiskColorsArray[i] = color.r;
            innerDiskColorsArray[i + 1] = color.g;
            innerDiskColorsArray[i + 2] = color.b;
        }
        innerDiskGeometry.setAttribute('position', new THREE.BufferAttribute(innerDiskPosArray, 3));
        innerDiskGeometry.setAttribute('color', new THREE.BufferAttribute(innerDiskColorsArray, 3));
        const innerDiskMaterial = new THREE.PointsMaterial({
            size: 0.7,
            vertexColors: true,
            transparent: true,
            opacity: 1,
            map: this.circleTexture,
            blending: THREE.NormalBlending
        });
        this.innerParticleDisk = new THREE.Points(innerDiskGeometry, innerDiskMaterial);
        this.scene.add(this.innerParticleDisk);
    }

    createDiskParticles() {
        const diskParticleCount = 100000;
        const innerRadius = 110;
        const outerRadius = 350;
        const diskGeometry = new THREE.BufferGeometry();
        const diskPosArray = new Float32Array(diskParticleCount * 3);
        const diskColorsArray = new Float32Array(diskParticleCount * 3);
        
        for (let i = 0; i < diskParticleCount * 3; i += 3) {
            const rand = Math.pow(Math.random(), 1.5);
            const radius = Math.sqrt(outerRadius * outerRadius * rand + (1 - rand) * innerRadius * innerRadius);
            const angle = Math.random() * Math.PI * 2;
            const height = (Math.random() - 0.5) * 2;
            
            const point = new THREE.Vector3().setFromCylindricalCoords(radius, angle, height);
            
            diskPosArray[i] = point.x;
            diskPosArray[i + 1] = point.y;
            diskPosArray[i + 2] = point.z;
            
            const color = new THREE.Color(1.0, 0.8, 0.9);
            diskColorsArray[i] = color.r;
            diskColorsArray[i + 1] = color.g;
            diskColorsArray[i + 2] = color.b;
        }
        
        diskGeometry.setAttribute('position', new THREE.BufferAttribute(diskPosArray, 3));
        diskGeometry.setAttribute('color', new THREE.BufferAttribute(diskColorsArray, 3));
        
        const diskMaterial = new THREE.PointsMaterial({
            size: 0.3,
            vertexColors: true,
            transparent: true,
            opacity: 1,
            map: this.circleTexture,
            blending: THREE.AdditiveBlending
        });
        
        this.particleDisk = new THREE.Points(diskGeometry, diskMaterial);
        this.scene.add(this.particleDisk);
    }

    createOutermostDiskParticles() {
        const outermostDiskParticleCount = 100000;
        const outermostInnerRadius = 350;
        const outermostOuterRadius = 520;
        const outermostDiskHeightRange = 2;
        const outermostDiskGeometry = new THREE.BufferGeometry();
        const outermostDiskPosArray = new Float32Array(outermostDiskParticleCount * 3);
        const outermostDiskColorsArray = new Float32Array(outermostDiskParticleCount * 3);
        
        for (let i = 0; i < outermostDiskParticleCount * 3; i += 3) {
            const radius = outermostInnerRadius + Math.random() * (outermostOuterRadius - outermostInnerRadius);
            const angle = Math.random() * Math.PI * 2;
            const height = (Math.random() - 0.5) * outermostDiskHeightRange * 2;
            
            outermostDiskPosArray[i] = Math.cos(angle) * radius;
            outermostDiskPosArray[i + 1] = height;
            outermostDiskPosArray[i + 2] = Math.sin(angle) * radius;
            
            const color = new THREE.Color(
                Math.random() * 0.2 + 0.8,
                Math.random() * 0.2 + 0.8,
                Math.random() * 0.2 + 0.8
            );
            outermostDiskColorsArray[i] = color.r;
            outermostDiskColorsArray[i + 1] = color.g;
            outermostDiskColorsArray[i + 2] = color.b;
        }
        
        outermostDiskGeometry.setAttribute('position', new THREE.BufferAttribute(outermostDiskPosArray, 3));
        outermostDiskGeometry.setAttribute('color', new THREE.BufferAttribute(outermostDiskColorsArray, 3));
        
        const outermostDiskMaterial = new THREE.ShaderMaterial({
            uniforms: {
                time: { value: 0 }
            },
            vertexShader: `
                uniform float time;
                attribute vec3 color;
                varying vec3 vColor;
                varying float vAlpha;

                void main() {
                    vColor = color;
                    vec3 pos = position;
                    
                    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
                    gl_PointSize = 2.0 * (300.0 / -mvPosition.z);
                    gl_Position = projectionMatrix * mvPosition;
                    vAlpha = 1.0;
                }
            `,
            fragmentShader: `
                varying vec3 vColor;
                varying float vAlpha;

                void main() {
                    float d = length(gl_PointCoord.xy - 0.5);
                    if (d > 0.5) discard;
                    
                    float alpha = smoothstep(0.5, 0.1, d);
                    vec3 finalColor = vColor;
                    
                    gl_FragColor = vec4(finalColor, alpha * 0.6);
                }
            `,
            transparent: true,
            depthTest: false,
            blending: THREE.AdditiveBlending
        });
        
        this.outermostParticleDisk = new THREE.Points(outermostDiskGeometry, outermostDiskMaterial);
        this.scene.add(this.outermostParticleDisk);
    }

    animate() {
        this.backgroundParticles.rotation.y += 0.001;
        this.particleDisk.rotation.y += this.diskRotationSpeed;
        this.innerParticleDisk.rotation.y += this.innerDiskRotationSpeed;
        this.outermostParticleDisk.rotation.y += this.diskRotationSpeed;
        
        // Cập nhật thời gian cho shader của outerdisk
        if (this.outermostParticleDisk.material.uniforms) {
            this.outermostParticleDisk.material.uniforms.time.value = this.clock.getElapsedTime();
        }
    }

    updateDiskRotationSpeed(speed) {
        this.diskRotationSpeed = speed;
    }

    updateInnerDiskRotationSpeed(speed) {
        this.innerDiskRotationSpeed = speed;
    }

    updateTextureRotationSpeed(speed) {
        this.textureRotationSpeed = speed;
    }

    updateColors(backgroundColor, diskColor, innerDiskColor, outermostColor) {
        // Cập nhật màu background particles
        if (backgroundColor) {
            let colors = this.backgroundParticles.geometry.attributes.color;
            let color = new THREE.Color(backgroundColor);
            // Tăng saturation cho màu không gian
            color = color.offsetHSL(0, 0.5, 0); // tăng saturation 40%
            for (let i = 0; i < colors.count; i++) {
                colors.setXYZ(i, color.r, color.g, color.b);
            }
            colors.needsUpdate = true;
        }

        // Cập nhật màu disk particles
        if (diskColor) {
            const colors = this.particleDisk.geometry.attributes.color;
            const color = new THREE.Color(diskColor);
            for (let i = 0; i < colors.count; i++) {
                colors.setXYZ(i, color.r, color.g, color.b);
            }
            colors.needsUpdate = true;
        }

        // Cập nhật màu inner disk particles
        if (innerDiskColor) {
            const colors = this.innerParticleDisk.geometry.attributes.color;
            const color = new THREE.Color(innerDiskColor);
            for (let i = 0; i < colors.count; i++) {
                colors.setXYZ(i, color.r, color.g, color.b);
            }
            colors.needsUpdate = true;
        }

        // Cập nhật màu outermost disk particles
        if (outermostColor) {
            const colors = this.outermostParticleDisk.geometry.attributes.color;
            const color = new THREE.Color(outermostColor);
            for (let i = 0; i < colors.count; i++) {
                colors.setXYZ(i, color.r, color.g, color.b);
            }
            colors.needsUpdate = true;
        }

        // Cập nhật material để áp dụng thay đổi
        if (backgroundColor) {
            this.backgroundParticles.material.needsUpdate = true;
        }
        if (diskColor) {
            this.particleDisk.material.needsUpdate = true;
        }
        if (innerDiskColor) {
            this.innerParticleDisk.material.needsUpdate = true;
        }
        if (outermostColor) {
            this.outermostParticleDisk.material.needsUpdate = true;
        }
    }
} 