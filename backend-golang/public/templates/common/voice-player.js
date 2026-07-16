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
      voiceAudio.autoplay = true;
      voiceAudio.loop = true;
      voiceAudio.playsInline = true;
      voiceAudio.id = 'inxk-voice-audio';
      container.appendChild(voiceAudio);
    }
    document.body.appendChild(container);

    var isMuted = false;

    function audioElements() {
      return Array.prototype.slice.call(document.querySelectorAll('audio'));
    }

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

    setMuted(false);
    tryAutoplay();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initVoicePlayer);
  } else {
    initVoicePlayer();
  }
})();
