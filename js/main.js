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
      picks:   [['submit', ''], ['schedule', '🗓️ Schedule'], ['rosters', '📋 Rosters'], ['crowd', '🏅 Crowd'], ['futures', '🔮 Futures'], ['bracket', '🏆 Bracket']],
      rivalry: [['profiles', '⭐ Profiles'], ['weekly', '🗞️ The Weekly'], ['legacy', '📜 All-Time'], ['bethistory', '🧾 Bet Log'], ['museum', '🏛️ Museum'], ['game', '🏈 Games']],
      numbers: [['analytics', '📊 Numbers'], ['machine', '🤖 Machine']], // 📊 Numbers = Stories (analytics) + Explore (lab), v134
      chat:    [['chat', 'Trash Talk']],
    };
    var HUB_OF = {}, HUB_LAST = {};
    Object.keys(HUBS).forEach(function(h) { HUBS[h].forEach(function(t) { HUB_OF[t[0]] = h; }); });
    HUB_OF.lab = 'numbers'; // 🧪 Explore: the second half of 📊 Numbers
    function hubTabs(h) { return HUBS[h].filter(function(t) { return (t[0] !== 'bracket' || BRACKET_ON) && (t[0] !== 'futures' || FUTURES_ON); }); }
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
      }).join('') + '</div>' + '<button class="hub-acct hub-look" onclick="openLook()" aria-label="Display settings">⚙️</button>' + (h !== 'picks' ? '<button class="hub-acct" onclick="switchTab(\'submit\')" aria-label="' + (mini ? mini.getAttribute('aria-label') : 'Log in') + '">' + (mini ? mini.textContent.split(' ')[0] : '👤') + '</button>' : '');
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
      if (typeof lookComfort === 'function') lookComfort();
    }
    function setLook(v) { try { localStorage.setItem('mvd-look', v); } catch (e) {} lookApply(); lookPanelDraw(); }
    // ⚙️ Display panel (v141): light/dark, text size, less motion. All saved on this phone only.
    function lookGet(k, d) { try { return localStorage.getItem(k) || d; } catch (e) { return d; } }
    function lookSet(k, v) { try { if (v) localStorage.setItem(k, v); else localStorage.removeItem(k); } catch (e) {} }
    function lookComfort() {
      var t = lookGet('mvd-text', ''), m = lookGet('mvd-motion', ''), root = document.documentElement;
      if (t === 'lg' || t === 'xl') root.setAttribute('data-text', t); else root.removeAttribute('data-text');
      var less = m ? m === 'less' : !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
      if (less) root.setAttribute('data-motion', 'less'); else root.removeAttribute('data-motion');
      var f = document.getElementById('look-foot');
      if (f) f.textContent = '⚙️ Display · ' + ({ dark: 'Dark', light: 'Light', auto: 'Auto' })[lookPick()] + (t === 'lg' ? ' · Large text' : t === 'xl' ? ' · Larger text' : '') + (less ? ' · Less motion' : '');
    }
    function setComfort(k, v) { lookSet(k, v); lookComfort(); lookPanelDraw(); }
    function openLook() {
      var bd = document.getElementById('lk-back');
      if (!bd) {
        bd = document.createElement('div'); bd.id = 'lk-back'; bd.className = 'lk-back';
        bd.innerHTML = '<div class="lk-card" role="dialog" aria-label="Display"><div class="lk-top"><b>⚙️ Display</b><button class="lk-x" aria-label="Close">✕</button></div><div id="lk-body"></div><div class="lk-note">Saved on this phone only.</div></div>';
        document.body.appendChild(bd);
        bd.addEventListener('click', function(e) { if (e.target === bd || e.target.closest('.lk-x')) bd.classList.remove('open'); });
        document.addEventListener('keydown', function(e) { if (e.key === 'Escape') bd.classList.remove('open'); });
      }
      lookPanelDraw(); bd.classList.add('open');
    }
    function lookPanelDraw() {
      var el = document.getElementById('lk-body'); if (!el) return;
      var m = lookGet('mvd-motion', ''), osLess = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
      function seg(title, sub, opts, cur, fn) {
        return '<div class="lk-g"><div class="lk-h">' + title + (sub ? ' <small>' + sub + '</small>' : '') + '</div><div class="lk-seg">' + opts.map(function(o) {
          return '<button class="' + (o[0] === cur ? 'on' : '') + '" onclick="' + fn + '(\'' + o[0] + '\')">' + o[1] + '</button>';
        }).join('') + '</div></div>';
      }
      el.innerHTML = seg('🌗 Theme', 'Auto follows your phone', [['dark', 'Dark'], ['light', 'Light'], ['auto', 'Auto']], lookPick(), 'setLook') +
        seg('🔠 Text size', '', [['', 'Normal'], ['lg', 'Large'], ['xl', 'Larger']], lookGet('mvd-text', ''), 'setTextSize') +
        seg('🎞️ Less motion', 'no confetti, falling snow or card flips', [['', 'Like my phone (' + (osLess ? 'on' : 'off') + ')'], ['less', 'On'], ['full', 'Off']], m, 'setMotion');
    }
    function setTextSize(v) { setComfort('mvd-text', v); }
    function setMotion(v) { setComfort('mvd-motion', v); }
    lookComfort();
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
      if (name === 'futures') openFutures();
      if (name === 'weekly') loadScriptOnce('js/weekly.js').then(function() { loadWeeklyTab(); }).catch(function() { var el = document.getElementById('weekly-content'); if (el) el.innerHTML = '<div class="loading">Couldn\'t load The Weekly. Check your connection.</div>'; });
      if (name === 'patch') loadScriptOnce('js/patchnotes.js').then(function() { openPatchNotesTab(); }).catch(function() {});
      if ((location.hash || '').indexOf('#weekly') === 0 && name !== 'weekly') { try { history.replaceState(null, '', location.pathname + location.search); } catch (e) {} }
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
    // 🔮 Futures (js/futures.js): the Picks hub's 🔮 tab and the card on Home, only while Futures are on (v149)
    var FUTURES_ON = null; // { state: open | locked | final, lockAt, label } from the script, or null
    function openFutures() {
      loadScriptOnce('js/futures.js').then(function() { loadFuturesTab(); }).catch(function() {
        var el = document.getElementById('futures-content');
        if (el) el.innerHTML = '<div class="loading">Couldn\'t load Futures. Check your connection. <button class="link-btn" onclick="openFutures()">Try again</button></div>';
      });
    }
    function setFuturesState(f) {
      FUTURES_ON = f && f.state ? f : null;
      var cur = document.querySelector('.tab-panel.active');
      if (cur) drawHubSub(cur.id.replace('tab-', ''));
      var el = document.getElementById('fut-home');
      if (!el) return;
      if (!FUTURES_ON) { el.style.display = 'none'; el.innerHTML = ''; return; }
      loadScriptOnce('js/futures.js').then(function() { drawFuturesHome(el); }).catch(function() {});
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
        if (window.HOLIDAY_THEME === 'playoffs') sp.style.color = 'var(--warn)';
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

    // ── ⏳ Time Machine (v142): the whole site the way it looked right after any week ──
    // core.js (ASOF) leaves out everything after that week; js/timemachine.js is the picker.
    function openTimeMachine() {
      loadScriptOnce('js/timemachine.js').then(function() { tmOpen(); }).catch(function() { alert('Couldn\'t open the Time Machine. Check your connection.'); });
    }
    function tmStep(d) { loadScriptOnce('js/timemachine.js').then(function() { tmStepGo(d); }).catch(function() {}); }
    function tmShare(btn) { shareUrl(btn, location.origin + location.pathname + '?asof=' + ASOF.year + '-w' + ASOF.week, 'Maria vs Danielle, ' + asofLabel()); }
    (function() {
      // Going to a week (or back to now) brings you back to the page you were on
      var t = ''; try { t = sessionStorage.getItem('mvd-tm-tab') || ''; sessionStorage.removeItem('mvd-tm-tab'); } catch (e) {}
      if (t && t !== 'stats' && t !== 'submit' && /^[a-z]+$/.test(t) && document.getElementById('tab-' + t) && !location.hash) setTimeout(function() { switchTab(t); }, 0);
      if (!ASOF) return;
      var when = new Date(asofEnd()).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
      var card = document.createElement('div');
      card.className = 'tm-bar'; card.id = 'tm-bar';
      function both(full, short) { return '<span class="tn-full">' + full + '</span><span class="tn-short">' + short + '</span>'; }
      card.innerHTML = '<div class="tm-bar-t"><span class="tm-kick">⏳ Time Machine</span> The site the way it looked after <b>' + asofLabel() + '</b> <small>(' + when + ')</small>.<span class="tm-long"> Nothing after that shows, and nothing can be changed.</span></div>' +
        '<div class="tm-btns"><button class="tm-b" onclick="tmStep(-1)">‹ Earlier</button><button class="tm-b" onclick="tmStep(1)">Later ›</button>' +
        '<button class="tm-b" onclick="openTimeMachine()" aria-label="Pick a week">' + both('📅 Pick a week', '📅') + '</button><button class="tm-b" onclick="tmShare(this)" aria-label="Share">' + both('🔗 Share', '🔗') + '</button>' +
        '<button class="tm-b tm-now" onclick="asofGo()">' + both('✕ Back to now', '✕ Now') + '</button></div>';
      var hs = document.getElementById('hub-sub');
      hs.parentNode.insertBefore(card, hs.nextSibling);
      // Always on screen: a small pill (tap = pick a week, ✕ = back to now)
      var pill = document.createElement('div');
      pill.className = 'tm-pill';
      pill.innerHTML = '<button class="tm-pill-a" onclick="openTimeMachine()">⏳ ' + asofLabel(true) + '</button><button class="tm-pill-x" onclick="asofGo()" aria-label="Back to now">✕</button>';
      document.body.appendChild(pill);
      document.getElementById('tm-foot').textContent = '⏳ Back to now';
      document.getElementById('tm-foot').setAttribute('onclick', 'asofGo()');
    })();

    // ── 🗞️ The Weekly, 🎬 Highlight Reels and 📜 Patch Notes (v150) ─────────────────
    function openWeekly(year, week) {
      loadScriptOnce('js/weekly.js').then(function() { WK.view = year ? { year: String(year), week: week || 0 } : null; switchTab('weekly'); }).catch(function() {});
    }
    function openReel(year, week) {
      loadScriptOnce('js/weekly.js').then(function() { return loadScriptOnce('js/reels.js'); }).then(function() { startReel(String(year), week || 0); })
        .catch(function() { alert('Couldn\'t load the reel. Check your connection.'); });
    }
    function openPatchNotes() { switchTab('patch'); }
    if ((location.hash || '').indexOf('#weekly') === 0) setTimeout(function() { switchTab('weekly'); }, 0);
    if ((location.hash || '').indexOf('#patch') === 0) setTimeout(function() { switchTab('patch'); }, 0);
    // 🔴 A new issue of The Weekly: a dot on Rivalry and a card on Home until it's read
    setTimeout(function() { loadScriptOnce('js/weekly.js').then(function() { return wkLight(); }).then(function(D) { wkBadge(D); }).catch(function() {}); }, 3500);

    // ── 🎉 The v150 reveal: once per phone ──
    (function() {
      var seen = ''; try { seen = localStorage.getItem('mvd-v150') || ''; } catch (e) {}
      if (seen || ASOF || /#(weekly|player|game|lab|join|patch)/.test(location.hash || '')) return;
      setTimeout(function() {
        if (document.querySelector('.pc-backdrop, .lk-back.open, #rl-root, .st-root[style*="flex"]')) return;
        var el = document.createElement('div');
        el.className = 'v150 dk';
        el.innerHTML = '<div class="v150-card"><div class="v150-n">150</div><div class="v150-t">Version 150 is here</div>' +
          '<div class="v150-s">The biggest update yet. A few things to try:</div>' +
          '<button class="v150-f" data-v150="weekly"><b>🗞️ The Weekly</b><span>A magazine issue for every week of every season, back to 2025.</span></button>' +
          '<button class="v150-f" data-v150="reel"><b>🎬 Highlight Reels</b><span>Any week or season as a video you can drop in the group chat.</span></button>' +
          '<button class="v150-f" data-v150="patch"><b>📜 Patch Notes</b><span>How the site got here, all 150 versions.</span></button>' +
          '<button class="v150-go" data-v150="close">Let\'s go</button></div>';
        document.body.appendChild(el);
        try { localStorage.setItem('mvd-v150', '1'); } catch (e) {}
        el.addEventListener('click', function(e) {
          var b = e.target.closest('[data-v150]'), k = b ? b.getAttribute('data-v150') : (e.target === el ? 'close' : '');
          if (!k) return;
          el.remove();
          if (k === 'weekly') openWeekly();
          if (k === 'patch') openPatchNotes();
          if (k === 'reel') openReel(CURRENT_YEAR, 0);
        });
      }, 2500);
    })();
