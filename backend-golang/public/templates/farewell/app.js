/**
 * Bon Voyage — a boarding pass, a flight around a sphere of memories, a letter.
 *
 * Pressing the pass hands the screen over to a 3D globe built from the order's
 * photos. The plane circles it while the sphere turns to bring each memory to
 * the front in turn, then the page lands on the arrival facts and the sealed
 * letter.
 *
 * The sphere is plain CSS 3D — no WebGL, no third-party code. Route facts
 * (distance, flight time, time difference, live clocks) are derived from the two
 * cities rather than asked for in the order form. Clocks go through the
 * browser's IANA timezone data so daylight saving stays correct.
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
  var SPHERE_MIN_TILES = 15;
  var SPHERE_MAX_TILES = 26;

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

  /** Shortest signed way around the circle, so the globe never spins the long way. */
  function shortestTurn(from, to) {
    var delta = (to - from) % 360;
    if (delta > 180) delta -= 360;
    if (delta < -180) delta += 360;
    return delta;
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
    var radius = 0;
    var orbitRadius = 0;
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
    document.getElementById('startJourney').addEventListener('click', startFlight);
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
     * Spread tiles evenly over a sphere with a Fibonacci spiral, each parked on
     * its own point facing outward. A handful of stages would leave the ball
     * looking empty, so the stage visuals repeat until it reads as a sphere —
     * the first pass through them is what the tour visits. Angles are kept so
     * the tiles can be re-placed at a new radius when the viewport changes.
     */
    function buildSphere() {
      var count = stages.length;
      if (!count) return;

      var slots = count >= SPHERE_MIN_TILES
        ? count
        : Math.min(SPHERE_MAX_TILES, count * Math.ceil(SPHERE_MIN_TILES / count));
      var goldenAngle = 180 * (3 - Math.sqrt(5));

      for (var i = 0; i < slots; i++) {
        // Pull the poles in a little; tiles sitting exactly on top read as flat.
        var y = (slots === 1 ? 0 : 1 - (i / (slots - 1)) * 2) * 0.82;

        var tile = document.createElement('figure');
        tile.className = 'tile';

        var face = document.createElement('span');
        face.className = 'tile-face';
        var stageIndex = i % count;
        var stage = stages[stageIndex];
        var stageImage = stage.imageUrl || '';
        if (stageImage) {
          var img = document.createElement('img');
          img.src = stageImage;
          img.alt = 'Kỷ niệm ' + (stageIndex + 1);
          img.loading = i < 6 ? 'eager' : 'lazy';
          img.onerror = function () {
            this.replaceWith(createTilePlaceholder());
          };
          face.appendChild(img);
        } else {
          face.appendChild(createTilePlaceholder());
        }

        // A plain card back, so the far side of the sphere isn't a mirror image.
        var back = document.createElement('span');
        back.className = 'tile-back';

        tile.appendChild(face);
        tile.appendChild(back);
        sphereEl.appendChild(tile);

        tiles.push({
          el: tile,
          azimuth: (goldenAngle * i) % 360,
          elevation: Math.asin(clamp(y, -1, 1)) * (180 / Math.PI)
        });
      }
    }

    function createTilePlaceholder() {
      var placeholder = document.createElement('span');
      placeholder.className = 'tile-placeholder';
      placeholder.textContent = '✈';
      return placeholder;
    }

    function layoutSphere() {
      var box = document.getElementById('globeScene').getBoundingClientRect();
      // The scene is now a tight square around the sphere, so leaning on the
      // shared side (they're equal) fills it far better than the old
      // width/height split did, which used to leave a dead zone below the ball.
      radius = clamp(Math.min(box.width, box.height) * 0.4, 92, 210);
      // Keep the plane's lap inside the scene, however narrow the screen is.
      orbitRadius = Math.min(box.width / 2 - 22, radius * 1.45);
      sphereEl.style.setProperty('--tile', Math.round(radius * 0.66) + 'px');

      tiles.forEach(function (tile) {
        tile.el.style.transform =
          'rotateY(' + tile.azimuth + 'deg) rotateX(' + -tile.elevation + 'deg) ' +
          'translateZ(' + Math.round(radius) + 'px)';
      });
    }

    /** The rotation that brings a tile round to face the viewer. */
    function facing(tile) {
      return { rx: tile.elevation, ry: -tile.azimuth };
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
      if (!tiles[index]) return;

      var local = elapsed - index * legMs;
      var to = facing(tiles[index]);
      var from = index === 0 ? { rx: -14, ry: 24 } : facing(tiles[index - 1]);
      var t = easeInOut(clamp(local / TURN_MS, 0, 1));

      var rx = from.rx + (to.rx - from.rx) * t;
      var ry = from.ry + shortestTurn(from.ry, to.ry) * t;
      sphereEl.style.transform = 'rotateX(' + rx + 'deg) rotateY(' + ry + 'deg)';

      // Hand over once the incoming memory is most of the way round, so the
      // caption is never describing the photo that just left.
      if (t >= 0.45 && flight.front !== index) showMemory(index);
    }

    function showMemory(index) {
      if (flight.front >= 0 && tiles[flight.front]) {
        tiles[flight.front].el.classList.remove('is-front');
      }
      flight.front = index;
      tiles[index].el.classList.add('is-front');

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
