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
    loadAnnouncement();
    checkChatUnread();
    setInterval(function() { if (document.visibilityState === 'visible') checkChatUnread(); }, 120000);
    var ROSTERS_READY = loadRosters();

    function toggleTabMenu(e) {
      e.stopPropagation();
      document.getElementById('tab-menu').classList.toggle('open');
    }
    document.addEventListener('click', function(e) {
      var m = document.getElementById('tab-menu');
      if (m && m.classList.contains('open') && !e.target.closest('.tab-more-wrap')) m.classList.remove('open');
    });

    // The Log In tab shows who's logged in
    function setLoginTab() {
      var b = document.getElementById('tab-login');
      if (!b) return;
      b.textContent = !SUB.pin ? 'Log In' : SUB.role === 'admin' ? 'Admin' : (SUB.name || 'Me');
      b.setAttribute('data-ic', SUB.role === 'admin' ? '🔧' : '👤');
      if (SUB.pin) b.setAttribute('data-in', '1'); else b.removeAttribute('data-in'); // desktop shows the icon once logged in
    }

    function switchTab(name) {
      if (name === 'money') name = 'legacy'; // Earnings now lives inside All-Time
      var cur = document.querySelector('.tab-panel.active');
      if (cur && cur.id !== 'tab-' + name) window.scrollTo(0, 0); // new tab starts at the top (the phone bar sits at the bottom)
      document.querySelectorAll('.tab-btn').forEach(function(b) { b.classList.remove('active'); });
      document.querySelectorAll('.tab-panel').forEach(function(p) { p.classList.remove('active'); });
      document.querySelectorAll('.tab-btn').forEach(function(b) {
        if (b.getAttribute('onclick') === "switchTab('" + name + "')") b.classList.add('active');
      });
      document.getElementById('tab-' + name).classList.add('active');
      // "More" shows which hidden tab you're on
      var extra = { crowd: 'Crowd', schedule: 'Schedule', legacy: 'All-Time', museum: 'Museum', bracket: 'Bracket', machine: 'Machine', bethistory: 'Bet Log', rosters: 'Rosters' }[name];
      if (name === 'analytics' && window.matchMedia('(max-width: 700px)').matches) extra = 'Analytics';
      var more = document.getElementById('tab-more');
      if (more) {
        more.innerHTML = (extra || 'More') + ' <span class="tab-caret">▾</span>';
        more.classList.toggle('active', !!extra);
      }
      var menu = document.getElementById('tab-menu');
      if (menu) menu.classList.remove('open');
      if (name === 'legacy') loadLegacyTab();
      if (name === 'analytics') openAnalytics(); // loads js/analytics.js the first time
      if (name === 'bethistory') loadBetHistoryTab();
      if (name === 'submit') loadSubmitTab();
      if (name === 'chat') loadChatTab(); else stopChatRefresh();
      if (name === 'profiles') loadProfilesTab();
      if (name === 'schedule') loadScheduleTab();
      if (name === 'crowd') loadCrowdTab();
      if (name === 'rosters') setupPlayerSearch();
      if (name === 'museum') openMuseum();
      if (name === 'bracket') openBracket();
      if (name === 'machine') loadScriptOnce('js/machine.js').then(function() { loadMachineTab(); }).catch(function() {
        var el = document.getElementById('machine-content'); if (el) el.innerHTML = '<div class="loading">Couldn\'t load the Machine. Check your connection.</div>';
      });
    }
    // ⏪ Replay one past game (or a whole week) on the Game Day screen (js/replay.js)
    function replayGame(year, week, game) {
      loadScriptOnce('js/replay.js').then(function() { openReplay(year, week, game); }).catch(function() { alert('Couldn\'t load Replay. Check your connection.'); });
    }
    // 🏆 Playoff Bracket Challenge (js/bracket.js, loaded the first time it opens)
    function openBracket() {
      loadScriptOnce('js/bracket.js').then(function() { loadBracketTab(true); }).catch(function() {
        var el = document.getElementById('bracket-content');
        if (el) el.innerHTML = '<div class="loading">Couldn\'t load the bracket. Check your connection. <button class="link-btn" onclick="openBracket()">Try again</button></div>';
      });
    }
    // The 🏆 Bracket menu item, Log In shortcut and Stats banner only exist while the challenge is on
    var BRACKET_ON = null; // { state, lockAt } from the script, or null
    function setBracketState(b) {
      BRACKET_ON = b && b.state && b.state !== 'off' ? b : null;
      var mi = document.getElementById('menu-bracket');
      if (mi) mi.style.display = BRACKET_ON ? '' : 'none';
      var bn = document.getElementById('br-banner');
      if (!bn) return;
      var closed = ''; try { closed = localStorage.getItem('mvd-br-banner') || ''; } catch (e) {}
      if (!BRACKET_ON || BRACKET_ON.state !== 'open' || closed === CURRENT_YEAR) { bn.style.display = 'none'; return; }
      var when = BRACKET_ON.lockAt ? new Date(BRACKET_ON.lockAt).toLocaleString([], { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '';
      bn.innerHTML = '<span>🏆 <b>The Playoff Bracket Challenge is open.</b> Pick every playoff winner and first TD' + (when ? ' before ' + when : ' before Wild Card kickoff') + '.</span>' +
        '<span style="white-space:nowrap"><button class="adm-btn" onclick="switchTab(\'bracket\')">Fill mine out</button> <button class="vb-x" aria-label="Dismiss">✕</button></span>';
      bn.style.display = '';
      bn.querySelector('.vb-x').addEventListener('click', function() { try { localStorage.setItem('mvd-br-banner', CURRENT_YEAR); } catch (e) {} bn.style.display = 'none'; });
    }
    // 🏛️ The Museum (js/museum.js, loaded the first time it opens)
    function openMuseum() {
      loadScriptOnce('js/museum.js').then(function() { loadMuseumTab(); }).catch(function() {
        var el = document.getElementById('museum-content');
        if (el) el.innerHTML = '<div class="loading">Couldn\'t open the Museum. Check your connection. <button class="link-btn" onclick="openMuseum()">Try again</button></div>';
      });
    }



    // ── Holiday theme extras ────────────────────────────────────────────────
    (function() {
      var THEMES = {
        halloween:    { label: '🎃 Spooky Season', fx: ['🦇', '🍂', '🦇'], n: 10 },
        thanksgiving: { label: '🦃 Happy Thanksgiving', fx: ['🍂', '🍁', '🍂'], n: 12 },
        christmas:    { label: '🎄 Merry Christmas', fx: ['❄', '❄', '❅'], n: 16, snow: true },
        playoffs:     { label: '🏆 Playoff Time', fx: ['✦', '✧'], n: 12 },
        superbowl:    { label: '🏈 Super Bowl Week', fx: ['🏈', '✦', '✧'], n: 12 },
        jewish:       { label: '✡️ Shalom', fx: ['✡', '🕎', '✡', '✦'], n: 14, tint: '#93C5FD' },
      };
      // Admin forced a theme on this device: show a small reminder with a reset button
      if (window.HOLIDAY_FORCED) {
        var chip = document.createElement('button');
        chip.className = 'theme-chip';
        chip.textContent = '🎨 Theme preview: ' + (window.HOLIDAY_THEME || 'off') + ' · tap to reset';
        chip.addEventListener('click', function() { try { localStorage.removeItem('mvd-theme-force'); } catch (e) {} location.reload(); });
        document.body.appendChild(chip);
      }
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
        if (th.tint && sp.textContent === '✡') sp.style.color = th.tint;
        fx.appendChild(sp);
      }
      card.insertBefore(fx, card.firstChild);
    })();

    // Phones: hide the bottom tab bar while typing, so it doesn't ride up on top of the keyboard
    document.addEventListener('focusin', function(e) { if (e.target.matches && e.target.matches('input, textarea')) document.body.classList.add('kb-open'); });
    document.addEventListener('focusout', function() { document.body.classList.remove('kb-open'); });

    // 🥚 Hidden extras, loaded once the page has settled
    setTimeout(function() { loadScriptOnce('js/eggs.js').catch(function() {}); }, 2500);
    // 🤖 The Machine's line under the scoreboard (only games that have kicked off)
    setTimeout(function() { if (PICKS_URL) loadScriptOnce('js/machine.js').then(function() { renderMachineLine(); }).catch(function() {}); }, 3000);
