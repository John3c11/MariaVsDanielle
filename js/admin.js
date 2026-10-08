// Admin screens (John's admin PIN only): Odds, Games, Friends, Injuries, Trash Talk, Season, Theme, Status + Data check.
// Loaded by picks.js (loadAdmin) only after the admin PIN is accepted, so nobody else downloads it.
// Part of the MariaVsDanielle site. Shares the global scope with the other js/ files.

    // ── Admin odds entry (admin PIN) ─────────────────────────────────────────
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

      function oddsInput(row, side, val, pick) {
        return '<span class="odds-wrap"><input class="odds-input" data-row="' + row + '" data-side="' + side + '" data-pick="' + escHtml(pick || '') + '" inputmode="decimal" autocomplete="off" placeholder="+" value="' + (val || '') + '" ' +
          'style="width:84px;font-family:Inter,sans-serif;font-size:14px;padding:7px 10px;border:1.5px solid rgba(255,255,255,0.10);border-radius:8px;background:rgba(255,255,255,0.04);color:#F3F4F6;text-align:right">' +
          '<span class="odds-hint"></span></span>';
      }

      games.forEach(function(g) {
        html += '<div style="background:rgba(255,255,255,0.05);border-radius:10px;padding:14px 16px;margin-bottom:14px">' +
          '<div style="font-size:11px;font-weight:600;color:#9CA3AF;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:4px">' + weekName(g.week) + ' · ' + g.slot + '</div>' +
          '<div style="font-size:15px;font-weight:700;margin-bottom:10px">' + coloredGame(g.home, g.away) + '</div>';
        g.rows.forEach(function(r) {
          html += '<div style="margin-top:8px">' +
            '<div style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.06em;color:' + personColor(r.picker) + ';margin-bottom:4px">' + r.picker + '</div>' +
            '<div style="display:flex;justify-content:space-between;align-items:center;padding:4px 0;font-size:14px">' + coloredText(r.homePick, r.home) + oddsInput(r.row, 'home', r.homeOdds, r.homePick) + '</div>' +
            '<div style="display:flex;justify-content:space-between;align-items:center;padding:4px 0;font-size:14px">' + coloredText(r.awayPick, r.away) + oddsInput(r.row, 'away', r.awayOdds, r.awayPick) + '</div>' +
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
      // Live check: what each box will save as, and a heads-up on odds that look off
      el.querySelectorAll('.odds-input').forEach(function(inp) {
        inp.addEventListener('input', function() { oddsHint(inp); });
        oddsHint(inp);
      });
    }
    // Same rules as the script: 15 or +15 = 15 to 1; +1500 or 1500 is turned into +15
    function oddsCheck(v) {
      v = String(v || '').trim();
      if (!v || v === '+') return { empty: true };
      if (!/^\+?\d+(\.\d+)?$/.test(v)) return { bad: true };
      var n = parseFloat(v.replace('+', ''));
      if (!(n > 0)) return { bad: true };
      var conv = n >= 100;
      if (conv) n = n / 100;
      n = Math.round(n * 100) / 100;
      return { n: n, conv: conv, odd: n < 1.5 || n > 60, american: '+' + Math.round(n * 100), saves: '+' + n };
    }
    function oddsHint(inp) {
      var c = oddsCheck(inp.value), h = inp.parentNode.querySelector('.odds-hint');
      inp.classList.toggle('odds-bad', !!c.bad);
      inp.classList.toggle('odds-odd', !!c.odd);
      h.className = 'odds-hint' + (c.bad ? ' bad' : c.odd ? ' odd' : '');
      h.textContent = c.empty ? '' : c.bad ? 'can\'t read that' : c.odd ? c.american + '? unusual, double-check' : c.conv ? 'saves as ' + c.saves + ' (' + c.american + ')' : '= ' + c.american;
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
      var bad = [], odd = [];
      document.querySelectorAll('.odds-input').forEach(function(inp) {
        var c = oddsCheck(inp.value), who = inp.getAttribute('data-pick') || 'a pick';
        if (c.bad) bad.push(who + ' ("' + inp.value.trim() + '")');
        else if (c.odd) odd.push(who + ' at ' + c.american);
      });
      if (bad.length) { msg.style.color = '#F87171'; msg.textContent = 'Can\'t read: ' + bad.join(', ') + '. Type it like 15 or +1500.'; return; }
      if (odd.length && !confirm('These look unusual:\n\n' + odd.join('\n') + '\n\nSave anyway?')) return;

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


    // ── Admin: friends ──────────────────────────────────────────────────────
    function adminFriends() {
      var body = adminScreen('friends', '<div class="loading">Loading…</div>');
      picksApi({ pin: SUB.pin, action: 'friends' }).then(function(res) {
        if (!document.body.contains(body)) return; // left this tab before it loaded
        ADMIN.friends = res.friends || [];
        var list = ADMIN.friends;
        var h = '<div class="pf-h" style="margin-top:0">🔑 Main PINs <small>no code edits needed</small></div><div id="main-pins"><div class="loading">Loading…</div></div>' +
          '<div class="pf-h">👥 Friends</div>' +
          '<div style="font-size:12px;color:#A1A9B6;margin-bottom:12px">Friends log in with their PIN to make their own picks. PINs are stored in the script, not the sheet. Text each friend their PIN.</div>' +
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
            '<button class="adm-btn" data-fpin="' + escHtml(f.name) + '">PIN</button>' +
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
        body.querySelectorAll('[data-fpin]').forEach(function(b) {
          b.addEventListener('click', function() {
            var n = b.getAttribute('data-fpin');
            var pin = prompt('New 4-digit PIN for ' + n + ':', '');
            if (pin === null) return;
            pin = pin.trim();
            if (!/^\d{4}$/.test(pin)) return adminMsg('PINs are 4 digits.');
            adminMsg('Saving…', true);
            picksApi({ pin: SUB.pin, action: 'friendpin', name: n, newpin: pin }).then(function(r) {
              if (r.error) return adminMsg(r.error);
              adminFriends(); setTimeout(function() { adminMsg(n + '\'s new PIN is saved. Their old one stops working now.', true); }, 600);
            }).catch(function() { adminMsg('Couldn\'t reach the script.'); });
          });
        });
        drawMainPins();
      });
    }
    // 🔑 Maria's, Danielle's and John's PINs (kept in the script's settings, changeable here)
    function drawMainPins() {
      var box = document.getElementById('main-pins');
      if (!box) return;
      picksApi({ pin: SUB.pin, action: 'pins' }).then(function(r) {
        if (!r.pins) { box.innerHTML = '<div class="inj-warn" style="margin:0">Changing these needs the newest PicksAPI.gs (Deploy → Manage deployments → ✏️ → New version → Deploy).</div>'; return; }
        var who = [['Maria', SB_M], ['Danielle', SB_D], ['ADMIN', '#E5E7EB']];
        box.innerHTML = who.map(function(w) {
          return '<div class="adm-row"><div><b style="color:' + w[1] + '">' + (w[0] === 'ADMIN' ? 'You (admin)' : w[0]) + '</b> <span class="mp-pin" style="color:#A1A9B6;letter-spacing:0.15em;margin-left:6px">••••</span></div>' +
            '<div style="display:flex;gap:6px"><button class="adm-btn" data-mp-show="' + w[0] + '">Show</button><button class="adm-btn" data-mp-set="' + w[0] + '">Change</button></div></div>';
        }).join('');
        box.querySelectorAll('[data-mp-show]').forEach(function(b) {
          b.addEventListener('click', function() {
            var sp = b.closest('.adm-row').querySelector('.mp-pin');
            var on = sp.textContent === '••••';
            sp.textContent = on ? r.pins[b.getAttribute('data-mp-show')] : '••••'; b.textContent = on ? 'Hide' : 'Show';
          });
        });
        box.querySelectorAll('[data-mp-set]').forEach(function(b) {
          b.addEventListener('click', function() {
            var w = b.getAttribute('data-mp-set'), label = w === 'ADMIN' ? 'your admin' : w + '\'s';
            var pin = prompt('New 4-digit PIN for ' + label + ' login:', '');
            if (pin === null) return;
            pin = pin.trim();
            if (!/^\d{4}$/.test(pin)) return adminMsg('PINs are 4 digits.');
            if (!confirm('Change ' + label + ' PIN? The old one stops working right away' + (w === 'ADMIN' ? '' : ', and ' + w + ' will need the new one to log in (phones that remembered the old one get logged out)') + '.')) return;
            picksApi({ pin: SUB.pin, action: 'setpin', who: w, newpin: pin }).then(function(x) {
              if (x.error) return adminMsg(x.error);
              if (w === 'ADMIN') SUB.pin = pin; // stay logged in
              r.pins = x.pins;
              adminMsg((w === 'ADMIN' ? 'Your' : w + '\'s') + ' new PIN is saved.', true);
            }).catch(function() { adminMsg('Couldn\'t reach the script.'); });
          });
        });
      }).catch(function() { box.innerHTML = ''; });
    }


    // ── 📜 Which copy of each Apps Script file the website expects ─────────────
    // Bump these whenever a delivery includes that file. Status and the admin alert compare them
    // with what the live script says, so a file that didn't get pasted (or deployed) shows up.
    var SCRIPT_VERSIONS = { PicksAPI: '2026-10-18', Features: '2026-10-10', Automation: '2026-10-18', WeeklyRecap: '2026-10-06', Machine: '2026-10-18' };
    var OLD_SCRIPT_FILES = { Features: 'Market.gs, Museum.gs and Bracket.gs', Automation: 'FirstTD.gs, NFLPlayers.gs, Injuries.gs and Playoffs.gs' };
    var DEPLOY_STEPS = 'Deploy → Manage deployments → ✏️ → New version → Deploy';
    function scriptIssues(v) {
      var out = [];
      Object.keys(SCRIPT_VERSIONS).forEach(function(k) {
        var live = (v || {})[k] || 'missing', want = SCRIPT_VERSIONS[k], t = null, kind = 'old';
        if (live === 'missing') t = 'Not in Apps Script yet. Add ' + k + '.gs, then ' + DEPLOY_STEPS + '.';
        else if (live === 'old separate files') t = 'Still the old separate files. Paste ' + k + '.gs, delete ' + OLD_SCRIPT_FILES[k] + ', then ' + DEPLOY_STEPS + '.';
        else if (!/^\d{4}-/.test(live)) t = 'An old copy (' + live + '). Paste the newest ' + k + '.gs, then ' + DEPLOY_STEPS + '.';
        else if (live < want) t = 'The live copy is from ' + live + ', the site expects ' + want + '. Paste the newest ' + k + '.gs and ' + DEPLOY_STEPS + ' (if you already pasted it, it only needs the deploy).';
        else if (live > want) { kind = 'newer'; t = 'The script (' + live + ') is newer than the website expects (' + want + '). Upload the newest website files to GitHub, then hard-refresh.'; }
        if (t) out.push({ file: k, kind: kind, text: t });
      });
      return out;
    }

    // ── Admin tools (admin PIN): Odds · Friends · Injuries · Trash Talk · Season · Theme · Status ───────
    var ADMIN = { oddsRes: null };

    function adminHeader(active) {
      var tabs = [['odds', '💲 Odds'], ['games', '🏈 Games'], ['friends', '👥 Friends'], ['injuries', '🚑 Injuries'], ['chat', '🗣️ Trash Talk'], ['season', '🆕 Season'], ['bracket', '🏆 Bracket'], ['theme', '🎨 Theme'], ['museum', '🏛️ Museum'], ['machine', '🤖 Machine'], ['mlines', '🎯 Machine Lines'], ['eggs', '🥚 Eggs'], ['status', '🩺 Status']];
      return '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">' +
        '<div style="font-size:16px;font-weight:700">Hi John</div>' +
        '<button class="link-btn" id="sub-switch">Log out</button></div>' +
        '<div class="adm-nav">' + tabs.map(function(t) {
          return '<button data-adm="' + t[0] + '" class="' + (t[0] === active ? 'on' : '') + '">' + t[1] + '</button>';
        }).join('') + '</div>' + (active === 'status' ? '' : adminAlertHtml());
    }
    function bindAdminNav() {
      document.querySelectorAll('[data-adm]').forEach(function(b) {
        b.addEventListener('click', function() { showAdmin(b.getAttribute('data-adm')); });
      });
      var x = document.getElementById('adm-alert-x');
      if (x) x.addEventListener('click', function() { ADMIN.alertHidden = true; var a = document.getElementById('adm-alert'); if (a) a.remove(); });
    }

    // ── ⚠️ Heads-up right after logging in: Data check problems + new phone errors ──
    function errSeen() { try { return localStorage.getItem('mvd-err-seen') || ''; } catch (e) { return ''; } }
    function markErrSeen(list) { if (list && list.length) { try { localStorage.setItem('mvd-err-seen', list[0].at); } catch (e) {} } }
    function adminAlertHtml() {
      var a = ADMIN.alert;
      if (!a || ADMIN.alertHidden || (!a.issues && !a.errs && !a.jobs && !a.bracket && !(a.scripts && a.scripts.length))) return '';
      var parts = [];
      if (a.scripts && a.scripts.length) parts.push('📜 <b>' + a.scripts.map(function(x) { return x.file + '.gs'; }).join(', ') + (a.scripts.length === 1 ? ' needs' : ' need') + ' updating</b> in Apps Script');
      if (a.bracket) parts.push('🏆 Playoff field is (almost) set: <b>open the Bracket Challenge</b> <button class="adm-btn" data-adm="bracket">Bracket</button>');
      if (a.issues) parts.push('🔍 Data check: <b>' + a.issues + ' thing' + (a.issues > 1 ? 's' : '') + ' to look at</b>' + (a.bad ? ' (' + a.bad + ' affect' + (a.bad === 1 ? 's' : '') + ' the totals)' : ''));
      if (a.errs) parts.push('📱 <b>' + a.errs + ' new error' + (a.errs > 1 ? 's' : '') + '</b> from phones');
      if (a.jobs) parts.push('⏱️ <b>' + a.jobs + ' background job' + (a.jobs > 1 ? 's' : '') + ' not working</b>');
      return '<div class="adm-alert" id="adm-alert"><span>⚠️ ' + parts.join(' · ') + '</span>' +
        '<span style="white-space:nowrap">' + (a.issues || a.errs || a.jobs || (a.scripts && a.scripts.length) ? '<button class="adm-btn" data-adm="status">Open Status</button> ' : '') + '<button class="link-btn" id="adm-alert-x" aria-label="Hide">✕</button></span></div>';
    }
    function adminLoginCheck() {
      ADMIN.alert = null; ADMIN.alertHidden = false;
      var seen = errSeen();
      Promise.all([
        loadAllBets().catch(function() { return null; }),
        picksApi({ pin: SUB.pin, action: 'errlist' }).catch(function() { return {}; }),
        picksApi({ pin: SUB.pin, action: 'versions' }).catch(function() { return {}; }),
        picksApi({ pin: SUB.pin, action: 'jobs' }).catch(function() { return {}; }),
      ]).then(function(res) {
        if (SUB.role !== 'admin') return;
        if (res[1].dcOk) ADMIN.dcOk = res[1].dcOk;
        var c = res[0] ? dcCounts(res[0]) : { issues: 0, bad: 0 };
        var errs = (res[1].errors || []).filter(function(e) { return e.at > seen; }).length;
        // January, before Wild Card weekend: nudge to set the playoff field
        var mo = new Date().getMonth(), brOff = typeof BRACKET_ON === 'undefined' || !BRACKET_ON;
        // An older PicksAPI doesn't know 'versions' (it answers with the odds list): treat that as old too
        var scripts = res[2] && res[2].versions ? scriptIssues(res[2].versions).filter(function(x) { return x.kind !== 'newer'; }) : (res[2] && !res[2].error && Object.keys(res[2]).length ? [{ file: 'PicksAPI', kind: 'old' }] : []);
        var jobsBad = (res[3] && res[3].jobs || []).filter(function(j) { return j.fails >= 2 || (!j.triggers && j.fn !== 'sendWeeklyRecap'); }).length;
        ADMIN.alert = { scripts: scripts, issues: c.issues, bad: c.bad, errs: errs, jobs: jobsBad, bracket: mo === 0 && new Date().getDate() <= 14 && brOff };
        var nav = document.querySelector('#submit-content .adm-nav');
        if (!nav || document.getElementById('adm-alert') || document.querySelector('.adm-nav .on[data-adm="status"]')) return;
        nav.insertAdjacentHTML('afterend', adminAlertHtml());
        bindAdminNav();
      });
    }
    function adminScreen(active, bodyHtml) {
      var el = document.getElementById('submit-content');
      el.innerHTML = adminHeader(active) + '<div id="adm-body">' + bodyHtml + '</div>';
      bindSwitch(); bindAdminNav();
      return document.getElementById('adm-body');
    }
    // ── 🩺 Status: is everything working? ─────────────────────────────────────
    // ── ⏱️ Background jobs (Status 2.0): each timed script, its last runs, today's Google limits ──
    function jobsHtml(J, ago) {
      function dur(ms) { return ms == null ? '' : ms < 1000 ? ms + ' ms' : ms < 60000 ? (ms / 1000).toFixed(1) + ' s' : Math.floor(ms / 60000) + ' min ' + Math.round(ms % 60000 / 1000) + ' s'; }
      function bar(label, v, max, unit) {
        var p = Math.min(100, Math.round(v / max * 100)), c = p >= 80 ? '#F87171' : p >= 50 ? '#FCD34D' : '#34D399';
        return '<div class="jb-q"><div class="jb-ql"><span>' + label + '</span><b>' + v.toLocaleString('en-US') + ' / ' + max.toLocaleString('en-US') + unit + '</b></div><div class="jb-bar"><i style="width:' + Math.max(2, p) + '%;background:' + c + '"></i></div></div>';
      }
      var bad = 0;
      var rows = J.jobs.map(function(j) {
        var last = j.runs[0], lastOk = j.runs.filter(function(r) { return r.ok; })[0];
        var stale = last && Date.now() - new Date(last.at).getTime() > j.mins * 2.5 * 60000;
        var state = !j.triggers ? (j.fn === 'sendWeeklyRecap' ? 'info' : 'bad') : j.fails >= 2 ? 'bad' : (j.fails === 1 || j.triggers > 1 || stale) ? 'warn' : 'ok';
        if (state === 'bad' || state === 'warn') bad++;
        var ic = { ok: '✅', warn: '⚠️', bad: '❌', info: 'ℹ️' }[state];
        var next = last && j.triggers ? new Date(new Date(last.at).getTime() + j.mins * 60000) : null;
        var sub = !j.triggers ? 'No timer, so it never runs on its own. Press 🔧 Fix timers below.' :
          (j.running ? '⏳ Running now (started ' + ago(j.running) + ')<br>' : '') +
          (last ? 'Last run ' + ago(last.at) + ' · ' + (last.ok ? 'worked' : '<b style="color:#F87171">failed</b>') + (last.ms != null ? ' · took ' + dur(last.ms) : '') + (last.calls ? ' · ' + last.calls + ' outside calls' : '') : 'No runs logged yet (logging starts with this version).') +
          (j.fails ? '<br><b style="color:#F87171">' + j.fails + ' failure' + (j.fails > 1 ? 's' : '') + ' in a row</b>' + (j.fails >= 2 ? ' · you were emailed' : '') : '') +
          (last && !last.ok ? '<div class="st-log">' + escHtml(last.err || '') + '</div>' : '') +
          (j.triggers > 1 ? '<br>⚠️ ' + j.triggers + ' timers for this job (it runs ' + j.triggers + '× too often). Press 🔧 Fix timers.' : '') +
          (stale && j.triggers ? '<br>⚠️ Hasn\'t run for a while (expected ' + j.every + ').' : '') +
          (next && !j.running ? '<br><span style="color:#6B7280">Next: about ' + next.toLocaleString([], { weekday: 'short', hour: 'numeric', minute: '2-digit' }) + ' (' + j.every + ')</span>' : '');
        var hist = j.runs.length > 1 ? '<details class="jb-hist"><summary>Last ' + j.runs.length + ' runs</summary>' + j.runs.map(function(r) {
          return '<div class="jb-run' + (r.ok ? '' : ' bad') + '"><span>' + (r.ok ? '✅' : '❌') + ' ' + new Date(r.at).toLocaleString([], { weekday: 'short', month: 'numeric', day: 'numeric', hour: 'numeric', minute: '2-digit' }) + '</span><span>' + dur(r.ms) + (r.calls ? ' · ' + r.calls + ' calls' : '') + '</span>' +
            (r.ok ? (r.note ? '<em>' + escHtml(r.note) + '</em>' : '') : '<em>' + escHtml(r.err || '') + '</em>') + '</div>';
        }).join('') + '</details>' : '';
        return '<div class="st-row"><span class="st-ic">' + ic + '</span><div style="flex:1;min-width:0"><div class="st-l">' + escHtml(j.name) + '</div><div class="st-d">' + sub + '</div>' + hist + '</div></div>';
      }).join('');
      var q = J.quota;
      return '<div class="pf-h">⏱️ Background jobs <small>' + (bad ? bad + ' need' + (bad === 1 ? 's' : '') + ' a look' : 'all healthy') + '</small></div>' + rows +
        (J.orphans && J.orphans.length ? '<div class="st-row"><span class="st-ic">⚠️</span><div><div class="st-l">Leftover timers</div><div class="st-d">' + J.orphans.map(escHtml).join(', ') + ' (those jobs don\'t exist anymore). 🔧 Fix timers removes them.</div></div></div>' : '') +
        '<div class="jb-qs"><div class="st-l" style="margin-bottom:6px">📊 Today\'s Google limits</div>' + bar('Calls to outside sites (ESPN…)', q.fetch, q.limits.fetch, '') + bar('Timed-job run time', q.runMin, q.limits.runMin, ' min') +
        '<div class="st-d" style="margin-top:4px">Counted by the scripts themselves (Google doesn\'t show this). Resets at midnight.</div></div>' +
        '<div style="margin:10px 0 18px"><button class="adm-btn" id="jb-fix">🔧 Fix timers</button> <span style="font-size:11.5px;color:#6B7280">One timer per job, missing ones added, leftovers removed.</span><div class="submit-msg" id="jb-msg" style="text-align:left"></div></div>';
    }
    function bindJobs(body) {
      var b = document.getElementById('jb-fix');
      if (!b) return;
      b.addEventListener('click', function() {
        b.disabled = true; b.textContent = 'Fixing…';
        picksApi({ pin: SUB.pin, action: 'fixtrig' }).then(function(r) {
          var m = document.getElementById('jb-msg');
          if (r.error) { b.disabled = false; b.textContent = '🔧 Fix timers'; if (m) { m.style.color = '#F87171'; m.textContent = r.error; } return; }
          if (m) { m.style.color = '#6EE7B7'; m.innerHTML = r.done.map(escHtml).join('<br>'); }
          b.textContent = 'Done ✓';
          setTimeout(adminStatus, 2500);
        }).catch(function() { b.disabled = false; b.textContent = '🔧 Fix timers'; });
      });
    }
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
        if (!document.body.contains(body)) return; // you moved to another admin tab while it was checking
        var s = res[0], be = res[1], sh = res[2];
        var siteV = (document.firstChild && document.firstChild.nodeType === 8) ? document.firstChild.nodeValue.trim() : '?';
        var h = '<div style="font-size:12px;color:#A1A9B6;margin-bottom:10px">Everything the site depends on, checked right now. <button class="link-btn" id="st-again">Check again</button></div>';
        var dataSlot = '<div class="pf-h">🔍 Data check <small>every season, every row</small></div><div id="st-data"><div class="loading">Checking every row in every season…</div></div>';
        if (s.jobs) h += jobsHtml(s.jobs, ago);
        h += '<div class="pf-h">🔌 Connections</div>';
        h += row('info', '📺 Game Day', 'Only shows up while a game they both picked is live. <button class="adm-btn" id="gd-test">Test it on the last game</button>' +
          '<br><span style="color:#6B7280">Opens the most recent finished game they both picked, with the final box score, plays and the touchdown moment.</span>');
        h += row(sh.ok ? 'ok' : 'bad', 'Google Sheets (from this browser)', sh.ok ? 'Reachable · ' + sh.ms + ' ms' : 'Not reachable' + (sh.code ? ' (HTTP ' + sh.code + (sh.code === 429 ? ', too many requests: wait a minute' : sh.code === 403 ? ', check the API key limits' : '') + ')' : ''));
        h += row(s.error ? 'bad' : 'ok', 'Picks script (PicksAPI)', s.error ? s.error : 'Reachable · season ' + s.season + ' · ' + s.friends + ' friend' + (s.friends === 1 ? '' : 's'));
        h += row(be.ok ? 'ok' : 'warn', 'ESPN (from this browser)', be.ok ? 'Reachable · ' + be.ms + ' ms · used for Live Picks scores and kickoff times' : 'Not reachable right now. Live scores and kickoff times won\'t show; nothing else is affected.');
        if (!s.error) {
          h += row(s.espn && s.espn.ok ? 'ok' : 'bad', 'ESPN (from Google, for FirstTD)', s.espn && s.espn.ok ? 'Reachable · ESPN says it\'s ' + (s.espn.week ? (s.espn.week > 18 ? 'playoff round ' + (s.espn.week - 18) : weekName(s.espn.week)) : 'the offseason') : 'Not reachable: ' + (s.espn ? s.espn.error : '') + '. First TDs won\'t fill in until this works.');
          var trig = s.triggers || [];
          h += '<div class="pf-h">🔎 Job details</div>';
          h += row(trig.indexOf('fillFirstTDs') >= 0 ? 'ok' : 'bad', 'First TD auto-fill', (trig.indexOf('fillFirstTDs') >= 0 ? 'On (every 30 min)' : 'OFF: run setupFirstTDAutoFill in Apps Script') +
            '<br>Last ran: ' + ago(s.ftdLast && s.ftdLast.at) + (s.ftdLast && s.ftdLast.log && s.ftdLast.log.length ? '<div class="st-log">' + s.ftdLast.log.map(escHtml).join('<br>') + '</div>' : '') +
            'Last wrote something: ' + ago(s.ftdLastWrite && s.ftdLastWrite.at) + (s.ftdLastWrite ? '<div class="st-log">' + s.ftdLastWrite.log.map(escHtml).join('<br>') + '</div>' : ''));
          // 🤖 The Machine's game library (Machine.gs)
          var lb = s.library;
          if (lb) {
            var ll = lb.last || {};
            var pct = ll.total && lb.estimate ? Math.min(100, Math.round(ll.total / lb.estimate * 100)) : 0;
            h += row(!lb.on ? 'bad' : ll.err ? 'warn' : 'ok', '🤖 Game library (every NFL game since 2023)',
              (!lb.on ? 'OFF: run setupGameLibrary in Apps Script' : ll.caught ? 'Up to date · checks every hour for newly finished games' : 'Building · every 10 minutes') +
              '<br>' + (ll.total || 0) + ' games saved' + (ll.caught ? '' : ' of about ' + lb.estimate + ' (' + pct + '%)') + (ll.cursor ? ' · up to ' + escHtml(ll.cursor) : '') +
              '<br>Last ran: ' + ago(ll.at) + (ll.added ? ' · added ' + ll.added : '') + (ll.err ? '<div class="st-log">' + escHtml(ll.err) + '</div>' : '') +
              (!ll.caught && lb.on ? '<div class="lib-bar"><i style="width:' + pct + '%"></i></div>' : ''));
          }
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
          var errs = s.errors || [], seen = errSeen();
          h += '<div class="pf-h">📱 Errors from phones <small>last 15 kept</small></div>';
          if (!errs.length) h += row('ok', 'No errors reported', 'If the site breaks on someone\'s phone, it shows up here.');
          else {
            h += errs.slice(0, 10).map(function(e) {
              var isNew = e.at > seen;
              return '<div class="err-item">' + row(isNew ? 'warn' : 'info', escHtml(e.msg) + (e.n > 1 ? ' <span style="color:#9CA3AF">×' + e.n + '</span>' : '') + (isNew ? ' <span class="err-new">new</span>' : ''),
                escHtml(e.who) + ' · ' + escHtml(e.device) + ' · ' + escHtml(e.tab || '?') + ' tab' + (e.where ? ' · ' + escHtml(e.where) : '') + (e.v ? ' · ' + escHtml(e.v) : '') + '<br>' + ago(e.at) +
                ' · <button class="link-btn" data-errdel="' + escHtml(e.at) + '" data-errmsg="' + escHtml(e.msg) + '">Dismiss</button>') + '</div>';
            }).join('') + (errs.length > 10 ? '<div style="font-size:11px;color:#6B7280;margin:4px 0">+ ' + (errs.length - 10) + ' older</div>' : '') +
              '<div style="margin:8px 0 4px"><button class="adm-btn" id="err-clear">Clear the list</button> <span style="font-size:11px;color:#6B7280">Fixed? Clear it so new ones stand out.</span></div>';
          }
          markErrSeen(errs);
          if (ADMIN.alert) ADMIN.alert.errs = 0;
          h += '<div class="pf-h">🏷️ Versions</div>';
          var v = s.versions || {};
          h += row('info', 'Website', siteV + ' · ' + (navigator.serviceWorker && navigator.serviceWorker.controller ? 'offline mode on' : 'offline mode not active yet'));
          var bad = scriptIssues(v);
          Object.keys(SCRIPT_VERSIONS).forEach(function(k) {
            var x = bad.filter(function(i) { return i.file === k; })[0];
            h += row(x ? (x.kind === 'newer' ? 'warn' : 'bad') : 'ok', k + '.gs', x ? x.text : 'Up to date (' + v[k] + ')');
          });
          if (window.HOLIDAY_FORCED) h += row('info', 'Theme preview is on for this device', window.HOLIDAY_THEME || 'off');
        }
        if (h.indexOf('id="st-data"') < 0) h += dataSlot; // script unreachable: still check the sheets
        body.innerHTML = h;
        document.getElementById('st-again').addEventListener('click', adminStatus);
        bindJobs(body);
        var gdt = document.getElementById('gd-test');
        if (gdt) gdt.addEventListener('click', function() { gdt.disabled = true; gdt.textContent = 'Finding a game…'; adminTestGameDay().then(function() { gdt.disabled = false; gdt.textContent = 'Test it on the last game'; }); });
        body.querySelectorAll('[data-errdel]').forEach(function(b) {
          b.addEventListener('click', function() {
            b.disabled = true; b.textContent = 'Dismissing…';
            picksApi({ pin: SUB.pin, action: 'errdel', at: b.getAttribute('data-errdel'), msg: b.getAttribute('data-errmsg') }).then(function(r) {
              if (r.error || !r.errors) { b.disabled = false; b.textContent = 'Didn\'t work (old script?)'; return; }
              var item = b.closest('.err-item'); if (item) item.remove();
            }).catch(function() { b.disabled = false; b.textContent = 'Dismiss'; });
          });
        });
        var ec = document.getElementById('err-clear');
        if (ec) ec.addEventListener('click', function() {
          if (!confirm('Clear the list of phone errors?')) return;
          ec.disabled = true;
          picksApi({ pin: SUB.pin, action: 'errclear' }).then(adminStatus).catch(function() { ec.disabled = false; });
        });
        clearSheetCache(); ALL_BETS_PROMISE = null;
        if (s && s.dcOk) ADMIN.dcOk = s.dcOk;
        loadAllBets().then(function(rows) {
          var el = document.getElementById('st-data');
          if (el) drawDataCheck(el, rows);
        }).catch(function() { var el = document.getElementById('st-data'); if (el) el.innerHTML = row('bad', 'Couldn\'t read the sheets', ''); });
      });
    }

    // 📺 Game Day test: the latest scored game where both made picks, with their picks and odds
    function adminTestGameDay() {
      return loadAllBets().then(function(all) {
        var G = {}, order = [];
        all.forEach(function(r) {
          if (!r.firstScorer || !(r.homePick || r.awayPick) || (r.picker !== 'Maria' && r.picker !== 'Danielle')) return;
          var k = r.year + '_' + r.week + '_' + r.game;
          if (!G[k]) { G[k] = { year: r.year, week: r.week, home: r.homeTeam, away: r.awayTeam, by: {} }; order.push(k); }
          G[k].by[r.picker] = r;
        });
        var k = order.filter(function(x) { return G[x].by.Maria && G[x].by.Danielle; }).pop();
        if (!k) { alert('No finished game with both picks yet.'); return; }
        var g = G[k], picks = [];
        ['Maria', 'Danielle'].forEach(function(n) {
          var r = g.by[n];
          if (r.homePick) picks.push({ who: n, name: r.homePick, team: g.home, odds: r.homeOdds ? fmtOdds(r.homeOdds) : '' });
          if (r.awayPick) picks.push({ who: n, name: r.awayPick, team: g.away, odds: r.awayOdds ? fmtOdds(r.awayOdds) : '' });
        });
        return loadScriptOnce('js/gameday.js').then(function() { startGameDay(g.home, g.away, { year: g.year, week: g.week, picks: picks }); });
      }).catch(function() { alert('Couldn\'t load the games.'); });
    }

    // ── 🏆 Bracket: set the playoff field, open/lock it, fix a first TD ──────────
    var BRA = { seeds: null };
    function adminBracket() {
      var body = adminScreen('bracket', '<div class="loading">Loading the bracket…</div>');
      Promise.all([picksApi({ pin: SUB.pin, action: 'bradmin' }), loadScriptOnce('js/bracket.js')]).then(function(res) {
        var r = res[0];
        if (r.error) { body.innerHTML = '<div class="inj-warn">' + escHtml(r.error) + (/Bracket\.gs/.test(r.error) ? '' : '') + '</div>'; return; }
        if (!r.bracket) { body.innerHTML = '<div class="inj-warn">⚠️ The picks script that\'s live is an older version. In Apps Script: <b>Deploy → Manage deployments → ✏️ → New version → Deploy</b>, then reload.</div>'; return; }
        BRA.seeds = r.seeds ? { AFC: r.seeds.AFC.slice(), NFC: r.seeds.NFC.slice() } : (BRA.seeds || { AFC: ['', '', '', '', '', '', ''], NFC: ['', '', '', '', '', '', ''] });
        drawAdminBracket(body, r);
      }).catch(function() { body.innerHTML = '<div class="loading">Couldn\'t reach the script.</div>'; });
    }
    function drawAdminBracket(body, r) {
      if (!document.body.contains(body)) return; // left this tab before it loaded
      var B = r.bracket, S = r.seeds, st = B.state;
      var teams = Object.keys(TEAM_ABBR).sort();
      var stateTxt = { off: S ? 'Field saved, not open yet' : 'Not set up', open: 'Open: people can fill out brackets', locked: 'Locked: games are on', done: 'Finished' }[st] || st;
      var h = '<div style="font-size:12px;color:#A1A9B6;margin-bottom:12px">Everyone picks the winner and first TD of all 13 playoff games before Wild Card kickoff. It locks by itself at the first kickoff, and results come from ESPN. Set the field right after Week 18.</div>';
      h += '<div class="st-row"><span class="st-ic">' + (st === 'open' ? '🟢' : st === 'locked' ? '🔒' : st === 'done' ? '🏁' : '⚪') + '</span><div style="flex:1"><div class="st-l">' + stateTxt + '</div>' +
        '<div class="st-d">' + (B.lockAt ? 'Locks ' + new Date(B.lockAt).toLocaleString() : 'Lock time: the first Wild Card kickoff, once ESPN lists the games') + ' · ' + (r.entries || []).length + ' brackets</div>' +
        '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:8px">' +
          (S ? '<button class="adm-btn ' + (S.opened ? '' : 'green') + '" id="bra-open">' + (S.opened ? 'Close it (hide from the site)' : 'Open it') + '</button>' : '') +
          (S && S.opened && st === 'open' ? '<button class="adm-btn" id="bra-lock">Lock now</button>' : '') +
          (S && S.lockAt ? '<button class="adm-btn" id="bra-unlock">Undo manual lock</button>' : '') +
          (st !== 'off' ? '<button class="adm-btn" id="bra-see">See the page →</button>' : '') +
        '</div></div></div>';
      h += '<div class="pf-h" style="margin-top:16px">🏈 The field <small>seed 1 gets the bye</small></div>' +
        '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:8px"><button class="adm-btn" id="bra-pull">Fill from ESPN standings</button></div>' +
        '<div class="bra-seeds">' + ['AFC', 'NFC'].map(function(c) {
          return '<div><div class="bra-conf">' + c + '</div>' + BRA.seeds[c].map(function(t, i) {
            return '<label class="bra-seed"><span>' + (i + 1) + '</span><select class="adm-input" data-bra="' + c + '|' + i + '"><option value="">—</option>' + teams.map(function(x) {
              return '<option value="' + escHtml(x) + '"' + (resolveTeam(t) === x ? ' selected' : '') + '>' + escHtml(x.split(' ').pop()) + '</option>'; }).join('') + '</select></label>';
          }).join('') + '</div>';
        }).join('') + '</div>' +
        '<button class="primary-btn" id="bra-save" style="padding:10px 20px">' + (S && S.opened ? 'Save the field' : 'Save and open the bracket') + '</button>' +
        (S && !S.opened ? ' <button class="link-btn" id="bra-save-only" style="margin-left:8px">Save without opening</button>' : '') +
        '<div class="submit-msg" id="adm-msg" style="text-align:left"></div>';
      var E = r.entries || [];
      h += '<div class="pf-h" style="margin-top:18px">👥 Brackets <small>' + E.length + '</small></div>' + (E.length ? E.map(function(e) {
        var n = BR_ORDER.filter(function(k) { return e.picks[k] && e.picks[k].w; }).length, ns = BR_ORDER.filter(function(k) { return e.picks[k] && e.picks[k].s; }).length;
        return '<div class="adm-row"><div><b>' + escHtml(e.who) + '</b> <span style="color:#9CA3AF">· ' + n + '/13 winners · ' + ns + '/13 first TDs' + (e.at && !isNaN(new Date(e.at)) ? ' · ' + new Date(e.at).toLocaleDateString() : '') + '</span></div>' +
          '<button class="adm-btn red" data-bra-rm="' + escHtml(e.who) + '">Remove</button></div>';
      }).join('') : '<div style="font-size:13px;color:#A1A9B6">None yet.</div>');
      var G = B.games || [];
      if (G.length) {
        h += '<div class="pf-h" style="margin-top:18px">📋 Results from ESPN <small>fix a first TD if ESPN\'s name doesn\'t match</small></div>';
        G.forEach(function(g) {
          h += '<div class="adm-row"><div style="min-width:0"><b>' + escHtml(brNick(g.teams[0])) + ' vs ' + escHtml(brNick(g.teams[1])) + '</b> <span style="color:#9CA3AF">· ' + BR_ROUNDS[g.round].t + ' · ' + (g.state === 'post' ? 'final' + (g.winner ? ', ' + escHtml(brNick(g.winner)) + ' won' : '') : g.state === 'in' ? 'live' : 'not started') + '</span>' +
            '<div style="font-size:12px;margin-top:3px">First TD: <b>' + escHtml(g.ftd || '—') + '</b>' + (g.fixed ? ' (fixed by you)' : '') + '</div></div>' +
            '<span style="white-space:nowrap"><button class="adm-btn" data-bra-fix="' + escHtml(g.id) + '">Fix</button>' + (g.fixed ? ' <button class="adm-btn" data-bra-unfix="' + escHtml(g.id) + '">Use ESPN</button>' : '') + '</span></div>';
        });
      }
      body.innerHTML = h;

      function call(q, msg) {
        q.pin = SUB.pin; adminMsg('Saving…', true);
        return picksApi(q).then(function(x) {
          if (x.needForce) { if (confirm(x.error + ' Save anyway?')) { q.force = '1'; return call(q, msg); } adminMsg('Not saved.', false); return; }
          if (x.error) { adminMsg(x.error, false); return; }
          BRA.seeds = x.seeds ? { AFC: x.seeds.AFC.slice(), NFC: x.seeds.NFC.slice() } : BRA.seeds;
          drawAdminBracket(body, x); adminMsg(msg, true);
          if (typeof setBracketState === 'function') setBracketState(x.bracket && x.bracket.state !== 'off' ? { state: x.bracket.state, lockAt: x.bracket.lockAt } : null);
          if (typeof BR !== 'undefined') BR.data = null;
        }).catch(function() { adminMsg('Couldn\'t reach the script. Try again.', false); });
      }
      body.querySelectorAll('[data-bra]').forEach(function(sel) {
        sel.addEventListener('change', function() { var x = sel.getAttribute('data-bra').split('|'); BRA.seeds[x[0]][+x[1]] = sel.value; });
      });
      function saveSeeds(open) {
        var all = BRA.seeds.AFC.concat(BRA.seeds.NFC);
        if (all.some(function(t) { return !t; })) { adminMsg('Fill in all 7 seeds for both conferences.', false); return; }
        call({ action: 'brseeds', seeds: JSON.stringify(BRA.seeds), open: open ? '1' : '' }, open ? 'Saved. The bracket is open. 🏆' : 'Saved.');
      }
      document.getElementById('bra-save').addEventListener('click', function() { saveSeeds(!S || !S.opened ? true : true); });
      var so = document.getElementById('bra-save-only'); if (so) so.addEventListener('click', function() { saveSeeds(false); });
      document.getElementById('bra-pull').addEventListener('click', function() {
        adminMsg('Asking ESPN…', true);
        picksApi({ pin: SUB.pin, action: 'brpull' }).then(function(x) {
          if (x.error || !x.espn) { adminMsg(x.error || 'ESPN didn\'t answer.', false); return; }
          ['AFC', 'NFC'].forEach(function(c) { for (var i = 0; i < 7; i++) BRA.seeds[c][i] = (x.espn[c] && x.espn[c][i]) ? resolveTeam(x.espn[c][i]) : BRA.seeds[c][i]; });
          drawAdminBracket(body, r); adminMsg('Filled from ESPN. Check it, then save.', true);
        }).catch(function() { adminMsg('Couldn\'t reach the script.', false); });
      });
      var ob = document.getElementById('bra-open'); if (ob) ob.addEventListener('click', function() { call({ action: 'bropen', open: S.opened ? '' : '1' }, S.opened ? 'Closed. The 🏆 Bracket page is hidden.' : 'Open. 🏆'); });
      var lk = document.getElementById('bra-lock'); if (lk) lk.addEventListener('click', function() { if (confirm('Lock every bracket right now?')) call({ action: 'brlock', lock: '1' }, 'Locked.'); });
      var ul = document.getElementById('bra-unlock'); if (ul) ul.addEventListener('click', function() { call({ action: 'brlock', lock: '' }, 'Back to locking at the first kickoff.'); });
      var see = document.getElementById('bra-see'); if (see) see.addEventListener('click', function() { switchTab('bracket'); });
      body.querySelectorAll('[data-bra-rm]').forEach(function(b) {
        b.addEventListener('click', function() { var w = b.getAttribute('data-bra-rm'); if (confirm('Remove ' + w + '\'s bracket?')) call({ action: 'brrm', who: w }, 'Removed.'); });
      });
      body.querySelectorAll('[data-bra-fix]').forEach(function(b) {
        b.addEventListener('click', function() {
          var id = b.getAttribute('data-bra-fix'), g = G.filter(function(x) { return x.id === id; })[0];
          var name = prompt('First TD scorer for ' + brNick(g.teams[0]) + ' vs ' + brNick(g.teams[1]) + ' (spell it like the Rosters tab):', g.ftd || '');
          if (name === null || !name.trim()) return;
          var team = prompt('His team? Type ' + brNick(g.teams[0]) + ' or ' + brNick(g.teams[1]) + ':', g.ftdTeam ? brNick(g.ftdTeam) : '');
          var full = g.teams.filter(function(t) { return team && brNick(t).toLowerCase() === team.trim().toLowerCase(); })[0] || g.ftdTeam || '';
          call({ action: 'brfix', id: id, ftd: name.trim(), team: full }, 'Fixed.');
        });
      });
      body.querySelectorAll('[data-bra-unfix]').forEach(function(b) {
        b.addEventListener('click', function() { call({ action: 'brfix', id: b.getAttribute('data-bra-unfix'), ftd: '' }, 'Back to ESPN\'s answer.'); });
      });
    }

    // ── 🤖 The Machine (admin only until step 3): the game library + the model's accuracy report ──
    function adminMachine() {
      var body = adminScreen('machine', '<div class="loading">Loading the Machine…</div>');
      Promise.all([picksApi({ pin: SUB.pin, action: 'machine' }), loadAllBets().catch(function() { return []; })]).then(function(res) {
        drawAdminMachine(body, res[0], res[1]);
      }).catch(function() { body.innerHTML = '<div class="loading">Couldn\'t reach the script.</div>'; });
    }
    function drawAdminMachine(body, r, bets) {
      if (!document.body.contains(body)) return; // left this tab before it loaded
      if (r.error) { body.innerHTML = '<div class="inj-warn">' + escHtml(r.error) + '</div>'; return; }
      if (!r.library) { body.innerHTML = '<div class="inj-warn">⚠️ The picks script that\'s live is older. Deploy → Manage deployments → ✏️ → New version → Deploy, then reload.</div>'; return; }
      var L = r.library, ll = L.last || {}, R = r.report;
      function pc(x, d) { return (x * 100).toFixed(d == null ? 0 : d) + '%'; }
      function ago(iso) { if (!iso) return 'never'; var m = Math.round((Date.now() - new Date(iso).getTime()) / 60000); return m < 1 ? 'just now' : m < 60 ? m + ' min ago' : m < 1440 ? Math.round(m / 60) + ' hr ago' : Math.round(m / 1440) + ' days ago'; }
      var h = '<div style="font-size:12px;color:#A1A9B6;margin-bottom:12px">Only you can see this report. Everyone else sees the 🤖 Machine tab, where its picks only show up after kickoff.</div>';
      h += '<div class="st-row"><span class="st-ic">' + (!L.on ? '❌' : ll.caught ? '✅' : '⏳') + '</span><div style="flex:1"><div class="st-l">Game library: ' + (ll.total || 0) + ' games</div><div class="st-d">' +
        (!L.on ? 'Not running. In Apps Script, run setupGameLibrary.' : ll.caught ? 'Every NFL game since 2023, up to date. Checks hourly for new ones.' : 'Still filling in (about ' + L.estimate + ' games total), up to ' + escHtml(ll.cursor || '…') + '.') +
        '</div></div></div>';
      h += '<div class="st-row"><span class="st-ic">' + (R ? '🧠' : '⏳') + '</span><div style="flex:1"><div class="st-l">' + (R ? 'Model trained ' + ago(R.at) : 'Model not trained yet') + '</div><div class="st-d">' +
        (R ? 'On ' + R.games + ' games. It retrains itself when new games come in.' : 'It trains itself once the library is caught up, or press Train now (needs 100+ games).') +
        '</div><button class="adm-btn" id="mc-train" style="margin-top:8px">' + (R ? 'Retrain now' : 'Train now') + '</button>' +
        (R ? ' <button class="adm-btn" id="mc-picks" style="margin-top:8px">Make its picks now</button>' : '') + '</div></div><div class="submit-msg" id="adm-msg" style="text-align:left"></div>' +
        (R ? '<div class="mc-note" style="margin:-4px 0 6px">Its picks for upcoming games refresh every hour on their own and lock at kickoff. The 2026 games already played got "after the fact" picks once, and those never change. <button class="link-btn" onclick="switchTab(\'machine\')">See the 🤖 Machine tab →</button></div>' : '');
      if (R) {
        // Their real hit rate in the same format (two picks a game), for comparison
        function rate(who) {
          var x = bets.filter(function(b) { return b.picker === who && (b.correct === 'Yes' || b.correct === 'No') && !b.notOffered && R.testSeasons.indexOf(parseInt(b.year, 10)) >= 0; });
          return x.length ? { r: x.filter(function(b) { return b.correct === 'Yes'; }).length / x.length, n: x.length } : null;
        }
        var rm = rate('Maria'), rd = rate('Danielle');
        h += '<div class="pf-h" style="margin-top:18px">📋 Accuracy report <small>tested on ' + R.tested + ' games it never trained on (' + R.testSeasons.join(' & ') + ')</small></div>';
        h += '<div class="mc-tiles">' +
          (R.theirN >= 10
            ? '<div class="mc-tile big"><div class="mc-k">On their ' + R.theirN + ' games, its picks hit (one per team, like theirs)</div><div class="mc-v">' + pc(R.their, 1) + '</div>' +
              '<div class="mc-s">' + (rm ? '<b style="color:' + SB_M + '">Maria ' + pc(rm.r) + '</b> · ' : '') + (rd ? '<b style="color:' + SB_D + '">Danielle ' + pc(rd.r) + '</b> · ' : '') + 'every NFL game: ' + pc(R.two, 1) + ' (most-touches pick ' + pc(R.twoBase, 1) + ')</div></div>'
            : '<div class="mc-tile big"><div class="mc-k">Its picks hit (one per team, like theirs)</div><div class="mc-v">' + pc(R.two, 1) + '</div>' +
              '<div class="mc-s">' + (rm ? '<b style="color:' + SB_M + '">Maria ' + pc(rm.r) + '</b> · ' : '') + (rd ? '<b style="color:' + SB_D + '">Danielle ' + pc(rd.r) + '</b> · ' : '') + 'most-touches pick ' + pc(R.twoBase, 1) + '</div></div>') +
          '<div class="mc-tile"><div class="mc-k">Top pick of the game scored first</div><div class="mc-v">' + pc(R.top1, 1) + '</div></div>' +
          '<div class="mc-tile"><div class="mc-k">Called which team scores first</div><div class="mc-v">' + pc(R.team) + '</div><div class="mc-s">a coin flip is 50%</div></div>' +
          '<div class="mc-tile"><div class="mc-k">Sharper than guessing</div><div class="mc-v">' + (R.llBase ? Math.round((1 - R.ll / R.llBase) * 100) : 0) + '%</div><div class="mc-s">how much less surprised it is by the real scorer than an even guess</div></div>' +
        '</div>';
        // Calibration
        var top = Math.max.apply(null, R.cal.map(function(c) { return Math.max(c.pred, c.act); }).concat([0.05]));
        h += '<div class="pf-h">🎯 Are its percentages honest? <small>players grouped by the chance it gave them</small></div><div class="mc-cal">' +
          R.cal.filter(function(c) { return c.n >= 15; }).map(function(c) {
            return '<div class="mc-row"><div class="mc-lab">' + Math.round(c.lo * 100) + '–' + (c.hi >= 1 ? '100' : Math.round(c.hi * 100)) + '%<small>' + c.n + ' players</small></div><div class="mc-bars">' +
              '<div class="mc-bar pred"><i style="width:' + (c.pred / top * 100).toFixed(1) + '%"></i><span>said ' + pc(c.pred, 1) + '</span></div>' +
              '<div class="mc-bar act"><i style="width:' + (c.act / top * 100).toFixed(1) + '%"></i><span>scored ' + pc(c.act, 1) + '</span></div></div></div>';
          }).join('') + '</div><div class="mc-note">If the two bars in a row are close, its percentages mean what they say.</div>';
        // What it learned
        var W = R.W || {}, wsum = (W.a || 0) + (W.b || 0) + (W.c || 0) || 1;
        h += '<div class="pf-h">🧠 What it learned</div><ul class="mc-list">' +
          '<li>A 7-point home favorite scores the first TD <b>' + R.home7 + '%</b> of the time, an even game <b>' + R.homeEven + '%</b> (when a defense or return TD doesn\'t come first).</li>' +
          '<li><b>' + pc(R.nonoff, 1) + '</b> of first TDs are a defense or special-teams score that nobody can pick.</li>' +
          '<li>Who scores for his team: <b>' + Math.round((W.b || 0) / wsum * 100) + '%</b> goal-line touches, <b>' + Math.round((W.a || 0) / wsum * 100) + '%</b> recent TD share, <b>' + Math.round((W.c || 0) / wsum * 100) + '%</b> overall touches' + (W.tau > 1 ? ', with extra weight on the team\'s top options' : '') + '.</li>' +
          '<li>ESPN had a point spread for <b>' + pc(R.spreadShare) + '</b> of games. The rest use each offense\'s recent form.</li></ul>';
        // Prices
        var P = R.price || {};
        h += '<div class="pf-h">💲 Estimated FanDuel prices <small>for picks without real odds</small></div><div class="mc-note" style="margin-bottom:6px">' +
          (P.n >= 20 ? 'Learned from <b>' + P.n + '</b> real FanDuel prices you typed into the sheets. Typical miss: <b>±' + Math.round(P.err * 100) + '%</b> of the real price.' : 'Not enough real prices matched yet (' + (P.n || 0) + '), so it uses the fair price with a 20% cut for now.') + '</div>' +
          '<div class="mc-prices"><span>5% chance → <b>+' + P.p05 + '</b></span><span>10% → <b>+' + P.p10 + '</b></span><span>20% → <b>+' + P.p20 + '</b></span>' +
            (P.margin != null ? '<span>FanDuel\'s cut: <b>' + Math.round(P.margin * 100) + '%</b></span>' : '') + '</div>';
        // 🔍 Price check: real prices you typed vs its estimates
        if (P.ranges && P.ranges.length) {
          h += '<div class="pf-h">🔍 Price check <small>its estimate for every pick Maria and Danielle made</small></div>' +
            '<div class="mc-pc"><div class="mc-pc-r mc-pc-h"><span>Real price</span><span>Picks</span><span>Typical real</span><span>Its estimate</span></div>' +
            P.ranges.filter(function(r) { return r.n; }).map(function(r) {
              var off = r.est && r.real ? Math.round((r.est - r.real) / r.real * 100) : 0;
              return '<div class="mc-pc-r"><span>' + r.label + '</span><span>' + r.n + '</span><span>+' + r.real + '</span><span>+' + r.est + ' <small style="color:' + (Math.abs(off) <= 20 ? '#6EE7B7' : '#FCA5A5') + '">' + (off > 0 ? '+' : '') + off + '%</small></span></div>';
            }).join('') + '</div>';
          if (P.check && P.check.length) h += '<details class="an-more" style="margin-top:8px"><summary>Biggest misses (' + P.check.length + ')</summary>' +
            '<div class="mc-pc">' + P.check.map(function(c) {
              return '<div class="mc-pc-r"><span>' + escHtml(c.n) + ' <small>' + c.y + ' ' + wkName(c.w) + '</small></span><span>' + c.p + '%</span><span>+' + c.real + '</span><span>+' + c.est + '</span></div>';
            }).join('') + '</div><div class="mc-note">Its chance, the real price, and its estimate. If the misses are mostly stars it rates too low (a low chance with a short real price), the chance is off, not the pricing.</div></details>';
        }
      }
      body.innerHTML = h;
      var mp = document.getElementById('mc-picks');
      if (mp) mp.addEventListener('click', function() {
        mp.disabled = true; mp.textContent = 'Picking… (about a minute)';
        picksApi({ pin: SUB.pin, action: 'mpicks' }).then(function(x) {
          mp.disabled = false; mp.textContent = 'Make its picks now';
          if (x.error) { adminMsg(x.error, false); return; }
          if (typeof MACHINE !== 'undefined') MACHINE.data = null;
          adminMsg(x.made ? 'Made or refreshed ' + x.made + ' pick' + (x.made === 1 ? '' : 's') + '.' : 'Nothing new to pick right now.', true);
        }).catch(function() { mp.disabled = false; mp.textContent = 'Make its picks now'; adminMsg('It took too long to answer. Wait a minute and check the 🤖 Machine tab.', false); });
      });
      document.getElementById('mc-train').addEventListener('click', function() {
        var b = this; b.disabled = true; b.textContent = 'Training… (about a minute)';
        picksApi({ pin: SUB.pin, action: 'mtrain' }).then(function(x) {
          if (x.error) { b.disabled = false; b.textContent = 'Train now'; adminMsg(x.error, false); return; }
          adminMachine();
        }).catch(function() { b.disabled = false; b.textContent = 'Train now'; adminMsg('It took too long to answer. Wait a minute and reload: it probably finished.', false); });
      });
    }

    // ── 🏛️ Museum: John's notes, photos and moments (js/museum.js draws the page) ──
    var MUA = { edit: null, list: null };
    function adminMuseum() {
      MUA.edit = null;
      var body = adminScreen('museum', '<div class="loading">Loading the Museum…</div>');
      loadScriptOnce('js/museum.js').then(function() { return museumData(true); }).then(function(list) {
        MUA.list = list; drawAdminMuseum(body);
      }).catch(function() { body.innerHTML = '<div class="loading">Couldn\'t reach the script.</div>'; });
    }
    function muaSaved(id) { return (MUSEUM.saved || []).filter(function(m) { return m.id === id; })[0] || null; }
    function drawAdminMuseum(body) {
      if (!document.body.contains(body)) return; // left this tab before it loaded
      var E = MUA.edit, auto = E && !E.custom && E.id;
      var years = SEASONS.map(function(s) { return s.year; });
      var weeks = [''].concat(Array.apply(null, Array(18)).map(function(_, i) { return i + 1; })).concat([19, 20, 21, 23]);
      function sel(id, opts, val, dis) {
        return '<select class="adm-input" id="' + id + '"' + (dis ? ' disabled' : '') + '>' + opts.map(function(o) {
          var v = Array.isArray(o) ? o[0] : o, t = Array.isArray(o) ? o[1] : o;
          return '<option value="' + escHtml(String(v)) + '"' + (String(v) === String(val) ? ' selected' : '') + '>' + escHtml(String(t)) + '</option>';
        }).join('') + '</select>';
      }
      var h = '<div style="display:flex;justify-content:space-between;align-items:baseline;gap:10px;margin-bottom:10px">' +
        '<div style="font-size:12px;color:#A1A9B6">The site finds most moments by itself. Add your own, or give any moment a note, a photo or a ⭐. Hidden ones stay off the page.</div>' +
        '<button class="link-btn" id="mua-open" style="white-space:nowrap">Open the Museum →</button></div>';
      h += '<div class="pf-h">' + (E ? '✏️ Edit: ' + escHtml(E.title) : '➕ Add a moment') + '</div>' +
        '<div class="mua-form">' +
          '<label>Season' + sel('mua-season', years, E ? E.season : CURRENT_YEAR, auto) + '</label>' +
          '<label>Week' + sel('mua-week', weeks.map(function(w) { return [w, w ? wkName(w) : '—']; }), E ? (E.week === 99 ? '' : E.week || '') : '', auto) + '</label>' +
          '<label>Who' + sel('mua-who', [['', '—'], 'Maria', 'Danielle', 'Both'], E ? E.who || '' : '', auto) + '</label>' +
          '<label class="wide">Title' + '<input class="adm-input" id="mua-title" maxlength="90" placeholder="' + (auto ? escHtml(E.autoTitle || E.title) + ' (leave empty to keep)' : 'e.g. The Thanksgiving miracle') + '" value="' + escHtml(E && (E.custom || E.titleSet) ? E.title : '') + '"></label>' +
          '<label class="wide">Caption' + '<textarea class="adm-input" id="mua-cap" maxlength="500" placeholder="' + (auto ? escHtml(E.autoCaption || '') : 'What happened?') + '">' + escHtml(E && (E.custom || E.capSet) ? E.caption : '') + '</textarea></label>' +
          '<label class="wide">Photo (optional)<div class="mua-photo">' +
            '<input type="file" id="mua-file" accept="image/*" style="display:none"><button class="adm-btn" id="mua-pick" type="button">📷 Upload a photo</button>' +
            '<input class="adm-input" id="mua-photo" placeholder="or paste an image link (https://…)" style="flex:1;min-width:160px" value="' + escHtml(E && E.photo || '') + '">' +
            (E && E.photo ? '<img class="mua-thumb" id="mua-thumb" src="' + escHtml(E.photo) + '" alt="">' : '<img class="mua-thumb" id="mua-thumb" alt="" style="display:none">') +
          '</div></label>' +
          '<label class="wide" style="flex-direction:row;align-items:center;gap:8px;font-size:13px;color:#E5E7EB"><input type="checkbox" id="mua-star"' + (E && E.star ? ' checked' : '') + '> ⭐ Feature it (gold card, bigger with a photo)</label>' +
        '</div>' +
        '<button class="primary-btn" id="mua-save" style="padding:10px 20px">' + (E ? 'Save changes' : 'Add to the Museum') + '</button>' +
        (E ? ' <button class="link-btn" id="mua-cancel" style="margin-left:10px">Cancel</button>' : '') +
        '<div class="submit-msg" id="adm-msg" style="text-align:left"></div>';

      var list = MUA.list || [];
      h += '<div class="pf-h" style="margin-top:18px">🏛️ Everything in the Museum <small>' + list.filter(function(m) { return !m.hidden; }).length + ' showing · ' + list.filter(function(m) { return m.hidden; }).length + ' hidden</small></div>';
      list.forEach(function(m, i) {
        var tag = MU_TAGS[m.tag] || MU_TAGS.custom;
        h += '<div class="mua-row' + (m.hidden ? ' off' : '') + '"><div class="mua-ic">' + tag.ic + '</div><div class="mua-mid">' +
          '<div class="mua-t">' + (m.star ? '⭐ ' : '') + escHtml(m.title) + (m.photo ? ' 📷' : '') + '</div>' +
          '<div class="mua-s">' + (m.custom ? 'Yours' : tag.t) + (m.edited ? ' · edited' : '') + ' · ' + museumWhen(m) + (m.hidden ? ' · hidden' : '') + '</div></div>' +
          '<div class="mua-btns"><button class="adm-btn" data-mua-ed="' + i + '">Edit</button>' +
          '<button class="adm-btn" data-mua-hide="' + i + '">' + (m.hidden ? 'Show' : 'Hide') + '</button>' +
          (m.custom ? '<button class="adm-btn red" data-mua-rm="' + i + '">Delete</button>' : m.edited ? '<button class="adm-btn" data-mua-rm="' + i + '" title="Remove your note, photo and ⭐">Reset</button>' : '') +
          '</div></div>';
      });
      body.innerHTML = h;

      function val(id) { var x = document.getElementById(id); return x ? x.value : ''; }
      function refresh(res, msg) {
        if (res && res.museum) MUSEUM.saved = res.museum.items;
        museumData().then(function(l) { MUA.list = l; MUA.edit = null; drawAdminMuseum(body); adminMsg(msg, true); });
      }
      // Save one moment: the full row is written every time, so carry over what's already saved
      function save(m, changes, msg) {
        var cur = muaSaved(m.id) || {};
        var q = { pin: SUB.pin, action: 'museumsave', id: m.custom || cur.id ? m.id : (m.id || ''),
          season: m.season, week: m.week === 99 ? '' : (m.week || ''), who: m.who || '',
          title: cur.title || (m.custom ? m.title : ''), caption: cur.caption || (m.custom ? m.caption : ''), photo: cur.photo || '', star: cur.star ? '1' : '', hidden: cur.hidden ? '1' : '' };
        Object.keys(changes).forEach(function(k) { q[k] = changes[k]; });
        adminMsg('Saving…', true);
        return picksApi(q).then(function(res) {
          if (res.error) { adminMsg(res.error, false); return; }
          refresh(res, msg);
        }).catch(function() { adminMsg('Couldn\'t reach the script. Try again.', false); });
      }

      document.getElementById('mua-open').addEventListener('click', function() { switchTab('museum'); });
      var cancel = document.getElementById('mua-cancel');
      if (cancel) cancel.addEventListener('click', function() { MUA.edit = null; drawAdminMuseum(body); });
      var file = document.getElementById('mua-file'), thumb = document.getElementById('mua-thumb'), photo = document.getElementById('mua-photo');
      document.getElementById('mua-pick').addEventListener('click', function() { file.click(); });
      function showThumb(u) { if (u && /^https:\/\//.test(u)) { thumb.src = u; thumb.style.display = ''; } else thumb.style.display = 'none'; }
      photo.addEventListener('input', function() { showThumb(photo.value.trim()); });
      file.addEventListener('change', function() {
        if (!file.files || !file.files[0]) return;
        adminMsg('Uploading the photo…', true);
        museumUpload(SUB.pin, file.files[0]).then(function(r) {
          if (!r || r.error || !r.url) { adminMsg((r && r.error) || 'The upload didn\'t work.', false); return; }
          photo.value = r.url; showThumb(r.url); adminMsg('Photo uploaded. Save to keep it.', true);
        }).catch(function() { adminMsg('The upload didn\'t work. Make sure Museum.gs is in Apps Script and you ran authorizeMuseumPhotos once.', false); });
      });
      document.getElementById('mua-save').addEventListener('click', function() {
        var title = val('mua-title').trim(), cap = val('mua-cap').trim(), ph = val('mua-photo').trim(), star = document.getElementById('mua-star').checked ? '1' : '';
        if (ph && !/^https:\/\//.test(ph)) { adminMsg('The photo link has to start with https://', false); return; }
        if (!E) {
          if (!title) { adminMsg('Give the moment a title.', false); return; }
          return save({ id: '', custom: true, season: val('mua-season'), week: val('mua-week'), who: val('mua-who') },
            { id: '', title: title, caption: cap, photo: ph, star: star, hidden: '' }, 'Added to the Museum. 🏛️');
        }
        var ch = { title: title, caption: cap, photo: ph, star: star };
        if (E.custom) { if (!title) { adminMsg('Give the moment a title.', false); return; } ch.season = val('mua-season'); ch.week = val('mua-week'); ch.who = val('mua-who'); }
        save(E, ch, 'Saved.');
      });
      body.querySelectorAll('[data-mua-ed]').forEach(function(b) {
        b.addEventListener('click', function() {
          var m = list[+b.getAttribute('data-mua-ed')], cur = muaSaved(m.id) || {};
          MUA.edit = Object.assign({}, m, { titleSet: !!cur.title, capSet: !!cur.caption, autoTitle: m.custom ? '' : (cur.title ? '' : m.title), autoCaption: m.custom ? '' : (cur.caption ? '' : m.caption) });
          drawAdminMuseum(body); window.scrollTo(0, 0);
        });
      });
      body.querySelectorAll('[data-mua-hide]').forEach(function(b) {
        b.addEventListener('click', function() { var m = list[+b.getAttribute('data-mua-hide')]; save(m, { hidden: m.hidden ? '' : '1' }, m.hidden ? 'Back on display.' : 'Hidden from the Museum.'); });
      });
      body.querySelectorAll('[data-mua-rm]').forEach(function(b) {
        b.addEventListener('click', function() {
          var m = list[+b.getAttribute('data-mua-rm')];
          if (!confirm(m.custom ? 'Delete "' + m.title + '" from the Museum?' : 'Remove your note, photo and ⭐ from "' + m.title + '"?')) return;
          adminMsg('Saving…', true);
          picksApi({ pin: SUB.pin, action: 'museumrm', id: m.id }).then(function(res) {
            if (res.error) { adminMsg(res.error, false); return; }
            refresh(res, m.custom ? 'Deleted.' : 'Back to the automatic version.');
          }).catch(function() { adminMsg('Couldn\'t reach the script. Try again.', false); });
        });
      });
    }

    // ── 🥚 Easter eggs: the answer key (js/eggs.js has the actual eggs) ──────
    var EGG_GUIDE = [
      { k: 'campbell', ic: '🐶', t: 'Campbell Dingus', how: 'Tap Campbell Dingus at the very bottom of any page 5 times, quickly (within about 2 seconds).', what: 'Campbell rains down the screen: "Campbell Dingus has entered the chat."' },
      { k: 'kelce', ic: '🏈', t: 'KELCE', how: 'On a computer, type K-E-L-C-E anywhere (not inside a text box).', what: 'Football and 87 confetti.' },
      { k: 'rivalry', ic: '⚔️', t: 'The rivalry', how: 'On Stats, press and hold the VS badge between Maria and Danielle for a second and a half.', what: 'The badge shakes and shows the all-time head-to-head in units.' },
      { k: 'retro', ic: '🕹️', t: 'Retro mode', how: 'On a computer, type the Konami code: ↑ ↑ ↓ ↓ ← → ← → B A.', what: 'Pixel arcade font and scanlines. Do it again (or reload) to turn it off.' },
      { k: 'roll', ic: '🌀', t: 'Barrel roll', how: 'On Stats, tap the season title ("2026 Touchdown Bets") 3 times quickly.', what: 'The title does a barrel roll.' },
    ];
    function adminEggs() {
      var got = {};
      try { got = JSON.parse(localStorage.getItem('mvd-eggs') || '{}'); } catch (e) {}
      var n = EGG_GUIDE.filter(function(e) { return got[e.k]; }).length;
      var h = '<div style="font-size:12px;color:#A1A9B6;margin-bottom:14px">The hidden extras, and how to set each one off. Nobody else sees this list. Finding one shows "🥚 Easter egg N of ' + EGG_GUIDE.length + ' found!", counted per phone.</div>' +
        '<div class="pf-h">🥚 Easter eggs <small>' + n + ' of ' + EGG_GUIDE.length + ' found on this device</small></div>' +
        EGG_GUIDE.map(function(e) {
          return '<div class="egg-row' + (got[e.k] ? ' got' : '') + '"><div class="egg-ic">' + e.ic + '</div><div><div class="egg-t">' + e.t + (got[e.k] ? ' <span class="egg-got">✓ found</span>' : '') + '</div>' +
            '<div class="egg-how"><b>How:</b> ' + e.how + '</div><div class="egg-what"><b>What happens:</b> ' + e.what + '</div></div></div>';
        }).join('') +
        '<div style="margin-top:14px"><button class="adm-btn" id="egg-reset">Reset found eggs on this device</button></div><div class="submit-msg" id="adm-msg" style="text-align:left"></div>';
      var body = adminScreen('eggs', h);
      document.getElementById('egg-reset').addEventListener('click', function() {
        try { localStorage.removeItem('mvd-eggs'); } catch (e) {}
        adminEggs(); adminMsg('Reset. Every egg counts as new again on this device.', true);
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
        if (!document.body.contains(body)) return; // left this tab before it loaded
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
        h += '<div class="submit-msg" id="adm-msg" style="text-align:left"></div>';
        h += '<div class="pf-h" style="margin-top:18px">✅ Ready for ' + (pend ? pend.year : cur.year) + '? <small><button class="link-btn" id="ns-recheck">Check again</button></small></div><div id="ns-check"><div class="loading">Checking…</div></div>';
        h += '<div style="font-size:11px;color:#6B7280;margin-top:14px">Keep editing the scripts in the 2026 sheet\'s Apps Script. The new sheet gets a copy of them only so the team colors keep working there.</div>';
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
        // ✅ The checklist: the script looks at the sheet, this page checks the website's config.js
        function drawCheck() {
          var box = document.getElementById('ns-check');
          if (!box) return;
          box.innerHTML = '<div class="loading">Checking…</div>';
          picksApi({ pin: SUB.pin, action: 'seasoncheck' }).then(function(c) {
            if (c.error || !c.items) { box.innerHTML = '<div class="inj-warn">' + escHtml(c.error || 'The picks script that\'s live is older. Deploy → Manage deployments → ✏️ → New version → Deploy.') + '</div>'; return; }
            var items = c.items.slice();
            var listed = SEASONS.some(function(x) { return x.year === c.year; });
            items.splice(items.length - 2, 0, { state: !pend && CURRENT_YEAR === c.year ? 'ok' : pend ? 'now' : listed ? 'ok' : 'bad', label: 'Website shows ' + c.year,
              detail: CURRENT_YEAR === c.year ? 'config.js lists it as the current season.' : pend ? 'After switching, upload the new config.js (step 4).' : 'Upload the new config.js (step 4). The site still shows ' + CURRENT_YEAR + '.' });
            var bad = items.filter(function(x) { return x.state === 'bad' || x.state === 'warn' || x.state === 'now'; }).length;
            box.innerHTML = '<div class="ns-sum ' + (bad ? 'todo' : 'ready') + '">' + (bad ? bad + ' thing' + (bad === 1 ? '' : 's') + ' left before ' + c.year + ' is ready' : '🎉 All set for ' + c.year + '.') + '</div>' +
              items.map(function(x) {
                var ic = x.state === 'ok' ? '✅' : x.state === 'warn' ? '⚠️' : x.state === 'bad' ? '❌' : x.state === 'now' ? '👉' : 'ℹ️';
                return '<div class="st-row"><span class="st-ic">' + ic + '</span><div><div class="st-l">' + escHtml(x.label) + '</div>' + (x.detail ? '<div class="st-d">' + escHtml(x.detail) + '</div>' : '') + '</div></div>';
              }).join('');
          }).catch(function() { box.innerHTML = '<div class="loading">Couldn\'t reach the script.</div>'; });
        }
        drawCheck();
        document.getElementById('ns-recheck').addEventListener('click', drawCheck);
        var cp = document.getElementById('ns-copy');
        if (cp) cp.addEventListener('click', function() {
          var ta = document.getElementById('ns-config'); ta.select();
          (navigator.clipboard ? navigator.clipboard.writeText(ta.value) : Promise.reject()).catch(function() { document.execCommand('copy'); });
          cp.textContent = 'Copied ✓';
        });
      }).catch(function() { body.innerHTML = '<div class="loading">Couldn\'t reach the script.</div>'; });
    }

    // ── 🏈 Games: add a game (two rows, Maria + Danielle) or take out one nobody has picked ──
    var GAMES = { showAll: false, edit: null }; // edit = the game loaded into the form for editing
    function adminGames() {
      GAMES.edit = null;
      var body = adminScreen('games', '<div class="loading">Loading games…</div>');
      picksApi({ pin: SUB.pin, action: 'gamelist' }).then(function(r) {
        if (r.error) { body.innerHTML = '<div class="loading">' + escHtml(r.error) + '</div>'; return; }
        if (!r.games) { body.innerHTML = '<div class="inj-warn">⚠️ The picks script that\'s live is an older version. In Apps Script: <b>Deploy → Manage deployments → ✏️ → Version: New version → Deploy</b>, then reload.</div>'; return; }
        drawGames(body, r);
      }).catch(function() { body.innerHTML = '<div class="loading">Couldn\'t reach the script.</div>'; });
    }
    function drawGames(body, r) {
      if (!document.body.contains(body)) return; // left this tab before it loaded
      var teams = Object.keys(TEAM_ABBR).sort();
      function teamSel(id) {
        return '<select class="adm-input" id="' + id + '"><option value="">Pick a team</option>' + teams.map(function(t) { return '<option>' + escHtml(t) + '</option>'; }).join('') + '</select>';
      }
      function nick(t) { return escHtml(resolveTeam(t).split(' ').pop()); }
      var E = GAMES.edit;
      var h = '<div class="pf-h" style="margin-top:4px">' + (E ? '✏️ Edit ' + weekName(E.week) + ': ' + nick(E.home) + ' vs ' + nick(E.away) : '➕ Add a game') + ' <small>' + CURRENT_YEAR + ' sheet</small></div>' +
        '<div class="ag-form">' +
          '<label>Week <span class="ag-hint">playoffs: 19 WC · 20 DIV · 21 CONF · 23 SB</span><input class="adm-input" id="ag-week" type="number" min="1" max="30" value="' + (r.lastWeek || 1) + '"></label>' +
          '<label>Time<input class="adm-input" id="ag-slot" list="ag-slots" placeholder="TNF, SNF…"><datalist id="ag-slots">' + (r.slots || []).map(function(x) { return '<option value="' + escHtml(x) + '">'; }).join('') + '</datalist></label>' +
          '<label>Home team' + teamSel('ag-home') + '</label>' +
          '<label>Away team' + teamSel('ag-away') + '</label>' +
          '<label>Amount bet<input class="adm-input" id="ag-amt" type="number" min="1" step="any" value="' + escHtml(r.amount || '5') + '"></label>' +
        '</div>' +
        '<div class="ag-note" id="ag-note"></div>' +
        '<button class="primary-btn" id="ag-add" style="padding:10px 20px">' + (E ? 'Save changes' : 'Add game') + '</button>' +
        (E ? ' <button class="link-btn" id="ag-cancel" style="margin-left:10px">Cancel</button>' : '') +
        '<div class="submit-msg" id="adm-msg" style="text-align:left"></div>' +
        '<div style="font-size:11px;color:#6B7280;margin:8px 0 20px">' + (E
          ? 'Changes both rows (' + E.rows.join(' and ') + '), Maria\'s and Danielle\'s. Only works while nobody has picked in it. If friends already picked it, only the time can change.'
          : 'Adds two rows right below the last game (game ' + r.nextGame + '), one for Maria and one for Danielle, with the formulas, dropdowns and team colors. Odds start as "+" like always.') + '</div>';
      // Game list: the latest two weeks, the rest behind a button
      var weeks = [], byWeek = {};
      r.games.forEach(function(g) { if (!byWeek[g.week]) { byWeek[g.week] = []; weeks.push(g.week); } byWeek[g.week].push(g); });
      weeks.sort(function(a, b) { return b - a; });
      var shown = GAMES.showAll ? weeks : weeks.slice(0, 2);
      h += '<div class="pf-h">📋 Games in the sheet <small>' + r.games.length + ' games</small></div>';
      if (!weeks.length) h += '<div style="font-size:13px;color:#A1A9B6">No games yet.</div>';
      shown.forEach(function(w) {
        h += '<div class="ag-wk">' + weekName(w) + '</div>';
        byWeek[w].forEach(function(g) {
          var state = g.scorer ? '<span class="ag-st">🏈 ' + escHtml(g.scorer) + '</span>' : g.picked ? '<span class="ag-st">picked</span>' : '';
          h += '<div class="adm-row"><div style="min-width:0"><b>' + nick(g.home) + '</b> vs <b>' + nick(g.away) + '</b> <span style="color:#9CA3AF">· ' + escHtml(g.slot || '—') + ' · game ' + escHtml(g.game) + ' · rows ' + g.rows.join(', ') + '</span></div>' +
            (g.picked || g.scorer ? state : '<span style="white-space:nowrap"><button class="adm-btn" data-edg="' + g.week + '|' + escHtml(g.game) + '">Edit</button> ' +
              '<button class="adm-btn red" data-rmg="' + g.week + '|' + escHtml(g.game) + '|' + nick(g.home) + ' vs ' + nick(g.away) + '">Remove</button></span>') + '</div>';
        });
      });
      if (weeks.length > 2) h += '<button class="link-btn" id="ag-all" style="margin-top:10px">' + (GAMES.showAll ? 'Show only the latest weeks' : 'Show all ' + weeks.length + ' weeks') + '</button>';
      body.innerHTML = h;

      var wk = document.getElementById('ag-week'), note = document.getElementById('ag-note');
      if (E) { // load the game into the form
        wk.value = E.week; document.getElementById('ag-slot').value = E.slot || '';
        document.getElementById('ag-home').value = resolveTeam(E.home) || E.home; document.getElementById('ag-away').value = resolveTeam(E.away) || E.away;
        document.getElementById('ag-amt').value = E.amount || r.amount || '5';
      }
      function warnOrder() {
        var w = parseInt(wk.value, 10);
        var t = [];
        if (isPlayoffWeek(w)) t.push('🏆 Week ' + w + ' = ' + weekName(w) + (w === 22 ? ' (there are no games that week; the Super Bowl is 23)' : '') + '.');
        if (!E && w && w < r.lastWeek) t.push('Heads-up: this goes at the bottom of the sheet, after the ' + weekName(r.lastWeek) + ' games. Picking still goes in week order, so it comes up when it should.');
        note.textContent = t.join(' ');
      }
      wk.addEventListener('input', warnOrder); warnOrder();
      function reload(msg, ok) {
        clearSheetCache(); ALL_BETS_PROMISE = null;
        picksApi({ pin: SUB.pin, action: 'gamelist' }).then(function(r2) { drawGames(body, r2); adminMsg(msg, ok); });
      }
      var cancel = document.getElementById('ag-cancel');
      if (cancel) cancel.addEventListener('click', function() { GAMES.edit = null; drawGames(body, r); });
      document.getElementById('ag-add').addEventListener('click', function() {
        var btn = this;
        var p = { pin: SUB.pin, action: E ? 'editgame' : 'addgame', week: E ? E.week : wk.value, slot: document.getElementById('ag-slot').value.trim(),
          home: document.getElementById('ag-home').value, away: document.getElementById('ag-away').value, amount: document.getElementById('ag-amt').value };
        if (E) { p.game = E.game; p.newweek = wk.value; }
        if (!p.home || !p.away) return adminMsg('Pick both teams.');
        if (p.home === p.away) return adminMsg('Home and away are the same team.');
        if (!p.slot && !confirm('No time (TNF, SNF…) filled in. ' + (E ? 'Save' : 'Add') + ' it anyway?')) return;
        btn.disabled = true; adminMsg(E ? 'Saving…' : 'Adding…', true);
        picksApiOnce(p).then(function(x) { // once: a retry could add it twice
          btn.disabled = false;
          if (x.error) return adminMsg(x.error);
          if (E) { GAMES.edit = null; return reload('✅ Saved ' + weekName(x.week) + ': ' + x.home + ' vs ' + x.away + (x.slot ? ' (' + x.slot + ')' : '') + ', rows ' + x.rows.join(' and ') + '.', true); }
          reload('✅ Added ' + weekName(x.week) + ': ' + x.home + ' vs ' + x.away + ' (rows ' + x.rows.join(' and ') + ').' + (x.warn ? ' ⚠️ ' + x.warn : ''), !x.warn);
        }).catch(function() { btn.disabled = false; adminMsg('Couldn\'t reach the script. Check the sheet before trying again, it may have gone through.'); });
      });
      body.querySelectorAll('[data-edg]').forEach(function(b) {
        b.addEventListener('click', function() {
          var k = b.getAttribute('data-edg').split('|');
          GAMES.edit = r.games.filter(function(g) { return String(g.week) === k[0] && String(g.game) === k[1]; })[0] || null;
          drawGames(body, r);
          var top = document.getElementById('adm-body'); if (top) top.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
      });
      var all = document.getElementById('ag-all');
      if (all) all.addEventListener('click', function() { GAMES.showAll = !GAMES.showAll; drawGames(body, r); });
      body.querySelectorAll('[data-rmg]').forEach(function(b) {
        b.addEventListener('click', function() {
          var parts = b.getAttribute('data-rmg').split('|');
          if (!confirm('Remove ' + weekName(parts[0]) + ' ' + parts[2] + '? Both rows go (Maria and Danielle). Nobody has picked in it yet.')) return;
          b.disabled = true; b.textContent = 'Removing…'; GAMES.edit = null;
          picksApiOnce({ pin: SUB.pin, action: 'rmgame', week: parts[0], game: parts[1] }).then(function(x) {
            if (x.error) { b.disabled = false; b.textContent = 'Remove'; return adminMsg(x.error); }
            clearSheetCache(); ALL_BETS_PROMISE = null;
            picksApi({ pin: SUB.pin, action: 'gamelist' }).then(function(r2) {
              drawGames(body, r2);
              adminMsg(x.how === 'gap' ? 'Removed, but the sheet wouldn\'t let the rows below move up, so rows ' + x.rows.join(' and ') + ' are blank now. Delete them in the sheet if you want.' : '✅ Removed ' + weekName(parts[0]) + ' ' + parts[2] + '.', x.how !== 'gap');
            });
          }).catch(function() { b.disabled = false; b.textContent = 'Remove'; adminMsg('Couldn\'t reach the script.'); });
        });
      });
    }

    // ── 🎯 Machine Lines: real FanDuel odds for the Machine's correct picks ──
    function adminMachineLines() {
      var body = adminScreen('mlines', '<div class="loading">Loading its correct picks…</div>');
      picksApi({ pin: SUB.pin, action: 'mlines' }).then(function(r) { drawMachineLines(body, r); })
        .catch(function() { body.innerHTML = '<div class="loading">Couldn\'t reach the script.</div>'; });
    }
    function drawMachineLines(body, r) {
      if (!document.body.contains(body)) return; // left this tab before it loaded
      if (r.error) { body.innerHTML = '<div class="inj-warn">' + escHtml(r.error) + '</div>'; return; }
      if (!r.lines) { body.innerHTML = '<div class="inj-warn">⚠️ The picks script that\'s live is older. Deploy → Manage deployments → ✏️ → New version → Deploy, then reload.</div>'; return; }
      var need = r.lines.filter(function(x) { return !x.real && !x.mine; }).length;
      var h = '<div style="font-size:12px;color:#A1A9B6;margin-bottom:12px">The Machine\'s correct picks in ' + escHtml(r.season) + '. A miss costs 1 unit at any price, so only these need real odds. ' +
        'Type FanDuel\'s price to replace its estimate. Clear the box to go back to the estimate.</div>';
      if (!r.lines.length) {
        body.innerHTML = h + '<div class="mc-note" style="text-align:center;margin:18px 0">No correct picks yet this season.</div>';
        return;
      }
      h += '<div class="mll-sum">' + (need ? '⚠️ <b>' + need + '</b> still on an estimate' : '✅ Every correct pick has real odds') + '</div><div class="submit-msg" id="adm-msg" style="text-align:left"></div>';
      r.lines.forEach(function(x, i) {
        var src = x.real ? '<span class="mll-src">Real · same pick as Maria/Danielle</span>' : x.mine ? '<span class="mll-src ok">Real · you entered it</span>' : '<span class="mll-src est">Estimate +' + x.est + '</span>';
        h += '<div class="mll-row"><div class="mll-l"><div class="mll-p">✅ ' + escHtml(x.player) + ' <small>' + escHtml(x.team) + '</small></div>' +
          '<div class="mll-g">' + wkName(parseInt(x.week, 10)) + ' · ' + escHtml(x.away) + ' @ ' + escHtml(x.home) + (x.retro ? ' · after the fact' : '') + '</div>' + src + '</div>' +
          (x.real ? '<b class="mll-odds">+' + x.real + '</b>' :
            '<div class="mll-in"><input class="adm-input" data-mll="' + i + '" inputmode="decimal" autocomplete="off" placeholder="+' + x.est + ' est" value="' + (x.mine ? '+' + x.mine : '') + '" style="width:96px;text-align:center">' +
            '<button class="adm-btn green" data-mll-save="' + i + '">Save</button></div>') + '</div>';
      });
      body.innerHTML = h;
      body.querySelectorAll('[data-mll-save]').forEach(function(b) {
        b.addEventListener('click', function() {
          var i = +b.getAttribute('data-mll-save'), x = r.lines[i], inp = body.querySelector('[data-mll="' + i + '"]');
          var val = inp.value.trim();
          if (val && !(parseFloat(val.replace('+', '')) > 0)) { adminMsg('Odds should look like +475.'); return; }
          b.disabled = true; b.textContent = 'Saving…';
          picksApi({ pin: SUB.pin, action: 'mlineset', game: x.game, side: x.side, player: x.player, odds: val }).then(function(res) {
            if (res.error) { b.disabled = false; b.textContent = 'Save'; adminMsg(res.error); return; }
            if (typeof MACHINE !== 'undefined' && MACHINE) { MACHINE.data = null; MACHINE.loading = null; } // the Machine tab reloads with the new price
            drawMachineLines(body, res);
            adminMsg(val ? 'Saved. ' + x.player + ' now pays at the real price.' : 'Cleared. Back to the estimate.', true);
          }).catch(function() { b.disabled = false; b.textContent = 'Save'; adminMsg('Couldn\'t reach the script.'); });
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
      if (section === 'season') adminSeason();
      if (section === 'theme') adminTheme();
      if (section === 'bracket') adminBracket();
      if (section === 'museum') adminMuseum();
      if (section === 'machine') adminMachine();
      if (section === 'mlines') adminMachineLines();
      if (section === 'eggs') adminEggs();
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
      if (!document.body.contains(body)) return; // left this tab before it loaded
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
          var where = r ? r.year + ' sheet · row ' + r.row + ' · ' + wkName(r.week) + ' · ' + r.picker : '';
          issues.push({ level: level, title: title, where: where, text: text, fix: fix, key: dcKey(title + '|' + where + '|' + text) });
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
          var label = weekName(a.week) + ' game ' + a.game;
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

        // Items John marked "it's fine" stay hidden while their text is the same
        var okKeys = {}; (ADMIN.dcOk || []).forEach(function(x) { okKeys[x.k] = 1; });
        var fine = issues.filter(function(x) { return okKeys[x.key]; });
        issues = issues.filter(function(x) { return !okKeys[x.key]; });
        var bad = issues.filter(function(x) { return x.level === 'bad'; }).length;
        var h = '';
        var fineHtml = fine.length ? '<details class="chk-more dc-fine"><summary class="link-btn">✓ ' + fine.length + ' marked as fine</summary>' + fine.map(function(x) {
          return '<div class="dc-fine-row"><div><b>' + x.title + '</b> <span style="color:#9CA3AF">' + escHtml(x.where) + '</span><div>' + escHtml(x.text) + '</div></div>' +
            '<button class="adm-btn" data-dcundo="' + x.key + '">Undo</button></div>';
        }).join('') + '</details>' : '';
        if (!issues.length) {
          h += '<div class="st-row"><span class="st-ic">✅</span><div><div class="st-l">Every season checks out</div><div class="st-d">No spelling mismatches, wrong sides, odd-looking odds or mismatched game rows' + (fine.length ? ', apart from what you marked as fine' : '') + '.</div></div></div>';
        } else {
          h += '<div style="font-size:13px;font-weight:700;margin-bottom:12px">' + issues.length + ' thing' + (issues.length > 1 ? 's' : '') + ' to look at' + (bad ? ' · ' + bad + ' affect the totals' : '') + '</div>';
          issues.sort(function(a, b) { return (a.level === 'bad' ? 0 : 1) - (b.level === 'bad' ? 0 : 1); });
          var card = function(x) {
            return '<div class="adm-issue ' + (x.level === 'bad' ? 'bad' : '') + '"><div class="t" style="color:' + (x.level === 'bad' ? '#FCA5A5' : '#FCD34D') + '">' + x.title + '</div>' +
              (x.where ? '<div style="font-size:11px;color:#A1A9B6;margin-bottom:3px">' + x.where + '</div>' : '') +
              '<div>' + escHtml(x.text) + '</div><div class="fix">→ ' + escHtml(x.fix) + '</div>' +
              '<div class="dc-act"><button class="adm-btn green" data-dcok="' + x.key + '" data-dclabel="' + escHtml((x.title + ': ' + x.text).slice(0, 90)) + '">✓ It\'s fine</button>' +
              '<span>Hides it until something in that row changes.</span></div></div>';
          };
          // First 5 up front; the rest behind a button so Versions doesn't get buried
          h += issues.slice(0, 5).map(card).join('');
          if (issues.length > 5) h += '<details class="chk-more"><summary class="adm-btn">Show the other ' + (issues.length - 5) + '</summary>' + issues.slice(5).map(card).join('') + '</details>';
        }
        return h + fineHtml;
    }
    // Short fingerprint of an item's exact text (djb2), so "it's fine" sticks to that exact item
    function dcKey(str) {
      var h = 5381;
      for (var i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) >>> 0;
      return 'k' + h.toString(36) + str.length.toString(36);
    }
    function dcCounts(rows) {
      var d = document.createElement('div'); d.innerHTML = dataCheckHtml(rows);
      return { issues: d.querySelectorAll('.adm-issue').length, bad: d.querySelectorAll('.adm-issue.bad').length };
    }
    // Draw the Data check into el, with working "It's fine" / Undo buttons
    function drawDataCheck(el, rows) {
      el.innerHTML = dataCheckHtml(rows);
      var openFine = false;
      el.querySelectorAll('[data-dcok], [data-dcundo]').forEach(function(b) {
        b.addEventListener('click', function() {
          var ok = b.hasAttribute('data-dcok');
          b.disabled = true; b.textContent = ok ? 'Saving…' : 'Undoing…';
          openFine = !ok;
          picksApi({ pin: SUB.pin, action: ok ? 'dcok' : 'dcundo', key: b.getAttribute(ok ? 'data-dcok' : 'data-dcundo'), label: b.getAttribute('data-dclabel') || '' }).then(function(r) {
            if (r.error || !r.dcOk) { b.disabled = false; b.textContent = r.error || 'Didn\'t save (old script?)'; return; }
            ADMIN.dcOk = r.dcOk;
            if (ADMIN.alert) { var c = dcCounts(rows); ADMIN.alert.issues = c.issues; ADMIN.alert.bad = c.bad; }
            drawDataCheck(el, rows);
            var f = el.querySelector('.dc-fine'); if (f && openFine) f.open = true;
          }).catch(function() { b.disabled = false; b.textContent = 'Couldn\'t reach the script'; });
        });
      });
    }
