// 🤖 The Machine: a first-TD model (Machine.gs) that plays every game Maria and Danielle play.
// Its picks come from the script only once a game has kicked off, so nothing here can show a pick early.
// This file: the 🤖 Machine tab, its profile, the 3-way line on Stats, and pick grades in the Bet Log.
// Loaded on demand (loadScriptOnce). Part of the MariaVsDanielle site; shares the global scope.

    var MACHINE = { data: null, loading: null, realOnly: false, week: 'all' };
    var MC_COLOR = '#A78BFA';
    var GRADE_PTS = { 'A+': 4.3, A: 4, B: 3, C: 2, D: 1, F: 0 };

    function loadMachine(fresh) {
      if (MACHINE.data && !fresh) return Promise.resolve(MACHINE.data);
      if (MACHINE.loading && !fresh) return MACHINE.loading;
      MACHINE.loading = Promise.all([picksApi({ action: 'machinepub' }), loadAllBets()]).then(function(res) {
        MACHINE.data = machineCompute(res[0] || {}, res[1] || []);
        window.MACHINE_GRADES = MACHINE.data.gradeMap;
        return MACHINE.data;
      });
      return MACHINE.loading;
    }

    // ── Grades: was the price they got good for the player's real chance? ──
    // Compares the odds they got with what FanDuel usually charges for that chance (the Machine's
    // price model). A+ = a much better price than usual … F = a much worse one. Not about hit or miss.
    function mcGrade(chance, amer, price) {
      if (!(chance > 0) || !(amer > 0) || !price) return null;
      var est = Math.exp(price.k0 + price.k1 * Math.log(Math.max(0.003, chance))); // decimal odds FanDuel would usually post
      var ratio = (1 + amer / 100) / est;
      return { ratio: ratio, g: ratio >= 1.45 ? 'A+' : ratio >= 1.25 ? 'A' : ratio >= 1.08 ? 'B' : ratio >= 0.92 ? 'C' : ratio >= 0.78 ? 'D' : 'F' };
    }
    function mcGradeFromPts(p) { return p >= 4.15 ? 'A+' : p >= 3.5 ? 'A' : p >= 2.5 ? 'B' : p >= 1.5 ? 'C' : p >= 0.5 ? 'D' : 'F'; }
    function mcChance(ch, name) {
      if (!name) return 0;
      if (ch[name] != null) return ch[name];
      var k = playerKey(name), hit = Object.keys(ch).filter(function(n) { return playerKey(n) === k; })[0];
      return hit ? ch[hit] : 0;
    }

    function machineCompute(pub, bets) {
      var year = String(pub.season || CURRENT_YEAR);
      var rowsByGame = {};
      bets.forEach(function(b) { if (b.year === year) (rowsByGame[String(b.game)] = rowsByGame[String(b.game)] || {})[b.picker] = b; });
      var games = (pub.picks || []).map(function(p) {
        var rr = rowsByGame[String(p.game)] || {}, any = rr.Maria || rr.Danielle || null;
        var scorer = any ? any.firstScorer : '', settled = !!(any && (any.correct === 'Yes' || any.correct === 'No'));
        var notOffered = !!(any && isNotOffered(any));
        var picks = [{ side: 'home', name: p.hp, pct: p.hpct, price: Math.abs(p.hprice), real: p.hprice > 0, team: p.home }, { side: 'away', name: p.ap, pct: p.apct, price: Math.abs(p.aprice), real: p.aprice > 0, team: p.away }];
        var hit = settled && !notOffered ? picks.filter(function(x) { return playerKey(x.name) === playerKey(scorer); })[0] : null;
        var units = !settled || notOffered ? 0 : hit ? hit.price / 100 : -picks.length;
        // Grades for Maria's and Danielle's picks in this game
        var grades = {};
        ['Maria', 'Danielle'].forEach(function(w) {
          var r = rr[w]; if (!r) return;
          var gs = [];
          [['homePick', 'homeOdds'], ['awayPick', 'awayOdds']].forEach(function(k) {
            if (!r[k[0]]) return;
            var o = oddsN(r[k[1]]) * 100, gr = mcGrade(mcChance(p.chances || {}, r[k[0]]), o, pub.price);
            if (gr) gs.push({ name: r[k[0]], odds: o, chance: mcChance(p.chances || {}, r[k[0]]), g: gr.g, ratio: gr.ratio, hit: settled && playerKey(r[k[0]]) === playerKey(scorer) });
          });
          if (gs.length) {
            var pts = gs.reduce(function(a, x) { return a + GRADE_PTS[x.g]; }, 0) / gs.length;
            grades[w] = { picks: gs, g: mcGradeFromPts(pts), pts: pts, units: r.netUnits, settled: settled, notOffered: notOffered };
          }
        });
        return { p: p, week: parseInt(p.week, 10), game: String(p.game), home: p.home, away: p.away, scorer: scorer, settled: settled, notOffered: notOffered,
          picks: picks, hit: hit, units: units, estHit: !!(hit && !hit.real), retro: p.retro, grades: grades, rows: rr };
      }).sort(function(a, b) { return b.week - a.week || b.game - a.game; });
      // Grade lookup for the Bet Log: "year|game|picker"
      var gradeMap = {};
      games.forEach(function(g) { Object.keys(g.grades).forEach(function(w) { gradeMap[year + '|' + g.game + '|' + w] = g.grades[w]; }); });
      // Upcoming games this season (picks sealed until kickoff)
      var upcoming = {};
      bets.forEach(function(b) { if (b.year === year && !b.firstScorer && b.game) upcoming[b.game] = 1; });
      var seen = {}; games.forEach(function(g) { seen[g.game] = 1; });
      return { pub: pub, year: year, games: games, gradeMap: gradeMap, sealed: Object.keys(upcoming).filter(function(k) { return !seen[k]; }).length };
    }

    // Standings for the three of them over the same settled games
    function mcStandings(D, realOnly) {
      var S = { Machine: { u: 0, h: 0, n: 0 }, Maria: { u: 0, h: 0, n: 0 }, Danielle: { u: 0, h: 0, n: 0 } };
      D.games.forEach(function(g) {
        if (!g.settled || g.notOffered) return;
        if (realOnly && g.estHit) return;
        S.Machine.u += g.units; S.Machine.n++; if (g.hit) S.Machine.h++;
        ['Maria', 'Danielle'].forEach(function(w) { var r = g.rows[w]; if (!r) return; S[w].u += r.netUnits; S[w].n++; if (r.correct === 'Yes') S[w].h++; });
      });
      return S;
    }
    function mcGpa(D, who) {
      var all = [];
      D.games.forEach(function(g) { if (g.grades[who]) all = all.concat(g.grades[who].picks); });
      if (!all.length) return null;
      var pts = all.reduce(function(a, x) { return a + GRADE_PTS[x.g]; }, 0) / all.length;
      return { g: mcGradeFromPts(pts), pts: pts, n: all.length, picks: all };
    }
    function mcPrice(x) { return '+' + Math.round(x.price) + (x.real ? '' : ' <span class="mc-est">est</span>'); }
    function mcChip(g) { return '<span class="mc-grade g-' + g.replace('+', 'p') + '">' + g + '</span>'; }

    // ── The 🤖 Machine tab ──
    function loadMachineTab() {
      var el = document.getElementById('machine-content');
      if (!el) return;
      if (!el.innerHTML) el.innerHTML = '<div class="loading">Waking up the Machine…</div>';
      loadMachine(true).then(function(D) { drawMachineTab(el, D); })
        .catch(function() { el.innerHTML = '<div class="loading">Couldn\'t reach the Machine. Check your connection.</div>'; });
    }
    function drawMachineTab(el, D) {
      var pub = D.pub, St = mcStandings(D, MACHINE.realOnly);
      var h = '<div class="mch-hero"><div class="mch-bot">🤖</div><div><div class="mch-t">The Machine</div>' +
        '<div class="mch-s">A first-TD model trained on ' + (pub.games ? pub.games.toLocaleString() : 'every') + ' NFL games since 2023. It plays every game Maria and Danielle play: one player per team, from the same list they pick from, sealed until kickoff.</div></div></div>';
      if (!D.games.length) {
        el.innerHTML = h + '<div class="ch-empty">' + (D.sealed ? '🔒 Its picks for ' + D.sealed + ' upcoming game' + (D.sealed === 1 ? '' : 's') + ' are sealed until kickoff.' : 'No picks yet. The Machine is still learning.') + '</div>';
        return;
      }
      // Standings
      var order = ['Machine', 'Maria', 'Danielle'].sort(function(a, b) { return St[b].u - St[a].u; });
      h += '<div class="pf-h">🏁 ' + D.year + ' standings <small>the same ' + St.Machine.n + ' games for all three</small></div>' +
        '<div class="af-bar" style="margin-bottom:8px"><button class="filter-btn' + (!MACHINE.realOnly ? ' active' : '') + '" data-mc-real="0">All games</button><button class="filter-btn' + (MACHINE.realOnly ? ' active' : '') + '" data-mc-real="1">Real odds only</button></div>' +
        '<div class="mch-stand">' + order.map(function(w, i) {
          var s = St[w], c = w === 'Machine' ? MC_COLOR : personColor(w);
          return '<div class="mch-st' + (i === 0 ? ' lead' : '') + '" style="--c:' + c + '"><div class="mch-rank">' + (i + 1) + '</div><div class="mch-who">' + (w === 'Machine' ? '🤖 The Machine' : w) + '</div>' +
            '<div class="mch-u" style="color:' + (s.u >= 0 ? '#34D399' : '#F87171') + '">' + fmtU(s.u) + (w === 'Machine' && !MACHINE.realOnly ? ' <span class="mc-est">est</span>' : '') + '</div>' +
            '<div class="mch-r">' + s.h + ' of ' + s.n + ' games hit' + (s.n ? ' (' + Math.round(s.h / s.n * 100) + '%)' : '') + '</div></div>';
        }).join('') + '</div>' +
        '<div class="mc-note">' + (MACHINE.realOnly ? 'Leaves out games the Machine hit at an estimated price, so every number here comes from odds you typed in.' : 'When the Machine picks someone Maria or Danielle also picked, it gets the real odds. Otherwise its price is an estimate of what FanDuel would have posted ("est").') + '</div>';
      // Grades
      var gm = mcGpa(D, 'Maria'), gd = mcGpa(D, 'Danielle');
      if (gm || gd) {
        var allG = [];
        D.games.forEach(function(g) { ['Maria', 'Danielle'].forEach(function(w) { if (g.grades[w]) g.grades[w].picks.forEach(function(x) { allG.push({ w: w, x: x, g: g }); }); }); });
        var bestMiss = allG.filter(function(a) { return a.g.settled && !a.x.hit && (a.x.g === 'A+' || a.x.g === 'A'); }).sort(function(a, b) { return b.x.ratio - a.x.ratio; })[0];
        var luckyHit = allG.filter(function(a) { return a.x.hit && (a.x.g === 'D' || a.x.g === 'F'); }).sort(function(a, b) { return a.x.ratio - b.x.ratio; })[0];
        function gp(a) { return '<b style="color:' + personColor(a.w) + '">' + a.w + '</b>\'s ' + escHtml(a.x.name) + ' at +' + Math.round(a.x.odds) + ' (' + Math.round(a.x.chance * 100) + '% chance) · ' + D.year + ' ' + wkName(a.g.week); }
        h += '<div class="pf-h">📝 Pick grades <small>the price they got vs the player\'s real chance</small></div><div class="mch-grades">' +
          [['Maria', gm], ['Danielle', gd]].filter(function(x) { return x[1]; }).map(function(x) {
            return '<div class="mch-gr" style="--c:' + personColor(x[0]) + '">' + mcChip(x[1].g) + '<div><div class="mch-who">' + x[0] + '</div><div class="mch-r">' + x[1].n + ' picks graded · ' + x[1].pts.toFixed(2) + ' GPA</div></div></div>';
          }).join('') + '</div>' +
          (bestMiss ? '<div class="mch-call">💎 <b>Best value that missed:</b> ' + gp(bestMiss) + ' ' + mcChip(bestMiss.x.g) + '</div>' : '') +
          (luckyHit ? '<div class="mch-call">🍀 <b>Luckiest hit:</b> ' + gp(luckyHit) + ' ' + mcChip(luckyHit.x.g) + '</div>' : '') +
          '<div class="mc-note">A grade is about the price, not the result: an A that misses was still a smart bet, and an F that hits was a lucky one. It compares the odds they got with what FanDuel usually charges for a player with the same chance.</div>';
      }
      // Picks, week by week
      var weeks = []; D.games.forEach(function(g) { if (weeks.indexOf(g.week) < 0) weeks.push(g.week); });
      h += '<div class="pf-h">🗓️ Its picks <small>' + (D.sealed ? '🔒 ' + D.sealed + ' upcoming sealed until kickoff' : 'every game they played') + '</small></div>';
      weeks.forEach(function(w) {
        var list = D.games.filter(function(g) { return g.week === w; });
        h += '<div class="mch-wk">' + wkName(w) + (list.some(function(g) { return g.retro; }) ? ' <span class="mch-retro" title="Made after the fact, using only what was known before kickoff">made after the fact</span>' : '') + '</div>' + list.map(mcGameHtml).join('');
      });
      // How it works
      var R = pub.report;
      if (R) h += '<div class="pf-h">🧠 How good is it?</div><div class="mc-note" style="margin-bottom:24px">Tested on ' + R.tested + ' games it never trained on, its picks hit ' + Math.round(R.two * 1000) / 10 + '% of the time' +
        (R.theirN >= 10 ? ' (' + Math.round(R.their * 1000) / 10 + '% on games Maria and Danielle played)' : '') + ', and it called which team scores first ' + Math.round(R.team * 100) + '% of the time. ' +
        'It works out each player\'s chance from his team\'s odds of scoring first (spread and recent form) times his recent share of the team\'s touchdowns and goal-line touches. Last trained ' + (pub.trainedAt ? new Date(pub.trainedAt).toLocaleDateString() : '—') + '.</div>';
      el.innerHTML = h;
      if (typeof fillHeadshots === 'function') fillHeadshots(el);
      el.querySelectorAll('[data-mc-real]').forEach(function(b) { b.addEventListener('click', function() { MACHINE.realOnly = b.getAttribute('data-mc-real') === '1'; drawMachineTab(el, D); }); });
    }
    function mcGameHtml(g) {
      function nick(t) { return escHtml(resolveTeam(t).split(' ').pop()); }
      var h = '<div class="mch-g"><div class="mch-gh"><span>' + teamLogo(g.away) + nick(g.away) + ' @ ' + nick(g.home) + teamLogo(g.home) + '</span>' +
        '<span class="mch-ftd">' + (g.settled ? '🏈 ' + escHtml(g.scorer) + (g.notOffered ? ' · not offered' : '') : '<span class="ls-dot"></span> live') + '</span></div>';
      h += '<div class="mch-row mc"><span class="mch-lbl" style="color:' + MC_COLOR + '">🤖</span>' + g.picks.map(function(x) {
        var hit = g.hit === x;
        return '<span class="mch-p' + (hit ? ' hit' : g.settled ? ' miss' : '') + '">' + headshot(x.name, x.team, 22) + escHtml(x.name) + ' <small>' + Math.round(x.pct * 100) + '% · ' + mcPrice(x) + '</small>' + (hit ? ' ✅' : '') + '</span>';
      }).join('') + (g.settled ? '<b class="mch-units" style="color:' + (g.units >= 0 ? '#34D399' : '#F87171') + '">' + fmtU(g.units) + '</b>' : '') + '</div>';
      ['Maria', 'Danielle'].forEach(function(w) {
        var gr = g.grades[w], r = g.rows[w];
        if (!r) return;
        var picks = gr ? gr.picks : [r.homePick, r.awayPick].filter(Boolean).map(function(n) { return { name: n, g: null }; });
        h += '<div class="mch-row"><span class="mch-lbl" style="color:' + personColor(w) + '">' + w.charAt(0) + '</span>' + picks.map(function(x) {
          var hit = g.settled && playerKey(x.name) === playerKey(g.scorer);
          return '<span class="mch-p' + (hit ? ' hit' : g.settled ? ' miss' : '') + '">' + escHtml(x.name) + (x.chance ? ' <small>' + Math.round(x.chance * 100) + '% · +' + Math.round(x.odds) + '</small>' : '') + (x.g ? ' ' + mcChip(x.g) : '') + (hit ? ' ✅' : '') + '</span>';
        }).join('') + (g.settled ? '<b class="mch-units" style="color:' + (r.netUnits >= 0 ? '#34D399' : '#F87171') + '">' + fmtU(r.netUnits) + '</b>' : '') + '</div>';
      });
      return h + '</div>';
    }

    // ── Its profile (Profiles tab, 🤖 button) ──
    function renderMachineProfile(el) {
      el.innerHTML = profileSwitchHtml('Machine') + '<div class="loading">Loading…</div>';
      bindProfileSwitch(el);
      loadMachine().then(function(D) {
        var S = mcStandings(D, false).Machine;
        var hits = D.games.filter(function(g) { return g.hit; });
        var best = hits.slice().sort(function(a, b) { return b.hit.price - a.hit.price; })[0];
        var fav = {}; D.games.forEach(function(g) { g.picks.forEach(function(x) { fav[x.name] = (fav[x.name] || 0) + 1; }); });
        var favN = Object.keys(fav).sort(function(a, b) { return fav[b] - fav[a]; })[0];
        var h = profileSwitchHtml('Machine') +
          '<div class="pf-hero" style="--pc:' + MC_COLOR + ';background:linear-gradient(140deg,#0F0F12 0%,#1E1240 55%,#5B21B6 100%)"><div class="mch-avatar">🤖</div>' +
          '<div class="pf-name" style="color:' + MC_COLOR + '">The Machine</div><div class="pf-sub">' + D.year + ' · ' + S.n + ' games played</div>' +
          '<div class="pf-big"><div><b>' + S.h + '/' + S.n + '</b><span>Record · ' + (S.n ? Math.round(S.h / S.n * 100) : 0) + '%</span></div>' +
          '<div><b style="color:' + (S.u >= 0 ? '#34D399' : '#F87171') + '">' + shortU(S.u) + '</b><span>Units (est)</span></div>' +
          '<div><b>' + D.sealed + '</b><span>Sealed picks</span></div></div></div>' +
          '<div class="pf-tiles">' +
            '<div class="pf-tile"><div class="l">Best hit</div><div class="v">' + (best ? escHtml(best.hit.name) + ' +' + Math.round(best.hit.price) : '—') + '</div><div class="s">' + (best ? wkName(best.week) + (best.hit.real ? '' : ' · est price') : '') + '</div></div>' +
            '<div class="pf-tile"><div class="l">Favorite pick</div><div class="v">' + (favN ? escHtml(favN) : '—') + '</div><div class="s">' + (favN ? 'picked ' + fav[favN] + 'x' : '') + '</div></div>' +
          '</div>' +
          '<div class="mc-note" style="margin:6px 0 14px">It doesn\'t have opinions, just numbers: every pick is the offered player with the best chance on his side. <button class="link-btn" onclick="switchTab(\'machine\')">See every pick →</button></div>' +
          '<div class="tcd-slot" id="mc-cards"></div>';
        el.innerHTML = h;
        bindProfileSwitch(el);
        var slot = document.getElementById('mc-cards');
        loadScriptOnce('js/cards.js').then(function() {
          rostersReady().then(function() {
            drawCardAlbum(slot, { key: 'machine', who: 'The Machine', color: MC_COLOR, seasons: false, mode: 'odds',
              hits: hits.map(function(g) { return { name: g.hit.name, team: g.hit.team, year: D.year, week: g.week, odds: g.hit.price, units: g.units }; }) });
          });
        }).catch(function() {});
      }).catch(function() { el.innerHTML = profileSwitchHtml('Machine') + '<div class="loading">Couldn\'t reach the Machine.</div>'; bindProfileSwitch(el); });
    }

    // ── 3-way line on Stats ──
    function renderMachineLine() {
      var el = document.getElementById('machine-line');
      if (!el) return;
      loadMachine().then(function(D) {
        var S = mcStandings(D, false);
        if (!S.Machine.n) { el.style.display = 'none'; return; }
        el.innerHTML = '🤖 <b style="color:' + MC_COLOR + '">The Machine</b> ' + fmtU(S.Machine.u) + ' <span class="mc-est">est</span> · ' + S.Machine.h + ' of ' + S.Machine.n + ' hit · ' +
          '<button class="link-btn" onclick="switchTab(\'machine\')">vs Maria ' + fmtU(S.Maria.u) + ' & Danielle ' + fmtU(S.Danielle.u) + ' →</button>';
        el.style.display = '';
      }).catch(function() {});
    }
