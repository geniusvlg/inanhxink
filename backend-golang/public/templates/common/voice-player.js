(function () {
  'use strict';

  function initVoicePlayer() {
    var rootData = window.dataFromSubdomain;
    var data = rootData && rootData.data ? rootData.data : {};
    var voiceUrl = data.voiceRecordingUrl;
    var musicUrl = data.musicUrl;
    if ((!voiceUrl && !musicUrl) || document.getElementById('inxk-voice-player')) return;

    var container = document.createElement('div');
    container.id = 'inxk-voice-player';

    var button = document.createElement('button');
    button.type = 'button';
    button.className = 'inxk-voice-button';

    container.appendChild(button);
    var voiceAudio = null;
    if (voiceUrl) {
      voiceAudio = document.createElement('audio');
      voiceAudio.src = voiceUrl;
      voiceAudio.preload = 'metadata';
      // Voice messages play once per listen, not on loop — the button lets
      // the customer hear it again as many times as they like.
      voiceAudio.loop = false;
      voiceAudio.playsInline = true;
      voiceAudio.id = 'inxk-voice-audio';
      container.appendChild(voiceAudio);
    }
    document.body.appendChild(container);

    function audioElements() {
      return Array.prototype.slice.call(document.querySelectorAll('audio'));
    }

    // ── Voice recording: single "Nghe lại lời nhắn" (replay) button ──────────
    // Every template has its own "reveal" moment (open the gift box, open the
    // envelope, tap to start, fill the heart, etc). The voice recording should
    // stay silent until that reveal happens, then play once; the button lets
    // the customer hear it again afterwards, any number of times.
    if (voiceAudio) {
      button.classList.add('inxk-voice-button--replay');
      button.setAttribute('aria-label', 'Nghe lại lời nhắn giọng nói');
      button.innerHTML =
        '<span class="inxk-voice-icon" aria-hidden="true">🔁</span>' +
        '<span class="inxk-voice-label">Nghe lại lời nhắn</span>';

      var voiceRevealed = false;

      function playVoiceFromStart() {
        voiceAudio.muted = false;
        try { voiceAudio.currentTime = 0; } catch (e) {}
        voiceAudio.play().catch(function () {});
      }

      function revealVoice() {
        if (voiceRevealed) return;
        voiceRevealed = true;
        button.hidden = false;
        playVoiceFromStart();
      }

      // birthdaycake's gift-box.js dispatches this once the box is opened
      // (its own tap/drag gesture handling is too involved to duplicate here).
      var giftBoxEl = document.getElementById('gift-cube');

      // Other templates' reveal action is a plain click/tap on one element —
      // watch it directly instead of touching each template's own script.
      var CLICK_REVEAL_IDS = [
        'openLetterBtn',        // loveletter — envelope seal
        'start-button',         // letterinspace — start button
        'startBtn',             // birthday — tap-to-start button
        'heartScreen',          // specialgift — tap the heart to open
        'tap-to-start-overlay'  // galaxy — tap-to-start button
      ];
      var clickRevealEl = null;
      if (!giftBoxEl) {
        for (var i = 0; i < CLICK_REVEAL_IDS.length; i++) {
          var candidate = document.getElementById(CLICK_REVEAL_IDS[i]);
          if (candidate) { clickRevealEl = candidate; break; }
        }
      }

      // lovedays — reveal isn't a single tap, it's the heart filling up over
      // several clicks, which then adds an "open" class to the message
      // overlay. Watch for that instead.
      var lovedaysOverlayEl = (!giftBoxEl && !clickRevealEl)
        ? document.getElementById('messageOverlay')
        : null;

      if (giftBoxEl) {
        button.hidden = true;
        window.addEventListener('inxk:giftbox-open', function onReveal() {
          window.removeEventListener('inxk:giftbox-open', onReveal);
          // Fires from within the box's own click/keydown handler, so this
          // is still inside a user-gesture call stack and allowed to autoplay.
          revealVoice();
        });
      } else if (clickRevealEl) {
        button.hidden = true;
        var onRevealInteract = function () {
          clickRevealEl.removeEventListener('click', onRevealInteract);
          clickRevealEl.removeEventListener('touchstart', onRevealInteract);
          revealVoice();
        };
        clickRevealEl.addEventListener('click', onRevealInteract);
        // Some templates call preventDefault() on their own touchstart
        // handler for this element, which suppresses the synthetic click —
        // listen for touchstart too so mobile still triggers the reveal.
        clickRevealEl.addEventListener('touchstart', onRevealInteract);
      } else if (lovedaysOverlayEl) {
        button.hidden = true;
        var overlayObserver = new MutationObserver(function () {
          if (lovedaysOverlayEl.classList.contains('open')) {
            overlayObserver.disconnect();
            revealVoice();
          }
        });
        overlayObserver.observe(lovedaysOverlayEl, { attributes: true, attributeFilter: ['class'] });
      } else {
        // No known reveal moment on this page — try to play right away; if
        // the browser blocks autoplay, fall back to the first tap anywhere.
        var unlockEvents = ['click', 'touchstart', 'keydown'];
        function unlockVoice() {
          revealVoice();
        }
        voiceAudio.play().then(function () { voiceRevealed = true; }).catch(function () {
          unlockEvents.forEach(function (eventName) {
            document.addEventListener(eventName, unlockVoice, { once: true });
          });
        });
      }

      button.addEventListener('click', playVoiceFromStart);
      return;
    }

    // ── Background music only: original mute/unmute toggle for the page's
    //    own <audio> element(s) ───────────────────────────────────────────────
    var isMuted = false;

    function playAvailableAudio() {
      var attempts = audioElements().filter(function (audio) {
        return audio.src || audio.currentSrc;
      }).map(function (audio) {
        return audio.play();
      });
      return Promise.all(attempts);
    }

    function setMuted(muted) {
      isMuted = muted;
      audioElements().forEach(function (audio) { audio.muted = muted; });
      button.classList.toggle('is-muted', muted);
      button.setAttribute('aria-pressed', muted ? 'true' : 'false');
      button.setAttribute('aria-label', muted ? 'Bật âm thanh' : 'Tắt âm thanh');
      button.innerHTML =
        '<span class="inxk-voice-icon" aria-hidden="true">' + (muted ? '🔇' : '🔊') + '</span>' +
        '<span class="inxk-voice-label">' + (muted ? 'Bật âm' : 'Tắt âm') + '</span>';
    }

    function tryAutoplay() {
      playAvailableAudio().then(removeUnlockListeners).catch(function () {
        addUnlockListeners();
      });
    }

    button.addEventListener('click', function () {
      setMuted(!isMuted);
      if (!isMuted) tryAutoplay();
    });

    var unlockEvents = ['click', 'touchstart', 'keydown'];
    function unlockAudio() {
      playAvailableAudio().then(removeUnlockListeners).catch(function () {});
    }
    function addUnlockListeners() {
      unlockEvents.forEach(function (eventName) {
        document.addEventListener(eventName, unlockAudio, { once: true });
      });
    }
    function removeUnlockListeners() {
      unlockEvents.forEach(function (eventName) {
        document.removeEventListener(eventName, unlockAudio);
      });
    }

    var observer = new MutationObserver(function () {
      audioElements().forEach(function (audio) { audio.muted = isMuted; });
    });
    observer.observe(document.body, { childList: true, subtree: true });

    setMuted(false);
    tryAutoplay();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initVoicePlayer);
  } else {
    initVoicePlayer();
  }
})();
