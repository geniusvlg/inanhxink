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

  // Mix music + voice through one AudioContext. Two HTMLAudioElements fight
  // on iOS Safari (volume is ignored, one stream ducks the other).
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
    return audioCtx;
  }

  function unlockWebAudio() {
    var ctx = ensureAudioContext();
    if (!ctx) return;
    if (ctx.state === 'suspended') {
      try { ctx.resume(); } catch (e) {}
    }
    if (ctx.__inxkUnlocked) return;
    try {
      var buffer = ctx.createBuffer(1, 1, ctx.sampleRate || 22050);
      var src = ctx.createBufferSource();
      src.buffer = buffer;
      src.connect(ctx.destination);
      src.start(0);
      ctx.__inxkUnlocked = true;
    } catch (e) {}
  }

  function decodeUrl(url) {
    return fetch(url, { mode: 'cors', credentials: 'omit' }).then(function (res) {
      if (!res.ok) throw new Error('audio fetch failed');
      return res.arrayBuffer();
    }).then(function (ab) {
      var ctx = ensureAudioContext();
      if (!ctx) throw new Error('no audio context');
      return new Promise(function (resolve, reject) {
        var copy = ab.slice(0);
        var ret = ctx.decodeAudioData(copy, resolve, reject);
        if (ret && typeof ret.then === 'function') ret.then(resolve, reject);
      });
    });
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
    if (!ctx || ctx.state !== 'running') return null;
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
      voiceAudio.crossOrigin = 'anonymous';
      voiceAudio.src = voiceUrl;
      voiceAudio.preload = 'auto';
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
    var musicBuffer = null;
    var voiceBuffer = null;
    var musicGain = null;
    var musicSource = null;
    var voiceSource = null;

    function mixerAvailable() {
      if (!ensureAudioContext()) return false;
      if (musicUrl && !musicBuffer) return false;
      if (voiceUrl && !voiceBuffer) return false;
      return !!(musicBuffer || voiceBuffer);
    }

    function silenceHtmlAudio() {
      audioElements().forEach(function (audio) {
        try { audio.pause(); } catch (e) {}
        audio.muted = true;
      });
    }

    function ensureMixerGraph() {
      var ctx = ensureAudioContext();
      if (!ctx || musicGain) return;
      musicGain = ctx.createGain();
      musicGain.gain.value = musicMuted ? 0 : musicVolume;
      musicGain.connect(ctx.destination);
    }

    function startMusicSource() {
      var ctx = ensureAudioContext();
      if (!ctx || !musicBuffer || musicSource) return;
      ensureMixerGraph();
      musicSource = ctx.createBufferSource();
      musicSource.buffer = musicBuffer;
      musicSource.loop = true;
      musicSource.connect(musicGain);
      musicSource.start(0);
    }

    function startVoiceSource() {
      var ctx = ensureAudioContext();
      if (!ctx || !voiceBuffer) return;
      if (voiceSource) {
        try { voiceSource.stop(); } catch (e) {}
        try { voiceSource.disconnect(); } catch (e) {}
        voiceSource = null;
      }
      voiceSource = ctx.createBufferSource();
      voiceSource.buffer = voiceBuffer;
      voiceSource.connect(ctx.destination);
      voiceSource.onended = function () { voiceSource = null; };
      voiceSource.start(0);
    }

    function applyMusicGain() {
      if (musicGain) {
        musicGain.gain.value = musicMuted ? 0 : musicVolume;
        return;
      }
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
      decodeUrl(musicUrl).then(function (buf) { musicBuffer = buf; }).catch(function () {});
    }
    if (voiceUrl) {
      decodeUrl(voiceUrl).then(function (buf) { voiceBuffer = buf; }).catch(function () {});
    }

    function startAllMusic() {
      return Promise.all(musicAudioElements().map(function (audio) {
        if (!(audio.src || audio.currentSrc)) return Promise.resolve();
        return audio.play().catch(function () {});
      }));
    }

    function playMix(withVoice) {
      unlockWebAudio();
      if (mixerAvailable()) {
        ensureMixerGraph();
        applyMusicGain();
        silenceHtmlAudio();
        if (musicUrl) startMusicSource();
        if (withVoice) startVoiceSource();
        removeMusicUnlockListeners();
        return Promise.resolve();
      }
      applyMusicGain();
      var playing = startAllMusic();
      if (withVoice && voiceAudio) {
        voiceAudio.muted = false;
        try { voiceAudio.currentTime = 0; } catch (e) {}
        voiceAudio.play().catch(function () {});
      }
      addMusicUnlockListeners();
      return playing;
    }

    function playMusic() {
      return playMix(false);
    }
    window.__inxkPlayBackgroundMusic = playMusic;

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

    var unlockEvents = ['pointerdown', 'touchstart', 'touchend', 'click', 'keydown'];
    function unlockMusic() {
      userGestured = true;
      playMix(voiceRevealed);
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
      addMusicUnlockListeners();
    }

    var voiceRevealed = false;

    if (musicUrl) {
      muteButton.addEventListener('click', function () {
        var turningOn = musicMuted;
        setMuted(!musicMuted);
        if (turningOn && !musicSource) playMix(false);
      });
      setMuted(false);
      tryAutoplayMusic();
    }

    if (voiceAudio) {
      function playVoiceFromStart() {
        playMix(true);
      }

      function revealVoice() {
        if (voiceRevealed) {
          playMix(true);
          return;
        }
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
        unlockEvents.forEach(function (eventName) {
          document.addEventListener(eventName, revealVoice, { once: true });
        });
      }

      replayButton.addEventListener('click', playVoiceFromStart);
    }

    ['pointerdown', 'touchstart', 'touchend', 'keydown'].forEach(function (eventName) {
      document.addEventListener(eventName, function onFirstGesture() {
        document.removeEventListener(eventName, onFirstGesture);
        userGestured = true;
        playMix(false);
      }, true);
    });

    var observer = new MutationObserver(function () {
      if (!mixerAvailable()) applyMusicGain();
      if (musicUrl) muteButton.hidden = !!document.getElementById('musicBtn');
    });
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['src'] });
    applyMusicGain();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initVoicePlayer);
  } else {
    initVoicePlayer();
  }
})();
