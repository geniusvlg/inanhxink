(function () {
  'use strict';

  var data = (window.dataFromSubdomain && window.dataFromSubdomain.data) || window.siteData || {};
  var backgroundText = data.backgroundText || 'I LOVE YOU';
  var backgroundColor = data.backgroundColor || '#ffa3e0';
  var textColor = data.textColor || { r: 179, g: 204, b: 255 };
  var heartColor = data.heartColor || { r: 255, g: 105, b: 180 };
  var messages = data.messages || [];
  var finalText = data.finalText || '';
  var musicSrc = data.musicUrl || data.music || '';

  // ─── Dynamic --vh ────────────────────────────────────────────────────────────
  function updateVh() {
    var vh = window.innerHeight * 0.01;
    document.documentElement.style.setProperty('--vh', vh + 'px');
  }
  updateVh();
  window.addEventListener('resize', updateVh);
  window.addEventListener('orientationchange', function () { setTimeout(updateVh, 100); });

  // ─── Audio ───────────────────────────────────────────────────────────────────
  var audio = null;
  if (musicSrc) {
    audio = document.createElement('audio');
    audio.src = musicSrc;
    audio.loop = true;
    audio.hidden = true;
    document.body.appendChild(audio);
    var tryPlay = function () {
      if (audio && audio.paused) {
        audio.play().catch(function () {});
      }
    };
    ['click', 'touchstart', 'mousedown'].forEach(function (e) {
      document.addEventListener(e, tryPlay, { once: true });
    });
  }

  // ─── Safe-area helpers ───────────────────────────────────────────────────────
  function getSafeArea(side) {
    if (typeof window === 'undefined') return 0;
    var d = document.createElement('div');
    d.style.position = 'fixed';
    d.style[side] = 'env(safe-area-inset-' + side + ')';
    d.style.visibility = 'hidden';
    document.body.appendChild(d);
    var val = parseInt(getComputedStyle(d)[side]) || 0;
    document.body.removeChild(d);
    return val;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 1. MATRIX RAIN BACKGROUND
  // ═══════════════════════════════════════════════════════════════════════════
  (function initMatrixRain() {
    var canvas = document.getElementById('matrixCanvas');
    var ctx = canvas.getContext('2d');
    var dpr = window.devicePixelRatio || 1;
    var charSize = 14;
    var fontSize = 20;
    var columns, drops, charIndices;
    // Cache safe-area so we don't touch DOM every frame
    var safeL = 0, safeT = 0, safeR = 0, safeB = 0;
    var logW, logH;

    function resize() {
      safeT = getSafeArea('top'); safeB = getSafeArea('bottom');
      safeL = getSafeArea('left'); safeR = getSafeArea('right');
      logW = window.innerWidth + safeL + safeR;
      logH = window.innerHeight + safeT + safeB;
      canvas.width = logW * dpr;
      canvas.height = logH * dpr;
      canvas.style.width = logW + 'px';
      canvas.style.height = (logH + 4) + 'px';
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.scale(dpr, dpr);
      // Seed with black
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, logW, logH);
      columns = Math.floor(logW / (fontSize / 2));
      drops = Array.from({ length: columns }, function () {
        return -Math.floor(Math.random() * logH / charSize);
      });
      charIndices = Array.from({ length: columns }, function (_, i) {
        return i % backgroundText.length;
      });
    }

    resize();
    window.addEventListener('resize', function () { resize(); });

    function draw() {
      // Fading trail
      ctx.fillStyle = 'rgba(0, 0, 0, 0.06)';
      ctx.fillRect(0, 0, logW, logH);

      ctx.fillStyle = backgroundColor;
      ctx.font = fontSize + "px 'Courier New', monospace";

      for (var i = 0; i < columns; i++) {
        var ch = backgroundText[charIndices[i] % backgroundText.length];
        var x = i * (fontSize / 2) + safeL;
        var y = drops[i] * charSize + safeT;
        ctx.fillText(ch, x, y);
        drops[i]++;
        charIndices[i] = (charIndices[i] + 1) % backgroundText.length;
        if (drops[i] * charSize > logH && Math.random() > 0.975) {
          drops[i] = 0;
        }
      }
      setTimeout(draw, 25);
    }
    draw();
  })();

  // ═══════════════════════════════════════════════════════════════════════════
  // 2. PARTICLE COUNTDOWN  (Three.js WebGL — ported from Harumi countdown-3d)
  // ═══════════════════════════════════════════════════════════════════════════
  (function initParticleCountdown() {

    // ── Quality presets (same as Harumi) ────────────────────────────────────
    var QUALITY = {
      low:    { dotGapMultiplier: 1.5, effectIntensity: 0.7,  blurEnabled: false, maxFlyingDots: 180 },
      medium: { dotGapMultiplier: 1.2, effectIntensity: 0.85, blurEnabled: true,  maxFlyingDots: 387 },
      high:   { dotGapMultiplier: 1.0, effectIntensity: 1.0,  blurEnabled: true,  maxFlyingDots: 850 },
    };

    var quality = 'medium';
    var saved = typeof localStorage !== 'undefined' && localStorage.getItem('dotsQualityPreference');
    if (saved && QUALITY[saved]) {
      quality = saved;
    } else if ('deviceMemory' in navigator || 'hardwareConcurrency' in navigator) {
      var mem = navigator.deviceMemory || 4;
      var cpu = navigator.hardwareConcurrency || 4;
      if (mem <= 2 || cpu <= 2) quality = 'low';
      else if (mem >= 8 && cpu >= 6) quality = 'high';
    }
    var cfg = QUALITY[quality];

    var DOT_SIZE   = 6;   // base gl_PointSize (same as Harumi)
    var isMobile   = !/Macintosh|MacIntel|MacPPC|Mac68K/.test(navigator.userAgent)
                     && (window.innerHeight + getSafeArea('top') + getSafeArea('bottom')) <= 768;
    var DOT_GAP_BASE = isMobile ? 3 : 4;
    var dotGap = DOT_GAP_BASE * cfg.dotGapMultiplier;

    // ── Three.js scene setup ─────────────────────────────────────────────────
    var container = document.getElementById('particleContainer');
    var W = window.innerWidth, H = window.innerHeight;

    var scene    = new THREE.Scene();
    var camera   = new THREE.PerspectiveCamera(75, W / H, 1, 1000);
    camera.position.z = 280;

    var renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    renderer.setSize(W, H);
    renderer.setPixelRatio(window.devicePixelRatio);
    container.appendChild(renderer.domElement);

    window.addEventListener('resize', function () {
      W = window.innerWidth; H = window.innerHeight;
      camera.aspect = W / H;
      camera.updateProjectionMatrix();
      renderer.setSize(W, H);
    });

    // ── Dot texture (radial gradient) ────────────────────────────────────────
    function makeDotTexture(size) {
      var c = document.createElement('canvas');
      c.width = c.height = size * 4;
      var cx2 = c.getContext('2d');
      var r = size * 2;
      var grad = cx2.createRadialGradient(r, r, 0, r, r, r);
      grad.addColorStop(0,   'rgba(255,255,255,1)');
      grad.addColorStop(0.2, 'rgba(200,230,255,0.9)');
      grad.addColorStop(0.5, 'rgba(150,200,255,0.6)');
      grad.addColorStop(1,   'rgba(100,150,255,0)');
      cx2.fillStyle = grad;
      cx2.beginPath(); cx2.arc(r, r, r, 0, Math.PI * 2); cx2.fill();
      return new THREE.CanvasTexture(c);
    }

    var dotTex  = makeDotTexture(DOT_SIZE);
    var blurTex = makeDotTexture(DOT_SIZE * 2.5);

    // ── GLSL shaders (identical to Harumi) ───────────────────────────────────
    var r = textColor.r, g = textColor.g, b = textColor.b;
    var vertexShader = [
      'attribute float alpha;',
      'attribute float glow;',
      'varying float vAlpha;',
      'varying float vGlow;',
      'void main() {',
      '  vAlpha = alpha; vGlow = glow;',
      '  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);',
      '  gl_PointSize = ' + DOT_SIZE.toFixed(1) + ' * (300.0 / -mvPosition.z) * (1.0 + glow * 0.3);',
      '  gl_Position = projectionMatrix * mvPosition;',
      '}',
    ].join('\n');

    var fragmentShader = [
      'varying float vAlpha;',
      'varying float vGlow;',
      'uniform sampler2D pointTexture;',
      'uniform float uTime;',
      'void main() {',
      '  vec4 texColor = texture2D(pointTexture, gl_PointCoord);',
      '  float pulse = 0.5 + 0.5 * sin(uTime * 5.0);',
      '  float glow = smoothstep(0.5, 1.0, vAlpha) * (1.0 + pulse * 0.5 + vGlow * 2.0);',
      '  vec3 baseColor = mix(',
      '    vec3(' + r + '.0/255.0, ' + g + '.0/255.0, ' + b + '.0/255.0),',
      '    vec3(' + r + '.0*1.75/255.0, ' + g + '.0*1.333/255.0, ' + b + '.0*0.667/255.0),',
      '    smoothstep(1.0, 3.0, glow)',
      '  );',
      '  float alpha = vAlpha * texColor.a * (1.0 + glow * 2.0);',
      '  gl_FragColor = vec4(baseColor * (1.0 + glow * 0.8), alpha);',
      '}',
    ].join('\n');

    function makeMaterial(tex, pointSizeOverride) {
      var vs = pointSizeOverride
        ? vertexShader.replace(
            /gl_PointSize = [^;]+;/,
            'gl_PointSize = ' + pointSizeOverride.toFixed(1) + ' * (300.0 / -mvPosition.z) * (1.0 + glow * 0.3);'
          )
        : vertexShader;
      return new THREE.ShaderMaterial({
        uniforms: { pointTexture: { value: tex }, uTime: { value: 0 } },
        vertexShader: vs,
        fragmentShader: fragmentShader,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });
    }

    // ── Main points mesh ──────────────────────────────────────────────────────
    var mainGeo  = new THREE.BufferGeometry();
    var mainMat  = makeMaterial(dotTex);
    var mainMesh = new THREE.Points(mainGeo, mainMat);
    scene.add(mainMesh);

    // ── Blur overlay (medium/high quality) ───────────────────────────────────
    var blurGeo  = new THREE.BufferGeometry();
    var blurMat  = makeMaterial(blurTex, DOT_SIZE * 2.5);
    var blurMesh = new THREE.Points(blurGeo, blurMat);
    blurMesh.renderOrder = -1;
    blurMesh.visible = false;
    scene.add(blurMesh);

    // ── Flying dots mesh ──────────────────────────────────────────────────────
    var flyGeo  = new THREE.BufferGeometry();
    var flyMesh = new THREE.Points(flyGeo, mainMat);
    flyMesh.name = 'flyingDots';
    flyMesh.visible = false;
    scene.add(flyMesh);

    // ── Particle state ────────────────────────────────────────────────────────
    var particles  = [];   // { x,y, tx,ty, vx,vy, opacity, glowIntensity, exploded, isExtra }
    var flyingDots = [];   // same shape

    // Explosion state
    var exploding    = false;
    var explodeStart = 0;
    var explodeScale = 0;

    // ── Sync particles → GPU buffers ─────────────────────────────────────────
    function syncMain() {
      var n   = particles.length;
      var pos = new Float32Array(n * 3);
      var alp = new Float32Array(n);
      var glw = new Float32Array(n);
      for (var i = 0; i < n; i++) {
        var p = particles[i];
        pos[i * 3]     = p.x;
        pos[i * 3 + 1] = p.y;
        pos[i * 3 + 2] = 0;
        alp[i] = p.opacity;
        glw[i] = p.glowIntensity;
      }
      mainGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      mainGeo.setAttribute('alpha',    new THREE.BufferAttribute(alp, 1));
      mainGeo.setAttribute('glow',     new THREE.BufferAttribute(glw, 1));
      mainGeo.attributes.position.needsUpdate = true;
      mainGeo.attributes.alpha.needsUpdate    = true;
      mainGeo.attributes.glow.needsUpdate     = true;
    }

    function syncFlying() {
      var n   = flyingDots.length;
      if (n === 0) { flyMesh.visible = false; return; }
      var pos = new Float32Array(n * 3);
      var alp = new Float32Array(n);
      var glw = new Float32Array(n);
      for (var i = 0; i < n; i++) {
        var p = flyingDots[i];
        pos[i * 3]     = p.x;
        pos[i * 3 + 1] = p.y;
        pos[i * 3 + 2] = 0;
        alp[i] = p.opacity;
        glw[i] = p.glowIntensity;
      }
      flyGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      flyGeo.setAttribute('alpha',    new THREE.BufferAttribute(alp, 1));
      flyGeo.setAttribute('glow',     new THREE.BufferAttribute(glw, 1));
      flyGeo.attributes.position.needsUpdate = true;
      flyGeo.attributes.alpha.needsUpdate    = true;
      flyGeo.attributes.glow.needsUpdate     = true;
      flyMesh.visible = true;
    }

    function syncBlur() {
      if (!cfg.blurEnabled || !exploding) { blurMesh.visible = false; return; }
      var n   = particles.length;
      var pos = new Float32Array(n * 3);
      var alp = new Float32Array(n);
      var glw = new Float32Array(n);
      for (var i = 0; i < n; i++) {
        var p = particles[i];
        pos[i * 3]     = p.x;
        pos[i * 3 + 1] = p.y;
        pos[i * 3 + 2] = 0;
        alp[i] = p.opacity * 0.5;
        glw[i] = p.glowIntensity * 2.5;
      }
      blurGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      blurGeo.setAttribute('alpha',    new THREE.BufferAttribute(alp, 1));
      blurGeo.setAttribute('glow',     new THREE.BufferAttribute(glw, 1));
      blurGeo.attributes.position.needsUpdate = true;
      blurGeo.attributes.alpha.needsUpdate    = true;
      blurGeo.attributes.glow.needsUpdate     = true;
      blurMesh.visible = true;
    }

    // ── Sample dots from text via offscreen canvas ───────────────────────────
    function sampleText(text) {
      var cw = isMobile ? window.innerWidth  : 920;
      var ch = isMobile ? window.innerHeight : 350;

      var offscreen = document.createElement('canvas');
      offscreen.width  = cw;
      offscreen.height = ch;
      var octx = offscreen.getContext('2d');

      var fontSize = 150;
      octx.font = 'bold ' + fontSize + 'px system-ui, Arial, sans-serif';

      // Font-load guard (same as Harumi)
      if (document.fonts && document.fonts.check && !document.fonts.check(octx.font)) {
        return [];
      }

      // Word-wrap (supports explicit \n line breaks)
      var maxW  = cw * 0.9;
      var lines = [];
      var segments = text.split('\n');
      for (var s = 0; s < segments.length; s++) {
        var words = segments[s].split(' ');
        var segLines = [words[0]];
        for (var i = 1; i < words.length; i++) {
          var test = segLines[segLines.length - 1] + ' ' + words[i];
          if (octx.measureText(test).width < maxW) {
            segLines[segLines.length - 1] = test;
          } else {
            segLines.push(words[i]);
          }
        }
        lines = lines.concat(segLines);
      }
      while (lines.length * (fontSize + 10) > ch && fontSize > 30) {
        fontSize -= 5;
        octx.font = 'bold ' + fontSize + 'px system-ui, Arial, sans-serif';
      }

      octx.fillStyle    = '#cce6ff';
      octx.textAlign    = 'center';
      octx.textBaseline = 'middle';
      var lineH  = fontSize + 10;
      var startY = ch / 2 - (lines.length - 1) * lineH / 2;
      lines.forEach(function (line, idx) {
        octx.fillText(line, cw / 2, startY + idx * lineH);
      });

      var imageData = octx.getImageData(0, 0, cw, ch).data;
      var pts = [];
      var gap = Math.round(dotGap);

      for (var row = 0; row < ch; row += gap) {
        for (var col = 0; col < cw; col += gap) {
          if (imageData[4 * (row * cw + col) + 3] > 128) {
            pts.push({
              x: 0, y: 0,
              tx:  col - cw / 2,
              ty: -(row - ch / 2),
              vx: 0, vy: 0,
              opacity:       1,
              glowIntensity: 0,
              exploded:      false,
            });
          }
        }
      }
      return pts;
    }

    // ── Shuffle helper ───────────────────────────────────────────────────────
    function shuffle(arr) {
      for (var i = arr.length - 1; i > 0; i--) {
        var j = Math.floor(Math.random() * (i + 1));
        var tmp = arr[i]; arr[i] = arr[j]; arr[j] = tmp;
      }
      return arr;
    }

    // ── Transition particles to new text ────────────────────────────────────
    function loadText(text) {
      var extras = particles.filter(function (p) { return p.isExtra; });
      var newPts = sampleText(text);
      particles = newPts.concat(extras);
      syncMain();
    }

    function transitionTo(newText, prevText) {
      var newPts = sampleText(newText);
      if (!newPts.length) return;

      // Morph: new dots inherit shuffled positions from the current particles
      var old     = particles.slice();
      var indices = shuffle(Array.from({ length: newPts.length }, function (_, i) { return i; }));
      newPts.forEach(function (p, idx) {
        var src = old[indices[idx % old.length]];
        if (src) { p.x = src.x; p.y = src.y; }
      });

      // Second-to-last message: spawn independence dots
      if (messages.length > 0 && newText === messages[messages.length - 2]) {
        var indCount = Math.max(10, Math.floor(newPts.length * 0.08));
        flyingDots = [];
        for (var i = 0; i < indCount; i++) {
          var angle = Math.random() * Math.PI * 2;
          var dist  = 100 + Math.random() * 350;
          flyingDots.push({
            x: Math.cos(angle) * dist, y: Math.sin(angle) * dist,
            tx: 0, ty: 0,
            vx: 0.7 * (Math.random() - 0.5), vy: 0.7 * (Math.random() - 0.5),
            opacity: 0.3 + Math.random() * 0.7, glowIntensity: 1.5,
            started: true, gathering: false, isExtra: false, isIndependence: true,
          });
        }
      }

      particles = newPts;
      syncMain();
    }

    // ── Spawn flying dots along the outline of '1' ───────────────────────────
    function spawnOutlineFlying(count) {
      var cw = 800, ch = 300;
      var off = document.createElement('canvas');
      off.width = cw; off.height = ch;
      var octx = off.getContext('2d');
      octx.font = '900 150px "Roboto Mono", Arial Black, Arial, sans-serif';
      octx.fillStyle = '#fff';
      octx.textAlign = 'center';
      octx.textBaseline = 'middle';
      octx.fillText('1', cw / 2, ch / 2);
      octx.lineWidth = 12; octx.strokeStyle = '#fff';
      octx.strokeText('1', cw / 2, ch / 2);

      var data = octx.getImageData(0, 0, cw, ch).data;
      var edgePts = [];
      var step = Math.max(2, Math.floor(600 / count * 4));
      var neighbors = [[-step,0],[step,0],[0,-step],[0,step]];
      for (var row = step; row < ch - step; row += step) {
        for (var col = step; col < cw - step; col += step) {
          if (data[4 * (row * cw + col) + 3] > 8) {
            var isEdge = false;
            for (var n = 0; n < neighbors.length && !isEdge; n++) {
              var nr = row + neighbors[n][0], nc = col + neighbors[n][1];
              if (nr < 0 || nr >= ch || nc < 0 || nc >= cw) { isEdge = true; break; }
              if (data[4 * (nr * cw + nc) + 3] <= 8) isEdge = true;
            }
            if (isEdge) edgePts.push({ x: col - cw / 2, y: -(row - ch / 2) });
          }
        }
      }

      if (edgePts.length > count) {
        var step2 = Math.floor(edgePts.length / count);
        edgePts = edgePts.filter(function (_, i) { return i % step2 === 0; }).slice(0, count);
      }

      var waveCount = 5;
      for (var i = 0; i < edgePts.length; i++) {
        var pt   = edgePts[i];
        var wave = Math.floor(Math.random() * waveCount);
        var speed;
        if      (wave === 0) speed = 1.8 + Math.random() * 1.2;
        else if (wave === 1) speed = 1.2 + Math.random() * 1.8;
        else if (wave === 2) speed = 1.5 + Math.random() * 1.8;
        else if (wave === 3) speed = 1.5 + Math.random() * 1.5;
        else                 speed = 1.0 + Math.random() * 1.8;
        var angle  = Math.random() * Math.PI * 2;
        var jitter = 5;
        flyingDots.push({
          x:  pt.x + (Math.random() * jitter - jitter / 2),
          y:  pt.y + (Math.random() * jitter - jitter / 2),
          tx: 0, ty: 0,
          vx: Math.cos(angle) * speed * (0.5 + Math.random()) + 1.5 * (Math.random() - 0.5),
          vy: Math.sin(angle) * speed * (0.5 + Math.random()) + 1.5 * (Math.random() - 0.5),
          opacity: 0.7 + Math.random() * 0.3,
          glowIntensity: 0.5 + Math.random() * 2,
          started: true, gathering: false, isExtra: true, isIndependence: false,
        });
      }
    }

    // ── Explode all particles ────────────────────────────────────────────────
    function explode() {
      particles.forEach(function (p) {
        p.vx = (Math.random() - 0.5) * 1.2;
        p.vy = (Math.random() - 0.5) * 1.2;
        p.vz = (Math.random() - 0.5) * 1.2;
        p.exploded       = true;
        p.opacity        = 0.3 + Math.random() * 0.7;
        p.glowIntensity  = 2.5;
      });
      exploding    = true;
      explodeStart = performance.now();
    }

    // ── State machine ────────────────────────────────────────────────────────
    var COUNTDOWN  = ['3', '2', '1'];
    var phase      = 'countdown';
    var phaseIndex = 0;
    var timer      = null;
    var onComplete = null;

    function step() {
      if (timer) clearTimeout(timer);

      if (phase === 'countdown') {
        phaseIndex++;
        if (phaseIndex >= COUNTDOWN.length) {
          phase = 'message'; phaseIndex = 0;
          if (messages.length > 0) {
            // Spawn flying dots from the '1' outline before transitioning
            var maxFly = cfg.maxFlyingDots;
            var firstPts = sampleText(messages[0]);
            spawnOutlineFlying(Math.min(maxFly, Math.floor(firstPts.length * 0.12)));
            transitionTo(messages[0], COUNTDOWN[2]);
            // After short delay, direct flying dots toward first-message targets
            setTimeout(function () {
              var targets = sampleText(messages[0]);
              flyingDots.forEach(function (fd, i) {
                if (!fd.isIndependence && targets[i % targets.length]) {
                  fd.tx = targets[i % targets.length].tx;
                  fd.ty = targets[i % targets.length].ty;
                  fd.gathering = true;
                }
              });
            }, 1600);
            timer = setTimeout(step, 3800);
          } else {
            explode();
            setTimeout(function () { if (onComplete) onComplete(); }, 1200);
          }
        } else {
          transitionTo(COUNTDOWN[phaseIndex], COUNTDOWN[phaseIndex - 1]);
          if (phaseIndex === COUNTDOWN.length - 1) {
            var bgAudio = document.getElementById('bgAudio');
            if (bgAudio) bgAudio.play().catch(function () {});
          }
          var delay = (phaseIndex === COUNTDOWN.length - 1) ? 1500 : 1300;
          timer = setTimeout(step, delay);
        }

      } else if (phase === 'message') {
        phaseIndex++;
        if (phaseIndex >= messages.length) {
          explode();
          setTimeout(function () { if (onComplete) onComplete(); }, 1200);
        } else {
          transitionTo(messages[phaseIndex], messages[phaseIndex - 1]);
          timer = setTimeout(step, 3800);
        }
      }
    }

    // ── Render / animation loop ──────────────────────────────────────────────
    var lastT = 0;
    function animate(time) {
      requestAnimationFrame(animate);
      var s = Math.min(1.5, (time - lastT) / 16.67);
      lastT = time;
      if (s <= 0) s = 1;

      mainMat.uniforms.uTime.value = time * 0.001;
      blurMat.uniforms.uTime.value = time * 0.001;

      // Update main particles
      var posAttr = mainGeo.attributes.position;
      var alpAttr = mainGeo.attributes.alpha;
      var glwAttr = mainGeo.attributes.glow;
      if (!posAttr) { renderer.render(scene, camera); return; }

      for (var i = 0; i < particles.length; i++) {
        var p = particles[i];
        if (p.isExtra) {
          p.x += p.vx * s; p.y += p.vy * s;
          p.opacity       *= Math.pow(0.97,   s);
          p.glowIntensity *= Math.pow(0.96,   s);
          if (p.opacity < 0.05) p.opacity = 0;
        } else if (p.exploded) {
          p.x += p.vx * s; p.y += p.vy * s;
        } else {
          var ease = 0.05 * s;
          p.x += (p.tx - p.x) * ease;
          p.y += (p.ty - p.y) * ease;
        }
        p.glowIntensity *= Math.pow(0.95, s);

        posAttr.setXYZ(i, p.x, p.y, 0);
        alpAttr.setX(i, Math.min(2, p.opacity + p.glowIntensity * 0.5));
        glwAttr.setX(i, p.glowIntensity);
      }
      posAttr.needsUpdate = true;
      alpAttr.needsUpdate = true;
      glwAttr.needsUpdate = true;

      // Update flying dots
      if (flyingDots.length > 0) {
        if (flyingDots.length > cfg.maxFlyingDots) {
          flyingDots.sort(function (a, b) { return b.opacity - a.opacity; });
          flyingDots.length = cfg.maxFlyingDots;
        }
        var toPromote = [];
        flyingDots = flyingDots.filter(function (fd) {
          if (fd.gathering) {
            var dx = fd.tx - fd.x, dy = fd.ty - fd.y;
            var dist = Math.sqrt(dx * dx + dy * dy);
            var ease = Math.max(0.1, Math.min(0.2, 20 / (dist + 20))) * s;
            fd.x += dx * ease; fd.y += dy * ease;
            if (Math.abs(fd.x - fd.tx) < 2 && Math.abs(fd.y - fd.ty) < 2) {
              toPromote.push({ x: fd.tx, y: fd.ty, tx: fd.tx, ty: fd.ty,
                               vx: 0, vy: 0, opacity: 1, glowIntensity: -0.6,
                               exploded: false, isExtra: false });
              return false;
            }
          } else {
            fd.x += fd.vx * s; fd.y += fd.vy * s;
            fd.vx += (Math.random() - 0.5) * 0.03 * s;
            fd.vy += (Math.random() - 0.5) * 0.03 * s;
            var spd = Math.sqrt(fd.vx * fd.vx + fd.vy * fd.vy);
            if (spd > 2.5) { fd.vx = fd.vx / spd * 2.5; fd.vy = fd.vy / spd * 2.5; }
            var decay = quality === 'low' ? 0.95 : 0.998;
            fd.opacity *= Math.pow(decay, s);
            if (fd.opacity < 0.01) return false;
          }
          fd.glowIntensity *= Math.pow(0.9995, s);
          if (Math.abs(fd.x) > 900 || Math.abs(fd.y) > 700) return false;
          return true;
        });
        if (toPromote.length) {
          particles = particles.concat(toPromote);
          syncMain();
        }
        syncFlying();
      } else {
        flyMesh.visible = false;
      }

      // Blur layer
      syncBlur();

      renderer.render(scene, camera);
    }

    // ── Boot ─────────────────────────────────────────────────────────────────
    loadText(COUNTDOWN[0]);
    requestAnimationFrame(animate);

    // Wait for user tap to start (unlocks audio policy)
    var startOverlay = document.getElementById('startOverlay');
    var startBtn     = document.getElementById('startBtn');
    function startCountdown() {
      startOverlay.style.display = 'none';
      // Unlock audio: play then immediately pause so timed play() works later
      var bgAudio = document.getElementById('bgAudio');
      if (bgAudio) {
        bgAudio.play().then(function () { bgAudio.pause(); bgAudio.currentTime = 0; }).catch(function () {});
      }
      timer = setTimeout(step, 1300);
    }
    startBtn.addEventListener('click', startCountdown);
    startBtn.addEventListener('touchstart', function (e) { e.preventDefault(); startCountdown(); });

    window._setCountdownComplete = function (cb) { onComplete = cb; };
  })();


  // ═══════════════════════════════════════════════════════════════════════════
  // 3. HEART + FINAL TEXT
  // ═══════════════════════════════════════════════════════════════════════════
  (function initHeart() {
    var canvas = document.getElementById('heartCanvas');
    var ctx = canvas.getContext('2d');
    var W, H;
    var heartParticles = [];
    var sparkles = [];
    var active = false;
    var rafId = null;

    function resize() {
      W = window.innerWidth;
      H = window.innerHeight;
      canvas.width = W;
      canvas.height = H;
    }
    resize();
    window.addEventListener('resize', resize);

    // Parametric heart point
    function heartPt(t) {
      var scale = Math.max(10, Math.min(Math.min(W, H) / 40, 25));
      var nx = 16 * Math.pow(Math.sin(t), 3);
      var ny = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t);
      return {
        x: W / 2 + nx * scale,
        y: H / 2 - ny * scale - 0.1 * H,
      };
    }

    // Spawn particles radiating outward from heart boundary
    function spawnParticles() {
      var isMobile = H < 768;
      var count = isMobile ? 4 : 8;
      var pushDist = isMobile ? 35 : 40;

      for (var i = 0; i < count; i++) {
        var t = Math.random() * Math.PI * 2;
        var pt = heartPt(t);
        var dx = W / 2 - pt.x;
        var dy = H / 2 - pt.y;
        var d = Math.sqrt(dx * dx + dy * dy);
        var sx = pt.x + (dx / d) * pushDist;
        var sy = pt.y + (dy / d) * pushDist;
        heartParticles.push({
          x: sx, y: sy,
          vx: (pt.x - sx) * 0.01,
          vy: (pt.y - sy) * 0.01,
          alpha: 1,
          scale: 0.05 + Math.random() * 0.12,
          reachedEdge: false,
        });
      }
    }

    // Draw a mini heart shape
    function drawMiniHeart(cx, cy, scale, alpha) {
      ctx.save();
      ctx.translate(cx, cy);
      ctx.scale(scale, scale);
      ctx.beginPath();
      ctx.moveTo(0, -30);
      ctx.bezierCurveTo(25, -60, 60, -30, 0, 30);
      ctx.bezierCurveTo(-60, -30, -25, -60, 0, -30);
      ctx.fillStyle = 'rgba(' + heartColor.r + ',' + heartColor.g + ',' + heartColor.b + ',' + alpha + ')';
      ctx.fill();
      ctx.restore();
    }

    // Draw center text inside heart
    function drawText() {
      if (!finalText) return;

      // Enforce 11-word limit
      var rawWords = finalText.replace(/\n/g, ' ').trim().split(/\s+/);
      if (rawWords.length > 11) rawWords = rawWords.slice(0, 11);

      var lines;
      if (finalText.indexOf('\n') !== -1) {
        // Manual mode: honour explicit \n line breaks
        lines = finalText.split('\n').map(function (s) { return s.trim(); }).filter(Boolean);
      } else {
        // Auto mode: distribute words evenly
        // ≤4 words → 1 line, 5-8 → 2 lines, 9-11 → 4 lines
        var wc = rawWords.length;
        var numLines = wc <= 4 ? 1 : wc <= 8 ? 2 : 4;
        // Balanced split: first (wc % numLines) lines get one extra word
        var base = Math.floor(wc / numLines);
        var extra = wc % numLines;
        lines = [];
        var idx = 0;
        for (var l = 0; l < numLines; l++) {
          var count = base + (l < extra ? 1 : 0);
          if (count > 0) lines.push(rawWords.slice(idx, idx + count).join(' '));
          idx += count;
        }
      }

      // Express all sizing in vh/vw (H and W are the canvas dimensions)
      var vh = H / 100;
      var maxWidth   = 72 * vh;   // heart width is ~80vh; allow 72vh for text
      var offsetY    = 10 * vh;   // vertical offset of heart centre

      // Max font: height budget = 28vh total, split across lines
      var maxFontByHeight = (28 * vh) / (lines.length * 1.3);
      var fontSize = Math.min(9 * vh, maxFontByHeight);
      if (fontSize < 10) fontSize = 10;

      // Shrink only if a line overflows horizontally
      ctx.font = 'bold ' + fontSize + "px 'Mali', sans-serif";
      while (fontSize > 10 && lines.some(function (l) { return ctx.measureText(l).width > maxWidth; })) {
        fontSize -= 1;
        ctx.font = 'bold ' + fontSize + "px 'Mali', sans-serif";
      }
      ctx.font = 'bold ' + fontSize + "px 'Mali', sans-serif";
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      var lineH = fontSize * 1.2;
      var centerY = H / 2 - offsetY;
      lines.forEach(function (line, i) {
        ctx.fillStyle = 'white';
        ctx.fillText(line, W / 2, centerY + (i - (lines.length - 1) / 2) * lineH);
      });
    }

    // ── Render loop ───────────────────────────────────────────────────────────
    function render() {
      rafId = requestAnimationFrame(render);
      ctx.clearRect(0, 0, W, H);

      // No outline — heart shape is formed entirely by the flying mini hearts

      // Spawn new particles
      spawnParticles();

      // Update & draw particles
      heartParticles.forEach(function (p) {
        if (p.reachedEdge) {
          p.alpha -= 0.01;
        } else {
          p.x += p.vx;
          p.y += p.vy;
          // Check if particle hit heart boundary
          for (var t2 = 0; t2 <= Math.PI * 2; t2 += 0.05) {
            var hp = heartPt(t2);
            var dx = p.x - hp.x, dy = p.y - hp.y;
            if (dx * dx + dy * dy < 64) {
              p.reachedEdge = true;
              p.vx = 0;
              p.vy = 0;
              break;
            }
          }
        }
      });
      heartParticles = heartParticles.filter(function (p) { return p.alpha > 0; });

      heartParticles.forEach(function (p) {
        drawMiniHeart(p.x, p.y, p.scale, p.alpha);
      });

      updateSparkles();
      drawText();
    }

    function updateSparkles() {
      // Spawn 1-2 new sparkles per frame
      var n = Math.random() < 0.4 ? 2 : 1;
      for (var i = 0; i < n; i++) {
        sparkles.push({
          x: Math.random() * W,
          y: Math.random() * H,
          r: 1 + Math.random() * 2.5,
          vy: -(0.1 + Math.random() * 0.25),
          alpha: 0,
          maxAlpha: 0.4 + Math.random() * 0.5,
          growing: true,
          speed: 0.018 + Math.random() * 0.022,
        });
      }
      sparkles.forEach(function (s) {
        if (s.growing) {
          s.alpha += s.speed;
          if (s.alpha >= s.maxAlpha) { s.alpha = s.maxAlpha; s.growing = false; }
        } else {
          s.alpha -= s.speed;
        }
        s.y += s.vy;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255,255,255,' + s.alpha.toFixed(2) + ')';
        ctx.fill();
      });
      sparkles = sparkles.filter(function (s) { return s.alpha > 0; });
    }

    // Activated when countdown finishes
    window._setCountdownComplete(function () {
      var particleContainer = document.getElementById('particleContainer');
      // Fade out particle layer
      particleContainer.style.transition = 'opacity 0.8s';
      particleContainer.style.opacity = '0';
      setTimeout(function () { particleContainer.style.display = 'none'; }, 800);

      canvas.style.display = 'block';
      active = true;
      render();
    });
  })();

})();
