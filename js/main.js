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

    // ── The 5 hubs and their sub-tabs ──────────────────────────────────────
    // Each tab panel (#tab-<name>) belongs to one hub. Tapping a hub opens the sub-tab you last used there.
    var HUBS = {
      home:    [['stats', 'Home']],
      picks:   [['submit', ''], ['schedule', '🗓️ Schedule'], ['rosters', '📋 Rosters'], ['crowd', '🏅 Crowd'], ['bracket', '🏆 Bracket']],
      rivalry: [['profiles', '⭐ Profiles'], ['legacy', '📜 All-Time'], ['bethistory', '🧾 Bet Log'], ['museum', '🏛️ Museum'], ['game', '🏈 Games']],
      numbers: [['analytics', '📊 Numbers'], ['machine', '🤖 Machine']], // 📊 Numbers = Stories (analytics) + Explore (lab), v134
      chat:    [['chat', 'Trash Talk']],
    };
    var HUB_OF = {}, HUB_LAST = {};
    Object.keys(HUBS).forEach(function(h) { HUBS[h].forEach(function(t) { HUB_OF[t[0]] = h; }); });
    HUB_OF.lab = 'numbers'; // 🧪 Explore: the second half of 📊 Numbers
    function hubTabs(h) { return HUBS[h].filter(function(t) { return t[0] !== 'bracket' || BRACKET_ON; }); }
    function openHub(h) {
      var last = HUB_LAST[h];
      if (!last || (last !== 'lab' && !hubTabs(h).some(function(t) { return t[0] === last; }))) last = h === 'picks' ? (SUB.pin ? 'submit' : 'schedule') : hubTabs(h)[0][0];
      switchTab(last);
    }
    function loginLabel() { return !SUB.pin ? '👤 Log In' : SUB.role === 'admin' ? '🔧 Admin' : '✍️ My Picks'; }
    function drawHubSub(name) {
      var el = document.getElementById('hub-sub'), h = HUB_OF[name];
      if (!el) return;
      var tabs = h ? hubTabs(h) : [];
      document.body.classList.toggle('has-sub', tabs.length >= 2);
      if (tabs.length < 2) { el.style.display = 'none'; el.innerHTML = ''; return; }
      var mini = document.getElementById('acct-mini');
      el.innerHTML = '<div class="hub-sub-row">' + tabs.map(function(t) {
        return '<button class="hub-sub-btn' + (t[0] === name || (name === 'lab' && t[0] === 'analytics') ? ' on' : '') + '" onclick="switchTab(\'' + t[0] + '\')">' + (t[0] === 'submit' ? loginLabel() : t[1]) + '</button>';
      }).join('') + '</div>' + (h !== 'picks' ? '<button class="hub-acct" onclick="switchTab(\'submit\')" aria-label="' + (mini ? mini.getAttribute('aria-label') : 'Log in') + '">' + (mini ? mini.textContent.split(' ')[0] : '👤') + '</button>' : '');
      el.style.display = '';
      var row = el.querySelector('.hub-sub-row'), on = el.querySelector('.on');
      if (on && on.offsetLeft - row.offsetLeft + on.offsetWidth > row.clientWidth) row.scrollLeft = Math.max(0, on.offsetLeft - row.offsetLeft - 16); // only if it's off-screen
    }

    // ── Tabs whose code loads the first time they open (v133): Profiles, All-Time, Bet Log, Schedule ──
    // These stand-ins load the real file, which replaces them, then run the real one.
    var PROFILE_WHO = 'Maria', PROFILE_TAB_NEXT = '';
    function openProfile(name, tab) { PROFILE_WHO = name; PROFILE_TAB_NEXT = tab || ''; switchTab('profiles'); } // tab: 'seasons', 'cards'…
    function lazyTab(file, elId, again) {
      loadScriptOnce(file).then(again).catch(function() {
        var el = document.getElementById(elId);
        if (el) el.innerHTML = '<div class="loading">Couldn\'t load this page. Check your connection. <button class="link-btn" onclick="switchTab(\'' + elId.replace('-content', '') + '\')">Try again</button></div>';
      });
    }
    function loadProfilesTab() { lazyTab('js/profiles.js', 'profiles-content', function() { loadProfilesTab(); }); }
    function loadLegacyTab() { lazyTab('js/history.js', 'legacy-content', function() { loadLegacyTab(); }); }
    function loadBetHistoryTab() { lazyTab('js/history.js', 'bethistory-content', function() { loadBetHistoryTab(); }); }
    function loadScheduleTab() { lazyTab('js/schedule.js', 'schedule-content', function() { loadScheduleTab(); }); }

    // ── 🌗 Light / dark (v140) ──────────────────────────────────────────────
    // The head of index.html applies the saved choice before the page draws; this switches it live.
    function lookPick() { try { return localStorage.getItem('mvd-look') || 'dark'; } catch (e) { return 'dark'; } }
    function lookApply() {
      var pick = lookPick(), mq = window.matchMedia && matchMedia('(prefers-color-scheme: light)');
      var light = pick === 'light' || (pick === 'auto' && mq && mq.matches);
      document.documentElement.setAttribute('data-theme', light ? 'light' : 'dark');
      var link = document.getElementById('light-css');
      if (light && !link) {
        var me = document.querySelector('link[href*="style.css"]'), v = me && /[?&]v=(\d+)/.exec(me.getAttribute('href'));
        link = document.createElement('link'); link.rel = 'stylesheet'; link.id = 'light-css'; link.href = 'light.css' + (v ? '?v=' + v[1] : '');
        document.head.appendChild(link);
      }
      if (link) link.disabled = !light;
      if (typeof CSS_LOADS !== 'undefined') Object.keys(CSS_LOADS).forEach(function(n) { if (light) loadLightCss(n); else if (LIGHT_CSS[n]) LIGHT_CSS[n].disabled = true; });
      var meta = document.querySelector('meta[name="theme-color"]'); if (meta) meta.setAttribute('content', light ? '#F4F5F7' : '#08090C');
      document.querySelectorAll('[data-look]').forEach(function(b) { b.classList.toggle('on', b.getAttribute('data-look') === pick); });
    }
    function setLook(v) { try { localStorage.setItem('mvd-look', v); } catch (e) {} lookApply(); }
    lookApply();
    if (window.matchMedia) { var LOOK_MQ = matchMedia('(prefers-color-scheme: light)'); if (LOOK_MQ.addEventListener) LOOK_MQ.addEventListener('change', function() { if (lookPick() === 'auto') lookApply(); }); }

    // The Log In tab shows who's logged in
    function setLoginTab() {
      var b = document.getElementById('tab-login'), m = document.getElementById('acct-mini');
      var txt = !SUB.pin ? 'Log In' : SUB.role === 'admin' ? 'Admin' : (SUB.name || 'Me'), ic = SUB.role === 'admin' ? '🔧' : '👤';
      if (b) {
        b.textContent = txt; b.setAttribute('data-ic', ic);
        if (SUB.pin) b.setAttribute('data-in', '1'); else b.removeAttribute('data-in'); // desktop shows the icon once logged in
      }
      if (m) { m.textContent = SUB.pin ? ic + ' ' + txt : '👤'; m.classList.toggle('in', !!SUB.pin); m.setAttribute('aria-label', SUB.pin ? txt : 'Log in'); }
      var cur = document.querySelector('.tab-panel.active');
      if (cur) drawHubSub(cur.id.replace('tab-', ''));
    }
    function switchTab(name) {
      if (name === 'money') name = 'legacy'; // Earnings now lives inside All-Time
      var cur = document.querySelector('.tab-panel.active');
      if (cur && cur.id !== 'tab-' + name) window.scrollTo(0, 0); // new tab starts at the top (the phone bar sits at the bottom)
      document.querySelectorAll('.tab-panel').forEach(function(p) { p.classList.remove('active'); });
      document.getElementById('tab-' + name).classList.add('active');
      var hub = HUB_OF[name] || 'home';
      HUB_LAST[hub] = name;
      document.querySelectorAll('.tabs-nav [data-hub]').forEach(function(b) { b.classList.toggle('active', b.getAttribute('data-hub') === hub); });
      var lg = document.getElementById('tab-login');
      if (lg) lg.classList.toggle('active', name === 'submit');
      drawHubSub(name);
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
      if (name === 'lab') openLab();
      if (name === 'game') openGamesTab();
      // A shared #lab?… link only stays in the address bar while the Lab is open (#game/… belongs to the game overlay)
      if ((location.hash || '').indexOf('#lab') === 0 && name !== 'lab') { try { history.replaceState(null, '', location.pathname + location.search); } catch (e) {} }
      if (name === 'bracket') openBracket();
      if (name === 'machine') loadScriptOnce('js/machine.js').then(function() { loadMachineTab(); }).catch(function() {
        var el = document.getElementById('machine-content'); if (el) el.innerHTML = '<div class="loading">Couldn\'t load the Machine. Check your connection.</div>';
      });
    }
    // The 🏆 Bracket menu item, Log In shortcut and Stats banner only exist while the challenge is on
    var BRACKET_ON = null; // { state, lockAt } from the script, or null
    function setBracketState(b) {
      BRACKET_ON = b && b.state && b.state !== 'off' ? b : null;
      var cur = document.querySelector('.tab-panel.active');
      if (cur) drawHubSub(cur.id.replace('tab-', '')); // the 🏆 Bracket sub-tab under Picks
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
    // 🧪 Stat Lab (js/lab.js, loaded the first time it opens). A shared link (#lab?…) opens straight to it.
    function openLab() {
      loadScriptOnce('js/lab.js').then(function() { loadLabTab(); }).catch(function() {
        var el = document.getElementById('lab-content');
        if (el) el.innerHTML = '<div class="loading">Couldn\'t open Explore. Check your connection. <button class="link-btn" onclick="openLab()">Try again</button></div>';
      });
    }
    if ((location.hash || '').indexOf('#lab') === 0) setTimeout(function() { switchTab('lab'); }, 0);
    if ((location.hash || '').indexOf('#join') === 0) setTimeout(function() { switchTab('submit'); }, 0); // 📨 invite link
    // Open Analytics on one of its sub-tabs (Profiles' Bad Beats / Jinxes tiles -> 😬 Pain)
    function openAnalyticsPane(pane) {
      try { localStorage.setItem('mvd-an-tab', pane); } catch (e) {}
      switchTab('analytics');
      var tries = 0;
      (function go() { var b = document.querySelector('[data-an-tab="' + pane + '"]'); if (b) b.click(); else if (++tries < 40) setTimeout(go, 150); })();
    }
    // 🏈 Games (js/gamepage.js): the Rivalry hub's list of every game, and each game's full-screen page at #game/2026-14
    function openGame(year, game) {
      loadScriptOnce('js/gamepage.js').then(function() { gpOpen(String(year), String(game)); }).catch(function() { alert('Couldn\'t open the game. Check your connection.'); });
    }
    function openGamesTab() {
      loadScriptOnce('js/gamepage.js').then(function() { renderGamesList(); }).catch(function() {
        var el = document.getElementById('game-content');
        if (el) el.innerHTML = '<div class="loading">Couldn\'t load the games. Check your connection. <button class="link-btn" onclick="openGamesTab()">Try again</button></div>';
      });
    }
    // Any game, anywhere: <span ' + gameLinkAttr(year, game) + '>…</span> opens its Game Page
    function gameLinkAttr(year, game) { return 'role="link" tabindex="0" class="game-link" onclick="event.stopPropagation();openGame(\'' + year + '\',\'' + String(game).replace(/[^0-9A-Za-z]/g, '') + '\')"'; }
    (function() {
      var m = /^#game\/(\d{4})-([0-9A-Za-z]+)/.exec(location.hash || '');
      if (m) setTimeout(function() { switchTab('game'); openGame(m[1], m[2]); }, 0);
    })();

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
    setTimeout(function() { if (PICKS_URL) renderCrowdLine(); }, 3200); // 🏅 the Crowd vs Maria & Danielle (js/crowd.js)
    // Open the 🧪 Stat Lab on a question, e.g. openLabQuery('split=pos') (used by Analytics' Splits buttons)
    function openLabQuery(qs) {
      try { history.replaceState(null, '', location.pathname + location.search + '#lab?' + qs); } catch (e) {}
      if (typeof LAB !== 'undefined') LAB.q = null;
      switchTab('lab');
    }
