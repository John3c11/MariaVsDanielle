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
        if (season !== 'all' && (i === 0 || g.week !== G[i - 1].week)) xl.push({ i: i + 1, label: 'Wk ' + g.week });
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
        tips.push((season === 'all' ? g.year + ' ' : '') + 'Wk ' + g.week + ' ' + teamNick(g.home) + ' vs ' + teamNick(g.away) + ' · Maria ' + chU(m[i + 1]) + ' · Danielle ' + chU(d[i + 1]));
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
        tips.push((season === 'all' ? g.year + ' ' : '') + 'Wk ' + g.week + ' · Maria ' + luckTxt(out.Maria.hits - out.Maria.exp) + ' · Danielle ' + luckTxt(out.Danielle.hits - out.Danielle.exp));
      });
      return { out: out, G: G, series: series, tips: tips };
    }
    function luckTxt(v) { return (v >= 0 ? '+' : '') + v.toFixed(1); }
    function luckVerdict(o) {
      var diff = o.hits - o.exp;
      if (o.n < 4) return { t: 'Not enough bets yet', c: '#9CA3AF' };
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
        var k = (season === 'all' ? c.g.year + ' ' : '') + 'Wk ' + c.g.week;
        if (!wk[k]) { wk[k] = { n: 0, chaos: 0 }; order.push(k); }
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
        return '<div class="cc-bar" data-tip="' + chTip(k + ': ' + w.chaos + ' of ' + w.n + ' first TDs from off the board') + '"><i style="height:' + Math.max(3, pctv) + '%"></i><span>' + k.replace(/^\d{4} /, '').replace('Wk ', '') + '</span></div>';
      }).join('') + '</div><div class="ch-note">Chaos index: how many of each week\'s first touchdowns came from defense, linemen, kickers or players who weren\'t offered.</div>';
      var weird = C.filter(function(c) { return c.tags.length; }).reverse();
      if (weird.length) {
        h += '<div class="cc-list">' + weird.slice(0, 10).map(function(c) {
          return '<div class="cc-row"><div><b>' + escHtml(c.name) + '</b>' + (c.pos ? ' <span class="cc-pos">' + escHtml(c.pos) + '</span>' : '') +
            '<div class="cc-meta">' + (season === 'all' ? c.g.year + ' ' : '') + 'Wk ' + c.g.week + ' · ' + teamNick(c.g.home) + ' vs ' + teamNick(c.g.away) + '</div></div>' +
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
        beat('hit', r.netUnits, r.picker, { year: r.year, week: r.week, txt: fmtU(r.netUnits), sub: r.firstScorer + ' · ' + r.year + ' Wk ' + r.week });
      });
      // Streaks (not-offered games skipped), across seasons
      ['Maria', 'Danielle'].forEach(function(n) {
        var cur = { Yes: 0, No: 0 }, start = {};
        bets.forEach(function(r) {
          if (r.picker !== n || isNotOffered(r)) return;
          var other = r.correct === 'Yes' ? 'No' : 'Yes';
          if (!cur[r.correct]) start[r.correct] = r;
          cur[r.correct]++; cur[other] = 0;
          var s = start[r.correct], span = s.year + ' Wk ' + s.week + (s.year + s.week === r.year + r.week ? '' : ' – ' + (s.year === r.year ? '' : r.year + ' ') + 'Wk ' + r.week);
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
        var w = W[k], sub = w.year + ' Week ' + w.week;
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
