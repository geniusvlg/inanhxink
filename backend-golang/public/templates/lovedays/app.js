(function () {
  'use strict';

  var data = window.siteData || {};

  // ── Elements ─────────────────────────────────────────────────────────────────
  var heartWrapper   = document.getElementById('heartWrapper');
  var heartSvg       = document.getElementById('heartSvg');
  var gradStop1      = document.getElementById('gradStop1');
  var gradStop2      = document.getElementById('gradStop2');
  var gradStop3      = document.getElementById('gradStop3');
  var counterDays    = document.getElementById('counterDays');
  var counterTime    = document.getElementById('counterTime');
  var nameFromEl     = document.getElementById('nameFrom');
  var nameToEl       = document.getElementById('nameTo');
  var avatarFromImg  = document.getElementById('avatarFromImg');
  var avatarToImg    = document.getElementById('avatarToImg');
  var avatarFromWrap = document.getElementById('avatarFromWrap');
  var avatarToWrap   = document.getElementById('avatarToWrap');
  var annivDateEl    = document.getElementById('anniversaryDate');
  var messageOverlay = document.getElementById('messageOverlay');
  var messageText    = document.getElementById('messageText');
  var messageGallery = document.getElementById('messageGallery');
  var messageGalleryWrap = document.getElementById('messageGalleryWrap');
  var galleryDots = document.getElementById('galleryDots');
  var galleryPrev = document.getElementById('galleryPrev');
  var galleryNext = document.getElementById('galleryNext');
  var messageClose   = document.getElementById('messageClose');
  var lightbox       = document.getElementById('lightbox');
  var lightboxImg    = document.getElementById('lightboxImg');
  var audio          = document.getElementById('audio');
  var musicBtn       = document.getElementById('musicBtn');
  var iconMuted      = document.getElementById('iconMuted');
  var iconPlaying    = document.getElementById('iconPlaying');
  var themeSwitcher  = document.getElementById('themeSwitcher');
  var timelineList   = document.getElementById('timelineList');

  var galleryTimer = null;
  var galleryScrollHandler = null;
  var galleryImages = [];
  var galleryIndex = 0;

  function normalizePathForUrl(path) {
    return String(path || '').trim().replace(/ /g, '%20');
  }

  // fallback local assets for file:/// preview
  var fallbackAvatarFrom = normalizePathForUrl('./images/avatars/Screenshot 2026-04-11 at 11.02.52.png');
  var fallbackAvatarTo   = normalizePathForUrl('./images/avatars/Screenshot 2026-04-11 at 11.03.07.png');
  var fallbackGallery = [
    normalizePathForUrl('./images/images/z7705797650932_7bd0bea3ed2cc1c81395246f5357a76a.jpg'),
    normalizePathForUrl('./images/images/z7705797647874_9c292f99c35cfd076d89b53389888bde.jpg'),
    normalizePathForUrl('./images/images/z7705797649633_5fef56bddac47d1f616bc08ce9395e6f.jpg'),
    normalizePathForUrl('./images/images/z7705797648773_2213a1b8d3ae953f29c9d81e9f6e40e0.jpg')
  ];

  function toArray(value) {
    if (Array.isArray(value)) return value;
    if (typeof value === 'string' && value.trim()) {
      return value.split(',').map(function (s) { return s.trim(); }).filter(Boolean);
    }
    return [];
  }

  var popupImages = toArray(data.popupImages || data.imageUrls);
  if (popupImages.length === 0) popupImages = fallbackGallery.slice();


  var fixedMessage = [
    'Gửi em – người con gái anh thương 💌',
    '',
    'Anh không biết bắt đầu từ đâu, chỉ biết rằng từ khi có em, mọi thứ trong cuộc sống của anh đều trở nên nhẹ nhàng và ý nghĩa hơn.',
    '',
    'Em giống như một điều gì đó rất dịu dàng – không ồn ào nhưng lại khiến anh luôn muốn ở bên. Những lúc mệt mỏi, chỉ cần nghĩ đến em thôi là anh thấy lòng mình ổn lại.',
    '',
    'Anh không hứa những điều quá lớn lao, chỉ mong có thể cùng em đi qua những ngày bình thường nhất – cùng ăn, cùng cười, cùng kể nhau nghe những chuyện nhỏ xíu trong cuộc sống.',
    '',
    'Cảm ơn em vì đã xuất hiện, vì đã ở đây, và vì đã là “em” – theo cách rất riêng mà anh yêu thương 💗',
    '',
    'Nếu sau này có chuyện gì xảy ra, chỉ mong tụi mình vẫn nắm tay nhau như bây giờ.',
    '',
    'Thương em nhiều hơn những gì anh nói được 🌷'
  ].join('\n');

  // Dynamic values from order template_data
  var defaultDateISO = '2024-08-04';
  var dynamicNameFrom = (typeof data.nameFrom === 'string' && data.nameFrom.trim()) ? data.nameFrom.trim() : 'Người 1';
  var dynamicNameTo = (typeof data.nameTo === 'string' && data.nameTo.trim()) ? data.nameTo.trim() : 'Người 2';
  var dynamicDateISO = (typeof data.date === 'string' && data.date.trim()) ? data.date.trim().split('T')[0] : defaultDateISO;

  var timelineItems = Array.isArray(data.timeline) && data.timeline.length > 0
    ? data.timeline.map(function (item) {
        return {
          date: String(item && item.date ? item.date : '').trim(),
          text: String(item && item.text ? item.text : '').trim(),
        };
      }).filter(function (item) { return item.date || item.text; })
    : [
        { date: dynamicDateISO.split('-').reverse().join('/'), text: 'Ngày mình chính thức bên nhau 🌷' }
      ];

  var themeMap = {
    soft: 'soft',
    sunset: 'sunset',
    night: 'night',
    polaroid: 'polaroid'
  };

  function renderTimeline(items) {
    if (!timelineList) return;
    timelineList.innerHTML = '';
    (items || []).forEach(function (item) {
      var row = document.createElement('div');
      row.className = 'timeline-item';

      var dot = document.createElement('span');
      dot.className = 'timeline-dot';

      var content = document.createElement('div');
      var meta = document.createElement('div');
      meta.className = 'timeline-meta';
      meta.textContent = item.date || '';

      var text = document.createElement('div');
      text.className = 'timeline-text';
      text.textContent = item.text || '';

      content.appendChild(meta);
      content.appendChild(text);
      row.appendChild(dot);
      row.appendChild(content);
      timelineList.appendChild(row);
    });
  }

  function applyTheme(themeKey) {
    var theme = themeMap[themeKey] || 'soft';
    if (theme === 'soft') document.body.removeAttribute('data-theme');
    else document.body.setAttribute('data-theme', theme);

    if (!themeSwitcher) return;
    var chips = themeSwitcher.querySelectorAll('.theme-chip');
    chips.forEach(function (chip) {
      if (chip.getAttribute('data-theme') === themeKey) chip.classList.add('active');
      else chip.classList.remove('active');
    });
  }

  function bindThemeSwitcher() {
    if (!themeSwitcher) return;
    themeSwitcher.addEventListener('click', function (e) {
      var target = e.target;
      if (!(target instanceof HTMLElement)) return;
      var chip = target.closest('.theme-chip');
      if (!chip) return;
      var key = chip.getAttribute('data-theme') || 'soft';
      applyTheme(key);
    });
  }

  // ── Populate couple data ─────────────────────────────────────────────────────
  nameFromEl.textContent = dynamicNameFrom;
  nameToEl.textContent   = dynamicNameTo;

  renderTimeline(timelineItems);
  bindThemeSwitcher();
  var initialTheme = (typeof data.theme === 'string' && themeMap[data.theme]) ? data.theme : 'soft';
  applyTheme(initialTheme);

  var avatarFrom = data.avatarFrom || fallbackAvatarFrom;
  var avatarTo   = data.avatarTo   || fallbackAvatarTo;

  if (avatarFrom) {
    avatarFromImg.src = avatarFrom;
    avatarFromImg.style.display = '';
  } else {
    avatarFromImg.style.display = 'none';
  }

  if (avatarTo) {
    avatarToImg.src = avatarTo;
    avatarToImg.style.display = '';
  } else {
    avatarToImg.style.display = 'none';
  }

  // Format date as DD/MM/YYYY
  annivDateEl.textContent = dynamicDateISO.split('-').reverse().join('/');

  // ── Live counter ─────────────────────────────────────────────────────────────
  var anniversaryDate = new Date(dynamicDateISO + 'T00:00:00');

  function pad(n) {
    return String(n).padStart(2, '0');
  }

  function updateCounter() {
    if (!anniversaryDate || isNaN(anniversaryDate.getTime())) {
      counterDays.textContent = '0 DAYS';
      counterTime.textContent = '00 : 00 : 00';
      return;
    }

    var now    = new Date();
    var today  = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    var origin = new Date(anniversaryDate.getFullYear(), anniversaryDate.getMonth(), anniversaryDate.getDate());
    var diffMs = today.getTime() - origin.getTime();
    var days   = Math.max(0, Math.ceil(diffMs / 86400000));

    counterDays.textContent = days + ' DAYS';

    var midnight = new Date(anniversaryDate.getFullYear(), anniversaryDate.getMonth(), anniversaryDate.getDate(), 0, 0, 0);
    var elapsed  = Math.floor((now.getTime() - midnight.getTime()) / 1000);
    if (elapsed < 0) elapsed = 0;

    var ss  = elapsed % 60;
    var mm  = Math.floor(elapsed / 60) % 60;
    var hh  = Math.floor(elapsed / 3600) % 24;

    counterTime.textContent = pad(hh) + ' : ' + pad(mm) + ' : ' + pad(ss);
  }

  updateCounter();
  setInterval(updateCounter, 1000);

  // ── Heart — draw animation ───────────────────────────────────────────────────
  setTimeout(function () {
    heartSvg.classList.remove('draw-mode');
  }, 2000);

  // ── Heart — interactive fill on click ────────────────────────────────────────
  var fillLevel = 0;
  var auraId = 0;

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  function setGradient(pct) {
    var p = Math.min(100, Math.max(0, pct));
    gradStop1.setAttribute('offset', '0%');
    gradStop1.setAttribute('stop-color', '#ff9999');
    gradStop2.setAttribute('offset', p + '%');
    gradStop2.setAttribute('stop-color', '#ff9999');
    gradStop3.setAttribute('offset', p + '%');
    gradStop3.setAttribute('stop-color', 'transparent');
  }

  function spawnAura() {
    var id = auraId++;
    var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', 'aura-svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.innerHTML = '<path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" stroke="#ff9999" fill="none" stroke-width="0.3"/>';
    heartWrapper.appendChild(svg);
    setTimeout(function () { svg.remove(); }, 700);
  }

  function clearGalleryAutoplay() {
    if (galleryTimer) {
      clearInterval(galleryTimer);
      galleryTimer = null;
    }
  }

  function restartGalleryAutoplay() {
    clearGalleryAutoplay();
    if (!messageOverlay.classList.contains('open')) return;
    if (galleryImages.length <= 1) return;

    galleryTimer = setInterval(function () {
      goToGalleryIndex((galleryIndex + 1) % galleryImages.length);
    }, 3000);
  }

  function updateGalleryState() {
    var dots = galleryDots.querySelectorAll('.gallery-dot');
    dots.forEach(function (d, i) {
      if (i === galleryIndex) d.classList.add('active');
      else d.classList.remove('active');
    });

    if (galleryPrev) galleryPrev.disabled = galleryImages.length <= 1;
    if (galleryNext) galleryNext.disabled = galleryImages.length <= 1;

    galleryImages.forEach(function (img, i) {
      if (i === galleryIndex) img.classList.add('active');
      else img.classList.remove('active');
    });
  }

  function goToGalleryIndex(index) {
    if (!galleryImages.length) return;
    var max = galleryImages.length - 1;
    galleryIndex = Math.max(0, Math.min(max, index));
    var width = messageGallery.clientWidth || 1;
    messageGallery.scrollTo({ left: galleryIndex * width, behavior: 'smooth' });
    updateGalleryState();
  }

  function renderPopupGallery(images) {
    var list = (images || []).map(normalizePathForUrl).filter(Boolean);

    clearGalleryAutoplay();
    galleryImages = [];
    galleryIndex = 0;

    if (galleryScrollHandler) {
      messageGallery.removeEventListener('scroll', galleryScrollHandler);
      galleryScrollHandler = null;
    }

    messageGallery.innerHTML = '';
    galleryDots.innerHTML = '';

    if (list.length === 0) {
      if (messageGalleryWrap) messageGalleryWrap.style.display = 'none';
      if (galleryDots) galleryDots.style.display = 'none';
      return;
    }

    if (messageGalleryWrap) messageGalleryWrap.style.display = '';
    if (galleryDots) galleryDots.style.display = list.length > 1 ? '' : 'none';

    list.forEach(function (src, idx) {
      var img = document.createElement('img');
      img.src = src;
      img.alt = 'photo ' + (idx + 1);
      img.loading = 'lazy';
      img.className = idx === 0 ? 'active' : '';
      img.addEventListener('click', function () {
        openLightbox(src);
      });
      messageGallery.appendChild(img);
      galleryImages.push(img);

      var dot = document.createElement('span');
      dot.className = 'gallery-dot' + (idx === 0 ? ' active' : '');
      dot.dataset.index = String(idx);
      dot.addEventListener('click', function () {
        goToGalleryIndex(idx);
        restartGalleryAutoplay();
      });
      galleryDots.appendChild(dot);
    });

    galleryScrollHandler = function () {
      var width = messageGallery.clientWidth || 1;
      var nextIndex = Math.round(messageGallery.scrollLeft / width);
      if (nextIndex !== galleryIndex) {
        galleryIndex = nextIndex;
        updateGalleryState();
      }
    };

    messageGallery.addEventListener('scroll', galleryScrollHandler);

    if (galleryPrev) {
      galleryPrev.style.display = list.length > 1 ? '' : 'none';
      galleryPrev.onclick = function () {
        goToGalleryIndex(galleryIndex - 1);
        restartGalleryAutoplay();
      };
    }

    if (galleryNext) {
      galleryNext.style.display = list.length > 1 ? '' : 'none';
      galleryNext.onclick = function () {
        goToGalleryIndex(galleryIndex + 1);
        restartGalleryAutoplay();
      };
    }

    updateGalleryState();
    restartGalleryAutoplay();
  }

  heartWrapper.addEventListener('click', function () {
    fillLevel = Math.min(100, fillLevel + 4);
    setGradient(fillLevel);
    spawnAura();

    if (fillLevel >= 100 && !messageOverlay.classList.contains('open')) {
      messageOverlay.classList.add('open');
      var popupMessage = (typeof data.message === 'string' && data.message.trim()) ? data.message : fixedMessage;
      messageText.innerHTML = escapeHtml(popupMessage).replace(/\n/g, '<br>');
      renderPopupGallery(popupImages);
    }
  });

  // ── Message overlay close ────────────────────────────────────────────────────
  messageClose.addEventListener('click', function () {
    messageOverlay.classList.remove('open');
    clearGalleryAutoplay();
  });
  messageOverlay.addEventListener('click', function (e) {
    if (e.target === messageOverlay) {
      messageOverlay.classList.remove('open');
      clearGalleryAutoplay();
    }
  });

  // ── Avatar + photo lightbox ─────────────────────────────────────────────────
  function openLightbox(src) {
    lightboxImg.src = src;
    lightbox.classList.add('open');
  }

  lightbox.addEventListener('click', function () {
    lightbox.classList.remove('open');
  });

  if (avatarFrom) {
    avatarFromWrap.addEventListener('click', function () { openLightbox(avatarFrom); });
  }
  if (avatarTo) {
    avatarToWrap.addEventListener('click', function () { openLightbox(avatarTo); });
  }

  // ── Music ────────────────────────────────────────────────────────────────────
  var musicUrl = data.musicUrl || '';
  var isPlaying = false;

  function setMusicIcon(playing) {
    iconMuted.style.display = playing ? 'none' : '';
    iconPlaying.style.display = playing ? '' : 'none';
    isPlaying = playing;
  }

  function tryPlay() {
    if (!musicUrl) return;
    audio.src = musicUrl;
    audio.muted = false;
    audio.play().then(function () {
      setMusicIcon(true);
    }).catch(function () {
      setMusicIcon(false);
    });
  }

  if (musicUrl) {
    tryPlay();

    var unlockHandler = function () {
      if (!isPlaying) tryPlay();
      document.removeEventListener('click', unlockHandler);
    };
    document.addEventListener('click', unlockHandler);

    musicBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      if (isPlaying) {
        audio.pause();
        setMusicIcon(false);
      } else {
        tryPlay();
      }
    });
  } else {
    musicBtn.style.display = 'none';
  }

})();
