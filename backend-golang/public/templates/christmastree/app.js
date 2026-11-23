
"use strict";
console.clear();
import * as THREE from "three";

import { OrbitControls as e } from "three/addons/controls/OrbitControls.js";

import * as BufferGeometryUtils from "three/addons/utils/BufferGeometryUtils.js";

import { MeshSurfaceSampler as t } from "three/addons/math/MeshSurfaceSampler.js";

import { EffectComposer as o } from "three/addons/postprocessing/EffectComposer.js";

import { RenderPass as n } from "three/addons/postprocessing/RenderPass.js";

import { ShaderPass as r } from "three/addons/postprocessing/ShaderPass.js";

import { UnrealBloomPass as a } from "three/addons/postprocessing/UnrealBloomPass.js";

import { SVGLoader as s } from "three/addons/loaders/SVGLoader.js";

import { Flow as i } from "three/addons/modifiers/CurveModifier.js";

!(function () {
  function l(e, t, o) {
    x = t.length;
    let n,
      r = new THREE.InstancedMesh(b.geometry, b.material, x);
    K.set(0, 0, 0, 0), ee.set(1, 1, 1);
    for (let a = 0; a < x; a++) {
      if (
        (Q.set(t[a][0], t[a][1], t[a][2]),
        (J = Q),
        ("ribbon" != o && "twist" != o) ||
          (V.lookAt(Q.x, 0, Q.z), (K = V.quaternion)),
        1 != e && ee.set(e, e, e),
        _.compose(J, K, ee),
        "ribbon" == o)
      )
        n = new THREE.Color("red");
      else if ("light" == o || "light2" == o) n = new THREE.Color("burlywood");
      else if ("sphere" == o) {
        let e = ["white", "red"];
        n = new THREE.Color(e[Math.floor(Math.random() * e.length)]);
      }
      r.setMatrixAt(a, _), r.setColorAt(a, n);
    }
    return r;
  }
  function d(e) {
    let t = this.attributes.position;
    if (null != this.index) return;
    let o = t.count / 3,
      n = [],
      r = new THREE.Triangle(),
      a = te.clone(),
      s = te.clone(),
      i = te.clone();
    for (let l = 0; l < o; l++) {
      a.fromBufferAttribute(t, 3 * l + 0),
        s.fromBufferAttribute(t, 3 * l + 1),
        i.fromBufferAttribute(t, 3 * l + 2),
        r.set(a, s, i);
      let o = te.clone();
      r.getMidpoint(o);
      let d = a.distanceTo(s),
        h = (Math.sqrt(3) / 2) * d * e,
        c = o.clone().normalize().setLength(h);
      o.add(c),
        n.push(
          o.clone(),
          a.clone(),
          s.clone(),
          o.clone(),
          s.clone(),
          i.clone(),
          o.clone(),
          i.clone(),
          a.clone()
        );
    }
    let l = new THREE.BufferGeometry().setFromPoints(n);
    return l.computeVertexNormals(), l;
  }
  function h() {
    const e = window.innerWidth,
      t = window.innerHeight;
    (E.aspect = e / t),
      E.updateProjectionMatrix(),
      f.setSize(e, t),
      k.setSize(e, t),
      Z.setSize(e, t),
      p();
  }
  function c(e) {
    (e.isMesh || e.isInstancedMesh) &&
      !1 === q.test(e.layers) &&
      ((W[e.uuid] = e.material), (e.material = N));
  }
  function u(e) {
    W[e.uuid] && ((e.material = W[e.uuid]), delete W[e.uuid]);
  }
  function m() {
    requestAnimationFrame(m), w.update(), O && O.moveAlongCurve(7e-4), p();
  }
  function p() {
    const now = performance.now() * 0.001;

   
    if (
      starEffectEnabled &&
      topStar &&
      topStar.material &&
      topStar.material.color
    ) {
      const time = now;
      const bpm = 17;
      const speed = (bpm / 60) * Math.PI * 2;
      const phase = Math.sin(time * speed) * 0.5 + 0.5;
      const shaped = Math.pow(phase, 3);
      const intensity =
        STAR_MIN_INTENSITY + (STAR_MAX_INTENSITY - STAR_MIN_INTENSITY) * shaped;

      // Giữ màu vàng, chỉ đổi độ “sáng” bằng cách scale RGB
      const baseColor = new THREE.Color("yellow");
      baseColor.multiplyScalar(intensity);
      topStar.material.color.copy(baseColor);
    }

    // Trong giai đoạn intro: luôn chỉ hiện ngôi sao + viền highlight, ẩn các object khác
    if (introMode && M && topStar) {
      M.children.forEach((obj) => {
        if (obj !== topStar && obj !== topStarOutline && !obj.isCamera) {
          obj.visible = false;
        }
      });
      if (topStarOutline) {
        topStarOutline.visible = true;
      }
    }

    // Anim camera từ trạng thái zoom vào sao -> trạng thái bình thường
    if (
      cameraAnimStartTime !== null &&
      cameraNormalPos &&
      cameraIntroPos &&
      E
    ) {
      // Easing để chuyển động mượt hơn (ease-in-out)
      const rawT = (now - cameraAnimStartTime) / cameraAnimDuration;
      const t = Math.min(Math.max(rawT, 0), 1);
      const easedT = t * t * (3 - 2 * t); // smoothstep

      E.position.lerpVectors(cameraIntroPos, cameraNormalPos, easedT);

      if (cameraIntroTarget && cameraNormalTarget && w) {
        const tmpTarget = new THREE.Vector3().lerpVectors(
          cameraIntroTarget,
          cameraNormalTarget,
          easedT
        );
        w.target.copy(tmpTarget);
      }

      E.lookAt(w ? w.target : new THREE.Vector3(0, 0, 0));

      if (t >= 1 && w) {
        cameraAnimStartTime = null;
        introMode = false;
        w.autoRotate = !0; // sau intro mới cho quay tự động

        // Hiển thị hint "Bấm vào thư hoặc hộp quà" sau khi zoom out xong
        if (!postcardHintEl) {
          // Tạo hint nếu chưa có
          if (!document.getElementById("postcardHint")) {
            // CSS cho hint nếu chưa có
            if (!document.getElementById("postcardHintStyles")) {
              const style = document.createElement("style");
              style.id = "postcardHintStyles";
              style.textContent = `
                @keyframes hintPulse {
                  0%   { transform: translate(-50%, 0);   opacity: 0.4; }
                  50%  { transform: translate(-50%, -4px); opacity: 1; }
                  100% { transform: translate(-50%, 0);   opacity: 0.4; }
                }
                #postcardHint {
                  position: fixed;
                  left: 50%;
                  bottom: 4%;
                  transform: translateX(-50%);
                  padding: 4px 8px;
                  color: #fff9d9;
                  font-family: "XmasFont", system-ui, sans-serif;
                  font-size: clamp(14px, 2vw, 18px);
                  letter-spacing: 0.12em;
                  text-shadow: 0 0 8px rgba(0, 0, 0, 0.8);
                  white-space: nowrap;
                  pointer-events: none;
                  z-index: 999;
                  animation: hintPulse 1.6s ease-in-out infinite;
                }
              `;
              document.head.appendChild(style);
            }

            const el = document.createElement("div");
            el.id = "postcardHint";
            el.textContent = "Bấm vào thư hoặc hộp quà";
            document.body.appendChild(el);
            postcardHintEl = el;
          } else {
            postcardHintEl = document.getElementById("postcardHint");
          }
        }
        if (postcardHintEl) {
          postcardHintEl.style.display = "block";
        }
      }
    }

    // Fade-in mềm cho các vật trên cây / quà / postcard sau khi thoát intro
    if (objectsFadeIn && objectsFadeStartTime !== null && M) {
      const rawFadeT = (now - objectsFadeStartTime) / objectsFadeDuration;
      const ft = Math.min(Math.max(rawFadeT, 0), 1);
      const easedFt = ft * ft * (3 - 2 * ft); // smoothstep

      M.traverse((child) => {
        if (
          child === topStar ||
          !child.isMesh ||
          !child.material ||
          child.material.opacity === undefined
        ) {
          return;
        }

        const mat = child.material;
        const targetOpacity =
          (mat.userData && mat.userData.__targetOpacity) || 1;

        mat.transparent = true;
        mat.opacity = THREE.MathUtils.lerp(0, targetOpacity, easedFt);

        if (ft >= 1 && mat.userData && mat.userData.__targetOpacity) {
          delete mat.userData.__targetOpacity;
        }
      });

      if (ft >= 1) {
        objectsFadeIn = false;
        objectsFadeStartTime = null;
      }
    }

    // Nhịp toggle layer chỉ cho dây đèn (giữ sao fade mượt, không chớp cứng)
    Y.getElapsedTime() > X / 1e3 &&
      (P.layers.toggle(L), v.layers.toggle(L), Y.stop(), Y.start()),
      I &&
        (function (e) {
          for (let t = 0; t < e.count; t++)
            e.getMatrixAt(t, _),
              _.decompose(V.position, V.quaternion, V.scale),
              (V.position.y -= A),
              V.position.y < -U
                ? ((V.position.y = U),
                  (V.position.x = THREE.MathUtils.randFloat(-U, U)),
                  (V.position.z = THREE.MathUtils.randFloat(-U, U)))
                : t % 4 == 1
                ? ((V.position.x += F), (V.position.z += j))
                : t % 4 == 2
                ? ((V.position.x += F), (V.position.z -= j))
                : t % 4 == 3
                ? ((V.position.x -= F), (V.position.z += j))
                : ((V.position.x -= F), (V.position.z -= j)),
              (V.rotation.x += THREE.MathUtils.randFloat(0, z)),
              (V.rotation.z += THREE.MathUtils.randFloat(0, C)),
              V.updateMatrix(),
              e.setMatrixAt(t, V.matrix);
          e.instanceMatrix.needsUpdate = !0;
        })(I),
      // Cập nhật lớp bụi tuyết mềm: rơi chậm + lắc nhẹ, chạm đáy thì hồi sinh
      snowDust &&
        (function (p) {
          const now = performance.now() / 1000,
            arr = p.geometry.attributes.position.array;
          for (let e = 0; e < snowDustSpeed.length; e++)
            (arr[e * 3 + 1] -= snowDustSpeed[e]),
              (arr[e * 3] += Math.sin(now * 0.6 + e * 1.7) * 0.003),
              arr[e * 3 + 1] < -U &&
                ((arr[e * 3 + 1] = U),
                (arr[e * 3] = THREE.MathUtils.randFloat(-U, U)),
                (arr[e * 3 + 2] = THREE.MathUtils.randFloat(-U, U)));
          p.geometry.attributes.position.needsUpdate = !0;
        })(snowDust),
      // Cập nhật hướng postcards về camera
      postcardGroups.forEach((group) => {
        group.children.forEach((postcard) => {
          postcard.lookAt(E.position);
        });
      }),
      // Lời chúc 3D trên đỉnh cây luôn hướng về camera
      treeTitleMesh && treeTitleMesh.lookAt(E.position),
      M.traverse(c),
      k.render(),
      M.traverse(u),
      Z.render();
  }
  let E,
    M,
    f,
    w,
    T,
    R,
    H,
    g,
    y,
    b,
    x,
    P,
    v,
    I,
    S,
    B = 1,
    G = [],
    U = 12,
    topStar = null,
    topStarOutline = null;
  // Trạng thái intro và hiệu ứng ngôi sao
  let introMode = true; // true: mới vào chỉ hiển thị ngôi sao
  let starEffectEnabled = false; // chỉ bật nhấp nháy khi đã click vào sao
  let cameraNormalPos = null;
  let cameraIntroPos = null;
  let cameraIntroTarget = null;
  let cameraNormalTarget = null;
  let cameraAnimStartTime = null;
  const cameraAnimDuration = 3; // giây
  const STAR_MIN_INTENSITY = 0.1; // phải trùng với min của logic nhấp nháy
  const STAR_MAX_INTENSITY = 2.0;
  // Trạng thái fade-in cho các vật trang trí/cây/quà... sau khi click sao
  let objectsFadeIn = false;
  let objectsFadeStartTime = null;
  const objectsFadeDuration = 1.5; // giây
  // DOM hint "bấm vào ngôi sao"
  let introHintEl = null;
  // Mesh lời chúc 3D phía trên ngôi sao (hiện sau khi bấm ngôi sao)
  let treeTitleMesh = null;
  // DOM hint "bấm vào thư hoặc hộp quà" (sau khi zoom out)
  let postcardHintEl = null;
  // Lớp bụi tuyết mềm (THREE.Points) và tốc độ rơi từng chấm
  let snowDust = null;
  let snowDustSpeed = null;
  const z = Math.PI / 30,
    C = Math.PI / 50,
    A = 0.03,
    F = 0.005,
    j = 0.005,
    V = new THREE.Object3D();
  let k, Z;
  const L = 1,
    q = new THREE.Layers();
  q.set(L);
  const D = {
      exposure: 0,
      bloomStrength: 1,
      bloomThreshold: 0,
      bloomRadius: 0.1,
    },
    N = new THREE.MeshBasicMaterial({
      color: "black",
    }),
    W = {},
    X = 1e3,
    Y = new THREE.Clock();
  let O;
  let postcardGroups = [];
  let postcardMeshes = [];
  let giftMeshes = [];
  let textLabelMeshes = [];
  let treePostcardPositions = [];
  let raycaster = new THREE.Raycaster();
  let mouse = new THREE.Vector2();
  let modal = null;
  const _ = new THREE.Matrix4();
  // Nhạc nền và lời nhắn giọng nói do voice-player.js phát (một bản nhạc + một ghi âm).
  // Template không tự tạo Audio nữa — bản thứ hai chồng lên và làm trang giật.
  function initBackgroundMusic() {}

  function playBackgroundMusic() {
    if (typeof window.__inxkPlayBackgroundMusic === "function") {
      window.__inxkPlayBackgroundMusic();
    }
  }

  // Hàm tạo modal
  function createModal() {
    // Tạo overlay
    const overlay = document.createElement("div");
    overlay.id = "postcardModal";
    overlay.style.cssText = `
      display: none;
      position: fixed;
      z-index: 1000;
      left: 0;
      top: 0;
      width: 100%;
      height: 100%;
      justify-content: center;
      align-items: center;
      perspective: 1000px;
    `;

    // Tạo wrapper với viền sọc chéo màu Giáng Sinh cố định
    const borderWrapper = document.createElement("div");

    // Tạo flip card container - kích thước sẽ được set sau khi load postcard
    const flipContainer = document.createElement("div");
    flipContainer.id = "flipContainer";
    flipContainer.style.cssText = `
      position: relative;
      transform-style: preserve-3d;
      transition: transform 0.8s cubic-bezier(0.4, 0.0, 0.2, 1);
    `;

    // Tạo mặt trước (postcard.svg)
    const cardFront = document.createElement("div");
    cardFront.id = "cardFront";
    cardFront.style.cssText = `
      position: absolute;
      width: 100%;
      height: 100%;
      backface-visibility: hidden;
      border-radius: 8px;
      overflow: hidden;
      display: flex;
      align-items: center;
      justify-content: center;
      background-color: #fff;
      box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5);
      transform: rotateY(0deg);
    `;
    const frontImg = document.createElement("img");
    frontImg.src = "/templates/christmastree/postcard.svg";
    frontImg.id = "postcardFrontImg";
    frontImg.style.cssText = `
      width: 100%;
      height: 100%;
      object-fit: contain;
      display: block;
    `;
    cardFront.appendChild(frontImg);

    // Tạo mặt sau (nội dung modal)
    const cardBack = document.createElement("div");
    cardBack.id = "cardBack";
    cardBack.style.cssText = `
      position: absolute;
      width: 100%;
      height: 100%;
      backface-visibility: hidden;
      transform: rotateY(180deg);
      border-radius: 8px;
      padding: 4px;
      background: repeating-linear-gradient(
        45deg,
        #dc143c 0px,
        #dc143c 8px,
        #228b22 8px,
        #228b22 16px,
        #ffffff 16px,
        #ffffff 24px,
        #dc143c 24px,
        #dc143c 32px
      );
      box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5);
      box-sizing: border-box;
    `;

    // Tạo wrapper bên trong cho nội dung
    const cardBackContent = document.createElement("div");
    cardBackContent.id = "cardBackContent";
    cardBackContent.style.cssText = `
      width: 100%;
      height: 100%;
      background-color: #eee2c9;
      border-radius: 4px;
      display: flex;
      flex-direction: column;
      box-sizing: border-box;
    `;

    // Tạo close button
    const closeBtn = document.createElement("span");
    closeBtn.innerHTML = "&times;";
    closeBtn.style.cssText = `
      color: #aaa;
      float: right;
      font-size: 28px;
      font-weight: bold;
      position: absolute;
      right: 15px;
      top: 10px;
      cursor: pointer;
      line-height: 1;
      z-index: 10;
    `;
    closeBtn.onmouseover = () => (closeBtn.style.color = "#000");
    closeBtn.onmouseout = () => (closeBtn.style.color = "#aaa");
    closeBtn.onclick = () => hideModal();

    // Tạo modal body với scroll
    const modalBody = document.createElement("div");
    modalBody.id = "modalBody";
    modalBody.style.cssText = `
      margin-top: 20px;
      overflow-y: auto;
      flex: 1;
      padding: 15px 20px 15px 20px;
    `;

    // Thêm CSS animation
    if (!document.getElementById("modalStyles")) {
      const style = document.createElement("style");
      style.id = "modalStyles";
      style.textContent = `
        #flipContainer {
          transform-origin: center center;
        }
        #flipContainer.flipped {
          transform: rotateY(180deg);
        }
        #cardFront, #cardBack {
          transform-origin: center center;
        }
        #postcardFrontImg {
          width: 100%;
          height: 100%;
          object-fit: contain;
          display: block;
        }
        #modalBody img {
          display: block;
        }
        #modalBody .modal-image {
          width: auto;
          height: auto;
          max-width: 100%;
          max-height: 100%;
          object-fit: contain;
          border-radius: 5px;
          image-rendering: -webkit-optimize-contrast;
          image-rendering: crisp-edges;
        }
        #modalBody .message-wrapper {
          height: 100%;
          max-height: 100%;
          overflow-y: auto;
          padding-right: 6px;
          display: flex;
          flex-direction: column;
          justify-content: flex-start;
        }
        #modalBody .message-wrapper p {
          margin-top: 0;
          margin-bottom: 0;
          white-space: pre-wrap;
          font-size: clamp(14px, 2.2vw, 16px);
          line-height: 1.7;
          font-family: "Playpen Sans", system-ui, sans-serif;
          color: #876e45;
        }
        @media (max-width: 600px) {
          #flipContainer {
            max-width: 100vw;
            max-height: 100vh;
          }
          #cardBackContent {
            padding: 0;
          }
          #modalBody {
            margin: 0;
            padding: 0 !important;
          }
          #modalBody .modal-image {
            max-width: 100%;
            max-height: 100%;
          }
          #modalBody .message-wrapper p {
            font-size: 14.5px;
          }
        }
        
        /* Custom scrollbar */
        #modalBody::-webkit-scrollbar {
          width: 8px;
        }
        
        #modalBody::-webkit-scrollbar-track {
          background: #eee2c9;
          border-radius: 4px;
        }
        
        #modalBody::-webkit-scrollbar-thumb {
          background: rgba(135, 110, 69, 0.4);
          border-radius: 4px;
        }
        
        #modalBody::-webkit-scrollbar-thumb:hover {
          background: rgba(135, 110, 69, 0.6);
        }
        
        /* Firefox scrollbar */
        #modalBody {
          scrollbar-width: thin;
          scrollbar-color: rgba(135, 110, 69, 0.4) #eee2c9;
        }
        #modalBody p {
          font-size: 16px;
          line-height: 1.6;
          color: #876e45;
          margin-bottom: 10px;
          font-family: "Playpen Sans", system-ui, sans-serif;
        }
      `;
      document.head.appendChild(style);
    }

    cardBackContent.appendChild(closeBtn);
    cardBackContent.appendChild(modalBody);
    cardBack.appendChild(cardBackContent);
    flipContainer.appendChild(cardFront);
    flipContainer.appendChild(cardBack);
    overlay.appendChild(flipContainer);
    document.body.appendChild(overlay);

    return overlay;
  }

  // Kích thước postcard.svg đã biết (từ code hiện tại)
  const POSTCARD_SVG_WIDTH = 5108.4399;
  const POSTCARD_SVG_HEIGHT = 3174.5732;
  const POSTCARD_ASPECT_RATIO = POSTCARD_SVG_WIDTH / POSTCARD_SVG_HEIGHT; // ≈ 1.609

  // Hàm lấy kích thước SVG
  function getSVGSize(img) {
    // Thử lấy từ naturalWidth/naturalHeight trước
    if (img.naturalWidth > 0 && img.naturalHeight > 0) {
      return { width: img.naturalWidth, height: img.naturalHeight };
    }

    // Thử lấy từ width/height attributes
    if (img.width > 0 && img.height > 0) {
      return { width: img.width, height: img.height };
    }

    // Fallback: sử dụng kích thước đã biết
    return { width: POSTCARD_SVG_WIDTH, height: POSTCARD_SVG_HEIGHT };
  }

  // Hàm tính toán kích thước modal dựa trên postcard
  function calculateModalSize(postcardWidth, postcardHeight) {
    const maxWidth = Math.min(720, window.innerWidth * 0.9);
    const maxHeight = Math.min(720, window.innerHeight * 0.85);
    const aspectRatio = postcardWidth / postcardHeight;

    let modalWidth, modalHeight;

    // Tính toán kích thước dựa trên tỉ lệ khung hình của postcard
    if (aspectRatio > 1) {
      // Postcard ngang
      modalWidth = Math.min(maxWidth, postcardWidth);
      modalHeight = modalWidth / aspectRatio;
      if (modalHeight > maxHeight) {
        modalHeight = maxHeight;
        modalWidth = modalHeight * aspectRatio;
      }
    } else {
      // Postcard dọc
      modalHeight = Math.min(maxHeight, postcardHeight);
      modalWidth = modalHeight * aspectRatio;
      if (modalWidth > maxWidth) {
        modalWidth = maxWidth;
        modalHeight = modalWidth / aspectRatio;
      }
    }

    return { width: modalWidth, height: modalHeight };
  }

  // Mảng lời chúc và ảnh cho modal
  const postcardMessages = [
    ...((window.dataFromSubdomain && window.dataFromSubdomain.data &&
      (window.dataFromSubdomain.data.defaultPostcardMessages ||
        window.dataFromSubdomain.data.postcards ||
        window.dataFromSubdomain.data.christmastreePostcards)) || ["testt"]),
  ];

  const postcardImageUrls = [
    ...((window.dataFromSubdomain && window.dataFromSubdomain.data &&
      (window.dataFromSubdomain.data.giftImageVariants ||
        window.dataFromSubdomain.data.imageUrls ||
        window.dataFromSubdomain.data.images)) || []),
  ];

  // Lời chúc hiển thị phía trên cây thông (mặc định "Merry Christmas")
  const treeTitleText = (() => {
    const d = (window.dataFromSubdomain && window.dataFromSubdomain.data) || {};
    const t = typeof d.title === "string" ? d.title.trim() : "";
    return t || "Merry Christmas";
  })();

  // Counter riêng cho postcard (messages) và gift (images)
  let postcardCounter = 0; // Counter cho danh sách messages
  let giftCounter = 0; // Counter cho danh sách images

  // Không tải trước toàn bộ ảnh. Mỗi file có thể vài MB; tải và decode hết
  // lúc mở trang làm điện thoại đứng hình và modal phải chờ decode xong mới hiện.

  function buildModalPayload(kind, index) {
    if (kind === "postcard") {
      // Postcard sử dụng danh sách messages
      if (postcardMessages.length > 0) {
        const msg = postcardMessages[postcardCounter % postcardMessages.length];
        postcardCounter++; // Tăng counter cho lần click tiếp theo
        return { type: "text", content: msg };
      }
      // Nếu không có messages, fallback sang images
      if (postcardImageUrls.length > 0) {
        const src = postcardImageUrls[giftCounter % postcardImageUrls.length];
        giftCounter++;
        return { type: "image", src };
      }
    } else if (kind === "gift") {
      // Gift sử dụng danh sách images
      if (postcardImageUrls.length > 0) {
        const src = postcardImageUrls[giftCounter % postcardImageUrls.length];
        giftCounter++; // Tăng counter cho lần click tiếp theo
        return { type: "image", src };
      }
      // Nếu không có images, fallback sang messages
      if (postcardMessages.length > 0) {
        const msg = postcardMessages[postcardCounter % postcardMessages.length];
        postcardCounter++;
        return { type: "text", content: msg };
      }
    }

    // Fallback nếu không có nội dung nào
    return {
      type: "text",
      content: "Chúc bạn một mùa Giáng Sinh an lành và ấm áp! 🎄",
    };
  }

  // Hàm hiển thị modal
  function showModal(data, options = {}) {
    const mode = options.mode || "postcard"; // 'postcard' | 'gift'
    if (!modal) {
      modal = createModal();
    }

    const flipContainer = document.getElementById("flipContainer");
    const modalBody = document.getElementById("modalBody");
    const cardFront = document.getElementById("cardFront");
    const cardBack = document.getElementById("cardBack");
    const frontImg = document.getElementById("postcardFrontImg");

    // Thiết lập chế độ hiển thị:
    // - postcard: có mặt trước + animation lật
    // - gift: chỉ hiện nội dung mặt sau, không lật
    flipContainer.classList.remove("flipped");
    if (mode === "gift") {
      // Ẩn mặt trước, hiển thị mặt sau như một mặt phẳng
      cardFront.style.display = "none";
      cardBack.style.transform = "rotateY(0deg)";
    } else {
      cardFront.style.display = "flex";
      cardBack.style.transform = "rotateY(180deg)";
    }

    // Xóa nội dung cũ
    modalBody.innerHTML = "";

    // Hàm để set kích thước và hiển thị modal
    const setupModalSize = () => {
      // Lấy kích thước thực tế của postcard
      const { width: postcardWidth, height: postcardHeight } =
        getSVGSize(frontImg);

      // Tính toán kích thước modal dựa trên postcard
      const { width: modalWidth, height: modalHeight } = calculateModalSize(
        postcardWidth,
        postcardHeight
      );

      // Cập nhật kích thước container
      flipContainer.style.width = `${modalWidth}px`;
      flipContainer.style.height = `${modalHeight}px`;

      // Đảm bảo cả hai mặt có cùng kích thước
      cardFront.style.width = `${modalWidth}px`;
      cardFront.style.height = `${modalHeight}px`;
      cardBack.style.width = `${modalWidth}px`;
      cardBack.style.height = `${modalHeight}px`;

      // Hiển thị modal
      modal.style.display = "flex";

      // Ẩn hint khi modal hiển thị
      const hintEl = document.getElementById("postcardHint");
      if (hintEl) {
        hintEl.style.display = "none";
      }
      if (postcardHintEl) {
        postcardHintEl.style.display = "none";
      }

      // Chỉ bật animation lật cho postcard
      if (mode === "postcard") {
        setTimeout(() => {
          flipContainer.classList.add("flipped");
        }, 500);
      }
    };

    // Thêm nội dung vào modal body
    if (data.type === "image") {
      const imgWrapper = document.createElement("div");
      imgWrapper.style.cssText = `
        width: 100%;
        height: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
      `;

      const img = document.createElement("img");
      img.className = "modal-image";
      img.alt = "Ảnh trong hộp quà";
      img.decoding = "async";
      img.src = data.src;
      imgWrapper.appendChild(img);
      modalBody.appendChild(imgWrapper);
    } else if (data.type === "text") {
      const messageWrapper = document.createElement("div");
      messageWrapper.className = "message-wrapper";
      const p = document.createElement("p");
      p.textContent = data.content;
      messageWrapper.appendChild(p);
      modalBody.appendChild(messageWrapper);
    }

    // Đảm bảo postcard.svg đã load xong trước khi set kích thước
    if (frontImg.complete) {
      // Ảnh đã load, set kích thước ngay
      setupModalSize();
    } else {
      // Đợi ảnh load xong
      frontImg.onload = () => {
        setupModalSize();
      };
      // Nếu ảnh load quá lâu, sử dụng fallback
      setTimeout(() => {
        if (!frontImg.complete) {
          setupModalSize(); // Sử dụng kích thước đã biết
        }
      }, 500);
    }
  }

  // Hàm ẩn modal
  function hideModal() {
    if (modal) {
      const flipContainer = document.getElementById("flipContainer");
      if (flipContainer) {
        // Reset về mặt trước ngay lập tức (không cần animation khi đóng)
        flipContainer.classList.remove("flipped");
      }
      modal.style.display = "none";

      // Hiển thị lại hint khi modal ẩn
      const hintEl = document.getElementById("postcardHint");
      if (hintEl) {
        hintEl.style.display = "block";
      }
      if (postcardHintEl) {
        postcardHintEl.style.display = "block";
      }
    }
  }

  // Hàm setup click handler
  function setupPostcardClickHandler() {
    if (!f || !f.domElement) return;

    f.domElement.addEventListener("click", (event) => {
      // Tính toán vị trí chuột trong không gian normalized (-1 đến +1)
      mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
      mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

      // Cập nhật raycaster với camera và vị trí chuột
      raycaster.setFromCamera(mouse, E);

      // Kiểm tra giao điểm với cả postcard, hộp quà và ngôi sao
      const clickTargets = [
        ...postcardMeshes,
        ...giftMeshes,
        ...(topStar ? [topStar] : []),
      ];
      if (!clickTargets.length) return;

      const intersects = raycaster.intersectObjects(clickTargets, true);
      if (intersects.length === 0) return;

      let clicked = intersects[0].object;

      // Nếu click vào ngôi sao intro
      if (
        topStar &&
        (clicked === topStar ||
          clicked.parent === topStar ||
          clicked.parent?.parent === topStar)
      ) {
        // Chỉ xử lý 1 lần
        if (!starEffectEnabled) {
          starEffectEnabled = true;

          // Phát nhạc nền khi click vào ngôi sao
          playBackgroundMusic();

          // Sau khi click mới cho ngôi sao tham gia layer bloom
          if (topStar) {
            topStar.layers.enable(L);
          }

          // Ẩn viền highlight sau khi đã click
          if (topStarOutline) {
            topStarOutline.visible = false;
          }

          // Ẩn hint text sau khi đã click
          if (introHintEl) {
            introHintEl.style.display = "none";
          }

          // Hiện lại các object khác để bắt đầu zoom out + fade-in
          if (M) {
            M.children.forEach((obj) => {
              if (obj !== topStar && !obj.isCamera) {
                obj.visible = true;

                // Chuẩn bị fade-in opacity cho mọi mesh (trừ ngôi sao)
                if (
                  obj.isMesh &&
                  obj.material &&
                  obj.material.opacity !== undefined
                ) {
                  const mat = obj.material;
                  mat.userData = mat.userData || {};
                  // Lưu lại opacity gốc (mặc định 1)
                  mat.userData.__targetOpacity =
                    mat.userData.__targetOpacity ?? mat.opacity ?? 1;
                  mat.transparent = true;
                  mat.opacity = 0;
                }
              }
            });
          }

          introMode = false;
          objectsFadeIn = true;
          objectsFadeStartTime = performance.now() * 0.001;
          cameraAnimStartTime = performance.now() * 0.001;

          // Trong lúc đang nội suy camera thì vẫn tắt autoRotate,
          // sẽ bật lại ở trong hàm p() khi nội suy xong
          if (w) {
            w.autoRotate = !1;
          }
        }
        return;
      }

      // Leo lên parent để tìm userData.kind
      while (clicked && !clicked.userData?.kind && clicked.parent) {
        clicked = clicked.parent;
      }
      if (!clicked || !clicked.userData) return;

      // Hint "Bấm vào thư hoặc hộp quà" sẽ luôn hiển thị, không ẩn khi click

      const { kind = "postcard", index = 0 } = clicked.userData;
      const payload = buildModalPayload(kind, index);
      const mode = kind === "gift" ? "gift" : "postcard";
      showModal(payload, { mode });
    });

    // Đóng modal khi click ra ngoài
    if (modal) {
      modal.addEventListener("click", (e) => {
        if (e.target === modal) {
          hideModal();
        }
      });
    }
  }

  // Hàm tạo texture chữ 3D giả lập bằng Canvas, dùng font XmasFont
  function createTextLabelTexture(text, options = {}) {
    const {
      width = 960,
      height = 256,
      fontSize = 160,
      fontFamily = "XmasFont",
      bgColor = "rgba(0,0,0,0)",
      // Màu chữ chính: vàng trắng rất nhẹ
      mainColor = "#fff9d9",
      // Bóng đổ vàng nhạt để glow dịu hơn
      shadowColor = "rgba(255, 245, 200, 0.8)",
      // Viền vàng nhạt để không quá gắt
      strokeColor = "#ffe9a3",
    } = options;

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");

    ctx.clearRect(0, 0, width, height);

    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `bold ${fontSize}px "${fontFamily}"`;

    // Tự co nhỏ font nếu chữ (kể cả khoảng cách giữa các ký tự) quá dài
    const charsForMeasure = Array.from(text);
    let tmpLetterSpacing = 12;
    const measureTotalWidth = () => {
      const widths = charsForMeasure.map((ch) => ctx.measureText(ch).width);
      const raw = widths.reduce((sum, w) => sum + w, 0);
      return raw + tmpLetterSpacing * Math.max(0, charsForMeasure.length - 1);
    };

    const maxTextWidth = width * 0.9;
    let totalWidth = measureTotalWidth();
    if (totalWidth > maxTextWidth) {
      const scale = maxTextWidth / totalWidth;
      const adjustedFontSize = Math.max(36, fontSize * scale);
      ctx.font = `bold ${adjustedFontSize}px "${fontFamily}"`;
      totalWidth = measureTotalWidth();
    }

    // Đổ bóng tạo cảm giác nổi
    ctx.shadowColor = shadowColor;
    // Tăng blur để nhìn giống glow neon hơn
    ctx.shadowBlur = 40;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;

    // Vẽ chữ chính với tracking (khoảng cách chữ cái) thưa hơn
    const centerX = width / 2;
    const centerY = height / 2;
    ctx.fillStyle = mainColor;

    const chars = Array.from(text);
    const letterSpacing = 12; // px giữa các ký tự
    const charWidths = chars.map((ch) => ctx.measureText(ch).width);
    const rawWidth = charWidths.reduce((sum, w) => sum + w, 0);
    const totalWidthWithSpacing =
      rawWidth + letterSpacing * Math.max(0, chars.length - 1);

    let cursorX = centerX - totalWidthWithSpacing / 2;

    // Fill từng ký tự
    chars.forEach((ch, idx) => {
      const w = charWidths[idx];
      const charCenterX = cursorX + w / 2;
      ctx.fillText(ch, charCenterX, centerY);
      cursorX += w + letterSpacing;
    });

    // Vẽ viền
    // Viền ngoài nhẹ để chữ rõ nét hơn trên nền glow
    ctx.shadowColor = "transparent";
    ctx.lineWidth = 4;
    ctx.strokeStyle = strokeColor;

    cursorX = centerX - totalWidthWithSpacing / 2;
    chars.forEach((ch, idx) => {
      const w = charWidths[idx];
      const charCenterX = cursorX + w / 2;
      ctx.strokeText(ch, charCenterX, centerY);
      cursorX += w + letterSpacing;
    });

    const texture = new THREE.CanvasTexture(canvas);
    texture.encoding = THREE.sRGBEncoding;
    texture.anisotropy = 4;
    texture.needsUpdate = true;
    return texture;
  }

  async function ensureXmasFontLoaded() {
    if (!document.fonts || !document.fonts.load) return;
    try {
      await document.fonts.load('64px "XmasFont"');
    } catch (e) {
      // Bỏ qua nếu trình duyệt không hỗ trợ
      console.warn("Không thể chắc chắn đã load font XmasFont:", e);
    }
  }

  // Tạo các chữ 3D (dạng plane có texture chữ) gắn lên thân cây
  async function addTreeTextLabels(existingDecorPositions = []) {
    const treeTexts = [
      "Merry Christmas",
      "Sweet Holiday",
      "Warm Wishes",
      "Peace & Love",
      "Happy Time",
      "Noel",
      "Happiness",
      "Joy",
    ];

    await ensureXmasFontLoaded();

    // Geometry thân cây tương tự chỗ lấy mẫu đồ trang trí
    const trunkGeometry = new THREE.CylinderGeometry(0.1, 4.5, 10, 16, 4, true);
    const trunkMesh = new THREE.Mesh(
      trunkGeometry,
      new THREE.MeshBasicMaterial()
    );
    const sampler = new t(trunkMesh).build();

    const candidatePositions = [];
    for (let i = 0; i < 400; i++) {
      sampler.sample(Q);
      candidatePositions.push([Q.x, Q.y, Q.z]);
    }

    // Ưu tiên các vị trí cao trên thân cây (khoảng 70% từ đỉnh xuống)
    let positionsForText = candidatePositions;
    if (candidatePositions.length) {
      const ys = candidatePositions.map((p) => p[1]);
      const minY = Math.min(...ys);
      const maxY = Math.max(...ys);
      const heightRange = maxY - minY || 1;
      // Lấy vùng gần đỉnh: top ~30% chiều cao
      const minAllowedY = maxY - heightRange * 0.9;
      const highBand = candidatePositions.filter((p) => p[1] >= minAllowedY);
      // Nếu đủ điểm trong vùng cao thì dùng vùng đó, ngược lại dùng toàn bộ
      if (highBand.length >= treeTexts.length) {
        positionsForText = highBand;
      }
    }

    // Helper
    function shuffleArray(array) {
      for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
      }
    }

    function angularDistance(a, b) {
      const diff = Math.abs(a - b);
      return Math.min(diff, Math.PI * 2 - diff);
    }

    const isFarEnough = (candidate, other, limitSq) => {
      if (!other) return true;
      const dx = candidate[0] - other[0];
      const dy = candidate[1] - other[1];
      const dz = candidate[2] - other[2];
      return dx * dx + dy * dy + dz * dz >= limitSq;
    };

    function selectPositionsForText({
      positions,
      count,
      minDistance = 0.7,
      decorPositions = [],
      minDecorDistance = 0.55,
      layerCount = 6,
      minAngleDiff = Math.PI / 6,
    }) {
      if (!positions.length) return [];

      const ys = positions.map((p) => p[1]);
      const minY = Math.min(...ys);
      const maxY = Math.max(...ys);
      const heightRange = maxY - minY || 1;

      const minDistanceSq = minDistance * minDistance;
      const minDecorDistanceSq = minDecorDistance * minDecorDistance;

      const layerHeight = heightRange / layerCount || 1;
      const layers = Array.from({ length: layerCount }, () => []);

      positions.forEach((pos) => {
        const idx = Math.max(
          0,
          Math.min(layerCount - 1, Math.floor((pos[1] - minY) / layerHeight))
        );
        layers[idx].push(pos);
      });

      layers.forEach((layer) => shuffleArray(layer));

      const selected = [];
      const usedAngles = [];
      const layerQuota = Math.max(1, Math.ceil(count / layerCount));

      const canUseCandidate = (candidate) => {
        const angle = Math.atan2(candidate[2], candidate[0]);
        const farFromText = selected.every((existing) =>
          isFarEnough(candidate, existing, minDistanceSq)
        );
        const farFromDecor = decorPositions.every((existing) =>
          isFarEnough(candidate, existing, minDecorDistanceSq)
        );
        const angleClear = usedAngles.every(
          (a) => angularDistance(a, angle) >= minAngleDiff
        );
        return farFromText && farFromDecor && angleClear;
      };

      for (let i = 0; i < layerCount && selected.length < count; i++) {
        const layer = layers[i];
        let usedInLayer = 0;
        for (const candidate of layer) {
          if (canUseCandidate(candidate)) {
            selected.push(candidate);
            usedAngles.push(Math.atan2(candidate[2], candidate[0]));
            usedInLayer++;
          }
          if (usedInLayer >= layerQuota || selected.length >= count) break;
        }
      }

      // Fallback nếu chưa đủ số lượng
      if (selected.length < count) {
        const remaining = positions.filter((p) => !selected.includes(p));
        shuffleArray(remaining);
        for (const candidate of remaining) {
          if (canUseCandidate(candidate)) {
            selected.push(candidate);
            usedAngles.push(Math.atan2(candidate[2], candidate[0]));
          }
          if (selected.length >= count) break;
        }
      }

      return selected.slice(0, count);
    }

    const decorPositions = existingDecorPositions || [];
    const textPositions = selectPositionsForText({
      positions: positionsForText,
      count: treeTexts.length,
      // Tăng khoảng cách tối thiểu giữa các cụm chữ với nhau
      minDistance: 1.0,
      // Và với đồ trang trí (quả châu, đèn, postcard, quà...)
      decorPositions,
      minDecorDistance: 0.8,
      layerCount: 6,
      minAngleDiff: Math.PI / 4,
    });

    const textGroup = new THREE.Group();
    textGroup.name = "tree-text-labels";
    textLabelMeshes = [];

    const labelHeightWorld = 0.85;
    const labelWidthWorld = labelHeightWorld * 2.8;
    // Plane phẳng, không còn bẻ cong theo thân cây
    const labelGeometry = new THREE.PlaneGeometry(
      labelWidthWorld,
      labelHeightWorld
    );

    for (let i = 0; i < textPositions.length; i++) {
      const text = treeTexts[i % treeTexts.length];
      const texture = createTextLabelTexture(text, {
        fontSize: 130,
        fontFamily: "XmasFont",
      });
      const material = new THREE.MeshBasicMaterial({
        map: texture,
        transparent: true,
        side: THREE.DoubleSide,
        alphaTest: 0.1,
        // Cho phép bị che bởi thân và lá (theo depth), nhưng vẫn ưu tiên né đồ trang trí bằng khoảng cách
        depthTest: true,
        depthWrite: false,
      });
      const mesh = new THREE.Mesh(labelGeometry, material);

      const [px, py, pz] = textPositions[i];
      const normal = new THREE.Vector3(px, 0, pz).normalize();
      const offset = normal.clone().multiplyScalar(0.5);

      mesh.position.set(px + offset.x, py + 0.05, pz + offset.z);

      // Hướng chữ ra ngoài thân cây
      const lookTarget = new THREE.Vector3(
        mesh.position.x + normal.x,
        mesh.position.y,
        mesh.position.z + normal.z
      );
      mesh.lookAt(lookTarget);

      // Đặt renderOrder cao để chắc chắn render sau các đồ trang trí khác
      mesh.renderOrder = 10;

      textGroup.add(mesh);
      textLabelMeshes.push(mesh);
    }

    M.add(textGroup);

    // Lời chúc lớn nằm trong không gian 3D phía trên ngôi sao,
    // luôn hướng về camera nhưng đứng yên cùng cảnh khi xoay quanh cây
    const titleTexture = createTextLabelTexture(treeTitleText, {
      width: 1400,
      height: 320,
      fontSize: 220,
      fontFamily: "XmasFont",
    });
    const titleAspect =
      titleTexture.image.width / titleTexture.image.height || 4;
    const titleWidth = 8.5;
    const titleGeometry = new THREE.PlaneGeometry(
      titleWidth,
      titleWidth / titleAspect
    );
    const titleMaterial = new THREE.MeshBasicMaterial({
      map: titleTexture,
      transparent: true,
      side: THREE.DoubleSide,
      alphaTest: 0.1,
      depthTest: true,
      depthWrite: false,
    });
    treeTitleMesh = new THREE.Mesh(titleGeometry, titleMaterial);
    treeTitleMesh.position.set(0, 7.6, 0);
    treeTitleMesh.renderOrder = 11;
    M.add(treeTitleMesh);
  }

  const giftPatternDrawers = {
    stripes(ctx, size, palette) {
      ctx.fillStyle = palette.base;
      ctx.fillRect(0, 0, size, size);
      ctx.save();
      ctx.translate(size / 2, size / 2);
      ctx.rotate((-35 * Math.PI) / 180);
      ctx.translate(-size, -size / 2);
      ctx.fillStyle = palette.accent;
      const stripeWidth = size / 6;
      for (let i = -size; i < size * 2; i += stripeWidth * 1.6) {
        ctx.fillRect(i, 0, stripeWidth, size * 2);
      }
      ctx.restore();
    },
    polka(ctx, size, palette) {
      ctx.fillStyle = palette.base;
      ctx.fillRect(0, 0, size, size);
      ctx.fillStyle = palette.accent;
      const radius = size / 12;
      for (let y = radius; y < size; y += radius * 3) {
        for (let x = radius; x < size; x += radius * 3) {
          ctx.beginPath();
          ctx.arc(
            x + ((y / (radius * 3)) % 2 === 0 ? 0 : radius * 1.5),
            y,
            radius,
            0,
            Math.PI * 2
          );
          ctx.fill();
        }
      }
    },
    solid(ctx, size, palette) {
      const gradient = ctx.createLinearGradient(0, 0, size, size);
      gradient.addColorStop(0, palette.base);
      gradient.addColorStop(1, palette.highlight);
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, size, size);
    },
    chevron(ctx, size, palette) {
      ctx.fillStyle = palette.base;
      ctx.fillRect(0, 0, size, size);
      ctx.strokeStyle = palette.accent;
      ctx.lineWidth = size / 18;
      const step = size / 6;
      for (let y = -step; y <= size + step; y += step) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(size / 2, y + step);
        ctx.lineTo(size, y);
        ctx.stroke();
      }
    },
    diagonal(ctx, size, palette) {
      ctx.fillStyle = palette.base;
      ctx.fillRect(0, 0, size, size);
      ctx.save();
      ctx.translate(size / 2, size / 2);
      ctx.rotate((45 * Math.PI) / 180);
      ctx.translate(-size, -size / 2);
      ctx.fillStyle = palette.highlight;
      const stripeWidth = size / 8;
      for (let i = -size; i < size * 2; i += stripeWidth * 2.4) {
        ctx.fillRect(i, 0, stripeWidth, size * 2.2);
      }
      ctx.restore();
    },
    confetti(ctx, size, palette) {
      ctx.fillStyle = palette.base;
      ctx.fillRect(0, 0, size, size);
      const colors = [palette.accent, palette.highlight, palette.sparkle];
      for (let i = 0; i < 60; i++) {
        ctx.fillStyle = colors[i % colors.length];
        const radius = THREE.MathUtils.randFloat(size / 40, size / 18);
        ctx.beginPath();
        ctx.arc(
          Math.random() * size,
          Math.random() * size,
          radius,
          0,
          Math.PI * 2
        );
        ctx.fill();
      }
    },
    plaid(ctx, size, palette) {
      ctx.fillStyle = palette.base;
      ctx.fillRect(0, 0, size, size);
      ctx.strokeStyle = palette.accent;
      ctx.lineWidth = size / 20;
      const step = size / 5;
      for (let i = 0; i <= size; i += step) {
        ctx.beginPath();
        ctx.moveTo(i, 0);
        ctx.lineTo(i, size);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(0, i);
        ctx.lineTo(size, i);
        ctx.stroke();
      }
      ctx.strokeStyle = palette.highlight;
      ctx.lineWidth = size / 28;
      for (let i = step / 2; i <= size; i += step) {
        ctx.beginPath();
        ctx.moveTo(i, 0);
        ctx.lineTo(i, size);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(0, i);
        ctx.lineTo(size, i);
        ctx.stroke();
      }
    },
  };

  function createPatternTexture(drawer, palette) {
    const size = 256;
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext("2d");
    drawer(ctx, size, palette);
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.anisotropy = 4;
    texture.needsUpdate = true;
    return texture;
  }

  const giftPalettes = [
    {
      name: "candy-cane",
      base: ["#ff4d6d", "#ff5c8d", "#ff8fab"],
      accent: ["#ffffff", "#ffe5ec"],
      highlight: ["#fff0f3", "#ffe0f7"],
      sparkle: ["#ffd6e6", "#fff7f9"],
      ribbon: ["#ffd166", "#f72585", "#ffafcc"],
      patterns: ["stripes", "diagonal", "plaid"],
    },
    {
      name: "gingerbread",
      base: ["#ff9f1c", "#ffbf69", "#ff7b00"],
      accent: ["#fff3b0", "#ffe066", "#ffd100"],
      highlight: ["#fff4d6", "#ffd6a5"],
      sparkle: ["#fff9db", "#faf0ca"],
      ribbon: ["#ff006e", "#8338ec"],
      patterns: ["polka", "chevron", "confetti"],
    },
    {
      name: "holly-jolly",
      base: ["#2ec4b6", "#00b4d8", "#48cae4"],
      accent: ["#f9c80e", "#ffe66d"],
      highlight: ["#cbf3f0", "#e0fbfc"],
      sparkle: ["#fff3b0", "#fdfcdc"],
      ribbon: ["#ff477e", "#ff006e", "#ffd166"],
      patterns: ["polka", "confetti", "stripes"],
    },
    {
      name: "aurora",
      base: ["#7209b7", "#560bad", "#3a0ca3"],
      accent: ["#f15bb5", "#fee440"],
      highlight: ["#faa307", "#ffbe0b"],
      sparkle: ["#fff4e6", "#fef3c7"],
      ribbon: ["#ffd500", "#fb5607", "#ff8500"],
      patterns: ["chevron", "plaid", "diagonal"],
    },
    {
      name: "noel",
      base: ["#008000", "#228b22", "#2b9348"],
      accent: ["#d00000", "#ff0a54", "#c9184a"],
      highlight: ["#fef9ef", "#fff3b0"],
      sparkle: ["#ffe5ec", "#f8f9fa"],
      ribbon: ["#ffe066", "#ffd6ff", "#f72585"],
      patterns: ["plaid", "stripes", "chevron"],
    },
  ];

  const patternTextureCache = new Map();

  function pickRandom(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  function createPaletteVariant() {
    const theme = pickRandom(giftPalettes);
    return {
      name: theme.name,
      base: pickRandom(theme.base),
      accent: pickRandom(theme.accent),
      highlight: pickRandom(theme.highlight),
      sparkle: pickRandom(theme.sparkle),
      ribbon: pickRandom(theme.ribbon),
      pattern: pickRandom(theme.patterns),
    };
  }

  function getPatternTextureForVariant(variant) {
    const key = `${variant.pattern}|${variant.base}|${variant.accent}|${variant.highlight}|${variant.sparkle}`;
    if (!patternTextureCache.has(key)) {
      const drawer =
        giftPatternDrawers[variant.pattern] || giftPatternDrawers.solid;
      patternTextureCache.set(key, createPatternTexture(drawer, variant));
    }
    return patternTextureCache.get(key);
  }

  function createGiftBow(color, size) {
    const bowGroup = new THREE.Group();
    const baseColor = new THREE.Color(color);
    // Tăng saturation + độ sáng để nơ nổi hơn so với thân hộp
    const brightColor = baseColor.clone().offsetHSL(0, 0.18, 0.22);
    const highlightColor = brightColor.clone().offsetHSL(0, 0.05, 0.12);

    const loopMaterial = new THREE.MeshStandardMaterial({
      color: brightColor,
      metalness: 0.72,
      roughness: 0.2,
      envMapIntensity: 2.1,
      emissive: brightColor.clone().multiplyScalar(0.45),
      emissiveIntensity: 1.1,
      side: THREE.DoubleSide,
    });

    const accentMaterial = new THREE.MeshStandardMaterial({
      color: highlightColor,
      metalness: 0.6,
      roughness: 0.26,
      envMapIntensity: 1.8,
      emissive: highlightColor.clone().multiplyScalar(0.35),
      emissiveIntensity: 0.9,
    });

    const createLoopGeometry = () => {
      const loopWidth = size * 0.55;
      const loopHeight = size * 0.32;
      const points = [
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(loopWidth * 0.15, loopHeight * 0.8, 0),
        new THREE.Vector3(loopWidth * 0.45, loopHeight * 0.65, 0),
        new THREE.Vector3(loopWidth * 0.55, 0, 0),
        new THREE.Vector3(loopWidth * 0.45, -loopHeight * 0.65, 0),
        new THREE.Vector3(loopWidth * 0.15, -loopHeight * 0.8, 0),
        new THREE.Vector3(0, 0, 0),
      ];
      const curve = new THREE.CatmullRomCurve3(points, true, "centripetal");
      return new THREE.TubeGeometry(curve, 80, size * 0.045, 24, true);
    };

    const leftLoop = new THREE.Mesh(createLoopGeometry(), loopMaterial);
    leftLoop.rotation.set(Math.PI / 2, 0.25, Math.PI / 8);
    leftLoop.position.set(-size * 0.23, size * 0.05, 0);
    const rightLoop = leftLoop.clone();
    rightLoop.scale.x *= -1;
    rightLoop.rotation.y *= -1;
    rightLoop.rotation.z *= -1;
    rightLoop.position.x *= -1;

    const knot = new THREE.Mesh(
      new THREE.SphereGeometry(size * 0.14, 24, 18),
      accentMaterial
    );
    knot.scale.set(1, 0.9, 1.2);

    const belt = new THREE.Mesh(
      new THREE.BoxGeometry(size * 0.9, size * 0.08, size * 0.09),
      accentMaterial
    );
    belt.position.y = -size * 0.02;

    const tailShape = new THREE.Shape();
    const tailHalf = size * 0.16;
    const tailLength = size * 0.55;
    tailShape.moveTo(-tailHalf, 0);
    tailShape.lineTo(tailHalf, 0);
    tailShape.lineTo(tailHalf, -tailLength * 0.75);
    tailShape.lineTo(0, -tailLength);
    tailShape.lineTo(-tailHalf, -tailLength * 0.75);
    tailShape.lineTo(-tailHalf, 0);
    const tailGeometry = new THREE.ExtrudeGeometry(tailShape, {
      depth: size * 0.04,
      bevelEnabled: false,
    });
    tailGeometry.center();
    const leftTail = new THREE.Mesh(tailGeometry, loopMaterial);
    leftTail.rotation.x = Math.PI / 2;
    leftTail.rotation.z = Math.PI / 12;
    leftTail.position.set(-size * 0.18, -size * 0.15, size * 0.08);
    const rightTail = leftTail.clone();
    rightTail.rotation.z *= -1;
    rightTail.position.x *= -1;

    bowGroup.add(leftLoop);
    bowGroup.add(rightLoop);
    bowGroup.add(knot);
    bowGroup.add(belt);
    bowGroup.add(leftTail);
    bowGroup.add(rightTail);

    bowGroup.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = child.receiveShadow = true;
      }
    });

    return bowGroup;
  }

  function createGiftBox({ size, height, material, ribbonColor }) {
    const giftGroup = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(size, height, size),
      material
    );
    giftGroup.add(body);

    const lidHeight = Math.max(0.1, height * 0.15);
    const lid = new THREE.Mesh(
      new THREE.BoxGeometry(size * 1.04, lidHeight, size * 1.04),
      new THREE.MeshStandardMaterial({
        color: new THREE.Color(ribbonColor).offsetHSL(0, 0.12, 0.18),
        metalness: 0.65,
        roughness: 0.28,
        envMapIntensity: 1.7,
        emissive: new THREE.Color(ribbonColor).multiplyScalar(0.45),
        emissiveIntensity: 1.1,
      })
    );
    lid.position.y = height / 2 - lidHeight / 2 + lidHeight * 0.3;
    giftGroup.add(lid);

    const ribbonCoreColor = new THREE.Color(ribbonColor);
    const ribbonDisplayColor = ribbonCoreColor.clone().offsetHSL(0, 0.22, 0.24);
    const ribbonMaterial = new THREE.MeshStandardMaterial({
      color: ribbonDisplayColor,
      metalness: 0.8,
      roughness: 0.22,
      envMapIntensity: 2.2,
      emissive: ribbonDisplayColor.clone().multiplyScalar(0.5),
      emissiveIntensity: 1.35,
    });
    const ribbonThickness = Math.min(size * 0.22, 0.4);
    const ribbonVertical = new THREE.Mesh(
      new THREE.BoxGeometry(
        ribbonThickness,
        height + lidHeight * 0.6,
        size * 1.06
      ),
      ribbonMaterial
    );
    const ribbonHorizontal = new THREE.Mesh(
      new THREE.BoxGeometry(
        size * 1.06,
        height + lidHeight * 0.6,
        ribbonThickness
      ),
      ribbonMaterial
    );
    giftGroup.add(ribbonVertical);
    giftGroup.add(ribbonHorizontal);

    const bow = createGiftBow(ribbonColor, size);
    bow.position.y = height / 2 + lidHeight * 0.35;
    giftGroup.add(bow);

    return giftGroup;
  }

  function populateGiftRing(scene) {
    if (!scene) return;
    const ringSettings = [
      {
        count: 16,
        radius: 4.9,
        sizeRange: [0.55, 1.05],
        heightRange: [0.85, 1.45],
      },
      {
        count: 14,
        radius: 3.9,
        sizeRange: [0.45, 0.95],
        heightRange: [0.75, 1.25],
      },
      {
        count: 12,
        radius: 3.0,
        sizeRange: [0.35, 0.8],
        heightRange: [0.65, 1.1],
      },
    ];
    const fillerSettings = {
      count: 22,
      radiusRange: [1.2, 4.4],
      sizeRange: [0.18, 0.38],
      heightRange: [0.35, 0.6],
    };

    const giftGroup = new THREE.Group();
    giftGroup.name = "gift-ring";
    const groundY = -5.75;

    const buildGift = (baseSize, height) => {
      const paletteVariant = createPaletteVariant();
      const texture = getPatternTextureForVariant(paletteVariant).clone();
      texture.center.set(0.5, 0.5);
      texture.rotation = Math.random() * Math.PI * 2;
      texture.needsUpdate = true;

      const material = new THREE.MeshStandardMaterial({
        map: texture,
        // Tăng độ phản chiếu và giảm nhám để hộp bắt sáng mạnh hơn
        metalness: 0.65,
        roughness: 0.22,
        // Đẩy sáng từ môi trường
        envMapIntensity: 2.0,
        // Đổi màu hộp theo hướng “overbright” một chút
        color: new THREE.Color(1.4, 1.4, 1.4),
        // Cho hộp tự phát sáng rõ hơn để không bị chìm dưới tán cây
        emissive: new THREE.Color(0.4, 0.4, 0.4),
        emissiveIntensity: 1.4,
      });

      const ribbonColor = paletteVariant.ribbon || paletteVariant.accent;

      const gift = createGiftBox({
        size: baseSize,
        height,
        material,
        ribbonColor,
      });

      gift.traverse((child) => {
        if (child.isMesh) {
          child.castShadow = child.receiveShadow = !0;
        }
      });

      return gift;
    };

    ringSettings.forEach((ring, ringIndex) => {
      let angleCursor = Math.random() * Math.PI * 2;
      const avgSpacing = (Math.PI * 2) / ring.count;
      for (let i = 0; i < ring.count; i++) {
        const baseSize = THREE.MathUtils.randFloat(
          ring.sizeRange[0],
          ring.sizeRange[1]
        );
        const height =
          baseSize *
          THREE.MathUtils.randFloat(ring.heightRange[0], ring.heightRange[1]);

        const gift = buildGift(baseSize, height);
        const sizeSpacing = (baseSize / ring.radius) * 1.1;
        const randomSpacing = THREE.MathUtils.randFloat(
          avgSpacing * 0.35,
          avgSpacing * 0.65
        );
        angleCursor += sizeSpacing + randomSpacing;
        const angle = angleCursor % (Math.PI * 2);
        const radius =
          ring.radius + THREE.MathUtils.randFloatSpread(ring.radius * 0.08);

        gift.position.set(
          Math.cos(angle) * radius,
          groundY + height / 2 + THREE.MathUtils.randFloat(-0.2, 0.08),
          Math.sin(angle) * radius
        );
        gift.rotation.y =
          angle + Math.PI / 2 + THREE.MathUtils.randFloatSpread(0.45);

        gift.userData = {
          kind: "gift",
          index: giftMeshes.length,
        };
        giftGroup.add(gift);
        giftMeshes.push(gift);
      }
    });

    for (let i = 0; i < fillerSettings.count; i++) {
      const baseSize = THREE.MathUtils.randFloat(
        fillerSettings.sizeRange[0],
        fillerSettings.sizeRange[1]
      );
      const height =
        baseSize *
        THREE.MathUtils.randFloat(
          fillerSettings.heightRange[0],
          fillerSettings.heightRange[1]
        );
      const gift = buildGift(baseSize, height);
      const angle = Math.random() * Math.PI * 2;
      const radius =
        THREE.MathUtils.randFloat(
          fillerSettings.radiusRange[0],
          fillerSettings.radiusRange[1]
        ) * THREE.MathUtils.randFloat(0.92, 1.08);
      gift.position.set(
        Math.cos(angle) * radius,
        groundY + height / 2 + THREE.MathUtils.randFloat(-0.16, 0.06),
        Math.sin(angle) * radius
      );
      gift.rotation.y =
        angle + Math.PI / 2 + THREE.MathUtils.randFloatSpread(0.35);
      gift.userData = {
        kind: "gift",
        index: giftMeshes.length,
      };
      giftGroup.add(gift);
      giftMeshes.push(gift);
    }

    scene.add(giftGroup);
  }
  let Q = new THREE.Vector3(),
    J = Q.clone(),
    K = new THREE.Quaternion();
  const $ = new THREE.Euler(),
    ee = Q.clone(),
    te = Q.clone();
  !(async function () {
    const c = new THREE.TextureLoader().loadAsync(data_env);
    ([y] = await Promise.all([c])),
      (y.mapping = THREE.EquirectangularReflectionMapping),
      y.dispose(),
      (data_env = null);
    const u = document.createElement("div");
    document.body.appendChild(u),
      ((M = new THREE.Scene()).background = "black"),
      (M.environment = y),
      (f = new THREE.WebGLRenderer({
        antialias: !1,
      })).setPixelRatio(Math.min(window.devicePixelRatio, 2)),
      f.setSize(window.innerWidth, window.innerHeight),
      (f.toneMapping = THREE.LinearToneMapping),
      u.appendChild(f.domElement),
      (E = new THREE.PerspectiveCamera(
        35,
        window.innerWidth / window.innerHeight,
        0.1,
        70
      )),
      // Lưu cấu hình camera bình thường (toàn cảnh)
      E.position.set(0, 0.8, 40),
      (cameraNormalPos = E.position.clone()),
      (cameraNormalTarget = new THREE.Vector3(0, 0, 0)),
      // Cấu hình camera intro: zoom gần vào đỉnh cây nơi có ngôi sao
      (cameraIntroPos = new THREE.Vector3(0, 5.7, 6)),
      (cameraIntroTarget = new THREE.Vector3(0, 5.7, 0)),
      E.position.copy(cameraIntroPos),
      E.lookAt(cameraIntroTarget);
    // Khởi tạo nhạc nền
    initBackgroundMusic();
    // Tạo hint DOM "Bấm vào ngôi sao" ở đáy màn hình
    (() => {
      if (document.getElementById("introHint")) {
        introHintEl = document.getElementById("introHint");
        return;
      }

      // CSS cho font & animation nếu chưa có
      if (!document.getElementById("introHintStyles")) {
        const style = document.createElement("style");
        style.id = "introHintStyles";
        style.textContent = `
          @keyframes hintPulse {
            0%   { transform: translate(-50%, 0);   opacity: 0.4; }
            50%  { transform: translate(-50%, -4px); opacity: 1; }
            100% { transform: translate(-50%, 0);   opacity: 0.4; }
          }
          #introHint {
            position: fixed;
            left: 50%;
            bottom: 4%;
            transform: translateX(-50%);
            padding: 4px 8px;
            color: #fff9d9;
            font-family: "XmasFont", system-ui, sans-serif;
            font-size: clamp(14px, 2vw, 18px);
            letter-spacing: 0.12em;
            text-shadow: 0 0 8px rgba(0, 0, 0, 0.8);
            white-space: nowrap;
            pointer-events: none;
            z-index: 999;
            animation: hintPulse 1.6s ease-in-out infinite;
          }
        `;
        document.head.appendChild(style);
      }

      const el = document.createElement("div");
      el.id = "introHint";
      el.textContent = "Bấm vào ngôi sao";
      document.body.appendChild(el);
      introHintEl = el;
    })();
    const p = new n(M, E),
      z = new a(
        new THREE.Vector2(window.innerWidth, window.innerHeight),
        D.bloomStrength,
        D.bloomRadius,
        D.bloomThreshold
      );
    ((k = new o(f)).renderToScreen = !1), k.addPass(p), k.addPass(z);
    const C = new r(
      new THREE.ShaderMaterial({
        uniforms: {
          baseTexture: {
            value: null,
          },
          bloomTexture: {
            value: k.renderTarget2.texture,
          },
        },
        vertexShader: document.getElementById("vertexshader").textContent,
        fragmentShader: document.getElementById("fragmentshader").textContent,
        defines: {},
      }),
      "baseTexture"
    );
    (C.needsSwap = !0),
      (Z = new o(f)).addPass(p),
      Z.addPass(C),
      (g = new THREE.MeshBasicMaterial({
        color: "white",
        reflectivity: 1,
        envMap: y,
      })),
      (H = (function () {
        let e;
        (S = 2),
          (x = 700),
          (B = 15),
          (G = []),
          (T = new THREE.PlaneGeometry(0.05, 0.05));
        for (let t = 0; t < x; t++) {
          const t = Math.acos(THREE.MathUtils.randFloatSpread(2)),
            o = THREE.MathUtils.randFloatSpread(360);
          (Q.x = S * Math.sin(t) * Math.cos(o)),
            (Q.y = Math.abs(S * Math.sin(t) * Math.sin(o)) * B - S * B),
            (Q.z = S * Math.cos(t)),
            (e = Math.random()),
            Q.copy(Q).multiplyScalar(e);
          let n = T.clone();
          n.rotateX(Math.random() * Math.PI),
            n.rotateY(Math.random() * Math.PI),
            n.rotateZ(Math.random() * Math.PI),
            n.translate(Q.x, Q.y, Q.z),
            G.push(n);
        }
        return (
          (T = BufferGeometryUtils.mergeGeometries(G)).rotateZ(-Math.PI / 2),
          (T.attributes.position.needsUpdate = !0),
          T.center(),
          T.computeBoundingBox(),
          T.computeVertexNormals(),
          (R = g.clone()).color.set("khaki"),
          (R.reflectivity = 1),
          (R.side = THREE.DoubleSide),
          (H = new THREE.Mesh(T, R))
        );
      })());
    let A = (function (e = 1, t = 1, o = 100, n) {
      const r = [];
      for (let a = 0; a <= o; a++)
        (S = e * a),
          ((Q = Q.clone()).x = S * Math.cos(a)),
          (Q.z = S * Math.sin(a)),
          (Q.y = t * -a + n),
          r.push(Q);
      for (let a = o; a >= 0; a--)
        (S = e * a),
          ((Q = Q.clone()).x = S * Math.cos(-a)),
          (Q.z = S * Math.sin(-a)),
          (Q.y = t * -a + n),
          r.push(Q);
      return new THREE.CatmullRomCurve3(r, !0, "centripetal", 0);
    })(0.24, 0.2 * 3, 25, 10);
    A.getPoints(25),
      (O = new i(H)).updateCurve(0, A),
      M.add(O.object3D),
      (function () {
        (x = 128), (B = 0.002);
        const e = document.querySelector("svg#snowflake").outerHTML,
          t = new s().parse(e).paths[0],
          o = s.createShapes(t)[0];
        let n = new THREE.ExtrudeGeometry(o, {
          steps: 1,
          // Dày hơn để thành tinh thể 3D chứ không phẳng như sticker
          depth: 20,
          bevelEnabled: !0,
          // Bo tròn cạnh để bông tuyết bắt sáng mềm, không còn dạng lăng trụ phẳng
          bevelThickness: 4,
          bevelSize: 3,
          bevelOffset: 0,
          bevelSegments: 2,
        });
        n.scale(B, B, B),
          (n = BufferGeometryUtils.mergeVertices(n, B / 20)).center(),
          (n.attributes.position.needsUpdate = !0),
          n.computeBoundingBox(),
          n.computeVertexNormals(),
          // Chất liệu băng: clearcoat + iridescence để bông tuyết lấp lánh
          // và hơi trong mờ như tinh thể thật thay vì khối nhựa trắng đục
          (R = new THREE.MeshPhysicalMaterial({
            color: "#ffffff",
            metalness: 0,
            roughness: 0.22,
            clearcoat: 1,
            clearcoatRoughness: 0.22,
            iridescence: 0.55,
            iridescenceIOR: 1.31,
            transparent: true,
            opacity: 0.95,
            envMapIntensity: 2.5,
            // Tự phát sáng dịu để tinh thể luôn sáng trên nền trời đen
            emissive: "#b8c4d8",
            emissiveIntensity: 0.5,
            side: THREE.DoubleSide,
          })),
          (I = new THREE.InstancedMesh(n, R, x)),
          K.set(0, 0, 0, 0),
          ee.set(1, 1, 1);
        for (let e = 0; e < x; e++)
          Q.set(
            THREE.MathUtils.randFloat(-U, U),
            THREE.MathUtils.randFloat(-U, U),
            THREE.MathUtils.randFloat(-U, U)
          ),
            (J = Q),
            $.set(
              Math.random() * Math.PI,
              Math.random() * Math.PI,
              Math.random() * Math.PI
            ),
            K.setFromEuler($),
            (ee.x = ee.y = ee.z = 0.3 + Math.random()),
            _.compose(J, K, ee),
            I.setMatrixAt(e, _);
        // Tông màu hơi khác nhau từng bông: trắng, xanh băng, vàng ấm
        const snowTint = new THREE.Color();
        for (let e = 0; e < x; e++) {
          const r = Math.random();
          snowTint.set(
            r < 0.6 ? "#ffffff" : r < 0.85 ? "#dcebff" : "#fff1d8"
          ),
            I.setColorAt(e, snowTint);
        }
        (I.instanceColor.needsUpdate = !0), M.add(I);
        // Lớp bụi tuyết mềm bay xa tạo chiều sâu (chấm sáng nhỏ, additive)
        const dustCount = 300,
          dustPositions = new Float32Array(dustCount * 3);
        snowDustSpeed = new Float32Array(dustCount);
        for (let e = 0; e < dustCount; e++)
          (dustPositions[e * 3] = THREE.MathUtils.randFloat(-U, U)),
            (dustPositions[e * 3 + 1] = THREE.MathUtils.randFloat(-U, U)),
            (dustPositions[e * 3 + 2] = THREE.MathUtils.randFloat(-U, U)),
            (snowDustSpeed[e] = 0.008 + Math.random() * 0.02);
        const dustGeometry = new THREE.BufferGeometry();
        dustGeometry.setAttribute(
          "position",
          new THREE.BufferAttribute(dustPositions, 3)
        );
        const dustCanvas = document.createElement("canvas");
        (dustCanvas.width = dustCanvas.height = 64),
          (() => {
            const dctx = dustCanvas.getContext("2d"),
              grad = dctx.createRadialGradient(32, 32, 0, 32, 32, 32);
            grad.addColorStop(0, "rgba(255,255,255,1)"),
              grad.addColorStop(0.4, "rgba(255,255,255,0.55)"),
              grad.addColorStop(1, "rgba(255,255,255,0)"),
              (dctx.fillStyle = grad),
              dctx.fillRect(0, 0, 64, 64);
          })();
        const dustMaterial = new THREE.PointsMaterial({
          map: new THREE.CanvasTexture(dustCanvas),
          color: "#e8f1ff",
          size: 0.32,
          transparent: !0,
          opacity: 0.65,
          depthWrite: !1,
          blending: THREE.AdditiveBlending,
          sizeAttenuation: !0,
        });
        (snowDust = new THREE.Points(dustGeometry, dustMaterial)),
          M.add(snowDust);
      })(),
      (T = (function (e, t, o) {
        let n = [];
        for (let r = 0; r < 2 * e; r++) {
          let a, s;
          n.push(0, 0, -o / 2),
            r % 2 == 0 ? ((a = t), (s = 1)) : ((a = 1), (s = t));
          let i = ((r + 1) / e) * Math.PI;
          n.push(Math.cos(i) * a, Math.sin(i) * a, 0),
            (i = (r / e) * Math.PI),
            n.push(Math.cos(i) * s, Math.sin(i) * s, 0),
            n.push(0, 0, o / 2),
            (i = (r / e) * Math.PI),
            n.push(Math.cos(i) * s, Math.sin(i) * s, 0),
            (i = ((r + 1) / e) * Math.PI),
            n.push(Math.cos(i) * a, Math.sin(i) * a, 0);
        }
        return (
          (n = new Float32Array(n)),
          (T = new THREE.BufferGeometry()).setAttribute(
            "position",
            new THREE.BufferAttribute(n, 3)
          ),
          T.rotateZ(-Math.PI / e / 2),
          (T.attributes.position.needsUpdate = !0),
          T.computeVertexNormals(),
          T.center(),
          T
        );
      })(5, 2, 1.78)),
      (R = g.clone()).color.set("yellow"),
      (R.reflectivity = 0.8);
    topStar = new THREE.Mesh(T, R);
    let j;
    (topStar.position.y = 5.7),
      (B = 0.35),
      topStar.scale.set(B, B, B),
      // Đặt màu sao về đúng mức "tối" theo logic nhấp nháy (min intensity)
      (() => {
        const baseColor = new THREE.Color("yellow");
        baseColor.multiplyScalar(STAR_MIN_INTENSITY);
        topStar.material.color.copy(baseColor);
      })(),
      // Tạo viền highlight chỉ các cạnh ngoài cùng của ngôi sao (loại bỏ cạnh bên trong)
      (() => {
        // Lấy tất cả edges
        const allEdges = new THREE.EdgesGeometry(T, 5);
        const posAttr = allEdges.getAttribute("position");
        const edgeData = [];

        // Tính khoảng cách từ tâm đến trung điểm của mỗi cạnh
        for (let i = 0; i < posAttr.count; i += 2) {
          const x1 = posAttr.getX(i);
          const y1 = posAttr.getY(i);
          const z1 = posAttr.getZ(i);
          const x2 = posAttr.getX(i + 1);
          const y2 = posAttr.getY(i + 1);
          const z2 = posAttr.getZ(i + 1);

          // Trung điểm của cạnh
          const midX = (x1 + x2) / 2;
          const midY = (y1 + y2) / 2;
          const midZ = (z1 + z2) / 2;

          // Khoảng cách từ tâm đến trung điểm
          const dist = Math.sqrt(midX * midX + midY * midY + midZ * midZ);

          edgeData.push({
            index: i,
            dist,
            x1,
            y1,
            z1,
            x2,
            y2,
            z2,
          });
        }

        // Sắp xếp theo khoảng cách (xa nhất trước)
        edgeData.sort((a, b) => b.dist - a.dist);

        // Lấy top 10 cạnh xa nhất (đủ cho ngôi sao 5 cánh: 5 cạnh ngoài + 5 cạnh chóp)
        // Điều này đảm bảo không bị thiếu cạnh nào
        const topN = 10;
        const outerEdgePositions = [];
        for (let i = 0; i < Math.min(topN, edgeData.length); i++) {
          const edge = edgeData[i];
          outerEdgePositions.push(
            edge.x1,
            edge.y1,
            edge.z1,
            edge.x2,
            edge.y2,
            edge.z2
          );
        }

        const outerEdgeGeom = new THREE.BufferGeometry();
        outerEdgeGeom.setAttribute(
          "position",
          new THREE.BufferAttribute(new Float32Array(outerEdgePositions), 3)
        );

        const edgeMat = new THREE.LineBasicMaterial({
          color: new THREE.Color("#fff7c2"),
          linewidth: 2,
          transparent: true,
          opacity: 0.95,
        });

        topStarOutline = new THREE.LineSegments(outerEdgeGeom, edgeMat);
        topStarOutline.position.copy(topStar.position);
        topStarOutline.scale.copy(topStar.scale).multiplyScalar(1.03);
        topStarOutline.visible = true;
        topStarOutline.layers.enable(L); // cho ăn bloom nhẹ
        M.add(topStarOutline);
      })(),
      // Intro: chưa cho vào layer bloom để ngôi sao không "sáng" ngay
      // (khi click mới enable layer L cho topStar)
      M.add(topStar);
    let V = [],
      q = [];
    (x = 2e3),
      (T = new THREE.CylinderGeometry(0.1, 4.5, 10, 8, 1, !0)),
      (H = new THREE.Mesh(T, new THREE.MeshBasicMaterial())),
      (j = new t(H).build()),
      (S = 0.1),
      (B = 3),
      (THREE.BufferGeometry.prototype.tripleFace = d);
    let N = new THREE.IcosahedronGeometry(S, 0).tripleFace(B);
    G = [];
    for (let e = 0; e < x; e++)
      j.sample(Q),
        (T = N.clone()).rotateX(Math.random() * Math.PI),
        T.rotateY(Math.random() * Math.PI),
        T.rotateZ(Math.random() * Math.PI),
        T.translate(Q.x, Q.y, Q.z),
        G.push(T);
    (T = BufferGeometryUtils.mergeGeometries(G)).computeVertexNormals(),
      (R = g.clone()).color.set("mediumseagreen"),
      (R.reflectivity = 0.9),
      (H = new THREE.Mesh(T, R)),
      M.add(H),
      (T = new THREE.CylinderGeometry(0.6, 5, 10, 8, 1, !0)),
      (V = []),
      (q = []),
      (x = 282),
      (H = new THREE.Mesh(T, new THREE.MeshBasicMaterial())),
      (j = new t(H).build());
    for (let e = 0; e < x; e++) j.sample(Q), V.push([Q.x, Q.y, Q.z]);
    let W = [];
    for (let e = 0; e < 70; e++) {
      let e = Math.floor(Math.random() * V.length);
      W.push(V.splice(e, 1)[0]);
    }
    let X = [];
    for (let e = 0; e < 70; e++) {
      let e = Math.floor(Math.random() * V.length);
      X.push(V.splice(e, 1)[0]);
    }
    let Y = [];
    for (let e = 0; e < 22; e++) {
      let e = Math.floor(Math.random() * V.length);
      Y.push(V.splice(e, 1)[0]);
    }
    let te = [];
    for (let e = 0; e < 120; e++) {
      let e = Math.floor(Math.random() * V.length);
      te.push(V.splice(e, 1)[0]);
    }
    (S = 0.24),
      (B = 1),
      (T = new THREE.SphereGeometry(S, 20, 20)),
      ((R = g.clone()).reflectivity = 0.8),
      (b = new THREE.Mesh(T, R)),
      (H = l(B, te, "sphere")),
      M.add(H),
      (B = 1),
      (T = (function (e) {
        let t = 1.5 * e,
          o = new THREE.SphereGeometry(e, 10, 10);
        const n = o.attributes.position;
        for (let r = 0; r < n.count; r++)
          n.getY(r) > e / 3 &&
            (o.attributes.position.setX(r, 0),
            o.attributes.position.setY(r, t),
            o.attributes.position.setZ(r, 0));
        (G = []), o.translate(0, -t, 0);
        let r = o.clone();
        return (
          r.rotateZ(Math.PI / 2),
          G.push(r),
          (r = o.clone()).rotateZ(-Math.PI / 2),
          G.push(r),
          (r = o.clone()).scale(0.7, 1.5, 0.7),
          r.rotateZ(Math.PI / 8),
          G.push(r),
          (r = o.clone()).scale(0.7, 1.5, 0.7),
          r.rotateZ(-Math.PI / 8),
          G.push(r),
          (r = new THREE.SphereGeometry(t / 2.3, 5, 5)),
          G.push(r),
          (o = BufferGeometryUtils.mergeGeometries(G)),
          (o = BufferGeometryUtils.mergeVertices(o, e / 10)).scale(1, 1, 0.7),
          o.rotateX(-Math.PI / 7),
          (o.attributes.position.needsUpdate = !0),
          o.computeBoundingBox(),
          o.computeVertexNormals(),
          o
        );
      })((S = 0.15))),
      ((R = g.clone()).reflectivity = 0.4),
      (b = new THREE.Mesh(T, R)),
      (H = l(B, Y, "ribbon")),
      M.add(H),
      (S = 0.11),
      (B = 1),
      (T = new THREE.SphereGeometry(S, 10, 10)),
      (b = new THREE.Mesh(T, new THREE.MeshBasicMaterial())),
      (P = l(B, W, "light")),
      M.add(P),
      (v = l(B, X, "light2")).layers.toggle(L),
      M.add(v),
      populateGiftRing(M),
      // Thêm các ảnh postcard.svg vào các vị trí ngẫu nhiên trên tán cây
      (async function () {
        try {
          const loader = new THREE.TextureLoader();
          const postcardTexture = await loader.loadAsync("/templates/christmastree/postcard.svg");
          postcardTexture.flipY = false;
          // Xoay texture 180 độ
          postcardTexture.center.set(0.5, 0.5);
          postcardTexture.rotation = Math.PI;

          // Tính tỉ lệ từ SVG (width: 5108.4399, height: 3174.5732)
          const svgWidth = 5108.4399;
          const svgHeight = 3174.5732;
          const aspectRatio = svgWidth / svgHeight; // ≈ 1.609

          // Tạo material với texture
          const postcardMaterial = new THREE.MeshBasicMaterial({
            map: postcardTexture,
            transparent: true,
            side: THREE.DoubleSide,
            alphaTest: 0.1,
          });

          // Kích thước của postcard - giữ tỉ lệ đúng (tăng 1.5 lần so với trước)
          const postcardHeight = 0.4 * 1.8;
          const postcardWidth = postcardHeight * aspectRatio; // ≈ 0.644
          const postcardGeometry = new THREE.PlaneGeometry(
            postcardWidth,
            postcardHeight
          );

          // Tạo geometry của cây để lấy các điểm trên bề mặt
          const treeGeometry = new THREE.CylinderGeometry(
            0.6,
            5,
            10,
            8,
            1,
            true
          );
          const treeMesh = new THREE.Mesh(
            treeGeometry,
            new THREE.MeshBasicMaterial()
          );
          const sampler = new t(treeMesh).build();

          // Lấy nhiều điểm ngẫu nhiên trên bề mặt cây
          const allTreePositions = [];
          for (let i = 0; i < 500; i++) {
            sampler.sample(Q);
            allTreePositions.push([Q.x, Q.y, Q.z]);
          }

          // Tập hợp vị trí các vật trang trí đã có để tránh trùng
          const existingDecorPositions = [...W, ...X, ...Y, ...te].filter(
            Boolean
          );

          // Hàm shuffle đơn giản
          function shuffleArray(array) {
            for (let i = array.length - 1; i > 0; i--) {
              const j = Math.floor(Math.random() * (i + 1));
              [array[i], array[j]] = [array[j], array[i]];
            }
          }

          function angularDistance(a, b) {
            const diff = Math.abs(a - b);
            return Math.min(diff, Math.PI * 2 - diff);
          }

          const isFarEnough = (candidate, other, limitSq) => {
            if (!other) return true;
            const dx = candidate[0] - other[0];
            const dy = candidate[1] - other[1];
            const dz = candidate[2] - other[2];
            return dx * dx + dy * dy + dz * dz >= limitSq;
          };

          // Chọn vị trí rải đều theo tầng và góc nhìn
          function selectDistributedPositions({
            positions,
            count,
            minDistance = 0.6,
            decorPositions = [],
            minDecorDistance = 0.45,
            layerCount = 6,
            minAngleDiff = Math.PI / 6,
            topCoverageRatio = 0.8,
          }) {
            if (!positions.length) return [];

            const ys = positions.map((p) => p[1]);
            const minY = Math.min(...ys);
            const maxY = Math.max(...ys);
            const heightRange = maxY - minY || 1;
            const minAllowedY = maxY - heightRange * topCoverageRatio;

            const filteredPositions = positions.filter(
              (p) => p[1] >= minAllowedY
            );
            const sourcePositions =
              filteredPositions.length >= count ? filteredPositions : positions;

            const minDistanceSq = minDistance * minDistance;
            const minDecorDistanceSq = minDecorDistance * minDecorDistance;

            const layerHeight = heightRange / layerCount || 1;
            const layers = Array.from({ length: layerCount }, () => []);

            sourcePositions.forEach((pos) => {
              const idx = Math.max(
                0,
                Math.min(
                  layerCount - 1,
                  Math.floor((pos[1] - minY) / layerHeight)
                )
              );
              layers[idx].push(pos);
            });

            layers.forEach((layer) => shuffleArray(layer));

            const selected = [];
            const usedAngles = [];
            const layerQuota = Math.max(1, Math.ceil(count / layerCount));

            const canUseCandidate = (candidate) => {
              const angle = Math.atan2(candidate[2], candidate[0]);
              const farFromPostcards = selected.every((existing) =>
                isFarEnough(candidate, existing, minDistanceSq)
              );
              const farFromDecor = decorPositions.every((existing) =>
                isFarEnough(candidate, existing, minDecorDistanceSq)
              );
              const angleClear = usedAngles.every(
                (a) => angularDistance(a, angle) >= minAngleDiff
              );
              return farFromPostcards && farFromDecor && angleClear;
            };

            for (let i = 0; i < layerCount && selected.length < count; i++) {
              const layer = layers[i];
              let takenInLayer = 0;
              for (const candidate of layer) {
                if (canUseCandidate(candidate)) {
                  selected.push(candidate);
                  usedAngles.push(Math.atan2(candidate[2], candidate[0]));
                  takenInLayer++;
                }
                if (takenInLayer >= layerQuota || selected.length >= count)
                  break;
              }
            }

            // Fallback nếu chưa đủ số lượng
            if (selected.length < count) {
              const remaining = sourcePositions.filter(
                (pos) => !selected.includes(pos)
              );
              shuffleArray(remaining);
              for (const candidate of remaining) {
                if (canUseCandidate(candidate)) {
                  selected.push(candidate);
                  usedAngles.push(Math.atan2(candidate[2], candidate[0]));
                }
                if (selected.length >= count) break;
              }
            }

            return selected.slice(0, count);
          }

          // Chọn 12 vị trí ngẫu nhiên nhưng rải đều
          const postcardPositions = selectDistributedPositions({
            positions: allTreePositions,
            count: 12,
            minDistance: 0.65,
            decorPositions: existingDecorPositions,
            minDecorDistance: 0.5,
            layerCount: 6,
            minAngleDiff: Math.PI / 5,
            topCoverageRatio: 0.8,
          });

          // Tạo postcard group
          const postcardGroup = new THREE.Group();
          postcardMeshes = [];

          for (let i = 0; i < postcardPositions.length; i++) {
            const postcard = new THREE.Mesh(
              postcardGeometry,
              postcardMaterial.clone()
            );
            postcard.position.set(
              postcardPositions[i][0],
              postcardPositions[i][1],
              postcardPositions[i][2]
            );

            // Thêm rotation ngẫu nhiên ban đầu
            postcard.rotateY(Math.random() * Math.PI * 2);
            postcard.rotateX((Math.random() - 0.5) * 0.3);

            // Lưu metadata cho postcard
            postcard.userData = {
              kind: "postcard",
              index: i,
            };

            postcardGroup.add(postcard);
            postcardMeshes.push(postcard);
          }

          postcardGroups = [postcardGroup];
          M.add(postcardGroup);

          // Tạo modal và thêm click handler
          modal = createModal();
          setupPostcardClickHandler();

          // Sau khi đã có vị trí postcard và đồ trang trí, thêm các chữ 3D
          treePostcardPositions = postcardPositions;
          const allDecorForText = [
            ...existingDecorPositions,
            ...treePostcardPositions,
          ].filter(Boolean);
          addTreeTextLabels(allDecorForText);
        } catch (error) {
          console.error("Lỗi khi tải postcard.svg:", error);
        }
      })(),
      ((w = new e(E, f.domElement)).autoRotate = !1), // Intro: tạm tắt auto-rotate, sẽ bật sau khi zoom out
      (w.autoRotateSpeed = 1),
      (w.enableDamping = !0),
      (w.enablePan = !1),
      (w.minDistance = 8),
      (w.maxDistance = 50),
      (w.minPolarAngle = 0),
      (w.maxPolarAngle = Math.PI / 2),
      // Trong intro, target của camera là đỉnh cây (ngôi sao)
      cameraIntroTarget && w.target.copy(cameraIntroTarget),
      w.update(),
      m(),
      window.addEventListener("resize", h);
  })();
})();
