# Valentine Flower Camera 💐

手機瀏覽器版情人節小驚喜。

## 效果
1. 對方打開網址
2. 點「打開鏡頭」
3. 使用前鏡頭
4. 把手放進畫面
5. 握拳 ✊
6. 花束會出現在拳頭上，並顯示情人節文字

## 最快部署方式：GitHub Pages

1. 建立一個新的 GitHub repository，例如 `valentine-flower`
2. 把這四個檔案上傳到 repository 根目錄：
   - `index.html`
   - `style.css`
   - `app.js`
   - `README.md`
3. GitHub repository → Settings → Pages
4. Build and deployment 選 `Deploy from a branch`
5. Branch 選 `main`，資料夾選 `/ (root)`
6. 儲存後使用 GitHub Pages 給你的 HTTPS 網址
7. 把網址傳給對方

## 注意
手機相機的 `getUserMedia()` 需要 HTTPS。直接把 HTML 檔傳到手機打開，通常無法取得相機權限，所以要透過 GitHub Pages / Vercel / Netlify 之類的 HTTPS 網站開啟。

## 修改文字
在 `index.html` 搜尋：
- `有個小東西想送你`
- `Happy Valentine's Day`
- `這束花送給你 ❤️`

直接換成你想寫的內容即可。

## 修改花束
目前花束直接內嵌在 `app.js` 裡的 SVG，不需要額外圖片檔。
如果之後要換成真實花束 PNG，可以把 `bouquet.src` 改成你自己的透明背景圖片路徑。
