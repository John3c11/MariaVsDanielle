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
      // Sealed = picks it has already made for games that haven't kicked off (the script only sends the count)
      return { pub: pub, year: year, games: games, gradeMap: gradeMap, anyEst: games.some(function(g) { return g.estHit; }), sealed: pub.sealed != null ? pub.sealed : 0, made: pub.made != null ? pub.made : games.length, trained: !!pub.trainedAt };
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

    // ── The 🤖 Machine tab ──
    function loadMachineTab() {
      var el = document.getElementById('machine-content');
      if (!el) return;
      if (!el.innerHTML) el.innerHTML = '<div class="loading">Waking up the Machine…</div>';
      loadMachine(true).then(function(D) { drawMachineTab(el, D); })
        .catch(function() { el.innerHTML = '<div class="loading">Couldn\'t reach the Machine. Check your connection.</div>'; });
    }
    // Laid out like the Stats tab: the three of them over the same games, a units race, then a game-by-game log
    var MC_WHO = ['Maria', 'Danielle', 'Machine'];
    function mcColor(w) { return w === 'Machine' ? MC_COLOR : personColor(w); }
    function mcName(w) { return w === 'Machine' ? 'The Machine' : w; }
    function drawMachineTab(el, D) {
      var pub = D.pub;
      var h = '';
      if (!D.games.length) {
        el.innerHTML = '<div class="mch-hero"><div class="mch-bot">🤖</div><div><div class="mch-t">The Machine</div>' +
          '<div class="mch-s">A first-TD model trained on ' + (pub.games ? pub.games.toLocaleString() : 'every') + ' NFL games since 2023. It plays every game Maria and Danielle play, sealed until kickoff.</div></div></div>' +
          '<div class="ch-empty">' + (!D.trained ? 'The Machine is still learning from every NFL game since 2023. Its picks show up here once it\'s trained.'
          : !D.made ? 'The Machine is trained but hasn\'t made its picks yet. It makes them on its own within the hour, including the 2026 games already played.'
          : '🔒 Its picks for ' + D.sealed + ' upcoming game' + (D.sealed === 1 ? '' : 's') + ' are sealed until kickoff.') + '</div>';
        return;
      }
      // Totals over the same settled games
      var T = {}; MC_WHO.forEach(function(w) { T[w] = { u: 0, d: 0, h: 0, n: 0 }; });
      var W = {}, race = [];
      D.games.slice().reverse().forEach(function(g) {
        if (!g.settled || g.notOffered) return;
        var amt = parseFloat((g.rows.Maria || g.rows.Danielle || {}).amount) || 5;
        var res = { Machine: { u: g.units, h: g.hit ? 1 : 0 } };
        ['Maria', 'Danielle'].forEach(function(w) { var r = g.rows[w]; if (r) res[w] = { u: r.netUnits, h: r.correct === 'Yes' ? 1 : 0, d: r.netDollars }; });
        MC_WHO.forEach(function(w) {
          if (!res[w]) return;
          T[w].u += res[w].u; T[w].n++; T[w].h += res[w].h; T[w].d += res[w].d != null ? res[w].d : res[w].u * amt;
          (W[g.week] = W[g.week] || { Maria: 0, Danielle: 0, Machine: 0 })[w] += res[w].h;
        });
        race.push({ g: g, Maria: T.Maria.u, Danielle: T.Danielle.u, Machine: T.Machine.u });
      });
      // Weeks won (most hits that week; a tie at the top counts as tied)
      var won = { Maria: 0, Danielle: 0, Machine: 0, tied: 0 };
      Object.keys(W).forEach(function(k) {
        var top = Math.max(W[k].Maria, W[k].Danielle, W[k].Machine), at = MC_WHO.filter(function(w) { return W[k][w] === top; });
        if (at.length === 1) won[at[0]]++; else won.tied++;
      });
      var rank = MC_WHO.slice().sort(function(a, b) { return T[b].u - T[a].u; });
      var lead = rank[0], gap = T[rank[0]].u - T[rank[1]].u;
      h += '<div class="sb mch-sb ' + (lead === 'Maria' ? 'sb-maria' : lead === 'Danielle' ? 'sb-danielle' : 'sb-machine') + '">' +
        '<div class="mch-head"><div class="mch-av"><img src="pics/Maria.jpeg" alt="Maria"><span>Maria</span></div><i>vs</i>' +
        '<div class="mch-av"><img src="pics/Danielle.jpeg" alt="Danielle"><span>Danielle</span></div><i>vs</i>' +
        '<div class="mch-av mc"><b>🤖</b><span>The Machine</span></div></div>' +
        '<div class="u-d-block leader-banner">' + (gap < 0.05 ? 'It\'s <span>tied</span> at the top' : '<span>' + mcName(lead) + '</span> is leading by ' + gap.toFixed(1) + ' units') + '</div>' +
        '<div class="sb-weeks mch-weeks"><div class="mch-wt">Weeks won</div>' + MC_WHO.map(function(w) {
          return '<div><div class="n" style="color:' + mcColor(w) + '">' + won[w] + '</div><div class="l">' + w + '</div></div>';
        }).join('') + (won.tied ? '<div><div class="u-c-soft n">' + won.tied + '</div><div class="l">Tied</div></div>' : '') + '</div>' +
        '<div class="sb-grid mch-grid">' +
          mcBlock('Correct', T, function(t) { return t.h; }, function(t) { return t.h + '/' + t.n; }) +
          mcBlock('Accuracy', T, function(t) { return t.n ? t.h / t.n : 0; }, function(t) { return t.n ? Math.round(t.h / t.n * 100) + '%' : '—'; }) +
          mcBlock('Units', T, function(t) { return t.u; }, function(t, w) { return shortU(t.u).replace('u', '') + (w === 'Machine' && D.anyEst ? '<sup>est</sup>' : ''); }) +
          mcBlock('Dollars', T, function(t) { return t.d; }, function(t, w) { return shortD(t.d) + (w === 'Machine' && D.anyEst ? '<sup>est</sup>' : ''); }) +
        '</div>' +
        '<div class="mch-foot">' + T.Machine.n + ' games, the same ones for all three.' + (D.anyEst ? ' "est": at least one of its hits is paid at an estimate of FanDuel\'s odds until the real price is entered.' : ' Every hit is paid at real FanDuel odds.') + '</div></div>';
      // Units race
      if (race.length >= 2 && typeof chLineChart === 'function') {
        var tips = [''].concat(race.map(function(x) { return wkName(x.g.week) + ' · Maria ' + chU(x.Maria) + ' · Danielle ' + chU(x.Danielle) + ' · Machine ' + chU(x.Machine); }));
        h += '<div class="pf-h">📈 Units race <small>game by game, ' + D.year + '</small></div><div class="ch-box mch-race">' +
          chLineChart({ n: race.length + 1, series: MC_WHO.map(function(w) { return { name: mcName(w), color: mcColor(w), vals: [0].concat(race.map(function(x) { return x[w]; })) }; }),
            xLabels: [], dividers: [], tips: tips, fmt: function(v, axis) { return axis ? (v > 0 ? '+' : '') + v : chU(v); }, height: 240 }) +
          '</div>';
      }
      // Bet log: one card per game, one line per person
      var weeks = []; D.games.forEach(function(g) { if (weeks.indexOf(g.week) < 0) weeks.push(g.week); });
      h += '<div class="pf-h">🧾 Bet log <small>' + (D.sealed ? '🔒 ' + D.sealed + ' upcoming pick' + (D.sealed === 1 ? '' : 's') + ' sealed until kickoff' : 'newest first') + '</small></div>';
      weeks.forEach(function(w) {
        var list = D.games.filter(function(g) { return g.week === w; });
        h += '<div class="mch-wk">' + wkName(w) + (list.some(function(g) { return g.retro; }) ? ' <span class="mch-retro" title="The Machine made these picks after the fact, using only what was known before kickoff">Machine picked after the fact</span>' : '') + '</div>' + list.map(mcGameHtml).join('');
      });
      var R = pub.report;
      if (R) h += '<div class="u-m-14px-0-24px mc-note">🧠 How it picks: each player\'s chance = his team\'s chance of scoring first (spread and recent form) × his recent share of the team\'s touchdowns and goal-line touches. Tested on ' + R.tested + ' games it never saw, its picks hit ' + Math.round(R.two * 1000) / 10 + '% of the time.</div>';
      el.innerHTML = h;
      if (typeof fillHeadshots === 'function') fillHeadshots(el);
    }
    // One stat with three values and bars (Maria, Danielle, Machine)
    function mcBlock(label, T, val, show) {
      var vals = MC_WHO.map(function(w) { return val(T[w]); });
      var lo = Math.min.apply(null, vals.concat([0])), hi = Math.max.apply(null, vals.concat([0])), span = (hi - lo) || 1;
      return '<div class="stat-block mch-block"><div class="stat-label">' + label + '</div><div class="mch-vals">' + MC_WHO.map(function(w, i) {
        return '<div class="mch-val"><b style="color:' + mcColor(w) + '">' + show(T[w], w) + '</b><div class="mch-bar"><i style="width:' + Math.max(4, Math.round((vals[i] - lo) / span * 100)) + '%;background:' + mcColor(w) + '"></i></div></div>';
      }).join('') + '</div></div>';
    }
    function mcGameHtml(g) {
      function nick(t) { return escHtml(resolveTeam(t).split(' ').pop()); }
      function pick(name, odds, est, settled) {
        var hit = settled && playerKey(name) === playerKey(g.scorer);
        return '<span class="mch-pk' + (hit ? ' hit' : settled ? ' miss' : '') + '">' + (hit ? '✅ ' : '') + escHtml(name) + (odds ? ' <small>+' + Math.round(odds) + (est ? ' est' : '') + '</small>' : '') + '</span>';
      }
      var h = '<div class="mch-g"><div class="mch-gh"><span class="mch-match"' + (typeof gameLinkAttr === 'function' ? ' ' + gameLinkAttr(MACHINE.data ? MACHINE.data.year : CURRENT_YEAR, g.game) + ' title="Open this game"' : '') + '>' + teamLogo(g.away) + nick(g.away) + ' <i>@</i> ' + nick(g.home) + teamLogo(g.home) + '</span>' +
        '<span class="mch-ftd">' + (g.settled ? '🏈 ' + escHtml(g.scorer) + (g.notOffered ? ' <small>not offered</small>' : '') : '<span class="ls-dot"></span> in progress') + '</span></div>';
      MC_WHO.forEach(function(w) {
        var line, units = null;
        if (w === 'Machine') {
          line = g.picks.map(function(x) { return pick(x.name, x.price, !x.real, g.settled); }).join('');
          if (g.settled) units = g.units;
        } else {
          var r = g.rows[w];
          if (!r) return;
          line = [[r.homePick, r.homeOdds], [r.awayPick, r.awayOdds]].filter(function(x) { return x[0]; }).map(function(x) { return pick(x[0], oddsN(x[1]) * 100, false, g.settled); }).join('');
          if (g.settled) units = r.netUnits;
        }
        h += '<div class="mch-line"><span class="mch-who" style="color:' + mcColor(w) + '">' + (w === 'Machine' ? '🤖 Machine' : w) + '</span><span class="mch-picks">' + line + '</span>' +
          (units === null ? '' : '<b class="mch-units" style="color:' + (units > 0 ? '#34D399' : units < 0 ? '#F87171' : '#A1A9B6') + '">' + fmtU(units) + '</b>') + '</div>';
      });
      return h + '</div>';
    }

    // ── Its profile (Profiles tab, 🤖 button) ──
    function renderMachineProfile(el) {
      el.innerHTML = profileSwitchHtml('Machine') + '<div class="loading">Loading…</div>';
      bindProfileSwitch(el);
      loadMachine().then(function(D) {
        if (!D.games.length) {
          el.innerHTML = profileSwitchHtml('Machine') + '<div class="pf-hero" style="--pc:' + MC_COLOR + ';background:linear-gradient(140deg,#0F0F12 0%,#1E1240 55%,#5B21B6 100%)"><div class="mch-avatar">🤖</div>' +
            '<div class="pf-name" style="color:' + MC_COLOR + '">The Machine</div><div class="pf-sub">' + (D.made ? '🔒 ' + D.sealed + ' pick' + (D.sealed === 1 ? '' : 's') + ' sealed until kickoff' : D.trained ? 'Trained. Its first picks are on the way.' : 'Still learning.') + '</div></div>' +
            '<div class="u-m-10px-0-24px u-ta-center mc-note">Its record, best hits and cards show up here after its first games kick off.</div>';
          bindProfileSwitch(el);
          return;
        }
        var S = mcStandings(D, false).Machine;
        var hits = D.games.filter(function(g) { return g.hit; });
        var best = hits.slice().sort(function(a, b) { return b.hit.price - a.hit.price; })[0];
        var fav = {}; D.games.forEach(function(g) { g.picks.forEach(function(x) { fav[x.name] = (fav[x.name] || 0) + 1; }); });
        var favN = Object.keys(fav).sort(function(a, b) { return fav[b] - fav[a]; })[0];
        var h = profileSwitchHtml('Machine') +
          '<div class="pf-hero" style="--pc:' + MC_COLOR + ';background:linear-gradient(140deg,#0F0F12 0%,#1E1240 55%,#5B21B6 100%)"><div class="mch-avatar">🤖</div>' +
          '<div class="pf-name" style="color:' + MC_COLOR + '">The Machine</div><div class="pf-sub">' + D.year + ' · ' + S.n + ' games played</div>' +
          '<div class="pf-big"><div><b>' + S.h + '/' + S.n + '</b><span>Record · ' + (S.n ? Math.round(S.h / S.n * 100) : 0) + '%</span></div>' +
          '<div><b style="color:' + (S.u >= 0 ? '#34D399' : '#F87171') + '">' + shortU(S.u) + '</b><span>Units' + (D.anyEst ? ' (est)' : '') + '</span></div>' +
          '<div><b>' + D.sealed + '</b><span>Sealed picks</span></div></div></div>' +
          '<div class="pf-tiles">' +
            '<div class="pf-tile"><div class="l">Best hit</div><div class="v">' + (best ? escHtml(best.hit.name) + ' +' + Math.round(best.hit.price) : '—') + '</div><div class="s">' + (best ? wkName(best.week) + (best.hit.real ? '' : ' · est price') : '') + '</div></div>' +
            '<div class="pf-tile"><div class="l">Favorite pick</div><div class="v">' + (favN ? escHtml(favN) : '—') + '</div><div class="s">' + (favN ? 'picked ' + fav[favN] + 'x' : '') + '</div></div>' +
          '</div>' +
          '<div class="u-m-6px-0-14px mc-note">It doesn\'t have opinions, just numbers: every pick is the offered player with the best chance on his side. <button class="link-btn" onclick="switchTab(\'machine\')">See every pick →</button></div>' +
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
        el.innerHTML = '🤖 <b style="color:' + MC_COLOR + '">The Machine</b> ' + fmtU(S.Machine.u) + (D.anyEst ? ' <span class="mc-est">est</span>' : '') + ' · ' + S.Machine.h + ' of ' + S.Machine.n + ' hit · ' +
          '<button class="link-btn" onclick="switchTab(\'machine\')">vs Maria ' + fmtU(S.Maria.u) + ' & Danielle ' + fmtU(S.Danielle.u) + ' →</button>';
        el.style.display = '';
      }).catch(function() {});
    }
