const textData = window.dataFromSubdomain?.data?.texts || ['tokitoki.love', 'khám phá vũ trụ', 'yêu em mãi mãi'];
const songUrl = window.dataFromSubdomain?.data?.song;
const width = window.innerWidth;
const height = window.innerHeight;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ alpha: true });

renderer.setSize(width, height);
document.getElementById('threejs-canvas').appendChild(renderer.domElement);
camera.position.z = 15;

let isPlaying = false;
let isAudioAllowed = true;
let isAudioInited = false;

function createTextImage(text) {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    context.font = 'bold 48px "Playpen Sans"';
    const textWidth = context.measureText(text).width;
    const padding = 60;
    const width = Math.ceil(textWidth + padding * 2);
    const height = 128;

    const textureCanvas = document.createElement('canvas');
    textureCanvas.width = width;
    textureCanvas.height = height;
    const texContext = textureCanvas.getContext('2d');
    texContext.font = 'bold 48px "Playpen Sans"';
    texContext.textAlign = 'center';
    texContext.textBaseline = 'middle';
    texContext.shadowColor = '#ff69b4';
    texContext.shadowBlur = 50;
    texContext.fillStyle = '#fff';
    texContext.fillText(text, width / 2, height / 2);

    return {
        texture: new THREE.CanvasTexture(textureCanvas),
        aspect: width / height
    };
}

function createHeartTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const context = canvas.getContext('2d');
    context.clearRect(0, 0, 128, 128);
    context.save();
    context.translate(64, 64);
    context.beginPath();
    context.moveTo(0, 28);
    context.bezierCurveTo(28, 0, 56, 28, 0, 56);
    context.bezierCurveTo(-56, 28, -28, 0, 0, 28);
    context.closePath();
    context.fillStyle = '#ff2222';
    context.shadowColor = '#ffb3b3';
    context.shadowBlur = 10;
    context.fill();
    context.restore();
    return new THREE.CanvasTexture(canvas);
}

let starParticles = [];
function initStars() {
    const geometry = new THREE.SphereGeometry(0.07, 6, 6);
    const material = new THREE.MeshBasicMaterial({ color: 0xffffff });
    for (let i = 0; i < 800; i++) {
        const star = new THREE.Mesh(geometry, material);
        star.position.x = (Math.random() - 0.5) * 120;
        star.position.y = Math.random() * 80 - 20;
        star.position.z = (Math.random() - 0.5) * 120 - 20;
        scene.add(star);
        starParticles.push(star);
    }
}

let flyingTexts = [];
function initFlyingTexts() {
    flyingTexts.forEach(item => scene.remove(item));
    flyingTexts = [];
    for (let i = 0; i < 200; i++) {
        const text = textData[Math.floor(Math.random() * textData.length)];
        const { texture, aspect } = createTextImage(text);
        texture.needsUpdate = true;
        const h = 1.1;
        const w = h * aspect;
        const geometry = new THREE.PlaneGeometry(w, h);
        const material = new THREE.MeshBasicMaterial({
            map: texture,
            transparent: true,
            depthWrite: false,
            depthTest: true,
            color: 0xffffff
        });
        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.x = (Math.random() - 0.5) * 30;
        mesh.position.y = Math.random() * 20 + 10;
        mesh.position.z = (Math.random() - 0.5) * 10;
        mesh.userData.phase = Math.random() * Math.PI * 2;
        scene.add(mesh);
        flyingTexts.push(mesh);
    }
}

let flyingHearts = [];
function initFlyingHearts() {
    flyingHearts.forEach(item => scene.remove(item));
    flyingHearts = [];
    const texture = createHeartTexture();
    for (let i = 0; i < 15; i++) {
        const geometry = new THREE.PlaneGeometry(1.5, 1.5);
        const material = new THREE.MeshBasicMaterial({
            map: texture,
            transparent: true,
            depthWrite: false,
            depthTest: true
        });
        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.x = (Math.random() - 0.5) * 30;
        mesh.position.y = Math.random() * 20 + 10;
        mesh.position.z = (Math.random() - 0.5) * 10;
        const scale = 1 + Math.random() * 1.5;
        mesh.scale.set(scale, scale, 1);
        scene.add(mesh);
        flyingHearts.push(mesh);
    }
}

let shootingStars = [];
function createShootingStar() {
    const geometry = new THREE.SphereGeometry(0.15, 8, 8);
    const material = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.x = (Math.random() - 0.5) * 100;
    mesh.position.y = Math.random() * 80 - 20;
    mesh.position.z = -40 - Math.random() * 40;
    mesh.userData = {
        vx: 0.4 + Math.random() * 0.3,
        vy: -0.2 - Math.random() * 0.2,
        vz: 0.7 + Math.random() * 0.5,
        tail: []
    };
    scene.add(mesh);
    shootingStars.push(mesh);
}

let isMouseDown = false, lastMouseX = 0, isTouchDown = false, lastTouchX = 0, targetRotationY = 0;

renderer.domElement.addEventListener('mousedown', e => {
    isMouseDown = true;
    lastMouseX = e.clientX;
});
window.addEventListener('mouseup', () => isMouseDown = false);
window.addEventListener('mousemove', e => {
    if (isMouseDown) {
        const deltaX = e.clientX - lastMouseX;
        lastMouseX = e.clientX;
        targetRotationY += deltaX * 0.0015;
    }
});

renderer.domElement.addEventListener('touchstart', e => {
    if (e.touches.length === 1) {
        isTouchDown = true;
        lastTouchX = e.touches[0].clientX;
    }
});
window.addEventListener('touchend', () => isTouchDown = false);
window.addEventListener('touchmove', e => {
    if (isTouchDown && e.touches.length === 1) {
        const touchX = e.touches[0].clientX;
        const deltaX = touchX - lastTouchX;
        lastTouchX = touchX;
        targetRotationY += deltaX * 0.0015;
    }
});

function lerpColor(c1, c2, t) {
    return [
        Math.round(c1[0] + (c2[0] - c1[0]) * t),
        Math.round(c1[1] + (c2[1] - c1[1]) * t),
        Math.round(c1[2] + (c2[2] - c1[2]) * t)
    ];
}

function animate() {
    requestAnimationFrame(animate);
    camera.rotation.y += (targetRotationY - camera.rotation.y) * 0.08;
    const now = Date.now();

    flyingTexts.forEach(mesh => {
        mesh.position.y -= 0.05 + Math.random() * 0.02;
        if (mesh.position.y < -12) {
            mesh.position.y = Math.random() * 20 + 10;
            mesh.position.x = (Math.random() - 0.5) * 30;
            mesh.position.z = (Math.random() - 0.5) * 10;
        }
        if (mesh.position.x > 16) mesh.position.x = -16;
        if (mesh.position.x < -16) mesh.position.x = 16;

        const t = (Math.sin(now * 0.0005 + mesh.userData.phase) + 1) / 2;
        const color = lerpColor([255, 255, 255], [255, 105, 180], t);
        const hex = (color[0] << 16) | (color[1] << 8) | color[2];
        mesh.material.color.setHex(hex);
    });

    flyingHearts.forEach(mesh => {
        mesh.position.y -= 0.08 + Math.random() * 0.04;
        mesh.position.x += (Math.random() - 0.5) * 0.05;
        if (mesh.position.y < -12) {
            mesh.position.y = Math.random() * 20 + 10;
            mesh.position.x = (Math.random() - 0.5) * 30;
            mesh.position.z = (Math.random() - 0.5) * 10;
        }
        if (mesh.position.x > 16) mesh.position.x = -16;
        if (mesh.position.x < -16) mesh.position.x = 16;
    });

    shootingStars.forEach((star, index) => {
        if (star.userData.tail.length > 20) star.userData.tail.shift();
        star.userData.tail.push({ x: star.position.x, y: star.position.y, z: star.position.z });

        star.position.x += star.userData.vx;
        star.position.y += star.userData.vy;
        star.position.z += star.userData.vz;

        for (let i = 0; i < star.userData.tail.length - 1; i++) {
            const p1 = star.userData.tail[i];
            const p2 = star.userData.tail[i + 1];
            const geometry = new THREE.BufferGeometry().setFromPoints([
                new THREE.Vector3(p1.x, p1.y, p1.z),
                new THREE.Vector3(p2.x, p2.y, p2.z)
            ]);
            const material = new THREE.LineBasicMaterial({
                color: 0xffffff,
                transparent: true,
                opacity: 0.15 + 0.25 * (i / star.userData.tail.length)
            });
            const line = new THREE.Line(geometry, material);
            scene.add(line);
            setTimeout(() => scene.remove(line), 40);
        }

        star.material.opacity = 0.8;
        if (star.position.z > 0 || star.position.y < -40) {
            scene.remove(star);
            shootingStars.splice(index, 1);
        }
    });

    if (Math.random() < 0.012) createShootingStar();
    updateFireworks();
    renderer.render(scene, camera);
}

const activeFireworks = [];

function createFireworkTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(32, 32, 16, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 10;
    ctx.shadowColor = '#ffffff';
    ctx.beginPath();
    ctx.arc(32, 32, 12, 0, Math.PI * 2);
    ctx.fill();
    return new THREE.CanvasTexture(canvas);
}

const fireworkTexture = createFireworkTexture();

function createFirework() {
    const particleCount = 100;
    const x = (Math.random() - 0.5) * 60;
    const y = (Math.random() - 0.5) * 40 + 10;
    const z = -30 - Math.random() * 20;

    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    const colors = new Float32Array(particleCount * 3);
    const velocities = [];

    const chosenColor = Math.random() > 0.5 ? new THREE.Color(0xffffff) : new THREE.Color(0xff69b4);

    for (let i = 0; i < particleCount; i++) {
        positions[i * 3] = x;
        positions[i * 3 + 1] = y;
        positions[i * 3 + 2] = z;
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);
        const speed = 0.1 + Math.random() * 0.35;
        velocities.push({
            x: Math.sin(phi) * Math.cos(theta) * speed,
            y: Math.sin(phi) * Math.sin(theta) * speed,
            z: Math.cos(phi) * speed
        });
        colors[i * 3] = chosenColor.r;
        colors[i * 3 + 1] = chosenColor.g;
        colors[i * 3 + 2] = chosenColor.b;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const material = new THREE.PointsMaterial({
        size: 1.0,
        map: fireworkTexture,
        transparent: true,
        opacity: 1,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        vertexColors: true
    });

    const points = new THREE.Points(geometry, material);
    scene.add(points);
    activeFireworks.push({ points, velocities, life: 1.0, decay: 0.015 + Math.random() * 0.01 });
}

function updateFireworks() {
    for (let i = activeFireworks.length - 1; i >= 0; i--) {
        const fw = activeFireworks[i];
        const positions = fw.points.geometry.attributes.position.array;
        for (let j = 0; j < fw.velocities.length; j++) {
            positions[j * 3] += fw.velocities[j].x;
            positions[j * 3 + 1] += fw.velocities[j].y;
            positions[j * 3 + 2] += fw.velocities[j].z;
            fw.velocities[j].y -= 0.002;
        }
        fw.points.geometry.attributes.position.needsUpdate = true;
        fw.life -= fw.decay;
        fw.points.material.opacity = fw.life;
        if (fw.life <= 0) {
            scene.remove(fw.points);
            fw.points.geometry.dispose();
            fw.points.material.dispose();
            activeFireworks.splice(i, 1);
        }
    }
    if (Math.random() < 0.05) createFirework();
}

initStars();
initFlyingTexts();
initFlyingHearts();
animate();

window.addEventListener('resize', () => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
});

const bgAudio = document.getElementById('bg-audio');
if (bgAudio && songUrl) bgAudio.src = songUrl;

function initAudio() {
    if (!bgAudio || isAudioInited) return;
    bgAudio.loop = true;
    bgAudio.volume = 0;
    bgAudio.addEventListener('error', () => isAudioAllowed = false);
    bgAudio.addEventListener('canplaythrough', () => isAudioAllowed = true);
    bgAudio.addEventListener('loadeddata', () => isAudioAllowed = true);
    isAudioInited = true;
}

function playAudio(targetVolume = 0.7, duration = 3000) {
    if (!isAudioAllowed || !bgAudio) return;
    if (bgAudio.fadeInterval) clearInterval(bgAudio.fadeInterval);
    bgAudio.volume = 0;
    bgAudio.play().then(() => {
        isPlaying = true;
        const step = targetVolume / (duration / 50);
        bgAudio.fadeInterval = setInterval(() => {
            if (bgAudio.volume < targetVolume) {
                bgAudio.volume = Math.min(bgAudio.volume + step, targetVolume);
            } else {
                clearInterval(bgAudio.fadeInterval);
            }
        }, 50);
    }).catch(() => {
        isAudioAllowed = false;
        isPlaying = false;
    });
}

function handleUserInteraction() {
    if (!isAudioInited && bgAudio) initAudio();
    if (bgAudio && isAudioAllowed && !isPlaying) playAudio();
}

['click', 'touchstart', 'touchend', 'mousedown', 'keydown'].forEach(event => {
    document.addEventListener(event, handleUserInteraction, { once: true, passive: true });
});

document.addEventListener('DOMContentLoaded', () => {
    document.body.style.display = '';
    if (bgAudio) {
        initAudio();
        bgAudio.addEventListener('error', () => isAudioAllowed = false);
        try { bgAudio.load(); } catch (e) { isAudioAllowed = false; }
    } else {
        isAudioAllowed = false;
    }
});

bgAudio && bgAudio.addEventListener('ended', () => {
    isPlaying = false;
    if (isAudioAllowed) setTimeout(() => playAudio(), 1000);
});

function createLoadingStars() {
    const screen = document.getElementById('loading-screen');
    if (!screen) return;
    for (let i = 0; i < 50; i++) {
        const star = document.createElement('div');
        star.className = 'star';
        star.style.left = Math.random() * 100 + '%';
        star.style.top = Math.random() * 100 + '%';
        const size = Math.random() * 3;
        star.style.width = size + 'px';
        star.style.height = size + 'px';
        star.style.animationDelay = Math.random() * 2 + 's';
        const blur = Math.random() * 5 + 5;
        star.style.boxShadow = `0 0 ${blur}px #fff`;
        screen.appendChild(star);
    }
}

const startButton = document.getElementById('start-button');
const loadingScreen = document.getElementById('loading-screen');
const canvasElement = document.getElementById('threejs-canvas');

document.addEventListener('DOMContentLoaded', createLoadingStars);

function handleStartClick() {
    if (startButton) startButton.classList.add('clicked');
    setTimeout(() => {
        if (loadingScreen) loadingScreen.classList.add('fade-out');
        if (canvasElement) {
            canvasElement.style.display = '';
            canvasElement.classList.add('fade-in');
        }
        setTimeout(() => {
            if (loadingScreen) loadingScreen.remove();
        }, 1000);
        if (bgAudio) {
            initAudio();
            handleUserInteraction();
        }
    }, 1000);
}

if (startButton) startButton.addEventListener('click', handleStartClick);
