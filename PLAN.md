# 排班系統規劃文件

## 專案概述

建立一個簡單的排班系統，使用者透過網頁表單填入人員的工作時段，排班結果直接寫入 Google Sheet，免去資料庫建置。

---

## 架構方案

```
使用者 → 網頁表單 (前端) → Google Apps Script (後端 API) → Google Sheet (資料儲存)
```

**選擇 Google Apps Script 作為後端的原因：**
- 免費、無需自建伺服器
- 原生支援 Google Sheet 讀寫
- 可部署為 Web App，提供 API 端點
- 前端可以是純靜態 HTML，部署在任何地方（GitHub Pages、本地開啟皆可）

### 前後端通訊方式：隱藏 iframe + 表單提交

為了讓使用者可以**直接雙擊 HTML 檔案開啟使用**（`file://` 協定），不依賴任何 Web Server，
採用**隱藏 iframe + form submit** 的方式與 Google Apps Script 通訊，繞過 CORS 限制。

**原理：**
1. 頁面中建立一個隱藏的 `<iframe name="hidden-iframe">`
2. 表單的 `target` 指向該 iframe：`<form target="hidden-iframe" action="Apps Script URL">`
3. 表單提交後，Apps Script 的回應會載入到隱藏 iframe 中，不會導致頁面跳轉
4. Apps Script 回傳一段包含 `postMessage` 的 HTML，透過 `window.parent.postMessage()` 將結果傳回主頁面
5. 主頁面監聽 `message` 事件，接收處理結果（成功/失敗）

**寫入資料（POST）流程：**
```
使用者填表 → form submit 到 iframe → Apps Script doPost() 寫入 Sheet
→ 回傳含 postMessage 的 HTML → 主頁面收到成功通知
```

**讀取資料（GET）流程：**
```
JavaScript 動態建立 <script> 標籤（JSONP 方式）
→ Apps Script doGet() 讀取 Sheet → 回傳 callback(data)
→ 主頁面 callback 函式接收資料並渲染
```

> **備案：Web Server 方式**
> 如果 iframe 方式遇到瀏覽器安全限制，可改用本地 Web Server + fetch 方式：
> - **Python**：`python -m http.server 8080`，然後開啟 `http://localhost:8080`
> - **Node.js**：`npx serve`
> - **VS Code**：安裝 Live Server 插件，右鍵 → Open with Live Server
>
> 使用 Web Server 後，前端改用 `fetch()` 直接呼叫 Apps Script URL 即可，
> 不需要 iframe / JSONP 的繞道方式。

---

## 前提條件

### 1. Google 帳號設定
- 需要一個 Google 帳號
- 在 Google Drive 中建立一個新的 Google Sheet

### 2. Google Sheet 設定
需要建立以下工作表（Sheet）：

#### 工作表 1：`排班表`
| 欄位 | 說明 |
|------|------|
| A: 日期 | 排班日期 (YYYY-MM-DD) |
| B: 星期 | 星期幾 |
| C: 人員姓名 | 員工姓名 |
| D: 班別 | 早班 / 中班 / 晚班 / 自訂時段 |
| E: 開始時間 | HH:MM |
| F: 結束時間 | HH:MM |
| G: 備註 | 其他說明 |
| H: 建立時間 | 資料寫入時間戳記 |

#### 工作表 2：`人員名單`
| 欄位 | 說明 |
|------|------|
| A: 姓名 | 員工姓名 |
| B: 職位 | 職位/角色 |
| C: 聯絡方式 | 電話或 Email |

### 3. Google Apps Script 設定
- 在 Google Sheet 中開啟「擴充功能 → Apps Script」
- 撰寫處理表單資料的 Script
- 部署為 Web App（存取權限設為「任何人」）
- 取得部署後的 URL 作為 API 端點

---

## 實作步驟

### 步驟 1：建立 Google Sheet
1. 建立新的 Google Sheet
2. 建立「排班表」和「人員名單」兩個工作表
3. 在第一列填入欄位標題

### 步驟 2：撰寫 Google Apps Script
建立後端 API，處理以下功能：
- `doPost(e)` — 接收表單資料，寫入排班表，回傳含 `postMessage` 的 HTML（供 iframe 回傳結果）
- `doGet(e)` — 讀取排班資料 / 人員名單，支援 JSONP 回傳（`callback` 參數）
- 資料驗證（日期格式、時間格式、必填欄位）

### 步驟 3：部署 Apps Script 為 Web App
1. 在 Apps Script 編輯器中點選「部署 → 新增部署」
2. 類型選擇「網頁應用程式」
3. 執行身分：「我自己」
4. 存取權限：「所有人」（不需登入即可使用）
5. 複製部署後的 URL

### 步驟 4：建立前端網頁
- 純 HTML + CSS + JavaScript（無需框架）
- 包含以下頁面/功能：
  1. **排班表單** — 選擇日期、人員、班別、時間，送出排班
  2. **排班總覽** — 以表格或行事曆方式檢視已排班次
  3. **人員管理** — 新增/檢視人員名單

### 步驟 5：串接前後端
- **寫入**：前端透過隱藏 iframe + form submit 送出資料，監聽 `postMessage` 接收回應
- **讀取**：前端透過動態 `<script>` 標籤（JSONP）載入資料
- 不依賴 `fetch()`，完全繞過 CORS 限制，支援 `file://` 協定直接開啟

### 步驟 6：測試與調整
- 測試表單送出是否正確寫入 Sheet
- 測試讀取排班資料是否正確顯示
- 調整 UI/UX

---

## 確認事項（測試階段預設值）

1. **班別設定**：早班 08:00-16:00、中班 16:00-24:00、晚班 00:00-08:00
2. **人員數量**：預設 5-10 人規模
3. **排班週期**：以「日」為單位，逐筆排班
4. **權限控制**：暫不設定，任何人皆可操作
5. **前端部署方式**：純本地 HTML 檔案（雙擊開啟），使用 iframe + JSONP
6. **語言**：繁體中文
7. **額外功能**：暫不實作，先完成核心功能

---

## 技術堆疊

| 項目 | 技術 |
|------|------|
| 前端 | HTML5 + CSS3 + Vanilla JavaScript |
| 後端 | Google Apps Script |
| 資料庫 | Google Sheet |
| 前後端通訊 | 隱藏 iframe + form submit（寫入）、JSONP（讀取） |
| 部署 | 純靜態 HTML 檔案，雙擊即可使用（備案：本地 Web Server） |

## 限制與注意事項

- Google Apps Script 有每日執行次數限制（免費帳號約 20,000 次/天），一般小團隊使用足夠
- Google Sheet 單一工作表上限約 1,000 萬格，排班資料量不會達到此限制
- Apps Script 單次執行時間上限 6 分鐘，正常排班操作不會超過
- 資料安全性依賴 Google 帳號權限，不適合高機密需求
