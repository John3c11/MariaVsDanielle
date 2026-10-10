// ⏪ Replay Mode: re-watch any past game Maria and Danielle picked, play by play, on the Game Day screen.
// Uses ESPN's play-by-play for that game (nothing is saved anywhere). Opened from the ⏪ Replay card on
// All-Time, a game in the Bet Log, or "This Week in History". Loaded on demand (loadScriptOnce).
// Part of the MariaVsDanielle site. Shares the global scope with the other js/ files.

    var RP = { queue: [], gi: 0, plays: [], i: -1, timer: null, speed: 1, playing: false, firstIdx: -1, ev: null, game: null, shown: {}, token: 0 };
    var RP_MS = { 1: 900, 3: 300, 10: 90 };

    // ── Which games: everything Maria and/or Danielle picked that week ──
    function rpWeekGames(rows, year, week) {
      var G = {}, order = [];
      rows.forEach(function(r) {
        if (r.year !== String(year) || parseInt(r.week, 10) !== parseInt(week, 10) || !(r.homePick || r.awayPick)) return;
        var k = r.game;
        if (!G[k]) { G[k] = { key: r.year + '_' + r.week + '_' + r.game, year: r.year, week: parseInt(r.week, 10), game: r.game, home: r.homeTeam, away: r.awayTeam, scorer: '', picks: [] }; order.push(k); }
        if (r.firstScorer) G[k].scorer = r.firstScorer;
        if (r.picker === 'Maria' || r.picker === 'Danielle') {
          if (r.homePick) G[k].picks.push({ who: r.picker, name: r.homePick, team: r.homeTeam, odds: r.homeOdds ? fmtOdds(r.homeOdds) : '' });
          if (r.awayPick) G[k].picks.push({ who: r.picker, name: r.awayPick, team: r.awayTeam, odds: r.awayOdds ? fmtOdds(r.awayOdds) : '' });
        }
      });
      return order.map(function(k) { return G[k]; }).filter(function(g) { return g.scorer; }); // finished games only
    }

    // Open a week (and optionally start at one game)
    function openReplay(year, week, game) {
      return loadAllBets().then(function(rows) {
        var list = rpWeekGames(rows, year, week);
        if (!list.length) { alert('No finished games to replay that week.'); return; }
        RP.queue = list;
        RP.gi = Math.max(0, list.findIndex(function(g) { return String(g.game) === String(game); }));
        rpShell();
        rpLoadGame();
      });
    }

    function rpShell() {
      var root = document.getElementById('replay');
      if (!root) {
        root = document.createElement('div');
        root.id = 'replay';
        root.className = 'gd-root dk'; // .dk = stays dark in the light theme (v140)
        root.setAttribute('role', 'dialog');
        root.setAttribute('aria-label', 'Replay');
        document.body.appendChild(root);
        root.addEventListener('click', rpClick);
        document.addEventListener('keydown', function(e) {
          if (!root.classList.contains('open')) return;
          if (e.key === 'Escape') closeReplay();
          if (e.key === ' ' && e.target === document.body) { e.preventDefault(); rpToggle(); }
        });
      }
      root.innerHTML = '<div class="gd-frame"><div class="gd-top"><span class="gd-title">⏪ Replay <span class="gd-test" id="rp-when"></span></span><button class="gd-x" aria-label="Close">✕</button></div>' +
        '<div class="rp-ctrl" id="rp-ctrl"></div><div class="gd-body" id="rp-body"></div></div>';
      root.classList.add('open');
      document.documentElement.classList.add('st-lock');
    }
    function closeReplay() {
      clearTimeout(RP.timer); RP.playing = false; RP.token++;
      var root = document.getElementById('replay');
      if (root) { root.classList.remove('open'); root.innerHTML = ''; }
      document.documentElement.classList.remove('st-lock');
    }

    // ESPN: find the game, then flatten its drives into one list of plays
    function rpLoadGame() {
      clearTimeout(RP.timer); RP.playing = false;
      var g = RP.game = RP.queue[RP.gi], token = ++RP.token;
      RP.plays = []; RP.i = -1; RP.firstIdx = -1; RP.ev = null; RP.shown = {};
      document.getElementById('rp-when').textContent = g.year + ' ' + weekName(g.week);
      document.getElementById('rp-body').innerHTML = '<div class="st-loading">Getting the game from ESPN…</div>';
      rpDrawCtrl();
      var path = 'scoreboard?dates=' + g.year + '&seasontype=' + (g.week > 18 ? 3 : 2) + '&week=' + (g.week > 18 ? g.week - 18 : g.week);
      espnGet(path).then(function(board) {
        var hk = espnTeamKey(g.home), ak = espnTeamKey(g.away), ev = null;
        (board.events || []).forEach(function(e) {
          var c = e.competitions && e.competitions[0];
          if (!c) return;
          var keys = c.competitors.map(function(x) { return espnTeamKey(x.team.displayName); });
          if (keys.indexOf(hk) >= 0 && keys.indexOf(ak) >= 0) ev = e;
        });
        if (!ev) throw new Error('not found');
        RP.ev = ev;
        return espnGet('summary?event=' + ev.id);
      }).then(function(sum) {
        if (token !== RP.token) return;
        var plays = [];
        ((sum.drives && sum.drives.previous) || []).forEach(function(d) {
          (d.plays || []).forEach(function(p) {
            if (!p.text) return;
            plays.push({ id: p.id, text: p.text, q: p.period && p.period.number, clock: (p.clock && p.clock.displayValue) || '', hs: p.homeScore || 0, as: p.awayScore || 0,
              score: !!p.scoringPlay, td: !!p.scoringPlay && tdPlay(p), off: d.team ? (d.team.abbreviation || '') : '', offName: d.team ? d.team.displayName || '' : '',
              togo: p.end && p.end.yardsToEndzone != null ? p.end.yardsToEndzone : (p.start && p.start.yardsToEndzone != null ? p.start.yardsToEndzone : null) });
          });
        });
        if (!plays.length) throw new Error('no plays');
        RP.plays = plays;
        RP.firstIdx = plays.findIndex(function(p) { return p.td; });
        RP.i = 0;
        rpDraw(); rpDrawCtrl();
        rpPlay();
      }).catch(function() {
        if (token !== RP.token) return;
        document.getElementById('rp-body').innerHTML = '<div class="st-loading">ESPN doesn\'t have the play-by-play for this one. ' + (RP.gi < RP.queue.length - 1 ? '<button class="link-btn" data-rp="next">Next game →</button>' : '') + '</div>';
      });
    }

    // ── Playback ──
    function rpPlay() { RP.playing = true; rpDrawCtrl(); rpTick(); }
    function rpPause() { RP.playing = false; clearTimeout(RP.timer); rpDrawCtrl(); }
    function rpToggle() { if (RP.playing) rpPause(); else { if (RP.i >= RP.plays.length - 1) RP.i = 0; rpPlay(); } }
    function rpTick() {
      clearTimeout(RP.timer);
      if (!RP.playing) return;
      if (RP.i >= RP.plays.length - 1) { RP.playing = false; rpDraw(); rpDrawCtrl(); return; }
      RP.i++;
      rpDraw();
      if (RP.i === RP.firstIdx && !RP.shown[RP.firstIdx]) {
        RP.shown[RP.firstIdx] = 1;
        rpTakeover();
        RP.timer = setTimeout(rpTick, 4200); // let the moment breathe
        rpScrub();
        return;
      }
      rpScrub();
      RP.timer = setTimeout(rpTick, RP_MS[RP.speed]);
    }
    function rpJump(i) { RP.i = Math.max(0, Math.min(RP.plays.length - 1, i)); rpDraw(); rpScrub(); }

    function rpDrawCtrl() {
      var c = document.getElementById('rp-ctrl');
      if (!c) return;
      var g = RP.game, n = RP.plays.length;
      var nick = function(t) { return escHtml(resolveTeam(t).split(' ').pop()); };
      c.innerHTML = '<div class="rp-games">' + RP.queue.map(function(x, i) {
        return '<button class="rp-g' + (i === RP.gi ? ' on' : '') + '" data-rp-g="' + i + '">' + nick(x.away) + ' @ ' + nick(x.home) + '</button>';
      }).join('') + '</div>' +
        '<div class="rp-bar"><button class="rp-btn rp-main" data-rp="toggle" aria-label="' + (RP.playing ? 'Pause' : 'Play') + '">' + (RP.playing ? '⏸' : '▶') + '</button>' +
        '<input type="range" class="rp-scrub" id="rp-scrub" min="0" max="' + Math.max(0, n - 1) + '" value="' + Math.max(0, RP.i) + '"' + (n ? '' : ' disabled') + ' aria-label="Play">' +
        [1, 3, 10].map(function(s) { return '<button class="rp-btn' + (RP.speed === s ? ' on' : '') + '" data-rp-speed="' + s + '">' + s + '×</button>'; }).join('') + '</div>' +
        '<div class="rp-bar rp-jumps">' + (RP.firstIdx > 0 ? '<button class="rp-btn" data-rp="first">⏭ Right before the first TD</button>' : '') +
        '<button class="rp-btn" data-rp="end">⏭ Final</button>' +
        (RP.gi < RP.queue.length - 1 ? '<button class="rp-btn" data-rp="next">Next game →</button>' : '') + '</div>';
      var on = c.querySelector('.rp-g.on');
      if (on) on.parentNode.scrollLeft = on.offsetLeft - 20; // keep the current game's chip in view
      var sc = document.getElementById('rp-scrub');
      if (sc) sc.addEventListener('input', function() { rpPause(); rpJump(parseInt(sc.value, 10)); });
    }
    function rpScrub() { var sc = document.getElementById('rp-scrub'); if (sc) sc.value = RP.i; }
    function rpClick(e) {
      var t = e.target;
      if (t.closest('.gd-x')) return closeReplay();
      if (t.closest('.gd-takeover')) { t.closest('.gd-takeover').remove(); if (RP.playing) { clearTimeout(RP.timer); RP.timer = setTimeout(rpTick, 300); } return; }
      var b = t.closest('[data-rp],[data-rp-speed],[data-rp-g]');
      if (!b) return;
      if (b.hasAttribute('data-rp-speed')) { RP.speed = parseInt(b.getAttribute('data-rp-speed'), 10); rpDrawCtrl(); if (RP.playing) rpTick(); return; }
      if (b.hasAttribute('data-rp-g')) { RP.gi = parseInt(b.getAttribute('data-rp-g'), 10); rpLoadGame(); return; }
      var a = b.getAttribute('data-rp');
      if (a === 'toggle') rpToggle();
      if (a === 'first') { rpPause(); rpJump(RP.firstIdx - 3); rpPlay(); }
      if (a === 'end') { rpPause(); RP.shown[RP.firstIdx] = 1; rpJump(RP.plays.length - 1); rpDrawCtrl(); }
      if (a === 'next') { RP.gi = Math.min(RP.queue.length - 1, RP.gi + 1); rpLoadGame(); }
    }

    // ── One frame ──
    // Is this pick the ball carrier / target in a play? ("J.Cook up the middle", "pass to K.Shakir")
    function rpInPlay(text, name) {
      var parts = name.replace(/\b(Jr|Sr|II|III|IV|V)\b\.?/g, '').trim().split(/\s+/);
      if (parts.length < 2) return false;
      var last = parts.slice(1).join(' ').replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), ini = parts[0].charAt(0);
      return new RegExp('\\b(' + parts[0] + '\\s+' + last + '|' + ini + '[a-z]?\\.\\s?' + last + ')\\b', 'i').test(text);
    }
    function rpStats(name, upto) {
      var s = { touches: 0, yds: 0, td: 0 };
      for (var i = 0; i <= upto; i++) {
        var t = RP.plays[i].text;
        if (!rpInPlay(t, name) || /incomplete|kicks|punts|extra point|field goal|PENALTY on/i.test(t) && !/TOUCHDOWN/i.test(t)) continue;
        var m = t.match(/for (-?\d+) yards?/i);
        if (m || /no gain/i.test(t)) { s.touches++; s.yds += m ? parseInt(m[1], 10) : 0; }
        if (RP.plays[i].td && sameScorer(tdScorerName(t), name)) s.td++;
      }
      return s;
    }
    function rpDraw() {
      var body = document.getElementById('rp-body');
      if (!body || !RP.ev || RP.i < 0) return;
      var g = RP.game, p = RP.plays[RP.i], comp = RP.ev.competitions[0];
      var H = comp.competitors.filter(function(c) { return c.homeAway === 'home'; })[0] || comp.competitors[0];
      var A = comp.competitors.filter(function(c) { return c.homeAway === 'away'; })[0] || comp.competitors[1];
      var done = RP.i === RP.plays.length - 1;
      function side(c, pts) {
        var t = resolveTeam(c.team.displayName), tc = TEAM_COLORS[t] || {}, has = !done && p.offName && espnTeamKey(p.offName) === espnTeamKey(c.team.displayName);
        return '<div class="gd-team" style="--tc:' + (tc.dark || '#F3F4F6') + '">' + teamLogo(t, 'gd-logo') +
          '<div class="gd-abbr">' + escHtml(c.team.abbreviation || teamNick(t)) + (has ? ' <span class="gd-ball">🏈</span>' : '') + '</div><div class="gd-pts">' + pts + '</div></div>';
      }
      var h = '<div class="gd-score">' + side(H, p.hs) + '<div class="gd-mid"><span class="rp-tag">REPLAY</span><div class="gd-clock">' + (done ? 'Final' : (p.q ? (p.q > 4 ? 'OT' : 'Q' + p.q) + ' ' : '') + escHtml(p.clock)) + '</div>' +
        '<div class="gd-down">Play ' + (RP.i + 1) + ' of ' + RP.plays.length + '</div></div>' + side(A, p.as) + '</div>';
      // Field: home end zone on the left, so home drives right
      if (!done && p.togo != null && p.offName) {
        var homeOff = espnTeamKey(p.offName) === espnTeamKey(H.team.displayName);
        var pos = homeOff ? 100 - p.togo : p.togo;
        var hc = (TEAM_COLORS[resolveTeam(H.team.displayName)] || {}).primary || '#374151', ac = (TEAM_COLORS[resolveTeam(A.team.displayName)] || {}).primary || '#374151';
        h += '<div class="gd-field"><i class="gd-ez" style="left:0;background:' + hc + '"></i><i class="gd-ez" style="right:0;background:' + ac + '"></i>' +
          '<i class="gd-mark" style="left:' + (8 + pos * 0.84).toFixed(1) + '%"></i><span class="gd-togo">' + escHtml(p.off) + ' · ' + p.togo + ' yds to the end zone</span></div>';
      }
      // First TD box: the sheet's first scorer is the truth; the play list says when it happened
      var happened = RP.firstIdx >= 0 && RP.i >= RP.firstIdx;
      var first = happened ? g.scorer : null;
      if (first) {
        var who = g.picks.filter(function(x) { return sameScorer(first, x.name) || playerKey(first) === playerKey(x.name); }).map(function(x) { return x.who; });
        who = who.filter(function(n, i) { return who.indexOf(n) === i; });
        h += '<div class="gd-ftd hit"><div class="gd-ftd-k">🏈 First touchdown</div><div class="gd-ftd-n">' + escHtml(first) + '</div>' +
          '<div>' + (who.length ? '🎉 ' + who.map(function(n) { return '<b style="color:' + personColor(n) + '">' + n + '</b>'; }).join(' & ') + ' hit it!' : 'Nobody had him 😩') + '</div></div>';
      } else {
        h += '<div class="gd-ftd"><div class="gd-ftd-k">🏈 First touchdown</div><div>' + (RP.firstIdx < 0 ? 'ESPN\'s play list doesn\'t show a touchdown.' : 'No touchdowns yet. All four picks are alive.') + '</div></div>';
      }
      // The picks, with touches and yards so far
      var heats = [], cards = g.picks.map(function(x) {
        var s = rpStats(x.name, RP.i), heat = Math.min(100, Math.round(s.touches * 8 + s.yds * 0.6));
        heats.push(heat);
        var hit = first && (sameScorer(first, x.name) || playerKey(first) === playerKey(x.name));
        return { who: x.who, heat: heat, html: '<div class="gd-pick' + (hit ? ' hit' : first ? ' out' : '') + '" style="--pc:' + personColor(x.who) + '">' + headshot(x.name, x.team, 40) +
          '<div class="gd-pk-mid"><div class="gd-pk-n">' + escHtml(x.name) + (hit ? ' ✅' : '') + '</div>' + (x.odds ? '<div class="gd-pk-o">' + escHtml(x.odds) + '</div>' : '') +
          '<div class="gd-pk-s">' + (s.touches ? s.touches + ' touch' + (s.touches === 1 ? '' : 'es') + ' · ' + s.yds + ' yds' + (s.td ? ' · ' + s.td + ' TD' : '') : 'No touches yet') + '</div>' +
          (first ? '' : '<div class="gd-heat"><i style="width:' + heat + '%"></i></div>') + '</div></div>' };
      });
      var top = Math.max.apply(null, heats.concat([0]));
      h += '<div class="gd-cols">' + ['Maria', 'Danielle'].map(function(n) {
        var mine = cards.filter(function(c) { return c.who === n; });
        if (!mine.length) return '<div class="gd-col"><div class="gd-col-h" style="color:' + personColor(n) + '">' + n + '</div><div class="u-p-6px-2px gd-pk-s">Didn\'t pick this one</div></div>';
        return '<div class="gd-col"><div class="gd-col-h" style="color:' + personColor(n) + '">' + n + '</div>' +
          mine.map(function(c) { return c.html.replace('class="gd-pick"', 'class="gd-pick' + (!first && top > 0 && c.heat === top ? ' hot' : '') + '"'); }).join('') + '</div>';
      }).join('') + '</div>';
      // Latest plays
      h += '<div class="gd-h">Latest plays</div>' + RP.plays.slice(Math.max(0, RP.i - 4), RP.i + 1).reverse().map(function(x) {
        return '<div class="gd-play' + (x.score ? ' sc' : '') + '"><span>' + (x.q ? (x.q > 4 ? 'OT' : 'Q' + x.q) + ' ' : '') + escHtml(x.clock) + '</span>' + escHtml(x.text) + '</div>';
      }).join('');
      h += '<div class="gd-foot">Replaying ESPN\'s play-by-play. Touches are counted from the play descriptions.</div>';
      body.innerHTML = h;
      if (typeof fillHeadshots === 'function') fillHeadshots(body);
    }
    function rpTakeover() {
      var g = RP.game, first = g.scorer;
      var who = g.picks.filter(function(x) { return sameScorer(first, x.name) || playerKey(first) === playerKey(x.name); });
      var names = who.map(function(x) { return x.who; }).filter(function(n, i, a) { return a.indexOf(n) === i; });
      var p0 = who[0], el = document.createElement('div');
      el.className = 'gd-takeover' + (p0 ? ' win' : '');
      el.style.setProperty('--pc', p0 ? personColor(p0.who) : '#A1A9B6');
      var team = p0 ? p0.team : (typeof ROSTER_INFO !== 'undefined' && ROSTER_INFO[playerKey(first)] ? ROSTER_INFO[playerKey(first)].team : '');
      el.innerHTML = '<div class="gd-to-in"><div class="gd-to-k">TOUCHDOWN</div>' + (team ? headshot(first, team, 120) : '') +
        '<div class="gd-to-n">' + escHtml(first) + '</div><div class="gd-to-r">' +
        (names.length ? '🎉 ' + names.map(function(n) { return '<b style="color:' + personColor(n) + '">' + n + '</b>'; }).join(' & ') + ' hit it!' : 'Nobody had him 😩') +
        '</div><div class="gd-to-tap">tap to keep watching</div></div>';
      document.getElementById('replay').appendChild(el);
      if (typeof fillHeadshots === 'function') fillHeadshots(el);
      setTimeout(function() { if (el.parentNode) el.remove(); }, 4000);
    }

    // ── The ⏪ Replay card on All-Time: pick a season and week ──
    var RPC = { year: '', week: 0 };
    function renderReplayCard(el) {
      if (!el) return;
      loadAllBets().then(function(rows) {
        var W = {};
        rows.forEach(function(r) { if (r.firstScorer && (r.homePick || r.awayPick)) { (W[r.year] = W[r.year] || {})[parseInt(r.week, 10)] = 1; } });
        var years = Object.keys(W).sort().reverse();
        if (!years.length) { el.innerHTML = ''; return; }
        if (!RPC.year || !W[RPC.year]) RPC.year = years[0];
        var weeks = Object.keys(W[RPC.year]).map(Number).sort(function(a, b) { return a - b; });
        if (!RPC.week || weeks.indexOf(RPC.week) < 0) RPC.week = weeks[weeks.length - 1];
        var games = rpWeekGames(rows, RPC.year, RPC.week);
        var h = '<div class="pf-h">⏪ Replay <small>re-watch any week, play by play</small></div><div class="rpc">' +
          '<div class="rpc-sel"><select class="adm-input" id="rpc-year">' + years.map(function(y) { return '<option' + (y === RPC.year ? ' selected' : '') + '>' + y + '</option>'; }).join('') + '</select>' +
          '<select class="adm-input" id="rpc-week">' + weeks.map(function(w) { return '<option value="' + w + '"' + (w === RPC.week ? ' selected' : '') + '>' + weekName(w) + '</option>'; }).join('') + '</select>' +
          '<button class="primary-btn" id="rpc-all">▶ Play the week</button></div>' +
          '<div class="rpc-list">' + games.map(function(g) {
            var nick = function(t) { return escHtml(resolveTeam(t).split(' ').pop()); };
            var hit = g.picks.filter(function(x) { return playerKey(x.name) === playerKey(g.scorer); }).map(function(x) { return x.who; });
            return '<button class="rpc-g" data-rpc="' + escHtml(String(g.game)) + '"><span>' + teamLogo(g.away) + nick(g.away) + ' @ ' + nick(g.home) + teamLogo(g.home) + '</span>' +
              '<small>🏈 ' + escHtml(g.scorer) + (hit.length ? ' · ' + hit.filter(function(n, i) { return hit.indexOf(n) === i; }).map(function(n) { return '<b style="color:' + personColor(n) + '">' + n + ' ✓</b>'; }).join(' ') : '') + '</small><span class="rpc-play">▶</span></button>';
          }).join('') + '</div></div>';
        el.innerHTML = h;
        document.getElementById('rpc-year').addEventListener('change', function() { RPC.year = this.value; RPC.week = 0; renderReplayCard(el); });
        document.getElementById('rpc-week').addEventListener('change', function() { RPC.week = parseInt(this.value, 10); renderReplayCard(el); });
        document.getElementById('rpc-all').addEventListener('click', function() { openReplay(RPC.year, RPC.week); });
        el.querySelectorAll('[data-rpc]').forEach(function(b) { b.addEventListener('click', function() { openReplay(RPC.year, RPC.week, b.getAttribute('data-rpc')); }); });
      }).catch(function() { el.innerHTML = ''; });
    }
