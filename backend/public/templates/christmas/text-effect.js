// Text Effect - Hiệu ứng chữ "Merry Christmas"
// Sử dụng biến global isMobile từ index.html (đã được khai báo trước khi load file này)
// Nếu chưa có thì tạo mới (fallback)
if (typeof window.isMobile === 'undefined') {
    window.isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}

// Kiểm tra màn hình nhỏ (mobile portrait với chiều ngang nhỏ)
function isSmallScreen() {
  return window.innerWidth < 480 || (window.isMobile && window.innerWidth < window.innerHeight && window.innerWidth < 600);
}

const S = {};

S.Drawing = (function () {
  let canvas,
    context,
    renderFn,
    requestFrame =
      window.requestAnimationFrame ||
      window.webkitRequestAnimationFrame ||
      window.mozRequestAnimationFrame ||
      window.oRequestAnimationFrame ||
      window.msRequestAnimationFrame ||
      function (callback) {
        window.setTimeout(callback, 1000 / 60);
      };

  return {
    init: function (el) {
      canvas = document.querySelector(el);
      if (!canvas) return;
      context = canvas.getContext("2d");
      this.adjustCanvas();
      window.addEventListener("resize", () => S.Drawing.adjustCanvas());
    },

    loop: function (fn) {
      renderFn = !renderFn ? fn : renderFn;
      this.clearFrame();
      renderFn();
      requestFrame.call(window, this.loop.bind(this));
    },

    adjustCanvas: function () {
      if (!canvas) return;
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    },

    clearFrame: function () {
      if (!canvas) return;
      context.clearRect(0, 0, canvas.width, canvas.height);
    },

    getArea: function () {
      if (!canvas) {
        return { w: window.innerWidth || 800, h: window.innerHeight || 600 };
      }
      return { w: canvas.width, h: canvas.height };
    },
    drawCircle: function (p, c) {
      if (!canvas) return;
      context.fillStyle = c.render();
      context.beginPath();
      context.arc(p.x, p.y, p.z, 0, 2 * Math.PI, true);
      context.closePath();
      context.fill();
    }
  };
})();

S.Point = function (args) {
  this.x = args.x;
  this.y = args.y;
  this.z = args.z || 4;
  this.a = args.a || 1;
  this.h = args.h || 0;
};

S.Color = function (r, g, b, a) {
  this.r = r;
  this.g = g;
  this.b = b;
  this.a = a;
};

S.Color.prototype = {
  render: function () {
    return "rgba(" + this.r + "," + this.g + "," + this.b + "," + this.a + ")";
  }
};

S.Dot = function (x, y) {
  // Kích thước dot: màn hình nhỏ nhất nhỏ nhất, mobile nhỏ hơn, desktop lớn nhất
  let dotSize;
  if (isSmallScreen()) {
    dotSize = 0.9; // Màn hình nhỏ (portrait nhỏ) - dot rất nhỏ
  } else if (window.isMobile) {
    dotSize = 1.3; // Mobile thông thường
  } else {
    dotSize = 4; // Desktop
  }
  
  this.p = new S.Point({
    x: x,
    y: y,
    z: dotSize,
    a: 1,
    h: 0
  });
  // Trên mobile giảm tốc độ di chuyển để mượt hơn
  this.e = window.isMobile ? 0.18 : 0.11;
  this.s = true;
  // Màu chữ: trắng
  this.c = new S.Color(255, 255, 255, this.p.a);
  this.t = this.clone();
  this.q = [];
};

S.Dot.prototype = {
  clone: function () {
    return new S.Point({
      x: this.p.x,
      y: this.p.y,
      z: this.p.z,
      a: this.p.a,
      h: this.p.h
    });
  },

  _draw: function () {
    this.c.a = this.p.a;
    S.Drawing.drawCircle(this.p, this.c);
  },

  _moveTowards: function (n) {
    var details = this.distanceTo(n, true),
      dx = details[0],
      dy = details[1],
      d = details[2],
      e = this.e * d;

    if (this.p.h === -1) {
      this.p.x = n.x;
      this.p.y = n.y;
      return true;
    }

    if (d > 1) {
      this.p.x -= (dx / d) * e;
      this.p.y -= (dy / d) * e;
    } else {
      if (this.p.h > 0) {
        this.p.h--;
      } else {
        return true;
      }
    }

    return false;
  },

  _update: function () {
    if (this._moveTowards(this.t)) {
      var p = this.q.shift();
      if (p) {
        this.t.x = p.x || this.p.x;
        this.t.y = p.y || this.p.y;
        this.t.z = p.z || this.p.z;
        this.t.a = p.a || this.p.a;
        this.p.h = p.h || 0;
      } else {
        // Bỏ hiệu ứng rung để giảm lag
        // if (this.s) {
        //   const amplitude = isMobile ? 0.1 : Math.PI;
        //   this.p.x -= Math.sin(Math.random() * amplitude);
        //   this.p.y -= Math.sin(Math.random() * amplitude);
        // }
      }
    }
    let d = this.p.a - this.t.a;
    this.p.a = Math.max(0.1, this.p.a - d * 0.05);
    d = this.p.z - this.t.z;
    this.p.z = Math.max(1, this.p.z - d * 0.05);
  },

  distanceTo: function (n, details) {
    var dx = this.p.x - n.x,
      dy = this.p.y - n.y,
      d = Math.sqrt(dx * dx + dy * dy);
    return details ? [dx, dy, d] : d;
  },

  move: function (p, avoidStatic) {
    if (!avoidStatic || (avoidStatic && this.distanceTo(p) > 1)) {
      this.q.push(p);
    }
  },

  render: function () {
    this._update();
    this._draw();
  }
};

S.ShapeBuilder = (function () {
  var shapeCanvas = document.createElement("canvas"),
    shapeContext = shapeCanvas.getContext("2d"),
    fontFamily = "Avenir, Helvetica Neue, Helvetica, Arial, sans-serif";

  // Khoảng cách giữa các dot (gap) – màn hình nhỏ gap nhỏ hơn để chữ mịn hơn
  function getGap() {
    if (isSmallScreen()) {
      return 4; // Màn hình nhỏ (portrait nhỏ) - gap nhỏ để chữ mịn
    } else if (window.isMobile) {
      return 5; // Mobile thông thường
    } else {
      return 8; // Desktop
    }
  }

  function fit() {
    const gap = getGap();
    shapeCanvas.width = Math.floor(window.innerWidth / gap) * gap;
    shapeCanvas.height = Math.floor(window.innerHeight / gap) * gap;
    shapeContext.fillStyle = "red";
    shapeContext.textBaseline = "middle";
    shapeContext.textAlign = "center";
  }

  function processCanvas() {
    const gap = getGap();
    var pixels = shapeContext.getImageData(
        0,
        0,
        shapeCanvas.width,
        shapeCanvas.height
      ).data,
      dots = [],
      x = 0,
      y = 0,
      fx = shapeCanvas.width,
      fy = shapeCanvas.height,
      w = 0,
      h = 0;

    for (var p = 0; p < pixels.length; p += 4 * gap) {
      if (pixels[p + 3] > 0) {
        dots.push(
          new S.Point({
            x: x,
            y: y
          })
        );

        w = x > w ? x : w;
        h = y > h ? y : h;
        fx = x < fx ? x : fx;
        fy = y < fy ? y : fy;
      }
      x += gap;
      if (x >= shapeCanvas.width) {
        x = 0;
        y += gap;
        p += gap * 4 * shapeCanvas.width;
      }
    }
    return { dots: dots, w: w + fx, h: h + fy };
  }

  function setFontSize(s) {
    shapeContext.font = "bold " + s + "px " + fontFamily;
  }

  function isNumber(n) {
    return !isNaN(parseFloat(n)) && isFinite(n);
  }

  function init() {
    fit();
    window.addEventListener("resize", fit);
  }

  init();

  return {
    letter: function (l) {
      var s = 0;

      const isSmallScreen = window.innerWidth < 768;
      const baseFontSize = window.isMobile || isSmallScreen ? 220 : 450;

      setFontSize(baseFontSize);
      s = Math.min(
        baseFontSize,
        (shapeCanvas.width / shapeContext.measureText(l).width) *
          0.8 *
          baseFontSize,
        (shapeCanvas.height / baseFontSize) *
          (isNumber(l) ? 0.8 : 0.35) *
          baseFontSize
      );

      setFontSize(s);
      shapeContext.clearRect(0, 0, shapeCanvas.width, shapeCanvas.height);
      shapeContext.fillText(l, shapeCanvas.width / 2, shapeCanvas.height / 2);
      return processCanvas();
    }
  };
})();

S.Shape = (function () {
  var dots = [],
    width = 0,
    height = 0,
    cx = 0,
    cy = 0;

  function compensate() {
    var a = S.Drawing.getArea();
    cx = a.w / 2 - width / 2;
    cy = a.h / 2 - height / 2;
  }

  return {
    switchShape: function (n, fast) {
      var a = S.Drawing.getArea();
      width = n.w;
      height = n.h;
      compensate();

      if (n.dots.length > dots.length) {
        var size = n.dots.length - dots.length;
        for (var d = 1; d <= size; d++) {
          dots.push(new S.Dot(a.w / 2, a.h / 2));
        }
      }

      var d = 0,
        i = 0;
      while (n.dots.length > 0) {
        i = Math.floor(Math.random() * n.dots.length);

        if (dots[d].s) {
          dots[d].move(
            new S.Point({
              z: Math.random() * 8 + 2,
              a: Math.random(),
              h: 18
            })
          );
        } else {
          dots[d].move(
            new S.Point({
              z: Math.random() * 4 + 2,
              h: fast ? 18 : 30
            })
          );
        }

        dots[d].s = true;
        dots[d].move(
          new S.Point({
            x: n.dots[i].x + cx,
            y: n.dots[i].y + cy,
            a: 1,
            z: 4,
            h: 0
          })
        );

        n.dots = n.dots.slice(0, i).concat(n.dots.slice(i + 1));
        d++;
      }

      for (var j = d; j < dots.length; j++) {
        if (dots[j].s) {
          dots[j].move(
            new S.Point({
              z: Math.random() * 8 + 2,
              a: Math.random(),
              h: 20
            })
          );
          dots[j].s = false;
          dots[j].e = 0.04;
          dots[j].move(
            new S.Point({
              x: Math.random() * a.w,
              y: Math.random() * a.h,
              a: 0.3,
              z: Math.random() * 4 + 2,
              h: 0
            })
          );
        }
      }
    },

    render: function () {
      for (var d = 0; d < dots.length; d++) {
        dots[d].render();
      }
    }
  };
})();

S.UI = (function () {
  var interval,
    sequence = [],
    cmd = "#";

  function getValue(value) {
    return value && value.split(" ")[1];
  }

  function getAction(value) {
    value = value && value.split(" ")[0];
    return value && value[0] === cmd && value.substring(1);
  }

  // Chạy fn lặp lại theo khoảng thời gian cố định (hoặc theo reverse cho countdown)
  function timedAction(fn, delay, max, reverse) {
    clearInterval(interval);
    let currentAction = reverse ? max : 1;
    fn(currentAction);

    if (!max || (!reverse && currentAction < max) || (reverse && currentAction > 0)) {
      interval = setInterval(function () {
        currentAction = reverse ? currentAction - 1 : currentAction + 1;
        fn(currentAction);
        if (
          (!reverse && max && currentAction === max) ||
          (reverse && currentAction === 0)
        ) {
          clearInterval(interval);
        }
      }, delay);
    }
  }

  function performAction(value) {
    var action, val, current;

    sequence =
      typeof value === "object" ? value : sequence.concat(value.split("|"));

    // Thời gian hiển thị MỖI cụm chữ là cố định, không phụ thuộc độ dài
    // để tất cả các từ/câu có nhịp đều nhau.
    function getDynamicDelay() {
      const base = window.isMobile ? 1700 : 1900;
      return base;
    }

    timedAction(function () {
      current = sequence.shift();
      action = getAction(current);
      val = getValue(current);

      switch (action) {
        case "countdown":
          let value = parseInt(val) || 3;
          value = value > 0 ? value : 3;
          timedAction(
            function (index) {
              if (index === 0) {
                if (sequence.length === 0) {
                  S.Shape.switchShape(S.ShapeBuilder.letter(""));
                } else {
                  performAction(sequence);
                }
              } else {
                S.Shape.switchShape(
                  S.ShapeBuilder.letter(index.toString()),
                  true
                );
              }
            },
            window.isMobile ? 1000 : 1100,
            value,
            true
          );
          break;

        default:
          var isCommand = current[0] === cmd;
          // Hiển thị chữ bình thường
          S.Shape.switchShape(S.ShapeBuilder.letter(isCommand ? "" : current));
      }
    }, getDynamicDelay(), sequence.length);
  }

  return {
    simulate: function (action) {
      performAction(action);
    },
    reset: function () {
      clearInterval(interval);
      sequence = [];
    }
  };
})();

// Lấy chuỗi hiệu ứng chữ từ API (backend) nếu có, fallback về default
function getTextEffectSequence() {
  try {
    if (window.apiData && typeof window.apiData.textEffectSeq === 'string') {
      const seq = window.apiData.textEffectSeq.trim();
      if (seq.length > 0) {
        return seq;
      }
    }
  } catch (e) {
    console.warn('Không đọc được textEffectSeq từ apiData, dùng default:', e);
  }
  // Chuỗi mặc định
  return "Merry|Christmas";
}

function startTextEffect() {
  S.Drawing.init(".canvas");
  S.Drawing.loop(function () {
    S.Shape.render();
  });

  // Dùng chuỗi hiệu ứng chữ từ API nếu có
  const seq = getTextEffectSequence();
  // Tính tổng thời gian dựa trên SỐ LƯỢNG cụm chữ (bất kỳ) và thời gian cố định mỗi cụm
  (function () {
    const parts =
      typeof seq === "string"
        ? seq.split("|")
        : Array.isArray(seq)
        ? seq
        : [];
    let displayCount = 0;
    parts.forEach((item) => {
      const trimmed = (item || "").trim();
      // Bỏ qua lệnh bắt đầu bằng '#', chỉ đếm chữ thực sự hiển thị
      if (trimmed && trimmed[0] !== "#") {
        displayCount++;
      }
    });
    if (displayCount === 0) {
      displayCount = 1;
    }
    const perItem = window.isMobile ? 1700 : 1900; // phải trùng với getDynamicDelay()
    // Lưu lại tổng delay để dùng bên dưới
    window.__textEffectTotalDelay = displayCount * perItem + 300;
  })();
  const totalDelay = window.__textEffectTotalDelay || (window.isMobile ? 1700 : 1900) * 2;
  
  S.UI.simulate(seq);
  
  setTimeout(function() {
    gsap.to(".canvas", {
      duration: 1,
      opacity: 0,
      onComplete: function() {
        var canvas = document.querySelector(".canvas");
        if (canvas) {
          canvas.style.display = "none";
        }
      }
    });
    
    // Kiểm tra letterContent từ API - nếu rỗng thì không hiện book
    let shouldShowBook = true;
    try {
      if (window.apiData && window.apiData.hasOwnProperty('letterContent')) {
        if (typeof window.apiData.letterContent === 'string') {
          const letterContent = window.apiData.letterContent.trim();
          if (letterContent === '') {
            shouldShowBook = false;
            console.log('letterContent rỗng, bỏ qua hiển thị book');
          }
        }
      }
    } catch (e) {
      console.warn('Không kiểm tra được letterContent:', e);
    }
    
    if (shouldShowBook) {
      var guideInfo = document.getElementById("guideInfo");
      if (guideInfo) {
        guideInfo.classList.remove("hidden");
        guideInfo.classList.add("show");
      }
    } else {
      // Nếu không hiện book, chuyển thẳng sang hiệu ứng mưa chữ (nếu có messages)
      setTimeout(function() {
        // Kiểm tra messages từ API - nếu rỗng hoặc không có thì không chạy hiệu ứng mưa chữ
        let shouldStartSnowEffects = false;
        try {
          if (window.apiData && window.apiData.hasOwnProperty('messages')) {
            if (typeof window.apiData.messages === 'string') {
              const messages = window.apiData.messages.trim();
              if (messages !== '') {
                shouldStartSnowEffects = true;
              } else {
                console.log('messages rỗng, bỏ qua hiệu ứng mưa chữ');
              }
            } else if (Array.isArray(window.apiData.messages) && window.apiData.messages.length > 0) {
              shouldStartSnowEffects = true;
            } else {
              console.log('messages rỗng hoặc không hợp lệ, bỏ qua hiệu ứng mưa chữ');
            }
          } else {
            console.log('Không có trường messages trong apiData, bỏ qua hiệu ứng mưa chữ');
          }
        } catch (e) {
          console.warn('Không kiểm tra được messages:', e);
        }
        
        if (shouldStartSnowEffects && typeof startSnowEffects === 'function') {
          startSnowEffects();
          setTimeout(function() {
            if (renderer && renderer.domElement) {
              renderer.domElement.style.display = 'block';
              renderer.domElement.style.pointerEvents = 'auto';
            }
            if (typeof startAnimate === 'function') {
              startAnimate();
            }
          }, 100);
        }
      }, 500);
    }
  }, totalDelay);
}
