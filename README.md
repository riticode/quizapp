# QuizBlitz — Live MCQ Quiz App

A lightweight, realtime MCQ quiz web app for 150+ concurrent participants.

## Architecture

| Component | Technology | Cost |
|-----------|-----------|------|
| Frontend  | Static HTML/CSS/JS | $0 |
| Hosting   | Vercel (free tier) | $0 |
| Backend   | Google Apps Script | $0 |
| Database  | Google Sheets | $0 |

**Total cost: $0**

## Setup Instructions

### Step 1: Google Sheets + Apps Script Backend

1. Go to [Google Sheets](https://sheets.google.com) and create a new spreadsheet
2. Go to **Extensions → Apps Script**
3. Delete the default code and paste the entire contents of [`backend/apps-script.js`](backend/apps-script.js)
4. In the script editor, run the `setupSheets()` function once (select it from the dropdown and click ▶ Run). Grant permissions when prompted.
5. Go to **Deploy → New deployment**
   - Click the gear icon → select **Web app**
   - Description: "Quiz Backend"
   - Execute as: **Me**
   - Who has access: **Anyone**
6. Click **Deploy** and copy the Web App URL

### Step 2: Configure Frontend

1. Open [`public/config.js`](public/config.js)
2. Replace `YOUR_APPS_SCRIPT_WEB_APP_URL_HERE` with the URL from Step 1

### Step 3: Deploy to Vercel

```bash
# Install Vercel CLI (if not installed)
npm i -g vercel

# From the project root:
vercel --prod
```

Or connect the GitHub repo to Vercel for automatic deployments.

### Step 4: Test

1. Open the deployed URL
2. Register with a test name
3. Take the quiz to verify all 12 questions work
4. Check the Google Sheet to see data being recorded

## Local Development

```bash
npx serve public -l 3000 -s
```

Open http://localhost:3000

## Files

```
quiz_app/
├── question.txt          # Authoritative quiz content (DO NOT modify)
├── package.json
├── vercel.json           # Vercel deployment config
├── backend/
│   └── apps-script.js    # Google Apps Script (paste into GAS editor)
└── public/
    ├── index.html        # Main HTML (all 4 screens)
    ├── styles.css         # Complete stylesheet
    ├── config.js          # Backend URL config
    └── app.js             # Application logic
```

## How It Works

1. **Registration**: Participant enters name/branch/contact → stored in Google Sheets
2. **Quiz Flow**: For each question:
   - Client requests question from server (answer NOT included)
   - Server sets a deadline and returns question + options
   - Client shows 10-second timer synced to server deadline
   - On answer or timeout, client submits to server
   - Server validates timing, records response, returns correct answer + PM hook
   - Client shows reveal screen
3. **Leaderboard**: After Q12, server calculates rankings (most correct → lowest total time) and returns top 3

## Concurrency Design

- **Google Apps Script** uses `LockService.getScriptLock()` for all write operations → no race conditions
- **PropertiesService** stores per-participant deadlines → server-controlled timing
- Automatic retry with exponential backoff on network failures
- Duplicate submission detection (returns cached result, doesn't double-count)
- Staggered user interactions naturally distribute load across time

## Security

- Correct answers are never sent to the client before submission
- Server validates all timing (late submissions = timeout)
- Input sanitization on both client and server
- Contact numbers stored but not exposed in leaderboard
