(function () {
  var fallbackData = {
    letterTitle: "Gửi công chúa nhỏ của anh ❤️",
    letterBody: "Cảm ơn em đã bước vào cuộc đời anh và làm mọi ngày bình thường trở nên thật đặc biệt. Chúc em tuổi mới thật nhiều sức khỏe, may mắn và luôn mỉm cười. Dù mai này có đi bao xa, anh vẫn muốn là người nắm tay em. Chúc mừng sinh nhật, công chúa nhỏ của anh – anh yêu em nhiều lắm!",
    cakeInscription: "Bé Hương Giang\n21+",
    musicType: "Sample",
    musicPath: "./assets/musics/birthday/hppd_amee.mp3",
    customMusicUrl: null,
    photoBlobUrls: window.BIRTHDAY_PHOTOS || [
      "./assets/images/1.jpg",
      "./assets/images/2.jpg",
      "./assets/images/3.jpg",
      "./assets/images/4.jpg",
      "./assets/images/5.jpg",
      "./assets/images/6.jpg",
      "./assets/images/7.jpg"
    ],
    isSavePermanent: true,
    finalGift: true,
    giftLanguage: "vi"
  };

  var injectedData = (window.dataFromSubdomain && window.dataFromSubdomain.data) || null;
  var data = injectedData || fallbackData;
  var photoUrls = data.photoBlobUrls || data.imageUrls;
  if (!photoUrls || photoUrls.length === 0) {
    photoUrls = injectedData ? [] : fallbackData.photoBlobUrls;
  }

  data = Object.assign({}, fallbackData, data, {
    photoBlobUrls: photoUrls,
    customMusicUrl: data.customMusicUrl || data.musicUrl || null,
    musicPath: data.musicPath || data.musicUrl || fallbackData.musicPath,
    finalGift: data.finalGift !== false,
    giftLanguage: data.giftLanguage || "vi"
  });

  function applyAudioSource(src) {
    if (!src) return;
    ["audios", "letterSound"].forEach(function (id) {
      var audio = document.getElementById(id);
      if (!audio) return;
      var source = audio.querySelector("source");
      if (source) {
        source.src = src;
      }
      audio.src = src;
      audio.load();
    });
  }

  window.__BIRTHDAY_MODE__ = true;
  window.__PREVIEW_DATA__ = data;
  window.__PREVIEW_READY__ = Promise.resolve(data);
  applyAudioSource(data.customMusicUrl || data.musicPath);
})();
