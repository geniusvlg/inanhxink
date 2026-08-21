import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.172.0/build/three.module.js';

(function () {
  if (window.__LOVEBURST_EFFECTS__) return;
  window.__LOVEBURST_EFFECTS__ = true;

  var isMobile = window.innerWidth < 768;
  var isInApp = /Zalo|FBAN|FBAV|Instagram|Line|MicroMessenger/i.test(navigator.userAgent || '');
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var PARTICLE_COUNT = reduced ? 0 : (isInApp ? (isMobile ? 40000 : 60000) : (isMobile ? 80000 : 120000));
  var GATHER_SPEED = isMobile ? 0.08 : 0.05;
  var HOLD_MS = isMobile ? 4000 : 3500;
  var DEPTH = isMobile ? 1 : 1.5;
  var SIZE = isMobile ? 0.13 : 0.17;

  var scene, camera, renderer;
  var stars, galaxy, sparks, sparkMeta = [];
  var textMesh, textGlow, textBloom, geometry;
  var twinkleIdx = [];
  var twinklePhase = [];
  var twinkleBase = [];
  var positions = new Float32Array(PARTICLE_COUNT * 3);
  var targets = new Float32Array(PARTICLE_COUNT * 3);
  var fireworks = [];
  var messages = [];
  var msgIndex = 0;
  var gatherAt = 0;
  var exploding = false;
  var explodeAt = 0;
  var started = false;
  var textDone = false;
  var colorStart = new THREE.Color('#ff1493');
  var colorEnd = new THREE.Color('#ff69b4');
  var fade = 0;
  var fadeFrom = 0;
  var alive = true;

  function spriteTexture() {
    var c = document.createElement('canvas');
    c.width = 64;
    c.height = 64;
    var x = c.getContext('2d');
    var g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.1, 'rgba(255,240,250,1)');
    g.addColorStop(0.26, 'rgba(255,105,180,0.95)');
    g.addColorStop(0.48, 'rgba(255,20,147,0.5)');
    g.addColorStop(0.72, 'rgba(255,20,147,0.14)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = g;
    x.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(c);
  }

  function glowTexture() {
    var c = document.createElement('canvas');
    c.width = 128;
    c.height = 128;
    var x = c.getContext('2d');
    var g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, 'rgba(255,210,235,0.95)');
    g.addColorStop(0.16, 'rgba(255,105,180,0.62)');
    g.addColorStop(0.4, 'rgba(255,20,147,0.28)');
    g.addColorStop(0.7, 'rgba(255,20,147,0.07)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = g;
    x.fillRect(0, 0, 128, 128);
    return new THREE.CanvasTexture(c);
  }

  function addStars() {
    var n = 8000;
    var pos = [];
    for (var i = 0; i < n; i++) {
      pos.push((Math.random() - 0.5) * 2000, (Math.random() - 0.5) * 2000, (Math.random() - 0.5) * 2000);
    }
    var geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    stars = new THREE.Points(geo, new THREE.PointsMaterial({
      color: 0xffffff, size: 0.5, transparent: true, opacity: 0
    }));
    scene.add(stars);
  }

  function addGalaxy() {
    var n = 30000;
    var pos = [];
    var col = [];
    var a = new THREE.Color(0xfd9595);
    var b = new THREE.Color(0xffb3c1);
    var c = new THREE.Color(0x9955cc);
    for (var i = 0; i < n; i++) {
      var r = 80 * Math.pow(Math.random(), 1.5);
      var th = Math.random() * Math.PI * 2;
      var twist = r * 0.05;
      pos.push(Math.cos(th + twist) * r, 1.5 * (Math.random() - 0.5), Math.sin(th + twist) * r);
      var t = r / 80;
      var mix = t < 0.5 ? a.clone().lerp(b, t * 2) : b.clone().lerp(c, (t - 0.5) * 2);
      col.push(mix.r, mix.g, mix.b);
    }
    var geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    galaxy = new THREE.Points(geo, new THREE.PointsMaterial({
      size: 0.12, sizeAttenuation: true, transparent: true, opacity: 0,
      vertexColors: true, blending: THREE.AdditiveBlending, depthWrite: false
    }));
    galaxy.position.y = -20;
    scene.add(galaxy);
  }

  function addSparks() {
    var n = 8000;
    var pos = [];
    sparkMeta = [];
    for (var i = 0; i < n; i++) {
      pos.push((Math.random() - 0.5) * 200, Math.random() * 200 - 50, (Math.random() - 0.5) * 200);
      sparkMeta.push({
        y: Math.random() * 0.02 + 0.01,
        swayX: (Math.random() - 0.5) * 0.1,
        swayZ: (Math.random() - 0.5) * 0.1,
        freq: Math.random() * 0.5 + 0.2
      });
    }
    var geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    sparks = new THREE.Points(geo, new THREE.PointsMaterial({
      color: 0xffffff, size: 0.15, transparent: true, opacity: 0,
      blending: THREE.AdditiveBlending, depthWrite: false
    }));
    scene.add(sparks);
  }

  function addTextCloud() {
    if (!PARTICLE_COUNT) return;
    var cols = new Float32Array(PARTICLE_COUNT * 3);
    for (var i = 0; i < PARTICLE_COUNT; i++) {
      var r = 20 + 40 * Math.random();
      var th = Math.random() * Math.PI * 2;
      var ph = Math.acos(2 * Math.random() - 1);
      positions[i * 3] = r * Math.sin(ph) * Math.cos(th);
      positions[i * 3 + 1] = r * Math.sin(ph) * Math.sin(th);
      positions[i * 3 + 2] = r * Math.cos(ph);
      targets[i * 3] = positions[i * 3];
      targets[i * 3 + 1] = positions[i * 3 + 1];
      targets[i * 3 + 2] = positions[i * 3 + 2];
      cols[i * 3] = 0.78 + 0.15 * Math.random();
      cols[i * 3 + 1] = 0.1 + 0.15 * Math.random();
      cols[i * 3 + 2] = 0.35 + 0.15 * Math.random();
    }
    geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(cols, 3));
    var map = spriteTexture();
    var halo = glowTexture();
    textMesh = new THREE.Points(geometry, new THREE.PointsMaterial({
      size: SIZE, map: map, vertexColors: true, transparent: true,
      opacity: 1, depthWrite: false, blending: THREE.AdditiveBlending
    }));
    textMesh.position.set(0, 8, 0);
    textGlow = new THREE.Points(geometry, new THREE.PointsMaterial({
      size: SIZE * 4.8, map: halo, vertexColors: true, transparent: true,
      opacity: 0.42, depthWrite: false, blending: THREE.AdditiveBlending
    }));
    textBloom = new THREE.Points(geometry, new THREE.PointsMaterial({
      size: SIZE * (isMobile ? 8.5 : 11), map: halo, vertexColors: true, transparent: true,
      opacity: isMobile ? 0.16 : 0.22, depthWrite: false, blending: THREE.AdditiveBlending
    }));
    textGlow.position.copy(textMesh.position);
    textBloom.position.copy(textMesh.position);
    scene.add(textBloom);
    scene.add(textGlow);
    scene.add(textMesh);
  }

  function drawSpaced(ctx, text, x, y, gap, mode) {
    if (gap <= 0) {
      if (mode === 'fill') ctx.fillText(text, x, y);
      else ctx.strokeText(text, x, y);
      return;
    }
    var chars = Array.from(text);
    var total = chars.reduce(function (sum, ch) { return sum + ctx.measureText(ch).width + gap; }, -gap);
    var cursor = x - total / 2;
    chars.forEach(function (ch) {
      var w = ctx.measureText(ch).width;
      if (mode === 'fill') ctx.fillText(ch, cursor + w / 2, y);
      else ctx.strokeText(ch, cursor + w / 2, y);
      cursor += w + gap;
    });
  }

  function formText(text) {
    if (!PARTICLE_COUNT || !textMesh) return;
    if (msgIndex > 0) {
      for (var i = 0; i < PARTICLE_COUNT; i++) {
        positions[i * 3] += (Math.random() - 0.5) * 150;
        positions[i * 3 + 1] += (Math.random() - 0.5) * 150;
        positions[i * 3 + 2] += (Math.random() - 0.5) * 150;
      }
    }

    var w = isMobile ? 600 : 1200;
    var h = 500;
    var size = isMobile ? 130 : 160;
    var gap = isMobile ? 2 : 4;
    var canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    var ctx = canvas.getContext('2d');
    var font = '"Mali", "Pacifico", cursive';

    function wrap(px) {
      ctx.font = px + 'px ' + font;
      var words = String(text).split(' ');
      var lines = [];
      var line = words[0] || '';
      for (var i = 1; i < words.length; i++) {
        var next = line + ' ' + words[i];
        if (ctx.measureText(next).width + next.length * gap > w * 0.85) {
          lines.push(line);
          line = words[i];
        } else {
          line = next;
        }
      }
      lines.push(line);
      return lines;
    }

    var lines = wrap(size);
    for (var t = 0; t < 5; t++) {
      var tooTall = lines.length * size * 1.6 > 425;
      var tooWide = false;
      ctx.font = size + 'px ' + font;
      for (var li = 0; li < lines.length; li++) {
        if (ctx.measureText(lines[li]).width + lines[li].length * gap > w * 0.85) tooWide = true;
      }
      if (!tooTall && !tooWide) break;
      size = Math.floor(size * 0.85);
      lines = wrap(size);
    }

    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, w, h);
    ctx.font = size + 'px ' + font;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    var lh = size * 1.6;
    var y0 = 250 - (lines.length - 1) * lh / 2;
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = isMobile ? 6 : 8;
    lines.forEach(function (line, i) {
      drawSpaced(ctx, line, w / 2, y0 + i * lh, gap, 'stroke');
    });
    ctx.fillStyle = '#fff';
    lines.forEach(function (line, i) {
      drawSpaced(ctx, line, w / 2, y0 + i * lh, gap, 'fill');
    });

    var pixels = ctx.getImageData(0, 0, w, h).data;
    var hits = [];
    for (var y = 0; y < h; y++) {
      for (var x = 0; x < w; x++) {
        var b = pixels[4 * (y * w + x)];
        if (b > 100) hits.push({ x: x, y: y, b: b });
      }
    }

    var sx = isMobile ? 0.09 : 0.1;
    var sy = sx;
    var ox = -w * sx / 2;
    var colors = geometry.attributes.color;
    var twinkleCap = isMobile ? 1200 : 2200;
    twinkleIdx = [];
    twinklePhase = [];
    twinkleBase = [];
    for (var p = 0; p < PARTICLE_COUNT; p++) {
      if (hits.length) {
        var hit = hits[Math.floor(Math.random() * hits.length)];
        targets[p * 3] = hit.x * sx + ox;
        targets[p * 3 + 1] = -hit.y * sy + h * sy / 2;
        targets[p * 3 + 2] = (Math.random() - 0.5) * DEPTH;
        var mix = colorStart.clone().lerp(colorEnd, 1 - hit.b / 255);
        var roll = Math.random();
        var r, g, b;
        if (roll < 0.07) {
          r = 1;
          g = 0.78;
          b = 0.92;
        } else if (roll < 0.22) {
          r = Math.min(1, mix.r * 1.32);
          g = Math.min(1, mix.g * 1.22 + 0.12);
          b = Math.min(1, mix.b * 1.12 + 0.08);
        } else {
          r = Math.min(1, mix.r * 1.16);
          g = Math.min(1, mix.g * 1.06);
          b = mix.b;
        }
        colors.setXYZ(p, r, g, b);
        if (roll < 0.07 && twinkleIdx.length < twinkleCap) {
          twinkleIdx.push(p);
          twinklePhase.push(Math.random() * Math.PI * 2);
          twinkleBase.push(r, g, b);
        }
      } else {
        targets[p * 3] = 40 * (Math.random() - 0.5);
        targets[p * 3 + 1] = 15 * (Math.random() - 0.5);
        targets[p * 3 + 2] = 2 * (Math.random() - 0.5);
        colors.setXYZ(p, 1, 0.08, 0.58);
      }
    }
    colors.needsUpdate = true;
  }

  function syncTextGlow() {
    if (!textMesh) return;
    var pulse = exploding ? 0 : 0.5 + 0.5 * Math.sin(Date.now() * 0.0022);
    if (textGlow) {
      textGlow.position.copy(textMesh.position);
      textGlow.rotation.copy(textMesh.rotation);
      if (!exploding) {
        textGlow.material.size = SIZE * (2 + 0.4 * pulse);
        textGlow.material.opacity = 0.08 + 0.04 * pulse;
      }
    }
    if (textBloom) {
      textBloom.position.copy(textMesh.position);
      textBloom.rotation.copy(textMesh.rotation);
      if (!exploding) {
        textBloom.material.size = SIZE * ((isMobile ? 3.2 : 4.2) + 0.6 * pulse);
        textBloom.material.opacity = (isMobile ? 0.015 : 0.025) + 0.015 * pulse;
      }
    }
  }

  function shimmerText(t) {
    if (!geometry || !twinkleIdx.length) return;
    var colors = geometry.attributes.color;
    for (var k = 0; k < twinkleIdx.length; k++) {
      var tw = 0.45 + 0.55 * Math.max(0, Math.sin(t * 9 + twinklePhase[k]));
      var bi = k * 3;
      colors.setXYZ(
        twinkleIdx[k],
        twinkleBase[bi] + (1 - twinkleBase[bi]) * tw * 0.7,
        twinkleBase[bi + 1] + (0.95 - twinkleBase[bi + 1]) * tw * 0.7,
        twinkleBase[bi + 2] + (0.98 - twinkleBase[bi + 2]) * tw * 0.55
      );
    }
    colors.needsUpdate = true;
  }

  function disposeHalo(mesh, dropMap) {
    if (!mesh) return;
    scene.remove(mesh);
    if (mesh.material) {
      if (dropMap && mesh.material.map) mesh.material.map.dispose();
      mesh.material.dispose();
    }
  }

  function disposeTextMeshes() {
    disposeHalo(textBloom, false);
    disposeHalo(textGlow, true);
    textBloom = null;
    textGlow = null;
    if (textMesh) {
      textMesh.visible = false;
      scene.remove(textMesh);
      if (textMesh.geometry) textMesh.geometry.dispose();
      if (textMesh.material) {
        if (textMesh.material.map) textMesh.material.map.dispose();
        textMesh.material.dispose();
      }
      textMesh = null;
    }
    geometry = null;
    twinkleIdx = [];
    twinklePhase = [];
    twinkleBase = [];
  }

  function Firework() {
    this.dead = false;
    var origin = new THREE.Vector3((Math.random() - 0.5) * 40, 20 + 30 * Math.random(), (Math.random() - 0.5) * 20);
    var geo = new THREE.BufferGeometry();
    var pos = [];
    var vels = [];
    var color = new THREE.Color().setHSL(Math.random(), 0.9, 0.6);
    for (var i = 0; i < 80; i++) {
      pos.push(origin.x, origin.y, origin.z, origin.x, origin.y, origin.z);
      var th = Math.random() * Math.PI * 2;
      var ph = Math.acos(2 * Math.random() - 1);
      var sp = 0.12 + 0.2 * Math.random();
      vels.push({
        x: Math.sin(ph) * Math.cos(th) * sp,
        y: Math.sin(ph) * Math.sin(th) * sp,
        z: Math.cos(ph) * sp
      });
    }
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    this.mesh = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({
      color: color, transparent: true, opacity: 1, blending: THREE.AdditiveBlending
    }));
    this.mesh.userData = { velocities: vels, life: 1, drag: 0.96 };
    scene.add(this.mesh);
  }
  Firework.prototype.update = function () {
    if (this.dead) return;
    var arr = this.mesh.geometry.attributes.position.array;
    var vels = this.mesh.userData.velocities;
    this.mesh.userData.life -= 0.012;
    this.mesh.material.opacity = this.mesh.userData.life;
    for (var i = 0; i < vels.length; i++) {
      vels[i].x *= this.mesh.userData.drag;
      vels[i].y *= this.mesh.userData.drag;
      vels[i].z *= this.mesh.userData.drag;
      vels[i].y -= 0.005;
      var a = i * 6;
      var b = a + 3;
      arr[b] += 0.15 * (arr[a] - arr[b]);
      arr[b + 1] += 0.15 * (arr[a + 1] - arr[b + 1]);
      arr[b + 2] += 0.15 * (arr[a + 2] - arr[b + 2]);
      arr[a] += vels[i].x;
      arr[a + 1] += vels[i].y;
      arr[a + 2] += vels[i].z;
    }
    this.mesh.geometry.attributes.position.needsUpdate = true;
    if (this.mesh.userData.life <= 0) {
      this.dead = true;
      scene.remove(this.mesh);
      this.mesh.geometry.dispose();
      this.mesh.material.dispose();
    }
  };

  function beginMessages() {
    var data = window.loveburstData || {};
    messages = (data.messages || []).filter(Boolean);
    if (!messages.length) messages = ['Gửi Em 💖💕', 'Người Anh Yêu Nhất 💝', 'Mãi Bên Em 💖'];
    if (data.heartColor) {
      try { colorStart = new THREE.Color(data.heartColor); } catch (e) {}
    }
    var kick = function () {
      formText(messages[0]);
      gatherAt = Date.now();
    };
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(function () { setTimeout(kick, 150); });
    } else {
      setTimeout(kick, 400);
    }
  }

  function tick() {
    if (!alive) return;
    requestAnimationFrame(tick);
    var now = Date.now();
    var t = now * 0.0005;
    if (fade < 1 && fadeFrom) {
      fade = Math.min(1, (now - fadeFrom) / 500);
      if (stars) stars.material.opacity = 0.6 * fade;
      if (galaxy) galaxy.material.opacity = 0.35 * fade;
      if (sparks) sparks.material.opacity = 0.7 * fade;
    }

    if (textMesh && messages.length && !textDone) {
      var speed = exploding ? 0.008 : GATHER_SPEED;
      for (var i = 0; i < PARTICLE_COUNT; i++) {
        var n = i * 3;
        positions[n] += (targets[n] - positions[n]) * speed;
        positions[n + 1] += (targets[n + 1] - positions[n + 1]) * speed;
        positions[n + 2] += (targets[n + 2] - positions[n + 2]) * speed;
      }
      geometry.attributes.position.needsUpdate = true;
      if (!exploding) {
        textMesh.position.y = 8 + 1.5 * Math.sin(t * 1.5);
        textMesh.rotation.z = 0.03 * Math.sin(t * 0.8);
        textMesh.material.size = SIZE * (1 + 0.1 * Math.sin(t * 2.4));
        shimmerText(t);
      }
      syncTextGlow();
      if (exploding && explodeAt) {
        var elapsed = now - explodeAt;
        if (elapsed > 500) {
          var fadeOut = 1 - Math.min(1, (elapsed - 500) / 1000);
          textMesh.material.opacity = fadeOut;
          if (textGlow) textGlow.material.opacity = fadeOut * 0.1;
          if (textBloom) textBloom.material.opacity = fadeOut * (isMobile ? 0.02 : 0.035);
        }
        if (elapsed > 1500) {
          exploding = false;
          textDone = true;
          disposeTextMeshes();
          window.dispatchEvent(new CustomEvent('textMessagesComplete'));
        }
      } else if (gatherAt && now - gatherAt > HOLD_MS) {
        msgIndex += 1;
        if (msgIndex < messages.length) {
          formText(messages[msgIndex]);
          gatherAt = now;
        } else {
          exploding = true;
          explodeAt = now;
          for (var p = 0; p < PARTICLE_COUNT; p++) {
            targets[p * 3] = 300 * (Math.random() - 0.5);
            targets[p * 3 + 1] = 300 * (Math.random() - 0.5);
            targets[p * 3 + 2] = 300 * (Math.random() - 0.5);
          }
        }
      }
    } else if (textMesh) {
      for (var j = 0; j < PARTICLE_COUNT; j++) {
        positions[j * 3] = targets[j * 3] + Math.sin(t * 0.6 + j * 0.013) * 1.5;
        positions[j * 3 + 1] = targets[j * 3 + 1] + Math.cos(t * 0.5 + j * 0.017) * 1.5;
        positions[j * 3 + 2] = targets[j * 3 + 2] + Math.sin(t * 0.7 + j * 0.011) * 1.2;
      }
      geometry.attributes.position.needsUpdate = true;
      textMesh.position.y = 8 + 0.6 * Math.sin(t * 0.8);
      textMesh.rotation.y += 0.0003;
      textMesh.material.size = SIZE * (1 + 0.05 * Math.sin(t * 2));
      shimmerText(t);
      syncTextGlow();
    }

    if (sparks) {
      var arr = sparks.geometry.attributes.position.array;
      for (var s = 0; s < arr.length; s += 3) {
        var meta = sparkMeta[s / 3];
        if (!meta) continue;
        arr[s + 1] -= meta.y;
        arr[s] += Math.sin(t * meta.freq + s) * meta.swayX * 0.1;
        arr[s + 2] += Math.cos(t * meta.freq + s) * meta.swayZ * 0.1;
        if (arr[s + 1] < -60) arr[s + 1] = 100;
      }
      sparks.geometry.attributes.position.needsUpdate = true;
    }
    if (galaxy) galaxy.rotation.y += 0.0003;
    if (!reduced && Math.random() < (isMobile ? 0.012 : 0.025)) fireworks.push(new Firework());
    for (var f = fireworks.length - 1; f >= 0; f--) {
      fireworks[f].update();
      if (fireworks[f].dead) fireworks.splice(f, 1);
    }
    renderer.render(scene, camera);
  }

  function init() {
    var canvas = document.createElement('canvas');
    canvas.id = 'effects-overlay';
    canvas.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:2;';
    document.body.appendChild(canvas);
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 2000);
    camera.position.set(0, 25, 65);
    camera.lookAt(0, 0, 0);
    renderer = new THREE.WebGLRenderer({ canvas: canvas, alpha: true, antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setClearColor(0x000000, 0);
    addStars();
    addGalaxy();
    addSparks();
    addTextCloud();
    fadeFrom = Date.now();
    tick();
    window.addEventListener('resize', function () {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    });
    if (window.__LOVEBURST_START_REQUESTED__) startMessages();
  }

  function startMessages() {
    window.__LOVEBURST_START_REQUESTED__ = true;
    if (started) return;
    if (!geometry) return;
    started = true;
    if (reduced || !PARTICLE_COUNT) {
      window.dispatchEvent(new CustomEvent('textMessagesComplete'));
      return;
    }
    beginMessages();
  }

  window.addEventListener('__textStart', startMessages);

  function boot() {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', function () { setTimeout(init, 0); });
    } else {
      setTimeout(init, 0);
    }
  }
  boot();
})();
