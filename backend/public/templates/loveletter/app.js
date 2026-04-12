/**
 * LoveLetter — envelope+letter from OurMemories, polaroids/music from LoveLetter.
 * window.siteData injected by index.html; falls back to sample data.
 */

const _dataSource = (window.siteData) ? {
  title:    window.siteData.title    || 'Love Letter',
  sender:   window.siteData.sender   || '',
  receiver: window.siteData.receiver || '',
  text:     window.siteData.content  || '',
  song:     window.siteData.musicUrl || null,
  images:   window.siteData.imageUrls || [],
} : {
  title:    "Love Letter",
  sender:   "Người gửi",
  receiver: "Người nhận",
  text:     "Nội dung thư sẽ hiển thị ở đây.",
  song:       "./song.mp3",
  images:     [],
};

// ── DOM refs ──────────────────────────────────────────────────────────────────
const envelope       = document.getElementById("envelope");
const extractedPaper = document.getElementById("extractedPaper");
const envelopeFlap   = document.getElementById("envelopeFlap");
const openLetterBtn  = document.getElementById("openLetterBtn");
const tileOut        = document.getElementById("tileOut");
const tileInTop      = document.getElementById("tileInTop");

// ── Letter state ──────────────────────────────────────────────────────────────
let envIsOpen  = false;
let envIsBusy  = false;
let cardIsOpen = false;
let cardIsBusy = false;

const letterTimers = [];
function letterTimeout(fn, ms) {
  letterTimers.push(setTimeout(fn, ms));
}
function clearLetterTimers() {
  while (letterTimers.length) clearTimeout(letterTimers.pop());
}

// ── Render letter content ─────────────────────────────────────────────────────
function renderLetter() {
  const hint     = _dataSource.hint     || 'Em iu ấn vào lá thư đi nè ❤';
  const receiver = _dataSource.receiver || '';
  const sender   = _dataSource.sender   || '';
  const body     = _dataSource.text     || '';

  const setText = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };

  setText('letterHint',          hint);
  setText('letterModalGreeting', receiver ? `Gửi ${receiver},` : '');
  setText('letterNote',          sender   ? 'Thương em rất nhiều. 💗' : '');
  setText('letterModalSignature', sender  ? sender : '');

  const paragraphs = body.split(/\n\s*\n/).map(p => p.trim()).filter(Boolean);
  const bodyTopEl = document.getElementById('letterBodyTop');
  const bodyBotEl = document.getElementById('letterBodyBottom');

  if (bodyTopEl) bodyTopEl.innerHTML = '';
  if (bodyBotEl) bodyBotEl.innerHTML = '';

  if (!bodyTopEl || !bodyBotEl) return;

  const appendParagraph = (container, text) => {
    const p = document.createElement('p');
    p.textContent = text;
    container.appendChild(p);
    return p;
  };

  // Try to fit as many words of a paragraph as possible into bodyTopEl,
  // returns the leftover text (or null if everything fit).
  const splitParagraphForTop = (paragraph) => {
    const words = paragraph.split(' ');
    const p = document.createElement('p');
    bodyTopEl.appendChild(p);

    let lastFitIndex = 0;
    for (let i = 0; i < words.length; i++) {
      p.textContent = words.slice(0, i + 1).join(' ');
      if (bodyTopEl.scrollHeight > bodyTopEl.clientHeight) break;
      lastFitIndex = i + 1;
    }

    if (lastFitIndex === 0) {
      bodyTopEl.removeChild(p);
      return paragraph;
    }

    p.textContent = words.slice(0, lastFitIndex).join(' ');
    const remainder = words.slice(lastFitIndex).join(' ');
    return remainder || null;
  };

  let useBottom = false;
  paragraphs.forEach(text => {
    if (useBottom) {
      appendParagraph(bodyBotEl, text);
      return;
    }
    const node = appendParagraph(bodyTopEl, text);
    if (bodyTopEl.scrollHeight > bodyTopEl.clientHeight) {
      bodyTopEl.removeChild(node);
      const remainder = splitParagraphForTop(text);
      if (remainder) appendParagraph(bodyBotEl, remainder);
      useBottom = true;
    }
  });
}

// ── Floating hearts (same trigger as OurMemories) ────────────────────────────
function playHeartIntro() {
  const durations = [1.5, 1.7, 1.6, 1.8, 1.9, 1.6];
  document.querySelectorAll(".heart-float").forEach((el, i) => {
    el.style.animation = "";
    void el.offsetWidth;
    el.style.animation = `heartFloat${i + 1} ${durations[i]}s ease-out 800ms 1 forwards`;
  });
}

// ── Envelope open / close (exact OurMemories logic) ──────────────────────────
function openEnvelope() {
  if (envIsBusy || envIsOpen) return;
  envIsOpen = true;
  envIsBusy = true;

  document.body.classList.add("env-open");

  envelopeFlap.classList.add("flap-open");
  openLetterBtn.classList.add("is-open");

  letterTimeout(() => {
    extractedPaper.classList.remove("is-raised", "is-settled", "is-expanded");
    extractedPaper.classList.add("is-raised");
    extractedPaper.style.zIndex = "41";
  }, 300);

  letterTimeout(() => {
    extractedPaper.classList.remove("is-raised");
    extractedPaper.classList.add("is-settled");
    extractedPaper.style.zIndex = "56";
  }, 900);

  letterTimeout(() => {
    envIsBusy = false;
    showPolaroids(true);
  }, 1200);
}

function closeEnvelope() {
  envIsBusy = true;
  showPolaroids(false);

  letterTimeout(() => {
    extractedPaper.classList.remove("is-settled");
    extractedPaper.classList.add("is-raised");
    extractedPaper.style.zIndex = "56";
  }, 300);

  letterTimeout(() => {
    extractedPaper.style.zIndex = "50";
    extractedPaper.classList.remove("is-raised");
  }, 900);

  letterTimeout(() => {
    extractedPaper.style.zIndex = "39";
    envelopeFlap.classList.remove("flap-open");
    openLetterBtn.classList.remove("is-open");
    document.body.classList.remove("env-open");
    envIsOpen = false;
    envIsBusy = false;
  }, 1500);
}

// ── Card open / close (exact OurMemories logic) ──────────────────────────────
function openCard() {
  if (!envIsOpen || envIsBusy || cardIsBusy) return;
  cardIsBusy = true;

  // Move polaroids out of the letter's way
  document.body.classList.add("card-open");

  // Swap z-indices so in-top covers out's back face during animation
  tileOut.style.zIndex   = "2";
  tileInTop.style.zIndex = "3";

  tileOut.classList.add("openingTop");
  tileInTop.classList.add("openingBottom");

  letterTimeout(() => {
    tileOut.classList.remove("openingTop");
    tileInTop.classList.remove("openingBottom");
    tileOut.classList.add("topOpen");
    tileInTop.classList.add("bottomOpen");
    cardIsOpen = true;

    letterTimeout(() => {
      extractedPaper.classList.remove("is-settled");
      extractedPaper.classList.add("is-expanded");
      cardIsBusy = false;
    }, 400);
  }, 750);
}

function closeCard() {
  if (!cardIsOpen || cardIsBusy) return;
  cardIsBusy = true;

  // Restore z-indices so out covers in-top's back during closing
  tileOut.style.zIndex   = "3";
  tileInTop.style.zIndex = "2";

  tileOut.classList.remove("topOpen");
  tileInTop.classList.remove("bottomOpen");
  tileOut.classList.add("closingTop");
  tileInTop.classList.add("closingBottom");
  extractedPaper.classList.remove("is-expanded");
  extractedPaper.classList.add("is-settled");

  letterTimeout(() => {
    tileOut.classList.remove("closingTop");
    tileInTop.classList.remove("closingBottom");
    tileOut.className   = "tile out";
    tileInTop.className = "tile in-top";
    tileOut.style.zIndex   = "3";
    tileInTop.style.zIndex = "2";
    cardIsOpen = false;
    cardIsBusy = false;
    document.body.classList.remove("card-open");
    closeEnvelope();
  }, 750);
}

// ── Click handler: envelope seal / paper ─────────────────────────────────────
function handleEnvelopeClick() {
  startMusicFadeIn();
  if (envIsBusy || cardIsBusy) return;
  if (!envIsOpen) openEnvelope();
  else closeEnvelope();   // clicking envelope back-area closes it
}

function handlePaperClick(e) {
  e.preventDefault();
  e.stopPropagation();
  startMusicFadeIn();
  if (envIsBusy || cardIsBusy) return;
  if (cardIsOpen) closeCard();
  else if (envIsOpen) openCard();
}

// ── Polaroids ─────────────────────────────────────────────────────────────────
const imageSources = _dataSource.images;

function renderImages() {
  const polaroids = document.querySelectorAll(".polaroid img");
  polaroids.forEach((img, i) => { if (imageSources[i]) img.src = imageSources[i]; });
}

function showPolaroids(show) {
  const group    = document.getElementById("polaroidGroup");
  const polaroids = document.querySelectorAll(".polaroid");
  if (show) {
    group.classList.add("visible");
    polaroids.forEach((p, i) => setTimeout(() => p.classList.add("visible"), 300 + i * 120));
  } else {
    group.classList.remove("visible");
    polaroids.forEach(p => p.classList.remove("visible"));
  }
}

function showPolaroidFullscreen(imgSrc, label) {
  const overlay = document.getElementById("polaroidFullscreenOverlay");
  const img     = document.getElementById("fullscreenPolaroidImg");
  const lbl     = document.getElementById("fullscreenPolaroidLabel");
  if (overlay && img && lbl) {
    img.src = imgSrc;
    img.dataset.currentSrc = imgSrc;
    lbl.textContent = label || "";
    overlay.style.display = "flex";
    setTimeout(() => { overlay.style.opacity = "1"; }, 10);
  }
}

function hidePolaroidFullscreen() {
  const overlay = document.getElementById("polaroidFullscreenOverlay");
  if (overlay) {
    overlay.style.opacity = "0";
    setTimeout(() => { overlay.style.display = "none"; }, 300);
  }
}

function showRandomPolaroid() {
  const img = document.getElementById("fullscreenPolaroidImg");
  if (img && imageSources.length > 1) {
    const current = img.dataset.currentSrc;
    let next;
    do { next = imageSources[Math.floor(Math.random() * imageSources.length)]; }
    while (next === current && imageSources.length > 1);
    img.src = next;
    img.dataset.currentSrc = next;
  }
}

// ── Background music ─────────────────────────────────────────────────────────
let backgroundMusic = null;
let musicStarted    = false;
let musicMuted      = false;

function setupBackgroundMusic() {
  const src = _dataSource.song;
  if (!src) return;
  backgroundMusic = new Audio(src);
  backgroundMusic.loop = true;
  backgroundMusic.volume = 0;
}

function startMusicFadeIn() {
  if (!backgroundMusic || musicStarted) return;
  musicStarted = true;
  const target = 0.8, steps = 60, dur = 3000;
  let vol = 0;
  backgroundMusic.play()
    .then(() => {
      const iv = setInterval(() => {
        if (musicMuted) { clearInterval(iv); return; }
        vol = Math.min(vol + target / steps, target);
        backgroundMusic.volume = vol;
        if (vol >= target) clearInterval(iv);
      }, dur / steps);
    })
    .catch(e => console.log("Music blocked:", e));
}

function toggleMusic() {
  const btn = document.getElementById("musicBtn");
  if (!backgroundMusic) return;
  musicMuted = !musicMuted;
  if (musicMuted) {
    backgroundMusic.volume = 0;
    btn?.classList.add("muted");
  } else {
    backgroundMusic.volume = 0.8;
    btn?.classList.remove("muted");
    // If user unmutes before music started, start it now
    if (!musicStarted) startMusicFadeIn();
  }
}

// ── Init ──────────────────────────────────────────────────────────────────────
function init() {
  renderImages();
  renderLetter();
  setupBackgroundMusic();

  // Play hearts midway through the fly-in animation
  setTimeout(playHeartIntro, 500);

  const bgTitle = document.getElementById("backgroundTitle");
  if (bgTitle && _dataSource.title) bgTitle.textContent = _dataSource.title;

  const envSenderEl   = document.getElementById("envSender");
  const envReceiverEl = document.getElementById("envReceiver");
  if (envSenderEl   && _dataSource.sender)   envSenderEl.textContent   = "Người gửi: "  + _dataSource.sender;
  if (envReceiverEl && _dataSource.receiver) envReceiverEl.textContent = "Người nhận: " + _dataSource.receiver;

  // Music toggle button
  document.getElementById("musicBtn")?.addEventListener("click", toggleMusic);

  // Envelope seal click → open/close envelope
  if (openLetterBtn) openLetterBtn.addEventListener("click", handleEnvelopeClick);

  // Paper / label click → open/close card (or open envelope if it was already open)
  const letterLabel = document.getElementById("letterLabel");
  if (letterLabel) letterLabel.addEventListener("click", handlePaperClick);
  if (extractedPaper) extractedPaper.addEventListener("click", handlePaperClick);

  // Polaroid clicks
  document.querySelectorAll(".polaroid").forEach(p => {
    p.addEventListener("click", e => {
      e.stopPropagation();
      const img   = p.querySelector("img");
      const label = p.querySelector(".polaroid-label")?.innerText || "";
      if (img?.src) showPolaroidFullscreen(img.src, label);
    });
  });

  const fsOverlay = document.getElementById("polaroidFullscreenOverlay");
  fsOverlay?.addEventListener("click", e => { if (e.target === fsOverlay) hidePolaroidFullscreen(); });
  document.getElementById("closeFullscreenBtn")?.addEventListener("click", hidePolaroidFullscreen);
  document.querySelector(".fullscreen-arrow")?.addEventListener("click", e => { e.stopPropagation(); showRandomPolaroid(); });
  document.getElementById("fullscreenPolaroidImg")?.addEventListener("click", e => { e.stopPropagation(); showRandomPolaroid(); });

  const polaroidOverlay = document.getElementById("polaroidOverlay");
  polaroidOverlay?.addEventListener("click", e => {
    if (e.target === polaroidOverlay) { polaroidOverlay.style.display = "none"; polaroidOverlay.innerHTML = ""; }
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
