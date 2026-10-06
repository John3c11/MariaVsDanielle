// Log In tab: PIN screen, Maria and Danielle picking / changing picks, friends picking, and every admin screen (odds, friends, injuries, Trash Talk, Data Check, Season).
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
        if (res.admin) { renderOdds(res); picksApi({ pin: SUB.pin, action: 'friends' }).then(function(r) { if (r.friends) ADMIN.friends = r.friends; }).catch(function() {}); }
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
          '✅ Locked in for Week ' + done.week + ' ' + done.slot + ': ' +
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
        '<div style="font-size:11px;font-weight:600;color:#9CA3AF;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:6px">Week ' + g.week + ' · ' + g.slot + '</div>' +
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
        '✅ <b>' + res.name + '</b>, you\'re ' + (SUB.mode === 'change' ? 'updated' : 'locked in') + ' for Week ' + res.week + ' ' + res.slot + ': ' +
        coloredText(res.homePick, res.home) + ' / ' + coloredText(res.awayPick, res.away) +
        '. You\'ve been logged out.</div>';
      renderPinScreen('', done);
      clearSheetCache();
      load(); // refresh Stats / Live Picks
    }

    // ── Admin odds entry (PIN 0328) ─────────────────────────────────────────
    function renderOdds(res) {
      ADMIN.oddsRes = res;
      var el = document.getElementById('submit-content');
      var html = adminHeader('odds') +
        '<div style="font-size:12px;color:#A1A9B6;margin-bottom:18px">Enter odds for picks that don\'t have them yet. Type them the way you do in the sheet (15, 4.7) or as American odds (+1500, +470). Leave a box blank to skip it.</div>';

      if (!res.rows.length) {
        html += '<div style="text-align:center;padding:32px 0;color:#A1A9B6;font-size:14px">🎉 All odds are filled in.</div>';
        el.innerHTML = html;
        bindSwitch(); bindAdminNav();
        return;
      }

      // Group rows by game
      var games = [], idx = {};
      res.rows.forEach(function(r) {
        var k = r.week + '_' + r.game;
        if (!(k in idx)) { idx[k] = games.length; games.push({ week: r.week, slot: r.slot, home: r.home, away: r.away, rows: [] }); }
        games[idx[k]].rows.push(r);
      });

      function oddsInput(row, side, val) {
        return '<input class="odds-input" data-row="' + row + '" data-side="' + side + '" inputmode="decimal" autocomplete="off" placeholder="+" value="' + (val || '') + '" ' +
          'style="width:84px;font-family:Inter,sans-serif;font-size:14px;padding:7px 10px;border:1.5px solid rgba(255,255,255,0.10);border-radius:8px;background:rgba(255,255,255,0.04);color:#F3F4F6;text-align:right">';
      }

      games.forEach(function(g) {
        html += '<div style="background:rgba(255,255,255,0.05);border-radius:10px;padding:14px 16px;margin-bottom:14px">' +
          '<div style="font-size:11px;font-weight:600;color:#9CA3AF;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:4px">Week ' + g.week + ' · ' + g.slot + '</div>' +
          '<div style="font-size:15px;font-weight:700;margin-bottom:10px">' + coloredGame(g.home, g.away) + '</div>';
        g.rows.forEach(function(r) {
          html += '<div style="margin-top:8px">' +
            '<div style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.06em;color:' + personColor(r.picker) + ';margin-bottom:4px">' + r.picker + '</div>' +
            '<div style="display:flex;justify-content:space-between;align-items:center;padding:4px 0;font-size:14px">' + coloredText(r.homePick, r.home) + oddsInput(r.row, 'home', r.homeOdds) + '</div>' +
            '<div style="display:flex;justify-content:space-between;align-items:center;padding:4px 0;font-size:14px">' + coloredText(r.awayPick, r.away) + oddsInput(r.row, 'away', r.awayOdds) + '</div>' +
            '</div>';
        });
        html += '</div>';
      });

      html += '<div style="text-align:center;margin-top:8px">' +
        '<button class="primary-btn" id="odds-go">Save Odds</button>' +
        '<div class="submit-msg" id="odds-msg"></div></div>';

      el.innerHTML = html;
      bindSwitch(); bindAdminNav();
      document.getElementById('odds-go').addEventListener('click', saveOdds);
    }

    function saveOdds() {
      if (SUB.busy) return;
      var byRow = {};
      document.querySelectorAll('.odds-input').forEach(function(inp) {
        var v = inp.value.trim();
        if (!v) return;
        var row = inp.getAttribute('data-row');
        if (!byRow[row]) byRow[row] = { row: row, home: '', away: '' };
        byRow[row][inp.getAttribute('data-side')] = v;
      });
      var items = Object.keys(byRow).map(function(k) { return byRow[k]; });
      var msg = document.getElementById('odds-msg');
      if (!items.length) { msg.style.color = '#F87171'; msg.textContent = 'Nothing entered yet.'; return; }

      SUB.busy = true;
      var btn = document.getElementById('odds-go');
      btn.disabled = true;
      btn.textContent = 'Saving…';
      picksApi({ pin: SUB.pin, action: 'odds', data: JSON.stringify(items) })
        .then(function(res) {
          SUB.busy = false;
          if (res.error || (res.bad && res.bad.length)) {
            btn.disabled = false;
            btn.textContent = 'Save Odds';
            msg.style.color = '#F87171';
            msg.textContent = res.error || ('Couldn\'t read: ' + res.bad.join(', ') + '. Everything else was saved.');
            return;
          }
          var done = '<div style="background:rgba(52,211,153,0.15);border-radius:10px;padding:14px 16px;font-size:13px;color:#34D399">' +
            '✅ Saved ' + res.saved + ' odds. You\'ve been logged out.</div>';
          renderPinScreen('', done);
          clearSheetCache();
          load();
        })
        .catch(function() {
          SUB.busy = false;
          btn.disabled = false;
          btn.textContent = 'Save Odds';
          msg.style.color = '#F87171';
          msg.textContent = 'Couldn\'t reach the sheet. Check the sheet, then try again.';
        });
    }



    // ── Logged-in menu for Maria / Danielle ────────────────────────────────
    // Each entry is one thing they can do. More get added here over time.
    var PLAYER_SECTIONS = [['pick', '🏈 Make Pick'], ['change', '✏️ Change Pick'], ['mine', '📋 My Picks'], ['chat', '🗣️ Trash Talk'], ['profile', '👤 My Profile']];

    var FRIEND_SECTIONS = [['fpick', '🏈 Make Picks'], ['fprofile', '👤 My Profile'], ['crowd', '🏅 Crowd']];
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
        if (g.week !== lastWeek) { lastWeek = g.week; h += '<div class="sch-week">Week ' + g.week + '</div>'; }
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
          '<div style="font-size:11px;font-weight:600;color:#9CA3AF;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:6px">Week ' + g.week + ' · ' + escHtml(g.slot) + '</div>' +
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
          if (m) { m.style.color = '#6EE7B7'; m.textContent = '✅ Saved Week ' + r.week + ': ' + r.homePick + ' / ' + r.awayPick; }
        }).catch(function() { btn.disabled = false; btn.textContent = 'Save Picks'; msg.style.color = '#F87171'; msg.textContent = 'Couldn\'t reach the sheet. Try again.'; });
      });
      paint();
    }

    // ── Admin: friends ──────────────────────────────────────────────────────
    function adminFriends() {
      var body = adminScreen('friends', '<div class="loading">Loading…</div>');
      picksApi({ pin: SUB.pin, action: 'friends' }).then(function(res) {
        ADMIN.friends = res.friends || [];
        var list = ADMIN.friends;
        var h = '<div style="font-size:12px;color:#A1A9B6;margin-bottom:12px">Friends log in with their PIN to make their own picks. PINs are stored in the script, not the sheet. Text each friend their PIN.</div>' +
          '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:6px">' +
            '<input class="adm-input" id="fr-name" placeholder="Name" maxlength="24" style="flex:2;min-width:140px">' +
            '<input class="adm-input" id="fr-pin" placeholder="PIN" maxlength="4" inputmode="numeric" style="width:90px;letter-spacing:0.2em;text-align:center">' +
            '<button class="adm-btn" id="fr-rand" title="Random PIN">🎲</button>' +
            '<button class="primary-btn" id="fr-add" style="padding:9px 18px">Add Friend</button>' +
          '</div><div class="submit-msg" id="adm-msg" style="text-align:left"></div>' +
          '<div style="font-size:11px;font-weight:800;letter-spacing:0.12em;color:#A1A9B6;margin:14px 0 4px">FRIENDS (' + list.length + ')</div>';
        h += list.length ? list.map(function(f) {
          return '<div class="adm-row"><div><b style="color:' + fStyle(f.name).color + '">' + (fStyle(f.name).emoji ? fStyle(f.name).emoji + ' ' : '') + escHtml(f.name) + '</b> <span style="color:#A1A9B6;letter-spacing:0.15em;margin-left:6px">' + f.pin + '</span></div>' +
            '<div style="display:flex;gap:6px"><button class="adm-btn" data-fprof="' + escHtml(f.name) + '">Profile</button>' +
            '<button class="adm-btn red" data-frm="' + escHtml(f.name) + '">Remove</button></div></div>';
        }).join('') : '<div style="color:#A1A9B6;font-size:13px;padding:10px 0">No friends yet.</div>';
        body.innerHTML = h;
        document.getElementById('fr-rand').addEventListener('click', function() {
          var taken = list.map(function(f) { return f.pin; }), pin;
          do { pin = String(Math.floor(Math.random() * 10000)).padStart(4, '0'); } while (taken.indexOf(pin) >= 0);
          document.getElementById('fr-pin').value = pin;
        });
        document.getElementById('fr-add').addEventListener('click', function() {
          var name = document.getElementById('fr-name').value.trim(), pin = document.getElementById('fr-pin').value.trim();
          if (!name) return adminMsg('Type a name.');
          if (!/^\d{4}$/.test(pin)) return adminMsg('PINs are 4 digits.');
          adminMsg('Saving…', true);
          picksApi({ pin: SUB.pin, action: 'friendadd', name: name, newpin: pin }).then(function(r) {
            if (r.error) return adminMsg(r.error);
            CROWD.data = null; adminFriends();
          }).catch(function() { adminMsg('Couldn\'t reach the sheet.'); });
        });
        body.querySelectorAll('[data-frm]').forEach(function(b) {
          b.addEventListener('click', function() {
            var n = b.getAttribute('data-frm');
            if (!confirm('Remove ' + n + '? Their PIN stops working and they drop off the Crowd tab. Their old picks stay saved in the private sheet.')) return;
            picksApi({ pin: SUB.pin, action: 'friendrm', name: n }).then(function() { CROWD.data = null; adminFriends(); });
          });
        });
        body.querySelectorAll('[data-fprof]').forEach(function(b) {
          b.addEventListener('click', function() { openProfile(b.getAttribute('data-fprof')); });
        });
      });
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
            return '<div class="adm-row"><div><div style="font-size:11px;font-weight:700;color:#A1A9B6;letter-spacing:0.08em">WEEK ' + g.week + ' · ' + escHtml(g.slot).toUpperCase() + '</div>' +
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
          h += '<div class="adm-row"><div>🏈 Next up: <b>Week ' + open[0].week + ' ' + escHtml(open[0].slot) + '</b> · ' + coloredGame(open[0].home, open[0].away) + '</div>' +
            '<button class="adm-btn green" id="go-pick">Make Pick</button></div>';
        }
        h += '<div style="font-size:11px;font-weight:800;letter-spacing:0.12em;color:#A1A9B6;margin:18px 0 4px">WAITING ON RESULTS (' + waiting.length + ')</div>';
        h += waiting.length ? waiting.map(function(r) {
          var o = byGame[r.week + '_' + r.game];
          var otherIn = o && o.homePick;
          return '<div class="adm-row"><div><div style="font-size:11px;font-weight:700;color:#A1A9B6">WEEK ' + r.week + ' · ' + escHtml(r.slot).toUpperCase() + '</div>' +
            '<div style="margin-top:3px">' + picksOf(r) + '</div><div style="font-size:11px;color:#A1A9B6;margin-top:2px">' + oddsOf(r) + '</div></div>' +
            '<span class="sch-chip" style="' + (otherIn ? 'color:#6EE7B7;background:rgba(52,211,153,0.14)">🔒 Locked' : 'color:#FCD34D;background:rgba(251,191,36,0.14)">✏️ Can change') + '</span></div>';
        }).join('') : '<div style="color:#A1A9B6;font-size:13px;padding:8px 0">Nothing pending.</div>';

        h += '<div style="font-size:11px;font-weight:800;letter-spacing:0.12em;color:#A1A9B6;margin:18px 0 4px">RECENT RESULTS</div>';
        h += done.length ? done.slice(-6).reverse().map(function(r) {
          var win = r.correct === 'Yes', u = r.units, no = r.notOffered;
          return '<div class="adm-row"><div><div style="font-size:11px;font-weight:700;color:#A1A9B6">WEEK ' + r.week + ' · ' + escHtml(r.slot).toUpperCase() + '</div>' +
            '<div style="margin-top:3px">' + picksOf(r) + '</div><div style="font-size:11px;color:#A1A9B6;margin-top:2px">First TD: ' + escHtml(r.scorer) + '</div></div>' +
            '<div style="text-align:right"><div style="font-weight:800;color:' + (no ? '#A1A9B6' : win ? '#34D399' : '#F87171') + '">' + (no ? 'NOT OFFERED' : win ? 'WIN' : 'LOSS') + '</div>' +
            '<div style="font-size:12px;color:' + (u > 0 ? '#34D399' : u < 0 ? '#F87171' : '#A1A9B6') + '">' + (u > 0 ? '+' : '') + u + 'u</div></div></div>';
        }).join('') : '<div style="color:#A1A9B6;font-size:13px;padding:8px 0">No results yet.</div>';

        body.innerHTML = h;
        var go = document.getElementById('go-pick');
        if (go) go.addEventListener('click', function() { showPlayer('pick'); });
      });
    }

    // ── Admin tools (0328): Odds · Friends · Injuries · Trash Talk · Season · Theme · Status ───────
    var ADMIN = { oddsRes: null };

    function adminHeader(active) {
      var tabs = [['odds', '💲 Odds'], ['games', '🏈 Games'], ['friends', '👥 Friends'], ['injuries', '🚑 Injuries'], ['chat', '🗣️ Trash Talk'], ['season', '🆕 Season'], ['theme', '🎨 Theme'], ['status', '🩺 Status']];
      return '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">' +
        '<div style="font-size:16px;font-weight:700">Hi John</div>' +
        '<button class="link-btn" id="sub-switch">Log out</button></div>' +
        '<div class="adm-nav">' + tabs.map(function(t) {
          return '<button data-adm="' + t[0] + '" class="' + (t[0] === active ? 'on' : '') + '">' + t[1] + '</button>';
        }).join('') + '</div>';
    }
    function bindAdminNav() {
      document.querySelectorAll('[data-adm]').forEach(function(b) {
        b.addEventListener('click', function() { showAdmin(b.getAttribute('data-adm')); });
      });
    }
    function adminScreen(active, bodyHtml) {
      var el = document.getElementById('submit-content');
      el.innerHTML = adminHeader(active) + '<div id="adm-body">' + bodyHtml + '</div>';
      bindSwitch(); bindAdminNav();
      return document.getElementById('adm-body');
    }
    // ── 🩺 Status: is everything working? ─────────────────────────────────────
    function adminStatus() {
      var body = adminScreen('status', '<div class="loading">Checking everything…</div>');
      function ago(iso) {
        if (!iso) return 'never';
        var m = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
        var when = m < 1 ? 'just now' : m < 60 ? m + ' min ago' : m < 1440 ? Math.round(m / 60) + ' hr ago' : Math.round(m / 1440) + ' days ago';
        return when + ' <span style="color:#6B7280">(' + new Date(iso).toLocaleString([], { weekday: 'short', hour: 'numeric', minute: '2-digit' }) + ')</span>';
      }
      function row(state, label, detail) {
        var ic = state === 'ok' ? '✅' : state === 'warn' ? '⚠️' : state === 'bad' ? '❌' : 'ℹ️';
        return '<div class="st-row"><span class="st-ic">' + ic + '</span><div><div class="st-l">' + label + '</div>' + (detail ? '<div class="st-d">' + detail + '</div>' : '') + '</div></div>';
      }
      var t0 = Date.now();
      var browserEspn = espnGet('scoreboard').then(function() { return { ok: true, ms: Date.now() - t0 }; }).catch(function() { return { ok: false }; });
      var t1 = Date.now();
      var sheets = fetch('https://sheets.googleapis.com/v4/spreadsheets/' + SHEET_ID + '/values/' + encodeURIComponent('Winnings!A1:A2') + '?key=' + API_KEY + '&_=' + Date.now())
        .then(function(r) { return { ok: r.ok, code: r.status, ms: Date.now() - t1 }; }).catch(function() { return { ok: false }; });
      Promise.all([picksApi({ pin: SUB.pin, action: 'status' }).catch(function(e) { return { error: 'Couldn\'t reach the script.' }; }), browserEspn, sheets]).then(function(res) {
        var s = res[0], be = res[1], sh = res[2];
        var siteV = (document.firstChild && document.firstChild.nodeType === 8) ? document.firstChild.nodeValue.trim() : '?';
        var h = '<div style="font-size:12px;color:#A1A9B6;margin-bottom:10px">Everything the site depends on, checked right now. <button class="link-btn" id="st-again">Check again</button></div>';
        var dataSlot = '<div class="pf-h">🔍 Data check <small>every season, every row</small></div><div id="st-data"><div class="loading">Checking every row in every season…</div></div>';
        h += '<div class="pf-h">🔌 Connections</div>';
        h += row(sh.ok ? 'ok' : 'bad', 'Google Sheets (from this browser)', sh.ok ? 'Reachable · ' + sh.ms + ' ms' : 'Not reachable' + (sh.code ? ' (HTTP ' + sh.code + (sh.code === 429 ? ', too many requests: wait a minute' : sh.code === 403 ? ', check the API key limits' : '') + ')' : ''));
        h += row(s.error ? 'bad' : 'ok', 'Picks script (PicksAPI)', s.error ? s.error : 'Reachable · season ' + s.season + ' · ' + s.friends + ' friend' + (s.friends === 1 ? '' : 's'));
        h += row(be.ok ? 'ok' : 'warn', 'ESPN (from this browser)', be.ok ? 'Reachable · ' + be.ms + ' ms · used for Live Picks scores and kickoff times' : 'Not reachable right now. Live scores and kickoff times won\'t show; nothing else is affected.');
        if (!s.error) {
          h += row(s.espn && s.espn.ok ? 'ok' : 'bad', 'ESPN (from Google, for FirstTD)', s.espn && s.espn.ok ? 'Reachable · ESPN says it\'s ' + (s.espn.week ? (s.espn.week > 18 ? 'playoff round ' + (s.espn.week - 18) : 'Week ' + s.espn.week) : 'the offseason') : 'Not reachable: ' + (s.espn ? s.espn.error : '') + '. First TDs won\'t fill in until this works.');
          var trig = s.triggers || [];
          h += '<div class="pf-h">⏱️ Automatic jobs</div>';
          h += row(trig.indexOf('fillFirstTDs') >= 0 ? 'ok' : 'bad', 'First TD auto-fill', (trig.indexOf('fillFirstTDs') >= 0 ? 'On (every 30 min)' : 'OFF: run setupFirstTDAutoFill in Apps Script') +
            '<br>Last ran: ' + ago(s.ftdLast && s.ftdLast.at) + (s.ftdLast && s.ftdLast.log && s.ftdLast.log.length ? '<div class="st-log">' + s.ftdLast.log.map(escHtml).join('<br>') + '</div>' : '') +
            'Last wrote something: ' + ago(s.ftdLastWrite && s.ftdLastWrite.at) + (s.ftdLastWrite ? '<div class="st-log">' + s.ftdLastWrite.log.map(escHtml).join('<br>') + '</div>' : ''));
          var nl = s.nflLast;
          h += row(trig.indexOf('updateNFLPlayers') >= 0 && nl && !nl.kept ? 'ok' : nl ? 'warn' : 'bad', 'NFL Players list (daily, from ESPN)',
            (trig.indexOf('updateNFLPlayers') >= 0 ? 'On (every 2 hours)' : 'OFF: run setupNFLPlayersDaily in Apps Script') +
            '<br>Last updated: ' + ago(nl && nl.at) + (nl ? ' · ' + nl.count + ' players' + (nl.failed && nl.failed.length ? ' · missed ' + nl.failed.join(', ') : '') + (nl.kept ? ' · <b>kept the old list</b> (ESPN gave too little)' : '') : ''));
          var ij = s.injuries;
          if (ij) h += row(!ij.auto ? 'info' : (ij.needFill && ij.needFill.length) ? 'warn' : 'ok', 'Auto injuries (ESPN)',
            (ij.auto ? 'On' : 'Off') + ' · last check ' + ago(ij.last && ij.last.at) + (ij.shifted && ij.shifted.length ? ' · shifted: ' + ij.shifted.map(function(t) { return t.split(' ').pop(); }).join(', ') : '') +
            (ij.needFill && ij.needFill.length ? '<br>⚠️ Needs a fill-in: ' + ij.needFill.map(escHtml).join(', ') : '') +
            (ij.pending && ij.pending.length ? '<br>⏳ Waiting on games: ' + ij.pending.map(function(t) { return t.split(' ').pop(); }).join(', ') : '') +
            (ij.log && ij.log.length ? '<div class="st-log">' + ij.log.map(function(l) { return escHtml(l.text); }).join('<br>') + '</div>' : ''));
          h += row(trig.indexOf('sendWeeklyRecap') >= 0 ? 'ok' : 'info', 'Tuesday recap email', (trig.indexOf('sendWeeklyRecap') >= 0 ? 'On (Tuesdays 9 AM)' : 'Off') + '<br>Last sent: ' + ago(s.recapLast && s.recapLast.at) + (s.recapLast ? ' · "' + escHtml(s.recapLast.subject) + '"' : ''));
          var gp = s.gaps || { noScorer: [], noSide: [], noOdds: [] };
          h += '<div class="pf-h">📋 Sheet check</div>';
          function gapRow(list, label, fix) {
            return row(list.length ? 'warn' : 'ok', label + (list.length ? ': ' + list.length : ''), list.length ? list.slice(0, 8).join(' · ') + (list.length > 8 ? ' · +' + (list.length - 8) + ' more' : '') + '<br><span style="color:#6B7280">' + fix + '</span>' : 'None');
          }
          h += gapRow(gp.noScorer, 'Finished games with no first scorer', 'FirstTD fills these on its next run. If it\'s been hours, type it into column L.');
          h += gapRow(gp.noSide, 'Scored games missing Home/Away', 'FirstTD fills column N on its next run, or type Home/Away yourself.');
          h += gapRow(gp.noOdds, 'Scored games missing odds', 'Enter them on the 💲 Odds screen.');
          h += gapRow(gp.noPlayers || [], 'Games with no players to pick', 'Run fixGameRows in Apps Script (it fills in the hidden player lists). If one still shows after that, its team name doesn\'t match the Rosters tab.');
          var no = gp.notOffered || [];
          h += row('info', 'Games where the scorer wasn\'t offered' + (no.length ? ': ' + no.length : ''), no.length ? no.join(' · ') + '<br><span style="color:#6B7280">These count 0 units. If one is wrong, clear that game\'s column O cells and FirstTD re-checks it on its next run.</span>' : 'None');
          h += dataSlot;
          h += '<div class="pf-h">🏷️ Versions</div>';
          var v = s.versions || {};
          h += row('info', 'Website', siteV + ' · ' + (navigator.serviceWorker && navigator.serviceWorker.controller ? 'offline mode on' : 'offline mode not active yet'));
          ['PicksAPI', 'FirstTD', 'WeeklyRecap', 'NFLPlayers', 'Injuries'].forEach(function(k) {
            var old = !/^\d{4}-/.test(v[k] || '');
            h += row(old ? 'warn' : 'info', k + '.gs', old ? (v[k] || 'unknown') + ': paste the latest copy into Apps Script' : 'Updated ' + v[k]);
          });
          if (window.HOLIDAY_FORCED) h += row('info', 'Theme preview is on for this device', window.HOLIDAY_THEME || 'off');
        }
        if (h.indexOf('id="st-data"') < 0) h += dataSlot; // script unreachable: still check the sheets
        body.innerHTML = h;
        document.getElementById('st-again').addEventListener('click', adminStatus);
        clearSheetCache(); ALL_BETS_PROMISE = null;
        loadAllBets().then(function(rows) {
          var el = document.getElementById('st-data');
          if (el) el.innerHTML = dataCheckHtml(rows);
        }).catch(function() { var el = document.getElementById('st-data'); if (el) el.innerHTML = row('bad', 'Couldn\'t read the sheets', ''); });
      });
    }

    // ── 🎨 Theme preview (this device only) + 📣 announcement (everyone) ─────
    var THEME_NAMES = { '': 'Auto (by date)', off: 'Off', halloween: '🎃 Halloween', thanksgiving: '🦃 Thanksgiving', christmas: '🎄 Christmas', playoffs: '🏆 Playoffs', superbowl: '🏈 Super Bowl', jewish: '✡️ Jewish' };
    function adminTheme() {
      var forced = ''; try { forced = localStorage.getItem('mvd-theme-force') || ''; } catch (e) {}
      var auto = window.HOLIDAY_AUTO ? THEME_NAMES[window.HOLIDAY_AUTO] : 'no theme';
      var h = '<div class="pf-h" style="margin-top:4px">🎨 Theme preview <small>only on this device</small></div>' +
        '<div style="font-size:12px;color:#A1A9B6;margin-bottom:10px">Force any theme here to check how it looks, whatever the date. Nobody else sees it. Everyone else gets the date-based theme, which today is <b style="color:#F3F4F6">' + auto + '</b>.</div>' +
        '<div class="theme-grid">' + Object.keys(THEME_NAMES).map(function(k) {
          var on = forced === k;
          return '<button class="theme-opt' + (on ? ' on' : '') + '" data-theme-opt="' + k + '">' + THEME_NAMES[k] + (on ? ' ✓' : '') + '</button>';
        }).join('') + '</div>' +
        '<div style="font-size:11px;color:#6B7280;margin:8px 0 22px">The page reloads to apply it. A small "Theme preview" button stays at the bottom of the screen until you go back to Auto.</div>' +
        '<div class="pf-h">👤 Themes for people <small>they can\'t change it</small></div>' +
        '<div style="font-size:12px;color:#A1A9B6;margin-bottom:10px">Give someone their own theme. It shows on any phone where they\'ve logged in at least once, and it beats the date-based theme until you set them back to Auto.</div>' +
        '<div id="pt-box"><div class="loading">Loading…</div></div>' +
        '<div class="pf-h" style="margin-top:22px">📣 Announcement <small>everyone sees it on Stats</small></div><div id="ann-box"><div class="loading">Loading…</div></div>';
      var body = adminScreen('theme', h);
      body.querySelectorAll('[data-theme-opt]').forEach(function(b) {
        b.addEventListener('click', function() {
          var k = b.getAttribute('data-theme-opt');
          try { if (k) localStorage.setItem('mvd-theme-force', k); else localStorage.removeItem('mvd-theme-force'); } catch (e) {}
          location.reload();
        });
      });
      Promise.all([picksApi({ action: 'site' }), picksApi({ pin: SUB.pin, action: 'friends' }).catch(function() { return {}; })]).then(function(res) {
        drawAnnounceAdmin(res[0].announce);
        drawPersonThemes(res[0].themes || {}, ['Maria', 'Danielle'].concat((res[1].friends || []).map(function(f) { return f.name; })));
      }).catch(function() { drawAnnounceAdmin(null); });
    }
    function drawPersonThemes(themes, people) {
      var box = document.getElementById('pt-box');
      if (!box) return;
      box.innerHTML = people.map(function(n) {
        var c = n === 'Maria' ? SB_M : n === 'Danielle' ? SB_D : (typeof fStyle === 'function' ? fStyle(n).color : FRIEND_COLOR);
        return '<div class="adm-row"><b style="color:' + c + '">' + escHtml(n) + '</b><select class="adm-input pt-sel" data-pt="' + escHtml(n) + '" style="padding:6px 10px;width:auto">' +
          Object.keys(THEME_NAMES).map(function(k) { return '<option value="' + k + '"' + ((themes[n] || '') === k ? ' selected' : '') + '>' + THEME_NAMES[k] + '</option>'; }).join('') + '</select></div>';
      }).join('') + '<div class="submit-msg" id="pt-msg" style="text-align:left"></div>';
      box.querySelectorAll('[data-pt]').forEach(function(sel) {
        sel.addEventListener('change', function() {
          var m = document.getElementById('pt-msg'); m.style.color = '#9CA3AF'; m.textContent = 'Saving…';
          picksApi({ pin: SUB.pin, action: 'settheme', name: sel.getAttribute('data-pt'), theme: sel.value }).then(function(r) {
            if (r.error) { m.style.color = '#F87171'; m.textContent = r.error; return; }
            m.style.color = '#6EE7B7'; m.textContent = '✅ ' + sel.getAttribute('data-pt') + ': ' + THEME_NAMES[sel.value] + '. It shows the next time they open the site.';
          }).catch(function() { m.style.color = '#F87171'; m.textContent = 'Couldn\'t reach the script.'; });
        });
      });
    }
    function drawAnnounceAdmin(a) {
      var box = document.getElementById('ann-box');
      if (!box) return;
      var cur = a ? '<div class="announce-banner" style="display:block;margin-bottom:12px">📣 ' + escHtml(a.text) + '<div style="font-size:11px;color:#A1A9B6;margin-top:4px">' + (a.until ? 'Showing through ' + new Date(a.until + 'T12:00').toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' }) : 'Showing until you remove it') + '</div></div>' +
        '<button class="adm-btn red" id="ann-rm" style="margin-bottom:16px">Remove it</button>' : '<div style="font-size:12px;color:#A1A9B6;margin-bottom:10px">Nothing posted right now.</div>';
      box.innerHTML = cur +
        '<textarea class="adm-input" id="ann-text" maxlength="160" rows="2" placeholder="e.g. Happy birthday Danielle 🎂" style="width:100%;box-sizing:border-box;resize:vertical"></textarea>' +
        '<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-top:8px"><label style="font-size:12px;color:#A1A9B6">Show through <input type="date" class="adm-input" id="ann-until" style="padding:6px 8px"></label>' +
        '<span style="font-size:11px;color:#6B7280">(leave blank to keep it up)</span><button class="primary-btn" id="ann-post" style="padding:9px 18px;margin-left:auto">' + (a ? 'Replace' : 'Post') + '</button></div>' +
        '<div class="submit-msg" id="adm-msg" style="text-align:left"></div>';
      document.getElementById('ann-post').addEventListener('click', function() {
        var text = document.getElementById('ann-text').value.trim(), until = document.getElementById('ann-until').value;
        if (!text) return adminMsg('Type a message.');
        adminMsg('Posting…', true);
        picksApi({ pin: SUB.pin, action: 'announce', text: text, until: until }).then(function(r) {
          if (r.error) return adminMsg(r.error);
          try { localStorage.removeItem('mvd-announce'); } catch (e) {}
          drawAnnounceAdmin(r.announce); adminMsg('Posted. Everyone sees it on Stats now.', true);
          if (typeof loadAnnouncement === 'function') loadAnnouncement();
        }).catch(function() { adminMsg('Couldn\'t reach the script.'); });
      });
      var rm = document.getElementById('ann-rm');
      if (rm) rm.addEventListener('click', function() {
        picksApi({ pin: SUB.pin, action: 'unannounce' }).then(function() {
          try { localStorage.removeItem('mvd-announce'); } catch (e) {}
          drawAnnounceAdmin(null); if (typeof loadAnnouncement === 'function') loadAnnouncement();
        });
      });
    }

    // ── 🆕 Season: start next year's sheet ──────────────────────────────────
    function seasonConfigText(add) {
      var list = SEASONS.filter(function(x) { return x.year !== add.year; }).concat([{ year: add.year, sheetId: add.id }])
        .sort(function(a, b) { return parseInt(b.year) - parseInt(a.year); });
      var lines = ['const CONFIG = {'];
      Object.keys(CONFIG).forEach(function(k) { if (k !== 'SEASONS') lines.push('  ' + k + ': ' + JSON.stringify(CONFIG[k]) + ','); });
      lines.push('  SEASONS: [');
      list.forEach(function(x) { lines.push("    { year: '" + x.year + "', sheetId: '" + x.sheetId + "'" + (x.tab && x.tab !== 'Winnings' ? ", tab: '" + x.tab + "'" : '') + ' },'); });
      lines.push('  ],', '};');
      return lines.join('\n');
    }
    function adminSeason() {
      var body = adminScreen('season', '<div class="loading">Loading…</div>');
      picksApi({ pin: SUB.pin, action: 'season' }).then(function(r) {
        if (r.error) { body.innerHTML = '<div class="loading">' + escHtml(r.error) + '</div>'; return; }
        var cur = r.current, pend = r.pending, prev = r.prev;
        var next = String(parseInt(cur.year, 10) + 1);
        var siteYear = CURRENT_YEAR;
        function link(x) { return '<a href="' + x.url + '" target="_blank" rel="noopener" style="color:#93C5FD">Open sheet ↗</a>'; }
        function step(n, title, state, inner) {
          return '<div class="ns-step ' + state + '"><div class="ns-num">' + (state === 'done' ? '✓' : n) + '</div><div style="flex:1;min-width:0"><div class="ns-title">' + title + '</div>' + (inner || '') + '</div></div>';
        }
        var h = '<div style="font-size:12px;color:#A1A9B6;margin-bottom:14px">Picks, odds, Trash Talk, first TDs and the Tuesday email all use the <b style="color:#F3F4F6">' + cur.year + '</b> sheet right now. ' + link(cur) + '</div>';
        var configFor = pend || (prev ? cur : null);
        var needConfig = configFor && SEASONS.map(function(x) { return x.year; }).indexOf(configFor.year) < 0;

        h += step(1, 'Make the ' + (pend ? pend.year : prev ? cur.year : next) + ' sheet', (pend || prev) ? 'done' : 'now',
          (pend || prev) ? '<div class="ns-sub">Copied from ' + (pend ? cur.year : prev.year) + ' with the formulas, tabs and team colors. Game rows, Trash Talk and Injured were blanked. ' + link(pend || cur) + '</div>'
            : '<div class="ns-sub">Copies the ' + cur.year + ' sheet into a new "' + next + '" sheet in the same Drive folder, keeping every formula, tab, dropdown and the team-color script, then blanks the game rows, Trash Talk and Injured list. The ' + cur.year + ' sheet is not changed. Nothing switches yet.</div>' +
              '<button class="primary-btn" id="ns-make" style="margin-top:10px">Make ' + next + ' sheet</button>');
        h += step(2, 'Fill it in', pend ? 'now' : prev ? 'done' : 'later',
          '<div class="ns-sub">Pre-fill the game rows like you always do (or add them on the 🏈 Games screen, which only works after step 3), and update the Rosters and QBs tabs for the new year. The site and scripts keep using ' + (pend ? cur.year : 'the old sheet') + ' until step 3.</div>');
        h += step(3, 'Switch over', pend ? 'now' : prev ? 'done' : 'later',
          pend ? '<div class="ns-sub">Do this before ' + pend.year + ' Week 1. Picks, odds, chat, first TDs and the Tuesday email move to the ' + pend.year + ' sheet. Friends and their old picks stay.</div><button class="adm-btn green" id="ns-switch" style="margin-top:10px;padding:9px 16px;font-size:13px">Switch to ' + pend.year + '</button>'
            : prev ? '<div class="ns-sub">Switched from ' + prev.year + ' to ' + cur.year + '. <button class="link-btn" id="ns-undo">Undo, go back to ' + prev.year + '</button></div>' : '');
        h += step(4, 'Upload the new config.js', needConfig ? (prev ? 'now' : 'later') : (configFor ? 'done' : 'later'),
          configFor ? (needConfig
            ? '<div class="ns-sub">Replace config.js on GitHub with this, right after step 3. Then the site shows ' + configFor.year + ' as the current season and ' + (parseInt(configFor.year) - 1) + ' gets its Season Wrapped and Crowd Wrapped cards.</div>' +
              '<textarea class="ns-config" id="ns-config" readonly rows="' + (seasonConfigText(configFor).split('\n').length) + '">' + escHtml(seasonConfigText(configFor)) + '</textarea>' +
              '<button class="adm-btn" id="ns-copy">Copy</button>'
            : '<div class="ns-sub">The site already lists ' + configFor.year + ' (it shows ' + siteYear + ' as the current season).</div>')
          : '<div class="ns-sub">You\'ll get the exact file to paste here.</div>');
        h += '<div class="submit-msg" id="adm-msg" style="text-align:left"></div>' +
          '<div style="font-size:11px;color:#6B7280;margin-top:14px">Keep editing the scripts in the 2026 sheet\'s Apps Script. The new sheet gets a copy of them only so the team colors keep working there.</div>';
        body.innerHTML = h;

        function run(action, btn, label) {
          btn.disabled = true; btn.textContent = label;
          picksApi({ pin: SUB.pin, action: action }).then(function(x) {
            if (x.error) { btn.disabled = false; adminMsg(x.error); return; }
            CROWD.data = null; adminSeason();
          }).catch(function() { btn.disabled = false; adminMsg('Couldn\'t reach the script. Check the sheet before trying again.'); });
        }
        var mk = document.getElementById('ns-make');
        if (mk) mk.addEventListener('click', function() { run('newseason', mk, 'Copying… (about 30 seconds)'); });
        var sw = document.getElementById('ns-switch');
        if (sw) sw.addEventListener('click', function() {
          if (confirm('Switch to ' + pend.year + '? New picks, odds, chat and first TDs will go into the ' + pend.year + ' sheet. Upload the new config.js right after.')) run('switchseason', sw, 'Switching…');
        });
        var un = document.getElementById('ns-undo');
        if (un) un.addEventListener('click', function() {
          if (confirm('Go back to the ' + prev.year + ' sheet? (The ' + cur.year + ' sheet stays in Drive, ready to switch again.)')) run('undoseason', un, 'Switching back…');
        });
        var cp = document.getElementById('ns-copy');
        if (cp) cp.addEventListener('click', function() {
          var ta = document.getElementById('ns-config'); ta.select();
          (navigator.clipboard ? navigator.clipboard.writeText(ta.value) : Promise.reject()).catch(function() { document.execCommand('copy'); });
          cp.textContent = 'Copied ✓';
        });
      }).catch(function() { body.innerHTML = '<div class="loading">Couldn\'t reach the script.</div>'; });
    }

    // ── 🏈 Games: add a game (two rows, Maria + Danielle) or take out one nobody has picked ──
    var GAMES = { showAll: false };
    function adminGames() {
      var body = adminScreen('games', '<div class="loading">Loading games…</div>');
      picksApi({ pin: SUB.pin, action: 'gamelist' }).then(function(r) {
        if (r.error) { body.innerHTML = '<div class="loading">' + escHtml(r.error) + '</div>'; return; }
        if (!r.games) { body.innerHTML = '<div class="inj-warn">⚠️ The picks script that\'s live is an older version. In Apps Script: <b>Deploy → Manage deployments → ✏️ → Version: New version → Deploy</b>, then reload.</div>'; return; }
        drawGames(body, r);
      }).catch(function() { body.innerHTML = '<div class="loading">Couldn\'t reach the script.</div>'; });
    }
    function drawGames(body, r) {
      var teams = Object.keys(TEAM_ABBR).sort();
      function teamSel(id) {
        return '<select class="adm-input" id="' + id + '"><option value="">Pick a team</option>' + teams.map(function(t) { return '<option>' + escHtml(t) + '</option>'; }).join('') + '</select>';
      }
      function nick(t) { return escHtml(resolveTeam(t).split(' ').pop()); }
      var h = '<div class="pf-h" style="margin-top:4px">➕ Add a game <small>' + CURRENT_YEAR + ' sheet</small></div>' +
        '<div class="ag-form">' +
          '<label>Week<input class="adm-input" id="ag-week" type="number" min="1" max="30" value="' + (r.lastWeek || 1) + '"></label>' +
          '<label>Time<input class="adm-input" id="ag-slot" list="ag-slots" placeholder="TNF, SNF…"><datalist id="ag-slots">' + (r.slots || []).map(function(x) { return '<option value="' + escHtml(x) + '">'; }).join('') + '</datalist></label>' +
          '<label>Home team' + teamSel('ag-home') + '</label>' +
          '<label>Away team' + teamSel('ag-away') + '</label>' +
          '<label>Amount bet<input class="adm-input" id="ag-amt" type="number" min="1" step="any" value="' + escHtml(r.amount || '5') + '"></label>' +
        '</div>' +
        '<div class="ag-note" id="ag-note"></div>' +
        '<button class="primary-btn" id="ag-add" style="padding:10px 20px">Add game</button>' +
        '<div class="submit-msg" id="adm-msg" style="text-align:left"></div>' +
        '<div style="font-size:11px;color:#6B7280;margin:8px 0 20px">Adds two rows right below the last game (game ' + r.nextGame + '), one for Maria and one for Danielle, with the formulas, dropdowns and team colors. Odds start as "+" like always.</div>';
      // Game list: the latest two weeks, the rest behind a button
      var weeks = [], byWeek = {};
      r.games.forEach(function(g) { if (!byWeek[g.week]) { byWeek[g.week] = []; weeks.push(g.week); } byWeek[g.week].push(g); });
      weeks.sort(function(a, b) { return b - a; });
      var shown = GAMES.showAll ? weeks : weeks.slice(0, 2);
      h += '<div class="pf-h">📋 Games in the sheet <small>' + r.games.length + ' games</small></div>';
      if (!weeks.length) h += '<div style="font-size:13px;color:#A1A9B6">No games yet.</div>';
      shown.forEach(function(w) {
        h += '<div class="ag-wk">Week ' + w + '</div>';
        byWeek[w].forEach(function(g) {
          var state = g.scorer ? '<span class="ag-st">🏈 ' + escHtml(g.scorer) + '</span>' : g.picked ? '<span class="ag-st">picked</span>' : '';
          h += '<div class="adm-row"><div style="min-width:0"><b>' + nick(g.home) + '</b> vs <b>' + nick(g.away) + '</b> <span style="color:#9CA3AF">· ' + escHtml(g.slot || '—') + ' · game ' + escHtml(g.game) + ' · rows ' + g.rows.join(', ') + '</span></div>' +
            (g.picked || g.scorer ? state : '<button class="adm-btn red" data-rmg="' + g.week + '|' + escHtml(g.game) + '|' + nick(g.home) + ' vs ' + nick(g.away) + '">Remove</button>') + '</div>';
        });
      });
      if (weeks.length > 2) h += '<button class="link-btn" id="ag-all" style="margin-top:10px">' + (GAMES.showAll ? 'Show only the latest weeks' : 'Show all ' + weeks.length + ' weeks') + '</button>';
      body.innerHTML = h;

      var wk = document.getElementById('ag-week'), note = document.getElementById('ag-note');
      function warnOrder() {
        var w = parseInt(wk.value, 10);
        note.textContent = w && w < r.lastWeek ? 'Heads-up: this goes at the bottom of the sheet, after the Week ' + r.lastWeek + ' games. Picking still goes in week order, so it comes up when it should.' : '';
      }
      wk.addEventListener('input', warnOrder); warnOrder();
      document.getElementById('ag-add').addEventListener('click', function() {
        var btn = this;
        var p = { pin: SUB.pin, action: 'addgame', week: wk.value, slot: document.getElementById('ag-slot').value.trim(),
          home: document.getElementById('ag-home').value, away: document.getElementById('ag-away').value, amount: document.getElementById('ag-amt').value };
        if (!p.home || !p.away) return adminMsg('Pick both teams.');
        if (p.home === p.away) return adminMsg('Home and away are the same team.');
        if (!p.slot && !confirm('No time (TNF, SNF…) filled in. Add it anyway?')) return;
        btn.disabled = true; adminMsg('Adding…', true);
        picksApiOnce(p).then(function(x) { // once: a retry could add it twice
          btn.disabled = false;
          if (x.error) return adminMsg(x.error);
          clearSheetCache(); ALL_BETS_PROMISE = null;
          picksApi({ pin: SUB.pin, action: 'gamelist' }).then(function(r2) {
            drawGames(body, r2);
            adminMsg('✅ Added Week ' + x.week + ': ' + x.home + ' vs ' + x.away + ' (rows ' + x.rows.join(' and ') + ').' + (x.warn ? ' ⚠️ ' + x.warn : ''), !x.warn);
          });
        }).catch(function() { btn.disabled = false; adminMsg('Couldn\'t reach the script. Check the sheet before trying again, it may have gone through.'); });
      });
      var all = document.getElementById('ag-all');
      if (all) all.addEventListener('click', function() { GAMES.showAll = !GAMES.showAll; drawGames(body, r); });
      body.querySelectorAll('[data-rmg]').forEach(function(b) {
        b.addEventListener('click', function() {
          var parts = b.getAttribute('data-rmg').split('|');
          if (!confirm('Remove Week ' + parts[0] + ' ' + parts[2] + '? Both rows go (Maria and Danielle). Nobody has picked in it yet.')) return;
          b.disabled = true; b.textContent = 'Removing…';
          picksApiOnce({ pin: SUB.pin, action: 'rmgame', week: parts[0], game: parts[1] }).then(function(x) {
            if (x.error) { b.disabled = false; b.textContent = 'Remove'; return adminMsg(x.error); }
            clearSheetCache(); ALL_BETS_PROMISE = null;
            picksApi({ pin: SUB.pin, action: 'gamelist' }).then(function(r2) {
              drawGames(body, r2);
              adminMsg(x.how === 'gap' ? 'Removed, but the sheet wouldn\'t let the rows below move up, so rows ' + x.rows.join(' and ') + ' are blank now. Delete them in the sheet if you want.' : '✅ Removed Week ' + parts[0] + ' ' + parts[2] + '.', x.how !== 'gap');
            });
          }).catch(function() { b.disabled = false; b.textContent = 'Remove'; adminMsg('Couldn\'t reach the script.'); });
        });
      });
    }

    function adminMsg(text, ok) {
      var m = document.getElementById('adm-msg');
      if (m) { m.style.color = ok ? '#6EE7B7' : '#F87171'; m.textContent = text; }
    }

    function showAdmin(section) {
      if (section === 'friends') adminFriends();
      if (section === 'odds') {
        adminScreen('odds', '<div class="loading">Loading…</div>');
        picksApi({ pin: SUB.pin }).then(function(res) { if (res.admin) renderOdds(res); });
      }
      if (section === 'injuries') adminInjuries();
      if (section === 'games') adminGames();
      if (section === 'chat') adminChat();
      if (section === 'check') adminStatus(); // Data Check now lives inside Status
      if (section === 'season') adminSeason();
      if (section === 'theme') adminTheme();
      if (section === 'status') adminStatus();
    }

    // Injuries
    function adminInjuries() {
      var body = adminScreen('injuries', '<div class="loading">Loading…</div>');
      Promise.all([picksApi({ pin: SUB.pin, action: 'injuries' }), ROSTERS_READY, loadNFL()]).then(function(res) {
        drawInjuries(body, res[0]);
      }).catch(function() { body.innerHTML = '<div class="loading">Couldn\'t reach the script.</div>'; });
    }
    function drawInjuries(body, st) {
      if (st.error) { body.innerHTML = '<div class="loading">' + escHtml(st.error) + '</div>'; return; }
      if (!st.slots) { body.innerHTML = '<div class="inj-warn">⚠️ The picks script that\'s live is an older version, so this screen can\'t work yet. In Apps Script: <b>Deploy → Manage deployments → ✏️ → Version: New version → Deploy</b>. Then reload this page.</div>'; return; }
      function nick(t) { return t ? resolveTeam(t).split(' ').pop() : ''; }
      function when(iso) { return iso ? new Date(iso).toLocaleString([], { weekday: 'short', hour: 'numeric', minute: '2-digit' }) : 'never'; }
      var names = Object.keys(ROSTER_INFO).map(function(k) { return ROSTER_INFO[k].name; }).filter(Boolean).sort();
      var h = '<div class="inj-auto"><div><b>🤖 Auto from ESPN</b><div class="st-d">Players ESPN lists as Out, IR, Suspended or PUP are marked out every 2 hours and come back when ESPN clears them. Last check: ' + when(st.last && st.last.at) + '</div></div>' +
        '<div style="display:flex;flex-direction:column;gap:6px;align-items:flex-end"><span class="inj-state ' + (st.auto ? 'on' : 'off') + '">' + (st.auto ? '● Currently ON' : '● Currently OFF') + '</span>' +
          '<button class="adm-btn" id="inj-auto">' + (st.auto ? 'Turn off' : 'Turn on') + '</button><button class="adm-btn" id="inj-sync">Check ESPN now</button></div></div>';
      h += '<div style="display:flex;gap:8px;flex-wrap:wrap;margin:12px 0 6px">' +
          '<input class="adm-input" id="inj-name" list="inj-players" placeholder="Mark someone out by hand" style="flex:2;min-width:160px">' +
          '<input class="adm-input" id="inj-note" placeholder="Note (optional)" style="flex:1.4;min-width:120px">' +
          '<button class="primary-btn" id="inj-add" style="padding:9px 18px">Mark OUT</button>' +
        '</div><datalist id="inj-players">' + names.map(function(n) { return '<option value="' + escHtml(n) + '">'; }).join('') + '</datalist>' +
        '<div class="submit-msg" id="adm-msg" style="text-align:left"></div>';
      if (st.needFill && st.needFill.length) h += '<div class="inj-warn">⚠️ No fill-in found for: <b>' + st.needFill.map(escHtml).join(', ') + '</b>. Pick one below, or leave the slot empty.</div>';
      if (st.pending && st.pending.length) h += '<div class="inj-warn" style="border-color:rgba(147,197,253,0.4);background:rgba(96,165,250,0.08)">⏳ Waiting for the game to finish before shifting: <b>' + st.pending.map(nick).join(', ') + '</b></div>';

      h += '<div class="inj-h">🚑 Currently out (' + st.rows.length + ')</div>';
      h += st.rows.length ? st.rows.map(function(r) {
        var auto = r.source === 'auto';
        var team = resolveTeam(r.team);
        var pos = r.pos || (ROSTER_INFO[playerKey(r.name)] || {}).pos || '';
        var P = pos.replace(/\d+/g, '');
        // Fill-in choices: that team's players at the same position who aren't offered yet
        var opts = Object.keys(NFL).map(function(k) { return NFL[k]; }).filter(function(n) {
          return n.team === team && n.pos === P && !isOffered(n.name) && playerKey(n.name) !== playerKey(r.name);
        }).sort(function(a, b) { return a.name.localeCompare(b.name); });
        var cur = r.fill === '-' ? '-' : (r.fillBy === 'you' ? r.fill : '');
        var sel = '<select class="adm-input inj-fill" data-fill="' + escHtml(r.name) + '">' +
          '<option value=""' + (!cur ? ' selected' : '') + '>' + (P === 'QB' ? 'No fill-in (QB)' : 'Auto: ESPN depth chart' + (r.fill && r.fillBy === 'espn' ? ' (' + escHtml(r.fill) + ')' : '')) + '</option>' +
          '<option value="-"' + (cur === '-' ? ' selected' : '') + '>No fill-in, leave it empty</option>' +
          opts.map(function(n) { return '<option value="' + escHtml(n.name) + '"' + (cur === n.name ? ' selected' : '') + '>' + escHtml(n.name) + (n.inj ? ' (' + escHtml(n.inj) + ')' : '') + '</option>'; }).join('') +
          (cur && cur !== '-' && !opts.some(function(n) { return n.name === cur; }) ? '<option selected value="' + escHtml(cur) + '">' + escHtml(cur) + '</option>' : '') + '</select>';
        return '<div class="inj-row"><div class="inj-top"><div><b>' + escHtml(r.name) + '</b> <span style="color:#A1A9B6">· ' + nick(team) + (pos ? ' ' + escHtml(pos) : '') + '</span>' +
            '<div class="inj-tags">' + (auto ? '<span class="pc-tag inj">🤖 ESPN: ' + escHtml(r.espn || 'Out') + '</span>' : '<span class="pc-tag">✋ Added by you</span>') +
            (r.note && !/^ESPN:/.test(r.note) ? '<span class="st-d">' + escHtml(r.note) + '</span>' : '') + '</div></div>' +
            (auto ? '<button class="adm-btn" data-keep="' + escHtml(r.name) + '" title="Ignore ESPN for him until his status changes">Keep him in</button>'
                  : '<button class="adm-btn green" data-heal="' + escHtml(r.name) + '">Healthy ✓</button>') + '</div>' +
          '<div class="inj-fillrow"><span>Fill-in:</span>' + sel + '</div></div>';
      }).join('') : '<div style="color:#A1A9B6;font-size:13px;padding:10px 0">Nobody is out.</div>';

      if (st.shifted && st.shifted.length) {
        h += '<div class="inj-h">🔒 Shifted teams <small>don\'t hand-edit these columns until they\'re back to normal</small></div>';
        h += st.shifted.map(function(s) {
          var diffs = [];
          for (var i = 0; i < 9; i++) if ((s.original[i] || '') !== (s.now[i] || '')) diffs.push('<span class="inj-slot">' + st.slots[i] + '</span> ' + (s.original[i] ? '<s>' + escHtml(s.original[i]) + '</s>' : '<i>empty</i>') + ' → ' + (s.now[i] ? '<b>' + escHtml(s.now[i]) + '</b>' : '<i>empty</i>'));
          return '<div class="inj-shift">' + teamLogo(s.team) + '<b>' + nick(s.team) + '</b><div class="st-d">' + diffs.join('<br>') + '</div></div>';
        }).join('');
      }
      if (st.tagged && st.tagged.length) h += '<div class="inj-h">🟡 Questionable / doubtful <small>tagged only, still pickable</small></div>' +
        '<div class="st-d">' + st.tagged.map(function(t) { return escHtml(t.name) + ' (' + nick(t.team) + ', ' + escHtml(t.espn) + ')'; }).join(' · ') + '</div>';
      if (st.unmatched && st.unmatched.length) h += '<div class="inj-h">✏️ Not found on ESPN <small>usually a spelling difference, so these can\'t be auto-tracked</small></div>' +
        '<div class="st-d">' + st.unmatched.map(escHtml).join(' · ') + '</div>';
      if (st.log && st.log.length) h += '<div class="inj-h">🕘 Recent activity</div><div class="st-log">' + st.log.map(function(l) { return '<span style="color:#6B7280">' + when(l.at) + '</span> ' + escHtml(l.text); }).join('<br>') + '</div>';
      body.innerHTML = h;

      function act(params, btn) {
        if (btn) { btn.disabled = true; }
        adminMsg('Saving…', true);
        picksApi(Object.assign({ pin: SUB.pin }, params)).then(function(r) {
          if (r && r.error) { adminMsg(r.error); if (btn) btn.disabled = false; return; }
          refreshAfterInjury(); adminInjuries();
        }).catch(function() { adminMsg('Couldn\'t reach the script.'); if (btn) btn.disabled = false; });
      }
      document.getElementById('inj-auto').addEventListener('click', function() { act({ action: 'injauto', on: st.auto ? 'off' : 'on' }, this); });
      document.getElementById('inj-sync').addEventListener('click', function() { this.textContent = 'Checking…'; act({ action: 'injsync' }, this); });
      document.getElementById('inj-add').addEventListener('click', function() {
        var name = document.getElementById('inj-name').value.trim();
        if (!name) return adminMsg('Type a player name.');
        if (!ROSTER_INFO[playerKey(name)] && !confirm(name + ' isn\'t on the Rosters tab. Add anyway?')) return;
        act({ action: 'injure', name: name, note: document.getElementById('inj-note').value.trim() }, this);
      });
      body.querySelectorAll('[data-heal]').forEach(function(b) { b.addEventListener('click', function() { act({ action: 'heal', name: b.getAttribute('data-heal') }, b); }); });
      body.querySelectorAll('[data-keep]').forEach(function(b) {
        b.addEventListener('click', function() {
          if (confirm('Keep ' + b.getAttribute('data-keep') + ' in? ESPN will be ignored for him until his status changes.')) act({ action: 'injkeep', name: b.getAttribute('data-keep') }, b);
        });
      });
      body.querySelectorAll('[data-fill]').forEach(function(sel) { sel.addEventListener('change', function() { act({ action: 'setfill', name: sel.getAttribute('data-fill'), fill: sel.value }); }); });
    }
    function refreshAfterInjury() { clearSheetCache(); ROSTERS_READY = loadRosters(); }

    // Trash Talk moderation
    function adminChat() {
      var body = adminScreen('chat', '<div class="loading">Loading…</div>');
      fetchChatRows(SEASONS[0]).then(function(rows) {
        var msgs = [];
        rows.forEach(function(r, i) { if (i && (r[2] || '').trim()) msgs.push({ row: i + 1, who: r[1], text: r[2], pinned: /pin/i.test(r[3] || '') }); });
        msgs.reverse();
        body.innerHTML = '<div style="font-size:12px;color:#A1A9B6;margin-bottom:12px">Pin the best ones to the top of the wall, or delete anything that should go.</div>' +
          '<div class="submit-msg" id="adm-msg" style="text-align:left"></div>' +
          (msgs.length ? msgs.slice(0, 60).map(function(m) {
            var c = personColor(m.who);
            return '<div class="adm-row"><div style="flex:1;min-width:0"><b style="color:' + c + '">' + escHtml(m.who) + '</b> ' + (m.pinned ? '📌 ' : '') +
              '<span style="color:#D1D5DB">' + escHtml(m.text) + '</span></div>' +
              '<div style="display:flex;gap:6px"><button class="adm-btn" data-pin="' + m.row + '">' + (m.pinned ? 'Unpin' : 'Pin') + '</button>' +
              '<button class="adm-btn red" data-del="' + m.row + '" data-text="' + escHtml(m.text) + '">Delete</button></div></div>';
          }).join('') : '<div style="color:#A1A9B6;font-size:13px">No messages yet.</div>');
        body.querySelectorAll('[data-pin]').forEach(function(b) {
          b.addEventListener('click', function() {
            b.disabled = true;
            picksApi({ pin: SUB.pin, action: 'chatpin', row: b.getAttribute('data-pin') }).then(function(r) {
              if (r.error) return adminMsg(r.error);
              CHAT.lastKey = ''; adminChat();
            });
          });
        });
        body.querySelectorAll('[data-del]').forEach(function(b) {
          b.addEventListener('click', function() {
            if (!confirm('Delete this message for good?\n\n"' + b.getAttribute('data-text') + '"')) return;
            b.disabled = true;
            picksApi({ pin: SUB.pin, action: 'chatdel', row: b.getAttribute('data-del'), text: b.getAttribute('data-text') }).then(function(r) {
              if (r.error) return adminMsg(r.error);
              CHAT.lastKey = ''; adminChat();
            });
          });
        });
      }).catch(function() {
        body.innerHTML = '<div style="color:#A1A9B6;font-size:13px">No Trash Talk tab yet. It appears after the first post.</div>';
      });
    }

    // Data check: finds the sheet mistakes that quietly break the numbers
    function levenshtein(a, b) {
      if (Math.abs(a.length - b.length) > 2) return 9;
      var prev = [], cur, i, j;
      for (j = 0; j <= b.length; j++) prev[j] = j;
      for (i = 1; i <= a.length; i++) {
        cur = [i];
        for (j = 1; j <= b.length; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
        prev = cur;
      }
      return prev[b.length];
    }

    // 🔍 Data check (part of 🩺 Status): spelling mismatches and other things that quietly throw off the numbers
    function dataCheckHtml(rows) {
        var issues = [];
        function add(level, title, r, text, fix) {
          issues.push({ level: level, title: title, where: r ? r.year + ' sheet · row ' + r.row + ' · Wk ' + r.week + ' · ' + r.picker : '', text: text, fix: fix });
        }
        var names = {}; // spelling -> { n, first: row }
        rows.forEach(function(r) {
          if (r.picker !== 'Maria' && r.picker !== 'Danielle') return;
          var picks = [r.homePick, r.awayPick];
          var scored = r.correct === 'Yes' || r.correct === 'No';
          picks.concat([r.firstScorer]).forEach(function(n) {
            if (!n) return;
            if (!names[n]) names[n] = { n: 0, first: r };
            names[n].n++;
          });
          picks.forEach(function(pk) {
            if (pk && pk.indexOf('/') >= 0) add('bad', 'Two names in one cell', r, '"' + pk + '" counts as one oddly named player, so neither gets credit.', 'Keep just the player who counted for that game.');
          });
          if (r.homePick && playerKey(r.homePick) === playerKey(r.awayPick)) add('bad', 'Same player twice', r, r.homePick + ' is both the home and away pick.', 'One side should be a different player.');
          if (!scored || !r.firstScorer) return;
          var hitHome = playerKey(r.firstScorer) === playerKey(r.homePick);
          var hitAway = playerKey(r.firstScorer) === playerKey(r.awayPick);
          if (r.correct === 'No' && (hitHome || hitAway)) {
            var pk = hitHome ? r.homePick : r.awayPick;
            add('bad', 'Win counted as a loss', r, 'First scorer "' + r.firstScorer + '" and pick "' + pk + '" are spelled differently, so Correct? says No.', 'Make both spellings match exactly.');
          }
          if (r.correct === 'Yes') {
            var side = (r.side || '').toLowerCase();
            if (r.firstScorer === r.homePick && side && side !== 'home') add('bad', 'Wrong side scored', r, r.firstScorer + ' was the home pick, but Which Side Scored says "' + r.side + '". Units use the wrong odds.', 'Change it to Home.');
            if (r.firstScorer === r.awayPick && side && side !== 'away') add('bad', 'Wrong side scored', r, r.firstScorer + ' was the away pick, but Which Side Scored says "' + r.side + '". Units use the wrong odds.', 'Change it to Away.');
            var odds = r.firstScorer === r.homePick ? r.homeOdds : r.firstScorer === r.awayPick ? r.awayOdds : 1;
            if (!odds) add('warn', 'Missing odds on a win', r, 'The winning pick (' + r.firstScorer + ') has no odds, so this win is worth 0 units.', 'Enter the odds.');
          }
        });
        // Odds the sheet's Net Units formula would misread. It wants "+15" (15 to 1).
        rows.forEach(function(r) {
          if (r.picker !== 'Maria' && r.picker !== 'Danielle') return;
          [['home', r.homePick, r.homeOddsTxt], ['away', r.awayPick, r.awayOddsTxt]].forEach(function(x) {
            var pick = x[1], txt = (x[2] || '').trim();
            if (!pick || txt === '' || txt === '+') return;
            var won = r.correct === 'Yes' && r.firstScorer && playerKey(r.firstScorer) === playerKey(pick);
            if (!/^\+?\d+(\.\d+)?$/.test(txt)) {
              add(won ? 'bad' : 'warn', 'Odds the sheet can\'t read', r, pick + '\'s odds are "' + txt + '". Net Units counts unreadable odds as 0' + (won ? ', so this win is worth nothing right now.' : '.'), 'Type it like +15 (that\'s +1500).');
              return;
            }
            var n = parseFloat(txt.replace('+', ''));
            if (n >= 100) {
              add(won ? 'bad' : 'warn', 'Odds typed the long way', r, pick + '\'s odds are "' + txt + '". The sheet reads that as ' + n + ' units, not ' + (n / 100) + (won ? ', and this one hit, so the totals are way off.' : '. It only matters if he scores, but fix it now.'), 'Change it to +' + (Math.round(n) / 100) + '.');
            } else if (n < 1.5 || n > 60) {
              add('warn', 'Unusual odds', r, pick + ' at "' + txt + '" means +' + Math.round(n * 100) + '. First TD odds are almost always between +150 and +6000.', 'Double-check it against FanDuel.');
            }
          });
        });
        // Each game is a Maria row and a Danielle row that should agree on the matchup
        var games = {}, gameOrder = [];
        rows.forEach(function(r) {
          if (!r.game || !r.week) return;
          var k = r.year + '|' + r.week + '|' + r.game;
          if (!games[k]) { games[k] = []; gameOrder.push(k); }
          games[k].push(r);
        });
        gameOrder.forEach(function(k) {
          var g = games[k], a = g[0];
          var label = 'Week ' + a.week + ' game ' + a.game;
          g.slice(1).forEach(function(b) {
            if (b.homeTeam !== a.homeTeam || b.awayTeam !== a.awayTeam) add('bad', 'Game rows don\'t match', b, label + ': row ' + a.row + ' says ' + a.homeTeam + ' vs ' + a.awayTeam + ', row ' + b.row + ' says ' + b.homeTeam + ' vs ' + b.awayTeam + '.', 'Make both rows the same matchup. The first TD and the Crowd go by one of them.');
            else if ((b.slot || '') !== (a.slot || '')) add('warn', 'Game rows don\'t match', b, label + ': row ' + a.row + ' says "' + (a.slot || 'blank') + '", row ' + b.row + ' says "' + (b.slot || 'blank') + '".', 'Use the same time (TNF, SNF…) on both rows.');
          });
          var who = g.map(function(r) { return r.picker; });
          if (who.length !== who.filter(function(x, i) { return who.indexOf(x) === i; }).length) add('warn', 'Same person twice in one game', g[1], label + ' has ' + who.join(' + ') + ' rows.', 'One of them should be ' + (who.indexOf('Maria') < 0 ? 'Maria' : 'Danielle') + '.');
          if (a.year !== CURRENT_YEAR) return;
          if (g.length === 1 && (a.picker === 'Maria' || a.picker === 'Danielle')) add('warn', 'Game with only one row', a, label + ' (' + a.homeTeam + ' vs ' + a.awayTeam + ') only has a ' + a.picker + ' row.', 'Add the ' + (a.picker === 'Maria' ? 'Danielle' : 'Maria') + ' row, or use the 🏈 Games screen next time.');
          // Upcoming game where both picked the same player (they're not supposed to)
          if (g.some(function(r) { return r.firstScorer; })) return;
          var m = g.filter(function(r) { return r.picker === 'Maria'; })[0], d = g.filter(function(r) { return r.picker === 'Danielle'; })[0];
          if (!m || !d) return;
          [m.homePick, m.awayPick].forEach(function(pk) {
            if (pk && [d.homePick, d.awayPick].some(function(q) { return q && playerKey(q) === playerKey(pk); })) add('warn', 'Both picked the same player', d, 'Maria and Danielle both have ' + pk + ' in ' + label + ' (' + a.homeTeam + ' vs ' + a.awayTeam + ').', 'Have one of them switch before kickoff (change it in the sheet).');
          });
        });
        // This season's games with no Amount Bet: Net Winnings would stay $0
        var noAmt = rows.filter(function(r) { return r.year === CURRENT_YEAR && (r.picker === 'Maria' || r.picker === 'Danielle') && r.homeTeam && !r.amount; });
        if (noAmt.length) add('warn', 'No amount bet', null, noAmt.length + ' row' + (noAmt.length > 1 ? 's' : '') + ' in the ' + CURRENT_YEAR + ' sheet: ' + noAmt.slice(0, 8).map(function(r) { return r.row; }).join(', ') + (noAmt.length > 8 ? '…' : '') + '. Net Winnings stays $0 on those.', 'Fill in Amount Bet (column K).');

        // Spellings that are almost the same (e.g. "Thorton" vs "Thornton")
        var list = Object.keys(names).filter(function(n) { return playerKey(n).length >= 7; });
        var seen = {};
        for (var i = 0; i < list.length; i++) {
          for (var j = i + 1; j < list.length; j++) {
            var a = playerKey(list[i]), b = playerKey(list[j]);
            if (a === b) {
              if (list[i].replace(/\s+/g, ' ') !== list[j].replace(/\s+/g, ' ') && !seen[a + '|=']) {
                seen[a + '|='] = 1;
                // Same letters, different punctuation (AJ vs A.J.) breaks the sheet's exact match
                add('warn', 'Two spellings of one player', null, '"' + list[i] + '" (' + names[list[i]].n + 'x) and "' + list[j] + '" (' + names[list[j]].n + 'x). Your sheet formulas treat these as different people.',
                  'Use one spelling everywhere, probably "' + (names[list[i]].n >= names[list[j]].n ? list[i] : list[j]) + '".');
              }
              continue;
            }
            if (levenshtein(a, b) <= 2) {
              var common = names[list[i]].n >= names[list[j]].n ? list[i] : list[j];
              var rare = common === list[i] ? list[j] : list[i];
              var onRoster = ROSTER_INFO[playerKey(rare)] && !ROSTER_INFO[playerKey(common)] ? rare : common;
              add('warn', 'Possible typo', names[rare].first, '"' + rare + '" (' + names[rare].n + 'x) looks like "' + common + '" (' + names[common].n + 'x).',
                'If they\'re the same player, change it to "' + onRoster + '".');
            }
          }
        }

        var bad = issues.filter(function(x) { return x.level === 'bad'; }).length;
        var h = '';
        if (!issues.length) {
          h += '<div class="st-row"><span class="st-ic">✅</span><div><div class="st-l">Every season checks out</div><div class="st-d">No spelling mismatches, wrong sides, odd-looking odds or mismatched game rows.</div></div></div>';
        } else {
          h += '<div style="font-size:13px;font-weight:700;margin-bottom:12px">' + issues.length + ' thing' + (issues.length > 1 ? 's' : '') + ' to look at' + (bad ? ' · ' + bad + ' affect the totals' : '') + '</div>';
          issues.sort(function(a, b) { return (a.level === 'bad' ? 0 : 1) - (b.level === 'bad' ? 0 : 1); });
          var card = function(x) {
            return '<div class="adm-issue ' + (x.level === 'bad' ? 'bad' : '') + '"><div class="t" style="color:' + (x.level === 'bad' ? '#FCA5A5' : '#FCD34D') + '">' + x.title + '</div>' +
              (x.where ? '<div style="font-size:11px;color:#A1A9B6;margin-bottom:3px">' + x.where + '</div>' : '') +
              '<div>' + escHtml(x.text) + '</div><div class="fix">→ ' + escHtml(x.fix) + '</div></div>';
          };
          // First 5 up front; the rest behind a button so Versions doesn't get buried
          h += issues.slice(0, 5).map(card).join('');
          if (issues.length > 5) h += '<details class="chk-more"><summary class="adm-btn">Show the other ' + (issues.length - 5) + '</summary>' + issues.slice(5).map(card).join('') + '</details>';
        }
        return h;
    }

    function bindSwitch() {
      var b = document.getElementById('sub-switch');
      if (b) b.addEventListener('click', function() { renderPinScreen(''); });
    }
