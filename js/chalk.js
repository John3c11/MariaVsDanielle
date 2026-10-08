// 🔮 The Chalk Team: what if Maria and Danielle, together, had always taken the favorite?
// For every game they played, the Chalk Team takes the shorter-priced of their two home picks and the
// shorter-priced of their two away picks (the only odds the sheet has), bets them the same way they do
// (both of them betting it, a hit pays the odds, a miss costs one unit per pick, "not offered" doesn't count), and races
// Maria + Danielle combined. Lives on All-Time. Loaded on demand (loadScriptOnce).
// Part of the MariaVsDanielle site. Shares the global scope with the other js/ files.

    var CHALK = { season: 'all' };

    function chalkGames(rows) {
      var G = {}, order = [];
      rows.forEach(function(r) {
        if (r.picker !== 'Maria' && r.picker !== 'Danielle') return;
        if (r.correct !== 'Yes' && r.correct !== 'No') return; // finished games only
        var k = r.year + '_' + r.game;
        if (!G[k]) { G[k] = { year: r.year, week: parseInt(r.week, 10), game: r.game, home: r.homeTeam, away: r.awayTeam, scorer: r.firstScorer, rows: [], notOffered: false, amount: 0 }; order.push(k); }
        G[k].rows.push(r);
        if (isNotOffered(r)) G[k].notOffered = true;
        G[k].amount = G[k].amount || parseFloat(r.amount) || 0;
      });
      return order.map(function(k) {
        var g = G[k];
        function fav(side) { // shortest odds among their picks on that side
          var c = g.rows.map(function(r) { return { name: side === 'home' ? r.homePick : r.awayPick, odds: oddsN(side === 'home' ? r.homeOdds : r.awayOdds), who: r.picker }; })
            .filter(function(x) { return x.name && x.odds > 0; });
          c.sort(function(a, b) { return a.odds - b.odds || (a.who === 'Maria' ? -1 : 1); });
          return c[0] || null;
        }
        g.chalk = [fav('home'), fav('away')].filter(Boolean);
        var hitPick = g.chalk.filter(function(x) { return playerKey(x.name) === playerKey(g.scorer); })[0];
        // Both of them bet the chalk picks (one bet each, like they really do), so stakes match their real ones
        var each = !g.chalk.length ? 0 : hitPick ? hitPick.odds : -g.chalk.length;
        var live = g.rows.filter(function(r) { return !isNotOffered(r); }).length; // "not offered" bets count 0, same as the sheet
        g.bets = live;
        g.chalkUnits = each * live;
        g.chalkHit = !!hitPick && live > 0;
        g.realUnits = g.rows.reduce(function(a, r) { return a + r.netUnits; }, 0);
        g.realHits = g.rows.filter(function(r) { return r.correct === 'Yes' && !isNotOffered(r); }).length;
        g.realPicks = g.rows.filter(function(r) { return !isNotOffered(r); }).length;
        return g;
      }).sort(function(a, b) { return a.year - b.year || a.week - b.week || a.game - b.game; });
    }

    function renderChalkCard(el) {
      if (!el) return;
      loadAllBets().then(function(rows) { drawChalk(el, chalkGames(rows)); }).catch(function() { el.innerHTML = ''; });
    }
    function drawChalk(el, all) {
      var years = []; all.forEach(function(g) { if (years.indexOf(g.year) < 0) years.push(g.year); });
      years.sort().reverse();
      if (CHALK.season !== 'all' && years.indexOf(CHALK.season) < 0) CHALK.season = 'all';
      var G = all.filter(function(g) { return CHALK.season === 'all' || g.year === CHALK.season; });
      if (!G.length) { el.innerHTML = ''; return; }
      var cu = 0, ru = 0, cd = 0, rd = 0, ch = 0, rh = 0, cn = 0, rn = 0;
      G.forEach(function(g) {
        cu += g.chalkUnits; ru += g.realUnits; cd += g.chalkUnits * g.amount; rd += g.rows.reduce(function(a, r) { return a + (r.netDollars || 0); }, 0);
        ch += g.chalkHit ? g.bets : 0; cn += g.bets;
        rh += g.realHits; rn += g.realPicks;
      });
      var diff = ru - cu, lead = diff >= 0;
      // Week by week, running totals
      var W = [], wi = {};
      G.forEach(function(g) { var k = g.year + '_' + g.week; if (!(k in wi)) { wi[k] = W.length; W.push({ year: g.year, week: g.week, c: 0, r: 0 }); } W[wi[k]].c += g.chalkUnits; W[wi[k]].r += g.realUnits; });
      var cs = [0], rs = [0], tips = [''], dv = [];
      W.forEach(function(w, i) {
        cs.push(cs[i] + w.c); rs.push(rs[i] + w.r);
        if (i > 0 && w.year !== W[i - 1].year) dv.push({ i: i + 1, label: w.year });
        tips.push(w.year + ' ' + wkName(w.week) + ' · Maria + Danielle ' + chU(rs[i + 1]) + ' · Chalk ' + chU(cs[i + 1]));
      });
      var CHALK_C = '#A3A3A3', DUO_C = '#C084FC';
      var chart = W.length >= 2 && typeof chLineChart === 'function' ? chLineChart({ n: W.length + 1,
        series: [{ name: 'Maria + Danielle', color: DUO_C, vals: rs }, { name: 'Chalk', color: CHALK_C, vals: cs }],
        xLabels: [], dividers: (CHALK.season === 'all' ? [{ i: 0, label: W[0].year }] : []).concat(CHALK.season === 'all' ? dv : []), tips: tips,
        fmt: function(v, axis) { return axis ? (v > 0 ? '+' : '') + v : chU(v); }, height: 220 }) : '';
      // Biggest swings both ways
      var swings = G.filter(function(g) { return g.realUnits !== g.chalkUnits; }).map(function(g) { return { g: g, d: g.realUnits - g.chalkUnits }; });
      swings.sort(function(a, b) { return b.d - a.d; });
      var best = swings.filter(function(s) { return s.d > 0; }).slice(0, 2), worst = swings.filter(function(s) { return s.d < 0; }).slice(-2).reverse();
      function nick(t) { return escHtml(resolveTeam(t).split(' ').pop()); }
      function swingHtml(s) {
        var g = s.g, when = g.year + ' ' + wkName(g.week) + ' · ' + nick(g.away) + ' @ ' + nick(g.home);
        var real = g.rows.filter(function(r) { return r.correct === 'Yes' && !isNotOffered(r); })[0];
        var txt;
        if (s.d > 0) {
          var o = real ? oddsN(playerKey(real.firstScorer) === playerKey(real.homePick) ? real.homeOdds : real.awayOdds) : 0;
          txt = '<b style="color:' + personColor(real.picker) + '">' + real.picker + '</b>\'s ' + escHtml(real.firstScorer) + (o ? ' at ' + fmtOdds(o) : '') + ' beat the chalk' + (g.chalkHit ? '' : ' (chalk missed)') + '.';
        } else {
          var c = g.chalk.filter(function(x) { return playerKey(x.name) === playerKey(g.scorer); })[0];
          txt = c ? 'Chalk would\'ve had ' + escHtml(c.name) + ' (' + fmtOdds(c.odds) + '), ' + (g.realHits ? 'and paid more' : 'you both missed') + '.' : 'Chalk lost less.';
        }
        return '<div class="ck-sw ' + (s.d > 0 ? 'up' : 'down') + '"><div class="ck-sw-d">' + (s.d > 0 ? '+' : '') + s.d.toFixed(1) + 'u</div><div><div class="ck-sw-w">' + when + '</div><div>' + txt + '</div></div></div>';
      }
      var h = '<div class="pf-h">🔮 The Chalk Team <small>what if they\'d always taken the favorite?</small></div>' +
        '<div class="u-mb-10px af-bar"><span class="af-bar-label">Season</span>' + ['all'].concat(years).map(function(y) {
          return '<button class="filter-btn' + (CHALK.season === y ? ' active' : '') + '" data-ck="' + y + '">' + (y === 'all' ? 'All' : y) + '</button>';
        }).join('') + '</div>' +
        '<div class="ck-card">' +
          '<div class="ck-verdict ' + (lead ? 'up' : 'down') + '">' + (Math.abs(diff) < 0.05 ? 'Dead even with the chalk.' : lead
            ? 'Going with their gut is <b>' + fmtU(diff) + '</b> better than playing it safe.'
            : 'Playing it safe would\'ve been <b>' + fmtU(-diff) + '</b> better.') + '</div>' +
          '<div class="ck-vs">' +
            '<div class="ck-side"><div class="ck-k" style="color:' + DUO_C + '">Maria + Danielle</div><div class="ck-u" style="color:' + (ru >= 0 ? '#34D399' : '#F87171') + '">' + fmtU(ru) + '</div><div class="ck-s">' + fmtDWhole(rd) +  ' · ' + rh + ' of ' + rn + ' bets hit (' + (rn ? Math.round(rh / rn * 100) : 0) + '%)</div></div>' +
            '<div class="ck-mid">vs</div>' +
            '<div class="ck-side"><div class="ck-k" style="color:' + CHALK_C + '">The Chalk Team</div><div class="ck-u" style="color:' + (cu >= 0 ? '#34D399' : '#F87171') + '">' + fmtU(cu) + '</div><div class="ck-s">' + fmtDWhole(cd) + ' · ' + ch + ' of ' + cn + ' bets hit (' + (cn ? Math.round(ch / cn * 100) : 0) + '%)</div></div>' +
          '</div>' + chart +
          (best.length || worst.length ? '<div class="ck-swings">' + best.map(swingHtml).join('') + worst.map(swingHtml).join('') + '</div>' : '') +
          '<div class="ck-note">For every game, the Chalk Team is both of them taking the shorter-priced of their two picks on each side (the sheet only has odds for players they picked). Same bets, same stakes: a hit pays the odds, a miss costs a unit per pick, and "not offered" doesn\'t count.</div>' +
        '</div>';
      el.innerHTML = h;
      el.querySelectorAll('[data-ck]').forEach(function(b) { b.addEventListener('click', function() { CHALK.season = b.getAttribute('data-ck'); drawChalk(el, all); }); });
    }
