import {
  FilesetResolver,
  GestureRecognizer
} from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/+esm";

const video = document.querySelector("#video");
const canvas = document.querySelector("#canvas");
const ctx = canvas.getContext("2d");
const startBtn = document.querySelector("#startBtn");
const intro = document.querySelector("#intro");
const statusText = document.querySelector("#statusText");
const debugText = document.querySelector("#debugText");
const hint = document.querySelector("#hint");
const hintText = document.querySelector("#hintText");
const message = document.querySelector("#message");
const errorBox = document.querySelector("#errorBox");

let recognizer = null;
let running = false;
let lastVideoTime = -1;
let lastResult = null;
let fistFrames = 0;
let openFrames = 0;
let flowerVisible = false;
let flowerScale = 0;

const bouquet = new Image();
bouquet.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 520">
<g>
<g stroke="#416847" stroke-width="9" stroke-linecap="round">
<path d="M155 440 L118 122"/><path d="M158 442 L155 94"/><path d="M160 442 L194 117"/>
<path d="M158 442 L88 165"/><path d="M160 442 L230 162"/>
</g>
<g fill="#547a53">
<ellipse cx="120" cy="280" rx="23" ry="55" transform="rotate(-35 120 280)"/>
<ellipse cx="199" cy="300" rx="23" ry="58" transform="rotate(37 199 300)"/>
</g>
<g>
<circle cx="83" cy="128" r="43" fill="#d92e55"/>
<circle cx="155" cy="87" r="47" fill="#ef5473"/>
<circle cx="229" cy="126" r="42" fill="#d72d55"/>
<circle cx="116" cy="178" r="38" fill="#f3a7b8"/>
<circle cx="198" cy="180" r="39" fill="#f7b4c2"/>
</g>
<path d="M70 230 Q158 275 250 230 L207 468 Q160 505 111 468 Z" fill="#ead4bc" opacity=".96"/>
<path d="M123 399 Q160 416 198 398 L192 433 Q159 448 128 431 Z" fill="#b6294b"/>
</g>
</svg>`);

function showError(msg) {
  console.error(msg);
  errorBox.textContent = msg;
  errorBox.classList.remove("hidden");
}

async function openCameraFirst() {
  if (!window.isSecureContext) {
    throw new Error("這個網址不是 HTTPS。iPhone Safari 必須用 HTTPS 才能開相機。");
  }
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    throw new Error("這個瀏覽器沒有提供相機 API。請直接使用 Safari 開啟網址。");
  }

  statusText.textContent = "正在要求相機權限…";

  const stream = await navigator.mediaDevices.getUserMedia({
    audio: false,
    video: {
      facingMode: { ideal: "user" },
      width: { ideal: 1280 },
      height: { ideal: 720 }
    }
  });

  video.srcObject = stream;

  // Important on iOS: explicitly call play() after assigning srcObject.
  await video.play();

  // Wait until iOS actually knows the camera dimensions.
  if (!video.videoWidth) {
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("相機已授權，但 Safari 沒有開始輸出影像。")), 5000);
      video.onloadedmetadata = () => {
        clearTimeout(timer);
        resolve();
      };
    });
  }

  return stream;
}

async function initRecognizer() {
  hintText.textContent = "相機已開啟，正在載入手勢辨識…";

  const vision = await FilesetResolver.forVisionTasks(
    "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/wasm"
  );

  recognizer = await GestureRecognizer.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath:
        "https://storage.googleapis.com/mediapipe-models/gesture_recognizer/gesture_recognizer/float16/1/gesture_recognizer.task",
      delegate: "CPU"
    },
    runningMode: "VIDEO",
    numHands: 1,
    minHandDetectionConfidence: 0.5,
    minHandPresenceConfidence: 0.5,
    minTrackingConfidence: 0.5
  });

  hintText.textContent = "把手放進畫面，然後握拳 ✊";
}

async function start() {
  startBtn.disabled = true;
  errorBox.classList.add("hidden");

  try {
    await openCameraFirst();

    intro.classList.add("hide");
    hint.classList.remove("hidden");
    running = true;
    resizeCanvas();
    requestAnimationFrame(loop);

    try {
      await initRecognizer();
    } catch (e) {
      showError("相機已成功開啟，但手勢模型載入失敗。請確認網路正常後重新整理。錯誤：" + (e?.message || e));
      hintText.textContent = "相機正常，但手勢辨識載入失敗";
    }
  } catch (e) {
    startBtn.disabled = false;
    startBtn.textContent = "再試一次";
    statusText.textContent = "相機沒有成功開啟";
    debugText.textContent = e?.name ? `錯誤：${e.name}` : "";
    showError(
      e?.name === "NotAllowedError"
        ? "Safari 沒有相機權限。到「設定 → Safari → 相機」，改成允許，或點網址列左邊的頁面設定允許相機。"
        : e?.name === "NotFoundError"
        ? "找不到可用的相機。"
        : "開啟相機失敗：" + (e?.message || e)
    );
  }
}

function resizeCanvas() {
  const dpr = Math.min(devicePixelRatio || 1, 2);
  canvas.width = Math.round(innerWidth * dpr);
  canvas.height = Math.round(innerHeight * dpr);
  canvas.style.width = innerWidth + "px";
  canvas.style.height = innerHeight + "px";
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function lmToScreen(lm) {
  // video is CSS-mirrored, so mirror x here too
  return { x: (1 - lm.x) * innerWidth, y: lm.y * innerHeight };
}

function metrics(lms) {
  const wrist = lmToScreen(lms[0]);
  const mid = lmToScreen(lms[9]);
  const index = lmToScreen(lms[5]);
  const pinky = lmToScreen(lms[17]);

  return {
    x: (wrist.x + mid.x + index.x + pinky.x) / 4,
    y: (wrist.y + mid.y + index.y + pinky.y) / 4,
    width: Math.hypot(
      index.x - pinky.x,
      index.y - pinky.y
    ),
    angle: Math.atan2(
      mid.y - wrist.y,
      mid.x - wrist.x
    )
  };
}

function drawBouquet(m) {
  flowerScale +=
    ((flowerVisible ? 1 : 0) - flowerScale) * 0.15;

  if (flowerScale < 0.02) return;

  const h = Math.max(
    200,
    Math.min(420, m.width * 6)
  );

  const w = h * 0.62;

  ctx.save();

  // 拳頭頂端
  ctx.translate(
    m.x,
    m.y + m.width * 0.1
  );

  // 從小長大
  ctx.scale(
    flowerScale,
    flowerScale
  );

  /*
    圖片底端落在拳頭上，
    所以整束花往上畫
  */
  ctx.drawImage(
    bouquet,

    -w / 2,

    // 控制花束高度
    -h * 0.96,

    w,
    h
  );

  ctx.restore();
}

function updateGesture(result) {
  if (!result?.landmarks?.length) {
    fistFrames = Math.max(0, fistFrames - 2);
    openFrames++;

    if (openFrames > 4) {
      flowerVisible = false;
      message.classList.remove("show");
    }

    return null;
  }

  const top = result.gestures?.[0]?.[0];

  const isFist =
    top?.categoryName === "Closed_Fist" &&
    top.score > 0.35;

  const m = metrics(result.landmarks[0]);

  if (isFist) {
    fistFrames++;
    openFrames = 0;

    hintText.textContent = "就是這樣 ✨";

    if (fistFrames >= 3) {
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

  return m;
}

function loop() {
  if (!running) return;
  ctx.clearRect(0, 0, innerWidth, innerHeight);

  if (recognizer && video.readyState >= 2 && video.currentTime !== lastVideoTime) {
    lastVideoTime = video.currentTime;
    try {
      lastResult = recognizer.recognizeForVideo(video, performance.now());
    } catch (e) {
      console.error(e);
    }
  }

  if (lastResult) {
    const m = updateGesture(lastResult);
    if (m) drawBouquet(m);
  }

  requestAnimationFrame(loop);
}

startBtn.addEventListener("click", start, { passive: true });
window.addEventListener("resize", resizeCanvas);
window.addEventListener("orientationchange", () => setTimeout(resizeCanvas, 200));
