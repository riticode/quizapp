// =============================================
// Google Apps Script — Quiz Backend
// =============================================
// Deploy as Web App: Execute as "Me", Access "Anyone"
// Paste this entire file into a Google Apps Script project
// linked to a Google Sheet with two sheets: "Participants" and "Responses"
//
// Sheet setup:
// "Participants" columns: participantId | name | branch | contact | registeredAt
// "Responses" columns: participantId | questionNumber | selectedOption | isCorrect | timeTaken | submittedAt
//
// After deploying, copy the web app URL and set it as APPS_SCRIPT_URL in config.js

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

// Map letter answers to 0-based index
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

// ========== CORS ==========

function doOptions(e) {
  return ContentService.createTextOutput('')
    .setMimeType(ContentService.MimeType.TEXT);
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

  // Store the deadline in PropertiesService for this participant+question
  var props = PropertiesService.getScriptProperties();
  var key = 'deadline_' + participantId + '_' + questionNumber;
  props.setProperty(key, deadline.toString());

  // Return question WITHOUT the answer
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
  var selectedOption = parseInt(body.selectedOption, 10); // 0-based index, or -1 for timeout

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
        // Already submitted — return the existing result without re-recording
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

    var timeTaken = 10000; // default: full 10s for timeout
    var timedOut = false;

    if (deadlineStr) {
      var deadline = parseInt(deadlineStr, 10);
      var questionStartTime = deadline - 10500;
      timeTaken = Math.min(now - questionStartTime, 10000);

      if (now > deadline) {
        // Late submission — mark as timeout
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

    // Record response
    responseSheet.appendRow([
      participantId,
      questionNumber,
      selectedOption,
      isCorrect,
      Math.round(timeTaken),
      new Date().toISOString()
    ]);

    // Clean up deadline property
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

// ========== LEADERBOARD ==========

function handleGetLeaderboard(body) {
  var participantId = sanitize(body.participantId);

  var lock = LockService.getScriptLock();
  lock.waitLock(15000);

  try {
    var pSheet = getSheet('Participants');
    var rSheet = getSheet('Responses');

    var participants = pSheet.getDataRange().getValues();
    var responses = rSheet.getDataRange().getValues();

    // Build participant map: id -> { name, totalCorrect, totalTime }
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

    // Aggregate responses
    for (var j = 1; j < responses.length; j++) {
      var rid = responses[j][0];
      if (!pMap[rid]) continue;

      pMap[rid].questionsAnswered++;

      if (responses[j][3] === true || responses[j][3] === 'TRUE' || responses[j][3] === true) {
        pMap[rid].totalCorrect++;
      }

      var time = parseInt(responses[j][4], 10);
      if (isNaN(time)) time = 10000;
      pMap[rid].totalTime += time;
    }

    // For unanswered questions, add 10s each (treat as timeout)
    var totalQ = QUIZ_DATA.length;
    for (var pid in pMap) {
      var unanswered = totalQ - pMap[pid].questionsAnswered;
      if (unanswered > 0) {
        pMap[pid].totalTime += unanswered * 10000;
      }
    }

    // Only include participants who answered all 12 questions
    var completed = [];
    for (var pid in pMap) {
      if (pMap[pid].questionsAnswered >= totalQ) {
        completed.push(pMap[pid]);
      }
    }

    // Sort: more correct first, then lower total time
    completed.sort(function (a, b) {
      if (b.totalCorrect !== a.totalCorrect) return b.totalCorrect - a.totalCorrect;
      return a.totalTime - b.totalTime;
    });

    // Top 3 only
    var top3 = completed.slice(0, 3).map(function (p, idx) {
      return {
        rank: idx + 1,
        name: p.name,
        correct: p.totalCorrect,
        total: totalQ,
        totalTime: (p.totalTime / 1000).toFixed(1)
      };
    });

    // Find current participant's result
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

// ========== SHEET SETUP HELPER ==========
// Run this once to create the sheets with headers
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
