/**
 * Bon Voyage — a boarding pass, a flight around a sphere of memories, a letter.
 *
 * Pressing the pass first opens Love Burst's 3D photo sphere. Tapping the
 * sphere then moves through the order's individual memory stages before the
 * page lands on the arrival facts and the sealed letter.
 *
 * The photo sphere copies Love Burst's CSS3DRenderer, Tween assembly, fixed
 * tile sizing, camera, radius, and automatic rotation. Route
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
    farewellDestination: 'Sydney',
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

  // Pacing of each memory stage.
  var TURN_MS = 1000;
  var HOLD_MS = 1500;
  var HOLD_MS_SHORT = 1050;
  var BOARD_MESSAGE_MAX = 36;

  var DESTINATIONS = {
    australia:   { label: 'Úc',           code: 'SYD', city: 'Sydney',    cc: 'AU', tz: 'Australia/Sydney',  lat: -33.87, lon: 151.21 },
    usa:         { label: 'Hoa Kỳ',       code: 'JFK', city: 'New York',  cc: 'US', tz: 'America/New_York',  lat: 40.71,  lon: -74.01 },
    canada:      { label: 'Canada',       code: 'YVR', city: 'Vancouver', cc: 'CA', tz: 'America/Vancouver', lat: 49.28,  lon: -123.12 },
    uk:          { label: 'Anh',          code: 'LHR', city: 'London',    cc: 'GB', tz: 'Europe/London',     lat: 51.51,  lon: -0.13 },
    france:      { label: 'Pháp',         code: 'CDG', city: 'Paris',     cc: 'FR', tz: 'Europe/Paris',      lat: 48.86,  lon: 2.35 },
    germany:     { label: 'Đức',          code: 'FRA', city: 'Frankfurt', cc: 'DE', tz: 'Europe/Berlin',     lat: 50.11,  lon: 8.68 },
    japan:       { label: 'Nhật Bản',     code: 'HND', city: 'Tokyo',     cc: 'JP', tz: 'Asia/Tokyo',        lat: 35.68,  lon: 139.69 },
    korea:       { label: 'Hàn Quốc',     code: 'ICN', city: 'Seoul',     cc: 'KR', tz: 'Asia/Seoul',        lat: 37.57,  lon: 126.98 },
    singapore:   { label: 'Singapore',    code: 'SIN', city: 'Singapore', cc: 'SG', tz: 'Asia/Singapore',    lat: 1.35,   lon: 103.82 },
    newzealand:  { label: 'New Zealand',  code: 'AKL', city: 'Auckland',  cc: 'NZ', tz: 'Pacific/Auckland',  lat: -36.85, lon: 174.76 },
    netherlands: { label: 'Hà Lan',       code: 'AMS', city: 'Amsterdam', cc: 'NL', tz: 'Europe/Amsterdam',  lat: 52.37,  lon: 4.90 },
    other:       { label: 'Miền đất mới', code: 'INT', city: '',          cc: '',   tz: '',                  lat: null,   lon: null }
  };

  // Longer needles first so "new york" wins over a short country slug.
  var FLAG_HINTS = [
    ['ho chi minh', 'VN'], ['hai phong', 'VN'], ['nha trang', 'VN'], ['can tho', 'VN'],
    ['new york', 'US'], ['los angeles', 'US'], ['san francisco', 'US'], ['hoa ky', 'US'],
    ['new zealand', 'NZ'], ['auckland', 'NZ'], ['wellington', 'NZ'],
    ['singapore', 'SG'], ['australia', 'AU'], ['melbourne', 'AU'], ['brisbane', 'AU'],
    ['sydney', 'AU'], ['perth', 'AU'], ['vancouver', 'CA'], ['toronto', 'CA'],
    ['canada', 'CA'], ['london', 'GB'], ['manchester', 'GB'], ['paris', 'FR'],
    ['frankfurt', 'DE'], ['berlin', 'DE'], ['munich', 'DE'], ['tokyo', 'JP'],
    ['osaka', 'JP'], ['seoul', 'KR'], ['busan', 'KR'], ['amsterdam', 'NL'],
    ['bangkok', 'TH'], ['thailand', 'TH'], ['taipei', 'TW'],
    ['ha noi', 'VN'], ['hanoi', 'VN'], ['sai gon', 'VN'], ['saigon', 'VN'],
    ['da nang', 'VN'], ['viet nam', 'VN'], ['vietnam', 'VN'],
    ['japan', 'JP'], ['korea', 'KR'], ['france', 'FR'], ['germany', 'DE'],
    ['nhat ban', 'JP'], ['han quoc', 'KR'], ['ha lan', 'NL'],
    ['tphcm', 'VN'], ['hue', 'VN']
  ];

  // One unique flag per board row, like a real departures list.
  var BOARD_FLAGS = ['JP', 'SG', 'US', 'FR', 'TH', 'GB', 'AU', 'KR', 'CA', 'DE', 'NZ', 'NL', 'VN'];
  var BOARD_AIRLINES = {
    JP: 'JL', SG: 'SQ', US: 'AA', FR: 'AF', TH: 'TG', GB: 'BA',
    AU: 'QF', KR: 'KE', CA: 'AC', DE: 'LH', NZ: 'NZ', NL: 'KL', VN: 'VN'
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
    return { code: 'VN', city: name };
  }

  function airportCode(name) {
    var letters = deaccent(name).replace(/[^a-z]/g, '').toUpperCase();
    return (letters.slice(0, 3) || 'INT');
  }

  function resolveDestination(raw) {
    var known = DESTINATIONS[raw];
    if (known && raw !== 'other') {
      return {
        label: known.label,
        code: known.code,
        city: known.city || known.label,
        cc: known.cc || ''
      };
    }
    var name = !raw || raw === 'other' ? 'Miền đất mới' : raw;
    return { label: name, code: airportCode(name), city: name, cc: guessCountryCode(name) };
  }

  function guessCountryCode(name) {
    var plain = deaccent(name);
    if (!plain) return '';
    if (DESTINATIONS[plain] && DESTINATIONS[plain].cc) return DESTINATIONS[plain].cc;
    var key;
    for (key in DESTINATIONS) {
      if (!Object.prototype.hasOwnProperty.call(DESTINATIONS, key)) continue;
      var place = DESTINATIONS[key];
      if (!place.cc) continue;
      if (plain === deaccent(place.label) || plain === deaccent(place.city) ||
          plain === String(place.code).toLowerCase()) {
        return place.cc;
      }
    }
    var i;
    for (i = 0; i < FLAG_HINTS.length; i++) {
      if (plain.indexOf(FLAG_HINTS[i][0]) !== -1) return FLAG_HINTS[i][1];
    }
    if (plain === 'uc') return 'AU';
    if (plain === 'my' || plain === 'usa') return 'US';
    if (plain === 'anh' || plain === 'uk') return 'GB';
    if (plain === 'duc') return 'DE';
    if (plain === 'phap') return 'FR';
    return '';
  }

  function boardFlagCodes(prefer) {
    var list = [];
    if (prefer) list.push(prefer);
    var i;
    for (i = 0; i < BOARD_FLAGS.length; i++) {
      if (BOARD_FLAGS[i] !== prefer) list.push(BOARD_FLAGS[i]);
    }
    return list;
  }

  function flagEmoji(cc) {
    if (!cc || cc.length !== 2) return '';
    var a = cc.toUpperCase().charCodeAt(0) - 65;
    var b = cc.toUpperCase().charCodeAt(1) - 65;
    if (a < 0 || a > 25 || b < 0 || b > 25) return '';
    return String.fromCodePoint(0x1F1E6 + a, 0x1F1E6 + b);
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

  function stageImageUrl(raw) {
    var stage = raw && typeof raw === 'object' ? raw : {};
    if (typeof stage.imageUrl === 'string') return stage.imageUrl.trim();
    if (Array.isArray(stage.imageUrls) && typeof stage.imageUrls[0] === 'string') {
      return stage.imageUrls[0].trim();
    }
    return '';
  }

  function collectImages(rawStages, imageUrls) {
    var urls = imageUrls.filter(function (url) {
      return typeof url === 'string' && url.trim();
    }).map(function (url) { return url.trim(); }).slice(0, 12);
    if (urls.length) return urls;
    return rawStages.slice(0, 12).map(stageImageUrl).filter(Boolean);
  }

  function collectMessages(rawStages, captions) {
    var fromCaptions = captions.map(function (item) {
      return typeof item === 'string' ? fitBoardMessage(item) : '';
    }).filter(Boolean).slice(0, 12);
    var fromStages = rawStages.slice(0, 12).map(function (raw) {
      var stage = raw && typeof raw === 'object' ? raw : {};
      return typeof stage.message === 'string' ? fitBoardMessage(stage.message) : '';
    }).filter(Boolean);
    // Prefer the longer list so new independent captions win over a short
    // image-zip, while older paired stages keep messages that never sat on a photo.
    if (fromCaptions.length >= fromStages.length && fromCaptions.length) return fromCaptions;
    if (fromStages.length) return fromStages;
    return fromCaptions;
  }

  function fitBoardMessage(text) {
    return Array.from(text.trim()).slice(0, BOARD_MESSAGE_MAX).join('');
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

  function seededRandom(seed) {
    var s = seed;
    return function () {
      s = (s * 16807) % 2147483647;
      return (s - 1) / 2147483646;
    };
  }

  function paintNightSky() {
    var canvas = document.getElementById('globeStars');
    if (!canvas || !canvas.getContext) return;
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var width = window.innerWidth;
    var height = window.innerHeight;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    var ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);

    var rng = seededRandom(20260901);
    var count = Math.max(900, Math.round((width * height) / 420));
    var i;
    for (i = 0; i < count; i++) {
      var roll = rng();
      var x = rng() * width;
      var y = rng() * height;
      if (roll < 0.5) {
        var t = rng();
        x = width * (0.08 + t * 0.84) + (rng() - 0.5) * width * 0.22;
        y = height * (0.08 + t * 0.55) + (rng() - 0.5) * height * 0.2;
      }
      var size = roll < 0.84 ? 0.35 + rng() * 0.55 : roll < 0.97 ? 0.9 + rng() * 0.7 : 1.5 + rng() * 1.1;
      var alpha = roll < 0.84 ? 0.22 + rng() * 0.4 : 0.68 + rng() * 0.32;
      var tint = rng();
      var color = tint < 0.1
        ? '255, 214, 170'
        : tint < 0.2
        ? '186, 214, 255'
        : '255, 255, 255';
      ctx.fillStyle = 'rgba(' + color + ',' + alpha + ')';
      ctx.beginPath();
      ctx.arc(x, y, size, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function boot() {
    var globeEl = document.getElementById('globe');
    var sphereEl = document.getElementById('sphere');
    var landingEl = document.getElementById('landing');
    var hud = document.getElementById('hud');
    var sphereStage = document.getElementById('sphereStage');
    var memoryStage = document.getElementById('memoryStage');
    if (!globeEl || !sphereEl || !landingEl || !sphereStage ||
        !memoryStage) return;

    paintNightSky();
    window.addEventListener('resize', paintNightSky);

    var friendName = pick('farewellFriendName', 'Người bạn thân');
    var fromName = pick('farewellFrom', 'Việt Nam');
    var origin = resolveOrigin(fromName);
    var dest = resolveDestination(pick('farewellDestination', ''));
    var departure = parseDate(pick('farewellDepartureDate', ''));
    var letterText = pick('farewellMessage', 'Chúc cậu một hành trình thật rực rỡ.');
    var rawStages = pickList('farewellStages');
    var images = collectImages(rawStages, pickList('imageUrls'));
    var boardMessages = collectMessages(rawStages, pickList('farewellCaptions'));
    if (!boardMessages.length) boardMessages = [fitBoardMessage(defaultStageMessage(0))];
    var gate = (hashCode(friendName) % 24) + 1;
    var distance = null;

    var sphereObjects = [];
    var sphereTargets = [];
    var sphereInnerTargets = [];
    var sphereScene = null;
    var sphereCamera = null;
    var sphereRenderer = null;
    var sphereControls = null;
    var sphereTransform = null;
    var sphereReady = false;
    var sphereHasAssembled = false;
    var sphereIsEntering = false;
    var sphereBuildPromise = null;
    var memoryCount = Math.max(images.length, boardMessages.length, 1);
    var holdMs = memoryCount > 8 ? HOLD_MS_SHORT : HOLD_MS;
    var legMs = TURN_MS + holdMs;
    var tourMs = Math.max(1, memoryCount) * legMs;
    var flight = { raf: 0, startedAt: 0, running: false, front: -1 };
    var spherePreview = { raf: 0, startedAt: 0, running: false };
    var boardRows = [];

    var envelope = document.getElementById('envelope');
    var letterPaper = document.getElementById('letterPaper');
    var envelopeOpen = false;
    var envelopeHideTimer = null;
    var letterHideTimer = null;
    var letterRaiseTimer = null;
    var letterOpenTimer = null;

    fillBoardingPass();
    buildBoard();
    sphereBuildPromise = buildSphere();
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
      showSphereStage();
    }
    startJourneyButton.addEventListener('pointerdown', startJourneyOnce, true);
    startJourneyButton.addEventListener('touchstart', startJourneyOnce, { capture: true, passive: true });
    startJourneyButton.addEventListener('click', startJourneyOnce);
    document.getElementById('skipFlight').addEventListener('click', function () {
      endFlight();
    });
    sphereEl.addEventListener('keydown', function (event) {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        enterSphere();
      }
    });
    document.getElementById('replayJourney').addEventListener('click', function () {
      sealEnvelope();
      landingEl.hidden = true;
      window.scrollTo(0, 0);
      showSphereStage();
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
      document.getElementById('boardFlight').textContent = 'BV ' + (100 + ((gate * 37) % 800));
      document.getElementById('boardSeat').textContent =
        (gate < 10 ? '0' : '') + gate + 'ABCDEF'.charAt(gate % 6);
      document.getElementById('passCountdown').textContent = countdownText(departure);
      document.getElementById('envelopeStamp').textContent = dest.code;
      document.getElementById('envelopeTo').textContent = friendName;
      document.getElementById('envelopeFrom').textContent =
        'Từ ' + fromName + (departure ? ' · ' + formatDate(departure) : '');

      document.getElementById('letterBody').textContent = letterText;
      var sender = pick('farewellSender', '');
      var signEl = document.getElementById('letterSign');
      if (sender) signEl.textContent = '— ' + sender;
      else signEl.hidden = true;
    }

    function galleryTileSize() {
      var mobile = window.innerWidth < 768;
      return Math.round((mobile ? 220 : 200) * Math.min(window.devicePixelRatio || 1, 3));
    }

    function squareImage(url, size) {
      return new Promise(function (resolve) {
        var objectUrl = '';
        var settled = false;
        var timeout = window.setTimeout(function () { finish(url); }, 8000);

        function finish(value) {
          if (settled) return;
          settled = true;
          window.clearTimeout(timeout);
          if (objectUrl) URL.revokeObjectURL(objectUrl);
          resolve(value);
        }

        fetch(url)
          .then(function (response) {
            if (!response.ok) throw new Error('Image request failed');
            return response.blob();
          })
          .then(function (blob) {
            if (settled) return;
            objectUrl = URL.createObjectURL(blob);
            var img = new Image();
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
                finish(canvas.toDataURL('image/jpeg', 0.92));
              } catch (error) {
                finish(url);
              }
            };
            img.onerror = function () { finish(url); };
            img.src = objectUrl;
          })
          .catch(function () { finish(url); });
      });
    }

    function preloadSphereImages() {
      var unique = [];
      images.forEach(function (url) {
        if (unique.indexOf(url) === -1) unique.push(url);
      });
      return Promise.all(unique.map(function (url) {
        return squareImage(url, galleryTileSize());
      })).then(function (squared) {
        var map = {};
        unique.forEach(function (url, index) { map[url] = squared[index]; });
        return map;
      });
    }

    /**
     * Love Burst's photo sphere, with the final tap routed into Farewell's
     * memory stages instead of Love Burst's envelope sequence.
     */
    function buildSphere() {
      if (!images.length || typeof THREE === 'undefined' ||
          typeof TWEEN === 'undefined' || !THREE.CSS3DRenderer ||
          !THREE.TrackballControls) {
        return Promise.resolve(false);
      }

      return preloadSphereImages().then(function (imageMap) {
        var ua = navigator.userAgent || '';
        var inApp = /Zalo|FBAN|FBAV|Instagram|Line|MicroMessenger/i.test(ua);
        var mobile = window.innerWidth < 768;
        var rings = inApp ? (mobile ? 6 : 7) : (mobile ? 8 : 12);
        var layout = [];
        for (var ring = 0; ring < rings; ring++) {
          var phi = Math.PI * (ring + 0.5) / rings;
          var count = Math.max(1, Math.round(2 * rings * Math.sin(phi)));
          for (var cell = 0; cell < count; cell++) {
            layout.push({ phi: phi, theta: 2 * Math.PI * cell / count });
          }
        }

        sphereCamera = new THREE.PerspectiveCamera(
          40,
          window.innerWidth / window.innerHeight,
          1,
          10000
        );
        sphereCamera.position.z = 3000;
        sphereScene = new THREE.Scene();

        for (var i = 0; i < layout.length; i++) {
          var tile = document.createElement('div');
          tile.className = 'element';
          var img = document.createElement('img');
          var imageUrl = images[i % images.length];
          img.src = imageMap[imageUrl] || imageUrl;
          img.alt = 'Kỷ niệm ' + ((i % images.length) + 1);
          tile.appendChild(img);

          var object = new THREE.CSS3DObject(tile);
          object.position.set(
            Math.random() * 4000 - 2000,
            Math.random() * 4000 - 2000,
            Math.random() * 4000 - 2000
          );
          sphereScene.add(object);
          sphereObjects.push(object);
        }

        var vector = new THREE.Vector3();
        var spherical = new THREE.Spherical();
        var radius = mobile ? 540 : 800;
        for (i = 0; i < sphereObjects.length; i++) {
          var target = new THREE.Object3D();
          spherical.set(radius, layout[i].phi, layout[i].theta);
          target.position.setFromSpherical(spherical);
          vector.copy(target.position).multiplyScalar(2);
          target.lookAt(vector);
          sphereTargets.push(target);

          var innerTarget = new THREE.Object3D();
          spherical.set(radius, layout[i].phi, layout[i].theta);
          innerTarget.position.setFromSpherical(spherical);
          innerTarget.lookAt(new THREE.Vector3(0, 0, 0));
          sphereInnerTargets.push(innerTarget);
        }

        sphereRenderer = new THREE.CSS3DRenderer();
        sphereRenderer.setSize(window.innerWidth, window.innerHeight);
        sphereRenderer.domElement.style.position = 'absolute';
        sphereRenderer.domElement.style.background = 'transparent';
        sphereEl.appendChild(sphereRenderer.domElement);

        sphereControls = new THREE.TrackballControls(sphereCamera, sphereRenderer.domElement);
        sphereControls.rotateSpeed = 0.5;
        sphereControls.minDistance = 500;
        sphereControls.maxDistance = 6000;
        sphereControls.noRotate = true;
        sphereControls.noPan = true;
        sphereControls.noZoom = true;
        sphereControls.enabled = false;

        sphereTransform = function (targets, duration) {
          TWEEN.removeAll();
          for (var index = 0; index < sphereObjects.length; index++) {
            new TWEEN.Tween(sphereObjects[index].position)
              .to({
                x: targets[index].position.x,
                y: targets[index].position.y,
                z: targets[index].position.z
              }, Math.random() * duration + duration)
              .easing(TWEEN.Easing.Exponential.InOut)
              .start();
            new TWEEN.Tween(sphereObjects[index].rotation)
              .to({
                x: targets[index].rotation.x,
                y: targets[index].rotation.y,
                z: targets[index].rotation.z
              }, Math.random() * duration + duration)
              .easing(TWEEN.Easing.Exponential.InOut)
              .start();
          }
        };

        var pointerDown = { x: 0, y: 0 };
        var dragDistance = 0;
        var pointerActive = false;
        sphereRenderer.domElement.addEventListener('pointerdown', function (event) {
          if (event.button && event.button !== 0) return;
          pointerActive = true;
          pointerDown.x = event.clientX;
          pointerDown.y = event.clientY;
          dragDistance = 0;
        });
        sphereRenderer.domElement.addEventListener('pointermove', function (event) {
          if (!pointerActive) return;
          var dx = event.clientX - pointerDown.x;
          var dy = event.clientY - pointerDown.y;
          dragDistance = Math.max(dragDistance, Math.sqrt(dx * dx + dy * dy));
        });
        sphereRenderer.domElement.addEventListener('pointerup', function () {
          if (!pointerActive) return;
          pointerActive = false;
          if (dragDistance <= 12) enterSphere();
        });
        sphereRenderer.domElement.addEventListener('pointercancel', function () {
          pointerActive = false;
        });

        window.addEventListener('resize', function () {
          if (!sphereRenderer || !sphereCamera) return;
          sphereCamera.aspect = window.innerWidth / window.innerHeight;
          sphereCamera.updateProjectionMatrix();
          sphereRenderer.setSize(window.innerWidth, window.innerHeight);
          sphereControls.handleResize();
        });

        sphereReady = true;
        return true;
      });
    }

    function showSphereStage() {
      document.body.classList.remove('is-gated');

      // Nothing to show, or the visitor asked for calm: go straight there.
      if (!images.length || reduceMotion) {
        endFlight();
        return;
      }

      landingEl.hidden = true;
      globeEl.hidden = false;
      document.body.classList.add('is-flying');
      sphereStage.hidden = false;
      memoryStage.hidden = true;
      hud.classList.remove('is-visible');
      sphereBuildPromise.then(function (built) {
        if (!built || sphereStage.hidden) {
          if (!built) endFlight();
          return;
        }
        sphereEl.classList.add('active');
        if (!sphereHasAssembled) {
          sphereTransform(sphereTargets, 2000);
          sphereHasAssembled = true;
        }
        if (!spherePreview.running) {
          spherePreview.running = true;
          spherePreview.startedAt = window.performance.now();
          spherePreview.raf = window.requestAnimationFrame(stepSpherePreview);
        }
      });
    }

    function stepSpherePreview(now) {
      if (!spherePreview.running) return;
      sphereScene.rotation.y += 0.004;
      TWEEN.update();
      sphereControls.update();
      sphereRenderer.render(sphereScene, sphereCamera);
      spherePreview.raf = window.requestAnimationFrame(stepSpherePreview);
    }

    function enterSphere() {
      if (!sphereReady || !spherePreview.running || sphereIsEntering || flight.running) return;
      sphereIsEntering = true;
      sphereTransform(sphereInnerTargets, 1500);
      new TWEEN.Tween(sphereCamera.position)
        .to({ x: 0, y: 0, z: window.innerWidth < 768 ? 180 : 0 }, 2000)
        .easing(TWEEN.Easing.Cubic.InOut)
        .onComplete(function () {
          sphereIsEntering = false;
          startFlight();
        })
        .start();
    }

    function startFlight() {
      if (!sphereReady || !spherePreview.running || flight.running) return;
      spherePreview.running = false;
      if (spherePreview.raf) window.cancelAnimationFrame(spherePreview.raf);
      spherePreview.raf = 0;
      sphereEl.classList.remove('active');
      sphereStage.hidden = true;
      memoryStage.hidden = false;
      TWEEN.removeAll();
      sphereCamera.position.set(0, 0, 3000);
      sphereObjects.forEach(function (object, index) {
        object.position.copy(sphereTargets[index].position);
        object.rotation.copy(sphereTargets[index].rotation);
      });

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

      var stageIndex = clamp(Math.floor(elapsed / legMs), 0, memoryCount - 1);
      if (flight.front !== stageIndex) showMemory(stageIndex);
      updateHud(progress);
      updateStatus(progress);

      if (elapsed >= tourMs) {
        endFlight();
        return;
      }
      flight.raf = window.requestAnimationFrame(step);
    }

    /**
     * Every stage message lives on the departure board at once, so the photo
     * panel carries no caption — the board row is what tells the story.
     */
    function buildBoard() {
      var rowsEl = document.getElementById('fidsRows');
      var dotsEl = document.getElementById('globeDots');
      rowsEl.innerHTML = '';
      dotsEl.innerHTML = '';
      var dotCount = Math.max(images.length, 1);
      for (var d = 0; d < dotCount; d++) {
        dotsEl.appendChild(document.createElement('i'));
      }
      var flagCodes = boardFlagCodes(dest.cc);
      boardRows = boardMessages.map(function (text, index) {
        var row = document.createElement('li');
        row.className = 'fids-row is-wait';
        var rowCc = flagCodes[index % flagCodes.length];
        var rowFlag = flagEmoji(rowCc);

        var flag = document.createElement('span');
        flag.className = rowFlag ? 'f' : 'f is-empty';
        flag.setAttribute('aria-hidden', 'true');
        flag.textContent = rowFlag;

        var message = document.createElement('span');
        message.className = 'm';
        if (Array.from(text).length > 30) message.classList.add('is-long');
        message.textContent = text;

        var code = document.createElement('span');
        code.className = 't';
        code.textContent = BOARD_AIRLINES[rowCc] || 'BV';

        var status = document.createElement('span');
        status.className = 's';
        status.textContent = 'Chờ';

        row.appendChild(flag);
        row.appendChild(message);
        row.appendChild(code);
        row.appendChild(status);
        rowsEl.appendChild(row);
        return row;
      });
    }

    function showMemory(index) {
      flight.front = index;

      var photoIndex = images.length ? Math.min(index, images.length - 1) : -1;
      var photoUrl = photoIndex >= 0 ? images[photoIndex] : '';
      var memoryEl = document.querySelector('.globe-memory');
      memoryEl.style.setProperty('--stage-x', index % 2 === 0 ? '54px' : '-54px');
      memoryEl.style.setProperty('--stage-turn', index % 2 === 0 ? '-7deg' : '7deg');
      memoryEl.classList.remove('is-changing');
      void memoryEl.offsetWidth;
      memoryEl.classList.add('is-changing');
      var imageEl = document.getElementById('globeMemoryImage');
      var placeholderEl = document.getElementById('globeMemoryPlaceholder');
      if (photoUrl) {
        imageEl.src = photoUrl;
        imageEl.alt = 'Ảnh ' + (photoIndex + 1);
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

      var photoTotal = Math.max(images.length, 1);
      var photoShown = photoIndex >= 0 ? photoIndex : 0;
      document.getElementById('globeStep').textContent =
        'Ảnh ' + (photoShown < 9 ? '0' : '') + (photoShown + 1) + ' / ' +
        (photoTotal < 10 ? '0' : '') + photoTotal;

      var dots = document.getElementById('globeDots').children;
      for (var d = 0; d < dots.length; d++) {
        dots[d].classList.toggle('is-now', d === photoShown);
      }

      boardRows.forEach(function (row, rowIndex) {
        var state = index >= boardRows.length
          ? 'is-done'
          : rowIndex < index ? 'is-done' : rowIndex > index ? 'is-wait' : 'is-now';
        row.className = 'fids-row ' + state;
        row.lastChild.textContent =
          state === 'is-done' ? 'Đã qua' : state === 'is-now' ? 'Đang bay' : 'Chờ';
      });

      var active = index < boardRows.length ? boardRows[index] : boardRows[boardRows.length - 1];
      if (active && active.scrollIntoView) {
        active.scrollIntoView({ block: 'nearest', behavior: reduceMotion ? 'auto' : 'smooth' });
      }
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
      spherePreview.running = false;
      if (spherePreview.raf) window.cancelAnimationFrame(spherePreview.raf);
      spherePreview.raf = 0;
      sphereEl.classList.remove('active');
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
      document.getElementById('facts').hidden = true;
      document.getElementById('clocks').hidden = true;
      document.getElementById('clocksNote').hidden = true;
    }

    function startClocks() {}

    function buildRecap() {
      if (images.length === 0) return;
      var recap = document.getElementById('recap');
      var grid = document.getElementById('recapGrid');
      images.forEach(function (url, imageIndex) {
        var figure = document.createElement('figure');
        figure.className = 'recap-item';

        var img = document.createElement('img');
        img.src = url;
        img.alt = 'Kỷ niệm ' + (imageIndex + 1);
        img.loading = 'lazy';
        figure.appendChild(img);
        grid.appendChild(figure);
      });
      recap.hidden = false;
    }

    function scrollLetterIntoCenter() {
      var box = letterPaper.getBoundingClientRect();
      var target = window.scrollY + box.top + box.height / 2 - window.innerHeight / 2;
      window.scrollTo({
        top: Math.max(0, target),
        behavior: reduceMotion ? 'auto' : 'smooth'
      });
    }

    /**
     * Flap opens, the paper slides out, then zooms to readable size.
     * No book-fold open — that was the Love Letter card flip.
     */
    function openEnvelope() {
      if (envelopeOpen) return;
      envelopeOpen = true;
      window.clearTimeout(envelopeHideTimer);
      window.clearTimeout(letterHideTimer);
      window.clearTimeout(letterRaiseTimer);
      window.clearTimeout(letterOpenTimer);

      letterPaper.hidden = false;
      envelope.classList.add('is-open');
      envelope.setAttribute('aria-expanded', 'true');

      if (reduceMotion) {
        letterPaper.classList.remove('is-sealed', 'is-raised');
        letterPaper.classList.add('is-expanded');
        envelope.classList.add('is-away');
        envelope.hidden = true;
        scrollLetterIntoCenter();
        return;
      }

      letterRaiseTimer = window.setTimeout(function () {
        letterPaper.classList.remove('is-sealed', 'is-expanded');
        letterPaper.classList.add('is-raised');
      }, 280);

      letterOpenTimer = window.setTimeout(function () {
        letterPaper.classList.remove('is-raised');
        letterPaper.classList.add('is-expanded');
        envelope.classList.add('is-away');
        scrollLetterIntoCenter();
      }, 980);

      envelopeHideTimer = window.setTimeout(function () {
        envelope.hidden = true;
        scrollLetterIntoCenter();
      }, 1550);
    }

    function sealEnvelope() {
      envelopeOpen = false;
      window.clearTimeout(envelopeHideTimer);
      window.clearTimeout(letterHideTimer);
      window.clearTimeout(letterRaiseTimer);
      window.clearTimeout(letterOpenTimer);

      envelope.hidden = false;
      void envelope.offsetWidth;
      envelope.classList.remove('is-open', 'is-away');
      envelope.setAttribute('aria-expanded', 'false');
      letterPaper.classList.remove('is-raised', 'is-expanded');
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
