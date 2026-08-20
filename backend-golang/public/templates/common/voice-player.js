(function () {
  'use strict';

  function parseVolume(value) {
    var n = Number(value);
    if (!isFinite(n)) return 1;
    if (n < 0) return 0;
    if (n > 1) return 1;
    return n;
  }

  var MUSIC_IDS = {
    'bg-audio': true,
    'inxk-bg-audio': true,
    audios: true,
    bgMusic: true,
    audio: true
  };
  var EXCLUDE_IDS = {
    'inxk-voice-audio': true,
    letterSound: true,
    audioPreview: true
  };

  // iOS Safari ignores HTMLMediaElement.volume. A GainNode is the only way
  // to honour musicVolume there. Never call load() from the mutation
  // observer — that loop froze pages. CORS is set once per element, and
  // MediaElementSource is created only after a user gesture.
  var audioCtx = null;
  var gainNodes = typeof WeakMap === 'function' ? new WeakMap() : null;
  var routeFailed = typeof WeakMap === 'function' ? new WeakMap() : null;
  var prepared = typeof WeakSet === 'function' ? new WeakSet() : null;
  var userGestured = false;
  var applying = false;

  function ensureAudioContext() {
    var Ctor = window.AudioContext || window.webkitAudioContext;
    if (!Ctor) return null;
    if (!audioCtx) {
      try { audioCtx = new Ctor(); } catch (e) { return null; }
    }
    if (audioCtx.state === 'suspended') {
      try { audioCtx.resume(); } catch (e) {}
    }
    return audioCtx;
  }

  function prepareMusicElement(audio) {
    if (!audio || (prepared && prepared.has(audio))) return;
    if (prepared) prepared.add(audio);
    audio.loop = true;
    audio.playsInline = true;
    if (!audio.crossOrigin) audio.crossOrigin = 'anonymous';
  }

  function gainFor(audio) {
    if (!gainNodes || !routeFailed) return null;
    if (!userGestured) return null;
    if (routeFailed.get(audio)) return null;
    if (gainNodes.has(audio)) {
      ensureAudioContext();
      return gainNodes.get(audio);
    }
    if (!audio.crossOrigin) {
      routeFailed.set(audio, true);
      return null;
    }
    var ctx = ensureAudioContext();
    if (!ctx) {
      routeFailed.set(audio, true);
      return null;
    }
    try {
      var source = ctx.createMediaElementSource(audio);
      var gain = ctx.createGain();
      source.connect(gain);
      gain.connect(ctx.destination);
      gainNodes.set(audio, gain);
      return gain;
    } catch (e) {
      routeFailed.set(audio, true);
      return null;
    }
  }

  function initVoicePlayer() {
    var rootData = window.dataFromSubdomain;
    var data = rootData && rootData.data ? rootData.data : {};
    var voiceUrl = data.voiceRecordingUrl;
    var musicUrl = data.musicUrl;
    var musicVolume = parseVolume(data.musicVolume);
    if ((!voiceUrl && !musicUrl) || document.getElementById('inxk-voice-player')) return;

    var needsGain = musicVolume < 1;
    var container = document.createElement('div');
    container.id = 'inxk-voice-player';

    var muteButton = document.createElement('button');
    muteButton.type = 'button';
    muteButton.className = 'inxk-voice-button inxk-voice-button--mute';
    muteButton.hidden = !musicUrl || !!document.getElementById('musicBtn');

    var replayButton = document.createElement('button');
    replayButton.type = 'button';
    replayButton.className = 'inxk-voice-button inxk-voice-button--replay';
    replayButton.setAttribute('aria-label', 'Nghe lại lời nhắn giọng nói');
    replayButton.innerHTML =
      '<span class="inxk-voice-icon" aria-hidden="true">🔁</span>' +
      '<span class="inxk-voice-label">Nghe lại lời nhắn</span>';
    replayButton.hidden = true;

    if (musicUrl) container.appendChild(muteButton);
    if (voiceUrl) container.appendChild(replayButton);
    document.body.appendChild(container);

    var voiceAudio = null;
    if (voiceUrl) {
      voiceAudio = document.createElement('audio');
      voiceAudio.src = voiceUrl;
      voiceAudio.preload = 'metadata';
      voiceAudio.loop = false;
      voiceAudio.playsInline = true;
      voiceAudio.volume = 1;
      voiceAudio.id = 'inxk-voice-audio';
      container.appendChild(voiceAudio);
    }

    function audioElements() {
      return Array.prototype.slice.call(document.querySelectorAll('audio'));
    }

    function isMusicAudio(audio) {
      if (!audio || audio === voiceAudio) return false;
      if (EXCLUDE_IDS[audio.id]) return false;
      if (MUSIC_IDS[audio.id]) return true;
      return false;
    }

    function musicAudioElements() {
      return audioElements().filter(isMusicAudio);
    }

    var musicMuted = false;

    function applyMusicGain() {
      if (applying) return;
      applying = true;
      try {
        musicAudioElements().forEach(function (audio) {
          prepareMusicElement(audio);
          var gain = needsGain ? gainFor(audio) : null;
          if (gain) {
            gain.gain.value = musicMuted ? 0 : musicVolume;
            audio.muted = musicMuted;
            try { audio.volume = 1; } catch (e) {}
            return;
          }
          audio.muted = musicMuted;
          try { audio.volume = musicMuted ? 0 : musicVolume; } catch (e) {}
        });
      } finally {
        applying = false;
      }
    }

    if (musicUrl) {
      var existingMusic = musicAudioElements();
      if (existingMusic.length === 0) {
        var musicAudio = document.createElement('audio');
        musicAudio.id = 'inxk-bg-audio';
        prepareMusicElement(musicAudio);
        musicAudio.src = musicUrl;
        musicAudio.preload = 'auto';
        container.appendChild(musicAudio);
      } else {
        existingMusic.forEach(function (audio) {
          prepareMusicElement(audio);
          if (!(audio.src || audio.currentSrc)) {
            audio.src = musicUrl;
            audio.preload = 'auto';
          }
        });
      }
    }

    function playMusic() {
      applyMusicGain();
      return Promise.all(musicAudioElements().map(function (audio) {
        if (!(audio.src || audio.currentSrc)) return Promise.resolve();
        return audio.play();
      }));
    }

    function setMuted(muted) {
      musicMuted = muted;
      muteButton.classList.toggle('is-muted', muted);
      muteButton.setAttribute('aria-pressed', muted ? 'true' : 'false');
      muteButton.setAttribute('aria-label', muted ? 'Bật nhạc nền' : 'Tắt nhạc nền');
      muteButton.innerHTML =
        '<span class="inxk-voice-icon" aria-hidden="true">' + (muted ? '🔇' : '🔊') + '</span>' +
        '<span class="inxk-voice-label">' + (muted ? 'Bật nhạc' : 'Tắt nhạc') + '</span>';
      applyMusicGain();
    }

    var unlockEvents = ['click', 'touchstart', 'keydown'];
    function unlockMusic() {
      playMusic().then(removeMusicUnlockListeners).catch(function () {});
    }
    function addMusicUnlockListeners() {
      unlockEvents.forEach(function (eventName) {
        document.addEventListener(eventName, unlockMusic, { once: true });
      });
    }
    function removeMusicUnlockListeners() {
      unlockEvents.forEach(function (eventName) {
        document.removeEventListener(eventName, unlockMusic);
      });
    }

    function tryAutoplayMusic() {
      if (!musicUrl) return;
      playMusic().then(removeMusicUnlockListeners).catch(function () {
        addMusicUnlockListeners();
      });
    }

    if (musicUrl) {
      muteButton.addEventListener('click', function () {
        setMuted(!musicMuted);
        if (!musicMuted) tryAutoplayMusic();
      });
      setMuted(false);
      tryAutoplayMusic();
    }

    if (voiceAudio) {
      function playVoiceFromStart() {
        voiceAudio.muted = false;
        voiceAudio.volume = 1;
        try { voiceAudio.currentTime = 0; } catch (e) {}
        playMusic().catch(function () {});
        voiceAudio.play().catch(function () {});
      }

      var voiceRevealed = false;
      function revealVoice() {
        if (voiceRevealed) return;
        voiceRevealed = true;
        replayButton.hidden = false;
        playVoiceFromStart();
      }

      var giftBoxEl = document.getElementById('gift-cube');
      var CLICK_REVEAL_IDS = [
        'openLetterBtn',
        'start-button',
        'startBtn',
        'startJourney',
        'heartScreen',
        'tap-to-start-overlay',
        'start-wrap'
      ];
      var clickRevealEl = null;
      if (!giftBoxEl) {
        for (var i = 0; i < CLICK_REVEAL_IDS.length; i++) {
          var candidate = document.getElementById(CLICK_REVEAL_IDS[i]);
          if (candidate) { clickRevealEl = candidate; break; }
        }
      }
      var lovedaysOverlayEl = (!giftBoxEl && !clickRevealEl)
        ? document.getElementById('messageOverlay')
        : null;

      if (giftBoxEl) {
        window.addEventListener('inxk:giftbox-open', function onReveal() {
          window.removeEventListener('inxk:giftbox-open', onReveal);
          revealVoice();
        });
      } else if (clickRevealEl) {
        var onRevealInteract = function () {
          clickRevealEl.removeEventListener('click', onRevealInteract);
          clickRevealEl.removeEventListener('touchstart', onRevealInteract);
          revealVoice();
        };
        clickRevealEl.addEventListener('click', onRevealInteract);
        clickRevealEl.addEventListener('touchstart', onRevealInteract);
      } else if (lovedaysOverlayEl) {
        var overlayObserver = new MutationObserver(function () {
          if (lovedaysOverlayEl.classList.contains('open')) {
            overlayObserver.disconnect();
            revealVoice();
          }
        });
        overlayObserver.observe(lovedaysOverlayEl, { attributes: true, attributeFilter: ['class'] });
      } else {
        replayButton.hidden = false;
        voiceAudio.play().then(function () {
          voiceRevealed = true;
        }).catch(function () {
          unlockEvents.forEach(function (eventName) {
            document.addEventListener(eventName, revealVoice, { once: true });
          });
        });
      }

      replayButton.addEventListener('click', playVoiceFromStart);
    }

    ['pointerdown', 'touchstart', 'keydown'].forEach(function (eventName) {
      document.addEventListener(eventName, function onFirstGesture() {
        document.removeEventListener(eventName, onFirstGesture);
        userGestured = true;
        applyMusicGain();
      }, true);
    });

    var observer = new MutationObserver(function () {
      applyMusicGain();
      if (musicUrl) muteButton.hidden = !!document.getElementById('musicBtn');
    });
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['src'] });
    document.addEventListener('play', function (event) {
      if (event.target !== voiceAudio) applyMusicGain();
    }, true);
    applyMusicGain();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initVoicePlayer);
  } else {
    initVoicePlayer();
  }
})();
