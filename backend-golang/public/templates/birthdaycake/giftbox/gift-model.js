(function () {
  "use strict";

  function boot() {
    if (!window.THREE) {
      requestAnimationFrame(boot);
      return;
    }

    var THREE = window.THREE;
    var host = document.getElementById("gift-box-canvas");
    var trigger = document.getElementById("gift-cube");
    if (!host || !trigger || host.__giftModelReady) return;
    host.__giftModelReady = true;

    var scene = new THREE.Scene();
    var camera = new THREE.PerspectiveCamera(34, 1, 0.1, 100);
    camera.position.set(5.2, 3.8, 7.3);
    camera.lookAt(0, 0.2, 0);

    var renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true,
      powerPreference: "high-performance"
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    host.appendChild(renderer.domElement);

    scene.add(new THREE.HemisphereLight(0xfff7fb, 0x8c3763, 2.7));
    var keyLight = new THREE.DirectionalLight(0xffffff, 4.2);
    keyLight.position.set(4, 7, 6);
    scene.add(keyLight);
    var rimLight = new THREE.DirectionalLight(0xff9fc6, 2.2);
    rimLight.position.set(-5, 2, -3);
    scene.add(rimLight);

    var pinkMaterial = new THREE.MeshStandardMaterial({
      color: 0xe83f83,
      roughness: 0.32,
      metalness: 0.08
    });
    var lidMaterial = new THREE.MeshStandardMaterial({
      color: 0xf15d98,
      roughness: 0.3,
      metalness: 0.08
    });
    var goldMaterial = new THREE.MeshStandardMaterial({
      color: 0xffd768,
      roughness: 0.27,
      metalness: 0.22
    });

    var model = new THREE.Group();
    model.rotation.y = -0.28;
    scene.add(model);

    var body = new THREE.Group();
    var wallThickness = 0.16;
    var bodyY = -0.48;

    function addBodyPart(width, height, depth, x, y, z) {
      var part = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), pinkMaterial);
      part.position.set(x, y, z);
      body.add(part);
      return part;
    }

    addBodyPart(3.45, 2.55, wallThickness, 0, bodyY, 1.445);
    addBodyPart(3.45, 2.55, wallThickness, 0, bodyY, -1.445);
    addBodyPart(wallThickness, 2.55, 2.73, -1.645, bodyY, 0);
    addBodyPart(wallThickness, 2.55, 2.73, 1.645, bodyY, 0);
    addBodyPart(3.45, wallThickness, 3.05, 0, -1.715, 0);

    [
      [0.46, 2.58, 0.08, 0, bodyY, 1.535],
      [0.46, 2.58, 0.08, 0, bodyY, -1.535],
      [0.08, 2.58, 0.46, -1.735, bodyY, 0],
      [0.08, 2.58, 0.46, 1.735, bodyY, 0]
    ].forEach(function (spec) {
      var ribbon = new THREE.Mesh(
        new THREE.BoxGeometry(spec[0], spec[1], spec[2]),
        goldMaterial
      );
      ribbon.position.set(spec[3], spec[4], spec[5]);
      body.add(ribbon);
    });

    var innerFloor = new THREE.Mesh(
      new THREE.BoxGeometry(3.1, 0.08, 2.7),
      new THREE.MeshStandardMaterial({ color: 0x8f2055, roughness: 0.65 })
    );
    innerFloor.position.y = -1.61;
    body.add(innerFloor);
    model.add(body);

    var lidPivot = new THREE.Group();
    lidPivot.position.set(0, 1.02, -1.52);
    model.add(lidPivot);

    var lid = new THREE.Group();
    lid.position.z = 1.52;

    var lidBox = new THREE.Mesh(new THREE.BoxGeometry(3.8, 0.58, 3.38), lidMaterial);
    lid.add(lidBox);

    var lidUnderside = new THREE.Mesh(
      new THREE.BoxGeometry(3.54, 0.08, 3.12),
      new THREE.MeshStandardMaterial({
        color: 0xb72f6c,
        roughness: 0.58,
        metalness: 0.02
      })
    );
    lidUnderside.position.y = -0.32;
    lid.add(lidUnderside);

    var lidRibbonFront = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.62, 3.43), goldMaterial);
    lid.add(lidRibbonFront);

    var lidRibbonSide = new THREE.Mesh(new THREE.BoxGeometry(3.85, 0.62, 0.5), goldMaterial);
    lid.add(lidRibbonSide);


    lidPivot.add(lid);

    var surpriseLight = new THREE.PointLight(0xffd76d, 0, 5.5, 2);
    surpriseLight.position.set(0, 0.25, 0);
    model.add(surpriseLight);

    var surpriseHeartShape = new THREE.Shape();
    surpriseHeartShape.moveTo(0, -1);
    surpriseHeartShape.bezierCurveTo(-0.2, -0.75, -1.2, -0.15, -1.2, 0.55);
    surpriseHeartShape.bezierCurveTo(-1.2, 1.2, -0.35, 1.35, 0, 0.72);
    surpriseHeartShape.bezierCurveTo(0.35, 1.35, 1.2, 1.2, 1.2, 0.55);
    surpriseHeartShape.bezierCurveTo(1.2, -0.15, 0.2, -0.75, 0, -1);
    var surpriseHeartGeometry = new THREE.ShapeGeometry(surpriseHeartShape, 14);
    surpriseHeartGeometry.center();

    var surpriseBits = [];
    for (var bitIndex = 0; bitIndex < 12; bitIndex++) {
      var bit = new THREE.Mesh(
        surpriseHeartGeometry,
        new THREE.MeshBasicMaterial({
          color: bitIndex % 3 === 0 ? 0xffd868 : (bitIndex % 2 ? 0xff6f9f : 0xffa8c4),
          side: THREE.DoubleSide,
          transparent: true,
          opacity: 0
        })
      );
      bit.scale.setScalar(0.08 + Math.random() * 0.05);
      bit.position.set((Math.random() - 0.5) * 1.8, -1.2, (Math.random() - 0.5) * 1.5);
      bit.rotation.z = (Math.random() - 0.5) * 0.8;
      bit.userData.speed = 0.6 + Math.random() * 0.8;
      bit.userData.spin = (Math.random() - 0.5) * 0.025;
      bit.userData.phase = Math.random() * Math.PI * 2;
      model.add(bit);
      surpriseBits.push(bit);
    }

    var shadow = new THREE.Mesh(
      new THREE.CircleGeometry(2.35, 64),
      new THREE.MeshBasicMaterial({
        color: 0xb73c75,
        transparent: true,
        opacity: 0.18,
        depthWrite: false
      })
    );
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = -1.83;
    shadow.scale.y = 0.48;
    scene.add(shadow);

    var opening = false;
    var openProgress = 0;
    var pointerX = 0;
    var pointerY = 0;

    new MutationObserver(function () {
      if (trigger.classList.contains("open")) opening = true;
    }).observe(trigger, { attributes: true, attributeFilter: ["class"] });

    trigger.addEventListener("pointermove", function (event) {
      var rect = trigger.getBoundingClientRect();
      pointerX = ((event.clientX - rect.left) / rect.width - 0.5) * 2;
      pointerY = ((event.clientY - rect.top) / rect.height - 0.5) * 2;
    });

    trigger.addEventListener("pointerleave", function () {
      pointerX = 0;
      pointerY = 0;
    });

    function resize() {
      var width = Math.max(1, host.clientWidth);
      var height = Math.max(1, host.clientHeight);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      // The canvas is larger than the box footprint (see #gift-box-canvas inset
      // in CSS) so the lid has room to travel. Zoom back in by the same ratio so
      // the box renders at its original on-screen size.
      var footprint = (trigger && trigger.clientWidth) || width;
      camera.zoom = footprint / width;
      camera.updateProjectionMatrix();
    }

    var start = performance.now();
    function animate(now) {
      requestAnimationFrame(animate);
      var time = (now - start) / 1000;

      if (opening) {
        openProgress += (1 - openProgress) * 0.035;
        var eased = 1 - Math.pow(1 - openProgress, 3);
        lidPivot.position.x = eased * 1.2;
        lidPivot.position.y = 1.02 + eased * 1.05;
        lidPivot.position.z = -1.52 + eased * 0.25;
        lidPivot.rotation.x = -eased * 0.22;
        lidPivot.rotation.y = eased * 0.12;
        lidPivot.rotation.z = -eased * 0.18;
        model.rotation.y += 0.004;
        surpriseLight.intensity = eased * 7;
        surpriseBits.forEach(function (bit, index) {
          bit.material.opacity = Math.min(1, eased * 1.6) * Math.max(0, 1 - Math.max(0, openProgress - 0.78) * 4);
          bit.position.y = -1.2 + eased * bit.userData.speed * 3.2;
          bit.position.x += Math.sin(time * 2.4 + bit.userData.phase + index) * 0.002;
          bit.rotation.z += bit.userData.spin;
        });
      } else {
        model.position.y = Math.sin(time * 1.35) * 0.12;
        model.rotation.y += 0.0035;
        model.rotation.x += ((-pointerY * 0.08) - model.rotation.x) * 0.04;
        model.rotation.z += ((-pointerX * 0.035) - model.rotation.z) * 0.04;
      }

      renderer.render(scene, camera);
    }

    window.addEventListener("resize", resize);
    resize();
    requestAnimationFrame(animate);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
