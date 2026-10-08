// Insights: luck meter, season race, chaos corner, team report card numbers, the Record Book
// and the season win-probability bar on Stats.
// Part of the MariaVsDanielle site. All js/ files share one global scope and load in the order listed in index.html.
// Rows here are the shared bet objects from loadAllBets() (core.js), oldest first.

    // ── Odds helpers ─────────────────────────────────────────────────────────
    // Sheet odds are "+15" (= +1500) or "1500". Returns the payout in units (15).
    function oddsN(v) { var n = parseFloat(String(v == null ? '' : v).replace('+', '')); return n > 0 ? (n >= 100 ? n / 100 : n) : 0; }
    // The chance the odds imply: +1500 -> 1 in 16 -> 6.25%
    function impliedP(v) { var n = oddsN(v); return n ? 1 / (n + 1) : 0; }
    // Chance one bet hits = either pick scoring first (they can't both)
    function betChance(r) {
      var p = 0, known = false;
      if (r.homePick) { if (!oddsN(r.homeOdds)) return null; p += impliedP(r.homeOdds); known = true; }
      if (r.awayPick) { if (!oddsN(r.awayOdds)) return null; p += impliedP(r.awayOdds); known = true; }
      return known ? p : null;
    }
    function isMD(n) { return n === 'Maria' || n === 'Danielle'; }
    function gameKey(r) { return r.year + '_' + r.week + '_' + r.game; }
    // One entry per game, in order, with each person's bet
    function gamesOf(bets) {
      var G = [], gi = {};
      bets.forEach(function(r) {
        var k = gameKey(r);
        if (!(k in gi)) { gi[k] = G.length; G.push({ year: r.year, week: r.week, home: r.homeTeam, away: r.awayTeam, slot: r.slot, by: {} }); }
        G[gi[k]].by[r.picker] = r;
      });
      return G;
    }
    function weekLabels(G, season) {
      var xl = [], dv = [];
      G.forEach(function(g, i) {
        if (season === 'all' && i > 0 && g.year !== G[i - 1].year) dv.push({ i: i + 1, label: g.year });
        if (season !== 'all' && (i === 0 || g.week !== G[i - 1].week)) xl.push({ i: i + 1, label: wkShort(g.week) });
      });
      var keep = Math.ceil(xl.length / 9);
      return { xl: xl.filter(function(l, k) { return k % keep === 0; }), dv: dv };
    }

    // ── 🏁 Season Race: running units, game by game (moved here from Stats) ──
    function seasonRaceChart(rows, season) {
      var G = gamesOf(rows.filter(function(r) { return (season === 'all' || r.year === season) && isMD(r.picker) && r.homeTeam && (r.correct === 'Yes' || r.correct === 'No'); }));
      if (G.length < 2) return '<div class="ch-empty">Needs at least 2 scored games.</div>';
      var m = [0], d = [0], tips = [''];
      G.forEach(function(g, i) {
        m.push(m[i] + (g.by.Maria ? g.by.Maria.netUnits : 0));
        d.push(d[i] + (g.by.Danielle ? g.by.Danielle.netUnits : 0));
        tips.push((season === 'all' ? g.year + ' ' : '') + wkName(g.week) + ' ' + teamNick(g.home) + ' vs ' + teamNick(g.away) + ' · Maria ' + chU(m[i + 1]) + ' · Danielle ' + chU(d[i + 1]));
      });
      var lab = weekLabels(G, season);
      return chLineChart({ n: G.length + 1, series: [{ name: 'Maria', color: SB_M, vals: m }, { name: 'Danielle', color: SB_D, vals: d }],
        xLabels: lab.xl, dividers: lab.dv, tips: tips, fmt: function(v, axis) { return axis ? (v > 0 ? '+' : '') + v : chU(v); } });
    }
    function teamNick(t) { return resolveTeam(t || '').split(' ').pop(); }

    // ── 🍀 Luck Meter: hits vs what the odds said ─────────────────────────────
    function luckData(rows, season) {
      var out = { Maria: { hits: 0, exp: 0, n: 0 }, Danielle: { hits: 0, exp: 0, n: 0 } }, series = { Maria: [0], Danielle: [0] }, tips = [''];
      var G = gamesOf(rows.filter(function(r) {
        return (season === 'all' || r.year === season) && isMD(r.picker) && (r.correct === 'Yes' || r.correct === 'No') && !isNotOffered(r) && betChance(r) !== null;
      }));
      G.forEach(function(g) {
        ['Maria', 'Danielle'].forEach(function(n) {
          var r = g.by[n], o = out[n];
          if (r) { o.n++; o.exp += betChance(r); if (r.correct === 'Yes') o.hits++; }
          series[n].push(o.n ? Math.round((o.hits - o.exp) * 100) / 100 : null);
        });
        tips.push((season === 'all' ? g.year + ' ' : '') + wkName(g.week) + ' · Maria ' + luckTxt(out.Maria.hits - out.Maria.exp) + ' · Danielle ' + luckTxt(out.Danielle.hits - out.Danielle.exp));
      });
      return { out: out, G: G, series: series, tips: tips };
    }
    function luckTxt(v) { return (v >= 0 ? '+' : '') + v.toFixed(1); }
    function luckVerdict(o) {
      var diff = o.hits - o.exp;
      if (o.n < 4) return { t: 'Not enough bets yet', c: '#A1A9B6' };
      if (diff >= 1) return { t: '🔥 Running hot', c: '#34D399' };
      if (diff <= -1) return { t: '🧊 Running cold (she\'s due)', c: '#93C5FD' };
      return { t: '⚖️ Right where the odds say', c: '#D1D5DB' };
    }
    function luckSection(rows, season) {
      var L = luckData(rows, season);
      if (L.out.Maria.n + L.out.Danielle.n < 4) return '<div class="ch-empty">Needs a few more scored bets with odds.</div>';
      var cards = '<div class="lk-cards">' + ['Maria', 'Danielle'].map(function(n) {
        var o = L.out[n], v = luckVerdict(o), diff = o.hits - o.exp;
        return '<div class="lk-card" style="--pc:' + personColor(n) + '"><div class="lk-name">' + n + '</div>' +
          '<div class="lk-big" style="color:' + v.c + '">' + luckTxt(diff) + '</div>' +
          '<div class="lk-sub">' + o.hits + ' hit' + (o.hits === 1 ? '' : 's') + ' vs ' + o.exp.toFixed(1) + ' expected</div>' +
          '<div class="lk-v" style="color:' + v.c + '">' + v.t + '</div></div>';
      }).join('') + '</div>';
      var lab = weekLabels(L.G, season);
      var chart = L.G.length >= 2 ? chLineChart({ n: L.G.length + 1, series: [{ name: 'Maria', color: SB_M, vals: L.series.Maria }, { name: 'Danielle', color: SB_D, vals: L.series.Danielle }],
        xLabels: lab.xl, dividers: lab.dv, tips: L.tips, fmt: function(v) { return luckTxt(v); } }) : '';
      return cards + (chart ? '<div class="ch-box">' + chart + '</div>' : '') +
        '<div class="ch-note">Each bet\'s odds say how likely it was to hit (+1500 is about 6%, and two picks add up). Above the line = more hits than the odds expected. Not-offered games are skipped.</div>';
    }

    // ── 🌀 Chaos Corner: first TDs nobody could see coming ───────────────────
    var CHAOS_POS = {
      CB: '🛡️ Defense', S: '🛡️ Defense', FS: '🛡️ Defense', SS: '🛡️ Defense', DB: '🛡️ Defense', LB: '🛡️ Defense', ILB: '🛡️ Defense', OLB: '🛡️ Defense',
      MLB: '🛡️ Defense', DE: '🛡️ Defense', DT: '🛡️ Defense', NT: '🛡️ Defense', DL: '🛡️ Defense', EDGE: '🛡️ Defense',
      OT: '🐘 Lineman', T: '🐘 Lineman', G: '🐘 Lineman', OG: '🐘 Lineman', C: '🐘 Lineman', OL: '🐘 Lineman',
      K: '🦵 Kicker', P: '🦵 Punter', PK: '🦵 Kicker', LS: '🐘 Long snapper',
    };
    function chaosGames(rows, season) {
      var G = gamesOf(rows.filter(function(r) { return (season === 'all' || r.year === season) && isMD(r.picker) && r.firstScorer; }));
      return G.map(function(g) {
        var r = g.by.Maria || g.by.Danielle, n = typeof nflOf === 'function' ? nflOf(r.firstScorer) : null;
        var tags = [];
        if (n && CHAOS_POS[n.pos]) tags.push(CHAOS_POS[n.pos]);
        if (isNotOffered(r)) tags.push('🚫 Not offered');
        return { g: g, name: r.firstScorer, pos: n ? n.pos : '', tags: tags };
      });
    }
    function chaosSection(rows, season) {
      var C = chaosGames(rows, season);
      if (!C.length) return '<div class="ch-empty">No first TDs yet.</div>';
      var wk = {}, order = [];
      C.forEach(function(c) {
        var k = (season === 'all' ? c.g.year + ' ' : '') + wkName(c.g.week);
        if (!wk[k]) { wk[k] = { n: 0, chaos: 0, bar: PLAYOFF_SHORT[parseInt(c.g.week, 10)] || String(c.g.week) }; order.push(k); }
        wk[k].n++; if (c.tags.length) wk[k].chaos++;
      });
      var total = C.filter(function(c) { return c.tags.length; }).length;
      var worst = order.slice().sort(function(a, b) { return wk[b].chaos / wk[b].n - wk[a].chaos / wk[a].n || wk[b].chaos - wk[a].chaos; })[0];
      var h = '<div class="cc-top"><div><b>' + total + '</b> of ' + C.length + ' first TDs came from off the board</div>' +
        (wk[worst].chaos ? '<div>Most chaotic: <b>' + worst + '</b> (' + wk[worst].chaos + ' of ' + wk[worst].n + ')</div>' : '') + '</div>';
      // Chaos index per week: share of that week's first TDs nobody could pick
      var recent = order.slice(-12);
      h += '<div class="cc-bars">' + recent.map(function(k) {
        var w = wk[k], pctv = Math.round(w.chaos / w.n * 100);
        return '<div class="cc-bar" data-tip="' + chTip(k + ': ' + w.chaos + ' of ' + w.n + ' first TDs from off the board') + '"><i style="height:' + Math.max(3, pctv) + '%"></i><span>' + w.bar + '</span></div>';
      }).join('') + '</div><div class="ch-note">Chaos index: how many of each week\'s first touchdowns came from defense, linemen, kickers or players who weren\'t offered.</div>';
      var weird = C.filter(function(c) { return c.tags.length; }).reverse();
      if (weird.length) {
        h += '<div class="cc-list">' + weird.slice(0, 10).map(function(c) {
          return '<div class="cc-row"><div><b>' + escHtml(c.name) + '</b>' + (c.pos ? ' <span class="cc-pos">' + escHtml(c.pos) + '</span>' : '') +
            '<div class="cc-meta">' + (season === 'all' ? c.g.year + ' ' : '') + wkName(c.g.week) + ' · ' + teamNick(c.g.home) + ' vs ' + teamNick(c.g.away) + '</div></div>' +
            '<div class="cc-tags">' + c.tags.map(function(t) { return '<span>' + t + '</span>'; }).join('') + '</div></div>';
        }).join('') + '</div>';
      }
      return h;
    }

    // ── Team Report Card numbers: units won/lost picking from each team ──────
    // A hit pays the team whose player scored; a miss costs each picked team 1 unit.
    function teamUnits(rows, season, picker) {
      var U = {};
      rows.forEach(function(r) {
        if ((season !== 'all' && r.year !== season) || !(picker === 'all' ? isMD(r.picker) : r.picker === picker)) return;
        if ((r.correct !== 'Yes' && r.correct !== 'No') || isNotOffered(r)) return;
        var sides = [];
        if (r.homePick) sides.push([r.homePick, r.homeTeam]);
        if (r.awayPick) sides.push([r.awayPick, r.awayTeam]);
        if (!sides.length) return;
        if (r.correct === 'Yes') {
          var won = sides.filter(function(s) { return s[0] === r.firstScorer; })[0];
          if (won) U[won[1]] = (U[won[1]] || 0) + r.netUnits;
        } else {
          sides.forEach(function(s) { U[s[1]] = (U[s[1]] || 0) + r.netUnits / sides.length; });
        }
      });
      return U;
    }

    // ── 📖 Record Book ───────────────────────────────────────────────────────
    // Ties go to whoever set it first: a record stands until it's beaten.
    var RECORDS = [
      { k: 'hit', ic: '💰', t: 'Biggest hit' },
      { k: 'heater', ic: '🔥', t: 'Longest heater' },
      { k: 'drought', ic: '🧊', t: 'Longest drought', shame: true },
      { k: 'bestwk', ic: '📈', t: 'Best week' },
      { k: 'worstwk', ic: '📉', t: 'Worst week', shame: true },
      { k: 'hitswk', ic: '🎯', t: 'Most hits in a week' },
      { k: 'season', ic: '🏆', t: 'Best season' },
    ];
    function computeRecords(rows) {
      var bets = rows.filter(function(r) { return isMD(r.picker) && (r.correct === 'Yes' || r.correct === 'No') && (r.homePick || r.awayPick); });
      var R = {};
      function beat(k, val, who, extra, higher) {
        if (!R[k] || (higher === false ? val < R[k].val : val > R[k].val)) R[k] = Object.assign({ val: val, who: who }, extra);
      }
      // Biggest hit
      bets.forEach(function(r) {
        if (r.correct !== 'Yes' || isNotOffered(r)) return;
        beat('hit', r.netUnits, r.picker, { year: r.year, week: r.week, txt: fmtU(r.netUnits), sub: r.firstScorer + ' · ' + r.year + ' ' + wkName(r.week) });
      });
      // Streaks (not-offered games skipped), across seasons
      ['Maria', 'Danielle'].forEach(function(n) {
        var cur = { Yes: 0, No: 0 }, start = {};
        bets.forEach(function(r) {
          if (r.picker !== n || isNotOffered(r)) return;
          var other = r.correct === 'Yes' ? 'No' : 'Yes';
          if (!cur[r.correct]) start[r.correct] = r;
          cur[r.correct]++; cur[other] = 0;
          var s = start[r.correct], span = s.year + ' ' + wkName(s.week) + (s.year + s.week === r.year + r.week ? '' : ' – ' + (s.year === r.year ? '' : r.year + ' ') + wkName(r.week));
          if (r.correct === 'Yes') beat('heater', cur.Yes, n, { year: r.year, week: r.week, txt: cur.Yes + ' straight hits', sub: span });
          else beat('drought', cur.No, n, { year: r.year, week: r.week, txt: cur.No + ' straight misses', sub: span });
        });
      });
      // Weeks and seasons
      var W = {}, S = {};
      bets.forEach(function(r) {
        var wk = r.picker + '|' + r.year + '|' + r.week, se = r.picker + '|' + r.year;
        W[wk] = W[wk] || { u: 0, h: 0, who: r.picker, year: r.year, week: r.week };
        W[wk].u += r.netUnits; if (r.correct === 'Yes' && !isNotOffered(r)) W[wk].h++;
        S[se] = S[se] || { u: 0, who: r.picker, year: r.year };
        S[se].u += r.netUnits;
      });
      Object.keys(W).forEach(function(k) {
        var w = W[k], sub = w.year + ' ' + weekName(w.week);
        beat('bestwk', Math.round(w.u * 10) / 10, w.who, { year: w.year, week: w.week, txt: fmtU(w.u), sub: sub });
        beat('worstwk', Math.round(w.u * 10) / 10, w.who, { year: w.year, week: w.week, txt: fmtU(w.u), sub: sub }, false);
        if (w.h) beat('hitswk', w.h, w.who, { year: w.year, week: w.week, txt: w.h + ' hit' + (w.h > 1 ? 's' : ''), sub: sub });
      });
      Object.keys(S).forEach(function(k) {
        var s = S[k];
        beat('season', Math.round(s.u * 10) / 10, s.who, { year: s.year, week: 0, txt: fmtU(s.u), sub: s.year + (s.year === CURRENT_YEAR ? ' (so far)' : '') });
      });
      return R;
    }
    function recordBookHtml(rows) {
      var R = computeRecords(rows);
      var items = RECORDS.filter(function(d) { return R[d.k]; });
      if (!items.length) return '';
      return '<div class="rb-list">' + items.map(function(d) {
        var r = R[d.k], fresh = r.year === CURRENT_YEAR;
        return '<div class="rb-row' + (d.shame ? ' rb-shame' : '') + '"><span class="rb-ic">' + d.ic + '</span>' +
          '<div class="rb-mid"><div class="rb-t">' + d.t + (fresh ? ' <span class="rb-new">' + CURRENT_YEAR + '</span>' : '') + '</div><div class="rb-sub">' + escHtml(r.sub) + '</div></div>' +
          '<div class="rb-val"><b style="color:' + personColor(r.who) + '">' + r.who + '</b><span>' + r.txt + '</span></div></div>';
      }).join('') + '</div>';
    }
    // 🚨 Stats banner when a record falls (each phone remembers the records it last saw)
    function checkNewRecords(all) {
      var R = computeRecords(all), now = {};
      RECORDS.forEach(function(d) {
        if (!R[d.k]) return;
        // Best season grows every week while it's this season: only announce when a new season takes it
        now[d.k] = d.k === 'season' ? R[d.k].who + '|' + R[d.k].year : R[d.k].who + '|' + R[d.k].val + '|' + R[d.k].year + '|' + R[d.k].week;
      });
      var saved = null;
      try { saved = JSON.parse(localStorage.getItem('mvd-records') || 'null'); } catch (e) {}
      try { localStorage.setItem('mvd-records', JSON.stringify(now)); } catch (e) {}
      if (!saved) return [];
      return RECORDS.filter(function(d) { return now[d.k] && saved[d.k] !== now[d.k] && R[d.k].year === CURRENT_YEAR; }).map(function(d) {
        var r = R[d.k];
        return '🚨 New record: ' + d.ic + ' <b>' + d.t + '</b>, <b style="color:' + personColor(r.who) + '">' + r.who + '</b> ' + r.txt;
      });
    }

    // ── 📊 Season win probability (Stats) ─────────────────────────────────────
    // Plays out the rest of the season 5,000 times. Each remaining bet: not offered (0u)
    // as often as it's happened so far, otherwise a hit at her hit rate (pulled toward what
    // the odds say, so a hot start doesn't count for too much) paying one of her real past
    // wins, or -2u. Seeded, so the number doesn't wiggle every time the page refreshes.
    function winProbability(cur, all) {
      var left = { Maria: 0, Danielle: 0 }, units = { Maria: 0, Danielle: 0 };
      cur.forEach(function(b) {
        if (!isMD(b.picker) || !b.home) return;
        if (b.scored) units[b.picker] += b.units; else if (!b.scorer) left[b.picker]++;
      });
      if (!left.Maria && !left.Danielle) return null;
      var P = {};
      ['Maria', 'Danielle'].forEach(function(n) {
        var mine = all.filter(function(r) { return r.picker === n && (r.correct === 'Yes' || r.correct === 'No') && (r.homePick || r.awayPick); });
        var counted = mine.filter(function(r) { return !isNotOffered(r); });
        var hits = counted.filter(function(r) { return r.correct === 'Yes'; });
        var chances = counted.map(betChance).filter(function(p) { return p !== null; });
        var prior = chances.length ? chances.reduce(function(a, b) { return a + b; }, 0) / chances.length : 0.15;
        var pays = hits.map(function(r) { return r.netUnits; }).filter(function(u) { return u > 0; });
        P[n] = {
          no: mine.length ? (mine.length - counted.length) / mine.length : 0.15,
          hit: (hits.length + 10 * prior) / (counted.length + 10),
          pays: pays.length ? pays : [10],
        };
      });
      var seed = Math.round(units.Maria * 10) * 7919 + Math.round(units.Danielle * 10) * 104729 + left.Maria * 31 + left.Danielle;
      function rnd() { seed |= 0; seed = seed + 0x6D2B79F5 | 0; var t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }
      var N = 5000, mWins = 0;
      for (var s = 0; s < N; s++) {
        var tot = { Maria: units.Maria, Danielle: units.Danielle };
        ['Maria', 'Danielle'].forEach(function(n) {
          var p = P[n];
          for (var i = 0; i < left[n]; i++) {
            if (rnd() < p.no) continue;
            tot[n] += rnd() < p.hit ? p.pays[Math.floor(rnd() * p.pays.length)] : -2;
          }
        });
        mWins += tot.Maria > tot.Danielle ? 1 : tot.Maria === tot.Danielle ? 0.5 : 0;
      }
      return { maria: mWins / N, left: left };
    }
    function renderWinProb(cur) {
      var el = document.getElementById('pace-line');
      if (!el) return;
      var weeks = {};
      cur.forEach(function(b) { if (b.scored) weeks[b.weekN] = 1; });
      if (Object.keys(weeks).length < 2) { el.style.display = 'none'; return; }
      loadAllBets().then(function(all) {
        var w = winProbability(cur, all);
        if (!w) { el.style.display = 'none'; return; }
        var m = Math.round(w.maria * 100), d = 100 - m;
        if (m > 99) { m = 99; d = 1; } if (d > 99) { d = 99; m = 1; }
        el.innerHTML = '<div class="wp-line" data-tip="' + chTip('5,000 simulated finishes to the season, using each one\'s hit rate, payouts and not-offered games so far. ' + w.left.Maria + ' bets left for Maria, ' + w.left.Danielle + ' for Danielle.') + '">' +
          '📊 Chance to win ' + CURRENT_YEAR + ': <b style="color:' + SB_M + '">Maria ' + m + '%</b> · <b style="color:' + SB_D + '">Danielle ' + d + '%</b></div>' +
          '<div class="wp-bar"><i style="width:' + m + '%;background:' + SB_M + '"></i><i style="width:' + d + '%;background:' + SB_D + '"></i></div>';
        el.style.display = '';
      }).catch(function() { el.style.display = 'none'; });
    }

    // ── 🌟 Overachievers & Busts: players vs what their odds expected ─────────
    // Each pick counts on its own: expected = the chance its odds gave it, hit = he scored first.
    function playerLuck(rows, season, picker) {
      var P = {};
      rows.forEach(function(r) {
        if ((season !== 'all' && r.year !== season) || !(picker === 'all' ? isMD(r.picker) : r.picker === picker)) return;
        if ((r.correct !== 'Yes' && r.correct !== 'No') || isNotOffered(r)) return;
        [[r.homePick, r.homeOdds, r.homeTeam], [r.awayPick, r.awayOdds, r.awayTeam]].forEach(function(s) {
          if (!s[0] || !oddsN(s[1])) return;
          var k = playerKey(s[0]);
          var p = P[k] || (P[k] = { name: s[0], team: s[2], n: 0, hits: 0, exp: 0 });
          p.n++; p.exp += impliedP(s[1]); if (r.firstScorer && playerKey(r.firstScorer) === k) p.hits++;
          p.team = s[2];
        });
      });
      return Object.keys(P).map(function(k) { return P[k]; }).filter(function(p) { return p.n >= 3; });
    }
    function bustsSection(rows, season, picker) {
      var L = playerLuck(rows, season, picker);
      if (!L.length) return '<div class="ch-empty">Needs players picked at least 3 times.</div>';
      function row(p) {
        var d = p.hits - p.exp;
        return '<div class="ob-row"><div class="ob-name">' + coloredText(escHtml(p.name), p.team) +
          '<div class="ob-meta">picked ' + p.n + '× · ' + p.hits + ' hit' + (p.hits === 1 ? '' : 's') + ' vs ' + p.exp.toFixed(1) + ' expected</div></div>' +
          '<span class="ob-d" style="color:' + (d >= 0 ? '#34D399' : '#F87171') + '">' + luckTxt(d) + '</span></div>';
      }
      var over = L.filter(function(p) { return p.hits - p.exp >= 0.3; }).sort(function(a, b) { return (b.hits - b.exp) - (a.hits - a.exp); }).slice(0, 5);
      var bust = L.filter(function(p) { return p.hits - p.exp <= -0.3; }).sort(function(a, b) { return (a.hits - a.exp) - (b.hits - b.exp); }).slice(0, 5);
      return '<div class="ob-grid"><div><div class="ob-h">🌟 Overachievers</div>' + (over.length ? over.map(row).join('') : '<div class="ob-none">Nobody yet</div>') + '</div>' +
        '<div><div class="ob-h">💀 Busts</div>' + (bust.length ? bust.map(row).join('') : '<div class="ob-none">Nobody yet</div>') + '</div></div>' +
        '<div class="ch-note">Each pick on its own: a +1500 pick is expected to score first about 6% of the time. Players picked at least 3 times. Not-offered games are skipped.</div>';
    }

    // ── 🎲 Boldness Meter: how long the odds they pick are, week by week ─────
    function oddsTxt(n) { return '+' + Math.round(n * 100); }
    function boldSection(rows, season) {
      var bets = rows.filter(function(r) { return (season === 'all' || r.year === season) && isMD(r.picker) && (r.homePick || r.awayPick); });
      var W = [], wi = {}, tot = { Maria: { s: 0, n: 0 }, Danielle: { s: 0, n: 0 } };
      var scored = { Maria: [], Danielle: [] };
      bets.forEach(function(r) {
        var picks = [[r.homePick, r.homeOdds], [r.awayPick, r.awayOdds]].filter(function(s) { return s[0] && oddsN(s[1]); });
        if (!picks.length) return;
        var avg = picks.reduce(function(a, s) { return a + oddsN(s[1]); }, 0) / picks.length;
        var k = r.year + '_' + r.week;
        if (!(k in wi)) { wi[k] = W.length; W.push({ year: r.year, week: r.week, Maria: { s: 0, n: 0 }, Danielle: { s: 0, n: 0 } }); }
        W[wi[k]][r.picker].s += avg; W[wi[k]][r.picker].n++;
        tot[r.picker].s += avg; tot[r.picker].n++;
        if ((r.correct === 'Yes' || r.correct === 'No') && !isNotOffered(r)) scored[r.picker].push({ avg: avg, hit: r.correct === 'Yes', u: r.netUnits });
      });
      if (!tot.Maria.n && !tot.Danielle.n) return '<div class="ch-empty">No odds entered yet.</div>';
      // Does going bold pay? Split each person's bets at their own middle odds
      var cards = '<div class="lk-cards lk-stack">' + ['Maria', 'Danielle'].map(function(n) {
        var t = tot[n], list = scored[n].slice().sort(function(a, b) { return a.avg - b.avg; });
        var avg = t.n ? t.s / t.n : 0, h = '';
        if (list.length >= 6) {
          var mid = list[Math.floor(list.length / 2)].avg;
          var safe = list.filter(function(b) { return b.avg < mid; }), bold = list.filter(function(b) { return b.avg >= mid; });
          function line(lbl, L) { var hits = L.filter(function(b) { return b.hit; }).length, u = L.reduce(function(a, b) { return a + b.u; }, 0); return '<div class="bm-l"><span>' + lbl + '</span><b style="color:' + (u >= 0 ? '#34D399' : '#F87171') + '">' + fmtU(u) + '</b> <i>' + hits + '/' + L.length + '</i></div>'; }
          h = line('🛡️ Safer', safe) + line('🎲 Bolder', bold);
        }
        return '<div class="lk-card" style="--pc:' + personColor(n) + '"><div class="lk-name">' + n + '</div>' +
          '<div class="lk-big">' + (t.n ? oddsTxt(avg) : '—') + '</div><div class="lk-sub">average odds per pick</div>' + h + '</div>';
      }).join('') + '</div>';
      if (W.length < 2) return cards;
      var m = W.map(function(w) { return w.Maria.n ? w.Maria.s / w.Maria.n : null; }), d = W.map(function(w) { return w.Danielle.n ? w.Danielle.s / w.Danielle.n : null; });
      var xl = [], dv = [], tips = W.map(function(w, i) {
        if (season === 'all' && i > 0 && w.year !== W[i - 1].year) dv.push({ i: i, label: w.year });
        if (season !== 'all') xl.push({ i: i, label: wkShort(w.week) });
        return (season === 'all' ? w.year + ' ' : '') + wkName(w.week) + ' · Maria ' + (m[i] === null ? '—' : oddsTxt(m[i])) + ' · Danielle ' + (d[i] === null ? '—' : oddsTxt(d[i]));
      });
      var keep = Math.ceil(xl.length / 9); xl = xl.filter(function(l, k) { return k % keep === 0; });
      var chart = chLineChart({ n: W.length, series: [{ name: 'Maria', color: SB_M, vals: m }, { name: 'Danielle', color: SB_D, vals: d }],
        xLabels: xl, dividers: dv, tips: tips, zeroLine: false, fmt: function(v) { return oddsTxt(v); } });
      return cards + '<div class="ch-box">' + chart + '</div><div class="ch-note">Average odds of the players they picked each week. Higher = bolder. "Safer / Bolder" splits each person\'s scored bets at her own middle odds.</div>';
    }

    // ── 😰 Pressure Picks: how they do when they're behind for the week ──────
    // Within each week, game by game: whoever has fewer units that week so far is "behind"
    // going into the next game. Compares hit rates behind vs ahead vs overall.
    function pressureStats(rows, season) {
      var G = gamesOf(rows.filter(function(r) { return (season === 'all' || r.year === season) && isMD(r.picker) && (r.correct === 'Yes' || r.correct === 'No') && (r.homePick || r.awayPick); }));
      var S = {}, wkU = {}, lastOf = {};
      ['Maria', 'Danielle'].forEach(function(n) { S[n] = { behind: { h: 0, n: 0, u: 0 }, ahead: { h: 0, n: 0, u: 0 }, all: { h: 0, n: 0 }, final: { h: 0, n: 0 } }; });
      G.forEach(function(g, i) { lastOf[g.year + '_' + g.week] = i; });
      G.forEach(function(g, i) {
        var wk = g.year + '_' + g.week;
        var u = wkU[wk] || (wkU[wk] = { Maria: 0, Danielle: 0, games: 0 });
        ['Maria', 'Danielle'].forEach(function(n) {
          var r = g.by[n]; if (!r || isNotOffered(r)) return;
          var other = n === 'Maria' ? 'Danielle' : 'Maria', hit = r.correct === 'Yes' ? 1 : 0;
          S[n].all.n++; S[n].all.h += hit;
          if (!u.games) return; // first game of the week: nobody's behind yet
          var side = u[n] < u[other] ? 'behind' : u[n] > u[other] ? 'ahead' : null;
          if (!side) return;
          S[n][side].n++; S[n][side].h += hit; S[n][side].u += r.netUnits;
          if (side === 'behind' && lastOf[wk] === i) { S[n].final.n++; S[n].final.h += hit; }
        });
        ['Maria', 'Danielle'].forEach(function(n) { if (g.by[n]) u[n] += g.by[n].netUnits; });
        u.games++;
      });
      return S;
    }
    function pressureVerdict(s) {
      var b = s.behind, base = s.all.n ? s.all.h / s.all.n : 0;
      return b.n < 4 ? { t: 'Not enough pressure spots yet', c: '#A1A9B6' }
        : b.h / b.n - base >= 0.08 ? { t: '🧊 Ice in her veins', c: '#93C5FD' }
        : b.h / b.n - base <= -0.08 ? { t: '😰 Feels the pressure', c: '#FCA5A5' }
        : { t: '😐 Same either way', c: '#D1D5DB' };
    }
    function pressureSection(rows, season) {
      var S = pressureStats(rows, season);
      function pc(o) { return o.n ? Math.round(o.h / o.n * 100) + '%' : '—'; }
      var any = S.Maria.behind.n + S.Danielle.behind.n;
      if (!any) return '<div class="ch-empty">Not enough weeks yet.</div>';
      return '<div class="lk-cards lk-stack">' + ['Maria', 'Danielle'].map(function(n) {
        var s = S[n], b = s.behind, a = s.ahead, v = pressureVerdict(s);
        return '<div class="lk-card" style="--pc:' + personColor(n) + '"><div class="lk-name">' + n + '</div>' +
          '<div class="bm-l"><span>😬 Behind</span><b>' + pc(b) + '</b> <i>' + b.h + '/' + b.n + '</i></div>' +
          '<div class="bm-l"><span>😎 Ahead</span><b>' + pc(a) + '</b> <i>' + a.h + '/' + a.n + '</i></div>' +
          '<div class="bm-l"><span>📊 Overall</span><b>' + pc(s.all) + '</b> <i>' + s.all.h + '/' + s.all.n + '</i></div>' +
          (s.final.n ? '<div class="bm-l"><span>🏁 Last game</span><b>' + pc(s.final) + '</b> <i>' + s.final.h + '/' + s.final.n + '</i></div>' : '') +
          '<div class="lk-v" style="color:' + v.c + '">' + v.t + '</div></div>';
      }).join('') + '</div><div class="ch-note">Behind / Ahead = fewer or more units than the other that week, going into the game. Last game = the week\'s final game while behind. The first game of each week and not-offered games are left out.</div>';
    }

    // ── 🏟️ Team card: tap any team name (works like the player cards) ────────
    function openTeamCard(team) {
      team = resolveTeam(team);
      if (!TEAM_COLORS[team]) return;
      Promise.all([loadAllBets(), loadNFL().catch(function() {}), (typeof ROSTERS_READY !== 'undefined' ? ROSTERS_READY : Promise.resolve()).catch(function() {})]).then(function(res) {
        var rows = res[0].filter(function(r) { return isMD(r.picker) && (r.homeTeam === team || r.awayTeam === team); });
        var tc = TEAM_COLORS[team], headBg = tc.bg === '#FFFFFF' ? tc.primary : tc.bg, nick = team.split(' ').pop();
        function scorerTeam(r) {
          var s = (r.side || '').toLowerCase();
          if (s === 'home') return r.homeTeam;
          if (s === 'away') return r.awayTeam;
          if (r.firstScorer === r.homePick) return r.homeTeam;
          if (r.firstScorer === r.awayPick) return r.awayTeam;
          var n = typeof nflOf === 'function' ? nflOf(r.firstScorer) : null;
          return n ? n.team : '';
        }
        // One entry per game
        var G = gamesOf(rows), scored = G.filter(function(g) { var r = g.by.Maria || g.by.Danielle; return r.firstScorer; });
        var ownFirst = 0, scorers = {};
        scored.forEach(function(g) {
          var r = g.by.Maria || g.by.Danielle;
          if (scorerTeam(r) === team) { ownFirst++; scorers[r.firstScorer] = (scorers[r.firstScorer] || 0) + 1; }
        });
        // Picks from this team, per person
        var me = {};
        ['Maria', 'Danielle'].forEach(function(n) {
          var picked = 0, paid = 0;
          rows.forEach(function(r) {
            if (r.picker !== n) return;
            var pk = r.homeTeam === team ? r.homePick : r.awayPick;
            if (!pk) return;
            picked++;
            if (r.correct === 'Yes' && !isNotOffered(r) && r.firstScorer === pk) paid++;
          });
          me[n] = { picked: picked, paid: paid, u: teamUnits(res[0], 'all', n)[team] || 0 };
        });
        function person(n) {
          var m = me[n], c = personColor(n);
          return '<div class="pc-person"><span style="color:' + c + ';font-weight:700">' + n + '</span><span class="u-soft">' +
            (m.picked ? 'picked ' + m.picked + 'x · paid ' + m.paid + 'x · <span style="font-weight:700;color:' + (m.u > 0 ? '#34D399' : m.u < 0 ? '#F87171' : '#A1A9B6') + '">' + fmtU(m.u) + '</span>'
              : '<span class="u-faint">never picked from them</span>') + '</span></div>';
        }
        // Offered right now (Rosters tab)
        var ORDER = ['WR1', 'RB1', 'WR2', 'QB', 'TE', 'WR3'];
        var offered = Object.keys(ROSTER_INFO).map(function(k) { return ROSTER_INFO[k]; })
          .filter(function(p) { return p.team && !p.hidden && resolveTeam(p.team) === team; })
          .sort(function(a, b) { var ai = ORDER.indexOf(a.pos), bi = ORDER.indexOf(b.pos); return (ai < 0 ? 99 : ai) - (bi < 0 ? 99 : bi); });
        var offeredHtml = offered.length ? '<div class="tc-offered">' + offered.map(function(p) {
          return '<span class="tc-pl' + (playerKey(p.name) in INJURED ? ' is-out' : '') + '"><i>' + (p.pos || '+') + '</i>' + escHtml(p.name) + '</span>';
        }).join('') + '</div>' : '<div class="pc-small">Nobody offered right now.</div>';
        var top = Object.keys(scorers).sort(function(a, b) { return scorers[b] - scorers[a]; }).slice(0, 4);
        function res1(r) {
          if (!r) return '';
          var c = personColor(r.picker), t = !r.firstScorer ? '⏳' : isNotOffered(r) ? '🚫' : r.correct === 'Yes' ? '✅' : '❌';
          return '<span class="pc-chip" style="color:' + c + ';background:' + hexA(c, 0.15) + '">' + r.picker.charAt(0) + ' ' + t + '</span>';
        }
        var played = G.filter(function(g) { var r = g.by.Maria || g.by.Danielle; return r.firstScorer; });
        var next = G.filter(function(g) { var r = g.by.Maria || g.by.Danielle; return !r.firstScorer; })[0];
        var nextHtml = '';
        if (next) {
          var nr = next.by.Maria || next.by.Danielle, no = nr.homeTeam === team ? nr.awayTeam : nr.homeTeam;
          nextHtml = '<div class="tc-next">⏭️ Next: ' + nr.year + ' ' + weekName(nr.week) + (nr.slot ? ' ' + escHtml(nr.slot) : '') + ' · ' + (nr.homeTeam === team ? 'vs ' : '@ ') +
            '<b style="color:' + ((TEAM_COLORS[no] || {}).dark || '#F3F4F6') + '">' + no.split(' ').pop() + '</b></div>';
        }
        var recent = played.slice().reverse().slice(0, 5).map(function(g) {
          var r = g.by.Maria || g.by.Danielle, opp = r.homeTeam === team ? r.awayTeam : r.homeTeam;
          var oc = TEAM_COLORS[opp];
          var ftd = r.firstScorer ? (scorerTeam(r) === team ? '<b style="color:' + tc.dark + '">' + escHtml(r.firstScorer) + '</b>' : '<span class="u-muted">' + escHtml(r.firstScorer) + '</span>') : '<span class="u-faint">Not played</span>';
          return '<div class="pc-game tc-game"><span class="u-muted">' + r.year + ' ' + wkName(r.week) + '</span>' +
            '<span>' + (r.homeTeam === team ? 'vs ' : '@ ') + '<b style="color:' + (oc ? oc.dark : '#F3F4F6') + '">' + (TEAM_ABBR[opp] || opp).toUpperCase() + '</b> · ' + ftd + '</span>' +
            '<span>' + res1(g.by.Maria) + res1(g.by.Danielle) + '</span></div>';
        }).join('');
        var nfl = Object.keys(NFL).filter(function(k) { return NFL[k].team === team && SKILL_POS[NFL[k].pos] && NFL[k].inj; }).map(function(k) { return NFL[k]; });
        var html = '<div class="pc-backdrop" id="pc-backdrop"><div class="pc-card" role="dialog" aria-label="' + team + '">' +
          '<div class="pc-head" style="background:linear-gradient(150deg,' + hexA(headBg, 0.95) + ' 0%,' + hexA(headBg, 0.35) + ' 70%, rgba(17,19,24,1) 100%)">' +
            '<button class="pc-close" id="pc-close" aria-label="Close">×</button>' +
            '<div class="tc-logo">' + teamLogo(team) + '</div>' +
            '<div class="pc-name">' + team + '</div>' +
            '<div class="pc-sub">' + (G.length ? G.length + ' game' + (G.length === 1 ? '' : 's') + ' bet on' : 'No games bet on yet') + (nfl.length ? ' · 🩹 ' + nfl.length + ' on ESPN\'s injury report' : '') + '</div>' +
          '</div><div class="pc-body">' +
            '<div class="pc-tiles">' +
              '<div class="pc-tile"><div class="pc-label">Scores first</div><div class="pc-big">' + (scored.length ? Math.round(ownFirst / scored.length * 100) + '%' : '—') + '</div><div class="pc-small">' + (scored.length ? 'the ' + nick + ' scored first in ' + ownFirst + ' of ' + scored.length : 'no scored games yet') + '</div></div>' +
              '<div class="pc-tile"><div class="pc-label">Top scorers</div>' + (top.length ? top.map(function(n) { return '<div class="tc-sc">' + escHtml(n) + ' <b>' + scorers[n] + '</b></div>'; }).join('') : '<div class="pc-small">None yet</div>') + '</div>' +
            '</div>' +
            person('Maria') + person('Danielle') +
            '<div class="pc-games"><div class="pc-label">Offered now</div>' + offeredHtml + '</div>' +
            (recent || nextHtml ? '<div class="pc-games"><div class="pc-label">Recent games</div>' + recent + nextHtml + '</div>' : '') +
          '</div></div></div>';
        closePlayerCard();
        document.body.insertAdjacentHTML('beforeend', html);
        var bd = document.getElementById('pc-backdrop');
        bd.addEventListener('click', function(e) { if (e.target === bd) closePlayerCard(); });
        document.getElementById('pc-close').addEventListener('click', closePlayerCard);
      });
    }

    // ── 🧭 Scouting report (Maria / Danielle profiles) ────────────────────────
    function scoutingReportHtml(who, rows) {
      var season = CURRENT_YEAR;
      var lk = luckData(rows, season).out[who];
      if (lk.n < 4) { season = 'all'; lk = luckData(rows, 'all').out[who]; }
      var tag = season === 'all' ? 'all seasons' : season;
      var items = [];
      // Luck
      var lv = luckVerdict(lk);
      if (lk.n) items.push(['🍀', 'Luck', '<b style="color:' + lv.c + '">' + luckTxt(lk.hits - lk.exp) + '</b>', lk.hits + ' hits vs ' + lk.exp.toFixed(1) + ' expected · ' + lv.t + ' (' + tag + ')']);
      // Boldness
      var odds = [];
      rows.forEach(function(r) {
        if (r.picker !== who || (season !== 'all' && r.year !== season)) return;
        [[r.homePick, r.homeOdds], [r.awayPick, r.awayOdds]].forEach(function(s) { if (s[0] && oddsN(s[1])) odds.push(oddsN(s[1])); });
      });
      if (odds.length) {
        var avg = odds.reduce(function(a, b) { return a + b; }, 0) / odds.length;
        var other = who === 'Maria' ? 'Danielle' : 'Maria', oOdds = [];
        rows.forEach(function(r) { if (r.picker === other && (season === 'all' || r.year === season)) [[r.homePick, r.homeOdds], [r.awayPick, r.awayOdds]].forEach(function(s) { if (s[0] && oddsN(s[1])) oOdds.push(oddsN(s[1])); }); });
        var oAvg = oOdds.length ? oOdds.reduce(function(a, b) { return a + b; }, 0) / oOdds.length : 0;
        items.push(['🎲', 'Boldness', '<b>' + oddsTxt(avg) + '</b>', 'average odds per pick · ' + (oAvg ? (avg > oAvg * 1.05 ? 'bolder than ' + other : avg < oAvg * 0.95 ? 'safer than ' + other : 'about the same as ' + other) : '') + ' (' + tag + ')']);
      }
      // Pressure (all seasons, it needs the samples)
      var ps = pressureStats(rows, 'all')[who], pv = pressureVerdict(ps);
      items.push(['😰', 'Under pressure', '<b style="color:' + pv.c + '">' + (ps.behind.n ? Math.round(ps.behind.h / ps.behind.n * 100) + '%' : '—') + '</b>',
        'hit rate when behind for the week (' + ps.behind.h + '/' + ps.behind.n + ') · ' + pv.t]);
      // Teams
      var TU = teamUnits(rows, 'all', who), cnt = {};
      rows.forEach(function(r) { if (r.picker !== who) return; if (r.homePick) cnt[r.homeTeam] = (cnt[r.homeTeam] || 0) + 1; if (r.awayPick) cnt[r.awayTeam] = (cnt[r.awayTeam] || 0) + 1; });
      var ranked = Object.keys(TU).filter(function(t) { return (cnt[t] || 0) >= 3; }).sort(function(a, b) { return TU[b] - TU[a]; });
      if (ranked.length >= 2) {
        var best = ranked[0], worst = ranked[ranked.length - 1];
        if (TU[best] > 0) items.push(['💸', 'Best team', coloredText('<b>' + best.split(' ').pop() + '</b>', best), fmtU(TU[best]) + ' picking from them (all seasons)']);
        if (TU[worst] < 0) items.push(['🔥', 'Burning team', coloredText('<b>' + worst.split(' ').pop() + '</b>', worst), fmtU(TU[worst]) + ' picking from them (all seasons)']);
      }
      // Records she holds
      var R = computeRecords(rows), held = RECORDS.filter(function(d) { return R[d.k] && R[d.k].who === who; });
      if (held.length) items.push(['📖', 'Records', '<b>' + held.length + '</b>', held.map(function(d) { return d.ic + ' ' + d.t + ' (' + R[d.k].txt + ')'; }).join(' · ')]);
      if (!items.length) return '';
      return '<div class="pf-h">🧭 Scouting Report <small>how she bets</small></div><div class="sr-list">' + items.map(function(it) {
        return '<div class="sr-row"><span class="sr-ic">' + it[0] + '</span><div class="sr-mid"><div class="sr-l">' + it[1] + '</div><div class="sr-n">' + it[3] + '</div></div><div class="sr-v">' + it[2] + '</div></div>';
      }).join('') + '</div>';
    }

    // ── 🎁 Extra Season Wrapped tiles: luck, boldness, team of the year, chaos week, records set ──
    function wrappedExtraTiles(year, all) {
      var rows = all.filter(function(r) { return r.year === year; });
      function nm(n) { return '<span style="color:' + personColor(n) + '">' + n + '</span>'; }
      function tile(label, main, sub) { return '<div class="wr-tile"><div class="wr-tile-label">' + label + '</div><div class="wr-tile-main">' + main + '</div>' + (sub ? '<div class="wr-tile-sub">' + sub + '</div>' : '') + '</div>'; }
      var out = [];
      // Luckiest: most hits above what the odds expected
      var L = luckData(rows, year).out, lm = L.Maria.hits - L.Maria.exp, ld = L.Danielle.hits - L.Danielle.exp;
      if (L.Maria.n + L.Danielle.n >= 6) {
        var lucky = lm >= ld ? 'Maria' : 'Danielle', lv = Math.max(lm, ld);
        out.push(tile('🍀 Luckiest', nm(lucky) + ' ' + luckTxt(lv), 'hits above what the odds expected'));
      }
      // Boldest picker: longest average odds
      var avg = {};
      ['Maria', 'Danielle'].forEach(function(n) {
        var o = [];
        rows.forEach(function(r) { if (r.picker === n) [[r.homePick, r.homeOdds], [r.awayPick, r.awayOdds]].forEach(function(s) { if (s[0] && oddsN(s[1])) o.push(oddsN(s[1])); }); });
        avg[n] = o.length ? o.reduce(function(a, b) { return a + b; }, 0) / o.length : 0;
      });
      if (avg.Maria && avg.Danielle) { var bold = avg.Maria >= avg.Danielle ? 'Maria' : 'Danielle'; out.push(tile('🎲 Boldest Picker', nm(bold) + ' ' + oddsTxt(avg[bold]), 'average odds per pick')); }
      // Team of the year: most units won picking from one team
      var TU = teamUnits(all, year, 'all'), best = Object.keys(TU).sort(function(a, b) { return TU[b] - TU[a]; })[0];
      if (best && TU[best] > 0) out.push(tile('💸 Team of the Year', coloredText(best.split(' ').pop(), best) + ' ' + fmtU(TU[best]), 'units won picking from them'));
      // Chaos week
      var C = chaosGames(all, year), wk = {};
      C.forEach(function(c) { var k = c.g.week; wk[k] = wk[k] || { n: 0, x: 0 }; wk[k].n++; if (c.tags.length) wk[k].x++; });
      var cw = Object.keys(wk).filter(function(k) { return wk[k].x; }).sort(function(a, b) { return wk[b].x / wk[b].n - wk[a].x / wk[a].n || wk[b].x - wk[a].x; })[0];
      if (cw) out.push(tile('🌀 Chaos Week', weekName(cw), wk[cw].x + ' of ' + wk[cw].n + ' first TDs from off the board'));
      // All-time records set this season, as they stood when the season ended
      // (later seasons don't count, so a season's Wrapped never changes after the fact)
      var R = computeRecords(all.filter(function(r) { return parseInt(r.year, 10) <= parseInt(year, 10); })), set = RECORDS.filter(function(d) { return R[d.k] && R[d.k].year === year; });
      if (set.length) out.push('<div class="wr-tile"><div class="wr-tile-label">📖 Records Set</div>' + set.slice(0, 3).map(function(d) {
        return '<div class="wr-fav">' + d.ic + ' ' + nm(R[d.k].who) + ' · ' + d.t + ' <span class="u-faint">' + R[d.k].txt + '</span></div>';
      }).join('') + '</div>');
      return out.join('');
    }
    function fillWrappedExtras() {
      var slots = document.querySelectorAll('.wr-more[data-wr-year]');
      if (!slots.length) return;
      loadAllBets().then(function(all) {
        slots.forEach(function(el) { el.outerHTML = wrappedExtraTiles(el.getAttribute('data-wr-year'), all); });
      }).catch(function() { slots.forEach(function(el) { el.remove(); }); });
    }

    // ── 🎯 Pick preview on Live Picks (only once both picks are revealed, so they're locked) ──
    // Each card gets its chance from the odds and each player's track record when picked.
    function addPickPreview(root) {
      var games = root.querySelectorAll('.live-game[data-reveal]');
      if (!games.length) return;
      loadPlayerDB().then(function(db) {
        games.forEach(function(gEl) {
          if (gEl.querySelector('.lp-prev')) return;
          var chance = {};
          gEl.querySelectorAll('.live-pick-card').forEach(function(card) {
            var who = card.classList.contains('maria') ? 'Maria' : 'Danielle';
            var odds = ((card.querySelector('.pick-odds') || {}).textContent || '').split('/').map(function(s) { return oddsN(s.trim()); });
            var names = Array.prototype.map.call(card.querySelectorAll('.lp-pick'), function(el) { return el.getAttribute('data-player'); });
            var p = 0, known = names.length > 0;
            var recs = names.map(function(n, i) {
              if (!odds[i]) known = false; else p += impliedP(odds[i]);
              var k = playerKey(n), pl = db[k];
              var picked = pl ? pl.gameOrder.map(function(g) { return pl.games[g]; }).filter(function(g) { return g.by.length && g.scorer; }) : [];
              var hits = picked.filter(function(g) { return playerKey(g.scorer) === k; }).length;
              return '<span>' + escHtml(n.split(' ').slice(-1)[0]) + ' ' + (picked.length ? hits + '/' + picked.length : 'new') + '</span>';
            });
            chance[who] = known ? p : null;
            card.insertAdjacentHTML('beforeend', '<div class="lp-prev"><div class="lp-ch">' + (known ? '🎯 <b>' + Math.round(p * 100) + '%</b> chance' : '🎯 odds coming') + '</div><div class="lp-rec">' + recs.join(' · ') + '</div></div>');
          });
          if (chance.Maria != null && chance.Danielle != null && Math.round(chance.Maria * 100) !== Math.round(chance.Danielle * 100)) {
            var better = chance.Maria > chance.Danielle ? 'maria' : 'danielle';
            var c = gEl.querySelector('.live-pick-card.' + better + ' .lp-ch');
            if (c) c.insertAdjacentHTML('beforeend', ' <span class="lp-best">⭐ better shot</span>');
          }
        });
      }).catch(function() {});
    }

    // ── Shared with Stats and Profiles (moved here from analytics.js, which now loads only when Analytics opens) ──
    // Jinxes + loyalty from analytics-style rows (used by Analytics and Profiles)
    function computeJinxes(rows) {
      // Build games in chronological order (2025 before 2026, sheet order within a year)
      var chrono = rows.slice().sort(function(a, b) {
        return a.year !== b.year ? parseInt(a.year) - parseInt(b.year) : a.idx - b.idx;
      });
      var jGames = [], jIdx = {};
      chrono.forEach(function(r) {
        if (r.picker !== 'Maria' && r.picker !== 'Danielle') return;
        var k = r.year + '_' + r.week + '_' + r.game + '_' + r.homeTeam + '_' + r.awayTeam;
        if (!(k in jIdx)) {
          jIdx[k] = jGames.length;
          jGames.push({ year: r.year, week: r.week, home: resolveTeam(r.homeTeam), away: resolveTeam(r.awayTeam),
            homeRaw: r.homeTeam, awayRaw: r.awayTeam, scorer: '', rows: {} });
        }
        var g = jGames[jIdx[k]];
        g.rows[r.picker] = r;
        if (r.firstScorer) g.scorer = r.firstScorer;
      });

      var tracking = { Maria: {}, Danielle: {} }; // player -> where they were last picked
      var jinxes = { Maria: [], Danielle: [] };
      var loyalty = { Maria: { kept: 0, dropped: 0 }, Danielle: { kept: 0, dropped: 0 } };

      jGames.forEach(function(g) {
        if (!g.scorer) return; // unscored games don't count yet
        // 1) Check players each person was tracking whose team is in this game
        ['Maria', 'Danielle'].forEach(function(p) {
          var mine = g.rows[p];
          if (!mine || (!mine.homePick && !mine.awayPick)) return;
          var picks = [mine.homePick, mine.awayPick];
          Object.keys(tracking[p]).forEach(function(player) {
            var t = tracking[p][player];
            if (t.team !== g.home && t.team !== g.away) return;
            delete tracking[p][player]; // only the next appearance counts
            if (picks.indexOf(player) !== -1) { loyalty[p].kept++; return; }
            loyalty[p].dropped++;
            if (g.scorer === player) {
              var other = p === 'Maria' ? 'Danielle' : 'Maria';
              var o = g.rows[other], cashed = null;
              if (o && o.correct === 'Yes' && (o.homePick === player || o.awayPick === player)) {
                cashed = { units: o.netUnits, odds: o.homePick === player ? o.homeOdds : o.awayOdds };
              }
              jinxes[p].push({ picker: p, other: other, player: player, team: t.rawTeam,
                fromYear: t.year, fromWeek: t.week, year: g.year, week: g.week, cashed: cashed });
            }
          });
        });
        // 2) Start tracking this game's picks
        ['Maria', 'Danielle'].forEach(function(p) {
          var mine = g.rows[p];
          if (!mine) return;
          if (mine.homePick) tracking[p][mine.homePick] = { team: g.home, rawTeam: g.homeRaw, year: g.year, week: g.week };
          if (mine.awayPick) tracking[p][mine.awayPick] = { team: g.away, rawTeam: g.awayRaw, year: g.year, week: g.week };
        });
      });
      return { jinxes: jinxes, loyalty: loyalty };
    }

    // Bad beats from analytics-style rows: checks ESPN once per finished game, then caches it
    var BAD_BEATS_CACHE = null;
    async function computeBadBeats(rows, onProgress) {
      if (BAD_BEATS_CACHE) return BAD_BEATS_CACHE;
    var games = {}, order = [];
    rows.forEach(function(r) {
      if (!r.firstScorer || (r.picker !== 'Maria' && r.picker !== 'Danielle')) return;
      var k = r.year + '_' + r.week + '_' + r.homeTeam + '_' + r.awayTeam;
      if (!games[k]) { games[k] = { key: k, year: r.year, week: r.week, home: r.homeTeam, away: r.awayTeam, first: r.firstScorer, picks: { Maria: [], Danielle: [] } }; order.push(k); }
      [[r.homePick, r.homeTeam], [r.awayPick, r.awayTeam]].forEach(function(x) { if (x[0]) games[k].picks[r.picker].push({ name: x[0], team: x[1] }); });
    });

    var cache = {};
    try { cache = JSON.parse(localStorage.getItem('mvd-tds-v1') || '{}'); } catch (e) {}
    var boards = {}, failed = 0, done = 0;
    function board(year, week) {
      var k = year + '_' + week;
      if (!boards[k]) {
        var path = week > 18
          ? 'scoreboard?dates=' + year + '&seasontype=3&week=' + (week - 18)
          : 'scoreboard?dates=' + year + '&seasontype=2&week=' + week;
        boards[k] = espnGet(path).then(function(d) { return d.events || []; }).catch(function() { return []; });
      }
      return boards[k];
    }
    function clockSecs(c) { var m = (c || '').match(/(\d+):(\d+)/); return m ? +m[1] * 60 + +m[2] : 0; }

    async function tdsFor(g) {
      if (cache[g.key]) return cache[g.key];
      var events = await board(g.year, g.week);
      var hk = espnTeamKey(g.home), ak = espnTeamKey(g.away), ev = null;
      events.forEach(function(e) {
        var c = e.competitions && e.competitions[0];
        if (!c) return;
        var keys = c.competitors.map(function(x) { return espnTeamKey(x.team.displayName); });
        if (keys.indexOf(hk) >= 0 && keys.indexOf(ak) >= 0) ev = e;
      });
      if (!ev) { failed++; return null; }
      var sum = await espnGet('summary?event=' + ev.id);
      var tds = (sum.scoringPlays || []).filter(tdPlay).map(function(p) {
        var per = (p.period && p.period.number) || 1;
        return { n: tdScorerName(p.text), p: per, c: (p.clock && p.clock.displayValue) || '', t: (per - 1) * 900 + (900 - clockSecs(p.clock && p.clock.displayValue)) };
      });
      if (ev.status && ev.status.type && ev.status.type.state === 'post') cache[g.key] = tds;
      return tds;
    }

    // A few at a time so it's gentle on ESPN
    var queue = order.slice(), results = {};
    async function worker() {
      while (queue.length) {
        var k = queue.shift();
        try { results[k] = await tdsFor(games[k]); } catch (e) { failed++; }
        done++;
        if (onProgress && done % 5 === 0) onProgress(done, order.length);
      }
    }
    await Promise.all([worker(), worker(), worker(), worker()]);
    try { localStorage.setItem('mvd-tds-v1', JSON.stringify(cache)); } catch (e) {}

    var beats = [];
    order.forEach(function(k) {
      var g = games[k], tds = results[k];
      if (!tds || !tds.length) return;
      var firstT = tds[0].t;
      ['Maria', 'Danielle'].forEach(function(who) {
        g.picks[who].forEach(function(pk) {
          if (normName(pk.name) === normName(g.first)) return; // that's a hit, not a bad beat
          var td = tds.filter(function(t, i) { return i > 0 && sameScorer(t.n, pk.name); })[0];
          if (!td) return;
          beats.push({ who: who, player: pk.name, team: pk.team, year: g.year, week: g.week, first: g.first,
            q: td.p > 4 ? 'OT' : 'Q' + td.p, clock: td.c, gap: Math.max(0, Math.round((td.t - firstT) / 60)) });
        });
      });
    });
      var anyData = Object.keys(results).some(function(k) { return results[k]; });
      BAD_BEATS_CACHE = { beats: beats, failed: failed, order: order, results: results, anyData: anyData };
      return BAD_BEATS_CACHE;
    }
