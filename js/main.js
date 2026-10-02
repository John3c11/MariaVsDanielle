// Navigation and startup. Loads last, so everything it starts is already defined.
// Part of the MariaVsDanielle site. All js/ files share one global scope and load in the order listed in index.html.

    setTimeout(loadPlayerDB, 0);

    // ── Offline / instant launch ────────────────────────────────────────────
    function showOfflineNote() {
      var saved = null;
      try { saved = parseInt(localStorage.getItem('mvd-last-online'), 10); } catch (e) {}
      var when = saved ? new Date(saved).toLocaleString([], { weekday: 'short', hour: 'numeric', minute: '2-digit' }) : 'your last visit';
      var lu = document.getElementById('last-updated');
      if (lu) lu.textContent = 'Offline · saved data from ' + when;
      if (document.getElementById('offline-note')) return;
      var note = document.createElement('div');
      note.id = 'offline-note';
      note.textContent = '📡 No connection. Showing saved data from ' + when + '.';
      note.style.cssText = 'position:fixed;left:50%;bottom:calc(16px + env(safe-area-inset-bottom));transform:translateX(-50%);z-index:900;' +
        'background:rgba(17,19,24,0.95);border:1px solid rgba(255,255,255,0.15);color:#F3F4F6;font-size:12px;font-weight:600;' +
        'padding:9px 14px;border-radius:999px;box-shadow:0 10px 30px rgba(0,0,0,0.5);max-width:92vw;text-align:center';
      document.body.appendChild(note);
    }
    window.addEventListener('offline', showOfflineNote);
    if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
      navigator.serviceWorker.register('sw.js').catch(function() {});
      window.addEventListener('online', function() { var n = document.getElementById('offline-note'); if (n) n.remove(); load(); });
    }

    load();
    var ROSTERS_READY = loadRosters();

    function toggleTabMenu(e) {
      e.stopPropagation();
      document.getElementById('tab-menu').classList.toggle('open');
    }
    document.addEventListener('click', function(e) {
      var m = document.getElementById('tab-menu');
      if (m && m.classList.contains('open') && !e.target.closest('.tab-more-wrap')) m.classList.remove('open');
    });

    function switchTab(name) {
      document.querySelectorAll('.tab-btn').forEach(function(b) { b.classList.remove('active'); });
      document.querySelectorAll('.tab-panel').forEach(function(p) { p.classList.remove('active'); });
      document.querySelectorAll('.tab-btn').forEach(function(b) {
        if (b.getAttribute('onclick') === "switchTab('" + name + "')") b.classList.add('active');
      });
      document.getElementById('tab-' + name).classList.add('active');
      // "More" shows which hidden tab you're on
      var extra = { crowd: 'Crowd', schedule: 'Schedule', money: 'Money', legacy: 'Legacy', bethistory: 'Bet History', rosters: 'Roster' }[name];
      var more = document.getElementById('tab-more');
      if (more) {
        more.innerHTML = (extra || 'More') + ' <span class="tab-caret">▾</span>';
        more.classList.toggle('active', !!extra);
      }
      var menu = document.getElementById('tab-menu');
      if (menu) menu.classList.remove('open');
      if (name === 'legacy') loadLegacyTab();
      if (name === 'money') loadMoneyTab();
      if (name === 'analytics') loadAnalyticsTab();
      if (name === 'bethistory') loadBetHistoryTab();
      if (name === 'submit') loadSubmitTab();
      if (name === 'chat') loadChatTab(); else stopChatRefresh();
      if (name === 'profiles') loadProfilesTab();
      if (name === 'schedule') loadScheduleTab();
      if (name === 'crowd') loadCrowdTab();
    }



    // ── Holiday theme extras ────────────────────────────────────────────────
    (function() {
      var THEMES = {
        halloween:    { label: '🎃 Spooky Season', fx: ['🦇', '🍂', '🦇'], n: 10 },
        thanksgiving: { label: '🦃 Happy Thanksgiving', fx: ['🍂', '🍁', '🍂'], n: 12 },
        christmas:    { label: '🎄 Merry Christmas', fx: ['❄', '❄', '❅'], n: 16, snow: true },
        playoffs:     { label: '🏆 Playoff Time', fx: ['✦', '✧'], n: 12 },
      };
      var th = THEMES[window.HOLIDAY_THEME];
      if (!th) return;
      var nav = document.querySelector('.tabs-nav');
      nav.insertAdjacentHTML('afterend', '<div class="holiday-pill">' + th.label + '</div>');
      var card = document.getElementById('sb-main');
      var fx = document.createElement('div');
      fx.className = 'holiday-fx';
      for (var i = 0; i < th.n; i++) {
        var sp = document.createElement('span');
        sp.textContent = th.fx[i % th.fx.length];
        sp.style.left = (Math.random() * 100) + '%';
        sp.style.fontSize = (th.snow ? 8 + Math.random() * 10 : 12 + Math.random() * 10) + 'px';
        sp.style.animationDuration = (14 + Math.random() * 16) + 's';
        sp.style.animationDelay = (-Math.random() * 30) + 's';
        sp.style.setProperty('--drift', (Math.random() * 80 - 40) + 'px');
        sp.style.setProperty('--spin', th.snow ? '0deg' : (Math.random() * 360 - 180) + 'deg');
        if (th.snow) sp.style.color = '#FFFFFF';
        if (window.HOLIDAY_THEME === 'playoffs') sp.style.color = '#FCD34D';
        fx.appendChild(sp);
      }
      card.insertBefore(fx, card.firstChild);
    })();
