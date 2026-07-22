/** Ảnh gốc để dán quanh thành bánh 3D */
let MEMORY_IMAGE_SRCS = [
  "./assets/images/1.jpg",
  "./assets/images/2.jpg",
  "./assets/images/3.jpg",
  "./assets/images/4.jpg",
  "./assets/images/5.jpg",
  "./assets/images/6.jpg",
];

/**
 * Local file:// images must not receive crossOrigin="anonymous" or Chromium
 * rejects them before Three.js can upload them as WebGL textures.
 */
function configureMemoryTextureLoader(loader, imageSrc) {
  if (/^https?:\/\//i.test(String(imageSrc || ""))) {
    loader.setCrossOrigin("anonymous");
  } else {
    loader.crossOrigin = undefined;
  }
  return loader;
}

/*
 * Nạp trước (preload) ảnh bánh ngay khi trang mở — KHÔNG đợi mở hộp quà.
 * Nhờ vậy khi hộp mở, Three.js dựng bánh gần như tức thì vì ảnh đã nằm sẵn
 * trong cache trình duyệt.
 *
 * crossOrigin phải khớp với TextureLoader (anonymous cho URL http/https) để
 * request CORS trùng nhau và dùng chung một entry cache.
 */
(function preloadMemoryImages() {
  function warm(urls) {
    if (!Array.isArray(urls)) return;
    urls.forEach(function (src) {
      if (!src) return;
      var img = new Image();
      if (/^https?:\/\//i.test(String(src))) img.crossOrigin = "anonymous";
      img.src = src;
      if (typeof img.decode === "function") {
        img.decode().catch(function () {});
      }
    });
  }

  var ready = window.__PREVIEW_READY__;
  if (ready && typeof ready.then === "function") {
    ready.then(function (pd) {
      warm(
        pd && pd.photoBlobUrls && pd.photoBlobUrls.length
          ? pd.photoBlobUrls
          : MEMORY_IMAGE_SRCS
      );
    });
  } else {
    warm(MEMORY_IMAGE_SRCS);
  }
})();

/**
 * Dựng bánh sinh nhật 3D (Three.js) 2 tầng.
 * - Tầng dưới lớn hơn tầng trên
 * - Mỗi tầng xoay quanh trục Y
 * - Ảnh quanh thành + ảnh tròn trên mỗi tầng + ảnh tròn đáy tầng dưới + nến (trụ ảnh + ngọn lửa) trên đỉnh
 * - Hiển thị khi mở hộp quà lần đầu (revealMemoryZoneOnGiftOpen), không đợi nút Tiếp tục thư
 * - Thổi nến → nhắc cắt. 3 nhát → bánh tách → memory:cake-cuts-complete → mở thư trước → Tiếp tục → tim ảnh → chạm tim mở thư lần 2
 */
function populateMemoryZone() {
  /* Nếu đang ở chế độ preview thì chờ boot xong trước rồi mới dựng bánh */
  if (window.__PREVIEW_READY__) {
    window.__PREVIEW_READY__.then(function (pd) {
      if (pd && pd.photoBlobUrls && pd.photoBlobUrls.length > 0) {
        MEMORY_IMAGE_SRCS = pd.photoBlobUrls;
      }
      _doPopulateMemoryZone();
    });
    return;
  }
  _doPopulateMemoryZone();
}

function _doPopulateMemoryZone() {
  const zone = document.getElementById("memory-zone");
  const stage = document.getElementById("memory-cake-stage");
  const blowBtn = document.getElementById("memory-blow-candle-btn");
  const blowSlot = document.getElementById("memory-blow-slot");
  const cutReminder = document.getElementById("memory-cake-cut-reminder");
  const THREE = window.THREE;
  if (!zone || !stage || !THREE) return;

  if (stage.__memoryCleanup) {
    stage.__memoryCleanup();
    stage.__memoryCleanup = null;
  }

  stage.innerHTML = "";

  const vw = stage.clientWidth || window.innerWidth || 800;
  const vh = stage.clientHeight || window.innerHeight || 600;
  const IS_MOBILE_PORTRAIT = vh > vw && vw <= 920;
  const IS_TOUCH_DEVICE =
    ("ontouchstart" in window) || ((navigator && navigator.maxTouchPoints) || 0) > 0;
  const IS_MOBILE_OR_TABLET = IS_TOUCH_DEVICE && Math.min(vw, vh) <= 1024;

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(vw, vh);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NoToneMapping;
  renderer.toneMappingExposure = 1.0;
  stage.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  let candleBlown = false;
  let blowStartTime = -1;       /* timestamp lúc bắt đầu thổi, dùng cho anim tắt nến */
  const BLOW_ANIM_MS = 1100;    /* tổng thời gian hiệu ứng tắt nến (ms) */

  const SLASH_MIN_PATH_LEN = 92;
  const SLASH_LOCK_PATH_LEN = 28;
  const SLASH_LOCK_SEG_VEL = 0.28;
  const SLASHES_FOR_LETTER = 2;

  let slashUiReadyTimer = 0;
  let slashUiReady = false;
  let slashLetterDone = false;
  let slashUiCleanup = null;
  let slashRaf = 0;

  ["#memory-cake-cut-ui", "#memory-cake-slash-ui"].forEach(function (sel) {
    const el = zone.querySelector(sel);
    if (el) el.remove();
  });

  const slashUi = document.createElement("div");
  slashUi.id = "memory-cake-slash-ui";
  slashUi.className = "memory-cake-slash-ui";
  slashUi.setAttribute("aria-hidden", "true");
  slashUi.innerHTML =
    '<canvas class="memory-cake-slash-canvas" id="memory-cake-slash-canvas" aria-hidden="true"></canvas>';
  zone.appendChild(slashUi);
  const slashCanvas = slashUi.querySelector("#memory-cake-slash-canvas");
  const slashCtx = slashCanvas ? slashCanvas.getContext("2d") : null;

  let slashStrokePts = [];
  let slashLastMoveT = 0;
  let slashGestureStartYaw = 0;
  let slashGestureStartPitch = 0;
  let slashPathLen = 0;
  let slashMaxSegVel = 0;
  let slashLocksRotation = false;
  let slashCommittedPaths = [];
  let slashCountValid = 0;

  function clientToStageLocal(clientX, clientY) {
    const r = stage.getBoundingClientRect();
    return { x: clientX - r.left, y: clientY - r.top };
  }

  function downsampleSlashPoints(pts) {
    if (pts.length <= 72) return pts.slice();
    const step = Math.ceil(pts.length / 72);
    const out = [];
    for (let i = 0; i < pts.length; i += step) out.push(pts[i]);
    if (out[out.length - 1] !== pts[pts.length - 1]) out.push(pts[pts.length - 1]);
    return out;
  }

  function resizeSlashCanvas() {
    if (!slashCanvas || !slashCtx) return;
    const w = stage.clientWidth || window.innerWidth || 800;
    const h = stage.clientHeight || window.innerHeight || 600;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    slashCanvas.width = Math.floor(w * dpr);
    slashCanvas.height = Math.floor(h * dpr);
    slashCanvas.style.width = w + "px";
    slashCanvas.style.height = h + "px";
    slashCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    redrawSlashCanvas();
  }

  function drawStrokeLine(ctx, pts, isLive) {
    if (!pts || pts.length < 2) return;
    ctx.save();
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.shadowColor = isLive ? "rgba(255,255,255,0.85)" : "rgba(255,220,180,0.5)";
    ctx.shadowBlur = isLive ? 14 : 10;
    ctx.strokeStyle = isLive ? "rgba(255,255,255,0.95)" : "rgba(255,248,240,0.88)";
    ctx.lineWidth = isLive ? 5.2 : 4.2;
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
    ctx.stroke();
    ctx.strokeStyle = isLive ? "rgba(255,215,120,0.9)" : "rgba(255,200,90,0.75)";
    ctx.lineWidth = isLive ? 2.1 : 1.7;
    ctx.shadowBlur = 6;
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let j = 1; j < pts.length; j++) ctx.lineTo(pts[j].x, pts[j].y);
    ctx.stroke();
    ctx.restore();
  }

  function redrawSlashCanvas() {
    if (!slashCtx || !slashCanvas) return;
    const w = stage.clientWidth || slashCanvas.width;
    const h = stage.clientHeight || slashCanvas.height;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    slashCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    slashCtx.clearRect(0, 0, w, h);
    for (let c = 0; c < slashCommittedPaths.length; c++) {
      drawStrokeLine(slashCtx, slashCommittedPaths[c].points, false);
    }
    if (slashStrokePts.length >= 2) {
      drawStrokeLine(slashCtx, slashStrokePts, true);
    }
  }

  function scheduleSlashRedraw() {
    if (slashRaf) return;
    slashRaf = requestAnimationFrame(function () {
      slashRaf = 0;
      redrawSlashCanvas();
    });
  }

  let blowBtnReady = false;
  let blowBtnDelayTimer = 0;
  function syncBlowButtonState() {
    if (!blowBtn) return;
    if (candleBlown) {
      blowBtn.style.display = "none";
      blowBtn.setAttribute("aria-hidden", "true");
      if (cutReminder) {
        cutReminder.hidden = false;
        cutReminder.setAttribute("aria-hidden", "false");
      }
      if (blowSlot) blowSlot.classList.add("memory-blow-slot--after-candle");
      return;
    }
    blowBtn.style.display = !blowBtnReady ? "none" : "";
    blowBtn.setAttribute("aria-hidden", !blowBtnReady ? "true" : "false");
    if (cutReminder) {
      cutReminder.hidden = true;
      cutReminder.setAttribute("aria-hidden", "true");
    }
    if (blowSlot) blowSlot.classList.remove("memory-blow-slot--after-candle");
  }
  function activateSlashMode() {
    if (slashLetterDone || slashUiReady) return;
    slashUiReady = true;
    slashCommittedPaths = [];
    slashCountValid = 0;
    slashUi.classList.add("memory-cake-slash-ui--ready");
    slashUi.setAttribute("aria-hidden", "false");
  }

  function onBlowButtonClick() {
    if (!blowBtnReady || candleBlown) return;
    candleBlown = true;
    blowStartTime = -1; /* flame vẫn bình thường — chờ gió đến */
    syncBlowButtonState();

    /* Hiệu ứng cơn gió — xong rồi mới bắt đầu anim tắt nến */
    triggerWindEffect(function () {
      blowStartTime = performance.now();
    });

    window.dispatchEvent(
      new CustomEvent("memory:candle-blown", { detail: { phase: "blow" } })
    );
    activateSlashMode();
  }

  /*
   * Vẽ các vệt gió xám chéo bay ngang qua stage.
   * onArrived() được gọi khi gió chạm đến vùng ngọn nến (~60% thời gian).
   */
  function triggerWindEffect(onArrived) {
    /* Dọn overlay cũ nếu có */
    var old = stage.querySelector('.cake-wind-overlay');
    if (old) old.remove();

    var overlay = document.createElement('div');
    overlay.className = 'cake-wind-overlay';

    /*
     * 6 vệt gió với vị trí, kích thước, delay khác nhau.
     * top: khoảng giữa màn hình (nơi ngọn nến xuất hiện).
     */
    var streaks = [
      { top: 18, h: 4, w: 32, delay:   0, rot: -3, op: 0.60, dur: 520 },
      { top: 23, h: 3, w: 24, delay:  50, rot: -1, op: 0.45, dur: 490 },
      { top: 14, h: 2, w: 18, delay:  80, rot: -4, op: 0.35, dur: 540 },
      { top: 28, h: 3, w: 28, delay:  25, rot:  1, op: 0.50, dur: 505 },
      { top: 10, h: 2, w: 16, delay: 110, rot: -2, op: 0.28, dur: 560 },
      { top: 32, h: 2, w: 22, delay:  65, rot:  2, op: 0.38, dur: 480 },
    ];

    streaks.forEach(function (s) {
      var el = document.createElement('div');
      el.className = 'cake-wind-streak';
      el.style.cssText = [
        'top:'         + s.top + '%',
        'height:'      + s.h   + 'px',
        'width:'       + s.w   + '%',
        '--ws-rot:'    + s.rot + 'deg',
        '--ws-op:'     + s.op,
        '--ws-delay:'  + s.delay + 'ms',
        '--ws-dur:'    + s.dur + 'ms',
      ].join(';');
      overlay.appendChild(el);
    });

    stage.appendChild(overlay);

    /* Gọi callback khi gió đến vùng ngọn nến (~300ms) */
    var arriveTimer = setTimeout(function () {
      if (onArrived) onArrived();
    }, 300);

    /* Dọn overlay sau khi animation kết thúc */
    setTimeout(function () {
      clearTimeout(arriveTimer);
      if (overlay.parentNode) overlay.remove();
    }, 750);
  }
  if (blowBtn) {
    blowBtn.addEventListener("click", onBlowButtonClick);
    blowBtnReady = false;
    syncBlowButtonState();
    blowBtnDelayTimer = window.setTimeout(function () {
      blowBtnDelayTimer = 0;
      blowBtnReady = true;
      syncBlowButtonState();
    }, 5000);
  }

  function tryAcceptSlashStroke() {
    if (slashLetterDone || !slashUiReady || !candleBlown) return;
    if (slashStrokePts.length < 5) return;
    const isSlashGesture = slashPathLen >= SLASH_MIN_PATH_LEN;
    if (!isSlashGesture || !strokeCrossesCake(slashStrokePts)) return;

    userDragYaw = slashGestureStartYaw;
    userDragPitch = slashGestureStartPitch;

    slashCommittedPaths.push({ points: downsampleSlashPoints(slashStrokePts) });
    slashCountValid++;
    slashStrokePts = [];
    slashPathLen = 0;
    slashMaxSegVel = 0;
    slashLocksRotation = false;
    redrawSlashCanvas();

    if (slashCountValid >= SLASHES_FOR_LETTER) {
      startCakeShatterSequence();
    }
  }

  slashUiCleanup = function () {
    if (shatterAnimId) { cancelAnimationFrame(shatterAnimId); shatterAnimId = 0; }
    shatterPieces.forEach(function (p) {
      scene.remove(p.group);
      p.group.traverse(function (obj) {
        if (!obj.isMesh) return;
        [].concat(obj.material).forEach(function (m) { if (m && m.dispose) m.dispose(); });
      });
    });
    shatterPieces = [];
    cakeShatterDone = false;
    cakeRoot.visible = true;
    renderer.localClippingEnabled = false;
    slashUiReady = false;
    slashLetterDone = false;
    slashCommittedPaths = [];
    slashCountValid = 0;
    if (zone) zone.classList.remove("memory-zone--faded");
    if (slashRaf) {
      cancelAnimationFrame(slashRaf);
      slashRaf = 0;
    }
    if (slashUiReadyTimer) {
      window.clearTimeout(slashUiReadyTimer);
      slashUiReadyTimer = 0;
    }
    window.removeEventListener("resize", onSlashResize);
    slashUi.classList.remove("memory-cake-slash-ui--ready", "memory-cake-slash-ui--done");
    const fly = zone.querySelector(".memory-cake-letter-fly");
    if (fly) fly.remove();
    if (slashUi.parentNode === zone) zone.removeChild(slashUi);
    if (blowBtn) {
      if (blowBtnDelayTimer) {
        window.clearTimeout(blowBtnDelayTimer);
        blowBtnDelayTimer = 0;
      }
      blowBtn.removeEventListener("click", onBlowButtonClick);
      blowBtn.disabled = false;
      blowBtn.style.display = "";
      blowBtn.setAttribute("aria-hidden", "false");
      blowBtn.textContent =
        (window.__GIFT_I18N__ && window.__GIFT_I18N__.blowCandle) || "🔥 Thổi nến";
      blowBtnReady = false;
      if (cutReminder) {
        cutReminder.hidden = true;
        cutReminder.setAttribute("aria-hidden", "true");
      }
      if (blowSlot) {
        blowSlot.classList.remove(
          "memory-blow-slot--after-candle",
          "is-hidden-by-tilt"
        );
      }
    }
    slashUiCleanup = null;
  };

  function onSlashResize() {
    resizeSlashCanvas();
  }
  window.addEventListener("resize", onSlashResize);

  candleBlown = false;
  slashLetterDone = false;
  slashUiReady = false;
  window.__memoryCandleBlown = false;
  /* Canvas cắt chỉ hiện SAU KHI thổi nến — xem onBlowButtonClick */
  resizeSlashCanvas();
  const CAM_LOOK_Y = 2.6;
  const camera = new THREE.PerspectiveCamera(38, vw / vh, 0.1, 200);
  camera.position.set(0, 5.6, 15.8);
  camera.lookAt(0, CAM_LOOK_Y, 0);

  const hemi = new THREE.HemisphereLight(0xffffff, 0x3c3240, 0.95);
  scene.add(hemi);
  const key = new THREE.DirectionalLight(0xffffff, 0.95);
  key.position.set(8, 12, 10);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0xfff1d8, 0.35);
  rim.position.set(-10, 4, -8);
  scene.add(rim);

  const cakeRoot = new THREE.Group();
  scene.add(cakeRoot);

  function createTier(radiusTop, radiusBottom, height, y) {
    const tierGroup = new THREE.Group();
    tierGroup.position.y = y;
    cakeRoot.add(tierGroup);

    return tierGroup;
  }

  const LOWER_TIER_H = 3.1;
  const UPPER_TIER_H = 2.35;
  const LOWER_TIER_Y = 1.65;
  const LOWER_TIER_RING_R = 5.18;
  const UPPER_TIER_RING_R = 3.5;
  const LOWER_RING_COUNT = 14;
  const UPPER_RING_COUNT = 10;
  /** arcFill >1 = hơi chồng cung; 1.002/1.005 khít hơn 0.998/1.001, vẫn dưới mức 1.02 từng đè nhiều */
  const RING_PHOTO_ARC_FILL_LOWER = 1.002;
  const RING_PHOTO_ARC_FILL_UPPER = 1.005;

  function ringCardHeight(ringR, count, arcFill) {
    const circumference = 2 * Math.PI * ringR;
    const cardW = Math.max(1.1, (circumference / count) * arcFill);
    return cardW * 1.06;
  }

  const lowerRingCardH = ringCardHeight(
    LOWER_TIER_RING_R,
    LOWER_RING_COUNT,
    RING_PHOTO_ARC_FILL_LOWER
  );
  const upperRingCardH = ringCardHeight(
    UPPER_TIER_RING_R,
    UPPER_RING_COUNT,
    RING_PHOTO_ARC_FILL_UPPER
  );

  /**
   * Tâm mỗi tầng = giữa vòng ảnh (cardH), để đáy ảnh tầng trên khớp đỉnh ảnh tầng dưới.
   */
  const UPPER_TIER_Y =
    LOWER_TIER_Y + lowerRingCardH * 0.5 + upperRingCardH * 0.5;
  let baseCakeRootY = 0;

  const lowerTier = createTier(4.8, 5.1, LOWER_TIER_H, LOWER_TIER_Y);
  const upperTier = createTier(3.25, 3.45, UPPER_TIER_H, UPPER_TIER_Y);
  const lowerTierSpin = new THREE.Group();
  const lowerTierTopStatic = new THREE.Group();
  lowerTier.add(lowerTierSpin);
  lowerTier.add(lowerTierTopStatic);

  const TOP_DISC_OVERHANG = 1.035;
  /** Chỉ đĩa đỉnh tầng dưới — thu nhỏ nhẹ so với vòng ảnh + overhang */
  const LOWER_TOP_DISC_SCALE = 0.978;
  /** Đĩa ảnh mặt đỉnh tầng trên — thu nhỏ nhẹ (nến vẫn đặt trên đỉnh đĩa) */
  const UPPER_TOP_DISC_SCALE = 0.978;
  /** Chỉ đĩa đáy tầng dưới — nhỏ hơn đỉnh cùng tầng một chút */
  const LOWER_BOTTOM_DISC_SCALE = 0.965;
  const LOWER_TOP_DISC_R =
    LOWER_TIER_RING_R * TOP_DISC_OVERHANG * LOWER_TOP_DISC_SCALE;
  const UPPER_TIER_FOOTPRINT_R = 3.45;
  /* Không inscription (null / rỗng) → không vẽ chữ trên vành; không dùng text mẫu */
  let LOWER_TOP_MESSAGE_LINES = [];
  const insRaw =
    window.__PREVIEW_DATA__ && window.__PREVIEW_DATA__.cakeInscription != null
      ? String(window.__PREVIEW_DATA__.cakeInscription).trim()
      : "";
  if (insRaw) {
    LOWER_TOP_MESSAGE_LINES = insRaw
      .split("\n")
      .map(function (s) { return s.trim(); })
      .filter(Boolean)
      .slice(0, 2);
  }

  /**
   * Một ảnh tròn trên đỉnh vòng ảnh (topLocalY = nửa chiều cao thẻ quanh thành).
   */
  function placeSinglePhotoOnTierTop(tierGroup, topLocalY, imageSrc, discRadius) {
    const loader = new THREE.TextureLoader();
    configureMemoryTextureLoader(loader, imageSrc);
    const topY = topLocalY + 0.02;

    const tex = loader.load(imageSrc);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = THREE.ClampToEdgeWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;

    const geo = new THREE.CircleGeometry(discRadius, 80);
    const mat = new THREE.MeshBasicMaterial({
      map: tex,
      side: THREE.DoubleSide
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(0, topY, 0);
    tierGroup.add(mesh);
  }

  /**
   * Một ảnh tròn mặt đáy tầng (đối xứng đỉnh), nhìn rõ từ phía dưới.
   * bottomLocalY = -nửa chiều cao vòng ảnh quanh thành.
   */
  function placeSinglePhotoOnTierBottom(
    tierGroup,
    bottomLocalY,
    imageSrc,
    discRadius
  ) {
    const loader = new THREE.TextureLoader();
    configureMemoryTextureLoader(loader, imageSrc);
    const y = bottomLocalY - 0.02;

    const tex = loader.load(imageSrc);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = THREE.ClampToEdgeWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;

    const geo = new THREE.CircleGeometry(discRadius, 80);
    const mat = new THREE.MeshBasicMaterial({
      map: tex,
      side: THREE.DoubleSide
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.x = Math.PI / 2;
    mesh.position.set(0, y, 0);
    tierGroup.add(mesh);
  }

  function createTopArcTextGeometry(
    innerRadius,
    outerRadius,
    thetaStart,
    thetaLength,
    radialSegs,
    arcSegs,
    THREE
  ) {
    const positions = [];
    const uvs = [];
    const indices = [];

    for (let rStep = 0; rStep <= radialSegs; rStep++) {
      const v = rStep / radialSegs;
      const radius = innerRadius + (outerRadius - innerRadius) * v;
      for (let aStep = 0; aStep <= arcSegs; aStep++) {
        const u = aStep / arcSegs;
        const theta = thetaStart + thetaLength * u;
        positions.push(
          Math.cos(theta) * radius,
          0,
          Math.sin(theta) * radius
        );
        uvs.push(1 - u, 1 - v);
      }
    }

    for (let rStep = 0; rStep < radialSegs; rStep++) {
      for (let aStep = 0; aStep < arcSegs; aStep++) {
        const row = arcSegs + 1;
        const a = rStep * row + aStep;
        const b = a + 1;
        const c = a + row;
        const d = c + 1;
        indices.push(a, c, b, b, c, d);
      }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(positions, 3)
    );
    geo.setAttribute(
      "uv",
      new THREE.Float32BufferAttribute(uvs, 2)
    );
    geo.setIndex(indices);
    geo.computeVertexNormals();
    return geo;
  }

  /**
   * Chữ "viết kem" trên phần vành lộ ra của đỉnh tầng dưới.
   * Mỗi dòng là một dải cung riêng để tránh bị kéo dãn/méo khi map
   * một canvas lớn lên cả bề rộng vành bánh.
   */
  function placeLowerTierTopMessage(tierGroup, topLocalY, innerRadius, outerRadius, lines) {
    const drawLines = Array.isArray(lines) ? lines : [String(lines)];
    if (!drawLines.length) return;
    const ringBand = Math.max(outerRadius - innerRadius, 0.8);
    const usableInnerR = innerRadius + ringBand * 0.12;
    const usableOuterR = outerRadius - ringBand * 0.12;
    const usableBand = usableOuterR - usableInnerR;
    const lineCount = Math.max(1, drawLines.length);
    const lineBand = usableBand / lineCount;
    const thetaLength = Math.PI * 0.58;
    const thetaStart = Math.PI * 0.5 - thetaLength * 0.5;

    drawLines.forEach(function (line, idx) {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const baseFontPx = IS_MOBILE_PORTRAIT ? 180 : 132;
      const minFontPx = IS_MOBILE_PORTRAIT ? 56 : 44;
      const padX = 140;
      const maxCanvasW = 4096;
      const minCanvasW = 1600;
      const canvasH = IS_MOBILE_OR_TABLET ? 300 : 220;
      const fontFamily = IS_MOBILE_OR_TABLET
        ? '"Satisfy", "Segoe Script", "Comic Sans MS", cursive'
        : '"Segoe Script", "Comic Sans MS", cursive';

      let fontPx = baseFontPx;
      function fontCss(px) {
        return "bold " + px + "px " + fontFamily;
      }
      function measureW() {
        ctx.font = fontCss(fontPx);
        return ctx.measureText(line).width;
      }
      let textW = measureW();
      while (textW + padX > maxCanvasW && fontPx > minFontPx) {
        fontPx -= 3;
        textW = measureW();
      }
      canvas.width = Math.min(maxCanvasW, Math.max(minCanvasW, Math.ceil(textW + padX)));
      canvas.height = canvasH;

      ctx.font = fontCss(fontPx);
      while (ctx.measureText(line).width + padX > canvas.width && fontPx > 28) {
        fontPx -= 2;
        ctx.font = fontCss(fontPx);
      }

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.textAlign = "center";
      ctx.textBaseline = "alphabetic";
      ctx.lineJoin = "round";
      ctx.lineCap = "round";
      ctx.font = fontCss(fontPx);

      const cx = canvas.width * 0.5;
      const t = fontPx / baseFontPx;
      const outerStrokeW = (IS_MOBILE_PORTRAIT ? 42 : 34) * t;
      const innerStrokeW = (IS_MOBILE_PORTRAIT ? 24 : 18) * t;
      const shadowBlur = (IS_MOBILE_PORTRAIT ? 22 : 18) * t;
      const metrics = ctx.measureText(line);
      const ascent = metrics.actualBoundingBoxAscent || fontPx * 0.76;
      const descent = metrics.actualBoundingBoxDescent || fontPx * 0.28;
      const verticalBleed = Math.max(8, outerStrokeW * 0.8 + shadowBlur * 0.45);
      /* Canh baseline theo glyph box thực (ascent/descent), không nudge thêm.
         top clearance = bottom clearance = (canvas.height - ascent - descent) / 2
         Stroke/shadow bleed cần nằm trong phần clearance đó nên canvasH đã được
         để đủ rộng (300px mobile, 220px desktop). */
      const baselineY = (canvas.height - ascent - descent) * 0.5 + ascent;

      ctx.strokeStyle = "rgba(172, 69, 118, 0.98)";
      ctx.lineWidth = outerStrokeW;
      ctx.shadowColor = "rgba(140, 52, 95, 0.35)";
      ctx.shadowBlur = shadowBlur;
      ctx.strokeText(line, cx, baselineY);
      ctx.strokeStyle = "rgba(255, 248, 242, 1)";
      ctx.lineWidth = innerStrokeW;
      ctx.strokeText(line, cx, baselineY);
      ctx.shadowBlur = 0;
      ctx.fillStyle = "rgba(210, 86, 140, 1)";
      ctx.fillText(line, cx, baselineY);

      const tex = new THREE.CanvasTexture(canvas);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.wrapS = THREE.ClampToEdgeWrapping;
      tex.wrapT = THREE.ClampToEdgeWrapping;
      tex.minFilter = THREE.LinearFilter;
      tex.magFilter = THREE.LinearFilter;
      tex.needsUpdate = true;

      const lineInnerR = usableInnerR + idx * lineBand + lineBand * 0.08;
      const lineOuterR = usableInnerR + (idx + 1) * lineBand - lineBand * 0.08;
      const geo = createTopArcTextGeometry(
        lineInnerR,
        Math.max(lineInnerR + 0.08, lineOuterR),
        thetaStart,
        thetaLength,
        3,
        120,
        THREE
      );
      const mat = new THREE.MeshBasicMaterial({
        map: tex,
        transparent: true,
        alphaTest: 0.06,
        depthWrite: false,
        side: THREE.DoubleSide
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(0, topLocalY + 0.06 + idx * 0.002, 0);
      mesh.renderOrder = 6 + idx;
      tierGroup.add(mesh);
    });
  }

  /**
   * Thân nến 2D kiểu sticker (giống ảnh tham khảo Pinterest): nền trắng, sọc
   * chéo hồng, viền hồng mảnh, bo góc. Vẽ bằng canvas rồi dán lên Sprite luôn
   * hướng về camera nên nhìn phẳng như hình dán.
   */
  function makeCandleBodyTexture() {
    const w = 128;
    const h = 512;
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    const ctx = c.getContext("2d");

    const pad = 10;
    const bw = w - pad * 2;
    const bh = h - pad * 2;
    const r = bw * 0.28;
    function bodyPath() {
      ctx.beginPath();
      ctx.moveTo(pad + r, pad);
      ctx.lineTo(pad + bw - r, pad);
      ctx.arcTo(pad + bw, pad, pad + bw, pad + r, r);
      ctx.lineTo(pad + bw, pad + bh - r);
      ctx.arcTo(pad + bw, pad + bh, pad + bw - r, pad + bh, r);
      ctx.lineTo(pad + r, pad + bh);
      ctx.arcTo(pad, pad + bh, pad, pad + bh - r, r);
      ctx.lineTo(pad, pad + r);
      ctx.arcTo(pad, pad, pad + r, pad, r);
      ctx.closePath();
    }

    bodyPath();
    ctx.fillStyle = "#ffffff";
    ctx.fill();

    ctx.save();
    bodyPath();
    ctx.clip();
    ctx.strokeStyle = "#f56ea0";
    ctx.lineWidth = bw * 0.5;
    const step = bw * 1.15;
    for (let y = -h; y < h * 2; y += step) {
      ctx.beginPath();
      ctx.moveTo(-bw, y);
      ctx.lineTo(w + bw, y + bw * 2.6);
      ctx.stroke();
    }
    ctx.restore();

    bodyPath();
    ctx.strokeStyle = "#e85891";
    ctx.lineWidth = 5;
    ctx.stroke();

    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  /** Ngọn lửa giọt nước 2D: viền cam, lõi vàng sáng — giống ảnh tham khảo. */
  function makeCandleFlameTexture() {
    const w = 128;
    const h = 192;
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    const ctx = c.getContext("2d");
    const cx = w / 2;

    function teardrop(topY, botY, halfW) {
      ctx.beginPath();
      ctx.moveTo(cx, topY);
      ctx.bezierCurveTo(cx + halfW, topY + (botY - topY) * 0.42, cx + halfW, botY - halfW * 0.2, cx, botY);
      ctx.bezierCurveTo(cx - halfW, botY - halfW * 0.2, cx - halfW, topY + (botY - topY) * 0.42, cx, topY);
      ctx.closePath();
    }

    teardrop(h * 0.06, h * 0.96, w * 0.42);
    ctx.fillStyle = "#ff9f1c";
    ctx.fill();

    teardrop(h * 0.28, h * 0.9, w * 0.26);
    ctx.fillStyle = "#ffd35b";
    ctx.fill();

    teardrop(h * 0.46, h * 0.86, w * 0.14);
    ctx.fillStyle = "#fff4c2";
    ctx.fill();

    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  /**
   * Nến sticker 2D: thân + ngọn lửa đều là Sprite luôn hướng camera (nhìn phẳng
   * như hình dán). Ngọn lửa vẫn được animate bập bùng qua candleFlames.
   */
  function placeBirthdayCandle(
    tierGroup,
    baseY,
    candleH,
    candleR
  ) {
    tierGroup.userData = tierGroup.userData || {};
    tierGroup.userData.candleFlames = [];
    tierGroup.userData.candleR = candleR;

    const bodyW = candleR * 2.4;
    const bodyMat = new THREE.SpriteMaterial({
      map: makeCandleBodyTexture(),
      transparent: true,
      depthWrite: false
    });
    const bodySprite = new THREE.Sprite(bodyMat);
    bodySprite.scale.set(bodyW, candleH, 1);
    bodySprite.position.set(0, baseY + candleH * 0.5, 0);
    bodySprite.renderOrder = 5;
    tierGroup.add(bodySprite);

    const candleTopY = baseY + candleH;
    const flameRoot = new THREE.Group();
    flameRoot.position.set(0, candleTopY, 0);
    tierGroup.add(flameRoot);

    const flameW = candleR * 2.6;
    const flameH = candleR * 3.9;
    const flameMat = new THREE.SpriteMaterial({
      map: makeCandleFlameTexture(),
      transparent: true,
      depthWrite: false
    });
    const flameSprite = new THREE.Sprite(flameMat);
    flameSprite.renderOrder = 8;
    const oy = flameH * 0.5;
    flameSprite.position.set(0, oy, 0);
    flameSprite.scale.set(flameW, flameH, 1);
    flameSprite.userData.flame = {
      bx: 0,
      by: oy,
      bz: 0,
      sx: flameW,
      sy: flameH,
      sz: 1,
      bop: 0.98,
      px: Math.random() * Math.PI * 2,
      py: Math.random() * Math.PI * 2,
      pz: Math.random() * Math.PI * 2,
      f1: 6.5 + Math.random() * 6,
      f2: 11 + Math.random() * 10,
      f3: 17 + Math.random() * 12,
      f4: 23 + Math.random() * 9,
      f5: 31 + Math.random() * 7
    };
    flameRoot.add(flameSprite);
    tierGroup.userData.candleFlames.push(flameSprite);
  }

  const nImg = MEMORY_IMAGE_SRCS.length;
  /** Cùng một ảnh cho đỉnh tầng dưới, đáy tầng dưới và đỉnh tầng trên. */
  const discSharedSrc = nImg > 0 ? MEMORY_IMAGE_SRCS[0] : null;
  if (discSharedSrc) {
    placeSinglePhotoOnTierTop(
      lowerTierTopStatic,
      lowerRingCardH * 0.5,
      discSharedSrc,
      LOWER_TOP_DISC_R
    );
    placeSinglePhotoOnTierBottom(
      lowerTierSpin,
      -lowerRingCardH * 0.5,
      discSharedSrc,
      LOWER_TIER_RING_R * TOP_DISC_OVERHANG * LOWER_BOTTOM_DISC_SCALE
    );
    placeSinglePhotoOnTierTop(
      upperTier,
      upperRingCardH * 0.5,
      discSharedSrc,
      UPPER_TIER_RING_R * TOP_DISC_OVERHANG * UPPER_TOP_DISC_SCALE
    );
    if (LOWER_TOP_MESSAGE_LINES.length) {
      placeLowerTierTopMessage(
        lowerTierTopStatic,
        lowerRingCardH * 0.5,
        UPPER_TIER_FOOTPRINT_R + 0.04,
        LOWER_TOP_DISC_R,
        LOWER_TOP_MESSAGE_LINES
      );
    }
  }

  const upperDiscTopLocalY = upperRingCardH * 0.5 + 0.02;
  placeBirthdayCandle(
    upperTier,
    upperDiscTopLocalY + 0.018,
    1.42,
    0.13
  );

  /**
   * Ảnh dán trên dải mặt trụ (cylinder) — cong theo chu vi thật, không còn mặt phẳng gấp khúc.
   * arcLen ≈ độ dài cung mỗi tấm; dTheta = arcLen/rr; trục Y trùng trục tầng.
   */
  /*
   * Gán ảnh cho các thẻ quanh bánh theo kiểu round-robin trên một danh sách đã
   * xáo trộn (dùng chung cho cả 2 tầng) — đảm bảo MỌI ảnh đều xuất hiện và phân
   * bố đều, thay vì random gây trùng lặp và bỏ sót ảnh.
   */
  const ringPhotoPool = MEMORY_IMAGE_SRCS.slice();
  for (let s = ringPhotoPool.length - 1; s > 0; s--) {
    const j = Math.floor(Math.random() * (s + 1));
    const tmp = ringPhotoPool[s];
    ringPhotoPool[s] = ringPhotoPool[j];
    ringPhotoPool[j] = tmp;
  }
  let ringPhotoCursor = 0;

  function placePhotosAroundTier(tierGroup, radius, height, count, offset, arcFill) {
    const loader = new THREE.TextureLoader();
    configureMemoryTextureLoader(loader, MEMORY_IMAGE_SRCS[0]);
    const circumference = 2 * Math.PI * radius;
    const arcLen = Math.max(1.1, (circumference / count) * arcFill);
    const cardH = arcLen * 1.06;
    const rr = radius + 0.02;
    const segsAlongArc = Math.max(
      10,
      Math.min(28, Math.round(8 + arcLen * 2.2))
    );

    for (let i = 0; i < count; i++) {
      const photo = ringPhotoPool.length
        ? ringPhotoPool[ringPhotoCursor++ % ringPhotoPool.length]
        : MEMORY_IMAGE_SRCS[0];
      const tex = loader.load(photo);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.wrapS = THREE.ClampToEdgeWrapping;
      tex.wrapT = THREE.ClampToEdgeWrapping;

      const mat = new THREE.MeshBasicMaterial({
        map: tex,
        side: THREE.DoubleSide
      });

      const a = (Math.PI * 2 * i) / count + offset;
      const dTheta = arcLen / rr;
      const thetaStart = a - dTheta * 0.5;

      const geo = new THREE.CylinderGeometry(
        rr,
        rr,
        cardH,
        segsAlongArc,
        1,
        true,
        thetaStart,
        dTheta
      );
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.y = 0;
      tierGroup.add(mesh);
    }
  }

  placePhotosAroundTier(
    lowerTierSpin,
    LOWER_TIER_RING_R,
    LOWER_TIER_H,
    LOWER_RING_COUNT,
    0.08,
    RING_PHOTO_ARC_FILL_LOWER
  );
  placePhotosAroundTier(
    upperTier,
    UPPER_TIER_RING_R,
    UPPER_TIER_H,
    UPPER_RING_COUNT,
    0.21,
    RING_PHOTO_ARC_FILL_UPPER
  );

  /**
   * Màn dọc: thu scale + dịch Y để tâm bánh trùng CAM_LOOK_Y (scale từ gốc làm lệch dọc).
   * Màn ngang: scale 1, không offset.
   */
  function refreshStageViewport(w, h) {
    renderer.setSize(w, h);
    camera.aspect = w / h;
    const portrait = h > w;
    const ar = w / h;
    if (portrait) {
      const s = Math.max(0.42, Math.min(0.64, ar * 0.98));
      cakeRoot.scale.setScalar(s);
      const visualMidY = (LOWER_TIER_Y + UPPER_TIER_Y) * 0.5;
      baseCakeRootY = CAM_LOOK_Y - s * visualMidY;
    } else {
      const mobileLandscape = Math.min(w, h) <= 500;
      cakeRoot.scale.setScalar(mobileLandscape ? 0.68 : 0.85);
      baseCakeRootY = 0;
    }
    cakeRoot.position.y = baseCakeRootY;
    camera.updateProjectionMatrix();
  }

  refreshStageViewport(vw, vh);
  resizeSlashCanvas();

  /* Nét cắt: raycast vào mesh bánh (theo góc nhìn), không dùng ellipse 2D — tránh lật bánh rồi vẫn “cắt” chỗ trống. */
  const cakeSlashTargets = [];
  function refreshCakeSlashTargets() {
    cakeSlashTargets.length = 0;
    cakeRoot.traverse(function (obj) {
      if (!obj.isMesh || !obj.geometry) return;
      if (obj.userData && obj.userData.flame) return;
      cakeSlashTargets.push(obj);
    });
  }
  refreshCakeSlashTargets();

  const slashRaycaster = new THREE.Raycaster();
  const _slashNdc = new THREE.Vector2();

  function stageLocalToSlashNdc(p) {
    const w = stage.clientWidth || 1;
    const h = stage.clientHeight || 1;
    _slashNdc.set((p.x / w) * 2 - 1, -(p.y / h) * 2 + 1);
    return _slashNdc;
  }

  function strokeCrossesCake(pts) {
    if (!pts || pts.length < 2) return false;
    const w = stage.clientWidth || 1;
    const h = stage.clientHeight || 1;
    const minDim = Math.min(w, h);

    cakeRoot.updateWorldMatrix(true, true);
    const hits = new Array(pts.length);
    for (let i = 0; i < pts.length; i++) {
      slashRaycaster.setFromCamera(stageLocalToSlashNdc(pts[i]), camera);
      hits[i] = slashRaycaster.intersectObjects(cakeSlashTargets, false).length > 0;
    }

    let prev = hits[0];
    for (let j = 1; j < hits.length; j++) {
      if (hits[j] !== prev) return true;
      prev = hits[j];
    }
    let allHit = true;
    for (let k = 0; k < hits.length; k++) {
      if (!hits[k]) {
        allHit = false;
        break;
      }
    }
    if (!allHit) return false;

    const minSpan = minDim * 0.12;
    let maxSpan = 0;
    const n = pts.length;
    for (let a = 0; a < n && maxSpan < minSpan * 1.05; a++) {
      for (let b = a + 1; b < n; b++) {
        const d = Math.hypot(pts[a].x - pts[b].x, pts[a].y - pts[b].y);
        if (d > maxSpan) maxSpan = d;
      }
    }
    return maxSpan >= minSpan;
  }

  /** Zoom camera: >1 = gần hơn (bánh to). Chuột: wheel; cảm ứng: pinch 2 ngón. */
  const BASE_CAM_Z = 15.8;
  const BASE_CAM_Y = 5.6;
  let userZoom = 1;
  const ZOOM_MIN = 0.4;
  const ZOOM_MAX = 2.85;

  function applyUserCameraZoom() {
    userZoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, userZoom));
    camera.position.z = BASE_CAM_Z / userZoom;
    camera.position.y = BASE_CAM_Y;
    camera.position.x = 0;
    camera.lookAt(0, CAM_LOOK_Y, 0);
  }

  // Kéo 1 ngón xoay; 2 ngón pinch zoom
  let dragActive = false;
  let rotatePointerId = null;
  let dragStartX = 0;
  let dragStartY = 0;
  let baseRootRotY = 0;
  let baseRootRotX = 0;
  let userDragYaw = 0;
  let userDragPitch = 0;
  const dragScaleYaw = 0.0076;
  const dragScalePitch = 0.005;
  const PITCH_LIMIT = 0.87;

  const pointers = new Map();
  let pinchDist0 = 0;
  let zoomAtPinchStart = 1;

  function pinchDistance() {
    const arr = Array.from(pointers.values());
    if (arr.length < 2) return 0;
    return Math.hypot(arr[1].x - arr[0].x, arr[1].y - arr[0].y);
  }

  function onPointerDown(e) {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pointers.size === 2) {
      dragActive = false;
      pinchDist0 = pinchDistance();
      zoomAtPinchStart = userZoom;
      if (rotatePointerId != null) {
        try {
          stage.releasePointerCapture(rotatePointerId);
        } catch (err) {}
        rotatePointerId = null;
      }
      return;
    }

    if (pointers.size === 1) {
      dragActive = true;
      rotatePointerId = e.pointerId;
      dragStartX = e.clientX;
      dragStartY = e.clientY;
      baseRootRotY = userDragYaw;
      baseRootRotX = userDragPitch;
      /* Chỉ ghi nét khi đã thổi nến (slashUiReady) */
      if (slashUiReady && !slashLetterDone) {
        slashGestureStartYaw = userDragYaw;
        slashGestureStartPitch = userDragPitch;
        slashStrokePts = [clientToStageLocal(e.clientX, e.clientY)];
        slashLastMoveT = performance.now();
        slashPathLen = 0;
        slashMaxSegVel = 0;
        slashLocksRotation = false;
      } else {
        slashStrokePts = [];
        slashPathLen = 0;
        slashMaxSegVel = 0;
        slashLocksRotation = false;
      }
      try {
        stage.setPointerCapture(e.pointerId);
      } catch (err) {}
    }
  }

  function onPointerMove(e) {
    if (!pointers.has(e.pointerId)) return;
    const pt = pointers.get(e.pointerId);
    pt.x = e.clientX;
    pt.y = e.clientY;

    if (pointers.size >= 2) {
      e.preventDefault();
      const dist = pinchDistance();
      if (pinchDist0 > 6 && dist > 0) {
        userZoom = zoomAtPinchStart * (dist / pinchDist0);
        applyUserCameraZoom();
      }
      return;
    }

    if (!dragActive) return;
    /* Chỉ thu điểm và vẽ nét khi chế độ cắt đã kích hoạt */
    if (slashUiReady && !slashLetterDone && slashStrokePts.length) {
      const loc = clientToStageLocal(e.clientX, e.clientY);
      const last = slashStrokePts[slashStrokePts.length - 1];
      const seg = Math.hypot(loc.x - last.x, loc.y - last.y);
      if (seg > 0.4) {
        slashPathLen += seg;
        slashStrokePts.push(loc);
        const now = performance.now();
        const dt = Math.max(1, now - slashLastMoveT);
        slashMaxSegVel = Math.max(slashMaxSegVel, seg / dt);
        slashLastMoveT = now;
        slashLocksRotation =
          slashPathLen > SLASH_LOCK_PATH_LEN &&
          slashMaxSegVel > SLASH_LOCK_SEG_VEL;
        scheduleSlashRedraw();
      }
    }
    if (slashLocksRotation) return;
    const dx = e.clientX - dragStartX;
    const dy = e.clientY - dragStartY;
    userDragYaw = baseRootRotY + dx * dragScaleYaw;
    userDragPitch = Math.max(
      -PITCH_LIMIT,
      Math.min(PITCH_LIMIT, baseRootRotX + dy * dragScalePitch)
    );
  }

  function onPointerUp(e) {
    pointers.delete(e.pointerId);
    if (pointers.size < 2) {
      pinchDist0 = 0;
    }

    if (e.pointerId === rotatePointerId) {
      tryAcceptSlashStroke();
      slashStrokePts = [];
      slashPathLen = 0;
      slashMaxSegVel = 0;
      slashLocksRotation = false;
      scheduleSlashRedraw();
      dragActive = false;
      rotatePointerId = null;
      try {
        if (e.pointerId != null) stage.releasePointerCapture(e.pointerId);
      } catch (err) {}
    }

    if (pointers.size === 1) {
      const id = pointers.keys().next().value;
      const p = pointers.get(id);
      dragActive = true;
      rotatePointerId = id;
      dragStartX = p.x;
      dragStartY = p.y;
      baseRootRotY = userDragYaw;
      baseRootRotX = userDragPitch;
      if (slashUiReady && !slashLetterDone) {
        slashGestureStartYaw = userDragYaw;
        slashGestureStartPitch = userDragPitch;
        slashStrokePts = [clientToStageLocal(p.x, p.y)];
        slashLastMoveT = performance.now();
        slashPathLen = 0;
        slashMaxSegVel = 0;
        slashLocksRotation = false;
      } else {
        slashStrokePts = [];
        slashPathLen = 0;
        slashMaxSegVel = 0;
        slashLocksRotation = false;
      }
      try {
        stage.setPointerCapture(id);
      } catch (err) {}
    }
  }

  function onWheel(e) {
    e.preventDefault();
    const dy = e.deltaMode === 1 ? e.deltaY * 12 : e.deltaY;
    userZoom *= Math.exp(-dy * 0.0014);
    applyUserCameraZoom();
  }

  stage.addEventListener("pointerdown", onPointerDown);
  stage.addEventListener("pointermove", onPointerMove);
  stage.addEventListener("pointerup", onPointerUp);
  stage.addEventListener("pointercancel", onPointerUp);
  stage.addEventListener("wheel", onWheel, { passive: false });

  let rafId = 0;
  const clock = new THREE.Clock();
  const SPIN_ROOT_Y = 0.2;
  const SPIN_LOWER_TIER_Y = 0.078;
  const SPIN_UPPER_TIER_Y = 0.085;

  let cakeShatterDone = false;
  let shatterPieces = [];
  let shatterAnimId = 0;

  /* ── Chiếu điểm màn hình → giao với mặt phẳng y=yPlane trong world space ── */
  function screenToWorldXZ(sx, sy, yPlane) {
    const w = stage.clientWidth || 800;
    const h = stage.clientHeight || 600;
    const ndcX = (sx / w) * 2 - 1;
    const ndcY = -(sy / h) * 2 + 1;
    const vec = new THREE.Vector3(ndcX, ndcY, 0.5).unproject(camera);
    const dir = vec.clone().sub(camera.position).normalize();
    if (Math.abs(dir.y) < 1e-6) return null;
    const t = (yPlane - camera.position.y) / dir.y;
    return new THREE.Vector3(
      camera.position.x + dir.x * t,
      yPlane,
      camera.position.z + dir.z * t
    );
  }

  /* ── Normal của mặt phẳng cắt (thẳng đứng qua trục Y) từ đường vuốt ── */
  function computeCutNormal(path) {
    if (!path || path.length < 2) return null;
    const yMid = (LOWER_TIER_Y + UPPER_TIER_Y) / 2;
    const w0 = screenToWorldXZ(path[0].x, path[0].y, yMid);
    const w1 = screenToWorldXZ(path[path.length - 1].x, path[path.length - 1].y, yMid);
    if (!w0 || !w1) return null;
    const dx = w1.x - w0.x;
    const dz = w1.z - w0.z;
    const len = Math.sqrt(dx * dx + dz * dz);
    if (len < 1e-4) return null;
    /* Chiều vuốt là (dx,dz); normal của mặt cắt vuông góc với chiều đó trong XZ */
    return new THREE.Vector3(-dz / len, 0, dx / len);
  }

  function startCakeShatterSequence() {
    if (slashLetterDone) return;
    slashLetterDone = true;
    cakeShatterDone = true;

    /* ── 1. Tính góc vết cắt (world space) ─────────────────────────────── */
    const TWO_PI = Math.PI * 2;
    const cutNormals = slashCommittedPaths.map(function (p) {
      return computeCutNormal(p.points || p);
    }).filter(Boolean);

    const rawAngles = [];
    cutNormals.forEach(function (n) {
      let a = Math.atan2(-n.z, n.x), b = a + Math.PI;
      if (a < 0) a += TWO_PI; if (b < 0) b += TWO_PI;
      if (b >= TWO_PI) b -= TWO_PI;
      rawAngles.push(a, b);
    });
    rawAngles.sort(function (a, b) { return a - b; });
    const cutAngles = rawAngles.length ? [rawAngles[0]] : [];
    for (let i = 1; i < rawAngles.length; i++) {
      if (rawAngles[i] - rawAngles[i - 1] > 0.15) cutAngles.push(rawAngles[i]);
    }
    if (cutAngles.length < 2) {
      cutAngles.length = 0;
      for (let i = 0; i < 6; i++) cutAngles.push(i * Math.PI / 3);
    }

    /* ── 2. Thu thập meshes cùng góc world của chúng ──────────────────── */
    cakeRoot.updateWorldMatrix(true, true);
    const cakeWorldInv = cakeRoot.matrixWorld.clone().invert();
    const originPos = cakeRoot.position.clone();
    const originRot = cakeRoot.rotation.clone();
    const originRotY = originRot.y;

    function primaryMeshMaterial(mesh) {
      const m = mesh.material;
      if (!m) return null;
      return Array.isArray(m) ? m[0] || null : m;
    }

    const meshInfos = [];
    cakeRoot.traverse(function (obj) {
      if (!obj.isMesh) return;
      obj.updateWorldMatrix(true, false);

      let worldAngle = null;
      const geo = obj.geometry;
      const params = geo && geo.parameters;

      /*
       * Ring cards là CylinderGeometry có thetaStart + thetaLength trong params.
       * Mesh pivot của chúng nằm tại (0,0,0) nên không thể dùng mesh.position để
       * xác định góc. Thay vào đó: chiếu điểm tâm arc của geometry ra world space.
       */
      const ringMatProbe = primaryMeshMaterial(obj);
      if (params && params.thetaStart !== undefined && params.thetaLength !== undefined
          && ringMatProbe && ringMatProbe.map && ringMatProbe.map.isTexture) {
        const thetaCenter = params.thetaStart + params.thetaLength * 0.5;
        const r = params.radiusTop || params.radiusBottom || 1;
        const localPt = new THREE.Vector3(
          Math.sin(thetaCenter) * r, 0, Math.cos(thetaCenter) * r
        );
        const worldPt = localPt.applyMatrix4(obj.matrixWorld);
        const d = Math.sqrt(worldPt.x * worldPt.x + worldPt.z * worldPt.z);
        if (d > 0.8) {
          worldAngle = Math.atan2(worldPt.x, worldPt.z);
          if (worldAngle < 0) worldAngle += TWO_PI;
        }
      } else {
        /* Với mesh không phải ring card: dùng world position như cũ */
        const wp = new THREE.Vector3();
        obj.getWorldPosition(wp);
        const dist = Math.sqrt(wp.x * wp.x + wp.z * wp.z);
        if (dist > 0.8) {
          worldAngle = Math.atan2(wp.x, wp.z);
          if (worldAngle < 0) worldAngle += TWO_PI;
        }
      }

      meshInfos.push({ mesh: obj, worldAngle: worldAngle, worldMat: obj.matrixWorld.clone() });
    });

    function inSector(angle, θStart, θLen) {
      if (angle === null) return false;
      const a = ((angle - θStart) % TWO_PI + TWO_PI) % TWO_PI;
      return a <= θLen + 0.02; /* nhỏ tolerance cho card gần biên */
    }

    /* Góc nằm trong phần “lõi” của sector (cách hai mép cắt một chút) — dùng lọc cung ảnh */
    function angleInSectorInterior(angle, θStart, θLen, insetMax) {
      if (angle === null) return false;
      const a = ((angle - θStart) % TWO_PI + TWO_PI) % TWO_PI;
      const ins = Math.min(insetMax, Math.max(0.006, θLen * 0.18));
      if (θLen <= ins * 2 + 0.02) return inSector(angle, θStart, θLen);
      return a >= ins && a <= θLen - ins + 1e-6;
    }

    /* Cả cung ảnh phải nằm trong wedge — tránh clone card chỉ khớp tâm mà hai mép vẫn nhô ra ngoài khối */
    function ringArcFullyInSector(mesh, params, θStart, θLen) {
      if (!params || params.thetaStart === undefined || params.thetaLength === undefined) {
        return true;
      }
      const r0 = params.radiusTop || params.radiusBottom || 1;
      const inset = 0.055;
      const steps = 7;
      for (let s = 0; s < steps; s++) {
        const t = params.thetaStart + (params.thetaLength * s) / (steps - 1);
        const lv = new THREE.Vector3(
          Math.sin(t) * r0,
          0,
          Math.cos(t) * r0
        );
        lv.applyMatrix4(mesh.matrixWorld);
        const ang = Math.atan2(lv.x, lv.z);
        const un = ang < 0 ? ang + TWO_PI : ang;
        if (!angleInSectorInterior(un, θStart, θLen, inset)) return false;
      }
      return true;
    }

    /*
     * Tìm material của top disc gốc (disc ảnh trên đỉnh tầng, có map texture,
     * nằm gần trục Y — dùng cho mặt trên/dưới của mỗi miếng).
     */
    let lowerTopDiscMat = null;
    let upperTopDiscMat = null;
    meshInfos.forEach(function (info) {
      if (info.worldAngle !== null) return; /* chỉ lấy mesh trung tâm */
      const mat = primaryMeshMaterial(info.mesh);
      if (!mat || !mat.map || !mat.map.isTexture) return; /* phải có texture thật, không phải material[] */
      const wp = new THREE.Vector3();
      info.mesh.getWorldPosition(wp);
      /* Phân biệt tầng trên/dưới theo độ cao world */
      if (!lowerTopDiscMat && wp.y < originPos.y + LOWER_TIER_Y + LOWER_TIER_H) {
        lowerTopDiscMat = mat;
      } else if (!upperTopDiscMat) {
        upperTopDiscMat = mat;
      }
    });

    /* Vật liệu phần lõi đặc */
    const matSolid = new THREE.MeshStandardMaterial({ color: 0xf0ddb0, roughness: 0.82, metalness: 0 });

    /*
     * Tra cứu ring card có texture gần nhất góc → dùng cho mặt cắt.
     * Clone material + set DoubleSide để không ảnh hưởng ring card gốc.
     */
    const ringTexMeshes = [];
    meshInfos.forEach(function (info) {
      if (info.worldAngle === null) return;
      const mat = primaryMeshMaterial(info.mesh);
      if (mat && mat.map && mat.map.isTexture) ringTexMeshes.push({ angle: info.worldAngle, mat: mat });
    });

    /* Tìm ring card material gần nhất góc (không clone) */
    function findNearestRingMat(worldAngle) {
      if (!ringTexMeshes.length) return null;
      let best = null, bestD = Infinity;
      ringTexMeshes.forEach(function (item) {
        let d = Math.abs(item.angle - worldAngle) % TWO_PI;
        if (d > Math.PI) d = TWO_PI - d;
        if (d < bestD) { bestD = d; best = item.mat; }
      });
      return best;
    }

    /* Clone + tune material để dùng làm mặt ảnh trên khối bánh */
    function makePhotoMat(srcMat, doubleSide) {
      let m0 = srcMat;
      if (Array.isArray(m0)) m0 = m0[0];
      if (!m0 || typeof m0.clone !== "function") return matSolid;
      const m = m0.clone();
      m.roughness = 0.55;
      m.metalness = 0.0;
      if (doubleSide) m.side = THREE.DoubleSide;
      return m;
    }

    /* ── 3. Tạo từng miếng bánh ─────────────────────────────────────────── */
    shatterPieces = [];
    const numSectors = cutAngles.length;

    for (let i = 0; i < numSectors; i++) {
      const θStart = cutAngles[i];
      let θEnd = cutAngles[(i + 1) % numSectors];
      if (θEnd <= θStart) θEnd += TWO_PI;
      const θLen = θEnd - θStart;
      if (θLen < 0.05) continue;

      const centerθ = θStart + θLen / 2;
      const flyDir = new THREE.Vector3(Math.sin(centerθ), 0, Math.cos(centerθ));
      /* Góc local (trừ đi rotation của cakeRoot để đặt vào group local space) */
      const θSL = θStart - originRotY;
      const θEL = θEnd - originRotY;

      const grp = new THREE.Group();
      grp.position.copy(originPos);
      grp.rotation.copy(originRot);
      /* Miếng bánh dùng geometry ở toạ độ local của cakeRoot (chưa scale). Phải
       * copy luôn scale của cakeRoot, nếu không trên mobile (cake thu nhỏ ~0.45)
       * các miếng sẽ hiện to gấp ~2 lần và tràn màn hình khi cắt bánh. */
      grp.scale.copy(cakeRoot.scale);

      /* Bán kính lõi kem sector vs vỏ ảnh quanh thành (rr = RING_R + 0.02) — cần trước khi clone ring */
      const lR = LOWER_TIER_RING_R * 0.93;
      const uR = UPPER_TIER_RING_R * 0.93;
      const lowerPhotoR = LOWER_TIER_RING_R + 0.02;
      const upperPhotoR = UPPER_TIER_RING_R + 0.02;

      /* a) Clone ring card — chỉ khi cả cung nằm trong wedge; co XZ thêm để không lọt ngoài kem */
      meshInfos.forEach(function (info) {
        if (!inSector(info.worldAngle, θStart, θLen)) return;
        const rp0 = info.mesh.geometry && info.mesh.geometry.parameters;
        if (rp0 && rp0.thetaStart !== undefined && !ringArcFullyInSector(info.mesh, rp0, θStart, θLen)) {
          return;
        }
        const srcMat = Array.isArray(info.mesh.material)
          ? info.mesh.material[0]
          : info.mesh.material;
        const matClone = srcMat.clone();
        matClone.polygonOffset = true;
        matClone.polygonOffsetFactor = -0.35;
        matClone.polygonOffsetUnits = 0.35;
        const m = new THREE.Mesh(info.mesh.geometry, matClone);
        m.matrix.multiplyMatrices(cakeWorldInv, info.worldMat);
        const rp = info.mesh.geometry && info.mesh.geometry.parameters;
        const rMesh = rp && (rp.radiusTop || rp.radiusBottom);
        if (rp && rp.thetaStart !== undefined && rMesh) {
          let sXZ = 1;
          if (Math.abs(rMesh - lowerPhotoR) < 0.2) sXZ = (lR * 0.985) / lowerPhotoR;
          else if (Math.abs(rMesh - upperPhotoR) < 0.15) sXZ = (uR * 0.985) / upperPhotoR;
          if (sXZ < 0.999) {
            m.matrix.multiply(new THREE.Matrix4().makeScale(sXZ, 1, sXZ));
          }
        }
        m.matrixAutoUpdate = false;
        grp.add(m);
      });

      /*
       * b) Lõi cylinder đặc — tất cả 5 mặt đều có ảnh:
       *   group 0 = mặt ngoài cong  → ảnh ring card tâm sector
       *   group 1 = mặt trên (cap)  → ảnh top disc (nếu có) hoặc ring card
       *   group 2 = mặt dưới (cap)  → ảnh ring card tâm sector
       * Mặt cắt (2 PlaneGeometry) → ảnh ring card gần vết cắt (phần c)
       */
      /* Material ảnh đại diện cho sector này (tâm sector) */
      const sectorSrcMat = findNearestRingMat(centerθ);
      const outerMat  = makePhotoMat(sectorSrcMat, false);
      const bottomMat = makePhotoMat(sectorSrcMat, false);
      [
        [lR, LOWER_TIER_H, LOWER_TIER_Y, 40, lowerTopDiscMat, 'lower'],
        [uR, UPPER_TIER_H, UPPER_TIER_Y, 32, upperTopDiscMat, 'upper'],
      ].forEach(function (cfg) {
        const r = cfg[0], h = cfg[1], y = cfg[2], segs = cfg[3], discMat = cfg[4], tier = cfg[5];
        const geo = new THREE.CylinderGeometry(r, r, h, segs, 1, false, θSL, θLen);
        const topMat = makePhotoMat(discMat || sectorSrcMat, false);
    
        const mesh = new THREE.Mesh(geo, [outerMat, topMat, bottomMat]);
        mesh.position.y = y;
        grp.add(mesh);
      });

      /* c) Mặt cắt — gán ảnh ring card gần nhất góc vết cắt */
      [θSL, θEL].forEach(function (θ) {
        /*
         * Plane mặc định nằm XY, cạnh rộng theo +X. Cần +X local → hướng bán kính (sin θ, 0, cos θ).
         * R_y(β).xAxis = (cos β, 0, -sin β) = radial ⇒ β = atan2(-cos θ, sin θ).
         * (π/2 - θ chỉ đúng một phần góc — dễ lệch 180° / xìa texture ra ngoài mép cắt.)
         */
        const capRotY = Math.atan2(-Math.cos(θ), Math.sin(θ));
        const cutSrc = findNearestRingMat(θ + originRotY);
        const faceMat = makePhotoMat(cutSrc, false);
        faceMat.side = THREE.FrontSide;
        faceMat.polygonOffset = true;
        faceMat.polygonOffsetFactor = 0.6;
        faceMat.polygonOffsetUnits = 0.5;

        [
          [lR, LOWER_TIER_H, LOWER_TIER_Y],
          [uR, UPPER_TIER_H, UPPER_TIER_Y],
        ].forEach(function (cfg, tierIdx) {
          const r = cfg[0], h = cfg[1], y = cfg[2];
          const pw = r * 0.94;
          const ph = h * 0.982;
          const radialMid = r * 0.5 - 0.08;
          const cx = Math.sin(θ) * radialMid;
          const cz = Math.cos(θ) * radialMid;
          const face = new THREE.Mesh(new THREE.PlaneGeometry(pw, ph), faceMat);
          face.position.set(cx, y, cz);
          face.rotation.y = capRotY;
          grp.add(face);
        });
      });

      scene.add(grp);
      /* Trục tiếp tuyến mặt tròn (vuông góc bán kính trong XZ): mỗi sector ngả theo hướng riêng */
      const tiltAxis = new THREE.Vector3(flyDir.z, 0, -flyDir.x);
      if (tiltAxis.lengthSq() < 1e-10) tiltAxis.set(1, 0, 0);
      else tiltAxis.normalize();

      shatterPieces.push({
        group: grp,
        planes: [],
        flyDir: flyDir,
        tiltAxis: tiltAxis.clone(),
        ox: originPos.x,
        oz: originPos.z,
        spinX: (Math.random() - 0.5) * 0.2,
        spinZ: (Math.random() - 0.5) * 0.17,
        spinY: (Math.random() - 0.5) * 0.07,
      });
    }

    cakeRoot.visible = false;
    renderer.localClippingEnabled = false;

    /* ── 3. Mờ UI ────────────────────────────────────────────────────────── */
    window.setTimeout(function () {
      if (slashUi) slashUi.classList.add("memory-cake-slash-ui--done");
    }, 250);
    if (blowSlot) { blowSlot.style.transition = "opacity 0.4s"; blowSlot.style.opacity = "0"; }

    /* ── 4. Animation tách miếng: nứt / tách rất nhẹ, chậm hơn một chút ───── */
    const SHATTER_MS = 2900;
    const shatterStart = performance.now();
    function shatterFrame() {
      const elapsed = performance.now() - shatterStart;
      const u = Math.min(1, elapsed / SHATTER_MS);
      const easeOut = 1 - Math.pow(1 - u, 2.65);
      const gravity = u * u * 0.18;
      const leanAngle = easeOut * 0.34;

      shatterPieces.forEach(function (piece) {
        const dist = easeOut * 0.72;
        const newX = piece.ox + piece.flyDir.x * dist;
        const newZ = piece.oz + piece.flyDir.z * dist;
        const newY = originPos.y + easeOut * 0.12 - gravity;
        piece.group.position.set(newX, newY, newZ);
        const qBase = new THREE.Quaternion().setFromEuler(
          new THREE.Euler(originRot.x, originRot.y, originRot.z, 'XYZ')
        );
        const qLean = new THREE.Quaternion().setFromAxisAngle(piece.tiltAxis, leanAngle);
        const qSpin = new THREE.Quaternion().setFromEuler(
          new THREE.Euler(
            easeOut * piece.spinX,
            easeOut * piece.spinY,
            easeOut * piece.spinZ,
            'XYZ'
          )
        );
        piece.group.quaternion.copy(qBase).premultiply(qLean).multiply(qSpin);
      });

      if (u < 1) {
        shatterAnimId = requestAnimationFrame(shatterFrame);
      } else {
        /* Chiếu vị trí 3D → viewport % để gift-box.js làm điểm xuất phát ảnh */
        var rect = stage.getBoundingClientRect();
        var vw = window.innerWidth || rect.width;
        var vh = window.innerHeight || rect.height;
        window.__cakePieceScreenPositions = shatterPieces.map(function (piece) {
          var wp = piece.group.position.clone().project(camera);
          var sx = (wp.x * 0.5 + 0.5) * rect.width + rect.left;
          var sy = (-wp.y * 0.5 + 0.5) * rect.height + rect.top;
          return {
            x: Math.max(5, Math.min(95, (sx / vw) * 100)),
            y: Math.max(5, Math.min(95, (sy / vh) * 100))
          };
        });

        if (zone) zone.classList.add("memory-zone--faded");
        window.setTimeout(function () {
          shatterPieces.forEach(function (p) {
            scene.remove(p.group);
            p.group.traverse(function (obj) {
              if (!obj.isMesh) return;
              if (obj.geometry) obj.geometry.dispose();
              [].concat(obj.material).forEach(function (m) { if (m && m.dispose) m.dispose(); });
            });
          });
          shatterPieces = [];
        }, 2000);
        window.dispatchEvent(new CustomEvent("memory:cake-cuts-complete"));
      }
    }
    shatterAnimId = requestAnimationFrame(shatterFrame);
  }

  function animate() {
    const t = clock.getElapsedTime();
    const undersideLiftT = Math.abs(userDragPitch) / PITCH_LIMIT;
    const undersideLift = undersideLiftT * undersideLiftT * 1.15;

    if (!cakeShatterDone) {
      cakeRoot.rotation.y = t * SPIN_ROOT_Y + userDragYaw;
      cakeRoot.rotation.x = userDragPitch;
      cakeRoot.position.y = baseCakeRootY + undersideLift;
      lowerTier.position.set(0, LOWER_TIER_Y, 0);
      lowerTier.rotation.set(0, 0, 0);
      upperTier.position.set(0, UPPER_TIER_Y, 0);
      upperTier.rotation.set(0, 0, 0);
      lowerTierSpin.rotation.y = t * SPIN_LOWER_TIER_Y;
      lowerTierTopStatic.rotation.y = -cakeRoot.rotation.y;
      upperTier.rotation.y = -t * SPIN_UPPER_TIER_Y;
    }

    if (blowSlot) {
      blowSlot.classList.toggle(
        "is-hidden-by-tilt",
        !candleBlown && (pointers.size > 0 || dragActive || slashLocksRotation)
      );
    }
    const flames = upperTier.userData && upperTier.userData.candleFlames;
    const flameR =
      (upperTier.userData && upperTier.userData.candleR) || 0.13;
    if (flames && flames.length) {
      flames.forEach(function (mesh) {
        const u = mesh.userData.flame;
        if (!u) return;
        /* ── Hiệu ứng thổi tắt nến ─────────────────────────────────────── */
        if (candleBlown) {
          const elapsed = performance.now() - blowStartTime;
          if (blowStartTime < 0 || elapsed >= BLOW_ANIM_MS) {
            mesh.visible = false;
            return;
          }
          mesh.visible = true;
          const prog = elapsed / BLOW_ANIM_MS; /* 0 → 1 */

          if (prog < 0.38) {
            /* Pha 1 (0–38%): lung lay dữ dội như đang bị thổi */
            const p1 = prog / 0.38;
            const leanX = u.bx + flameR * 1.2 * p1 * Math.sin(t * 38 + u.px);
            const leanY = u.by + flameR * 0.3 * Math.sin(t * 26 + u.py);
            mesh.position.set(leanX, leanY, u.bz);
            mesh.scale.set(
              u.sx * (1 + 0.4 * Math.abs(Math.sin(t * 35))),
              u.sy * (1.25 - 0.35 * p1),
              u.sz
            );
            mesh.material.opacity = Math.min(0.92, u.bop * (1.1 - 0.15 * p1));
          } else {
            /* Pha 2 (38–100%): teo nhỏ + mờ dần — ngọn lửa tắt */
            const p2 = (prog - 0.38) / 0.62;
            const ease = 1 - Math.pow(1 - p2, 1.8);
            const sc = Math.max(0, 1 - ease);
            mesh.position.set(u.bx, u.by + flameR * 0.15 * (1 - p2), u.bz);
            mesh.scale.set(u.sx * sc, u.sy * sc, u.sz * sc);
            mesh.material.opacity = Math.max(0, u.bop * (1 - ease));
          }
          return;
        }
        /* ── Ngọn lửa bình thường ────────────────────────────────────────── */
        mesh.visible = true;
        const wobbleY =
          flameR * 0.2 * Math.sin(t * u.f5 + u.py) +
          flameR * 0.13 * Math.sin(t * 27 + u.pz) +
          flameR * 0.11 * Math.sin(t * u.f1 + u.px) +
          flameR * 0.08 * Math.sin(t * u.f3 * 1.2 + u.py);
        const stretchY =
          1 +
          0.26 * Math.sin(t * u.f2 + u.pz) +
          0.17 * Math.sin(t * u.f4 * 1.3 + u.px) +
          0.12 * Math.sin(t * u.f5 * 0.6 + u.py) +
          0.08 * Math.sin(t * u.f1 * 1.8 + u.pz);
        mesh.position.set(u.bx, u.by + wobbleY, u.bz);
        mesh.scale.set(u.sx, u.sy * stretchY, u.sz);
        mesh.rotation.set(0, 0, 0);
        const flicker =
          0.58 +
          0.22 * (0.5 + 0.5 * Math.sin(t * 14.2 + u.px)) +
          0.18 * (0.5 + 0.5 * Math.sin(t * 21.7 + u.pz)) +
          0.12 * (0.5 + 0.5 * Math.sin(t * 33 + u.py));
        mesh.material.opacity = Math.max(
          0.12,
          Math.min(0.92, u.bop * flicker)
        );
      });
    }
    renderer.render(scene, camera);
    rafId = requestAnimationFrame(animate);
  }
  animate();

  function onResize() {
    const nw = stage.clientWidth || window.innerWidth || 800;
    const nh = stage.clientHeight || window.innerHeight || 600;
    refreshStageViewport(nw, nh);
    resizeSlashCanvas();
  }

  function onOrientationChange() {
    setTimeout(onResize, 200);
  }

  window.addEventListener("resize", onResize);
  window.addEventListener("orientationchange", onOrientationChange);

  stage.__memoryCleanup = function () {
    cancelAnimationFrame(rafId);
    window.removeEventListener("resize", onResize);
    window.removeEventListener("orientationchange", onOrientationChange);
    stage.removeEventListener("pointerdown", onPointerDown);
    stage.removeEventListener("pointermove", onPointerMove);
    stage.removeEventListener("pointerup", onPointerUp);
    stage.removeEventListener("pointercancel", onPointerUp);
    stage.removeEventListener("wheel", onWheel, { passive: false });
    if (typeof slashUiCleanup === "function") {
      slashUiCleanup();
    }
    renderer.dispose();
    scene.traverse(function (obj) {
      if (!obj) return;
      if (obj.geometry && obj.geometry.dispose) obj.geometry.dispose();
      if (obj.material) {
        if (Array.isArray(obj.material)) {
          obj.material.forEach(function (m) {
            if (m.map) m.map.dispose();
            if (m.dispose) m.dispose();
          });
        } else {
          if (obj.material.map) obj.material.map.dispose();
          if (obj.material.dispose) obj.material.dispose();
        }
      }
    });
    if (renderer.domElement && renderer.domElement.parentNode === stage) {
      stage.removeChild(renderer.domElement);
    }
  };
}

/**
 * Từng chữ cái "Happy Birthday!" bay thật sự qua màn hình từ hộp quà tới vị trí câu chữ.
 * Kỹ thuật:
 *  1. Tạm show heading (invisible) để đo rect của từng chữ
 *  2. Tạo clone fixed-position cho từng chữ, đặt tại tâm hộp quà
 *  3. Animate clone bay tới rect đích theo stagger
 *  4. Sau khi tất cả đến nơi: hiện heading thật, xoá clones
 */
(function setupBirthdayHeadingLaunch() {
  var heading = document.querySelector(".page-birthday-heading");
  if (!heading) return;

  var letters = Array.from(
    heading.querySelectorAll(".page-birthday-heading__letter")
  );
  if (!letters.length) return;

  var launched = false;

  function getGiftCenter() {
    var gift = document.getElementById("gift-cube");
    if (gift) {
      var r = gift.getBoundingClientRect();
      if (r.width > 0)
        return { x: r.left + r.width * 0.5, y: r.top + r.height * 0.38 };
    }
    return { x: window.innerWidth * 0.5, y: window.innerHeight * 0.52 };
  }

  window.launchBirthdayHeadingFromGift = function () {
    if (launched) return;
    launched = true;

    /* ── 1. Đo vị trí đích của từng chữ ── */
    heading.classList.add("is-measuring");
    void heading.offsetHeight; // force layout

    var rects = letters.map(function (l) {
      return l.getBoundingClientRect();
    });

    heading.classList.remove("is-measuring");

    /* ── 2. Tạo flying clones — bắt đầu phía trên viewport ── */
    var clones = [];

    letters.forEach(function (letter, i) {
      var rect = rects[i];
      var cs = window.getComputedStyle(letter);
      var rDeg = letter.style.getPropertyValue("--r") || "0deg";

      var clone = letter.cloneNode(true);
      clone.className = "bday-flying-letter";
      clone.setAttribute("data-ch", letter.getAttribute("data-ch") || "");
      /* đặt ngay trên đỉnh viewport, cùng x với đích */
      clone.style.cssText = [
        "left:" + rect.left.toFixed(1) + "px",
        "top:" + (-rect.height - 16) + "px",
        "width:" + rect.width.toFixed(1) + "px",
        "height:" + rect.height.toFixed(1) + "px",
        "padding:" + cs.padding,
        "font-size:" + cs.fontSize,
        "opacity:0",
        "transform:rotate(" + rDeg + ") scale(1)",
        "transition:none",
      ].join(";");

      /* sao chép các CSS custom vars cho màu sắc 3D lớp trước/sau */
      var glyph = clone.querySelector(".page-birthday-heading__glyph");
      if (glyph) {
        var origGlyph = letter.querySelector(".page-birthday-heading__glyph");
        if (origGlyph) {
          var gcs = window.getComputedStyle(origGlyph);
          glyph.style.color = gcs.color;
          glyph.style.webkitTextStroke = gcs.webkitTextStroke || gcs["-webkit-text-stroke"];
        }
      }

      document.body.appendChild(clone);
      clones.push({ clone: clone, rect: rect, rDeg: rDeg });
    });

    /* ── 3. Stagger: từng clone xuất hiện rồi bay tới đích ── */
    var FLY_DUR = 260;  /* ms mỗi chữ rơi xuống */
    var STAGGER = 295;  /* ms giữa các chữ — sequential (> FLY_DUR) */

    clones.forEach(function (item, i) {
      var clone = item.clone;
      var rect = item.rect;
      var rDeg = item.rDeg;

      /* đặt clone ngay trên đỉnh viewport (cùng x với đích, nhưng y âm) */
      clone.style.left = rect.left.toFixed(1) + "px";
      clone.style.top = (-rect.height - 16) + "px";
      clone.style.transform = "rotate(" + rDeg + ") scale(1)";

      setTimeout(function () {
        /* hiện clone */
        void clone.offsetWidth;
        clone.style.transition = "opacity 80ms ease";
        clone.style.opacity = "1";

        /* rơi xuống đích — cubic-bezier spring: ease-in rồi overshoot nhún lên chút */
        setTimeout(function () {
          clone.style.transition = [
            "top " + FLY_DUR + "ms cubic-bezier(0.34, 1.52, 0.58, 1)",
            "transform " + FLY_DUR + "ms cubic-bezier(0.34, 1.52, 0.58, 1)",
          ].join(",");
          clone.style.top = rect.top.toFixed(1) + "px";
          clone.style.transform = "rotate(" + rDeg + ") scale(1)";
        }, 30);
      }, i * STAGGER);
    });

    /* ── 4. Sau khi tất cả đến nơi: hiện heading thật, xoá clones ── */
    var totalMs = (letters.length - 1) * STAGGER + FLY_DUR + 80;
    setTimeout(function () {
      heading.classList.add("is-visible");
      clones.forEach(function (item) {
        if (item.clone.parentNode) item.clone.parentNode.removeChild(item.clone);
      });
    }, totalMs);
  };
})();
