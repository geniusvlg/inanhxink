/**
 * Bon Voyage — a boarding pass, a flight around a sphere of memories, a letter.
 *
 * Pressing the pass hands the screen over to a 3D globe built from the order's
 * photos. The plane circles it while the sphere turns to bring each memory to
 * the front in turn, then the page lands on the arrival facts and the sealed
 * letter.
 *
 * The photo sphere is rendered with three.js's CSS3DRenderer — the same
 * technique the Special Gift template uses for its memory globe — so tiles
 * sit on a real perspective camera (proper foreshortening, no DIY CSS
 * transform math) instead of the old hand-rolled flat CSS 3D sphere. Route
 * facts (distance, flight time, time difference, live clocks) are derived
 * from the two cities rather than asked for in the order form. Clocks go
 * through the browser's IANA timezone data so daylight saving stays correct.
 */
(function () {
  'use strict';

  var injected = (window.dataFromSubdomain && window.dataFromSubdomain.data) || null;

  var DEMO = {
    farewellFriendName: 'Minh Anh',
    farewellFrom: 'Hà Nội',
    farewellDestination: 'australia',
    farewellDepartureDate: '2026-09-15',
    farewellMessage:
      'Cậu đi nhé. Nhớ ăn uống đủ bữa, nhớ mặc ấm, và nhớ gọi về khi thấy nhớ nhà.\n\n' +
      'Bọn tớ sẽ luôn ở đây — cùng một múi giờ cũ, cùng một chỗ ngồi quen, đợi ngày cậu quay lại kể chuyện.',
    farewellSender: 'Hội bạn thân luôn nhớ cậu',
    farewellStages: [],
    farewellCaptions: [],
    imageUrls: []
  };

  var HOME_TZ = 'Asia/Ho_Chi_Minh';
  var CRUISE_ALTITUDE = 10600;
  var CRUISE_SPEED = 850;

  // One lap of the plane around the globe, and the pacing of the memory tour.
  var ORBIT_PERIOD = 7600;
  var ORBIT_TILT = -20;
  var TURN_MS = 1000;
  var HOLD_MS = 1500;
  var HOLD_MS_SHORT = 1050;
  // Same fill counts and tile/radius ratio as Special Gift's gallery globe
  // (170/199 CSS3D tiles, 208px cards on an 800-unit sphere).
  var SPHERE_FILL_MOBILE = 170;
  var SPHERE_FILL_DESKTOP = 199;
  var SPHERE_CAMERA_FOV = 40;
  var SPHERE_TILE_RATIO = 208 / 800;

  var DESTINATIONS = {
    australia:   { label: 'Úc',           code: 'SYD', city: 'Sydney',    tz: 'Australia/Sydney',  lat: -33.87, lon: 151.21 },
    usa:         { label: 'Hoa Kỳ',       code: 'JFK', city: 'New York',  tz: 'America/New_York',  lat: 40.71,  lon: -74.01 },
    canada:      { label: 'Canada',       code: 'YVR', city: 'Vancouver', tz: 'America/Vancouver', lat: 49.28,  lon: -123.12 },
    uk:          { label: 'Anh',          code: 'LHR', city: 'London',    tz: 'Europe/London',     lat: 51.51,  lon: -0.13 },
    france:      { label: 'Pháp',         code: 'CDG', city: 'Paris',     tz: 'Europe/Paris',      lat: 48.86,  lon: 2.35 },
    germany:     { label: 'Đức',          code: 'FRA', city: 'Frankfurt', tz: 'Europe/Berlin',     lat: 50.11,  lon: 8.68 },
    japan:       { label: 'Nhật Bản',     code: 'HND', city: 'Tokyo',     tz: 'Asia/Tokyo',        lat: 35.68,  lon: 139.69 },
    korea:       { label: 'Hàn Quốc',     code: 'ICN', city: 'Seoul',     tz: 'Asia/Seoul',        lat: 37.57,  lon: 126.98 },
    singapore:   { label: 'Singapore',    code: 'SIN', city: 'Singapore', tz: 'Asia/Singapore',    lat: 1.35,   lon: 103.82 },
    newzealand:  { label: 'New Zealand',  code: 'AKL', city: 'Auckland',  tz: 'Pacific/Auckland',  lat: -36.85, lon: 174.76 },
    netherlands: { label: 'Hà Lan',       code: 'AMS', city: 'Amsterdam', tz: 'Europe/Amsterdam',  lat: 52.37,  lon: 4.90 },
    other:       { label: 'Miền đất mới', code: 'INT', city: '',          tz: '',                  lat: null,   lon: null }
  };

  var ORIGINS = [
    ['ha noi',      { code: 'HAN', city: 'Hà Nội',           lat: 21.03, lon: 105.85 }],
    ['hanoi',       { code: 'HAN', city: 'Hà Nội',           lat: 21.03, lon: 105.85 }],
    ['ho chi minh', { code: 'SGN', city: 'TP. Hồ Chí Minh',  lat: 10.82, lon: 106.63 }],
    ['sai gon',     { code: 'SGN', city: 'Sài Gòn',          lat: 10.82, lon: 106.63 }],
    ['saigon',      { code: 'SGN', city: 'Sài Gòn',          lat: 10.82, lon: 106.63 }],
    ['tphcm',       { code: 'SGN', city: 'TP. Hồ Chí Minh',  lat: 10.82, lon: 106.63 }],
    ['da nang',     { code: 'DAD', city: 'Đà Nẵng',          lat: 16.05, lon: 108.20 }],
    ['hai phong',   { code: 'HPH', city: 'Hải Phòng',        lat: 20.84, lon: 106.72 }],
    ['can tho',     { code: 'VCA', city: 'Cần Thơ',          lat: 10.03, lon: 105.78 }],
    ['nha trang',   { code: 'CXR', city: 'Nha Trang',        lat: 12.24, lon: 109.19 }],
    ['hue',         { code: 'HUI', city: 'Huế',              lat: 16.46, lon: 107.59 }]
  ];

  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var canUseTimeZones = !!(window.Intl && window.Intl.DateTimeFormat);

  /** Real orders never fall back to demo copy — only the preview does. */
  function pick(key, fallback) {
    var raw = injected ? injected[key] : DEMO[key];
    if (typeof raw === 'string' && raw.trim()) return raw.trim();
    return fallback;
  }

  function pickList(key) {
    var raw = injected ? injected[key] : DEMO[key];
    return Array.isArray(raw) ? raw : [];
  }

  function deaccent(text) {
    return text
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'd')
      .toLowerCase();
  }

  function resolveOrigin(name) {
    var plain = deaccent(name);
    for (var i = 0; i < ORIGINS.length; i++) {
      if (plain.indexOf(ORIGINS[i][0]) !== -1) return ORIGINS[i][1];
    }
    // Unknown city: keep what the buyer typed, but fly from Hanoi for the maths.
    return { code: 'VN', city: name, lat: 21.03, lon: 105.85 };
  }

  function hashCode(text) {
    var h = 0;
    for (var i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) % 100000;
    return h;
  }

  function parseDate(raw) {
    var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(raw || '');
    return m ? { y: +m[1], m: +m[2], d: +m[3] } : null;
  }

  function formatDate(parts) {
    if (!parts) return 'Sắp tới';
    var pad = function (n) { return (n < 10 ? '0' : '') + n; };
    return pad(parts.d) + '.' + pad(parts.m) + '.' + parts.y;
  }

  function countdownText(parts) {
    if (!parts) return '—';
    var target = new Date(parts.y, parts.m - 1, parts.d);
    var today = new Date();
    today.setHours(0, 0, 0, 0);
    var days = Math.round((target - today) / 86400000);
    if (days > 0) return 'Còn ' + days + ' ngày';
    if (days === 0) return 'Hôm nay!';
    return 'Đã bay ' + Math.abs(days) + ' ngày trước';
  }

  function num(value) {
    return value.toLocaleString('vi-VN');
  }

  /** Great-circle distance in km. */
  function haversine(a, b) {
    var toRad = Math.PI / 180;
    var dLat = (b.lat - a.lat) * toRad;
    var dLon = (b.lon - a.lon) * toRad;
    var h =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(a.lat * toRad) * Math.cos(b.lat * toRad) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return Math.round(2 * 6371 * Math.asin(Math.sqrt(h)));
  }

  function flightTime(distanceKm) {
    var hours = distanceKm / CRUISE_SPEED + 0.6; // taxi, climb and descent
    var h = Math.floor(hours);
    var m = Math.round((hours - h) * 60);
    if (m === 60) { h += 1; m = 0; }
    return h + ' giờ' + (m ? ' ' + m + ' phút' : '');
  }

  /** Minutes a zone is ahead of UTC right now, straight from the browser's tz data. */
  function zoneOffset(tz, date) {
    var parts = new Intl.DateTimeFormat('en-US', {
      timeZone: tz, hour12: false,
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit'
    }).formatToParts(date).reduce(function (acc, p) { acc[p.type] = p.value; return acc; }, {});
    var asUTC = Date.UTC(
      +parts.year, +parts.month - 1, +parts.day,
      +parts.hour % 24, +parts.minute, +parts.second
    );
    return Math.round((asUTC - date.getTime()) / 60000);
  }

  function timeIn(tz, date) {
    return new Intl.DateTimeFormat('vi-VN', {
      timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false
    }).format(date);
  }

  function spanText(minutes) {
    var abs = Math.abs(minutes);
    var h = Math.floor(abs / 60);
    var m = abs % 60;
    if (!h) return m + ' phút';
    return h + ' tiếng' + (m ? ' ' + m + ' phút' : '');
  }

  function offsetText(minutes) {
    if (minutes === 0) return 'Cùng múi giờ';
    return spanText(minutes) + (minutes > 0 ? ' nhanh hơn' : ' chậm hơn');
  }

  function clamp(value, min, max) {
    return value < min ? min : value > max ? max : value;
  }

  function normalizeStages(rawStages, legacyImages, legacyCaptions) {
    if (rawStages.length) {
      return rawStages.slice(0, 8).map(function (raw) {
        var stage = raw && typeof raw === 'object' ? raw : {};
        var imageUrl = typeof stage.imageUrl === 'string'
          ? stage.imageUrl
          : (Array.isArray(stage.imageUrls) && typeof stage.imageUrls[0] === 'string' ? stage.imageUrls[0] : '');
        return {
          imageUrl: imageUrl.trim(),
          message: typeof stage.message === 'string' ? stage.message.trim() : ''
        };
      });
    }

    var legacyCount = Math.max(legacyImages.length, legacyCaptions.length);
    return Array.from({ length: Math.min(legacyCount, 12) }, function (_, index) {
      return {
        imageUrl: typeof legacyImages[index] === 'string' ? legacyImages[index] : '',
        message: typeof legacyCaptions[index] === 'string' ? legacyCaptions[index].trim() : ''
      };
    });
  }

  function defaultStageMessage(index) {
    var defaults = [
      'Một chặng trời mới đang chờ phía trước.',
      'Giữ lại một chỗ cho những điều chưa kịp kể.',
      'Mỗi hành trình đều bắt đầu bằng một bước thật nhỏ.',
      'Xa nhau một chút để ngày gặp lại có thêm thật nhiều chuyện.',
      'Phía trước là những ngày rực rỡ đang đợi cậu.'
    ];
    return defaults[index % defaults.length];
  }

  function easeInOut(t) {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }

  function boot() {
    var globeEl = document.getElementById('globe');
    var sphereEl = document.getElementById('sphere');
    var orbitEl = document.getElementById('orbit');
    var armEl = document.getElementById('orbitArm');
    var planeEl = document.getElementById('orbitPlane');
    var landingEl = document.getElementById('landing');
    var hud = document.getElementById('hud');
    if (!globeEl || !sphereEl || !landingEl) return;

    var friendName = pick('farewellFriendName', 'Người bạn thân');
    var fromName = pick('farewellFrom', 'Việt Nam');
    var origin = resolveOrigin(fromName);
    var destKey = pick('farewellDestination', 'other');
    var dest = DESTINATIONS[destKey] || DESTINATIONS.other;
    var departure = parseDate(pick('farewellDepartureDate', ''));
    var stages = normalizeStages(
      pickList('farewellStages'),
      pickList('imageUrls'),
      pickList('farewellCaptions')
    );
    var images = stages
      .map(function (stage) { return stage.imageUrl; })
      .filter(function (url) { return Boolean(url); });
    var gate = (hashCode(friendName) % 24) + 1;
    var distance = dest.lat === null ? null : haversine(origin, dest);

    var tiles = [];
    var tourTiles = [];
    var radius = 0;
    var orbitRadius = 0;
    var sphereScene = null;
    var sphereCamera = null;
    var sphereRenderer = null;
    var sphereGroup = null;
    var initialQuat = null;
    var memoryCount = stages.length;
    var holdMs = memoryCount > 8 ? HOLD_MS_SHORT : HOLD_MS;
    var legMs = TURN_MS + holdMs;
    var tourMs = Math.max(1, memoryCount) * legMs;
    var flight = { raf: 0, startedAt: 0, running: false, front: -1 };

    var envelope = document.getElementById('envelope');
    var letterPaper = document.getElementById('letterPaper');
    var envelopeOpen = false;
    var envelopeHideTimer = null;
    var letterHideTimer = null;

    fillBoardingPass();
    buildSphere();
    fillArrival();
    buildRecap();
    startClocks();
    watchReveals();

    envelope.addEventListener('click', openEnvelope);
    var journeyStarted = false;
    var startJourneyButton = document.getElementById('startJourney');
    function startJourneyOnce() {
      if (journeyStarted) return;
      journeyStarted = true;
      startFlight();
    }
    startJourneyButton.addEventListener('pointerdown', startJourneyOnce, true);
    startJourneyButton.addEventListener('touchstart', startJourneyOnce, { capture: true, passive: true });
    startJourneyButton.addEventListener('click', startJourneyOnce);
    document.getElementById('skipFlight').addEventListener('click', function () {
      endFlight();
    });
    document.getElementById('replayJourney').addEventListener('click', function () {
      sealEnvelope();
      landingEl.hidden = true;
      window.scrollTo(0, 0);
      startFlight();
    });

    window.addEventListener('resize', function () {
      if (flight.running) layoutSphere();
    });

    function fillBoardingPass() {
      document.getElementById('fromCode').textContent = origin.code;
      document.getElementById('fromName').textContent = fromName;
      document.getElementById('toCode').textContent = dest.code;
      document.getElementById('toName').textContent = dest.label;
      document.getElementById('stubCode').textContent = dest.code;
      document.getElementById('passName').textContent = friendName;
      document.getElementById('passDate').textContent = formatDate(departure);
      document.getElementById('passGate').textContent = (gate < 10 ? '0' : '') + gate;
      document.getElementById('passCountdown').textContent = countdownText(departure);
      document.getElementById('envelopeStamp').textContent = dest.code;
      document.getElementById('envelopeTo').textContent = friendName;
      document.getElementById('envelopeFrom').textContent =
        'Từ ' + fromName + (departure ? ' · ' + formatDate(departure) : '');

      document.getElementById('letterBody').textContent =
        pick('farewellMessage', 'Chúc cậu một hành trình thật rực rỡ.');
      var sender = pick('farewellSender', '');
      var signEl = document.getElementById('letterSign');
      if (sender) signEl.textContent = '— ' + sender;
      else signEl.hidden = true;
    }

    /**
     * Spread tiles evenly over a sphere with the same Fibonacci-sphere formula
     * the Special Gift template uses for its memory globe, and render them
     * with THREE.CSS3DObject/CSS3DRenderer. Customer photos are repeated
     * across ~170/199 square cards (Special Gift's counts) so the ball reads
     * as a dense globe rather than a handful of large portraits. Tiles are a
     * single flat card — the far side is a mirror, same as theirs. The tour
     * still visits each stage once, turning toward a well-spaced repeat of
     * that photo instead of the first N Fibonacci points (which would all
     * sit on the south pole of a 199-tile ball).
     */
    function buildSphere() {
      var count = stages.length;
      if (!count || typeof THREE === 'undefined' || !THREE.CSS3DRenderer) return;

      var slots = window.innerWidth < 768 ? SPHERE_FILL_MOBILE : SPHERE_FILL_DESKTOP;
      if (slots < count) slots = count;

      sphereCamera = new THREE.PerspectiveCamera(SPHERE_CAMERA_FOV, 1, 1, 6000);
      sphereScene = new THREE.Scene();
      sphereGroup = new THREE.Object3D();
      sphereScene.add(sphereGroup);

      var vector = new THREE.Vector3();
      var spherical = new THREE.Spherical();

      for (var i = 0; i < slots; i++) {
        var stageIndex = i % count;
        var stage = stages[stageIndex];
        var stageImage = stage.imageUrl || '';

        var tile = document.createElement('figure');
        tile.className = 'tile';

        if (stageImage) {
          var img = document.createElement('img');
          img.src = stageImage;
          img.alt = 'Kỷ niệm ' + (stageIndex + 1);
          img.loading = i < 6 ? 'eager' : 'lazy';
          img.onerror = function () {
            this.replaceWith(createTilePlaceholder());
          };
          tile.appendChild(img);
        } else {
          tile.appendChild(createTilePlaceholder());
        }

        // Same phi/theta distribution as the Special Gift globe: evenly
        // spaced points on a unit sphere, each looking outward from the
        // center so the card faces the viewer rather than the sphere's core.
        var phi = Math.acos(-1 + (2 * i) / slots);
        var theta = Math.sqrt(slots * Math.PI) * phi;

        var object = new THREE.CSS3DObject(tile);
        spherical.set(1, phi, theta);
        object.position.setFromSpherical(spherical);
        var direction = object.position.clone().normalize();
        vector.copy(direction).multiplyScalar(2);

        // object.lookAt() is degenerate right at the poles (direction ≈
        // ±Y), where the default up vector (0,1,0) is parallel to the look
        // direction — it produces an unpredictable, often upside-down roll.
        // Fibonacci sphere point 0 lands exactly on a pole every time, and
        // unlike Special Gift's ~200-tile ball (where that one odd tile is
        // buried in the crowd), this tour deliberately parks every tile
        // front-and-center in turn — so a broken pole tile would be glaring.
        // Swap the up reference near the poles to keep lookAt well-defined.
        if (Math.abs(direction.y) > 0.999) {
          object.up.set(0, 0, 1);
        }
        object.lookAt(vector);

        sphereGroup.add(object);

        tiles.push({
          el: tile,
          object: object,
          direction: direction,
          // The rotation that, applied to the whole group, brings this tile
          // round to face the camera (parked on the +Z axis).
          quat: new THREE.Quaternion().setFromUnitVectors(direction, new THREE.Vector3(0, 0, 1))
        });
      }

      // Pick one well-spaced repeat of each stage so the tour travels
      // around the globe instead of wobbling around the south pole.
      tourTiles = [];
      for (var m = 0; m < count; m++) {
        var target = count <= 1
          ? Math.floor(slots / 2)
          : Math.round(m * (slots - 1) / (count - 1));
        var best = m;
        var bestDist = Math.abs(best - target);
        for (var j = m; j < slots; j += count) {
          var d = Math.abs(j - target);
          if (d < bestDist) {
            best = j;
            bestDist = d;
          }
        }
        tourTiles.push(tiles[best]);
      }

      initialQuat = new THREE.Quaternion().setFromEuler(
        new THREE.Euler(-14 * Math.PI / 180, 24 * Math.PI / 180, 0, 'XYZ')
      );

      sphereRenderer = new THREE.CSS3DRenderer();
      sphereRenderer.domElement.style.position = 'absolute';
      sphereRenderer.domElement.style.top = '0';
      sphereRenderer.domElement.style.left = '0';
      sphereRenderer.domElement.style.pointerEvents = 'none';
      // CSS3DRenderer defaults to overflow:hidden, which shears off tiles
      // that perspective-scale past the box (the missing right side).
      sphereRenderer.domElement.style.overflow = 'visible';
      sphereEl.appendChild(sphereRenderer.domElement);
    }

    function createTilePlaceholder() {
      var placeholder = document.createElement('span');
      placeholder.className = 'tile-placeholder';
      placeholder.textContent = '✈';
      return placeholder;
    }

    function renderGlobe() {
      if (sphereRenderer && sphereScene && sphereCamera) {
        sphereRenderer.render(sphereScene, sphereCamera);
      }
    }

    function layoutSphere() {
      var box = document.getElementById('globeScene').getBoundingClientRect();
      // The scene is now a tight square around the sphere, so leaning on the
      // shared side (they're equal) fills it far better than the old
      // width/height split did, which used to leave a dead zone below the ball.
      // 0.38 leaves room for tile size + CSS3D perspective scale so the
      // silhouette stays inside the box (0.46 overflowed and got clipped).
      var side = Math.min(box.width, box.height);
      radius = side * 0.38;
      // Keep the plane's lap inside the scene, however narrow the screen is.
      orbitRadius = Math.min(side / 2 - 22, radius * 1.45);
      sphereEl.style.setProperty(
        '--tile',
        Math.max(28, Math.round(radius * SPHERE_TILE_RATIO)) + 'px'
      );

      if (!sphereRenderer || !sphereCamera) return;

      var width = Math.max(1, Math.round(box.width));
      var height = Math.max(1, Math.round(box.height));

      sphereRenderer.setSize(width, height);
      sphereCamera.aspect = width / height;
      // Park the camera so one world unit renders as one CSS pixel at the
      // sphere's center — the same relationship the Special Gift globe relies
      // on — so tiles at "radius" line up with the plane's CSS-driven orbit.
      var fovRad = (SPHERE_CAMERA_FOV * Math.PI) / 180;
      sphereCamera.position.z = (height / 2) / Math.tan(fovRad / 2);
      sphereCamera.updateProjectionMatrix();

      tiles.forEach(function (tile) {
        tile.object.position.copy(tile.direction).multiplyScalar(radius);
      });

      renderGlobe();
    }

    function startFlight() {
      document.body.classList.remove('is-gated');

      // Nothing to fly around, or the visitor asked for calm: go straight there.
      if (!tiles.length || reduceMotion) {
        endFlight();
        return;
      }

      landingEl.hidden = true;
      globeEl.hidden = false;
      document.body.classList.add('is-flying');
      // Let the section get its size before the tiles are placed on it.
      layoutSphere();

      flight.running = true;
      flight.front = -1;
      showMemory(0);
      flight.startedAt = window.performance.now();
      flight.raf = window.requestAnimationFrame(step);
    }

    function step(now) {
      if (!flight.running) return;
      var elapsed = now - flight.startedAt;
      var progress = clamp(elapsed / tourMs, 0, 1);

      spinPlane(elapsed);
      turnSphere(elapsed);
      updateHud(progress);
      updateStatus(progress);

      if (elapsed >= tourMs) {
        endFlight();
        return;
      }
      flight.raf = window.requestAnimationFrame(step);
    }

    function spinPlane(elapsed) {
      var angle = (elapsed / ORBIT_PERIOD) * 360;
      armEl.style.transform = 'rotateY(' + angle + 'deg)';

      // Billboard the plane out of the orbit's rotations, then point its nose
      // along the direction it is travelling on screen.
      var rad = angle * (Math.PI / 180);
      var tiltRad = ORBIT_TILT * (Math.PI / 180);
      var heading = Math.atan2(Math.sin(rad) * Math.sin(tiltRad), Math.cos(rad)) * (180 / Math.PI);
      planeEl.style.transform =
        'translateZ(' + Math.round(orbitRadius) + 'px) ' +
        'rotateY(' + -angle + 'deg) rotateX(' + -ORBIT_TILT + 'deg)';
      planeEl.firstElementChild.style.transform = 'rotate(' + (heading + 90) + 'deg)';

      // The sphere is a hollow shell of translucent cards — CSS cannot fully
      // occlude the plane through gaps and opacity. Fade it out on the far half
      // of the lap (cos < 0 ≈ behind the ball) so it never shows through.
      var depth = Math.cos(rad);
      var fade = clamp((depth + 0.22) / 0.44, 0, 1);
      planeEl.style.opacity = String(fade);
      planeEl.style.visibility = fade < 0.02 ? 'hidden' : 'visible';
    }

    function turnSphere(elapsed) {
      // The tour visits each memory once, not each tile — the sphere repeats
      // the photos to fill itself out.
      var index = clamp(Math.floor(elapsed / legMs), 0, memoryCount - 1);
      if (!tourTiles[index] || !sphereGroup) return;

      var local = elapsed - index * legMs;
      var toQuat = tourTiles[index].quat;
      var fromQuat = index === 0 ? initialQuat : tourTiles[index - 1].quat;
      var t = easeInOut(clamp(local / TURN_MS, 0, 1));

      // Spherical interpolation, so the whole rigid sphere arcs smoothly
      // round to the next tile instead of wobbling through separate X/Y turns.
      sphereGroup.quaternion.copy(fromQuat).slerp(toQuat, t);
      renderGlobe();

      // Hand over once the incoming memory is most of the way round, so the
      // caption is never describing the photo that just left.
      if (t >= 0.45 && flight.front !== index) showMemory(index);
    }

    function showMemory(index) {
      if (flight.front >= 0 && tourTiles[flight.front]) {
        tourTiles[flight.front].el.classList.remove('is-front');
      }
      flight.front = index;
      if (tourTiles[index]) tourTiles[index].el.classList.add('is-front');

      var stage = stages[index] || { imageUrl: '', message: '' };
      var memoryEl = document.querySelector('.globe-memory');
      var imageEl = document.getElementById('globeMemoryImage');
      var placeholderEl = document.getElementById('globeMemoryPlaceholder');
      var hasImage = Boolean(stage.imageUrl);
      memoryEl.classList.toggle('is-image-only', hasImage && !stage.message);
      memoryEl.classList.toggle('is-message-only', !hasImage && Boolean(stage.message));
      memoryEl.classList.toggle('is-empty', !hasImage && !stage.message);
      if (hasImage) {
        imageEl.src = stage.imageUrl;
        imageEl.alt = 'Ảnh chặng ' + (index + 1);
        imageEl.hidden = false;
        imageEl.onerror = function () {
          imageEl.hidden = true;
          placeholderEl.hidden = false;
        };
        placeholderEl.hidden = true;
      } else {
        imageEl.hidden = true;
        imageEl.removeAttribute('src');
        placeholderEl.hidden = false;
      }

      var note = stage.message;
      if (!hasImage && !note) {
        note = defaultStageMessage(index);
      }
      document.getElementById('globeStep').textContent =
        'Chặng ' + (index < 9 ? '0' : '') + (index + 1);
      document.getElementById('globeNote').textContent = note;
    }

    function updateStatus(progress) {
      var text = progress < 0.16
        ? 'Đang lấy độ cao'
        : progress < 0.5
        ? 'Độ cao hành trình ' + num(CRUISE_ALTITUDE) + ' m'
        : progress < 0.84
        ? 'Đã qua nửa chặng đường'
        : 'Bắt đầu hạ độ cao';
      var el = document.getElementById('globeStatus');
      if (el.textContent !== text) el.textContent = text;
    }

    function updateHud(progress) {
      var altitude = progress < 0.12
        ? CRUISE_ALTITUDE * (progress / 0.12)
        : progress > 0.88
        ? CRUISE_ALTITUDE * ((1 - progress) / 0.12)
        : CRUISE_ALTITUDE;
      document.getElementById('hudAltitude').textContent = num(Math.round(altitude / 100) * 100) + ' m';
      document.getElementById('hudDistance').textContent = distance === null
        ? Math.round(progress * 100) + '%'
        : num(Math.round(distance * progress)) + ' / ' + num(distance) + ' km';
      document.getElementById('hudBar').style.width = (progress * 100).toFixed(1) + '%';
      hud.classList.toggle('is-visible', progress > 0 && progress < 1);
    }

    /** Land: put the globe away and hand the page back to normal scrolling. */
    function endFlight() {
      if (flight.raf) window.cancelAnimationFrame(flight.raf);
      flight.raf = 0;
      flight.running = false;
      hud.classList.remove('is-visible');

      globeEl.hidden = true;
      document.body.classList.remove('is-gated');
      document.body.classList.remove('is-flying');
      document.body.classList.add('is-landed');
      landingEl.hidden = false;

      var top = landingEl.getBoundingClientRect().top + window.scrollY;
      window.scrollTo(0, Math.max(0, top));
    }

    function fillArrival() {
      var city = dest.city || dest.label;
      document.getElementById('arrivalCity').textContent = city;
      document.getElementById('stampCode').textContent = dest.code;
      document.getElementById('stampCity').textContent = deaccent(city).toUpperCase();
      document.getElementById('stampDate').textContent = formatDate(departure);

      var facts = document.getElementById('facts');
      if (distance === null) {
        facts.hidden = true;
      } else {
        document.getElementById('factDistance').textContent = num(distance) + ' km';
        document.getElementById('factDuration').textContent = flightTime(distance);
      }

      var clocks = document.getElementById('clocks');
      var note = document.getElementById('clocksNote');
      if (!canUseTimeZones || !dest.tz) {
        clocks.hidden = true;
        document.getElementById('factOffset').textContent = '—';
        return;
      }

      var minutes = zoneOffset(dest.tz, new Date()) - zoneOffset(HOME_TZ, new Date());
      document.getElementById('factOffset').textContent = offsetText(minutes);
      document.getElementById('clockFromLabel').textContent = origin.city || fromName;
      document.getElementById('clockToLabel').textContent = city;
      note.textContent = minutes === 0
        ? 'Cũng may, hai nơi vẫn chung một múi giờ.'
        : 'Từ hôm nay, ' + city + ' luôn ' + (minutes > 0 ? 'đi trước ' : 'đi sau ') +
          (origin.city || fromName) + ' ' + spanText(minutes) + '.';
    }

    function startClocks() {
      if (!canUseTimeZones || !dest.tz) return;
      var fromEl = document.getElementById('clockFrom');
      var toEl = document.getElementById('clockTo');
      var render = function () {
        var now = new Date();
        fromEl.textContent = timeIn(HOME_TZ, now);
        toEl.textContent = timeIn(dest.tz, now);
      };
      render();
      setInterval(render, 20000);
    }

    function buildRecap() {
      if (images.length === 0) return;
      var recap = document.getElementById('recap');
      var grid = document.getElementById('recapGrid');
      stages.forEach(function (stage, stageIndex) {
        if (!stage.imageUrl) return;
        var figure = document.createElement('figure');
        figure.className = 'recap-item';

        var img = document.createElement('img');
        img.src = stage.imageUrl;
        img.alt = 'Kỷ niệm ' + (stageIndex + 1);
        img.loading = 'lazy';
        figure.appendChild(img);

        if (stage.message) {
          var caption = document.createElement('figcaption');
          caption.textContent = stage.message;
          figure.appendChild(caption);
        }
        grid.appendChild(figure);
      });
      recap.hidden = false;
    }

    /**
     * The envelope and the sealed letter each stay out of the document flow
     * (`hidden`) whenever they're not the one on screen, so the invisible one
     * never inflates `.letter-stage`'s height — that used to leave a tall dead
     * gap sized to the letter's full text before it was ever opened.
     */
    function openEnvelope() {
      if (envelopeOpen) return;
      envelopeOpen = true;
      window.clearTimeout(envelopeHideTimer);
      window.clearTimeout(letterHideTimer);

      letterPaper.hidden = false;
      void letterPaper.offsetWidth; // flush layout so the seal→open transition animates
      letterPaper.classList.remove('is-sealed');
      envelope.classList.add('is-open');
      envelope.setAttribute('aria-expanded', 'true');

      envelopeHideTimer = window.setTimeout(function () {
        envelope.hidden = true;
      }, reduceMotion ? 0 : 900);
    }

    function sealEnvelope() {
      envelopeOpen = false;
      window.clearTimeout(envelopeHideTimer);
      window.clearTimeout(letterHideTimer);

      envelope.hidden = false;
      void envelope.offsetWidth;
      envelope.classList.remove('is-open');
      envelope.setAttribute('aria-expanded', 'false');
      letterPaper.classList.add('is-sealed');

      letterHideTimer = window.setTimeout(function () {
        letterPaper.hidden = true;
      }, reduceMotion ? 0 : 260);
    }

    function watchReveals() {
      var stamp = document.getElementById('stamp');
      if (!('IntersectionObserver' in window)) {
        stamp.classList.add('is-in');
        return;
      }
      var observer = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          entry.target.classList.add('is-in');
          observer.unobserve(entry.target);
        });
      }, { threshold: 0.3 });
      observer.observe(stamp);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
