# 🧾 Expense Tracker

A mobile-first web app that automatically extracts expense data from receipt photos using OCR. Snap a photo, review the parsed fields, and save to Google Sheets — all from your phone.

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

## 🚀 Quick Start

### Prerequisites

1. **Google Cloud Project** with these APIs enabled:
   - Cloud Vision API
   - Google Sheets API
   - Google Drive API

2. **Service Account** with a JSON key file

3. **Google Sheet** with 4 tabs:
   - `Expenses` — main data
   - `Queue` — quota-paused receipts
   - `Logs` — operational logs
   - `QuotaUsage` — OCR budget tracking

4. **Google Drive folder** for receipt images

5. Both the Sheet and Drive folder shared with the service account email

### Local Development

```bash
# Clone the repo
git clone https://github.com/SMJ-205/expense-tracker.git
cd expense-tracker

# Install dependencies
npm install

# Copy env template and fill in your values
cp .env.local.example .env.local

# Start dev server
npm run dev
```

### Deploy to Vercel

1. Push to GitHub
2. Import project in [vercel.com](https://vercel.com)
3. Add environment variables in Vercel Dashboard → Settings → Environment Variables:

```
GOOGLE_SERVICE_ACCOUNT_KEY  = (entire JSON key content)
GOOGLE_SHEET_ID             = (from spreadsheet URL)
GOOGLE_DRIVE_FOLDER_ID      = (from Drive folder URL)
OCR_MONTHLY_LIMIT           = 1000
APP_USERS                   = [{"name":"Sarif","pin":"1234"},{"name":"Family","pin":"5678"}]
CRON_SECRET                 = (random string for cron auth)
```

4. Deploy — Vercel auto-detects Next.js

## 📁 Project Structure

```
src/
├── app/
│   ├── layout.js              # Root layout + PWA meta
│   ├── page.js                # Main upload + result screen
│   ├── globals.css            # Design system
│   ├── history/page.js        # Expense history
│   └── api/
│       ├── upload/route.js    # OCR + parse
│       ├── upload/confirm/    # Save to Sheets
│       ├── expenses/          # Fetch history
│       ├── quota/             # Quota status
│       └── cron/              # Monthly reset
└── lib/
    ├── google-auth.js         # Service account auth
    ├── ocr-service.js         # Cloud Vision API
    ├── parser.js              # Receipt text → fields
    ├── quota-guard.js         # OCR usage cap
    ├── sheets-service.js      # Google Sheets CRUD
    ├── drive-service.js       # Image upload
    └── logger.js              # Structured logging
```

## 🛡️ Quota Guard

The system enforces a hard cap on Cloud Vision API usage to stay within the free tier:

- **1,000 OCR calls/month** (configurable via `OCR_MONTHLY_LIMIT`)
- Usage tracked in the `QuotaUsage` sheet tab
- When limit is reached: images are saved to Drive, receipts queued as `QUOTA_PAUSED`
- **Monthly auto-reset**: Vercel Cron runs on the 1st of each month

## 📋 Google Sheet Schema

### Expenses Tab
| Column | Description |
|--------|-------------|
| timestamp | When the expense was recorded |
| receipt_id | Unique receipt identifier |
| submitter | Who submitted (user name) |
| merchant_name | Store/restaurant name |
| transaction_date | Date on the receipt |
| total_amount | Total paid |
| tax_amount | Tax (PPN) |
| service_charge | Service charge |
| category | Auto-detected or manual |
| notes | User notes |
| confidence_score | OCR parsing confidence (0-1) |
| raw_ocr_text | Full OCR output |
| image_file_url | Google Drive link |
| status | CONFIRMED / NEEDS_REVIEW / QUOTA_PAUSED |

## 📄 License

MIT
