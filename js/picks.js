// Log In tab: PIN screen, Maria and Danielle picking / changing picks, and friends picking.
// The admin screens live in js/admin.js, loaded only after the admin PIN (see loadAdmin).
// Part of the MariaVsDanielle site. All js/ files share one global scope and load in the order listed in index.html.

    // ── Submit Picks tab ─────────────────────────────────────────────────────
    var PICKS_URL = (typeof CONFIG !== 'undefined' && CONFIG.PICKS_URL) || '';
    var SUB = { pin: '', game: null, homeSel: null, awaySel: null, busy: false };

    function picksApiOnce(params) {
      var qs = Object.keys(params).map(function(k) {
        return encodeURIComponent(k) + '=' + encodeURIComponent(params[k]);
      }).join('&');
      var ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
      var timer = ctrl ? setTimeout(function() { ctrl.abort(); }, 20000) : null;
      return fetch(PICKS_URL + '?' + qs + '&_=' + Date.now(), ctrl ? { signal: ctrl.signal } : {})
        .then(function(r) {
          if (!r.ok) throw new Error('HTTP ' + r.status);
          return r.json();
        })
        .finally(function() { if (timer) clearTimeout(timer); });
    }
    // Google's script servers occasionally drop the reply even though the write went through,
    // so every call gets one quiet retry. Submitting the same picks twice is safe.
    function picksApi(params) {
      return picksApiOnce(params).catch(function() {
        return new Promise(function(res) { setTimeout(res, 1500); })
          .then(function() { return picksApiOnce(params); });
      });
    }


    function loadSubmitTab() {
      if (!SUB.pin) renderPinScreen('');
    }

    function renderPinScreen(msg, successHtml) {
      SUB.pin = ''; SUB.game = null; SUB.mode = 'pick'; SUB.role = '';
      if (typeof setLoginTab === 'function') setLoginTab();
      if (PROFILE_WHO !== 'Maria' && PROFILE_WHO !== 'Danielle') PROFILE_WHO = 'Maria';
      // Logging out also ends a Trash Talk session that came from logging in (unless "Remember me" saved it)
      if (CHAT.session) {
        CHAT.session = false;
        var saved = ''; try { saved = localStorage.getItem('mvd-chat-pin') || ''; } catch (e) {}
        if (!saved) { CHAT.pin = ''; CHAT.name = ''; }
      }
      var el = document.getElementById('submit-content');
      if (!PICKS_URL) {
        el.innerHTML = '<div class="loading">Pick submission isn\'t set up yet (PICKS_URL missing in config.js).</div>';
        return;
      }
      el.innerHTML = (successHtml || '') +
        '<div style="text-align:center;padding:24px 0 8px">' +
          '<div style="font-size:18px;font-weight:700;margin-bottom:6px">Log In</div>' +
          '<div style="font-size:13px;color:#A1A9B6;margin-bottom:20px">Enter your PIN to see what you can do</div>' +
          '<input id="pin-input" class="pin-input" type="password" inputmode="numeric" maxlength="4" autocomplete="off">' +
          '<div style="margin-top:16px"><button class="primary-btn" id="pin-go">Enter</button></div>' +
          '<div class="submit-msg" id="pin-msg" style="color:#F87171">' + (msg || '') + '</div>' +
        '</div>';
      var input = document.getElementById('pin-input');
      if (!successHtml) input.focus();
      input.addEventListener('keydown', function(e) { if (e.key === 'Enter') tryPin(); });
      input.addEventListener('input', function() { if (input.value.length === 4) tryPin(); });
      document.getElementById('pin-go').addEventListener('click', tryPin);
    }

    function tryPin() {
      if (SUB.busy) return;
      var input = document.getElementById('pin-input');
      var pin = (input.value || '').trim();
      if (pin.length !== 4) { document.getElementById('pin-msg').textContent = 'PINs are 4 digits.'; return; }
      SUB.busy = true;
      document.getElementById('pin-msg').style.color = '#9CA3AF';
      document.getElementById('pin-msg').textContent = 'Checking…';
      picksApi({ pin: pin }).then(function(res) {
        SUB.busy = false;
        if (res.error) { renderPinScreen(res.error); return; }
        SUB.pin = pin;
        SUB.role = res.admin ? 'admin' : res.role === 'friend' ? 'friend' : 'player';
        SUB.name = res.admin ? '' : res.name;
        setLoginTab();
        if (!res.admin && res.name) rememberMe(res.name);
        if (res.admin) {
          loadAdmin().then(function() {
            renderOdds(res);
            picksApi({ pin: SUB.pin, action: 'friends' }).then(function(r) { if (r.friends) ADMIN.friends = r.friends; }).catch(function() {});
            if (typeof adminLoginCheck === 'function') adminLoginCheck();
          }).catch(function() { renderPinScreen('Couldn\'t load the admin screens. Check your connection and try again.'); });
        }
        else if (SUB.role === 'friend') renderFriendHome(res);
        else renderGame(res, null);
      }).catch(function() {
        SUB.busy = false;
        renderPinScreen('Couldn\'t reach the sheet. Try again.');
      });
    }

    // res = next open game from the script; done = just-submitted picks (or null)
    function renderGame(res, done, mode) {
      SUB.mode = mode || 'pick';
      var changing = SUB.mode === 'change';
      SUB.game = res.done ? null : res;
      SUB.homeSel = changing ? res.homePick : null; SUB.awaySel = changing ? res.awayPick : null;
      var el = document.getElementById('submit-content');
      var pc = personColor(res.name);

      var html = playerHeader(res.name || SUB.name, changing ? 'change' : 'pick');

      if (done) {
        html += '<div style="background:rgba(52,211,153,0.15);border-radius:10px;padding:14px 16px;margin-bottom:20px;font-size:13px;color:#34D399;line-height:1.6">' +
          '✅ Locked in for ' + weekName(done.week) + ' ' + done.slot + ': ' +
          coloredText(done.homePick, done.home) + ' / ' + coloredText(done.awayPick, done.away) +
          '. Odds get added later.</div>';
      }

      if (res.done) {
        html += '<div style="text-align:center;padding:32px 0;color:#A1A9B6;font-size:14px">🎉 You\'re all caught up. No open games right now.</div>';
        el.innerHTML = html;
        bindSwitch(); bindPlayerNav();
        return;
      }

      var g = res;
      html += '<div style="text-align:center;margin-bottom:16px">' +
        '<div style="font-size:11px;font-weight:600;color:#9CA3AF;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:6px">' + weekName(g.week) + ' · ' + g.slot + '</div>' +
        '<div style="font-size:17px;font-weight:700">' + coloredGame(g.home, g.away) + '</div>' +
        '<div style="font-size:12px;color:#A1A9B6;margin-top:6px">' + (changing ? 'Your current picks are highlighted. Tap someone else to swap.' : 'Pick one player from each team.') + '</div></div>';

      function column(side, team, players) {
        var tc = TEAM_COLORS[team] || { bg: '#1C1C1E', text: '#FFFFFF', primary: '#1C1C1E' };
        var out = '<div>' +
          '<div class="team-header-bar" style="background:' + (tc.bg || tc.primary) + ';color:' + tc.text + ';border-radius:8px;margin-bottom:8px">' + team + '</div>';
        if (!players.length) out += '<div style="font-size:12px;color:#9CA3AF;padding:8px">No players listed on the Rosters tab.</div>';
        var taken = g.taken || [];
        players.forEach(function(name, i) {
          if (taken.indexOf(name) >= 0) {
            out += '<button class="pick-chip" disabled style="opacity:0.45;cursor:not-allowed;text-decoration:line-through">' +
              name + '<span class="pos-hint">Taken</span></button>';
          } else {
            out += '<button class="pick-chip" data-side="' + side + '" data-idx="' + i + '">' + name + '</button>';
          }
        });
        return out + '</div>';
      }
      html += '<div class="two-col" style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:8px">' +
        column('home', g.home, g.homePlayers) + column('away', g.away, g.awayPlayers) + '</div>';

      html += '<div style="text-align:center;margin-top:16px">' +
        '<div id="sub-summary" style="font-size:13px;color:#A1A9B6;margin-bottom:12px;min-height:20px"></div>' +
        '<button class="primary-btn" id="sub-go" disabled>' + (changing ? 'Save Changes' : 'Submit Picks') + '</button>' +
        '<div class="submit-msg" id="sub-msg"></div></div>';

      el.innerHTML = html;
      bindSwitch(); bindPlayerNav();
      // No player stats while picking: picks should be made blind

      el.querySelectorAll('.pick-chip[data-side]').forEach(function(btn) {
        btn.addEventListener('click', function() {
          var side = btn.getAttribute('data-side');
          var idx = parseInt(btn.getAttribute('data-idx'), 10);
          if (side === 'home') SUB.homeSel = g.homePlayers[idx]; else SUB.awaySel = g.awayPlayers[idx];
          updateChips();
        });
      });
      document.getElementById('sub-go').addEventListener('click', submitPicks);
      updateChips();
    }

    function updateChips() {
      var g = SUB.game;
      if (!g) return;
      document.querySelectorAll('.pick-chip[data-side]').forEach(function(btn) {
        var side = btn.getAttribute('data-side');
        var name = side === 'home' ? g.homePlayers[+btn.getAttribute('data-idx')] : g.awayPlayers[+btn.getAttribute('data-idx')];
        var team = side === 'home' ? g.home : g.away;
        var tc = TEAM_COLORS[team] || { bg: '#1C1C1E', text: '#FFFFFF', primary: '#1C1C1E' };
        var selected = (side === 'home' ? SUB.homeSel : SUB.awaySel) === name;
        btn.style.background = selected ? (tc.bg || tc.primary) : 'rgba(255,255,255,0.04)';
        btn.style.color = selected ? tc.text : '#F3F4F6';
        btn.style.borderColor = selected ? (tc.dark || tc.primary) : 'rgba(255,255,255,0.12)';
        btn.style.fontWeight = selected ? '700' : '500';
        btn.classList.toggle('chip-on', selected);
      });
      var sum = document.getElementById('sub-summary');
      if (SUB.homeSel && SUB.awaySel) {
        sum.innerHTML = coloredText(SUB.homeSel, g.home) + ' <span style="color:#9CA3AF">/</span> ' + coloredText(SUB.awaySel, g.away);
      } else {
        sum.textContent = (SUB.homeSel || SUB.awaySel) ? 'One more to go…' : '';
      }
      document.getElementById('sub-go').disabled = !(SUB.homeSel && SUB.awaySel) || SUB.busy;
    }

    function submitPicks() {
      var g = SUB.game;
      if (!g || !SUB.homeSel || !SUB.awaySel || SUB.busy) return;
      SUB.busy = true;
      var sent = { home: SUB.homeSel, away: SUB.awaySel };
      var btn = document.getElementById('sub-go');
      btn.disabled = true;
      btn.textContent = 'Submitting…';

      function fail(text) {
        SUB.busy = false;
        btn.textContent = 'Submit Picks';
        var msg = document.getElementById('sub-msg');
        msg.style.color = '#F87171';
        msg.textContent = text;
        updateChips();
      }

      picksApi({ pin: SUB.pin, action: SUB.mode === 'change' ? 'change' : 'submit', row: g.row, home: sent.home, away: sent.away })
        .then(function(res) {
          if (res.error) return fail(res.error);
          showSubmitted(res);
        })
        .catch(function() {
          // The reply got lost. Ask the sheet whether the picks landed before calling it a failure.
          picksApi({ pin: SUB.pin, action: 'check', row: g.row })
            .then(function(res) {
              if (res.ok && res.homePick === sent.home && res.awayPick === sent.away) showSubmitted(res);
              else fail('Your picks were not saved. Try again.');
            })
            .catch(function() { fail('Couldn\'t reach the sheet. Check the Live Picks section before trying again.'); });
        });
    }

    // Confirmation + log out after one game's picks
    function showSubmitted(res) {
      SUB.busy = false;
      var done = '<div style="background:rgba(52,211,153,0.15);border-radius:10px;padding:14px 16px;font-size:13px;color:#34D399;line-height:1.6">' +
        '✅ <b>' + res.name + '</b>, you\'re ' + (SUB.mode === 'change' ? 'updated' : 'locked in') + ' for ' + weekName(res.week) + ' ' + res.slot + ': ' +
        coloredText(res.homePick, res.home) + ' / ' + coloredText(res.awayPick, res.away) +
        '. You\'ve been logged out.</div>';
      renderPinScreen('', done);
      clearSheetCache();
      load(); // refresh Stats / Live Picks
    }



    // ── Logged-in menu for Maria / Danielle ────────────────────────────────
    // Each entry is one thing they can do. More get added here over time.
    var PLAYER_SECTIONS = [['pick', '🏈 Make Pick'], ['change', '✏️ Change Pick'], ['mine', '📋 My Picks'], ['chat', '🗣️ Trash Talk'], ['profile', '👤 My Profile']];

    var FRIEND_SECTIONS = [['fpick', '🏈 Make Picks'], ['market', '📈 Market'], ['fprofile', '👤 My Profile'], ['crowd', '🏅 Crowd']];
    var FRIEND_COLOR = '#2DD4BF';
    var FRIEND_EMOJI = ['🏈','🔥','🐐','🦅','🐻','🦁','🐯','🐺','🦈','🐍','👑','💎','🚀','⚡','🎯','🍀','🌮','🍕','🌭','🍺','😎','🤠','👽','🤡'];
    var FRIEND_COLORS = ['#2DD4BF','#34D399','#A3E635','#FACC15','#FB923C','#F472B6','#E879F9','#A78BFA','#22D3EE','#E5E7EB'];
    function fStyle(name) {
      var s = ((CROWD.data && CROWD.data.styles) || {})[name] || {};
      return { color: s.color || FRIEND_COLOR, emoji: s.emoji || '' };
    }
    // A friend's name in their color; tap to open their profile
    function fName(name) {
      var st = fStyle(name);
      return '<a class="fr-link" data-fname="' + escHtml(name) + '" style="color:' + st.color + '">' + (st.emoji ? st.emoji + ' ' : '') + escHtml(name) + '</a>';
    }
    document.addEventListener('click', function(e) {
      var a = e.target.closest && e.target.closest('.fr-link');
      if (a) { e.preventDefault(); openProfile(a.getAttribute('data-fname')); }
    });

    // ── Friend: pick list ───────────────────────────────────────────────────
    var FRIEND = { showLater: false };
    function renderFriendHome(res) {
      var body = playerScreen('fpick', '');
      var games = res.games || [];
      if (!games.length) { body.innerHTML = '<div style="text-align:center;padding:30px 0;color:#A1A9B6">No open games right now. Check back later.</div>'; return; }
      var weeks = games.map(function(g) { return parseInt(g.week, 10); }).filter(function(w, i, a) { return a.indexOf(w) === i; });
      var nearWeeks = weeks.slice(0, 2);
      var shown = FRIEND.showLater ? games : games.filter(function(g) { return nearWeeks.indexOf(parseInt(g.week, 10)) >= 0; });
      var h = '<div style="font-size:12px;color:#A1A9B6;margin-bottom:6px">Pick one player from each team. You can change picks until kickoff. Nobody sees your picks until the game starts.</div>' +
        '<div class="submit-msg" id="fr-msg" style="text-align:left;min-height:0"></div>';
      var lastWeek = null;
      shown.forEach(function(g, i) {
        if (g.week !== lastWeek) { lastWeek = g.week; h += '<div class="sch-week">' + weekName(g.week) + '</div>'; }
        var picked = g.myHome && g.myAway;
        var ko = g.kickoff ? new Date(g.kickoff).toLocaleString([], { weekday: 'short', hour: 'numeric', minute: '2-digit' }) : '';
        h += '<div class="sch-game"><div class="sch-top"><span class="sch-slot">' + escHtml(g.slot) + '</span><span class="sch-ko">' + ko + '</span></div>' +
          '<div class="sch-teams">' + teamPill(g.home, g.home) + ' <span style="color:rgba(255,255,255,0.45)">vs</span> ' + teamPill(g.away, g.away) + '</div>' +
          '<div style="display:flex;justify-content:space-between;align-items:center;gap:10px">' +
            '<div class="sch-status">' + (picked ? '✅ ' + coloredText(g.myHome, g.home) + ' / ' + coloredText(g.myAway, g.away) : '<span style="color:#A1A9B6">Not picked yet</span>') + '</div>' +
            '<button class="adm-btn' + (picked ? '' : ' green') + '" data-fg="' + games.indexOf(g) + '">' + (picked ? 'Change' : 'Pick') + '</button></div></div>';
      });
      if (!FRIEND.showLater && shown.length < games.length) h += '<div style="text-align:center;margin-top:8px"><button class="adm-btn" id="fr-later">Show later weeks</button></div>';
      body.innerHTML = h;
      body.querySelectorAll('[data-fg]').forEach(function(b) {
        b.addEventListener('click', function() { renderFriendPicker(games[+b.getAttribute('data-fg')], res); });
      });
      var later = document.getElementById('fr-later');
      if (later) later.addEventListener('click', function() { FRIEND.showLater = true; renderFriendHome(res); });
    }

    function renderFriendPicker(g, res) {
      var sel = { home: g.myHome || null, away: g.myAway || null };
      var body = playerScreen('fpick', '');
      function column(side, team, players) {
        var tc = TEAM_COLORS[team] || { bg: '#1C1C1E', text: '#FFFFFF', primary: '#1C1C1E' };
        return '<div><div class="team-header-bar" style="background:' + (tc.bg || tc.primary) + ';color:' + tc.text + ';border-radius:8px;margin-bottom:8px">' + team + '</div>' +
          players.map(function(n) {
            return '<button class="pick-chip fr-chip" data-fs="' + side + '" data-fn="' + escHtml(n) + '">' + escHtml(n) + '</button>';
          }).join('') + '</div>';
      }
      body.innerHTML = '<div style="text-align:center;margin-bottom:16px">' +
          '<div style="font-size:11px;font-weight:600;color:#9CA3AF;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:6px">' + weekName(g.week) + ' · ' + escHtml(g.slot) + '</div>' +
          '<div style="font-size:17px;font-weight:700">' + coloredGame(g.home, g.away) + '</div></div>' +
        '<div class="two-col" style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:8px">' + column('home', g.home, g.homePlayers) + column('away', g.away, g.awayPlayers) + '</div>' +
        '<div style="text-align:center;margin-top:16px"><button class="primary-btn" id="fr-save">Save Picks</button> <button class="link-btn" id="fr-back" style="margin-left:10px">Back</button>' +
        '<div class="submit-msg" id="fr-msg"></div></div>';
      function paint() {
        body.querySelectorAll('.fr-chip').forEach(function(b) {
          var side = b.getAttribute('data-fs'), on = sel[side] === b.getAttribute('data-fn');
          var tc = TEAM_COLORS[side === 'home' ? g.home : g.away] || { bg: '#1F2937', text: '#FFFFFF', primary: '#1F2937' };
          b.style.background = on ? (tc.bg || tc.primary) : 'rgba(255,255,255,0.04)';
          b.style.color = on ? tc.text : '#F3F4F6';
          b.style.borderColor = on ? (tc.dark || tc.primary) : 'rgba(255,255,255,0.12)';
          b.classList.toggle('chip-on', on);
        });
        document.getElementById('fr-save').disabled = !(sel.home && sel.away);
      }
      body.querySelectorAll('.fr-chip').forEach(function(b) {
        b.addEventListener('click', function() { sel[b.getAttribute('data-fs')] = b.getAttribute('data-fn'); paint(); });
      });
      document.getElementById('fr-back').addEventListener('click', function() { renderFriendHome(res); });
      document.getElementById('fr-save').addEventListener('click', function() {
        var btn = this, msg = document.getElementById('fr-msg');
        btn.disabled = true; btn.textContent = 'Saving…';
        picksApi({ pin: SUB.pin, action: 'fpick', week: g.week, game: g.game, home: sel.home, away: sel.away }).then(function(r) {
          if (r.error) { btn.disabled = false; btn.textContent = 'Save Picks'; msg.style.color = '#F87171'; msg.textContent = r.error; return; }
          g.myHome = r.homePick; g.myAway = r.awayPick;
          CROWD.data = null;
          renderFriendHome(res);
          var m = document.getElementById('fr-msg');
          if (m) { m.style.color = '#6EE7B7'; m.textContent = '✅ Saved ' + weekName(r.week) + ': ' + r.homePick + ' / ' + r.awayPick; }
        }).catch(function() { btn.disabled = false; btn.textContent = 'Save Picks'; msg.style.color = '#F87171'; msg.textContent = 'Couldn\'t reach the sheet. Try again.'; });
      });
      paint();
    }


    function playerHeader(name, active) {
      var pc = personColor(name);
      var sections = SUB.role === 'friend' ? FRIEND_SECTIONS : PLAYER_SECTIONS;
      if (SUB.role === 'friend') pc = '#2DD4BF';
      return '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">' +
        '<div style="font-size:16px;font-weight:700">Hi <span style="color:' + pc + '">' + name + '</span></div>' +
        '<button class="link-btn" id="sub-switch">Log out</button></div>' +
        '<div class="adm-nav">' + sections.map(function(t) {
          return '<button data-pl="' + t[0] + '" class="' + (t[0] === active ? 'on' : '') + '">' + t[1] + '</button>';
        }).join('') + '</div>';
    }
    function bindPlayerNav() {
      document.querySelectorAll('[data-pl]').forEach(function(b) {
        b.addEventListener('click', function() { showPlayer(b.getAttribute('data-pl')); });
      });
    }
    function playerScreen(active, bodyHtml) {
      var el = document.getElementById('submit-content');
      el.innerHTML = playerHeader(SUB.name, active) + '<div id="pl-body">' + bodyHtml + '</div>';
      bindSwitch(); bindPlayerNav();
      return document.getElementById('pl-body');
    }

    function showPlayer(section) {
      if (section === 'pick') {
        playerScreen('pick', '<div class="loading">Loading…</div>');
        picksApi({ pin: SUB.pin }).then(function(res) { if (!res.error) renderGame(res, null); else renderPinScreen(res.error); });
      }
      if (section === 'change') showChangeList();
      if (section === 'mine') showMyPicks();
      if (section === 'chat') {
        // Use this login for the wall (just for this visit)
        CHAT.pin = SUB.pin; CHAT.name = SUB.name; CHAT.session = true;
        switchTab('chat');
      }
      if (section === 'profile') openProfile(SUB.name);
      if (section === 'fpick') {
        playerScreen('fpick', '<div class="loading">Loading…</div>');
        picksApi({ pin: SUB.pin }).then(function(res) { if (!res.error) renderFriendHome(res); else renderPinScreen(res.error); });
      }
      if (section === 'fprofile') openProfile(SUB.name);
      if (section === 'crowd') switchTab('crowd');
      if (section === 'market') {
        var mb = playerScreen('market', '<div class="loading">Loading the market…</div>');
        loadScriptOnce('js/market.js').then(function() { mb.innerHTML = ''; renderMarket(mb, { trade: true, fresh: true }); })
          .catch(function() { mb.innerHTML = '<div class="loading">Couldn\'t load the market. Check your connection.</div>'; });
      }
    }

    // ✏️ Change Pick: games where the other person hasn't picked yet
    function showChangeList() {
      var body = playerScreen('change', '<div class="loading">Loading…</div>');
      picksApi({ pin: SUB.pin, action: 'editable' }).then(function(res) {
        if (res.error) { body.innerHTML = '<div class="submit-msg" style="color:#F87171">' + res.error + '</div>'; return; }
        var h = '<div style="font-size:12px;color:#A1A9B6;margin-bottom:12px">You can swap a pick until the other person makes theirs. After that it\'s locked.</div>';
        if (!res.games.length) {
          h += '<div style="text-align:center;padding:26px 0;color:#A1A9B6;font-size:14px">Nothing to change right now. Every pick you\'ve made is locked in.</div>';
        } else {
          h += res.games.map(function(g, i) {
            return '<div class="adm-row"><div><div style="font-size:11px;font-weight:700;color:#A1A9B6;letter-spacing:0.08em">' + weekName(g.week).toUpperCase() + ' · ' + escHtml(g.slot).toUpperCase() + '</div>' +
              '<div style="margin-top:4px">' + coloredText(g.homePick, g.home) + ' / ' + coloredText(g.awayPick, g.away) + '</div></div>' +
              '<button class="adm-btn" data-chg="' + i + '">Change</button></div>';
          }).join('');
        }
        body.innerHTML = h;
        body.querySelectorAll('[data-chg]').forEach(function(b) {
          b.addEventListener('click', function() {
            var g = res.games[+b.getAttribute('data-chg')];
            g.name = SUB.name; g.taken = [];
            renderGame(g, null, 'change');
          });
        });
      }).catch(function() { body.innerHTML = '<div class="submit-msg" style="color:#F87171">Couldn\'t reach the sheet. Try again.</div>'; });
    }

    // 📋 My Picks: what's open, what's waiting, how it went
    function showMyPicks() {
      var body = playerScreen('mine', '<div class="loading">Loading…</div>');
      var me = SUB.name, other = me === 'Maria' ? 'Danielle' : 'Maria';
      clearSheetCache();
      fetchSheet('Winnings', 'A1:Q400').then(function(values) {
        var all = readBets(values);
        var rows = all.filter(function(b) { return b.picker === me && b.home; });
        var byGame = {};
        all.forEach(function(b) { if (b.picker === other) byGame[b.week + '_' + b.game] = b; });
        function picksOf(b) { return coloredText(b.homePick, b.home) + ' / ' + coloredText(b.awayPick, b.away); }
        function oddsOf(b) {
          var o = [b.homeOdds, b.awayOdds].map(function(v) { return isNaN(parseFloat(v)) ? null : formatOdds(v); });
          return o[0] || o[1] ? (o[0] || '—') + ' / ' + (o[1] || '—') : 'odds coming';
        }
        var open = rows.filter(function(b) { return !b.homePick && !b.scorer; });
        var waiting = rows.filter(function(b) { return b.homePick && !b.scorer; });
        var done = rows.filter(function(b) { return b.scored; });
        var units = done.reduce(function(a, b) { return a + b.units; }, 0);
        var counted = done.filter(function(b) { return !b.notOffered; });
        var wins = counted.filter(function(b) { return b.correct === 'Yes'; }).length;
        var pc = personColor(me);

        var h = '<div class="pf-big" style="margin-bottom:18px">' +
          '<div><b>' + wins + '/' + counted.length + '</b><span>' + CURRENT_YEAR + ' record</span></div>' +
          '<div><b style="color:' + (units >= 0 ? '#34D399' : '#F87171') + '">' + fmtU(units) + '</b><span>Units</span></div>' +
          '<div><b>' + open.length + '</b><span>Games left to pick</span></div></div>';

        if (open.length) {
          h += '<div class="adm-row"><div>🏈 Next up: <b>' + weekName(open[0].week) + ' ' + escHtml(open[0].slot) + '</b> · ' + coloredGame(open[0].home, open[0].away) + '</div>' +
            '<button class="adm-btn green" id="go-pick">Make Pick</button></div>';
        }
        h += '<div style="font-size:11px;font-weight:800;letter-spacing:0.12em;color:#A1A9B6;margin:18px 0 4px">WAITING ON RESULTS (' + waiting.length + ')</div>';
        h += waiting.length ? waiting.map(function(r) {
          var o = byGame[r.week + '_' + r.game];
          var otherIn = o && o.homePick;
          return '<div class="adm-row"><div><div style="font-size:11px;font-weight:700;color:#A1A9B6">' + weekName(r.week).toUpperCase() + ' · ' + escHtml(r.slot).toUpperCase() + '</div>' +
            '<div style="margin-top:3px">' + picksOf(r) + '</div><div style="font-size:11px;color:#A1A9B6;margin-top:2px">' + oddsOf(r) + '</div></div>' +
            '<span class="sch-chip" style="' + (otherIn ? 'color:#6EE7B7;background:rgba(52,211,153,0.14)">🔒 Locked' : 'color:#FCD34D;background:rgba(251,191,36,0.14)">✏️ Can change') + '</span></div>';
        }).join('') : '<div style="color:#A1A9B6;font-size:13px;padding:8px 0">Nothing pending.</div>';

        h += '<div style="font-size:11px;font-weight:800;letter-spacing:0.12em;color:#A1A9B6;margin:18px 0 4px">RECENT RESULTS</div>';
        h += done.length ? done.slice(-6).reverse().map(function(r) {
          var win = r.correct === 'Yes', u = r.units, no = r.notOffered;
          return '<div class="adm-row"><div><div style="font-size:11px;font-weight:700;color:#A1A9B6">' + weekName(r.week).toUpperCase() + ' · ' + escHtml(r.slot).toUpperCase() + '</div>' +
            '<div style="margin-top:3px">' + picksOf(r) + '</div><div style="font-size:11px;color:#A1A9B6;margin-top:2px">First TD: ' + escHtml(r.scorer) + '</div></div>' +
            '<div style="text-align:right"><div style="font-weight:800;color:' + (no ? '#A1A9B6' : win ? '#34D399' : '#F87171') + '">' + (no ? 'NOT OFFERED' : win ? 'WIN' : 'LOSS') + '</div>' +
            '<div style="font-size:12px;color:' + (u > 0 ? '#34D399' : u < 0 ? '#F87171' : '#A1A9B6') + '">' + (u > 0 ? '+' : '') + u + 'u</div></div></div>';
        }).join('') : '<div style="color:#A1A9B6;font-size:13px;padding:8px 0">No results yet.</div>';

        body.innerHTML = h;
        var go = document.getElementById('go-pick');
        if (go) go.addEventListener('click', function() { showPlayer('pick'); });
      });
    }


    // The admin screens (js/admin.js) load the first time the admin PIN is used, same version as this file
    var ADMIN_JS = null;
    function loadAdmin() {
      if (typeof showAdmin === 'function') return Promise.resolve();
      if (ADMIN_JS) return ADMIN_JS;
      ADMIN_JS = new Promise(function(res, rej) {
        var me = document.querySelector('script[src*="js/picks.js"]');
        var v = me && /[?&]v=([^&]+)/.exec(me.getAttribute('src'));
        var sc = document.createElement('script');
        sc.src = 'js/admin.js' + (v ? '?v=' + v[1] : '');
        sc.onload = function() { res(); };
        sc.onerror = function() { ADMIN_JS = null; sc.remove(); rej(new Error('admin.js')); };
        document.body.appendChild(sc);
      });
      return ADMIN_JS;
    }

    function bindSwitch() {
      var b = document.getElementById('sub-switch');
      if (b) b.addEventListener('click', function() { renderPinScreen(''); });
    }
