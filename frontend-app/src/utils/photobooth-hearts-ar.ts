/**
 * Port of photobooth-io.cc/hearts-layout.js (Face Mesh crown + drawHearts).
 * Asset: /photobooth/heart-emoji-v2.2.png (their assets/heart-emoji-v2.2.png).
 */

type Landmark = { x: number; y: number };
type FaceResults = { multiFaceLandmarks?: Landmark[][] };

type FaceMeshInstance = {
  setOptions: (opts: Record<string, unknown>) => void;
  onResults: (cb: (results: FaceResults) => void) => void;
  send: (input: { image: HTMLVideoElement }) => Promise<void>;
  initialize: () => Promise<void>;
  close?: () => void;
};

declare global {
  interface Window {
    FaceMesh?: new (opts: { locateFile: (file: string) => string }) => FaceMeshInstance;
  }
}

const FACE_MESH_SRC = 'https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/face_mesh.js';
const FACE_MESH_FILE = 'https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh';
const HEART_SRC = '/photobooth/heart-emoji-v2.2.png';

let scriptPromise: Promise<void> | null = null;
let meshReady: Promise<FaceMeshInstance> | null = null;
const heartImg = new Image();
heartImg.crossOrigin = 'anonymous';
heartImg.src = HEART_SRC;

function loadFaceMeshScript(): Promise<void> {
  if (window.FaceMesh) return Promise.resolve();
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise((resolve, reject) => {
    const done = () => {
      if (window.FaceMesh) resolve();
      else reject(new Error('Face Mesh không khả dụng'));
    };
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${FACE_MESH_SRC}"]`);
    if (existing) {
      if (window.FaceMesh) done();
      else {
        existing.addEventListener('load', done, { once: true });
        existing.addEventListener('error', () => reject(new Error('Không tải được Face Mesh')), { once: true });
      }
      return;
    }
    const script = document.createElement('script');
    script.src = FACE_MESH_SRC;
    script.async = true;
    script.onload = done;
    script.onerror = () => {
      scriptPromise = null;
      reject(new Error('Không tải được Face Mesh'));
    };
    document.head.appendChild(script);
  });
  return scriptPromise;
}

async function getFaceMesh(): Promise<FaceMeshInstance> {
  await loadFaceMeshScript();
  if (!window.FaceMesh) throw new Error('Face Mesh không khả dụng');
  if (!meshReady) {
    meshReady = (async () => {
      const faceMesh = new window.FaceMesh!({
        locateFile: file => `${FACE_MESH_FILE}/${file}`,
      });
      faceMesh.setOptions({
        maxNumFaces: 1,
        refineLandmarks: false,
        minDetectionConfidence: 0.6,
        minTrackingConfidence: 0.6,
      });
      await faceMesh.initialize();
      return faceMesh;
    })().catch(err => {
      meshReady = null;
      throw err;
    });
  }
  return meshReady;
}

function drawHearts(
  arCtx: CanvasRenderingContext2D,
  arCanvas: HTMLCanvasElement,
  faceResults: FaceResults | null,
  invertBtnState: boolean,
  time: number,
) {
  arCtx.clearRect(0, 0, arCanvas.width, arCanvas.height);

  if (!faceResults?.multiFaceLandmarks?.length) return;

  const landmarks = faceResults.multiFaceLandmarks[0];
  const head = landmarks[10];

  const leftCheek = landmarks[234];
  const rightCheek = landmarks[454];
  const faceWidth = Math.abs(rightCheek.x - leftCheek.x) * arCanvas.width;
  const scale = faceWidth / 200;

  const leftEye = landmarks[33];
  const rightEye = landmarks[263];
  const eyeDx = (rightEye.x - leftEye.x) * arCanvas.width;
  const eyeDy = (rightEye.y - leftEye.y) * arCanvas.height;
  let rollAngle = Math.atan2(eyeDy, eyeDx);
  if (invertBtnState) rollAngle = -rollAngle;

  let centerX = head.x * arCanvas.width;
  const centerY = head.y * arCanvas.height;
  if (invertBtnState) centerX = arCanvas.width - centerX;

  const HEART_COUNT = 12;
  const ARC_START = Math.PI * 1.05;
  const ARC_END = Math.PI * 1.95;
  const RADIUS_X = 75 * scale;
  const RADIUS_Y = 45 * scale;
  const Y_OFFSET = -40 * scale;
  const BOB_AMOUNT = 12 * scale;
  const HEART_SIZE = 32 * scale;
  const FADE_SPEED = 2;
  const BOB_SPEED = 0.003;

  arCtx.save();
  arCtx.translate(centerX, centerY);
  arCtx.rotate(rollAngle);
  arCtx.translate(-centerX, -centerY);

  if (heartImg.complete && heartImg.naturalWidth > 0) {
    const heartAspect = heartImg.naturalWidth / heartImg.naturalHeight;
    for (let i = 0; i < HEART_COUNT; i++) {
      const t = i / (HEART_COUNT - 1);
      const angle = ARC_START + t * (ARC_END - ARC_START);
      const baseX = centerX + RADIUS_X * Math.cos(angle);
      const baseY = centerY + Y_OFFSET + RADIUS_Y * Math.sin(angle);
      const alpha = 0.7 + 0.3 * Math.sin((time / 1000) * FADE_SPEED + i);
      const bob = Math.sin(time * BOB_SPEED + i * 1.5) * BOB_AMOUNT;
      const size = HEART_SIZE + (i % 3) * 2 * scale;
      const heartW = size;
      const heartH = heartW / heartAspect;
      arCtx.globalAlpha = alpha;
      arCtx.drawImage(heartImg, baseX - heartW / 2, baseY + bob - heartH / 2, heartW, heartH);
    }
  }

  arCtx.restore();
  arCtx.globalAlpha = 1;
}

export function preloadHeartsAr() {
  void loadFaceMeshScript();
  if (!heartImg.src) heartImg.src = HEART_SRC;
}

export async function startHeartsAr(opts: {
  video: HTMLVideoElement;
  canvas: HTMLCanvasElement;
  getMirror: () => boolean;
  onStatus?: (text: string) => void;
}): Promise<() => void> {
  const { video, canvas, getMirror, onStatus } = opts;
  const arCtx = canvas.getContext('2d');
  if (!arCtx) throw new Error('Canvas không khả dụng');

  onStatus?.('Đang tải AR…');
  const faceMesh = await getFaceMesh();

  const syncSize = () => {
    const w = video.videoWidth;
    const h = video.videoHeight;
    if (w && h && (canvas.width !== w || canvas.height !== h)) {
      canvas.width = w;
      canvas.height = h;
    }
  };
  syncSize();

  let faceResults: FaceResults | null = null;
  faceMesh.onResults(results => {
    faceResults = results;
  });

  let running = true;
  let lastInferenceTime = 0;
  const INFERENCE_THROTTLE = 33;

  const trackFace = async (timestamp: number) => {
    if (!running) return;
    if (video.readyState >= 2 && timestamp - lastInferenceTime >= INFERENCE_THROTTLE) {
      syncSize();
      lastInferenceTime = timestamp;
      try {
        await faceMesh.send({ image: video });
      } catch {
        /* stream ended */
      }
    }
    if (running) requestAnimationFrame(trackFace);
  };

  const renderAR = (time: number) => {
    if (!running) return;
    syncSize();
    drawHearts(arCtx, canvas, faceResults, getMirror(), time);
    requestAnimationFrame(renderAR);
  };

  onStatus?.('AR sẵn sàng');
  requestAnimationFrame(trackFace);
  requestAnimationFrame(renderAR);

  return () => {
    running = false;
    arCtx.clearRect(0, 0, canvas.width, canvas.height);
  };
}
