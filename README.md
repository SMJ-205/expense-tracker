# 🧾 Expense Tracker

A "mobile" web app that automatically extracts expense data from receipt photos using OCR. Snap a photo, review the parsed fields, and save to Google Sheets — all from your phone.

**Stack:** Next.js 16 · Vercel · Google Cloud Vision API · Google Sheets · Google Drive

## ✨ Features

- 📷 **Camera capture** — snap receipts directly from your phone
- 🤖 **OCR extraction** — Google Cloud Vision with Indonesian + English support
- 🏷️ **Smart categories** — auto-detects merchant type + item-content scanning
- ✏️ **Edit before save** — review and correct parsed fields before confirming
- 📊 **Expense history** — browse past expenses with spending summary
- 👨‍👩‍👧 **Multi-user** — family access with individual PINs
- 🛡️ **Quota guard** — hard cap at 1,000 OCR calls/month (zero cost overrun)
- 📱 **PWA** — installable on your phone, works like a native app

## 🏗️ Architecture

```
Phone → Upload receipt photo → Vercel API Route
         ↓
    ┌─────────────────┐
    │ 1. Check quota   │ ← QuotaGuard (tracked in Google Sheets)
    │ 2. Run OCR       │ ← Cloud Vision API
    │ 3. Parse fields  │ ← Regex engine (ID + EN)
    │ 4. Return result │ → User reviews & edits
    └─────────────────┘
         ↓ (on confirm)
    ┌─────────────────┐
    │ 5. Save image    │ → Google Drive
    │ 6. Write row     │ → Google Sheets
    └─────────────────┘
```

