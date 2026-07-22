(function () {
			// ENABLE_PHOTO_HEART_FLOW: chỉ ảnh hưởng lần nhấn thứ 2 lên hộp (explodeInnerPhotos).
			// Flow cắt bánh: cắt xong → thư trước → Tiếp tục → trái tim → click tim → thư lần 2.
			var ENABLE_PHOTO_HEART_FLOW = false;

			var view = document.getElementById('cube-view');
			var cube = document.getElementById('gift-cube');
			var photoWall = document.getElementById('photo-wall');
			/** Ảnh cho photo-wall (flow trái tim) khi không còn khối inner-cube trong HTML */
			var PHOTO_WALL_SOURCES = [
				'./assets/images/1.jpg',
				'./assets/images/2.jpg',
				'./assets/images/3.jpg',
				'./assets/images/4.jpg',
				'./assets/images/5.jpg',
				'./assets/images/6.jpg'
			];
			/* Helper: lấy danh sách ảnh (ưu tiên preview nếu có) */
			function getPhotoSources() {
				var pd = window.__PREVIEW_DATA__;
				if (pd && pd.photoBlobUrls && pd.photoBlobUrls.length > 0) return pd.photoBlobUrls;
				return PHOTO_WALL_SOURCES;
			}
			var balloonLayer = document.getElementById('balloon-layer');
			var fireworksLayer = document.getElementById('fireworks-layer');
			if (!view || !cube) return;

			var rotX = -18;
			var rotY = -28;
			var sceneDrag = false;
			var cubeGesture = false;
			var cubeMoved = false;
			var exploded = false;
			var balloonsLaunched = false;
			var fireworksLaunched = false;
			var startX = 0;
			var startY = 0;
			var startRotX = 0;
			var startRotY = 0;
			var MOVE_THRESH = 10;
			var relayoutTimer = null;
			var mergeToLetterTimer = null;
			var letterModalShown = false;
			var candleBlownForLetter = !!window.__memoryCandleBlown;
			var pendingLetterAfterCandle = false;
			var heartBubbleEmitterTimer = null;
			var heartBubbleLayer = null;
			var heartBubbleDebugCount = 0;
			var photoHeartDismissFadeTimer = null;
			var photoHeartDismissCleanupTimer = null;

			function clearPhotoHeartDismissTimers() {
				if (photoHeartDismissFadeTimer) {
					clearTimeout(photoHeartDismissFadeTimer);
					photoHeartDismissFadeTimer = null;
				}
				if (photoHeartDismissCleanupTimer) {
					clearTimeout(photoHeartDismissCleanupTimer);
					photoHeartDismissCleanupTimer = null;
				}
			}

			/* Sau fade: gỡ tim ảnh + ẩn bóng giữa (giữ node trong HTML) */
			function finalizePhotoWallHeartDismiss() {
				if (!photoWall) return;
				photoWall.classList.remove('active', 'photo-wall--collapse', 'photo-wall--fading');
				photoWall.innerHTML = '';
				photoWall.setAttribute('aria-hidden', 'true');
				var cb = document.querySelector('.page-float-bubble');
				if (cb) {
					cb.style.display = 'none';
					cb.classList.remove('page-float-bubble--shrink', 'page-float-bubble--hide-after-shrink');
					cb.setAttribute('aria-hidden', 'true');
				}
			}

			function requestLetterAfterCandle() {
				if (candleBlownForLetter) {
					showLetterModalAfterMerge();
				} else {
					pendingLetterAfterCandle = true;
				}
			}

			function onCandleBlown(e) {
				var d = e && e.detail;
				/* cake.js: 'blow' = đã thổi nến (chỉ mở quyền mở thư sau tim ảnh); 'letter' = tương thích cũ / mở thư trực tiếp */
				if (d && d.phase === 'letter') {
					candleBlownForLetter = true;
					if (pendingLetterAfterCandle) {
						pendingLetterAfterCandle = false;
						showLetterModalAfterMerge();
					}
					return;
				}
				if (d && d.phase === 'blow') {
					candleBlownForLetter = true;
					return;
				}
				candleBlownForLetter = true;
				if (cube.classList.contains('open') && !exploded) {
					explodeInnerPhotos();
					return;
				}
				if (pendingLetterAfterCandle) {
					pendingLetterAfterCandle = false;
					showLetterModalAfterMerge();
				}
			}

			window.addEventListener('memory:candle-blown', onCandleBlown);

			window.addEventListener('memory:cake-cuts-complete', function () {
				/* Bánh đã tách → mở phong bì thư trước; sau khi user ấn «Tiếp tục»
				   (letter-index gọi __afterLetterContinue) mới xếp trái tim ảnh. */
				if (letterModalShown) return;
				if (!cube.classList.contains('open')) return;
				if (!photoWall) return;
				if (photoWall.classList.contains('active')) return;
				if (!exploded) {
					exploded = true;
					cube.classList.add('exploded');
				}
				window.__afterLetterContinue = function () {
					letterModalShown = false;
					setTimeout(renderExplodedHeart, 400);
				};
				showLetterModalAfterMerge();
			});

			function applyViewTransform() {
				var vw = window.innerWidth;
				var vh = window.innerHeight;
				var mobileLandscape = vw > vh && Math.min(vw, vh) <= 500;
				var mobilePortrait = vh > vw && vw <= 500;
				var scaleStr = mobileLandscape ? 'scale(0.72) ' : mobilePortrait ? 'scale(1.02) ' : 'scale(1) ';
				view.style.transform =
					'translate(-50%, -50%) ' + scaleStr;
			}

			function launchBirthdayBalloons() {
				var rect;
				var cx;
				var cy;
				var colors;
				var n;
				var i;
				var wrap;
				var offX;
				var offY;
				var delay;
				var dur;
				var scale;
				var vw;
				var vh;
				var burstAngle;
				var burstReach;
				var burstTx;
				var burstTy;
				if (balloonsLaunched || !balloonLayer || !cube) return;
				balloonsLaunched = true;
				rect = cube.getBoundingClientRect();
				cx = rect.left + rect.width / 2;
				cy = rect.top + rect.height / 2;
				vw = window.innerWidth || document.documentElement.clientWidth || 800;
				vh = window.innerHeight || document.documentElement.clientHeight || 600;
				balloonLayer.style.setProperty('--spawn-x', cx + 'px');
				balloonLayer.style.setProperty('--spawn-y', cy + 'px');
				balloonLayer.classList.add('active');
				balloonLayer.setAttribute('aria-hidden', 'false');
				colors = [
					'#ffb6c1', /* Light pink */
					'#ffc0cb', /* Pink */
					'#ffd700', /* Gold */
					'#ff69b4', /* Hot pink */
					'#ffe4e1', /* Misty rose */
					'#fff0f5', /* Lavender blush */
					'#f8c8dc', /* Pastel pink */
					'#ffdfba', /* Peach */
					'#ff9999'  /* Soft red */
				];
				if (Math.min(vw, vh) < 520) {
					n = 14; /* mobile */
				} else if (vw >= 1024) {
					n = 16; /* desktop: giảm bớt bóng */
				} else {
					n = 24; /* tablet / màn trung */
				}
				for (i = 0; i < n; i++) {
					wrap = document.createElement('div');
					wrap.className = 'balloon-unit';
					offX = (Math.random() - 0.5) * 56;
					offY = (Math.random() - 0.5) * 56;
					burstAngle = Math.random() * Math.PI * 2;
					burstReach = Math.hypot(vw, vh) * (0.42 + Math.random() * 0.58);
					burstTx = Math.cos(burstAngle) * burstReach;
					burstTy = Math.sin(burstAngle) * burstReach;
					wrap.style.setProperty(
						'--tx2',
						(burstTx * 0.32) + 'px'
					);
					wrap.style.setProperty(
						'--ty2',
						(burstTy * 0.32 - vh * (0.06 + Math.random() * 0.09)) + 'px'
					);
					wrap.style.setProperty('--tx', burstTx + 'px');
					delay = Math.random() * 0.65;
					dur = 4.8 + Math.random() * 4.2;
					scale = 0.55 + Math.random() * 0.55;
					wrap.style.setProperty('--off-x', offX + 'px');
					wrap.style.setProperty('--off-y', offY + 'px');
					wrap.style.setProperty('--delay', delay + 's');
					wrap.style.setProperty('--dur', dur + 's');
					wrap.style.setProperty('--b-scale', String(scale));
					wrap.style.setProperty(
						'--rot',
						(Math.random() * 24 - 12).toFixed(1) + 'deg'
					);
					wrap.style.setProperty('--balloon-color', colors[i % colors.length]);
					wrap.innerHTML =
						'<span class="gift-heart" aria-hidden="true">' +
							'<svg viewBox="0 0 32 32" overflow="visible">' +
								'<path d="M16 29 C14 27, 2 18, 2 10 A7 7 0 0 1 16 7 A7 7 0 0 1 30 10 C30 18, 18 27, 16 29Z" fill="currentColor"></path>' +
							'</svg>' +
						'</span>';
					balloonLayer.appendChild(wrap);
				}
			}

			function launchBirthdayFireworks() {
				var vw;
				var vh;
				var rect;
				var cx;
				var cy;
				var numBursts;
				var b;
				var px;
				var py;
				if (fireworksLaunched || !fireworksLayer || !cube) return;
				fireworksLaunched = true;
				vw = window.innerWidth || document.documentElement.clientWidth || 800;
				vh = window.innerHeight || document.documentElement.clientHeight || 600;
				rect = cube.getBoundingClientRect();
				cx = rect.left + rect.width / 2;
				cy = rect.top + rect.height / 2;
				fireworksLayer.classList.add('active');
				fireworksLayer.setAttribute('aria-hidden', 'false');

				function spawnBurst(x, y, delayMs) {
					setTimeout(function () {
						var burst;
						var particles;
						var i;
						var ang;
						var d;
						var spark;
						var baseHue;
						if (!fireworksLayer) return;
						burst = document.createElement('div');
						burst.className = 'firework-burst';
						burst.style.left = x + 'px';
						burst.style.top = y + 'px';
						var hueRange = Math.random() < 0.5 ? Math.floor(Math.random() * 50) : 320 + Math.floor(Math.random() * 40);
						baseHue = hueRange;
						particles = 15 + Math.floor(Math.random() * 15); // Giảm lượng tia sáng mỗi chùm pháo hoa
						for (i = 0; i < particles; i++) {
							ang = (Math.PI * 2 * i) / particles + Math.random() * 0.4;
							d =
								Math.min(vw, vh) * (0.1 + Math.random() * 0.28);
							spark = document.createElement('span');
							spark.className = 'firework-spark';
							spark.style.setProperty(
								'--sx',
								Math.cos(ang) * d + 'px'
							);
							spark.style.setProperty(
								'--sy',
								Math.sin(ang) * d + 'px'
							);
							spark.style.setProperty(
								'--fh',
								String((baseHue + Math.floor(Math.random() * 70) - 35 + 360) % 360)
							);
							spark.style.setProperty(
								'--fd',
								Math.random() * 0.12 + 's'
							);
							spark.style.animationDuration =
								0.75 + Math.random() * 0.55 + 's';
							burst.appendChild(spark);
						}
						fireworksLayer.appendChild(burst);
						setTimeout(function () {
							if (burst.parentNode) {
								burst.parentNode.removeChild(burst);
							}
						}, 1600);
					}, delayMs);
				}

				numBursts = Math.min(vw, vh) < 520 ? 4 : 7; // Giảm số cụm pháo hoa ban đầu
				for (b = 0; b < numBursts; b++) {
					if (b === 0) {
						px = cx;
						py = cy;
					} else if (b === 1) {
						px = vw * 0.22 + Math.random() * vw * 0.18;
						py = vh * 0.18 + Math.random() * vh * 0.22;
					} else if (b === 2) {
						px = vw * 0.6 + Math.random() * vw * 0.22;
						py = vh * 0.15 + Math.random() * vh * 0.2;
					} else {
						px = vw * 0.08 + Math.random() * vw * 0.84;
						py = vh * 0.1 + Math.random() * vh * 0.5;
					}
					spawnBurst(px, py, b * 200 + Math.floor(Math.random() * 120));
				}

				setTimeout(function () {
					var k;
					var extra = Math.min(vw, vh) < 520 ? 2 : 3; // Giảm số pháo hoa nổ phụ
					for (k = 0; k < extra; k++) {
						spawnBurst(
							vw * 0.12 + Math.random() * vw * 0.76,
							vh * 0.12 + Math.random() * vh * 0.45,
							k * 180
						);
					}
				}, 900);
			}

			function openGiftBoxOnly() {
				var wasOpen = cube.classList.contains('open');
				if (!wasOpen) {
					cube.classList.add('open');

					// Phát nhạc cảm động ngay khi mở hộp thay vì đợi mở thư
					var letterSound = document.getElementById('letterSound');
					if (letterSound) {
						letterSound.play().catch(function(e){});
					}
					
					// Dừng nhạc nền ban đầu để tránh bị loạn tiếng
					var bgAudio = document.getElementById('audios');
					if (bgAudio) {
						bgAudio.pause();
					}

					launchBirthdayBalloons();
					// Trì hoãn pháo hoa 500ms để trình duyệt tránh bị quá tải renderDOM cùng 1 lúc với bóng bay
					setTimeout(launchBirthdayFireworks, 500);

					// Cho nắp mở hết và lộ rõ khoang rỗng trước khi bánh xuất hiện.
					setTimeout(function () {
						if (typeof window.revealMemoryZoneOnGiftOpen === "function") {
							window.revealMemoryZoneOnGiftOpen();
						}
					}, 800);
				}
			}

			function getExplosionConfig() {
				var vw = window.innerWidth || document.documentElement.clientWidth || 1280;
				var vh = window.innerHeight || document.documentElement.clientHeight || 720;
				var shortSide = Math.min(vw, vh);
				var portrait = vh >= vw;
				if (shortSide <= 430) {
					if (portrait) {
						return {
							total: 54,
							size: '56px',
							xScale: 2.50, // Thu hẹp thêm bề ngang vào trong
							yScale: 1.55, // Tăng thêm chiều cao để trái tim thanh mảnh hơn
							xMin: 0,
							xMax: 100,
							yMin: 14,
							yMax: 86,
							tiltRange: 10
						};
					}
					return {
						total: 30,
						size: '58px',
						xScale: 1.05,
						yScale: 2.02,
						xMin: 26,
						xMax: 74,
						yMin: 4,
						yMax: 96,
						tiltRange: 8
					};
				}
			if (shortSide <= 768) {
				if (portrait) {
					return {
						total: 68,
						size: '64px',
						xScale: 2.55, // Khép bề ngang 2 bên mép màn hình
						yScale: 1.65, // Kéo dài thêm chiều dọc trái tim
						xMin: 0,
						xMax: 100,
						yMin: 12,
						yMax: 88,
						tiltRange: 12
					};
				}
				return {
					total: 38,
					size: '68px',
					xScale: 1.1,
					yScale: 2.05,
					xMin: 23,
					xMax: 77,
					yMin: 5,
					yMax: 95,
					tiltRange: 10
				};
			}
			/* iPad / tablet lớn portrait (shortSide 769–1024): cần xScale rộng hơn desktop để tim không bị hẹp */
			if (shortSide <= 1024 && portrait) {
				return {
					total: 80,
					size: '72px',
					xScale: 2.20,
					yScale: 1.72,
					xMin: 2,
					xMax: 98,
					yMin: 10,
					yMax: 90,
					tiltRange: 12
				};
			}
			/* iPad landscape (shortSide 769–1024, không phải portrait) */
			if (shortSide <= 1024) {
				return {
					total: 48,
					size: '76px',
					xScale: 1.15,
					yScale: 2.00,
					xMin: 20,
					xMax: 80,
					yMin: 5,
					yMax: 95,
					tiltRange: 12
				};
			}
			return {
				total: 52,
				size: 'min(12vw, 124px)',
				xScale: 1.22,
				yScale: 1.92,
				xMin: 22,
				xMax: 78,
				yMin: 6,
				yMax: 94,
				tiltRange: 18
			};
			}

			function buildHeartPoints(count, cfg) {
				var points = [];
				var i;
				var t;
				var x;
				var y;
				var xNorm;
				var yNorm;
				for (i = 0; i < count; i++) {
					t = (Math.PI * 2 * i) / count;
					x = 16 * Math.pow(Math.sin(t), 3);
					y =
						13 * Math.cos(t) -
						5 * Math.cos(2 * t) -
						2 * Math.cos(3 * t) -
						Math.cos(4 * t);
					xNorm = 50 + x * cfg.xScale;
					// Bù trừ trọng tâm lên cao thêm do phương trình trái tim nặng phần đuôi nhọn ở đáy (dễ có cảm giác tuột xuống lề dưới)
					yNorm = 45 - y * cfg.yScale;
					points.push({
						x: Math.max(cfg.xMin, Math.min(cfg.xMax, xNorm)),
						y: Math.max(cfg.yMin, Math.min(cfg.yMax, yNorm))
					});
				}
				return points;
			}

		function renderExplodedHeart() {
			var srcList;
			var imgs;
			var points;
			var total;
			var i;
			var card;
			var img;
			var pick;
			var tilt;
			var cfg;
			var innerCube;
			if (!photoWall) return;
			innerCube = cube ? cube.querySelector('.inner-cube') : null;
			srcList = [];
			if (innerCube) {
				imgs = innerCube.querySelectorAll('img');
				for (i = 0; i < imgs.length; i++) {
					srcList.push(imgs[i].src);
				}
			}
			if (!srcList.length) {
				srcList = getPhotoSources().slice();
			}
			cfg = getExplosionConfig();
			total = cfg.total;
			points = buildHeartPoints(total, cfg);
			photoWall.style.setProperty('--photo-size', cfg.size);
			photoWall.innerHTML = '';

			for (i = 0; i < total; i++) {
				card = document.createElement('div');
				tilt = cfg.tiltRange * -0.5 + Math.random() * cfg.tiltRange;
				card.className = 'photo-card';
				card.style.setProperty('--order', i + 1);
				card.style.setProperty('--x', points[i].x + '%');
				card.style.setProperty('--y', points[i].y + '%');
				card.style.setProperty('--tilt', tilt.toFixed(2) + 'deg');
			img = document.createElement('img');
			pick = Math.floor(Math.random() * srcList.length);
			if (/^https?:\/\//i.test(srcList[pick])) img.crossOrigin = 'anonymous';
			img.src = srcList[pick];
			img.alt = '';
			card.appendChild(img);
				photoWall.appendChild(card);
			}

			photoWall.classList.add('active');
			photoWall.setAttribute('aria-hidden', 'false');

			/* Hint nhắc user chạm vào trái tim để sang màn tiếp theo */
			var hint = document.createElement('div');
			hint.className = 'photo-wall-hint';
			hint.setAttribute('aria-hidden', 'true');
			hint.innerHTML =
				'<span class="photo-wall-hint__pulse" aria-hidden="true"></span>' +
				'<span class="photo-wall-hint__icon" aria-hidden="true">\uD83D\uDC46</span>' +
				'<span class="photo-wall-hint__text">Chạm vào trái tim để tiếp tục</span>';
			photoWall.appendChild(hint);
			/* Chỉ hiện hint sau khi card cuối cùng xếp xong */
			var hintDelayMs = total * 30 + 600 + 120;
			setTimeout(function () {
				if (!photoWall || !photoWall.classList.contains('active')) return;
				if (photoWall.classList.contains('photo-wall--collapse')) return;
				hint.classList.add('photo-wall-hint--visible');
			}, hintDelayMs);

			scheduleMergeHeartToLetter();
		}

			function scheduleMergeHeartToLetter() {
				if (letterModalShown) return;
				
				// Hủy tính năng tự động hút ảnh sau vài giây, thay bằng sự kiện click
				if (mergeToLetterTimer) {
					clearTimeout(mergeToLetterTimer);
					mergeToLetterTimer = null;
				}
				
			var onClickWall = function() {
				if (letterModalShown || !photoWall) return;
				if (!photoWall.classList.contains('active')) return;
				if (photoWall.classList.contains('photo-wall--collapse')) return;

				/* Ẩn hint ngay khi user click */
				var h = photoWall.querySelector('.photo-wall-hint');
				if (h) h.classList.add('photo-wall-hint--hidden');
				/* Poetic touch: bóng trung tâm co lại + bong bóng nước bay lên */
				triggerHeartBubblePoem();

				photoWall.classList.add('photo-wall--collapse');
					photoWall.removeEventListener('click', onClickWall); // click tim chỉ thu ảnh + bubble flow

					/* Sau khi ảnh thu về giữa (~2s CSS), fade out rồi dọn wall + ẩn bóng trang trí giữa */
					clearPhotoHeartDismissTimers();
					var HEART_COLLAPSE_MS = 2080;
					var HEART_FADEOUT_MS = 620;
					photoHeartDismissFadeTimer = setTimeout(function () {
						photoHeartDismissFadeTimer = null;
						if (!photoWall || !photoWall.classList.contains('photo-wall--collapse')) return;
						photoWall.classList.add('photo-wall--fading');
						var centerB = document.querySelector('.page-float-bubble');
						if (centerB) centerB.classList.add('page-float-bubble--hide-after-shrink');
						photoHeartDismissCleanupTimer = setTimeout(function () {
							photoHeartDismissCleanupTimer = null;
							finalizePhotoWallHeartDismiss();
						}, HEART_FADEOUT_MS);
					}, HEART_COLLAPSE_MS);
				};
				
				photoWall.addEventListener('click', onClickWall);
			}

		function triggerHeartBubblePoem() {
			var centerBubble = document.querySelector('.page-float-bubble');
			var vw = window.innerWidth || document.documentElement.clientWidth || 1280;

			if (centerBubble) {
				centerBubble.style.display = '';
				centerBubble.classList.remove('page-float-bubble--shrink', 'page-float-bubble--hide-after-shrink');
				/* force reflow để replay animation khi click lần khác */
				void centerBubble.offsetWidth;
				centerBubble.classList.add('page-float-bubble--shrink');
			}

			if (!heartBubbleLayer) {
				heartBubbleLayer = document.createElement('div');
				heartBubbleLayer.className = 'heart-bubble-layer';
				document.body.appendChild(heartBubbleLayer);
			}
			if (heartBubbleEmitterTimer) return;

			/* Portrait hẹp: giữ như cũ. Desktop rộng: dày nhất. Mobile landscape: thưa hơn tier tablet ngang */
			var portraitNarrowLayout = isHeartBubbleMobilePortrait();
			var iwSetup = window.innerWidth || document.documentElement.clientWidth || vw;
			var ihSetup = window.innerHeight || document.documentElement.clientHeight || 800;
			var isMobileLandscapeBubbles = iwSetup > ihSetup && Math.min(iwSetup, ihSetup) <= 520;
			var bubbleBurstCount;
			var bubbleBurstStagger;
			var bubbleEmitterInterval;
			var bubbleDoubleSpawnThreshold;
			if (portraitNarrowLayout) {
				bubbleBurstCount = 4;
				bubbleBurstStagger = 260;
				bubbleEmitterInterval = 1480;
				bubbleDoubleSpawnThreshold = 0.88;
			} else if (isMobileLandscapeBubbles) {
				bubbleBurstCount = 5;
				bubbleBurstStagger = 220;
				bubbleEmitterInterval = 1320;
				bubbleDoubleSpawnThreshold = 0.86;
			} else if (iwSetup >= 1100) {
				bubbleBurstCount = 11;
				bubbleBurstStagger = 95;
				bubbleEmitterInterval = 620;
				bubbleDoubleSpawnThreshold = 0.48;
			} else {
				bubbleBurstCount = 7;
				bubbleBurstStagger = 140;
				bubbleEmitterInterval = 860;
				bubbleDoubleSpawnThreshold = 0.62;
			}

			/* Tránh nhiều bóng cùng xuất hiện chồng nhau theo trục ngang */
			var recentBubbleXPct = [];
			var RECENT_X_WINDOW = 7;
			var MIN_X_GAP_PCT = 15;
			var MIN_X_GAP_PCT_NARROW = 11;
			var laneRot = 0;
			var LANE_CENTERS = [12, 28, 44, 58, 72, 86];
			var LANE_CENTERS_NARROW = [26, 38, 50, 62, 74];

			function isHeartBubbleMobilePortrait() {
				try {
					return window.matchMedia('(max-width: 720px) and (orientation: portrait)').matches;
				} catch (err) {
					var iw = window.innerWidth || vw;
					var ih = window.innerHeight || 0;
					return iw <= 720 && ih >= iw;
				}
			}

			function pickSpawnXPct() {
				var narrow = isHeartBubbleMobilePortrait();
				var margin = narrow ? 17 : 5;
				var minGap = narrow ? MIN_X_GAP_PCT_NARROW : MIN_X_GAP_PCT;
				var lanes = narrow ? LANE_CENTERS_NARROW : LANE_CENTERS;
				var t, x, ok, i;
				for (t = 0; t < 28; t++) {
					x = margin + Math.random() * (100 - 2 * margin);
					ok = true;
					for (i = 0; i < recentBubbleXPct.length; i++) {
						if (Math.abs(x - recentBubbleXPct[i]) < minGap) {
							ok = false;
							break;
						}
					}
					if (ok) {
						recentBubbleXPct.push(x);
						if (recentBubbleXPct.length > RECENT_X_WINDOW) recentBubbleXPct.shift();
						return x;
					}
				}
				x = lanes[laneRot % lanes.length] + (Math.random() - 0.5) * (narrow ? 3 : 5);
				laneRot++;
				recentBubbleXPct.push(x);
				if (recentBubbleXPct.length > RECENT_X_WINDOW) recentBubbleXPct.shift();
				if (x < margin) x = margin;
				if (x > 100 - margin) x = 100 - margin;
				return x;
			}

			/* Ấn giữ + kéo: dừng animation, fixed px; thả tay → giữ trên màn thêm 60s rồi xóa */
			function attachHeartBubbleDrag(bubble, initialLifeMs) {
				var drag = null;

				function armRemove(ms) {
					if (bubble._heartRemoveTimer) {
						clearTimeout(bubble._heartRemoveTimer);
						bubble._heartRemoveTimer = null;
					}
					bubble._heartRemoveTimer = setTimeout(function () {
						bubble._heartRemoveTimer = null;
						if (bubble.parentNode) bubble.parentNode.removeChild(bubble);
					}, ms);
				}

				function onDown(ev) {
					if (ev.button !== 0 && ev.button !== undefined) return;
					if (drag) return;
					ev.stopPropagation();
					try {
						ev.preventDefault();
					} catch (ignore) {}
					if (bubble._heartRemoveTimer) {
						clearTimeout(bubble._heartRemoveTimer);
						bubble._heartRemoveTimer = null;
					}
					var r = bubble.getBoundingClientRect();
					var op = parseFloat(getComputedStyle(bubble).opacity);
					if (isNaN(op)) op = 1;
					bubble.style.animation = 'none';
					bubble.style.opacity = String(op);
					bubble.style.position = 'fixed';
					bubble.style.width = r.width + 'px';
					bubble.style.height = r.height + 'px';
					bubble.style.left = r.left + 'px';
					bubble.style.top = r.top + 'px';
					bubble.style.transform = 'none';
					bubble.style.willChange = 'auto';
					bubble.classList.add('heart-bubble--dragging');
					drag = {
						pid: ev.pointerId,
						offX: ev.clientX - r.left,
						offY: ev.clientY - r.top
					};
					try {
						bubble.setPointerCapture(ev.pointerId);
					} catch (e) {}
				}

				function onMove(ev) {
					if (!drag || ev.pointerId !== drag.pid) return;
					var iw = window.innerWidth || 800;
					var ih = window.innerHeight || 600;
					var bw = bubble.offsetWidth || 48;
					var bh = bubble.offsetHeight || 48;
					var nl = ev.clientX - drag.offX;
					var nt = ev.clientY - drag.offY;
					var pad = 6;
					nl = Math.max(pad - bw * 0.88, Math.min(nl, iw - pad - bw * 0.12));
					nt = Math.max(pad - bh * 0.88, Math.min(nt, ih - pad - bh * 0.12));
					bubble.style.left = nl + 'px';
					bubble.style.top = nt + 'px';
				}

				function resumeFlightFromRelease() {
					var cs = getComputedStyle(bubble);
					var dx = parseFloat(cs.getPropertyValue('--dx')) || 0;
					var durStr = cs.getPropertyValue('--dur').trim();
					var durSec = parseFloat(durStr) || 10;
					var op = parseFloat(cs.opacity);
					if (isNaN(op)) op = 0.9;
					var dyExtra = parseFloat(cs.getPropertyValue('--dy')) || 0;
					var resumeDur = Math.max(4.2, durSec * 0.58);
					bubble.style.setProperty('--resume-dur', resumeDur + 's');
					bubble.style.setProperty('--release-opacity', String(op));
					bubble.style.setProperty('--resume-dx', dx + 'px');
					bubble.style.setProperty('--resume-dy', 'calc(-112vh + ' + dyExtra + 'px)');
					bubble.style.removeProperty('animation');
					bubble.style.willChange = 'transform, opacity';
					bubble.classList.add('heart-bubble--resume-flight');
					function onAnimEnd(e) {
						if (e.target !== bubble) return;
						var n = e.animationName || '';
						if (n.indexOf('heart-bubble-resume') === -1) return;
						bubble.removeEventListener('animationend', onAnimEnd);
						if (bubble.parentNode) bubble.parentNode.removeChild(bubble);
					}
					bubble.addEventListener('animationend', onAnimEnd);
					setTimeout(function () {
						if (bubble.parentNode && bubble.classList.contains('heart-bubble--resume-flight')) {
							bubble.removeEventListener('animationend', onAnimEnd);
							bubble.parentNode.removeChild(bubble);
						}
					}, Math.ceil(resumeDur * 1000) + 800);
				}

				function onEnd(ev) {
					if (!drag || ev.pointerId !== drag.pid) return;
					try {
						bubble.releasePointerCapture(ev.pointerId);
					} catch (e2) {}
					drag = null;
					bubble.classList.remove('heart-bubble--dragging');
					resumeFlightFromRelease();
				}

				bubble.addEventListener('pointerdown', onDown);
				bubble.addEventListener('pointermove', onMove);
				bubble.addEventListener('pointerup', onEnd);
				bubble.addEventListener('pointercancel', onEnd);

				armRemove(initialLifeMs);
			}

			function spawnOneBubble() {
				var b = document.createElement('div');
				var narrow = isHeartBubbleMobilePortrait();
				var iw = window.innerWidth || vw;
				var sizeH = 126 + Math.random() * 154; /* chiều cao bóng */
				var sizeW = sizeH * (0.78 + Math.random() * 0.06); /* elip dọc rõ ràng */
				if (narrow) {
					sizeH *= 0.78;
					sizeW *= 0.78;
				}
				var x = pickSpawnXPct();
				var dxMag = narrow ? 0.085 : 0.26;
				var dx = (Math.random() - 0.5) * (iw * dxMag);
				var dur = 12 + Math.random() * 8; /* bay chậm, tách nhau dễ nhìn */
				var s0 = 0.45 + Math.random() * 0.22;
				var s1 = 1.05 + Math.random() * 0.45;
				var photo = document.createElement('img');
				var shell = document.createElement('img');
				var _photoSrcs = getPhotoSources();
			var pick = Math.floor(Math.random() * _photoSrcs.length);

				b.className = 'heart-bubble';
				b.style.setProperty('--x', x.toFixed(2) + '%');
				b.style.setProperty('--size-w', sizeW.toFixed(1) + 'px');
				b.style.setProperty('--size-h', sizeH.toFixed(1) + 'px');
				b.style.setProperty('--dx', dx.toFixed(1) + 'px');
				b.style.setProperty('--delay', '0s');
				b.style.setProperty('--dur', dur.toFixed(2) + 's');
				b.style.setProperty('--s0', s0.toFixed(2));
				b.style.setProperty('--s1', s1.toFixed(2));
			photo.className = 'heart-bubble-photo';
			if (/^https?:\/\//i.test(_photoSrcs[pick])) photo.crossOrigin = 'anonymous';
			photo.src = _photoSrcs[pick];
			photo.alt = '';
			photo.decoding = 'async';
				shell.className = 'heart-bubble-shell';
				shell.src = './assets/images/ballon.png';
				shell.alt = '';
				shell.decoding = 'async';
				b.appendChild(photo);
				b.appendChild(shell);
				heartBubbleLayer.appendChild(b);

				/* Debug tâm ảnh user vs vỏ ballon (log vài mẫu đầu để tránh spam) */
				if (heartBubbleDebugCount < 10) {
					requestAnimationFrame(function () {
						var br = b.getBoundingClientRect();
						var pr = photo.getBoundingClientRect();
						var sr = shell.getBoundingClientRect();
						var bcX = br.left + br.width * 0.5;
						var bcY = br.top + br.height * 0.5;
						var pcX = pr.left + pr.width * 0.5;
						var pcY = pr.top + pr.height * 0.5;
						var scX = sr.left + sr.width * 0.5;
						var scY = sr.top + sr.height * 0.5;
						
						heartBubbleDebugCount++;
					});
				}
				attachHeartBubbleDrag(b, Math.ceil(dur * 1000) + 250);
			}

			/* Burst đầu: portrait ít bóng; màn rộng / landscape nhiều hơn */
			for (var bi = 0; bi < bubbleBurstCount; bi++) {
				setTimeout(spawnOneBubble, bi * bubbleBurstStagger);
			}
			heartBubbleEmitterTimer = setInterval(function () {
				spawnOneBubble();
				if (Math.random() > bubbleDoubleSpawnThreshold) spawnOneBubble();
			}, bubbleEmitterInterval);
		}

		function showLetterModalAfterMerge() {
			clearPhotoHeartDismissTimers();
			var el = document.getElementById('letter-modal');
			if (!el || letterModalShown) return;
			letterModalShown = true;
			pendingLetterAfterCandle = false;
			if (mergeToLetterTimer) {
				clearTimeout(mergeToLetterTimer);
				mergeToLetterTimer = null;
			}
			
			// Hiện phong bì với hiệu ứng fade-in (delay 0.8s từ CSS)
			el.classList.add('is-visible');
			el.setAttribute('aria-hidden', 'false');

			/*
			 * Một lần đo + bay thôi. Gọi lặp (setTimeout đo lại) sẽ đổi --rabbit-tx/ty giữa chừng
			 * → transition 1s chạy lại → nhìn như bay lên / xuống / lên.
			 */
			flyRabbitsToEnvelope();
			
			// Bắt đầu fade-out cụm ảnh
			if (photoWall) photoWall.classList.remove('active');

			// Điểm giao thoa (Cross-fade) an toàn hoàn tất
			setTimeout(function() {
				if (!photoWall) return;
				photoWall.classList.remove('photo-wall--collapse', 'photo-wall--fading');
				photoWall.innerHTML = '';
				photoWall.setAttribute('aria-hidden', 'true');
			}, 1600);
		}

		/*
		 * Animate 2 con thỏ trang chủ bay từ đáy màn hình lên nâng đỡ 2 mép dưới phong bì.
		 * Tính delta từ vị trí thực (getBoundingClientRect) → set CSS vars → add class transition.
		 */
		function flyRabbitsToEnvelope() {
			var envEl   = document.getElementById('envelope');
			var lRabbit = document.querySelector('.page-cloud-decor__rabbit--left');
			var rRabbit = document.querySelector('.page-cloud-decor__rabbit--right');
			if (!envEl || !lRabbit || !rRabbit) return;

			/* Đợi 1 frame để modal render xong rồi mới đo rect */
			requestAnimationFrame(function () {
				var envRect = envEl.getBoundingClientRect();
				var lRect   = lRabbit.getBoundingClientRect();
				var rRect   = rRabbit.getBoundingClientRect();

				/*
				 * Đích: dưới đáy phong bì, lệch ra 2 lề ngoài.
				 * sideOutset: giới hạn tối đa = khoảng cách từ mép phong bì ra cạnh viewport
				 *             tránh thỏ biến ra ngoài màn hình trên mobile.
				 */
				var vw = window.innerWidth;
				var belowOffset = Math.round(lRect.height * 0.32);
				/* Lùi thỏ xuống dưới mép đáy phong bì (sau khi wrapper căn giữa landscape / layout ổn định) */
				var extraBelow = 16;
				try {
					if (window.matchMedia('(orientation: landscape) and (max-width: 932px)').matches) {
						extraBelow = Math.max(36, Math.round((envRect.height || 240) * 0.14));
					}
				} catch (e2) {}
				var rawSide     = Math.round(lRect.width  * 0.85);
				/* Tối đa: không để thỏ chạy ra quá 70% chiều rộng bản thân khỏi mép phong bì */
				var maxSideL    = Math.max(0, envRect.left  + lRect.width * 0.7);
				var maxSideR    = Math.max(0, vw - envRect.right + rRect.width * 0.7);
				var sideOutsetL = Math.min(rawSide, maxSideL);
				var sideOutsetR = Math.min(rawSide, maxSideR);

				var lDX = envRect.left  - lRect.left  - sideOutsetL;
				var lDY = envRect.bottom - lRect.bottom + belowOffset + extraBelow;

				var rDX = (envRect.right - rRect.width) - rRect.left + sideOutsetR;
				var rDY = envRect.bottom - rRect.bottom + belowOffset + extraBelow;

				lRabbit.style.setProperty('--rabbit-tx', lDX.toFixed(1) + 'px');
				lRabbit.style.setProperty('--rabbit-ty', lDY.toFixed(1) + 'px');
				rRabbit.style.setProperty('--rabbit-tx', rDX.toFixed(1) + 'px');
				rRabbit.style.setProperty('--rabbit-ty', rDY.toFixed(1) + 'px');

				/* Raise container z-index lên trên modal trước khi fly */
				var cloudDecor = document.querySelector('.page-cloud-decor');
				if (cloudDecor) cloudDecor.classList.add('rabbit--active');

				/* Stagger nhẹ: trái trước, phải sau 120ms */
				lRabbit.classList.add('rabbit--flying');
				setTimeout(function () {
					rRabbit.classList.add('rabbit--flying');
				}, 120);
			});
		}

		/* Thỏ quay về vị trí ban đầu sau khi bấm "Tiếp tục" trên thư */
		function resetRabbitsHome() {
			var lRabbit = document.querySelector('.page-cloud-decor__rabbit--left');
			var rRabbit = document.querySelector('.page-cloud-decor__rabbit--right');
			var cloudDecor = document.querySelector('.page-cloud-decor');
			if (!lRabbit || !rRabbit) return;

			lRabbit.classList.remove('rabbit--flying');
			rRabbit.classList.remove('rabbit--flying');
			lRabbit.style.removeProperty('--rabbit-tx');
			lRabbit.style.removeProperty('--rabbit-ty');
			rRabbit.style.removeProperty('--rabbit-tx');
			rRabbit.style.removeProperty('--rabbit-ty');

			/* Chờ thỏ về vị trí cũ rồi hạ z-index container */
			setTimeout(function () {
				if (cloudDecor) cloudDecor.classList.remove('rabbit--active');
			}, 1100);
		}
		window.resetRabbitsHomeAfterLetter = resetRabbitsHome;

			function explodeInnerPhotos() {
				if (exploded) return;
				exploded = true;
				cube.classList.add('exploded');
				
				if (ENABLE_PHOTO_HEART_FLOW) {
					// Flow 1: Chờ 3D tách rời lơ lửng 1.5 giây để thấy rõ rồi mới xuất hiện mảng trái tim
					setTimeout(renderExplodedHeart, 1500);
				} else {
					// Flow 2: Delay ngắn trước khi kiểm tra điều kiện thổi nến rồi mở thư
					setTimeout(requestLetterAfterCandle, 900);
				}
			}

			function targetIsAudio(el) {
				return el && el.closest && el.closest('audio');
			}

			applyViewTransform();

			/* Xoay: kéo trên màn hình, trừ khi chạm vào hộp hoặc audio */
			document.addEventListener(
				'pointerdown',
				function (e) {
					if (e.button !== 0 && e.button !== undefined) return;
					if (cube.contains(e.target)) return;
					if (e.target.closest && e.target.closest('#photo-wall')) return;
					if (e.target.closest && e.target.closest('#loveLetter')) return;
					if (e.target.closest && e.target.closest('#letter-modal')) return;
					if (e.target.closest && e.target.closest('#memory-zone')) return;
					if (targetIsAudio(e.target)) return;
					sceneDrag = true;
					startX = e.clientX;
					startY = e.clientY;
					startRotX = rotX;
					startRotY = rotY;
					document.body.classList.add('is-scene-dragging');
					try {
						document.documentElement.setPointerCapture(e.pointerId);
					} catch (err) {}
				},
				true
			);

			document.addEventListener('pointermove', function (e) {
				if (!sceneDrag) return;
				var dx = e.clientX - startX;
				var dy = e.clientY - startY;
				rotY = startRotY + dx * 0.45;
				rotX = startRotX - dy * 0.45;
				applyViewTransform();
			});

			function endSceneDrag(e) {
				if (!sceneDrag) return;
				sceneDrag = false;
				document.body.classList.remove('is-scene-dragging');
				try {
					if (e.pointerId != null) {
						document.documentElement.releasePointerCapture(e.pointerId);
					}
				} catch (err) {}
			}

			document.addEventListener('pointerup', endSceneDrag);
			document.addEventListener('pointercancel', endSceneDrag);

			/* Mở hộp: chỉ nhấn trên hộp (kéo nhẹ vẫn không mở) */
			cube.addEventListener('pointerdown', function (e) {
				if (e.button !== 0 && e.button !== undefined) return;
				cubeGesture = true;
				cubeMoved = false;
				startX = e.clientX;
				startY = e.clientY;
				try {
					cube.setPointerCapture(e.pointerId);
				} catch (err) {}
			});

			cube.addEventListener('pointermove', function (e) {
				if (!cubeGesture) return;
				var dx = e.clientX - startX;
				var dy = e.clientY - startY;
				if (Math.abs(dx) > MOVE_THRESH || Math.abs(dy) > MOVE_THRESH) {
					cubeMoved = true;
				}
			});

			function endCubeGesture(e) {
				if (!cubeGesture) return;
				cubeGesture = false;
				try {
					if (e.pointerId != null) {
						cube.releasePointerCapture(e.pointerId);
					}
				} catch (err) {}
				if (!cubeMoved) {
					if (exploded) return;
					if (cube.classList.contains('open')) {
						/* Flow cắt bánh: zone đang hiển thị → click thứ 2 lên hộp không làm gì.
						   Tim ảnh: sau thư (Tiếp tục) hoặc từ explodeInnerPhotos. */
						var mz = document.getElementById('memory-zone');
						if (mz && mz.classList.contains('is-visible')) return;
						explodeInnerPhotos();
						return;
					}
					openGiftBoxOnly();
				}
			}

			cube.addEventListener('pointerup', endCubeGesture);
			cube.addEventListener('pointercancel', endCubeGesture);

			cube.addEventListener('keydown', function (e) {
				if (e.key === 'Enter' || e.key === ' ') {
					e.preventDefault();
					if (exploded) return;
					if (cube.classList.contains('open')) {
						var mz = document.getElementById('memory-zone');
						if (mz && mz.classList.contains('is-visible')) return;
						explodeInnerPhotos();
					} else {
						openGiftBoxOnly();
					}
				}
			});

			function relayoutExplodedHeart() {
				if (!exploded) return;
				if (letterModalShown) return;
				if (photoWall.classList.contains('photo-wall--collapse')) return;
				if (relayoutTimer) {
					clearTimeout(relayoutTimer);
				}
				relayoutTimer = setTimeout(function () {
					renderExplodedHeart();
					relayoutTimer = null;
				}, 140);
			}

			window.addEventListener('resize', relayoutExplodedHeart);
			window.addEventListener('orientationchange', relayoutExplodedHeart);
		})();

