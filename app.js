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


// ======================================================
// 花束
// ======================================================

const bouquet = new Image();
bouquet.src = "./flower.png";


// ======================================================
// Error
// ======================================================

function showError(msg) {

  console.error(msg);

  if (!errorBox) return;

  errorBox.textContent = msg;
  errorBox.classList.remove("hidden");

}


// ======================================================
// 開啟手機相機
// ======================================================

async function openCameraFirst() {

  if (!window.isSecureContext) {

    throw new Error(
      "這個網址不是 HTTPS。iPhone Safari 必須使用 HTTPS。"
    );

  }


  if (
    !navigator.mediaDevices ||
    !navigator.mediaDevices.getUserMedia
  ) {

    throw new Error(
      "這個瀏覽器沒有提供相機功能。請使用 Safari 開啟。"
    );

  }


  statusText.textContent =
    "正在要求相機權限…";


  const stream =
    await navigator.mediaDevices.getUserMedia({

      audio: false,

      video: {

        facingMode: {
          ideal: "user"
        },

        width: {
          ideal: 1280
        },

        height: {
          ideal: 720
        }

      }

    });


  video.srcObject = stream;

  await video.play();


  if (!video.videoWidth) {

    await new Promise((resolve, reject) => {

      const timer =
        setTimeout(() => {

          reject(
            new Error(
              "Safari 沒有開始輸出相機畫面。"
            )
          );

        }, 5000);


      video.onloadedmetadata = () => {

        clearTimeout(timer);

        resolve();

      };

    });

  }


  return stream;

}


// ======================================================
// MediaPipe
// ======================================================

async function initRecognizer() {

  hintText.textContent =
    "相機已開啟，正在載入手勢辨識…";


  const vision =
    await FilesetResolver.forVisionTasks(

      "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/wasm"

    );


  recognizer =
    await GestureRecognizer.createFromOptions(

      vision,

      {

        baseOptions: {

          modelAssetPath:
            "https://storage.googleapis.com/mediapipe-models/gesture_recognizer/gesture_recognizer/float16/1/gesture_recognizer.task",

          delegate: "CPU"

        },


        runningMode: "VIDEO",

        numHands: 1,


        // 稍微降低門檻
        minHandDetectionConfidence: 0.45,

        minHandPresenceConfidence: 0.45,

        minTrackingConfidence: 0.45

      }

    );


  hintText.textContent =
    "把手放進畫面，然後握拳 👊";

}


// ======================================================
// 啟動
// ======================================================

async function start() {

  startBtn.disabled = true;


  if (errorBox) {

    errorBox.classList.add("hidden");

  }


  try {

    await openCameraFirst();


    intro.classList.add("hide");

    hint.classList.remove("hidden");


    running = true;


    resizeCanvas();


    requestAnimationFrame(loop);


    try {

      await initRecognizer();

    }

    catch (e) {

      showError(
        "相機已開啟，但手勢辨識載入失敗：" +
        (e?.message || e)
      );


      hintText.textContent =
        "手勢辨識載入失敗";

    }

  }

  catch (e) {

    startBtn.disabled = false;

    startBtn.textContent =
      "再試一次";


    statusText.textContent =
      "相機沒有成功開啟";


    if (debugText) {

      debugText.textContent =
        e?.name
          ? `錯誤：${e.name}`
          : "";

    }


    showError(

      e?.name === "NotAllowedError"

        ? "Safari 沒有相機權限，請允許網站使用相機。"

        : e?.name === "NotFoundError"

        ? "找不到相機。"

        : "開啟相機失敗：" +
          (e?.message || e)

    );

  }

}


// ======================================================
// Canvas
// ======================================================

function resizeCanvas() {

  const dpr =
    Math.min(
      devicePixelRatio || 1,
      2
    );


  canvas.width =
    Math.round(
      innerWidth * dpr
    );


  canvas.height =
    Math.round(
      innerHeight * dpr
    );


  canvas.style.width =
    innerWidth + "px";


  canvas.style.height =
    innerHeight + "px";


  ctx.setTransform(
    dpr,
    0,
    0,
    dpr,
    0,
    0
  );

}


// ======================================================
// Landmark → 畫面座標
// ======================================================

function lmToScreen(lm) {

  return {

    // 前鏡頭鏡像
    x:
      (1 - lm.x) *
      innerWidth,

    y:
      lm.y *
      innerHeight

  };

}


// ======================================================
// 計算拳頭位置
// ======================================================

function metrics(lms) {

  const wrist =
    lmToScreen(lms[0]);


  const mid =
    lmToScreen(lms[9]);


  const index =
    lmToScreen(lms[5]);


  const pinky =
    lmToScreen(lms[17]);


  return {

    x:
      (
        wrist.x +
        mid.x +
        index.x +
        pinky.x
      ) / 4,


    y:
      (
        wrist.y +
        mid.y +
        index.y +
        pinky.y
      ) / 4,


    width:
      Math.hypot(

        index.x -
        pinky.x,

        index.y -
        pinky.y

      ),


    angle:
      Math.atan2(

        mid.y -
        wrist.y,

        mid.x -
        wrist.x

      )

  };

}


// ======================================================
// Landmark 3D 距離
// ======================================================

function dist(a, b) {

  return Math.hypot(

    a.x - b.x,

    a.y - b.y,

    (a.z || 0) -
    (b.z || 0)

  );

}


// ======================================================
// 自訂「寬鬆拳頭」判斷
//
// 主要就是要辨識 👊 這種拳頭。
// 不要求拳頭方向。
// 不要求完全握緊。
// ======================================================

function isTargetFist(lms) {

  if (
    !lms ||
    lms.length < 21
  ) {

    return false;

  }


  // --------------------------------------------------
  // 掌心中心
  // --------------------------------------------------

  const palm = {

    x:
      (
        lms[0].x +
        lms[5].x +
        lms[9].x +
        lms[13].x +
        lms[17].x
      ) / 5,


    y:
      (
        lms[0].y +
        lms[5].y +
        lms[9].y +
        lms[13].y +
        lms[17].y
      ) / 5,


    z:
      (
        (lms[0].z || 0) +
        (lms[5].z || 0) +
        (lms[9].z || 0) +
        (lms[13].z || 0) +
        (lms[17].z || 0)
      ) / 5

  };


  // --------------------------------------------------
  // 手掌寬度
  // --------------------------------------------------

  const palmWidth =
    dist(
      lms[5],
      lms[17]
    );


  if (
    !palmWidth ||
    palmWidth < 0.01
  ) {

    return false;

  }


  // --------------------------------------------------
  // 四根手指
  //
  // 8  = 食指尖
  // 12 = 中指尖
  // 16 = 無名指尖
  // 20 = 小指尖
  // --------------------------------------------------

  const fingerTips = [
    8,
    12,
    16,
    20
  ];


  let closedFingers = 0;


  for (
    const tipIndex
    of fingerTips
  ) {

    const tip =
      lms[tipIndex];


    const distanceToPalm =
      dist(
        tip,
        palm
      );


    // ------------------------------------------------
    // 數字越大越容易判斷成拳頭
    // ------------------------------------------------

    if (
      distanceToPalm <
      palmWidth * 1.60
    ) {

      closedFingers++;

    }

  }


  // --------------------------------------------------
  // 拇指
  // --------------------------------------------------

  const thumbTip =
    lms[4];


  const thumbClosed =

    dist(
      thumbTip,
      lms[5]
    ) <
      palmWidth * 1.65

    ||

    dist(
      thumbTip,
      lms[9]
    ) <
      palmWidth * 1.65

    ||

    dist(
      thumbTip,
      palm
    ) <
      palmWidth * 1.65;


  // --------------------------------------------------
  // 至少 3 根手指收起
  // + 拇指靠近拳頭
  // --------------------------------------------------

  return (

    closedFingers >= 3

    &&

    thumbClosed

  );

}


// ======================================================
// 畫花束
// ======================================================

function drawBouquet(m) {
  flowerScale +=
    ((flowerVisible ? 1 : 0) - flowerScale) * 0.18;

  if (flowerScale < 0.02) return;

  // 圖片還沒載入完成就先不畫
  if (!bouquet.complete || !bouquet.naturalWidth) return;

  const h = Math.max(
    190,
    Math.min(390, m.width * 5.8)
  );

  // 保持原始圖片比例
  const ratio =
    bouquet.naturalWidth /
    bouquet.naturalHeight;

  const w = h * ratio;

  ctx.save();

  // 拳頭的位置
  ctx.translate(
    m.x - 40,
    m.y + m.width * 0.15 + 50
  );

  // 花出現動畫
  ctx.scale(
    flowerScale,
    flowerScale
  );

  // PNG 透明背景會自動保留
  ctx.drawImage(
    bouquet,
    -w / 2,
    -h * 0.91,
    w,
    h
  );

  ctx.restore();
}


// ======================================================
// 手勢判斷
// ======================================================

function updateGesture(result) {

  // --------------------------------------------------
  // 沒看到手
  // --------------------------------------------------

  if (
    !result?.landmarks?.length
  ) {

    fistFrames =
      Math.max(
        0,
        fistFrames - 2
      );


    openFrames++;


    if (
      openFrames > 4
    ) {

      flowerVisible = false;


      message.classList.remove(
        "show"
      );


      hint.classList.remove(
        "hidden"
      );


      hintText.textContent =
        "把手放進畫面，然後握拳 👊";

    }


    return null;

  }


  // --------------------------------------------------
  // 有看到手
  // --------------------------------------------------

  const lms =
    result.landmarks[0];


  const top =
    result.gestures?.[0]?.[0];


  const m =
    metrics(lms);


  // --------------------------------------------------
  // MediaPipe 自己判斷 Closed_Fist
  //
  // 0.20 是故意放寬
  // --------------------------------------------------

  const mediaPipeFist =

    top?.categoryName ===
      "Closed_Fist"

    &&

    top.score > 0.20;


  // --------------------------------------------------
  // 我們自己的拳頭判斷
  // --------------------------------------------------

  const customFist =
    isTargetFist(lms);


  // --------------------------------------------------
  // 其中一種成功
  // 就算拳頭
  // --------------------------------------------------

  const isFist =

    mediaPipeFist

    ||

    customFist;


  // --------------------------------------------------
  // 是拳頭
  // --------------------------------------------------

  if (isFist) {

    fistFrames++;

    openFrames = 0;


    hintText.textContent =
      "就是這樣 ✨";


    // ------------------------------------------------
    // 連續看到兩幀拳頭就顯示
    // ------------------------------------------------

    if (
      fistFrames >= 2
    ) {

      flowerVisible = true;


      message.classList.add(
        "show"
      );


      hint.classList.add(
        "hidden"
      );

    }

  }


  // --------------------------------------------------
  // 不是拳頭
  // --------------------------------------------------

  else {

    fistFrames =
      Math.max(
        0,
        fistFrames - 1
      );


    openFrames++;


    if (
      openFrames > 5
    ) {

      flowerVisible = false;


      message.classList.remove(
        "show"
      );


      hint.classList.remove(
        "hidden"
      );


      hintText.textContent =
        "握拳看看 👊";

    }

  }


  return m;

}


// ======================================================
// Camera Loop
// ======================================================

function loop() {

  if (!running) {

    return;

  }


  ctx.clearRect(

    0,
    0,

    innerWidth,
    innerHeight

  );


  // --------------------------------------------------
  // MediaPipe 辨識
  // --------------------------------------------------

  if (

    recognizer

    &&

    video.readyState >= 2

    &&

    video.currentTime !==
      lastVideoTime

  ) {

    lastVideoTime =
      video.currentTime;


    try {

      lastResult =

        recognizer.recognizeForVideo(

          video,

          performance.now()

        );

    }

    catch (e) {

      console.error(e);

    }

  }


  // --------------------------------------------------
  // 判斷拳頭 + 畫花
  // --------------------------------------------------

  if (lastResult) {

    const m =
      updateGesture(
        lastResult
      );


    if (m) {

      drawBouquet(m);

    }

  }


  requestAnimationFrame(
    loop
  );

}


// ======================================================
// Events
// ======================================================

startBtn.addEventListener(

  "click",

  start,

  {
    passive: true
  }

);


window.addEventListener(

  "resize",

  resizeCanvas

);


window.addEventListener(

  "orientationchange",

  () =>

    setTimeout(

      resizeCanvas,

      200

    )

);
