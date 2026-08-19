import {
  FilesetResolver,
  GestureRecognizer
} from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22/+esm";

const video = document.querySelector("#video");
const canvas = document.querySelector("#canvas");
const ctx = canvas.getContext("2d");
const startBtn = document.querySelector("#startBtn");
const intro = document.querySelector("#intro");
const hint = document.querySelector("#hint");
const hintText = document.querySelector("#hintText");
const loading = document.querySelector("#loading");
const message = document.querySelector("#message");

let recognizer = null;
let running = false;
let lastVideoTime = -1;
let fistFrames = 0;
let openFrames = 0;
let flowerVisible = false;
let flowerScale = 0;
let particles = [];
let lastParticleBurst = 0;

const bouquet = new Image();
bouquet.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 520">
  <defs>
    <filter id="shadow" x="-40%" y="-40%" width="180%" height="180%">
      <feDropShadow dx="0" dy="9" stdDeviation="8" flood-opacity=".28"/>
    </filter>
    <linearGradient id="wrap" x1="0" x2="1">
      <stop offset="0" stop-color="#ead4bc"/>
      <stop offset=".55" stop-color="#f7ead9"/>
      <stop offset="1" stop-color="#d5b89b"/>
    </linearGradient>
  </defs>

  <g filter="url(#shadow)">
    <!-- stems -->
    <g stroke="#416847" stroke-width="9" stroke-linecap="round">
      <path d="M155 440 L118 122"/>
      <path d="M158 442 L155 94"/>
      <path d="M160 442 L194 117"/>
      <path d="M158 442 L88 165"/>
      <path d="M160 442 L230 162"/>
      <path d="M158 442 L124 180"/>
      <path d="M160 442 L195 185"/>
    </g>

    <!-- leaves -->
    <g fill="#547a53">
      <ellipse cx="120" cy="280" rx="23" ry="55" transform="rotate(-35 120 280)"/>
      <ellipse cx="199" cy="300" rx="23" ry="58" transform="rotate(37 199 300)"/>
      <ellipse cx="101" cy="235" rx="18" ry="43" transform="rotate(-49 101 235)"/>
      <ellipse cx="219" cy="237" rx="18" ry="44" transform="rotate(45 219 237)"/>
    </g>

    <!-- flowers -->
    <g>
      <g transform="translate(83 128)">
        <circle r="43" fill="#d92e55"/><circle cx="-26" cy="-11" r="25" fill="#ed4a6e"/>
        <circle cx="25" cy="-14" r="25" fill="#c92348"/><circle cy="-27" r="25" fill="#f16a87"/>
        <circle cx="4" cy="8" r="24" fill="#bd173d"/>
      </g>
      <g transform="translate(155 87)">
        <circle r="47" fill="#ef5473"/><circle cx="-28" cy="-8" r="27" fill="#ff7991"/>
        <circle cx="28" cy="-10" r="27" fill="#d72d52"/><circle cy="-29" r="28" fill="#f96a84"/>
        <circle cx="3" cy="8" r="25" fill="#c92247"/>
      </g>
      <g transform="translate(229 126)">
        <circle r="42" fill="#d72d55"/><circle cx="-25" cy="-10" r="24" fill="#f35e7e"/>
        <circle cx="25" cy="-12" r="24" fill="#c31e45"/><circle cy="-27" r="25" fill="#ed6b87"/>
        <circle cx="1" cy="8" r="23" fill="#b9163c"/>
      </g>
      <g transform="translate(116 178)">
        <circle r="38" fill="#f3a7b8"/><circle cx="-22" cy="-8" r="22" fill="#ffd0d9"/>
        <circle cx="22" cy="-10" r="22" fill="#e9889f"/><circle cy="-24" r="22" fill="#ffc3d0"/>
        <circle cx="2" cy="7" r="21" fill="#dc6c89"/>
      </g>
      <g transform="translate(198 180)">
        <circle r="39" fill="#f7b4c2"/><circle cx="-23" cy="-9" r="22" fill="#ffd8df"/>
        <circle cx="22" cy="-11" r="22" fill="#eb91a7"/><circle cy="-24" r="23" fill="#ffcbd5"/>
        <circle cx="1" cy="7" r="21" fill="#df758f"/>
      </g>
    </g>

    <!-- bouquet paper -->
    <path d="M70 230 Q158 275 250 230 L207 468 Q160 505 111 468 Z" fill="url(#wrap)" opacity=".96"/>
    <path d="M70 230 L145 319 L111 468 Z" fill="#e2c7aa" opacity=".78"/>
    <path d="M250 230 L174 319 L207 468 Z" fill="#f8ead7" opacity=".82"/>

    <!-- ribbon -->
    <path d="M123 399 Q160 416 198 398 L192 433 Q159 448 128 431 Z" fill="#b6294b"/>
    <path d="M139 424 L105 487 L153 445 Z" fill="#9f1f3e"/>
    <path d="M178 425 L214 486 L166 445 Z" fill="#c63555"/>
  </g>
</svg>
`);

async function initRecognizer() {
  loading.classList.remove("hidden");

  const vision = await FilesetResolver.forVisionTasks(
    "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22/wasm"
  );

  recognizer = await GestureRecognizer.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath:
        "https://storage.googleapis.com/mediapipe-tasks/gesture_recognizer/gesture_recognizer.task",
      delegate: "CPU"
    },
    runningMode: "VIDEO",
    numHands: 1,
    minHandDetectionConfidence: 0.55,
    minHandPresenceConfidence: 0.55,
    minTrackingConfidence: 0.5
  });
}

async function startCamera() {
  startBtn.disabled = true;
  startBtn.textContent = "準備中…";

  try {
    if (!recognizer) await initRecognizer();

    const stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: {
        facingMode: "user",
        width: { ideal: 1280 },
        height: { ideal: 720 }
      }
    });

    video.srcObject = stream;
    await video.play();

    running = true;
    intro.classList.add("hide");
    loading.classList.add("hidden");
    hint.classList.remove("hidden");

    resizeCanvas();
    requestAnimationFrame(loop);
  } catch (err) {
    console.error(err);
    loading.classList.add("hidden");
    startBtn.disabled = false;
    startBtn.textContent = "再試一次";

    if (!window.isSecureContext) {
      alert("手機鏡頭需要 HTTPS 網址。請部署到 GitHub Pages、Vercel 或 Netlify 後再開啟。");
    } else {
      alert("無法開啟鏡頭。請允許瀏覽器使用相機後再試一次。");
    }
  }
}

function resizeCanvas() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(innerWidth * dpr);
  canvas.height = Math.round(innerHeight * dpr);
  canvas.style.width = innerWidth + "px";
  canvas.style.height = innerHeight + "px";
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function drawCoverMirrored(video, targetW, targetH) {
  const vw = video.videoWidth;
  const vh = video.videoHeight;
  if (!vw || !vh) return null;

  const scale = Math.max(targetW / vw, targetH / vh);
  const drawW = vw * scale;
  const drawH = vh * scale;
  const dx = (targetW - drawW) / 2;
  const dy = (targetH - drawH) / 2;

  ctx.save();
  ctx.translate(targetW, 0);
  ctx.scale(-1, 1);
  ctx.drawImage(video, targetW - dx - drawW, dy, drawW, drawH);
  ctx.restore();

  return { scale, drawW, drawH, dx, dy, vw, vh };
}

function landmarkToScreen(lm, cover) {
  // MediaPipe sees the original camera image; canvas displays it mirrored.
  const rawX = cover.dx + lm.x * cover.drawW;
  const rawY = cover.dy + lm.y * cover.drawH;
  return {
    x: innerWidth - rawX,
    y: rawY
  };
}

function handMetrics(landmarks, cover) {
  const wrist = landmarkToScreen(landmarks[0], cover);
  const middleMcp = landmarkToScreen(landmarks[9], cover);
  const indexMcp = landmarkToScreen(landmarks[5], cover);
  const pinkyMcp = landmarkToScreen(landmarks[17], cover);

  const palmX = (wrist.x + middleMcp.x + indexMcp.x + pinkyMcp.x) / 4;
  const palmY = (wrist.y + middleMcp.y + indexMcp.y + pinkyMcp.y) / 4;

  const palmWidth = Math.hypot(indexMcp.x - pinkyMcp.x, indexMcp.y - pinkyMcp.y);
  const angle = Math.atan2(middleMcp.y - wrist.y, middleMcp.x - wrist.x);

  return { wrist, middleMcp, palmX, palmY, palmWidth, angle };
}

function drawBouquet(metrics) {
  flowerScale += ((flowerVisible ? 1 : 0) - flowerScale) * 0.18;
  if (flowerScale < 0.02) return;

  const size = Math.max(180, Math.min(390, metrics.palmWidth * 5.7));
  const w = size * 0.62;
  const h = size;

  // Bouquet points opposite the wrist direction, with stems ending near the fist.
  const flowerAngle = metrics.angle + Math.PI / 2;
  const anchorX = metrics.palmX;
  const anchorY = metrics.palmY;

  ctx.save();
  ctx.translate(anchorX, anchorY);
  ctx.rotate(flowerAngle);
  const pop = flowerScale * (0.88 + 0.12 * Math.sin(Math.min(1, flowerScale) * Math.PI / 2));
  ctx.scale(pop, pop);

  // Move bottom of bouquet to the fist so stems look held in the hand.
  ctx.drawImage(bouquet, -w / 2, -h * 0.91, w, h);
  ctx.restore();
}

function spawnParticles(x, y) {
  const now = performance.now();
  if (now - lastParticleBurst < 900) return;
  lastParticleBurst = now;

  for (let i = 0; i < 18; i++) {
    particles.push({
      x,
      y,
      vx: (Math.random() - 0.5) * 2.5,
      vy: -1 - Math.random() * 2.5,
      life: 1,
      size: 4 + Math.random() * 6,
      spin: Math.random() * Math.PI
    });
  }
}

function drawParticles() {
  for (const p of particles) {
    p.x += p.vx;
    p.y += p.vy;
    p.vy += 0.025;
    p.life -= 0.018;
    p.spin += 0.08;

    ctx.save();
    ctx.globalAlpha = Math.max(0, p.life);
    ctx.translate(p.x, p.y);
    ctx.rotate(p.spin);
    ctx.font = `${p.size * 2}px serif`;
    ctx.fillText(Math.random() > .55 ? "✦" : "♥", 0, 0);
    ctx.restore();
  }
  particles = particles.filter(p => p.life > 0);
}

function updateGesture(result, cover) {
  const hasHand = result?.landmarks?.length > 0;
  if (!hasHand) {
    fistFrames = Math.max(0, fistFrames - 2);
    openFrames++;
    hintText.textContent = "把手放進畫面，然後握拳 ✊";
    flowerVisible = false;
    message.classList.remove("show");
    return null;
  }

  const gesture = result.gestures?.[0]?.[0];
  const name = gesture?.categoryName || "None";
  const score = gesture?.score || 0;
  const metrics = handMetrics(result.landmarks[0], cover);

  if (name === "Closed_Fist" && score > 0.55) {
    fistFrames++;
    openFrames = 0;
    hintText.textContent = "就是這樣… ✨";

    // Debounce so an accidental partial fist doesn't flash the flower.
    if (fistFrames >= 3) {
      if (!flowerVisible) spawnParticles(metrics.palmX, metrics.palmY - 120);
      flowerVisible = true;
      message.classList.add("show");
      hint.classList.add("hidden");
    }
  } else {
    fistFrames = Math.max(0, fistFrames - 1);
    openFrames++;

    if (openFrames > 5) {
      flowerVisible = false;
      message.classList.remove("show");
      hint.classList.remove("hidden");
      hintText.textContent = "握拳看看 ✊";
    }
  }

  return metrics;
}

function loop() {
  if (!running) return;

  ctx.clearRect(0, 0, innerWidth, innerHeight);
  const cover = drawCoverMirrored(video, innerWidth, innerHeight);

  if (cover && recognizer && video.readyState >= 2) {
    if (video.currentTime !== lastVideoTime) {
      lastVideoTime = video.currentTime;
      const result = recognizer.recognizeForVideo(video, performance.now());
      window.__lastGestureResult = result;
    }

    const metrics = updateGesture(window.__lastGestureResult, cover);
    if (metrics) drawBouquet(metrics);
    else flowerScale += (0 - flowerScale) * 0.18;
  }

  drawParticles();
  requestAnimationFrame(loop);
}

startBtn.addEventListener("click", startCamera);
window.addEventListener("resize", resizeCanvas);
window.addEventListener("orientationchange", () => setTimeout(resizeCanvas, 150));
