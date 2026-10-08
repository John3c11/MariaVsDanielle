// Crowd: friend picks data, the Crowd tab leaderboard, and the "friends picked" line on Live Picks.
// Part of the MariaVsDanielle site. All js/ files share one global scope and load in the order listed in index.html.

    // ── Crowd data (shared by the Crowd tab, Live Picks and friend profiles) ──
    var CROWD = { data: null, at: 0 };
    function getCrowd() {
      if (!PICKS_URL) return Promise.resolve({ friends: [], picks: [], counts: {} });
      if (CROWD.data && Date.now() - CROWD.at < 60000) return Promise.resolve(CROWD.data);
      return picksApi({ action: 'crowd' }).then(function(d) { CROWD.data = d; CROWD.at = Date.now(); return d; });
    }

    // One entry per game from this season's public sheet
    function crowdGames(values) {
      var G = {};
      readBets(values).forEach(function(b) {
        var picker = b.picker;
        if (!b.game || !b.home) return;
        var k = b.week + '_' + b.game;
        var g = G[k] || (G[k] = { key: k, week: b.weekN, game: parseInt(b.game) || 0, slot: b.slot, home: resolveTeam(b.home), away: resolveTeam(b.away),
          scorer: '', notOffered: false, md: {}, mdCorrect: {}, odds: {} });
        if (b.scorer) g.scorer = b.scorer;
        if (b.notOffered) g.notOffered = true;
        if (picker === 'Maria' || picker === 'Danielle') {
          g.md[picker] = [b.homePick, b.awayPick];
          g.mdCorrect[picker] = b.correct;
          var ho = oddsN(b.homeOdds), ao = oddsN(b.awayOdds); // real prices from their picks (best-hit odds for friends)
          if (ho > 0) g.odds[playerKey(b.homePick)] = ho;
          if (ao > 0) g.odds[playerKey(b.awayPick)] = ao;
        }
      });
      return G;
    }

    // Stats for one friend. rows: [{week, game, homePick, awayPick}], others: every revealed friend pick (for Lone Wolf)
    function friendStats(name, rows, G, others) {
      var list = rows.map(function(r) { return { r: r, g: G[r.week + '_' + r.game] }; })
        .filter(function(x) { return x.g; })
        .sort(function(a, b) { return a.g.week - b.g.week || a.g.game - b.g.game; });
      var S = { name: name, history: [], h2h: { Maria: { me: 0, them: 0, both: 0, neither: 0, n: 0, theirW: 0 }, Danielle: { me: 0, them: 0, both: 0, neither: 0, n: 0, theirW: 0 } }, picks: list.length, w: 0, n: 0, heater: { n: 0 }, drought: { n: 0 }, cur: { type: '', n: 0 }, lone: [], hits: [], weeks: {}, players: {}, playerHits: {}, upcoming: [] };
      var cw = 0, cl = 0;
      list.forEach(function(x) {
        var r = x.r, g = x.g;
        [r.homePick, r.awayPick].filter(Boolean).forEach(function(p) { S.players[p] = (S.players[p] || 0) + 1; });
        if (!g.scorer) {
          if (r.revealed === false) S.upcoming.push(x); else S.history.push({ r: r, g: g, status: 'live' });
          return;
        }
        if (g.notOffered) { S.history.push({ r: r, g: g, status: 'void' }); return; }
        var hit = playerKey(g.scorer) === playerKey(r.homePick) || playerKey(g.scorer) === playerKey(r.awayPick);
        S.history.push({ r: r, g: g, status: hit ? 'hit' : 'miss' });
        ['Maria', 'Danielle'].forEach(function(who) {
          var c = g.mdCorrect[who]; if (c !== 'Yes' && c !== 'No') return;
          var H = S.h2h[who], them = c === 'Yes';
          H.n++; if (them) H.theirW++;
          if (hit && !them) H.me++; else if (them && !hit) H.them++; else if (hit) H.both++; else H.neither++;
        });
        S.n++;
        var W = S.weeks[g.week] || (S.weeks[g.week] = { w: 0, n: 0 });
        W.n++;
        if (hit) {
          S.w++; W.w++; cw++; cl = 0;
          S.playerHits[g.scorer] = true;
          S.hits.push(x);
          if (cw > S.heater.n) S.heater = { n: cw, at: g.week };
          var k = playerKey(g.scorer);
          var mdHad = ['Maria', 'Danielle'].some(function(n) { return (g.md[n] || []).some(function(p) { return playerKey(p) === k; }); });
          var friendHad = others.some(function(o) { return o.friend !== name && (o.week + '_' + o.game) === g.key && (playerKey(o.homePick) === k || playerKey(o.awayPick) === k); });
          if (!mdHad && !friendHad) S.lone.push(x);
        } else { cl++; cw = 0; if (cl > S.drought.n) S.drought = { n: cl, at: g.week }; }
      });
      S.cur = cw ? { type: 'W', n: cw } : cl ? { type: 'L', n: cl } : { type: '', n: 0 };
      S.pct = S.n ? S.w / S.n : 0;
      return S;
    }

    function mdStats(who, G) {
      var keys = Object.keys(G).map(function(k) { return G[k]; }).sort(function(a, b) { return a.week - b.week || a.game - b.game; });
      var S = { name: who, w: 0, n: 0 }, cw = 0, cl = 0;
      keys.forEach(function(g) {
        var c = g.mdCorrect[who];
        if (!g.scorer || g.notOffered || (c !== 'Yes' && c !== 'No')) return;
        S.n++;
        if (c === 'Yes') { S.w++; cw++; cl = 0; } else { cl++; cw = 0; }
      });
      S.cur = cw ? { type: 'W', n: cw } : cl ? { type: 'L', n: cl } : { type: '', n: 0 };
      S.pct = S.n ? S.w / S.n : 0;
      return S;
    }

    var CROWD_MIN = 5; // games picked to be ranked
    function pctTxt(p) { return Math.round(p * 100) + '%'; }
    function streakTxt(c) { return c.n ? (c.type === 'W' ? '🔥 W' : '🧊 L') + c.n : '—'; }

    function rankFriends(crowd, G) {
      var byFriend = {};
      crowd.friends.forEach(function(n) { byFriend[n] = []; });
      crowd.picks.forEach(function(p) { if (byFriend[p.friend]) byFriend[p.friend].push(p); });
      var stats = crowd.friends.map(function(n) { return friendStats(n, byFriend[n], G, crowd.picks); });
      var ranked = stats.filter(function(s) { return s.n >= CROWD_MIN; }).sort(function(a, b) { return b.pct - a.pct || b.n - a.n; });
      var unranked = stats.filter(function(s) { return s.n < CROWD_MIN; }).sort(function(a, b) { return b.n - a.n; });
      return { stats: stats, ranked: ranked, unranked: unranked };
    }

    // ── 🏅 Every season's Crowd (v130): standings, champions, friend careers ──
    // Finished seasons come from the script once per visit (every pick is public after the season).
    function pastCrowds() {
      if (!PICKS_URL) return Promise.resolve([]);
      if (!CROWD.past) CROWD.past = Promise.all(SEASONS.filter(function(s) { return s.year !== CURRENT_YEAR; }).map(function(s) {
        return picksApi({ action: 'crowd', season: s.year }).then(function(d) { return { year: s.year, crowd: d && !d.error ? d : {} }; }).catch(function() { return { year: s.year, crowd: {} }; });
      })).then(function(list) { return list.filter(function(x) { return (x.crowd.friends || []).length && (x.crowd.picks || []).length; }); });
      return CROWD.past;
    }
    // [{ year, crowd, G, R, final, champ, leader }] newest first, only seasons friends played in
    function crowdSeasons() {
      return Promise.all([getCrowd(), fetchSheet('Winnings', 'A1:Q400'), pastCrowds(), loadAllBets()]).then(function(r) {
        var list = [{ year: CURRENT_YEAR, crowd: r[0] || {}, raw: r[1] }].concat(r[2].map(function(x) { return { year: x.year, crowd: x.crowd, raw: SEASON_RAW[x.year] || [] }; }));
        return list.filter(function(x) { return (x.crowd.friends || []).length; }).map(function(x) {
          var G = crowdGames(x.raw), R = rankFriends({ friends: x.crowd.friends || [], picks: x.crowd.picks || [] }, G), fin = x.year !== CURRENT_YEAR;
          return { year: x.year, crowd: x.crowd, G: G, R: R, final: fin, champ: fin && R.ranked[0] ? R.ranked[0] : null, leader: R.ranked[0] || null };
        }).sort(function(a, b) { return b.year - a.year; });
      });
    }

    // ── 🏅 Crowd tab ────────────────────────────────────────────────────────
    function loadCrowdTab() {
      var el = document.getElementById('crowd-content');
      if (!el.innerHTML) el.innerHTML = '<div class="loading">Loading the crowd…</div>';
      var yr = CROWD.view || CURRENT_YEAR, past = yr !== CURRENT_YEAR;
      var src = past
        ? Promise.all([pastCrowds(), loadAllBets()]).then(function(r) { var x = r[0].filter(function(c) { return c.year === yr; })[0]; return [x ? x.crowd : { friends: [], picks: [] }, SEASON_RAW[yr] || []]; })
        : Promise.all([getCrowd(), fetchSheet('Winnings', 'A1:Q400')]);
      src.then(function(res) {
        var crowd = res[0], G = crowdGames(res[1]);
        var h = '<div class="u-center u-mb-m"><div class="ui-big">🏅 The Crowd' + (past ? ' · ' + yr : '') + '</div>' +
          '<div class="ui-note u-mt-xs">' + (past ? 'Final standings. Ranked by win % (' + CROWD_MIN + '+ games to qualify).' : 'Friends make their own picks each game. Ranked by win % (' + CROWD_MIN + '+ games to qualify). Picks show at kickoff.') + '</div></div>' +
          '<div id="cr-seasons"></div>';
        if (!crowd.friends || !crowd.friends.length) { el.innerHTML = h + '<div class="loading">No friends have joined yet.</div>'; crowdSeasonChips(yr); return; }
        var R = rankFriends(crowd, G);
        var ref = ['Maria', 'Danielle'].map(function(n) { var s = mdStats(n, G); s.ref = true; return s; });

        // Leaderboard, with Maria and Danielle slotted in as reference rows
        var board = R.ranked.concat(ref).sort(function(a, b) { return b.pct - a.pct || b.n - a.n; });
        var rank = 0;
        if (past && R.ranked[0]) h += '<div class="cr-champ" style="--pc:' + fStyle(R.ranked[0].name).color + '">🏅 <span>' + yr + ' Crowd Champion</span> <b>' + fName(R.ranked[0].name) + '</b> <small>' + R.ranked[0].w + '–' + (R.ranked[0].n - R.ranked[0].w) + ' · ' + pctTxt(R.ranked[0].pct) + '</small></div>';
        h += '<div class="ui-small u-right u-mb-xs">Tap a name to see their profile</div><table class="cr-table"><tr><th>#</th><th>Name</th><th>Record</th><th>Win %</th><th>Streak</th></tr>';
        board.forEach(function(s) {
          var c = s.ref ? (personColor(s.name)) : FRIEND_COLOR;
          if (!s.ref) rank++;
          h += '<tr class="' + (s.ref ? 'ref' : '') + '"><td>' + (s.ref ? '' : (rank === 1 ? (past ? '🏅' : '👑') : rank)) + '</td>' +
            '<td style="font-weight:700;color:' + c + '">' + (s.ref ? '<a class="fr-link" data-fname="' + s.name + '" style="color:' + c + '">' + s.name + '</a> <span class="ui-tiny">(for reference)</span>' : fName(s.name)) + '</td>' +
            '<td>' + s.w + '–' + (s.n - s.w) + '</td><td class="u-xbold">' + pctTxt(s.pct) + '</td><td>' + streakTxt(s.cur) + '</td></tr>';
        });
        h += '</table>';
        if (R.unranked.length) {
          h += '<div class="ui-label u-mt">UNRANKED (UNDER ' + CROWD_MIN + ' GAMES)</div>' +
            R.unranked.map(function(s) {
              return '<div class="adm-row"><span class="u-bold">' + fName(s.name) + '</span><span class="u-muted">' + s.w + '–' + (s.n - s.w) + ' · ' + s.n + ' game' + (s.n === 1 ? '' : 's') + '</span></div>';
            }).join('');
        }

        // 📈 The Market (js/market.js, loaded when this tab opens)
        if (!past) h += '<div id="market-slot" class="u-mt-l"></div>';

        // Weekly best
        var weeks = {};
        R.stats.forEach(function(s) {
          Object.keys(s.weeks).forEach(function(w) {
            var W = weeks[w] || (weeks[w] = { best: 0, who: [] });
            if (s.weeks[w].w > W.best) { W.best = s.weeks[w].w; W.who = [s.name]; }
            else if (s.weeks[w].w === W.best && W.best > 0) W.who.push(s.name);
          });
        });
        var wkKeys = Object.keys(weeks).filter(function(w) { return weeks[w].best > 0; }).sort(function(a, b) { return b - a; });
        if (wkKeys.length) {
          h += '<div class="u-mt-l pf-h">🗓️ Weekly Best</div>' + moreList(wkKeys.map(function(w) {
            return '<div class="adm-row"><span class="u-muted">' + weekName(w) + '</span><span><b>' + weeks[w].who.map(fName).join(' & ') + '</b> · ' + weeks[w].best + ' hit' + (weeks[w].best > 1 ? 's' : '') + '</span></div>';
          }), 5);
        }

        // Game by game (only games that have kicked off)
        var byGame = {};
        crowd.picks.forEach(function(p) { (byGame[p.week + '_' + p.game] = byGame[p.week + '_' + p.game] || []).push(p); });
        var gKeys = Object.keys(byGame).filter(function(k) { return G[k]; }).sort(function(a, b) { return G[b].week - G[a].week || G[b].game - G[a].game; });
        if (gKeys.length) {
          h += '<div class="u-mt-l pf-h">🏈 Game by Game</div>';
          h += moreList(gKeys.map(function(k) {
            var g = G[k], sk = playerKey(g.scorer);
            function pk(p, team) {
              var hit = g.scorer && playerKey(p) === sk;
              return '<span style="' + (hit ? 'color:#34D399;font-weight:800' : '') + '">' + escHtml(p) + (hit ? ' ✅' : '') + '</span>';
            }
            return '<div class="sch-game"><div class="sch-top"><span class="sch-slot">' + weekName(g.week) + ' · ' + escHtml(g.slot) + '</span>' +
              '<span class="sch-ko">' + (g.scorer ? '🏈 ' + escHtml(g.scorer) : '⏳ In progress') + '</span></div>' +
              '<div class="sch-teams">' + teamPill(g.home, g.home) + ' <span class="u-faint">vs</span> ' + teamPill(g.away, g.away) + '</div>' +
              byGame[k].map(function(p) {
                return '<div class="ui-note-plain"><b>' + fName(p.friend) + '</b> · ' + pk(p.homePick) + ' / ' + pk(p.awayPick) + '</div>';
              }).join('') + '</div>';
          }), 6);
        }
        el.innerHTML = h;
        crowdSeasonChips(yr);
        if (!past) loadScriptOnce('js/market.js').then(function() { renderMarket(document.getElementById('market-slot'), {}); }).catch(function() {});
      }).catch(function() { el.innerHTML = '<div class="loading">Couldn\'t load the crowd right now.</div>'; });
    }

    // Season chips on the Crowd tab, only once there's a finished season friends played in
    function crowdSeasonChips(yr) {
      pastCrowds().then(function(list) {
        var box = document.getElementById('cr-seasons');
        if (!box || !list.length) return;
        var years = [CURRENT_YEAR].concat(list.map(function(x) { return x.year; }).sort().reverse());
        box.innerHTML = '<div class="af-bar u-mb"><span class="af-bar-label">Season</span>' + years.map(function(y) {
          return '<button class="filter-btn' + (y === yr ? ' active' : '') + '" data-cr-y="' + y + '">' + y + '</button>';
        }).join('') + '</div>';
        box.querySelectorAll('[data-cr-y]').forEach(function(b) { b.addEventListener('click', function() { CROWD.view = b.getAttribute('data-cr-y'); loadCrowdTab(); }); });
      }).catch(function() {});
    }

    // 🏠 Home: how the Crowd's picks are doing next to Maria's and Danielle's on the same games (v130)
    function renderCrowdLine() {
      var el = document.getElementById('crowd-line');
      if (!el || !PICKS_URL) return;
      Promise.all([getCrowd(), fetchSheet('Winnings', 'A1:Q400')]).then(function(r) {
        var crowd = r[0] || {}, G = crowdGames(r[1]), c = { w: 0, n: 0 }, games = {};
        (crowd.picks || []).forEach(function(p) {
          var g = G[p.week + '_' + p.game]; if (!g || !g.scorer || g.notOffered) return;
          var k = playerKey(g.scorer);
          c.n++; if (playerKey(p.homePick) === k || playerKey(p.awayPick) === k) c.w++;
          games[g.key] = g;
        });
        if (!c.n) { el.style.display = 'none'; return; }
        function md(who) { var w = 0, n = 0; Object.keys(games).forEach(function(k) { var x = games[k].mdCorrect[who]; if (x === 'Yes' || x === 'No') { n++; if (x === 'Yes') w++; } }); return n ? pctTxt(w / n) : '—'; }
        var R = rankFriends({ friends: crowd.friends || [], picks: crowd.picks || [] }, G), top = R.ranked[0];
        el.innerHTML = '🏅 <b class="u-c-warn">The Crowd</b> hits ' + pctTxt(c.w / c.n) + ' <span class="u-c-muted">(' + c.w + ' of ' + c.n + ')</span> · ' +
          '<button class="link-btn" onclick="switchTab(\'crowd\')">vs Maria ' + md('Maria') + ' & Danielle ' + md('Danielle') + ' on the same games' + (top ? ' · 👑 ' + escHtml(top.name) : '') + ' →</button>';
        el.style.display = '';
      }).catch(function() {});
    }

    // Live Picks: "👥 N friends have picked"
    function addCrowdLines(root) {
      getCrowd().then(function(crowd) {
        root.querySelectorAll('.live-game[data-wg]').forEach(function(g) {
          var n = (crowd.counts || {})[g.getAttribute('data-wg')] || 0;
          var old = g.querySelector('.cr-line'); if (old) old.remove();
          if (!n) return;
          var title = g.querySelector('.live-game-title');
          title.insertAdjacentHTML('afterend', '<div class="cr-line">👥 ' + n + ' friend' + (n > 1 ? 's have' : ' has') + ' picked this game</div>');
        });
      }).catch(function() {});
    }
