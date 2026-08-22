import * as THREE from "three";
import { OrbitControls } from "https://cdn.jsdelivr.net/npm/three@0.157.0/examples/jsm/controls/OrbitControls.js";
import { EffectComposer } from "https://cdn.jsdelivr.net/npm/three@0.157.0/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "https://cdn.jsdelivr.net/npm/three@0.157.0/examples/jsm/postprocessing/RenderPass.js";
import { makeMat } from "./materials.min.js";
let STAR_COUNT = 0,
  starAlpha = null,
  starPhase = null,
  starGeo = null;
const RingText = [
  ...(window.dataFromSubdomain &&
  window.dataFromSubdomain.data &&
  window.dataFromSubdomain.data.candyTexts
    ? window.dataFromSubdomain.data.candyTexts
    : [
        "Hôm nay em đẹp lắm ❤️",
        "谢谢你朋友 ✨",
        "사랑해요 💖",
        "힘내요! 🌟",
        "あなたが好き 🥰",
        "元気ですか？ 🌈",
      ]),
];
const PhotoUrls = (
  window.dataFromSubdomain &&
  window.dataFromSubdomain.data &&
  Array.isArray(window.dataFromSubdomain.data.imageUrls)
    ? window.dataFromSubdomain.data.imageUrls
    : []
)
  .filter((url) => typeof url === "string" && url.trim())
  .slice(0, 12);
// Logic âm thanh giống y hệt galaxy template
let echoheartAudio = null;
let audioInitialized = false;
function playEchoheartAudio() {
  if (!audioInitialized) {
    const musicUrl =
      window.dataFromSubdomain &&
      window.dataFromSubdomain.data &&
      (window.dataFromSubdomain.data.musicUrl || window.dataFromSubdomain.data.music)
        ? (window.dataFromSubdomain.data.musicUrl || window.dataFromSubdomain.data.music)
        : "";

    if (!musicUrl) {
      audioInitialized = true;
      return;
    }

    echoheartAudio = new Audio(musicUrl);
    echoheartAudio.loop = true;
    echoheartAudio.volume = 0.7;

    // Handle audio errors gracefully
    echoheartAudio.addEventListener("error", (e) => {
      console.log("Audio file not found or cannot be loaded:", musicUrl);
      echoheartAudio = null;
    });

    audioInitialized = true;
  }

  if (echoheartAudio) {
    // Only play if user has interacted and audio is ready
    const playPromise = echoheartAudio.play();
    if (playPromise !== undefined) {
      playPromise.catch((error) => {
        // Auto-play was prevented, user needs to interact first
        console.log("Audio play prevented, waiting for user interaction");
      });
    }
  }
}
let cameraAnimationStart = null;
const CAMERA_ANIMATION_DURATION = 5;
let CAMERA_START_POSITION = { x: 0, y: 90, z: 30 };
const CAMERA_END_POSITION = { x: 0, y: 25, z: 65 };
let userHasMovedCamera = !1,
  streamHeartStarted = !1,
  streamHeartActiveRatio = 0,
  firstResetCompleted = !1;
const scene = new THREE.Scene(),
  heartScene = new THREE.Scene(),
  renderer = new THREE.WebGLRenderer({ antialias: !0, alpha: !0 }),
  HEART_ROTATE = !1;
let heartbeatEnabled = !1;
const fadeObjects = [];
let revealStart = null;
const REVEAL_DURATION = 1.5,
  HEARTBEAT_FREQ_HZ = 0.5,
  HEARTBEAT_AMPLITUDE = 0.05,
  STAGE = { RIBBON: 0, STREAM: 1, STAR: 2, SHOOT: 3, HEART: 4 },
  STAGE_DURATION = 0.7;
renderer.setPixelRatio(window.devicePixelRatio),
  renderer.setSize(window.innerWidth, window.innerHeight),
  document.body.appendChild(renderer.domElement);
let staticBottomHeart = null,
  staticTopHeart = null;
const camera = new THREE.PerspectiveCamera(
  45,
  window.innerWidth / window.innerHeight,
  0.1,
  300
);
camera.position.set(0, 90, 25), camera.lookAt(0, 0, 0);
const controls = new OrbitControls(camera, renderer.domElement);
(controls.enableDamping = !0),
  (controls.minDistance = 5),
  (controls.maxDistance = 100),
  (controls.enableZoom = !0),
  (controls.minPolarAngle = THREE.MathUtils.degToRad(45)),
  (controls.maxPolarAngle = THREE.MathUtils.degToRad(120)),
  (controls.enablePan = !0);
const composerMain = new EffectComposer(renderer),
  renderPassMain = new RenderPass(scene, camera);
(renderPassMain.clear = !1), composerMain.addPass(renderPassMain);
const composerHeart = new EffectComposer(renderer);
composerHeart.addPass(new RenderPass(heartScene, camera));
scene.add(new THREE.AmbientLight(16777215, 0.6));
const p1 = new THREE.PointLight(16777215, 1.2);
p1.position.set(10, 10, 10), scene.add(p1);
function createCircleTexture() {
  const canvas = document.createElement("canvas");
  (canvas.width = 256), (canvas.height = 256);
  const ctx = canvas.getContext("2d"),
    shadowGrad = ctx.createRadialGradient(128, 128, 127 * 0.4, 128, 128, 127);
  shadowGrad.addColorStop(0, "rgba(255,105,180,0.6)"),
    shadowGrad.addColorStop(1, "rgba(255,20,147,0)"),
    (ctx.fillStyle = shadowGrad),
    ctx.beginPath(),
    ctx.arc(128, 128, 127, 0, 2 * Math.PI),
    ctx.closePath(),
    ctx.fill();
  const coreGrad = ctx.createRadialGradient(128, 128, 0, 128, 128, 76.2);
  coreGrad.addColorStop(0, "rgba(255,255,255,1)"),
    coreGrad.addColorStop(1, "rgba(255,255,255,0)"),
    (ctx.fillStyle = coreGrad),
    ctx.beginPath(),
    ctx.arc(128, 128, 76.2, 0, 2 * Math.PI),
    ctx.closePath(),
    ctx.fill();
  const tex = new THREE.CanvasTexture(canvas);
  return (
    (tex.minFilter = THREE.LinearFilter),
    (tex.magFilter = THREE.LinearFilter),
    (tex.needsUpdate = !0),
    tex
  );
}
function createSnowflakeTexture() {
  const canvas = document.createElement("canvas");
  (canvas.width = 256), (canvas.height = 256);
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "rgba(0,0,0,0)";
  ctx.fillRect(0, 0, 256, 256);
  const centerX = 128,
    centerY = 128,
    outerRadius = 100,
    innerRadius = 40;
  ctx.strokeStyle = "rgba(255,255,255,1)";
  ctx.lineWidth = 8;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.save();
  ctx.translate(centerX, centerY);
  for (let i = 0; i < 6; i++) {
    ctx.save();
    ctx.rotate((i * Math.PI) / 3);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, -outerRadius);
    ctx.moveTo(0, -innerRadius);
    ctx.lineTo(-15, -innerRadius - 20);
    ctx.moveTo(0, -innerRadius);
    ctx.lineTo(15, -innerRadius - 20);
    ctx.moveTo(0, -outerRadius + 15);
    ctx.lineTo(-12, -outerRadius + 5);
    ctx.moveTo(0, -outerRadius + 15);
    ctx.lineTo(12, -outerRadius + 5);
    ctx.stroke();
    ctx.restore();
  }
  ctx.beginPath();
  ctx.arc(0, 0, 10, 0, 2 * Math.PI);
  ctx.fillStyle = "rgba(255,255,255,1)";
  ctx.fill();
  ctx.restore();
  const shadowGrad = ctx.createRadialGradient(
    centerX,
    centerY,
    0,
    centerX,
    centerY,
    outerRadius
  );
  shadowGrad.addColorStop(0, "rgba(255,255,255,0.3)"),
    shadowGrad.addColorStop(0.5, "rgba(255,255,255,0.1)"),
    shadowGrad.addColorStop(1, "rgba(255,255,255,0)"),
    (ctx.fillStyle = shadowGrad),
    ctx.beginPath(),
    ctx.arc(centerX, centerY, outerRadius, 0, 2 * Math.PI),
    ctx.closePath(),
    ctx.fill();
  const tex = new THREE.CanvasTexture(canvas);
  return (
    (tex.minFilter = THREE.LinearFilter),
    (tex.magFilter = THREE.LinearFilter),
    (tex.needsUpdate = !0),
    tex
  );
}
const circleTexture = createCircleTexture(),
  snowflakeTexture = createSnowflakeTexture(),
  heartShape = new THREE.Shape(),
  x = 0,
  y = 0;
heartShape.moveTo(5, 5),
  heartShape.bezierCurveTo(5, 5, 4, 0, 0, 0),
  heartShape.bezierCurveTo(-6, 0, -6, 7, -6, 7),
  heartShape.bezierCurveTo(-6, 11, -3, 15.4, 5, 19),
  heartShape.bezierCurveTo(12, 15.4, 16, 11, 16, 7),
  heartShape.bezierCurveTo(16, 7, 16, 0, 10, 0),
  heartShape.bezierCurveTo(7, 0, 5, 5, 5, 5);
const polyPts = heartShape.getPoints(100);
function pointInPolygon(pt, poly) {
  let inside = !1;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i].x,
      yi = poly[i].y,
      xj = poly[j].x,
      yj = poly[j].y;
    yi > pt.y != yj > pt.y &&
      pt.x < ((xj - xi) * (pt.y - yi)) / (yj - yi) + xi &&
      (inside = !inside);
  }
  return inside;
}
const polyShift = polyPts.map((p) => ({ x: p.x - 5, y: p.y - 7 })),
  BORDER_THRESHOLD =
    0.1 *
    (Math.max(...polyPts.map((p) => p.x)) -
      Math.min(...polyPts.map((p) => p.x)));
function minDistToBorder(px, py) {
  let minDistSq = 1 / 0;
  for (let i = 0; i < polyShift.length; i++) {
    const a = polyShift[i],
      b = polyShift[(i + 1) % polyShift.length],
      dx = b.x - a.x,
      dy = b.y - a.y,
      t = ((px - a.x) * dx + (py - a.y) * dy) / (dx * dx + dy * dy),
      clamped = Math.max(0, Math.min(1, t)),
      dxi = px - (a.x + clamped * dx),
      dyi = py - (a.y + clamped * dy),
      distSq = dxi * dxi + dyi * dyi;
    distSq < minDistSq && (minDistSq = distSq);
  }
  return Math.sqrt(minDistSq);
}
const positions = [],
  sampleCount = 1200,
  xs = polyPts.map((p) => p.x),
  ys = polyPts.map((p) => p.y),
  minX = Math.min(...xs),
  maxX = Math.max(...xs),
  minY = Math.min(...ys),
  maxY = Math.max(...ys),
  threshold = minY + (maxY - minY) / 6;
for (; positions.length / 3 < sampleCount; ) {
  const px = Math.random() * (maxX - minX) + minX,
    py = Math.random() * (maxY - minY) + minY;
  if (pointInPolygon({ x: px, y: py }, polyPts)) {
    let minDistSq = 1 / 0;
    for (let i = 0; i < polyPts.length; i++) {
      const a = polyPts[i],
        b = polyPts[(i + 1) % polyPts.length],
        dx = b.x - a.x,
        dy = b.y - a.y,
        t = ((px - a.x) * dx + (py - a.y) * dy) / (dx * dx + dy * dy),
        clamped = Math.max(0, Math.min(1, t)),
        dxi = px - (a.x + clamped * dx),
        dyi = py - (a.y + clamped * dy),
        distSq = dxi * dxi + dyi * dyi;
      distSq < minDistSq && (minDistSq = distSq);
    }
    const keepProb = 1 / (1 + 2 * Math.sqrt(minDistSq));
    if (Math.random() < keepProb) {
      const pz = 3.6 * (Math.random() - 0.5);
      positions.push(px - 5, py - 7, pz);
    }
  }
}
let minZ = 1 / 0,
  maxZval = -1 / 0;
for (let i = 2; i < positions.length; i += 3) {
  const zVal = positions[i];
  zVal < minZ && (minZ = zVal), zVal > maxZval && (maxZval = zVal);
}
const heartDepth = maxZval - minZ,
  heartWidth = maxX - minX,
  planeXVar = 2 * heartWidth,
  rStreamStart = 0.8 * heartWidth,
  Rmax = rStreamStart,
  rVortex = 0.48 * heartWidth,
  planeZVar = 15 * heartDepth,
  planeYCenter = maxY,
  planeYVar = 1,
  riseDuration = 10,
  fallDuration = 0,
  holdDuration = 0,
  STREAM_RISE_MIN = 8,
  STREAM_RISE_MAX = 12,
  INDENT_Y = maxY - 0.25 * (maxY - minY),
  INDENT_HALF_WIDTH = 0.35 * heartWidth,
  COS_ANGLE_THRESH = 0.707106,
  CLIP_FRONT_Z = 0.3,
  staticGeo = new THREE.BufferGeometry(),
  originalPositions = positions.slice();
staticGeo.setAttribute(
  "position",
  new THREE.Float32BufferAttribute(originalPositions, 3)
);
const colors = [],
  blue = new THREE.Color(0x0066ff),
  white = new THREE.Color(0xffffff),
  skyBlue = new THREE.Color(0x87ceeb);
for (let i = 0; i < positions.length; i += 3) {
  const idx = i / 3;
  const color = idx % 3 === 0 ? blue : idx % 3 === 1 ? white : skyBlue;
  colors.push(color.r, color.g, color.b);
}
staticGeo.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
const staticSizes = new Float32Array(positions.length / 3),
  SIZE_SCALE = 2;
for (let i = 0; i < staticSizes.length; i++) {
  const sizeFactor = 0.3 + 0.7 * Math.random();
  staticSizes[i] = 20 * (0.3 * Math.random() + 0.2) * sizeFactor;
}
staticGeo.setAttribute(
  "size",
  new THREE.Float32BufferAttribute(staticSizes, 1)
);
const topIndices = [];
for (let i = 0; i < positions.length; i += 3) {
  positions[i + 1] > threshold + 0.1 * (Math.random() - 0.5) * (maxY - minY) &&
    topIndices.push(i / 3);
}
const topSet = new Set(topIndices);
let bottomPositions = [];
const bottomColors = [],
  bottomSizes = [],
  bottomSizesBase = [],
  topPositionsArr = [],
  topColors = [],
  topSizes = [],
  topAlpha = [],
  idxToTopIdx = new Int32Array(positions.length / 3).fill(-1);
for (let i = 0, topIdx = 0; i < positions.length; i += 3) {
  const idx = i / 3,
    sizeVal = staticSizes[idx],
    px = positions[i],
    py = positions[i + 1],
    pz = positions[i + 2];
  if (topSet.has(idx)) {
    const color = idx % 3 === 0 ? blue : idx % 3 === 1 ? white : skyBlue;
    topPositionsArr.push(px, py, pz),
      topColors.push(color.r, color.g, color.b),
      topSizes.push(sizeVal);
    const hideIndent = Math.abs(px) < INDENT_HALF_WIDTH && py > INDENT_Y;
    topAlpha.push(hideIndent ? 0 : 1), (idxToTopIdx[idx] = topIdx++);
  } else {
    const color = idx % 3 === 0 ? blue : idx % 3 === 1 ? white : skyBlue;
    bottomPositions.push(px, py, pz),
      bottomColors.push(color.r, color.g, color.b),
      bottomSizes.push(sizeVal);
  }
}
staticGeo.setAttribute(
  "position",
  new THREE.Float32BufferAttribute(topPositionsArr, 3)
),
  staticGeo.setAttribute(
    "color",
    new THREE.Float32BufferAttribute(topColors, 3)
  ),
  staticGeo.setAttribute("size", new THREE.Float32BufferAttribute(topSizes, 1)),
  staticGeo.setAttribute(
    "alpha",
    new THREE.BufferAttribute(new Float32Array(topAlpha), 1)
  ),
  (staticGeo.attributes.position.needsUpdate = !0),
  (staticGeo.attributes.alpha.needsUpdate = !0);
const topCount = topPositionsArr.length / 3,
  topRadiusArr = new Float32Array(topCount),
  topPhaseArr = new Float32Array(topCount),
  topDelayArr = new Float32Array(topCount);
for (let i = 0; i < topCount; i++) {
  const x = topPositionsArr[3 * i],
    z = topPositionsArr[3 * i + 2],
    r = Math.sqrt(x * x + z * z);
  (topRadiusArr[i] = r),
    (topPhaseArr[i] = Math.atan2(z, x)),
    (topDelayArr[i] = 10 * Math.random());
}
const GLOBAL_SPIRAL_FREQ = 0.5,
  BASE_OMEGA = (-1 * Math.PI) / 10,
  GATHER_RATIO = 0.01,
  HOLD_RATIO = 0.2,
  radiusPow = 2.5,
  rCore = 0.25,
  rOuter = rVortex,
  vIn = 0.9,
  SHRINK_TO_CORE = !1,
  BURST_SPREAD = 0.1,
  FADE_DURATION = 2.5,
  SPAWN_DELAY_MAX = 3,
  ASCEND_DELAY_MAX = 10,
  apexY = maxY,
  LOW_REGION_FACTOR = 0.5;
let minBottomY = 1 / 0,
  maxBottomY = -1 / 0;
for (let i = 1; i < bottomPositions.length; i += 3) {
  const yVal = bottomPositions[i];
  yVal < minBottomY && (minBottomY = yVal),
    yVal > maxBottomY && (maxBottomY = yVal);
}
const Y_THRESHOLD = minBottomY + 0.5 * (maxBottomY - minBottomY),
  HIGH_BOTTOM_MULT = 2;
{
  const extraPos = [],
    extraColor = [],
    extraSize = [];
  for (let i = 0; i < bottomPositions.length; i += 3) {
    const py = bottomPositions[i + 1];
    if (py >= Y_THRESHOLD)
      for (let k = 1; k < 2; k++) {
        const idx = i / 3;
        const color = idx % 3 === 0 ? blue : idx % 3 === 1 ? white : skyBlue;
        extraPos.push(bottomPositions[i], py, bottomPositions[i + 2]),
          extraColor.push(color.r, color.g, color.b),
          extraSize.push(bottomSizes[i / 3]);
      }
  }
  bottomPositions.push(...extraPos),
    bottomColors.push(...extraColor),
    bottomSizes.push(...extraSize);
}
const BOTTOM_ROTATE_RATIO = 0.2,
  rotPos = [],
  rotColors = [],
  rotSizes = [],
  staticBotPos = [],
  staticBotColors = [],
  staticBotSizes = [];
for (let i = 0; i < bottomPositions.length; i += 3) {
  const idx = i / 3;
  const color = idx % 3 === 0 ? blue : idx % 3 === 1 ? white : skyBlue;
  Math.random() < 0.2
    ? (rotPos.push(
        bottomPositions[i],
        bottomPositions[i + 1],
        bottomPositions[i + 2]
      ),
      rotColors.push(color.r, color.g, color.b),
      rotSizes.push(bottomSizes[i / 3]))
    : (staticBotPos.push(
        bottomPositions[i],
        bottomPositions[i + 1],
        bottomPositions[i + 2]
      ),
      staticBotColors.push(color.r, color.g, color.b),
      staticBotSizes.push(bottomSizes[i / 3]));
}
(bottomPositions.length = 0),
  bottomPositions.push(...rotPos),
  (bottomColors.length = 0),
  bottomColors.push(...rotColors),
  (bottomSizes.length = 0),
  bottomSizes.push(...rotSizes);
const bottomCount = bottomPositions.length / 3,
  bottomRadiusArr = new Float32Array(bottomCount),
  bottomPhaseArr = new Float32Array(bottomCount),
  bottomDelayArr = new Float32Array(bottomCount),
  CLEFT_FACTOR = 2.5,
  bottomAlphaArr = new Float32Array(bottomCount).fill(1),
  bottomIsLow = new Uint8Array(bottomCount),
  pivotOffset = 0.25 * heartWidth,
  KEEP_LOW_MIN = 0,
  KEEP_LOW_MAX = 0.3;
for (let i = 0; i < bottomCount; i++) {
  const x = bottomPositions[3 * i],
    y = bottomPositions[3 * i + 1],
    z = bottomPositions[3 * i + 2],
    isLow = y < Y_THRESHOLD;
  if (((bottomIsLow[i] = isLow ? 1 : 0), isLow)) {
    const keepProb = 0 + 0.3 * ((y - minBottomY) / (Y_THRESHOLD - minBottomY));
    bottomAlphaArr[i] = Math.random() < keepProb ? 1 : 0;
  } else bottomAlphaArr[i] = 1;
  const r = Math.sqrt(x * x + z * z),
    angle = Math.atan2(z, x),
    distToCleft = Math.min(1, Math.abs(x) / (0.25 * heartWidth)),
    cleftFactor = 1.5 * Math.pow(1 - distToCleft, 3) + 1;
  (bottomRadiusArr[i] = r * cleftFactor),
    (bottomPhaseArr[i] = angle),
    (bottomDelayArr[i] = 10 * Math.random());
}
const bottomAlphaBase = Float32Array.from(bottomAlphaArr),
  bottomGeo = new THREE.BufferGeometry();
bottomGeo.setAttribute(
  "position",
  new THREE.Float32BufferAttribute(bottomPositions, 3)
),
  bottomGeo.setAttribute(
    "color",
    new THREE.Float32BufferAttribute(bottomColors, 3).setUsage(
      THREE.DynamicDrawUsage
    )
  ),
  bottomGeo.setAttribute(
    "size",
    new THREE.Float32BufferAttribute(bottomSizes, 1)
  ),
  bottomGeo.setAttribute("alpha", new THREE.BufferAttribute(bottomAlphaArr, 1));
const V_SLOPE = 0.3,
  matBottom = makeMat({
    map: snowflakeTexture,
    alphaSupport: !0,
    vClipSlope: 0.3,
    clipFrontZ: 0.3,
  });
matBottom.alphaTest = 0.5;
const bottomHeart = new THREE.Points(bottomGeo, matBottom);
(bottomHeart.renderOrder = 5),
  (bottomHeart.rotation.z = Math.PI),
  scene.add(bottomHeart);
const BOTTOM_OMEGA = BASE_OMEGA,
  topPointVisibility = new Array(topIndices.length).fill(!0);
let hiddenTopCount = 0;
const matStatic = makeMat({ map: snowflakeTexture, alphaSupport: !0 });
matStatic.alphaTest = 0.5;
const staticHeart = new THREE.Points(staticGeo, matStatic);
(staticHeart.renderOrder = 5),
  (staticHeart.rotation.z = Math.PI),
  scene.add(staticHeart);
const TOP_STATIC_RATIO = 0.5;
{
  const topStaticPos = [],
    topStaticCol = [],
    topStaticSize = [];
  for (let i = 0; i < topPositionsArr.length; i += 3) {
    const keep =
      minDistToBorder(topPositionsArr[i] + 5, topPositionsArr[i + 1] + 7) <
        BORDER_THRESHOLD || Math.random() < 0.3;
    Math.random() < 0.5 &&
      keep &&
      (() => {
        const idx = Math.floor(i / 3);
        const color = idx % 3 === 0 ? blue : idx % 3 === 1 ? white : skyBlue;
        topStaticPos.push(
          topPositionsArr[i],
          topPositionsArr[i + 1],
          topPositionsArr[i + 2]
        ),
          topStaticCol.push(color.r, color.g, color.b),
          topStaticSize.push(topSizes[idx]);
      })();
  }
  if (topStaticPos.length) {
    const topStaticGeo = new THREE.BufferGeometry();
    topStaticGeo.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(topStaticPos, 3)
    ),
      topStaticGeo.setAttribute(
        "color",
        new THREE.Float32BufferAttribute(topStaticCol, 3).setUsage(
          THREE.DynamicDrawUsage
        )
      ),
      topStaticGeo.setAttribute(
        "size",
        new THREE.Float32BufferAttribute(topStaticSize, 1)
      );
    const matTopStatic = makeMat({ map: snowflakeTexture, alphaSupport: !0 });
    (matTopStatic.alphaTest = 0.5),
      ((staticTopHeart = new THREE.Points(topStaticGeo, matTopStatic)),
      (staticTopHeart.renderOrder = 5)),
      (staticTopHeart.rotation.z = Math.PI),
      scene.add(staticTopHeart);
  }
}
if (staticBotPos.length > 0) {
  const staticBottomGeo = new THREE.BufferGeometry();
  staticBottomGeo.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(staticBotPos, 3)
  ),
    staticBottomGeo.setAttribute(
      "color",
      new THREE.Float32BufferAttribute(staticBotColors, 3).setUsage(
        THREE.DynamicDrawUsage
      )
    ),
    staticBottomGeo.setAttribute(
      "size",
      new THREE.Float32BufferAttribute(staticBotSizes, 1)
    );
  const staticBottomMat = makeMat({ map: snowflakeTexture, alphaSupport: !0 });
  (staticBottomMat.alphaTest = 0.5),
    ((staticBottomHeart = new THREE.Points(staticBottomGeo, staticBottomMat)),
    (staticBottomHeart.renderOrder = 5)),
    (staticBottomHeart.rotation.z = Math.PI),
    scene.add(staticBottomHeart);
}
const SPAWN_MULT = 0.2,
  rimIndices = [];
for (const idx of topIndices) {
  minDistToBorder(positions[3 * idx], positions[3 * idx + 1]) <
    BORDER_THRESHOLD && rimIndices.push(idx);
}
const streamSource = rimIndices.length ? rimIndices : topIndices,
  streamCount = Math.floor(0.04 * streamSource.length),
  targetIdxArr = new Uint32Array(streamCount);
for (let i = 0; i < streamCount; i++)
  targetIdxArr[i] = streamSource[i % streamSource.length];
const planeIdxForStream = new Int32Array(streamCount).fill(-1),
  streamPositions = new Float32Array(3 * streamCount),
  streamGeo = new THREE.BufferGeometry(),
  streamAlpha = new Float32Array(streamCount).fill(1);
streamGeo.setAttribute("alpha", new THREE.BufferAttribute(streamAlpha, 1)),
  streamGeo.setAttribute(
    "position",
    new THREE.BufferAttribute(streamPositions, 3).setUsage(
      THREE.DynamicDrawUsage
    )
  );
const streamColors = new Float32Array(3 * streamCount);
for (let i = 0; i < streamCount; i++) {
  targetIdxArr[i];
  const color = i % 3 === 0 ? blue : i % 3 === 1 ? white : skyBlue;
  (streamColors[3 * i] = color.r),
    (streamColors[3 * i + 1] = color.g),
    (streamColors[3 * i + 2] = color.b);
}
streamGeo.setAttribute("color", new THREE.BufferAttribute(streamColors, 3));
const streamSizes = new Float32Array(streamCount);
for (let i = 0; i < streamCount; i++)
  streamSizes[i] = 8 * (0.3 * Math.random() + 0.2 + 0.1);
const streamSizeBase = streamSizes.slice(),
  BIG_RATIO = 0.1;
for (let i = 0; i < streamCount; i++)
  Math.random() < 0.1 &&
    (() => {
      const color = i % 3 === 0 ? blue : i % 3 === 1 ? white : skyBlue;
      (streamSizes[i] *= 1.2),
        (streamColors[3 * i] = color.r),
        (streamColors[3 * i + 1] = color.g),
        (streamColors[3 * i + 2] = color.b);
    })();
streamGeo.setAttribute("size", new THREE.BufferAttribute(streamSizes, 1));
const matStream = makeMat({
  map: snowflakeTexture,
  alphaSupport: !0,
  clipBandWidth: INDENT_HALF_WIDTH,
  clipFrontZ: 0.3,
});
matStream.alphaTest = 0.5;
const streamHeart = new THREE.Points(streamGeo, matStream);
(streamHeart.renderOrder = 5),
  (streamHeart.rotation.z = Math.PI),
  scene.add(streamHeart),
  (streamHeart.visible = !1),
  fadeObjects.push(streamHeart),
  (streamHeart.userData.fadeStage = STAGE.STREAM);
const FLOATING_SNOWFLAKE_COUNT = 5;
const floatingPositions = new Float32Array(3 * FLOATING_SNOWFLAKE_COUNT);
const floatingSizes = new Float32Array(FLOATING_SNOWFLAKE_COUNT);
const floatingColors = new Float32Array(3 * FLOATING_SNOWFLAKE_COUNT);
const floatingAlpha = new Float32Array(FLOATING_SNOWFLAKE_COUNT);
const floatingStartTimes = new Float32Array(FLOATING_SNOWFLAKE_COUNT);
const floatingTargetIndices = new Uint32Array(FLOATING_SNOWFLAKE_COUNT);
const floatingRiseDurations = new Float32Array(FLOATING_SNOWFLAKE_COUNT);
const FLOATING_SIZE_MIN = 2;
const FLOATING_SIZE_MAX = 4;
const FLOATING_RISE_DURATION_MIN = 4;
const FLOATING_RISE_DURATION_MAX = 7;
for (let i = 0; i < FLOATING_SNOWFLAKE_COUNT; i++) {
  const idx3 = 3 * i;
  const angle = Math.random() * Math.PI * 2;
  const radius = 0.25 + (rVortex - 0.25) * Math.random();
  floatingPositions[idx3] = Math.cos(angle) * radius;
  floatingPositions[idx3 + 1] = planeYCenter;
  floatingPositions[idx3 + 2] = Math.sin(angle) * radius;
  floatingStartTimes[i] = -Math.random() * FLOATING_RISE_DURATION_MAX;
  floatingTargetIndices[i] =
    topIndices[Math.floor(Math.random() * topIndices.length)];
  floatingSizes[i] =
    FLOATING_SIZE_MIN + Math.random() * (FLOATING_SIZE_MAX - FLOATING_SIZE_MIN);
  floatingRiseDurations[i] =
    FLOATING_RISE_DURATION_MIN +
    Math.random() * (FLOATING_RISE_DURATION_MAX - FLOATING_RISE_DURATION_MIN);
  const colorIdx = i % 3;
  const color = colorIdx === 0 ? blue : colorIdx === 1 ? white : skyBlue;
  floatingColors[idx3] = color.r;
  floatingColors[idx3 + 1] = color.g;
  floatingColors[idx3 + 2] = color.b;
  floatingAlpha[i] = 0;
}
const floatingGeo = new THREE.BufferGeometry();
floatingGeo.setAttribute(
  "position",
  new THREE.BufferAttribute(floatingPositions, 3).setUsage(
    THREE.DynamicDrawUsage
  )
);
floatingGeo.setAttribute("color", new THREE.BufferAttribute(floatingColors, 3));
floatingGeo.setAttribute("size", new THREE.BufferAttribute(floatingSizes, 1));
floatingGeo.setAttribute(
  "alpha",
  new THREE.BufferAttribute(floatingAlpha, 1).setUsage(THREE.DynamicDrawUsage)
);
const floatingMat = makeMat({
  map: snowflakeTexture,
  alphaSupport: !0,
  blending: THREE.AdditiveBlending,
  opacity: 0.9,
});
floatingMat.alphaTest = 0.5;
const floatingSnowflakes = new THREE.Points(floatingGeo, floatingMat);
(floatingSnowflakes.rotation.z = Math.PI),
  scene.add(floatingSnowflakes),
  (floatingSnowflakes.visible = !1),
  fadeObjects.push(floatingSnowflakes),
  (floatingSnowflakes.userData.fadeStage = STAGE.STREAM);
const PLANE_COLOR_CYCLE = 9,
  PLANE_COL_WHITE = new THREE.Color("rgb(255, 227, 249)"),
  PLANE_COL_LIGHT = new THREE.Color("rgb(255,192,215)"),
  PLANE_COL_DARK = new THREE.Color("rgb(241, 121, 185)");
function makeCharTexture(ch) {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 128;
  const ctx = canvas.getContext("2d");
  (ctx.fillStyle = "rgba(0,0,0,0)"),
    ctx.fillRect(0, 0, 128, 128),
    (ctx.textAlign = "center"),
    (ctx.textBaseline = "middle"),
    (ctx.font =
      '100 105px "Segoe UI Emoji","Noto Color Emoji","Apple Color Emoji",sans-serif'),
    (ctx.lineWidth = 7.68),
    (ctx.strokeStyle = "rgba(160, 30, 95, 0.9)"),
    ctx.strokeText(ch, 64, 64),
    (ctx.fillStyle = "#ffffff"),
    ctx.fillText(ch, 64, 64);
  const tex = new THREE.CanvasTexture(canvas);
  return (tex.minFilter = tex.magFilter = THREE.LinearFilter), tex;
}
const ringCharsFull = RingText.join(""),
  ringChars = Array.from(ringCharsFull),
  charMatMap = {};
[...new Set(ringChars)].forEach((ch) => {
  charMatMap[ch] = new THREE.SpriteMaterial({
    map: makeCharTexture(ch),
    transparent: !0,
    depthWrite: !1,
  });
});
const streamSprites = [];
for (let i = 0; i < streamCount; i++) {
  const ch = ringChars[i % ringChars.length],
    sp = new THREE.Sprite(charMatMap[ch]);
  sp.scale.set(1, 1, 1),
    (sp.visible = !1),
    streamHeart.add(sp),
    streamSprites.push(sp);
}
function createRingTexture(lines, options = {}) {
  const {
    width = 2048,
    height = 256,
    fontSize = 120,
    strokeWidth = 6,
    strokeStyle = "rgba(255,175,210,0.9)",
    fillStyle = "#ffffff",
    shadowBlur = 12,
    shadowColor = "rgba(0,0,0,0.35)",
  } = options;
  const canvas = document.createElement("canvas");
  (canvas.width = width), (canvas.height = height);
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "rgba(0,0,0,0)";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.font = `${fontSize}px "Segoe UI Emoji","Noto Color Emoji","Apple Color Emoji",sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.lineWidth = strokeWidth;
  ctx.strokeStyle = strokeStyle;
  ctx.fillStyle = fillStyle;
  ctx.shadowBlur = shadowBlur;
  ctx.shadowColor = shadowColor;
  const lineHeight = canvas.height / lines.length;
  lines.forEach((line, idx) => {
    const y = (idx + 0.5) * lineHeight;
    ctx.strokeText(line, canvas.width / 2, y);
    ctx.fillText(line, canvas.width / 2, y);
  });
  const tex = new THREE.CanvasTexture(canvas);
  const maxAnisotropy =
    renderer?.capabilities?.getMaxAnisotropy?.() ??
    renderer?.capabilities?.maxAnisotropy ??
    1;
  tex.anisotropy = maxAnisotropy;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  return (tex.needsUpdate = !0), tex;
}
const RING_TEXTURE_OPTIONS = {
    width: 4096,
    height: 512,
    fontSize: 176,
    strokeWidth: 14,
    strokeStyle: "rgba(140,180,255,0.95)",
    fillStyle: "#ffffff",
    shadowBlur: 12,
    shadowColor: "rgba(10,10,30,0.65)",
  },
  RING_TEXT_COLORS = [new THREE.Color(0xffffff), new THREE.Color(0x87ceeb)],
  ringTexture = createRingTexture(RingText, RING_TEXTURE_OPTIONS),
  ringMat = new THREE.MeshBasicMaterial({
    map: ringTexture,
    transparent: !0,
    side: THREE.DoubleSide,
    depthWrite: !1,
    blending: THREE.AdditiveBlending,
  }),
  RING_THICKNESS = 2.5,
  RING_HUE_SPEED = 0.05,
  RING_FADE_DIST = 1,
  RING_FADE_SPEED = 2,
  ringHeight = 0.6,
  RING_Y_OFFSET = 2 * -planeYCenter - 0.5,
  ringGeo = new THREE.CylinderGeometry(rVortex, rVortex, 1, 128, 1, !0),
  RING_SPACING = 1.8,
  RING_START_RADIUS = rVortex,
  RING_END_RADIUS = 0.25,
  RING_COUNT = RingText.length * 1,
  RING_FLIP_Y = Math.PI,
  RING_APPEAR_INTERVAL = 0.25,
  RING_FADE_IN_DURATION = 0.8,
  RING_IDLE_OPACITY = 0.6,
  ribbon = new THREE.Group();
let ribbonRevealStart = null;
ribbon.position.set(0, planeYCenter + RING_Y_OFFSET, 0),
  (ribbon.rotation.z = Math.PI),
  (ribbon.renderOrder = 10),
  scene.add(ribbon),
  (ribbon.visible = !0);
for (let i = 0; i < RING_COUNT; i++) {
  const texLine = createRingTexture(
    [RingText[i % RingText.length]],
    RING_TEXTURE_OPTIONS
  );
  (texLine.wrapS = THREE.RepeatWrapping),
    texLine.repeat.set(2, 1),
    (texLine.offset.x = 1);
  const ringMatLine = new THREE.MeshBasicMaterial({
      map: texLine,
      transparent: !0,
      side: THREE.DoubleSide,
      depthWrite: !1,
      depthTest: !1,
      blending: THREE.NormalBlending,
    }),
    ringMesh = new THREE.Mesh(ringGeo, ringMatLine);
  ringMesh.rotation.x = Math.PI;
  const initRad = RING_START_RADIUS - 1.8 * i;
  (ringMesh.userData.radius = initRad),
    (ringMesh.userData.phase = Math.random() * Math.PI * 2);
  ringMesh.userData.appearDelay = i * RING_APPEAR_INTERVAL;
  ringMesh.userData.colorIdx = i % RING_TEXT_COLORS.length;
  ringMesh.userData.cycleOpacity = RING_IDLE_OPACITY;
  const scale = initRad / RING_START_RADIUS;
  ringMesh.scale.set(scale, 2.0, scale),
    (ringMesh.material.opacity = RING_IDLE_OPACITY),
    (ringMesh.material.transparent = !0),
    (ringMesh.material.depthWrite = !1),
    (ringMesh.renderOrder = i),
    (ringMesh.visible = !0),
    ribbon.add(ringMesh);
}
const photoOrbit = new THREE.Group();
photoOrbit.position.y = ribbon.position.y + 8;
photoOrbit.visible = !1;
photoOrbit.userData.fadeStage = STAGE.STREAM;
photoOrbit.userData.rotationSpeed = 0.14;
scene.add(photoOrbit);
fadeObjects.push(photoOrbit);

function loadPhotoTexture(url, onLoad) {
  const image = new Image();
  image.crossOrigin = "anonymous";
  image.decoding = "async";
  image.onload = () => {
    const maxEdge = 640;
    const scale = Math.min(1, maxEdge / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const ctx = canvas.getContext("2d");
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.needsUpdate = !0;
    onLoad(texture, image.naturalWidth / image.naturalHeight);
  };
  image.onerror = () => console.log("Failed to load orbit photo:", url);
  image.src = url;
}

PhotoUrls.forEach((url, index) => {
  const angle = (index / PhotoUrls.length) * Math.PI * 2;
  const radius = RING_START_RADIUS + 7 + (index % 2) * 2.5;
  const card = new THREE.Group();
  const imageMaterial = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: !0,
    opacity: 1,
    side: THREE.DoubleSide,
    depthWrite: !1,
  });
  const photo = new THREE.Mesh(new THREE.PlaneGeometry(4.35, 3.35), imageMaterial);
  card.add(photo);
  card.position.set(
    Math.cos(angle) * radius,
    ((index % 3) - 1) * 3.7,
    Math.sin(angle) * radius
  );
  card.rotation.y = Math.PI / 2 - angle;
  card.rotation.z = ((index % 5) - 2) * 0.035;
  card.userData.baseScale = 1;
  photoOrbit.add(card);

  loadPhotoTexture(url, (texture, aspect) => {
    imageMaterial.map = texture;
    imageMaterial.color.set(0xffffff);
    imageMaterial.needsUpdate = !0;
    const aspectScale = THREE.MathUtils.clamp(aspect / (4.35 / 3.35), 0.72, 1.5);
    card.scale.x = aspectScale;
    card.userData.baseScale = aspectScale;
  });
});
const heartLayers = [
  staticHeart,
  bottomHeart,
  staticBottomHeart,
  staticTopHeart,
];
heartLayers.forEach((obj) => {
  obj && (scene.remove(obj), heartScene.add(obj));
}),
  heartLayers.forEach((obj) => {
    obj &&
      ((obj.visible = !1),
      (obj.userData.fadeStage = STAGE.HEART),
      fadeObjects.includes(obj) || fadeObjects.push(obj));
  });
const HEART_OFFSET_Y = 10;
[staticHeart, bottomHeart, staticTopHeart, staticBottomHeart].forEach((obj) => {
  obj && (obj.position.y += 10);
});
function createOrnamentTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 256;
  const ctx = canvas.getContext("2d");
  const centerX = 128,
    centerY = 128,
    radius = 100;
  const gradient = ctx.createRadialGradient(
    centerX,
    centerY,
    0,
    centerX,
    centerY,
    radius
  );
  gradient.addColorStop(0, "rgba(255,255,255,1)");
  gradient.addColorStop(0.3, "rgba(255,255,255,0.9)");
  gradient.addColorStop(0.6, "rgba(255,255,255,0.6)");
  gradient.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
  ctx.fill();
  const highlightGrad = ctx.createRadialGradient(
    centerX - 30,
    centerY - 30,
    0,
    centerX - 30,
    centerY - 30,
    50
  );
  highlightGrad.addColorStop(0, "rgba(255,255,255,0.8)");
  highlightGrad.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = highlightGrad;
  ctx.beginPath();
  ctx.arc(centerX - 30, centerY - 30, 50, 0, 2 * Math.PI);
  ctx.fill();
  const tex = new THREE.CanvasTexture(canvas);
  return (
    (tex.minFilter = THREE.LinearFilter),
    (tex.magFilter = THREE.LinearFilter),
    (tex.needsUpdate = !0),
    tex
  );
}
const ornamentTexture = createOrnamentTexture();
const ORNAMENT_COUNT = 15;
const ornamentPositions = new Float32Array(3 * ORNAMENT_COUNT);
const ornamentSizes = new Float32Array(ORNAMENT_COUNT);
const ornamentColors = new Float32Array(3 * ORNAMENT_COUNT);
const ornamentAlpha = new Float32Array(ORNAMENT_COUNT);
const ornamentColorPhases = new Float32Array(ORNAMENT_COUNT);
const rainbowColors = [
  new THREE.Color(1, 0, 0), // Đỏ
  new THREE.Color(1, 0.5, 0), // Cam
  new THREE.Color(1, 1, 0), // Vàng
  new THREE.Color(0, 1, 0), // Xanh lá
  new THREE.Color(0, 0.5, 1), // Xanh dương
  new THREE.Color(0.5, 0, 1), // Chàm
  new THREE.Color(1, 0, 1), // Tím
];
for (let i = 0; i < ORNAMENT_COUNT; i++) {
  const angle = (i / ORNAMENT_COUNT) * Math.PI * 2;
  const radius = 8 + Math.random() * 4;
  const x = Math.cos(angle) * radius;
  const y = Math.sin(angle) * radius + 2;
  const z = (Math.random() - 0.5) * 3;
  const idx3 = 3 * i;
  ornamentPositions[idx3] = x;
  ornamentPositions[idx3 + 1] = y;
  ornamentPositions[idx3 + 2] = z;
  ornamentSizes[i] = 3 + Math.random() * 2;
  ornamentAlpha[i] = 1;
  ornamentColorPhases[i] = Math.random() * 7;
  const initColor = rainbowColors[Math.floor(ornamentColorPhases[i]) % 7];
  ornamentColors[idx3] = initColor.r;
  ornamentColors[idx3 + 1] = initColor.g;
  ornamentColors[idx3 + 2] = initColor.b;
}
const ornamentGeo = new THREE.BufferGeometry();
ornamentGeo.setAttribute(
  "position",
  new THREE.BufferAttribute(ornamentPositions, 3).setUsage(
    THREE.DynamicDrawUsage
  )
);
ornamentGeo.setAttribute(
  "color",
  new THREE.BufferAttribute(ornamentColors, 3).setUsage(THREE.DynamicDrawUsage)
);
ornamentGeo.setAttribute("size", new THREE.BufferAttribute(ornamentSizes, 1));
ornamentGeo.setAttribute(
  "alpha",
  new THREE.BufferAttribute(ornamentAlpha, 1).setUsage(THREE.DynamicDrawUsage)
);
const ornamentMat = makeMat({
  map: ornamentTexture,
  blending: THREE.AdditiveBlending,
  depthWrite: !1,
  alphaSupport: !0,
  opacity: 1.5,
  sizeAttenuation: !1,
  vertexColors: !0,
});
ornamentMat.onBeforeCompile = function (shader) {
  (shader.vertexShader = shader.vertexShader.replace(
    "uniform float size;",
    "attribute float size; attribute float alpha; varying float vAlpha;"
  )),
    (shader.vertexShader = shader.vertexShader.replace(
      "#include <project_vertex>",
      "#include <project_vertex>\n  vAlpha = alpha;"
    )),
    (shader.fragmentShader = shader.fragmentShader.replace(
      "void main() {",
      "varying float vAlpha;\nvoid main(){"
    )),
    (shader.fragmentShader = shader.fragmentShader.replace(
      "gl_FragColor = vec4( outgoingLight, diffuseColor.a );",
      "gl_FragColor = vec4( outgoingLight, diffuseColor.a * vAlpha );"
    ));
};
const ornaments = new THREE.Points(ornamentGeo, ornamentMat);
(ornaments.renderOrder = 6),
  (ornaments.rotation.z = Math.PI),
  heartScene.add(ornaments),
  (ornaments.visible = !1),
  (ornaments.userData.fadeStage = STAGE.HEART),
  fadeObjects.push(ornaments);
const HEART_OFFSET_YY = 8;
[streamHeart, ribbon].forEach((obj) => {
  obj && (obj.position.y += 8);
});
const ENABLE_EXPLOSION = !1;
let expPositions,
  expVelocities,
  expBirth,
  expGeo,
  expColors,
  expMat,
  explosionPoints,
  MAX_EXP,
  expCount = 0;
const startTimes = new Float32Array(streamCount),
  STATE_ON_DISK = 0,
  STATE_ASCEND = 1,
  streamState = new Uint8Array(streamCount),
  curRadiusArr = new Float32Array(streamCount),
  ascendStart = new Float32Array(streamCount),
  spiralPhase = new Float32Array(streamCount),
  streamRadius = new Float32Array(streamCount),
  initialRadius = new Float32Array(streamCount),
  spiralFrequency = new Float32Array(streamCount),
  spiralDirection = new Float32Array(streamCount),
  extraRotArr = new Float32Array(streamCount),
  MAX_TOP_HIDE = Math.floor(1 * topIndices.length),
  HIDE_DISTANCE = 0.25,
  TOP_ROT_SPEED = 0.5,
  streamRiseDuration = new Float32Array(streamCount),
  streamOffsets = new Float32Array(3 * streamCount);
for (let i = 0; i < streamCount; i++) {
  const idx3 = 3 * i,
    theta = Math.random() * Math.PI * 2,
    phi = Math.acos(2 * Math.random() - 1),
    r = 0.4;
  (streamOffsets[idx3] = r * Math.sin(phi) * Math.cos(theta)),
    (streamOffsets[idx3 + 1] = r * Math.sin(phi) * Math.sin(theta)),
    (streamOffsets[idx3 + 2] = r * Math.cos(phi));
}
function resetStreamParticle(i, now) {
  const idx3 = 3 * i,
    targetIndex = targetIdxArr[i];
  const rInit = 0.25 + (rOuter - 0.25) * Math.random(),
    angStart = Math.random() * Math.PI * 2;
  (streamPositions[idx3] = Math.cos(angStart) * rInit),
    (streamPositions[idx3 + 1] = planeYCenter),
    (streamPositions[idx3 + 2] = Math.sin(angStart) * rInit),
    (curRadiusArr[i] = rInit),
    (spiralPhase[i] = angStart),
    (streamState[i] = 0),
    (startTimes[i] = now - (Math.random() * (rOuter - 0.25)) / 0.9),
    (ascendStart[i] = 10 * Math.random()),
    (streamRiseDuration[i] = 8 + 4 * Math.random());
  const rotTurns = 0.5 + 1.5 * Math.random(),
    dir = Math.random() < 0.5 ? -1 : 1;
  extraRotArr[i] = 2 * rotTurns * Math.PI * dir;
  const mIdx = idxToTopIdx[targetIndex];
  -1 !== mIdx &&
    ((topAlpha[mIdx] = 1), (staticGeo.attributes.alpha.needsUpdate = !0));
  const sprite = streamSprites[i];
  (sprite.visible = !1),
    (sprite.material.opacity = 0),
    sprite.position.set(
      streamPositions[idx3],
      streamPositions[idx3 + 1],
      streamPositions[idx3 + 2]
    ),
    (streamAlpha[i] = 1),
    (streamGeo.attributes.alpha.needsUpdate = !0);
}
const now0 = 0;
for (let i = 0; i < streamCount; i++) resetStreamParticle(i, 0);
(streamGeo.attributes.position.needsUpdate = !0),
  (streamGeo.attributes.alpha.needsUpdate = !0);
const clock = new THREE.Clock();
function animate() {
  requestAnimationFrame(animate);
  const delta = clock.getDelta(),
    now = clock.getElapsedTime();
  if (PhotoUrls.length && photoOrbit.visible) {
    photoOrbit.rotation.y = photoOrbit.userData.rotationSpeed * now;
  }
  updateShootingStars(delta);
  if (void 0 !== ribbon && ribbon.children.length) {
    const ribbonActive = null !== ribbonRevealStart;
    const totalSpan = RING_START_RADIUS - 0.25;
    ribbon.visible = !0;
    ribbon.rotation.y = BASE_OMEGA * now + RING_FLIP_Y;
    ribbon.children.forEach((ringMesh, idx) => {
      const colorIdx =
        ringMesh.userData.colorIdx ?? idx % RING_TEXT_COLORS.length;
      const baseColor =
        RING_TEXT_COLORS[colorIdx % RING_TEXT_COLORS.length] ?? white;
      ringMesh.material.color.copy(baseColor);
      if (!ribbonActive) {
        ringMesh.visible = !0;
        ringMesh.material.opacity = RING_IDLE_OPACITY;
        ringMesh.userData.cycleOpacity = RING_IDLE_OPACITY;
        ringMesh.rotation.y = ringMesh.userData.phase;
        return;
      }
      const appearDelay = ringMesh.userData.appearDelay ?? 0;
      const appearElapsed = now - ribbonRevealStart - appearDelay;
      if (appearElapsed <= 0) {
        ringMesh.visible = !1;
        ringMesh.material.opacity = 0;
        ringMesh.userData.cycleOpacity = 0;
        return;
      }
      const appearProgress = THREE.MathUtils.clamp(
        appearElapsed / RING_FADE_IN_DURATION,
        0,
        1
      );
      ringMesh.visible = !0;
      let cycleOpacity = ringMesh.userData.cycleOpacity ?? 0;
      ringMesh.userData.radius -= 0.9 * delta;
      ringMesh.userData.radius - 1.25 < 0.25 &&
        (ringMesh.userData.radius += totalSpan);
      const innerRadius = ringMesh.userData.radius - 1.25;
      if (innerRadius < 1.25) {
        const t = THREE.MathUtils.clamp((innerRadius - 0.25) / 1, 0, 1);
        cycleOpacity = t;
      }
      innerRadius < 0.25 &&
        ((ringMesh.userData.radius += totalSpan), (cycleOpacity = 0)),
        cycleOpacity < 1 &&
          (cycleOpacity = Math.min(1, cycleOpacity + 2 * delta));
      const s = ringMesh.userData.radius / RING_START_RADIUS;
      ringMesh.scale.set(s, 2.0, s);
      ringMesh.userData.cycleOpacity = cycleOpacity;
      ringMesh.material.opacity = cycleOpacity * appearProgress;
      ringMesh.rotation.y = ringMesh.userData.phase;
    });
  }
  camera.updateMatrixWorld();
  const camInvMat = camera.matrixWorldInverse;
  if (streamHeartStarted) {
    streamHeart.matrixWorld, new THREE.Vector3(), new THREE.Vector3();
    for (let i = 0; i < streamCount; i++) {
      const idx3 = 3 * i,
        start = startTimes[i],
        elapsed = now - (start + (i % 5) * 1.6),
        targetIndex = targetIdxArr[i];
      if (0 === streamState[i]) {
        const ang = spiralPhase[i] + BASE_OMEGA * (now - startTimes[i]);
        false,
          (streamPositions[idx3] = Math.cos(ang) * curRadiusArr[i]),
          (streamPositions[idx3 + 1] = planeYCenter),
          (streamPositions[idx3 + 2] = Math.sin(ang) * curRadiusArr[i]);
        const sprite = streamSprites[i];
        (sprite.visible = !0),
          (sprite.material.opacity = 1),
          sprite.position.set(
            streamPositions[idx3],
            streamPositions[idx3 + 1],
            streamPositions[idx3 + 2]
          ),
          (streamAlpha[i] = 1),
          elapsed >= ascendStart[i] &&
            ((streamState[i] = 1),
            (startTimes[i] = now),
            (initialRadius[i] = curRadiusArr[i]));
        continue;
      }
      if (elapsed < -2.5) {
        const ang0 = spiralPhase[i] + BASE_OMEGA * (now - start);
        (streamPositions[idx3] = initialRadius[i] * Math.cos(ang0)),
          (streamPositions[idx3 + 1] = planeYCenter),
          (streamPositions[idx3 + 2] = initialRadius[i] * Math.sin(ang0)),
          (streamAlpha[i] = 0);
        const sprite = streamSprites[i];
        (sprite.visible = !0),
          (sprite.material.opacity = 0),
          sprite.position.set(
            streamPositions[idx3],
            streamPositions[idx3 + 1],
            streamPositions[idx3 + 2]
          );
        continue;
      }
      if (elapsed < 0) {
        const lin = (elapsed + 2.5) / 2.5,
          s = lin * lin * (3 - 2 * lin);
        streamAlpha[i] = s;
        const ang0 = spiralPhase[i] + BASE_OMEGA * (now - start);
        (streamPositions[idx3] = initialRadius[i] * Math.cos(ang0)),
          (streamPositions[idx3 + 1] = planeYCenter),
          (streamPositions[idx3 + 2] = initialRadius[i] * Math.sin(ang0));
        const sprite = streamSprites[i];
        (sprite.visible = !0),
          (sprite.material.opacity = s),
          sprite.position.set(
            streamPositions[idx3],
            streamPositions[idx3 + 1],
            streamPositions[idx3 + 2]
          );
        continue;
      }
      const riseDur = streamRiseDuration[i];
      if (elapsed >= riseDur) {
        const k = (elapsed - riseDur) / 2.5;
        if (k < 1) {
          const s2 = k * k * (3 - 2 * k);
          streamAlpha[i] = 1 - s2;
          const ang0 = spiralPhase[i] + BASE_OMEGA * (now - start);
          (streamPositions[idx3] = initialRadius[i] * Math.cos(ang0)),
            (streamPositions[idx3 + 1] = planeYCenter),
            (streamPositions[idx3 + 2] = initialRadius[i] * Math.sin(ang0));
          const sprite = streamSprites[i];
          (sprite.visible = !0),
            (sprite.material.opacity = 1 - s2),
            sprite.position.set(
              streamPositions[idx3],
              streamPositions[idx3 + 1],
              streamPositions[idx3 + 2]
            );
          continue;
        }
        (streamAlpha[i] = 1),
          resetStreamParticle(i, now),
          firstResetCompleted || (firstResetCompleted = !0);
        continue;
      }
      streamAlpha[i] = 1;
      const prog = elapsed / riseDur;
      if (prog < 0.01) {
        let newX, newY, newZ;
        const ang0 = spiralPhase[i] + BASE_OMEGA * (now - start);
        {
          const currentRadius = initialRadius[i];
          (newX = Math.cos(ang0) * currentRadius),
            (newZ = Math.sin(ang0) * currentRadius);
          const kAsc = Math.min(1, prog / 0.01);
          newY = THREE.MathUtils.lerp(planeYCenter, apexY, kAsc);
        }
        (streamPositions[idx3] = newX),
          (streamPositions[idx3 + 1] = newY),
          (streamPositions[idx3 + 2] = newZ);
      } else {
        const t = (prog - 0.01) / 0.99,
          easedT = 1 - Math.pow(1 - t, 3),
          angBurst = spiralPhase[i] + BASE_OMEGA * (now - start),
          radiusStart = initialRadius[i],
          startX = Math.cos(angBurst) * radiusStart,
          startZ = Math.sin(angBurst) * radiusStart,
          startY = apexY,
          baseIdx3 = 3 * targetIndex,
          targetX = positions[baseIdx3],
          targetY = positions[baseIdx3 + 1] - 4 + 2,
          targetZ = positions[baseIdx3 + 2];
        let newXBurst = THREE.MathUtils.lerp(startX, targetX, easedT),
          newYBurst = THREE.MathUtils.lerp(startY, targetY, easedT),
          newZBurst = THREE.MathUtils.lerp(startZ, targetZ, easedT);
        const spreadScale = 1 + 0.1 * (1 - easedT);
        (newXBurst *= spreadScale), (newZBurst *= spreadScale);
        const rotExtra = (1 - easedT) * extraRotArr[i],
          cosE = Math.cos(rotExtra),
          sinE = Math.sin(rotExtra),
          tmpX = newXBurst * cosE - newZBurst * sinE,
          tmpZ = newXBurst * sinE + newZBurst * cosE;
        (streamPositions[idx3] = tmpX),
          (streamPositions[idx3 + 1] = newYBurst),
          (streamPositions[idx3 + 2] = tmpZ);
      }
      const sprite = streamSprites[i];
      (sprite.visible = !0),
        (sprite.material.opacity = 1),
        sprite.position.set(
          streamPositions[idx3],
          streamPositions[idx3 + 1],
          streamPositions[idx3 + 2]
        );
      if (
        ((streamAlpha[i] = 1),
        (streamGeo.attributes.size.needsUpdate = !0),
        prog > 0.95)
      ) {
        const topIdxPos = topIndices.indexOf(targetIndex);
        if (topPointVisibility[topIdxPos] && hiddenTopCount < MAX_TOP_HIDE) {
          topPointVisibility[topIdxPos] = !1;
          const mIdx = idxToTopIdx[targetIndex];
          -1 !== mIdx &&
            ((topAlpha[mIdx] = 0),
            (staticGeo.attributes.alpha.needsUpdate = !0)),
            hiddenTopCount++;
        }
      }
    }
  } else {
    for (let i = 0; i < streamCount; i++) {
      if (streamHeartActiveRatio < 1 && i / streamCount > 0.1) {
        const idx3 = 3 * i,
          ang = spiralPhase[i] + BASE_OMEGA * now;
        (streamPositions[idx3] = Math.cos(ang) * curRadiusArr[i]),
          (streamPositions[idx3 + 1] = planeYCenter),
          (streamPositions[idx3 + 2] = Math.sin(ang) * curRadiusArr[i]),
          (streamAlpha[i] = 0);
        continue;
      }
      if (!firstResetCompleted && i / streamCount > 1e-4) {
        const idx3 = 3 * i,
          ang = spiralPhase[i] + BASE_OMEGA * now;
        (streamPositions[idx3] = Math.cos(ang) * curRadiusArr[i]),
          (streamPositions[idx3 + 1] = planeYCenter),
          (streamPositions[idx3 + 2] = Math.sin(ang) * curRadiusArr[i]),
          (streamAlpha[i] = 0);
        continue;
      }
      const idx3 = 3 * i,
        ang = spiralPhase[i] + BASE_OMEGA * now;
      (streamPositions[idx3] = Math.cos(ang) * curRadiusArr[i]),
        (streamPositions[idx3 + 1] = planeYCenter),
        (streamPositions[idx3 + 2] = Math.sin(ang) * curRadiusArr[i]),
        (streamAlpha[i] = 0);
    }
    (streamGeo.attributes.position.needsUpdate = !0),
      (streamGeo.attributes.alpha.needsUpdate = !0);
  }
  (streamGeo.attributes.position.needsUpdate = !0),
    (streamGeo.attributes.alpha.needsUpdate = !0);
  if (streamHeartStarted && floatingSnowflakes.visible) {
    for (let i = 0; i < FLOATING_SNOWFLAKE_COUNT; i++) {
      const idx3 = 3 * i;
      const elapsed = now - floatingStartTimes[i];
      if (elapsed < 0) {
        floatingAlpha[i] = 0;
        continue;
      }
      const riseDur = floatingRiseDurations[i];
      const progress = elapsed / riseDur;
      if (progress >= 1) {
        const angle = Math.random() * Math.PI * 2;
        const radius = 0.25 + (rVortex - 0.25) * Math.random();
        floatingPositions[idx3] = Math.cos(angle) * radius;
        floatingPositions[idx3 + 1] = planeYCenter;
        floatingPositions[idx3 + 2] = Math.sin(angle) * radius;
        floatingStartTimes[i] = now - Math.random() * 2;
        floatingTargetIndices[i] =
          topIndices[Math.floor(Math.random() * topIndices.length)];
        floatingRiseDurations[i] =
          FLOATING_RISE_DURATION_MIN +
          Math.random() *
            (FLOATING_RISE_DURATION_MAX - FLOATING_RISE_DURATION_MIN);
        floatingAlpha[i] = 0;
        continue;
      }
      const startAngle = Math.atan2(
        floatingPositions[idx3 + 2],
        floatingPositions[idx3]
      );
      const startRadius = Math.hypot(
        floatingPositions[idx3],
        floatingPositions[idx3 + 2]
      );
      const targetIdx = floatingTargetIndices[i];
      const targetIdx3 = 3 * targetIdx;
      const targetX = positions[targetIdx3];
      const targetY = positions[targetIdx3 + 1] - 4 + 2;
      const targetZ = positions[targetIdx3 + 2];
      const easedProgress = 1 - Math.pow(1 - progress, 2);
      floatingPositions[idx3] = THREE.MathUtils.lerp(
        Math.cos(startAngle) * startRadius,
        targetX,
        easedProgress
      );
      floatingPositions[idx3 + 1] = THREE.MathUtils.lerp(
        planeYCenter,
        targetY,
        easedProgress
      );
      floatingPositions[idx3 + 2] = THREE.MathUtils.lerp(
        Math.sin(startAngle) * startRadius,
        targetZ,
        easedProgress
      );
      if (progress < 0.15) {
        floatingAlpha[i] = progress / 0.15;
      } else if (progress > 0.85) {
        floatingAlpha[i] = (1 - progress) / 0.15;
      } else {
        floatingAlpha[i] = 1;
      }
    }
    floatingGeo.attributes.position.needsUpdate = !0;
    floatingGeo.attributes.alpha.needsUpdate = !0;
  }
  const bottomPosArr = bottomGeo.attributes.position.array;
  for (let i = 0; i < bottomCount; i++) {
    if (now < bottomDelayArr[i]) continue;
    const theta = bottomPhaseArr[i],
      r = bottomRadiusArr[i],
      baseX = Math.cos(theta) * r;
    if (Math.abs(theta) < 0.25 * Math.PI) {
      const distToCleft = Math.min(1, Math.abs(baseX) / (0.25 * heartWidth)),
        cleftFactor = 1.5 * Math.pow(1 - distToCleft, 3) + 1,
        sign = baseX >= 0 ? 1 : -1;
      bottomPosArr[3 * i] =
        baseX + sign * (Math.abs(baseX) * (cleftFactor - 1));
    } else bottomPosArr[3 * i] = baseX;
    bottomPosArr[3 * i + 2] = Math.sin(theta) * r;
    const xLocal = bottomPosArr[3 * i],
      yLocal = bottomPosArr[3 * i + 1],
      zLocal = bottomPosArr[3 * i + 2],
      worldPos = new THREE.Vector3(xLocal, yLocal, zLocal).applyMatrix4(
        bottomHeart.matrixWorld
      );
    new THREE.Vector3().copy(worldPos).applyMatrix4(camInvMat),
      (bottomAlphaArr[i] = bottomAlphaBase[i]);
  }
  (bottomGeo.attributes.position.needsUpdate = !0),
    (bottomGeo.attributes.alpha.needsUpdate = !0);
  const camAz = controls.getAzimuthalAngle();
  if (
    (staticHeart && (staticHeart.rotation.y = camAz),
    bottomHeart && (bottomHeart.rotation.y = camAz),
    staticBottomHeart && (staticBottomHeart.rotation.y = camAz),
    staticTopHeart && (staticTopHeart.rotation.y = camAz),
    ornaments && (ornaments.rotation.y = camAz),
    heartbeatEnabled)
  ) {
    const beatScale = 1 + 0.05 * Math.sin(0.5 * now * Math.PI * 2);
    staticHeart && staticHeart.scale.set(beatScale, beatScale, beatScale),
      bottomHeart && bottomHeart.scale.set(beatScale, beatScale, beatScale),
      staticBottomHeart &&
        staticBottomHeart.scale.set(beatScale, beatScale, beatScale),
      staticTopHeart &&
        staticTopHeart.scale.set(beatScale, beatScale, beatScale);
  }
  if (
    (controls.update(),
    renderer.clear(),
    composerHeart.render(),
    renderer.clearDepth(),
    (renderer.autoClear = !1),
    composerMain.render(),
    (renderer.autoClear = !0),
    hiddenTopCount < MAX_TOP_HIDE)
  ) {
    for (
      let attempt = 0;
      attempt < 5 && hiddenTopCount < MAX_TOP_HIDE;
      attempt++
    ) {
      const rnd = Math.floor(Math.random() * topIndices.length),
        idxTop = topIndices[rnd];
      if (topPointVisibility[rnd]) {
        topPointVisibility[rnd] = !1;
        const mIdx = idxToTopIdx[idxTop];
        -1 !== mIdx && ((topAlpha[mIdx] = 0), hiddenTopCount++);
      }
    }
    (staticGeo.attributes.position.needsUpdate = !0),
      (staticGeo.attributes.alpha.needsUpdate = !0);
  }
  const tCycle = (now % 9) / 9;
  let colTmp = new THREE.Color();
  if (tCycle < 1 / 3) {
    const k = 3 * tCycle;
    colTmp.copy(PLANE_COL_WHITE).lerp(PLANE_COL_LIGHT, k);
  } else if (tCycle < 2 / 3) {
    const k = 3 * (tCycle - 1 / 3);
    colTmp.copy(PLANE_COL_LIGHT).lerp(PLANE_COL_DARK, k);
  } else {
    const k = 3 * (tCycle - 2 / 3);
    colTmp.copy(PLANE_COL_DARK).lerp(PLANE_COL_WHITE, k);
  }
  function applyColor(attrArray) {
    for (let k = 0; k < attrArray.length; k += 3) {
      const idx = k / 3;
      const color = idx % 3 === 0 ? blue : idx % 3 === 1 ? white : skyBlue;
      (attrArray[k] = color.r),
        (attrArray[k + 1] = color.g),
        (attrArray[k + 2] = color.b);
    }
  }
  if (
    (applyColor(staticGeo.attributes.color.array),
    (staticGeo.attributes.color.needsUpdate = !0),
    applyColor(bottomGeo.attributes.color.array),
    (bottomGeo.attributes.color.needsUpdate = !0),
    staticBottomHeart &&
      (applyColor(staticBottomHeart.geometry.attributes.color.array),
      (staticBottomHeart.geometry.attributes.color.needsUpdate = !0)),
    staticTopHeart &&
      (applyColor(staticTopHeart.geometry.attributes.color.array),
      (staticTopHeart.geometry.attributes.color.needsUpdate = !0)),
    ribbon.children.forEach((ringMesh, idx) => {
      const color = idx % 3 === 0 ? blue : idx % 3 === 1 ? white : skyBlue;
      ringMesh.material.color.setRGB(color.r, color.g, color.b),
        (ringMesh.material.needsUpdate = !0);
    }),
    void 0 !== starAlpha)
  ) {
    for (let s = 0; s < STAR_COUNT; s++) {
      starAlpha[s] = 0.7 + 0.3 * Math.sin(2 * now + starPhase[s]);
      const idx3 = 3 * s;
      starPositions[idx3 + 1] -= starVelocities[s] * delta;
      if (starPositions[idx3 + 1] < STAR_BOTTOM_Y) {
        starPositions[idx3] = (Math.random() - 0.5) * 400;
        starPositions[idx3 + 1] = STAR_RESET_Y;
        starPositions[idx3 + 2] = (Math.random() - 0.5) * 400;
        starVelocities[s] =
          STAR_FALL_SPEED_MIN +
          Math.random() * (STAR_FALL_SPEED_MAX - STAR_FALL_SPEED_MIN);
      }
    }
    starGeo.attributes.position.needsUpdate = !0;
    starGeo.attributes.alpha.needsUpdate = !0;
  }
  if (pngBgFields && pngBgFields.length > 0) {
    for (let f = 0; f < pngBgFields.length; f++) {
      const pngField = pngBgFields[f];
      if (!pngField || !pngField.visible) continue;
      const pngIndices = pngField.userData.pngIndices;
      const pngGeo = pngField.userData.pngGeo;
      const pngPosArr = pngGeo.attributes.position.array;
      for (let k = 0; k < pngIndices.length; k++) {
        const srcIdx = pngIndices[k];
        const srcIdx3 = 3 * srcIdx;
        const dstIdx3 = 3 * k;
        pngBgPositions[srcIdx3 + 1] -= pngBgVelocities[srcIdx] * delta;
        if (pngBgPositions[srcIdx3 + 1] < PNG_BG_BOTTOM_Y) {
          pngBgPositions[srcIdx3] = (Math.random() - 0.5) * 400;
          pngBgPositions[srcIdx3 + 1] = PNG_BG_RESET_Y;
          pngBgPositions[srcIdx3 + 2] = (Math.random() - 0.5) * 400;
          pngBgVelocities[srcIdx] =
            PNG_BG_FALL_SPEED_MIN +
            Math.random() * (PNG_BG_FALL_SPEED_MAX - PNG_BG_FALL_SPEED_MIN);
          pngBgSizes[srcIdx] =
            PNG_BG_SIZE_MIN +
            Math.random() * (PNG_BG_SIZE_MAX - PNG_BG_SIZE_MIN);
        }
        pngPosArr[dstIdx3] = pngBgPositions[srcIdx3];
        pngPosArr[dstIdx3 + 1] = pngBgPositions[srcIdx3 + 1];
        pngPosArr[dstIdx3 + 2] = pngBgPositions[srcIdx3 + 2];
      }
      pngGeo.attributes.position.needsUpdate = !0;
    }
  }
  if (ledStrings && ledStrings.visible) {
    const blinkSpeed = 3;
    for (let i = 0; i < LED_TOTAL_COUNT; i++) {
      const phase = (ledPhases[i] + now * blinkSpeed) % (Math.PI * 2);
      ledAlpha[i] = 0.4 + 0.6 * (0.5 + 0.5 * Math.sin(phase));
      const idx3 = 3 * i;
      const brightness = 0.8 + 0.2 * Math.sin(phase * 2);
      ledColors[idx3] = warmYellow.r * brightness;
      ledColors[idx3 + 1] = warmYellow.g * brightness;
      ledColors[idx3 + 2] = warmYellow.b * brightness;
    }
    ledGeo.attributes.alpha.needsUpdate = !0;
    ledGeo.attributes.color.needsUpdate = !0;
  }
  if (ornaments && ornaments.visible) {
    const blinkSpeed = 2;
    for (let i = 0; i < ORNAMENT_COUNT; i++) {
      const phase = (ornamentColorPhases[i] + now * blinkSpeed) % 7;
      const colorIdx = Math.floor(phase);
      const t = phase - colorIdx;
      const color1 = rainbowColors[colorIdx % 7];
      const color2 = rainbowColors[(colorIdx + 1) % 7];
      const currentColor = new THREE.Color().lerpColors(color1, color2, t);
      const idx3 = 3 * i;
      ornamentColors[idx3] = currentColor.r;
      ornamentColors[idx3 + 1] = currentColor.g;
      ornamentColors[idx3 + 2] = currentColor.b;
      ornamentAlpha[i] = 0.7 + 0.3 * Math.sin(now * 3 + i);
    }
    ornamentGeo.attributes.color.needsUpdate = !0;
    ornamentGeo.attributes.alpha.needsUpdate = !0;
  }
  if (heartbeatEnabled) {
    const beatScale = 1 + 0.05 * Math.sin(0.5 * now * Math.PI * 2);
    staticHeart && staticHeart.scale.set(beatScale, beatScale, beatScale),
      bottomHeart && bottomHeart.scale.set(beatScale, beatScale, beatScale),
      staticBottomHeart &&
        staticBottomHeart.scale.set(beatScale, beatScale, beatScale),
      staticTopHeart &&
        staticTopHeart.scale.set(beatScale, beatScale, beatScale);
  }
  if (
    (null !== revealStart &&
      (fadeObjects.forEach((obj) => {
        if (!obj || obj === ribbon) return;
        const st = obj.userData.fadeStage ?? 0,
          lin = THREE.MathUtils.clamp(
            (now - revealStart - 0.7 * st) / 0.7,
            0,
            1
          ),
          tFade = lin * lin * (3 - 2 * lin);
        if (st === STAGE.STREAM || st === STAGE.STAR) {
          obj.visible = tFade > 0.01;
        }
        obj.traverse?.((child) => {
          const mat = child.material;
          if (!mat) return;
          const base = child.userData.baseOpacity ?? 1;
          mat.opacity = base * tFade;
        }),
          st === STAGE.STREAM &&
            tFade > 0.1 &&
            ((streamHeartStarted = !0), (streamHeartActiveRatio = tFade));
        if (obj === floatingSnowflakes && tFade > 0.1) {
          floatingSnowflakes.visible = !0;
        }
      }),
      now - revealStart > 0.7 * (STAGE.HEART + 1) && (revealStart = null)),
    null !== cameraAnimationStart)
  ) {
    const elapsed = now - cameraAnimationStart,
      progress = THREE.MathUtils.clamp(elapsed / 5, 0, 1),
      t = progress * progress * (3 - 2 * progress);
    (camera.position.x = THREE.MathUtils.lerp(
      CAMERA_START_POSITION.x,
      CAMERA_END_POSITION.x,
      t
    )),
      (camera.position.y = THREE.MathUtils.lerp(
        CAMERA_START_POSITION.y,
        CAMERA_END_POSITION.y,
        t
      )),
      (camera.position.z = THREE.MathUtils.lerp(
        CAMERA_START_POSITION.z,
        CAMERA_END_POSITION.z,
        t
      )),
      camera.lookAt(0, 0, 0),
      progress >= 1 && (cameraAnimationStart = null);
  }
}
window.addEventListener("resize", () => {
  (camera.aspect = window.innerWidth / window.innerHeight),
    camera.updateProjectionMatrix(),
    renderer.setSize(window.innerWidth, window.innerHeight);
});
const refinedBottomPos = [],
  refinedBottomColors = [],
  refinedBottomSizes = [];
for (let i = 0; i < bottomPositions.length; i += 3) {
  const px = bottomPositions[i],
    py = bottomPositions[i + 1],
    pz = bottomPositions[i + 2];
  (minDistToBorder(px, py) < BORDER_THRESHOLD || Math.random() < 0.9) &&
    (() => {
      const idx = i / 3;
      const color = idx % 3 === 0 ? blue : idx % 3 === 1 ? white : skyBlue;
      refinedBottomPos.push(px, py, pz),
        refinedBottomColors.push(color.r, color.g, color.b),
        refinedBottomSizes.push(bottomSizes[idx]);
    })();
}
(bottomPositions = refinedBottomPos),
  (bottomColors.length = 0),
  bottomColors.push(...refinedBottomColors),
  (bottomSizes.length = 0),
  bottomSizes.push(...refinedBottomSizes),
  (STAR_COUNT = 1e3);
const starPositions = new Float32Array(3 * STAR_COUNT),
  starColors = new Float32Array(3 * STAR_COUNT),
  starSizes = new Float32Array(STAR_COUNT);
(starAlpha = new Float32Array(STAR_COUNT)),
  (starPhase = new Float32Array(STAR_COUNT));
const STAR_RADIUS = 200;
const starVelocities = new Float32Array(STAR_COUNT);
const STAR_FALL_SPEED_MIN = 5;
const STAR_FALL_SPEED_MAX = 15;
const STAR_RESET_Y = 200;
const STAR_BOTTOM_Y = -200;
for (let i = 0; i < STAR_COUNT; i++) {
  const x = (Math.random() - 0.5) * 400,
    y = Math.random() * 400 + 100,
    z = (Math.random() - 0.5) * 400;
  const idx3 = 3 * i;
  (starPositions[idx3] = x),
    (starPositions[idx3 + 1] = y),
    (starPositions[idx3 + 2] = z);
  starVelocities[i] =
    STAR_FALL_SPEED_MIN +
    Math.random() * (STAR_FALL_SPEED_MAX - STAR_FALL_SPEED_MIN);
  const tint = 0.95 + 0.05 * Math.random();
  (starColors[idx3] = tint),
    (starColors[idx3 + 1] = tint),
    (starColors[idx3 + 2] = 1),
    (starSizes[i] = 22.5 * Math.random() + 2.5),
    (starAlpha[i] = 1),
    (starPhase[i] = Math.random() * Math.PI * 2);
}
(starGeo = new THREE.BufferGeometry()),
  starGeo.setAttribute(
    "position",
    new THREE.BufferAttribute(starPositions, 3).setUsage(THREE.DynamicDrawUsage)
  ),
  starGeo.setAttribute("color", new THREE.BufferAttribute(starColors, 3)),
  starGeo.setAttribute("size", new THREE.BufferAttribute(starSizes, 1)),
  starGeo.setAttribute(
    "alpha",
    new THREE.BufferAttribute(starAlpha, 1).setUsage(THREE.DynamicDrawUsage)
  );
const starMat = makeMat({
  map: snowflakeTexture,
  blending: THREE.AdditiveBlending,
  depthWrite: !1,
  alphaSupport: !0,
  opacity: 1.2,
  sizeAttenuation: !1,
});
starMat.onBeforeCompile = function (shader) {
  (shader.vertexShader = shader.vertexShader.replace(
    "uniform float size;",
    "attribute float size; attribute float alpha; varying float vAlpha;"
  )),
    (shader.vertexShader = shader.vertexShader.replace(
      "#include <project_vertex>",
      "#include <project_vertex>\n  vAlpha = alpha;"
    )),
    (shader.fragmentShader = shader.fragmentShader.replace(
      "void main() {",
      "varying float vAlpha;\nvoid main(){"
    )),
    (shader.fragmentShader = shader.fragmentShader.replace(
      "gl_FragColor = vec4( outgoingLight, diffuseColor.a );",
      "gl_FragColor = vec4( outgoingLight, diffuseColor.a * vAlpha );"
    ));
};
const starField = new THREE.Points(starGeo, starMat);
(starField.renderOrder = -10),
  scene.add(starField),
  (starField.visible = !0),
  fadeObjects.push(starField),
  (starField.userData.fadeStage = STAGE.STREAM);

function createShootingStarTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 64;
  const ctx = canvas.getContext("2d");
  const streak = ctx.createLinearGradient(0, 0, canvas.width, 0);
  streak.addColorStop(0, "rgba(255,255,255,1)");
  streak.addColorStop(0.08, "rgba(185,225,255,0.95)");
  streak.addColorStop(0.45, "rgba(105,180,255,0.35)");
  streak.addColorStop(1, "rgba(70,145,255,0)");
  ctx.strokeStyle = streak;
  ctx.lineWidth = 7;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(8, 32);
  ctx.lineTo(248, 32);
  ctx.stroke();
  const glow = ctx.createRadialGradient(9, 32, 0, 9, 32, 18);
  glow.addColorStop(0, "rgba(255,255,255,1)");
  glow.addColorStop(0.25, "rgba(190,230,255,0.85)");
  glow.addColorStop(1, "rgba(100,180,255,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 14, 28, 36);
  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.needsUpdate = !0;
  return texture;
}

const shootingStarTexture = createShootingStarTexture();
const shootingStars = Array.from(
  { length: window.innerWidth < 700 ? 3 : 5 },
  (_, index) => {
    const material = new THREE.SpriteMaterial({
      map: shootingStarTexture,
      color: 0xdaf2ff,
      transparent: !0,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: !1,
      depthTest: !1,
    });
    const sprite = new THREE.Sprite(material);
    sprite.scale.set(22, 4, 1);
    sprite.material.rotation = 0.44;
    sprite.renderOrder = -11;
    sprite.userData.delay = 1.5 + index * 2.2 + Math.random() * 2;
    sprite.userData.progress = 0;
    sprite.userData.duration = 0.9;
    sprite.visible = !1;
    scene.add(sprite);
    return sprite;
  }
);

function resetShootingStar(star) {
  const start = new THREE.Vector3(
    35 + Math.random() * 35,
    35 + Math.random() * 55,
    -45 - Math.random() * 55
  );
  star.userData.start = start;
  star.userData.end = start.clone().add(
    new THREE.Vector3(-75 - Math.random() * 30, -36 - Math.random() * 20, 0)
  );
  star.userData.progress = 0;
  star.userData.duration = 0.75 + Math.random() * 0.55;
  star.userData.delay = 2.5 + Math.random() * 7;
  star.material.opacity = 0;
  star.visible = !1;
}

function updateShootingStars(delta) {
  shootingStars.forEach((star) => {
    if (!star.userData.start) {
      if (star.userData.delay > 0) {
        star.userData.delay -= delta;
        return;
      }
      resetShootingStar(star);
      star.userData.delay = 0;
    }
    if (star.userData.delay > 0) {
      star.userData.delay -= delta;
      return;
    }
    star.visible = !0;
    star.userData.progress += delta / star.userData.duration;
    const progress = star.userData.progress;
    if (progress >= 1) {
      resetShootingStar(star);
      return;
    }
    star.position.lerpVectors(star.userData.start, star.userData.end, progress);
    const fadeIn = THREE.MathUtils.smoothstep(progress, 0, 0.12);
    const fadeOut = 1 - THREE.MathUtils.smoothstep(progress, 0.58, 1);
    star.material.opacity = 0.9 * fadeIn * fadeOut;
  });
}
function createLEDTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 64;
  const ctx = canvas.getContext("2d");
  const centerX = 32,
    centerY = 32,
    radius = 20;
  const gradient = ctx.createRadialGradient(
    centerX,
    centerY,
    0,
    centerX,
    centerY,
    radius
  );
  gradient.addColorStop(0, "rgba(255, 220, 100, 1)");
  gradient.addColorStop(0.4, "rgba(255, 200, 80, 0.9)");
  gradient.addColorStop(0.7, "rgba(255, 180, 60, 0.6)");
  gradient.addColorStop(1, "rgba(255, 160, 40, 0)");
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
  ctx.fill();
  const highlightGrad = ctx.createRadialGradient(
    centerX - 8,
    centerY - 8,
    0,
    centerX - 8,
    centerY - 8,
    12
  );
  highlightGrad.addColorStop(0, "rgba(255, 255, 200, 0.8)");
  highlightGrad.addColorStop(1, "rgba(255, 255, 200, 0)");
  ctx.fillStyle = highlightGrad;
  ctx.beginPath();
  ctx.arc(centerX - 8, centerY - 8, 12, 0, 2 * Math.PI);
  ctx.fill();
  const tex = new THREE.CanvasTexture(canvas);
  return (
    (tex.minFilter = THREE.LinearFilter),
    (tex.magFilter = THREE.LinearFilter),
    (tex.needsUpdate = !0),
    tex
  );
}
const ledTexture = createLEDTexture();
const LED_STRING_COUNT = 5;
const LED_PER_STRING = 30;
const LED_TOTAL_COUNT = LED_STRING_COUNT * LED_PER_STRING;
const ledPositions = new Float32Array(3 * LED_TOTAL_COUNT);
const ledSizes = new Float32Array(LED_TOTAL_COUNT);
const ledColors = new Float32Array(3 * LED_TOTAL_COUNT);
const ledAlpha = new Float32Array(LED_TOTAL_COUNT);
const ledPhases = new Float32Array(LED_TOTAL_COUNT);
const warmYellow = new THREE.Color(1, 0.85, 0.4);
for (let s = 0; s < LED_STRING_COUNT; s++) {
  const startX = -200 + s * 100;
  const startY = 150 - s * 30;
  const startZ = -150 + s * 50;
  const endX = startX + 400;
  const endY = startY - 300;
  const endZ = startZ + 100;
  for (let l = 0; l < LED_PER_STRING; l++) {
    const idx = s * LED_PER_STRING + l;
    const t = l / (LED_PER_STRING - 1);
    const x =
      THREE.MathUtils.lerp(startX, endX, t) + (Math.random() - 0.5) * 10;
    const y =
      THREE.MathUtils.lerp(startY, endY, t) + (Math.random() - 0.5) * 10;
    const z =
      THREE.MathUtils.lerp(startZ, endZ, t) + (Math.random() - 0.5) * 10;
    const idx3 = 3 * idx;
    ledPositions[idx3] = x;
    ledPositions[idx3 + 1] = y;
    ledPositions[idx3 + 2] = z;
    ledSizes[idx] = 8 + Math.random() * 4;
    ledAlpha[idx] = 0.3 + Math.random() * 0.7;
    ledPhases[idx] = Math.random() * Math.PI * 2;
    ledColors[idx3] = warmYellow.r;
    ledColors[idx3 + 1] = warmYellow.g;
    ledColors[idx3 + 2] = warmYellow.b;
  }
}
const ledGeo = new THREE.BufferGeometry();
ledGeo.setAttribute(
  "position",
  new THREE.BufferAttribute(ledPositions, 3).setUsage(THREE.DynamicDrawUsage)
);
ledGeo.setAttribute(
  "color",
  new THREE.BufferAttribute(ledColors, 3).setUsage(THREE.DynamicDrawUsage)
);
ledGeo.setAttribute("size", new THREE.BufferAttribute(ledSizes, 1));
ledGeo.setAttribute(
  "alpha",
  new THREE.BufferAttribute(ledAlpha, 1).setUsage(THREE.DynamicDrawUsage)
);
const ledMat = makeMat({
  map: ledTexture,
  blending: THREE.AdditiveBlending,
  depthWrite: !1,
  alphaSupport: !0,
  opacity: 1.5,
  sizeAttenuation: !1,
  vertexColors: !0,
});
ledMat.onBeforeCompile = function (shader) {
  (shader.vertexShader = shader.vertexShader.replace(
    "uniform float size;",
    "attribute float size; attribute float alpha; varying float vAlpha;"
  )),
    (shader.vertexShader = shader.vertexShader.replace(
      "#include <project_vertex>",
      "#include <project_vertex>\n  vAlpha = alpha;"
    )),
    (shader.fragmentShader = shader.fragmentShader.replace(
      "void main() {",
      "varying float vAlpha;\nvoid main(){"
    )),
    (shader.fragmentShader = shader.fragmentShader.replace(
      "gl_FragColor = vec4( outgoingLight, diffuseColor.a );",
      "gl_FragColor = vec4( outgoingLight, diffuseColor.a * vAlpha );"
    ));
};
const ledStrings = new THREE.Points(ledGeo, ledMat);
(ledStrings.renderOrder = -9),
  scene.add(ledStrings),
  (ledStrings.visible = !0),
  fadeObjects.push(ledStrings),
  (ledStrings.userData.fadeStage = STAGE.STREAM);
const PNG_BG_IMAGES = [
  "/templates/snowheart/mmmm.png",
  "/templates/snowheart/95704.png",
  "/templates/snowheart/9570dfb4.png",
  "/templates/snowheart/95fae704.png",
];
const PNG_BG_COUNT = 80;
const pngBgTextures = {};
const pngBgMats = {};
const pngBgAspectRatios = {};
PNG_BG_IMAGES.forEach((imgPath) => {
  const loader = new THREE.TextureLoader();
  const tex = loader.load(
    imgPath,
    (texture) => {
      // Lưu aspect ratio để giữ nguyên tỉ lệ
      pngBgAspectRatios[imgPath] = texture.image.width / texture.image.height;
    },
    undefined,
    (err) => {
      console.log("Failed to load texture:", imgPath, err);
      pngBgAspectRatios[imgPath] = 1; // Default aspect ratio
    }
  );
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  pngBgTextures[imgPath] = tex;
  pngBgMats[imgPath] = makeMat({
    map: tex,
    blending: THREE.AdditiveBlending,
    depthWrite: !1,
    alphaSupport: !0,
    opacity: 1.2,
    sizeAttenuation: !1,
    transparent: !0,
  });
  pngBgMats[imgPath].onBeforeCompile = function (shader) {
    (shader.vertexShader = shader.vertexShader.replace(
      "uniform float size;",
      "attribute float size; attribute float alpha; varying float vAlpha;"
    )),
      (shader.vertexShader = shader.vertexShader.replace(
        "#include <project_vertex>",
        "#include <project_vertex>\n  vAlpha = alpha;"
      )),
      (shader.fragmentShader = shader.fragmentShader.replace(
        "void main() {",
        "varying float vAlpha;\nvoid main(){"
      )),
      (shader.fragmentShader = shader.fragmentShader.replace(
        "gl_FragColor = vec4( outgoingLight, diffuseColor.a );",
        "gl_FragColor = vec4( outgoingLight, diffuseColor.a * vAlpha );"
      ));
  };
});
const pngBgPositions = new Float32Array(3 * PNG_BG_COUNT);
const pngBgSizes = new Float32Array(PNG_BG_COUNT);
const pngBgAlpha = new Float32Array(PNG_BG_COUNT);
const pngBgVelocities = new Float32Array(PNG_BG_COUNT);
const pngBgTypes = new Uint8Array(PNG_BG_COUNT);
const PNG_BG_SIZE_MIN = 50;
const PNG_BG_SIZE_MAX = 100;
const PNG_BG_FALL_SPEED_MIN = 5;
const PNG_BG_FALL_SPEED_MAX = 15;
const PNG_BG_RESET_Y = 200;
const PNG_BG_BOTTOM_Y = -200;
for (let i = 0; i < PNG_BG_COUNT; i++) {
  const x = (Math.random() - 0.5) * 400,
    y = Math.random() * 400 + 100,
    z = (Math.random() - 0.5) * 400;
  const idx3 = 3 * i;
  (pngBgPositions[idx3] = x),
    (pngBgPositions[idx3 + 1] = y),
    (pngBgPositions[idx3 + 2] = z);
  pngBgVelocities[i] =
    PNG_BG_FALL_SPEED_MIN +
    Math.random() * (PNG_BG_FALL_SPEED_MAX - PNG_BG_FALL_SPEED_MIN);
  pngBgSizes[i] =
    PNG_BG_SIZE_MIN + Math.random() * (PNG_BG_SIZE_MAX - PNG_BG_SIZE_MIN);
  pngBgAlpha[i] = 1;
  pngBgTypes[i] = Math.floor(Math.random() * PNG_BG_IMAGES.length);
}
const pngBgFields = [];
for (let i = 0; i < PNG_BG_IMAGES.length; i++) {
  const imgPath = PNG_BG_IMAGES[i];
  const pngIndices = [];
  for (let j = 0; j < PNG_BG_COUNT; j++) {
    if (pngBgTypes[j] === i) {
      pngIndices.push(j);
    }
  }
  if (pngIndices.length > 0) {
    const pngPositions = new Float32Array(3 * pngIndices.length);
    const pngSizes = new Float32Array(pngIndices.length);
    const pngAlphas = new Float32Array(pngIndices.length);
    const pngColors = new Float32Array(3 * pngIndices.length);
    for (let k = 0; k < pngIndices.length; k++) {
      const srcIdx = pngIndices[k];
      const srcIdx3 = 3 * srcIdx;
      const dstIdx3 = 3 * k;
      pngPositions[dstIdx3] = pngBgPositions[srcIdx3];
      pngPositions[dstIdx3 + 1] = pngBgPositions[srcIdx3 + 1];
      pngPositions[dstIdx3 + 2] = pngBgPositions[srcIdx3 + 2];
      pngSizes[k] = pngBgSizes[srcIdx];
      pngAlphas[k] = pngBgAlpha[srcIdx];
      pngColors[dstIdx3] = 1;
      pngColors[dstIdx3 + 1] = 1;
      pngColors[dstIdx3 + 2] = 1;
    }
    const pngGeo = new THREE.BufferGeometry();
    pngGeo.setAttribute(
      "position",
      new THREE.BufferAttribute(pngPositions, 3).setUsage(
        THREE.DynamicDrawUsage
      )
    );
    pngGeo.setAttribute("color", new THREE.BufferAttribute(pngColors, 3));
    pngGeo.setAttribute("size", new THREE.BufferAttribute(pngSizes, 1));
    pngGeo.setAttribute(
      "alpha",
      new THREE.BufferAttribute(pngAlphas, 1).setUsage(THREE.DynamicDrawUsage)
    );
    const pngField = new THREE.Points(pngGeo, pngBgMats[imgPath]);
    (pngField.renderOrder = -10),
      (pngField.userData.pngIndices = pngIndices),
      (pngField.userData.pngGeo = pngGeo),
      scene.add(pngField),
      (pngField.visible = !0),
      fadeObjects.push(pngField),
      (pngField.userData.fadeStage = STAGE.STREAM);
    pngBgFields.push(pngField);
  }
}
function activateEffects(e) {
  if (
    (console.log("activateEffects", e && e.type, heartbeatEnabled),
    !heartbeatEnabled)
  ) {
    if ((heartbeatEnabled = true)) {
      // Phát âm thanh giống y hệt galaxy template
      playEchoheartAudio();
    }
    null === ribbonRevealStart &&
      ((ribbonRevealStart = clock.getElapsedTime()),
      ribbon && (ribbon.visible = !0));
    fadeObjects.forEach((obj) => {
      obj &&
        ((obj.visible = !0),
        obj.traverse?.((child) => {
          const mat = child.material;
          mat &&
            (child.material &&
              void 0 === child.userData.baseOpacity &&
              (child.userData.baseOpacity = child.material.opacity ?? 1),
            (mat.opacity = 0));
        }));
    }),
      (revealStart = clock.getElapsedTime()),
      (cameraAnimationStart = clock.getElapsedTime()),
      userHasMovedCamera &&
        (CAMERA_START_POSITION = {
          x: camera.position.x,
          y: camera.position.y,
          z: camera.position.z,
        });
  }
}
fadeObjects.push(streamHeart),
  [streamHeart].forEach((obj) => {
    obj &&
      ((obj.visible = !1),
      obj.traverse?.((child) => {
        child.material &&
          void 0 === child.userData.baseOpacity &&
          (child.userData.baseOpacity = child.material.opacity ?? 1);
      }));
  }),
  renderer.domElement.addEventListener("click", activateEffects, {
    capture: !0,
  }),
  renderer.domElement.addEventListener("touchstart", activateEffects, {
    passive: !0,
    capture: !0,
  });
window.__INXK_SNOWHEART_READY__ = true;
window.dispatchEvent(new Event("inxk:snowheart-ready"));
let lastTouchEnd = 0;
document.addEventListener(
  "touchend",
  function (event) {
    const now = new Date().getTime();
    now - lastTouchEnd <= 300 && event.preventDefault(), (lastTouchEnd = now);
  },
  !1
),
  document.addEventListener(
    "gesturestart",
    function (e) {
      e.preventDefault();
    },
    { passive: !1 }
  ),
  document.addEventListener(
    "gesturechange",
    function (e) {
      e.preventDefault();
    },
    { passive: !1 }
  ),
  document.addEventListener(
    "gestureend",
    function (e) {
      e.preventDefault();
    },
    { passive: !1 }
  ),
  animate(),
  scene.add(staticBottomHeart),
  [staticTopHeart].forEach((obj) => {
    obj &&
      ((obj.visible = !1),
      (obj.userData.fadeStage = STAGE.HEART),
      fadeObjects.push(obj));
  }),
  controls.addEventListener("change", () => {
    userHasMovedCamera ||
      ((CAMERA_START_POSITION = {
        x: camera.position.x,
        y: camera.position.y,
        z: camera.position.z,
      }),
      (userHasMovedCamera = !0));
  });
// Logic audioHandler cũ đã được loại bỏ - chỉ dùng logic đơn giản như galaxy
