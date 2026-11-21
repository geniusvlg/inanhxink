        import * as THREE from 'three';
        import {
            OrbitControls
        } from 'three/addons/controls/OrbitControls.js';
        import {
            EffectComposer
        } from 'three/addons/postprocessing/EffectComposer.js';
        import {
            RenderPass
        } from 'three/addons/postprocessing/RenderPass.js';
        import {
            UnrealBloomPass
        } from 'three/addons/postprocessing/UnrealBloomPass.js';
        import {
            gsap
        } from 'gsap';

        let scene, camera, renderer, controls, composer;
        let treeGroup, star, staticStars, galaxy;

        let snowParticles, flakeParticles;
        let snowVelocities = [];
        let flakeParticlesArray = [];
        let flakeVelocities = [];

        let raycaster, mouse, interactionPlane;
        const clickEffects = [];

        let innerParticles;
        let risingParticlesData = [];
        let pathPoints = [];

        let currentColor = new THREE.Color(0xffffff);
        let isColorAnimationActive = false;
        let autoColorStarted = false;
        let flashColor = new THREE.Color(0xffffff);
        let waveProgress = {
            value: 0
        };

        let isTreeDrawn = false;
        let forceReset = false;

        let shockwaveEffects = [];
        let fireworks = [];
        let dragPlane = new THREE.Plane();
        let dragOffset = new THREE.Vector3();
        let isDraggingText = false;
        const pageData = (window.dataFromSubdomain && window.dataFromSubdomain.data) || {};
        const boardTitle = (typeof pageData.title === 'string' && pageData.title.trim())
            ? pageData.title.trim()
            : 'Merry Christmas';
        const serverData = {
            messages: (Array.isArray(pageData.messages) ? pageData.messages : [])
                .map((item) => String(item || '').trim())
                .filter(Boolean),
            images: (Array.isArray(pageData.imageUrls) ? pageData.imageUrls : [])
                .filter((url) => typeof url === 'string' && url.trim()),
        };
        if (serverData.messages.length === 0) {
            serverData.messages.push('Giáng sinh an lành');
        }
        const musicUrl = typeof pageData.musicUrl === 'string' ? pageData.musicUrl.trim() : '';
        const backgroundAudio = document.getElementById('bg-audio');
        if (backgroundAudio && musicUrl) {
            backgroundAudio.src = musicUrl;
            backgroundAudio.loop = true;
            backgroundAudio.preload = 'auto';
        }
        const startTitleEl = document.getElementById('start-title');
        if (startTitleEl) startTitleEl.textContent = boardTitle;
        let experienceStarted = false;
        let photoHintShown = false;
        let interactionsBound = false;

        const textMessages = serverData.messages;

        let activeTexts = [];
        let textContainer;

        let caughtTextObject = null;

        // Text mesh 3D variables
        let textMesh, textTexture, textCanvas, textContext;
        let msgIndex = 0;
        let charIndex = 0;
        let isWaiting = false;
        let waitStartTime = 0;
        let lastTypingTime = 0;
        const typingSpeed = 100;
        const messageArray = serverData.messages;
        let mousePos = new THREE.Vector2();

        const imageUrls = serverData.images;

        // Hệ thống hạt bụi (Trail)
        let trailParticlesGeometry;
        let trailParticlesMesh;
        const maxTrailParticles = 1000;
        let trailParticleData = [];
        let trailWriteIndex = 0;

        // BIẾN MỚI CHO LOGIC CLICK VÀ KÉO
        let clickStartTime = 0;
        let initialClientX = 0;
        let initialClientY = 0;
        const CLICK_THRESHOLD_TIME = 200; // ms
        const CLICK_THRESHOLD_MOVE = 5; // pixels
        let wasDragged = false; // Cờ hiệu để kiểm tra xem có phải là thao tác kéo hay không

        function create3DTextBoard() {
            textCanvas = document.createElement('canvas');
            // Tăng resolution gấp đôi để tránh blur trên mobile retina
            textCanvas.width = 2048;
            textCanvas.height = 1024;
            textContext = textCanvas.getContext('2d');

            textTexture = new THREE.CanvasTexture(textCanvas);
            // Mipmaps keep the 2048px board sharp when it is drawn small on screen
            textTexture.generateMipmaps = true;
            textTexture.minFilter = THREE.LinearMipmapLinearFilter;
            textTexture.magFilter = THREE.LinearFilter;
            textTexture.anisotropy = 16; // Tăng chất lượng texture

            const material = new THREE.MeshBasicMaterial({
                map: textTexture,
                transparent: true,
                side: THREE.DoubleSide,
                opacity: 0,
                depthWrite: false,
                blending: THREE.AdditiveBlending
            });

            const geometry = new THREE.PlaneGeometry(30, 15);
            textMesh = new THREE.Mesh(geometry, material);
            const isMobileText = window.innerWidth < 768;
            const textX = isMobileText ? 10 : 25; // Mobile dịch sang trái
            textMesh.position.set(textX, 5, 5);
            textMesh.rotation.y = -0.2;

            scene.add(textMesh);

            gsap.to(material, {
                opacity: 1,
                duration: 0.5,
                delay: 0
            });

            updateTextCanvas("");
        }

        function updateTextCanvas(currentMessage) {
            if (!textContext) return;
            textContext.clearRect(0, 0, textCanvas.width, textCanvas.height);

            // "Merry Christmas" Text - Enhanced Glow (x2 cho canvas gấp đôi)
            textContext.shadowColor = "rgba(255, 107, 107, 0.9)"; // Pink
            textContext.shadowBlur = 24; // tighter glow keeps the letters crisp
            textContext.font = "bold 200px 'Pacifico', cursive"; // x2
            textContext.fillStyle = "#ff6b6b"; // Pink
            textContext.textAlign = "center";
            let titleSize = 200;
            while (textContext.measureText(boardTitle).width > textCanvas.width - 160 && titleSize > 72) {
                titleSize -= 8;
                textContext.font = `bold ${titleSize}px 'Pacifico', cursive`;
            }
            textContext.fillText(boardTitle, textCanvas.width / 2, 300); // x2

            // Typing Content Text (x2 cho canvas gấp đôi)
            textContext.shadowColor = "rgba(0,0,0,0.8)";
            textContext.shadowBlur = 20; // x2
            const fontSize = 90; // x2
            const lineHeight = 130; // x2
            textContext.font = `bold ${fontSize}px "Noto Sans", "Noto Sans JP", "Noto Sans KR", "Noto Sans SC", "Noto Sans TC", sans-serif`;
            textContext.fillStyle = "#ffffff";
            textContext.textAlign = "center";
            const maxWidth = textCanvas.width - 300; // x2
            let startY = 560; // x2
            const paragraphs = currentMessage.split('\n');

            paragraphs.forEach(paragraph => {
                let currentLine = '';
                const words = paragraph.split(' ');

                for (let i = 0; i < words.length; i++) {
                    const testLine = currentLine + words[i] + ' ';
                    const metrics = textContext.measureText(testLine);
                    const testWidth = metrics.width;

                    if (testWidth > maxWidth && i > 0) {
                        textContext.fillText(currentLine.trim(), textCanvas.width / 2, startY);
                        currentLine = words[i] + ' ';
                        startY += lineHeight;
                    } else {
                        currentLine = testLine;
                    }
                }
                textContext.fillText(currentLine.trim(), textCanvas.width / 2, startY);
                startY += lineHeight;
            });
            textTexture.needsUpdate = true;
        }

        function init() {
            textContainer = document.getElementById('text-container');
            // Scene
            scene = new THREE.Scene();
            scene.background = new THREE.Color(0x000000);
            scene.fog = new THREE.FogExp2(0x000000, 0.001);

            // Camera
            camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
            const isMobile = window.innerWidth < 768;
            const cameraDistance = isMobile ? 80 : 60; // Mobile zoom ra xa hơn
            camera.position.set(0, 10, cameraDistance);

            // Renderer
            renderer = new THREE.WebGLRenderer({
                antialias: true,
                powerPreference: "high-performance" // Ưu tiên hiệu năng cao
            });
            renderer.setSize(window.innerWidth, window.innerHeight);
            renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
            renderer.toneMapping = THREE.ReinhardToneMapping;
            document.body.appendChild(renderer.domElement);

            // Controls
            controls = new OrbitControls(camera, renderer.domElement);
            controls.enableDamping = true;
            controls.dampingFactor = 0.05;
            controls.minDistance = 15;
            controls.maxDistance = 100;
            controls.autoRotate = true;
            controls.autoRotateSpeed = 0.3;
            controls.maxPolarAngle = Math.PI / 2 + 0.2;

            // Group for tree elements
            treeGroup = new THREE.Group();
            const isMobileTree = window.innerWidth < 768;
            const treeX = isMobileTree ? -8 : 0; // Mobile dịch cây sang trái
            treeGroup.position.set(treeX, -15, 0); // Canh chỉnh vị trí cây
            scene.add(treeGroup);

            createChristmasTree();
            createInnerSparkles();
            createStar();
            createStarfield();
            createGalaxy();
            document.fonts.ready.then(() => {
                create3DTextBoard();
            });

            // Post-processing for Glow Effect
            const renderScene = new RenderPass(scene, camera);
            const bloomPass = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 1.5, 0.4, 0.85);
            bloomPass.threshold = 0.1;
            bloomPass.strength = 0.7;
            bloomPass.radius = 0.5;

            composer = new EffectComposer(renderer);
            composer.addPass(renderScene);
            composer.addPass(bloomPass);

            createSnowfall();
            animateTreeDrawing();
            initTrails();

            raycaster = new THREE.Raycaster();
            raycaster.params.Points.threshold = 0.2;
            mouse = new THREE.Vector2();

            const planeGeometry = new THREE.PlaneGeometry(500, 500);
            const planeMaterial = new THREE.MeshBasicMaterial({
                visible: false,
                side: THREE.DoubleSide
            });
            interactionPlane = new THREE.Mesh(planeGeometry, planeMaterial);
            interactionPlane.rotation.x = -Math.PI / 2;
            interactionPlane.position.y = -15;
            scene.add(interactionPlane);

            // BỎ ẢNH VÀ CHỮ RƠI XUỐNG
            // const isMobile = window.innerWidth < 768;
            // // Mobile: 1.2 giây rơi 1 cái (nhanh hơn cũ). PC: 0.8 giây.
            // const dropInterval = isMobile ? 1200 : 800;

            // setInterval(() => {
            //     // Kiểm tra giới hạn trước khi sinh
            //     const limit = isMobile ? 8 : 30; // Giảm limit trên mobile để tránh quá tải

            //     if (activeTexts.length < limit) {
            //         // Tỉ lệ: 60% rơi Ảnh, 40% rơi Chữ (Vì ảnh đẹp hơn)
            //         if (imageUrls.length > 0 && Math.random() > 0.4) {
            //             createImageEffect(null, true);
            //         } else {
            //             if (textMessages.length > 0) createTextEffect(true);
            //         }
            //     }
            // }, dropInterval);

            window.addEventListener('resize', onWindowResize, false);

            // Gắn sự kiện đóng modal
            document.getElementById('image-modal').addEventListener('click', closeImageModal);
            document.getElementById('modal-image').addEventListener('click', (e) => e.stopPropagation()); // Ngăn click vào ảnh đóng modal
            document.getElementById('modal-close-btn').addEventListener('click', closeImageModal); // Nút X đóng modal
        }

        function initTrails() {
            const positions = new Float32Array(maxTrailParticles * 3);
            const colors = new Float32Array(maxTrailParticles * 3);
            const sizes = new Float32Array(maxTrailParticles);
            trailParticlesGeometry = new THREE.BufferGeometry();
            trailParticlesGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
            trailParticlesGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
            trailParticlesGeometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
            for (let i = 0; i < maxTrailParticles; i++) {
                trailParticleData.push({
                    life: 0,
                    velocity: new THREE.Vector3()
                });
                positions[i * 3 + 1] = -1000;
            }

            const material = new THREE.PointsMaterial({
                size: 0.3,
                vertexColors: true,
                blending: THREE.AdditiveBlending,
                transparent: true,
                depthWrite: false,
                map: createDotTexture()
            });

            trailParticlesMesh = new THREE.Points(trailParticlesGeometry, material);
            scene.add(trailParticlesMesh);
        }

        function createImageEffect(targetUrl = null, isAmbient = false) {
            if (!targetUrl && imageUrls.length === 0) return;
            // --- TỐI ƯU SỐ LƯỢNG ITEM ---
            const isMobile = window.innerWidth < 768;
            // Mobile: 8 item, PC: 30 item (Tăng lên để đỡ trống)
            const MAX_ITEMS = isMobile ? 8 : 30;

            if (activeTexts.length >= MAX_ITEMS) {
                // Xóa phần tử cũ nhất để nhường chỗ
                const oldItem = activeTexts.shift();
                if (oldItem && oldItem.element.parentNode) {
                    oldItem.element.parentNode.removeChild(oldItem.element);
                }
            }
            const imgUrl = targetUrl || imageUrls[Math.floor(Math.random() * imageUrls.length)];
            const imgElement = document.createElement('img');
            imgElement.src = imgUrl;
            imgElement.className = 'floating-image';
            imgElement.draggable = false;
            imgElement.id = 'img-' + Date.now() + Math.random();
            imgElement.style.transform = 'translate(-50%, -50%) scale(0)';
            imgElement.style.opacity = '0';
            textContainer.appendChild(imgElement);
            setTimeout(() => {
                imgElement.style.transition = 'transform 0.4s, opacity 0.3s';
                imgElement.style.transform = 'translate(-50%, -50%) scale(1)';
                imgElement.style.opacity = '1';
            }, 50);

            imgElement.addEventListener('mousedown', onTextCatch, false);
            imgElement.addEventListener('touchstart', onTextCatch, {
                passive: false
            });

            const startPosition = new THREE.Vector3();
            let velocity = new THREE.Vector3();
            if (isAmbient) {
                startPosition.x = (Math.random() - 0.5) * 80;
                startPosition.y = 45;
                startPosition.z = (Math.random() - 0.5) * 30;
                velocity.set(
                    (Math.random() - 0.5) * 0.01,
                    -0.03 - Math.random() * 0.03,
                    (Math.random() - 0.5) * 0.01
                );
            } else {
                star.getWorldPosition(startPosition);
                const angle = Math.random() * Math.PI * 2;
                const horizontalSpeed = 0.08 + Math.random() * 0.15;
                const upwardSpeed = 0.4 + Math.random() * 0.3;

                velocity.set(
                    Math.cos(angle) * horizontalSpeed,
                    upwardSpeed,
                    Math.sin(angle) * horizontalSpeed
                );
            }

            activeTexts.push({
                type: 'image',
                element: imgElement,
                position: startPosition,
                velocity: velocity,
                isCaught: false,
                swayX: (Math.random() - 0.5) * 0.05,
                swayZ: (Math.random() - 0.5) * 0.05,
                swayFreq: Math.random() * 0.5 + 0.5,
                timeOffset: Math.random() * 100
            });
            showPhotoHint();
        }

        function showPhotoHint() {
            if (photoHintShown) return;
            photoHintShown = true;
            const treeHint = document.getElementById('tree-hint');
            if (treeHint) treeHint.classList.add('is-hide');
            const hint = document.getElementById('photo-hint');
            if (!hint) return;
            hint.hidden = false;
            window.setTimeout(() => hint.classList.add('is-hide'), 5200);
        }

        function triggerSmartBurst() {
            let queue = [...imageUrls].sort(() => 0.5 - Math.random());
            const BATCH_SIZE = 3;
            const WAVE_DELAY = 300;
            let waveCount = 0;
            while (queue.length > 0) {
                const batch = queue.splice(0, BATCH_SIZE);
                setTimeout(() => {
                    batch.forEach(url => {
                        createImageEffect(url);
                    });
                }, waveCount * WAVE_DELAY);

                waveCount++;
            }
        }

        function emitTrail(position) {
            for (let i = 0; i < 2; i++) {
                const idx = trailWriteIndex;
                const positions = trailParticlesMesh.geometry.attributes.position.array;
                const colors = trailParticlesMesh.geometry.attributes.color.array;
                positions[idx * 3] = position.x + (Math.random() - 0.5) * 0.5;
                positions[idx * 3 + 1] = position.y + (Math.random() - 0.5) * 0.5;
                positions[idx * 3 + 2] = position.z + (Math.random() - 0.5) * 0.5;
                const color = Math.random() > 0.5 ? new THREE.Color(0xffd700) : new THREE.Color(0xffffff);
                colors[idx * 3] = color.r;
                colors[idx * 3 + 1] = color.g;
                colors[idx * 3 + 2] = color.b;
                trailParticleData[idx].life = 1.0;
                trailParticleData[idx].velocity.set(
                    (Math.random() - 0.5) * 0.02,
                    Math.random() * 0.02,
                    (Math.random() - 0.5) * 0.02
                );
                trailWriteIndex++;
                if (trailWriteIndex >= maxTrailParticles) trailWriteIndex = 0;
            }
        }

        // CẬP NHẬT onTextCatch
        function onTextCatch(event) {
            event.preventDefault(); // Ngăn hành vi kéo mặc định của trình duyệt
            event.stopPropagation(); // Ngăn sự kiện lan truyền để tránh ảnh hưởng đến các listener khác

            const caughtId = event.currentTarget.id;
            const textObj = activeTexts.find(t => t.element.id === caughtId);

            if (textObj) {
                caughtTextObject = textObj;
                caughtTextObject.isCaught = true;
                isDraggingText = true; // Cờ hiệu tổng thể cho trạng thái kéo
                wasDragged = false; // Reset cờ kéo cho mỗi tương tác

                textObj.element.style.cursor = 'grabbing';
                textObj.element.style.transform = 'translate(-50%, -50%) scale(1.15)';
                if (textObj.type === 'text') {
                    textObj.element.style.textShadow = '0 0 16px rgba(255, 215, 0, 1)';
                } else { // Ảnh
                    textObj.element.style.boxShadow = '0 0 15px rgba(255, 215, 0, 0.7)'; // Thêm hiệu ứng phát sáng cho ảnh
                }
                textObj.element.style.zIndex = 1000; // Đưa lên trên cùng

                updateMouseCoords(event); // Cập nhật mouse.x, mouse.y
                initialClientX = event.touches?.[0]?.clientX || event.clientX;
                initialClientY = event.touches?.[0]?.clientY || event.clientY;
                clickStartTime = Date.now();

                raycaster.setFromCamera(mouse, camera);
                dragPlane.setFromNormalAndCoplanarPoint(camera.getWorldDirection(dragPlane.normal), textObj.position);
                const intersectPoint = new THREE.Vector3();
                raycaster.ray.intersectPlane(dragPlane, intersectPoint);
                if (intersectPoint) {
                    dragOffset.subVectors(textObj.position, intersectPoint);
                }
            }
        }

        // CẬP NHẬT onMouseMove
        function onMouseMove(event) {
            if (isDraggingText && caughtTextObject) {
                event.preventDefault(); // Ngăn cuộn trên di động trong khi kéo
                updateMouseCoords(event);

                // Kiểm tra chuyển động kéo thực tế
                const currentClientX = event.touches?.[0]?.clientX || event.clientX;
                const currentClientY = event.touches?.[0]?.clientY || event.clientY;
                const deltaX = Math.abs(currentClientX - initialClientX);
                const deltaY = Math.abs(currentClientY - initialClientY);

                if (deltaX > CLICK_THRESHOLD_MOVE || deltaY > CLICK_THRESHOLD_MOVE) {
                    wasDragged = true;
                }
            }
        }

        // CẬP NHẬT onTextRelease
        function onTextRelease(event) {
            if (caughtTextObject) {
                caughtTextObject.velocity.set(0, 0, 0);
                caughtTextObject.isCaught = false;
                caughtTextObject.element.style.cursor = 'grab';
                caughtTextObject.element.style.transform = 'translate(-50%, -50%) scale(1.0)';
                caughtTextObject.element.style.zIndex = 10; // Đặt lại z-index

                if (caughtTextObject.type === 'text') {
                    caughtTextObject.element.style.textShadow = '0 0 8px rgba(255, 255, 255, 0.8)';
                } else {
                    caughtTextObject.element.style.boxShadow = 'none'; // Xóa hiệu ứng phát sáng ảnh
                }

                // Kiểm tra xem đó có phải là một click (không phải kéo và thời gian ngắn)
                const duration = Date.now() - clickStartTime;
                if (!wasDragged && duration < CLICK_THRESHOLD_TIME && caughtTextObject.type === 'image') {
                    // Đây là một click vào ảnh, mở modal
                    openImageModal(caughtTextObject.element.src);
                }

                caughtTextObject = null;
                isDraggingText = false;
                wasDragged = false; // Reset cho lần tương tác tiếp theo
            }
        }

        // Hàm mở modal ảnh
        function openImageModal(imageUrl) {
            const modal = document.getElementById('image-modal');
            const modalImage = document.getElementById('modal-image');
            modalImage.src = imageUrl;
            modal.classList.add('active');
            const hint = document.getElementById('photo-hint');
            if (hint) hint.classList.add('is-hide');
        }

        // Hàm đóng modal ảnh
        function closeImageModal() {
            const modal = document.getElementById('image-modal');
            modal.classList.remove('active');
            modalImage.src = ""; // Clear image src
        }

        function updateMouseCoords(event) {
            let clientX, clientY;
            if (event.touches && event.touches.length > 0) {
                clientX = event.touches[0].clientX;
                clientY = event.touches[0].clientY;
            } else if (event.changedTouches && event.changedTouches.length > 0) {
                clientX = event.changedTouches[0].clientX;
                clientY = event.changedTouches[0].clientY;
            } else {
                clientX = event.clientX;
                clientY = event.clientY;
            }
            if (clientX !== undefined && clientY !== undefined) {
                mouse.x = (clientX / window.innerWidth) * 2 - 1;
                mouse.y = -(clientY / window.innerHeight) * 2 + 1;
            }
        }

        function createTextEffect(isAmbient = false) {
            // --- TỐI ƯU SỐ LƯỢNG ITEM ---
            const isMobile = window.innerWidth < 768;
            // Mobile: 8 item, PC: 30 item (Tăng lên để đỡ trống)
            const MAX_ITEMS = isMobile ? 8 : 30;

            if (activeTexts.length >= MAX_ITEMS) {
                // Xóa phần tử cũ nhất để nhường chỗ
                const oldItem = activeTexts.shift();
                if (oldItem && oldItem.element.parentNode) {
                    oldItem.element.parentNode.removeChild(oldItem.element);
                }
            }
            let message = textMessages[0];
            if (textMessages.length > 0) {
                message = textMessages[Math.floor(Math.random() * textMessages.length)];
            }
            const textElement = document.createElement('div');
            const uniqueId = 'text-' + Date.now() + Math.random();
            textElement.id = uniqueId;
            textElement.className = 'floating-text';
            textElement.innerText = message;
            textElement.style.transform = '';
            textElement.style.opacity = '0';
            textContainer.appendChild(textElement);
            setTimeout(() => {
                textElement.style.transition = 'transform 0.4s, opacity 0.3s';
                textElement.style.transform = 'translate(-50%, -50%) scale(1)';
                textElement.style.opacity = '1';
            }, 50);

            textElement.addEventListener('mousedown', onTextCatch, false);
            textElement.addEventListener('touchstart', onTextCatch, {
                passive: false
            });
            const startPosition = new THREE.Vector3();
            let velocity = new THREE.Vector3();

            if (isAmbient) {
                startPosition.x = (Math.random() - 0.5) * 60;
                startPosition.y = 40;
                startPosition.z = (Math.random() - 0.5) * 20;
                velocity.set(
                    (Math.random() - 0.5) * 0.02,
                    -0.05 - Math.random() * 0.05,
                    (Math.random() - 0.5) * 0.02
                );
            } else {
                star.getWorldPosition(startPosition);
                const angle = Math.random() * Math.PI * 2;
                const horizontalSpeed = 0.1 + Math.random() * 0.1;
                const upwardSpeed = 0.4 + Math.random() * 0.2;
                velocity.set(
                    Math.cos(angle) * horizontalSpeed,
                    upwardSpeed,
                    Math.sin(angle) * horizontalSpeed
                );
            }

            activeTexts.push({
                type: 'text',
                element: textElement,
                position: startPosition,
                velocity: velocity,
                isCaught: false,
                swayX: (Math.random() - 0.5) * 0.05,
                swayZ: (Math.random() - 0.5) * 0.05,
                swayFreq: Math.random() * 0.5 + 0.5,
                timeOffset: Math.random() * 100
            });
        }


        function onInteractionStart(event) {
            // Chỉ preventDefault nếu sự kiện không phải là bắt đầu kéo trên một floating-item.
            // Nếu là click vào nền, thì vẫn chạy hiệu ứng.
            if (!event.target.classList.contains('floating-text') && !event.target.classList.contains('floating-image')) {
                 event.preventDefault();
            }


            let clientX, clientY;
            if (event.changedTouches) {
                clientX = event.changedTouches[0].clientX;
                clientY = event.changedTouches[0].clientY;
            } else {
                clientX = event.clientX;
                clientY = event.clientY;
            }

            mouse.x = (clientX / window.innerWidth) * 2 - 1;
            mouse.y = -(clientY / window.innerHeight) * 2 + 1;

            raycaster.setFromCamera(mouse, camera);

            const intersectsPlane = raycaster.intersectObject(interactionPlane);
            if (intersectsPlane.length > 0) {
                createSparkleEffect(intersectsPlane[0].point);
            }

            const particleTree = treeGroup.children[0];
            const intersectsTree = raycaster.intersectObject(particleTree);

            if (intersectsTree.length > 0 && isTreeDrawn) {
                if (imageUrls.length > 0 && Math.random() > 0.4) {
                    triggerSmartBurst();
                } else if (textMessages.length > 0) {
                    createTextEffect();
                }
            }

        }

        function playColorWave() {
            if (!isTreeDrawn || !experienceStarted || isColorAnimationActive) return;
            isColorAnimationActive = true;
            const randomHue = 0.25 + Math.random() * 0.75;
            flashColor.setHSL(randomHue, 1, 0.6);
            waveProgress.value = 0;
            const waveDuration = 2.5;
            const starToYellowDuration = 1.2;
            const tl = gsap.timeline({
                onComplete: () => {
                    createStarShockwave();
                    gsap.to(star.material.color, {
                        r: 1.0,
                        g: 0.42,
                        b: 0.42,
                        duration: 3.0,
                        ease: "power2.out"
                    });
                    gsap.to(star.material.emissive, {
                        r: 1.0,
                        g: 0.42,
                        b: 0.42,
                        duration: 3.0,
                        ease: "power2.out"
                    });
                    const colorProxy = {
                        r: flashColor.r,
                        g: flashColor.g,
                        b: flashColor.b
                    };
                    gsap.to(colorProxy, {
                        r: 1.0,
                        g: 0.42,
                        b: 0.42,
                        duration: 4.0,
                        ease: "power2.out",
                        onUpdate: () => {
                            flashColor.setRGB(colorProxy.r, colorProxy.g, colorProxy.b);
                        },
                        onComplete: () => {
                            isColorAnimationActive = false;
                            forceReset = true;
                            scheduleColorWave();
                        }
                    });
                }
            });
            tl.to(waveProgress, {
                value: 1,
                duration: waveDuration,
                ease: "power2.inOut"
            });
            const starStartTime = waveDuration - starToYellowDuration;
            const yellowColor = new THREE.Color(0xffd700);
            tl.to(star.material.color, {
                r: yellowColor.r,
                g: yellowColor.g,
                b: yellowColor.b,
                duration: starToYellowDuration,
                ease: "power2.inOut"
            }, starStartTime);
            tl.to(star.material.emissive, {
                r: yellowColor.r,
                g: yellowColor.g,
                b: yellowColor.b,
                duration: starToYellowDuration,
                ease: "power2.inOut"
            }, starStartTime);
        }

        function scheduleColorWave() {
            window.setTimeout(playColorWave, 2200);
        }

        function startAutoColor() {
            if (autoColorStarted || !experienceStarted || !isTreeDrawn) return;
            autoColorStarted = true;
            scheduleColorWave();
        }

        function createStarShockwave() {
            const particleCount = 400;
            const vertices = [];
            const particleData = [];
            const shockwaveColor = new THREE.Color(0xffffff);
            for (let i = 0; i < particleCount; i++) {
                vertices.push(0, 0, 0);
                const theta = Math.random() * Math.PI * 2;
                const phi = Math.acos((Math.random() * 2) - 1);
                const direction = new THREE.Vector3(
                    Math.sin(phi) * Math.cos(theta),
                    Math.sin(phi) * Math.sin(theta),
                    Math.cos(phi)
                );
                particleData.push({
                    direction: direction,
                    speed: Math.random() * 0.04 + 0.02
                });
            }

            const geometry = new THREE.BufferGeometry();
            geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
            const dotTexture = createDotTexture();
            const material = new THREE.PointsMaterial({
                color: shockwaveColor,
                size: 0.25,
                map: dotTexture,
                blending: THREE.AdditiveBlending,
                transparent: true,
                depthWrite: false
            });
            const shockwave = new THREE.Points(geometry, material);
            shockwave.position.copy(star.position);
            shockwave.userData = {
                particles: particleData,
                life: 1.0,
                decay: 0.0004 // Loang thật xa
            };
            treeGroup.add(shockwave);
            shockwaveEffects.push(shockwave);
        }

        function createSparkleEffect(position) {
            const sparkleCount = 80;
            const vertices = [];
            const velocities = [];
            const colors = [];
            const sparkleColor = new THREE.Color();
            const colorChoices = [0xffd700, 0xffffff, 0x87ceeb];
            for (let i = 0; i < sparkleCount; i++) {
                vertices.push(0, 0, 0);
                const theta = Math.random() * Math.PI * 2;
                const phi = Math.acos((Math.random() * 2) - 1);
                const speed = Math.random() * 0.3 + 0.1;
                const velocity = new THREE.Vector3(
                    speed * Math.sin(phi) * Math.cos(theta),
                    speed * Math.sin(phi) * Math.sin(theta),
                    speed * Math.cos(phi)
                );
                velocities.push(velocity);
                sparkleColor.setHex(colorChoices[Math.floor(Math.random() * colorChoices.length)]);
                colors.push(sparkleColor.r, sparkleColor.g, sparkleColor.b);
            }

            const geometry = new THREE.BufferGeometry();
            geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
            geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));

            const material = new THREE.PointsMaterial({
                size: 0.25,
                vertexColors: true,
                blending: THREE.AdditiveBlending,
                transparent: true,
                depthWrite: false,
            });
            const sparkles = new THREE.Points(geometry, material);
            sparkles.position.copy(position);
            sparkles.userData = {
                velocities: velocities,
                life: 1.0,
                decay: 0.01
            };

            scene.add(sparkles);
            clickEffects.push(sparkles);
        }

        function createInnerSparkles() {
            const particleCount = 100;
            const vertices = [];
            risingParticlesData = [];

            for (let i = 0; i < particleCount; i++) {
                vertices.push(0, 0, 0);
                risingParticlesData.push({
                    progress: Math.random(),
                    speed: Math.random() * 0.0015 + 0.0005,
                    angle: Math.random() * Math.PI * 2,
                    radius: Math.random() * 1.5 + 0.5
                });
            }

            const geometry = new THREE.BufferGeometry();
            geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));

            const material = new THREE.PointsMaterial({
                color: 0xffd700,
                size: 0.15,
                blending: THREE.AdditiveBlending,
                transparent: true,
                depthWrite: false,
                opacity: 0.8
            });

            innerParticles = new THREE.Points(geometry, material);
            innerParticles.visible = false;
            treeGroup.add(innerParticles);
        }

        function createDotTexture() {
            const canvas = document.createElement('canvas');
            canvas.width = 64;
            canvas.height = 64;
            const context = canvas.getContext('2d');
            const gradient = context.createRadialGradient(
                canvas.width / 2, canvas.height / 2, 0,
                canvas.width / 2, canvas.height / 2, canvas.width / 2
            );
            gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
            gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
            context.fillStyle = gradient;
            context.fillRect(0, 0, canvas.width, canvas.height);
            return new THREE.CanvasTexture(canvas);
        }

        function createChristmasTree() {
            pathPoints = [];
            const height = 30;
            const loops = 12;
            const radiusStep = 1.0;
            const pathResolution = 3500;

            for (let i = 0; i <= pathResolution; i++) {
                const progress = i / pathResolution;
                const angle = progress * Math.PI * 2 * loops;
                const y = progress * height;
                const radius = (1 - progress) * radiusStep * loops;
                const x = Math.cos(angle) * radius;
                const z = Math.sin(angle) * radius;
                pathPoints.push(new THREE.Vector3(x, y, z));
            }
            const treeParticlesPoints = [];
            const particlesPerPoint = 100;
            const clusterWidth = 1.2;
            const originalPositions = [];
            const directionVectors = [];
            const colors = [];
            const whiteColor = new THREE.Color(0xff6b6b);

            pathPoints.forEach(point => {
                for (let i = 0; i < particlesPerPoint; i++) {
                    const offsetX = (Math.random() - 0.5) * clusterWidth;
                    const offsetY = (Math.random() - 0.5) * clusterWidth;
                    const offsetZ = (Math.random() - 0.5) * clusterWidth;

                    const particlePosition = new THREE.Vector3(
                        point.x + offsetX,
                        point.y + offsetY,
                        point.z + offsetZ
                    );
                    treeParticlesPoints.push(particlePosition);
                    originalPositions.push(particlePosition.x, particlePosition.y, particlePosition.z);
                    const direction = new THREE.Vector3(offsetX, offsetY, offsetZ).normalize();
                    directionVectors.push(direction.x, direction.y, direction.z);
                    colors.push(whiteColor.r, whiteColor.g, whiteColor.b);
                }
            });
            const treeGeometry = new THREE.BufferGeometry().setFromPoints(treeParticlesPoints);
            treeGeometry.setAttribute('originalPosition', new THREE.Float32BufferAttribute(originalPositions, 3));
            treeGeometry.setAttribute('directionVector', new THREE.Float32BufferAttribute(directionVectors, 3));
            treeGeometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
            const dotTexture = createDotTexture();
            const treeMaterial = new THREE.PointsMaterial({
                size: 0.1,
                map: dotTexture,
                blending: THREE.AdditiveBlending,
                transparent: true,
                opacity: 0.7,
                depthWrite: false,
                vertexColors: true
            });
            if (treeGroup.children[0]) {
                treeGroup.remove(treeGroup.children[0]);
            }

            const particleTree = new THREE.Points(treeGeometry, treeMaterial);
            treeGroup.add(particleTree);
        }


        function createStar() {
            const geometry = new THREE.BufferGeometry();

            const outerRadius = 2.0;
            const innerRadius = 0.8;
            const thickness = 0.8;
            const numPoints = 5;

            const vertices = [];
            vertices.push(0, 0, thickness);
            for (let i = 0; i < numPoints * 2; i++) {
                const radius = (i % 2 === 0) ? outerRadius : innerRadius;
                const angle = (i * Math.PI) / numPoints;
                const x = Math.sin(angle) * radius;
                const y = Math.cos(angle) * radius;
                vertices.push(x, y, 0);
            }
            vertices.push(0, 0, -thickness);
            const backCenterIndex = 11;

            const indices = [];
            for (let i = 1; i <= numPoints * 2; i++) {
                indices.push(0, i, (i === numPoints * 2) ? 1 : i + 1);
            }
            for (let i = 1; i <= numPoints * 2; i++) {
                indices.push(backCenterIndex, (i === numPoints * 2) ? 1 : i + 1, i);
            }

            geometry.setIndex(indices);
            geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
            geometry.computeVertexNormals();
            const material = new THREE.MeshStandardMaterial({
                color: 0xff6b6b,
                metalness: 0.3,
                roughness: 0.5,
                emissive: 0xff6b6b,
                emissiveIntensity: 1.5
            });
            star = new THREE.Mesh(geometry, material);
            star.position.y = 31;
            star.scale.set(0, 0, 0);
            treeGroup.add(star);
            const starLight = new THREE.PointLight(0xff6b6b, 3, 100);
            star.add(starLight);
        }

        function createStarfield() {
            const vertices = [];
            for (let i = 0; i < 10000; i++) {
                const x = (Math.random() - 0.5) * 2000;
                const y = (Math.random() - 0.5) * 2000;
                const z = (Math.random() - 0.5) * 2000;
                vertices.push(x, y, z);
            }
            const geometry = new THREE.BufferGeometry();
            geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
            const material = new THREE.PointsMaterial({
                color: 0xffffff,
                size: 0.5,
                transparent: true,
                opacity: 0.5
            });
            staticStars = new THREE.Points(geometry, material);
            scene.add(staticStars);
        }

        function createSnowfall() {
            const isMobile = window.innerWidth < 768;
            const snowCount = isMobile ? 8000 : 10000;
            const snowVertices = [];
            snowVelocities = [];

            for (let i = 0; i < snowCount; i++) {
                const x = (Math.random() - 0.5) * 200;
                const y = Math.random() * 200 - 50;
                const z = (Math.random() - 0.5) * 200;
                snowVertices.push(x, y, z);
                snowVelocities.push({
                    y: Math.random() * 0.02 + 0.01,
                    swayX: (Math.random() - 0.5) * 0.1,
                    swayZ: (Math.random() - 0.5) * 0.1,
                    freq: Math.random() * 0.5 + 0.2
                });
            }
            const snowGeometry = new THREE.BufferGeometry();
            snowGeometry.setAttribute('position', new THREE.Float32BufferAttribute(snowVertices, 3));
            const snowMaterial = new THREE.PointsMaterial({
                color: 0xffffff,
                size: 0.1,
                transparent: true,
                opacity: 0.7,
                blending: THREE.AdditiveBlending,
                depthWrite: false
            });
            snowParticles = new THREE.Points(snowGeometry, snowMaterial);
            scene.add(snowParticles);
            // Enhanced Flake Particles với màu sắc và hiệu ứng đẹp
            const totalFlakeCount = isMobile ? 300 : 500;
            const textureLoader = new THREE.TextureLoader();
            flakeParticlesArray = [];
            flakeVelocities = [];

            for (let i = 1; i <= 11; i++) {
                const texturePath = `/templates/lovechristmas/snowflakes/${i}.png`;
                const texture = textureLoader.load(texturePath,
                    undefined,
                    undefined,
                    (err) => {
                        console.error('Error loading snowflake texture:', texturePath, err);
                    }
                );

                const flakesForThisType = Math.floor(totalFlakeCount / 11);
                const flakeVertices = [];
                const flakeColors = []; // Thêm màu sắc cho từng snowflake

                for (let j = 0; j < flakesForThisType; j++) {
                    const x = (Math.random() - 0.5) * 200;
                    const y = Math.random() * 200 - 50;
                    const z = (Math.random() - 0.5) * 200;
                    flakeVertices.push(x, y, z);

                    // Tạo màu sắc nhẹ nhàng cho snowflake (trắng/bạc/hồng pastel)
                    const color = new THREE.Color(0xffffff);
                    const rand = Math.random();
                    if (rand > 0.85) {
                        // 15% snowflakes có màu hồng pastel nhẹ
                        color.setHSL(0.9, 0.3, 0.95); // Pink pastel
                    } else {
                        // 85% còn lại là trắng/bạc
                        color.setHSL(0, 0, 0.85 + Math.random() * 0.15);
                    }
                    flakeColors.push(color.r, color.g, color.b);

                    flakeVelocities.push({
                        y: Math.random() * 0.015 + 0.01,
                        swayX: (Math.random() - 0.5) * 0.15,
                        swayZ: (Math.random() - 0.5) * 0.15,
                        freq: Math.random() * 0.4 + 0.1
                    });
                }

                const flakeGeometry = new THREE.BufferGeometry();
                flakeGeometry.setAttribute('position', new THREE.Float32BufferAttribute(flakeVertices, 3));
                flakeGeometry.setAttribute('color', new THREE.Float32BufferAttribute(flakeColors, 3)); // Add color attribute

                const flakeMaterial = new THREE.PointsMaterial({
                    size: 2.0,
                    map: texture,
                    vertexColors: true, // Enable vertex colors
                    blending: THREE.AdditiveBlending,
                    depthWrite: false,
                    transparent: true,
                    opacity: 0.8
                });

                const flakes = new THREE.Points(flakeGeometry, flakeMaterial);
                flakeParticlesArray.push(flakes);
                scene.add(flakes);
            }
        }

        function createGalaxy() {
            const isMobile = window.innerWidth < 768;
            const particleCount = isMobile ? 15000 : 40000;
            const vertices = [];
            const maxRadius = 80;
            const spin = 1;
            for (let i = 0; i < particleCount; i++) {
                const r = Math.pow(Math.random(), 1.5) * maxRadius;
                const angle = Math.random() * Math.PI * 2;
                const spinAngle = r * spin * 0.05;
                const x = Math.cos(angle + spinAngle) * r;
                const y = (Math.random() - 0.5) * 1.5;
                const z = Math.sin(angle + spinAngle) * r;
                vertices.push(x, y, z);
            }

            const geometry = new THREE.BufferGeometry();
            geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
            const material = new THREE.PointsMaterial({
                color: 0xffffff,
                size: 0.1,
                sizeAttenuation: true,
                transparent: true,
                opacity: 0.4,
                blending: THREE.AdditiveBlending,
                depthWrite: false
            });

            galaxy = new THREE.Points(geometry, material);
            galaxy.position.y = -15;
            scene.add(galaxy);
        }

        function animateTreeDrawing() {
            const treeGeometry = treeGroup.children[0].geometry;
            treeGeometry.setDrawRange(0, 0);
            const duration = 6;
            gsap.to(treeGeometry.drawRange, {
                count: treeGeometry.attributes.position.count,
                duration: duration,
                ease: "power1.inOut",
                onComplete: () => {
                    if (innerParticles) {
                        innerParticles.visible = true;
                    }
                    isTreeDrawn = true;
                    startAutoColor();
                }
            });

            gsap.to(star.scale, {
                x: 1.3,
                y: 1.3,
                z: 1.3,
                duration: 1.5,
                ease: "elastic.out(1, 0.5)",
                delay: duration - 0.5
            });
        }

        class Firework {
            constructor() {
                this.isDead = false;
                const treeX = treeGroup.position.x;
                const treeY = treeGroup.position.y;
                const treeZ = treeGroup.position.z;
                const startX = treeX + (Math.random() - 0.5) * 25;
                const startY = treeY + 30 + Math.random() * 25;
                const startZ = treeZ + (Math.random() - 0.5) * 10;

                this.createExplosion(new THREE.Vector3(startX, startY, startZ));
            }

            createExplosion(position) {
                const particleCount = 100;
                const geometry = new THREE.BufferGeometry();
                const positions = [];
                const velocities = [];

                for (let i = 0; i < particleCount; i++) {
                    positions.push(position.x, position.y, position.z);
                    positions.push(position.x, position.y, position.z);

                    const theta = Math.random() * Math.PI * 2;
                    const phi = Math.acos((Math.random() * 2) - 1);

                    const speed = 0.15 + Math.random() * 0.25;

                    const vx = Math.sin(phi) * Math.cos(theta) * speed;
                    const vy = Math.sin(phi) * Math.sin(theta) * speed;
                    const vz = Math.cos(phi) * speed;

                    velocities.push({
                        x: vx,
                        y: vy,
                        z: vz
                    });
                }

                geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));

                const material = new THREE.LineBasicMaterial({
                    color: 0xffffff,
                    transparent: true,
                    opacity: 1.0,
                    blending: THREE.AdditiveBlending
                });

                this.mesh = new THREE.LineSegments(geometry, material);
                this.mesh.userData = {
                    velocities: velocities,
                    life: 1.0,
                    drag: 0.96
                };
                scene.add(this.mesh);
            }

            update() {
                if (this.isDead) return;

                const positions = this.mesh.geometry.attributes.position.array;
                const velocities = this.mesh.userData.velocities;

                const gravity = -0.006;
                const drag = this.mesh.userData.drag;

                this.mesh.userData.life -= 0.008;
                this.mesh.material.opacity = this.mesh.userData.life;

                for (let i = 0; i < velocities.length; i++) {
                    velocities[i].x *= drag;
                    velocities[i].y *= drag;
                    velocities[i].z *= drag;
                    velocities[i].y += gravity;

                    const headIdx = i * 6;
                    const tailIdx = i * 6 + 3;

                    positions[tailIdx] += (positions[headIdx] - positions[tailIdx]) * 0.15;
                    positions[tailIdx + 1] += (positions[headIdx + 1] - positions[tailIdx + 1]) * 0.15;
                    positions[tailIdx + 2] += (positions[headIdx + 2] - positions[tailIdx + 2]) * 0.15;

                    positions[headIdx] += velocities[i].x;
                    positions[headIdx + 1] += velocities[i].y;
                    positions[headIdx + 2] += velocities[i].z;
                }

                this.mesh.geometry.attributes.position.needsUpdate = true;

                if (this.mesh.userData.life <= 0) {
                    this.isDead = true;
                    scene.remove(this.mesh);
                    this.mesh.geometry.dispose();
                    this.mesh.material.dispose();
                }
            }
        }

        function onWindowResize() {
            const isMobile = window.innerWidth < 768;
            const cameraDistance = isMobile ? 80 : 60;
            camera.position.z = cameraDistance; // Điều chỉnh zoom khi resize

            // Điều chỉnh vị trí cây và chữ theo mobile/desktop
            const treeX = isMobile ? -8 : 0;
            const textX = isMobile ? 10 : 25;
            if (treeGroup) treeGroup.position.x = treeX;
            if (textMesh) textMesh.position.x = textX;

            camera.aspect = window.innerWidth / window.innerHeight;
            camera.updateProjectionMatrix();
            renderer.setSize(window.innerWidth, window.innerHeight);
            composer.setSize(window.innerWidth, window.innerHeight);
        }

        function animate() {
            requestAnimationFrame(animate);

            // Typing animation for text mesh
            if (isTreeDrawn && textMesh) {
                const now = Date.now();
                const currentFullText = messageArray[msgIndex];
                if (!isWaiting) {
                    if (now - lastTypingTime > typingSpeed) {
                        charIndex++;
                        const currentStr = currentFullText.substring(0, charIndex);
                        const cursor = (Math.floor(now / 500) % 2 === 0 ? "|" : "");
                        updateTextCanvas(currentStr + cursor);

                        lastTypingTime = now;
                        if (charIndex > currentFullText.length) {
                            isWaiting = true;
                            waitStartTime = now;
                            // Hiện 1 ảnh ngẫu nhiên khi chữ viết xong
                            if (imageUrls.length > 0) {
                                createImageEffect();
                            }
                        }
                    }
                }
                else {
                    const cursor = (Math.floor(now / 500) % 2 === 0 ? "|" : "");
                    updateTextCanvas(currentFullText + cursor);
                    if (now - waitStartTime > 2500) {
                        isWaiting = false;
                        charIndex = 0;
                        msgIndex = (msgIndex + 1) % messageArray.length;
                        updateTextCanvas("");
                    }
                }
            }

            if (snowParticles && flakeParticlesArray.length > 0) {
                const time = Date.now() * 0.0005;

                const snowPositions = snowParticles.geometry.attributes.position.array;
                for (let i = 0; i < snowPositions.length; i += 3) {
                    const vel = snowVelocities[i / 3];
                    snowPositions[i + 1] -= vel.y;
                    snowPositions[i] += Math.sin(time * vel.freq + i) * vel.swayX;
                    snowPositions[i + 2] += Math.cos(time * vel.freq + i) * vel.swayZ;
                    if (snowPositions[i + 1] < -60) snowPositions[i + 1] = 100;
                }
                snowParticles.geometry.attributes.position.needsUpdate = true;

                let flakeVelocityIndex = 0;
                flakeParticlesArray.forEach(flakes => {
                    const flakePositions = flakes.geometry.attributes.position.array;
                    for (let i = 0; i < flakePositions.length; i += 3) {
                        const vel = flakeVelocities[flakeVelocityIndex];
                        flakePositions[i + 1] -= vel.y;
                        flakePositions[i] += Math.sin(time * vel.freq + i) * vel.swayX;
                        flakePositions[i + 2] += Math.cos(time * vel.freq + i) * vel.swayZ;
                        if (flakePositions[i + 1] < -60) flakePositions[i + 1] = 100;
                        flakeVelocityIndex++;
                    }
                    flakes.geometry.attributes.position.needsUpdate = true;
                    flakes.rotation.y += 0.001; // Subtle rotation for individual flakes
                });
            }

            if (galaxy) galaxy.rotation.y += 0.0005;
            if (star && star.scale.x > 0) star.rotation.y += 0.01;
            for (let i = clickEffects.length - 1; i >= 0; i--) {
                const sparkles = clickEffects[i];
                const positions = sparkles.geometry.attributes.position;
                const velocities = sparkles.userData.velocities;
                for (let j = 0; j < positions.count; j++) {
                    positions.setX(j, positions.getX(j) + velocities[j].x);
                    positions.setY(j, positions.getY(j) + velocities[j].y);
                    positions.setZ(j, positions.getZ(j) + velocities[j].z);
                }
                positions.needsUpdate = true;
                sparkles.userData.life -= sparkles.userData.decay;
                sparkles.material.opacity = Math.max(0, sparkles.userData.life);
                if (sparkles.userData.life <= 0) {
                    scene.remove(sparkles);
                    sparkles.geometry.dispose();
                    sparkles.material.dispose();
                    clickEffects.splice(i, 1);
                }
            }

            for (let i = shockwaveEffects.length - 1; i >= 0; i--) {
                const shockwave = shockwaveEffects[i];
                const positions = shockwave.geometry.attributes.position;
                const particleData = shockwave.userData.particles;
                shockwave.userData.life -= shockwave.userData.decay;
                shockwave.material.opacity = Math.max(0, shockwave.userData.life);
                for (let j = 0; j < positions.count; j++) {
                    const direction = particleData[j].direction;
                    const speed = particleData[j].speed;

                    positions.setX(j, positions.getX(j) + direction.x * speed);
                    positions.setY(j, positions.getY(j) + direction.y * speed);
                    positions.setZ(j, positions.getZ(j) + direction.z * speed);
                }
                positions.needsUpdate = true;
                if (shockwave.userData.life <= 0) {
                    treeGroup.remove(shockwave);
                    shockwave.geometry.dispose();
                    shockwave.material.dispose();
                    shockwaveEffects.splice(i, 1);
                }
            }

            if (trailParticlesMesh) {
                const positions = trailParticlesMesh.geometry.attributes.position.array;
                const colors = trailParticlesMesh.geometry.attributes.color.array;
                for (let i = 0; i < maxTrailParticles; i++) {
                    if (trailParticleData[i].life > 0) {
                        trailParticleData[i].life -= 0.02;
                        positions[i * 3] += trailParticleData[i].velocity.x;
                        positions[i * 3 + 1] += trailParticleData[i].velocity.y;
                        positions[i * 3 + 2] += trailParticleData[i].velocity.z;
                        if (trailParticleData[i].life <= 0) {
                            positions[i * 3 + 1] = -1000;
                        }
                    } else {
                        positions[i * 3 + 1] = -1000;
                    }
                }
                trailParticlesMesh.geometry.attributes.position.needsUpdate = true;
            }

            const gravity = -0.008;
            const groundLevel = -20;
            const fadeZone = 8;
            const nowTime = Date.now() * 0.001;

            for (let i = activeTexts.length - 1; i >= 0; i--) {
                const textObj = activeTexts[i];
                if (textObj.position.y > groundLevel) {
                    emitTrail(textObj.position);
                }
                if (textObj.isCaught) {
                    raycaster.setFromCamera(mouse, camera);
                    const intersectPoint = new THREE.Vector3();
                    raycaster.ray.intersectPlane(dragPlane, intersectPoint);
                    if (intersectPoint) {
                        textObj.position.copy(intersectPoint.add(dragOffset));
                    }
                    textObj.velocity.set(0, 0, 0);
                } else {
                    textObj.velocity.y += gravity;
                    const t = nowTime + textObj.timeOffset;
                    const swayForceX = Math.sin(t * textObj.swayFreq) * 0.002;
                    const swayForceZ = Math.cos(t * textObj.swayFreq * 0.8) * 0.002;
                    textObj.velocity.x += swayForceX;
                    textObj.velocity.z += swayForceZ;
                    textObj.velocity.multiplyScalar(0.96);
                    textObj.position.add(textObj.velocity);
                }

                const tempVec = textObj.position.clone();
                tempVec.project(camera);

                let scale = 1.0;

                if (textObj.isCaught) {
                    if (textObj.type === 'image') {
                        scale = 2.0;
                    } else {
                        scale = 1.2;
                    }
                    textObj.element.style.zIndex = 1000;
                } else {
                    scale = 1.0;
                    textObj.element.style.zIndex = 10;
                }

                if (tempVec.z < 1) {
                    const screenX = (tempVec.x * 0.5 + 0.5) * window.innerWidth;
                    const screenY = (-tempVec.y * 0.5 + 0.5) * window.innerHeight;

                    textObj.element.style.display = 'block';
                    textObj.element.style.left = `${screenX}px`;
                    textObj.element.style.top = `${screenY}px`;
                    textObj.element.style.transform = `translate(-50%, -50%) scale(${scale})`;

                } else {
                    textObj.element.style.display = 'none';
                }


                if (!textObj.isCaught) {
                    if (textObj.position.y < groundLevel + fadeZone) {
                        const opacity = (textObj.position.y - groundLevel) / fadeZone;
                        textObj.element.style.opacity = Math.max(0, opacity);
                    } else {
                        textObj.element.style.opacity = 1;
                    }

                    if (textObj.position.y < groundLevel) {
                        if (textObj.element.parentNode) {
                            textObj.element.parentNode.removeChild(textObj.element);
                        }
                        activeTexts.splice(i, 1);
                    }
                } else {
                    textObj.element.style.opacity = 1;
                }
            }

            if (innerParticles && innerParticles.visible && pathPoints.length > 0) {
                const positions = innerParticles.geometry.attributes.position;
                for (let i = 0; i < risingParticlesData.length; i++) {
                    const data = risingParticlesData[i];
                    data.progress += data.speed;
                    if (data.progress >= 1) {
                        data.progress = 0.001;
                        if (i === 0) triggerStarFlash();
                    }
                    const pathIndex = Math.floor(data.progress * (pathPoints.length - 1));
                    const basePoint = pathPoints[pathIndex];
                    const currentRadius = data.radius * (1 - data.progress);
                    const offsetX = Math.cos(data.angle) * currentRadius;
                    const offsetZ = Math.sin(data.angle) * currentRadius;
                    positions.setXYZ(i, basePoint.x + offsetX, basePoint.y, basePoint.z + offsetZ);
                }
                positions.needsUpdate = true;
            }

            const particleTree = treeGroup.children[0];
            if (particleTree && particleTree.geometry.attributes.originalPosition) {
                const now = Date.now() * 0.001;
                const positions = particleTree.geometry.attributes.position;
                const originalPositions = particleTree.geometry.attributes.originalPosition;
                const directions = particleTree.geometry.attributes.directionVector;
                const colors = particleTree.geometry.attributes.color;
                const breathFactor = Math.sin(now * 0.4) * 0.1;
                for (let i = 0; i < positions.count; i++) {
                    positions.setXYZ(i,
                        originalPositions.getX(i) + directions.getX(i) * breathFactor,
                        originalPositions.getY(i) + directions.getY(i) * breathFactor,
                        originalPositions.getZ(i) + directions.getZ(i) * breathFactor
                    );
                }
                positions.needsUpdate = true;
                if (isColorAnimationActive) {
                    const waveFrontIndex = Math.floor(waveProgress.value * colors.count);
                    for (let i = 0; i < colors.count; i++) {
                        if (waveProgress.value < 1) {
                            if (i <= waveFrontIndex) colors.setXYZ(i, flashColor.r, flashColor.g, flashColor.b);
                            else colors.setXYZ(i, 1.0, 0.42, 0.42);
                        } else {
                            colors.setXYZ(i, flashColor.r, flashColor.g, flashColor.b);
                        }
                    }
                } else {
                    raycaster.setFromCamera(mouse, camera);
                    const intersects = raycaster.intersectObject(particleTree);

                    if (forceReset || intersects.length === 0) {
                        for (let i = 0; i < colors.count; i++) {
                            if (colors.getX(i) !== 1.0) colors.setXYZ(i, 1.0, 0.42, 0.42);
                        }
                        if (star) {
                            star.material.color.setHex(0xff6b6b);
                            star.material.emissive.setHex(0xff6b6b);
                        }
                        if (intersects.length === 0) {
                            forceReset = false;
                        }
                    } else {
                        const intersectionPoint = intersects[0].point;
                        const baseHue = (now * 0.03) % 1;
                        const adjustedHue = 0.25 + baseHue * 0.75;
                        currentColor.setHSL(adjustedHue, 1, 0.6);

                        for (let i = 0; i < positions.count; i++) {
                            const particlePos = new THREE.Vector3().fromBufferAttribute(positions, i);
                            if (particlePos.distanceTo(intersectionPoint) < 4.0) {
                                colors.setXYZ(i, currentColor.r, currentColor.g, currentColor.b);
                            } else {
                                colors.setXYZ(i, 1.0, 0.42, 0.42);
                            }
                        }
                    }
                }
                colors.needsUpdate = true;
            }

            // Fireworks effect
            if (isTreeDrawn) {
                if (Math.random() < 0.06) fireworks.push(new Firework());
                for (let i = fireworks.length - 1; i >= 0; i--) {
                    fireworks[i].update();
                    if (fireworks[i].isDead) fireworks.splice(i, 1);
                }
            }

            controls.update();
            const centerTarget = new THREE.Vector3(0, 5, 0);
            controls.target.lerp(centerTarget, 0.02);
            composer.render();
        }

        function triggerStarFlash() {
            if (star && star.material) {
                gsap.to(star.material, {
                    emissiveIntensity: 2.5,
                    duration: 0.15,
                    yoyo: true,
                    repeat: 1
                });
            }
        }
        function bindInteractions() {
            if (interactionsBound) return;
            interactionsBound = true;
            window.addEventListener('mousedown', onInteractionStart, false);
            window.addEventListener('touchstart', onInteractionStart, false);
            window.addEventListener('mousemove', onMouseMove, false);
            window.addEventListener('touchmove', onMouseMove, {
                passive: false
            });
            window.addEventListener('mouseup', onTextRelease, false);
            window.addEventListener('touchend', onTextRelease, false);
        }

        function playBackgroundMusic() {
            if (typeof window.__inxkPlayBackgroundMusic === 'function') {
                window.__inxkPlayBackgroundMusic();
                return;
            }
            if (backgroundAudio && backgroundAudio.src) {
                backgroundAudio.play().catch(() => {});
            }
        }

        function beginExperience() {
            if (experienceStarted) return;
            experienceStarted = true;
            const start = document.getElementById('start-screen');
            if (start) start.classList.add('is-done');
            const hint = document.getElementById('tree-hint');
            if (hint) {
                hint.hidden = false;
                window.setTimeout(() => hint.classList.add('is-hide'), 4200);
            }
            bindInteractions();
            playBackgroundMusic();
            startAutoColor();
        }

        function bindStart() {
            const start = document.getElementById('start-screen');
            if (!start) {
                beginExperience();
                return;
            }
            const go = (event) => {
                if (event.type === 'keydown' && event.key !== 'Enter' && event.key !== ' ') return;
                if (event.key === ' ') event.preventDefault();
                beginExperience();
            };
            start.addEventListener('pointerdown', go, true);
            start.addEventListener('keydown', go);
        }

        init();
        animate();
        bindStart();
