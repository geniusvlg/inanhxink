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
    button.setAttribute('aria-label', 'Tắt âm lời nhắn giọng nói');
    button.setAttribute('aria-pressed', 'false');
    button.innerHTML = '<span class="inxk-voice-icon" aria-hidden="true">🔊</span><span class="inxk-voice-label">Tắt âm</span>';

    container.appendChild(button);
    var voiceAudio = null;
    if (voiceUrl) {
      voiceAudio = document.createElement('audio');
      voiceAudio.src = voiceUrl;
      voiceAudio.preload = 'metadata';
      voiceAudio.loop = true;
      voiceAudio.playsInline = true;
      voiceAudio.id = 'inxk-voice-audio';
      container.appendChild(voiceAudio);
    }
    document.body.appendChild(container);

    // Templates with a "gift box" reveal moment (currently: birthdaycake)
    // dispatch 'inxk:giftbox-open' once the customer taps the box open.
    // For those, the voice recording should stay silent until that happens
    // instead of autoplaying immediately on page load.
    var giftBoxEl = document.getElementById('gift-cube');
    var deferVoiceUntilReveal = !!(voiceAudio && giftBoxEl);
    var voiceRevealed = !deferVoiceUntilReveal;

    var isMuted = false;

    function audioElements() {
      return Array.prototype.slice.call(document.querySelectorAll('audio'));
    }

    function playAvailableAudio() {
      var attempts = audioElements().filter(function (audio) {
        if (audio === voiceAudio && !voiceRevealed) return false;
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
      button.querySelector('.inxk-voice-icon').textContent = muted ? '🔇' : '🔊';
      button.querySelector('.inxk-voice-label').textContent = muted ? 'Bật âm' : 'Tắt âm';
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

    if (deferVoiceUntilReveal) {
      window.addEventListener('inxk:giftbox-open', function onReveal() {
        window.removeEventListener('inxk:giftbox-open', onReveal);
        if (voiceRevealed) return;
        voiceRevealed = true;
        voiceAudio.muted = isMuted;
        // Fires from within the box's own click/keydown handler, so this is
        // still inside a user-gesture call stack and allowed to autoplay.
        voiceAudio.play().catch(function () {});
      });
    }

    setMuted(false);
    tryAutoplay();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initVoicePlayer);
  } else {
    initVoicePlayer();
  }
})();
