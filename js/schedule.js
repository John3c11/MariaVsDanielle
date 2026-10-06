// Schedule tab.
// Part of the MariaVsDanielle site. All js/ files share one global scope and load in the order listed in index.html.

    // ── Schedule ────────────────────────────────────────────────────────────
    var SCHED = { showAll: false, kickoffs: {}, loadingWeeks: {} };

    function loadScheduleTab() {
      var el = document.getElementById('schedule-content');
      if (!el.innerHTML) el.innerHTML = '<div class="loading">Loading schedule…</div>';
      fetchSheet('Winnings', 'A1:Q400').then(function(values) { drawSchedule(values); });
    }

    function drawSchedule(values) {
      var el = document.getElementById('schedule-content');
      var games = [], idx = {};
      readBets(values).forEach(function(b) {
        var picker = b.picker;
        if (!b.game || !b.home || (picker !== 'Maria' && picker !== 'Danielle')) return;
        var k = b.week + '_' + b.game;
        if (!(k in idx)) {
          idx[k] = games.length;
          games.push({ week: b.weekN, slot: b.slot, home: resolveTeam(b.home), away: resolveTeam(b.away), scorer: '', picked: {}, hit: {} });
        }
        var g = games[idx[k]];
        if (b.scorer) g.scorer = b.scorer;
        g.picked[picker] = !!(b.homePick && b.awayPick);
        g.hit[picker] = b.correct === 'Yes';
      });
      if (!games.length) { el.innerHTML = '<div class="loading">No games entered yet.</div>'; return; }

      var openWeeks = games.filter(function(g) { return !g.scorer; }).map(function(g) { return g.week; });
      var thisWeek = openWeeks.length ? Math.min.apply(null, openWeeks) : null;
      var upcoming = games.filter(function(g) { return !g.scorer || g.week === thisWeek; });
      var upWeeks = upcoming.map(function(g) { return g.week; }).filter(function(w, i, a) { return a.indexOf(w) === i; }).sort(function(a, b) { return a - b; });
      var shown = SCHED.showAll ? games : upcoming.filter(function(g) { return SCHED.later || upWeeks.indexOf(g.week) < 2; });
      var hiddenWeeks = SCHED.showAll || SCHED.later ? 0 : Math.max(0, upWeeks.length - 2);

      var h = '<div class="af-bar" style="justify-content:center;margin-bottom:6px"><span class="af-bar-label">Show</span>' +
        '<button class="filter-btn' + (!SCHED.showAll ? ' active' : '') + '" data-sch="0">Upcoming</button>' +
        '<button class="filter-btn' + (SCHED.showAll ? ' active' : '') + '" data-sch="1">Whole season</button></div>';
      if (!shown.length) h += '<div class="loading">All games are finished. 🎉</div>';

      var lastWeek = null;
      shown.forEach(function(g) {
        if (g.week !== lastWeek) {
          lastWeek = g.week;
          h += '<div class="sch-week">' + weekName(g.week) + (g.week === thisWeek ? ' <span class="sch-now">THIS WEEK</span>' : '') + '</div>';
        }
        var ko = SCHED.kickoffs[CURRENT_YEAR + '_' + g.week + '_' + espnTeamKey(g.home) + '_' + espnTeamKey(g.away)];
        var koText = ko ? new Date(ko).toLocaleString([], { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '';
        var status;
        if (g.scorer) {
          var hits = ['Maria', 'Danielle'].filter(function(n) { return g.hit[n]; });
          status = '🏈 First TD: <b>' + escHtml(g.scorer) + '</b> · ' + (hits.length
            ? hits.map(function(n) { var c = personColor(n); return '<span class="sch-chip" style="color:' + c + ';background:' + hexA(c, 0.15) + '">✅ ' + n + '</span>'; }).join('')
            : '<span style="color:#A1A9B6">nobody had him</span>');
        } else {
          var m = g.picked.Maria, d = g.picked.Danielle;
          if (m && d) status = '<span class="sch-chip" style="color:#6EE7B7;background:rgba(52,211,153,0.14)">✅ Both picks in</span>';
          else if (m || d) {
            var waiting = m ? 'Danielle' : 'Maria', c = personColor(waiting);
            status = '<span class="sch-chip" style="color:#FCD34D;background:rgba(251,191,36,0.14)">⏳ Waiting on <span style="color:' + c + '">' + waiting + '</span></span>';
          } else status = '<span class="sch-chip" style="color:#A1A9B6;background:rgba(255,255,255,0.06)">No picks yet</span>';
        }
        h += '<div class="sch-game"' + (g.scorer ? ' style="opacity:0.75"' : '') + '><div class="sch-top"><span class="sch-slot">' + escHtml(g.slot) + '</span><span class="sch-ko">' + koText + '</span></div>' +
          '<div class="sch-teams">' + teamPill(g.home, g.home) + ' <span style="color:rgba(255,255,255,0.45)">vs</span> ' + teamPill(g.away, g.away) + '</div>' +
          '<div class="sch-status">' + status + '</div></div>';
      });
      if (hiddenWeeks) h += '<div style="text-align:center;margin-top:8px"><button class="adm-btn" id="sch-later">Show ' + hiddenWeeks + ' later week' + (hiddenWeeks > 1 ? 's' : '') + '</button></div>';
      el.innerHTML = h;
      var later = document.getElementById('sch-later');
      if (later) later.addEventListener('click', function() { SCHED.later = true; drawSchedule(values); });
      el.querySelectorAll('[data-sch]').forEach(function(b) {
        b.addEventListener('click', function() { SCHED.showAll = b.getAttribute('data-sch') === '1'; drawSchedule(values); });
      });

      // Fill in kickoff times from ESPN, a week at a time
      var weeks = shown.map(function(g) { return g.week; }).filter(function(w, i, a) { return a.indexOf(w) === i; });
      weeks.forEach(function(w) {
        var wk = CURRENT_YEAR + '_' + w;
        if (SCHED.loadingWeeks[wk]) return;
        SCHED.loadingWeeks[wk] = true;
        var path = w > 18 ? 'scoreboard?dates=' + CURRENT_YEAR + '&seasontype=3&week=' + (w - 18) : 'scoreboard?dates=' + CURRENT_YEAR + '&seasontype=2&week=' + w;
        espnGet(path).then(function(d) {
          (d.events || []).forEach(function(e) {
            var c = e.competitions && e.competitions[0];
            if (!c) return;
            var keys = c.competitors.map(function(x) { return espnTeamKey(x.team.displayName); });
            var H = c.competitors.filter(function(x) { return x.homeAway === 'home'; })[0];
            var A = c.competitors.filter(function(x) { return x.homeAway === 'away'; })[0];
            // Store both orders since the sheet's home/away may differ from ESPN's
            SCHED.kickoffs[CURRENT_YEAR + '_' + w + '_' + keys[0] + '_' + keys[1]] = e.date;
            SCHED.kickoffs[CURRENT_YEAR + '_' + w + '_' + keys[1] + '_' + keys[0]] = e.date;
          });
          if (document.getElementById('tab-schedule').classList.contains('active')) drawSchedule(values);
        }).catch(function() {});
      });
    }
