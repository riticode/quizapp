// =============================================
// Google Apps Script — Quiz Backend (with Admin & Internship)
// =============================================
// Deploy as Web App: Execute as "Me", Access "Anyone"
//
// Sheet setup:
// "Participants" | "Responses" | "Internships"

// ========== ADMIN CREDENTIALS ==========
var ADMIN_EMAIL = 'codework.riti@gmail.com';
var ADMIN_PASSWORD = '7417914565';

// ========== QUIZ DATA ==========
var QUIZ_DATA = [
  { q: 1, text: "A YouTube show where contestants rate themselves and the judges guess the score. It was pulled after a huge controversy in 2025. Name it.", options: ["Comicstaan", "India's Got Latent", "MTV Roadies", "Shark Tank India"], answer: "B", hook: "A fresh format made it go viral, and one bad moment took the whole show down. Trust and risk are product decisions too." },
  { q: 2, text: "TikTok got banned in India in 2020. Which Instagram feature launched in India almost immediately after?", options: ["Stories", "Threads", "Reels", "Broadcast Channels"], answer: "C", hook: "When a competitor disappears, the gap is the opportunity. The fastest team to fill it wins the users." },
  { q: 3, text: "PUBG Mobile was banned in India. What did it come back as?", options: ["Free Fire Max", "Call of Duty Mobile", "Clash Royale", "BGMI"], answer: "D", hook: "Same core product, a new local identity. Sometimes the fix is positioning, not features." },
  { q: 4, text: "Millions of people got stuck in an online queue trying to buy Coldplay's India tickets. Which platform?", options: ["BookMyShow", "Paytm Insider", "District by Zomato", "Ticketmaster"], answer: "A", hook: "Your product is only as good as its worst peak day. Plan for the rush, not the average." },
  { q: 5, text: 'Which show made "Yeh sab doglapan hai" a national meme?', options: ["Bigg Boss", "Shark Tank India", "The Kapil Sharma Show", "MTV Splitsvilla"], answer: "B", hook: "The show turned business pitches into entertainment. Packaging decides whether people care about the product inside." },
  { q: 6, text: 'In an ad, Rahul Dravid loses it in traffic and yells "Indiranagar ka gunda hoon main!" Which brand?', options: ["Dream11", "PhonePe", "CRED", "Paytm"], answer: "C", hook: "The product is paying credit card bills, which is boring. The story made it unforgettable." },
  { q: 7, text: 'Which food delivery company renamed its parent company "Eternal"?', options: ["Swiggy", "Zepto", "Dunzo", "Zomato"], answer: "D", hook: "It stopped being one app and became a group of businesses: Zomato, Blinkit, District, Hyperpure. The name followed the strategy." },
  { q: 8, text: "Which 10-minute delivery app used to be called Grofers?", options: ["Blinkit", "Zepto", "Swiggy Instamart", "BigBasket"], answer: "A", hook: "The promise changed from groceries to groceries in 10 minutes, so the name changed too." },
  { q: 9, text: "In 2016, which telecom gave India free 4G data and changed how the whole country uses the internet?", options: ["Airtel", "Jio", "Vodafone", "BSNL"], answer: "B", hook: "Pricing is a product decision. Free got millions of people in, and habits kept them." },
  { q: 10, text: "Which app's green owl guilt-trips you into saving your streak?", options: ["Duolingo", "Snapchat", "Headspace", "Candy Crush"], answer: "A", hook: "Streaks are a retention feature disguised as fun. That owl is a product manager's best employee." },
  { q: 11, text: "A little cartoon girl has commented on every trending news story in India for decades. Which brand?", options: ["Parle-G", "Mother Dairy", "Britannia", "Amul"], answer: "D", hook: "An old brand that stays relevant by reacting to the news in real time. It shows marketing and timing matter as much as the product." },
  { q: 12, text: "The yearly sale that finally gets your parents to say yes to that new phone. (Bonus: the newspaper in Riti's photo on slide 3 is advertising it.)", options: ["Amazon Great Indian Festival", "Myntra End of Reason Sale", "Flipkart Big Billion Days", "Meesho Mega Blockbuster Sale"], answer: "C", hook: "One sale turned into a national event that people plan for. Scarcity and timing are product levers." }
];

var ANSWER_MAP = { A: 0, B: 1, C: 2, D: 3 };

// ========== HELPERS ==========

function getSheet(name) {
  return SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name);
}

function generateId() {
  return Utilities.getUuid().replace(/-/g, '').substring(0, 16);
}

function jsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
}

function sanitize(str) {
  if (typeof str !== 'string') return '';
  return str.replace(/[<>"'&\\]/g, '').trim().substring(0, 200);
}

function validateContact(contact) {
  if (typeof contact !== 'string') return false;
  var cleaned = contact.replace(/[\s\-\+\(\)]/g, '');
  return /^\d{10,15}$/.test(cleaned);
}

function verifyAdmin(body) {
  return body.adminEmail === ADMIN_EMAIL && body.adminPassword === ADMIN_PASSWORD;
}

function getQuizState() {
  var props = PropertiesService.getScriptProperties();
  var state = props.getProperty('QUIZ_STATE');
  return state || 'WAITING';
}

// ========== MAIN ROUTER ==========

function doPost(e) {
  try {
    var body = JSON.parse(e.postData.contents);
    var action = body.action;

    switch (action) {
      case 'register': return handleRegister(body);
      case 'getQuestion': return handleGetQuestion(body);
      case 'submitAnswer': return handleSubmitAnswer(body);
      case 'getLeaderboard': return handleGetLeaderboard(body);
      case 'getParticipantStatus': return handleGetParticipantStatus(body);
      case 'adminLogin': return handleAdminLogin(body);
      case 'getAdminDashboard': return handleGetAdminDashboard(body);
      case 'startQuiz': return handleStartQuiz(body);
      case 'submitInternship': return handleSubmitInternship(body);
      default: return jsonResponse({ error: 'Unknown action' });
    }
  } catch (err) {
    return jsonResponse({ error: err.message });
  }
}

function doGet(e) {
  return jsonResponse({ status: 'ok', time: new Date().toISOString() });
}

// ========== REGISTRATION ==========

function handleRegister(body) {
  var name = sanitize(body.name);
  var branch = sanitize(body.branch);
  var contact = (body.contact || '').toString().trim();

  if (!name || name.length < 2) return jsonResponse({ error: 'Please enter a valid name (at least 2 characters).' });
  if (!branch) return jsonResponse({ error: 'Please select or enter your branch.' });
  if (!validateContact(contact)) return jsonResponse({ error: 'Please enter a valid contact number (10-15 digits).' });

  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var sheet = getSheet('Participants');
    var participantId = generateId();
    sheet.appendRow([participantId, name, branch, contact, new Date().toISOString()]);
    lock.releaseLock();
    return jsonResponse({ success: true, participantId: participantId, totalQuestions: QUIZ_DATA.length, quizState: getQuizState() });
  } catch (err) {
    lock.releaseLock();
    return jsonResponse({ error: 'Registration failed. Please try again.' });
  }
}

// ========== GET QUESTION ==========

function handleGetQuestion(body) {
  var participantId = sanitize(body.participantId);
  var questionNumber = parseInt(body.questionNumber, 10);
  if (getQuizState() !== 'STARTED') return jsonResponse({ error: 'Quiz has not started yet.' });

  var qData = QUIZ_DATA[questionNumber - 1];
  var serverTime = new Date().getTime();
  var deadline = serverTime + 10500;

  var props = PropertiesService.getScriptProperties();
  props.setProperty('deadline_' + participantId + '_' + questionNumber, deadline.toString());

  return jsonResponse({ success: true, questionNumber: questionNumber, totalQuestions: QUIZ_DATA.length, text: qData.text, options: qData.options, deadline: deadline, serverTime: serverTime });
}

// ========== SUBMIT ANSWER ==========

function handleSubmitAnswer(body) {
  var participantId = sanitize(body.participantId);
  var questionNumber = parseInt(body.questionNumber, 10);
  var selectedOption = parseInt(body.selectedOption, 10);

  var lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    var responseSheet = getSheet('Responses');
    var responseData = responseSheet.getDataRange().getValues();
    for (var i = 1; i < responseData.length; i++) {
      if (responseData[i][0] === participantId && responseData[i][1] === questionNumber) {
        var qData = QUIZ_DATA[questionNumber - 1];
        lock.releaseLock();
        return jsonResponse({ success: true, duplicate: true, correctOption: ANSWER_MAP[qData.answer], isCorrect: responseData[i][3] === true || responseData[i][3] === 'TRUE', hook: qData.hook, questionNumber: questionNumber });
      }
    }

    var props = PropertiesService.getScriptProperties();
    var key = 'deadline_' + participantId + '_' + questionNumber;
    var deadlineStr = props.getProperty(key);
    var now = new Date().getTime();
    var timeTaken = 10000;
    var timedOut = false;

    if (deadlineStr) {
      var deadline = parseInt(deadlineStr, 10);
      timeTaken = Math.min(now - (deadline - 10500), 10000);
      if (now > deadline) { timedOut = true; selectedOption = -1; timeTaken = 10000; }
    }
    if (timeTaken < 0) timeTaken = 0;

    var qData = QUIZ_DATA[questionNumber - 1];
    var correctIdx = ANSWER_MAP[qData.answer];
    var isCorrect = !timedOut && selectedOption === correctIdx;

    responseSheet.appendRow([participantId, questionNumber, selectedOption, isCorrect, Math.round(timeTaken), new Date().toISOString()]);
    props.deleteProperty(key);
    lock.releaseLock();
    return jsonResponse({ success: true, duplicate: false, correctOption: correctIdx, isCorrect: isCorrect, timeTaken: Math.round(timeTaken), hook: qData.hook, questionNumber: questionNumber });
  } catch (err) {
    lock.releaseLock();
    return jsonResponse({ error: 'Submission failed: ' + err.message });
  }
}

// ========== GET LEADERBOARD ==========

function handleGetLeaderboard(body) {
  var participantId = sanitize(body.participantId);
  var lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    var pSheet = getSheet('Participants');
    var rSheet = getSheet('Responses');
    var participants = pSheet.getDataRange().getValues();
    var responses = rSheet.getDataRange().getValues();
    var pMap = {};

    for (var i = 1; i < participants.length; i++) {
      pMap[participants[i][0]] = { id: participants[i][0], name: participants[i][1], totalCorrect: 0, totalTime: 0, questionsAnswered: 0 };
    }

    for (var j = 1; j < responses.length; j++) {
      var rid = responses[j][0];
      if (!pMap[rid]) continue;
      pMap[rid].questionsAnswered++;
      if (responses[j][3] === true || responses[j][3] === 'TRUE') pMap[rid].totalCorrect++;
      pMap[rid].totalTime += parseInt(responses[j][4], 10) || 10000;
    }

    var completed = [];
    var totalQ = QUIZ_DATA.length;
    for (var pid in pMap) {
      if (totalQ - pMap[pid].questionsAnswered > 0) pMap[pid].totalTime += (totalQ - pMap[pid].questionsAnswered) * 10000;
      if (pMap[pid].questionsAnswered >= totalQ) completed.push(pMap[pid]);
    }

    completed.sort(function (a, b) {
      if (b.totalCorrect !== a.totalCorrect) return b.totalCorrect - a.totalCorrect;
      return a.totalTime - b.totalTime;
    });

    var top3 = completed.slice(0, 3).map(function (p, idx) {
      return { rank: idx + 1, name: p.name, correct: p.totalCorrect, total: totalQ, totalTime: (p.totalTime / 1000).toFixed(1) };
    });

    var myResult = null;
    if (participantId && pMap[participantId]) {
      var myRank = completed.findIndex(c => c.id === participantId) + 1;
      myResult = { rank: myRank, name: pMap[participantId].name, correct: pMap[participantId].totalCorrect, total: totalQ, totalTime: (pMap[participantId].totalTime / 1000).toFixed(1) };
    }
    lock.releaseLock();
    return jsonResponse({ success: true, leaderboard: top3, myResult: myResult });
  } catch (err) {
    lock.releaseLock();
    return jsonResponse({ error: 'Leaderboard failed: ' + err.message });
  }
}

// ========== PARTICIPANT STATUS ==========

function handleGetParticipantStatus(body) {
  var participantId = sanitize(body.participantId);
  var pSheet = getSheet('Participants');
  var pData = pSheet.getDataRange().getValues();
  var found = false, name = '';
  for (var i = 1; i < pData.length; i++) {
    if (pData[i][0] === participantId) { found = true; name = pData[i][1]; break; }
  }
  if (!found) return jsonResponse({ success: true, valid: false });

  var rSheet = getSheet('Responses');
  var rData = rSheet.getDataRange().getValues();
  var maxAnswered = 0;
  for (var j = 1; j < rData.length; j++) {
    if (rData[j][0] === participantId) maxAnswered = Math.max(maxAnswered, parseInt(rData[j][1], 10));
  }
  
  var isComplete = maxAnswered >= QUIZ_DATA.length;
  return jsonResponse({ success: true, valid: true, name: name, questionsAnswered: maxAnswered, isComplete: isComplete, nextQuestion: isComplete ? -1 : maxAnswered + 1, quizState: getQuizState() });
}

// ========== ADMIN METHODS ==========

function handleAdminLogin(body) {
  if (!verifyAdmin(body)) return jsonResponse({ error: 'Invalid email or password.' });
  return jsonResponse({ success: true });
}

function handleStartQuiz(body) {
  if (!verifyAdmin(body)) return jsonResponse({ error: 'Unauthorized' });
  var props = PropertiesService.getScriptProperties();
  props.setProperty('QUIZ_STATE', 'STARTED');
  return jsonResponse({ success: true });
}

function handleGetAdminDashboard(body) {
  if (!verifyAdmin(body)) return jsonResponse({ error: 'Unauthorized' });

  var pSheet = getSheet('Participants');
  var rSheet = getSheet('Responses');
  var pData = pSheet.getDataRange().getValues();
  var rData = rSheet.getDataRange().getValues();

  var pMap = {};
  for (var i = 1; i < pData.length; i++) pMap[pData[i][0]] = { name: pData[i][1], branch: pData[i][2], correct: 0, totalTime: 0, questionsAnswered: 0 };

  var questionStats = {}, recentResponses = [];
  for (var j = 1; j < rData.length; j++) {
    var pid = rData[j][0], qNum = parseInt(rData[j][1], 10), isCorrect = rData[j][3] === true || rData[j][3] === 'TRUE', timeTaken = parseInt(rData[j][4], 10) || 10000;
    if (pMap[pid]) { pMap[pid].questionsAnswered++; if (isCorrect) pMap[pid].correct++; pMap[pid].totalTime += timeTaken; }
    if (!questionStats[qNum]) questionStats[qNum] = { answered: 0, correct: 0, totalTime: 0 };
    questionStats[qNum].answered++; if (isCorrect) questionStats[qNum].correct++; questionStats[qNum].totalTime += timeTaken;
    recentResponses.push({ name: pMap[pid] ? pMap[pid].name : 'Unknown', q: qNum, isCorrect: isCorrect, timeTaken: (timeTaken / 1000).toFixed(1), at: rData[j][5] });
  }

  var leaderboard = [];
  var totalCompleted = 0, totalInProgress = 0;
  for (var pid in pMap) {
    if (pMap[pid].questionsAnswered >= QUIZ_DATA.length) totalCompleted++; else if (pMap[pid].questionsAnswered > 0) totalInProgress++;
    var adjustedTime = pMap[pid].totalTime + ((QUIZ_DATA.length - pMap[pid].questionsAnswered) * 10000);
    leaderboard.push({ name: pMap[pid].name, branch: pMap[pid].branch, correct: pMap[pid].correct, totalTime: adjustedTime, totalTimeDisplay: (adjustedTime / 1000).toFixed(1), questionsAnswered: pMap[pid].questionsAnswered, isComplete: pMap[pid].questionsAnswered >= QUIZ_DATA.length });
  }

  leaderboard.sort((a, b) => b.correct !== a.correct ? b.correct - a.correct : a.totalTime - b.totalTime);
  for (var k = 0; k < leaderboard.length; k++) leaderboard[k].rank = k + 1;

  recentResponses.sort((a, b) => String(b.at).localeCompare(String(a.at)));
  
  return jsonResponse({
    success: true,
    quizState: getQuizState(),
    stats: { registered: Object.keys(pMap).length, inProgress: totalInProgress, completed: totalCompleted },
    leaderboard: leaderboard,
    recentActivity: recentResponses.slice(0, 8)
  });
}

// ========== INTERNSHIP SUBMISSION ==========

function handleSubmitInternship(body) {
  var name = sanitize(body.name);
  var email = sanitize(body.email);
  var college = sanitize(body.college);
  var branch = sanitize(body.branch);
  var year = sanitize(body.year);
  
  if (!name || !email) return jsonResponse({ error: 'Name and email are required.' });

  var lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    var resumeUrl = "";
    if (body.resumeData && body.resumeName) {
      // Decode base64 and save to Drive
      var folder, folders = DriveApp.getFoldersByName("QuizBlitz Internships");
      if (folders.hasNext()) { folder = folders.next(); } 
      else { folder = DriveApp.createFolder("QuizBlitz Internships"); }
      
      var blob = Utilities.newBlob(Utilities.base64Decode(body.resumeData.split(',')[1]), 'application/pdf', body.resumeName);
      var file = folder.createFile(blob);
      file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      resumeUrl = file.getUrl();
    }

    var sheet = getSheet('Internships');
    sheet.appendRow([new Date().toISOString(), name, email, college, branch, year, resumeUrl]);
    lock.releaseLock();
    return jsonResponse({ success: true });
  } catch(err) {
    lock.releaseLock();
    return jsonResponse({ error: 'Failed to submit application: ' + err.message });
  }
}

// ========== SETUP SHEETS ==========
function setupSheets() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var pSheet = ss.getSheetByName('Participants') || ss.insertSheet('Participants');
  if (pSheet.getLastRow() === 0) pSheet.appendRow(['participantId', 'name', 'branch', 'contact', 'registeredAt']);
  
  var rSheet = ss.getSheetByName('Responses') || ss.insertSheet('Responses');
  if (rSheet.getLastRow() === 0) rSheet.appendRow(['participantId', 'questionNumber', 'selectedOption', 'isCorrect', 'timeTaken', 'submittedAt']);
  
  var iSheet = ss.getSheetByName('Internships') || ss.insertSheet('Internships');
  if (iSheet.getLastRow() === 0) iSheet.appendRow(['Timestamp', 'Name', 'Email', 'College', 'Branch', 'Year', 'Resume URL']);
}
