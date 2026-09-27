// =============================================
// Google Apps Script — Quiz Backend (with Admin)
// =============================================
// Deploy as Web App: Execute as "Me", Access "Anyone"
//
// Sheet setup:
// "Participants" columns: participantId | name | branch | contact | registeredAt
// "Responses" columns: participantId | questionNumber | selectedOption | isCorrect | timeTaken | submittedAt

// ========== ADMIN CREDENTIALS ==========
// IMPORTANT: Change these before deploying!
// These are checked server-side only — never exposed to participants.
var ADMIN_EMAIL = 'codework.riti@gmail.com';
var ADMIN_PASSWORD = '7417914565';

// ========== QUIZ DATA (from question.txt — verbatim) ==========
var QUIZ_DATA = [
  {
    q: 1,
    text: "A YouTube show where contestants rate themselves and the judges guess the score. It was pulled after a huge controversy in 2025. Name it.",
    options: ["Comicstaan", "India's Got Latent", "MTV Roadies", "Shark Tank India"],
    answer: "B",
    hook: "A fresh format made it go viral, and one bad moment took the whole show down. Trust and risk are product decisions too."
  },
  {
    q: 2,
    text: "TikTok got banned in India in 2020. Which Instagram feature launched in India almost immediately after?",
    options: ["Stories", "Threads", "Reels", "Broadcast Channels"],
    answer: "C",
    hook: "When a competitor disappears, the gap is the opportunity. The fastest team to fill it wins the users."
  },
  {
    q: 3,
    text: "PUBG Mobile was banned in India. What did it come back as?",
    options: ["Free Fire Max", "Call of Duty Mobile", "Clash Royale", "BGMI"],
    answer: "D",
    hook: "Same core product, a new local identity. Sometimes the fix is positioning, not features."
  },
  {
    q: 4,
    text: "Millions of people got stuck in an online queue trying to buy Coldplay's India tickets. Which platform?",
    options: ["BookMyShow", "Paytm Insider", "District by Zomato", "Ticketmaster"],
    answer: "A",
    hook: "Your product is only as good as its worst peak day. Plan for the rush, not the average."
  },
  {
    q: 5,
    text: 'Which show made "Yeh sab doglapan hai" a national meme?',
    options: ["Bigg Boss", "Shark Tank India", "The Kapil Sharma Show", "MTV Splitsvilla"],
    answer: "B",
    hook: "The show turned business pitches into entertainment. Packaging decides whether people care about the product inside."
  },
  {
    q: 6,
    text: 'In an ad, Rahul Dravid loses it in traffic and yells "Indiranagar ka gunda hoon main!" Which brand?',
    options: ["Dream11", "PhonePe", "CRED", "Paytm"],
    answer: "C",
    hook: "The product is paying credit card bills, which is boring. The story made it unforgettable."
  },
  {
    q: 7,
    text: 'Which food delivery company renamed its parent company "Eternal"?',
    options: ["Swiggy", "Zepto", "Dunzo", "Zomato"],
    answer: "D",
    hook: "It stopped being one app and became a group of businesses: Zomato, Blinkit, District, Hyperpure. The name followed the strategy."
  },
  {
    q: 8,
    text: "Which 10-minute delivery app used to be called Grofers?",
    options: ["Blinkit", "Zepto", "Swiggy Instamart", "BigBasket"],
    answer: "A",
    hook: "The promise changed from groceries to groceries in 10 minutes, so the name changed too."
  },
  {
    q: 9,
    text: "In 2016, which telecom gave India free 4G data and changed how the whole country uses the internet?",
    options: ["Airtel", "Jio", "Vodafone", "BSNL"],
    answer: "B",
    hook: "Pricing is a product decision. Free got millions of people in, and habits kept them."
  },
  {
    q: 10,
    text: "Which app's green owl guilt-trips you into saving your streak?",
    options: ["Duolingo", "Snapchat", "Headspace", "Candy Crush"],
    answer: "A",
    hook: "Streaks are a retention feature disguised as fun. That owl is a product manager's best employee."
  },
  {
    q: 11,
    text: "A little cartoon girl has commented on every trending news story in India for decades. Which brand?",
    options: ["Parle-G", "Mother Dairy", "Britannia", "Amul"],
    answer: "D",
    hook: "An old brand that stays relevant by reacting to the news in real time. It shows marketing and timing matter as much as the product."
  },
  {
    q: 12,
    text: "The yearly sale that finally gets your parents to say yes to that new phone. (Bonus: the newspaper in Riti's photo on slide 3 is advertising it.)",
    options: ["Amazon Great Indian Festival", "Myntra End of Reason Sale", "Flipkart Big Billion Days", "Meesho Mega Blockbuster Sale"],
    answer: "C",
    hook: "One sale turned into a national event that people plan for. Scarcity and timing are product levers."
  }
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
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
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

// ========== MAIN ROUTER ==========

function doPost(e) {
  try {
    var body = JSON.parse(e.postData.contents);
    var action = body.action;

    switch (action) {
      case 'register':
        return handleRegister(body);
      case 'getQuestion':
        return handleGetQuestion(body);
      case 'submitAnswer':
        return handleSubmitAnswer(body);
      case 'getLeaderboard':
        return handleGetLeaderboard(body);
      case 'getParticipantStatus':
        return handleGetParticipantStatus(body);
      case 'adminLogin':
        return handleAdminLogin(body);
      case 'getAdminDashboard':
        return handleGetAdminDashboard(body);
      default:
        return jsonResponse({ error: 'Unknown action' });
    }
  } catch (err) {
    return jsonResponse({ error: err.message });
  }
}

function doGet(e) {
  var action = e.parameter.action;
  if (action === 'ping') {
    return jsonResponse({ status: 'ok', time: new Date().toISOString() });
  }
  return jsonResponse({ error: 'Use POST' });
}

// ========== REGISTRATION ==========

function handleRegister(body) {
  var name = sanitize(body.name);
  var branch = sanitize(body.branch);
  var contact = (body.contact || '').toString().trim();

  if (!name || name.length < 2) {
    return jsonResponse({ error: 'Please enter a valid name (at least 2 characters).' });
  }
  if (!branch) {
    return jsonResponse({ error: 'Please select or enter your branch.' });
  }
  if (!validateContact(contact)) {
    return jsonResponse({ error: 'Please enter a valid contact number (10-15 digits).' });
  }

  var lock = LockService.getScriptLock();
  lock.waitLock(10000);

  try {
    var sheet = getSheet('Participants');
    var participantId = generateId();
    var now = new Date().toISOString();

    sheet.appendRow([participantId, name, branch, contact, now]);
    lock.releaseLock();

    return jsonResponse({
      success: true,
      participantId: participantId,
      totalQuestions: QUIZ_DATA.length
    });
  } catch (err) {
    lock.releaseLock();
    return jsonResponse({ error: 'Registration failed. Please try again.' });
  }
}

// ========== GET QUESTION ==========

function handleGetQuestion(body) {
  var participantId = sanitize(body.participantId);
  var questionNumber = parseInt(body.questionNumber, 10);

  if (!participantId) {
    return jsonResponse({ error: 'Missing participant ID.' });
  }
  if (isNaN(questionNumber) || questionNumber < 1 || questionNumber > QUIZ_DATA.length) {
    return jsonResponse({ error: 'Invalid question number.' });
  }

  var qData = QUIZ_DATA[questionNumber - 1];
  var serverTime = new Date().getTime();
  var deadline = serverTime + 10500; // 10s + 500ms network grace

  var props = PropertiesService.getScriptProperties();
  var key = 'deadline_' + participantId + '_' + questionNumber;
  props.setProperty(key, deadline.toString());

  return jsonResponse({
    success: true,
    questionNumber: questionNumber,
    totalQuestions: QUIZ_DATA.length,
    text: qData.text,
    options: qData.options,
    deadline: deadline,
    serverTime: serverTime
  });
}

// ========== SUBMIT ANSWER ==========

function handleSubmitAnswer(body) {
  var participantId = sanitize(body.participantId);
  var questionNumber = parseInt(body.questionNumber, 10);
  var selectedOption = parseInt(body.selectedOption, 10);

  if (!participantId) {
    return jsonResponse({ error: 'Missing participant ID.' });
  }
  if (isNaN(questionNumber) || questionNumber < 1 || questionNumber > QUIZ_DATA.length) {
    return jsonResponse({ error: 'Invalid question number.' });
  }

  var lock = LockService.getScriptLock();
  lock.waitLock(15000);

  try {
    // Check for duplicate submission
    var responseSheet = getSheet('Responses');
    var responseData = responseSheet.getDataRange().getValues();
    for (var i = 1; i < responseData.length; i++) {
      if (responseData[i][0] === participantId && responseData[i][1] === questionNumber) {
        var qData = QUIZ_DATA[questionNumber - 1];
        var correctIdx = ANSWER_MAP[qData.answer];
        lock.releaseLock();
        return jsonResponse({
          success: true,
          duplicate: true,
          correctOption: correctIdx,
          isCorrect: responseData[i][3] === true || responseData[i][3] === 'TRUE',
          hook: qData.hook,
          questionNumber: questionNumber
        });
      }
    }

    // Check deadline
    var props = PropertiesService.getScriptProperties();
    var key = 'deadline_' + participantId + '_' + questionNumber;
    var deadlineStr = props.getProperty(key);
    var now = new Date().getTime();

    var timeTaken = 10000;
    var timedOut = false;

    if (deadlineStr) {
      var deadline = parseInt(deadlineStr, 10);
      var questionStartTime = deadline - 10500;
      timeTaken = Math.min(now - questionStartTime, 10000);

      if (now > deadline) {
        timedOut = true;
        selectedOption = -1;
        timeTaken = 10000;
      }
    }

    if (timeTaken < 0) timeTaken = 0;

    var qData = QUIZ_DATA[questionNumber - 1];
    var correctIdx = ANSWER_MAP[qData.answer];
    var isCorrect = false;

    if (!timedOut && selectedOption >= 0 && selectedOption <= 3) {
      isCorrect = (selectedOption === correctIdx);
    } else {
      selectedOption = -1;
      timeTaken = 10000;
    }

    responseSheet.appendRow([
      participantId,
      questionNumber,
      selectedOption,
      isCorrect,
      Math.round(timeTaken),
      new Date().toISOString()
    ]);

    props.deleteProperty(key);
    lock.releaseLock();

    return jsonResponse({
      success: true,
      duplicate: false,
      correctOption: correctIdx,
      isCorrect: isCorrect,
      timeTaken: Math.round(timeTaken),
      hook: qData.hook,
      questionNumber: questionNumber
    });
  } catch (err) {
    lock.releaseLock();
    return jsonResponse({ error: 'Submission failed: ' + err.message });
  }
}

// ========== PARTICIPANT LEADERBOARD ==========

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
      var pid = participants[i][0];
      pMap[pid] = {
        id: pid,
        name: participants[i][1],
        totalCorrect: 0,
        totalTime: 0,
        questionsAnswered: 0
      };
    }

    for (var j = 1; j < responses.length; j++) {
      var rid = responses[j][0];
      if (!pMap[rid]) continue;
      pMap[rid].questionsAnswered++;
      if (responses[j][3] === true || responses[j][3] === 'TRUE') {
        pMap[rid].totalCorrect++;
      }
      var time = parseInt(responses[j][4], 10);
      if (isNaN(time)) time = 10000;
      pMap[rid].totalTime += time;
    }

    var totalQ = QUIZ_DATA.length;
    for (var pid in pMap) {
      var unanswered = totalQ - pMap[pid].questionsAnswered;
      if (unanswered > 0) {
        pMap[pid].totalTime += unanswered * 10000;
      }
    }

    var completed = [];
    for (var pid in pMap) {
      if (pMap[pid].questionsAnswered >= totalQ) {
        completed.push(pMap[pid]);
      }
    }

    completed.sort(function (a, b) {
      if (b.totalCorrect !== a.totalCorrect) return b.totalCorrect - a.totalCorrect;
      return a.totalTime - b.totalTime;
    });

    var top3 = completed.slice(0, 3).map(function (p, idx) {
      return {
        rank: idx + 1,
        name: p.name,
        correct: p.totalCorrect,
        total: totalQ,
        totalTime: (p.totalTime / 1000).toFixed(1)
      };
    });

    var myResult = null;
    if (participantId && pMap[participantId]) {
      var me = pMap[participantId];
      var myRank = -1;
      for (var k = 0; k < completed.length; k++) {
        if (completed[k].id === participantId) {
          myRank = k + 1;
          break;
        }
      }
      myResult = {
        rank: myRank,
        name: me.name,
        correct: me.totalCorrect,
        total: totalQ,
        totalTime: (me.totalTime / 1000).toFixed(1)
      };
    }

    lock.releaseLock();

    return jsonResponse({
      success: true,
      leaderboard: top3,
      myResult: myResult
    });
  } catch (err) {
    lock.releaseLock();
    return jsonResponse({ error: 'Leaderboard failed: ' + err.message });
  }
}

// ========== PARTICIPANT STATUS (for session recovery) ==========

function handleGetParticipantStatus(body) {
  var participantId = sanitize(body.participantId);
  if (!participantId) {
    return jsonResponse({ error: 'Missing participant ID.', valid: false });
  }

  var pSheet = getSheet('Participants');
  var pData = pSheet.getDataRange().getValues();
  var found = false;
  var name = '';

  for (var i = 1; i < pData.length; i++) {
    if (pData[i][0] === participantId) {
      found = true;
      name = pData[i][1];
      break;
    }
  }

  if (!found) {
    return jsonResponse({ success: true, valid: false });
  }

  var rSheet = getSheet('Responses');
  var rData = rSheet.getDataRange().getValues();
  var maxAnswered = 0;

  for (var j = 1; j < rData.length; j++) {
    if (rData[j][0] === participantId) {
      var qNum = parseInt(rData[j][1], 10);
      if (qNum > maxAnswered) maxAnswered = qNum;
    }
  }

  var totalQ = QUIZ_DATA.length;
  var isComplete = maxAnswered >= totalQ;
  var nextQuestion = isComplete ? -1 : maxAnswered + 1;

  return jsonResponse({
    success: true,
    valid: true,
    name: name,
    questionsAnswered: maxAnswered,
    isComplete: isComplete,
    nextQuestion: nextQuestion
  });
}

// ========== ADMIN LOGIN ==========

function handleAdminLogin(body) {
  if (!verifyAdmin(body)) {
    return jsonResponse({ error: 'Invalid email or password.' });
  }
  return jsonResponse({ success: true });
}

// ========== ADMIN DASHBOARD ==========

function handleGetAdminDashboard(body) {
  if (!verifyAdmin(body)) {
    return jsonResponse({ error: 'Unauthorized' });
  }

  var pSheet = getSheet('Participants');
  var rSheet = getSheet('Responses');
  var pData = pSheet.getDataRange().getValues();
  var rData = rSheet.getDataRange().getValues();

  // Build participant map
  var pMap = {};
  for (var i = 1; i < pData.length; i++) {
    pMap[pData[i][0]] = {
      name: pData[i][1],
      branch: pData[i][2],
      correct: 0,
      totalTime: 0,
      questionsAnswered: 0
    };
  }

  // Aggregate responses + build question stats + recent activity
  var questionStats = {};
  var recentResponses = [];

  for (var j = 1; j < rData.length; j++) {
    var pid = rData[j][0];
    var qNum = parseInt(rData[j][1], 10);
    var isCorrect = rData[j][3] === true || rData[j][3] === 'TRUE';
    var timeTaken = parseInt(rData[j][4], 10) || 10000;
    var submittedAt = rData[j][5];

    if (pMap[pid]) {
      pMap[pid].questionsAnswered++;
      if (isCorrect) pMap[pid].correct++;
      pMap[pid].totalTime += timeTaken;
    }

    // Question stats
    if (!questionStats[qNum]) {
      questionStats[qNum] = { answered: 0, correct: 0, totalTime: 0 };
    }
    questionStats[qNum].answered++;
    if (isCorrect) questionStats[qNum].correct++;
    questionStats[qNum].totalTime += timeTaken;

    // Recent activity (keep last 50 for sorting)
    recentResponses.push({
      name: pMap[pid] ? pMap[pid].name : 'Unknown',
      q: qNum,
      isCorrect: isCorrect,
      timeTaken: (timeTaken / 1000).toFixed(1),
      at: submittedAt
    });
  }

  // Stats
  var totalRegistered = Object.keys(pMap).length;
  var totalCompleted = 0;
  var totalInProgress = 0;
  var totalQ = QUIZ_DATA.length;

  // Build leaderboard
  var leaderboard = [];
  for (var pid in pMap) {
    var p = pMap[pid];
    if (p.questionsAnswered >= totalQ) {
      totalCompleted++;
    } else if (p.questionsAnswered > 0) {
      totalInProgress++;
    }

    // Add unanswered penalty time
    var unanswered = totalQ - p.questionsAnswered;
    var adjustedTime = p.totalTime + (unanswered * 10000);

    leaderboard.push({
      name: p.name,
      branch: p.branch,
      correct: p.correct,
      totalTime: adjustedTime,
      totalTimeDisplay: (adjustedTime / 1000).toFixed(1),
      questionsAnswered: p.questionsAnswered,
      total: totalQ,
      isComplete: p.questionsAnswered >= totalQ
    });
  }

  // Sort: more correct first, then lower total time
  leaderboard.sort(function (a, b) {
    if (b.correct !== a.correct) return b.correct - a.correct;
    return a.totalTime - b.totalTime;
  });

  // Add ranks
  for (var k = 0; k < leaderboard.length; k++) {
    leaderboard[k].rank = k + 1;
  }

  // Build question stats array
  var qStatsArray = [];
  for (var q = 1; q <= totalQ; q++) {
    var qs = questionStats[q] || { answered: 0, correct: 0, totalTime: 0 };
    qStatsArray.push({
      q: q,
      questionText: QUIZ_DATA[q - 1].text.substring(0, 80),
      answered: qs.answered,
      correct: qs.correct,
      accuracy: qs.answered > 0 ? Math.round((qs.correct / qs.answered) * 100) : 0,
      avgTime: qs.answered > 0 ? (qs.totalTime / qs.answered / 1000).toFixed(1) : '0.0',
      totalParticipants: totalRegistered
    });
  }

  // Recent activity — last 8
  recentResponses.sort(function (a, b) {
    return String(b.at).localeCompare(String(a.at));
  });
  var recent = recentResponses.slice(0, 8);

  return jsonResponse({
    success: true,
    stats: {
      registered: totalRegistered,
      inProgress: totalInProgress,
      completed: totalCompleted
    },
    questionStats: qStatsArray,
    leaderboard: leaderboard,
    recentActivity: recent,
    timestamp: new Date().toISOString()
  });
}

// ========== SHEET SETUP ==========
// Run this once from the GAS editor to create sheets with headers.
// Also set ADMIN_EMAIL and ADMIN_PASSWORD at the top of this file.
function setupSheets() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  var pSheet = ss.getSheetByName('Participants');
  if (!pSheet) {
    pSheet = ss.insertSheet('Participants');
  }
  if (pSheet.getLastRow() === 0) {
    pSheet.appendRow(['participantId', 'name', 'branch', 'contact', 'registeredAt']);
  }

  var rSheet = ss.getSheetByName('Responses');
  if (!rSheet) {
    rSheet = ss.insertSheet('Responses');
  }
  if (rSheet.getLastRow() === 0) {
    rSheet.appendRow(['participantId', 'questionNumber', 'selectedOption', 'isCorrect', 'timeTaken', 'submittedAt']);
  }
}
