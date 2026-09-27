// =============================================
// QuizBlitz — Main Application Logic
// =============================================
// Zero dependencies. Vanilla JS.
// Server is the authority for timing and scoring.
// Session persisted in localStorage for refresh recovery.
// =============================================

(function () {
  'use strict';

  // ========== STATE ==========
  var state = {
    participantId: null,
    currentQuestion: 0,
    totalQuestions: CONFIG.TOTAL_QUESTIONS,
    selectedOption: -1,
    timerInterval: null,
    deadline: 0,
    serverTimeOffset: 0,
    locked: false
  };

  // ========== DOM REFS ==========
  var $ = function (id) { return document.getElementById(id); };

  var screens = {
    register: $('screen-register'),
    waiting: $('screen-waiting'),
    quiz: $('screen-quiz'),
    reveal: $('screen-reveal'),
    leaderboard: $('screen-leaderboard')
  };

  var els = {
    form: $('register-form'),
    name: $('reg-name'),
    branch: $('reg-branch'),
    contact: $('reg-contact'),
    btnStart: $('btn-start'),
    regError: $('reg-error'),
    qCounter: $('q-counter'),
    progressFill: $('progress-fill'),
    timerCircle: $('timer-circle'),
    timerText: $('timer-text'),
    timerRing: $('timer-ring'),
    qText: $('q-text'),
    qOptions: $('q-options'),
    revealIcon: $('reveal-icon'),
    revealStatus: $('reveal-status'),
    revealAnswerText: $('reveal-answer-text'),
    revealHookText: $('reveal-hook-text'),
    btnNext: $('btn-next'),
    lbPodium: $('lb-podium'),
    lbMyResult: $('lb-my-result'),
    btnFinish: $('btn-finish'),
    loadingOverlay: $('loading-overlay')
  };

  var OPTION_LETTERS = ['A', 'B', 'C', 'D'];
  var CIRCUMFERENCE = 2 * Math.PI * 20;
  var SESSION_KEY = 'quizblitz_session';
  var pollInterval = null;

  // ========== NETWORK ==========

  function apiCall(body, retries) {
    if (typeof retries === 'undefined') retries = CONFIG.NETWORK_RETRY_ATTEMPTS;

    return fetch(CONFIG.APPS_SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify(body),
      redirect: 'follow'
    })
      .then(function (res) {
        if (!res.ok) throw new Error('Network error: ' + res.status);
        return res.json();
      })
      .then(function (data) {
        if (data.error) throw new Error(data.error);
        return data;
      })
      .catch(function (err) {
        if (retries > 0) {
          return new Promise(function (resolve) {
            setTimeout(resolve, CONFIG.NETWORK_RETRY_DELAY_MS);
          }).then(function () {
            return apiCall(body, retries - 1);
          });
        }
        throw err;
      });
  }

  // ========== SESSION PERSISTENCE ==========

  function saveSession() {
    var session = {
      participantId: state.participantId,
      currentQuestion: state.currentQuestion,
      totalQuestions: state.totalQuestions
    };
    try {
      localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    } catch (e) { /* localStorage unavailable */ }
  }

  function loadSession() {
    try {
      var raw = localStorage.getItem(SESSION_KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (e) {
      return null;
    }
  }

  function clearSession() {
    try {
      localStorage.removeItem(SESSION_KEY);
    } catch (e) { /* ok */ }
  }

  // ========== SCREEN MANAGEMENT ==========

  function showScreen(name) {
    Object.keys(screens).forEach(function (key) {
      if(screens[key]) screens[key].classList.remove('active');
    });
    if(screens[name]) screens[name].classList.add('active');
  }

  function showLoading(show) {
    els.loadingOverlay.hidden = !show;
  }

  function showError(msg) {
    els.regError.textContent = msg;
    els.regError.hidden = false;
  }

  function hideError() {
    els.regError.hidden = true;
  }

  // ========== WAITING ROOM ==========
  
  function showWaitingRoom() {
    showScreen('waiting');
    clearInterval(pollInterval);
    pollInterval = setInterval(function() {
      apiCall({ action: 'getParticipantStatus', participantId: state.participantId })
        .then(function(data) {
          if (data.quizState === 'STARTED') {
            clearInterval(pollInterval);
            loadQuestion(Math.max(1, data.nextQuestion || 1));
          }
        })
        .catch(function(){}); // ignore network errors during polling
    }, 3000);
  }

  // ========== REGISTRATION ==========

  function validateForm() {
    var name = els.name.value.trim();
    var branch = els.branch.value.trim();
    var contact = els.contact.value.trim();
    var valid = true;

    els.name.classList.remove('invalid');
    els.branch.classList.remove('invalid');
    els.contact.classList.remove('invalid');

    if (!name || name.length < 2) {
      els.name.classList.add('invalid');
      valid = false;
    }
    if (!branch) {
      els.branch.classList.add('invalid');
      valid = false;
    }
    var cleanContact = contact.replace(/[\s\-\+\(\)]/g, '');
    if (!/^\d{10,15}$/.test(cleanContact)) {
      els.contact.classList.add('invalid');
      valid = false;
    }

    return valid;
  }

  function handleRegistration(e) {
    e.preventDefault();
    hideError();

    if (!validateForm()) {
      showError('Please fill all fields correctly.');
      return;
    }

    var btnText = els.btnStart.querySelector('.btn-text');
    var btnLoader = els.btnStart.querySelector('.btn-loader');
    btnText.textContent = 'Connecting...';
    btnLoader.hidden = false;
    els.btnStart.disabled = true;

    apiCall({
      action: 'register',
      name: els.name.value.trim(),
      branch: els.branch.value.trim(),
      contact: els.contact.value.trim()
    })
      .then(function (data) {
        state.participantId = data.participantId;
        state.totalQuestions = data.totalQuestions || CONFIG.TOTAL_QUESTIONS;
        state.currentQuestion = 1;
        saveSession();
        
        if (data.quizState === 'WAITING') {
          showWaitingRoom();
        } else {
          loadQuestion(1);
        }
      })
      .catch(function (err) {
        showError(err.message || 'Registration failed. Please try again.');
        btnText.textContent = 'Start Quiz';
        btnLoader.hidden = true;
        els.btnStart.disabled = false;
      });
  }

  // ========== SESSION RECOVERY ==========

  function recoverSession(session) {
    showLoading(true);
    state.participantId = session.participantId;
    state.totalQuestions = session.totalQuestions || CONFIG.TOTAL_QUESTIONS;

    apiCall({
      action: 'getParticipantStatus',
      participantId: session.participantId
    })
      .then(function (data) {
        showLoading(false);
        if (!data.valid) {
          // Invalid session — clear and show registration
          clearSession();
          return;
        }

        if (data.isComplete) {
          // Already finished — show leaderboard with fresh data
          state.currentQuestion = state.totalQuestions;
          loadLeaderboard();
        } else if (data.quizState === 'WAITING') {
          showWaitingRoom();
        } else {
          // Resume from next unanswered question
          state.currentQuestion = Math.max(1, data.nextQuestion);
          loadQuestion(state.currentQuestion);
        }
      })
      .catch(function () {
        showLoading(false);
        // Can't verify — clear session, show registration
        clearSession();
      });
  }

  // ========== QUIZ ==========

  function loadQuestion(qNum) {
    showLoading(true);
    state.selectedOption = -1;
    state.locked = false;
    state.currentQuestion = qNum;
    saveSession();

    apiCall({
      action: 'getQuestion',
      participantId: state.participantId,
      questionNumber: qNum
    })
      .then(function (data) {
        showLoading(false);
        renderQuestion(data);
        showScreen('quiz');
        startTimer(data.deadline, data.serverTime);
      })
      .catch(function (err) {
        showLoading(false);
        setTimeout(function () {
          loadQuestion(qNum);
        }, 1500);
      });
  }

  function renderQuestion(data) {
    els.qCounter.textContent = data.questionNumber + ' / ' + data.totalQuestions;
    var pct = ((data.questionNumber - 1) / data.totalQuestions) * 100;
    els.progressFill.style.width = pct + '%';

    els.qText.textContent = data.text;

    els.qOptions.innerHTML = '';
    data.options.forEach(function (opt, idx) {
      var btn = document.createElement('button');
      btn.className = 'option-btn';
      btn.setAttribute('type', 'button');
      btn.setAttribute('id', 'option-' + idx);
      btn.innerHTML =
        '<span class="option-label">' + OPTION_LETTERS[idx] + '</span>' +
        '<span class="option-text">' + escapeHtml(opt) + '</span>';
      btn.addEventListener('click', function () {
        handleOptionSelect(idx);
      });
      els.qOptions.appendChild(btn);
    });
  }

  function escapeHtml(str) {
    var div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function handleOptionSelect(idx) {
    if (state.locked) return;

    var btns = els.qOptions.querySelectorAll('.option-btn');
    btns.forEach(function (btn) { btn.classList.remove('selected'); });

    btns[idx].classList.add('selected');
    state.selectedOption = idx;

    lockOptions();
    submitAnswer();
  }

  function lockOptions() {
    state.locked = true;
    var btns = els.qOptions.querySelectorAll('.option-btn');
    btns.forEach(function (btn) { btn.classList.add('locked'); });
  }

  // ========== TIMER ==========

  function startTimer(deadline, serverTime) {
    var localNow = Date.now();
    state.serverTimeOffset = localNow - serverTime;
    state.deadline = deadline;

    els.timerCircle.style.strokeDashoffset = '0';
    els.timerCircle.classList.remove('urgent');
    els.timerText.classList.remove('urgent');
    els.timerText.textContent = '10';

    clearInterval(state.timerInterval);

    state.timerInterval = setInterval(function () {
      var localNow = Date.now();
      var serverNow = localNow - state.serverTimeOffset;
      var remaining = Math.max(0, state.deadline - serverNow);
      var seconds = Math.ceil(remaining / 1000);
      var fraction = remaining / CONFIG.QUESTION_TIME_MS;

      var offset = CIRCUMFERENCE * (1 - Math.max(0, Math.min(1, fraction)));
      els.timerCircle.style.strokeDashoffset = offset;
      els.timerText.textContent = Math.max(0, Math.min(10, seconds));

      if (seconds <= 3) {
        els.timerCircle.classList.add('urgent');
        els.timerText.classList.add('urgent');
      }

      if (remaining <= 0) {
        clearInterval(state.timerInterval);
        els.timerText.textContent = '0';
        if (!state.locked) {
          lockOptions();
          submitAnswer();
        }
      }
    }, 100);
  }

  function stopTimer() {
    clearInterval(state.timerInterval);
  }

  // ========== SUBMIT ANSWER ==========

  function submitAnswer() {
    stopTimer();

    apiCall({
      action: 'submitAnswer',
      participantId: state.participantId,
      questionNumber: state.currentQuestion,
      selectedOption: state.selectedOption
    })
      .then(function (data) {
        showReveal(data);
      })
      .catch(function (err) {
        apiCall({
          action: 'submitAnswer',
          participantId: state.participantId,
          questionNumber: state.currentQuestion,
          selectedOption: state.selectedOption
        }, 1)
          .then(function (data) {
            showReveal(data);
          })
          .catch(function () {
            showReveal({
              isCorrect: false,
              correctOption: -1,
              hook: 'Unable to verify answer. Moving to next question.',
              questionNumber: state.currentQuestion
            });
          });
      });
  }

  // ========== REVEAL ==========

  function showReveal(data) {
    var isTimeout = state.selectedOption === -1;
    var isCorrect = data.isCorrect;

    els.revealIcon.className = 'reveal-icon';
    els.revealStatus.className = 'reveal-status';

    if (isTimeout) {
      els.revealIcon.classList.add('timeout');
      els.revealIcon.textContent = '⏱';
      els.revealStatus.classList.add('timeout');
      els.revealStatus.textContent = "Time's Up!";
    } else if (isCorrect) {
      els.revealIcon.classList.add('correct');
      els.revealIcon.textContent = '✓';
      els.revealStatus.classList.add('correct');
      els.revealStatus.textContent = 'Correct!';
    } else {
      els.revealIcon.classList.add('incorrect');
      els.revealIcon.textContent = '✗';
      els.revealStatus.classList.add('incorrect');
      els.revealStatus.textContent = 'Incorrect';
    }

    if (data.correctOption >= 0 && data.correctOption <= 3) {
      var optBtns = els.qOptions.querySelectorAll('.option-btn .option-text');
      var correctText = OPTION_LETTERS[data.correctOption] + ') ' +
        (optBtns[data.correctOption] ? optBtns[data.correctOption].textContent : '');
      els.revealAnswerText.textContent = correctText;
    } else {
      els.revealAnswerText.textContent = '—';
    }

    els.revealHookText.textContent = data.hook || '';

    var isLast = state.currentQuestion >= state.totalQuestions;
    var nextBtn = els.btnNext;
    nextBtn.querySelector('.btn-text').textContent = isLast ? 'See Results' : 'Next Question';

    showScreen('reveal');
  }

  function handleNext() {
    if (state.currentQuestion >= state.totalQuestions) {
      loadLeaderboard();
    } else {
      state.currentQuestion++;
      saveSession();
      loadQuestion(state.currentQuestion);
    }
  }

  // ========== LEADERBOARD ==========

  function loadLeaderboard() {
    showLoading(true);

    apiCall({
      action: 'getLeaderboard',
      participantId: state.participantId
    })
      .then(function (data) {
        showLoading(false);
        renderLeaderboard(data);
        showScreen('leaderboard');
      })
      .catch(function (err) {
        showLoading(false);
        setTimeout(function () {
          loadLeaderboard();
        }, 2000);
      });
  }

  function renderLeaderboard(data) {
    var podium = els.lbPodium;
    podium.innerHTML = '';

    var rankClasses = ['gold', 'silver', 'bronze'];
    var rankEmoji = ['🥇', '🥈', '🥉'];

    if (!data.leaderboard || data.leaderboard.length === 0) {
      podium.innerHTML = '<p style="color: var(--text-secondary); padding: 2rem;">Waiting for results...</p>';
    } else {
      data.leaderboard.forEach(function (entry, idx) {
        var div = document.createElement('div');
        div.className = 'lb-entry';
        div.innerHTML =
          '<div class="lb-rank ' + (rankClasses[idx] || '') + '">' + rankEmoji[idx] + '</div>' +
          '<div class="lb-info">' +
          '<div class="lb-name">' + escapeHtml(entry.name) + '</div>' +
          '<div class="lb-stats">' + entry.correct + '/' + entry.total + ' correct · ' + entry.totalTime + 's</div>' +
          '</div>' +
          '<div class="lb-score">#' + entry.rank + '</div>';
        podium.appendChild(div);
      });
    }

    // My result
    var myResult = data.myResult;
    if (myResult) {
      els.lbMyResult.hidden = false;
      els.lbMyResult.innerHTML =
        '<h3>Your Result</h3>' +
        '<p><strong>' + escapeHtml(myResult.name) + '</strong> — ' +
        myResult.correct + '/' + myResult.total + ' correct · ' +
        myResult.totalTime + 's' +
        (myResult.rank > 0 ? ' · Rank #' + myResult.rank : '') +
        '</p>';
    } else {
      els.lbMyResult.hidden = true;
    }
  }

  // ========== INIT ==========

  function init() {
    // Event listeners
    els.form.addEventListener('submit', handleRegistration);
    els.btnNext.addEventListener('click', handleNext);

    // "Refresh Rankings" button
    els.btnFinish.addEventListener('click', function () {
      loadLeaderboard();
    });

    // Prevent double-tap zoom on mobile
    document.addEventListener('touchend', function (e) {
      if (e.target.tagName === 'BUTTON') {
        e.preventDefault();
        e.target.click();
      }
    }, { passive: false });

    // Warn on page close during quiz
    window.addEventListener('beforeunload', function (e) {
      if (state.participantId && state.currentQuestion > 0 && state.currentQuestion <= state.totalQuestions) {
        e.preventDefault();
        e.returnValue = '';
      }
    });

    // Check config
    if (CONFIG.APPS_SCRIPT_URL === 'YOUR_APPS_SCRIPT_WEB_APP_URL_HERE') {
      showError('⚠ Backend not configured. Please set APPS_SCRIPT_URL in config.js');
      return;
    }

    // Check for existing session — recover on refresh
    var session = loadSession();
    if (session && session.participantId) {
      recoverSession(session);
    }
    // Otherwise, registration screen is already visible
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
