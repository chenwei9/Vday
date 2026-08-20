import {
  FilesetResolver,
  GestureRecognizer
} from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/+esm";


// ======================================================
// HTML
// ======================================================

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
const changeFlowerBtn = document.querySelector("#changeFlowerBtn");


// ======================================================
// MediaPipe 手勢
// ======================================================

let recognizer = null;

let running = false;
let lastVideoTime = -1;
let lastResult = null;

let fistFrames = 0;
let openFrames = 0;

let flowerVisible = false;
let flowerScale = 0;


// ======================================================
// DeepLab 貓分割
// ======================================================

let catSegmenter = null;

let catSegmenting = false;
let lastCatSegmentTime = 0;
let lastCatSeenTime = 0;

// 最後一次找到的「軀體點」
let catTorsoPoints = [];

// 軀體點平滑用
let smoothTorsoPoints = [];


// ======================================================
// 花
// ======================================================

const flowerImages = [
  "./flower1.png",
  "./flower2.png",
  "./flower3.png"
];

let currentFlower = 0;

const bouquet = new Image();

bouquet.src =
  flowerImages[currentFlower];


// ======================================================
// 鬼針草
// ======================================================

const burImage = new Image();

burImage.src =
  "./bur.png";


// 最多顯示幾個鬼針草
const MAX_BURS = 7;


// 鬼針草大小
// 數字越大越大
const BUR_SIZE = 0.07;


// ======================================================
// Error
// ======================================================

function showError(msg) {

  console.error(msg);

  if (!errorBox) {
    return;
  }

  errorBox.textContent =
    msg;

  errorBox.classList.remove(
    "hidden"
  );

}


// ======================================================
// 動態載入 JS
// ======================================================

function loadScript(src) {

  return new Promise(
    (resolve, reject) => {

      const existing =
        document.querySelector(
          `script[src="${src}"]`
        );


      if (existing) {

        if (
          existing.dataset.loaded ===
          "true"
        ) {

          resolve();

          return;

        }


        existing.addEventListener(
          "load",
          resolve,
          {
            once: true
          }
        );


        existing.addEventListener(
          "error",
          reject,
          {
            once: true
          }
        );


        return;

      }


      const script =
        document.createElement(
          "script"
        );


      script.src =
        src;


      script.async =
        true;


      script.onload =
        () => {

          script.dataset.loaded =
            "true";

          resolve();

        };


      script.onerror =
        () => {

          reject(
            new Error(
              "載入失敗：" +
              src
            )
          );

        };


      document.head.appendChild(
        script
      );

    }
  );

}


// ======================================================
// 相機
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
      "這個瀏覽器沒有提供相機功能。"
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


  video.srcObject =
    stream;


  await video.play();


  if (!video.videoWidth) {

    await new Promise(
      (resolve, reject) => {

        const timer =
          setTimeout(
            () => {

              reject(
                new Error(
                  "Safari 沒有開始輸出相機。"
                )
              );

            },
            5000
          );


        video.onloadedmetadata =
          () => {

            clearTimeout(
              timer
            );

            resolve();

          };

      }
    );

  }


  return stream;

}


// ======================================================
// MediaPipe 手勢模型
// ======================================================

async function initRecognizer() {

  hintText.textContent =
    "正在載入手勢辨識…";


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

          delegate:
            "CPU"

        },


        runningMode:
          "VIDEO",


        numHands:
          1,


        minHandDetectionConfidence:
          0.45,


        minHandPresenceConfidence:
          0.45,


        minTrackingConfidence:
          0.45

      }

    );


  console.log(
    "✅ 手勢辨識完成"
  );


  hintText.textContent =
    "把手放進畫面，然後握拳 👊";

}


// ======================================================
// DeepLab 初始化
// ======================================================

async function initCatSegmenter() {

  try {

    console.log(
      "開始載入 TensorFlow.js..."
    );


    await loadScript(
      "https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.22.0/dist/tf.min.js"
    );


    console.log(
      "✅ TensorFlow.js ready"
    );


    await loadScript(
      "https://cdn.jsdelivr.net/npm/@tensorflow-models/deeplab@0.2.2/dist/deeplab.min.js"
    );


    console.log(
      "✅ DeepLab JS ready"
    );


    if (
      typeof window.deeplab ===
      "undefined"
    ) {

      throw new Error(
        "deeplab 未載入"
      );

    }


    console.log(
      "開始載入 DeepLab Pascal..."
    );


    catSegmenter =
      await window.deeplab.load({

        // Pascal 有 cat 類別
        base:
          "pascal",

        // 1 最省流量、手機比較輕
        quantizationBytes:
          1

      });


    console.log(
      "✅ DeepLab 貓分割模型完成"
    );

  }

  catch (e) {

    console.error(
      "❌ DeepLab 載入失敗",
      e
    );


    showError(
      "貓辨識載入失敗：" +
      (e?.message || e)
    );

  }

}


// ======================================================
// Start
// ======================================================

async function start() {

  startBtn.disabled =
    true;


  if (errorBox) {

    errorBox.classList.add(
      "hidden"
    );

  }


  try {

    await openCameraFirst();


    intro.classList.add(
      "hide"
    );


    hint.classList.remove(
      "hidden"
    );


    if (changeFlowerBtn) {

      changeFlowerBtn.classList.remove(
        "hidden"
      );

    }


    resizeCanvas();


    // 手勢先載
    try {

      await initRecognizer();

    }

    catch (e) {

      console.error(
        "手勢模型失敗",
        e
      );

    }


    // 貓模型背景載入
    // 不阻塞相機畫面
    initCatSegmenter();


    running =
      true;


    requestAnimationFrame(
      loop
    );

  }

  catch (e) {

    startBtn.disabled =
      false;


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

      e?.name ===
      "NotAllowedError"

        ? "Safari 沒有相機權限。"

        : e?.name ===
          "NotFoundError"

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
      innerWidth *
      dpr
    );


  canvas.height =
    Math.round(
      innerHeight *
      dpr
    );


  canvas.style.width =
    innerWidth +
    "px";


  canvas.style.height =
    innerHeight +
    "px";


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
// 手座標
// ======================================================

function lmToScreen(lm) {

  return {

    x:
      (1 - lm.x) *
      innerWidth,

    y:
      lm.y *
      innerHeight

  };

}


// ======================================================
// 拳頭位置
// ======================================================

function metrics(lms) {

  const wrist =
    lmToScreen(
      lms[0]
    );


  const mid =
    lmToScreen(
      lms[9]
    );


  const index =
    lmToScreen(
      lms[5]
    );


  const pinky =
    lmToScreen(
      lms[17]
    );


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

      )

  };

}


// ======================================================
// Landmark 距離
// ======================================================

function dist(a, b) {

  return Math.hypot(

    a.x -
    b.x,

    a.y -
    b.y,

    (a.z || 0) -
    (b.z || 0)

  );

}


// ======================================================
// 寬鬆拳頭
// ======================================================

function isTargetFist(lms) {

  if (
    !lms ||
    lms.length < 21
  ) {

    return false;

  }


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


  const tips = [
    8,
    12,
    16,
    20
  ];


  let closed =
    0;


  for (
    const tipIndex
    of tips
  ) {

    if (
      dist(
        lms[tipIndex],
        palm
      ) <
      palmWidth *
      1.60
    ) {

      closed++;

    }

  }


  const thumb =
    lms[4];


  const thumbClosed =

    dist(
      thumb,
      lms[5]
    ) <
    palmWidth *
    1.65

    ||

    dist(
      thumb,
      lms[9]
    ) <
    palmWidth *
    1.65

    ||

    dist(
      thumb,
      palm
    ) <
    palmWidth *
    1.65;


  return (
    closed >= 3 &&
    thumbClosed
  );

}


// ======================================================
// 換花
// ======================================================

function changeFlower() {

  currentFlower =
    (
      currentFlower +
      1
    )
    %
    flowerImages.length;


  bouquet.src =
    flowerImages[
      currentFlower
    ];

}


if (changeFlowerBtn) {

  changeFlowerBtn.addEventListener(
    "click",
    changeFlower
  );

}


// ======================================================
// 畫花
// ======================================================

function drawBouquet(m) {

  flowerScale +=

    (
      (
        flowerVisible
          ? 1
          : 0
      )
      -
      flowerScale
    )

    *
    0.18;


  if (
    flowerScale <
    0.02
  ) {

    return;

  }


  if (
    !bouquet.complete ||
    !bouquet.naturalWidth
  ) {

    return;

  }


  const h =
    Math.max(

      190,

      Math.min(

        390,

        m.width *
        5.8

      )

    );


  const ratio =
    bouquet.naturalWidth /
    bouquet.naturalHeight;


  const w =
    h *
    ratio;


  ctx.save();


  ctx.translate(

    m.x -
    40,

    m.y +
    m.width *
    0.15 +
    50

  );


  ctx.scale(
    flowerScale,
    flowerScale
  );


  ctx.drawImage(

    bouquet,

    -w / 2,

    -h *
    0.91,

    w,

    h

  );


  ctx.restore();

}


// ======================================================
// 更新拳頭
// ======================================================

function updateGesture(result) {

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
      openFrames >
      4
    ) {

      flowerVisible =
        false;


      message?.classList.remove(
        "show"
      );


      hint?.classList.remove(
        "hidden"
      );


      hintText.textContent =
        "把手放進畫面，然後握拳 👊";

    }


    return null;

  }


  const lms =
    result.landmarks[0];


  const top =
    result.gestures?.[0]?.[0];


  const m =
    metrics(
      lms
    );


  const mpFist =

    top?.categoryName ===
    "Closed_Fist"

    &&

    top.score >
    0.20;


  const custom =
    isTargetFist(
      lms
    );


  const isFist =
    mpFist ||
    custom;


  if (isFist) {

    fistFrames++;

    openFrames =
      0;


    if (
      fistFrames >=
      2
    ) {

      flowerVisible =
        true;


      message?.classList.add(
        "show"
      );


      hint?.classList.add(
        "hidden"
      );

    }

  }

  else {

    fistFrames =
      Math.max(
        0,
        fistFrames - 1
      );


    openFrames++;


    if (
      openFrames >
      5
    ) {

      flowerVisible =
        false;


      message?.classList.remove(
        "show"
      );


      hint?.classList.remove(
        "hidden"
      );


      hintText.textContent =
        "握拳看看 👊";

    }

  }


  return m;

}


// ======================================================
// DeepLab segmentation pixel
// → 螢幕座標
// ======================================================

function segmentationToScreen(
  px,
  py,
  segWidth,
  segHeight
) {

  const videoRect =
    video.getBoundingClientRect();


  const canvasRect =
    canvas.getBoundingClientRect();


  const sourceWidth =
    video.videoWidth;


  const sourceHeight =
    video.videoHeight;


  if (
    !sourceWidth ||
    !sourceHeight
  ) {

    return null;

  }


  // segmentation map 跟輸入 video
  // 是相同比例
  const sourceX =
    px /
    segWidth *
    sourceWidth;


  const sourceY =
    py /
    segHeight *
    sourceHeight;


  const displayWidth =
    videoRect.width;


  const displayHeight =
    videoRect.height;


  // object-fit: cover
  const scale =
    Math.max(

      displayWidth /
      sourceWidth,

      displayHeight /
      sourceHeight

    );


  const contentWidth =
    sourceWidth *
    scale;


  const contentHeight =
    sourceHeight *
    scale;


  const offsetX =
    (
      displayWidth -
      contentWidth
    ) /
    2;


  const offsetY =
    (
      displayHeight -
      contentHeight
    ) /
    2;


  let x =
    offsetX +
    sourceX *
    scale;


  let y =
    offsetY +
    sourceY *
    scale;


  // 前鏡頭 CSS 是鏡像
  x =
    displayWidth -
    x;


  x +=
    videoRect.left -
    canvasRect.left;


  y +=
    videoRect.top -
    canvasRect.top;


  return {
    x,
    y
  };

}


// ======================================================
// 判斷 segmentation pixel 是否為 cat
// ======================================================

function isCatPixel(
  map,
  index,
  catColor
) {

  const r =
    map[index];


  const g =
    map[index + 1];


  const b =
    map[index + 2];


  return (

    r === catColor[0]

    &&

    g === catColor[1]

    &&

    b === catColor[2]

  );

}


// ======================================================
// 判斷該點是不是「厚的貓軀體」
//
// 核心：
//
// 腿、尾巴、耳朵比較細
// 往上下左右幾格就會離開 cat mask
//
// 軀體 / 背部比較厚
// 周圍仍然是 cat
// ======================================================

function isDeepInsideCat(
  map,
  x,
  y,
  width,
  height,
  catColor,
  radius
) {

  if (

    x - radius < 0

    ||

    y - radius < 0

    ||

    x + radius >=
    width

    ||

    y + radius >=
    height

  ) {

    return false;

  }


  const checks = [

    [0, 0],

    [radius, 0],

    [-radius, 0],

    [0, radius],

    [0, -radius],

    [radius, radius],

    [-radius, radius],

    [radius, -radius],

    [-radius, -radius]

  ];


  for (
    const [dx, dy]
    of checks
  ) {

    const px =
      x + dx;


    const py =
      y + dy;


    const index =
      (
        py *
        width +
        px
      )
      *
      4;


    if (
      !isCatPixel(
        map,
        index,
        catColor
      )
    ) {

      return false;

    }

  }


  return true;

}


// ======================================================
// 從 cat mask 找軀體點
// ======================================================

function findCatTorsoPoints(
  result
) {

  const {
    segmentationMap,
    width,
    height,
    legend
  } = result;


  const catColor =
    legend?.cat;


  if (!catColor) {

    console.log(
      "目前 DeepLab 沒有找到 cat"
    );

    return [];

  }


  // ==========================================
  // 先找整個貓 mask 的範圍
  // ==========================================

  let minX =
    width;


  let minY =
    height;


  let maxX =
    0;


  let maxY =
    0;


  let catPixels =
    0;


  // 不需要每 pixel 都查
  // 每 2px 查一次比較省
  for (
    let y = 0;
    y < height;
    y += 2
  ) {

    for (
      let x = 0;
      x < width;
      x += 2
    ) {

      const index =
        (
          y *
          width +
          x
        )
        *
        4;


      if (
        isCatPixel(
          segmentationMap,
          index,
          catColor
        )
      ) {

        catPixels++;


        minX =
          Math.min(
            minX,
            x
          );


        maxX =
          Math.max(
            maxX,
            x
          );


        minY =
          Math.min(
            minY,
            y
          );


        maxY =
          Math.max(
            maxY,
            y
          );

      }

    }

  }


  if (
    catPixels <
    20
  ) {

    return [];

  }


  const catWidth =
    maxX -
    minX;


  const catHeight =
    maxY -
    minY;


  // ==========================================
  // 深度半徑
  //
  // 貓越大，就要求點離邊界越遠
  // ==========================================

  const radius =
    Math.max(

      3,

      Math.round(

        Math.min(
          catWidth,
          catHeight
        )

        *

        0.045

      )

    );


  const candidates =
    [];


  // ==========================================
  // 找厚實區域
  // ==========================================

  const step =
    Math.max(

      5,

      Math.round(
        Math.min(
          catWidth,
          catHeight
        )
        *
        0.045
      )

    );


  for (
    let y =
      minY + radius;

    y <=
    maxY - radius;

    y +=
    step
  ) {

    for (
      let x =
        minX + radius;

      x <=
      maxX - radius;

      x +=
      step
    ) {

      if (
        !isDeepInsideCat(

          segmentationMap,

          x,

          y,

          width,

          height,

          catColor,

          radius

        )
      ) {

        continue;

      }


      // ----------------------------------------
      // 再多做一層：
      // 最下面區域通常是腿
      // 所以不要太靠 cat mask 底部
      // ----------------------------------------

      const normalizedY =
        (
          y -
          minY
        )
        /
        Math.max(
          1,
          catHeight
        );


      if (
        normalizedY >
        0.78
      ) {

        continue;

      }


      const screen =
        segmentationToScreen(

          x,

          y,

          width,

          height

        );


      if (screen) {

        candidates.push(
          screen
        );

      }

    }

  }


  if (
    candidates.length ===
    0
  ) {

    return [];

  }


  // ==========================================
  // 不要全部畫
  // 平均抽 MAX_BURS 個
  // ==========================================

  const selected =
    [];


  const count =
    Math.min(
      MAX_BURS,
      candidates.length
    );


  const spacing =
    candidates.length /
    count;


  for (
    let i = 0;
    i < count;
    i++
  ) {

    const index =
      Math.min(

        candidates.length -
        1,

        Math.floor(
          i *
          spacing
        )

      );


    selected.push(
      candidates[index]
    );

  }


  // 算貓的大概尺寸
  const p1 =
    segmentationToScreen(

      minX,

      minY,

      width,

      height

    );


  const p2 =
    segmentationToScreen(

      maxX,

      maxY,

      width,

      height

    );


  let catSize =
    150;


  if (
    p1 &&
    p2
  ) {

    catSize =
      Math.min(

        Math.abs(
          p2.x -
          p1.x
        ),

        Math.abs(
          p2.y -
          p1.y
        )

      );

  }


  return selected.map(
    (point, index) => ({

      x:
        point.x,

      y:
        point.y,

      size:
        Math.max(
          22,
          catSize *
          BUR_SIZE
        ),

      rotate:
        (
          index *
          47
        )
        %
        70
        -
        35

    })
  );

}


// ======================================================
// 平滑軀體點
// ======================================================

function smoothTorso(
  newPoints
) {

  if (
    !newPoints.length
  ) {

    return;

  }


  // 數量變了就直接更新
  if (
    smoothTorsoPoints.length !==
    newPoints.length
  ) {

    smoothTorsoPoints =
      newPoints.map(
        p => ({
          ...p
        })
      );


    return;

  }


  const smoothing =
    0.75;


  for (
    let i = 0;
    i <
    newPoints.length;
    i++
  ) {

    smoothTorsoPoints[i].x +=
      (
        newPoints[i].x -
        smoothTorsoPoints[i].x
      )
      *
      smoothing;


    smoothTorsoPoints[i].y +=
      (
        newPoints[i].y -
        smoothTorsoPoints[i].y
      )
      *
      smoothing;


    smoothTorsoPoints[i].size +=
      (
        newPoints[i].size -
        smoothTorsoPoints[i].size
      )
      *
      smoothing;

  }

}


// ======================================================
// DeepLab 偵測貓
// ======================================================

async function segmentCat(
  now
) {

  if (
    !catSegmenter
  ) {

    return;

  }


  if (
    catSegmenting
  ) {

    return;

  }


  if (
    video.readyState <
    2
  ) {

    return;

  }


  // ==========================================
  // DeepLab 比 bbox 模型重
  //
  // 約 800ms 做一次
  // iPhone 比較穩
  // ==========================================

  if (
    now -
    lastCatSegmentTime <
    300
  ) {

    return;

  }


  lastCatSegmentTime =
    now;


  catSegmenting =
    true;


  try {

    const result =
      await catSegmenter.segment(
        video
      );


    if (
      !result.legend?.cat
    ) {

      console.log(
        "目前沒有辨識到貓"
      );


      return;

    }


    console.log(
      "🐱 DeepLab 找到 cat",
      result.legend.cat
    );


    const points =
      findCatTorsoPoints(
        result
      );


    if (
      points.length
    ) {

      catTorsoPoints =
        points;


      smoothTorso(
        points
      );


      lastCatSeenTime =
        performance.now();


      console.log(
        "🐱 軀體點：",
        points
      );

    }

  }

  catch (e) {

    console.error(
      "DeepLab segmentation error:",
      e
    );

  }

  finally {

    catSegmenting =
      false;

  }

}


// ======================================================
// 畫鬼針草
// ======================================================

function drawBursOnTorso() {

  if (
    !burImage.complete ||
    !burImage.naturalWidth
  ) {

    return;

  }


  const ratio =
    burImage.naturalWidth /
    burImage.naturalHeight;


  for (
    const point
    of smoothTorsoPoints
  ) {

    const h =
      point.size;


    const w =
      h *
      ratio;


    ctx.save();


    ctx.translate(

      point.x,

      point.y

    );


    ctx.rotate(

      point.rotate *

      Math.PI /

      180

    );


    ctx.drawImage(

      burImage,

      -w / 2,

      -h / 2,

      w,

      h

    );


    ctx.restore();

  }

}


// ======================================================
// Debug 軀體點
//
// 想確認位置時可開
// ======================================================

const DEBUG_CAT_TORSO =
  false;


function drawTorsoDebug() {

  if (
    !DEBUG_CAT_TORSO
  ) {

    return;

  }


  ctx.save();


  ctx.fillStyle =
    "#00ff00";


  for (
    const point
    of smoothTorsoPoints
  ) {

    ctx.beginPath();


    ctx.arc(

      point.x,

      point.y,

      8,

      0,

      Math.PI *
      2

    );


    ctx.fill();

  }


  ctx.restore();

}


// ======================================================
// Loop
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


  const now =
    performance.now();


  // ====================================================
  // 拳頭
  // ====================================================

  if (

    recognizer

    &&

    video.readyState >=
    2

    &&

    video.currentTime !==
    lastVideoTime

  ) {

    lastVideoTime =
      video.currentTime;


    try {

      lastResult =
        recognizer
          .recognizeForVideo(

            video,

            now

          );

    }

    catch (e) {

      console.error(
        e
      );

    }

  }


  // ====================================================
  // 花
  // ====================================================

  if (
    lastResult
  ) {

    const m =
      updateGesture(
        lastResult
      );


    if (m) {

      drawBouquet(
        m
      );

    }

  }


  // ====================================================
  // DeepLab 找貓
  // ====================================================

  segmentCat(
    now
  );


  // ====================================================
  // 貓軀體上的鬼針草
  // ====================================================

  if (

    smoothTorsoPoints.length

    &&

    now -
    lastCatSeenTime <

    1800

  ) {

    drawTorsoDebug();


    drawBursOnTorso();

  }


  // 超過一段時間沒看到貓就清掉
  else if (

    now -
    lastCatSeenTime >=

    1800

  ) {

    catTorsoPoints =
      [];


    smoothTorsoPoints =
      [];

  }


  requestAnimationFrame(
    loop
  );

}


// ======================================================
// Event
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
