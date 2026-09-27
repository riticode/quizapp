// =============================================
// QuizBlitz — Admin Dashboard Logic
// =============================================
// Presenter-optimized. Auto-refreshes every 3s.
// =============================================

(function () {
  'use strict';

  var POLL_INTERVAL = 3000;
  var pollTimer = null;
  var lastFetchTime = 0;

  // ========== DOM ==========
  var $ = function (id) { return document.getElementById(id); };

  var screens = {
    login: $('admin-login'),
    dashboard: $('admin-dashboard')
  };

  var els = {
    loginForm: $('login-form'),
    emailInput: $('admin-email'),
    passwordInput: $('admin-password'),
    btnLogin: $('btn-login'),
    loginError: $('login-error'),
    btnLogout: $('btn-logout'),
    lastUpdated: $('last-updated'),
    statRegistered: $('stat-registered'),
    statActive: $('stat-active'),
    statCompleted: $('stat-completed'),
    qStatsList: $('q-stats-list'),
    recentActivity: $('recent-activity'),
    lbTableWrap: $('lb-table-wrap'),
    lbCount: $('lb-count')
  };

  // ========== STATE ==========
  var adminCreds = { email: '', password: '' };
  var prevData = null;

  // ========== NETWORK ==========
  function apiCall(body) {
    return fetch(CONFIG.APPS_SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify(body),
      redirect: 'follow'
    })
      .then(function (res) {
        if (!res.ok) throw new Error('Network error');
        return res.json();
      })
      .then(function (data) {
        if (data.error) throw new Error(data.error);
        return data;
      });
  }

  // ========== SCREENS ==========
  function showScreen(name) {
    Object.keys(screens).forEach(function (key) {
      screens[key].classList.remove('active');
    });
    screens[name].classList.add('active');
  }

  // ========== LOGIN ==========
  function handleLogin(e) {
    e.preventDefault();

    var email = els.emailInput.value.trim();
    var password = els.passwordInput.value;

    if (!email || !password) {
      showLoginError('Please fill in both fields.');
      return;
    }

    var btnText = els.btnLogin.querySelector('.btn-text');
    var btnLoader = els.btnLogin.querySelector('.btn-loader');
    btnText.textContent = 'Logging in...';
    btnLoader.hidden = false;
    els.btnLogin.disabled = true;
    els.loginError.hidden = true;

    apiCall({
      action: 'adminLogin',
      adminEmail: email,
      adminPassword: password
    })
      .then(function () {
        adminCreds.email = email;
        adminCreds.password = password;

        // Save session
        sessionStorage.setItem('quizblitz_admin', JSON.stringify(adminCreds));

        showScreen('dashboard');
        startPolling();
      })
      .catch(function (err) {
        showLoginError(err.message || 'Login failed.');
        btnText.textContent = 'Login';
        btnLoader.hidden = true;
        els.btnLogin.disabled = false;
      });
  }

  function showLoginError(msg) {
    els.loginError.textContent = msg;
    els.loginError.hidden = false;
  }

  function handleLogout() {
    stopPolling();
    adminCreds = { email: '', password: '' };
    sessionStorage.removeItem('quizblitz_admin');
    els.emailInput.value = '';
    els.passwordInput.value = '';
    var btnText = els.btnLogin.querySelector('.btn-text');
    btnText.textContent = 'Login';
    els.btnLogin.querySelector('.btn-loader').hidden = true;
    els.btnLogin.disabled = false;
    els.loginError.hidden = true;
    showScreen('login');
  }

  // ========== POLLING ==========
  function startPolling() {
    fetchDashboard();
    pollTimer = setInterval(fetchDashboard, POLL_INTERVAL);
  }

  function stopPolling() {
    clearInterval(pollTimer);
    pollTimer = null;
  }

  function fetchDashboard() {
    apiCall({
      action: 'getAdminDashboard',
      adminEmail: adminCreds.email,
      adminPassword: adminCreds.password
    })
      .then(function (data) {
        lastFetchTime = Date.now();
        renderDashboard(data);
      })
      .catch(function (err) {
        if (err.message === 'Unauthorized') {
          handleLogout();
        }
      });
  }

  // ========== RENDER ==========
  function renderDashboard(data) {
    // Stats
    animateNumber(els.statRegistered, data.stats.registered);
    animateNumber(els.statActive, data.stats.inProgress);
    animateNumber(els.statCompleted, data.stats.completed);

    // Last updated
    els.lastUpdated.textContent = 'Updated just now';

    // Question stats
    renderQuestionStats(data.questionStats);

    // Recent activity
    renderRecentActivity(data.recentActivity);

    // Leaderboard
    renderLeaderboard(data.leaderboard);

    prevData = data;
  }

  // ========== QUESTION STATS ==========
  function renderQuestionStats(stats) {
    if (!stats || stats.length === 0) {
      els.qStatsList.innerHTML = '<p class="panel-empty">Waiting for responses...</p>';
      return;
    }

    var html = '';
    stats.forEach(function (qs) {
      var accClass = qs.accuracy >= 70 ? 'high' : qs.accuracy >= 40 ? 'mid' : 'low';
      var barWidth = qs.answered > 0 ? Math.max(2, (qs.answered / qs.totalParticipants) * 100) : 0;

      html += '<div class="q-stat-row">' +
        '<div class="q-stat-num">Q' + qs.q + '</div>' +
        '<div class="q-stat-bar-wrap">' +
        '<div class="q-stat-text">' + escapeHtml(qs.questionText) + '…</div>' +
        '<div class="q-stat-bar"><div class="q-stat-bar-fill ' + accClass + '" style="width:' + barWidth + '%"></div></div>' +
        '</div>' +
        '<div class="q-stat-info">' +
        '<span class="q-stat-pct ' + accClass + '">' + qs.accuracy + '%</span>' +
        '<span class="q-stat-count">' + qs.answered + '/' + qs.totalParticipants + ' · ' + qs.avgTime + 's</span>' +
        '</div>' +
        '</div>';
    });

    els.qStatsList.innerHTML = html;
  }

  // ========== RECENT ACTIVITY ==========
  function renderRecentActivity(recent) {
    if (!recent || recent.length === 0) {
      els.recentActivity.innerHTML = '<p class="panel-empty">No activity yet...</p>';
      return;
    }

    var html = '';
    recent.forEach(function (r) {
      var icon = r.isCorrect ? '✅' : '❌';
      html += '<div class="recent-item">' +
        '<span class="recent-icon">' + icon + '</span>' +
        '<span class="recent-text"><strong>' + escapeHtml(r.name) + '</strong> answered Q' + r.q + ' (' + r.timeTaken + 's)</span>' +
        '<span class="recent-time">' + formatTime(r.at) + '</span>' +
        '</div>';
    });

    els.recentActivity.innerHTML = html;
  }

  // ========== LEADERBOARD ==========
  function renderLeaderboard(leaderboard) {
    if (!leaderboard || leaderboard.length === 0) {
      els.lbTableWrap.innerHTML = '<p class="panel-empty">Waiting for participants...</p>';
      els.lbCount.textContent = '';
      return;
    }

    els.lbCount.textContent = leaderboard.length + ' participants';

    var html = '<div class="lb-row lb-row-header">' +
      '<div>#</div>' +
      '<div>Name</div>' +
      '<div>Score</div>' +
      '<div>Time</div>' +
      '<div>Status</div>' +
      '</div>';

    leaderboard.forEach(function (p) {
      var rankClass = '';
      var topClass = '';
      if (p.rank === 1) { rankClass = 'rank-1'; topClass = 'top-1'; }
      else if (p.rank === 2) { rankClass = 'rank-2'; topClass = 'top-2'; }
      else if (p.rank === 3) { rankClass = 'rank-3'; topClass = 'top-3'; }

      var statusHtml = '';
      if (p.isComplete) {
        statusHtml = '<span class="status-done">Done</span>';
      } else if (p.questionsAnswered > 0) {
        statusHtml = '<span class="status-active">Q' + p.questionsAnswered + '</span>';
      } else {
        statusHtml = '<span class="status-waiting">—</span>';
      }

      var rankEmoji = p.rank === 1 ? '🥇' : p.rank === 2 ? '🥈' : p.rank === 3 ? '🥉' : p.rank;

      html += '<div class="lb-row ' + topClass + '">' +
        '<div class="lb-rank-cell ' + rankClass + '">' + rankEmoji + '</div>' +
        '<div class="lb-name-cell">' +
        '<div class="lb-name-val">' + escapeHtml(p.name) + '</div>' +
        '<div class="lb-branch-val">' + escapeHtml(p.branch) + '</div>' +
        '</div>' +
        '<div class="lb-score-cell">' + p.correct + '/' + p.total + '</div>' +
        '<div class="lb-time-cell">' + p.totalTimeDisplay + 's</div>' +
        '<div class="lb-status-cell">' + statusHtml + '</div>' +
        '</div>';
    });

    els.lbTableWrap.innerHTML = html;
  }

  // ========== HELPERS ==========
  function escapeHtml(str) {
    if (!str) return '';
    var div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function animateNumber(el, target) {
    var current = parseInt(el.textContent, 10) || 0;
    if (current === target) return;

    var duration = 400;
    var start = performance.now();

    function step(now) {
      var t = Math.min((now - start) / duration, 1);
      var eased = 1 - Math.pow(1 - t, 3); // easeOutCubic
      el.textContent = Math.round(current + (target - current) * eased);
      if (t < 1) requestAnimationFrame(step);
    }

    requestAnimationFrame(step);
  }

  function formatTime(isoStr) {
    if (!isoStr) return '';
    try {
      var d = new Date(isoStr);
      var now = new Date();
      var diff = Math.round((now - d) / 1000);
      if (diff < 5) return 'just now';
      if (diff < 60) return diff + 's ago';
      if (diff < 3600) return Math.floor(diff / 60) + 'm ago';
      return d.toLocaleTimeString();
    } catch (e) {
      return '';
    }
  }

  // Update "last updated" timer
  setInterval(function () {
    if (lastFetchTime === 0) return;
    var seconds = Math.round((Date.now() - lastFetchTime) / 1000);
    if (seconds < 2) {
      els.lastUpdated.textContent = 'Updated just now';
    } else {
      els.lastUpdated.textContent = 'Updated ' + seconds + 's ago';
    }
  }, 1000);

  // ========== INIT ==========
  function init() {
    els.loginForm.addEventListener('submit', handleLogin);
    els.btnLogout.addEventListener('click', handleLogout);

    // Check for saved session
    var saved = sessionStorage.getItem('quizblitz_admin');
    if (saved) {
      try {
        var creds = JSON.parse(saved);
        if (creds.email && creds.password) {
          adminCreds = creds;
          showScreen('dashboard');
          startPolling();
          return;
        }
      } catch (e) {}
    }

    // Check config
    if (CONFIG.APPS_SCRIPT_URL === 'YOUR_APPS_SCRIPT_WEB_APP_URL_HERE') {
      showLoginError('⚠ Backend not configured. Set APPS_SCRIPT_URL in config.js');
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
