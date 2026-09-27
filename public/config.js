// =============================================
// Configuration
// =============================================
// After deploying the Google Apps Script as a web app,
// paste the deployment URL below.
//
// Deploy steps:
// 1. Go to script.google.com, create new project
// 2. Paste the contents of backend/apps-script.js
// 3. Run setupSheets() once from the editor
// 4. Deploy > New deployment > Web app
//    - Execute as: Me
//    - Who has access: Anyone
// 5. Copy the URL and paste it below

var CONFIG = {
  APPS_SCRIPT_URL: 'https://script.google.com/macros/s/AKfycbxucFfDjM1FbnrHj3267XHvDdeP0RDISl5woOFeQpmQBiOuw0TrvrWCKLWkkaxwh75QKg/exec',
  QUESTION_TIME_MS: 10000,
  TOTAL_QUESTIONS: 12,
  NETWORK_RETRY_ATTEMPTS: 2,
  NETWORK_RETRY_DELAY_MS: 800
};
