(function () {
  'use strict';

  var startWrap = document.getElementById('start-wrap');
  var started = false;

  function start() {
    if (started) return;

    var canvas = document.querySelector('canvas');
    if (!canvas) return;

    started = true;
    startWrap.classList.add('done');
    canvas.dispatchEvent(new MouseEvent('click', {
      bubbles: true,
      cancelable: true,
      view: window
    }));

    window.setTimeout(function () {
      startWrap.hidden = true;
    }, 600);
  }

  startWrap.addEventListener('click', start);
  startWrap.addEventListener('keydown', function (event) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      start();
    }
  });
})();
