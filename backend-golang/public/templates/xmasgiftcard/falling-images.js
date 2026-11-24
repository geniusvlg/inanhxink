(function () {
  var data = window.dataFromSubdomain && window.dataFromSubdomain.data;
  var urls = data && Array.isArray(data.imageUrls) ? data.imageUrls.filter(Boolean) : [];
  if (!urls.length) return;

  var layer = document.createElement('div');
  layer.className = 'xgc-fall-layer';
  layer.hidden = true;
  document.body.appendChild(layer);

  var running = false;
  var timers = [];
  var maxOnScreen = 5;

  function spawn() {
    if (!running) return;
    if (layer.querySelectorAll('.xgc-fall-img').length < maxOnScreen) {
      var img = document.createElement('img');
      img.className = 'xgc-fall-img';
      img.alt = '';
      img.src = urls[Math.floor(Math.random() * urls.length)];
      var size = 72 + Math.random() * 46;
      img.style.width = size + 'px';
      img.style.height = size + 'px';
      img.style.left = (Math.random() * 82) + '%';
      var duration = 8 + Math.random() * 4;
      img.style.animationDuration = duration + 's';
      img.style.setProperty('--xgc-rot', (Math.random() * 24 - 12) + 'deg');
      layer.appendChild(img);
      timers.push(window.setTimeout(function () { img.remove(); }, duration * 1000 + 300));
    }
    timers.push(window.setTimeout(spawn, 1600 + Math.random() * 800));
  }

  function start() {
    if (running) return;
    running = true;
    layer.hidden = false;
    timers.push(window.setTimeout(spawn, 400));
  }

  function stop() {
    if (!running) return;
    running = false;
    layer.hidden = true;
    timers.forEach(function (id) { window.clearTimeout(id); });
    timers = [];
    layer.replaceChildren();
  }

  function mountBehindTree() {
    var box = document.querySelector('[class*="container-christmas-tree"]');
    if (!box) return false;
    if (layer.parentElement !== box) box.insertBefore(layer, box.firstChild);
    return true;
  }

  function sync() {
    if (document.querySelector('[class*="canvas-christmas-tree"]') && mountBehindTree()) start();
    else stop();
  }

  var observer = new MutationObserver(sync);
  observer.observe(document.body, { childList: true, subtree: true });
  sync();

  var viewer = document.createElement('div');
  viewer.className = 'xgc-viewer';
  viewer.hidden = true;
  viewer.innerHTML = '<button type="button" class="xgc-viewer-close" aria-label="Đóng">×</button><img alt="">';
  document.body.appendChild(viewer);
  var viewerImg = viewer.querySelector('img');

  function imageAt(x, y) {
    var imgs = layer.querySelectorAll('.xgc-fall-img');
    for (var i = imgs.length - 1; i >= 0; i--) {
      var rect = imgs[i].getBoundingClientRect();
      if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) return imgs[i];
    }
    return null;
  }

  var ignoreCloseClick = false;

  function openViewer(src) {
    viewerImg.src = src;
    viewer.hidden = false;
    ignoreCloseClick = true;
    window.setTimeout(function () { ignoreCloseClick = false; }, 0);
  }

  function closeViewer() {
    viewer.hidden = true;
    viewerImg.removeAttribute('src');
  }

  viewer.addEventListener('click', function (event) {
    if (ignoreCloseClick) {
      ignoreCloseClick = false;
      return;
    }
    if (event.target === viewer || event.target.closest('.xgc-viewer-close')) closeViewer();
  });
  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape' && !viewer.hidden) closeViewer();
  });

  document.addEventListener('click', function (event) {
    if (!viewer.hidden || !running) return;
    var img = imageAt(event.clientX, event.clientY);
    if (!img) return;
    event.preventDefault();
    event.stopPropagation();
    openViewer(img.currentSrc || img.src);
  }, true);

  document.addEventListener('pointermove', function (event) {
    var canvas = document.querySelector('canvas');
    if (!canvas || !running || !viewer.hidden) return;
    canvas.style.cursor = imageAt(event.clientX, event.clientY) ? 'pointer' : '';
  });
})();
