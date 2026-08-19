# iPhone Safari + CDN 修正版

這版修正：
- 舊版 jsDelivr `@mediapipe/tasks-vision@0.10.22/+esm` 404
- 改成目前 npm 上可用的 `@mediapipe/tasks-vision@1.0.1/+esm`
- WASM 路徑同步改為 1.0.1
- Gesture Recognizer 模型改成官方目前文件使用的 Google Storage 路徑
- 保留「先開相機，再載入 MediaPipe」的 iOS Safari 相容流程

部署後請用 HTTPS 網址在 Safari 開啟。
