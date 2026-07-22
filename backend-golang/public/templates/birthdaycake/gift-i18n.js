/**
 * gift-i18n.js — chuỗi UI món quà theo ngôn ngữ bản ghi (giftLanguage).
 * Bản ghi cũ không có field → mặc định "vi".
 */
(function () {
  "use strict";

  var STRINGS = {
    vi: {
      blowCandle: "🔥 Thổi nến",
      cutReminder:
        'Vuốt <strong>xuyên qua bánh</strong> để cắt bánh — cắt đủ <strong>2 nhát</strong>',
      letterContinue: "Tiếp tục",
      letterCloseAria: "Đóng thư",
      giftCubeAria:
        "Nhấn để mở hộp (không đóng lại bằng nhấn). Xoay góc nhìn bằng cách kéo vùng nền quanh hộp",
      birthdayHeadingAria: "Happy Birthday!",
    },
    en: {
      blowCandle: "🔥 Blow out the candle",
      cutReminder:
        'Swipe <strong>through the cake</strong> to cut it — make <strong>2 cuts</strong>',
      letterContinue: "Continue",
      letterCloseAria: "Close letter",
      giftCubeAria:
        "Tap to open the gift box (tap again will not close it). Drag the background to rotate the view",
      birthdayHeadingAria: "Happy Birthday!",
    },
    id: {
      blowCandle: "🔥 Tiup lilin",
      cutReminder:
        'Geser <strong>melalui kue</strong> untuk memotong — potong <strong>2 kali</strong>',
      letterContinue: "Lanjutkan",
      letterCloseAria: "Tutup surat",
      giftCubeAria:
        "Ketuk untuk membuka kotak hadiah. Seret latar belakang untuk memutar sudut pandang",
      birthdayHeadingAria: "Selamat ulang tahun!",
    },
    ja: {
      blowCandle: "🔥 ろうそくを吹き消す",
      cutReminder:
        'ケーキを<strong>横切る</strong>ようにスワイプ — <strong>2回</strong>切ってください',
      letterContinue: "続ける",
      letterCloseAria: "手紙を閉じる",
      giftCubeAria:
        "タップしてギフトボックスを開く。背景をドラッグして視点を回転",
      birthdayHeadingAria: "お誕生日おめでとう!",
    },
    ko: {
      blowCandle: "🔥 초를 불어 끄기",
      cutReminder:
        '케이크를 <strong>가로질러</strong> 스와이프하여 자르세요 — <strong>2번</strong> 자르기',
      letterContinue: "계속",
      letterCloseAria: "편지 닫기",
      giftCubeAria:
        "탭하여 선물 상자 열기. 배경을 드래그하여 시점 회전",
      birthdayHeadingAria: "생일 축하해!",
    },
    "zh-CN": {
      blowCandle: "🔥 吹灭蜡烛",
      cutReminder:
        '在蛋糕上<strong>划过</strong>来切蛋糕 — 切够 <strong>2刀</strong>',
      letterContinue: "继续",
      letterCloseAria: "关闭信件",
      giftCubeAria: "点击打开礼盒。拖动背景旋转视角",
      birthdayHeadingAria: "生日快乐!",
    },
    th: {
      blowCandle: "🔥 เป่าเทียน",
      cutReminder:
        'ปัด<strong>ผ่านเค้ก</strong>เพื่อตัด — ตัดให้ครบ <strong>2 ครั้ง</strong>',
      letterContinue: "ต่อไป",
      letterCloseAria: "ปิดจดหมาย",
      giftCubeAria:
        "แตะเพื่อเปิดกล่องของขวัญ ลากพื้นหลังเพื่อหมุนมุมมอง",
      birthdayHeadingAria: "สุขสันต์วันเกิด!",
    },
  };

  function normalizeGiftLanguage(code) {
    if (!code) return "vi";
    var c = String(code).trim();
    if (STRINGS[c]) return c;
    var lower = c.toLowerCase();
    if (lower === "zh" || lower === "zh-cn" || lower === "zh_cn") return "zh-CN";
    if (STRINGS[lower]) return lower;
    return "vi";
  }

  function getGiftStrings(lang) {
    var key = normalizeGiftLanguage(lang);
    return STRINGS[key] || STRINGS.vi;
  }

  function applyGiftLanguage(lang) {
    var key = normalizeGiftLanguage(lang);
    var s = getGiftStrings(key);
    window.__GIFT_LANGUAGE__ = key;
    window.__GIFT_I18N__ = s;

    var htmlLang = key === "zh-CN" ? "zh-CN" : key.split("-")[0];
    document.documentElement.lang = htmlLang;

    var blowBtn = document.getElementById("memory-blow-candle-btn");
    if (blowBtn) blowBtn.textContent = s.blowCandle;

    var cutReminder = document.getElementById("memory-cake-cut-reminder");
    if (cutReminder) cutReminder.innerHTML = s.cutReminder;

    var letterContinue = document.getElementById("letterBtnContinue");
    if (letterContinue) letterContinue.textContent = s.letterContinue;

    var letterClose = document.getElementById("letterBtnClose");
    if (letterClose) letterClose.setAttribute("aria-label", s.letterCloseAria);

    var giftCube = document.getElementById("gift-cube");
    if (giftCube) giftCube.setAttribute("aria-label", s.giftCubeAria);

    var heading = document.querySelector(".page-birthday-heading");
    if (heading) heading.setAttribute("aria-label", s.birthdayHeadingAria);
  }

  window.normalizeGiftLanguage = normalizeGiftLanguage;
  window.getGiftStrings = getGiftStrings;
  window.applyGiftLanguage = applyGiftLanguage;

  function bootGiftI18n() {
    function applyFromPreview(pd) {
      applyGiftLanguage((pd && pd.giftLanguage) || "vi");
    }
    if (window.__PREVIEW_DATA__) {
      applyFromPreview(window.__PREVIEW_DATA__);
    }
    if (window.__PREVIEW_READY__) {
      window.__PREVIEW_READY__.then(applyFromPreview);
    } else if (!window.__PREVIEW_DATA__) {
      applyGiftLanguage("vi");
    }
  }

  bootGiftI18n();
})();
