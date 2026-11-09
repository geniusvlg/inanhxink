(function () {
  'use strict';

  var DEFAULTS = {
    introTitle: 'Cốc cốc, có quà cho em đây 💖',
    introHint: 'Chạm vào ảnh, có điều bất ngờ',
    title: 'Gửi người anh yêu 💖',
    lines: [
      '💖 Gửi em — tình yêu của anh',
      'Cảm ơn em vì đã đến bên đời anh 🌹',
      'Yêu em — hôm nay, ngày mai và mãi mãi 💕✨'
    ],
    letterTitle: 'Gửi Người Anh Yêu 💖',
    content: '💘 Em à, mỗi ngày bên em đều là một ngày đặc biệt của anh. Cảm ơn em vì đã yêu anh, vì đã luôn ở đây cùng anh đi qua bao buồn vui. Anh hứa sẽ yêu thương, trân trọng và che chở em suốt cuộc đời này. Mãi yêu em 💕'
  };

  var FALLBACK_PHOTO = '/templates/giftflower/images/girl.jpeg';

  function payload() {
    var root = window.dataFromSubdomain && window.dataFromSubdomain.data;
    return root && typeof root === 'object' ? root : {};
  }

  function text(value, fallback) {
    return typeof value === 'string' && value.trim() ? value.trim() : fallback;
  }

  function linesOf(raw) {
    if (!Array.isArray(raw)) return DEFAULTS.lines.slice();
    var lines = raw.map(function (item) {
      return typeof item === 'string' ? item.trim() : '';
    }).filter(Boolean).slice(0, 3);
    return lines.length ? lines : DEFAULTS.lines.slice();
  }

  function imagesOf(raw) {
    if (!Array.isArray(raw)) return [];
    return raw.filter(function (item) {
      return typeof item === 'string' && item.trim();
    }).map(function (item) {
      return item.trim();
    }).slice(0, 8);
  }

  function whenDomReady(fn) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn);
    else setTimeout(fn, 0);
  }

  function reducedMotion() {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  function unitsOf(value) {
    return Array.from(value);
  }

  function paint(el, value, cursor) {
    el.textContent = value + (cursor ? '|' : '');
  }

  function typeOnce(el, full) {
    if (!el) return;
    if (reducedMotion()) {
      el.textContent = full;
      return;
    }
    var units = unitsOf(full);
    var index = 0;
    var cursor = true;
    var blink = setInterval(function () { cursor = !cursor; }, 500);
    var step = setInterval(function () {
      index += 1;
      if (index >= units.length) {
        clearInterval(step);
        clearInterval(blink);
        el.textContent = full;
        return;
      }
      paint(el, units.slice(0, index).join(''), cursor);
    }, 85);
  }

  function typeCycle(el, lines) {
    if (!el) return;
    if (reducedMotion()) {
      el.textContent = lines[0];
      return;
    }
    var line = 0;
    var index = 0;
    var deleting = false;
    var hold = 0;
    var cursor = true;
    setInterval(function () { cursor = !cursor; }, 500);
    setInterval(function () {
      var units = unitsOf(lines[line]);
      if (hold > 0) {
        hold -= 1;
        paint(el, lines[line], cursor);
        return;
      }
      if (!deleting) {
        index += 1;
        paint(el, units.slice(0, index).join(''), cursor);
        if (index >= units.length) {
          deleting = true;
          hold = 22;
        }
        return;
      }
      index -= 2;
      if (index <= 0) {
        deleting = false;
        index = 0;
        line = (line + 1) % lines.length;
        paint(el, '', cursor);
        return;
      }
      paint(el, units.slice(0, index).join(''), cursor);
    }, 80);
  }

  var cardOpen = false;
  var ended = false;
  var hintTimer = 0;

  function hint() {
    return document.querySelector('.instruction');
  }

  function showHint() {
    var el = hint();
    if (!el || ended) return;
    el.style.display = 'block';
    el.style.opacity = '0';
    clearTimeout(hintTimer);
    hintTimer = setTimeout(function () {
      if (ended) return;
      el.style.transition = 'opacity 1s ease-in';
      el.style.opacity = '1';
    }, 100);
  }

  function hideHint() {
    var el = hint();
    clearTimeout(hintTimer);
    if (el) el.style.display = 'none';
  }

  function openCard() {
    if (cardOpen || ended) return;
    cardOpen = true;
    hideHint();
    var popup = document.getElementById('flowerPopup');
    var message = document.querySelector('.popup-message');
    if (popup) popup.classList.add('active');
    if (message) {
      message.style.opacity = '0';
      setTimeout(function () { message.style.opacity = '1'; }, 60);
    }
    showHint();
  }

  function launch(urls) {
    var box = document.getElementById('flyingImages');
    if (!box) return;
    var items = urls.length ? urls : [null];
    items.forEach(function (url, index) {
      var el = url ? document.createElement('img') : document.createElement('div');
      el.className = url ? 'flying-img' : 'flying-img flying-heart';
      if (url) {
        el.src = url;
        el.alt = '';
      } else {
        el.textContent = '♥';
      }
      var count = items.length;
      var left = count === 1 ? 50 : 8 + (84 * index / (count - 1));
      el.style.left = left + '%';
      el.style.setProperty('--fly-delay', (0.25 + index * 0.45) + 's');
      el.style.setProperty('--fly-duration', (5.4 + (index % 4) * 0.35) + 's');
      el.style.setProperty('--drift-x', ((index % 2 ? 1 : -1) * (16 + index * 8)) + 'px');
      el.style.setProperty('--rotate', ((index % 2 ? 1 : -1) * (7 + index * 2)) + 'deg');
      box.appendChild(el);
    });
  }

  function closeCard(urls) {
    if (!cardOpen || ended) return;
    ended = true;
    var popup = document.getElementById('flowerPopup');
    var message = document.querySelector('.popup-message');
    var flowers = document.querySelector('.flowers');
    if (popup) popup.classList.remove('active');
    if (message) message.style.opacity = '0';
    if (flowers) flowers.classList.add('flowers-hidden');
    hideHint();
    launch(urls);
  }

  function paintSky() {
    var host = document.getElementById('shooting-stars');
    if (!host || reducedMotion()) return;
    for (var i = 0; i < 20; i++) {
      var star = document.createElement('div');
      star.className = 'shooting-star';
      star.style.left = (Math.random() * 80 + 20) + '%';
      star.style.top = (Math.random() * 30) + '%';
      star.style.animationDelay = (Math.random() * 10) + 's';
      var size = 3 + Math.random() * 3;
      star.style.width = size + 'px';
      star.style.height = size + 'px';
      host.appendChild(star);
    }
  }

  function enterMain() {
    var intro = document.getElementById('introScreen');
    var main = document.getElementById('mainContent');
    // styles.css keeps every animation paused while body has .container,
    // and the bloom keyframes start at scale(0). Removing the class is what
    // lets the tulips grow in.
    document.body.classList.remove('container');
    if (intro) intro.classList.add('fade-out');
    if (main) main.classList.remove('hidden');
    if (typeof window.__inxkPlayBackgroundMusic === 'function') {
      window.__inxkPlayBackgroundMusic();
    }
    showHint();
  }

  function boot() {
    var data = payload();
    var images = imagesOf(data.imageUrls);
    var letterPhoto = document.querySelector('.popup-card-image img');
    var intro = document.getElementById('introScreen');
    var flowers = document.querySelector('.flowers');
    var popup = document.getElementById('flowerPopup');
    var close = document.getElementById('popupCloseBtn');

    var introTitle = document.querySelector('.intro-title');
    var introHint = document.querySelector('.intro-hint');
    var letterTitle = document.querySelector('.popup-title');
    var letterBody = document.querySelector('.popup-message');
    if (introTitle) introTitle.textContent = text(data.introTitle, DEFAULTS.introTitle);
    if (introHint) introHint.textContent = text(data.introHint, DEFAULTS.introHint);
    if (letterTitle) letterTitle.textContent = text(data.letterTitle, DEFAULTS.letterTitle);
    if (letterBody) letterBody.textContent = text(data.content, DEFAULTS.content);
    if (letterPhoto) letterPhoto.src = images[0] || FALLBACK_PHOTO;

    paintSky();
    typeOnce(document.querySelector('.teachers-day-title'), text(data.title, DEFAULTS.title));
    typeCycle(document.querySelector('.teachers-day-date'), linesOf(data.lines));

    if (intro) intro.addEventListener('click', enterMain);
    if (flowers) flowers.addEventListener('click', openCard);
    if (close) {
      close.addEventListener('click', function (event) {
        event.stopPropagation();
        closeCard(images);
      });
    }
    if (popup) {
      popup.addEventListener('click', function (event) {
        if (event.target === popup) closeCard(images);
      });
    }
    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape') closeCard(images);
    });
  }

  whenDomReady(boot);
})();
