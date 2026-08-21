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

  function setLoadProgress(value) {
    var overlay = document.getElementById('loading-overlay');
    var pct = document.getElementById('loading-percent');
    if (overlay) overlay.style.setProperty('--load', String(value));
    if (pct) pct.textContent = Math.round(value) + '%';
  }

  function hideLoading() {
    setLoadProgress(100);
    var overlay = document.getElementById('loading-overlay');
    if (!overlay) return;
    setTimeout(function () {
      overlay.classList.add('fade-out');
      setTimeout(function () { overlay.classList.add('hidden'); }, 800);
    }, 400);
  }

  function simulateLoading() {
    var value = 0;
    var timer = setInterval(function () {
      value = Math.min(90, value + Math.random() * 18 + 8);
      setLoadProgress(value);
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

    function activate() {
      if (triggered) return;
      triggered = true;
      wrap.classList.add('done');
      if (typeof window.__inxkPlayBackgroundMusic === 'function') {
        window.__inxkPlayBackgroundMusic();
      } else {
        var audio = document.getElementById('bg-audio');
        if (audio && audio.src) audio.play().catch(function () {});
      }
      setTimeout(function () { wrap.style.display = 'none'; }, 600);
      window.dispatchEvent(new Event('__textStart'));
    }

    // Capture fires before the shared voice player starts audio on bubble
    // touchstart. audio.play() on some phones aborts remaining listeners,
    // which left Love Burst waiting for a second tap.
    wrap.addEventListener('pointerdown', activate, true);
    wrap.addEventListener('touchstart', activate, { capture: true, passive: true });
    wrap.addEventListener('click', activate);
    wrap.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') activate();
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
      renderer.domElement.style.touchAction = 'none';
      var controls = new THREE.TrackballControls(camera, renderer.domElement);
      controls.rotateSpeed = 0.5;
      controls.minDistance = 500;
      controls.maxDistance = 6000;
      controls.noRotate = true;
      controls.noPan = true;
      controls.noZoom = true;
      controls.enabled = false;
      controls.addEventListener('change', function () { renderer.render(scene, camera); });

      container.style.display = 'block';
      requestAnimationFrame(function () {
        container.classList.add('active');
        controls.handleResize();
      });

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

      function onSphereTap() {
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
      }

      var pointerDown = { x: 0, y: 0 };
      var dragDistance = 0;
      var pointerActive = false;
      renderer.domElement.addEventListener('pointerdown', function (e) {
        if (e.button && e.button !== 0) return;
        pointerActive = true;
        pointerDown.x = e.clientX;
        pointerDown.y = e.clientY;
        dragDistance = 0;
      });
      renderer.domElement.addEventListener('pointermove', function (e) {
        if (!pointerActive) return;
        var dx = e.clientX - pointerDown.x;
        var dy = e.clientY - pointerDown.y;
        dragDistance = Math.max(dragDistance, Math.sqrt(dx * dx + dy * dy));
      });
      renderer.domElement.addEventListener('pointerup', function () {
        if (!pointerActive) return;
        pointerActive = false;
        if (dragDistance <= 12) onSphereTap();
      });
      renderer.domElement.addEventListener('pointercancel', function () { pointerActive = false; });

      var autoRotateSpeed = 0.004;
      (function loop() {
        requestAnimationFrame(loop);
        if (rising) {
          for (var i = 0; i < 15 && i < objects.length; i++) objects[i].position.y += 0.8;
          scene.rotation.y = 0;
        } else {
          scene.rotation.y += autoRotateSpeed;
        }
        TWEEN.update();
        controls.update();
        renderer.render(scene, camera);
      })();

      window.addEventListener('resize', function () {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
        controls.handleResize();
      });
    });
  }

  function setupLetterSlider(urls) {
    var box = document.getElementById('popup-image-container');
    var track = document.getElementById('popup-slider-track');
    var dotsHost = document.getElementById('popup-slider-dots');
    var prev = document.getElementById('popup-slider-prev');
    var next = document.getElementById('popup-slider-next');
    var list = (urls || []).filter(Boolean);
    var index = 0;
    var timer = null;
    var startX = 0;
    var dragging = false;

    if (!box || !track) return;
    track.innerHTML = '';
    if (dotsHost) dotsHost.innerHTML = '';

    if (!list.length) {
      box.style.display = 'none';
      window.startLetterSlider = function () {};
      window.stopLetterSlider = function () {};
      return;
    }
    box.style.display = '';

    list.forEach(function (src, i) {
      var img = document.createElement('img');
      img.className = 'popup-image';
      img.src = src;
      img.alt = 'Ảnh ' + (i + 1);
      img.draggable = false;
      track.appendChild(img);
      if (dotsHost && list.length > 1) {
        var dot = document.createElement('button');
        dot.type = 'button';
        dot.className = 'popup-slider-dot' + (i === 0 ? ' active' : '');
        dot.setAttribute('aria-label', 'Ảnh ' + (i + 1));
        dot.addEventListener('click', function (e) {
          e.stopPropagation();
          goTo(i, true);
        });
        dotsHost.appendChild(dot);
      }
    });

    function render() {
      track.style.transform = 'translateX(-' + (index * 100) + '%)';
      if (dotsHost) {
        var dots = dotsHost.querySelectorAll('.popup-slider-dot');
        for (var i = 0; i < dots.length; i++) {
          dots[i].classList.toggle('active', i === index);
        }
      }
    }

    function goTo(nextIndex, user) {
      if (!list.length) return;
      index = (nextIndex + list.length) % list.length;
      render();
      if (user) restart();
    }

    function stop() {
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
    }

    function restart() {
      stop();
      if (list.length < 2) return;
      timer = setInterval(function () { goTo(index + 1, false); }, 3500);
    }

    if (prev && next) {
      var showNav = list.length > 1;
      prev.classList.toggle('is-hidden', !showNav);
      next.classList.toggle('is-hidden', !showNav);
      prev.disabled = !showNav;
      next.disabled = !showNav;
      prev.onclick = function (e) { e.stopPropagation(); goTo(index - 1, true); };
      next.onclick = function (e) { e.stopPropagation(); goTo(index + 1, true); };
    }
    if (dotsHost) dotsHost.classList.toggle('is-hidden', list.length < 2);

    var slider = document.getElementById('popup-slider');
    if (slider && list.length > 1) {
      slider.addEventListener('pointerdown', function (e) {
        if (e.target.closest && e.target.closest('.popup-slider-nav')) return;
        dragging = true;
        startX = e.clientX;
      });
      slider.addEventListener('pointerup', function (e) {
        if (!dragging) return;
        dragging = false;
        var dx = e.clientX - startX;
        if (dx > 40) goTo(index - 1, true);
        else if (dx < -40) goTo(index + 1, true);
      });
      slider.addEventListener('pointercancel', function () { dragging = false; });
    }

    window.startLetterSlider = restart;
    window.stopLetterSlider = stop;
    render();
  }

  function setupEnvelope(settings) {
    var overlay = document.getElementById('envelope-overlay');
    var anim = document.getElementById('envelope-anim');
    var flap = anim.querySelector('.env-flap');
    var popup = document.getElementById('love-popup');
    var closeBtn = document.getElementById('popup-close-btn');
    var title = document.getElementById('popup-title');
    var typewriter = document.getElementById('typewriter-text');
    var typeTimer = null;
    title.textContent = settings.titleMessage;
    setupLetterSlider(settings.imageUrls || []);

    function closePopup() {
      if (typeTimer) { clearTimeout(typeTimer); typeTimer = null; }
      if (window.stopLetterSlider) window.stopLetterSlider();
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
        if (window.startLetterSlider) window.startLetterSlider();
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
