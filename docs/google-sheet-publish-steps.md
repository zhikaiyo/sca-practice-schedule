# Google Sheet 發布步驟

目前使用的 Google Sheet：

- 檔名：教室練習時段
- 分頁：工作表1
- 連結：https://docs.google.com/spreadsheets/d/1NnnvMvJRZXta7bpyUHYJCEK-cVJy7Gj3GTfvcSgnJDE/edit
- 已發布 CSV：
  https://docs.google.com/spreadsheets/d/e/2PACX-1vRkdbsG06sCRQIiiBAcTM7imos4MrtgGeA-R568we0lDMGz1w9eihQPhV5CLz-8oq4XT4pTVtEFmGy4/pub?gid=0&single=true&output=csv

## 欄位順序

學生端網頁會依照以下欄位讀取資料：

```tsv
日期	開始時間	結束時間	義式組狀態	義式組名額	感官手沖組狀態	感官手沖組名額
```

日期欄可填完整日期，例如 `2026-06-19`，也可填簡短日期，例如 `6/19`。簡短日期會由網頁自動補成今年的完整日期。

狀態欄可填：

- 顯示名額
- 不顯示名額
- 不開放

## 取得可給網頁讀取的 CSV 連結

1. 打開 Google Sheet：教室練習時段。
2. 點上方選單「檔案」。
3. 點「共用」或「分享」相關選項中的「發布到網路」。
4. 在發布設定中選：
   - 分頁：工作表1
   - 格式：逗號分隔值（.csv）
5. 按「發布」。
6. 複製 Google 提供的 CSV 連結。
7. 把連結貼回 Codex，我會把它接到 `app/js/config.mjs`。

目前已完成：這份 CSV 連結已接到 `app/js/config.mjs`。

## 注意

這個 CSV 連結會讓知道連結的人讀取表格內容，所以這張 Sheet 不要放學生個資、電話、付款資訊或私人備註。
