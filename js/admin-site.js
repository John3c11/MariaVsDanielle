// Admin, ⚙️ Site: Status (jobs, Data check, Game Day test), Theme, Eggs, PINs
// Loaded by admin.js (showAdmin) the first time you open this section. Part of the MariaVsDanielle site; shares the global scope.

    // 🔑 PINs screen (⚙️ Site): rarely changed, so it lives out of the way
    function adminPins() {
      adminScreen('pins', '<div class="u-mt-0 pf-h">🔑 Main PINs <small>no code edits needed</small></div>' +
        '<div class="ui-note u-mb">Maria\'s, Danielle\'s and your login. Changing one works right away. Friends\' PINs are on 👥 People → Friends.</div>' +
        '<div id="main-pins"><div class="loading">Loading…</div></div><div class="u-ta-left submit-msg" id="adm-msg"></div>');
      drawMainPins();
    }
    // 🔑 Maria's, Danielle's and John's PINs (kept in the script's settings, changeable here)
    function drawMainPins() {
      var box = document.getElementById('main-pins');
      if (!box) return;
      picksApi({ pin: SUB.pin, action: 'pins' }).then(function(r) {
        if (!r.pins) { box.innerHTML = '<div class="u-m-0 inj-warn">Changing these needs the newest PicksAPI.gs (Deploy → Manage deployments → ✏️ → New version → Deploy).</div>'; return; }
        var who = [['Maria', SB_M], ['Danielle', SB_D], ['ADMIN', '#E5E7EB']];
        box.innerHTML = who.map(function(w) {
          return '<div class="adm-row"><div><b style="color:' + w[1] + '">' + (w[0] === 'ADMIN' ? 'You (admin)' : w[0]) + '</b> <span class="u-c-muted u-ls-0-15em u-ml-6px mp-pin">••••</span></div>' +
            '<div class="u-d-flex u-gap-6px"><button class="adm-btn" data-mp-show="' + w[0] + '">Show</button><button class="adm-btn" data-mp-set="' + w[0] + '">Change</button></div></div>';
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
          (last ? 'Last run ' + ago(last.at) + ' · ' + (last.ok ? 'worked' : '<b class="u-bad">failed</b>') + (last.ms != null ? ' · took ' + dur(last.ms) : '') + (last.calls ? ' · ' + last.calls + ' outside calls' : '') : 'No runs logged yet (logging starts with this version).') +
          (j.fails ? '<br><b class="u-bad">' + j.fails + ' failure' + (j.fails > 1 ? 's' : '') + ' in a row</b>' + (j.fails >= 2 ? ' · you were emailed' : '') : '') +
          (last && !last.ok ? '<div class="st-log">' + escHtml(last.err || '') + '</div>' : '') +
          (j.triggers > 1 ? '<br>⚠️ ' + j.triggers + ' timers for this job (it runs ' + j.triggers + '× too often). Press 🔧 Fix timers.' : '') +
          (stale && j.triggers ? '<br>⚠️ Hasn\'t run for a while (expected ' + j.every + ').' : '') +
          (next && !j.running ? '<br><span class="u-c-faint">Next: about ' + next.toLocaleString([], { weekday: 'short', hour: 'numeric', minute: '2-digit' }) + ' (' + j.every + ')</span>' : '');
        var hist = j.runs.length > 1 ? '<details class="jb-hist"><summary>Last ' + j.runs.length + ' runs</summary>' + j.runs.map(function(r) {
          return '<div class="jb-run' + (r.ok ? '' : ' bad') + '"><span>' + (r.ok ? '✅' : '❌') + ' ' + new Date(r.at).toLocaleString([], { weekday: 'short', month: 'numeric', day: 'numeric', hour: 'numeric', minute: '2-digit' }) + '</span><span>' + dur(r.ms) + (r.calls ? ' · ' + r.calls + ' calls' : '') + '</span>' +
            (r.ok ? (r.note ? '<em>' + escHtml(r.note) + '</em>' : '') : '<em>' + escHtml(r.err || '') + '</em>') + '</div>';
        }).join('') + '</details>' : '';
        return '<div class="st-row"><span class="st-ic">' + ic + '</span><div class="u-f-1 u-minw-0"><div class="st-l">' + escHtml(j.name) + '</div><div class="st-d">' + sub + '</div>' + hist + '</div></div>';
      }).join('');
      var q = J.quota;
      return '<div class="pf-h">⏱️ Background jobs <small>' + (bad ? bad + ' need' + (bad === 1 ? 's' : '') + ' a look' : 'all healthy') + '</small></div>' + rows +
        (J.orphans && J.orphans.length ? '<div class="st-row"><span class="st-ic">⚠️</span><div><div class="st-l">Leftover timers</div><div class="st-d">' + J.orphans.map(escHtml).join(', ') + ' (those jobs don\'t exist anymore). 🔧 Fix timers removes them.</div></div></div>' : '') +
        '<div class="jb-qs"><div class="u-mb-6px st-l">📊 Today\'s Google limits</div>' + bar('Calls to outside sites (ESPN…)', q.fetch, q.limits.fetch, '') + bar('Timed-job run time', q.runMin, q.limits.runMin, ' min') +
        '<div class="u-mt-xs st-d">Counted by the scripts themselves (Google doesn\'t show this). Resets at midnight.</div></div>' +
        '<div class="u-m-10px-0-18px"><button class="adm-btn" id="jb-fix">🔧 Fix timers</button> <span class="u-fs-11-5px u-c-faint">One timer per job, missing ones added, leftovers removed.</span><div class="u-ta-left submit-msg" id="jb-msg"></div></div>';
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
        return when + ' <span class="u-c-faint">(' + new Date(iso).toLocaleString([], { weekday: 'short', hour: 'numeric', minute: '2-digit' }) + ')</span>';
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
        var h = '<div class="u-fs-12px u-c-muted u-mb-10px">Everything the site depends on, checked right now. <button class="link-btn" id="st-again">Check again</button></div>';
        var dataSlot = '<div class="pf-h">🔍 Data check <small>every season, every row</small></div><div id="st-data"><div class="loading">Checking every row in every season…</div></div>';
        if (s.jobs) h += jobsHtml(s.jobs, ago);
        h += '<div class="pf-h">🔌 Connections</div>';
        h += row('info', '📺 Game Day', 'Only shows up while a game they both picked is live. <button class="adm-btn" id="gd-test">Test it on the last game</button>' +
          '<br><span class="u-c-faint">Opens the most recent finished game they both picked, with the final box score, plays and the touchdown moment.</span>');
        h += row(sh.ok ? 'ok' : 'bad', 'Google Sheets (from this browser)', sh.ok ? 'Reachable · ' + sh.ms + ' ms' : 'Not reachable' + (sh.code ? ' (HTTP ' + sh.code + (sh.code === 429 ? ', too many requests: wait a minute' : sh.code === 403 ? ', check the API key limits' : '') + ')' : ''));
        h += row(CSS_CHECK.stale ? 'bad' : 'ok', '🎨 style.css', CSS_CHECK.stale
          ? 'The live style.css is <b>older</b> than the page (style v' + escHtml(CSS_CHECK.have || '?') + ', page v' + escHtml(CSS_CHECK.want) + '). Some screens will look broken until you upload the newest style.css to GitHub.'
          : 'Matches the page' + (CSS_CHECK.want ? ' (v' + escHtml(CSS_CHECK.want) + ')' : ''));
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
            return row(list.length ? 'warn' : 'ok', label + (list.length ? ': ' + list.length : ''), list.length ? list.slice(0, 8).join(' · ') + (list.length > 8 ? ' · +' + (list.length - 8) + ' more' : '') + '<br><span class="u-c-faint">' + fix + '</span>' : 'None');
          }
          h += gapRow(gp.noScorer, 'Finished games with no first scorer', 'FirstTD fills these on its next run. If it\'s been hours, type it into column L.');
          h += gapRow(gp.noSide, 'Scored games missing Home/Away', 'FirstTD fills column N on its next run, or type Home/Away yourself.');
          h += gapRow(gp.noOdds, 'Scored games missing odds', 'Enter them on the 💲 Odds screen.');
          h += gapRow(gp.noPlayers || [], 'Games with no players to pick', 'Run fixGameRows in Apps Script (it fills in the hidden player lists). If one still shows after that, its team name doesn\'t match the Rosters tab.');
          var no = gp.notOffered || [];
          h += row('info', 'Games where the scorer wasn\'t offered' + (no.length ? ': ' + no.length : ''), no.length ? no.join(' · ') + '<br><span class="u-c-faint">These count 0 units. If one is wrong, clear that game\'s column O cells and FirstTD re-checks it on its next run.</span>' : 'None');
          h += dataSlot;
          var errs = s.errors || [], seen = errSeen();
          h += '<div class="pf-h">📱 Errors from phones <small>last 15 kept</small></div>';
          if (!errs.length) h += row('ok', 'No errors reported', 'If the site breaks on someone\'s phone, it shows up here.');
          else {
            h += errs.slice(0, 10).map(function(e) {
              var isNew = e.at > seen;
              return '<div class="err-item">' + row(isNew ? 'warn' : 'info', escHtml(e.msg) + (e.n > 1 ? ' <span class="u-muted">×' + e.n + '</span>' : '') + (isNew ? ' <span class="err-new">new</span>' : ''),
                escHtml(e.who) + ' · ' + escHtml(e.device) + ' · ' + escHtml(e.tab || '?') + ' tab' + (e.where ? ' · ' + escHtml(e.where) : '') + (e.v ? ' · ' + escHtml(e.v) : '') + '<br>' + ago(e.at) +
                ' · <button class="link-btn" data-errdel="' + escHtml(e.at) + '" data-errmsg="' + escHtml(e.msg) + '">Dismiss</button>') + '</div>';
            }).join('') + (errs.length > 10 ? '<div class="u-fs-11px u-c-faint u-m-4px-0">+ ' + (errs.length - 10) + ' older</div>' : '') +
              '<div class="u-m-8px-0-4px"><button class="adm-btn" id="err-clear">Clear the list</button> <span class="u-fs-11px u-c-faint">Fixed? Clear it so new ones stand out.</span></div>';
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
      var h = '<div class="u-fs-12px u-c-muted u-mb-14px">The hidden extras, and how to set each one off. Nobody else sees this list. Finding one shows "🥚 Easter egg N of ' + EGG_GUIDE.length + ' found!", counted per phone.</div>' +
        '<div class="pf-h">🥚 Easter eggs <small>' + n + ' of ' + EGG_GUIDE.length + ' found on this device</small></div>' +
        EGG_GUIDE.map(function(e) {
          return '<div class="egg-row' + (got[e.k] ? ' got' : '') + '"><div class="egg-ic">' + e.ic + '</div><div><div class="egg-t">' + e.t + (got[e.k] ? ' <span class="egg-got">✓ found</span>' : '') + '</div>' +
            '<div class="egg-how"><b>How:</b> ' + e.how + '</div><div class="egg-what"><b>What happens:</b> ' + e.what + '</div></div></div>';
        }).join('') +
        '<div class="u-mt-14px"><button class="adm-btn" id="egg-reset">Reset found eggs on this device</button></div><div class="u-ta-left submit-msg" id="adm-msg"></div>';
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
      var h = '<div class="u-mt-xs pf-h">🎨 Theme preview <small>only on this device</small></div>' +
        '<div class="u-fs-12px u-c-muted u-mb-10px">Force any theme here to check how it looks, whatever the date. Nobody else sees it. Everyone else gets the date-based theme, which today is <b class="u-c-t1">' + auto + '</b>.</div>' +
        '<div class="theme-grid">' + Object.keys(THEME_NAMES).map(function(k) {
          var on = forced === k;
          return '<button class="theme-opt' + (on ? ' on' : '') + '" data-theme-opt="' + k + '">' + THEME_NAMES[k] + (on ? ' ✓' : '') + '</button>';
        }).join('') + '</div>' +
        '<div class="u-fs-11px u-c-faint u-m-8px-0-22px">The page reloads to apply it. A small "Theme preview" button stays at the bottom of the screen until you go back to Auto.</div>' +
        '<div class="pf-h">👤 Themes for people <small>they can\'t change it</small></div>' +
        '<div class="u-fs-12px u-c-muted u-mb-10px">Give someone their own theme. It shows on any phone where they\'ve logged in at least once, and it beats the date-based theme until you set them back to Auto.</div>' +
        '<div id="pt-box"><div class="loading">Loading…</div></div>' +
        '<div class="u-mt-l pf-h">📣 Announcement <small>everyone sees it on Stats</small></div><div id="ann-box"><div class="loading">Loading…</div></div>';
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
        return '<div class="adm-row"><b style="color:' + c + '">' + escHtml(n) + '</b><select class="u-p-6px-10px u-w-auto adm-input pt-sel" data-pt="' + escHtml(n) + '">' +
          Object.keys(THEME_NAMES).map(function(k) { return '<option value="' + k + '"' + ((themes[n] || '') === k ? ' selected' : '') + '>' + THEME_NAMES[k] + '</option>'; }).join('') + '</select></div>';
      }).join('') + '<div class="u-ta-left submit-msg" id="pt-msg"></div>';
      box.querySelectorAll('[data-pt]').forEach(function(sel) {
        sel.addEventListener('change', function() {
          var m = document.getElementById('pt-msg'); m.style.color = '#A1A9B6'; m.textContent = 'Saving…';
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
      var cur = a ? '<div class="u-d-block u-mb-12px announce-banner">📣 ' + escHtml(a.text) + '<div class="u-fs-11px u-c-muted u-mt-4px">' + (a.until ? 'Showing through ' + new Date(a.until + 'T12:00').toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' }) : 'Showing until you remove it') + '</div></div>' +
        '<button class="u-mb-16px adm-btn red" id="ann-rm">Remove it</button>' : '<div class="u-fs-12px u-c-muted u-mb-10px">Nothing posted right now.</div>';
      box.innerHTML = cur +
        '<textarea class="u-w-100 u-bs-border-box u-rs-vertical adm-input" id="ann-text" maxlength="160" rows="2" placeholder="e.g. Happy birthday Danielle 🎂"></textarea>' +
        '<div class="u-d-flex u-gap-8px u-ai-center u-fwrap-wrap u-mt-8px"><label class="u-fs-12px u-c-muted">Show through <input type="date" class="u-p-6px-8px adm-input" id="ann-until"></label>' +
        '<span class="u-fs-11px u-c-faint">(leave blank to keep it up)</span><button class="u-p-9px-18px u-ml-auto primary-btn" id="ann-post">' + (a ? 'Replace' : 'Post') + '</button></div>' +
        '<div class="u-ta-left submit-msg" id="adm-msg"></div>';
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
          return '<div class="dc-fine-row"><div><b>' + x.title + '</b> <span class="u-muted">' + escHtml(x.where) + '</span><div>' + escHtml(x.text) + '</div></div>' +
            '<button class="adm-btn" data-dcundo="' + x.key + '">Undo</button></div>';
        }).join('') + '</details>' : '';
        if (!issues.length) {
          h += '<div class="st-row"><span class="st-ic">✅</span><div><div class="st-l">Every season checks out</div><div class="st-d">No spelling mismatches, wrong sides, odd-looking odds or mismatched game rows' + (fine.length ? ', apart from what you marked as fine' : '') + '.</div></div></div>';
        } else {
          h += '<div class="u-fs-13px u-fw-700 u-mb-12px">' + issues.length + ' thing' + (issues.length > 1 ? 's' : '') + ' to look at' + (bad ? ' · ' + bad + ' affect the totals' : '') + '</div>';
          issues.sort(function(a, b) { return (a.level === 'bad' ? 0 : 1) - (b.level === 'bad' ? 0 : 1); });
          var card = function(x) {
            return '<div class="adm-issue ' + (x.level === 'bad' ? 'bad' : '') + '"><div class="t" style="color:' + (x.level === 'bad' ? '#FCA5A5' : '#FCD34D') + '">' + x.title + '</div>' +
              (x.where ? '<div class="u-fs-11px u-c-muted u-mb-3px">' + x.where + '</div>' : '') +
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
