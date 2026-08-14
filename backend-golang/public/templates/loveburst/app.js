(function () {
  if (window.__LOVEBURST_INITIALIZED__) return;
  window.__LOVEBURST_INITIALIZED__ = true;

  function whenDomReady(cb) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', function () { setTimeout(cb, 0); });
    } else {
      setTimeout(cb, 0);
    }
  }

  function readSettings() {
    var injected = (window.dataFromSubdomain && window.dataFromSubdomain.data) || null;
    var demo = window.__LOVEBURST_DEMO__ || {};
    var src = injected || demo;
    var messages = [];
    if (Array.isArray(src.messages)) {
      messages = src.messages.map(function (m) { return String(m || '').trim(); }).filter(Boolean);
    }
    var images = [];
    if (Array.isArray(src.imageUrls) && src.imageUrls.length) {
      images = src.imageUrls.filter(Boolean);
    } else if (!injected && demo.imageUrls) {
      images = demo.imageUrls.slice();
    }
    return {
      isOrder: !!injected,
      titleMessage: src.titleMessage || demo.titleMessage || 'Gửi bé iu 💖',
      messages: messages.length ? messages : (demo.messages || []),
      content: src.content || src.popupMessage || demo.content || '',
      imageUrls: images,
      heartColor: src.heartColor || '',
      musicUrl: src.musicUrl || src.customMusicUrl || ''
    };
  }

  function galleryImageList(settings) {
    if (settings.imageUrls.length) return settings.imageUrls;
    return (window.__LOVEBURST_DEMO__ && window.__LOVEBURST_DEMO__.imageUrls) || [];
  }

  function galleryTileSize() {
    var mobile = window.innerWidth < 768;
    return Math.round((mobile ? 220 : 200) * Math.min(window.devicePixelRatio || 1, 3));
  }

  function preloadGalleryImages(settings) {
    var images = galleryImageList(settings);
    if (!images.length) return Promise.resolve({ images: [], map: {} });
    var unique = [];
    images.forEach(function (url) {
      if (unique.indexOf(url) === -1) unique.push(url);
    });
    return Promise.all(unique.map(function (url) { return squareImage(url, galleryTileSize()); })).then(function (squared) {
      var map = {};
      unique.forEach(function (url, i) { map[url] = squared[i]; });
      return { images: images, map: map };
    });
  }

  function bindBackgroundMusic(settings) {
    var audio = document.getElementById('bg-audio');
    if (!audio || !settings.musicUrl) return;
    audio.src = settings.musicUrl;
    audio.loop = true;
    audio.preload = 'auto';
    audio.load();
  }

  function hideLoading() {
    var bar = document.getElementById('loading-progress');
    var pct = document.getElementById('loading-percent');
    if (bar) bar.style.width = '100%';
    if (pct) pct.textContent = '100%';
    var overlay = document.getElementById('loading-overlay');
    if (!overlay) return;
    setTimeout(function () {
      overlay.classList.add('fade-out');
      setTimeout(function () { overlay.classList.add('hidden'); }, 800);
    }, 400);
  }

  function simulateLoading() {
    var bar = document.getElementById('loading-progress');
    var pct = document.getElementById('loading-percent');
    var value = 0;
    var timer = setInterval(function () {
      value = Math.min(90, value + Math.random() * 18 + 8);
      if (bar) bar.style.width = value + '%';
      if (pct) pct.textContent = Math.round(value) + '%';
      if (value >= 90) {
        clearInterval(timer);
        hideLoading();
      }
    }, 180);
  }

  function createShootingStars() {
    var host = document.getElementById('shooting-stars');
    if (!host) return;
    for (var i = 0; i < 20; i++) {
      var star = document.createElement('div');
      star.className = 'shooting-star';
      star.style.left = (Math.random() * 0.8 * window.innerWidth + 0.2 * window.innerWidth) + 'px';
      star.style.top = (Math.random() * 0.3 * window.innerHeight) + 'px';
      star.style.animationDelay = (Math.random() * 10) + 's';
      var size = 3 + Math.random() * 3;
      star.style.width = size + 'px';
      star.style.height = size + 'px';
      host.appendChild(star);
    }
  }

  function setupStartClick() {
    var wrap = document.getElementById('start-wrap');
    if (!wrap) return;
    var triggered = false;

    function show() { wrap.classList.add('visible'); }
    var overlay = document.getElementById('loading-overlay');
    if (!overlay || overlay.classList.contains('hidden')) {
      setTimeout(show, 200);
    } else {
      var obs = new MutationObserver(function () {
        if (overlay.classList.contains('hidden')) {
          setTimeout(show, 200);
          obs.disconnect();
        }
      });
      obs.observe(overlay, { attributes: true, attributeFilter: ['class'] });
    }

    function activate(e) {
      if (triggered) return;
      e.preventDefault();
      triggered = true;
      wrap.classList.add('done');
      var audio = document.getElementById('bg-audio');
      if (audio && audio.src) audio.play().catch(function () {});
      setTimeout(function () { wrap.style.display = 'none'; }, 600);
      window.dispatchEvent(new Event('__textStart'));
    }

    wrap.addEventListener('click', activate);
    wrap.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') activate(e);
    });
  }

  function squareImage(url, size) {
    return new Promise(function (resolve) {
      var img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = function () {
        try {
          var canvas = document.createElement('canvas');
          canvas.width = size;
          canvas.height = size;
          var ctx = canvas.getContext('2d');
          var scale = Math.max(size / img.width, size / img.height);
          var dw = img.width * scale;
          var dh = img.height * scale;
          ctx.drawImage(img, (size - dw) / 2, (size - dh) / 2, dw, dh);
          resolve(canvas.toDataURL('image/jpeg', 0.92));
        } catch (e) {
          resolve(url);
        }
      };
      img.onerror = function () { resolve(url); };
      img.src = url;
    });
  }

  function initGallery(settings, assets) {
    if (typeof THREE === 'undefined' || typeof TWEEN === 'undefined') return;
    var container = document.getElementById('sphere-container');
    var ready = (assets && assets.map) ? Promise.resolve(assets) : preloadGalleryImages(settings);

    ready.then(function (prepared) {
      var images = prepared.images;
      var map = prepared.map;
      if (!images.length) return;

    var ua = navigator.userAgent || '';
    var inApp = /Zalo|FBAN|FBAV|Instagram|Line|MicroMessenger/i.test(ua);
    var mobile = window.innerWidth < 768;
    var rings = inApp ? (mobile ? 6 : 7) : (mobile ? 8 : 12);
    var layout = [];
    for (var r = 0; r < rings; r++) {
      var phi = Math.PI * (r + 0.5) / rings;
      var count = Math.max(1, Math.round(2 * rings * Math.sin(phi)));
      for (var c = 0; c < count; c++) {
        layout.push({ phi: phi, theta: 2 * Math.PI * c / count });
      }
    }

      var camera = new THREE.PerspectiveCamera(40, window.innerWidth / window.innerHeight, 1, 10000);
      camera.position.z = 3000;
      var scene = new THREE.Scene();
      var objects = [];
      var targets = { sphere: [], sphereIn: [], rising: [] };

      for (var i = 0; i < layout.length; i++) {
        var el = document.createElement('div');
        el.className = 'element';
        var img = document.createElement('img');
        img.src = map[images[i % images.length]] || images[i % images.length];
        el.appendChild(img);
        var obj = new THREE.CSS3DObject(el);
        obj.position.set(Math.random() * 4000 - 2000, Math.random() * 4000 - 2000, Math.random() * 4000 - 2000);
        scene.add(obj);
        objects.push(obj);
      }

      var vector = new THREE.Vector3();
      var spherical = new THREE.Spherical();
      var radius = mobile ? 540 : 800;
      for (i = 0; i < objects.length; i++) {
        var outer = new THREE.Object3D();
        spherical.set(radius, layout[i].phi, layout[i].theta);
        outer.position.setFromSpherical(spherical);
        vector.copy(outer.position).multiplyScalar(2);
        outer.lookAt(vector);
        targets.sphere.push(outer);

        var inner = new THREE.Object3D();
        spherical.set(radius, layout[i].phi, layout[i].theta);
        inner.position.setFromSpherical(spherical);
        inner.lookAt(new THREE.Vector3(0, 0, 0));
        targets.sphereIn.push(inner);

        var rise = new THREE.Object3D();
        if (i < 15) {
          rise.position.set((i % 3 - 1) * 280, Math.floor(i / 3) * 280 - 1500, 0);
        } else {
          rise.position.set(0, -99999, 0);
        }
        targets.rising.push(rise);
      }

      var renderer = new THREE.CSS3DRenderer();
      renderer.setSize(window.innerWidth, window.innerHeight);
      renderer.domElement.style.position = 'absolute';
      renderer.domElement.style.background = 'transparent';
      container.style.background = 'transparent';
      container.appendChild(renderer.domElement);
      var controls = new THREE.TrackballControls(camera, renderer.domElement);
      controls.rotateSpeed = 0.5;
      controls.minDistance = 500;
      controls.maxDistance = 6000;
      controls.addEventListener('change', function () { renderer.render(scene, camera); });

      container.style.display = 'block';
      requestAnimationFrame(function () { container.classList.add('active'); });

      function transform(list, duration) {
        TWEEN.removeAll();
        for (var i = 0; i < objects.length; i++) {
          new TWEEN.Tween(objects[i].position)
            .to({ x: list[i].position.x, y: list[i].position.y, z: list[i].position.z }, Math.random() * duration + duration)
            .easing(TWEEN.Easing.Exponential.InOut)
            .start();
          new TWEEN.Tween(objects[i].rotation)
            .to({ x: list[i].rotation.x, y: list[i].rotation.y, z: list[i].rotation.z }, Math.random() * duration + duration)
            .easing(TWEEN.Easing.Exponential.InOut)
            .start();
        }
        new TWEEN.Tween({}).to({}, duration * 2).onUpdate(function () {
          renderer.render(scene, camera);
        }).start();
      }

      var clickState = 0;
      var busy = false;
      var rising = false;

      function showEnvelope() {
        var overlay = document.getElementById('envelope-overlay');
        var anim = document.getElementById('envelope-anim');
        overlay.classList.add('show');
        anim.classList.remove('open');
        anim.querySelector('.env-flap').classList.remove('open');
        anim.classList.add('show');
      }
      function hideEnvelope() {
        document.getElementById('envelope-overlay').classList.remove('show');
        document.getElementById('envelope-anim').classList.remove('show', 'open');
      }

      window.resetToSphere = function () {
        hideEnvelope();
        rising = false;
        transform(targets.sphere, 1500);
        new TWEEN.Tween(camera.position)
          .to({ x: 0, y: 0, z: 3000 }, 2000)
          .easing(TWEEN.Easing.Cubic.InOut)
          .onUpdate(function () { renderer.render(scene, camera); })
          .onComplete(function () {
            clickState = 0;
            busy = false;
            controls.minDistance = 500;
          })
          .start();
      };

      transform(targets.sphere, 2000);
      renderer.domElement.addEventListener('click', function () {
        if (busy) return;
        busy = true;
        if (clickState === 0) {
          transform(targets.sphereIn, 1500);
          new TWEEN.Tween(camera.position)
            .to({ x: 0, y: 0, z: mobile ? 180 : 0 }, 2000)
            .easing(TWEEN.Easing.Cubic.InOut)
            .onUpdate(function () { renderer.render(scene, camera); })
            .onComplete(function () {
              clickState = 1;
              busy = false;
              controls.minDistance = 0;
            })
            .start();
        } else if (clickState === 1) {
          transform(targets.rising, 2000);
          new TWEEN.Tween(camera.position)
            .to({ x: 0, y: 0, z: 1500 }, 2000)
            .easing(TWEEN.Easing.Cubic.InOut)
            .onUpdate(function () { renderer.render(scene, camera); })
            .onComplete(function () {
              clickState = 2;
              busy = false;
              controls.minDistance = 200;
              rising = true;
              showEnvelope();
            })
            .start();
        } else {
          hideEnvelope();
          rising = false;
          transform(targets.sphere, 1500);
          new TWEEN.Tween(camera.position)
            .to({ x: 0, y: 0, z: 3000 }, 2000)
            .easing(TWEEN.Easing.Cubic.InOut)
            .onUpdate(function () { renderer.render(scene, camera); })
            .onComplete(function () {
              clickState = 0;
              busy = false;
              controls.minDistance = 500;
            })
            .start();
        }
      });

      (function loop() {
        requestAnimationFrame(loop);
        if (rising) {
          for (var i = 0; i < 15 && i < objects.length; i++) objects[i].position.y += 0.8;
          scene.rotation.y = 0;
        } else {
          scene.rotation.y += 0.002;
        }
        TWEEN.update();
        controls.update();
        renderer.render(scene, camera);
      })();

      window.addEventListener('resize', function () {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
      });
    });
  }

  function setupEnvelope(settings) {
    var overlay = document.getElementById('envelope-overlay');
    var anim = document.getElementById('envelope-anim');
    var flap = anim.querySelector('.env-flap');
    var popup = document.getElementById('love-popup');
    var closeBtn = document.getElementById('popup-close-btn');
    var title = document.getElementById('popup-title');
    var image = document.getElementById('popup-image');
    var typewriter = document.getElementById('typewriter-text');
    var typeTimer = null;
    title.textContent = settings.titleMessage;
    if (settings.imageUrls[0]) {
      image.src = settings.imageUrls[0];
    } else {
      var box = image.closest('.popup-image-container');
      if (box) box.style.display = 'none';
    }

    function closePopup() {
      if (typeTimer) { clearTimeout(typeTimer); typeTimer = null; }
      popup.classList.remove('active');
      if (window.resetToSphere) window.resetToSphere();
    }

    anim.addEventListener('click', function (e) {
      e.stopPropagation();
      if (anim.classList.contains('open')) return;
      anim.classList.add('open');
      flap.classList.add('open');
      setTimeout(function () {
        overlay.classList.remove('show');
        anim.classList.remove('show', 'open');
        flap.classList.remove('open');
        var msg = String(settings.content || '').replace(/\\r\\n|\\n|\r\n/g, '\n');
        typewriter.textContent = '';
        popup.classList.add('active');
        var i = 0;
        var chars = Array.from(msg);
        function tick() {
          if (i < chars.length) {
            typewriter.textContent += chars[i];
            i += 1;
            typeTimer = setTimeout(tick, 30);
          }
        }
        typeTimer = setTimeout(tick, 500);
      }, 600);
    });
    closeBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      closePopup();
    });
    popup.addEventListener('click', function (e) {
      if (e.target === popup) closePopup();
    });
  }

  var bootSettings = readSettings();
  window.loveburstData = bootSettings;
  var galleryPreloadPromise = preloadGalleryImages(bootSettings);
  bindBackgroundMusic(bootSettings);

  whenDomReady(function () {
    var settings = bootSettings;
    createShootingStars();
    simulateLoading();
    setupStartClick();
    setupEnvelope(settings);
    var galleryReady = false;
    window.addEventListener('textMessagesComplete', function () {
      if (galleryReady) return;
      galleryReady = true;
      galleryPreloadPromise.then(function (assets) {
        initGallery(settings, assets);
      });
    });
  });
})();
