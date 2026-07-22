/** Gộp index: nội dung thư — chỉnh LETTER_TITLE / LETTER_BODY */
let LETTER_TITLE = "Gửi em,... ❤️";

let LETTER_BODY = `Anh viết những dòng này không phải vì nhất thời rung động,
Thật lòng. Chỉ mình em. Anh yêu em ❤️`;

/* Preview / Birthday mode: ghi đè nội dung thư và cấu hình finalGift */
let FINAL_GIFT_ENABLED = true; // mặc định cho phép nút Tiếp tục

if (window.__PREVIEW_READY__) {
  window.__PREVIEW_READY__.then(function (pd) {
    if (!pd) return;
    if (pd.letterTitle && pd.letterTitle.trim()) LETTER_TITLE = pd.letterTitle.trim();
    if (pd.letterBody  && pd.letterBody.trim())  LETTER_BODY  = pd.letterBody.trim();
    /* Ẩn nút Tiếp tục nếu không có gói Món Quà Cuối */
    FINAL_GIFT_ENABLED = !!pd.finalGift;
  });
}

const TYPE_TITLE_MS = 52;
const TYPE_BODY_MS = 26;
const TYPE_NEWLINE_MULT = 2.4;

let typingActive = false;
let typingTimeoutId = null;

function clearLetterFields() {
  const titleEl = document.getElementById("letterTitle");
  const bodyEl = document.getElementById("letterBody");
  if (titleEl) titleEl.textContent = "";
  if (bodyEl) bodyEl.textContent = "";
}

function cancelLetterTyping() {
  typingActive = false;
  if (typingTimeoutId !== null) {
    clearTimeout(typingTimeoutId);
    typingTimeoutId = null;
  }
}

function scrollLetterBodyToEnd(bodyEl) {
  if (!bodyEl || bodyEl.id !== "letterBody") return;
  requestAnimationFrame(function () {
    bodyEl.scrollTop = bodyEl.scrollHeight;
  });
}

function typeWriter(el, text, baseDelayMs, onDone) {
  if (!el) {
    if (onDone) onDone();
    return;
  }
  el.textContent = "";
  const chars = Array.from(text);
  let i = 0;

  function step() {
    if (!typingActive) return;
    if (i >= chars.length) {
      typingTimeoutId = null;
      if (onDone) onDone();
      return;
    }
    const ch = chars[i];
    el.textContent += ch;
    scrollLetterBodyToEnd(el);
    i++;
    let delay = baseDelayMs;
    if (ch === "\n") delay = Math.round(baseDelayMs * TYPE_NEWLINE_MULT);
    typingTimeoutId = setTimeout(step, delay);
  }

  typingActive = true;
  typingTimeoutId = setTimeout(step, baseDelayMs);
}

/** Tiếp tục gõ từ ký tự thứ startIndex (DOM đã khớp prefix tới startIndex-1). */
function typeWriterFromIndex(el, text, startIndex, baseDelayMs, onDone) {
  if (!el) {
    if (onDone) onDone();
    return;
  }
  const chars = Array.from(text);
  if (startIndex >= chars.length) {
    if (onDone) onDone();
    return;
  }
  let i = startIndex;
  function step() {
    if (!typingActive) return;
    if (i >= chars.length) {
      typingTimeoutId = null;
      if (onDone) onDone();
      return;
    }
    const ch = chars[i];
    i++;
    el.textContent = chars.slice(0, i).join("");
    if (el.id === "letterBody") scrollLetterBodyToEnd(el);
    let delay = baseDelayMs;
    if (ch === "\n") delay = Math.round(baseDelayMs * TYPE_NEWLINE_MULT);
    typingTimeoutId = setTimeout(step, delay);
  }
  typingActive = true;
  typingTimeoutId = setTimeout(step, baseDelayMs);
}

function setLetterContinueEnabled(on) {
  const btn = document.getElementById("letterBtnContinue");
  if (!btn) return;
  /* Chỉ bật nút khi finalGift được kích hoạt; tắt luôn nếu không */
  const allow = on && FINAL_GIFT_ENABLED;
  if (allow) {
    btn.classList.add("letter-btn-continue--visible");
    btn.disabled = false;
    btn.removeAttribute("aria-hidden");
  } else {
    btn.classList.remove("letter-btn-continue--visible");
    btn.disabled = true;
    btn.setAttribute("aria-hidden", "true");
  }
}

function startLetterTyping() {
  cancelLetterTyping();
  setLetterContinueEnabled(false);
  const titleEl = document.getElementById("letterTitle");
  const bodyEl = document.getElementById("letterBody");
  clearLetterFields();
  typingActive = true;
  typeWriter(titleEl, LETTER_TITLE, TYPE_TITLE_MS, function () {
    if (!typingActive) return;
    typeWriter(bodyEl, LETTER_BODY, TYPE_BODY_MS, function () {
      scrollLetterBodyToEnd(bodyEl);
      typingActive = false;
      typingTimeoutId = null;
      setLetterContinueEnabled(true);
    });
  });
}

$(document).ready(function () {
  if (!$("#letter-modal").length) return;

  clearLetterFields();
  setLetterContinueEnabled(false);

  const envelope = $("#letter-modal #envelope");
  const letter = document.getElementById("loveLetter");
  const letterSlot = letter ? letter.closest(".letter-slot") : null;
  const letterBtnClose = $("#letterBtnClose");
  const letterBtnContinue = $("#letterBtnContinue");
  const wrapper = $("#letter-modal .envlope-wrapper");
  const letterModal = $("#letter-modal");
  const memoryZone = $("#memory-zone");
  const audio = document.getElementById("letterSound");

  let isOpen = false;
  let memoryZoneRevealed = false;
  let giftCubeHideTimer = 0;
  let letterEndSequenceActive = false;
  let hasPlayed = false;
  let centeringStarted = false;
  let letterDockedToBody = false;
  let letterCenterTransitionHandler = null;
  /** Lưu khi đóng X: đã gõ xong → mở lại hiện full; chưa xong → gõ tiếp. */
  let letterResumeSnapshot = null;

  function captureLetterResumeState() {
    const titleEl = document.getElementById("letterTitle");
    const bodyEl = document.getElementById("letterBody");
    if (!titleEl || !bodyEl) {
      letterResumeSnapshot = null;
      return;
    }
    const t = titleEl.textContent;
    const b = bodyEl.textContent;
    const tLen = Array.from(t).length;
    const bLen = Array.from(b).length;
    const titleLen = Array.from(LETTER_TITLE).length;
    const bodyLen = Array.from(LETTER_BODY).length;

    if (t === LETTER_TITLE && b === LETTER_BODY && tLen === titleLen && bLen === bodyLen) {
      letterResumeSnapshot = { mode: "complete" };
      return;
    }
    if (tLen === 0 && bLen === 0) {
      letterResumeSnapshot = null;
      return;
    }
    letterResumeSnapshot = { mode: "partial", titleText: t, bodyText: b };
  }

  function isStrPrefixOf(typed, full) {
    const tc = Array.from(typed);
    const fc = Array.from(full);
    if (tc.length > fc.length) return false;
    for (let i = 0; i < tc.length; i++) {
      if (tc[i] !== fc[i]) return false;
    }
    return true;
  }

  function startOrResumeLetterTyping() {
    cancelLetterTyping();
    setLetterContinueEnabled(false);
    const titleEl = document.getElementById("letterTitle");
    const bodyEl = document.getElementById("letterBody");
    if (!titleEl || !bodyEl) return;

    const snap = letterResumeSnapshot;
    letterResumeSnapshot = null;

    if (snap && snap.mode === "complete") {
      const letterInner = letter ? letter.querySelector(".letter-inner") : null;
      if (letterInner) letterInner.classList.add("letter-text-reveal");
      titleEl.textContent = LETTER_TITLE;
      bodyEl.textContent = LETTER_BODY;
      scrollLetterBodyToEnd(bodyEl);
      typingActive = false;
      typingTimeoutId = null;
      setLetterContinueEnabled(true);
      if (letterInner) {
        window.setTimeout(function () {
          letterInner.classList.remove("letter-text-reveal");
        }, 1100);
      }
      return;
    }

    if (snap && snap.mode === "partial") {
      const t = snap.titleText || "";
      const b = snap.bodyText || "";
      const titleChars = Array.from(LETTER_TITLE);
      const bodyChars = Array.from(LETTER_BODY);
      const tLen = Array.from(t).length;
      const bLen = Array.from(b).length;

      if (!isStrPrefixOf(t, LETTER_TITLE) || (tLen === titleChars.length && !isStrPrefixOf(b, LETTER_BODY))) {
        startLetterTyping();
        return;
      }
      if (tLen < titleChars.length && bLen > 0) {
        startLetterTyping();
        return;
      }

      titleEl.textContent = t;
      bodyEl.textContent = b;

      if (tLen < titleChars.length) {
        typeWriterFromIndex(titleEl, LETTER_TITLE, tLen, TYPE_TITLE_MS, function () {
          if (!typingActive) return;
          typeWriter(bodyEl, LETTER_BODY, TYPE_BODY_MS, function () {
            scrollLetterBodyToEnd(bodyEl);
            typingActive = false;
            typingTimeoutId = null;
            setLetterContinueEnabled(true);
          });
        });
        return;
      }
      if (tLen === titleChars.length && bLen < bodyChars.length) {
        typeWriterFromIndex(bodyEl, LETTER_BODY, bLen, TYPE_BODY_MS, function () {
          scrollLetterBodyToEnd(bodyEl);
          typingActive = false;
          typingTimeoutId = null;
          setLetterContinueEnabled(true);
        });
        return;
      }
      startLetterTyping();
      return;
    }

    startLetterTyping();
  }

  function playAudioOnce() {
    if (!hasPlayed && audio) {
      audio
        .play()
        .then(() => {
          hasPlayed = true;
        })
        .catch(() => {});
    }
  }

  function resetLetterDock() {
    cancelLetterTyping();
    clearLetterFields();
    if (letter && letterCenterTransitionHandler) {
      letter.removeEventListener("transitionend", letterCenterTransitionHandler);
      letterCenterTransitionHandler = null;
    }
    if (!letter) return;
    const letterInner = letter.querySelector(".letter-inner");
    if (letterInner) letterInner.classList.remove("letter-text-reveal");
    letter.classList.remove("letter-is-centered", "letter-show-inner");
    if (letterDockedToBody && letterSlot) {
      letterSlot.appendChild(letter);
      letterDockedToBody = false;
    }
    letter.style.cssText = "";
    if (letterSlot) letterSlot.classList.remove("letter-slot--floating");
    centeringStarted = false;
    wrapper.removeClass("letter-stage-open");
    setLetterContinueEnabled(false);
  }

  function closeLetterToEnvelope() {
    resetLetterDock();
    envelope.removeClass("open").addClass("close");
    isOpen = false;
  }

  /** Bánh ký ức: gọi một lần khi mở hộp quà (gift-box.js) hoặc dự phòng sau thư. */
  function revealMemoryZoneOnGiftOpen() {
    if (memoryZoneRevealed) return;
    memoryZoneRevealed = true;
    if (giftCubeHideTimer) {
      clearTimeout(giftCubeHideTimer);
      giftCubeHideTimer = 0;
    }
    populateMemoryZone();
    memoryZone.addClass("is-visible").attr("aria-hidden", "false");
    $("#memory-cake-stage").attr("aria-hidden", "false");
    if (typeof window.launchBirthdayHeadingFromGift === "function") {
      window.launchBirthdayHeadingFromGift();
    }
    if (audio && audio.paused) {
      audio.play().catch(function () {});
    }
    /* Sau hiệu ứng bung nắp + vài giây xoay (cube-rotate-open), mới ẩn hộp để không lộ “thẻ” trước bánh */
    giftCubeHideTimer = window.setTimeout(function () {
      giftCubeHideTimer = 0;
      $(document.body).addClass("memory-cake-active");
    }, 2800);
  }

  window.revealMemoryZoneOnGiftOpen = revealMemoryZoneOnGiftOpen;

  /** Tiếp tục: thư tan biến → đóng modal (bánh đã hiện từ lúc mở hộp). */
  function finishLetterAndShowMemory() {
    if (letterEndSequenceActive) return;
    letterResumeSnapshot = null;
    letterEndSequenceActive = true;
    letterBtnContinue.prop("disabled", true);
    letterBtnClose.prop("disabled", true).css("pointer-events", "none");
    if (typeof window.resetRabbitsHomeAfterLetter === "function") {
      window.resetRabbitsHomeAfterLetter();
    }

    if (letter) {
      void letter.offsetWidth;
      letter.classList.add("letter--ending");
    }

    window.setTimeout(function () {
      closeLetterToEnvelope();
      letterModal.addClass("letter-modal--ending");
    }, 520);

    window.setTimeout(function () {
      letterModal.removeClass("is-visible letter-modal--ending");
      letterModal.attr("aria-hidden", "true");
      if (letter) letter.classList.remove("letter--ending");
      /* gift-box: sau thư (flow cắt bánh) → trái tim ảnh */
      if (typeof window.__afterLetterContinue === "function") {
        var cb = window.__afterLetterContinue;
        window.__afterLetterContinue = null;
        cb();
      }
      if (!memoryZoneRevealed) {
        revealMemoryZoneOnGiftOpen();
      } else if (audio && audio.paused) {
        audio.play().catch(function () {});
      }
    }, 520 + 900);
  }

  function runCenterLetter() {
    if (!letter || !envelope.hasClass("open")) return;
    const rect = letter.getBoundingClientRect();
    if (letterSlot && letter.parentNode === letterSlot) {
      document.body.appendChild(letter);
      letterDockedToBody = true;
    }
    letter.style.position = "fixed";
    letter.style.top = rect.top + "px";
    letter.style.left = rect.left + "px";
    letter.style.width = rect.width + "px";
    letter.style.height = rect.height + "px";
    letter.style.margin = "0";
    letter.style.zIndex = "1000";
    letter.style.boxSizing = "border-box";
    letter.style.animation = "none";
    letter.style.transform = "none";
    void letter.offsetWidth;
    requestAnimationFrame(() => {
      const vv = window.visualViewport;
      const vpW = vv ? vv.width : document.documentElement.clientWidth;
      const vpH = vv ? vv.height : window.innerHeight;
      const vpLeft = vv ? vv.offsetLeft : 0;
      const vpTop = vv ? vv.offsetTop : 0;
      const vw = Math.min(vpW * 0.92, 440);
      const maxH = Math.min(vpH * 0.76, 600);
      const leftPx = Math.round(vpLeft + (vpW - vw) / 2);
      const topPx = Math.round(vpTop + (vpH - maxH) / 2);
      letter.style.transition =
        "top 0.95s cubic-bezier(0.22, 1, 0.36, 1), left 0.95s cubic-bezier(0.22, 1, 0.36, 1), width 0.95s cubic-bezier(0.22, 1, 0.36, 1), height 0.95s cubic-bezier(0.22, 1, 0.36, 1), box-shadow 0.95s ease, transform 0.95s cubic-bezier(0.22, 1, 0.36, 1)";
      letter.style.top = topPx + "px";
      letter.style.left = leftPx + "px";
      letter.style.width = vw + "px";
      letter.style.height = maxH + "px";
      letter.style.transform = "none";
      letter.classList.add("letter-is-centered");
      wrapper.addClass("letter-stage-open");

      if (letterCenterTransitionHandler) {
        letter.removeEventListener("transitionend", letterCenterTransitionHandler);
        letterCenterTransitionHandler = null;
      }
      letterCenterTransitionHandler = function (e) {
        if (e.target !== letter) return;
        if (e.propertyName !== "width") return;
        letter.removeEventListener("transitionend", letterCenterTransitionHandler);
        letterCenterTransitionHandler = null;
        if (!envelope.hasClass("open") || !isOpen) return;
        startOrResumeLetterTyping();
      };
      letter.addEventListener("transitionend", letterCenterTransitionHandler);
    });
  }

  function openEnvelopeFromUser() {
    resetLetterDock();
    envelope.removeClass("close").addClass("open");
    if (letter) letter.classList.add("letter-show-inner");
    isOpen = true;
    // Đã chuyển tính năng bật nhạc sang lúc mở hộp quà
  }

  envelope.on("click", function (e) {
    if (!envelope.hasClass("close")) return;
    e.preventDefault();
    openEnvelopeFromUser();
  });

  if (letter) {
    letter.addEventListener("animationend", function (e) {
      if (e.animationName !== "letterPullOut") return;
      if (!envelope.hasClass("open")) return;
      if (centeringStarted) return;
      centeringStarted = true;
      runCenterLetter();
    });
  }

  letterBtnClose.on("click", function () {
    if (!isOpen) return;
    captureLetterResumeState();
    /* Không xóa __afterLetterContinue: callback chỉ được gift-box gán khi cắt xong bánh;
       nếu user đóng X rồi mở lại mới ấn «Tiếp tục» thì vẫn cần gọi tim ảnh. */
    closeLetterToEnvelope();
    return false;
  });

  letterBtnContinue.on("click", function () {
    if (!isOpen || letterBtnContinue.prop("disabled")) return;
    finishLetterAndShowMemory();
    return false;
  });

  /**
   * Debug: phong bì (wrapper + #envelope) so với tâm visualViewport.
   * delta ≈ [0,0] là đúng giữa màn hình nhìn thấy (desktop / mobile landscape…).
   * Gọi tay: __logEnvelopeLayout("manual")
   */
  function logEnvelopeLayout(reason) {
    var modal = document.getElementById("letter-modal");
    if (!modal || !modal.classList.contains("is-visible")) return;
    var wrap = document.querySelector("#letter-modal .envlope-wrapper");
    var env = document.getElementById("envelope");
    if (!wrap) return;

    var vv = window.visualViewport;
    var vpW = vv ? vv.width : window.innerWidth;
    var vpH = vv ? vv.height : window.innerHeight;
    var vpL = vv && typeof vv.offsetLeft === "number" ? vv.offsetLeft : 0;
    var vpT = vv && typeof vv.offsetTop === "number" ? vv.offsetTop : 0;
    var cx = vpL + vpW * 0.5;
    var cy = vpT + vpH * 0.5;

    var r = wrap.getBoundingClientRect();
    var wmx = r.left + r.width * 0.5;
    var wmy = r.top + r.height * 0.5;

    var out = {
      lyDo: reason || "",
      huongManHinh:
        typeof screen !== "undefined" && screen.orientation
          ? screen.orientation.type
          : "",
      cuaSo: window.innerWidth + "×" + window.innerHeight,
      visualViewport:
        Math.round(vpW) +
        "×" +
        Math.round(vpH) +
        " offset(" +
        Math.round(vpL) +
        "," +
        Math.round(vpT) +
        ")",
      tamViewportPx: [Math.round(cx), Math.round(cy)],
      phongBiWrapper: {
        tamPx: [Math.round(wmx), Math.round(wmy)],
        lechSoVoiTamVpPx: [Math.round(wmx - cx), Math.round(wmy - cy)],
        rect: {
          top: Math.round(r.top),
          left: Math.round(r.left),
          w: Math.round(r.width),
          h: Math.round(r.height),
        },
      },
    };

    if (env) {
      var er = env.getBoundingClientRect();
      var emx = er.left + er.width * 0.5;
      var emy = er.top + er.height * 0.5;
      out.phongBiEnvelope = {
        tamPx: [Math.round(emx), Math.round(emy)],
        lechSoVoiTamVpPx: [Math.round(emx - cx), Math.round(emy - cy)],
      };
    }

  }

  window.__logEnvelopeLayout = logEnvelopeLayout;

  var letterModalEl = document.getElementById("letter-modal");
  if (letterModalEl) {
    var envObs = new MutationObserver(function () {
      if (!letterModalEl.classList.contains("is-visible")) return;
      requestAnimationFrame(function () {
        requestAnimationFrame(function () {
          logEnvelopeLayout("mở overlay: sau 2 rAF");
          window.setTimeout(function () {
            logEnvelopeLayout("mở overlay: +350ms");
          }, 350);
          window.setTimeout(function () {
            logEnvelopeLayout("mở overlay: +900ms (sau transition opacity)");
          }, 900);
        });
      });
    });
    envObs.observe(letterModalEl, {
      attributes: true,
      attributeFilter: ["class"],
    });

    var envLogResizeT = 0;
    function logEnvelopeOnResize() {
      window.clearTimeout(envLogResizeT);
      envLogResizeT = window.setTimeout(function () {
        if (letterModalEl.classList.contains("is-visible")) {
          logEnvelopeLayout("resize / orientation / visualViewport");
        }
      }, 150);
    }
    window.addEventListener("resize", logEnvelopeOnResize);
    window.addEventListener("orientationchange", logEnvelopeOnResize);
    if (window.visualViewport) {
      window.visualViewport.addEventListener("resize", logEnvelopeOnResize);
      window.visualViewport.addEventListener("scroll", logEnvelopeOnResize);
    }
  }
});
