(function () {
  function whenDomReady(cb) {
    if (document.readyState !== 'loading') setTimeout(cb, 0);
    else document.addEventListener('DOMContentLoaded', cb);
  }

  whenDomReady(function init() {
    if (window.__WAXSEAL_INIT__) return;
    window.__WAXSEAL_INIT__ = true;

    var payload = window.dataFromSubdomain || {};
    var data = payload.data || {};
    var name = text(data.recipientName, 'bạn');
    var images = Array.isArray(data.imageUrls) ? data.imageUrls.filter(Boolean) : [];

    setText('dear-line', 'Dear ' + name);
    setText('seal-name', sealWord(name));
    setText('cover-line', text(data.coverLine, 'I got you something special.'));
    setText('retry-2', 'It’s all for you, ' + name + '!');
    setText('bday-title', text(data.birthdayTitle, 'Happy Birthday'));
    setText('bday-date', text(data.birthdayDate, ''));
    setText('teaser', text(data.teaserLine, 'You have been'));
    setText('letter-body', text(data.content, ''));
    setText('letter-signoff', text(data.signoff, ''));
    setText('letter-sender', text(data.senderName, ''));

    var hero = document.getElementById('hero-polaroid');
    var heroPhoto = document.getElementById('hero-photo');
    if (images[0] && hero && heroPhoto) {
      heroPhoto.src = images[0];
      heroPhoto.alt = 'Ảnh của ' + name;
      hero.hidden = false;
    }

    renderBouquet(images.slice(0, 3));
    renderMemories(images);

    var vinyl = document.getElementById('vinyl');
    if (vinyl && data.musicUrl) {
      vinyl.hidden = false;
      vinyl.addEventListener('click', function () {
        if (typeof window.__inxkPlayBackgroundMusic === 'function') {
          window.__inxkPlayBackgroundMusic();
        }
      });
    }

    document.querySelectorAll('[data-go]').forEach(function (button) {
      button.addEventListener('pointerdown', onAdvance, true);
      button.addEventListener('click', onAdvance);
    });

    var openSeal = document.getElementById('open-seal');
    if (openSeal) {
      openSeal.addEventListener('pointerdown', function (event) {
        if (event.button !== undefined && event.button !== 0) return;
        ignoreClick = true;
        show('gate');
      }, true);
      openSeal.addEventListener('click', function () {
        if (ignoreClick) {
          ignoreClick = false;
          return;
        }
        show('gate');
      });
    }
  });

  var ignoreClick = false;

  function onAdvance(event) {
    if (event.button !== undefined && event.button !== 0) return;
    var target = event.currentTarget.getAttribute('data-go');
    if (!target) return;
    if (event.type === 'pointerdown') {
      ignoreClick = true;
      event.preventDefault();
      show(target);
      return;
    }
    if (ignoreClick) {
      ignoreClick = false;
      return;
    }
    show(target);
  }

  function show(name) {
    document.querySelectorAll('.screen').forEach(function (screen) {
      var active = screen.getAttribute('data-screen') === name;
      screen.classList.toggle('is-active', active);
      screen.hidden = !active;
    });
  }

  function renderBouquet(images) {
    var root = document.getElementById('bouquet');
    if (!root) return;
    images.forEach(function (src) {
      var frame = document.createElement('span');
      frame.className = 'bloom';
      var img = document.createElement('img');
      img.src = src;
      img.alt = '';
      frame.appendChild(img);
      root.appendChild(frame);
    });
    var wrap = document.createElement('span');
    wrap.className = 'bouquet-wrap';
    var bow = document.createElement('span');
    bow.className = 'bouquet-bow';
    root.appendChild(wrap);
    root.appendChild(bow);
  }

  function renderMemories(images) {
    var root = document.getElementById('memory-grid');
    if (!root) return;
    if (!images.length) {
      var empty = document.createElement('p');
      empty.className = 'caption';
      empty.textContent = 'Our Memories';
      root.appendChild(empty);
      return;
    }
    images.forEach(function (src, index) {
      var card = document.createElement('figure');
      card.className = 'memory-card';
      var img = document.createElement('img');
      img.src = src;
      img.alt = 'Kỷ niệm ' + (index + 1);
      card.appendChild(img);
      if (index === 0) {
        var caption = document.createElement('figcaption');
        caption.textContent = 'Our Memories';
        card.appendChild(caption);
      }
      root.appendChild(card);
    });
  }

  function setText(id, value) {
    var node = document.getElementById(id);
    if (node) node.textContent = value;
  }

  function text(value, fallback) {
    var clean = typeof value === 'string' ? value.trim() : '';
    return clean || fallback;
  }

  function sealWord(name) {
    var word = name.split(/\s+/)[0] || 'love';
    return word.length > 10 ? word.slice(0, 10) : word;
  }
})();
