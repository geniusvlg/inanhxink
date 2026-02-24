/**
 * uynuyn.tokitoki.love — loveletter template clone
 * Data sourced from /dynamic/data.js on the live site.
 */

// window.siteData is injected by index.html from /api/site-data.
// Falls back to static sample data so the template works standalone too.
const _dataSource = (window.siteData) ? {
  title:  window.siteData.title  || 'Love Letter',
  sender: window.siteData.sender || '',
  receiver: window.siteData.receiver || '',
  text:   window.siteData.content || '',
  song:   window.siteData.musicUrl || null,
  images: window.siteData.imageUrls || [],
} : {
  title: "Iu em",
  sender: "",
  receiver: "",
  text: "Năm nay đã là giao thừa thứ 2 chúng ta đồng hành cùng nhau rồi, anh biết là anh vẫn chưa phải là người đàn ông tốt nhất thế giới này, nhưng anh sẽ luôn luôn cố gắng để trở thành người đàn ông tuyệt vời nhất trong lòng em. Mong 2 ta sẽ luôn chúc nhau thế này mỗi năm em nhé",
  images: [
    "./images/bgcqjh0a.55j.jpeg",  // stamp (index 0)
    "./images/5fhz0ver.gry.jpeg",  // polaroid 1
    "./images/lzbnesb1.2ca.jpeg",  // polaroid 2
    "./images/jyg2rqun.1fx.jpeg",  // polaroid 3
    "./images/mzbnhhoq.tgu.jpeg",  // polaroid 4
    "./images/mn41lj4p.eq0.jpeg",  // polaroid 5
    "./images/dderhkan.v4d.jpeg",  // polaroid 6
    "./images/and5bcb2.i0s.jpeg",  // polaroid 7
    "./images/qvz5gq44.um2.jpeg",  // polaroid 8
  ],
};

const imageSources = _dataSource.images;
let backgroundMusic = null;

function setupBackgroundMusic() {
  const src = _dataSource.song || null;
  if (!src) return;
  backgroundMusic = new Audio(src);
  backgroundMusic.loop = true;
  backgroundMusic.volume = 0;
  const targetVolume = 0.8, fadeDuration = 3000, fadeSteps = 60;
  const volumeStep = targetVolume / fadeSteps;
  const stepDuration = fadeDuration / fadeSteps;
  let currentVolume = 0;
  function startMusicWithFade() {
    backgroundMusic.play()
      .then(() => {
        console.log("Background music started playing");
        const fadeInterval = setInterval(() => {
          currentVolume = Math.min(currentVolume + volumeStep, targetVolume);
          backgroundMusic.volume = currentVolume;
          if (currentVolume >= targetVolume) clearInterval(fadeInterval);
        }, stepDuration);
      })
      .catch((e) => console.log("Could not play background music:", e));
  }
  startMusicWithFade();
}

function renderImagesFromArray() {
  console.log("Rendering images from array:", imageSources);
  const stampImg = document.querySelector(".stamp img");
  if (stampImg && imageSources[0]) {
    stampImg.src = imageSources[0];
    console.log("Stamp src set to:", imageSources[0]);
  }
  const polaroids = document.querySelectorAll(".polaroid img");
  polaroids.forEach((img, index) => {
    if (imageSources[index + 1]) {
      img.src = imageSources[index + 1];
      console.log(`Polaroid ${index + 1} src set to:`, imageSources[index + 1]);
    }
  });
}

const originalLetter = _dataSource.text;
let isLetterFullyDisplayed = false;

function renderLetterContent(animate = false) {
  const contentDiv = document.getElementById("extractedLetterContent");
  if (!contentDiv) return;
  if (animate) {
    contentDiv.style.opacity = "0";
    setTimeout(() => {
      contentDiv.innerText = originalLetter;
      setTimeout(() => {
        contentDiv.style.opacity = "1";
        isLetterFullyDisplayed = true;
      }, 50);
    }, 300);
  } else {
    contentDiv.innerText = originalLetter;
    isLetterFullyDisplayed = false;
  }
}

function showPolaroids(show) {
  const polaroidGroup = document.getElementById("polaroidGroup");
  const polaroids = document.querySelectorAll(".polaroid");
  if (show) {
    polaroidGroup.classList.add("visible");
    polaroids.forEach((p, i) => setTimeout(() => p.classList.add("visible"), 300 + i * 120));
  } else {
    polaroidGroup.classList.remove("visible");
    polaroids.forEach((p) => p.classList.remove("visible"));
  }
}

function showPolaroidFullscreen(imgSrc, label) {
  const overlay = document.getElementById("polaroidFullscreenOverlay");
  const img     = document.getElementById("fullscreenPolaroidImg");
  const lbl     = document.getElementById("fullscreenPolaroidLabel");
  if (img && lbl && overlay) {
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
    const currentSrc = img.dataset.currentSrc;
    let randomSrc;
    do {
      randomSrc = imageSources[Math.floor(Math.random() * imageSources.length)];
    } while (randomSrc === currentSrc && imageSources.length > 1);
    img.src = randomSrc;
    img.dataset.currentSrc = randomSrc;
  }
}

function initLoveletter() {
  console.log("DOM loaded, calling renderImagesFromArray");
  renderImagesFromArray();

  const bgTitleEl = document.getElementById("backgroundTitle");
  if (bgTitleEl && _dataSource.title) bgTitleEl.textContent = _dataSource.title;
  const senderEl = document.querySelector(".sender");
  if (senderEl && _dataSource.sender) senderEl.textContent = _dataSource.sender;
  const receiverEl = document.querySelector(".receiver");
  if (receiverEl && _dataSource.receiver) receiverEl.textContent = _dataSource.receiver;

  setupBackgroundMusic();
  renderLetterContent();

  // ── extractedLetter click ────────────────────────────────────────────────
  const extractedLetter = document.getElementById("extractedLetter");
  console.log("Extracted letter element:", extractedLetter);

  if (extractedLetter) {
    extractedLetter.addEventListener("click", (e) => {
      if (backgroundMusic && backgroundMusic.paused) backgroundMusic.play().catch(() => {});
      console.log("Extracted letter clicked, isLetterFullyDisplayed:", isLetterFullyDisplayed);

      if (!isLetterFullyDisplayed) {
        console.log("Displaying full letter content");
        renderLetterContent(true);
        e.stopPropagation();
      } else {
        console.log("Letter fully displayed, closing letter");
        extractedLetter.classList.add("shrink");
        showPolaroids(false);
        setTimeout(() => {
          extractedLetter.classList.remove("visible", "shrink");
          const letter = document.querySelector(".letter");
          if (letter) letter.classList.remove("visible", "opened-letter");
          const flap = document.querySelector(".flap");
          if (flap) flap.classList.remove("open");
          const envelope = document.querySelector(".envelope");
          if (envelope) { envelope.classList.remove("open"); envelope.style.transform = ""; }
          const sender = document.querySelector(".sender");
          const receiver = document.querySelector(".receiver");
          const stamp = document.querySelector(".stamp");
          if (sender) sender.style.visibility = "visible";
          if (receiver) receiver.style.visibility = "visible";
          if (stamp) stamp.style.visibility = "visible";
          document.body.classList.remove("bg-after-open");
          const bg = document.querySelector(".background-after-img");
          if (bg) { bg.style.opacity = "0"; setTimeout(() => bg.remove(), 4000); }
          isOpen = false;
          isLetterFullyDisplayed = false;
          renderLetterContent();
        }, 500);
      }
    });
  }

  // ── Envelope click ───────────────────────────────────────────────────────
  const envelope = document.querySelector(".envelope");
  let isOpen = false;
  console.log("Envelope element:", envelope);

  if (envelope) {
    envelope.addEventListener("click", () => {
      if (backgroundMusic && backgroundMusic.paused) backgroundMusic.play().catch(() => {});
      console.log("Envelope clicked, isOpen:", isOpen);

      if (!isOpen) {
        console.log("Opening envelope...");
        envelope.classList.add("envelope-fade");
        setTimeout(() => {
          envelope.classList.remove("envelope-fade");
          envelope.classList.add("open");
          document.body.classList.add("bg-after-open");
          if (!document.querySelector(".background-after-img")) {
            const bg = document.createElement("div");
            bg.className = "background-after-img";
            document.body.appendChild(bg);
            setTimeout(() => { bg.style.opacity = "0.7"; }, 10);
          }
          const sender = document.querySelector(".sender");
          const receiver = document.querySelector(".receiver");
          const stamp = document.querySelector(".stamp");
          if (sender) sender.style.visibility = "hidden";
          if (receiver) receiver.style.visibility = "hidden";
          if (stamp) stamp.style.visibility = "hidden";

          setTimeout(() => {
            const flap = document.querySelector(".flap");
            if (flap) flap.classList.add("open");
            setTimeout(() => {
              const letter = document.querySelector(".letter");
              if (letter) { letter.classList.add("visible"); letter.classList.add("opened-letter"); }
              setTimeout(() => {
                const el = document.getElementById("extractedLetter");
                if (el) {
                  el.classList.add("visible");
                  showPolaroids(true);
                  const env = document.querySelector(".envelope");
                  if (env) env.style.transform = "rotateY(180deg) scale(0.85) translate(30px, 100px)";
                }
              }, 700);
            }, 500);
          }, 700);
        }, 1000);

      } else {
        console.log("Closing envelope...");
        const letter = document.querySelector(".letter");
        if (letter) letter.classList.remove("visible", "opened-letter");
        document.body.classList.remove("bg-after-open");
        const bg = document.querySelector(".background-after-img");
        if (bg) { bg.style.opacity = "0"; setTimeout(() => bg.remove(), 4000); }
        const sender = document.querySelector(".sender");
        const receiver = document.querySelector(".receiver");
        const stamp = document.querySelector(".stamp");
        if (sender) sender.style.visibility = "visible";
        if (receiver) receiver.style.visibility = "visible";
        if (stamp) stamp.style.visibility = "visible";
        const el = document.getElementById("extractedLetter");
        if (el) el.classList.remove("visible");
        showPolaroids(false);
        setTimeout(() => {
          const flap = document.querySelector(".flap");
          if (flap) flap.classList.remove("open");
          setTimeout(() => { envelope.classList.remove("open"); envelope.style.transform = ""; }, 300);
        }, 500);
        isLetterFullyDisplayed = false;
        renderLetterContent();
      }
      isOpen = !isOpen;
    });
  }

  // ── Sparkles ─────────────────────────────────────────────────────────────
  document.querySelectorAll(".sparkle").forEach((sparkle) => {
    setInterval(() => {
      sparkle.style.opacity = "0.8";
      setTimeout(() => { sparkle.style.opacity = "0.4"; }, 700);
    }, 1500);
  });

  // ── Letter click → zoom only ──────────────────────────────────────────────
  const letter = document.querySelector(".letter");
  if (letter) {
    letter.addEventListener("click", function () {
      this.classList.add("letter-zoom");
      setTimeout(() => this.classList.remove("letter-zoom"), 700);
    });
  }

  // ── Polaroid fullscreen ───────────────────────────────────────────────────
  document.querySelectorAll(".polaroid").forEach((p) => {
    p.addEventListener("click", function (e) {
      e.stopPropagation();
      const img = this.querySelector("img");
      const label = this.querySelector(".polaroid-label")?.innerText || "";
      if (img && img.src) showPolaroidFullscreen(img.src, label);
    });
  });

  const polaroidFullscreenOverlay = document.getElementById("polaroidFullscreenOverlay");
  const closeFullscreenBtn        = document.getElementById("closeFullscreenBtn");
  const fullscreenArrow           = document.querySelector(".fullscreen-arrow");
  const fullscreenPolaroidImg     = document.getElementById("fullscreenPolaroidImg");

  polaroidFullscreenOverlay?.addEventListener("click", (e) => {
    if (e.target === polaroidFullscreenOverlay) hidePolaroidFullscreen();
  });
  closeFullscreenBtn?.addEventListener("click", hidePolaroidFullscreen);
  fullscreenArrow?.addEventListener("click", (e) => { e.stopPropagation(); showRandomPolaroid(); });
  fullscreenPolaroidImg?.addEventListener("click", (e) => { e.stopPropagation(); showRandomPolaroid(); });

  const polaroidOverlay = document.getElementById("polaroidOverlay");
  if (polaroidOverlay) {
    polaroidOverlay.addEventListener("click", (e) => {
      if (e.target === polaroidOverlay) { polaroidOverlay.style.display = "none"; polaroidOverlay.innerHTML = ""; }
    });
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initLoveletter);
} else {
  initLoveletter();
}
